// Pantalla de combate: dibuja el estado del motor y traduce toques en acciones.
import { AI_DECKS, AI_NAMES, TUTORIAL_LESSONS } from '../core/config.js';
import { LESSONS, lessonStep, setupLesson } from '../core/tutorial.js';
import { CARD_BY_ID } from '../core/cards.js';
import { attackStyle, fxElement, RANGED } from '../core/cardfx.js';
import { createMatch, playCard, playError, cardTargets, attack, attackTargets, endTurn, concede, takeEvents, findUnit, actionError, stateSignature, HERO } from '../core/engine.js';
import { aiAction, MIN_TURNS_TO_COUNT, setupMatch } from '../core/replay.js';
import { claimMatchRewards, levelOf } from '../core/progression.js';
import { matchStats } from '../core/missions.js';
import { app, beginMatch, endMatch, getCloudUser, getProfile, setProfile, savePrefs, go, onTap, wait, ask, artHtml, cardFace, toast } from './store.js';
import { icon } from './icons.js';
import { avatarHtml } from './avatar.js';
import { sfx, eventSound } from './sound.js';
import { motionOn, strikeFx, shootFx, castFx, healFx, auraFx, deathFx, landFx, shake } from './fx.js';

let ME = 0; // con amigos, cada móvil ocupa un asiento de la misma partida
let FOE = 1;
const aiDelay = () => (getProfile().settings.fastAi ? 300 : 650);

let battle = null;

// net (partida con amigos): { room, seat, decks, seed, first, name? }. Sin él se juega contra la IA.
// Con cuenta, la semilla, el rival y el mazo los da el servidor, que luego repite la partida con las jugadas guardadas.
// mode (solo con cuenta): { arena: true }, el rival es el mazo de otro jugador y hay trofeos en juego (core/arena.js);
// { daily: true }, el reto del día (core/daily.js); { forge: true }, un combate del Desafío de la Forja (core/forge.js).
export async function startBattle(net = null, mode = undefined) {
  if (!net && !mode && getProfile().tutorial < TUTORIAL_LESSONS && await wantsLesson()) return setupBattle(null, null, getProfile().tutorial);
  if (net || !getCloudUser()) return setupBattle(net, null);
  app.innerHTML = `<section class="screen"><p class="sub preparing">${mode?.arena ? 'Buscando rival…' : 'Preparando la partida…'}</p></section>`;
  onTap(() => {});
  const ticket = await beginMatch(mode);
  if (mode && !ticket.seed) {
    const [what, screen] = mode.arena ? ['la Arena', 'arena'] : mode.forge ? ['el desafío', 'forge'] : ['el reto', 'daily'];
    toast(`Sin conexión: ${what} necesita internet`);
    return go(screen);
  }
  if (!ticket.id) toast(ticket.seed ? 'Has llegado al tope de hoy: esta partida no da recompensa' : 'Sin conexión: esta partida no da recompensa');
  setupBattle(null, ticket);
}

// Las primeras partidas son lecciones (core/tutorial.js). Saltarlas pide confirmación, porque un toque fuera del aviso también dice que no.
async function wantsLesson() {
  const n = getProfile().tutorial;
  app.innerHTML = '<section class="screen battle"></section>';
  onTap(() => {});
  if (await ask(`Tutorial ${n + 1} de ${TUTORIAL_LESSONS}: ${LESSONS[n].title}. ${LESSONS[n].intro}`, { yes: 'Empezar', no: 'Saltar tutorial' })) return true;
  if (!(await ask('¿Saltar el tutorial? Las normas siguen en Perfil → Cómo jugar.', { yes: 'Saltar', no: 'Hacer el tutorial' }))) return true;
  savePrefs({ tutorial: TUTORIAL_LESSONS });
  return false;
}

// lesson: número de lección del tutorial; sin rival real, sin servidor y sin recompensa.
function setupBattle(net, ticket, lesson = null) {
  ME = net ? net.seat : 0;
  FOE = 1 - ME;
  const rival = ticket?.rival ?? Math.floor(Math.random() * AI_DECKS.length);
  const state = lesson !== null ? setupLesson(lesson, Date.now())
    : net ? createMatch({ decks: net.decks, seed: net.seed, firstPlayer: net.first })
    : setupMatch({ deck: ticket?.deck ?? getProfile().deck, seed: ticket?.seed ?? Date.now(), first: ticket?.first ?? (Math.random() < 0.5 ? ME : FOE), rival, level: ticket?.level ?? levelOf(getProfile().xp), foe: ticket?.foe });
  takeEvents(state);
  battle = {
    state,
    net,
    rivalName: lesson !== null ? 'Instructor' : net ? net.name ?? 'Tu amigo' : ticket?.foe ? ticket.foe.name ?? 'Rival de la Arena' : AI_NAMES[rival],
    lesson,
    matchId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    ticket, // con cuenta: la partida que abrió el servidor ({} si no se pudo)
    moves: [], // las jugadas propias, para que el servidor las repita
    sel: null, // { kind: 'hand', index, aiming } | { kind: 'unit', uid }
    inspect: null, // { player, uid } criatura que se está mirando
    busy: false,
    message: state.turn === ME ? 'Empiezas tú' : 'Empieza el rival',
    prevHandLen: 0,
    prevFoeHand: 0,
    seenUnits: new Set(), // para animar solo las criaturas recién llegadas
    log: [], // todos los eventos, para las estadísticas de misiones y el historial
  };
  if (net) net.room.onStop = (m) => rivalStopped(state, m.type === 'left' ? 'Tu amigo se ha ido' : 'Tu amigo se ha rendido');
  onTap(onBattleTap);
  sfx('shuffle');
  renderBattle();
  if (state.turn === FOE) runAiTurn();
}

