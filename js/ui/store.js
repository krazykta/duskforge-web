// Estado compartido de la interfaz: perfil guardado, navegación entre pantallas,
// toques y piezas visuales reutilizables.
import { newProfile, sanitizeProfile } from '../core/progression.js';
import { refreshMissions, claimableCount } from '../core/missions.js';
import { claimableAchievements } from '../core/achievements.js';
import { claimableTiers } from '../core/pass.js';
import { SEASON } from '../core/config.js';
import { cardText } from '../core/cards.js';
import { RARITY_TEXT } from '../core/collection.js';
import { runAction } from '../core/actions.js';
import { callGame } from '../cloud.js';
import { listenInvites } from '../online.js';
import { CARD_ART } from './card-art.js';
import { music } from './sound.js';
import { icon } from './icons.js';

export const app = document.getElementById('app');
// 100dvh puede medir más que lo visible en la PWA de Android y esconder la mano tras la barra del sistema.
const fitHeight = () => document.documentElement.style.setProperty('--app-h', `${innerHeight}px`);
addEventListener('resize', fitHeight);
fitHeight();

const STORAGE_KEY = 'duskforge.profile';
const OLD_KEY = 'cardclash.profile'; // nombre anterior del juego: se lee una vez para no perder el progreso
const OWNER_KEY = 'duskforge.owner'; // de qué cuenta es el perfil guardado en este dispositivo
const PENDING_KEY = 'duskforge.pending'; // resultado de una partida que aún no ha llegado al servidor
const MAIL_SEEN_KEY = 'duskforge.mailSeen'; // fecha del último mensaje leído en este dispositivo
export const PHOTO_KEY = 'duskforge.photo'; // foto del avatar (ui/avatar.js): nunca sale del dispositivo

function load() {
  try { return sanitizeProfile(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(OLD_KEY))); } catch { return newProfile(); }
}
let profile = load();

export const getProfile = () => profile;

export function setProfile(next) {
  profile = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* sin almacenamiento: se juega igual */ }
  document.body.classList.toggle('reduced-motion', profile.settings.reducedMotion);
  const { back } = profile.cosmetics;
  document.documentElement.className = back ? `c-${back}` : '';
  paintTabs();
}

// ---------- Cuenta ----------
// Con cuenta, la partida vive en el servidor: aquí solo se guarda una copia para pintar. Lo que cambia monedas, cartas
// o progreso lo calcula el servidor (core/server.js); sin cuenta, el mismo código se ejecuta aquí.
const RETRY_MS = 30000;
const PULL_EVERY_MS = 30000;
let cloudUser = null;
let cloudState = 'off'; // off, saved u offline
let waiting = false;
let lastPull = 0;
let prefs = null; // ajustes y mazos aún por enviar
let prefsTimer = null;
let entitlements = new Set();
let updateAsked = false;
let inbox = [];
let stopInvites = null;
let inviteHandler = null;

const stored = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const store = (key, value) => {
  try { value ? localStorage.setItem(key, JSON.stringify(value)) : localStorage.removeItem(key); } catch { /* sin almacenamiento */ }
};

export const getCloudUser = () => cloudUser;
export const hasPremiumPass = () => entitlements.has(SEASON.sku);
export const getCloudState = () => cloudState;
const CLOUD_TEXT = { saved: 'Partida guardada en tu cuenta', offline: 'Sin conexión: tus compras y recompensas esperan a que vuelva' };
export const cloudText = () => CLOUD_TEXT[cloudState] ?? '';
function setCloudState(next) {
  cloudState = next;
  document.dispatchEvent(new Event('cloudstate'));
}

// El servidor exige una versión más nueva: el service worker la instala y se recarga.
async function askUpdate() {
  if (updateAsked) return;
  updateAsked = true;
  if (!(await ask('Hay una versión nueva del juego.', { yes: 'Actualizar', no: 'Más tarde' }))) return;
  await (await navigator.serviceWorker?.getRegistration())?.update().catch(() => {});
  location.reload();
}

