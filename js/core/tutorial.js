// Partidas tutoriales: las primeras de un jugador nuevo, con manos preparadas y consejos paso a paso.
// Se juegan en el móvil y no dan recompensa, así que el servidor solo guarda cuántas lecciones se han hecho (profile.tutorial).
import { CARD_BY_ID } from './cards.js';
import { RULES, TUTORIAL_LESSONS } from './config.js';
import { createMatch, takeEvents } from './engine.js';

const ME = 0;
const FOE = 1;
const played = (log, test = () => true) => log.some((e) => e.type === 'play' && e.player === ME && test(CARD_BY_ID[e.card]));
const passed = (log) => log.some((e) => e.type === 'turn' && e.player === FOE);
const attacked = (log) => log.some((e) => e.type === 'attack' && e.player === ME);
const never = () => false;
const PLAYABLE = '.hand .card.playable';
const END = '[data-act="end"]';

// hand: la mano inicial; draws: lo que se roba, en orden. glow: lo que se ilumina mientras se muestra el consejo.
// done(state, log): el consejo se cumple y pasa al siguiente. Los consejos solo se ven en tu turno.
export const LESSONS = [
  {
    title: 'Criaturas y ataques',
    intro: 'Aprende a jugar cartas y a atacar. Deja la vida del rival en 0 para ganar.',
    hand: ['dusk_recruit', 'ash_bat', 'rune_squire', 'flame_acolyte'],
    draws: ['night_leech', 'bog_lurker', 'bronze_sentinel', 'tower_archer', 'arcane_librarian', 'dusk_recruit'],
    foe: { hp: 8, hand: ['cinder_imp', 'dusk_recruit', 'mire_toad'], draws: ['dusk_recruit', 'cinder_imp', 'dusk_recruit', 'mire_toad'] },
    steps: [
      { text: 'Toca una carta para verla en grande y toca otra vez para jugarla. Cuesta energía: este turno tienes 1.', glow: PLAYABLE, done: (s, log) => played(log) },
      { text: 'Las criaturas no atacan el turno en que entran, salvo con Ímpetu. Toca «Fin de turno».', glow: END, done: (s, log) => passed(log) },
      { text: 'Las criaturas con brillo verde pueden atacar. Toca una y luego toca al héroe rival.', glow: '.unit.ready', done: (s, log) => attacked(log) },
      { text: 'Cada turno tienes 1 de energía más. Juega cartas, ataca y deja la vida del rival en 0.', glow: null, done: never },
    ],
  },
  {
    title: 'Guardianes y hechizos',
    intro: 'Un Guardián protege a su héroe, y los hechizos se lanzan sobre un objetivo.',
    hand: ['dusk_recruit', 'spark', 'ash_bat', 'tower_archer'],
    draws: ['spark', 'night_leech', 'lightning_lance', 'bog_lurker', 'flame_acolyte', 'dusk_recruit'],
    foe: { hp: 10, hand: ['scarecrow', 'gnome_lookout', 'dusk_recruit'], draws: ['scarecrow', 'dusk_recruit', 'gnome_lookout', 'dusk_recruit'] },
    steps: [
      { text: 'Juega una criatura y toca «Fin de turno».', glow: PLAYABLE, done: (s, log) => passed(log) },
      { text: 'El rival ha puesto un Guardián: hay que acabar con él antes de atacar al héroe. Toca Chispa, «Elegir objetivo» y toca el Guardián marcado en rojo.',
        glow: PLAYABLE, done: (s, log) => played(log, (c) => c.type === 'spell') },
      { text: 'Sin Guardianes en medio, tus criaturas pueden atacar al héroe. ¡Gana la partida!', glow: '.unit.ready', done: never },
    ],
  },
  {
    title: 'Combos',
    intro: 'Algunas cartas hacen algo extra si antes jugaste otra en el mismo turno.',
    hand: ['dusk_recruit', 'ash_bat', 'spark', 'tower_archer'],
    draws: ['deckhand', 'deckhand', 'night_leech', 'bog_lurker', 'arcane_librarian', 'dusk_recruit'],
    foe: { hp: 10, hand: ['dusk_recruit', 'mire_toad', 'cinder_imp'], draws: ['dusk_recruit', 'cinder_imp', 'mire_toad', 'dusk_recruit'] },
    steps: [
      { text: 'Juega una carta y toca «Fin de turno».', glow: PLAYABLE, done: (s, log) => passed(log) },
      { text: 'Has robado un Grumete Pirata. Su Combo hace 2 de daño al héroe rival si ya jugaste otra carta este turno: juega antes una carta de 1 y después el Grumete.',
        glow: PLAYABLE, done: (s, log) => log.some((e) => e.type === 'combo' && e.player === ME) },
      { text: '¡Combo! Ya sabes lo básico. «Cómo jugar», en el Perfil, explica el resto. Gana la partida.', glow: '.unit.ready', done: never },
    ],
  },
];
if (LESSONS.length !== TUTORIAL_LESSONS) throw new Error('TUTORIAL_LESSONS no coincide con las lecciones');

// Empiezas tú, con la mano y los robos de la lección. El relleno solo existe para que createMatch acepte los mazos.
export function setupLesson(n, seed = 1) {
  const lesson = LESSONS[n];
  const filler = Array(RULES.deckSize).fill('dusk_recruit');
  const state = createMatch({ decks: [filler, filler], seed, firstPlayer: ME });
  const deal = (p, hand, draws) => Object.assign(state.players[p], { hand: [...hand], deck: [...draws].reverse() }); // se roba del final
  deal(ME, lesson.hand, lesson.draws);
  deal(FOE, lesson.foe.hand, lesson.foe.draws);
  state.players[FOE].hp = lesson.foe.hp;
  state.players[FOE].think = 0; // el instructor juega con las reglas sencillas, sin pensar jugadas
  takeEvents(state);
  return state;
}

// El consejo que toca: el primero sin cumplir.
export const lessonStep = (n, state, log) => LESSONS[n].steps.findIndex((s) => !s.done(state, log));
