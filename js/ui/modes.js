// Modos de juego (decisión 45): cada modo con su ilustración, qué es y cómo va. Un modo nuevo solo añade una entrada a MODES.
import { ARENA, DAILY, FORGE, TOURNAMENT } from '../core/config.js';
import { arenaIndex } from '../core/arena.js';
import { weekLeft } from './tournament.js';
import { localDay } from '../core/progression.js';
import { app, getCloudUser, getProfile, topBar } from './store.js';
import { icon } from './icons.js';

const today = () => localDay(new Date());

// status(p) devuelve [texto, destacado]: destacado es algo que hacer ya y suma en el aviso del inicio.
export const MODES = [
  { id: 'arena', section: 'Competir', name: 'Arena', icon: 'trophy', art: 'chained_gladiator', account: true,
    text: 'Mazos reales de otros jugadores. Gana trofeos y sube de arena.',
    status: (p) => [`${ARENA.arenas[arenaIndex(p.trophies)].name} · ${p.trophies}`, false] },
  { id: 'tournament', section: 'Competir', name: 'Torneo semanal', icon: 'crown', art: 'knight_commander', account: true,
    text: `Cada victoria en la Arena suma puntos. El lunes, los ${TOURNAMENT.top} mejores cobran en el buzón.`,
    status: () => [`Termina en ${weekLeft()}`, false] },
  { id: 'daily', section: 'Desafíos', name: 'Reto del día', icon: 'flag', art: 'great_clockmaker', account: true,
    text: 'La misma partida para todos. Gana en menos turnos y entra en la tabla.',
    status: (p) => (p.dailyDone === today() ? ['Hecho hoy', false] : [`+${DAILY.coins} monedas hoy`, true]) },
  { id: 'forge', section: 'Desafíos', name: 'Desafío de la Forja', icon: 'shield', art: 'master_smith', account: true,
    text: `Paga la entrada y llega a ${FORGE.maxWins} victorias antes de ${FORGE.maxLosses} derrotas. Mejor premio cuanto más lejos.`,
    status: (p) => (p.forge ? [`En marcha · ${p.forge.wins} V ${p.forge.losses} D`, true] : [`Entrada ${FORGE.price} monedas`, false]) },
  { id: 'battle', section: 'Partidas libres', name: 'Contra la IA', icon: 'sword', art: 'knight_errant',
    text: 'Partida rápida con tu mazo. Da monedas, XP y avanza el pase.',
    status: (p) => [`Mazo ${p.activeDeck + 1}`, false] },
  { id: 'online', section: 'Partidas libres', name: 'Con amigos', icon: 'heart', art: 'knights_oath',
    text: 'Invita a un amigo y jugad en directo. Sin premio: solo por el honor.',
    status: () => ['En directo', false] },
];

// Lo que conviene hacer ya, para el aviso del botón del inicio.
export const modesReady = (p) => (getCloudUser() ? MODES.filter((m) => m.status(p)[1]).length : 0);

function modeCard(p, m, guest) {
  const [status, hot] = m.status(p);
  const tag = m.account && guest ? `<span class="state">${icon('user')}Con cuenta</span>` : `<span class="state ${hot ? 'hot' : ''}">${status}</span>`;
  return `
    <button class="mode-card" data-go="${m.id}">
      <img class="mode-art" src="img/cards/${m.art}.webp" alt="" loading="lazy">
      <span class="mode-body">
        <b class="mode-name">${icon(m.icon)}${m.name}</b>
        <span class="mode-text">${m.text}</span>
        ${tag}
      </span>
    </button>`;
}

export function showModes() {
  const p = getProfile();
  const guest = !getCloudUser();
  const sections = [...new Set(MODES.map((m) => m.section))];
  app.innerHTML = `
    <section class="screen top">
      ${topBar('Modos', 'menu')}
      ${sections.map((s) => `
        <h3 class="mode-section">${s}</h3>
        ${MODES.filter((m) => m.section === s).map((m) => modeCard(p, m, guest)).join('')}`).join('')}
    </section>`;
}
