// ui.js — input handling + immediate-mode UI + ai& logo
import { roundRect, fillRoundRect, strokeRoundRect, pxText, pxTextCenter, clamp, lerp, PALETTE } from './util.js';

export const W = 960, H = 540;

// ---------- input state ----------
const keysDown = new Set();
const keysPressed = new Set();
export const pointer = { x: W / 2, y: H / 2, down: false, clicked: false, consumed: false, rdown: false };

let canvas = null, view = { scale: 1, ox: 0, oy: 0 };

export function setView(s, ox, oy) { view.scale = s; view.ox = ox; view.oy = oy; }

export function init(canvasEl) {
  canvas = canvasEl;
  const toLogical = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    const x = (cx - r.left) / r.width * W;
    const y = (cy - r.top) / r.height * H;
    return { x, y };
  };
  const down = (cx, cy) => {
    const p = toLogical(cx, cy); pointer.x = p.x; pointer.y = p.y;
    pointer.down = true; pointer.clicked = true; pointer.consumed = false;
  };
  const move = (cx, cy) => { const p = toLogical(cx, cy); pointer.x = p.x; pointer.y = p.y; };
  const up = () => { pointer.down = false; };

  canvas.addEventListener('mousedown', e => { e.preventDefault(); down(e.clientX, e.clientY); });
  window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
  window.addEventListener('mouseup', up);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); const t = e.touches[0]; down(t.clientX, t.clientY); }, { passive: false });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: false });
  canvas.addEventListener('touchend', e => { e.preventDefault(); up(); }, { passive: false });

  window.addEventListener('keydown', e => {
    const k = normKey(e);
    if (NAV_KEYS.has(k)) e.preventDefault();
    if (!keysDown.has(k)) keysPressed.add(k);
    keysDown.add(k);
  });
  window.addEventListener('keyup', e => { keysDown.delete(normKey(e)); });
}

const NAV_KEYS = new Set(['arrowup','arrowdown','arrowleft','arrowright',' ','enter']);
function normKey(e) { return e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase(); }

export const Input = {
  down(k) { return keysDown.has(k); },
  pressed(k) { return keysPressed.has(k); },
  anyPressed() { return keysPressed.size > 0; },
  axis() {
    let x = 0, y = 0;
    if (keysDown.has('arrowleft') || keysDown.has('a')) x -= 1;
    if (keysDown.has('arrowright') || keysDown.has('d')) x += 1;
    if (keysDown.has('arrowup') || keysDown.has('w')) y -= 1;
    if (keysDown.has('arrowdown') || keysDown.has('s')) y += 1;
    return { x, y };
  },
};

export function endFrame() { keysPressed.clear(); pointer.clicked = false; pointer.consumed = false; }
export function consumeClick() { pointer.consumed = true; }

// ---------- immediate-mode UI ----------
export function hover(x, y, w, h) {
  return pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
}

// returns true on click. opts: {bg, fg, font, scale, icon, disabled, hoverGrow}
export function button(ctx, x, y, w, h, label, opts = {}) {
  const hov = hover(x, y, w, h) && !opts.disabled;
  const click = hov && pointer.clicked && !pointer.consumed;
  if (click) consumeClick();
  const grow = hov && opts.hoverGrow !== false ? 1.04 : 1;
  const dw = w * grow, dh = h * grow;
  const dx = x - (dw - w) / 2, dy = y - (dh - h) / 2;

  ctx.save();
  if (hov && !opts.disabled) { ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5; }
  const bg = opts.disabled ? '#2a2f44' : (opts.bg || (hov ? PALETTE.panel2 : PALETTE.panel));
  fillRoundRect(ctx, dx, dy, dw, dh, h * 0.28, bg);
  if (hov && !opts.disabled) { ctx.shadowBlur = 0; }
  // border
  strokeRoundRect(ctx, dx + 1, dy + 1, dw - 2, dh - 2, h * 0.28 - 1, 2, opts.border || 'rgba(255,255,255,0.08)');
  // top sheen
  ctx.globalAlpha = 0.10;
  fillRoundRect(ctx, dx + 2, dy + 2, dw - 4, dh * 0.45, h * 0.2, '#ffffff');
  ctx.globalAlpha = 1;

  if (label) {
    const fs = opts.scale || Math.floor(h * 0.42);
    pxTextCenter(ctx, label, x + w / 2, y + (h - 7 * fs) / 2, fs, opts.fg || (opts.disabled ? PALETTE.dim : PALETTE.ink));
  }
  ctx.restore();
  return click;
}

export function panel(ctx, x, y, w, h, opts = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, opts.bg1 || '#1c2440'); g.addColorStop(1, opts.bg2 || '#141a2e');
  fillRoundRect(ctx, x, y, w, h, opts.r || 18, g);
  ctx.shadowBlur = 0;
  strokeRoundRect(ctx, x + 1, y + 1, w - 2, h - 2, (opts.r || 18) - 1, 2, opts.border || 'rgba(255,255,255,0.10)');
  ctx.restore();
}

export function bar(ctx, x, y, w, h, ratio, color, bg = 'rgba(0,0,0,0.4)') {
  ratio = clamp(ratio, 0, 1);
  fillRoundRect(ctx, x, y, w, h, h / 2, bg);
  if (ratio > 0) {
    ctx.save();
    roundRect(ctx, x, y, w * ratio, h, h / 2); ctx.clip();
    fillRoundRect(ctx, x, y, w, h, h / 2, color);
    ctx.globalAlpha = 0.25; fillRoundRect(ctx, x, y, w * ratio, h * 0.5, h / 2, '#fff'); ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ---------- ai& logo ----------
// SVG string for HTML favicon / loading screen
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#7b5cff"/><stop offset="1" stop-color="#00e0c6"/></linearGradient></defs>
<rect x="6" y="6" width="116" height="116" rx="30" fill="url(#g)"/>
<rect x="6" y="6" width="116" height="116" rx="30" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="3"/>
<text x="64" y="86" font-family="monospace" font-weight="bold" font-size="58" text-anchor="middle" fill="#ffffff">ai</text>
<text x="64" y="86" font-family="monospace" font-weight="bold" font-size="58" text-anchor="middle" fill="#ffcf4d" dx="40">&amp;</text>
</svg>`;

export function drawLogo(ctx, x, y, size, t = 0) {
  const s = size;
  ctx.save();
  ctx.shadowColor = 'rgba(123,92,255,0.55)'; ctx.shadowBlur = 18 + Math.sin(t * 2) * 6;
  const g = ctx.createLinearGradient(x, y, x + s, y + s);
  g.addColorStop(0, '#7b5cff'); g.addColorStop(1, '#00e0c6');
  fillRoundRect(ctx, x, y, s, s, s * 0.24, g);
  ctx.shadowBlur = 0;
  strokeRoundRect(ctx, x + 1.5, y + 1.5, s - 3, s - 3, s * 0.24 - 1, 2.5, 'rgba(255,255,255,0.18)');
  // sheen
  ctx.globalAlpha = 0.12; fillRoundRect(ctx, x + s * 0.08, y + s * 0.08, s * 0.84, s * 0.4, s * 0.18, '#fff'); ctx.globalAlpha = 1;
  // text "ai&"
  const fs = Math.floor(s * 0.46);
  const wAi = pxText(ctx, 'ai', x + s * 0.5 - fs * 1.5, y + (s - 7 * fs) / 2, fs, '#ffffff');
  pxText(ctx, '&', x + s * 0.5 - fs * 1.5 + wAi + fs * 0.3, y + (s - 7 * fs) / 2, fs, '#ffcf4d');
  ctx.restore();
}
