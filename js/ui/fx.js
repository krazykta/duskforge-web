// Efectos especiales del combate, dibujados en un canvas sobre la mesa. Solo decoran: el motor no sabe
// que existen, y todas las esperas son por tiempo para que un fallo de dibujo nunca pare la partida.
import { getProfile, wait } from './store.js';

const MAX_PARTICLES = 420; // tope para móviles modestos
const canvas = document.createElement('canvas');
canvas.className = 'fx-layer';
const ctx = canvas.getContext('2d');
let particles = [];
let marks = []; // dibujos con duración: tajos, mordiscos, rayos...
let running = false;
let lastFrame = 0;

function fit() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', fit);

export const motionOn = () => !getProfile().settings.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function emit(x, y, o) {
  if (particles.length >= MAX_PARTICLES) return;
  particles.push({ x, y, vx: 0, vy: 0, g: 0, drag: 1, size: 3, life: 500, born: performance.now(), color: '#fff', shape: 'dot', rot: rand(0, 6.28), spin: 0, add: true, ...o });
}

// n partículas que salen en todas direcciones desde un punto.
function burst(x, y, n, o) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.28);
    const v = rand(o.speed * 0.3, o.speed);
    emit(x, y, { ...o, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color: Array.isArray(o.color) ? pick(o.color) : o.color, size: rand(o.size * 0.5, o.size), life: rand(o.life * 0.6, o.life) });
  }
}

function mark(duration, draw) {
  marks.push({ duration, draw, born: performance.now() });
  start();
}

function start() {
  if (running) return;
  if (!canvas.isConnected) { document.body.appendChild(canvas); fit(); }
  running = true;
  lastFrame = performance.now();
  requestAnimationFrame(loop);
}

function drawParticle(p, k) {
  ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
  ctx.globalAlpha = 1 - k;
  ctx.fillStyle = ctx.strokeStyle = p.color;
  const s = p.size * (p.shrink === false ? 1 : 1 - k * 0.6);
  if (p.shape === 'spark') {
    ctx.lineWidth = s * 0.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
    ctx.stroke();
    return;
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.beginPath();
  if (p.shape === 'shard') { ctx.moveTo(0, -s * 1.6); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s * 1.6); ctx.lineTo(-s * 0.7, 0); ctx.closePath(); }
  else if (p.shape === 'leaf') ctx.ellipse(0, 0, s * 1.5, s * 0.6, 0, 0, 6.28);
  else if (p.shape === 'star') for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.4 : s * 1.5; ctx.lineTo(Math.cos(i * 0.785) * r, Math.sin(i * 0.785) * r); }
  else if (p.shape === 'cross') { ctx.rect(-s * 0.3, -s, s * 0.6, s * 2); ctx.rect(-s, -s * 0.3, s * 2, s * 0.6); }
  else ctx.arc(0, 0, s, 0, 6.28);
  ctx.fill();
  ctx.restore();
}

function loop(now) {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const steps = Math.min(now - lastFrame, 100) / (1000 / 60); // un móvil lento dibuja menos, no más despacio
  lastFrame = now;
  try {
    particles = particles.filter((p) => {
      const k = (now - p.born) / p.life;
      if (k >= 1) return false;
      if (k >= 0) {
        p.x += (p.vx / 60) * steps; p.y += (p.vy / 60) * steps;
        p.vy += (p.g / 60) * steps; p.vx *= p.drag ** steps; p.vy *= p.drag ** steps; p.rot += p.spin * steps;
        drawParticle(p, k);
      }
      return true;
    });
    ctx.globalCompositeOperation = 'source-over';
    marks = marks.filter((m) => {
      const k = (now - m.born) / m.duration;
      if (k >= 1) return false;
      if (k >= 0) { ctx.save(); m.draw(Math.max(0, k)); ctx.restore(); }
      return true;
    });
  } catch { particles = []; marks = []; } // decoración: si algo falla se limpia y el combate sigue
  ctx.globalAlpha = 1;
  if (particles.length || marks.length) requestAnimationFrame(loop);
  else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
}

