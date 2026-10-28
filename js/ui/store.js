// Estado compartido de la interfaz: perfil guardado, navegación entre pantallas,
// toques y piezas visuales reutilizables.
import { newProfile, sanitizeProfile, levelOf } from '../core/progression.js';
import { refreshMissions, claimableCount } from '../core/missions.js';
import { cardText } from '../core/cards.js';
import { RARITY_TEXT } from '../core/collection.js';

export const app = document.getElementById('app');
const STORAGE_KEY = 'cardclash.profile';

function load() {
  try { return sanitizeProfile(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { return newProfile(); }
}
let profile = load();

export const getProfile = () => profile;

export function setProfile(next) {
  profile = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* sin almacenamiento: se juega igual */ }
  document.body.classList.toggle('reduced-motion', profile.settings.reducedMotion);
}
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
  const n = claimableCount(refreshMissions(profile));
  return n ? `<span class="badge">${n}</span>` : '';
};

// Cara completa de una carta (colección, sobres, detalle).
export function cardFace(card, { count = null, foil = false, locked = false, big = false, attrs = '' } = {}) {
  const cls = ['face', `r-${card.rarity}`, foil && 'foil', locked && 'locked', big && 'big'].filter(Boolean).join(' ');
  const stats = card.type === 'unit' ? `<span class="fatk">${card.atk}</span><span class="fhp">${card.hp}</span>` : '';
  return `
    <div class="${cls}" ${attrs} role="button" aria-label="${card.name}${locked ? ' (no la tienes)' : ''}">
      <span class="cost">${card.cost}</span>
      ${count !== null ? `<span class="count">x${count}</span>` : ''}
      <span class="art">${card.art}</span>
      <span class="name">${card.name}</span>
      <span class="type">${card.type === 'unit' ? 'Criatura' : 'Hechizo'} · ${RARITY_TEXT[card.rarity]}</span>
      <span class="text">${cardText(card)}</span>
      ${stats}
    </div>`;
}
