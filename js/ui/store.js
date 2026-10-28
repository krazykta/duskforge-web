// Estado compartido de la interfaz: perfil guardado, navegación entre pantallas,
// toques y piezas visuales reutilizables.
import { newProfile, sanitizeProfile, levelOf } from '../core/progression.js';
import { refreshMissions, claimableCount } from '../core/missions.js';
import { claimableAchievements } from '../core/achievements.js';
import { cardText } from '../core/cards.js';
import { RARITY_TEXT } from '../core/collection.js';
import { pushProfile } from '../cloud.js';
import { CARD_ART } from './card-art.js';

export const app = document.getElementById('app');
const STORAGE_KEY = 'duskforge.profile';
const OLD_KEY = 'cardclash.profile'; // nombre anterior del juego: se lee una vez para no perder el progreso

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
let cloudUser = null;
let pushTimer = null;
export const getCloudUser = () => cloudUser;
export const setCloudUser = (user) => (cloudUser = user);
// shortcut: si el envío falla, se reintenta en el siguiente cambio; no hay cola persistente.
export async function flushCloud() {
  clearTimeout(pushTimer);
  if (cloudUser) await pushProfile(cloudUser.id, profile);
}
document.addEventListener('visibilitychange', () => document.hidden && flushCloud());
// Sustituye el perfil (al cargar el de la nube o al cerrar sesión).
export const replaceProfile = (raw) => setProfile(refreshMissions(raw ? sanitizeProfile(raw) : newProfile()));
setProfile(refreshMissions(profile));

// ---------- Navegación ----------
const screens = {};
let tapHandler = null;
export const register = (name, fn) => (screens[name] = fn);
export function go(name, ...args) {
  tapHandler = null;
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
  CARD_ART.has(card.id) ? `<img src="img/cards/${card.id}.webp" alt="" draggable="false">` : card.art;

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