const tKey = (t) => `${t.player}:${t.uid === HERO ? 'h' : t.uid}`;
function parseKey(k) {
  const [p, u] = k.split(':');
  return { player: Number(p), uid: u === 'h' ? HERO : Number(u) };
}
const tEl = (key) => app.querySelector(`[data-t="${key}"]`);
const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

function currentTargets() {
  const { state, sel } = battle;
  if (!sel || state.turn !== ME) return [];
  if (sel.kind === 'unit') return attackTargets(state, ME, sel.uid);
  return sel.aiming && playError(state, ME, sel.index) === 'Elige un objetivo' ? cardTargets(state, ME, sel.index) : [];
}

const dies = (u, amount, source) => amount > 0 && !u.shield && (u.hp <= amount || source?.poison);

// Qué va a pasar si se elige ese objetivo: calavera, cae él; aviso, cae tu atacante.
function previewOf(t) {
  const { state, sel } = battle;
  const unit = t.uid === HERO ? null : findUnit(state, t.player, t.uid);
  if (sel.kind === 'unit') {
    const a = findUnit(state, ME, sel.uid);
    const kills = unit ? dies(unit, a.atk, a) : state.players[t.player].hp <= a.atk;
    return `${kills ? icon('skull') : ''}${unit && dies(a, unit.atk, unit) ? icon('warn') : ''}`;
  }
  const e = CARD_BY_ID[state.players[ME].hand[sel.index]].effect;
  if (e?.kind === 'destroy') return unit ? icon('skull') : '';
  if (e?.kind !== 'damage' && e?.kind !== 'damageHeal') return '';
  return (unit ? dies(unit, e.amount) : state.players[t.player].hp <= e.amount) ? icon('skull') : '';
}

const previewHtml = (text) => (text ? `<span class="preview">${text}</span>` : '');

function heroHtml(p, targets) {
  const pl = battle.state.players[p];
  const k = tKey({ player: p, uid: HERO });
  const gems = Array.from({ length: pl.maxEnergy }, (_, i) => `<span class="gem ${i < pl.energy ? 'full' : ''}"></span>`).join('');
  const life = pl.hp > battle.state.rules.startHp ? 'over' : pl.hp <= 5 ? 'low' : '';
  return `
    <div class="hero ${targets.has(k) ? 'targetable' : ''}" data-t="${k}" role="button" aria-label="${p === ME ? 'Tu héroe' : 'Héroe rival'}, ${pl.hp} de vida">
      ${p === ME ? avatarHtml() : '<img class="portrait" src="img/ui/hero_foe.webp" alt="">'}
      <div class="who"><b>${p === ME ? 'Tú' : battle.rivalName}</b><div class="hp ${life}">${icon('heart')}${pl.hp}</div></div>
      <div class="meta">
        <div class="energy" aria-label="Energía ${pl.energy} de ${pl.maxEnergy}"><b>${pl.energy}/${pl.maxEnergy}</b>${gems}</div>
        <div class="piles"><span title="Cartas en la mano">${icon('hand')}${pl.hand.length}</span><span title="Cartas en el mazo">${icon('deck')}${pl.deck.length}</span></div>
      </div>
      ${previewHtml(targets.get(k))}
    </div>`;
}

// Mano del rival: dorsos en abanico, medio escondidos tras su barra.
function foeHandHtml() {
  const n = battle.state.players[FOE].hand.length;
  const cards = Array.from({ length: n }, (_, i) => {
    const o = i - (n - 1) / 2;
    const isNew = i >= battle.prevFoeHand;
    return `<div class="foe-card ${isNew ? 'drawn' : ''}" style="transform: translateY(${-o * o}px) rotate(${-o * 4}deg); ${isNew ? `animation-delay: ${(i - battle.prevFoeHand) * 70}ms` : ''}"></div>`;
  });
  return `<div class="foe-hand" aria-hidden="true">${cards.join('')}</div>`;
}

