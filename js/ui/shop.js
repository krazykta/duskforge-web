// Tienda: ofertas del día, sobres, cartas sueltas, coleccionables y mejoras. Las probabilidades se muestran ANTES de comprar.
import { COLLECTION, COSMETICS, COSMETIC_KINDS, PACK, PACKS, UPGRADES } from '../core/config.js';
import { CARD_BY_ID } from '../core/cards.js';
import { maxCopies, RARITIES, RARITY_TEXT, COLLECTIBLE } from '../core/collection.js';
import { localDay, nextDayStart } from '../core/missions.js';
import { dailyShop, isBought } from '../core/shop.js';
import { act, app, getProfile, onTap, topBar, cardFace, artHtml, toast, wait } from './store.js';
import { icon } from './icons.js';
import { avatarHtml } from './avatar.js';
import { sfx } from './sound.js';

const pct = (x) => `${(x * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;
const VIEWS = [['offers', 'Ofertas'], ['packs', 'Sobres'], ['cards', 'Cartas'], ['extras', 'Estilo'], ['upgrades', 'Mejoras']];
let view = 'offers';

const price = (coins) => `${icon('coin')}${coins}`;
const afford = (p, coins) => (p.coins < coins ? 'disabled' : '');

function timeToMidnight() {
  const ms = nextDayStart() - new Date();
  return `${Math.floor(ms / 3600000)} h ${Math.floor((ms % 3600000) / 60000)} min`;
}

function offersView(p) {
  const { offers } = dailyShop(localDay());
  return `
    <p class="sub shop-note">Se renuevan en ${timeToMidnight()}. Cada oferta se compra una vez al día.</p>
    <div class="offers stagger">
      ${offers.map((o) => {
        const sold = isBought(p, o.id);
        return `
        <article class="panel offer ${sold ? 'sold' : ''}">
          ${o.pack ? '<img class="pack-art" src="img/ui/pack.webp" alt="">' : `<span class="offer-icon">${icon('shard')}</span>`}
          <div class="mission-info"><b>${o.name}</b><span class="sub">${o.text}</span></div>
          ${sold ? `<span class="done" title="Comprada">${icon('check')}</span>` : `
          <button class="btn gold small" data-offer="${o.id}" aria-label="Comprar ${o.name} por ${o.price} monedas" ${afford(p, o.price)}>
            ${o.was ? `<s>${o.was}</s>` : ''}${price(o.price)}</button>`}
        </article>`;
      }).join('')}
    </div>`;
}

function packsView(p) {
  const history = [...p.packHistory].reverse().slice(0, 5);
  const lastLine = (pack) => pack.lastOdds && `<tr><td class="sub">Última: ${pack.name}</td>${RARITIES.map((r) => `<td>${pct(pack.lastOdds[r])}</td>`).join('')}</tr>`;
  return `
    <div class="packs stagger">
      ${PACKS.map((pack, i) => `
      <article class="pack-offer">
        <img class="pack-art" src="img/ui/pack.webp" alt="">
        <h3>${pack.name}</h3>
        <p class="sub">${pack.cards} cartas${pack.lastOdds ? `, la última ${RARITY_TEXT[RARITIES.find((r) => pack.lastOdds[r] > 0)].toLowerCase()}${pack.lastOdds.legendary === 1 ? '' : ' o mejor'}` : ''}</p>
        <button class="btn gold small" data-act="buy" data-pack="${i}" aria-label="Comprar ${pack.name} por ${pack.price} monedas" ${afford(p, pack.price)}>${price(pack.price)}</button>
        ${p.coins < pack.price ? `<p class="sub short">Te faltan ${pack.price - p.coins}</p>` : ''}
      </article>`).join('')}
    </div>
    <div class="panel">
      <h3>Probabilidades por carta</h3>
      <table class="odds">
        <tr class="sub"><td></td>${RARITIES.map((r) => `<td class="t-${r}">${RARITY_TEXT[r]}</td>`).join('')}</tr>
        <tr><td class="sub">Cada carta</td>${RARITIES.map((r) => `<td>${pct(PACK.odds[r])}</td>`).join('')}</tr>
        ${[...new Set(PACKS.map((x) => x.lastOdds).filter(Boolean))].map((o) => lastLine(PACKS.find((x) => x.lastOdds === o))).join('')}
        <tr><td class="sub">Cartas en juego</td>${RARITIES.map((r) => `<td>${COLLECTIBLE.filter((c) => c.rarity === r).length}</td>`).join('')}</tr>
      </table>
      <p class="sub">Dentro de cada rareza todas las cartas tienen la misma probabilidad. Si ya tienes el máximo de copias,
        la carta se convierte en fragmentos ${icon('shard')} (${RARITIES.map((r) => `${RARITY_TEXT[r]} ${COLLECTION.duplicateFragments[r]}`).join(', ')}).
        Las ofertas usan estas mismas probabilidades. Las monedas solo se ganan jugando: no se venden ni se cambian por dinero.</p>
    </div>
    ${history.length ? `
    <div class="panel">
      <h3>Últimos sobres</h3>
      ${history.map((h) => `<div class="history-row"><span class="sub">${new Date(h.at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
        <span class="minis">${h.cards.map((id) => `<span class="mini r-${CARD_BY_ID[id].rarity}" title="${CARD_BY_ID[id].name}">${artHtml(CARD_BY_ID[id])}</span>`).join('')}</span></div>`).join('')}
    </div>` : ''}`;
}

function cardsView(p) {
  const { cards } = dailyShop(localDay());
  return `
    <p class="sub shop-note">Cartas sueltas de hoy. Se renuevan en ${timeToMidnight()}.</p>
    <div class="shop-cards stagger">
      ${cards.map((item) => {
        const c = CARD_BY_ID[item.id];
        const full = (p.collection[c.id] || 0) >= maxCopies(c);
        const sold = isBought(p, c.id);
        return `
        <article class="shop-card">
          ${item.price < item.was ? '<span class="deal">Oferta</span>' : ''}
          ${cardFace(c, { count: p.collection[c.id] || 0, foil: p.foils.includes(c.id) })}
          <button class="btn gold small" data-card="${c.id}" aria-label="Comprar ${c.name} por ${item.price} monedas" ${sold || full ? 'disabled' : afford(p, item.price)}>
            ${sold ? 'Comprada' : full ? 'Al máximo' : `${item.price < item.was ? `<s>${item.was}</s>` : ''}${price(item.price)}`}</button>
        </article>`;
      }).join('')}
    </div>`;
}

const COSMETIC_RARITY = { common: 'Común', rare: 'Raro', epic: 'Épico', legendary: 'Legendario' }; // dorso, título, marco y estandarte son masculinos

export const cosmeticPreview = (p, c) => (c.kind === 'frame' ? avatarHtml({ ...p, cosmetics: { ...p.cosmetics, frame: c.id } })
  : c.kind === 'title' ? icon('flag') : '');

function cosmeticRow(p, c) {
  const owned = p.cosmetics.owned.includes(c.id);
  const on = p.cosmetics[c.kind] === c.id;
  const action = owned ? `<button class="btn small ${on ? '' : 'ghost'}" data-equip="${c.id}">${on ? 'En uso' : 'Usar'}</button>`
    : c.price ? `<button class="btn gold small" data-cosmetic="${c.id}" aria-label="Comprar ${c.name} por ${c.price} monedas" ${afford(p, c.price)}>${price(c.price)}</button>`
    : '<span class="sub">Del pase</span>';
  return `
    <div class="mission">
      <span class="cos-preview ${c.kind} r-${c.rarity} c-${c.id}" aria-hidden="true">${cosmeticPreview(p, c)}</span>
      <div class="mission-info"><b>${c.name}</b><span class="sub t-${c.rarity}">${COSMETIC_RARITY[c.rarity]}</span></div>
      ${action}
    </div>`;
}

const extrasView = (p) => Object.entries(COSMETIC_KINDS).map(([kind, label]) => `
  <div class="panel"><h3>${label}</h3>${COSMETICS.filter((c) => c.kind === kind).map((c) => cosmeticRow(p, c)).join('')}</div>`).join('');

function upgradesView(p) {
  return `
    <div class="panel">
      ${UPGRADES.map((u) => {
        const level = p.upgrades[u.id];
        const next = u.prices[level];
        return `
        <div class="mission">
          <div class="mission-info"><b>${u.name}</b><span class="sub">${u.text} Nivel ${level} de ${u.prices.length}.</span></div>
          ${next === undefined ? `<span class="done" title="Al máximo">${icon('check')}</span>`
            : `<button class="btn gold small" data-upgrade="${u.id}" aria-label="Mejorar ${u.name} por ${next} monedas" ${afford(p, next)}>${price(next)}</button>`}
        </div>`;
      }).join('')}
    </div>
    <p class="sub shop-note">Las mejoras son para siempre y no cambian cómo funcionan las cartas.</p>`;
}

const RENDER = { offers: offersView, packs: packsView, cards: cardsView, extras: extrasView, upgrades: upgradesView };

// next: pestaña con la que abrir (el perfil lleva directo a Estilo).
export function showShop(next) {
  if (next) view = next;
  const p = getProfile();
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Tienda')}
      <div class="seg rail" role="tablist">${VIEWS.map(([id, label]) => `<button role="tab" class="${view === id ? 'on' : ''}" data-view="${id}">${label}</button>`).join('')}</div>
      ${RENDER[view](p)}
    </section>`;
  app.querySelector('.seg.rail .on').scrollIntoView({ block: 'nearest', inline: 'center' }); // en móviles estrechos no caben todas
  onTap(onShopTap);
}

// Repinta tras una compra sin perder el sitio en la lista.
function done(r) {
  if (r.error) return toast(r.error);
  sfx('coins');
  const y = app.querySelector('.screen').scrollTop;
  showShop();
  app.querySelector('.screen').scrollTop = y;
}

async function onShopTap(el) {
  const hit = (name) => el.closest(`[data-${name}]`)?.dataset[name];
  if (hit('view')) {
    view = hit('view');
    return showShop();
  }
  if (el.closest('[data-act="buy"]')) return showReveal(await act('openPack', { pack: Number(hit('pack')) }));
  if (hit('card')) return done(await act('buyCard', { id: hit('card') }));
  if (hit('cosmetic')) return done(await act('buyCosmetic', { id: hit('cosmetic') }));
  if (hit('equip')) return done(await act('equipCosmetic', { id: hit('equip') }));
  if (hit('upgrade')) return done(await act('buyUpgrade', { id: hit('upgrade') }));
  const offer = hit('offer');
  if (!offer) return;
  const r = await act('buyOffer', { id: offer });
  if (r.results) return showReveal(r);
  done(r);
}

// Destapa lo que ha salido, ya guardado: cerrar la app no pierde el sobre. back: pantalla a la que se vuelve.
export async function showReveal(r, back = 'shop') {
  if (r.error) return toast(r.error);
  sfx('packOpen');
  app.innerHTML = `
    <section class="screen ${r.results.length > 5 ? 'top' : ''}">
      <h2 class="opening-title">¡Toca las cartas para revelarlas!</h2>
      <div class="reveal ${r.results.length > 5 ? 'many' : ''}">
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
        <button class="btn gold" data-go="${back}">Seguir</button>
        <button class="btn ghost" data-go="collection">Ver colección</button>
      </div>
    </section>`;
  document.body.classList.remove('tabs-on'); // el sobre ocupa toda la pantalla; las pestañas vuelven al seguir
  // El sobre reparte el ancho según la pantalla: cada carta se dibuja a tamaño de colección y se escala entera, para que nada se descoloque.
  app.querySelectorAll('.flip').forEach((f) => { f.querySelector('.face').style.transform = `scale(${f.offsetWidth / 108})`; });
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
