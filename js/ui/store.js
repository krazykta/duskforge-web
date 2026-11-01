// Estado compartido de la interfaz: perfil guardado, navegación entre pantallas,
// toques y piezas visuales reutilizables.
import { newProfile, sanitizeProfile, PROFILE_VERSION } from '../core/progression.js';
import { mergeProfiles } from '../core/sync.js';
import { refreshMissions, claimableCount } from '../core/missions.js';
import { claimableAchievements } from '../core/achievements.js';
import { claimableTiers } from '../core/pass.js';
import { SEASON } from '../core/config.js';
import { cardText } from '../core/cards.js';
import { RARITY_TEXT } from '../core/collection.js';
import { myEntitlements, pullProfile, saveProfile } from '../cloud.js';
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
const SYNC_KEY = 'duskforge.sync';

function load() {
  try { return sanitizeProfile(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(OLD_KEY))); } catch { return newProfile(); }
}
let profile = load();

export const getProfile = () => profile;

export function setProfile(next) {
  profile = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* sin almacenamiento: se juega igual */ }
  document.body.classList.toggle('reduced-motion', profile.settings.reducedMotion);
  const { back, board } = profile.cosmetics;
  document.documentElement.className = [back, board].filter(Boolean).map((id) => `c-${id}`).join(' ');
  paintTabs();
  if (cloudUser) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(flushCloud, 1500); // agrupa cambios seguidos en un solo envío
  }
}

// ---------- Guardado en la nube ----------
// sync recuerda la última partida en la que coincidimos con la nube: su rev impide pisar otro dispositivo
// y su contenido (base) permite saber qué se ha jugado aquí desde entonces, aunque se cierre la app sin conexión.
const RETRY_MS = 30000;
const PULL_EVERY_MS = 30000;
let cloudUser = null;
let cloudState = 'off'; // off, saving, saved, offline o rejected
let pushTimer = null;
let flushing = false;
let lastPull = 0;
let sync = null;
let entitlements = new Set();
try { sync = JSON.parse(localStorage.getItem(SYNC_KEY)); } catch { /* sin datos previos */ }

export const getCloudUser = () => cloudUser;
export const hasPremiumPass = () => entitlements.has(SEASON.sku);
export const getCloudState = () => cloudState;
const CLOUD_TEXT = {
  saving: 'Guardando…', saved: 'Guardado en la nube', offline: 'Sin conexión: se guardará al volver',
  rejected: 'El servidor no aceptó esta partida. Escríbenos desde Contacto',
};
export const cloudText = () => CLOUD_TEXT[cloudState] ?? '';
function setCloudState(next) {
  cloudState = next;
  document.dispatchEvent(new Event('cloudstate'));
}
function remember(uid, rev, base) {
  sync = uid ? { uid, rev, base } : null;
  try { sync ? localStorage.setItem(SYNC_KEY, JSON.stringify(sync)) : localStorage.removeItem(SYNC_KEY); } catch { /* sin almacenamiento */ }
}
const inSync = () => JSON.stringify(profile) === JSON.stringify(sync?.base);

function adopt(raw, rev) {
  const cloud = sanitizeProfile(raw);
  const mine = sync?.uid === cloudUser.id && sync.base;
  const next = mine ? mergeProfiles(sync.base, profile, cloud) : cloud;
  remember(cloudUser.id, rev, cloud);
  replaceProfile(next);
}

// Devuelve true si la partida ha quedado a salvo en la nube.
export async function flushCloud() {
  clearTimeout(pushTimer);
  if (!cloudUser || flushing || cloudState === 'rejected') return cloudState === 'saved';
  if (inSync()) { setCloudState('saved'); return true; }
  flushing = true;
  setCloudState('saving');
  const sent = profile;
  const r = await saveProfile(cloudUser.id, sent, sync?.uid === cloudUser.id ? sync.rev : null);
  flushing = false;
  if (!cloudUser) return false; // cerró sesión mientras se enviaba
  if (r.rejected) {
    toast('El servidor no aceptó esta partida.');
    setCloudState('rejected');
    return false;
  }
  if (r.conflict) return pullCloud(true); // otro dispositivo guardó antes: se une y se vuelve a enviar
  if (r.error) {
    setCloudState('offline');
    pushTimer = setTimeout(flushCloud, RETRY_MS);
    return false;
  }
  remember(cloudUser.id, r.rev, sent);
  if (inSync()) setCloudState('saved');
  else pushTimer = setTimeout(flushCloud, 1500); // ha cambiado mientras se enviaba
  return inSync();
}

