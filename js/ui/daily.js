// Pantalla del reto diario (decisión 43): la partida del día, la tabla de los mejores y el botón de compartir.
import { AI_NAMES, DAILY } from '../core/config.js';
import { dailyChallenge, dailyTitle, shareText } from '../core/daily.js';
import { localDay } from '../core/progression.js';
import { app, dailyBoard, getCloudUser, getProfile, go, onTap, toast, topBar } from './store.js';
import { escapeHtml } from './account.js';
import { icon } from './icons.js';

export async function shareDaily(day, turns) {
  const text = shareText(day, turns);
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast('Copiado: pégalo donde quieras'); }
  } catch (err) {
    if (err?.name !== 'AbortError') toast('No se ha podido compartir');
  }
}

const boardHtml = (b) => (b.top.length
  ? `<ol class="daily-top">${b.top.map((r, i) => `<li class="${r.me ? 'me' : ''}"><span>${i + 1}. ${escapeHtml(r.name ?? 'Jugador sin nombre')}</span><b>${r.turns} turnos</b></li>`).join('')}</ol>`
  : '<p class="sub">Nadie lo ha ganado todavía. ¡Sé el primero!</p>');

export async function showDaily() {
  const c = dailyChallenge(localDay(new Date()));
  const done = getProfile().dailyDone === c.day;
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Reto del día', 'modes')}
      <div class="panel arena-card">
        <span class="arena-trophies">${icon('flag')}</span>
        <b class="arena-name">${dailyTitle(c)}</b>
        <span class="sub">La misma partida para todo el mundo: las mismas cartas en el mismo orden. Gana en los menos turnos posibles.</span>
        <span class="sub">${done ? `${icon('check')} Premio de hoy cobrado` : `Primera victoria de hoy: +${DAILY.coins} ${icon('coin')}`}</span>
      </div>
      ${getCloudUser()
        ? `<button class="btn gold wide" data-act="play">${icon('sword')}Jugar el reto</button>`
        : `<p class="sub">El reto se juega contra todo el mundo: entra en tu cuenta para jugarlo.</p>
           <button class="btn gold wide" data-go="auth">Entrar en mi cuenta</button>`}
      <div class="panel">
        <h3>Los mejores de hoy</h3>
        <div data-board><p class="sub">${getCloudUser() ? 'Cargando…' : `Contra ${AI_NAMES[c.rival]}, con el mazo de ${AI_NAMES[c.mine]}.`}</p></div>
      </div>
    </section>`;
  let b = null;
  onTap((el) => {
    if (el.closest('[data-act="play"]')) go('battle', null, { daily: true });
    if (el.closest('[data-act="share"]')) shareDaily(b.day, b.mine); // el día del servidor, por si es justo medianoche
  });
  if (!getCloudUser()) return;
  b = await dailyBoard();
  const slot = app.querySelector('[data-board]');
  if (!slot) return; // ya se ha ido a otra pantalla
  if (!b.top) { slot.innerHTML = '<p class="sub">Sin conexión: la tabla se verá cuando vuelva.</p>'; return; }
  const { mine } = b;
  slot.innerHTML = `${boardHtml(b)}
    ${mine ? `<div class="progress-row"><span>Tu mejor marca</span><b>${mine} turnos</b></div>
      <button class="btn ghost wide" data-act="share">${icon('next')}Compartir mi marca</button>` : ''}`;
}
