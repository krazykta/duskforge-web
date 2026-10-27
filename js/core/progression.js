// Progresión y recompensas locales. Funciones puras: reciben el perfil y devuelven uno nuevo.
// shortcut: el perfil vive en el dispositivo y se puede manipular; en la fase de backend
// las recompensas se validarán en servidor.
import { ECONOMY } from './config.js';

export const PROFILE_VERSION = 1;
const MAX_REMEMBERED_MATCHES = 50;

export function newProfile() {
  return { version: PROFILE_VERSION, coins: 0, xp: 0, wins: 0, losses: 0, lastFirstWinDay: null, tutorialSeen: false, claimedMatches: [] };
}

export const levelOf = (xp, eco = ECONOMY) => Math.floor(xp / eco.xpPerLevel) + 1;
export const xpIntoLevel = (xp, eco = ECONOMY) => xp % eco.xpPerLevel;

// Valida un perfil cargado del almacenamiento; si está corrupto o es de otra versión, empieza de cero.
export function sanitizeProfile(raw) {
  const base = newProfile();
  if (!raw || typeof raw !== 'object' || raw.version !== PROFILE_VERSION) return base;
  const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  return {
    ...base,
    coins: n(raw.coins), xp: n(raw.xp), wins: n(raw.wins), losses: n(raw.losses),
    lastFirstWinDay: typeof raw.lastFirstWinDay === 'string' ? raw.lastFirstWinDay : null,
    tutorialSeen: raw.tutorialSeen === true,
    claimedMatches: Array.isArray(raw.claimedMatches) ? raw.claimedMatches.filter((x) => typeof x === 'string').slice(-MAX_REMEMBERED_MATCHES) : [],
  };
}

// won: true/false. today: 'AAAA-MM-DD' en hora local. Idempotente por matchId:
// reclamar dos veces la misma partida no concede nada la segunda vez.
export function claimMatchRewards(profile, matchId, won, today, eco = ECONOMY) {
  if (profile.claimedMatches.includes(matchId)) {
    return { profile, rewards: null };
  }
  const firstWin = won && profile.lastFirstWinDay !== today;
  const rewards = {
    coins: (won ? eco.winCoins : eco.lossCoins) + (firstWin ? eco.firstWinOfDayCoins : 0),
    xp: won ? eco.winXp : eco.lossXp,
    firstWinBonus: firstWin ? eco.firstWinOfDayCoins : 0,
    levelBefore: levelOf(profile.xp, eco),
  };
  const next = {
    ...profile,
    coins: profile.coins + rewards.coins,
    xp: profile.xp + rewards.xp,
    wins: profile.wins + (won ? 1 : 0),
    losses: profile.losses + (won ? 0 : 1),
    lastFirstWinDay: firstWin ? today : profile.lastFirstWinDay,
    claimedMatches: [...profile.claimedMatches, matchId].slice(-MAX_REMEMBERED_MATCHES),
  };
  rewards.levelAfter = levelOf(next.xp, eco);
  return { profile: next, rewards };
}

export function localDay(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