// Todas las llamadas pasan por aquí para que el estado de la conexión sea siempre el real.
async function request(op, args) {
  const r = await callGame(op, args);
  if (r.code === 'update') askUpdate();
  if (cloudUser) setCloudState(r.offline ? 'offline' : 'saved');
  return r;
}

// Amigos e invitaciones (ui/online.js): no tocan la partida guardada.
export const friendsCall = (op, args) => request(op, args);
export const dailyBoard = () => request('dailyBoard'); // la tabla del reto diario (ui/daily.js)
export const onInvite = (fn) => (inviteHandler = fn);
function startInvites(user) {
  stopInvites?.();
  stopInvites = listenInvites(user.id, (row) => inviteHandler?.(row));
}

// Hace una acción de core/actions.js. Devuelve lo mismo que runAction, o { error }.
export async function act(op, args) {
  if (!cloudUser) {
    const r = runAction(profile, op, args, { now: new Date(), rng: Math.random, owned: hasPremiumPass() });
    if (!r.error) setProfile(r.profile);
    return r;
  }
  if (waiting) return { error: 'Un momento…' };
  waiting = true;
  document.body.classList.add('waiting');
  const r = await request(op, args);
  waiting = false;
  document.body.classList.remove('waiting');
  if (r.profile && cloudUser) replaceProfile(r.profile);
  return r;
}

// Ajustes y mazos se ven al momento y se envían poco después: un fallo de red no debe frenar un interruptor.
export function savePrefs(changes) {
  setProfile(runAction(profile, 'savePrefs', changes).profile);
  if (!cloudUser) return;
  prefs = { ...prefs, ...changes };
  clearTimeout(prefsTimer);
  prefsTimer = setTimeout(flushPrefs, 1000);
}

// Devuelve true si no queda nada por enviar.
export async function flushPrefs() {
  clearTimeout(prefsTimer);
  if (!cloudUser || !prefs) return true;
  const sent = prefs;
  prefs = null;
  const r = await request('savePrefs', sent);
  if (r.offline) {
    prefs = { ...sent, ...prefs };
    prefsTimer = setTimeout(flushPrefs, RETRY_MS);
    return false;
  }
  if (r.profile && !prefs && cloudUser) replaceProfile(r.profile);
  return true;
}

// ---------- Buzón ----------
export const getInbox = () => inbox;
export const mailClaimable = (m) => Boolean(m.gift) && !profile.mailClaimed.includes(m.id);
const unreadMail = () => {
  const seen = stored(MAIL_SEEN_KEY) ?? '';
  return inbox.filter((m) => mailClaimable(m) || m.created_at > seen).length;
};
const mailBadge = () => { const n = unreadMail(); return n ? `<span class="badge">${n}</span>` : ''; };
export const mailSlot = () => `<span data-mail-slot>${mailBadge()}</span>`;
const paintMail = () => document.querySelectorAll('[data-mail-slot]').forEach((el) => { el.innerHTML = mailBadge(); });

// Un buzón que no carga no debe molestar: el juego sigue y se reintenta al volver a la app.
export async function loadInbox() {
  if (!cloudUser) return { error: 'Sin cuenta' };
  const r = await request('mail');
  if (r.mail && cloudUser) inbox = r.mail;
  paintMail();
  return r;
}

export function markMailSeen() {
  if (inbox[0]) store(MAIL_SEEN_KEY, inbox[0].created_at);
  paintMail();
}

// Pide al servidor una partida contra la IA, de Arena ({ arena: true }) o del reto diario ({ daily: true }).
// Sin respuesta devuelve {}: se juega igual, sin recompensa.
export async function beginMatch(mode) {
  await flushPrefs();
  await sendResult();
  return (await request('startMatch', mode)).match ?? {};
}

// El resultado se guarda antes de enviarlo: si no hay red o se cierra la app, se reenvía después.
export function endMatch(id, moves) {
  store(PENDING_KEY, { uid: cloudUser?.id, id, moves });
  return sendResult();
}