const PALETTE = {
  fire: ['#fff3b0', '#ffb347', '#ff6a1f', '#d62800'],
  ice: ['#ffffff', '#c7f1ff', '#7dd3fc', '#38a3e0'],
  lightning: ['#ffffff', '#d9e8ff', '#8fb8ff', '#ffe66d'],
  poison: ['#e5ffa3', '#9be24a', '#4caf3a', '#7b3fa0'],
  blood: ['#ff8a8a', '#e01e37', '#a00c23', '#5c0011'],
  water: ['#e0f7ff', '#7fd6ff', '#2e9bff', '#1466c9'],
  wind: ['#ffffff', '#dff5ee', '#a6e3d0'],
  earth: ['#e3c595', '#b98a56', '#7a5a38', '#4a3622'],
  nature: ['#e6ffb0', '#8fdc5a', '#3fa34d', '#c9a227'],
  steel: ['#ffffff', '#dbe4f0', '#9fb0c8', '#ffcf70'],
  shadow: ['#d9b3ff', '#8a3ffc', '#4c1d95', '#1a0b33'],
  holy: ['#ffffff', '#fff3b0', '#ffd76a', '#ffb347'],
  arcane: ['#ffffff', '#e6c9ff', '#b57bff', '#5ec8ff'],
  heal: ['#ffffff', '#c9ffd8', '#5ee08a', '#ffe9a0'],
};
const SHAPE = { ice: 'shard', nature: 'leaf', arcane: 'star', holy: 'star', earth: 'shard', heal: 'cross', steel: 'spark', lightning: 'spark' };

// ---------- Golpes cuerpo a cuerpo ----------
// Un tajo con forma de media luna: fino en las puntas y grueso en el centro.
function crescent(x, y, r, angle, color, width) {
  mark(240, (k) => {
    const reveal = Math.min(1, k * 2.4);
    const a0 = angle - 1.1;
    const a1 = a0 + 2.2 * reveal;
    ctx.globalAlpha = 1 - Math.max(0, (k - 0.45) / 0.55);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, a0, a1);
    ctx.arc(x + Math.cos(angle) * width, y + Math.sin(angle) * width, r, a1, a0, true);
    ctx.fill();
  });
}

