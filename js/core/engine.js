// Motor de reglas del combate. No toca el DOM ni las animaciones: recibe acciones,
// cambia el estado y deja una lista de eventos (state.events) que la interfaz consume.
import { RULES } from './config.js';
import { CARD_BY_ID } from './cards.js';

// Generador aleatorio con semilla (mulberry32): partidas reproducibles en tests.
function nextRandom(state) {
  let t = (state.seed = (state.seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffle(state, list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export const HERO = null; // uid de un objetivo que es el héroe
export const other = (p) => 1 - p;
const emit = (state, event) => state.events.push(event);
// Una criatura silenciada pierde su efecto impreso.
const unitEffect = (u) => (u.silenced ? null : CARD_BY_ID[u.id].effect);

export function createMatch({ decks, seed = Date.now(), firstPlayer = 0, rules = RULES }) {
  const state = {
    rules,
    seed: seed >>> 0,
    nextUid: 1,
    turn: firstPlayer,
    turnNumber: 0,
    winner: null, // 0 | 1 | 'draw'
    events: [],
    players: decks.map((deck) => {
      if (deck.length !== rules.deckSize) throw new Error(`El mazo debe tener ${rules.deckSize} cartas`);
      for (const id of deck) if (!CARD_BY_ID[id]) throw new Error(`Carta desconocida: ${id}`);
      return { hp: rules.startHp, maxHp: rules.startHp, energy: 0, maxEnergy: rules.startEnergy - 1, deck: [], hand: [], board: [] };
    }),
  };
  state.players.forEach((pl, i) => (pl.deck = shuffle(state, [...decks[i]])));
  for (let i = 0; i < rules.startHand; i++) state.players.forEach((_, p) => draw(state, p));
  for (let i = 0; i < rules.secondPlayerExtraCards; i++) draw(state, other(firstPlayer));
  if (rules.secondPlayerBonus) state.players[other(firstPlayer)].hand.push(rules.secondPlayerBonus);
  startTurn(state, firstPlayer, false);
  return state;
}

function draw(state, p) {
  const pl = state.players[p];
  if (pl.deck.length === 0) {
    emit(state, { type: 'fatigue', player: p });
    damage(state, { player: p, uid: HERO }, state.rules.fatigueDamage);
    return;
  }
  const id = pl.deck.pop();
  if (pl.hand.length >= state.rules.maxHand) return emit(state, { type: 'burn', player: p, card: id });
  pl.hand.push(id);
  emit(state, { type: 'draw', player: p });
}

function startTurn(state, p, drawCard = true) {
  const pl = state.players[p];
  state.turn = p;
  state.turnNumber++;
  pl.maxEnergy = Math.min(state.rules.maxEnergy, pl.maxEnergy + 1);
  pl.energy = pl.maxEnergy;
  pl.board.forEach((u) => { u.ready = !u.frozen; u.frozen = false; u.furyUsed = false; });
  emit(state, { type: 'turn', player: p });
  if (drawCard) draw(state, p);
  checkGameOver(state);
}

export function findUnit(state, p, uid) {
  return state.players[p].board.find((u) => u.uid === uid);
}

function makeUnit(state, id) {
  const c = CARD_BY_ID[id];
  const kw = c.keywords || [];
  return {
    uid: state.nextUid++, id, atk: c.atk, hp: c.hp, maxHp: c.hp,
    guard: kw.includes('guard'), swift: kw.includes('swift'), shield: kw.includes('shield'), drain: kw.includes('drain'),
    poison: kw.includes('poison'), stealth: kw.includes('stealth'), fury: kw.includes('fury'),
    ready: kw.includes('swift'), frozen: false, furyUsed: false, silenced: false,
  };
}

// Devuelve el daño realmente infligido (0 si lo anula un escudo). source: criatura que golpea (para Letal).
function damage(state, target, amount, source = null) {
  if (amount <= 0) return 0;
  if (target.uid === HERO) {
    state.players[target.player].hp -= amount;
    emit(state, { type: 'damage', ...target, amount });
    return amount;
  }
  const u = findUnit(state, target.player, target.uid);
  if (!u) return 0;
  if (u.shield) {
    u.shield = false;
    emit(state, { type: 'shieldBreak', ...target });
    return 0;
  }
  u.hp -= amount;
  if (source?.poison && u.hp > 0) u.hp = 0;
  emit(state, { type: 'damage', ...target, amount });
  return amount;
}

function heal(state, p, amount) {
  const pl = state.players[p];
  const healed = Math.min(amount, pl.maxHp - pl.hp);
  if (healed <= 0) return;
  pl.hp += healed;
  emit(state, { type: 'heal', player: p, uid: HERO, amount: healed });
}

// Retira las unidades muertas y resuelve sus efectos "al morir" (que pueden matar a otras).
function resolveDeaths(state) {
  for (let round = 0; round < 20; round++) { // límite de seguridad ante cadenas de muertes
    const dead = [];
    state.players.forEach((pl, p) => {
      pl.board = pl.board.filter((u) => (u.hp <= 0 ? (dead.push({ p, u }), false) : true));
    });
    if (dead.length === 0) break;
    for (const { p, u } of dead) {
      emit(state, { type: 'death', player: p, uid: u.uid, card: u.id });
      const e = unitEffect(u);
      if (e && e.trigger === 'death') applyEffect(state, p, e, null, null);
    }
  }
  checkGameOver(state);
}

function checkGameOver(state) {
  if (state.winner !== null) return;
  const [a, b] = state.players.map((pl) => pl.hp <= 0);
  if (a || b) {
    state.winner = a && b ? 'draw' : a ? 1 : 0;
    emit(state, { type: 'gameOver', winner: state.winner });
  }
}

function summon(state, p, id) {
  const pl = state.players[p];
  if (pl.board.length >= state.rules.boardSize) return null;
  const u = makeUnit(state, id);
  pl.board.push(u);
  emit(state, { type: 'summon', player: p, uid: u.uid, card: id });
  return u;
}

function applyEffect(state, p, effect, target, source) {
  const foe = other(p);
  const a = effect.amount;
  switch (effect.kind) {
    case 'damage': if (target) damage(state, target, a); break;
    case 'damageAllEnemies': [...state.players[foe].board].forEach((u) => damage(state, { player: foe, uid: u.uid }, a)); break;
    case 'damageHero': damage(state, { player: foe, uid: HERO }, a); break;
    case 'heal': heal(state, p, a); break;
    case 'draw': for (let i = 0; i < a; i++) draw(state, p); break;
    case 'summon': for (let i = 0; i < a; i++) summon(state, p, effect.token); break;
    case 'shield': {
      const u = target && findUnit(state, target.player, target.uid);
      if (u) { u.shield = true; emit(state, { type: 'buff', ...target }); }
      break;
    }
    case 'buff': {
      const u = target && findUnit(state, target.player, target.uid);
      if (u) { u.atk += a; u.hp += a; u.maxHp += a; emit(state, { type: 'buff', ...target }); }
      break;
    }
    case 'growPerAlly': {
      const n = state.players[p].board.filter((u) => u !== source).length * a;
      if (source && n > 0) { source.atk += n; source.hp += n; source.maxHp += n; emit(state, { type: 'buff', player: p, uid: source.uid }); }
      break;
    }
    case 'buffSelf':
      if (source) { source.atk += a; emit(state, { type: 'buff', player: p, uid: source.uid }); }
      break;
    case 'damageAll':
      state.players.forEach((pl, q) => [...pl.board].forEach((u) => damage(state, { player: q, uid: u.uid }, a)));
      break;
    case 'destroy': {
      const u = target && findUnit(state, target.player, target.uid);
      if (u) { emit(state, { type: 'damage', ...target, amount: u.hp }); u.hp = 0; } // atraviesa el Escudo
      break;
    }
    case 'freeze': {
      const u = target && findUnit(state, target.player, target.uid);
      if (u) { u.frozen = true; u.ready = false; emit(state, { type: 'freeze', ...target }); }
      break;
    }
    case 'buffAll':
      for (const u of state.players[p].board) {
        if (u === source) continue;
        u.atk += a; u.hp += a; u.maxHp += a;
        emit(state, { type: 'buff', player: p, uid: u.uid });
      }
      break;
    case 'silence': {
      const u = target && findUnit(state, target.player, target.uid);
      if (u) silence(state, target.player, u);
      break;
    }
    case 'grant': {
      const u = target && findUnit(state, target.player, target.uid);
      if (!u) break;
      u[effect.keyword] = true;
      if (effect.keyword === 'swift' && !u.frozen) u.ready = true;
      emit(state, { type: 'buff', ...target });
      break;
    }
    case 'freezeAll':
      for (const u of state.players[foe].board) { u.frozen = true; u.ready = false; emit(state, { type: 'freeze', player: foe, uid: u.uid }); }
      break;
    case 'shieldAll':
      for (const u of state.players[p].board) {
        if (u === source) continue;
        u.shield = true;
        emit(state, { type: 'buff', player: p, uid: u.uid });
      }
      break;
    case 'silenceAll': [...state.players[foe].board].forEach((u) => silence(state, foe, u)); break;
    case 'weaken': {
      const u = target && findUnit(state, target.player, target.uid);
      if (u) { u.atk = Math.max(0, u.atk - a); emit(state, { type: 'weaken', ...target }); }
      break;
    }
    case 'addCard': {
      const pl = state.players[p];
      for (let i = 0; i < (a || 1); i++) {
        if (pl.hand.length >= state.rules.maxHand) emit(state, { type: 'burn', player: p, card: effect.card });
        else { pl.hand.push(effect.card); emit(state, { type: 'draw', player: p }); }
      }
      break;
    }
    case 'energy': state.players[p].energy += a; break;
    case 'damageHeal': if (target) heal(state, p, damage(state, target, a)); break;
    case 'bounce': {
      const owner = target && state.players[target.player];
      const u = target && findUnit(state, target.player, target.uid);
      if (!u) break;
      owner.board = owner.board.filter((x) => x !== u);
      emit(state, { type: 'bounce', ...target, card: u.id });
      if (CARD_BY_ID[u.id].token) break; // las fichas desaparecen
      if (owner.hand.length >= state.rules.maxHand) emit(state, { type: 'burn', player: target.player, card: u.id });
      else owner.hand.push(u.id);
      break;
    }
    case 'missiles':
      for (let i = 0; i < a; i++) {
        const pool = [...state.players[foe].board.filter((u) => u.hp > 0).map((u) => ({ player: foe, uid: u.uid })), { player: foe, uid: HERO }];
        damage(state, pool[Math.floor(nextRandom(state) * pool.length)], 1);
      }
      break;
    default: throw new Error(`Efecto desconocido: ${effect.kind}`);
  }
}

function silence(state, p, u) {
  for (const k of ['guard', 'swift', 'shield', 'drain', 'poison', 'stealth', 'fury']) u[k] = false;
  u.silenced = true;
  emit(state, { type: 'silence', player: p, uid: u.uid });
}

// Objetivos válidos para un tipo de objetivo de efecto ("enemy", "enemyUnit", "allyUnit").
export function effectTargets(state, p, targetType) {
  const foe = other(p);
  // El Sigilo protege de los objetivos del rival, no de los propios.
  const units = (q) => state.players[q].board.filter((u) => q === p || !u.stealth).map((u) => ({ player: q, uid: u.uid }));
  if (targetType === 'enemy') return [...units(foe), { player: foe, uid: HERO }];
  if (targetType === 'enemyUnit') return units(foe);
  if (targetType === 'allyUnit') return units(p);
  return [];
}

const sameTarget = (a, b) => a.player === b.player && a.uid === b.uid;

export function cardTargets(state, p, handIndex) {
  const card = CARD_BY_ID[state.players[p].hand[handIndex]];
  const e = card && card.effect;
  if (!e || !e.target || (card.type === 'unit' && e.trigger !== 'play')) return [];
  return effectTargets(state, p, e.target);
}

// Motivo por el que no se puede jugar (o null si se puede).
export function playError(state, p, handIndex, target = null) {
  if (state.winner !== null) return 'La partida ha terminado';
  if (state.turn !== p) return 'No es tu turno';
  const pl = state.players[p];
  const card = CARD_BY_ID[pl.hand[handIndex]];
  if (!card) return 'Carta no válida';
  if (card.cost > pl.energy) return 'No tienes energía suficiente';
  if (card.type === 'unit' && pl.board.length >= state.rules.boardSize) return 'Tu tablero está lleno';
  const targets = cardTargets(state, p, handIndex);
  const needsTarget = card.effect && card.effect.target && (card.type === 'spell' || card.effect.trigger === 'play');
  if (needsTarget) {
    if (target) {
      if (!targets.some((t) => sameTarget(t, target))) return 'Objetivo no válido';
    } else if (card.type === 'spell' || targets.length > 0) {
      // Las criaturas pueden entrar sin objetivo solo si no hay ninguno disponible.
      return targets.length ? 'Elige un objetivo' : 'No hay objetivos válidos';
    }
  }
  return null;
}

export function playCard(state, p, handIndex, target = null) {
  const err = playError(state, p, handIndex, target);
  if (err) return { ok: false, error: err };
  const pl = state.players[p];
  const id = pl.hand.splice(handIndex, 1)[0];
  const card = CARD_BY_ID[id];
  pl.energy -= card.cost;
  emit(state, { type: 'play', player: p, card: id });

  if (card.type === 'unit') {
    const u = summon(state, p, id);
    if (card.effect && card.effect.trigger === 'play') applyEffect(state, p, card.effect, target, u);
  } else {
    applyEffect(state, p, card.effect, target, null);
    // Sinergia: criaturas que reaccionan a tus hechizos.
    for (const u of [...pl.board]) {
      const e = unitEffect(u);
      if (e && e.trigger === 'spell' && u.hp > 0) applyEffect(state, p, e, null, u);
    }
  }
  resolveDeaths(state);
  return { ok: true };
}

export function attackTargets(state, p, uid) {
  const u = findUnit(state, p, uid);
  if (!u || !u.ready || u.atk <= 0 || state.turn !== p || state.winner !== null) return [];
  const foe = other(p);
  const guards = state.players[foe].board.filter((x) => x.guard && !x.stealth);
  if (guards.length) return guards.map((x) => ({ player: foe, uid: x.uid }));
  return effectTargets(state, p, 'enemy');
}

export function attack(state, p, uid, target) {
  if (!target || !attackTargets(state, p, uid).some((t) => sameTarget(t, target))) {
    return { ok: false, error: 'Ataque no válido' };
  }
  const u = findUnit(state, p, uid);
  if (u.fury && !u.furyUsed) u.furyUsed = true; // Furia: el primer ataque no la agota
  else u.ready = false;
  u.stealth = false; // atacar revela
  emit(state, { type: 'attack', player: p, uid, target });
  const defender = target.uid === HERO ? null : findUnit(state, target.player, target.uid);
  const dealt = damage(state, target, u.atk, u);
  if (defender) damage(state, { player: p, uid }, defender.atk, defender); // contraataque simultáneo
  if (u.drain) heal(state, p, dealt);
  const e = unitEffect(u);
  if (e && e.trigger === 'attack' && u.hp > 0) applyEffect(state, p, e, null, u);
  resolveDeaths(state);
  return { ok: true };
}

export function endTurn(state, p) {
  if (state.winner !== null || state.turn !== p) return { ok: false, error: 'No es tu turno' };
  for (const u of [...state.players[p].board]) {
    const e = unitEffect(u);
    if (e && e.trigger === 'turnEnd' && u.hp > 0) applyEffect(state, p, e, null, u);
  }
  resolveDeaths(state);
  if (state.winner !== null) return { ok: true };
  startTurn(state, other(p));
  return { ok: true };
}

export function concede(state, p) {
  if (state.winner !== null) return { ok: false, error: 'La partida ha terminado' };
  state.winner = other(p);
  emit(state, { type: 'gameOver', winner: state.winner, conceded: true });
  return { ok: true };
}

// La interfaz llama a esto para recoger y vaciar los eventos pendientes.
export function takeEvents(state) {
  return state.events.splice(0);
}
