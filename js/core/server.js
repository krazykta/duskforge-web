// Reglas del servidor (supabase/functions/game). El móvil solo pide acciones: el servidor pone la hora, el azar y las cuentas.
// No hay ningún secreto aquí: las claves viven en la función de Supabase.
import { AI_DECKS, API_VERSION, ECONOMY, MAIL, SEASON } from './config.js';
import { claimMatchRewards, newProfile, PROFILE_VERSION, sanitizeProfile } from './progression.js';
import { refreshMissions } from './missions.js';
import { claimMail } from './collection.js';
import { isAction, runAction } from './actions.js';
import { replayMatch } from './replay.js';

const SAVE_TRIES = 5;
const MIN_MS_PER_TURN = 150; // pasar turno sin parar con el rival rápido no baja de aquí: menos que esto solo lo hace un programa
const MAX_BODY = 200000; // una partida de MAX_MOVES jugadas cabe de sobra
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// shortcut: límite por cuenta en Postgres (0007), provisional hasta pasar a un VPS; no protege la cuota de llamadas de Supabase.
const PER_MINUTE = 120; // jugando normal no se pasa de unas pocas por minuto

const randomUint = () => crypto.getRandomValues(new Uint32Array(1))[0];
const random = () => randomUint() / 2 ** 32;

// db: getProfile, insertProfile, saveProfile, owned, startMatch, getMatch, closeMatch, mail, hit (ver supabase/functions/game/index.ts).
export function createGame({ db, clock = () => new Date(), rng = random, perMinute = PER_MINUTE }) {
  async function read(uid) {
    const row = await db.getProfile(uid) ?? await db.insertProfile(uid, newProfile());
    if (row.data.version > PROFILE_VERSION) throw new Error('perfil más nuevo que esta función'); // sanitizeProfile lo pondría a cero
    return { rev: row.rev, profile: refreshMissions(sanitizeProfile(row.data), clock()) };
  }

  // Aplica un cambio sobre la última versión; si otra petición guardó a la vez, vuelve a empezar con la suya.
  async function change(uid, fn) {
    for (let i = 0; i < SAVE_TRIES; i++) {
      const { rev, profile } = await read(uid);
      const r = fn(profile);
      if (r.error || r.profile === profile) return { ...r, profile };
      if (await db.saveProfile(uid, r.profile, rev)) return r;
    }
    throw new Error('demasiados guardados a la vez');
  }

  // Con id null la partida se juega igual, sin recompensa: se ha llegado al tope del día.
  async function startMatch(uid) {
    const { profile } = await read(uid);
    const match = { seed: randomUint(), first: randomUint() % 2, rival: randomUint() % AI_DECKS.length, deck: profile.deck };
    return { match: { ...match, id: await db.startMatch(uid, match, ECONOMY.dailyMatches) } };
  }

  async function finishMatch(uid, { id, moves }) {
    const m = typeof id === 'string' && UUID.test(id) ? await db.getMatch(uid, id) : null;
    if (!m) return { error: 'Partida no encontrada' };
    if (m.finished_at) return { profile: (await read(uid)).profile }; // reenviada tras perderse la respuesta
    const r = replayMatch(m, moves);
    const now = clock();
    if (r.error || now - new Date(m.started_at) < r.turns * MIN_MS_PER_TURN) {
      await db.closeMatch(uid, id);
      return { error: 'Esta partida no se pudo verificar' };
    }
    // Se paga antes de cerrar y claimMatchRewards es idempotente: un fallo entre medias se arregla reenviando.
    const done = r.counts ? await change(uid, (p) => claimMatchRewards(p, id, r.won, now, r.stats)) : { profile: (await read(uid)).profile };
    await db.closeMatch(uid, id);
    return { profile: done.profile, rewards: done.rewards ?? null };
  }

  // El mensaje se busca entre los de este jugador: un id ajeno o caducado no sirve aunque exista.
  async function collectMail(uid, id) {
    const mail = (await db.mail(uid, MAIL.shown)).find((m) => m.id === id);
    if (!mail) return { error: 'Este mensaje ya no está disponible' };
    return change(uid, (p) => claimMail(p, mail, { now: clock(), rng }));
  }

  // body: { v, op, args }. Los errores de juego se devuelven; los de infraestructura se lanzan.
  return async function handle(uid, body) {
    if (!(await db.hit(uid, perMinute))) return { error: 'Vas demasiado rápido: espera un minuto', code: 'busy' };
    if (body?.v !== API_VERSION) return { error: 'Actualiza el juego para seguir', code: 'update' };
    const { op, args } = body;
    if (op === 'load') return { profile: (await read(uid)).profile, owned: await db.owned(uid) };
    if (op === 'startMatch') return startMatch(uid);
    if (op === 'finishMatch') return finishMatch(uid, args ?? {});
    if (op === 'mail') return { mail: await db.mail(uid, MAIL.shown) };
    if (op === 'claimMail') return collectMail(uid, args?.id);
    if (!isAction(op)) return { error: 'Acción no válida' };
    const owned = op === 'claimTier' && (await db.owned(uid)).includes(SEASON.sku);
    return change(uid, (p) => runAction(p, op, args, { now: clock(), rng, owned }));
  };
}

// La parte HTTP: autentica, limita el tamaño y nunca deja escapar un error interno.
export function httpHandler({ handle, userOf, origins }) {
  return async (req) => {
    const origin = req.headers.get('origin');
    const cors = {
      'Access-Control-Allow-Origin': origins.includes(origin) ? origin : origins[0],
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return reply({ error: 'Método no permitido' }, 405);
    try {
      const uid = await userOf(req.headers.get('authorization')?.replace(/^Bearer /, ''));
      if (!uid) return reply({ error: 'Vuelve a entrar en tu cuenta', code: 'auth' }, 401);
      const text = await req.text();
      if (text.length > MAX_BODY) return reply({ error: 'Demasiados datos' }, 413);
      const r = await handle(uid, JSON.parse(text));
      return reply(r, r.code === 'busy' ? 429 : 200); // el juego trata el 429 como falta de red y reintenta más tarde
    } catch (err) {
      if (err instanceof SyntaxError) return reply({ error: 'Petición no válida' }, 400);
      console.error(err);
      return reply({ error: 'El servidor no ha podido responder' }, 500);
    }
  };
}
