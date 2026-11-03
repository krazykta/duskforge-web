// Pantalla del Desafío de la Forja (decisión 44): entrada, marcador de victorias y derrotas, y el premio al acabar.
import { FORGE, PACKS } from '../core/config.js';
import { forgeOver } from '../core/forge.js';
import { act, app, ask, getCloudUser, getProfile, go, onTap, toast, topBar } from './store.js';
import { showReveal } from './shop.js';
import { icon } from './icons.js';

const prizeText = (n) => `${PACKS[FORGE.prizes[n].pack].name}${FORGE.prizes[n].coins ? ` + ${FORGE.prizes[n].coins} ${icon('coin')}` : ''}`;
const wins = (n) => `${n} ${n === 1 ? 'victoria' : 'victorias'}`;
const losses = (n) => `${n} ${n === 1 ? 'derrota' : 'derrotas'}`;
const pips =(n, max, cls) => Array.from({ length: max }, (_, i) => `<i class="pip ${cls} ${i < n ? 'on' : ''}"></i>`).join('');

export function showForge() {
  const p = getProfile();
  const f = p.forge;
  const over = forgeOver(f);
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Desafío de la Forja', 'modes')}
      <div class="panel arena-card">
        <span class="arena-trophies">${icon('shield')}</span>
        ${f ? `
          <b class="arena-name">${over ? `Desafío terminado: ${wins(f.wins)}` : `${wins(f.wins)} · ${losses(f.losses)}`}</b>
          <span class="forge-pips" aria-label="${f.wins} de ${FORGE.maxWins} victorias">${pips(f.wins, FORGE.maxWins, 'win')}</span>
          <span class="forge-pips" aria-label="${f.losses} de ${FORGE.maxLosses} derrotas">${pips(f.losses, FORGE.maxLosses, 'loss')}</span>
          <span class="sub">${over ? `Tu premio: ${prizeText(f.wins)}` : `Premio ahora: ${prizeText(f.wins)}. Con una victoria más: ${prizeText(f.wins + 1)}`}</span>`
        : `<b class="arena-name">Hasta ${FORGE.maxWins} victorias o ${FORGE.maxLosses} derrotas</b>
          <span class="sub">Cuantas más victorias, mejor premio.</span>`}
      </div>
      ${!getCloudUser()
        ? `<p class="sub">Los rivales del desafío son mazos de otros jugadores: entra en tu cuenta para jugarlo.</p>
           <button class="btn gold wide" data-go="auth">Entrar en mi cuenta</button>`
        : over ? `<button class="btn gold wide" data-act="claim">${icon('spark')}Recoger el premio</button>`
        : f ? `<button class="btn gold wide" data-act="fight">${icon('sword')}Siguiente combate</button>`
        : `<button class="btn gold wide" data-act="enter">Entrar · ${FORGE.price} ${icon('coin')}</button>`}
      <div class="panel">
        <h3>Cómo funciona</h3>
        <ul class="arena-rules">
          <li>Pagas la entrada y juegas contra <b>mazos de otros jugadores</b>, cada vez con más trofeos y más vida.</li>
          <li>Termina al llegar a <b>${FORGE.maxWins} victorias</b> o a <b>${FORGE.maxLosses} derrotas</b>. Cada combate da además su recompensa normal.</li>
          <li>Salir a media partida cuenta como derrota.</li>
        </ul>
      </div>
      <div class="panel">
        <h3>Premios</h3>
        ${FORGE.prizes.map((_, n) => `
          <div class="progress-row ${f?.wins === n ? 'here' : ''}"><span>${wins(n)}</span><b>${prizeText(n)}</b></div>`).join('')}
      </div>
    </section>`;
  onTap(async (el) => {
    if (el.closest('[data-act="fight"]')) return go('battle', null, { forge: true });
    if (el.closest('[data-act="claim"]')) return showReveal(await act('claimForge'), 'forge');
    if (!el.closest('[data-act="enter"]')) return;
    if (getProfile().coins < FORGE.price) return toast('No tienes monedas suficientes');
    if (!(await ask(`¿Entrar en el Desafío de la Forja por ${FORGE.price} monedas?`, { yes: 'Entrar' }))) return;
    const r = await act('enterForge');
    if (r.error) toast(r.error);
    showForge();
  });
}
