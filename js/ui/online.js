// Partida con amigos: crear una sala y pasar el código, o unirse con el que te han pasado.
import { legalDeck } from '../core/collection.js';
import { CODE_LENGTH, cleanRoomCode, newRoomCode, openRoom } from '../online.js';
import { app, getProfile, go, onTap, toast, topBar } from './store.js';
import { icon } from './icons.js';

const JOIN_TRIES = 40; // el anfitrión puede tardar en volver a la app tras enviar el código por otra
const SEND_EVERY = 2; // reintentos: quien entra por primera vez no sabe si el anfitrión le ha oído

const waitingHtml = (code, text) => `
  <section class="screen top">
    ${topBar('Amigos', 'online')}
    <div class="panel online-wait">
      <h3>Código de sala</h3>
      <p class="room-code" aria-label="Código ${code.split('').join(' ')}">${code}</p>
      <p class="sub"><span class="dot-wait"></span>${text}</p>
      <button class="btn small ghost" data-act="share">Compartir código</button>
    </div>
  </section>`;

const stillHere = () => {
  const el = app.querySelector('.online-wait');
  return () => el?.isConnected;
};

function start(room, seat, m) {
  room.setPeer(seat === 0 ? m.guest : m.from);
  go('battle', { room, seat, decks: m.decks, seed: m.seed, first: m.first });
}

async function host() {
  const code = newRoomCode();
  app.innerHTML = waitingHtml(code, 'Pásale el código a tu amigo y espera aquí.');
  onTap((el) => {
    if (el.closest('[data-act="share"]')) share(code);
  });
  const here = stillHere();
  const room = await openRoom(code);
  if (!room) return failed();
  while (here()) {
    const m = await room.receive(1000);
    if (m?.type !== 'hello' || !legalDeck(m.deck) || !here()) continue;
    const start_ = { type: 'start', guest: m.from, seed: crypto.getRandomValues(new Uint32Array(1))[0], first: Math.random() < 0.5 ? 0 : 1, decks: [getProfile().deck, m.deck] };
    await room.send(start_);
    return start(room, 0, start_);
  }
  room.close();
}

async function join(code) {
  app.innerHTML = waitingHtml(code, 'Buscando la sala…');
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
    return start(room, 1, m);
  }
  room.close();
  if (here()) {
    toast('No se encontró la sala, o ya está llena.');
    showOnline();
  }
}

function failed() {
  toast('No se pudo conectar. Comprueba tu conexión.');
  showOnline();
}

async function share(code) {
  const text = `Juega conmigo a DUSKFORGE. Código de sala: ${code}`;
  try {
    if (navigator.share) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(code);
      toast('Código copiado');
    }
  } catch { /* compartir cancelado */ }
}

export function showOnline() {
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Amigos', 'menu')}
      <div class="panel online-host">
        <h3>Crear sala</h3>
        <p class="sub">Te damos un código para que se lo pases a quien quieras.</p>
        <button class="btn gold" data-act="host">${icon('sword')}Crear sala</button>
      </div>
      <div class="panel online-join">
        <h3>Unirse a una sala</h3>
        <label class="field"><span class="sub">Código de ${CODE_LENGTH} letras</span>
          <input id="room-code" class="code-input" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="${CODE_LENGTH}"></label>
        <button class="btn" data-act="join">Unirse</button>
      </div>
      <p class="sub">Jugáis con vuestro mazo activo. No necesitas cuenta. Las amistosas no dan monedas, XP ni victorias.</p>
    </section>`;
  const input = app.querySelector('#room-code');
  input.addEventListener('input', () => (input.value = cleanRoomCode(input.value)));
  onTap((el) => {
    const act = el.closest('[data-act]')?.dataset.act;
    if (act === 'host') host();
    if (act !== 'join') return;
    if (input.value.length === CODE_LENGTH) join(input.value);
    else toast(`El código tiene ${CODE_LENGTH} letras`);
  });
}
