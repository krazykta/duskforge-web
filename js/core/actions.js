// Todo lo que cambia la partida guardada, salvo los combates (core/replay.js).
// Sin cuenta lo ejecuta el móvil; con cuenta, el servidor (core/server.js) con este mismo código.
import { PACKS } from './config.js';
import { CARD_BY_ID } from './cards.js';
import { claimWelcome, craftCard, openPack, upgradeFoil } from './collection.js';
import { buyCard, buyCosmetic, buyOffer, buyUpgrade, equipCosmetic } from './shop.js';
import { claimMission } from './missions.js';
import { claimAchievement } from './achievements.js';
import { claimTier } from './pass.js';
import { sanitizeProfile } from './progression.js';

const refuse = (profile, error) => ({ profile, error });
const onCard = (fn) => (p, { id }) => (CARD_BY_ID[id] ? fn(p, id) : refuse(p, 'Carta no válida'));

// Ajustes, mazos y avatar no dan ventaja por sí solos: sanitizeProfile descarta los mazos y avatares con cartas que no se tengan.
function savePrefs(p, { settings = p.settings, decks = p.decks, activeDeck = p.activeDeck, tutorialSeen = false, avatar = p.avatar }) {
  const list = Array.isArray(decks) ? decks : p.decks;
  return { profile: sanitizeProfile({ ...p, settings, decks: list, activeDeck, deck: list[activeDeck], tutorialSeen: p.tutorialSeen || tutorialSeen, avatar }) };
}

const ACTIONS = {
  openPack: (p, { pack }, ctx) => (Number.isInteger(pack) && PACKS[pack] ? openPack(p, { ...ctx, pack: PACKS[pack] }) : refuse(p, 'Sobre no válido')),
  buyCard: onCard((p, id) => buyCard(p, id)),
  craftCard: onCard((p, id) => craftCard(p, id)),
  upgradeFoil: onCard((p, id) => upgradeFoil(p, id)),
  buyOffer: (p, { id }, ctx) => buyOffer(p, id, ctx),
  buyCosmetic: (p, { id }) => buyCosmetic(p, id),
  equipCosmetic: (p, { id }) => equipCosmetic(p, id),
  buyUpgrade: (p, { id }) => buyUpgrade(p, id),
  claimWelcome: (p, _, ctx) => claimWelcome(p, ctx),
  claimMission: (p, { id }, ctx) => claimMission(p, id, ctx.now),
  claimAchievement: (p, { id }) => claimAchievement(p, id),
  claimTier: (p, { n, premium }, ctx) => (Number.isInteger(n) ? claimTier(p, n, premium === true, ctx) : refuse(p, 'Casilla no válida')),
  savePrefs,
};

export const isAction = (op) => Object.hasOwn(ACTIONS, op);

// ctx: { now, rng, owned }. Lo dejado sin definir usa los valores por defecto de cada función.
export function runAction(profile, op, args, ctx = {}) {
  if (!isAction(op)) return refuse(profile, 'Acción no válida');
  if (args?.id !== undefined && (typeof args.id !== 'string' || args.id.length > 64)) return refuse(profile, 'Acción no válida');
  return ACTIONS[op](profile, args ?? {}, ctx);
}
