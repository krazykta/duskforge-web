// IA sencilla y legible. Devuelve UNA acción cada vez para que la interfaz pueda
// animarla con pausas. Prioridades:
//   1. Jugar la carta jugable más cara que tenga un uso útil.
//   2. Atacar: guardianes obligatorios > golpe letal > intercambios favorables > héroe.
//   3. Terminar el turno.
import { CARD_BY_ID } from './cards.js';
import { HERO, other, findUnit, playError, cardTargets, attackTargets, playCard, attack } from './engine.js';

const unitOf = (state, t) => (t.uid === HERO ? null : findUnit(state, t.player, t.uid));
const byAtkDesc = (state) => (a, b) => (unitOf(state, b)?.atk ?? 0) - (unitOf(state, a)?.atk ?? 0);

function chooseCardTarget(state, p, card, targets) {
  const e = card.effect;
  if (e.kind === 'damage' || e.kind === 'damageHeal') {
    // Prioriza matar la criatura enemiga más peligrosa; si no, al héroe; si no, a la más fuerte.
    const kills = targets.filter((t) => { const u = unitOf(state, t); return u && !u.shield && u.hp <= e.amount; });
    if (kills.length) return kills.sort(byAtkDesc(state))[0];
    const hero = targets.find((t) => t.uid === HERO);
    if (hero) return hero;
    return targets.sort(byAtkDesc(state))[0];
  }
  if (e.kind === 'shield') {
    const unshielded = targets.filter((t) => !unitOf(state, t).shield);
    return unshielded.sort(byAtkDesc(state))[0] || null;
  }
  if (e.kind === 'freeze') {
    // La que más pega de las que no podré matar este turno: congelar lo que voy a matar no sirve.
    const strongest = Math.max(0, ...state.players[p].board.filter((u) => u.ready).map((u) => u.atk));
    const ready = targets.filter((t) => !unitOf(state, t).frozen);
    const safe = ready.filter((t) => unitOf(state, t).shield || unitOf(state, t).hp > strongest);
    return (safe.length ? safe : ready.length ? ready : targets).sort(byAtkDesc(state))[0];
  }
  if (e.kind === 'grant') {
    const without = targets.filter((t) => !unitOf(state, t)[e.keyword]);
    return (without.length ? without : targets).sort(byAtkDesc(state))[0];
  }
  if (e.kind === 'silence') {
    // Lo que más estorba: guardianes, escudos, veneno y efectos que siguen actuando.
    const worth = (u) => (u.guard ? 3 : 0) + (u.shield ? 2 : 0) + (u.poison || u.fury || u.drain ? 2 : 0) + (CARD_BY_ID[u.id].effect && !u.silenced ? 1 : 0) + u.atk / 10;
    return targets.filter((t) => !unitOf(state, t).silenced).sort((a, b) => worth(unitOf(state, b)) - worth(unitOf(state, a)))[0] || null;
  }
  return targets.sort(byAtkDesc(state))[0]; // buff, debilitar, destruir o devolver: la más fuerte
}