const KEYWORDS = [['swift', 'bolt'], ['drain', 'drop'], ['poison', 'skull'], ['fury', 'sword'], ['frozen', 'snow'], ['silenced', 'mute']];

function unitHtml(u, p, targets) {
  const c = CARD_BY_ID[u.id];
  const k = tKey({ player: p, uid: u.uid });
  const sel = battle.sel && battle.sel.kind === 'unit' && battle.sel.uid === u.uid;
  const myTurn = p === ME && battle.state.turn === ME;
  const canAttack = myTurn && attackTargets(battle.state, ME, u.uid).length > 0;
  const isNew = !battle.seenUnits.has(u.uid);
  battle.seenUnits.add(u.uid);
  const foil = p === ME && getProfile().foils.includes(u.id);
  const cls = ['unit', `r-${c.rarity}`, foil && 'foil', isNew && 'new', u.guard && 'guard', u.shield && 'shield', u.stealth && 'stealth',
    u.frozen && 'frozen', u.silenced && 'silenced', canAttack && 'ready', sel && 'selected', targets.has(k) && 'targetable'];
  const kw = KEYWORDS.filter(([k]) => u[k]).map(([k, name]) => `<i class="k-${k}">${icon(name)}</i>`).join('') + (myTurn && !u.ready && !u.frozen ? icon('sleep') : '');
  return `
    <div class="${cls.filter(Boolean).join(' ')}" data-t="${k}" role="button" aria-label="${c.name} ${u.atk}/${u.hp}">
      ${artHtml(c)}<span class="kw">${kw}</span>
      <span class="stat atk">${u.atk}</span><span class="stat hp ${u.hp < u.maxHp ? 'hurt' : ''}">${u.hp}</span>
      ${previewHtml(targets.get(k))}
    </div>`;
}

const canPlay = (err) => err === null || err === 'Elige un objetivo';

function cardHtml(id, i) {
  const { state, sel } = battle;
  const c = CARD_BY_ID[id];
  const err = state.turn === ME ? playError(state, ME, i) : 'No es tu turno';
  const cls = ['card', `r-${c.rarity}`, getProfile().foils.includes(id) && 'foil', canPlay(err) ? 'playable' : 'unplayable',
    sel && sel.kind === 'hand' && sel.index === i && 'selected', i >= battle.prevHandLen && 'drawn'];
  const delay = i >= battle.prevHandLen ? `style="animation-delay: ${(i - battle.prevHandLen) * 70}ms"` : '';
  const stats = c.type === 'unit' ? `${icon('sword')}${c.atk} ${icon('heart')}${c.hp}` : 'Hechizo';
  return `
    <div class="${cls.filter(Boolean).join(' ')}" data-hand="${i}" ${delay} role="button" aria-label="${c.name}, coste ${c.cost}">
      <span class="cost">${c.cost}</span>
      <span class="art">${artHtml(c)}</span>
      <span class="name" style="--n:${c.name.length}">${c.name}</span>
      <span class="type">${stats}</span>
    </div>`;
}

const STATUS = [['guard', 'shield', 'Guardián'], ['shield', 'spark', 'Escudo'], ['swift', 'bolt', 'Ímpetu'], ['drain', 'drop', 'Vampírico'], ['poison', 'skull', 'Letal'],
  ['fury', 'sword', 'Furia'], ['stealth', 'fog', 'Sigilo'], ['frozen', 'snow', 'Congelada'], ['silenced', 'mute', 'Silenciada']];

// Zoom de la carta tocada. No recibe toques (salvo su botón): debajo se puede seguir eligiendo.
function zoomHtml() {
  const { state, sel, inspect } = battle;
  const foils = getProfile().foils;
  if (sel?.kind === 'hand') {
    if (sel.aiming) return '';
    const id = state.players[ME].hand[sel.index];
    if (!id) return '';
    const err = state.turn === ME ? playError(state, ME, sel.index) : 'Espera tu turno';
    const side = err === null ? '<button class="btn small gold" data-act="play-selected">Jugar</button>'
      : err === 'Elige un objetivo' ? '<button class="btn small gold" data-act="aim">Elegir objetivo</button>'
      : `<span class="z-note">${err}</span>`;
    return `<div class="zoom over-hand">${cardFace(CARD_BY_ID[id], { foil: foils.includes(id) })}<div class="z-side">${side}</div></div>`;
  }
  const ref = sel?.kind === 'unit' ? { player: ME, uid: sel.uid } : inspect;
  const u = ref && findUnit(state, ref.player, ref.uid);
  if (!u) return '';
  const legend = sel?.kind === 'unit' ? `<span class="z-note">${icon('skull')} cae el objetivo<br>${icon('warn')} cae el tuyo</span>` : '';
  const chips = legend + STATUS.filter(([k]) => u[k]).map(([, name, text]) => `<span class="z-note">${icon(name)} ${text}</span>`).join('');
  const face = cardFace({ ...CARD_BY_ID[u.id], atk: u.atk, hp: u.hp }, { foil: ref.player === ME && foils.includes(u.id) });
  return `<div class="zoom">${face}<div class="z-side">${chips}</div></div>`;
}

