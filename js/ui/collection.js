// Colección (con filtros y detalle de carta) y constructor de mazos.
import { RULES, COLLECTION } from '../core/config.js';
import { CARD_BY_ID, SETS, cardText } from '../core/cards.js';
import { COLLECTIBLE, RARITIES, RARITY_TEXT, maxCopies, countCards, deckErrors } from '../core/collection.js';
import { act, app, getProfile, savePrefs, onTap, topBar, cardFace, artHtml, toast } from './store.js';
import { sfx } from './sound.js';
import { icon } from './icons.js';

const sortCards = (a, b) => a.cost - b.cost || a.name.localeCompare(b.name);

// Búsqueda por nombre o habilidad, sin distinguir mayúsculas ni tildes.
const fold = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SEARCH_TEXT = Object.fromEntries(COLLECTIBLE.map((c) => [c.id, fold(`${c.name} ${cardText(c)}`)]));
const matches = (c, query) => !query || fold(query).trim().split(/\s+/).every((w) => SEARCH_TEXT[c.id].includes(w));
const searchBox = (value) => `<input class="search" type="search" placeholder="Buscar nombre o habilidad…" aria-label="Buscar cartas" value="${value.replace(/"/g, '&quot;')}">`;

// Repinta solo la rejilla al escribir, para no perder el foco del buscador.
function bindSearch(state, repaint) {
  app.querySelector('.search')?.addEventListener('input', (ev) => { state.query = ev.target.value; repaint(); });
}

// ---------- Colección ----------
const filters = { set: 'all', rarity: 'all', type: 'all', cost: 'all', owned: 'all', query: '' };
let filtersOpen = false;

function chip(group, value, label, state = filters) {
  return `<button class="chip ${state[group] === value ? 'on' : ''}" data-filter="${group}:${value}">${label}</button>`;
}

const costMatch = (c, cost) => cost === 'all' || (cost === '4' ? c.cost >= 4 : c.cost === Number(cost));
const costChips = (state) => chip('cost', 'all', 'Todo coste', state) + ['0', '1', '2', '3'].map((c) => chip('cost', c, `${c}${icon('gem')}`, state)).join('') + chip('cost', '4', `4+${icon('gem')}`, state);

function collectionGrid() {
  const p = getProfile();
  const cards = COLLECTIBLE.filter((c) =>
    (filters.set === 'all' || c.set === Number(filters.set)) &&
    (filters.rarity === 'all' || c.rarity === filters.rarity) &&
    (filters.type === 'all' || c.type === filters.type) &&
    costMatch(c, filters.cost) &&
    (filters.owned === 'all' || !!p.collection[c.id] === (filters.owned === 'yes')) &&
    matches(c, filters.query)).sort(sortCards);
  return cards.map((c) => cardFace(c, { count: p.collection[c.id] || 0, foil: p.foils.includes(c.id), locked: !p.collection[c.id], attrs: `data-card="${c.id}"` })).join('')
    || '<p class="sub">Ninguna carta con estos filtros.</p>';
}

