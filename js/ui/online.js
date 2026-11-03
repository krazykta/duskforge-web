// Partida con amigos. Con cuenta: nombre público, lista de amigos e invitaciones (decisión 41).
// shortcut: la sala por código sigue para quien no tiene cuenta; se quitará cuando las invitaciones estén probadas.
import { ACHIEVEMENTS, ARENA, COSMETICS, SEASON } from '../core/config.js';
import { arenaIndex } from '../core/arena.js';
import { COLLECTIBLE, RARITIES, RARITY_TEXT, legalDeck } from '../core/collection.js';
import { FRIENDS } from '../core/social.js';
import { CODE_LENGTH, cleanRoomCode, newRoomCode, openRoom } from '../online.js';
import { app, ask, currentScreen, friendsCall, getCloudUser, getProfile, go, onInvite, onTap, toast, topBar } from './store.js';
import { escapeHtml } from './account.js';
import { avatarHtml } from './avatar.js';
import { icon } from './icons.js';

const JOIN_TRIES = 40; // el anfitrión puede tardar en volver a la app tras enviar el código por otra
const SEND_EVERY = 2; // reintentos: quien entra por primera vez no sabe si el anfitrión le ha oído
let social = null; // { me, friends } de la última respuesta del servidor

const waitingHtml = (code, text, shown = true) => `
  <section class="screen top">
    ${topBar('Amigos', 'online')}
    <div class="panel online-wait">
      ${shown ? `<h3>Código de sala</h3>
      <p class="room-code" aria-label="Código ${code.split('').join(' ')}">${code}</p>` : '<h3>Partida con amigos</h3>'}
      <p class="sub"><span class="dot-wait"></span>${text}</p>
      ${shown ? '<button class="btn small ghost" data-act="share">Compartir código</button>' : ''}
    </div>
  </section>`;

const stillHere = () => {
  const el = app.querySelector('.online-wait');
  return () => el?.isConnected;
};

function start(room, seat, m, name) {
  room.setPeer(seat === 0 ? m.guest : m.from);
  go('battle', { room, seat, decks: m.decks, seed: m.seed, first: m.first, name });
}

// friend: { name } cuando la sala sale de una invitación; entonces el código no se enseña y se espera menos.
async function host(code = newRoomCode(), friend = null) {
  app.innerHTML = friend
    ? waitingHtml(code, `Esperando a que ${escapeHtml(friend.name)} acepte…`, false)
    : waitingHtml(code, 'Pásale el código a tu amigo y espera aquí.');
  onTap((el) => {
    if (el.closest('[data-act="share"]')) share(code);
  });
  const here = stillHere();
  const room = await openRoom(code);
  if (!room) return failed();
  const until = friend ? Date.now() + FRIENDS.inviteMs : Infinity;
  while (here() && Date.now() < until) {
    const m = await room.receive(1000);
    if (m?.type !== 'hello' || !legalDeck(m.deck) || !here()) continue;
    const start_ = { type: 'start', guest: m.from, seed: crypto.getRandomValues(new Uint32Array(1))[0], first: Math.random() < 0.5 ? 0 : 1, decks: [getProfile().deck, m.deck] };
    await room.send(start_);
    return start(room, 0, start_, friend?.name);
  }
  room.close();
  if (here()) {
    toast(`${friend.name} no ha respondido`);
    showOnline();
  }
}

async function join(code, name) {
  app.innerHTML = waitingHtml(code, 'Buscando la sala…', !name);
  onTap(() => {});
  const here = stillHere();
  const room = await openRoom(code);
  if (!room) return failed();
  const deck = getProfile().deck;
  for (let i = 0; i < JOIN_TRIES && here(); i++) {
    if (i % SEND_EVERY === 0) await room.send({ type: 'hello', deck });
    const m = await room.receive(1000);
    if (m?.type !== 'start' || m.guest !== room.id || !here()) continue;
    const fair = Number.isInteger(m.seed) && (m.first === 0 || m.first === 1) && Array.isArray(m.decks) && legalDeck(m.decks[0]) && String(m.decks[1]) === String(deck);
    if (!fair) break;
    return start(room, 1, m, name);
  }
  room.close();
  if (here()) {
    toast(name ? 'La partida ya no está disponible' : 'No se encontró la sala, o ya está llena.');
    showOnline();
  }
}

function failed() {
  toast('No se pudo conectar. Comprueba tu conexión.');
  showOnline();
}

async function share(code, text = `Juega conmigo a DUSKFORGE. Código de sala: ${code}`) {
  try {
    if (navigator.share) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(code);
      toast('Copiado');
    }
  } catch { /* compartir cancelado */ }
}

