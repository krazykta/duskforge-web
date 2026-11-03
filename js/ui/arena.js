// Pantalla de la Arena (decisión 42): trofeos, arena actual y el botón para buscar rival.
import { ARENA } from '../core/config.js';
import { arenaIndex } from '../core/arena.js';
import { app, getCloudUser, getProfile, go, onTap, topBar } from './store.js';
import { icon } from './icons.js';

export function showArena() {
  const p = getProfile();
  const i = arenaIndex(p.trophies);
  const here = ARENA.arenas[i];
  const next = ARENA.arenas[i + 1];
  const pct = next ? ((p.trophies - here.from) / (next.from - here.from)) * 100 : 100;
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Arena', 'menu')}
      <div class="panel arena-card">
        <span class="arena-trophies">${icon('trophy')}<b>${p.trophies}</b></span>
        <b class="arena-name">${here.name}</b>
        <span class="xpbar"><span style="width:${pct}%"></span></span>
        <span class="sub">${next ? `${next.from - p.trophies} trofeos para ${next.name}` : 'Estás en la arena más alta'}</span>
      </div>
      ${getCloudUser()
        ? `<button class="btn gold wide" data-act="fight">${icon('sword')}Buscar rival</button>`
        : `<p class="sub">La Arena se juega contra los mazos de otros jugadores: entra en tu cuenta para jugarla.</p>
           <button class="btn gold wide" data-go="auth">Entrar en mi cuenta</button>`}
      <div class="panel">
        <h3>Cómo funciona</h3>
        <ul class="arena-rules">
          <li>Juegas contra el <b>mazo de otro jugador</b> con trofeos parecidos, llevado por la IA.</li>
          <li>Ganar: <b>+${ARENA.win}</b> trofeos y la recompensa de una victoria. Perder: <b>−${ARENA.loss}</b>.</li>
          <li>Salir a media partida cuenta como derrota.</li>
          <li>Los demás se encuentran tu mazo activo. Si te ganan, no pierdes nada.</li>
        </ul>
      </div>
      <div class="panel">
        <h3>Arenas</h3>
        <p class="sub">Desde cuántos trofeos y las monedas extra por victoria</p>
        ${ARENA.arenas.map((a, n) => `
          <div class="progress-row ${n === i ? 'here' : ''}"><span>${a.name} · ${a.from}</span><b>${a.winBonus ? `+${a.winBonus} ${icon('coin')}` : '–'}</b></div>`).join('')}
        <div class="progress-row"><span>Tu récord</span><b>${p.bestTrophies}</b></div>
      </div>
    </section>`;
  onTap((el) => {
    if (el.closest('[data-act="fight"]')) go('battle', null, { arena: true });
  });
}