async function sendResult() {
  const pending = stored(PENDING_KEY);
  if (!pending || !cloudUser) return {};
  if (pending.uid !== cloudUser.id) return {}; // de otra cuenta: espera a que vuelva a entrar
  const r = await request('finishMatch', pending);
  if (r.offline || r.code === 'update') return { pending: true };
  store(PENDING_KEY, null);
  if (r.profile) replaceProfile(r.profile);
  return r;
}

async function pullCloud() {
  lastPull = Date.now();
  const r = await request('load');
  if (!r.profile || !cloudUser || prefs || waiting) return;
  entitlements = new Set(r.owned);
  replaceProfile(r.profile);
  if (screen === 'menu') go('menu'); // shortcut: en otras pantallas lo nuevo se ve al volver a entrar
  loadInbox();
}

// Al entrar: manda lo que tenga el servidor. Sin conexión se sigue viendo la copia, si es de esta cuenta.
export async function connectCloud(user) {
  const r = await callGame('load');
  if (r.code === 'update') askUpdate();
  if (r.error) {
    if (stored(OWNER_KEY) !== user.id) return r;
    cloudUser = user;
    setCloudState('offline');
    startInvites(user);
    return {};
  }
  cloudUser = user;
  store(OWNER_KEY, user.id);
  entitlements = new Set(r.owned);
  lastPull = Date.now();
  replaceProfile(r.profile);
  setCloudState('saved');
  startInvites(user);
  await sendResult();
  loadInbox();
  return {};
}

export function disconnectCloud() {
  clearTimeout(prefsTimer);
  stopInvites?.();
  stopInvites = null;
  cloudUser = null;
  prefs = null;
  entitlements = new Set();
  inbox = [];
  store(OWNER_KEY, null);
  store(MAIL_SEEN_KEY, null);
  store(PHOTO_KEY, null); // en un móvil compartido, la siguiente cuenta no hereda la foto
  setCloudState('off');
  replaceProfile(null); // este dispositivo vuelve a empezar; la partida sigue en la cuenta (salvo si se borró)
}

document.addEventListener('visibilitychange', () => {
  if (!cloudUser) return;
  if (document.hidden) flushPrefs();
  else if (Date.now() - lastPull > PULL_EVERY_MS) pullCloud();
});
addEventListener('online', () => { flushPrefs().then(sendResult); });
// Sustituye el perfil (al cargar el de la nube o al cerrar sesión).
export const replaceProfile = (raw) => setProfile(refreshMissions(raw ? sanitizeProfile(raw) : newProfile()));

// ---------- Navegación ----------
const screens = {};
const TABS = [['collection', 'Colección', 'collection'], ['deck', 'Mazos', 'deck'], ['menu', 'Jugar'], ['shop', 'Tienda', 'shop'], ['missions', 'Misiones', 'missions']];
const tabOf = (name) => TABS.findIndex(([id]) => id === name);
const PARENT = { profile: 'menu', settings: 'profile', support: 'profile', mail: 'profile', auth: 'menu', online: 'modes', player: 'online', modes: 'menu', arena: 'modes', daily: 'modes', forge: 'modes' }; // pantallas que se abren encima de otra
let screen = null;
let cameFrom = null;
let tapHandler = null;
export const register = (name, fn) => (screens[name] = fn);
export const currentScreen = () => screen;

const tabbar = document.createElement('nav');
tabbar.id = 'tabbar';
tabbar.setAttribute('aria-label', 'Secciones');
tabbar.innerHTML = `<span class="ink"></span>${TABS.map(([id, label, art]) => `
  <button class="tab ${art ? '' : 'main'}" data-tab="${id}">
    ${art ? `<img src="img/ui/icon_${art}.webp" alt="">` : '<img class="play-emblem" src="img/ui/icon_play.webp" alt="">'}<span>${label}</span>
  </button>`).join('')}`;
document.body.appendChild(tabbar);
tabbar.addEventListener('click', (ev) => {
  const tab = ev.target.closest('[data-tab]')?.dataset.tab;
  if (tab === 'menu' && screen === 'menu') go('battle'); // la pestaña se llama Jugar: en el inicio, juega
  else if (tab && tab !== screen) go(tab);
});

