// Interfaz: pantallas, entrada táctil y animaciones. Las reglas viven en core/ y
// aquí solo se llaman y se dibuja el resultado.
import { GAME_NAME, STARTER_DECK, AI_DECK, ECONOMY } from './core/config.js';
import { CARD_BY_ID, cardText, KEYWORD_TEXT } from './core/cards.js';
import { createMatch, playCard, playError, cardTargets, attack, attackTargets, endTurn, takeEvents, findUnit, HERO } from './core/engine.js';
import { nextAction } from './core/ai.js';
import { newProfile, sanitizeProfile, claimMatchRewards, levelOf, xpIntoLevel, localDay } from './core/progression.js';

const app = document.getElementById('app');
const ME = 0;
const FOE = 1;
const STORAGE_KEY = 'cardclash.profile';
const AI_DELAY_MS = 650;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Guardado local ----------
function loadProfile() {
  try { return sanitizeProfile(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { return newProfile(); }
}
function saveProfile() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch { /* sin almacenamiento: se juega igual */ }
}
let profile = loadProfile();

// ---------- Menú ----------
function showMenu() {
  battle = null;
  const lvl = levelOf(profile.xp);
  app.innerHTML = `
    <section class="screen">
      <h1 class="logo">${GAME_NAME.split(':')[0]}<span>ARENA</span></h1>
      <div class="profile">
        <div class="profile-row"><span>Nivel ${lvl}</span><span class="coins">🪙 ${profile.coins}</span></div>
        <div class="xpbar" title="Experiencia"><div style="width:${(xpIntoLevel(profile.xp) / ECONOMY.xpPerLevel) * 100}%"></div></div>
        <div class="stats">${xpIntoLevel(profile.xp)} / ${ECONOMY.xpPerLevel} XP · ${profile.wins} victorias · ${profile.losses} derrotas</div>
      </div>
      <div class="menu-buttons">
        <button class="btn gold" data-act="play">⚔️ Jugar</button>
        <button class="btn ghost" data-act="rules">Cómo jugar</button>
      </div>
    </section>`;
  if (!profile.tutorialSeen) showRules();
}

function showRules() {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal" role="dialog" aria-label="Cómo jugar">
      <h2>Cómo jugar</h2>
      <ul>
        <li>Deja la vida del rival en <b>0</b> para ganar. Ambos empezáis con 20.</li>
        <li>Cada turno ganas <b>energía 💎</b> (hasta 5). Las cartas cuestan energía.</li>
        <li>Toca una carta para verla y <b>toca otra vez</b> para jugarla. Si necesita objetivo, toca el objetivo marcado en rojo.</li>
        <li>Las criaturas con brillo verde pueden atacar: tócala y luego toca su objetivo.</li>
        <li><b>Guardián</b> debe ser atacado primero. <b>Ímpetu</b> ataca al entrar. <b>Escudo</b> anula un golpe. <b>Vampírico</b> te cura al atacar.</li>
      </ul>
      <button class="btn" data-act="close-rules">¡Entendido!</button>
    </div>`;
  app.appendChild(bg);
}

// ---------- Combate ----------
let battle = null;

function startBattle() {
  const state = createMatch({ decks: [STARTER_DECK, AI_DECK], seed: Date.now(), firstPlayer: Math.random() < 0.5 ? ME : FOE });
  takeEvents(state);
  battle = {
    state,
    matchId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    sel: null, // { kind: 'hand', index } | { kind: 'unit', uid }
    inspect: null, // { player, uid } criatura que se está mirando
    busy: false,
    message: state.turn === ME ? 'Empiezas tú' : 'Empieza el rival',
    prevHandLen: 0,
    seenUnits: new Set(), // para animar solo las criaturas recién llegadas
  };
  renderBattle();
  if (state.turn === FOE) runAiTurn();
}

const tKey = (t) => `${t.player}:${t.uid === HERO ? 'h' : t.uid}`;
function parseKey(k) {
  const [p, u] = k.split(':');
  return { player: Number(p), uid: u === 'h' ? HERO : Number(u) };
}

function currentTargets() {
  const { state, sel } = battle;
  if (!sel || state.turn !== ME) return [];
  if (sel.kind === 'unit') return attackTargets(state, ME, sel.uid);
  return playError(state, ME, sel.index) === 'Elige un objetivo' ? cardTargets(state, ME, sel.index) : [];
}

function heroHtml(p, targetSet) {
  const pl = battle.state.players[p];
  const k = tKey({ player: p, uid: HERO });
  const gems = Array.from({ length: pl.maxEnergy }, (_, i) => `<span class="gem ${i < pl.energy ? 'full' : ''}"></span>`).join('');
  return `
    <div class="hero ${targetSet.has(k) ? 'targetable' : ''}" data-t="${k}" role="button" aria-label="${p === ME ? 'Tu héroe' : 'Héroe rival'}, ${pl.hp} de vida">
      <div class="portrait">${p === ME ? '⚔️' : '👹'}</div>
      <div class="hp">❤ ${pl.hp}</div>
      <div><b>${p === ME ? 'Tú' : 'Señor del Abismo'}</b></div>
      <div class="meta"><div class="energy" aria-label="Energía ${pl.energy} de ${pl.maxEnergy}">${gems}</div>🂠 ${pl.hand.length} · 📚 ${pl.deck.length}</div>
    </div>`;
}

function unitHtml(u, p, targetSet) {
  const c = CARD_BY_ID[u.id];
  const k = tKey({ player: p, uid: u.uid });
  const sel = battle.sel && battle.sel.kind === 'unit' && battle.sel.uid === u.uid;
  const canAttack = p === ME && battle.state.turn === ME && attackTargets(battle.state, ME, u.uid).length > 0;
  const isNew = !battle.seenUnits.has(u.uid);
  battle.seenUnits.add(u.uid);
  const cls = ['unit', `r-${c.rarity}`, isNew && 'new', u.guard && 'guard', u.shield && 'shield', canAttack && 'ready', sel && 'selected', targetSet.has(k) && 'targetable'];
  const kw = [u.swift && '⚡', u.drain && '🩸'].filter(Boolean).join('');
  return `
    <div class="${cls.filter(Boolean).join(' ')}" data-t="${k}" role="button" aria-label="${c.name} ${u.atk}/${u.hp}">
      ${c.art}<span class="kw">${kw}</span>
      <span class="stat atk">${u.atk}</span><span class="stat hp ${u.hp < u.maxHp ? 'hurt' : ''}">${u.hp}</span>
    </div>`;
}

function cardHtml(id, i) {
  const { state, sel } = battle;
  const c = CARD_BY_ID[id];
  const err = state.turn === ME ? playError(state, ME, i) : 'No es tu turno';
  const playable = err === null || err === 'Elige un objetivo';
  const cls = ['card', `r-${c.rarity}`, playable ? 'playable' : 'unplayable',
    sel && sel.kind === 'hand' && sel.index === i && 'selected', i >= battle.prevHandLen && 'drawn'];
  const stats = c.type === 'unit' ? `${c.atk}/${c.hp}` : 'Hechizo';
  return `
    <div class="${cls.filter(Boolean).join(' ')}" data-hand="${i}" role="button" aria-label="${c.name}, coste ${c.cost}">
      <span class="cost">${c.cost}</span>
      <span class="art">${c.art}</span>
      <span class="name">${c.name}</span>
      <span class="type">${stats}</span>
    </div>`;
}

function detailHtml() {
  const { state, sel, inspect } = battle;
  let card = null;
  let extra = '';
  let action = '';
  if (sel && sel.kind === 'hand') {
    card = CARD_BY_ID[state.players[ME].hand[sel.index]];
    if (state.turn === ME && playError(state, ME, sel.index) === null) action = `<button class="btn small gold" data-act="play-selected">Jugar</button>`;
  } else {
    const ref = (sel && sel.kind === 'unit' && { player: ME, uid: sel.uid }) || inspect;
    const u = ref && findUnit(state, ref.player, ref.uid);
    if (u) { card = CARD_BY_ID[u.id]; extra = ` · ${u.atk}/${u.hp}`; }
  }
  if (!card) return `<div class="detail">Toca una carta o criatura para ver qué hace.</div>`;
  const base = card.type === 'unit' ? `${card.atk}/${card.hp}` : 'Hechizo';
  return `
    <div class="detail">
      <div><b>${card.name}</b> <small>(${card.cost}💎 · ${base}${extra})</small><br>${cardText(card) || 'Sin habilidad.'}</div>
      ${action}
    </div>`;
}

function renderBattle() {
  const { state } = battle;
  const targetSet = new Set(currentTargets().map(tKey));
  const mine = state.turn === ME;
  app.innerHTML = `
    <section class="screen battle">
      ${heroHtml(FOE, targetSet)}
      <div class="board">${state.players[FOE].board.map((u) => unitHtml(u, FOE, targetSet)).join('')}</div>
      <div class="center">
        <span class="turn-badge ${mine ? 'mine' : 'theirs'}">${mine ? 'TU TURNO' : 'RIVAL'}</span>
        <span class="message">${battle.message}</span>
        <button class="btn small" data-act="end" ${!mine || battle.busy || state.winner !== null ? 'disabled' : ''}>Fin de turno</button>
      </div>
      <div class="board">${state.players[ME].board.map((u) => unitHtml(u, ME, targetSet)).join('')}</div>
      ${heroHtml(ME, targetSet)}
      ${detailHtml()}
      <div class="hand">${state.players[ME].hand.map(cardHtml).join('')}</div>
    </section>`;
  battle.prevHandLen = state.players[ME].hand.length;
}

// Números flotantes y sacudidas a partir de los eventos del motor.
function animateEvents(events) {
  let delay = 0;
  for (const e of events) {
    if (e.type === 'burn') battle.message = 'Mano llena: carta quemada';
    if (e.type === 'fatigue') battle.message = '¡Mazo vacío! Recibes daño de fatiga';
    if (!['damage', 'heal', 'shieldBreak'].includes(e.type)) continue;
    const el = app.querySelector(`[data-t="${tKey(e)}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = `float ${e.type === 'damage' ? 'dmg' : e.type === 'heal' ? 'heal' : 'info'}`;
    f.textContent = e.type === 'damage' ? `-${e.amount}` : e.type === 'heal' ? `+${e.amount}` : '¡Escudo!';
    f.style.left = `${r.left + r.width / 2 - 14}px`;
    f.style.top = `${r.top + r.height / 3}px`;
    f.style.animationDelay = `${delay}ms`;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1000 + delay);
    if (e.type === 'damage') el.classList.add('hit');
    delay += 80;
  }
}

