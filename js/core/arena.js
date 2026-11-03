// Arena (decisión 42): trofeos jugando contra el mazo de otro jugador, que lleva la IA. Funciones puras.
import { AI_HP, ARENA, RULES } from './config.js';
import { CARD_BY_ID } from './cards.js';

export const arenaIndex = (trophies) => ARENA.arenas.findLastIndex((a) => trophies >= a.from);

// El mazo de otro jugador se comprueba antes de usarlo: si no vale, se juega contra la IA de siempre.
export const validFoeDeck = (d) => Array.isArray(d) && d.length === RULES.deckSize && d.every((id) => CARD_BY_ID[id] && !CARD_BY_ID[id].token);

// Nivel con el que se calcula la vida del rival (aiHp): normal contra un jugador, más alta contra la IA en arenas altas.
export const arenaLevel = (trophies, foe) => AI_HP.fullAt + (foe ? 0 : arenaIndex(trophies) * ARENA.fallbackLevels);

// Va detrás de claimMatchRewards, con su resultado: si esa partida ya se había cobrado, no hace nada.
// stake son los trofeos que se descontaron al empezar; al ganar se devuelven junto con los ganados.
export function claimArena(claim, stake, won) {
  if (!claim.rewards) return claim;
  const p = claim.profile;
  const bonus = won ? ARENA.arenas[arenaIndex(p.trophies + stake)].winBonus : 0;
  const trophies = won ? p.trophies + stake + ARENA.win : p.trophies;
  return {
    profile: { ...p, coins: p.coins + bonus, trophies, bestTrophies: Math.max(p.bestTrophies, trophies) },
    rewards: { ...claim.rewards, coins: claim.rewards.coins + bonus, arenaBonus: bonus, trophies: won ? ARENA.win : -stake },
  };
}
