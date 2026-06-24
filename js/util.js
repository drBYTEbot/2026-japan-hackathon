// util.js — shared helpers for ArcAIdia
// RNG, math, storage, canvas drawing helpers, palettes

export const TAU = Math.PI * 2;

// ---------- math ----------
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const sign = v => v < 0 ? -1 : v > 0 ? 1 : 0;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = arr => arr[Math.floor(Math.random() * arr.length)];
export const chance = p => Math.random() < p;
export function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = randInt(0, i); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

export const easeInOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const easeOut = t => 1 - Math.pow(1 - t, 3);
export const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const approach = (a, b, step) => {
  if (a < b) return Math.min(a + step, b);
  if (a > b) return Math.max(a - step, b);
  return b;
};

export const rectsOverlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// seeded RNG (mulberry32) so avatars are deterministic per name
export function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t |= 0; t = t + 0x6D2B79F5 | 0;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r;
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
export const hashStr = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---------- palettes ----------
export const PALETTE = {
  bg: '#0e1320',
  panel: '#161d2e',
  panel2: '#1f2740',
  ink: '#e7ecff',
  dim: '#8b94b8',
  gold: '#ffcf4d',
  gold2: '#ff9d2e',
  green: '#43d17a',
  red: '#ff5d5d',
  blue: '#5db8ff',
  purple: '#b07bff',
  accent: '#00e0c6',
};

// ---------- storage ----------
const KEY = 'arcadia_save_v1';
export function loadSave() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
export function saveSave(obj) {
  try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch {}
}
export const Store = {
  get coins() { return loadSave().coins || 0; },
  set coins(v) { const s = loadSave(); s.coins = Math.max(0, Math.floor(v)); saveSave(s); },
  addCoins(n) { this.coins = this.coins + n; return this.coins; },
  get owned() { return loadSave().owned || []; },
  owns(name) { return this.owned.includes(name); },
  addOwned(name) { if (!this.owns(name)) { const s = loadSave(); s.owned = (s.owned || []).concat(name); saveSave(s); } },
  get best() { return loadSave().best || {}; },
  setBest(game, v) { const s = loadSave(); s.best = s.best || {}; if (!s.best[game] || v > s.best[game]) { s.best[game] = v; saveSave(s); } },
};