const STRIKES = {
  slash(x, y) {
    crescent(x, y, 44, 2.4, '#ffffff', -13);
    crescent(x, y, 40, 0.7, '#ffcf70', -9);
    burst(x, y, 16, { speed: 320, size: 3, life: 340, color: PALETTE.steel, shape: 'spark', drag: 0.93 });
  },
  pierce(x, y) {
    mark(190, (k) => {
      ctx.globalAlpha = 1 - k;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x - 7, y + 62 - k * 30); ctx.lineTo(x, y - 58 - k * 12); ctx.lineTo(x + 7, y + 62 - k * 30);
      ctx.fill();
    });
    burst(x, y, 14, { speed: 300, size: 3, life: 320, color: PALETTE.steel, shape: 'spark', drag: 0.92 });
  },
  // Dos filas de dientes que se cierran sobre la víctima, y la sangre al apretar.
  bite(x, y) {
    const row = (top, k) => {
      const shift = (1 - Math.min(1, k * 2.2)) * 34;
      const dir = top ? -1 : 1;
      ctx.beginPath();
      for (let i = -3; i <= 3; i++) {
        const tx = x + i * 13;
        const spread = 16 - Math.abs(i) * 2;
        const base = y + dir * (spread + shift);
        ctx.moveTo(tx - 6, base);
        ctx.lineTo(tx, base - dir * (22 - Math.abs(i) * 2));
        ctx.lineTo(tx + 6, base);
      }
      ctx.fill();
    };
    mark(360, (k) => {
      ctx.globalAlpha = k < 0.6 ? 1 : (1 - k) / 0.4;
      ctx.fillStyle = '#fff5e6';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 8;
      row(true, k);
      row(false, k);
    });
    setTimeout(() => {
      burst(x, y, 20, { speed: 240, size: 4, life: 520, color: PALETTE.blood, g: 620, drag: 0.98, add: false });
    }, 150);
  },
  // Tres zarpazos en diagonal que se quedan marcados un instante.
  claw(x, y) {
    mark(330, (k) => {
      const reveal = Math.min(1, k * 4);
      ctx.globalAlpha = k < 0.5 ? 1 : (1 - k) * 2;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffd9d0';
      for (let i = -1; i <= 1; i++) {
        const sx = x + i * 19 + 24; const sy = y - 42;
        const ex = sx - 48 * reveal; const ey = sy + 84 * reveal;
        ctx.beginPath();
        ctx.moveTo(sx, sy); ctx.lineTo((sx + ex) / 2 + 4, (sy + ey) / 2); ctx.lineTo(ex, ey); ctx.lineTo((sx + ex) / 2 - 4, (sy + ey) / 2);
        ctx.fill();
      }
    });
    burst(x, y, 12, { speed: 220, size: 3, life: 380, color: ['#ff8a8a', '#e01e37', '#ffffff'], g: 400, add: false });
  },
  sting(x, y) {
    STRIKES.pierce(x, y);
    burst(x, y, 14, { speed: 170, size: 3.5, life: 560, color: PALETTE.poison, g: 180 });
  },
  // Onda de choque, grietas y cascotes: pesa.
  smash(x, y, power) {
    ring(x, y, '#ffe2b0', 70 + power * 8, 5);
    const cracks = Array.from({ length: 7 }, () => {
      let a = rand(0, 6.28);
      let [cx, cy] = [x, y];
      return Array.from({ length: 4 }, () => { a += rand(-0.6, 0.6); cx += Math.cos(a) * 15; cy += Math.sin(a) * 15; return [cx, cy]; });
    });
    mark(420, (k) => {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#ffb347';
      ctx.lineWidth = 2;
      for (const c of cracks) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (const [cx, cy] of c) ctx.lineTo(cx, cy);
        ctx.stroke();
      }
    });
    burst(x, y, 22, { speed: 330, size: 5, life: 620, color: PALETTE.earth, shape: 'shard', g: 760, spin: 0.2, add: false });
    burst(x, y, 12, { speed: 110, size: 12, life: 620, color: 'rgba(150, 130, 110, 0.5)', drag: 0.95, add: false });
  },
  hit(x, y) {
    burst(x, y, 9, { speed: 200, size: 2.5, life: 280, color: PALETTE.steel, shape: 'spark', drag: 0.92 });
  },
};

function ring(x, y, color, radius, width) {
  mark(340, (k) => {
    ctx.globalAlpha = 1 - k;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = color;
    ctx.lineWidth = width * (1 - k) + 0.5;
    ctx.beginPath();
    ctx.arc(x, y, radius * (0.25 + k * 0.75), 0, 6.28);
    ctx.stroke();
  });
}

// ---------- Impactos de energía ----------
function impact(element, x, y, power = 2) {
  const color = PALETTE[element];
  const n = 14 + Math.min(power, 8) * 3;
  ring(x, y, color[1], 46 + Math.min(power, 8) * 7, 5);
  burst(x, y, n, { speed: 280, size: 4.5, life: 560, color, shape: SHAPE[element] ?? 'dot', drag: 0.95, spin: 0.12 });
  const glow = color[1];
  mark(220, (k) => {
    const r = 54 * (1 - k * 0.4);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, glow);
    g.addColorStop(1, 'transparent');
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  });
  if (element === 'fire') burst(x, y, 10, { speed: 90, size: 11, life: 680, color: 'rgba(60, 40, 40, 0.5)', add: false, g: -130 });
  if (element === 'ice') burst(x, y, 12, { speed: 320, size: 6, life: 620, color: PALETTE.ice, shape: 'shard', g: 620, add: false, spin: 0.2 });
  if (element === 'water') burst(x, y, 16, { speed: 300, size: 4, life: 600, color: PALETTE.water, g: 800 });
  if (element === 'blood') burst(x, y, 14, { speed: 260, size: 4, life: 560, color: PALETTE.blood, g: 700, add: false });
  if (element === 'earth') STRIKES.smash(x, y, power);
  if (element === 'steel') STRIKES.slash(x, y);
  if (element === 'shadow') burst(x, y, 14, { speed: 80, size: 13, life: 720, color: 'rgba(40, 10, 70, 0.6)', add: false });
  if (element === 'holy') beam(x, y, '#fff3b0');
}