async function pullCloud(afterConflict = false) {
  if (flushing) return false; // leer mientras se guarda confundiría lo propio con lo de otro dispositivo
  flushing = true;
  lastPull = Date.now();
  const r = await pullProfile(cloudUser.id);
  flushing = false;
  if (!cloudUser) return false;
  const moved = r.data && r.rev !== sync?.rev;
  if (r.error || (afterConflict && !moved)) { // sin nada nuevo que unir, reenviar ya volvería a chocar
    setCloudState('offline');
    pushTimer = setTimeout(flushCloud, RETRY_MS);
    return false;
  }
  if (moved) {
    adopt(r.data, r.rev);
    if (screen === 'menu') go('menu'); // shortcut: en otras pantallas lo nuevo se ve al volver a entrar
  }
  return flushCloud();
}

// Al entrar: la nube manda sobre lo que hubiera en el dispositivo, salvo lo jugado con esta misma cuenta sin subir.
export async function connectCloud(user) {
  const r = await pullProfile(user.id);
  if (r.error) {
    // Con rev conocida se puede seguir: nada pisará la nube. Sin ella se juega solo en local.
    if (sync?.uid !== user.id) return r;
    cloudUser = user;
    setCloudState('offline');
    pushTimer = setTimeout(flushCloud, RETRY_MS);
    return {};
  }
  if (r.data?.version > PROFILE_VERSION) return { newer: true }; // una versión antigua la sustituiría por una partida nueva
  cloudUser = user;
  entitlements = new Set(await myEntitlements());
  if (r.data) adopt(r.data, r.rev);
  else remember(user.id, null, null);
  await flushCloud();
  return {};
}

export function disconnectCloud() {
  clearTimeout(pushTimer);
  cloudUser = null;
  entitlements = new Set();
  remember(null);
  setCloudState('off');
  replaceProfile(null); // este dispositivo vuelve a empezar; la partida sigue en la cuenta (salvo si se borró)
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushCloud();
  else if (cloudUser && Date.now() - lastPull > PULL_EVERY_MS) pullCloud();
});
addEventListener('online', () => flushCloud());
// Sustituye el perfil (al cargar el de la nube o al cerrar sesión).
export const replaceProfile = (raw) => setProfile(refreshMissions(raw ? sanitizeProfile(raw) : newProfile()));

// ---------- Navegación ----------
const screens = {};
const TABS = [['collection', 'Colección', 'collection'], ['deck', 'Mazos', 'deck'], ['menu', 'Jugar'], ['shop', 'Tienda', 'shop'], ['missions', 'Misiones', 'missions']];
const tabOf = (name) => TABS.findIndex(([id]) => id === name);
const PARENT = { settings: 'menu', support: 'settings', auth: 'menu', online: 'menu' }; // pantallas que se abren encima de otra
let screen = null;
let cameFrom = null;
let tapHandler = null;
export const register = (name, fn) => (screens[name] = fn);

const tabbar = document.createElement('nav');
tabbar.id = 'tabbar';
tabbar.setAttribute('aria-label', 'Secciones');
tabbar.innerHTML = `<span class="ink"></span>${TABS.map(([id, label, art]) => `
  <button class="tab ${art ? '' : 'main'}" data-tab="${id}">
    ${art ? `<img src="img/ui/icon_${art}.webp" alt="">` : `<span class="play-dot">${icon('swords')}</span>`}<span>${label}</span>
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

// Cara completa de una carta (colección, sobres, detalle).
export function cardFace(card, { count = null, foil = false, locked = false, big = false, attrs = '' } = {}) {
  const cls = ['face', `r-${card.rarity}`, foil && 'foil', locked && 'locked', big && 'big'].filter(Boolean).join(' ');
  const stats = card.type === 'unit' ? `<span class="fatk">${card.atk}</span><span class="fhp">${card.hp}</span>` : '';
  return `
    <div class="${cls}" ${attrs} role="button" aria-label="${card.name}${locked ? ' (no la tienes)' : ''}">
      <span class="cost">${card.cost}</span>
      ${count !== null ? `<span class="count">x${count}</span>` : ''}
      <span class="art">${artHtml(card)}</span>
      <span class="name">${card.name}</span>
      <span class="type">${card.type === 'unit' ? 'Criatura' : 'Hechizo'} · ${RARITY_TEXT[card.rarity]}</span>
      <span class="text">${cardText(card)}</span>
      ${stats}
    </div>`;
}
