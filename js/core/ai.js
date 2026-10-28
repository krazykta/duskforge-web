// IA sencilla y legible. Devuelve UNA acción cada vez para que la interfaz pueda
// animarla con pausas. Prioridades:
//   1. Jugar la carta jugable más cara que tenga un uso útil.
//   2. Atacar: guardianes obligatorios > golpe letal > intercambios favorables > héroe.
//   3. Terminar el turno.
import { CARD_BY_ID } from './cards.js';
import { HERO, other, findUnit, playError, cardTargets, attackTargets } from './engine.js';

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
    const ready = targets.filter((t) => !unitOf(state, t).frozen);
    return (ready.length ? ready : targets).sort(byAtkDesc(state))[0];
  }
  return targets.sort(byAtkDesc(state))[0]; // buff, destruir o devolver: la más fuerte
}

// ¿Merece la pena jugarla ahora? Evita desperdiciar curaciones y barridos.
function isUseful(state, p, card) {
  const e = card.effect;
  if (!e || card.type === 'unit') return true;
  const me = state.players[p];
  if (e.kind === 'heal') return me.maxHp - me.hp >= Math.min(3, e.amount);
  const foeBoard = state.players[other(p)].board;
  if (e.kind === 'damageAllEnemies') return foeBoard.length > 0;
  if (e.kind === 'damageAll') return foeBoard.length > me.board.length; // solo si sale ganando
  if (e.kind === 'buffAll') return me.board.length >= 2;
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
  for (const i of order) {
    const card = CARD_BY_ID[hand[i]];
    if (!isUseful(state, p, card)) continue;
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
  const hasGuard = foe.board.some((u) => u.guard);
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

export function nextAction(state, p) {
  if (state.winner !== null || state.turn !== p) return { type: 'none' };
  return choosePlay(state, p) || chooseAttack(state, p) || { type: 'end' };
}
