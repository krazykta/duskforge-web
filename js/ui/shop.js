// Tienda y apertura de sobres. Las probabilidades se muestran ANTES de comprar.
import { PACK, COLLECTION } from '../core/config.js';
import { CARD_BY_ID } from '../core/cards.js';
import { openPack, RARITIES, RARITY_TEXT, COLLECTIBLE } from '../core/collection.js';
import { app, getProfile, setProfile, onTap, topBar, cardFace, toast, wait } from './store.js';

const pct = (x) => `${(x * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;

export function showShop() {
  const p = getProfile();
  const history = [...p.packHistory].reverse().slice(0, 5);
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Tienda')}
      <div class="pack-offer">
        <div class="pack-art" aria-hidden="true">🎴</div>
        <div>
          <h3>${PACK.name}</h3>
          <p>${PACK.cards} cartas · <b class="coins">${PACK.price} 🪙</b></p>
          <button class="btn gold" data-act="buy" ${p.coins < PACK.price ? 'disabled' : ''}>Comprar y abrir</button>
          ${p.coins < PACK.price ? `<p class="sub">Te faltan ${PACK.price - p.coins} 🪙. Juega partidas o completa misiones.</p>` : ''}
        </div>
      </div>
      <div class="panel">
        <h3>Probabilidades por carta</h3>
        <table class="odds">
          ${RARITIES.map((r) => `<tr class="t-${r}"><td>${RARITY_TEXT[r]}</td><td>${pct(PACK.odds[r])}</td>
            <td class="sub">${COLLECTIBLE.filter((c) => c.rarity === r).length} cartas</td></tr>`).join('')}
        </table>
        <p class="sub">Dentro de cada rareza todas las cartas tienen la misma probabilidad. Si ya tienes el máximo de copias,
          la carta se convierte en fragmentos 💠 (${RARITIES.map((r) => `${RARITY_TEXT[r]} ${COLLECTION.duplicateFragments[r]}`).join(', ')}).
          Las monedas solo se ganan jugando: no se venden ni se cambian por dinero.</p>
      </div>
      ${history.length ? `
      <div class="panel">
        <h3>Últimos sobres</h3>
        ${history.map((h) => `<div class="history-row"><span class="sub">${new Date(h.at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
          <span>${h.cards.map((id) => `<span class="t-${CARD_BY_ID[id].rarity}" title="${CARD_BY_ID[id].name}">${CARD_BY_ID[id].art}</span>`).join(' ')}</span></div>`).join('')}
      </div>` : ''}
    </section>`;
  onTap((el) => {
    if (el.closest('[data-act="buy"]')) buyPack();
  });
}

async function buyPack() {
  const r = openPack(getProfile());
  if (r.error) return toast(r.error);
  setProfile(r.profile); // se guarda antes de la animación: cerrar la app no pierde el sobre
  app.innerHTML = `
    <section class="screen">
      <h2 class="opening-title">¡Toca las cartas para revelarlas!</h2>
      <div class="reveal">
        ${r.results.map((x, i) => `
          <div class="flip" data-i="${i}" role="button" aria-label="Carta oculta ${i + 1}">
            <div class="back r-${CARD_BY_ID[x.id].rarity}-glow">🂠</div>
            <div class="front">
              ${cardFace(CARD_BY_ID[x.id], { foil: getProfile().foils.includes(x.id) })}
              <span class="tag ${x.isNew ? 'new' : x.fragments ? 'dupe' : ''}">${x.isNew ? '¡Nueva!' : x.fragments ? `+${x.fragments} 💠` : 'Copia +1'}</span>
            </div>
          </div>`).join('')}
      </div>
      <div class="menu-buttons hidden" id="after-pack">
        <button class="btn gold" data-go="shop">Seguir</button>
        <button class="btn ghost" data-go="collection">Ver colección</button>
      </div>
    </section>`;
  const root = app.querySelector('section');
  const revealed = new Set();
  const reveal = (i) => {
    if (revealed.has(i) || !root.isConnected) return;
    revealed.add(i);
    root.querySelector(`.flip[data-i="${i}"]`).classList.add('open');
    if (revealed.size === r.results.length) root.querySelector('#after-pack').classList.remove('hidden');
  };
  onTap(async (el) => {
    const f = el.closest('.flip');
    if (f) return reveal(Number(f.dataset.i));
  });
  // Si el jugador no toca, se revelan solas para no bloquear.
  await wait(4000);
  for (let i = 0; i < r.results.length; i++) {
    reveal(i);
    await wait(300);
  }
}
