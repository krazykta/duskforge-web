// Reglas del servidor (supabase/functions/game). El móvil solo pide acciones: el servidor pone la hora, el azar y las cuentas.
// No hay ningún secreto aquí: las claves viven en la función de Supabase.
import { AI_DECKS, AI_FULL_LEVEL, API_VERSION, ARENA, DAILY, ECONOMY, MAIL, SEASON, TOURNAMENT } from './config.js';
import { arenaIndex, claimArena, validFoeDeck } from './arena.js';
import { claimDaily, dailyChallenge, ownTurns } from './daily.js';
import { claimForgeMatch, forgeOver, forgeTrophies, markForgeStart } from './forge.js';
import { claimMatchRewards, levelOf, localDay, newProfile, PROFILE_VERSION, sanitizeProfile } from './progression.js';
import { refreshMissions, weekKey } from './missions.js';
import { claimMail } from './collection.js';
import { isAction, runAction } from './actions.js';
import { replayMatch } from './replay.js';
import { FRIENDS, cleanName, parseFriendCode, publicProfile } from './social.js';

const SAVE_TRIES = 5;
const MIN_MS_PER_TURN = 150; // pasar turno sin parar con el rival rápido no baja de aquí: menos que esto solo lo hace un programa
const MAX_BODY = 200000; // una partida de MAX_MOVES jugadas cabe de sobra
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// shortcut: límite por cuenta en Postgres (0007), provisional hasta pasar a un VPS; no protege la cuota de llamadas de Supabase.
const PER_MINUTE = 120; // jugando normal no se pasa de unas pocas por minuto

const randomUint = () => crypto.getRandomValues(new Uint32Array(1))[0];
const random = () => randomUint() / 2 ** 32;
const ROOM_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomCode = () => Array.from({ length: 12 }, () => ROOM_LETTERS[randomUint() % ROOM_LETTERS.length]).join(''); // solo lo saben los dos
const FRIEND_TEXT = {
  sent: 'Petición enviada', accepted: '¡Ya sois amigos!', already: 'Ya le habías enviado una petición', self: 'Ese eres tú',
  not_found: 'No hay nadie con ese nombre y número', limit: `Tienes el máximo de ${FRIENDS.max} amigos y peticiones`, no_name: 'Elige antes tu nombre',
};

