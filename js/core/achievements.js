// Logros permanentes: el progreso se calcula con el perfil y cada logro se reclama una vez. Funciones puras.
import { ACHIEVEMENTS } from './config.js';
import { CARD_BY_ID } from './cards.js';
import { levelOf } from './progression.js';

export function achievementStats(p) {
  const owned = Object.keys(p.collection).filter((id) => p.collection[id] > 0);
  return {
    wins: p.wins,
    level: levelOf(p.xp),
    unique: owned.length,
    legendaries: owned.filter((id) => CARD_BY_ID[id]?.rarity === 'legendary').length,
    foils: p.foils.length,
  };
}

export function achievementList(p, defs = ACHIEVEMENTS) {
  const s = achievementStats(p);
  return defs.map((d) => ({ ...d, progress: Math.min(d.goal, s[d.stat]), claimed: p.achievements.includes(d.id) }));
}

export const claimableAchievements = (p) => achievementList(p).filter((a) => !a.claimed && a.progress >= a.goal).length;

export function claimAchievement(p, id) {
  const a = achievementList(p).find((x) => x.id === id);
  if (!a) return { profile: p, error: 'Logro no disponible' };
  if (a.claimed) return { profile: p, error: 'Ya reclamado' };
  if (a.progress < a.goal) return { profile: p, error: 'Aún no está completado' };
  const reward = { coins: a.coins || 0, fragments: a.fragments || 0 };
  return {
    reward,
    profile: { ...p, coins: p.coins + reward.coins, fragments: p.fragments + reward.fragments, achievements: [...p.achievements, id] },
  };
}