async function lunge(p, uid) {
  const el = app.querySelector(`[data-t="${tKey({ player: p, uid })}"]`);
  if (el) el.classList.add('attacking', p === FOE ? 'enemy' : 'me');
  await wait(300);
}

async function afterAction() {
  const events = takeEvents(battle.state);
  renderBattle();
  animateEvents(events);
  if (battle.state.winner !== null) {
    battle.busy = true;
    renderBattle();
    await wait(1100);
    finishMatch();
    return false;
  }
  return true;
}

async function playerPlay(index, target) {
  battle.sel = null;
  const r = playCard(battle.state, ME, index, target);
  battle.message = r.ok ? '' : r.error;
  await afterAction();
}

async function playerAttack(uid, target) {
  battle.sel = null;
  battle.busy = true;
  await lunge(ME, uid);
  const r = attack(battle.state, ME, uid, target);
  battle.message = r.ok ? '' : r.error;
  battle.busy = false;
  await afterAction();
}

async function runAiTurn() {
  battle.busy = true;
  battle.sel = null;
  renderBattle();
  const s = battle.state;
  while (s.turn === FOE && s.winner === null) {
    await wait(AI_DELAY_MS);
    if (!battle || battle.state !== s) return; // el jugador salió de la partida
    const a = nextAction(s, FOE);
    if (a.type === 'play') {
      battle.message = `El rival juega ${CARD_BY_ID[s.players[FOE].hand[a.handIndex]].name}`;
      playCard(s, FOE, a.handIndex, a.target);
    } else if (a.type === 'attack') {
      await lunge(FOE, a.uid);
      attack(s, FOE, a.uid, a.target);
    } else {
      endTurn(s, FOE);
      battle.message = 'Tu turno';
    }
    if (!(await afterAction())) return;
  }
  battle.busy = false;
  renderBattle();
}

