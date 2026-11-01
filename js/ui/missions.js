// Misiones diarias y semanales con su tiempo restante, y logros permanentes.
import { refreshMissions, claimMission, missionDef } from '../core/missions.js';
import { achievementList, claimAchievement, claimableAchievements } from '../core/achievements.js';
import { ACHIEVEMENTS } from '../core/config.js';
import { app, getProfile, setProfile, onTap, topBar, toast } from './store.js';
import { sfx } from './sound.js';
import { icon } from './icons.js';

let view = 'missions';

function timeLeft(to) {
  const ms = to - Date.now();
  const h = Math.floor(ms / 3600000);
  return h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${h} h ${Math.floor((ms % 3600000) / 60000)} min`;
}

function missionRow(m) {
  const d = m.goal ? m : missionDef(m.id); // los logros ya traen su definición
  const done = m.progress >= d.goal;
  const reward = [d.coins && `${icon('coin')}${d.coins}`, d.fragments && `${icon('shard')}${d.fragments}`].filter(Boolean).join(' ');
  return `
    <div class="mission ${m.claimed ? 'claimed' : ''}">
      <div class="mission-info">
        <b>${d.text}</b>
        ${m.claimed ? '' : `
        <div class="xpbar"><div style="width:${Math.min(100, (m.progress / d.goal) * 100)}%"></div></div>
        <span class="sub">${Math.min(m.progress, d.goal)} / ${d.goal}</span>`}
      </div>
      ${m.claimed ? `<span class="done" title="${m.goal ? 'Conseguido' : 'Reclamada'}">${icon('check')}</span>`
        : done ? `<button class="btn small gold" data-claim="${m.id}">Reclamar <span class="prize">${reward}</span></button>`
        : `<span class="prize">${reward}</span>`}
    </div>`;
}

// Primero lo que se puede reclamar y al final lo ya reclamado.
const order = (m) => (m.claimed ? 2 : m.progress >= (m.goal ?? missionDef(m.id).goal) ? 0 : 1);

export function showMissions() {
  setProfile(refreshMissions(getProfile()));
  const m = getProfile().missions;
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7 - ((now.getDay() + 6) % 7));
  const claimable = claimableAchievements(getProfile());
  const list = (items) => [...items].sort((a, b) => order(a) - order(b)).map(missionRow).join('');
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Misiones')}
      <div class="seg" role="tablist">
        <button role="tab" class="${view === 'missions' ? 'on' : ''}" data-view="missions">Misiones</button>
        <button role="tab" class="${view === 'achievements' ? 'on' : ''}" data-view="achievements">Logros ${getProfile().achievements.length}/${ACHIEVEMENTS.length}${claimable ? `<span class="badge">${claimable}</span>` : ''}</button>
      </div>
      ${view === 'missions' ? `
      <div class="panel">
        <h3>Diarias <span class="sub">Se renuevan en ${timeLeft(midnight)}</span></h3>
        ${list(m.daily)}
      </div>
      <div class="panel">
        <h3>Semanales <span class="sub">Se renuevan en ${timeLeft(nextMonday)}</span></h3>
        ${list(m.weekly)}
      </div>` : `
      <div class="panel">${list(achievementList(getProfile()))}</div>`}
    </section>`;
  onTap((el) => {
    const tab = el.closest('[data-view]');
    if (tab) {
      view = tab.dataset.view;
      return showMissions();
    }
    const b = el.closest('[data-claim]');
    if (!b) return;
    const id = b.dataset.claim;
    const r = id.startsWith('a_') ? claimAchievement(getProfile(), id) : claimMission(getProfile(), id);
    if (r.error) return toast(r.error);
    setProfile(r.profile);
    sfx('coins');
    toast(`+${r.reward.coins} monedas${r.reward.fragments ? ` y +${r.reward.fragments} fragmentos` : ''}`);
    const y = app.querySelector('.screen').scrollTop; // no saltar arriba al reclamar un logro del final
    showMissions();
    app.querySelector('.screen').scrollTop = y;
  });
}