// db: getProfile, insertProfile, saveProfile, owned, startMatch, getMatch, closeMatch, mail, hit,
// setName, social, addFriend, answerFriend, related, invite, arenaRival, dailyRecord, dailyBoard,
// tournamentAdd, tournamentBoard, tournamentPay (ver supabase/functions/game/index.ts).
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
  // En la Arena el rival es el mazo de otro jugador (o la IA si no hay nadie cerca) y los trofeos en juego se quitan ya.
  // En el reto diario la partida es la del día (core/daily.js), igual para todos y con el rival a vida normal.
  // En el Desafío de la Forja el rival sale de la Arena, más fuerte con cada victoria, y se apunta ya una derrota.
  async function startMatch(uid, { arena = false, daily = false, forge = false } = {}) {
    const { profile } = await read(uid);
    const match = { seed: randomUint(), first: randomUint() % 2, rival: randomUint() % AI_DECKS.length, deck: profile.deck, level: levelOf(profile.xp), arena, foe: null, stake: 0, daily: null, forge: null };
    const foeNear = async (trophies) => {
      const found = await db.arenaRival(uid, trophies, ARENA.spread);
      return found && validFoeDeck(found.deck) ? { deck: found.deck, name: found.name ?? null, trophies: found.trophies } : null;
    };
    if (daily) {
      const c = dailyChallenge(localDay(clock()));
      Object.assign(match, { seed: c.seed, first: c.first, rival: c.rival, deck: c.deck, level: AI_FULL_LEVEL, arena: false, daily: c.day });
    } else if (forge) {
      if (!profile.forge || forgeOver(profile.forge)) return { error: 'No tienes un desafío en marcha' };
      Object.assign(match, { arena: false, foe: await foeNear(forgeTrophies(profile.forge)), level: AI_FULL_LEVEL, forge: profile.forge.run });
    } else if (arena) {
      match.foe = await foeNear(profile.trophies);
      match.level = AI_FULL_LEVEL;
      match.stake = Math.min(ARENA.loss, profile.trophies);
    }
    const id = await db.startMatch(uid, match, ECONOMY.dailyMatches);
    if (id && match.stake) await change(uid, (p) => ({ profile: { ...p, trophies: Math.max(0, p.trophies - match.stake) } }));
    if (id && match.forge) await change(uid, (p) => markForgeStart(p, match.forge));
    return { match: { ...match, id } };
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
    const day = m.daily; // 'YYYY-MM-DD' o null
    const claim = (p) => {
      const c = claimMatchRewards(p, id, r.won, now, r.stats);
      if (day) return claimDaily(c, day, r.won);
      if (m.forge) return claimForgeMatch(c, m.forge, r.won);
      return m.arena ? claimArena(c, m.stake, r.won) : c;
    };
    const done = r.counts ? await change(uid, claim) : { profile: (await read(uid)).profile };
    const turns = ownTurns(r.turns, m.first);
    if (day && r.won) await db.dailyRecord(uid, day, turns); // también sin recompensa: la marca vale aunque se pase del tope
    const points = m.arena && r.won && r.counts ? TOURNAMENT.points[arenaIndex(done.profile.trophies)] : 0;
    if (points) await db.tournamentAdd(uid, weekKey(now), points);
    await db.closeMatch(uid, id);
    const rewards = done.rewards && points ? { ...done.rewards, tournament: points } : done.rewards ?? null;
    return { profile: done.profile, rewards, ...(day && r.won && { daily: { day, turns } }) };
  }

  // shortcut: solo paga la semana anterior; si una semana entera nadie abre el juego, la de antes se queda sin pagar.
  const payLastWeek = () => db.tournamentPay(weekKey(new Date(clock().getTime() - 7 * 864e5)), TOURNAMENT.prizes);

  // El mensaje se busca entre los de este jugador: un id ajeno o caducado no sirve aunque exista.
  async function collectMail(uid, id) {
    const mail = (await db.mail(uid, MAIL.shown)).find((m) => m.id === id);
    if (!mail) return { error: 'Este mensaje ya no está disponible' };
    return change(uid, (p) => claimMail(p, mail, { now: clock(), rng }));
  }

  // Amigos: nunca sale el perfil entero de otro jugador, solo publicProfile.
  async function social(uid) {
    const { me, friends } = await db.social(uid);
    return { me, friends: friends.map(({ data, ...f }) => ({ ...f, ...publicProfile(data) })) };
  }

  async function friendOp(uid, op, args = {}) {
    if (op === 'social') return social(uid);
    if (op === 'setName') {
      const name = cleanName(args.name);
      if (!name) return { error: 'De 3 a 16 letras o números, sin espacios' };
      if (!(await db.setName(uid, name))) return { error: 'Ese nombre está muy cogido: prueba otro' };
      return social(uid);
    }
    if (op === 'addFriend') {
      const code = parseFriendCode(args.code);
      if (!code) return { error: 'Escribe el nombre y el número así: Nombre#1234' };
      const status = await db.addFriend(uid, code.name, code.tag, FRIENDS.max);
      if (status !== 'sent' && status !== 'accepted') return { error: FRIEND_TEXT[status] };
      return { ...(await social(uid)), message: FRIEND_TEXT[status] };
    }
    if (typeof args.id !== 'string' || !UUID.test(args.id)) return { error: 'Jugador no encontrado' };
    if (op === 'answerFriend') {
      await db.answerFriend(uid, args.id, args.accept === true);
      return social(uid);
    }
    if (op === 'viewPlayer') {
      const r = await db.related(uid, args.id);
      if (!r) return { error: 'Solo puedes ver el perfil de tus amigos' };
      const { data, ...who } = r;
      return { player: { ...who, ...publicProfile(data) } };
    }
    const code = roomCode(); // invite
    if (!(await db.invite(uid, args.id, code))) return { error: 'Solo puedes invitar a tus amigos' };
    return { code };
  }

  // body: { v, op, args }. Los errores de juego se devuelven; los de infraestructura se lanzan.
  return async function handle(uid, body) {
    if (!(await db.hit(uid, perMinute))) return { error: 'Vas demasiado rápido: espera un minuto', code: 'busy' };
    if (body?.v !== API_VERSION) return { error: 'Actualiza el juego para seguir', code: 'update' };
    const { op, args } = body;
    if (op === 'load') return { profile: (await read(uid)).profile, owned: await db.owned(uid) };
    if (op === 'startMatch') return startMatch(uid, { arena: args?.arena === true, daily: args?.daily === true, forge: args?.forge === true });
    if (op === 'dailyBoard') {
      const day = localDay(clock());
      return { day, ...(await db.dailyBoard(uid, day, DAILY.top)) };
    }
    if (op === 'tournamentBoard') {
      await payLastWeek();
      const week = weekKey(clock());
      return { week, ...(await db.tournamentBoard(uid, week, TOURNAMENT.top)) };
    }
    if (op === 'finishMatch') return finishMatch(uid, args ?? {});
    if (op === 'mail') {
      await payLastWeek(); // el buzón se mira al abrir el juego: así el premio llega el lunes sin tareas programadas
      return { mail: await db.mail(uid, MAIL.shown) };
    }
    if (op === 'claimMail') return collectMail(uid, args?.id);
    if (['social', 'setName', 'addFriend', 'answerFriend', 'viewPlayer', 'invite'].includes(op)) return friendOp(uid, op, args ?? {});
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