function onBattleTap(el) {
  const { state } = battle;
  if (battle.busy || state.winner !== null) return;
  const act = el.closest('[data-act]')?.dataset.act;
  if (act === 'end') {
    battle.sel = null;
    endTurn(state, ME);
    battle.message = 'Turno del rival';
    afterAction().then((alive) => alive && runAiTurn());
    return;
  }
  if (act === 'play-selected' && battle.sel?.kind === 'hand') return void playerPlay(battle.sel.index, null);

  const tEl = el.closest('[data-t]');
  const handEl = el.closest('[data-hand]');
  const targets = currentTargets();

  if (tEl && battle.sel && targets.some((t) => tKey(t) === tEl.dataset.t)) {
    const target = parseKey(tEl.dataset.t);
    if (battle.sel.kind === 'hand') return void playerPlay(battle.sel.index, target);
    return void playerAttack(battle.sel.uid, target);
  }

  if (handEl) {
    const i = Number(handEl.dataset.hand);
    const err = state.turn === ME ? playError(state, ME, i) : 'Espera tu turno';
    if (battle.sel?.kind === 'hand' && battle.sel.index === i && err === null) return void playerPlay(i, null);
    battle.sel = { kind: 'hand', index: i };
    battle.message = err === null ? 'Toca otra vez para jugarla' : err;
  } else if (tEl) {
    const t = parseKey(tEl.dataset.t);
    battle.inspect = t.uid === HERO ? null : t;
    const canAttack = t.player === ME && t.uid !== HERO && attackTargets(state, ME, t.uid).length > 0;
    battle.sel = canAttack && !(battle.sel?.kind === 'unit' && battle.sel.uid === t.uid) ? { kind: 'unit', uid: t.uid } : null;
    battle.message = battle.sel ? 'Elige a quién atacar' : '';
  } else {
    battle.sel = null;
    battle.message = '';
  }
  renderBattle();
}

