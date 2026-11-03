// Partidas contra la IA. El motor y la IA son deterministas: con la semilla, los mazos y las jugadas del jugador,
// el servidor repite la partida entera y sabe quién ganó sin fiarse de lo que diga el móvil.
import { AI_DECKS, AI_HP, RULES } from './config.js';
import { actionError, attack, concede, createMatch, endTurn, playCard, takeEvents } from './engine.js';
import { nextAction } from './ai.js';
import { matchStats } from './missions.js';

const ME = 0;
const FOE = 1;
const MAX_AI_ACTIONS = 60; // red de seguridad: un fallo de la IA no puede dejar la partida colgada
export const MIN_TURNS_TO_COUNT = 4; // rendirse antes no cuenta como partida
export const MAX_MOVES = 1500;

// Más fácil en los primeros niveles y cada vez más duro después.
export function aiHp(level) {
  const { start, fullAt, everyLevels, max } = AI_HP;
  if (level < fullAt) return Math.round(start + ((level - 1) * (RULES.startHp - start)) / (fullAt - 1));
  return Math.min(max, RULES.startHp + Math.floor((level - fullAt) / everyLevels));
}

// level es el nivel del jugador al empezar; las partidas de antes de guardarlo se juegan con la vida normal.
export function setupMatch({ deck, seed, first, rival, level = AI_HP.fullAt }) {
  const state = createMatch({ decks: [deck, AI_DECKS[rival]], seed, firstPlayer: first });
  state.players[FOE].hp = aiHp(level);
  return state;
}
export const aiAction = (state, count) => (count > MAX_AI_ACTIONS ? { type: 'end' } : nextAction(state, FOE));

function apply(state, p, a) {
  if (a.type === 'play') return playCard(state, p, a.handIndex, a.target);
  if (a.type === 'attack') return attack(state, p, a.uid, a.target);
  return endTurn(state, p);
}

function foeTurn(state, log) {
  for (let n = 1; state.turn === FOE && state.winner === null; n++) {
    try {
      apply(state, FOE, aiAction(state, n));
    } catch { // igual que en la pantalla de combate: el turno pasa al jugador pase lo que pase
      if (state.turn === FOE && state.winner === null) endTurn(state, FOE);
    }
    log.push(...takeEvents(state));
  }
}

// Devuelve { error } si alguna jugada es imposible o la partida no llega a terminar.
export function replayMatch(setup, moves) {
  if (!Array.isArray(moves) || moves.length > MAX_MOVES) return { error: 'Partida no válida' };
  const state = setupMatch(setup);
  takeEvents(state);
  const log = [];
  foeTurn(state, log);
  let conceded = false;
  for (const m of moves) {
    if (m?.type === 'concede') {
      conceded = state.winner === null;
      if (conceded) concede(state, ME);
      break;
    }
    if (state.winner !== null || actionError(state, ME, m)) return { error: 'Partida no válida' };
    apply(state, ME, m);
    log.push(...takeEvents(state));
    foeTurn(state, log);
  }
  if (state.winner === null) return { error: 'Partida sin terminar' };
  const won = state.winner === ME;
  return { won, turns: state.turnNumber, counts: !conceded || state.turnNumber >= MIN_TURNS_TO_COUNT, stats: matchStats(log, won, ME) };
}