function paintZoom() {
  app.querySelector('.zoom')?.remove();
  app.firstElementChild.insertAdjacentHTML('beforeend', zoomHtml());
}

const boardHtml = (p, targets) => {
  const units = battle.state.players[p].board;
  return `<div class="board ${units.length > 5 ? 'crowded' : ''}">${units.map((u) => unitHtml(u, p, targets)).join('')}</div>`;
};

function nothingLeft() {
  const { state } = battle;
  const me = state.players[ME];
  return !me.hand.some((_, i) => canPlay(playError(state, ME, i))) && !me.board.some((u) => attackTargets(state, ME, u.uid).length);
}

function renderBattle() {
  const { state } = battle;
  const targets = new Map(currentTargets().map((t) => [tKey(t), previewOf(t)]));
  const mine = state.turn === ME;
  const live = mine && !battle.busy && state.winner === null;
  // En el turno rival el consejo se oculta sin dejar de ocupar su sitio, para que la mesa no salte.
  const tip = battle.lesson !== null && state.winner === null ? LESSONS[battle.lesson].steps[lessonStep(battle.lesson, state, battle.log)] : null;
  app.innerHTML = `
    <section class="screen battle">
      ${heroHtml(FOE, targets)}
      ${foeHandHtml()}
      ${boardHtml(FOE, targets)}
      <div class="center">
        <button class="icon-btn" data-act="concede" aria-label="Rendirse" title="Rendirse">${icon('flag')}</button>
        <button class="icon-btn" data-act="history" aria-label="Historial de la partida" title="Historial">${icon('scroll')}</button>
        <span class="turn-badge ${mine ? 'mine' : 'theirs'}">${mine ? 'TU TURNO' : 'RIVAL'}</span>
        <span class="message">${battle.message}</span>
        <button class="btn small ${live && nothingLeft() ? 'nudge' : ''}" data-act="end" ${live ? '' : 'disabled'}>Fin de turno</button>
      </div>
      ${tip ? `<div class="tut-tip" role="status" ${mine ? '' : 'style="visibility: hidden"'}><b>Tutorial ${battle.lesson + 1}/${TUTORIAL_LESSONS}</b> · ${tip.text}</div>` : ''}
      ${boardHtml(ME, targets)}
      ${heroHtml(ME, targets)}
      <div class="hand">${state.players[ME].hand.map(cardHtml).join('')}</div>
      ${zoomHtml()}
    </section>`;
  if (live && tip?.glow && !battle.sel) app.querySelectorAll(tip.glow).forEach((el) => el.classList.add('tut-glow'));
  battle.prevHandLen = state.players[ME].hand.length;
  battle.prevFoeHand = state.players[FOE].hand.length;
}

function showLog() {
  const names = {};
  const who = (t) => (t.uid === HERO ? (t.player === ME ? 'Tú' : battle.rivalName) : names[t.uid] ?? 'Criatura');
  const line = (e) => {
    if (e.card && e.uid !== undefined) names[e.uid] = CARD_BY_ID[e.card]?.name;
    switch (e.type) {
      case 'play': return `${icon('hand')} ${e.player === ME ? 'Tú' : battle.rivalName}: ${CARD_BY_ID[e.card].name}`;
      case 'attack': return `${icon('sword')} ${who(e)} → ${who(e.target)}`;
      case 'damage': return `${icon('spark')} ${who(e)} −${e.amount}`;
      case 'heal': return `${icon('heart')} ${who(e)} +${e.amount}`;
      case 'death': return `${icon('skull')} ${who(e)}`;
      case 'turn': return `<b>Turno de ${e.player === ME ? 'ti' : battle.rivalName}</b>`;
      default: return null;
    }
  };
  const lines = battle.log.map(line).filter(Boolean).reverse();
  const bg = document.createElement('div');
  bg.className = 'modal-bg log-bg';
  bg.innerHTML = `
    <div class="modal" role="dialog" aria-label="Historial">
      <h2>Historial</h2>
      <div class="log-list">${lines.map((l) => `<div>${l}</div>`).join('') || 'Aún no ha pasado nada.'}</div>
      <button class="btn">Cerrar</button>
    </div>`;
  document.body.appendChild(bg); // fuera de #app: el turno rival sigue repintando la mesa detrás
  bg.addEventListener('click', () => bg.remove());
}

const snapshot = () => Object.fromEntries([...app.querySelectorAll('[data-t]')].map((el) => [el.dataset.t, el.getBoundingClientRect()]));

