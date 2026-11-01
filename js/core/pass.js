// Pase de temporada: casillas que se desbloquean con la XP de las partidas. Funciones puras sobre el perfil.
// La vía premium la abre el servidor (tabla entitlements): owned llega de fuera y el guard lo vuelve a comprobar.
import { PACKS, SEASON, tierId } from './config.js';
import { openPack } from './collection.js';

export const passTier = (p) => Math.min(SEASON.tiers.length, Math.floor(p.pass.xp / SEASON.xpPerTier));
export const seasonOver = (now = new Date()) => now >= new Date(SEASON.ends);

export function claimTier(p, n, premium, { owned = false, now = new Date(), rng = Math.random } = {}) {
  const reward = SEASON.tiers[n - 1]?.[premium ? 'premium' : 'free'];
  const id = tierId(n, premium);
  if (!reward) return { profile: p, error: 'Casilla no válida' };
  if (seasonOver(now)) return { profile: p, error: 'La temporada ha terminado' };
  if (premium && !owned) return { profile: p, error: 'Necesitas el pase premium' };
  if (n > passTier(p)) return { profile: p, error: 'Aún no has llegado a esta casilla' };
  if (p.achievements.includes(id)) return { profile: p, error: 'Ya reclamada' };
  const next = { ...p, coins: p.coins + (reward.coins || 0), fragments: p.fragments + (reward.fragments || 0), achievements: [...p.achievements, id] };
  if (reward.cosmetic) next.cosmetics = { ...p.cosmetics, owned: [...new Set([...p.cosmetics.owned, reward.cosmetic])] };
  if (reward.pack === undefined) return { profile: next, reward };
  return { ...openPack(next, { pack: { ...PACKS[reward.pack], price: 0 }, rng, now }), reward };
}

export function claimableTiers(p, owned = false, now = new Date()) {
  if (seasonOver(now)) return 0;
  let count = 0;
  for (let n = 1; n <= passTier(p); n++) count += Number(!p.achievements.includes(tierId(n, false))) + Number(owned && !p.achievements.includes(tierId(n, true)));
  return count;
}
