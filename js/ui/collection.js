// Colección (con filtros y detalle de carta) y constructor de mazos.
import { RULES, COLLECTION } from '../core/config.js';
import { CARD_BY_ID } from '../core/cards.js';
import { COLLECTIBLE, RARITIES, RARITY_TEXT, maxCopies, countCards, deckErrors, craftCard, upgradeFoil } from '../core/collection.js';
import { app, getProfile, setProfile, onTap, topBar, cardFace, toast } from './store.js';

const sortCards = (a, b) => a.cost - b.cost || a.name.localeCompare(b.name);

// ---------- Colección ----------
const filters = { rarity: 'all', type: 'all', cost: 'all' };

function chip(group, value, label) {
  return `<button class="chip ${filters[group] === value ? 'on' : ''}" data-filter="${group}:${value}">${label}</button>`;
}

export function showCollection() {
  const p = getProfile();
  const cards = COLLECTIBLE.filter((c) =>
    (filters.rarity === 'all' || c.rarity === filters.rarity) &&
    (filters.type === 'all' || c.type === filters.type) &&
    (filters.cost === 'all' || (filters.cost === '4' ? c.cost >= 4 : c.cost === Number(filters.cost)))).sort(sortCards);
  const owned = COLLECTIBLE.filter((c) => p.collection[c.id]).length;
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Colección')}
      <p class="sub">${owned} / ${COLLECTIBLE.length} cartas descubiertas</p>
      <div class="filters">
        <div>${chip('rarity', 'all', 'Todas')}${RARITIES.map((r) => chip('rarity', r, RARITY_TEXT[r])).join('')}</div>
        <div>${chip('type', 'all', 'Todo')}${chip('type', 'unit', 'Criaturas')}${chip('type', 'spell', 'Hechizos')}
          ${chip('cost', 'all', 'Coste')}${['1', '2', '3'].map((c) => chip('cost', c, `${c}💎`)).join('')}${chip('cost', '4', '4+💎')}</div>
      </div>
      <div class="grid">
        ${cards.map((c) => cardFace(c, { count: p.collection[c.id] || 0, foil: p.foils.includes(c.id), locked: !p.collection[c.id], attrs: `data-card="${c.id}"` })).join('')
          || '<p class="sub">Ninguna carta con estos filtros.</p>'}
      </div>
    </section>`;
  onTap((el) => {
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
      <p>Tienes <b>${owned} / ${max}</b> copias.</p>
      <div class="modal-actions">
        <button class="btn small" data-act="craft" ${owned >= max || p.fragments < craft ? 'disabled' : ''}>Fabricar · ${craft} 💠</button>
        <button class="btn small gold" data-act="foil" ${!owned || isFoil || p.fragments < foil ? 'disabled' : ''}>${isFoil ? 'Ya es brillante ✨' : `Brillante ✨ · ${foil} 💠`}</button>
      </div>
      <p class="sub">Brillante es una mejora solo visual: no cambia el poder de la carta.</p>
      <button class="btn ghost" data-act="close">Cerrar</button>
    </div>`;
  app.appendChild(bg);
  bg.addEventListener('click', (ev) => {
    ev.stopPropagation(); // que no lo procese también la pantalla de debajo
    const act = ev.target.closest('[data-act]')?.dataset.act;
    if (act === 'close' || ev.target === bg) return showCollection();
    const r = act === 'craft' ? craftCard(getProfile(), id) : act === 'foil' ? upgradeFoil(getProfile(), id) : null;
    if (!r) return;
    if (r.error) return toast(r.error);
    setProfile(r.profile);
    toast(act === 'craft' ? `¡${card.name} fabricada!` : `¡${card.name} ahora es brillante!`);
    showCollection();
    showCardDetail(id);
  });
}

// ---------- Constructor de mazos ----------
let draft = null; // mazo en edición (sin guardar)

export function showDeckBuilder() {
  const p = getProfile();
  if (!draft) draft = [...p.deck];
  const inDeck = countCards(draft);
  const errors = deckErrors(draft, p.collection);
  const changed = draft.slice().sort().join() !== p.deck.slice().sort().join();
  const deckRows = Object.keys(inDeck).map((id) => CARD_BY_ID[id]).sort(sortCards).map((c) => `
    <button class="deck-row r-${c.rarity}" data-remove="${c.id}" aria-label="Quitar ${c.name}">
      <span class="cost">${c.cost}</span><span>${c.art} ${c.name}</span><span class="n">x${inDeck[c.id]}</span>
    </button>`).join('');
  const pool = COLLECTIBLE.filter((c) => p.collection[c.id]).sort(sortCards);
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Mazo')}
      <div class="deck-head">
        <b class="${draft.length === RULES.deckSize ? 'ok' : 'warn'}">${draft.length} / ${RULES.deckSize} cartas</b>
        <button class="btn small gold" data-act="save" ${errors.length || !changed ? 'disabled' : ''}>Guardar</button>
      </div>
      ${errors.length && draft.length >= RULES.deckSize ? `<p class="warn">${errors[0]}</p>` : ''}
      <p class="sub">Toca una carta del mazo para quitarla y una de abajo para añadirla.</p>
      <div class="deck-list">${deckRows || '<p class="sub">Mazo vacío</p>'}</div>
      <h3>Tus cartas</h3>
      <div class="grid">
        ${pool.map((c) => {
          const left = Math.min(p.collection[c.id], maxCopies(c)) - (inDeck[c.id] || 0);
          return cardFace(c, { count: left, foil: p.foils.includes(c.id), locked: left <= 0, attrs: `data-add="${c.id}"` });
        }).join('')}
      </div>
      ${changed ? '<button class="btn ghost small" data-act="reset">Descartar cambios</button>' : ''}
    </section>`;
  onTap((el) => {
    const rm = el.closest('[data-remove]');
    const add = el.closest('[data-add]');
    const act = el.closest('[data-act]')?.dataset.act;
    if (rm) draft.splice(draft.indexOf(rm.dataset.remove), 1);
    else if (add) {
      const id = add.dataset.add;
      const c = CARD_BY_ID[id];
      if (draft.length >= RULES.deckSize) return toast('El mazo ya está completo: quita una carta primero');
      if ((inDeck[id] || 0) >= Math.min(p.collection[id], maxCopies(c))) return toast(`No puedes añadir más copias de ${c.name}`);
      draft.push(id);
    } else if (act === 'save') {
      setProfile({ ...getProfile(), deck: [...draft] });
      toast('Mazo guardado');
    } else if (act === 'reset') draft = [...p.deck];
    else return;
    showDeckBuilder();
  });
}

// Al salir del constructor sin guardar, se descartan los cambios.
export const resetDeckDraft = () => (draft = null);
