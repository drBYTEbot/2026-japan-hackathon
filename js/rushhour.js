// rushhour.js — DESK JAM (Easy, 10 coins). Rush-hour-style sliding-desk puzzle.
import { clamp, lerp, PALETTE, Particles, pxText, pxTextCenter, TAU } from './util.js';
import { W, H, Input, pointer, button, panel, hover } from './ui.js';
import { drawCharacter, descriptor } from './characters.js';
import { Sfx } from './audio.js';

// 6x6 grid. Target car = the employee (horizontal, row 2), exits right.
// Pure puzzle data + solver (no canvas) so we can verify solvability in node.
const COLS = 6, ROWS = 6;
// car: {id, c, r, len, dir:'h'|'v', t:true}  t = target
export const PUZZLES = [
  { name: 'MONDAY', cars: [
    { id: 'X', c: 0, r: 2, len: 2, dir: 'h', t: true },
    { id: 'A', c: 0, r: 1, len: 2, dir: 'h' },
    { id: 'D', c: 2, r: 0, len: 3, dir: 'v' },
    { id: 'B', c: 4, r: 2, len: 3, dir: 'v' },
    { id: 'E', c: 2, r: 3, len: 2, dir: 'h' },
    { id: 'C', c: 2, r: 4, len: 2, dir: 'h' },
  ]},
  { name: 'DEADLINE', cars: [
    { id: 'X', c: 0, r: 2, len: 2, dir: 'h', t: true },
    { id: 'A', c: 1, r: 0, len: 3, dir: 'v' },
    { id: 'B', c: 3, r: 0, len: 2, dir: 'v' },
    { id: 'C', c: 5, r: 0, len: 3, dir: 'v' },
    { id: 'D', c: 2, r: 3, len: 2, dir: 'h' },
    { id: 'E', c: 0, r: 4, len: 3, dir: 'h' },
    { id: 'F', c: 4, r: 4, len: 2, dir: 'h' },
  ]},
];

function cellsOf(car) {
  const out = [];
  if (car.dir === 'h') for (let i = 0; i < car.len; i++) out.push([car.c + i, car.r]);
  else for (let i = 0; i < car.len; i++) out.push([car.c, car.r + i]);
  return out;
}
function keyOf(cars) { return cars.map(c => `${c.id}:${c.c},${c.r}`).join('|'); }
function occupiedSet(cars, exclude) {
  const s = new Set();
  for (const car of cars) { if (car.id === exclude) continue; for (const [c, r] of cellsOf(car)) s.add(c + ',' + r); }
  return s;
}
function slideRange(car, cars) {
  const occ = occupiedSet(cars, car.id);
  let lo = 0, hi = 0;
  if (car.dir === 'h') {
    for (let k = 1; car.c - k >= 0; k++) { if (occ.has((car.c - k) + ',' + car.r)) break; lo = -k; }
    const right = car.c + car.len - 1;
    for (let k = 1; right + k <= COLS - 1; k++) { if (occ.has((right + k) + ',' + car.r)) break; hi = k; }
  } else {
    for (let k = 1; car.r - k >= 0; k++) { if (occ.has(car.c + ',' + (car.r - k))) break; lo = -k; }
    const bot = car.r + car.len - 1;
    for (let k = 1; bot + k <= ROWS - 1; k++) { if (occ.has(car.c + ',' + (bot + k))) break; hi = k; }
  }
  return [lo, hi];
}
function isSolved(cars) {
  const x = cars.find(c => c.t);
  return x && x.c + x.len - 1 >= COLS - 1;
}
// BFS solver — returns true if target can reach the exit
export function solve(puzzle) {
  const start = puzzle.cars.map(c => ({ ...c }));
  if (isSolved(start)) return true;
  const seen = new Set([keyOf(start)]);
  const queue = [start];
  let guard = 200000;
  while (queue.length && guard-- > 0) {
    const cur = queue.shift();
    for (const car of cur) {
      const [lo, hi] = slideRange(car, cur);
      for (let k = lo; k <= hi; k++) {
        if (k === 0) continue;
        const next = cur.map(c => ({ ...c }));
        const idx = next.findIndex(c => c.id === car.id);
        if (car.dir === 'h') next[idx].c += k; else next[idx].r += k;
        if (isSolved(next)) return true;
        const key = keyOf(next);
        if (!seen.has(key)) { seen.add(key); queue.push(next); }
      }
    }
  }
  return false;
}

// ---------- scene ----------
const CELL = 60;
const BOARD_W = COLS * CELL, BOARD_H = ROWS * CELL;
const BX = (W - BOARD_W) / 2, BY = 96;
const EXIT_ROW = 2;
const TIME_LIMIT = 80;

