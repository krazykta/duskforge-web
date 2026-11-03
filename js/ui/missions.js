// Misiones diarias y semanales con su tiempo restante, logros permanentes y pase de temporada.
import { refreshMissions, missionDef, nextDayStart, weekKey } from '../core/missions.js';
import { achievementList, claimableAchievements } from '../core/achievements.js';
import { claimableTiers, passTier, seasonOver } from '../core/pass.js';
import { ACHIEVEMENTS, COSMETICS, ECONOMY, PACKS, SEASON, tierId } from '../core/config.js';
import { act, app, getProfile, setProfile, hasPremiumPass, onTap, topBar, toast } from './store.js';
import { cosmeticPreview, showReveal } from './shop.js';
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

const cosmeticOf = (id) => COSMETICS.find((c) => c.id === id);

// Nombre de un premio del pase, también para el inicio.
export const rewardText = (r) => [r.cosmetic && cosmeticOf(r.cosmetic).name, r.pack !== undefined && PACKS[r.pack].name,
  r.coins && `${r.coins} monedas`, r.fragments && `${r.fragments} fragmentos`].filter(Boolean).join(' + ');

// Ilustración del premio: el coleccionable o el sobre delante; las monedas y fragmentos, como cifra.
function rewardHtml(p, r) {
  const art = [
    r.cosmetic && `<span class="cos-preview ${cosmeticOf(r.cosmetic).kind} c-${r.cosmetic}">${cosmeticPreview(p, cosmeticOf(r.cosmetic))}</span>`,
    r.pack !== undefined && `<img class="rw-pack p${r.pack}" src="img/ui/pack.webp" alt="">`,
  ].filter(Boolean);
  const label = [r.cosmetic && cosmeticOf(r.cosmetic).name, r.pack !== undefined && PACKS[r.pack].name].filter(Boolean);
  const amounts = [r.coins && `${icon('coin')}${r.coins}`, r.fragments && `${icon('shard')}${r.fragments}`].filter(Boolean);
  return `${art.length ? `<span class="rw-art">${art.join('')}</span>` : ''}
    ${amounts.length ? `<b class="rw-amount ${art.length ? '' : 'solo'}">${amounts.join(' ')}</b>` : ''}
    ${label.length ? `<span class="rw-label">${label.join(' + ')}</span>` : ''}`;
}

function tierCell(p, n, premium, reached) {
  const r = SEASON.tiers[n - 1][premium ? 'premium' : 'free'];
  const claimed = p.achievements.includes(tierId(n, premium));
  const locked = premium && !hasPremiumPass();
  const open = reached && !claimed && !locked && !seasonOver();
  const cls = `tier-cell ${premium ? 'premium' : 'free'} ${r.pack >= 3 || r.cosmetic ? 'rich' : ''}`;
  return open ? `<button class="${cls} ready" data-tier="${n}" data-premium="${premium ? 1 : ''}" aria-label="Reclamar ${rewardText(r)}">${rewardHtml(p, r)}<span class="rw-claim">Reclamar</span></button>`
    : `<span class="${cls} ${claimed ? 'claimed' : ''} ${locked ? 'locked' : ''}">${rewardHtml(p, r)}${claimed ? `<span class="rw-corner">${icon('check')}</span>` : locked ? `<span class="rw-corner">${icon('lock')}</span>` : ''}</span>`;
}

// Lo que da la vía gratis en toda la temporada, para que se vea de un vistazo lo que hay en juego.
function freeTotals() {
  const free = SEASON.tiers.map((t) => t.free);
  return [`${free.filter((r) => r.pack !== undefined).length} sobres`, `${free.filter((r) => r.cosmetic).length} coleccionables`,
    `${free.reduce((s, r) => s + (r.coins || 0), 0)} monedas`, `${free.reduce((s, r) => s + (r.fragments || 0), 0)} fragmentos`].join(', ');
}

function passView(p) {
  const tier = passTier(p);
  const max = SEASON.tiers.length;
  const into = tier >= max ? SEASON.xpPerTier : p.pass.xp % SEASON.xpPerTier;
  const next = SEASON.tiers[tier]?.free;
  return `
    <div class="pass-hero">
      <img class="pass-hero-art" src="img/cards/dusk_forgemaster.webp" alt="">
      <span class="pass-season">${seasonOver() ? 'Temporada terminada' : `Temporada · termina en ${timeLeft(new Date(SEASON.ends))}`}</span>
      <h2 class="pass-title">${SEASON.name}</h2>
      <div class="pass-progress">
        <span class="tier-medal"><small>Casilla</small><b>${tier}</b><small>de ${max}</small></span>
        <span class="summary-text">
          <b>${next ? `Siguiente: ${rewardText(next)}` : '¡Pase completado!'}</b>
          <span class="xpbar"><span style="width:${(into / SEASON.xpPerTier) * 100}%"></span></span>
          <span class="sub">${into} / ${SEASON.xpPerTier} XP · +${ECONOMY.winXp} por victoria, +${ECONOMY.lossXp} por derrota</span>
        </span>
      </div>
      <p class="pass-totals">Gratis en esta temporada: ${freeTotals()}.</p>
    </div>
    <div class="panel premium-cta">
      <span class="crown">${icon('crown')}</span>
      <span class="summary-text">
        <b>Pase premium</b>
        <span class="sub">La columna dorada: el doble de monedas, sobres legendarios, Dorso dorado, Corona de Ascuas y Ocaso en llamas.</span>
        ${hasPremiumPass() ? `<span class="state hot">${icon('check')}Activo</span>` : '<span class="state">Próximamente</span>'}
      </span>
    </div>
    <div class="pass-track">
      <div class="tier-row head"><span>Gratis</span><span></span><span class="prem">${icon('crown')}Premium</span></div>
      ${SEASON.tiers.map((_, i) => `
      <div class="tier-row ${i < tier ? 'reached' : ''} ${i === tier ? 'current' : ''} ${(i + 1) % 5 ? '' : 'milestone'}">
        ${tierCell(p, i + 1, false, i < tier)}<span class="tier-node"><b>${i + 1}</b></span>${tierCell(p, i + 1, true, i < tier)}
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
  // El pase se abre por lo que toca reclamar o por la casilla en curso, no siempre por la primera.
  const here = app.querySelector('.tier-cell.ready')?.closest('.tier-row') ?? app.querySelector('.tier-row.current');
  if (here && passTier(getProfile()) > 2) here.scrollIntoView({ block: 'center' });
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