// ¿Merece la pena jugarla ahora? Evita desperdiciar curaciones y barridos.
function isUseful(state, p, card) {
  const e = card.effect;
  const me = state.players[p];
  const pain = e && [e, e.then].find((x) => x?.kind === 'hurtSelf');
  if (pain && me.hp <= pain.amount + 3) return false; // un pacto no debe matarte
  if (!e || card.type === 'unit') return true;
  if (e.kind === 'bounce' && e.target === 'allyUnit') return false; // shortcut: la IA no sabe cuándo conviene retirar
  if (e.kind === 'transform') return state.players[other(p)].board.some((u) => u.atk >= 3 || u.guard);
  if (e.kind === 'draw') return me.deck.length >= e.amount && me.hand.length + e.amount <= state.rules.maxHand; // sin fatiga ni cartas quemadas
  if (e.kind === 'heal') return state.rules.startHp - me.hp >= Math.min(3, e.amount); // no se gasta si no le hace falta
  const foeBoard = state.players[other(p)].board;
  if (e.kind === 'damageAllEnemies') return foeBoard.length > 0;
  if (e.kind === 'damageAll') return foeBoard.length > me.board.length; // solo si sale ganando
  if (e.kind === 'buffAll') return me.board.filter((u) => !e.only || u[e.only]).length >= (e.only ? 1 : 2);
  if (e.kind === 'silence') return foeBoard.some((u) => !u.silenced && (u.guard || u.shield || u.poison || u.fury || u.drain || CARD_BY_ID[u.id].effect));
  if (e.kind === 'silenceAll') return foeBoard.filter((u) => !u.silenced && (u.guard || u.shield || u.poison || u.fury || u.stealth || CARD_BY_ID[u.id].effect)).length >= 2;
  if (e.kind === 'grant') return me.board.some((u) => !u[e.keyword]);
  if (e.kind === 'freezeAll') return foeBoard.filter((u) => !u.frozen && u.atk > 0).length >= 2;
  if (e.kind === 'shieldAll') return me.board.filter((u) => !u.shield && (!e.only || u[e.only])).length >= (e.only ? 1 : 2);
  if (e.kind === 'weaken') return foeBoard.some((u) => u.atk >= 2);
  if (e.kind === 'freeze') return foeBoard.some((u) => !u.stealth && !u.frozen && u.atk >= 2); // congelar algo que no pega es tirarla
  if (e.kind === 'summon') return me.board.length < state.rules.boardSize;
  if (e.kind === 'energy') {
    // Solo si la energía extra permite jugar algo que ahora no cabe.
    const left = me.energy - card.cost;
    return me.hand.some((id) => CARD_BY_ID[id] !== card && CARD_BY_ID[id].cost > left && CARD_BY_ID[id].cost <= left + e.amount);
  }
  return true;
}

function choosePlay(state, p) {
  const hand = state.players[p].hand;
  const order = hand.map((id, i) => i).sort((a, b) => CARD_BY_ID[hand[b]].cost - CARD_BY_ID[hand[a]].cost);
  const me = state.players[p];
  // Rival flojo de los primeros niveles (AI_EASY): deja sin gastar parte de la energía.
  const reserve = me.easy ? (state.turnNumber <= me.easy[1] ? me.easy[0] : me.easy[2]) : 0;
  // Una carta con Combo espera si otra carta útil cabe antes que ella este mismo turno.
  const waits = (i) => CARD_BY_ID[hand[i]].combo && me.played === 0 && hand.some((id, j) => j !== i
    && CARD_BY_ID[id].cost + CARD_BY_ID[hand[i]].cost <= me.energy && isUseful(state, p, CARD_BY_ID[id]) && !playError(state, p, j, cardTargets(state, p, j)[0] ?? null));
  for (const i of order) {
    const card = CARD_BY_ID[hand[i]];
    if (!isUseful(state, p, card) || waits(i) || me.energy - card.cost < reserve) continue;
    const targets = cardTargets(state, p, i);
    const target = targets.length ? chooseCardTarget(state, p, card, targets) : null;
    if (!playError(state, p, i, target)) return { type: 'play', handIndex: i, target };
  }
  return null;
}

function chooseAttack(state, p) {
  const foe = state.players[other(p)];
  const ready = state.players[p].board.filter((u) => attackTargets(state, p, u.uid).length > 0);
  if (!ready.length) return null;
  const hasGuard = foe.board.some((u) => u.guard && !u.stealth); // un Guardián con Sigilo no obliga (attackTargets)
  const totalAtk = ready.reduce((s, u) => s + u.atk, 0);

  for (const u of ready.sort((a, b) => b.atk - a.atk)) {
    const targets = attackTargets(state, p, u.uid);
    if (hasGuard) return { type: 'attack', uid: u.uid, target: targets.sort(byAtkDesc(state)).reverse()[0] };
    const hero = targets.find((t) => t.uid === HERO);
    if (totalAtk >= foe.hp) return { type: 'attack', uid: u.uid, target: hero };
    // Intercambio favorable: lo mato y sobrevivo, o mato algo que pega más fuerte que yo.
    const good = targets.filter((t) => {
      const d = unitOf(state, t);
      if (!d || d.shield) return false;
      const kills = u.atk >= d.hp || u.poison;
      const survives = u.shield || (d.atk < u.hp && !d.poison);
      return kills && (survives || d.atk > u.atk);
    });
    if (good.length) return { type: 'attack', uid: u.uid, target: good.sort(byAtkDesc(state))[0] };
    return { type: 'attack', uid: u.uid, target: hero };
  }
  return null;
}

