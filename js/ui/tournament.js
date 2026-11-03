// Pantalla del torneo semanal (decisión 46): puntos de la semana, premios del lunes y la tabla de los mejores.
import { ARENA, PACKS, TOURNAMENT } from '../core/config.js';
import { arenaIndex } from '../core/arena.js';
import { weekKey } from '../core/missions.js';
import { app, getCloudUser, getProfile, go, onTap, topBar, tournamentBoard } from './store.js';
import { escapeHtml } from './account.js';
import { icon } from './icons.js';

// La semana acaba el lunes a las 00:00 UTC, como weekKey.
export function weekLeft(now = new Date()) {
  const h = Math.max(1, Math.ceil((Date.parse(`${weekKey(now)}T00:00:00Z`) + 7 * 864e5 - now) / 36e5));
  return h > 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${h} h`;
}

const rankText = (from, to) => (from === to ? `${from}.º` : `${from}.º – ${to}.º`);
const giftText = (g) => [...(g.packs ?? []).map((x) => `${x.count > 1 ? `${x.count}× ` : ''}${PACKS[x.pack].name}`), g.coins && `${g.coins} ${icon('coin')}`]
  .filter(Boolean).join(' + ');

const boardHtml = (b) => (b.top.length
  ? `<ol class="daily-top">${b.top.map((r, i) => `<li class="${r.me ? 'me' : ''}"><span>${i + 1}. ${escapeHtml(r.name ?? 'Jugador sin nombre')}</span><b>${r.points} pts</b></li>`).join('')}</ol>`
  : '<p class="sub">Nadie ha sumado puntos esta semana. ¡Gana en la Arena y estrena la tabla!</p>');

export async function showTournament() {
  const p = getProfile();
  const here = arenaIndex(p.trophies);
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Torneo', 'modes')}
      <div class="panel arena-card">
        <span class="arena-trophies">${icon('crown')}</span>
        <b class="arena-name">Termina en ${weekLeft()}</b>
        <span class="sub">Cada victoria en la Arena suma puntos. El lunes, los ${TOURNAMENT.top} mejores reciben su premio en el buzón.</span>
        <div data-mine></div>
      </div>
      ${getCloudUser()
        ? `<button class="btn gold wide" data-act="fight">${icon('sword')}Buscar rival en la Arena</button>`
        : `<p class="sub">El torneo se juega en la Arena, contra otros jugadores: entra en tu cuenta para sumar puntos.</p>
           <button class="btn gold wide" data-go="auth">Entrar en mi cuenta</button>`}
      <div class="panel">
        <h3>Premios del lunes</h3>
        ${TOURNAMENT.prizes.map((x, n) => `
          <div class="progress-row"><span>${rankText((TOURNAMENT.prizes[n - 1]?.upTo ?? 0) + 1, x.upTo)}</span><b>${giftText(x.gift)}</b></div>`).join('')}
      </div>
      <div class="panel">
        <h3>Clasificación de la semana</h3>
        <div data-board><p class="sub">${getCloudUser() ? 'Cargando…' : 'Entra en tu cuenta para ver la tabla.'}</p></div>
      </div>
      <div class="panel">
        <h3>Puntos por victoria</h3>
        <p class="sub">Cuanto más alta tu arena, más vale cada victoria</p>
        ${ARENA.arenas.map((a, n) => `
          <div class="progress-row ${n === here ? 'here' : ''}"><span>${a.name}</span><b>+${TOURNAMENT.points[n]} pts</b></div>`).join('')}
        <p class="sub">A igualdad de puntos va antes quien llegó primero. Perder no quita puntos.</p>
      </div>
    </section>`;
  onTap((el) => {
    if (el.closest('[data-act="fight"]')) go('battle', null, { arena: true });
  });
  if (!getCloudUser()) return;
  const b = await tournamentBoard();
  const slot = app.querySelector('[data-board]');
  if (!slot) return; // ya se ha ido a otra pantalla
  if (!b.top) { slot.innerHTML = '<p class="sub">Sin conexión: la tabla se verá cuando vuelva.</p>'; return; }
  slot.innerHTML = boardHtml(b);
  app.querySelector('[data-mine]').innerHTML = b.mine
    ? `<div class="progress-row here"><span>Tu puesto: ${b.mine.pos}.º</span><b>${b.mine.points} pts</b></div>`
    : '<span class="sub">Aún no tienes puntos esta semana.</span>';
}