// Dónde quedará una criatura que aún no está en la mesa: pinta el estado nuevo, mide y deja el DOM como estaba.
function measure(key) {
  const old = app.firstElementChild;
  old.querySelectorAll('.drawn, .new, .land').forEach((el) => el.classList.remove('drawn', 'new', 'land')); // al volver no deben repetir su animación
  const saved = [battle.prevHandLen, battle.prevFoeHand, new Set(battle.seenUnits)];
  renderBattle();
  const el = tEl(key);
  el?.classList.remove('new'); // su animación de aparición falsearía la medida
  const rect = el?.getBoundingClientRect();
  app.replaceChildren(old);
  [battle.prevHandLen, battle.prevFoeHand, battle.seenUnits] = saved;
  return rect;
}

const AIMED = new Set(['damage', 'shieldBreak', 'buff', 'freeze', 'silence', 'weaken', 'bounce', 'heal']);

// La carta vuela de la mano a la mesa (la del rival sale bocabajo y se gira por el camino) y su efecto sale
// disparado hacia los objetivos. El DOM sigue mostrando el estado anterior hasta el impacto.
async function castCard({ id, el, hidden }, events, rects, skip) {
  const c = CARD_BY_ID[id];
  const from = el.getBoundingClientRect();
  const summoned = events.find((e) => e.type === 'summon' && e.card === id);
  const key = summoned && tKey(summoned);
  const slot = key && measure(key);
  const mid = center(app.querySelector('.center').getBoundingClientRect());
  const w = slot ? slot.width : 130;
  const h = slot ? slot.height : 192;
  const left = slot ? slot.left : mid.x - w / 2;
  const top = slot ? slot.top : mid.y - h / 2;
  el.style.visibility = 'hidden';
  app.querySelector('.message').textContent = battle.message;
  const fly = document.createElement('div');
  fly.className = 'fly';
  fly.style.cssText = `left: ${left}px; top: ${top}px; width: ${w}px; height: ${h}px`;
  fly.innerHTML = `<div class="fly-in"><div class="fly-back"></div><div class="fly-front r-${c.rarity}">${slot ? artHtml(c) : cardFace(c)}</div></div>`;
  document.body.appendChild(fly);
  const dx = from.left + from.width / 2 - (left + w / 2);
  const dy = from.top + from.height / 2 - (top + h / 2);
  const flight = [
    { transform: `translate(${dx}px, ${dy}px) scale(${from.width / w})` },
    { transform: 'translate(0, 0) scale(1.2)', offset: 0.72 }, // se eleva sobre la mesa antes de caer
    { transform: 'translate(0, 0) scale(1)' },
  ];
  if (hidden) fly.firstChild.animate([{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(180deg)', offset: 0.25 }, { transform: 'rotateY(0)', offset: 0.75 }], { duration: 480, fill: 'forwards' });
  fly.animate(flight, { duration: 480, easing: 'ease-in-out', fill: 'forwards' });
  await wait(480);

  const aimed = [...new Set(events.filter((e) => AIMED.has(e.type)).map(tKey))].filter((k) => k !== key && rects[k]);
  const spots = aimed.map((k) => center(rects[k]));
  const power = Math.max(2, ...events.filter((e) => e.type === 'damage').map((e) => e.amount));
  if (slot) {
    rects[key] = slot;
    skip.add(key);
    landFx(center(slot));
    if (aimed.length) {
      sfx('summon');
      await castFx(fxElement(c), center(slot), spots, power);
    }
  } else {
    if (aimed.length) sfx('spell');
    await wait(!hidden ? 380 : getProfile().settings.fastAi ? 500 : 900); // el hechizo del rival tiene que poder leerse
    fly.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(1.15)' }], { duration: 220, fill: 'forwards' });
    await castFx(fxElement(c), mid, spots, power);
  }
  for (const k of aimed) skip.add(k);
  return key;
}

function banner(text) {
  const b = document.createElement('div');
  b.className = 'turn-banner';
  b.textContent = text;
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 1100);
}

const FLOATS = { shieldBreak: '¡Escudo!', silence: 'Silencio', weaken: 'Debilitada', freeze: 'Congelada' };
const AURAS = { shieldBreak: 'holy', silence: 'arcane', weaken: 'shadow', freeze: 'ice', buff: 'holy', transform: 'arcane' };

// Números flotantes, sacudidas y efectos a partir de los eventos del motor. skip: lo que ya recibió su impacto.
function showEvents(events, rects, skip) {
  let delay = 0;
  let pain = 0;
  for (const e of events) {
    if (e.type === 'turn' && e.player === ME) banner('TU TURNO');
    if (e.type === 'attack' || e.uid === undefined) continue;
    const k = tKey(e);
    const el = tEl(k);
    const r = rects[k] ?? el?.getBoundingClientRect();
    if (!r) continue;
    const at = center(r);
    if (e.type === 'death') setTimeout(() => deathFx(at), 130);
    else if (e.type === 'summon') { if (!skip.has(k)) landFx(at); }
    else if (e.type === 'heal') healFx(at);
    else if (AURAS[e.type] && !skip.has(k)) auraFx(AURAS[e.type], at);
    if (e.type === 'damage') {
      el?.classList.add('hit');
      if (!skip.has(k)) strikeFx('hit', null, at);
      pain = Math.max(pain, e.amount);
    }
    if (e.type !== 'damage' && e.type !== 'heal' && !FLOATS[e.type]) continue;
    const f = document.createElement('div');
    f.className = `float ${e.type === 'damage' ? 'dmg' : e.type === 'heal' ? 'heal' : 'info'}`;
    f.textContent = e.type === 'damage' ? `-${e.amount}` : e.type === 'heal' ? `+${e.amount}` : FLOATS[e.type];
    f.style.left = `${at.x - 14}px`;
    f.style.top = `${r.top + r.height / 3}px`;
    f.style.animationDelay = `${delay}ms`;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1000 + delay);
    delay += 80;
  }
  shake(app, pain);
}

// El atacante se lanza o dispara antes de que el motor aplique el golpe. Devuelve lo que afterAction necesita para terminarlo.
async function strike(p, uid, target) {
  const u = findUnit(battle.state, p, uid);
  const key = tKey({ player: p, uid });
  const el = tEl(key);
  const to = tEl(tKey(target));
  if (!motionOn() || !u || !el || !to) return {};
  const card = CARD_BY_ID[u.id];
  const style = attackStyle(card);
  const a = center(el.getBoundingClientRect());
  const b = center(to.getBoundingClientRect());
  const hit = tKey(target);
  if (RANGED.has(style)) {
    el.animate([{ transform: 'none' }, { transform: `translateY(${p === ME ? 8 : -8}px) scale(0.95)` }, { transform: 'none' }], { duration: 200 });
    await shootFx(style, fxElement(card, style === 'breath' ? 'fire' : 'arcane'), a, b, u.atk);
    return { hit };
  }
  const reach = Math.max(0, 1 - 34 / Math.hypot(b.x - a.x, b.y - a.y)); // se queda justo delante, sin taparlo
  const dx = (b.x - a.x) * reach;
  const dy = (b.y - a.y) * reach;
  el.closest('.board').style.zIndex = 5;
  el.animate([
    { transform: 'none' },
    { transform: `translate(${-dx * 0.08}px, ${-dy * 0.08}px) scale(1.1)`, offset: 0.35 },
    { transform: `translate(${dx}px, ${dy}px) scale(1.1)` },
  ], { duration: 260, easing: 'ease-in', fill: 'forwards' });
  await wait(250);
  strikeFx(style, null, b, u.atk);
  return { hit, back: { key, at: { x: a.x + dx, y: a.y + dy } } };
}

async function afterAction({ fly, back, hit } = {}) {
  if (!battle || battle.finishing) return false; // rendición mientras otra acción estaba en curso
  const events = takeEvents(battle.state);
  battle.log.push(...events);
  for (const e of events) {
    if (e.type === 'burn') battle.message = 'Mano llena: carta quemada';
    if (e.type === 'fatigue') battle.message = '¡Mazo vacío! Recibes daño de fatiga';
  }
  const rects = snapshot();
  const skip = new Set(hit ? [hit] : []);
  let landed = null;
  if (fly?.el && motionOn()) {
    const wasBusy = battle.busy;
    battle.busy = true; // los toques se ignoran hasta el impacto
    try { landed = await castCard(fly, events, rects, skip); } catch (err) { console.error(err); } // decoración: nunca debe parar la partida
    if (!battle || battle.finishing) {
      document.querySelectorAll('.fly').forEach((f) => f.remove());
      return false;
    }
    battle.busy = wasBusy;
  }
  renderBattle();
  document.querySelectorAll('.fly').forEach((f) => f.remove());
  if (landed) {
    const unit = tEl(landed);
    unit?.classList.remove('new');
    unit?.classList.add('land');
  }
  const attacker = back && tEl(back.key);
  if (attacker) { // vuelve a su sitio, que puede haberse movido si alguien cayó
    const c = center(attacker.getBoundingClientRect());
    attacker.closest('.board').style.zIndex = 5;
    attacker.animate([{ transform: `translate(${back.at.x - c.x}px, ${back.at.y - c.y}px) scale(1.1)` }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });
  }
  showEvents(events, rects, skip);
  eventSound(events, ME);
  if (battle.state.winner !== null) {
    battle.finishing = true;
    battle.busy = true;
    renderBattle();
    await wait(1100);
    finishMatch();
    return false;
  }
  return true;
}

const clearSelection = () => {
  battle.sel = null;
  battle.inspect = null;
};

async function playerPlay(index, target) {
  clearSelection();
  renderBattle(); // quita el zoom y deja la mano en su sitio antes del vuelo
  const id = battle.state.players[ME].hand[index];
  const el = app.querySelector(`[data-hand="${index}"]`);
  const r = playCard(battle.state, ME, index, target);
  battle.message = r.ok ? '' : r.error;
  if (!r.ok) sfx('error');
  else {
    const move = { type: 'play', handIndex: index, target: target ?? null };
    battle.moves.push(move);
    battle.net?.room.send(move);
  }
  await afterAction(r.ok ? { fly: { id, el } } : {});
}

async function playerAttack(uid, target) {
  clearSelection();
  battle.busy = true;
  renderBattle();
  const hit = await strike(ME, uid, target);
  if (!battle || battle.finishing) return;
  const r = attack(battle.state, ME, uid, target);
  battle.message = r.ok ? '' : r.error;
  if (r.ok) {
    const move = { type: 'attack', uid, target };
    battle.moves.push(move);
    battle.net?.room.send(move);
  }
  battle.busy = false;
  await afterAction(hit);
}

// Termina la partida a favor del jugador que sigue aquí.
function rivalStopped(state, why) {
  if (battle?.state !== state || state.winner !== null) return;
  battle.message = why;
  concede(state, FOE);
  afterAction();
}

// Siguiente jugada del rival: la que piense la IA o la que llegue del otro móvil.
async function foeAction(s, count) {
  if (battle.net) {
    let a;
    do a = await battle.net.room.receive(); // el saludo que se reintentaba antes de empezar puede llegar tarde
    while (a?.type === 'hello' || a?.type === 'start');
    if (battle?.state !== s) return null;
    return actionError(s, FOE, a) ? { type: 'invalid' } : a;
  }
  await wait(aiDelay());
  if (!battle || battle.state !== s || s.winner !== null) return null; // partida abandonada
  return aiAction(s, count);
}

async function runAiTurn() {
  battle.busy = true;
  clearSelection();
  renderBattle();
  const s = battle.state;
  let actions = 0;
  try {
    while (s.turn === FOE && s.winner === null) {
      const a = await foeAction(s, ++actions);
      if (!a || !battle || battle.state !== s || s.winner !== null) return;
      if (a.type === 'invalid') return rivalStopped(s, 'Partida cancelada: jugada no válida');
      let done = {};
      if (a.type === 'play') {
        const id = s.players[FOE].hand[a.handIndex];
        done = { fly: { id, el: app.querySelectorAll('.foe-card')[a.handIndex], hidden: true } };
        battle.message = `El rival juega ${CARD_BY_ID[id].name}`;
        playCard(s, FOE, a.handIndex, a.target);
      } else if (a.type === 'attack') {
        done = await strike(FOE, a.uid, a.target);
        if (!battle || battle.state !== s) return;
        attack(s, FOE, a.uid, a.target);
      } else {
        endTurn(s, FOE);
        battle.message = 'Tu turno';
        if (battle.net && a.sig !== stateSignature(s)) return rivalStopped(s, 'Partida cancelada: dejó de coincidir');
      }
      if (!(await afterAction(done))) return;
    }
  } catch (err) {
    console.error(err);
    if (battle?.state === s && s.turn === FOE && s.winner === null) endTurn(s, FOE); // el turno pasa al jugador pase lo que pase
    if (!(await afterAction())) return;
  }
  if (battle?.state !== s) return;
  battle.busy = false;
  clearSelection(); // lo que se estuviera mirando no debe tapar el turno propio
  renderBattle();
}

async function askConcede(state) {
  if (state.winner !== null) return;
  const question = battle.net ? '¿Abandonar la partida con tu amigo?' : battle.lesson !== null ? '¿Dejar el tutorial? Podrás repetirlo en tu próxima partida.'
    : state.turnNumber < MIN_TURNS_TO_COUNT ? '¿Rendirte? Tan pronto no cuenta como partida ni da recompensa.' : '¿Rendirte? La partida contará como derrota.';
  const sure = await ask(question, { yes: 'Rendirse', no: 'Seguir jugando', danger: true });
  if (!sure || battle?.state !== state || state.winner !== null) return; // el rival sigue jugando mientras se decide
  concede(state, ME);
  battle.moves.push({ type: 'concede' });
  await battle.net?.room.send({ type: 'concede' });
  afterAction();
}

function onBattleTap(el) {
  const { state } = battle;
  const act = el.closest('[data-act]')?.dataset.act;
  if (act === 'concede') return void askConcede(state); // se permite también durante el turno rival
  if (act === 'history') return showLog();
  // En el turno rival no se juega, pero se pueden seguir mirando las cartas.
  const busy = battle.busy;
  if (state.winner !== null || (busy && state.turn !== FOE)) return;
  const aim = () => {
    battle.sel.aiming = true;
    battle.message = 'Elige un objetivo';
    renderBattle();
  };
  if (!busy && act === 'end') {
    clearSelection();
    endTurn(state, ME);
    battle.moves.push({ type: 'end' });
    battle.net?.room.send({ type: 'end', sig: stateSignature(state) });
    battle.message = 'Turno del rival';
    afterAction().then((alive) => alive && runAiTurn());
    return;
  }
  if (!busy && act === 'play-selected' && battle.sel?.kind === 'hand') return void playerPlay(battle.sel.index, null);
  if (!busy && act === 'aim' && battle.sel?.kind === 'hand') return aim();

  const unitTap = el.closest('[data-t]');
  const handEl = el.closest('[data-hand]');

  if (!busy && unitTap && currentTargets().some((t) => tKey(t) === unitTap.dataset.t)) {
    const target = parseKey(unitTap.dataset.t);
    if (battle.sel.kind === 'hand') return void playerPlay(battle.sel.index, target);
    return void playerAttack(battle.sel.uid, target);
  }

  if (handEl) {
    const i = Number(handEl.dataset.hand);
    const err = state.turn === ME ? playError(state, ME, i) : 'Espera tu turno';
    const again = battle.sel?.kind === 'hand' && battle.sel.index === i;
    if (!busy && again && err === null) return void playerPlay(i, null);
    if (!busy && again && err === 'Elige un objetivo') return aim();
    battle.sel = { kind: 'hand', index: i };
    battle.inspect = null;
    if (!busy) battle.message = canPlay(err) ? 'Toca otra vez para jugarla' : err;
  } else if (unitTap) {
    const t = parseKey(unitTap.dataset.t);
    const same = (battle.sel?.kind === 'unit' && battle.sel.uid === t.uid) || (battle.inspect && tKey(battle.inspect) === unitTap.dataset.t);
    const canAttack = t.player === ME && t.uid !== HERO && attackTargets(state, ME, t.uid).length > 0;
    battle.sel = !same && canAttack ? { kind: 'unit', uid: t.uid } : null;
    battle.inspect = !same && !battle.sel && t.uid !== HERO ? t : null;
    if (!busy) battle.message = battle.sel ? 'Elige objetivo' : '';
  } else {
    clearSelection();
    if (!busy) battle.message = '';
  }
  if (busy) paintZoom();
  else renderBattle();
}

async function finishMatch() {
  const won = battle.state.winner === ME;
  const draw = battle.state.winner === 'draw';
  sfx(won ? 'win' : 'lose');
  // Rendirse nada más empezar no cuenta: si no, abandonar en bucle daría monedas gratis.
  const abandoned = battle.log.some((e) => e.conceded) && battle.state.turnNumber < MIN_TURNS_TO_COUNT;
  const { net, ticket, moves, matchId, log } = battle;
  net?.room.close();
  document.querySelector('.log-bg')?.remove();
  let rewards = null;
  let note = '';
  let daily = null;
  if (ticket?.id) {
    battle.message = 'Guardando la partida…';
    renderBattle();
    const r = await endMatch(ticket.id, moves);
    rewards = r.rewards ?? null;
    daily = r.daily ?? null;
    note = r.pending ? 'Sin conexión: el resultado se sumará a tu cuenta cuando vuelva.' : r.error ?? '';
    if (!rewards && !r.pending && ticket.stake) note = `${note || 'Terminó demasiado pronto: no cuenta como partida.'} Pierdes ${ticket.stake} trofeos.`;
    if (!rewards && !r.pending && ticket.forge) note = `${note || 'Terminó demasiado pronto: no cuenta como partida.'} En el desafío cuenta como derrota.`;
  } else if (ticket) note = 'Esta partida no da recompensa.';
  else if (battle.lesson !== null) {
    if (won) savePrefs({ tutorial: battle.lesson + 1 });
    note = !won ? 'Repite la lección: el tutorial no da recompensa.'
      : battle.lesson + 1 < TUTORIAL_LESSONS ? `Tutorial ${battle.lesson + 1} de ${TUTORIAL_LESSONS} superado. Sigue con el siguiente.`
      : '¡Tutorial completado! Desde ahora las partidas dan monedas y experiencia.';
  } else if (!abandoned && !net) { // sin cuenta. Las amistosas no pagan: dos amigos podrían dejarse ganar por turnos para sacar monedas.
    const claim = claimMatchRewards(getProfile(), matchId, won, new Date(), matchStats(log, won, ME));
    setProfile(claim.profile);
    rewards = claim.rewards;
  }
  battle = null;
  go('result', won, rewards, draw, Boolean(net), note, ticket?.arena ? 'arena' : ticket?.daily ? 'daily' : ticket?.forge ? 'forge' : null, daily);
}