// La IA de reglas: la que usan los niveles fáciles y la que imagina el resto del turno al pensar.
const greedy = (state, p) => choosePlay(state, p) || chooseAttack(state, p) || { type: 'end' };

function apply(state, p, a) {
  if (a.type === 'play') playCard(state, p, a.handIndex, a.target);
  else if (a.type === 'attack') attack(state, p, a.uid, a.target);
}

// Cuánto vale la mesa para p al acabar su turno. Pesos medidos en la decisión 54.
const unitValue = (u) => (u.hp <= 0 ? 0 : 1 + u.atk * 1.2 + u.hp + (u.guard ? 1 : 0) + (u.shield ? 1 + u.atk * 0.5 : 0) + (u.poison ? 2 : 0)
  + (u.drain ? u.atk * 0.5 : 0) + (u.stealth ? 1 : 0) + (u.fury ? u.atk * 0.7 : 0));
function evaluate(state, p) {
  if (state.winner !== null) return state.winner === p ? 1e6 : -1e6;
  const me = state.players[p], foe = state.players[other(p)];
  const sum = (board) => board.reduce((s, u) => s + unitValue(u), 0);
  const threat = foe.board.reduce((s, u) => s + (u.frozen ? 0 : u.atk), 0);
  return sum(me.board) - sum(foe.board) + me.hp - foe.hp + me.hand.length - (threat >= me.hp ? 50 : 0);
}

function candidates(state, p) {
  const me = state.players[p];
  const list = [{ type: 'end' }];
  me.hand.forEach((id, i) => {
    if (me.hand.indexOf(id) !== i || CARD_BY_ID[id].cost > me.energy) return; // dos copias juegan igual
    const targets = cardTargets(state, p, i);
    for (const target of targets.length ? targets : [null]) if (!playError(state, p, i, target)) list.push({ type: 'play', handIndex: i, target });
  });
  for (const u of me.board) for (const target of attackTargets(state, p, u.uid)) list.push({ type: 'attack', uid: u.uid, target });
  return list;
}

// Prueba cada jugada posible, imagina el resto del turno con la IA de reglas y se queda con la que deja mejor la mesa.
// shortcut: lo imaginado usa el mismo azar que la partida, así que ve qué carta robaría; si molesta, barajar la copia.
function think(state, p) {
  const score = (first) => {
    const sim = structuredClone(state);
    sim.events = [];
    for (let a = first, n = 0; a.type !== 'end' && sim.turn === p && sim.winner === null && n < 30; a = greedy(sim, p), n++) apply(sim, p, a);
    return evaluate(sim, p);
  };
  const plain = greedy(state, p);
  let best = plain, bestScore = score(plain);
  for (const a of candidates(state, p)) {
    const s = score(a);
    if (s > bestScore + 0.01) { best = a; bestScore = s; }
  }
  return best;
}

export function nextAction(state, p) {
  if (state.winner !== null || state.turn !== p) return { type: 'none' };
  // think: parte de los turnos en que piensa (sin él, todos). El turno decide cuáles, sin gastar azar de la partida.
  const { easy, think: share = 1 } = state.players[p];
  return easy || (state.turnNumber * 37) % 100 >= share * 100 ? greedy(state, p) : think(state, p);
}
