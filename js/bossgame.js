// bossgame.js — BEAT THE CEO (Boss, 20 coins). Three-phase finale.
// Phase 1: Crossy Road (cross 14 rows)
// Phase 2: Rush Hour (solve the desk puzzle)
// Phase 3: Solo boss fight vs David (CEO), no team
import { clamp, lerp, rand, randInt, choice, chance, TAU, PALETTE, Particles, pxText, pxTextCenter, addShake, fillRoundRect, strokeRoundRect } from './util.js';
import { W, H, Input, button, panel, bar, hover, pointer, consumeClick } from './ui.js';
import { drawCharacter, descriptor } from './characters.js';
import { Sfx } from './audio.js';

const CELL = 48;
const COLS = Math.ceil(W / CELL);
const GOAL_ROW = 14;

const PLAYER = {
  maxhp: 280, atk: 34, def: 18, spd: 14,
  special: { name: 'CODE BLAST', uses: 1, max: 1, pow: 336 },
  potions: 3,
};
const DAVID = {
  name: 'DAVID', maxhp: 650, atk: 42, def: 22, spd: 16,
};

export class BossGame {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this.parts = new Particles();
    this.floats = [];
    this.desc = descriptor('ArcAIdia-Hero');
    this.davidDesc = descriptor('David');
  }
  onEnter() {
    this.t = 0;
    this.phase = 'intro';
    this.timer = 1.6;
    this.subPhase = 1;
    this.done = false; this.endTimer = 0;
    this.floats = [];
    this.msg = 'FINAL BOSS — BEAT THE CEO';
    this.initCrossy();
  }

  // ================================================================
  // PHASE 1: CROSSY ROAD
  // ================================================================
  initCrossy() {
    this.crossyCol = Math.floor(COLS / 2);
    this.crossyRow = 0;
    this.crossyVCol = this.crossyCol;
    this.crossyVRow = this.crossyRow;
    this.crossyHop = null;
    this.crossyLanes = new Map();
    this.crossyCamRow = -6;
    this.crossyDead = false;
    this.crossyWon = false;
    this.crossyFarthest = 0;
    this.ensureCrossyLanes();
  }
  crossyLaneType(r) {
    if (r < 2) return 'grass';
    if (r >= GOAL_ROW - 1) return 'grass';
    const hash = ((r * 9301 + 49297) % 233280) / 233280;
    const prev = this.crossyLanes.get(r - 1);
    const prev2 = this.crossyLanes.get(r - 2);
    const prevRoad = prev && prev.type === 'road';
    const prev2Road = prev2 && prev2.type === 'road';
    let road = hash < 0.6;
    if (prevRoad && prev2Road) road = false;
    return road ? 'road' : 'grass';
  }
  ensureCrossyLanes() {
    const top = Math.ceil(this.crossyCamRow) + 14;
    for (let r = Math.floor(this.crossyCamRow) - 2; r <= top; r++) {
      if (r < 0 || r > GOAL_ROW) continue;
      if (!this.crossyLanes.has(r)) this.makeCrossyLane(r);
    }
  }
  makeCrossyLane(r) {
    const type = this.crossyLaneType(r);
    if (type === 'grass') {
      const trees = new Set();
      if (r > 0 && r < GOAL_ROW - 1) { const n = randInt(0, 3); for (let i = 0; i < n; i++) trees.add(randInt(0, COLS - 1)); }
      this.crossyLanes.set(r, { type, trees, cars: [] });
    } else {
      this.crossyLanes.set(r, {
        type, dir: chance(0.5) ? 1 : -1,
        speed: rand(2.5, 4.8),
        interval: rand(1.4, 2.8),
        timer: rand(0, 2),
        cars: [],
      });
    }
  }
  updateCrossy(dt) {
    const targetCam = Math.max(this.crossyVRow - 6, this.crossyCamRow);
    this.crossyCamRow = lerp(this.crossyCamRow, targetCam, 1 - Math.pow(0.001, dt));
    if (this.crossyVRow < this.crossyCamRow - 1.2) { this.crossyDead = true; this.failPhase(); return; }

    for (const [r, lane] of this.crossyLanes) {
      if (lane.type !== 'road') continue;
      if (r < Math.floor(this.crossyCamRow) - 1 || r > Math.ceil(this.crossyCamRow) + 14) continue;
      lane.timer -= dt;
      if (lane.timer <= 0) {
        lane.timer = lane.interval;
        lane.cars.push({ x: lane.dir > 0 ? -2 : COLS + 1, dir: lane.dir, speed: lane.speed, len: choice([1, 1, 2]), color: choice(['#e25c5c', '#5db8ff', '#43d17a', '#ffd23f', '#b07bff']) });
      }
      for (const c of lane.cars) c.x += c.dir * lane.speed * dt;
      lane.cars = lane.cars.filter(c => c.x > -4 && c.x < COLS + 4);
    }

    if (!this.crossyHop && !this.crossyDead && !this.crossyWon) {
      let dc = 0, dr = 0;
      if (Input.pressed('arrowup') || Input.pressed('w')) dr = 1;
      else if (Input.pressed('arrowdown') || Input.pressed('s')) dr = -1;
      else if (Input.pressed('arrowleft') || Input.pressed('a')) dc = -1;
      else if (Input.pressed('arrowright') || Input.pressed('d')) dc = 1;
      if (dc || dr) this.crossyHopTry(dc, dr);
    }
    if (this.crossyHop) {
      this.crossyHop.t += dt / 0.13;
      if (this.crossyHop.t >= 1) {
        this.crossyHop = null;
        this.crossyVCol = this.crossyCol; this.crossyVRow = this.crossyRow;
        if (this.crossyRow > this.crossyFarthest) { this.crossyFarthest = this.crossyRow; Sfx.step(); }
        if (this.crossyRow >= GOAL_ROW) { this.crossyWon = true; this.phase = 'checkpoint'; this.timer = 1.6; this.msg = 'CHECKPOINT! Phase 2 — Escape the office'; Sfx.win(); return; }
      }
    }
    // collision
    const checkRow = Math.round(this.crossyVRow);
    const lane = this.crossyLanes.get(checkRow);
    if (lane && lane.type === 'road') {
      const pc = this.crossyVCol + 0.5;
      for (const c of lane.cars) if (pc > c.x - 0.1 && pc < c.x + c.len + 0.1) { this.crossyDead = true; this.failPhase(); return; }
    }
    if (this.crossyHop) {
      const mr = Math.round(lerp(this.crossyHop.fromR, this.crossyHop.toR, this.crossyHop.t));
      const ml = this.crossyLanes.get(mr);
      const mc = lerp(this.crossyHop.fromC, this.crossyHop.toC, this.crossyHop.t) + 0.5;
      if (ml && ml.type === 'road') for (const c of ml.cars) if (mc > c.x - 0.1 && mc < c.x + c.len + 0.1) { this.crossyDead = true; this.failPhase(); return; }
    }
    this.ensureCrossyLanes();
  }
  crossyHopTry(dc, dr) {
    const nc = this.crossyCol + dc, nr = this.crossyRow + dr;
    if (nr < 0 || nc < 0 || nc >= COLS) return;
    const lane = this.crossyLanes.get(nr) || (this.makeCrossyLane(nr), this.crossyLanes.get(nr));
    if (lane.type === 'grass' && lane.trees && lane.trees.has(nc)) { Sfx.deny(); return; }
    this.crossyHop = { fromC: this.crossyVCol, fromR: this.crossyVRow, toC: nc, toR: nr, t: 0 };
    this.crossyCol = nc; this.crossyRow = nr;
  }
  crossyScreenX(col) { return col * CELL + CELL / 2; }
  crossyScreenY(row) { return H - 90 - (row - this.crossyCamRow) * CELL; }
  drawCrossy(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a2342'); g.addColorStop(1, '#0c1020');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r0 = Math.floor(this.crossyCamRow) - 1, r1 = Math.ceil(this.crossyCamRow) + 14;
    for (let r = r0; r <= r1; r++) {
      const lane = this.crossyLanes.get(r);
      const y = this.crossyScreenY(r) - CELL / 2;
      if (lane) this.drawCrossyLane(ctx, lane, r, y);
    }
    // finish
    const fy = this.crossyScreenY(GOAL_ROW);
    if (fy > -CELL && fy < H + CELL) {
      ctx.fillStyle = 'rgba(255,207,77,0.25)'; ctx.fillRect(0, fy - CELL / 2, W, CELL);
      pxTextCenter(ctx, 'CHECKPOINT', W / 2, fy - 8, 4, PALETTE.gold);
    }
    this.drawCrossyPlayer(ctx);
    this.parts.draw(ctx);
    // HUD
    panel(ctx, W - 200, 14, 184, 38, {});
    pxText(ctx, 'PHASE 1/3', W - 190, 22, 2, PALETTE.gold);
    pxText(ctx, this.crossyFarthest + '/' + GOAL_ROW, W - 190, 36, 2, PALETTE.ink);
    if (button(ctx, 16, 14, 100, 32, 'QUIT', { scale: 2, fg: PALETTE.dim })) { this.app.exitGame('lose', 0); }
  }
  drawCrossyLane(ctx, lane, r, y) {
    if (lane.type === 'grass') {
      ctx.fillStyle = (r % 2 === 0) ? '#2e8c5a' : '#339a63'; ctx.fillRect(0, y, W, CELL);
      for (const tc of lane.trees) {
        ctx.fillStyle = '#5a3a22'; ctx.fillRect(tc * CELL + CELL / 2 - 3, y, 6, CELL / 2 - 6);
        ctx.fillStyle = '#1f6b3a'; ctx.beginPath(); ctx.arc(tc * CELL + CELL / 2, y - 2, CELL / 3, 0, TAU); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#3a3f4e'; ctx.fillRect(0, y, W, CELL);
      ctx.fillStyle = 'rgba(255,210,90,0.5)';
      for (let x = 0; x < W; x += 36) ctx.fillRect(x, y + CELL / 2 - 2, 18, 4);
      for (const c of lane.cars) {
        const x = c.x * CELL, w = c.len * CELL - 8, h = CELL - 14;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 3, y + 12, w, h);
        ctx.fillStyle = c.color; ctx.fillRect(x, y + 8, w, h);
        ctx.fillStyle = '#bfe6ff'; ctx.fillRect(c.dir > 0 ? x + w - 14 : x + 4, y + 12, 9, h - 8);
      }
    }
  }
  drawCrossyPlayer(ctx) {
    let col = this.crossyVCol, row = this.crossyVRow, hopZ = 0, squish = 0;
    if (this.crossyHop) {
      const t = clamp(this.crossyHop.t, 0, 1);
      col = lerp(this.crossyHop.fromC, this.crossyHop.toC, t);
      row = lerp(this.crossyHop.fromR, this.crossyHop.toR, t);
      hopZ = Math.sin(t * Math.PI) * 16; squish = Math.sin(t * Math.PI) * 0.15;
    }
    const x = this.crossyScreenX(col), y = this.crossyScreenY(row) - hopZ;
    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, this.crossyScreenY(row) + 2, 12, 5, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.save();
    ctx.translate(x, y + 2 * squish); ctx.scale(1 + squish, 1 - squish); ctx.translate(-x, -(y + 2 * squish));
    drawCharacter(ctx, x, y - 40, 2, this.desc, { t: this.t });
    ctx.restore();
  }

  // ================================================================
  // PHASE 2: RUSH HOUR
  // ================================================================
  initRush() {
    const PUZZLE = {
      cars: [
        { id: 'X', c: 0, r: 2, len: 2, dir: 'h', t: true },
        { id: 'A', c: 1, r: 0, len: 3, dir: 'v' },
        { id: 'B', c: 3, r: 0, len: 2, dir: 'v' },
        { id: 'C', c: 5, r: 0, len: 3, dir: 'v' },
        { id: 'D', c: 2, r: 3, len: 2, dir: 'h' },
        { id: 'E', c: 0, r: 4, len: 3, dir: 'h' },
        { id: 'F', c: 4, r: 4, len: 2, dir: 'h' },
      ]
    };
    this.rushCars = PUZZLE.cars.map(c => ({ ...c }));
    this.rushMoves = 0;
    this.rushDrag = null;
    this.rushWon = false;
    this.rushTime = 90;
    this.rushDone = false;
  }
  rushCellsOf(car) {
    const out = [];
    if (car.dir === 'h') for (let i = 0; i < car.len; i++) out.push([car.c + i, car.r]);
    else for (let i = 0; i < car.len; i++) out.push([car.c, car.r + i]);
    return out;
  }
  rushOccupied(exclude) {
    const s = new Set();
    for (const car of this.rushCars) { if (car.id === exclude) continue; for (const [c, r] of this.rushCellsOf(car)) s.add(c + ',' + r); }
    return s;
  }
  rushSlideRange(car) {
    const occ = this.rushOccupied(car.id);
    let lo = 0, hi = 0;
    if (car.dir === 'h') {
      for (let k = 1; car.c - k >= 0; k++) { if (occ.has((car.c - k) + ',' + car.r)) break; lo = -k; }
      const right = car.c + car.len - 1;
      for (let k = 1; right + k <= 5; k++) { if (occ.has((right + k) + ',' + car.r)) break; hi = k; }
    } else {
      for (let k = 1; car.r - k >= 0; k++) { if (occ.has(car.c + ',' + (car.r - k))) break; lo = -k; }
      const bot = car.r + car.len - 1;
      for (let k = 1; bot + k <= 5; k++) { if (occ.has(car.c + ',' + (bot + k))) break; hi = k; }
    }
    return [lo, hi];
  }
  rushSolved() { const x = this.rushCars.find(c => c.t); return x && x.c + x.len - 1 >= 5; }
  updateRush(dt) {
    if (this.rushDone) return;
    this.rushTime -= dt;
    if (this.rushTime <= 0) { this.rushTime = 0; this.failPhase(); return; }
    const RCELL = 56, RBX = (W - 6 * RCELL) / 2, RBY = 96;
    if (pointer.clicked && !pointer.consumed) {
      const car = this.rushPick(pointer.x, pointer.y, RCELL, RBX, RBY);
      if (car) {
        pointer.consumed = true;
        const [lo, hi] = this.rushSlideRange(car);
        this.rushDrag = { car, lo, hi, off: 0, startC: car.c, startR: car.r, startPx: car.dir === 'h' ? pointer.x : pointer.y };
      }
    }
    if (this.rushDrag && pointer.down) {
      const cur = this.rushDrag.car.dir === 'h' ? pointer.x : pointer.y;
      let off = (cur - this.rushDrag.startPx) / RCELL;
      off = clamp(off, this.rushDrag.lo, this.rushDrag.hi);
      this.rushDrag.off = off;
    }
    if (this.rushDrag && !pointer.down) {
      const snap = Math.round(this.rushDrag.off);
      const clamped = clamp(snap, this.rushDrag.lo, this.rushDrag.hi);
      const car = this.rushCars.find(c => c.id === this.rushDrag.car.id);
      if (car.dir === 'h') car.c = this.rushDrag.startC + clamped; else car.r = this.rushDrag.startR + clamped;
      if (clamped !== 0) { this.rushMoves++; Sfx.step(); }
      if (this.rushSolved()) { this.rushWon = true; this.rushDone = true; this.phase = 'checkpoint'; this.timer = 1.6; this.msg = 'CHECKPOINT! Phase 3 — Fight the CEO'; Sfx.win(); return; }
      this.rushDrag = null;
    }
  }
  rushPick(px, py, RCELL, RBX, RBY) {
    for (const car of this.rushCars) {
      let c = car.c, r = car.r;
      if (this.rushDrag && this.rushDrag.car.id === car.id) {
        if (car.dir === 'h') c = this.rushDrag.startC + this.rushDrag.off; else r = this.rushDrag.startR + this.rushDrag.off;
      }
      const x = RBX + c * RCELL + 4, y = RBY + r * RCELL + 4;
      const w = (car.dir === 'h' ? car.len * RCELL : RCELL) - 8;
      const h = (car.dir === 'h' ? RCELL : car.len * RCELL) - 8;
      if (px >= x && px <= x + w && py >= y && py <= y + h) return car;
    }
    return null;
  }
  drawRush(ctx) {
    ctx.fillStyle = '#0c1020'; ctx.fillRect(0, 0, W, H);
    pxTextCenter(ctx, 'PHASE 2: ESCAPE THE OFFICE', W / 2, 18, 3, PALETTE.ink);
    const RCELL = 56, RBX = (W - 6 * RCELL) / 2, RBY = 96;
    const BW = 6 * RCELL;
    // board
    ctx.fillStyle = '#e9edf7'; ctx.fillRect(RBX - 8, RBY - 8, BW + 16, BW + 16);
    ctx.fillStyle = '#cfd6e6'; ctx.fillRect(RBX, RBY, BW, BW);
    ctx.strokeStyle = 'rgba(120,130,160,0.25)'; ctx.lineWidth = 1;
    for (let c = 1; c < 6; c++) { ctx.beginPath(); ctx.moveTo(RBX + c * RCELL, RBY); ctx.lineTo(RBX + c * RCELL, RBY + BW); ctx.stroke(); }
    for (let r = 1; r < 6; r++) { ctx.beginPath(); ctx.moveTo(RBX, RBY + r * RCELL); ctx.lineTo(RBX + BW, RBY + r * RCELL); ctx.stroke(); }
    ctx.fillStyle = '#9aa3bd'; ctx.fillRect(RBX - 8, RBY - 8, BW + 16, 8);
    ctx.fillStyle = '#7f88a4'; ctx.fillRect(RBX - 8, RBY - 8, 8, BW + 16);
    ctx.fillRect(RBX + BW, RBY - 8, 8, BW + 16);
    ctx.fillRect(RBX - 8, RBY + BW, BW + 16, 8);
    // exit
    const ex = RBX + BW, ey = RBY + 2 * RCELL;
    ctx.fillStyle = '#0c1020'; ctx.fillRect(ex, ey, 8, RCELL);
    ctx.fillStyle = PALETTE.green;
    ctx.beginPath(); ctx.moveTo(ex + 22, ey + RCELL / 2); ctx.lineTo(ex + 6, ey + 8); ctx.lineTo(ex + 6, ey + RCELL - 8); ctx.closePath(); ctx.fill();
    pxText(ctx, 'EXIT', ex + 12, ey - 14, 2, PALETTE.green);
    // cars/desks
    for (const car of this.rushCars) {
      let c = car.c, r = car.r;
      if (this.rushDrag && this.rushDrag.car.id === car.id) {
        if (car.dir === 'h') c = this.rushDrag.startC + this.rushDrag.off; else r = this.rushDrag.startR + this.rushDrag.off;
      }
      const x = RBX + c * RCELL + 4, y = RBY + r * RCELL + 4;
      const w = (car.dir === 'h' ? car.len * RCELL : RCELL) - 8;
      const h = (car.dir === 'h' ? RCELL : car.len * RCELL) - 8;
      if (car.t) {
        ctx.fillStyle = '#3a4254'; ctx.fillRect(x, y + h - 10, w, 12);
        drawCharacter(ctx, x + w / 2, y - 6, 2, this.desc, { t: this.t });
      } else {
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, '#d8b072'); g.addColorStop(1, '#b8924e');
        ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#8a6a36'; ctx.fillRect(x, y + h - 6, w, 6);
        ctx.fillStyle = '#0e1320'; ctx.fillRect(x + 6, y + 4, 16, 12);
        ctx.fillStyle = '#39d2a0'; ctx.fillRect(x + 8, y + 6, 12, 8);
      }
    }
    // HUD
    panel(ctx, W - 200, 14, 184, 38, {});
    pxText(ctx, 'TIME', W - 190, 22, 2, PALETTE.dim);
    pxText(ctx, Math.ceil(this.rushTime) + 's', W - 190, 36, 2, this.rushTime < 20 ? PALETTE.red : PALETTE.ink);
    pxText(ctx, 'MOVES: ' + this.rushMoves, W - 120, 30, 2, PALETTE.ink);
    if (button(ctx, 16, 14, 100, 32, 'QUIT', { scale: 2, fg: PALETTE.dim })) { this.app.exitGame('lose', 0); }
  }

  // ================================================================
  // PHASE 3: SOLO BOSS FIGHT
  // ================================================================
  initFight() {
    this.player = {
      name: 'YOU', desc: this.desc,
      maxhp: PLAYER.maxhp, hp: PLAYER.maxhp,
      atk: PLAYER.atk, def: PLAYER.def, spd: PLAYER.spd,
      special: { ...PLAYER.special },
      potions: PLAYER.potions,
      defending: false, dead: false, flash: 0, x: W * 0.35, y: 300,
    };
    this.boss = {
      name: 'DAVID', desc: this.davidDesc,
      maxhp: DAVID.maxhp, hp: DAVID.maxhp,
      atk: DAVID.atk, def: DAVID.def, spd: DAVID.spd,
      dead: false, flash: 0, x: W * 0.65, y: 220, bob: 0,
      turnCount: 0,
    };
    this.fightPhase = 'menu';
    this.fightCursor = 0;
    this.fightTimer = 0;
    this.fightMsg = 'DAVID: "So you think you can challenge me?"';
    this.fightAnim = null;
    this.fightActor = null;
    this.fightApply = null;
    this.fightDone = false;
  }
  updateFight(dt) {
    if (this.fightDone) { this.endTimer += dt; this.parts.update(dt); return; }
    this.boss.flash = Math.max(0, this.boss.flash - dt * 4);
    this.player.flash = Math.max(0, this.player.flash - dt * 4);
    this.boss.bob = Math.sin(this.t * 2) * 6;

    if (this.fightPhase === 'menu') {
      if (Input.pressed('arrowleft') || Input.pressed('a')) { this.fightCursor = (this.fightCursor + 3) % 4; Sfx.hover(); }
      if (Input.pressed('arrowright') || Input.pressed('d')) { this.fightCursor = (this.fightCursor + 1) % 4; Sfx.hover(); }
      if (Input.pressed('arrowup') || Input.pressed('w')) { this.fightCursor = (this.fightCursor + 2) % 4; Sfx.hover(); }
      if (Input.pressed('arrowdown') || Input.pressed('s')) { this.fightCursor = (this.fightCursor + 2) % 4; Sfx.hover(); }
      if (Input.pressed('enter') || Input.pressed(' ')) this.fightChoose(this.fightCursor);
    }
    if (this.fightPhase === 'enemy') {
      this.fightTimer -= dt;
      if (this.fightTimer <= 0) this.doBossAction();
    }
    if (this.fightPhase === 'anim') {
      this.fightTimer -= dt;
      if (this.fightTimer <= 0) this.fightAfterAction();
    }
  }
  fightCommands() {
    const p = this.player;
    return [
      { label: 'ATTACK', run: () => this.fightActAttack() },
      { label: 'SPECIAL', sub: `${p.special.uses}/${p.special.max}`, disabled: p.special.uses <= 0, run: () => this.fightActSpecial() },
      { label: 'DEFEND', run: () => this.fightActDefend() },
      { label: `ITEM x${p.potions}`, disabled: p.potions <= 0, run: () => this.fightActItem() },
    ];
  }
  fightChoose(i) {
    const c = this.fightCommands()[i];
    if (c.disabled) { Sfx.deny(); return; }
    Sfx.click();
    c.run();
  }
  fightActAttack() { this.fightStartAnim(this.player, () => this.fightDamage(this.player, this.boss, randInt(this.player.atk - 4, this.player.atk + 4), false), 'You attack!'); }
  fightActSpecial() { this.player.special.uses--; this.fightStartAnim(this.player, () => this.fightDamage(this.player, this.boss, this.player.special.pow + randInt(-6, 6), true), `CODE BLAST!`); Sfx.heal(); }
  fightActDefend() { this.player.defending = true; this.fightStartAnim(this.player, null, 'You brace for impact!'); }
  fightActItem() { this.player.potions--; const heal = randInt(60, 80); this.player.hp = clamp(this.player.hp + heal, 0, this.player.maxhp); this.floats.push({ x: this.player.x, y: this.player.y - 30, val: '+' + heal, color: PALETTE.green, life: 1.2 }); this.parts.burst(this.player.x, this.player.y - 20, 16, { color: PALETTE.green, speed: 90, life: 0.7 }); Sfx.heal(); this.fightMsg = `Coffee! +${heal} HP`; this.fightStartAnim(this.player, null, this.fightMsg); }
  fightStartAnim(actor, applyFn, msg) {
    this.fightPhase = 'anim';
    this.fightTimer = applyFn ? 0.6 : 0.5;
    this.fightMsg = msg || '';
    this.fightApply = applyFn;
    this.fightActor = actor;
    if (applyFn) setTimeout(() => { if (this.fightApply === applyFn) { this.fightApply(); this.fightApply = null; } }, 250);
  }
  fightAfterAction() {
    if (this.boss.dead) { this.fightDone = true; this.done = true; this.outcome = 'win'; this.endTimer = 0; Sfx.win(); for (let i = 0; i < 40; i++) this.parts.burst(this.boss.x, this.boss.y, 1, { color: PALETTE.gold, speed: 200, life: 1, size: 4 }); return; }
    if (this.player.dead) { this.fightDone = true; this.done = true; this.outcome = 'lose'; this.endTimer = 0; Sfx.lose(); return; }
    // toggle turn
    if (this.fightActor === this.player) { this.fightPhase = 'enemy'; this.fightTimer = 0.7; }
    else { this.fightPhase = 'menu'; this.fightCursor = 0; }
  }
  doBossAction() {
    const b = this.boss;
    b.turnCount++;
    if (b.turnCount % 3 === 0) {
      // LAYOFF special
      this.fightPhase = 'anim'; this.fightTimer = 0.8; this.fightMsg = 'DAVID uses LAYOFF!';
      this.fightApply = () => this.fightDamage(b, this.player, randInt(55, 70), true);
      this.fightActor = b;
      setTimeout(() => { if (this.fightApply) { this.fightApply(); this.fightApply = null; } }, 300);
    } else {
      this.fightPhase = 'anim'; this.fightTimer = 0.6; this.fightMsg = 'DAVID attacks!';
      this.fightApply = () => this.fightDamage(b, this.player, randInt(b.atk - 4, b.atk + 4), false);
      this.fightActor = b;
      setTimeout(() => { if (this.fightApply) { this.fightApply(); this.fightApply = null; } }, 250);
    }
  }
  fightDamage(attacker, target, base, special) {
    let dmg = Math.max(1, base - Math.floor(target.def / 2));
    if (target.defending) { dmg = Math.floor(dmg / 2); target.defending = false; }
    dmg = Math.max(1, dmg + randInt(-2, 2));
    target.hp = clamp(target.hp - dmg, 0, target.maxhp);
    target.flash = 1;
    addShake(special ? 8 : 5, 0.25);
    Sfx.attack(); Sfx.hit();
    this.floats.push({ x: target.x, y: target.y - 20, val: String(dmg), color: special ? PALETTE.gold : '#fff', life: 1.1 });
    this.parts.burst(target.x, target.y - 10, special ? 18 : 10, { color: special ? PALETTE.gold : '#ff8a8a', speed: 140, life: 0.6, size: 3 });
    if (target.hp <= 0) { target.dead = true; this.fightMsg = `${target.name} is DOWN!`; this.parts.burst(target.x, target.y - 10, 24, { color: '#888', speed: 120, life: 0.8 }); }
  }
  drawFight(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a0a14'); g.addColorStop(1, '#05060d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(160,80,80,0.08)'; ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,80,80,0.08)'; ctx.fillRect(0, 280, W, 3);

    // boss
    if (!this.boss.dead) {
      const bx = this.boss.x, by = this.boss.y + this.boss.bob;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(bx, by + 50, 50, 12, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = this.boss.flash > 0 ? (0.4 + Math.sin(this.t * 40) * 0.6) : 1;
      // boss is drawn larger
      drawCharacter(ctx, bx, by - 30, 5, this.davidDesc, { t: this.t, face: 'fight' });
      ctx.restore();
      // "CEO" crown
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.moveTo(bx - 20, by - 80); ctx.lineTo(bx - 16, by - 90); ctx.lineTo(bx - 8, by - 84);
      ctx.lineTo(bx, by - 92); ctx.lineTo(bx + 8, by - 84); ctx.lineTo(bx + 16, by - 90); ctx.lineTo(bx + 20, by - 80);
      ctx.closePath(); ctx.fill();
    }
    // player
    if (!this.player.dead) {
      const px2 = this.player.x, py = this.player.y;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(px2, py + 8, 14, 5, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = this.player.flash > 0 ? (0.5 + Math.sin(this.t * 40) * 0.5) : 1;
      let dx = 0;
      if (this.fightActor === this.player && this.fightPhase === 'anim') dx = 16;
      ctx.translate(dx, 0);
      drawCharacter(ctx, px2, py - 44, 3, this.desc, { t: this.t, face: 'fight' });
      ctx.restore();
    }
    this.parts.draw(ctx);
    for (const f of this.floats) { ctx.globalAlpha = clamp(f.life, 0, 1); pxTextCenter(ctx, f.val, f.x, f.y, 3, f.color); ctx.globalAlpha = 1; }

    // boss HP bar (top)
    panel(ctx, 16, 14, 400, 52, {});
    pxText(ctx, 'DAVID — CEO', 30, 22, 3, PALETTE.red);
    pxText(ctx, 'PHASE 3/3', 280, 22, 2, PALETTE.gold);
    bar(ctx, 30, 44, 370, 10, this.boss.hp / this.boss.maxhp, this.boss.hp / this.boss.maxhp > 0.4 ? PALETTE.red : '#ff3030');
    // player HP (right)
    panel(ctx, W - 260, 14, 244, 52, {});
    pxText(ctx, 'YOU', W - 250, 22, 3, PALETTE.green);
    bar(ctx, W - 160, 30, 130, 10, this.player.hp / this.player.maxhp, this.player.dead ? '#444' : PALETTE.green);
    pxText(ctx, Math.ceil(this.player.hp) + '/' + this.player.maxhp, W - 160, 44, 1, PALETTE.dim);
    if (this.player.special.uses > 0) pxText(ctx, 'SP ' + this.player.special.uses, W - 250, 44, 2, PALETTE.blue);
    if (this.player.potions > 0) pxText(ctx, 'POT ' + this.player.potions, W - 200, 44, 2, PALETTE.gold);

    // message
    panel(ctx, 16, H - 150, W - 32, 44, {});
    pxText(ctx, this.fightMsg || '', 28, H - 136, 2, PALETTE.ink);

    // command menu
    if (this.fightPhase === 'menu' && !this.fightDone) {
      const cmds = this.fightCommands();
      const bw = 150, bh = 44, bx = W / 2 - bw, by = H - 96;
      panel(ctx, bx - 8, by - 8, bw * 2 + 8, bh * 2 + 16, { border: PALETTE.gold });
      for (let i = 0; i < cmds.length; i++) {
        const cx = bx + (i % 2) * bw, cy = by + Math.floor(i / 2) * bh;
        if (button(ctx, cx, cy, bw - 8, bh - 6, cmds[i].label, { scale: 2, bg: i === this.fightCursor ? PALETTE.panel2 : PALETTE.panel, border: i === this.fightCursor ? PALETTE.gold : 'rgba(255,255,255,0.08)', fg: cmds[i].disabled ? PALETTE.dim : PALETTE.ink })) {
          this.fightChoose(i);
        }
        if (cmds[i].sub) pxText(ctx, cmds[i].sub, cx + bw - 48, cy + 8, 2, PALETTE.dim);
      }
    }
  }

  // ================================================================
  // COMMON: phase transitions, update, draw
  // ================================================================
  failPhase() {
    // restart current phase
    if (this.subPhase === 1) { this.initCrossy(); }
    else if (this.subPhase === 2) { this.initRush(); }
    else if (this.subPhase === 3) { this.initFight(); }
    this.phase = 'fail'; this.timer = 1.4;
    this.msg = this.subPhase === 1 ? 'FAILED! Retry Phase 1...' : this.subPhase === 2 ? 'FAILED! Retry Phase 2...' : 'DEFEATED! Retry Phase 3...';
    Sfx.lose();
  }
  nextPhase() {
    if (this.subPhase === 1) { this.subPhase = 2; this.initRush(); this.phase = 'intro2'; this.timer = 1.4; this.msg = 'PHASE 2: ESCAPE THE OFFICE'; }
    else if (this.subPhase === 2) { this.subPhase = 3; this.initFight(); this.phase = 'intro3'; this.timer = 1.4; this.msg = 'PHASE 3: FIGHT THE CEO'; }
  }
  update(dt) {
    this.t += dt;
    this.parts.update(dt);
    for (let i = this.floats.length - 1; i >= 0; i--) { const f = this.floats[i]; f.life -= dt; f.y -= 30 * dt; if (f.life <= 0) this.floats.splice(i, 1); }

    if (this.done) { this.endTimer += dt; return; }

    if (this.phase === 'intro') { this.timer -= dt; if (this.timer <= 0) { this.phase = 'crossy'; } return; }
    if (this.phase === 'intro2' || this.phase === 'intro3') { this.timer -= dt; if (this.timer <= 0) { this.phase = this.subPhase === 2 ? 'rush' : 'fight'; } return; }
    if (this.phase === 'fail') { this.timer -= dt; if (this.timer <= 0) { this.phase = this.subPhase === 1 ? 'crossy' : (this.subPhase === 2 ? 'rush' : 'fight'); } return; }
    if (this.phase === 'checkpoint') { this.timer -= dt; if (this.timer <= 0) this.nextPhase(); return; }

    if (this.phase === 'crossy') this.updateCrossy(dt);
    else if (this.phase === 'rush') this.updateRush(dt);
    else if (this.phase === 'fight') this.updateFight(dt);
  }
  draw(ctx) {
    if (this.phase === 'intro' || this.phase === 'intro2' || this.phase === 'intro3' || this.phase === 'fail' || this.phase === 'checkpoint') {
      // draw current phase behind the overlay
      if (this.subPhase === 1) this.drawCrossy(ctx);
      else if (this.subPhase === 2) this.drawRush(ctx);
      else if (this.subPhase === 3) this.drawFight(ctx);
      // overlay
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, W, H);
      const k = clamp(this.timer / 1.4, 0, 1);
      ctx.globalAlpha = k < 0.3 ? k / 0.3 : 1;
      pxTextCenter(ctx, this.msg, W / 2, H / 2 - 12, 4, this.phase === 'fail' ? PALETTE.red : (this.phase === 'checkpoint' ? PALETTE.gold : PALETTE.ink));
      if (this.phase === 'checkpoint') pxTextCenter(ctx, 'PHASE ' + this.subPhase + ' COMPLETE', W / 2, H / 2 + 24, 2, PALETTE.green);
      ctx.globalAlpha = 1;
      return;
    }
    if (this.done) {
      if (this.subPhase === 3) this.drawFight(ctx);
      else this.drawCrossy(ctx);
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
      const win = this.outcome === 'win';
      const bw = 380, bh = 200, bx = W / 2 - bw / 2, by = H / 2 - bh / 2;
      panel(ctx, bx, by, bw, bh, { border: win ? PALETTE.gold : PALETTE.red });
      pxTextCenter(ctx, win ? 'CEO DEFEATED!' : 'YOU WERE DEFEATED', W / 2, by + 30, 4, win ? PALETTE.gold : PALETTE.red);
      pxTextCenter(ctx, win ? 'You beat the final boss!' : 'David was too strong...', W / 2, by + 84, 2, PALETTE.dim);
      pxTextCenter(ctx, win ? '+20 COINS' : 'NO COINS', W / 2, by + 112, 4, win ? PALETTE.green : PALETTE.dim);
      if (this.endTimer > 0.4 && button(ctx, W / 2 - 90, by + bh - 52, 180, 38, 'BACK TO OFFICE', { scale: 2 })) {
        this.app.exitGame(win ? 'win' : 'lose', win ? 20 : 0);
      }
      return;
    }
    if (this.phase === 'crossy') this.drawCrossy(ctx);
    else if (this.phase === 'rush') this.drawRush(ctx);
    else if (this.phase === 'fight') this.drawFight(ctx);
  }
}
