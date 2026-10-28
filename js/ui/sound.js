// Efectos de sonido sintetizados con Web Audio: sin archivos de audio ni licencias que comprobar.
import { getProfile } from './store.js';

// Cada sonido es una lista de notas [frecuencia Hz, duración s, forma de onda], tocadas una tras otra.
const SOUNDS = {
  play: [[520, 0.06, 'triangle'], [780, 0.09, 'triangle']],
  damage: [[150, 0.12, 'sawtooth']],
  heal: [[660, 0.07, 'sine'], [990, 0.12, 'sine']],
  death: [[240, 0.08, 'square'], [120, 0.18, 'square']],
  win: [[523, 0.12, 'triangle'], [659, 0.12, 'triangle'], [784, 0.3, 'triangle']],
  lose: [[392, 0.15, 'sine'], [330, 0.15, 'sine'], [262, 0.35, 'sine']],
};

let ctx = null;

export function sfx(name) {
  if (!getProfile().settings.sound || !SOUNDS[name]) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    let t = ctx.currentTime;
    for (const [freq, dur, type] of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur); // sin chasquido al cortar
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    }
  } catch { /* sin Web Audio: el juego sigue en silencio */ }
}

// Un solo sonido por tanda de eventos, el más importante, para que no se amontonen.
export function eventSound(events) {
  const types = new Set(events.map((e) => e.type));
  const name = ['death', 'damage', 'heal', 'play'].find((t) => types.has(t));
  if (name) sfx(name);
}