// ---------- canvas helpers ----------
export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function fillRoundRect(ctx, x, y, w, h, r, fill) {
  roundRect(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
}
export function strokeRoundRect(ctx, x, y, w, h, r, lw, style) {
  roundRect(ctx, x, y, w, h, r); ctx.lineWidth = lw; ctx.strokeStyle = style; ctx.stroke();
}

// draw a crisp pixel block
export function px(ctx, x, y, s, color) { ctx.fillStyle = color; ctx.fillRect(x | 0, y | 0, s | 0, (s + 1) | 0); }

// draw pixel text via tiny 5x7 font built into a bitmap string
// Each glyph is 5 cols wide, rows separated by rows; '1'=lit,'0'=unlit
const FONT5x7 = {
  ' ': '00000;00000;00000;00000;00000;00000;00000',
  A: '01110;10001;10001;11111;10001;10001;10001',
  B: '11110;10001;10001;11110;10001;10001;11110',
  C: '01111;10000;10000;10000;10000;10000;01111',
  D: '11110;10001;10001;10001;10001;10001;11110',
  E: '11111;10000;10000;11110;10000;10000;11111',
  F: '11111;10000;10000;11110;10000;10000;10000',
  G: '01111;10000;10000;10111;10001;10001;01111',
  H: '10001;10001;10001;11111;10001;10001;10001',
  I: '11111;00100;00100;00100;00100;00100;11111',
  J: '00111;00010;00010;00010;00010;10010;01100',
  K: '10001;10010;10100;11000;10100;10010;10001',
  L: '10000;10000;10000;10000;10000;10000;11111',
  M: '10001;11011;10101;10101;10001;10001;10001',
  N: '10001;11001;10101;10011;10001;10001;10001',
  O: '01110;10001;10001;10001;10001;10001;01110',
  P: '11110;10001;10001;11110;10000;10000;10000',
  Q: '01110;10001;10001;10001;10101;10010;01101',
  R: '11110;10001;10001;11110;10100;10010;10001',
  S: '01111;10000;10000;01110;00001;00001;11110',
  T: '11111;00100;00100;00100;00100;00100;00100',
  U: '10001;10001;10001;10001;10001;10001;01110',
  V: '10001;10001;10001;10001;10001;01010;00100',
  W: '10001;10001;10001;10101;10101;11011;10001',
  X: '10001;10001;01010;00100;01010;10001;10001',
  Y: '10001;10001;01010;00100;00100;00100;00100',
  Z: '11111;00001;00010;00100;01000;10000;11111',
  '0': '01110;10001;10011;10101;11001;10001;01110',
  '1': '00100;01100;00100;00100;00100;00100;01110',
  '2': '01110;10001;00001;00010;00100;01000;11111',
  '3': '11111;00010;00100;00010;00001;10001;01110',
  '4': '00010;00110;01010;10010;11111;00010;00010',
  '5': '11111;10000;11110;00001;00001;10001;01110',
  '6': '00110;01000;10000;11110;10001;10001;01110',
  '7': '11111;00001;00010;00100;01000;01000;01000',
  '8': '01110;10001;10001;01110;10001;10001;01110',
  '9': '01110;10001;10001;01111;00001;00010;01100',
  '&': '01100;10010;01010;00100;01010;10010;01101',
  '!': '00100;00100;00100;00100;00100;00000;00100',
  '?': '01110;10001;00001;00010;00100;00000;00100',
  ':': '00000;00100;00000;00000;00000;00100;00000',
  '-': '00000;00000;00000;11111;00000;00000;00000',
  '+': '00000;00100;00100;11111;00100;00100;00000',
  '/': '00001;00010;00010;00100;01000;01000;10000',
  '.': '00000;00000;00000;00000;00000;00000;00100',
  ',': '00000;00000;00000;00000;00000;00100;01000',
  "'": '00100;00100;00000;00000;00000;00000;00000',
  x: '00000;00000;10001;01010;00100;01010;10001',
};
export function pxText(ctx, text, x, y, scale, color) {
  const s = String(text).toUpperCase();
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of s) {
    const g = FONT5x7[ch] || FONT5x7['?'];
    const rows = g.split(';');
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] === '1') ctx.fillRect((cx + c * scale) | 0, (y + r * scale) | 0, scale | 0, (scale + 1) | 0);
      }
    }
    cx += 6 * scale;
  }
  return cx - x;
}
export function pxTextCenter(ctx, text, cx, y, scale, color) {
  const w = String(text).toUpperCase().length * 6 * scale - scale;
  return pxText(ctx, text, cx - w / 2, y, scale, color);
}

// ---------- particles ----------
export class Particles {
  constructor() { this.list = []; }
  burst(x, y, n, opts = {}) {
    const { color = '#fff', speed = 120, life = 0.6, size = 3, gravity = 0, spread = TAU } = opts;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU) + (spread === TAU ? 0 : 0);
      const sp = rand(speed * 0.3, speed);
      this.list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.up || 0), life, max: life, color, size: rand(size * 0.6, size), gravity });
    }
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt; p.vx *= 0.96; p.vy *= 0.98;
    }
  }
  draw(ctx) {
    for (const p of this.list) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------- screen shake ----------
export let shake = { mag: 0, t: 0 };
export function addShake(m, t = 0.3) { shake.mag = Math.max(shake.mag, m); shake.t = Math.max(shake.t, t); }
export function updateShake(dt) {
  if (shake.t > 0) { shake.t -= dt; if (shake.t <= 0) shake.mag = 0; }
}
export function applyShake(ctx) {
  if (shake.mag > 0 && shake.t > 0) {
    const m = shake.mag * (shake.t * 3);
    ctx.translate(rand(-m, m), rand(-m, m));
  }
}