export class RushHour {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this.parts = new Particles();
    this.done = false;
    this.desc = descriptor('DeskJamWorker');
  }
  onEnter() {
    this.puzzle = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
    this.cars = this.puzzle.cars.map(c => ({ ...c }));
    this.time = TIME_LIMIT;
    this.moves = 0;
    this.drag = null; // {car, axis, startC, startR, off, lo, hi, startPx}
    this.done = false;
    this.endTimer = 0;
    this.exitAnim = 0;
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    if (this.done) { this.endTimer += dt; this.parts.update(dt); if (this.exitAnim > 0) this.exitAnim += dt; return; }
    this.time -= dt;
    if (this.time <= 0) { this.time = 0; this.lose(); return; }

    // dragging
    if (pointer.clicked && !pointer.consumed) {
      const car = this.pickCar(pointer.x, pointer.y);
      if (car) {
        pointer.consumed = true;
        const [lo, hi] = slideRange(car, this.cars);
        this.drag = { car, lo, hi, off: 0, startC: car.c, startR: car.r, lastPx: this.axisPx(car) };
      }
    }
    if (this.drag && pointer.down) {
      const cur = this.axisPx(this.drag.car);
      let off = (cur - this.drag.lastPx) / CELL + this.drag.off;
      off = clamp(off, this.drag.lo, this.drag.hi);
      this.drag.off = off;
      this.drag.lastPx = cur;
    }
    if (this.drag && !pointer.down) {
      const snap = Math.round(this.drag.off);
      const clamped = clamp(snap, this.drag.lo, this.drag.hi);
      const car = this.cars.find(c => c.id === this.drag.car.id);
      if (car.dir === 'h') car.c = this.drag.startC + clamped; else car.r = this.drag.startR + clamped;
      if (clamped !== 0) { this.moves++; Sfx.step(); }
      // win check
      if (isSolved(this.cars)) { this.drag = null; this.win(); return; }
      this.drag = null;
    }
    this.parts.update(dt);
  }
  axisPx(car) { return car.dir === 'h' ? pointer.x : pointer.y; }
  pickCar(px, py) {
    for (const car of this.cars) {
      const [c, r] = [car.c, car.r];
      let x = BX + c * CELL, y = BY + r * CELL;
      let w = car.dir === 'h' ? car.len * CELL : CELL;
      let h = car.dir === 'h' ? CELL : car.len * CELL;
      if (this.drag && this.drag.car.id === car.id) {
        if (car.dir === 'h') x = BX + (this.drag.startC + this.drag.off) * CELL;
        else y = BY + (this.drag.startR + this.drag.off) * CELL;
      }
      if (px >= x && px <= x + w && py >= y && py <= y + h) return car;
    }
    return null;
  }
  win() {
    if (this.done) return;
    this.done = true; this.outcome = 'win'; this.exitAnim = 0.001;
    Sfx.win();
    const x = this.cars.find(c => c.t);
    for (let i = 0; i < 30; i++) this.parts.burst(BX + (x.c + 1) * CELL, BY + EXIT_ROW * CELL + CELL / 2, 1, { color: PALETTE.gold, speed: 160, life: 0.8, size: 4, up: 60 });
  }
  lose() { if (this.done) return; this.done = true; this.outcome = 'lose'; Sfx.lose(); }

  draw(ctx) {
    // backdrop
    ctx.fillStyle = '#0c1020'; ctx.fillRect(0, 0, W, H);
    this.drawOffice(ctx);

    // header
    pxTextCenter(ctx, 'DESK JAM', W / 2, 18, 4, PALETTE.ink);
    pxTextCenter(ctx, 'SLIDE DESKS · ESCAPE THE OFFICE · EASY +20', W / 2, 52, 2, PALETTE.dim);

    // board
    this.drawBoard(ctx);
    this.drawCars(ctx);
    this.parts.draw(ctx);

    // HUD: timer + moves
    this.drawHud(ctx);

    if (this.done) this.drawEnd(ctx);
  }
  drawOffice(ctx) {
    // subtle floor grid behind board
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#161d33'); g.addColorStop(1, '#0c1020');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  drawBoard(ctx) {
    ctx.save();
    // board frame (office floor)
    ctx.fillStyle = '#cfd6e6'; ctx.fillRect(BX - 8, BY - 8, BOARD_W + 16, BOARD_H + 16);
    ctx.fillStyle = '#e9edf7'; ctx.fillRect(BX, BY, BOARD_W, BOARD_H);
    // tiles
    ctx.strokeStyle = 'rgba(120,130,160,0.25)'; ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) { ctx.beginPath(); ctx.moveTo(BX + c * CELL, BY); ctx.lineTo(BX + c * CELL, BY + BOARD_H); ctx.stroke(); }
    for (let r = 1; r < ROWS; r++) { ctx.beginPath(); ctx.moveTo(BX, BY + r * CELL); ctx.lineTo(BX + BOARD_W, BY + r * CELL); ctx.stroke(); }
    // walls
    ctx.fillStyle = '#9aa3bd'; ctx.fillRect(BX - 8, BY - 8, BOARD_W + 16, 8);
    ctx.fillStyle = '#7f88a4'; ctx.fillRect(BX - 8, BY - 8, 8, BOARD_H + 16);
    ctx.fillRect(BX + BOARD_W, BY - 8, 8, BOARD_H + 16);
    ctx.fillRect(BX - 8, BY + BOARD_H, BOARD_W + 16, 8);
    // exit gap (right wall, row EXIT_ROW)
    const ex = BX + BOARD_W, ey = BY + EXIT_ROW * CELL;
    ctx.fillStyle = '#0c1020'; ctx.fillRect(ex, ey, 8, CELL);
    // exit arrow / door
    ctx.fillStyle = PALETTE.green;
    ctx.beginPath(); ctx.moveTo(ex + 22, ey + CELL / 2); ctx.lineTo(ex + 6, ey + 8); ctx.lineTo(ex + 6, ey + CELL - 8); ctx.closePath(); ctx.fill();
    pxText(ctx, 'EXIT', ex + 12, ey - 14, 2, PALETTE.green);
    ctx.restore();
  }
  drawCars(ctx) {
    // draw non-target first, target last
    const ordered = [...this.cars].sort((a, b) => (a.t ? 1 : 0) - (b.t ? 1 : 0));
    for (const car of ordered) this.drawCar(ctx, car);
  }
  drawCar(ctx, car) {
    let c = car.c, r = car.r;
    if (this.drag && this.drag.car.id === car.id) {
      if (car.dir === 'h') c = this.drag.startC + this.drag.off; else r = this.drag.startR + this.drag.off;
    }
    const x = BX + c * CELL + 4, y = BY + r * CELL + 4;
    const w = (car.dir === 'h' ? car.len * CELL : CELL) - 8;
    const h = (car.dir === 'h' ? CELL : car.len * CELL) - 8;
    ctx.save();
    // shadow
    ctx.globalAlpha = 0.25; ctx.fillStyle = '#000'; this.rr(ctx, x + 3, y + 4, w, h, 8); ctx.fill(); ctx.globalAlpha = 1;
    if (car.t) {
      // target = office character on a cart heading to exit
      ctx.fillStyle = '#3a4254'; this.rr(ctx, x, y + h - 10, w, 12, 4); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x + 8, y + h, 4, 0, TAU); ctx.arc(x + w - 8, y + h, 4, 0, TAU); ctx.fill();
      drawCharacter(ctx, x + w / 2, y - 6, 2, this.desc, { t: this.t, flip: false });
    } else {
      // desk
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#d8b072'); g.addColorStop(1, '#b8924e');
      ctx.fillStyle = g; this.rr(ctx, x, y, w, h, 8); ctx.fill();
      ctx.fillStyle = '#8a6a36'; ctx.fillRect(x, y + h - 6, w, 6);
      // monitor
      ctx.fillStyle = '#0e1320'; this.rr(ctx, x + 6, y + 4, 16, 12, 2); ctx.fill();
      ctx.fillStyle = '#39d2a0'; ctx.fillRect(x + 8, y + 6, 12, 8);
      // drawer lines
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
      if (car.dir === 'h') { for (let i = 1; i < car.len; i++) { ctx.beginPath(); ctx.moveTo(x + i * (CELL - 8) - 4, y + 4); ctx.lineTo(x + i * (CELL - 8) - 4, y + h - 4); ctx.stroke(); } }
    }
    ctx.restore();
  }
  drawHud(ctx) {
    const w = 200, h = 40, x = W - w - 16, y = 14;
    panel(ctx, x, y, w, h, {});
    const tr = this.time / TIME_LIMIT;
    const col = tr > 0.5 ? PALETTE.green : tr > 0.25 ? PALETTE.gold : PALETTE.red;
    pxText(ctx, 'TIME', x + 12, y + 8, 2, PALETTE.dim);
    const secs = Math.ceil(this.time);
    pxText(ctx, String(secs) + 's', x + 12, y + 20, 3, col);
    pxText(ctx, 'MOVES', x + 110, y + 8, 2, PALETTE.dim);
    pxText(ctx, String(this.moves), x + 110, y + 20, 3, PALETTE.ink);
    // restart
    if (button(ctx, 16, 14, 110, 36, 'RESTART', { scale: 2 })) { this.onEnter(); Sfx.click(); }
    if (button(ctx, 16, 56, 110, 28, 'QUIT', { scale: 2, fg: PALETTE.dim })) { this.app.exitGame('lose', 0); }
  }
  drawEnd(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(6,8,16,0.6)'; ctx.fillRect(0, 0, W, H);
    const win = this.outcome === 'win';
    const bw = 360, bh = 180, bx = W / 2 - bw / 2, by = H / 2 - bh / 2;
    panel(ctx, bx, by, bw, bh, { border: win ? PALETTE.gold : PALETTE.red });
    pxTextCenter(ctx, win ? 'YOU ESCAPED!' : "TIME'S UP", W / 2, by + 28, 5, win ? PALETTE.gold : PALETTE.red);
    pxTextCenter(ctx, win ? '+20 COINS' : 'NO COINS', W / 2, by + 78, 4, win ? PALETTE.green : PALETTE.dim);
    pxTextCenter(ctx, this.moves + ' moves', W / 2, by + 116, 2, PALETTE.dim);
    if (this.endTimer > 0.4 && button(ctx, W / 2 - 80, by + bh - 50, 160, 36, 'BACK TO OFFICE', { scale: 2 })) {
      this.app.exitGame(win ? 'win' : 'lose', win ? 20 : 0);
    }
    ctx.restore();
  }
  rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
}