function paintTabs() {
  const i = tabOf(screen);
  document.body.classList.toggle('tabs-on', i >= 0);
  if (i < 0) return;
  tabbar.style.setProperty('--tab', i);
  tabbar.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === screen));
  const count = claimableCount(refreshMissions(profile)) + claimableAchievements(profile) + claimableTiers(profile, hasPremiumPass());
  const tab = tabbar.querySelector('[data-tab="missions"]');
  tab.querySelector('.badge')?.remove();
  if (count) tab.insertAdjacentHTML('beforeend', `<span class="badge">${count}</span>`);
}
setProfile(refreshMissions(profile));

// Cómo se pasa de una pantalla a otra: las pestañas se deslizan hacia su lado y lo demás se apila encima.
function motionFor(from, to) {
  if (from === to) return null;
  if (!from) return 'fade';
  if (to === 'battle' || from === 'battle') return 'zoom';
  const a = tabOf(from);
  const b = tabOf(to);
  if (a >= 0 && b >= 0) return a < b ? 'next' : 'prev';
  if (PARENT[to] === from || (b < 0 && a >= 0)) return 'push';
  if (PARENT[from] === to || (a < 0 && b >= 0)) return 'pop';
  return 'fade';
}

export function go(name, ...args) {
  const motion = motionFor(screen, name);
  if (history.state?.df !== 'app') history.pushState({ df: 'app' }, ''); // tras un Atrás en el inicio que no llegó a salir de la app
  tapHandler = null;
  cameFrom = screen;
  screen = name;
  music(name === 'battle' ? 'battle' : name === 'result' ? null : 'menu'); // el resultado deja sonar solo la fanfarria
  const render = () => {
    screens[name](...args);
    app.querySelector('.screen')?.classList.add('enter'); // solo al llegar: repintar la misma pantalla no reanima nada
    paintTabs();
  };
  const calm = profile.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!motion || calm || document.hidden || !document.startViewTransition) return render();
  document.documentElement.dataset.motion = motion;
  const change = document.startViewTransition(render);
  change.ready.catch(() => {}); // sin soporte o interrumpida: la pantalla nueva ya está puesta
  change.finished.catch(() => {}).finally(() => delete document.documentElement.dataset.motion);
}

// Deslizar el dedo cambia de pestaña. Los carriles de filtros, los campos y las ventanas conservan su gesto.
let swipe = null;
addEventListener('touchstart', (ev) => {
  const t = ev.touches[0];
  swipe = tabOf(screen) < 0 || ev.touches.length > 1 || ev.target.closest?.('.rail, input, textarea, .modal-bg, [data-noswipe]') ? null : { x: t.clientX, y: t.clientY, at: Date.now() };
}, { passive: true });
addEventListener('touchend', (ev) => {
  if (!swipe) return;
  const t = ev.changedTouches[0];
  const dx = t.clientX - swipe.x;
  const dy = t.clientY - swipe.y;
  const quick = Date.now() - swipe.at < 500;
  swipe = null;
  if (!quick || Math.abs(dx) < 70 || Math.abs(dx) < 2 * Math.abs(dy)) return;
  const next = TABS[tabOf(screen) + (dx < 0 ? 1 : -1)];
  if (next) go(next[0]);
});

