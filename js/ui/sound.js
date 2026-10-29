// Sonido: efectos CC0 de Kenney (scripts/sfx.py) y música propia generada con ACE-Step (docs/sonido.md).
import { CARD_BY_ID } from '../core/cards.js';
import { getProfile } from './store.js';

// Efecto -> número de variantes en audio/sfx/<nombre><n>.mp3; se elige una al azar para que no canse.
const SFX = { click: 1, error: 1, draw: 2, play: 3, summon: 1, spell: 1, attack: 2, damage: 3, death: 2, heal: 1, buff: 1, weaken: 1, silence: 1, freeze: 1, burn: 1, shieldBreak: 1, transform: 1, bounce: 1, turn: 1, shuffle: 1, packOpen: 1, 'reveal-common': 1, 'reveal-rare': 1, 'reveal-epic': 1, 'reveal-legendary': 1, coins: 1, forge: 1, win: 1, lose: 1 };
const SFX_VOLUME = 0.6;

let ctx = null;
const buffers = {}; // archivo -> Promise<AudioBuffer>

function load(file) {
  buffers[file] ??= fetch(file).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b));
  return buffers[file];
}

export function sfx(name) {
  if (!getProfile().settings.sound || !SFX[name]) return;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      for (const [n, count] of Object.entries(SFX)) for (let i = 1; i <= count; i++) load(`audio/sfx/${n}${i}.mp3`).catch(() => {});
    }
    if (ctx.state === 'suspended') ctx.resume();
    load(`audio/sfx/${name}${1 + Math.floor(Math.random() * SFX[name])}.mp3`).then((buf) => {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = buf;
      gain.gain.value = SFX_VOLUME;
      src.connect(gain).connect(ctx.destination);
      src.start();
    }).catch(() => {});
  } catch { /* sin Web Audio: el juego sigue en silencio */ }
}

// Todos los botones, también los de las ventanas que cortan la propagación del clic.
document.addEventListener('click', (ev) => ev.target.closest?.('button') && sfx('click'), true);

// Un solo efecto por tanda de eventos, el más importante, para que no se amontonen; el ataque suena además del golpe.
const PRIORITY = ['death', 'shieldBreak', 'freeze', 'burn', 'damage', 'heal', 'buff', 'weaken', 'silence', 'transform', 'bounce', 'spell', 'play', 'summon', 'draw'];
export function eventSound(events, me) {
  const types = new Set(events.map((e) => (e.type === 'play' && CARD_BY_ID[e.card]?.type === 'spell' ? 'spell' : e.type)));
  if (types.has('attack')) sfx('attack');
  const name = PRIORITY.find((t) => types.has(t));
  if (name) sfx(name);
  if (events.some((e) => e.type === 'turn' && e.player === me)) sfx('turn');
}

// ---------- Música ----------
// shortcut: el reproductor pide el MP3 por rangos y el service worker no los guarda, así que sin conexión no hay música; precargarla en caché si hace falta.
// El volumen iguala las pistas: la de combate sale bastante más fuerte que la del menú.
const TRACKS = { menu: { file: 'audio/music/menu.mp3', volume: 0.4 }, battle: { file: 'audio/music/battle.mp3', volume: 0.15 } };
const player = new Audio();
player.loop = true;
let wanted = null;

// Pista que corresponde a la pantalla (null = silencio). Hasta el primer toque el navegador no deja sonar nada.
export function music(name) {
  wanted = name;
  updateMusic();
}

export function updateMusic() {
  if (!wanted || !getProfile().settings.music || document.hidden) return player.pause();
  const track = TRACKS[wanted];
  if (!player.src.endsWith(track.file)) player.src = track.file;
  player.volume = track.volume;
  if (player.paused) player.play().catch(() => {});
}

document.addEventListener('visibilitychange', updateMusic);
document.addEventListener('pointerdown', updateMusic);