export function showCollection() {
  const p = getProfile();
  const owned = COLLECTIBLE.filter((c) => p.collection[c.id]).length;
  const active = ['owned', 'set', 'rarity', 'type', 'cost'].filter((k) => filters[k] !== 'all').length;
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Colección')}
      <div class="panel album">
        <div class="row"><b>${owned} / ${COLLECTIBLE.length}</b><span class="sub">cartas descubiertas</span></div>
        <div class="xpbar"><div style="width:${(owned / COLLECTIBLE.length) * 100}%"></div></div>
        <div class="row rarities">${RARITIES.map((r) => {
          const all = COLLECTIBLE.filter((c) => c.rarity === r);
          return `<span class="t-${r}" title="${RARITY_TEXT[r]}">${RARITY_TEXT[r]} <b>${all.filter((c) => p.collection[c.id]).length}/${all.length}</b></span>`;
        }).join('')}</div>
      </div>
      <div class="filters">
        <div class="search-line">
          ${searchBox(filters.query)}
          <button class="icon-btn ${filtersOpen || active ? 'on' : ''}" data-act="filters" aria-expanded="${filtersOpen}" aria-label="Filtros">${icon('filter')}${active ? `<span class="badge">${active}</span>` : ''}</button>
        </div>
        <div class="rails ${filtersOpen ? '' : 'hidden'}">
          <div class="rail">${chip('owned', 'all', 'Todas')}${chip('owned', 'yes', 'Las tengo')}${chip('owned', 'no', 'Me faltan')}</div>
          <div class="rail">${chip('set', 'all', 'Toda expansión')}${SETS.map(([name], i) => chip('set', String(i), name)).join('')}</div>
          <div class="rail">${chip('rarity', 'all', 'Toda rareza')}${RARITIES.map((r) => chip('rarity', r, RARITY_TEXT[r])).join('')}</div>
          <div class="rail">${chip('type', 'all', 'Todo')}${chip('type', 'unit', 'Criaturas')}${chip('type', 'spell', 'Hechizos')}</div>
          <div class="rail">${costChips(filters)}</div>
        </div>
      </div>
      <div class="grid">${collectionGrid()}</div>
    </section>`;
  bindSearch(filters, () => (app.querySelector('.grid').innerHTML = collectionGrid()));
  if (filtersOpen) app.querySelector('.chip.on[data-filter^="set:"]').scrollIntoView({ block: 'nearest', inline: 'center' });
  onTap((el) => {
    if (el.closest('[data-act="filters"]')) {
      filtersOpen = !filtersOpen;
      return showCollection();
    }
    const f = el.closest('[data-filter]');
    if (f) {
      const [group, value] = f.dataset.filter.split(':');
      filters[group] = value;
      return showCollection();
    }
    const c = el.closest('[data-card]');
    if (c) showCardDetail(c.dataset.card);
  });
}

function showCardDetail(id) {
  const card = CARD_BY_ID[id];
  const p = getProfile();
  const owned = p.collection[id] || 0;
  const max = maxCopies(card);
  const craft = COLLECTION.craftCost[card.rarity];
  const foil = COLLECTION.foilCost[card.rarity];
  const isFoil = p.foils.includes(id);
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal detail-modal" role="dialog" aria-label="${card.name}">
      ${cardFace(card, { big: true, foil: isFoil, locked: !owned })}
      <p class="sub">Expansión: ${SETS[card.set][0]}</p>
      <p>Tienes <b>${owned} / ${max}</b> copias.</p>
      <div class="modal-actions">
        <button class="btn small" data-act="craft" ${owned >= max || p.fragments < craft ? 'disabled' : ''}>Fabricar ${icon('shard')}${craft}</button>
        <button class="btn small gold" data-act="foil" ${!owned || isFoil || p.fragments < foil ? 'disabled' : ''}>${isFoil ? 'Ya es brillante' : `Brillante ${icon('shard')}${foil}`}</button>
      </div>
      <p class="sub">Brillante es una mejora solo visual: no cambia el poder de la carta.</p>
      <button class="btn ghost" data-act="close">Cerrar</button>
    </div>`;
  app.appendChild(bg);
  bg.addEventListener('click', async (ev) => {
    ev.stopPropagation(); // que no lo procese también la pantalla de debajo
    const action = ev.target.closest('[data-act]')?.dataset.act;
    if (action === 'close' || ev.target === bg) return showCollection();
    if (action !== 'craft' && action !== 'foil') return;
    const r = await act(action === 'craft' ? 'craftCard' : 'upgradeFoil', { id });
    if (r.error) return toast(r.error);
    if (!bg.isConnected) return;
    sfx('forge');
    toast(action === 'craft' ? `¡${card.name} fabricada!` : `¡${card.name} ahora es brillante!`);
    showCollection();
    showCardDetail(id);
  });
}

// ---------- Constructor de mazos ----------
let draft = null; // mazo en edición (sin guardar)
let slot = null; // hueco de mazo que se está editando
const builder = { query: '', cost: 'all', view: 'deck' };
const CURVE_TOP = 5; // el coste 5 o más va en la misma barra

function poolGrid(inDeck) {
  const p = getProfile();
  return COLLECTIBLE.filter((c) => p.collection[c.id] && costMatch(c, builder.cost) && matches(c, builder.query)).sort(sortCards).map((c) => {
    const left = Math.min(p.collection[c.id], maxCopies(c)) - (inDeck[c.id] || 0);
    return cardFace(c, { count: left, foil: p.foils.includes(c.id), locked: left <= 0, attrs: `data-add="${c.id}"` });
  }).join('') || '<p class="sub">Ninguna carta coincide.</p>';
}

