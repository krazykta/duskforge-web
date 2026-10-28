// Perfil del jugador, progresión y recompensas de partida. Funciones puras.
// shortcut: el perfil vive en el dispositivo y se puede manipular; en la fase de backend
// las recompensas se validarán en servidor.
import { ECONOMY, COLLECTION, STARTER_DECK, ACHIEVEMENTS } from './config.js';
import { CARD_BY_ID } from './cards.js';
import { countCards, deckErrors, maxCopies } from './collection.js';
import { addProgress, localDay, missionDef } from './missions.js';

export { localDay };
export const PROFILE_VERSION = 2;
const MAX_REMEMBERED_MATCHES = 50;

export function newProfile() {
  return {
    version: PROFILE_VERSION,
    coins: 0, fragments: 0, xp: 0, wins: 0, losses: 0,
    lastFirstWinDay: null, tutorialSeen: false, claimedMatches: [],
    collection: countCards(STARTER_DECK),
    deck: [...STARTER_DECK],
    foils: [],
    achievements: [], // logros ya reclamados (core/achievements.js)
    packHistory: [],
    missions: null, // se generan al consultarlas (core/missions.js)
    settings: { reducedMotion: false, fastAi: false },
  };
}

export const levelOf = (xp, eco = ECONOMY) => Math.floor(xp / eco.xpPerLevel) + 1;
export const xpIntoLevel = (xp, eco = ECONOMY) => xp % eco.xpPerLevel;

const int = (v, max = Number.MAX_SAFE_INTEGER) => (Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), max) : 0);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const strList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

function sanitizeMissionList(list) {
  if (!Array.isArray(list)) return null;
  const clean = list.filter((m) => isObj(m) && missionDef(m.id)).map((m) => ({
    id: m.id, progress: int(m.progress, missionDef(m.id).goal), claimed: m.claimed === true,
  }));
  return clean.length === list.length ? clean : null;
}

// Valida un perfil cargado del almacenamiento. Migra la versión 1 y descarta datos corruptos
// campo a campo, sin perder el resto del progreso.
export function sanitizeProfile(raw) {
  const base = newProfile();
  if (!isObj(raw) || (raw.version !== 1 && raw.version !== PROFILE_VERSION)) return base;

  const collection = { ...base.collection }; // la colección inicial siempre está garantizada
  if (isObj(raw.collection)) {
    for (const [id, n] of Object.entries(raw.collection)) {
      const c = CARD_BY_ID[id];
      if (c && !c.token) collection[id] = Math.max(collection[id] || 0, int(n, maxCopies(c)));
    }
  }
  const deck = strList(raw.deck);
  const m = raw.missions;
  const daily = isObj(m) && sanitizeMissionList(m.daily);
  const weekly = isObj(m) && sanitizeMissionList(m.weekly);
  const settings = isObj(raw.settings) ? raw.settings : {};

  return {
    ...base,
    coins: int(raw.coins), fragments: int(raw.fragments), xp: int(raw.xp), wins: int(raw.wins), losses: int(raw.losses),
    lastFirstWinDay: typeof raw.lastFirstWinDay === 'string' ? raw.lastFirstWinDay : null,
    tutorialSeen: raw.tutorialSeen === true,
    claimedMatches: strList(raw.claimedMatches).slice(-MAX_REMEMBERED_MATCHES),
    collection,
    deck: deckErrors(deck, collection).length === 0 ? deck : [...STARTER_DECK],
    foils: [...new Set(strList(raw.foils).filter((id) => collection[id]))],
    achievements: [...new Set(strList(raw.achievements).filter((id) => ACHIEVEMENTS.some((a) => a.id === id)))],
    packHistory: Array.isArray(raw.packHistory)
      ? raw.packHistory.filter((h) => isObj(h) && Number.isFinite(h.at) && strList(h.cards).every((id) => CARD_BY_ID[id]))
        .map((h) => ({ at: h.at, cards: strList(h.cards) })).slice(-COLLECTION.historySize)
      : [],
    missions: daily && weekly && typeof m.day === 'string' && typeof m.week === 'string' ? { day: m.day, daily, week: m.week, weekly } : null,
    settings: { reducedMotion: settings.reducedMotion === true, fastAi: settings.fastAi === true },
  };
}

// Idempotente por matchId: reclamar dos veces la misma partida no concede nada la segunda vez.
// stats (opcional) hace avanzar las misiones; ver matchStats en core/missions.js.
export function claimMatchRewards(profile, matchId, won, now = new Date(), stats = null, eco = ECONOMY) {
  if (profile.claimedMatches.includes(matchId)) {
    return { profile, rewards: null };
  }
  const today = localDay(now);
  const firstWin = won && profile.lastFirstWinDay !== today;
  const rewards = {
    coins: (won ? eco.winCoins : eco.lossCoins) + (firstWin ? eco.firstWinOfDayCoins : 0),
    xp: won ? eco.winXp : eco.lossXp,
    firstWinBonus: firstWin ? eco.firstWinOfDayCoins : 0,
    levelBefore: levelOf(profile.xp, eco),
  };
  let next = {
    ...profile,
    coins: profile.coins + rewards.coins,
    xp: profile.xp + rewards.xp,
    wins: profile.wins + (won ? 1 : 0),
    losses: profile.losses + (won ? 0 : 1),
    lastFirstWinDay: firstWin ? today : profile.lastFirstWinDay,
    claimedMatches: [...profile.claimedMatches, matchId].slice(-MAX_REMEMBERED_MATCHES),
  };
  if (stats) next = addProgress(next, stats, now);
  rewards.levelAfter = levelOf(next.xp, eco);
  return { profile: next, rewards };
}