// ---------- Resultado ----------
function finishMatch() {
  const won = battle.state.winner === ME;
  const claim = claimMatchRewards(profile, battle.matchId, won, localDay());
  profile = claim.profile;
  saveProfile();
  showResult(won, claim.rewards, battle.state.winner === 'draw');
}

function showResult(won, rewards, draw) {
  battle = null;
  const levelUp = rewards && rewards.levelAfter > rewards.levelBefore;
  app.innerHTML = `
    <section class="screen">
      <h1 class="result-title ${won ? 'win' : 'lose'}">${won ? '¡VICTORIA!' : draw ? 'EMPATE' : 'DERROTA'}</h1>
      ${rewards ? `
      <div class="rewards">
        <div><span>Monedas</span><b class="coins">+${rewards.coins} 🪙</b></div>
        ${rewards.firstWinBonus ? `<div class="bonus"><span>Primera victoria del día</span><span>(incluye +${rewards.firstWinBonus})</span></div>` : ''}
        <div><span>Experiencia</span><b>+${rewards.xp} XP</b></div>
      </div>` : ''}
      ${levelUp ? `<div class="levelup">⬆ ¡Has subido a nivel ${rewards.levelAfter}!</div>` : ''}
      <div class="menu-buttons">
        <button class="btn gold" data-act="play">Jugar otra vez</button>
        <button class="btn ghost" data-act="menu">Menú</button>
      </div>
    </section>`;
}

// ---------- Entrada ----------
app.addEventListener('click', (ev) => {
  const act = ev.target.closest('[data-act]')?.dataset.act;
  if (act === 'close-rules') {
    profile = { ...profile, tutorialSeen: true };
    saveProfile();
    ev.target.closest('.modal-bg').remove();
  } else if (act === 'rules') showRules();
  else if (act === 'play') startBattle();
  else if (act === 'menu') showMenu();
  else if (battle) onBattleTap(ev.target);
});

setTimeout(showMenu, 600); // pantalla de carga breve
