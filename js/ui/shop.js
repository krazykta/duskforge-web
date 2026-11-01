// Tienda y apertura de sobres. Las probabilidades se muestran ANTES de comprar.
import { PACKS, BIG_PACK, COLLECTION } from '../core/config.js';
import { CARD_BY_ID } from '../core/cards.js';
import { openPack, RARITIES, RARITY_TEXT, COLLECTIBLE } from '../core/collection.js';
import { app, getProfile, setProfile, onTap, topBar, cardFace, artHtml, toast, wait } from './store.js';
import { icon } from './icons.js';
import { sfx } from './sound.js';

const pct = (x) => `${(x * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;

export function showShop() {
  const p = getProfile();
  const history = [...p.packHistory].reverse().slice(0, 5);
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Tienda')}
      <div class="packs stagger">
        ${PACKS.map((pack, i) => `
        <article class="pack-offer">
          <img class="pack-art" src="img/ui/pack.webp" alt="">
          <h3>${pack.name}</h3>
          <p class="sub">${pack.cards} cartas${pack.lastOdds ? ', la última rara o mejor' : ''}</p>
          <button class="btn gold small" data-act="buy" data-pack="${i}" aria-label="Comprar ${pack.name} por ${pack.price} monedas" ${p.coins < pack.price ? 'disabled' : ''}>${icon('coin')}${pack.price}</button>
          ${p.coins < pack.price ? `<p class="sub short">Te faltan ${pack.price - p.coins}</p>` : ''}
        </article>`).join('')}
      </div>
      <div class="panel">
        <h3>Probabilidades por carta</h3>
        <table class="odds">
          <tr class="sub"><td></td><td>Normal</td><td>Última del grande</td><td></td></tr>
          ${RARITIES.map((r) => `<tr class="t-${r}"><td>${RARITY_TEXT[r]}</td><td>${pct(BIG_PACK.odds[r])}</td><td>${pct(BIG_PACK.lastOdds[r])}</td>
            <td class="sub">${COLLECTIBLE.filter((c) => c.rarity === r).length} cartas</td></tr>`).join('')}
        </table>
        <p class="sub">Dentro de cada rareza todas las cartas tienen la misma probabilidad. Si ya tienes el máximo de copias,
          la carta se convierte en fragmentos ${icon('shard')} (${RARITIES.map((r) => `${RARITY_TEXT[r]} ${COLLECTION.duplicateFragments[r]}`).join(', ')}).
          Las monedas solo se ganan jugando: no se venden ni se cambian por dinero.</p>
      </div>
      ${history.length ? `
      <div class="panel">
        <h3>Últimos sobres</h3>
        ${history.map((h) => `<div class="history-row"><span class="sub">${new Date(h.at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
          <span class="minis">${h.cards.map((id) => `<span class="mini r-${CARD_BY_ID[id].rarity}" title="${CARD_BY_ID[id].name}">${artHtml(CARD_BY_ID[id])}</span>`).join('')}</span></div>`).join('')}
      </div>` : ''}
    </section>`;
  onTap((el) => {
    const buy = el.closest('[data-act="buy"]');
    if (buy) buyPack(PACKS[buy.dataset.pack]);
  });
}

async function buyPack(pack) {
  const r = openPack(getProfile(), { pack });
  if (r.error) return toast(r.error);
  setProfile(r.profile); // se guarda antes de la animación: cerrar la app no pierde el sobre
  sfx('packOpen');
  app.innerHTML = `
    <section class="screen">
      <h2 class="opening-title">¡Toca las cartas para revelarlas!</h2>
      <div class="reveal">
        ${r.results.map((x, i) => `
          <div class="flip" data-i="${i}" role="button" aria-label="Carta oculta ${i + 1}">
            <div class="back r-${CARD_BY_ID[x.id].rarity}-glow"></div>
            <div class="front">
              ${cardFace(CARD_BY_ID[x.id], { foil: getProfile().foils.includes(x.id) })}
              <span class="tag ${x.isNew ? 'new' : x.fragments ? 'dupe' : ''}">${x.isNew ? '¡Nueva!' : x.fragments ? `+${x.fragments} ${icon('shard')}` : 'Copia +1'}</span>
            </div>
          </div>`).join('')}
      </div>
      <div class="menu-buttons hidden" id="after-pack">
        <button class="btn gold" data-go="shop">Seguir</button>
        <button class="btn ghost" data-go="collection">Ver colección</button>
      </div>
    </section>`;
  document.body.classList.remove('tabs-on'); // el sobre ocupa toda la pantalla; las pestañas vuelven al seguir
  const root = app.querySelector('section');
  const revealed = new Set();
  const reveal = (i) => {
    if (revealed.has(i) || !root.isConnected) return;
    revealed.add(i);
    root.querySelector(`.flip[data-i="${i}"]`).classList.add('open');
    sfx(`reveal-${CARD_BY_ID[r.results[i].id].rarity}`);
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
