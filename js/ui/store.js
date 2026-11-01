// Estado compartido de la interfaz: perfil guardado, navegación entre pantallas,
// toques y piezas visuales reutilizables.
import { newProfile, sanitizeProfile, levelOf, PROFILE_VERSION } from '../core/progression.js';
import { mergeProfiles } from '../core/sync.js';
import { refreshMissions, claimableCount } from '../core/missions.js';
import { claimableAchievements } from '../core/achievements.js';
import { cardText } from '../core/cards.js';
import { RARITY_TEXT } from '../core/collection.js';
import { pullProfile, saveProfile } from '../cloud.js';
import { CARD_ART } from './card-art.js';
import { music } from './sound.js';

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
try { sync = JSON.parse(localStorage.getItem(SYNC_KEY)); } catch { /* sin datos previos */ }

export const getCloudUser = () => cloudUser;
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
  if (r.conflict) return pullCloud(); // otro dispositivo guardó antes: se une y se vuelve a enviar
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

async function pullCloud() {
  if (flushing) return false; // leer mientras se guarda confundiría lo propio con lo de otro dispositivo
  flushing = true;
  lastPull = Date.now();
  const r = await pullProfile(cloudUser.id);
  flushing = false;
  if (!cloudUser) return false;
  if (r.error) {
    setCloudState('offline');
    return false;
  }
  if (r.data && r.rev !== sync?.rev) {
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
  if (r.data) adopt(r.data, r.rev);
  else remember(user.id, null, null);
  await flushCloud();
  return {};
}

export function disconnectCloud() {
  clearTimeout(pushTimer);
  cloudUser = null;
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
setProfile(refreshMissions(profile));

// ---------- Navegación ----------
const screens = {};
let screen = null;
let tapHandler = null;
export const register = (name, fn) => (screens[name] = fn);
export function go(name, ...args) {
  tapHandler = null;
  screen = name;
  music(name === 'battle' ? 'battle' : name === 'result' ? null : 'menu'); // el resultado deja sonar solo la fanfarria
  screens[name](...args);
}
// Cada pantalla registra su manejador de toques; data-go="pantalla" navega sin código extra.
export const onTap = (fn) => (tapHandler = fn);
app.addEventListener('click', (ev) => {
  const nav = ev.target.closest('[data-go]');
  if (nav) return go(nav.dataset.go);
  if (tapHandler) tapHandler(ev.target, ev);
});

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

// ---------- Piezas visuales ----------
export function topBar(title) {
  return `
    <header class="topbar">
      ${title ? `<button class="icon-btn" data-go="menu" aria-label="Volver al menú">‹</button><h2>${title}</h2>` : `<span class="lvl">Nivel ${levelOf(profile.xp)}</span>`}
      <span class="res"><span class="coins" title="Monedas">🪙 ${profile.coins}</span><span class="frags" title="Fragmentos">💠 ${profile.fragments}</span></span>
    </header>`;
}

export const missionBadge = () => {
  const n = claimableCount(refreshMissions(profile)) + claimableAchievements(profile);
  return n ? `<span class="badge">${n}</span>` : '';
};

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
