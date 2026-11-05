// Desafío de la Forja (decisión 44): pagas la entrada y juegas hasta 7 victorias o 3 derrotas. Funciones puras.
// profile.forge es { run, wins, losses } mientras hay un desafío, null si no; run lo distingue de los anteriores.
import { FORGE, PACKS } from './config.js';
import { giftPacks } from './collection.js';

export const forgeOver = (f) => Boolean(f) && (f.wins >= FORGE.maxWins || f.losses >= FORGE.maxLosses);
export const forgeTrophies = (f) => f.wins * FORGE.trophyStep;

export function enterForge(p) {
  if (p.forge) return { profile: p, error: 'Ya tienes un desafío en marcha' };
  if (p.coins < FORGE.price) return { profile: p, error: 'No tienes monedas suficientes' };
  const run = p.forgeRuns + 1;
  return { profile: { ...p, coins: p.coins - FORGE.price, forgeRuns: run, forge: { run, wins: 0, losses: 0 } } };
}

// Al empezar cada combate se apunta una derrota: cerrar la app a media partida cuenta como perdida.
export const markForgeStart = (p, run) => (p.forge?.run === run && !forgeOver(p.forge) ? { profile: { ...p, forge: { ...p.forge, losses: p.forge.losses + 1 } } } : { profile: p });

// Va detrás de claimMatchRewards: si se gana, la derrota apuntada se cambia por una victoria.
export function claimForgeMatch(claim, run, won) {
  const f = claim.profile.forge;
  if (!claim.rewards || f?.run !== run) return claim;
  const forge = won ? { ...f, wins: Math.min(FORGE.maxWins, f.wins + 1), losses: Math.max(0, f.losses - 1) } : f;
  return { profile: { ...claim.profile, forge }, rewards: { ...claim.rewards, forge } };
}

export function claimForge(p, ctx) {
  if (!forgeOver(p.forge)) return { profile: p, error: 'El desafío aún no ha terminado' };
  const prize = FORGE.prizes[p.forge.wins];
  return giftPacks({ ...p, forge: null, coins: p.coins + prize.coins }, [{ pack: PACKS[prize.pack], count: 1 }], ctx);
}