export function showDeckBuilder() {
  const p = getProfile();
  slot ??= p.activeDeck;
  if (!draft) draft = [...p.decks[slot]];
  const inDeck = countCards(draft);
  const errors = deckErrors(draft, p.collection);
  const changed = draft.slice().sort().join() !== p.decks[slot].slice().sort().join();
  const deckRows = Object.keys(inDeck).map((id) => CARD_BY_ID[id]).sort(sortCards).map((c) => `
    <button class="deck-row r-${c.rarity}" data-remove="${c.id}" aria-label="Quitar ${c.name}">
      <span class="thumb">${artHtml(c)}</span><span class="name">${c.name}</span><span class="n">x${inDeck[c.id]}</span><span class="cost">${c.cost}</span>
    </button>`).join('');
  const curve = Array.from({ length: CURVE_TOP + 1 }, (_, n) => draft.filter((id) => (n === CURVE_TOP ? CARD_BY_ID[id].cost >= n : CARD_BY_ID[id].cost === n)).length);
  const tallest = Math.max(1, ...curve);
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Mazos')}
      <div class="seg">${p.decks.map((d, i) => `<button class="${i === slot ? 'on' : ''}" data-slot="${i}" aria-label="Mazo ${i + 1}${i === p.activeDeck ? ', en uso' : ''}">Mazo ${i + 1}${i === p.activeDeck ? icon('swords') : ''}</button>`).join('')}</div>
      <div class="panel deck-status">
        <div class="deck-head">
          <div><b class="${draft.length === RULES.deckSize ? 'ok' : ''}">${draft.length} / ${RULES.deckSize}</b><span class="sub">cartas</span></div>
          <div class="curve" title="Cartas por coste">${curve.map((n, i) => `<span><i style="height:${(n / tallest) * 100}%"></i>${i === CURVE_TOP ? `${i}+` : i}</span>`).join('')}</div>
          <button class="btn small gold" data-act="save" ${errors.length || !changed ? 'disabled' : ''}>Guardar</button>
        </div>
        <div class="xpbar"><div style="width:${(draft.length / RULES.deckSize) * 100}%"></div></div>
        ${errors.length && draft.length >= RULES.deckSize ? `<p class="warn">${errors[0]}</p>` : ''}
        ${slot === p.activeDeck ? '<p class="sub">Es el mazo con el que juegas.</p>' : p.decks[slot].length ? '<button class="btn small ghost" data-act="use">Usar en combate</button>' : ''}
        ${changed ? '<button class="link" data-act="reset">Descartar cambios</button>' : ''}
      </div>
      <div class="seg">
        <button class="${builder.view === 'deck' ? 'on' : ''}" data-view="deck">En el mazo</button>
        <button class="${builder.view === 'pool' ? 'on' : ''}" data-view="pool">Añadir cartas</button>
      </div>
      ${builder.view === 'deck' ? `
      <div class="deck-list">${deckRows || '<p class="sub empty">Mazo vacío. Ve a «Añadir cartas» para llenarlo.</p>'}</div>` : `
      <div class="filters">${searchBox(builder.query)}<div class="rail">${costChips(builder)}</div></div>
      <div class="grid">${poolGrid(inDeck)}</div>`}
    </section>`;
  bindSearch(builder, () => (app.querySelector('.grid').innerHTML = poolGrid(inDeck)));
  onTap((el) => {
    const rm = el.closest('[data-remove]');
    const add = el.closest('[data-add]');
    const act = el.closest('[data-act]')?.dataset.act;
    const f = el.closest('[data-filter]');
    const tab = el.closest('[data-slot]');
    const view = el.closest('[data-view]');
    if (view) builder.view = view.dataset.view;
    else if (tab) {
      slot = Number(tab.dataset.slot);
      draft = [...p.decks[slot]]; // cambiar de hueco descarta lo no guardado
    } else if (f) builder.cost = f.dataset.filter.split(':')[1];
    else if (rm) draft.splice(draft.indexOf(rm.dataset.remove), 1);
    else if (add) {
      const id = add.dataset.add;
      const c = CARD_BY_ID[id];
      if (draft.length >= RULES.deckSize) return toast('El mazo ya está completo: quita una carta primero');
      if ((inDeck[id] || 0) >= Math.min(p.collection[id], maxCopies(c))) return toast(`No puedes añadir más copias de ${c.name}`);
      draft.push(id);
    } else if (act === 'save') {
      savePrefs({ decks: getProfile().decks.map((d, i) => (i === slot ? [...draft] : d)) });
      toast('Mazo guardado');
    } else if (act === 'use') {
      savePrefs({ activeDeck: slot });
      toast(`Jugarás con el Mazo ${slot + 1}`);
    } else if (act === 'reset') draft = [...p.decks[slot]];
    else return;
    const y = app.querySelector('.screen').scrollTop; // seguir en el mismo sitio de la lista al añadir o quitar
    showDeckBuilder();
    app.querySelector('.screen').scrollTop = y;
  });
}

// Al salir del constructor sin guardar, se descartan los cambios.
export function resetDeckDraft() {
  draft = slot = null;
  builder.view = 'deck';
}