function beam(x, y, color) {
  mark(420, (k) => {
    const w = 30 * (1 - k);
    const g = ctx.createLinearGradient(0, y - 300, 0, y);
    g.addColorStop(0, 'transparent');
    g.addColorStop(1, color);
    ctx.globalAlpha = 1 - k;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(x - w, y - 300, w * 2, 310);
  });
}

function zigzag(from, to, jitter) {
  const steps = 8;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const j = i === 0 || i === steps ? 0 : rand(-jitter, jitter);
    return [from.x + (to.x - from.x) * t + j, from.y + (to.y - from.y) * t + j * 0.6];
  });
}

// El rayo no viaja: aparece de golpe, parpadea y se va.
function bolt(from, to) {
  const paths = [zigzag(from, to, 22), zigzag(from, to, 14)];
  mark(190, (k) => {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    for (const [i, path] of paths.entries()) {
      ctx.globalAlpha = (1 - k) * (Math.sin(k * 40) > -0.3 ? 1 : 0.35);
      ctx.strokeStyle = i ? '#ffffff' : '#8fb8ff';
      ctx.lineWidth = i ? 2 : 6;
      ctx.beginPath();
      path.forEach(([x, y], n) => (n ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  });
}

// ---------- Proyectiles ----------
const DRAW_SHOT = {
  // La flecha apunta hacia +x; se gira con la trayectoria.
  arrow() {
    ctx.strokeStyle = '#d9b38c'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(13, 0); ctx.stroke();
    ctx.fillStyle = '#e8eef7';
    ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(11, -4.5); ctx.lineTo(11, 4.5); ctx.fill();
    ctx.fillStyle = '#e05a3c';
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-24, -5); ctx.lineTo(-14, 0); ctx.lineTo(-24, 5); ctx.fill();
  },
  // Hacha que da vueltas en el aire.
  throw(k) {
    ctx.rotate(k * 16);
    ctx.fillStyle = '#7a5a38'; ctx.fillRect(-2, -14, 4, 28);
    ctx.fillStyle = '#dbe4f0';
    ctx.beginPath(); ctx.moveTo(2, -14); ctx.quadraticCurveTo(18, -12, 16, 2); ctx.lineTo(2, -3); ctx.fill();
  },
  shot() {
    ctx.fillStyle = '#20202a';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.arc(-2, -3, 2.5, 0, 6.28); ctx.fill();
  },
};

function travel(from, to, duration, each) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  mark(duration, (k) => each(from.x + dx * k, from.y + dy * k, k, angle));
  return wait(duration);
}

// Proyectil físico (flecha, hacha, bala). El arco de la trayectoria da sensación de peso.
function physical(kind, from, to) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const duration = kind === 'arrow' ? Math.max(170, dist * 0.55) : Math.max(260, dist * 0.8);
  const arc = kind === 'arrow' ? dist * 0.06 : dist * 0.16;
  return travel(from, to, duration, (x, y, k, angle) => {
    const lift = Math.sin(k * Math.PI) * arc;
    ctx.translate(x, y - lift);
    ctx.rotate(angle);
    DRAW_SHOT[kind](k);
    if (kind === 'shot') emit(x, y - lift, { size: 7, life: 340, color: 'rgba(120, 120, 130, 0.55)', add: false });
    if (kind === 'arrow') emit(x, y - lift, { size: 1.5, life: 140, color: '#ffffff' });
  });
}

// Bola de energía con estela del color de su elemento.
function orb(element, from, to, duration = 300) {
  const color = PALETTE[element];
  if (element === 'lightning') { bolt(from, to); return wait(90); }
  return travel(from, to, duration, (x, y) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 20);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, color[1]);
    g.addColorStop(1, 'transparent');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(x - 20, y - 20, 40, 40);
    for (let i = 0; i < 2; i++) {
      emit(x + rand(-5, 5), y + rand(-5, 5), { size: rand(2, 5), life: 300, color: pick(color), shape: SHAPE[element] ?? 'dot', vx: rand(-30, 30), vy: rand(-30, 30), spin: 0.1 });
    }
  });
}

