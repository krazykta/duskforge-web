// Reto diario (decisión 43): la misma partida para todo el mundo cada día. Funciones puras.
import { AI_DECKS, AI_NAMES, DAILY } from './config.js';

// FNV-1a: el reto sale solo de la fecha, así que es igual en todos los móviles y en el servidor.
function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  return h;
}

// day es la fecha UTC (localDay), la misma que usan las misiones. Juegas con el mazo de un rival contra otro.
export function dailyChallenge(day) {
  const h = hash(`reto:${day}`);
  const rival = h % AI_DECKS.length;
  const mine = (rival + 1 + ((h >>> 8) % (AI_DECKS.length - 1))) % AI_DECKS.length; // nunca el mismo que el rival
  return { day, seed: hash(`semilla:${day}`), first: (h >>> 16) % 2, rival, mine, deck: AI_DECKS[mine] };
}
export const dailyTitle = (c) => `Gana con el mazo de ${AI_NAMES[c.mine]} contra ${AI_NAMES[c.rival]}`;

// turnNumber cuenta los turnos de los dos; la marca son los tuyos.
export const ownTurns = (turnNumber, first) => (first === 0 ? Math.ceil(turnNumber / 2) : Math.floor(turnNumber / 2));

export const shareText = (day, turns) => `DUSKFORGE · Reto del ${day.slice(8, 10)}-${day.slice(5, 7)} · ganado en ${turns} turnos 🔥\n${DAILY.url}`;

// Va detrás de claimMatchRewards: la primera victoria del reto de cada día da DAILY.coins de más.
export function claimDaily(claim, day, won) {
  if (!claim.rewards || !won || claim.profile.dailyDone === day) return claim;
  const p = claim.profile;
  return {
    profile: { ...p, coins: p.coins + DAILY.coins, dailyDone: day },
    rewards: { ...claim.rewards, coins: claim.rewards.coins + DAILY.coins, daily: DAILY.coins },
  };
}