// Llega por Realtime (store.js) aunque estés en otra pantalla; en mitad de un combate no se interrumpe.
onInvite(async (inv) => {
  if (currentScreen() === 'battle' || Date.now() - new Date(inv.created_at) > FRIENDS.inviteMs) return;
  const name = inv.from_name.split('#')[0];
  if (await ask(`${escapeHtml(inv.from_name)} te invita a una partida.`, { yes: 'Jugar', no: 'Ahora no' })) {
    go('online');
    join(inv.code, name);
  }
});

// ---------- Pantallas ----------
const codeOf = (f) => `${f.name}#${f.tag}`;
const miniAvatar = (f) => avatarHtml({ avatar: f.avatar, cosmetics: { frame: f.frame } });

function friendRow(f) {
  const actions = f.accepted
    ? `<button class="btn small gold" data-invite="${f.id}">${icon('sword')}Invitar</button>`
    : f.incoming
      ? `<button class="btn small gold" data-accept="${f.id}">Aceptar</button><button class="btn small ghost" data-reject="${f.id}" aria-label="Rechazar">${icon('close')}</button>`
      : `<span class="sub">Pendiente</span><button class="btn small ghost" data-reject="${f.id}" aria-label="Cancelar petición">${icon('close')}</button>`;
  return `
    <li class="friend">
      <button class="friend-who" data-player="${f.id}">${miniAvatar(f)}<span><b>${escapeHtml(f.name)}</b><span class="sub">#${f.tag} · Nivel ${f.level}</span></span></button>
      <span class="friend-act">${actions}</span>
    </li>`;
}

function friendsHtml() {
  if (!getCloudUser()) {
    return `<div class="panel"><h3>Lista de amigos</h3>
      <p class="sub">Con una cuenta tienes nombre de jugador, añades amigos, ves sus perfiles y los invitas a jugar.</p>
      <button class="btn small gold" data-go="auth">Entrar o crear cuenta</button></div>`;
  }
  if (!social) return '<div class="panel"><p class="sub">Cargando tus amigos…</p></div>';
  if (!social.me) {
    return `<div class="panel"><h3>Elige tu nombre de jugador</h3>
      <p class="sub">Es lo que verán tus amigos. Te daremos un número para que te encuentren: Nombre#1234.</p>
      <label class="field"><span class="sub">De 3 a 16 letras o números, sin espacios</span>
        <input id="player-name" class="text-input" maxlength="16" autocomplete="nickname" spellcheck="false"></label>
      <button class="btn gold wide" data-act="name">Guardar nombre</button></div>`;
  }
  const incoming = social.friends.filter((f) => !f.accepted && f.incoming);
  const friends = social.friends.filter((f) => f.accepted);
  const sent = social.friends.filter((f) => !f.accepted && !f.incoming);
  const list = (title, rows) => (rows.length ? `<h3>${title} <span class="sub">(${rows.length})</span></h3><ul class="friend-list">${rows.map(friendRow).join('')}</ul>` : '');
  return `
    <div class="panel friend-me">
      <span><span class="sub">Tu código de amigo</span><b class="my-code">${escapeHtml(codeOf(social.me))}</b></span>
      <button class="btn small ghost" data-act="share-me">Compartir</button>
    </div>
    <div class="panel">
      <h3>Añadir amigo</h3>
      <label class="field"><span class="sub">Su código, por ejemplo Lobo#1234</span>
        <input id="friend-code" class="text-input" maxlength="21" autocomplete="off" spellcheck="false"></label>
      <button class="btn wide" data-act="add">${icon('heart')}Enviar petición</button>
    </div>
    <div class="panel">
      ${list('Peticiones recibidas', incoming)}
      ${friends.length ? list('Amigos', friends) : '<h3>Amigos</h3><p class="sub">Aún no tienes amigos. Pásales tu código o pídeles el suyo.</p>'}
      ${list('Peticiones enviadas', sent)}
    </div>`;
}

