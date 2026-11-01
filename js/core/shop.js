// Compras de la tienda: escaparate del día, ofertas, coleccionables y mejoras. Funciones puras sobre el perfil.
// Sobres y fabricación están en core/collection.js. Las probabilidades se enseñan en la pantalla de la tienda.
import { CARD_PRICE, COSMETICS, OFFERS, SHOP, UPGRADES } from './config.js';
import { CARD_BY_ID } from './cards.js';
import { COLLECTIBLE, grantCard, maxCopies, openPack } from './collection.js';
import { localDay, pickForDay } from './missions.js';

// Lo que hay a la venta ese día. Un artículo de los seis lleva descuento.
export function dailyShop(day) {
  const cards = SHOP.slots.map((rarity, i) => pickForDay(`${day}#${i}`, COLLECTIBLE.filter((c) => c.rarity === rarity), 1)[0]);
  const [deal] = pickForDay(`${day}#deal`, cards.map((c) => c.id), 1);
  return {
    cards: cards.map((c) => ({
      id: c.id,
      was: CARD_PRICE[c.rarity],
      price: c.id === deal ? Math.ceil(CARD_PRICE[c.rarity] * (1 - SHOP.dealOff)) : CARD_PRICE[c.rarity],
    })),
    offers: pickForDay(day, OFFERS, SHOP.offersPerDay),
  };
}

const boughtToday = (p, day) => (p.shop.day === day ? p.shop.bought : []);
export const isBought = (p, id, now = new Date()) => boughtToday(p, localDay(now)).includes(id);
const markBought = (p, id, day) => ({ ...p, shop: { day, bought: [...boughtToday(p, day), id] } });

export function buyCard(profile, id, now = new Date()) {
  const day = localDay(now);
  const item = dailyShop(day).cards.find((c) => c.id === id);
  if (!item) return { profile, error: 'Esta carta ya no está a la venta' };
  if (isBought(profile, id, now)) return { profile, error: 'Ya la has comprado hoy' };
  if ((profile.collection[id] || 0) >= maxCopies(CARD_BY_ID[id])) return { profile, error: 'Ya tienes el máximo de copias' };
  if (profile.coins < item.price) return { profile, error: 'No tienes monedas suficientes' };
  return { profile: markBought(grantCard({ ...profile, coins: profile.coins - item.price }, id).profile, id, day) };
}

export function buyOffer(profile, id, { now = new Date(), rng = Math.random } = {}) {
  const day = localDay(now);
  const offer = dailyShop(day).offers.find((o) => o.id === id);
  if (!offer) return { profile, error: 'Esta oferta ya no está disponible' };
  if (isBought(profile, id, now)) return { profile, error: 'Ya la has comprado hoy' };
  if (profile.coins < offer.price) return { profile, error: 'No tienes monedas suficientes' };
  if (offer.pack) {
    const r = openPack(profile, { pack: { ...offer.pack, price: offer.price }, rng, now });
    return { ...r, profile: markBought(r.profile, id, day) };
  }
  return { profile: markBought({ ...profile, coins: profile.coins - offer.price, fragments: profile.fragments + offer.fragments }, id, day) };
}

export function buyCosmetic(profile, id) {
  const c = COSMETICS.find((x) => x.id === id);
  if (!c?.price) return { profile, error: 'No está a la venta' };
  if (profile.cosmetics.owned.includes(id)) return { profile, error: 'Ya lo tienes' };
  if (profile.coins < c.price) return { profile, error: 'No tienes monedas suficientes' };
  return { profile: { ...profile, coins: profile.coins - c.price, cosmetics: { ...profile.cosmetics, owned: [...profile.cosmetics.owned, id] } } };
}

// Equipa un coleccionable que ya se tiene; si ya estaba puesto, lo quita.
export function equipCosmetic(profile, id) {
  const c = COSMETICS.find((x) => x.id === id);
  if (!c || !profile.cosmetics.owned.includes(id)) return { profile, error: 'No lo tienes' };
  return { profile: { ...profile, cosmetics: { ...profile.cosmetics, [c.kind]: profile.cosmetics[c.kind] === id ? null : id } } };
}

export function buyUpgrade(profile, id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return { profile, error: 'Mejora no válida' };
  const level = profile.upgrades[id];
  if (level >= u.prices.length) return { profile, error: 'Ya está al máximo' };
  if (profile.coins < u.prices[level]) return { profile, error: 'No tienes monedas suficientes' };
  const upgrades = { ...profile.upgrades, [id]: level + 1 };
  const next = { ...profile, coins: profile.coins - u.prices[level], upgrades };
  return { profile: id === 'deck' ? { ...next, decks: [...next.decks, []] } : next };
}
