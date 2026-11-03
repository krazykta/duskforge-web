// Buzón: noticias, ofertas y regalos. Los mensajes se envían desde Supabase (docs/soporte.md).
import { PACKS } from '../core/config.js';
import { act, app, getCloudUser, getInbox, loadInbox, mailClaimable, markMailSeen, onTap, toast, topBar } from './store.js';
import { escapeHtml } from './account.js';
import { showReveal } from './shop.js';
import { icon } from './icons.js';

const KIND = { news: 'Noticia', gift: 'Regalo', offer: 'Oferta' };

function giftLines(gift) {
  return [
    ...(gift.packs ?? []).map((x) => PACKS[x.pack] && `<li><b>${x.count}</b> × ${PACKS[x.pack].name}</li>`),
    gift.coins && `<li><b>${gift.coins}</b> monedas ${icon('coin')}</li>`,
    gift.fragments && `<li><b>${gift.fragments}</b> fragmentos ${icon('shard')}</li>`,
  ].filter(Boolean).join('');
}

function letter(m) {
  const when = new Date(m.created_at).toLocaleDateString('es-ES', { dateStyle: 'medium' });
  return `
    <article class="panel letter" data-kind="${m.kind}">
      <span class="sub"><span class="kind">${KIND[m.kind]}</span> ${when}</span>
      <h3>${escapeHtml(m.title)}</h3>
      <p>${escapeHtml(m.body)}</p>
      ${m.gift ? `<ul class="gift">${giftLines(m.gift)}</ul>
      ${mailClaimable(m)
    ? `<button class="btn small gold" data-claim="${m.id}">Recoger</button>`
    : `<p class="sub">${icon('check')} Recogido</p>`}` : ''}
      ${m.kind === 'offer' ? '<button class="btn small ghost" data-go="shop">Ir a la tienda</button>' : ''}
    </article>`;
}

function paint(list) {
  const mail = getInbox();
  list.innerHTML = mail.length ? mail.map(letter).join('') : '<p class="sub">Tu buzón está vacío. Aquí llegarán noticias, ofertas y regalos.</p>';
  markMailSeen();
}

export function showMail() {
  const user = getCloudUser();
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Buzón', 'profile')}
      ${user ? `<div class="mail-list" aria-live="polite">${getInbox().length ? '' : '<p class="sub">Cargando tu buzón…</p>'}</div>` : `
      <div class="panel"><h3>Buzón</h3>
        <p class="sub">Las noticias, ofertas y regalos llegan a tu cuenta.</p>
        <button class="btn small gold" data-go="auth">Entrar o crear cuenta</button></div>`}
    </section>`;
  if (!user) return;
  const list = app.querySelector('.mail-list');
  if (getInbox().length) paint(list);
  loadInbox().then((r) => {
    if (!list.isConnected) return;
    if (r.error && !getInbox().length) list.innerHTML = `<p class="warn">${escapeHtml(r.error)}</p>`;
    else paint(list);
  });
  onTap(async (el) => {
    const id = el.closest('[data-claim]')?.dataset.claim;
    if (!id) return;
    const r = await act('claimMail', { id });
    if (r.error) return toast(r.error);
    if (r.results.length) return showReveal(r, 'mail');
    toast('Regalo recogido');
    paint(list);
  });
}