// El botón Atrás de Android cierra la ventana abierta o vuelve atrás; en el menú sale de la app.
history.replaceState({ df: 'root' }, '');
history.pushState({ df: 'app' }, '');
addEventListener('popstate', () => {
  const modal = document.querySelector('.modal-bg');
  if ((screen === 'menu' || (screen === 'auth' && !cameFrom)) && !modal) return history.back();
  history.pushState({ df: 'app' }, '');
  if (modal) modal.querySelector('[data-act="close"], [data-no]')?.click();
  else if (screen !== 'battle') go(screen === 'auth' ? cameFrom : PARENT[screen] ?? 'menu');
});
// Cada pantalla registra su manejador de toques; data-go="pantalla" navega sin código extra.
export const onTap = (fn) => (tapHandler = fn);
app.addEventListener('click', (ev) => {
  if (waiting) return; // el servidor aún no ha respondido a lo anterior
  const nav = ev.target.closest('[data-go]');
  if (nav) return go(nav.dataset.go);
  if (tapHandler) tapHandler(ev.target, ev);
});

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function toast(text) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// Pregunta dentro del juego, con su aspecto, en vez del aviso del navegador.
export function ask(text, { yes = 'Aceptar', no = 'Cancelar', danger = false } = {}) {
  return new Promise((done) => {
    const bg = document.createElement('div');
    bg.className = 'modal-bg ask-bg';
    bg.innerHTML = `
      <div class="modal" role="alertdialog" aria-label="${text}">
        <p>${text}</p>
        <div class="modal-actions">
          <button class="btn small ghost" data-no>${no}</button>
          <button class="btn small ${danger ? 'danger' : 'gold'}" data-yes>${yes}</button>
        </div>
      </div>`;
    document.body.appendChild(bg);
    bg.addEventListener('click', (ev) => {
      const answer = ev.target.closest('[data-yes]') ? true : ev.target.closest('[data-no]') || ev.target === bg ? false : null;
      if (answer === null) return;
      bg.remove();
      done(answer);
    });
  });
}

// Cuenta hasta el valor: las recompensas se notan más que un número que ya está puesto.
export function countUp(el, to, prefix = '') {
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / 700);
    el.textContent = `${prefix}${Math.round(to * (1 - (1 - t) ** 3))}`;
    if (t < 1 && el.isConnected) requestAnimationFrame(step);
  };
  if (profile.settings.reducedMotion) el.textContent = `${prefix}${to}`;
  else requestAnimationFrame(step);
}

// ---------- Piezas visuales ----------
const amount = (n) => n.toLocaleString('es-ES');

export const resources = () => `
  <span class="res">
    <span class="pill coins" title="Monedas">${icon('coin')}<b>${amount(profile.coins)}</b></span>
    <span class="pill frags" title="Fragmentos">${icon('shard')}<b>${amount(profile.fragments)}</b></span>
  </span>`;

// back: pantalla a la que vuelve la flecha. Las pestañas no la necesitan.
export function topBar(title, back) {
  return `
    <header class="topbar">
      ${back ? `<button class="icon-btn" data-go="${back}" aria-label="Volver">${icon('back')}</button>` : ''}
      <h2>${title}</h2>
      ${resources()}
    </header>`;
}

// Ilustración de la carta, o su emoji si todavía no tiene.
export const artHtml = (card) =>
  CARD_ART.has(card.id) ? `<img src="img/cards/${card.id}.webp" alt="" draggable="false" loading="lazy">` : card.art;

// Letra de la descripción en % del ancho interior de la carta (9,2 px a tamaño de colección): baja lo justo según su largo.
const textFit = (len, unit) => (Math.min(9.2, unit ? 12.3 - len * 0.0375 : 9.2) / 0.94).toFixed(2);

// Cara completa de una carta (colección, sobres, detalle).
export function cardFace(card, { count = null, foil = false, locked = false, big = false, attrs = '' } = {}) {
  const cls = ['face', `r-${card.rarity}`, foil && 'foil', locked && 'locked', big && 'big'].filter(Boolean).join(' ');
  const stats = card.type === 'unit' ? `<span class="fatk">${card.atk}</span><span class="fhp">${card.hp}</span>` : '';
  const text = cardText(card);
  return `
    <div class="${cls}" ${attrs} role="button" aria-label="${card.name}${locked ? ' (no la tienes)' : ''}">
      <span class="cost">${card.cost}</span>
      ${count !== null ? `<span class="count">x${count}</span>` : ''}
      <span class="art">${artHtml(card)}</span>
      <span class="name" style="--n:${card.name.length}">${card.name}</span>
      <span class="type">${card.type === 'unit' ? 'Criatura' : 'Hechizo'} · ${RARITY_TEXT[card.rarity]}</span>
      <span class="text" style="--f:${textFit(text.length, card.type === 'unit')}">${card.type === 'unit' ? '<i></i><i></i>' : ''}${text}</span>
      ${stats}
    </div>`;
}
