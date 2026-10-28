// Misiones diarias y semanales con su tiempo restante.
import { refreshMissions, claimMission, missionDef } from '../core/missions.js';
import { app, getProfile, setProfile, onTap, topBar, toast } from './store.js';

function timeLeft(to) {
  const ms = to - Date.now();
  const h = Math.floor(ms / 3600000);
  return h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${h} h ${Math.floor((ms % 3600000) / 60000)} min`;
}

function missionRow(m) {
  const d = missionDef(m.id);
  const done = m.progress >= d.goal;
  const reward = [d.coins && `${d.coins} 🪙`, d.fragments && `${d.fragments} 💠`].filter(Boolean).join(' + ');
  return `
    <div class="mission ${m.claimed ? 'claimed' : ''}">
      <div class="mission-info">
        <b>${d.text}</b>
        <div class="xpbar"><div style="width:${(m.progress / d.goal) * 100}%"></div></div>
        <span class="sub">${m.progress} / ${d.goal} · ${reward}</span>
      </div>
      ${m.claimed ? '<span class="sub">✔ Reclamada</span>'
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
    </section>`;
  onTap((el) => {
    const b = el.closest('[data-claim]');
    if (!b) return;
    const r = claimMission(getProfile(), b.dataset.claim);
    if (r.error) return toast(r.error);
    setProfile(r.profile);
    toast(`+${r.reward.coins} 🪙${r.reward.fragments ? ` +${r.reward.fragments} 💠` : ''}`);
    showMissions();
  });
}
