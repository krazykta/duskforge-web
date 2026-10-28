// Misiones diarias y semanales con su tiempo restante, y logros permanentes.
import { refreshMissions, claimMission, missionDef } from '../core/missions.js';
import { achievementList, claimAchievement } from '../core/achievements.js';
import { ACHIEVEMENTS } from '../core/config.js';
import { app, getProfile, setProfile, onTap, topBar, toast } from './store.js';

function timeLeft(to) {
  const ms = to - Date.now();
  const h = Math.floor(ms / 3600000);
  return h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${h} h ${Math.floor((ms % 3600000) / 60000)} min`;
}

function missionRow(m) {
  const d = m.goal ? m : missionDef(m.id); // los logros ya traen su definición
  const done = m.progress >= d.goal;
  const reward = [d.coins && `${d.coins} 🪙`, d.fragments && `${d.fragments} 💠`].filter(Boolean).join(' + ');
  return `
    <div class="mission ${m.claimed ? 'claimed' : ''}">
      <div class="mission-info">
        <b>${d.text}</b>
        <div class="xpbar"><div style="width:${(m.progress / d.goal) * 100}%"></div></div>
        <span class="sub">${m.progress} / ${d.goal} · ${reward}</span>
      </div>
      ${m.claimed ? `<span class="sub">✔ ${m.goal ? 'Conseguido' : 'Reclamada'}</span>`
        : `<button class="btn small ${done ? 'gold' : ''}" data-claim="${m.id}" ${done ? '' : 'disabled'}>Reclamar</button>`}
    </div>`;
}

export function showMissions() {
  setProfile(refreshMissions(getProfile()));
  const m = getProfile().missions;
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7 - ((now.getDay() + 6) % 7));
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Misiones')}
      <div class="panel">
        <h3>Diarias <span class="sub">· se renuevan en ${timeLeft(midnight)}</span></h3>
        ${m.daily.map(missionRow).join('')}
      </div>
      <div class="panel">
        <h3>Semanales <span class="sub">· se renuevan en ${timeLeft(nextMonday)}</span></h3>
        ${m.weekly.map(missionRow).join('')}
      </div>
      <div class="panel">
        <h3>Logros <span class="sub">· ${getProfile().achievements.length} / ${ACHIEVEMENTS.length}</span></h3>
        ${achievementList(getProfile()).map(missionRow).join('')}
      </div>
    </section>`;
  onTap((el) => {
    const b = el.closest('[data-claim]');
    if (!b) return;
    const id = b.dataset.claim;
    const r = id.startsWith('a_') ? claimAchievement(getProfile(), id) : claimMission(getProfile(), id);
    if (r.error) return toast(r.error);
    setProfile(r.profile);
    toast(`+${r.reward.coins} 🪙${r.reward.fragments ? ` +${r.reward.fragments} 💠` : ''}`);
    const y = app.querySelector('.screen').scrollTop; // no saltar arriba al reclamar un logro del final
    showMissions();
    app.querySelector('.screen').scrollTop = y;
  });
}
