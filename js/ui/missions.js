// Misiones diarias y semanales con su tiempo restante, logros permanentes y pase de temporada.
import { refreshMissions, missionDef, nextDayStart, weekKey } from '../core/missions.js';
import { achievementList, claimableAchievements } from '../core/achievements.js';
import { claimableTiers, passTier, seasonOver } from '../core/pass.js';
import { ACHIEVEMENTS, COSMETICS, PACKS, SEASON, tierId } from '../core/config.js';
import { act, app, getProfile, setProfile, hasPremiumPass, onTap, topBar, toast } from './store.js';
import { showReveal } from './shop.js';
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

const rewardHtml = (r) => [r.coins && `${icon('coin')}${r.coins}`, r.fragments && `${icon('shard')}${r.fragments}`,
  r.pack !== undefined && PACKS[r.pack].name, r.cosmetic && COSMETICS.find((c) => c.id === r.cosmetic).name].filter(Boolean).join(' ');

function tierCell(p, n, premium, reached) {
  const r = SEASON.tiers[n - 1][premium ? 'premium' : 'free'];
  const claimed = p.achievements.includes(tierId(n, premium));
  const open = reached && !claimed && (!premium || hasPremiumPass()) && !seasonOver();
  return open ? `<button class="tier-cell ready" data-tier="${n}" data-premium="${premium ? 1 : ''}">${rewardHtml(r)}</button>`
    : `<span class="tier-cell ${claimed ? 'claimed' : ''} ${premium ? 'premium' : ''}">${claimed ? icon('check') : ''}${rewardHtml(r)}</span>`;
}

function passView(p) {
  const tier = passTier(p);
  const into = tier >= SEASON.tiers.length ? SEASON.xpPerTier : p.pass.xp % SEASON.xpPerTier;
  return `
    <div class="panel pass-head">
      <h3>${SEASON.name} <span class="sub">${seasonOver() ? 'Temporada terminada' : `Termina en ${timeLeft(new Date(SEASON.ends))}`}</span></h3>
      <div class="row"><b>Casilla ${tier} de ${SEASON.tiers.length}</b><span class="sub">${into} / ${SEASON.xpPerTier} XP</span></div>
      <div class="xpbar"><div style="width:${(into / SEASON.xpPerTier) * 100}%"></div></div>
      <p class="sub">Avanzas ganando XP en las partidas contra la IA.</p>
      ${hasPremiumPass() ? `<p class="sub">${icon('check')} Pase premium activo</p>` : '<button class="btn small ghost" disabled>Pase premium: próximamente</button>'}
    </div>
    <div class="panel pass-track">
      <div class="tier-row head"><span></span><span class="sub">Gratis</span><span class="sub">Premium</span></div>
      ${SEASON.tiers.map((_, i) => `
      <div class="tier-row ${i < tier ? 'reached' : ''}">
        <b class="tier-n">${i + 1}</b>${tierCell(p, i + 1, false, i < tier)}${tierCell(p, i + 1, true, i < tier)}
      </div>`).join('')}
    </div>`;
}

// Primero lo que se puede reclamar y al final lo ya reclamado.
const order = (m) => (m.claimed ? 2 : m.progress >= (m.goal ?? missionDef(m.id).goal) ? 0 : 1);

export function showMissions(open) {
  if (open) view = open;
  setProfile(refreshMissions(getProfile()));
  const m = getProfile().missions;
  const midnight = nextDayStart();
  const nextMonday = new Date(new Date(weekKey()).getTime() + 7 * 86400000);
  const claimable = claimableAchievements(getProfile());
  const tiers = claimableTiers(getProfile(), hasPremiumPass());
  const list = (items) => [...items].sort((a, b) => order(a) - order(b)).map(missionRow).join('');
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Misiones')}
      <div class="seg" role="tablist">
        <button role="tab" class="${view === 'missions' ? 'on' : ''}" data-view="missions">Misiones</button>
        <button role="tab" class="${view === 'achievements' ? 'on' : ''}" data-view="achievements">Logros ${achievementList(getProfile()).filter((a) => a.claimed).length}/${ACHIEVEMENTS.length}${claimable ? `<span class="badge">${claimable}</span>` : ''}</button>
        <button role="tab" class="${view === 'pass' ? 'on' : ''}" data-view="pass">Pase${tiers ? `<span class="badge">${tiers}</span>` : ''}</button>
      </div>
      ${view === 'pass' ? passView(getProfile()) : view === 'missions' ? `
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
  onTap(async (el) => {
    const tab = el.closest('[data-view]');
    if (tab) {
      view = tab.dataset.view;
      return showMissions();
    }
    const cell = el.closest('[data-tier]');
    if (cell) return claimPass(Number(cell.dataset.tier), Boolean(cell.dataset.premium));
    const b = el.closest('[data-claim]');
    if (!b) return;
    const id = b.dataset.claim;
    const r = await act(id.startsWith('a_') ? 'claimAchievement' : 'claimMission', { id });
    if (r.error) return toast(r.error);
    sfx('coins');
    toast(`+${r.reward.coins} monedas${r.reward.fragments ? ` y +${r.reward.fragments} fragmentos` : ''}`);
    keepScroll();
  });
}

function keepScroll() {
  const y = app.querySelector('.screen').scrollTop; // no saltar arriba al reclamar lo último de la lista
  showMissions();
  app.querySelector('.screen').scrollTop = y;
}

async function claimPass(n, premium) {
  const r = await act('claimTier', { n, premium });
  if (r.error) return toast(r.error);
  if (r.results) return showReveal(r, 'missions');
  sfx('coins');
  keepScroll();
}
