// Une dos partidas que partieron de la misma (dos dispositivos, o jugar sin conexión). Función pura.
import { sanitizeProfile } from './progression.js';

const COUNTERS = ['coins', 'fragments', 'xp', 'wins', 'losses'];

function mergeList(a, b, key, list) {
  if (a[key] !== b[key]) return (a[key] > b[key] ? a : b)[list];
  return a[list].map((m) => {
    const other = b[list].find((x) => x.id === m.id);
    return other ? { ...m, progress: Math.max(m.progress, other.progress), claimed: m.claimed || other.claimed } : m;
  });
}

function mergeMissions(a, b) {
  if (!a || !b) return a ?? b;
  return { day: a.day > b.day ? a.day : b.day, daily: mergeList(a, b, 'day', 'daily'), week: a.week > b.week ? a.week : b.week, weekly: mergeList(a, b, 'week', 'weekly') };
}

// A la partida de la nube se le suma lo que cambió aquí desde base. Mazos y ajustes son del dispositivo en uso.
// shortcut: un logro reclamado en los dos dispositivos paga dos veces; se corregirá si las recompensas pasan al servidor.
export function mergeProfiles(base, local, cloud) {
  if (JSON.stringify(base) === JSON.stringify(local)) return cloud;
  const merged = { ...local };
  for (const k of COUNTERS) merged[k] = Math.max(0, cloud[k] + local[k] - base[k]);
  merged.collection = { ...cloud.collection };
  for (const [id, n] of Object.entries(local.collection)) merged.collection[id] = Math.max(merged.collection[id] || 0, n);
  merged.foils = [...new Set([...cloud.foils, ...local.foils])];
  merged.achievements = [...new Set([...cloud.achievements, ...local.achievements])];
  merged.upgrades = Object.fromEntries(Object.keys(local.upgrades).map((k) => [k, Math.max(cloud.upgrades[k], local.upgrades[k])]));
  merged.cosmetics = { ...local.cosmetics, owned: [...new Set([...cloud.cosmetics.owned, ...local.cosmetics.owned])] };
  merged.pass = { ...local.pass, xp: Math.max(0, cloud.pass.xp + local.pass.xp - base.pass.xp) };
  merged.decks = merged.decks.concat(cloud.decks.slice(merged.decks.length)); // huecos comprados en el otro dispositivo
  merged.claimedMatches = [...new Set([...cloud.claimedMatches, ...local.claimedMatches])];
  merged.packHistory = [...new Map([...cloud.packHistory, ...local.packHistory].map((h) => [h.at, h])).values()].sort((x, y) => x.at - y.at);
  merged.lastFirstWinDay = [cloud.lastFirstWinDay, local.lastFirstWinDay].filter(Boolean).sort().pop() ?? null;
  merged.tutorialSeen = cloud.tutorialSeen || local.tutorialSeen;
  merged.missions = mergeMissions(local.missions, cloud.missions);
  return sanitizeProfile(merged);
}
