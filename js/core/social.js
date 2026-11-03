// Amigos (decisión 41): el nombre público y lo que otro jugador puede ver de tu perfil.
import { COLLECTIBLE, RARITIES } from './collection.js';
import { achievementList } from './achievements.js';
import { passTier } from './pass.js';
import { levelOf, sanitizeProfile } from './progression.js';

export const FRIENDS = { max: 50, inviteMs: 120000 }; // una invitación caduca a los 2 minutos
// Letras de cualquier idioma, cifras y _ ; sin espacios para que «Nombre#1234» se lea sin dudas.
const NAME = /^[\p{L}\p{N}_]{3,16}$/u;
// shortcut: sin filtro de palabrotas ni botón de denunciar; hacen falta antes de abrir el juego al público (Google Play lo pide).
export const cleanName = (text) => (typeof text === 'string' && NAME.test(text.trim()) ? text.trim() : null);

// «Nombre#1234» → { name, tag }, o null si no tiene esa forma.
export function parseFriendCode(text) {
  const m = typeof text === 'string' && text.trim().match(/^(.+)#(\d{4})$/u);
  const name = m && cleanName(m[1]);
  return name && Number(m[2]) >= 1000 ? { name, tag: Number(m[2]) } : null;
}

// Lo que ven los demás. La foto del avatar no sale del móvil: a los demás les sale el héroe.
export function publicProfile(raw) {
  const p = sanitizeProfile(raw);
  const owned = new Set(Object.keys(p.collection).filter((id) => p.collection[id] > 0));
  return {
    level: levelOf(p.xp),
    wins: p.wins,
    losses: p.losses,
    trophies: p.trophies,
    avatar: p.avatar === 'photo' ? null : p.avatar,
    frame: p.cosmetics.frame,
    banner: p.cosmetics.banner,
    title: p.cosmetics.title,
    cards: Object.fromEntries([['all', owned.size], ...RARITIES.map((r) => [r, COLLECTIBLE.filter((c) => c.rarity === r && owned.has(c.id)).length])]),
    foils: p.foils.length,
    achievements: achievementList(p).filter((a) => a.claimed).length,
    passTier: passTier(p),
  };
}