export function showOnline() {
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Amigos', 'modes')}
      <div class="friends-area">${friendsHtml()}</div>
      <details class="panel online-code">
        <summary><b>Sala con código</b><span class="sub">Para jugar sin cuenta</span></summary>
        <button class="btn gold" data-act="host">${icon('sword')}Crear sala</button>
        <label class="field"><span class="sub">O únete con un código de ${CODE_LENGTH} letras</span>
          <input id="room-code" class="code-input" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="${CODE_LENGTH}"></label>
        <button class="btn" data-act="join">Unirse</button>
      </details>
      <p class="sub">Jugáis con vuestro mazo activo. Las amistosas no dan monedas, XP ni victorias.</p>
    </section>`;
  const area = app.querySelector('.friends-area');
  const paint = (r) => {
    if (r?.error) toast(r.error);
    if (r?.me !== undefined) social = { me: r.me, friends: r.friends };
    if (area.isConnected) area.innerHTML = friendsHtml();
  };
  if (getCloudUser()) friendsCall('social').then((r) => paint(r.offline ? { error: r.error } : r));
  const input = app.querySelector('#room-code');
  input.addEventListener('input', () => (input.value = cleanRoomCode(input.value)));
  onTap(async (el) => {
    const act = el.closest('[data-act]')?.dataset.act;
    const id = (key) => el.closest(`[data-${key}]`)?.dataset[key];
    if (act === 'host') return host();
    if (act === 'join') return input.value.length === CODE_LENGTH ? join(input.value) : toast(`El código tiene ${CODE_LENGTH} letras`);
    if (act === 'share-me') return share(codeOf(social.me), `Agrégame en DUSKFORGE: ${codeOf(social.me)}`);
    if (act === 'name') return paint(await friendsCall('setName', { name: app.querySelector('#player-name').value }));
    if (act === 'add') {
      const r = await friendsCall('addFriend', { code: app.querySelector('#friend-code').value });
      if (r.message) toast(r.message);
      return paint(r);
    }
    if (id('player')) return go('player', id('player'));
    if (id('accept')) return paint(await friendsCall('answerFriend', { id: id('accept'), accept: true }));
    if (id('reject')) return paint(await friendsCall('answerFriend', { id: id('reject'), accept: false }));
    if (id('invite')) return invite(social.friends.find((f) => f.id === id('invite')));
  });
}

async function invite(friend) {
  const r = await friendsCall('invite', { id: friend.id });
  if (r.error) return toast(r.error);
  host(r.code, friend);
}

// Perfil de un amigo (o de quien te ha pedido amistad): lo que devuelve publicProfile en core/social.js.
export async function showPlayer(id) {
  app.innerHTML = `<section class="screen top">${topBar('Perfil', 'online')}<div class="player-area"><p class="sub">Cargando…</p></div></section>`;
  const r = await friendsCall('viewPlayer', { id });
  const area = app.querySelector('.player-area');
  if (!area) return;
  if (r.error) {
    area.innerHTML = `<p class="warn">${escapeHtml(r.error)}</p>`;
    return;
  }
  const p = r.player;
  const title = COSMETICS.find((c) => c.id === p.title)?.name;
  const played = p.wins + p.losses;
  const stat = (n, label) => `<span><b>${n}</b><small>${label}</small></span>`;
  const row = (label, n, total, cls = '') => `<div class="progress-row"><span class="${cls}">${label}</span><b>${n}${total ? ` / ${total}` : ''}</b></div>`;
  area.innerHTML = `
    <div class="panel profile-card ${p.banner ? `banner c-${p.banner}` : ''}">
      <span class="avatar-btn">${avatarHtml({ avatar: p.avatar, cosmetics: { frame: p.frame } }, 'big')}<span class="lvl"><b>${p.level}</b></span></span>
      <span class="summary-text">
        <b>${escapeHtml(p.name)}<span class="sub"> #${p.tag}</span></b>
        ${title ? `<span class="sub">${title}</span>` : ''}
        <span class="sub">Nivel ${p.level}</span>
      </span>
    </div>
    <div class="panel">
      <h3>Combates</h3>
      <div class="profile-stats">${stat(played, 'Partidas')}${stat(p.wins, 'Victorias')}${stat(p.losses, 'Derrotas')}${stat(played ? `${Math.round((p.wins / played) * 100)} %` : '–', 'Ganadas')}</div>
      ${row(`Arena · ${ARENA.arenas[arenaIndex(p.trophies)].name}`, `${icon('trophy')}${p.trophies}`)}
    </div>
    <div class="panel">
      <h3>Colección y logros</h3>
      ${row('Cartas distintas', p.cards.all, COLLECTIBLE.length)}
      ${RARITIES.map((x) => row(RARITY_TEXT[x], p.cards[x], COLLECTIBLE.filter((c) => c.rarity === x).length, `t-${x}`)).join('')}
      ${row('Brillantes', p.foils)}
      ${row('Logros', p.achievements, ACHIEVEMENTS.length)}
      ${row(`Pase «${SEASON.name}»`, p.passTier, SEASON.tiers.length)}
    </div>
    ${p.accepted ? `<button class="btn gold" data-act="invite">${icon('sword')}Invitar a una partida</button>
    <button class="btn small ghost profile-more" data-act="remove">Quitar de amigos</button>` : ''}`;
  onTap(async (el) => {
    const act = el.closest('[data-act]')?.dataset.act;
    if (act === 'invite') {
      go('online');
      return invite(p);
    }
    if (act === 'remove' && await ask(`¿Quitar a ${escapeHtml(p.name)} de tus amigos?`, { yes: 'Quitar', danger: true })) {
      await friendsCall('answerFriend', { id, accept: false });
      go('online');
    }
  });
}