// ---------- Lo que usa el combate ----------
export function strikeFx(style, element, to, power = 2) {
  if (!motionOn()) return;
  start();
  (STRIKES[style] ?? STRIKES.hit)(to.x, to.y, power);
  if (element) burst(to.x, to.y, 8, { speed: 180, size: 3, life: 400, color: PALETTE[element] });
}

// Devuelve cuando el disparo llega al objetivo.
export async function shootFx(style, element, from, to, power = 2) {
  if (!motionOn()) return;
  start();
  if (style === 'arrow' || style === 'throw' || style === 'shot') {
    await physical(style, from, to);
    if (style === 'shot') impact('fire', to.x, to.y, power + 2);
    else STRIKES.hit(to.x, to.y);
    return;
  }
  await orb(element, from, to, 280);
  impact(element, to.x, to.y, power);
}

export async function castFx(element, from, targets, power = 2) {
  if (!motionOn()) return;
  start();
  // Se concentra la energía antes de soltarla.
  const color = PALETTE[element];
  for (let i = 0; i < 26; i++) {
    const a = rand(0, 6.28);
    const r = rand(60, 110);
    emit(from.x + Math.cos(a) * r, from.y + Math.sin(a) * r, { vx: -Math.cos(a) * r * 3.2, vy: -Math.sin(a) * r * 3.2, size: 3, life: 300, color: pick(color), shape: SHAPE[element] ?? 'dot' });
  }
  await wait(240);
  if (!targets.length) { impact(element, from.x, from.y, power); return; }
  const shots = targets.map(async (t, i) => {
    await wait(i * 70);
    await orb(element, from, t, 260);
    impact(element, t.x, t.y, power);
  });
  await Promise.all(shots);
}

export function healFx(p) {
  if (!motionOn()) return;
  start();
  for (let i = 0; i < 16; i++) {
    emit(p.x + rand(-34, 34), p.y + rand(-4, 22), { vy: rand(-90, -46), size: rand(3, 6), life: rand(520, 860), color: pick(PALETTE.heal), shape: i % 3 ? 'dot' : 'cross', shrink: false });
  }
}

export function auraFx(element, p) {
  if (!motionOn()) return;
  start();
  ring(p.x, p.y, PALETTE[element][1], 50, 4);
  for (let i = 0; i < 12; i++) {
    emit(p.x + rand(-28, 28), p.y + rand(-10, 30), { vy: rand(-80, -30), size: rand(2.5, 4.5), life: rand(420, 700), color: pick(PALETTE[element]), shape: SHAPE[element] ?? 'dot' });
  }
}

// La carta se rompe en trozos y ceniza.
export function deathFx(p, color = '#a8a8c8') {
  if (!motionOn()) return;
  start();
  burst(p.x, p.y, 18, { speed: 210, size: 6, life: 700, color: [color, '#2a2440', '#ffb347'], shape: 'shard', g: 460, spin: 0.2, add: false });
  burst(p.x, p.y, 12, { speed: 60, size: 3, life: 900, color: ['#ffb347', '#ff6a1f'], g: -90 });
}

export function landFx(p) {
  if (!motionOn()) return;
  start();
  ring(p.x, p.y, '#ffd9a0', 56, 3);
  burst(p.x, p.y + 20, 10, { speed: 120, size: 7, life: 420, color: 'rgba(170, 150, 130, 0.5)', drag: 0.93, add: false });
}

// Sacude la mesa: más fuerte cuanto más duele.
export function shake(el, amount) {
  if (!motionOn() || amount < 3) return;
  const d = Math.min(3 + amount, 11);
  el.animate([{ transform: `translate(${d}px, ${-d / 2}px)` }, { transform: `translate(${-d}px, ${d / 2}px)` }, { transform: `translate(${d / 2}px, ${d / 3}px)` }, { transform: 'none' }], { duration: 240 });
}
