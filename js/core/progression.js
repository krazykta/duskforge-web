// Perfil del jugador, progresión y recompensas de partida. Funciones puras.
// Con cuenta las ejecuta el servidor (core/server.js); sin cuenta, el móvil, y ese progreso no sale de él.
import { ECONOMY, COLLECTION, STARTER_DECK, ACHIEVEMENTS, COSMETICS, COSMETIC_KINDS, FORGE, MAIL, SEASON, TUTORIAL_LESSONS, UPGRADES } from './config.js';
import { CARD_BY_ID } from './cards.js';
import { countCards, deckErrors, fillDeck, maxCopies } from './collection.js';
import { addProgress, localDay, missionDef } from './missions.js';

export { localDay };
export const PROFILE_VERSION = 3;
const MAX_REMEMBERED_MATCHES = 50;
const OLD_DECK_SIZE = 12; // tamaño de mazo anterior a RULES.deckSize
const BASE_DECK_SLOTS = 3;
const KNOWN_ACHIEVEMENTS = new Set(ACHIEVEMENTS.map((a) => a.id));
const isTierClaim = (id) => /^s\d+p?_\d+$/.test(id); // también de temporadas pasadas: el servidor no deja perder ninguna

export function newProfile() {
  return {
    version: PROFILE_VERSION,
    coins: 0, fragments: 0, xp: 0, wins: 0, losses: 0,
    trophies: 0, bestTrophies: 0, // Arena (core/arena.js)
    dailyDone: null, // último día con el reto diario cobrado (core/daily.js)
    forge: null, forgeRuns: 0, // Desafío de la Forja en marcha y cuántos se han empezado (core/forge.js)
    lastFirstWinDay: null, tutorialSeen: false, welcomeClaimed: false, claimedMatches: [], mailClaimed: [],
    tutorial: 0, // lecciones del tutorial hechas o saltadas (core/tutorial.js)
    collection: countCards(STARTER_DECK),
    deck: [...STARTER_DECK], // mazo activo: siempre igual a decks[activeDeck]
    decks: [[...STARTER_DECK], [], []], // huecos de mazo guardados ([] = vacío)
    activeDeck: 0,
    foils: [],
    achievements: [], // logros (core/achievements.js) y casillas del pase (core/pass.js) ya reclamados
    upgrades: { deck: 0, purse: 0 }, // nivel de cada mejora comprada
    cosmetics: { owned: [], ...Object.fromEntries(Object.keys(COSMETIC_KINDS).map((k) => [k, null])) },
    avatar: null, // null: el héroe de siempre; 'card:<id>': una carta que se tiene; 'photo': la foto guardada en el móvil
    pass: { season: SEASON.id, xp: 0 },
    shop: { day: null, bought: [] }, // lo comprado hoy en el escaparate
    packHistory: [],
    missions: null, // se generan al consultarlas (core/missions.js)
    settings: { reducedMotion: false, fastAi: false, sound: true, music: true },
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
  if (!isObj(raw) || !Number.isInteger(raw.version) || raw.version < 1 || raw.version > PROFILE_VERSION) return base;

  const collection = { ...base.collection }; // la colección inicial siempre está garantizada
  if (isObj(raw.collection)) {
    for (const [id, n] of Object.entries(raw.collection)) {
      const c = CARD_BY_ID[id];
      if (c && !c.token) collection[id] = Math.max(collection[id] || 0, int(n, maxCopies(c)));
    }
  }
  // Los mazos de antes de subir el tamaño se completan en vez de perderse.
  const grown = (d) => (d.length === OLD_DECK_SIZE ? fillDeck(d, collection) : d);
  const deck = grown(strList(raw.deck));
  const upgrades = Object.fromEntries(UPGRADES.map((u) => [u.id, int(raw.upgrades?.[u.id], u.prices.length)]));
  const decks = Array.from({ length: BASE_DECK_SLOTS + upgrades.deck }, (_, i) => {
    const d = grown(strList(Array.isArray(raw.decks) ? raw.decks[i] : null));
    return deckErrors(d, collection).length === 0 ? d : [];
  });
  const activeDeck = int(raw.activeDeck, decks.length - 1);
  // Perfiles de antes de los huecos (o hueco activo dañado): el mazo suelto pasa al hueco activo.
  if (!decks[activeDeck].length) decks[activeDeck] = deckErrors(deck, collection).length === 0 ? deck : [...STARTER_DECK];
  const m = raw.missions;
  const daily = isObj(m) && sanitizeMissionList(m.daily);
  const weekly = isObj(m) && sanitizeMissionList(m.weekly);
  const settings = isObj(raw.settings) ? raw.settings : {};
  const owned = [...new Set(strList(raw.cosmetics?.owned).filter((id) => COSMETICS.some((c) => c.id === id)))];
  const equipped = (kind) => (owned.find((id) => id === raw.cosmetics?.[kind] && COSMETICS.some((c) => c.id === id && c.kind === kind)) ?? null);

  return {
    ...base,
    coins: int(raw.coins), fragments: int(raw.fragments), xp: int(raw.xp), wins: int(raw.wins), losses: int(raw.losses),
    trophies: int(raw.trophies), bestTrophies: int(raw.bestTrophies),
    dailyDone: typeof raw.dailyDone === 'string' ? raw.dailyDone : null,
    forge: isObj(raw.forge) ? { run: int(raw.forge.run), wins: int(raw.forge.wins, FORGE.maxWins), losses: int(raw.forge.losses, FORGE.maxLosses) } : null,
    forgeRuns: int(raw.forgeRuns),
    lastFirstWinDay: typeof raw.lastFirstWinDay === 'string' ? raw.lastFirstWinDay : null,
    tutorialSeen: raw.tutorialSeen === true,
    // Quien ya jugaba antes del tutorial no lo necesita.
    tutorial: raw.tutorial === undefined && int(raw.wins) + int(raw.losses) > 0 ? TUTORIAL_LESSONS : int(raw.tutorial, TUTORIAL_LESSONS),
    welcomeClaimed: raw.welcomeClaimed === true,
    claimedMatches: strList(raw.claimedMatches).slice(-MAX_REMEMBERED_MATCHES),
    mailClaimed: strList(raw.mailClaimed).slice(-MAIL.remembered),
    collection,
    deck: decks[activeDeck], decks, activeDeck,
    foils: [...new Set(strList(raw.foils).filter((id) => collection[id]))],
    achievements: [...new Set(strList(raw.achievements).filter((id) => KNOWN_ACHIEVEMENTS.has(id) || isTierClaim(id)))],
    upgrades,
    cosmetics: { owned, ...Object.fromEntries(Object.keys(COSMETIC_KINDS).map((k) => [k, equipped(k)])) },
    avatar: raw.avatar === 'photo' || (typeof raw.avatar === 'string' && raw.avatar.startsWith('card:') && collection[raw.avatar.slice(5)]) ? raw.avatar : null,
    pass: { season: SEASON.id, xp: raw.pass?.season === SEASON.id ? int(raw.pass.xp) : 0 }, // cada temporada empieza de cero
    shop: { day: typeof raw.shop?.day === 'string' ? raw.shop.day : null, bought: strList(raw.shop?.bought) },
    packHistory: Array.isArray(raw.packHistory)
      ? raw.packHistory.filter((h) => isObj(h) && Number.isFinite(h.at) && strList(h.cards).every((id) => CARD_BY_ID[id]))
        .map((h) => ({ at: h.at, cards: strList(h.cards) })).slice(-COLLECTION.historySize)
      : [],
    missions: daily && weekly && typeof m.day === 'string' && typeof m.week === 'string' ? { day: m.day, daily, week: m.week, weekly } : null,
    settings: { reducedMotion: settings.reducedMotion === true, fastAi: settings.fastAi === true, sound: settings.sound !== false, music: settings.music !== false },
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
    coins: (won ? eco.winCoins + eco.pursePerLevel * profile.upgrades.purse : eco.lossCoins) + (firstWin ? eco.firstWinOfDayCoins : 0),
    xp: won ? eco.winXp : eco.lossXp,
    firstWinBonus: firstWin ? eco.firstWinOfDayCoins : 0,
    levelBefore: levelOf(profile.xp, eco),
  };
  let next = {
    ...profile,
    coins: profile.coins + rewards.coins,
    xp: profile.xp + rewards.xp,
    pass: { ...profile.pass, xp: profile.pass.xp + rewards.xp },
    wins: profile.wins + (won ? 1 : 0),
    losses: profile.losses + (won ? 0 : 1),
    lastFirstWinDay: firstWin ? today : profile.lastFirstWinDay,
    claimedMatches: [...profile.claimedMatches, matchId].slice(-MAX_REMEMBERED_MATCHES),
  };
  if (stats) next = addProgress(next, stats, now);
  rewards.levelAfter = levelOf(next.xp, eco);
  return { profile: next, rewards };
}
