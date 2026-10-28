// Misiones diarias y semanales. Funciones puras sobre el perfil.
// Estadísticas que hacen avanzar misiones: matches, wins, spells, units, heroDamage, kills, packs.
import { MISSIONS } from './config.js';
import { CARD_BY_ID } from './cards.js';
import { HERO } from './engine.js';

const pad = (n) => String(n).padStart(2, '0');
export const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// La semana empieza el lunes; su clave es la fecha de ese lunes.
export function weekKey(d = new Date()) {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return localDay(monday);
}

// Elige las misiones del día de forma determinista a partir de la fecha.
function pickDaily(day, cfg) {
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const pool = [...cfg.daily];
  const picked = [];
  while (picked.length < cfg.dailyCount && pool.length) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    picked.push(pool.splice(h % pool.length, 1)[0]);
  }
  return picked;
}

const fresh = (defs) => defs.map((m) => ({ id: m.id, progress: 0, claimed: false }));

export function refreshMissions(profile, now = new Date(), cfg = MISSIONS) {
  const day = localDay(now);
  const week = weekKey(now);
  const m = profile.missions;
  if (m && m.day === day && m.week === week) return profile;
  return {
    ...profile,
    missions: {
      day,
      daily: m && m.day === day ? m.daily : fresh(pickDaily(day, cfg)),
      week,
      weekly: m && m.week === week ? m.weekly : fresh(cfg.weekly),
    },
  };
}

export const missionDef = (id, cfg = MISSIONS) => [...cfg.daily, ...cfg.weekly].find((d) => d.id === id);

export function addProgress(profile, stats, now = new Date(), cfg = MISSIONS) {
  const p = refreshMissions(profile, now, cfg);
  const bump = (list) => list.map((m) => {
    const def = missionDef(m.id, cfg);
    const add = (def && stats[def.stat]) || 0;
    return m.claimed || !add ? m : { ...m, progress: Math.min(def.goal, m.progress + add) };
  });
  return { ...p, missions: { ...p.missions, daily: bump(p.missions.daily), weekly: bump(p.missions.weekly) } };
}

export function claimMission(profile, id, now = new Date(), cfg = MISSIONS) {
  const p = refreshMissions(profile, now, cfg);
  const def = missionDef(id, cfg);
  const kind = p.missions.daily.some((m) => m.id === id) ? 'daily' : 'weekly';
  const m = p.missions[kind].find((x) => x.id === id);
  if (!def || !m) return { profile: p, error: 'Misión no disponible' };
  if (m.claimed) return { profile: p, error: 'Ya reclamada' };
  if (m.progress < def.goal) return { profile: p, error: 'Aún no está completada' };
  const reward = { coins: def.coins || 0, fragments: def.fragments || 0 };
  return {
    reward,
    profile: {
      ...p,
      coins: p.coins + reward.coins,
      fragments: p.fragments + reward.fragments,
      missions: { ...p.missions, [kind]: p.missions[kind].map((x) => (x.id === id ? { ...x, claimed: true } : x)) },
    },
  };
}

export function claimableCount(profile, cfg = MISSIONS) {
  const m = profile.missions;
  if (!m) return 0;
  return [...m.daily, ...m.weekly].filter((x) => !x.claimed && x.progress >= (missionDef(x.id, cfg)?.goal ?? Infinity)).length;
}

// Resume los eventos de una partida en estadísticas para las misiones.
export function matchStats(events, won, me = 0) {
  const s = { matches: 1, wins: won ? 1 : 0, spells: 0, units: 0, heroDamage: 0, kills: 0 };
  for (const e of events) {
    if (e.type === 'play' && e.player === me) s[CARD_BY_ID[e.card].type === 'spell' ? 'spells' : 'units']++;
    if (e.type === 'damage' && e.player !== me && e.uid === HERO) s.heroDamage += e.amount;
    if (e.type === 'death' && e.player !== me) s.kills++;
  }
  return s;
}
