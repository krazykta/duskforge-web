// Colección, mazos, sobres, fabricación y mejoras cosméticas. Funciones puras sobre el perfil.
import { COLLECTION, PACK, RULES } from './config.js';
import { CARDS, CARD_BY_ID } from './cards.js';
import { addProgress } from './missions.js';

export const COLLECTIBLE = CARDS.filter((c) => !c.token);
export const RARITIES = ['common', 'rare', 'epic', 'legendary'];
export const RARITY_TEXT = { common: 'Común', rare: 'Rara', epic: 'Épica', legendary: 'Legendaria' };

export const maxCopies = (card, cfg = COLLECTION) => (card.rarity === 'legendary' ? cfg.legendaryMaxCopies : cfg.maxCopies);

export function countCards(ids) {
  const counts = {};
  for (const id of ids) counts[id] = (counts[id] || 0) + 1;
  return counts;
}

// Lista de problemas del mazo (vacía si es válido).
export function deckErrors(deck, collection, rules = RULES) {
  const errors = [];
  if (deck.length !== rules.deckSize) errors.push(`El mazo debe tener ${rules.deckSize} cartas (tiene ${deck.length})`);
  for (const [id, n] of Object.entries(countCards(deck))) {
    const c = CARD_BY_ID[id];
    if (!c || c.token) { errors.push(`Carta no válida: ${id}`); continue; }
    if (n > maxCopies(c)) errors.push(`Máximo ${maxCopies(c)} copia(s) de ${c.name}`);
    else if (n > (collection[id] || 0)) errors.push(`No tienes suficientes copias de ${c.name}`);
  }
  return errors;
}

function rollRarity(rng, odds) {
  let r = rng();
  for (const rarity of RARITIES) {
    if ((r -= odds[rarity]) < 0) return rarity;
  }
  return 'common'; // por redondeo de decimales
}

// Añade una carta: si ya tienes el máximo, se convierte en fragmentos.
function grantCard(profile, id, cfg) {
  const card = CARD_BY_ID[id];
  const owned = profile.collection[id] || 0;
  if (owned >= maxCopies(card, cfg)) {
    const fragments = cfg.duplicateFragments[card.rarity];
    return { profile: { ...profile, fragments: profile.fragments + fragments }, result: { id, isNew: false, fragments } };
  }
  return { profile: { ...profile, collection: { ...profile.collection, [id]: owned + 1 } }, result: { id, isNew: owned === 0, fragments: 0 } };
}

export function openPack(profile, { rng = Math.random, now = new Date(), pack = PACK, cfg = COLLECTION } = {}) {
  if (profile.coins < pack.price) return { profile, error: 'No tienes monedas suficientes' };
  let p = { ...profile, coins: profile.coins - pack.price };
  const results = [];
  for (let i = 0; i < pack.cards; i++) {
    const rarity = rollRarity(rng, pack.odds);
    const pool = COLLECTIBLE.filter((c) => c.rarity === rarity);
    const id = pool[Math.floor(rng() * pool.length)].id;
    const g = grantCard(p, id, cfg);
    p = g.profile;
    results.push(g.result);
  }
  p.packHistory = [...p.packHistory, { at: now.getTime(), cards: results.map((r) => r.id) }].slice(-cfg.historySize);
  return { profile: addProgress(p, { packs: 1 }, now), results };
}

export function craftCard(profile, id, cfg = COLLECTION) {
  const card = CARD_BY_ID[id];
  if (!card || card.token) return { profile, error: 'Carta no válida' };
  if ((profile.collection[id] || 0) >= maxCopies(card, cfg)) return { profile, error: 'Ya tienes el máximo de copias' };
  const cost = cfg.craftCost[card.rarity];
  if (profile.fragments < cost) return { profile, error: `Necesitas ${cost} fragmentos` };
  return { profile: grantCard({ ...profile, fragments: profile.fragments - cost }, id, cfg).profile };
}

export function upgradeFoil(profile, id, cfg = COLLECTION) {
  const card = CARD_BY_ID[id];
  if (!card || !profile.collection[id]) return { profile, error: 'No tienes esta carta' };
  if (profile.foils.includes(id)) return { profile, error: 'Ya es brillante' };
  const cost = cfg.foilCost[card.rarity];
  if (profile.fragments < cost) return { profile, error: `Necesitas ${cost} fragmentos` };
  return { profile: { ...profile, fragments: profile.fragments - cost, foils: [...profile.foils, id] } };
}
