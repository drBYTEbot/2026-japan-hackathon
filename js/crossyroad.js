// crossyroad.js — CROSSWALK (Medium, 30 coins). Hop across roads, dodge cars.
import { clamp, lerp, rand, randInt, choice, chance, TAU, PALETTE, Particles, pxText, pxTextCenter } from './util.js';
import { W, H, Input, button, panel } from './ui.js';
import { drawCharacter, descriptor } from './characters.js';
import { Sfx } from './audio.js';

const CELL = 48;
const COLS = Math.ceil(W / CELL);          // 20
const VIS_LANES = Math.ceil(H / CELL) + 2;
const GOAL_ROW = 26;
const CAM_OFFSET = 6;                        // player sits this many lanes above bottom
const AUTO_SCROLL_START = 4;                 // row after which camera auto-advances

export class CrossyRoad {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this.parts = new Particles();
    this.desc = descriptor('CrossyWorker');
  }
  onEnter() {
    this.t = 0;
    this.col = Math.floor(COLS / 2);
    this.row = 0;
    this.vcol = this.col; this.vrow = this.row;
    this.hop = null; // {fromC, fromR, toC, toR, t}
    this.lanes = new Map();
    this.camRow = -CAM_OFFSET;
    this.autoScroll = -CAM_OFFSET;
    this.autoOn = false;
    this.dead = false; this.won = false; this.done = false; this.endTimer = 0;
    this.farthest = 0;
    this.ensureLanes();
  }
  laneTypeForRow(r) {
    // deterministic-ish pattern: start grass, then roads every 2-3 lanes
    if (r < 2) return 'grass';
    const hash = ((r * 9301 + 49297) % 233280) / 233280;
    // about 55% road, 45% grass, avoid 3 roads in a row
    const prev = this.lanes.get(r - 1); const prev2 = this.lanes.get(r - 2);
    const prevRoad = prev && prev.type === 'road';
    const prev2Road = prev2 && prev2.type === 'road';
    let road = hash < 0.55;
    if (prevRoad && prev2Road) road = false; // break triple roads
    return road ? 'road' : 'grass';
  }
  ensureLanes() {
    const top = Math.ceil(this.camRow) + VIS_LANES + 2;
    for (let r = Math.floor(this.camRow) - 2; r <= top; r++) {
      if (r < 0) continue;
      if (!this.lanes.has(r)) this.makeLane(r);
    }
    // clean far behind
    for (const k of this.lanes.keys()) if (k < Math.floor(this.camRow) - 4) this.lanes.delete(k);
  }
  makeLane(r) {
    const type = this.laneTypeForRow(r);
    if (type === 'grass') {
      const trees = new Set();
      const treeCount = r === 0 ? 0 : randInt(0, 4);
      for (let i = 0; i < treeCount; i++) trees.add(randInt(0, COLS - 1));
      // keep spawn column clear
      if (r === 0) trees.clear();
      this.lanes.set(r, { type, trees, cars: [] });
    } else {
      this.lanes.set(r, {
        type, dir: chance(0.5) ? 1 : -1,
        speed: rand(2.2, 4.5) + Math.min(2, r * 0.03),
        interval: rand(1.6, 3.2),
        timer: rand(0, 2),
        cars: [],
      });
    }
  }
  update(dt) {
    this.t += dt;
    if (this.done) { this.endTimer += dt; this.parts.update(dt); return; }

    // auto-scroll
    if (!this.autoOn && this.row >= AUTO_SCROLL_START) this.autoOn = true;
    if (this.autoOn) this.autoScroll += dt * 0.32;
    const targetCam = Math.max(this.vrow - CAM_OFFSET, this.autoScroll);
    this.camRow = lerp(this.camRow, targetCam, 1 - Math.pow(0.001, dt));

    // fell behind camera
    if (this.vrow < this.camRow - 1.2) { this.die('TOO SLOW!'); return; }

    // spawn / move cars
    for (const [r, lane] of this.lanes) {
      if (lane.type !== 'road') continue;
      if (r < Math.floor(this.camRow) - 1 || r > Math.ceil(this.camRow) + VIS_LANES) continue;
      lane.timer -= dt;
      if (lane.timer <= 0) {
        lane.timer = lane.interval;
        lane.cars.push({ x: lane.dir > 0 ? -2 : COLS + 1, dir: lane.dir, speed: lane.speed, len: choice([1, 1, 2]), color: choice(['#e25c5c', '#5db8ff', '#43d17a', '#ffd23f', '#b07bff', '#ff9d2e']) });
      }
      for (const c of lane.cars) c.x += c.dir * c.speed * dt;
      lane.cars = lane.cars.filter(c => c.x > -4 && c.x < COLS + 4);
    }

    // hop input
    if (!this.hop && !this.done) {
      let dc = 0, dr = 0;
      if (Input.pressed('arrowup') || Input.pressed('w')) dr = 1;
      else if (Input.pressed('arrowdown') || Input.pressed('s')) dr = -1;
      else if (Input.pressed('arrowleft') || Input.pressed('a')) dc = -1;
      else if (Input.pressed('arrowright') || Input.pressed('d')) dc = 1;
      if (dc || dr) this.tryHop(dc, dr);
    }
    if (this.hop) {
      this.hop.t += dt / 0.13;
      if (this.hop.t >= 1) {
        this.hop = null; this.vcol = this.col; this.vrow = this.row;
        if (this.row > this.farthest) { this.farthest = this.row; Sfx.step(); }
        if (this.row >= GOAL_ROW) { this.win(); return; }
      }
    }

    // collision (road lane at visual row)
    const checkRow = Math.round(this.vrow);
    const lane = this.lanes.get(checkRow);
    if (lane && lane.type === 'road') {
      const pc = this.vcol + 0.5;
      for (const c of lane.cars) {
        if (pc > c.x - 0.1 && pc < c.x + c.len + 0.1) { this.die('SPLAT!'); return; }
      }
    }
    // also check the lane we're hopping into mid-hop
    if (this.hop) {
      const mr = Math.round(lerp(this.hop.fromR, this.hop.toR, this.hop.t));
      const ml = this.lanes.get(mr);
      const mc = lerp(this.hop.fromC, this.hop.toC, this.hop.t) + 0.5;
      if (ml && ml.type === 'road') for (const c of ml.cars) if (mc > c.x - 0.1 && mc < c.x + c.len + 0.1) { this.die('SPLAT!'); return; }
    }

    this.ensureLanes();
    this.parts.update(dt);
  }
  tryHop(dc, dr) {
    const nc = this.col + dc, nr = this.row + dr;
    if (nr < 0) return;
    if (nc < 0 || nc >= COLS) return;
    const lane = this.lanes.get(nr) || (this.makeLane(nr), this.lanes.get(nr));
    if (lane.type === 'grass' && lane.trees && lane.trees.has(nc)) { Sfx.deny(); return; }
    this.hop = { fromC: this.vcol, fromR: this.vrow, toC: nc, toR: nr, t: 0 };
    this.col = nc; this.row = nr;
  }
  win() { if (this.done) return; this.done = true; this.won = true; Sfx.win(); for (let i = 0; i < 40; i++) this.parts.burst(this.screenX(this.vcol), this.screenY(this.vrow), 1, { color: PALETTE.gold, speed: 200, life: 0.9, size: 4, up: 80 }); }
  die(msg) { if (this.done) return; this.done = true; this.dead = true; this.deathMsg = msg || 'OUCH!'; Sfx.lose(); Sfx.hit(); for (let i = 0; i < 24; i++) this.parts.burst(this.screenX(this.vcol), this.screenY(this.vrow), 1, { color: PALETTE.red, speed: 160, life: 0.7, size: 4 }); }

  screenX(col) { return col * CELL + CELL / 2; }
  screenY(row) { return H - 90 - (row - this.camRow) * CELL; }

  draw(ctx) {
    // sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a2342'); g.addColorStop(1, '#0c1020');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // lanes
    const r0 = Math.floor(this.camRow) - 1, r1 = Math.ceil(this.camRow) + VIS_LANES;
    for (let r = r0; r <= r1; r++) {
      const lane = this.lanes.get(r);
      const y = this.screenY(r) - CELL / 2;
      if (lane) this.drawLane(ctx, lane, r, y);
    }
    // finish line
    const fy = this.screenY(GOAL_ROW);
    if (fy > -CELL && fy < H + CELL) this.drawFinish(ctx, fy);

    // player
    this.drawPlayer(ctx);

    this.parts.draw(ctx);

    // HUD
    this.drawHud(ctx);
    if (this.done) this.drawEnd(ctx);
  }
  drawLane(ctx, lane, r, y) {
    if (lane.type === 'grass') {
      ctx.fillStyle = (r % 2 === 0) ? '#2e8c5a' : '#339a63';
      ctx.fillRect(0, y, W, CELL);
      // grass tufts
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < COLS; i++) { if ((i * 7 + r * 13) % 5 === 0) ctx.fillRect(i * CELL + 10, y + 10, 3, 3); }
      // trees
      for (const tc of lane.trees) this.drawTree(ctx, tc * CELL + CELL / 2, y + CELL / 2);
    } else {
      ctx.fillStyle = '#3a3f4e'; ctx.fillRect(0, y, W, CELL);
      ctx.fillStyle = '#2f333f'; ctx.fillRect(0, y, W, 4);
      // dashed center line
      ctx.fillStyle = 'rgba(255,210,90,0.5)';
      for (let x = 0; x < W; x += 36) ctx.fillRect(x, y + CELL / 2 - 2, 18, 4);
      for (const c of lane.cars) this.drawCar(ctx, c, y);
    }
  }
  drawTree(ctx, x, y) {
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(x - 3, y, 6, CELL / 2 - 6);
    ctx.fillStyle = '#1f6b3a';
    ctx.beginPath(); ctx.arc(x, y - 2, CELL / 3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2e8c5a'; ctx.beginPath(); ctx.arc(x - 6, y - 8, CELL / 4, 0, TAU); ctx.fill();
  }
  drawCar(ctx, c, y) {
    const x = c.x * CELL;
    const w = c.len * CELL - 8, h = CELL - 14;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 3, y + 8 + 4, w, h);
    // body
    ctx.fillStyle = c.color; this.rr(ctx, x, y + 8, w, h, 6); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y + 8 + h - 5, w, 5);
    // windows
    ctx.fillStyle = '#bfe6ff';
    if (c.dir > 0) { ctx.fillRect(x + w - 14, y + 12, 9, h - 8); ctx.fillRect(x + 4, y + 12, 8, h - 8); }
    else { ctx.fillRect(x + 4, y + 12, 9, h - 8); ctx.fillRect(x + w - 12, y + 12, 8, h - 8); }
    // headlights
    ctx.fillStyle = '#fff6c0';
    ctx.fillRect(c.dir > 0 ? x + w - 3 : x, y + 10, 3, 4);
    ctx.fillRect(c.dir > 0 ? x + w - 3 : x, y + 8 + h - 6, 3, 4);
    ctx.restore();
  }
  drawPlayer(ctx) {
    let col = this.vcol, row = this.vrow, hopZ = 0, squish = 0;
    if (this.hop) {
      const t = clamp(this.hop.t, 0, 1);
      col = lerp(this.hop.fromC, this.hop.toC, t);
      row = lerp(this.hop.fromR, this.hop.toR, t);
      hopZ = Math.sin(t * Math.PI) * 16;
      squish = Math.sin(t * Math.PI) * 0.15;
    }
    const x = this.screenX(col), y = this.screenY(row) - hopZ;
    // shadow
    ctx.save(); ctx.globalAlpha = 0.3 - hopZ * 0.01; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, this.screenY(row) + 2, 12 - hopZ * 0.2, 5, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.save();
    ctx.translate(x, y + 2 * squish); ctx.scale(1 + squish, 1 - squish); ctx.translate(-x, -(y + 2 * squish));
    if (this.dead) drawCharacter(ctx, x, y - 40, 2, this.desc, { t: this.t, face: 'sad', alpha: 0.8 });
    else drawCharacter(ctx, x, y - 40, 2, this.desc, { t: this.t });
    ctx.restore();
  }
  drawFinish(ctx, y) {
    ctx.fillStyle = 'rgba(255,207,77,0.25)'; ctx.fillRect(0, y - CELL / 2, W, CELL);
    for (let x = 0; x < W; x += 24) { ctx.fillStyle = (x / 24) % 2 === 0 ? '#fff' : '#222'; ctx.fillRect(x, y - CELL / 2, 24, 6); ctx.fillRect(x + 12, y + CELL / 2 - 6, 24, 6); }
    pxTextCenter(ctx, 'FINISH', W / 2, y - 8, 4, PALETTE.gold);
  }
  drawHud(ctx) {
    panel(ctx, W - 220, 14, 204, 56, {});
    pxText(ctx, 'DISTANCE', W - 210, 22, 2, PALETTE.dim);
    pxText(ctx, this.farthest + '/' + GOAL_ROW, W - 210, 36, 3, PALETTE.ink);
    // progress bar
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; this.rr(ctx, W - 110, 36, 84, 10, 5); ctx.fill();
    ctx.fillStyle = PALETTE.blue; this.rr(ctx, W - 110, 36, 84 * clamp(this.farthest / GOAL_ROW, 0, 1), 10, 5); ctx.fill();
    if (button(ctx, 16, 14, 110, 36, 'QUIT', { scale: 2, fg: PALETTE.dim })) { this.app.exitGame('lose', 0); }
  }
  drawEnd(ctx) {
    ctx.fillStyle = 'rgba(6,8,16,0.6)'; ctx.fillRect(0, 0, W, H);
    const win = this.won;
    const bw = 360, bh = 180, bx = W / 2 - bw / 2, by = H / 2 - bh / 2;
    panel(ctx, bx, by, bw, bh, { border: win ? PALETTE.gold : PALETTE.red });
    pxTextCenter(ctx, win ? 'YOU MADE IT!' : (this.deathMsg || 'OUCH!'), W / 2, by + 28, 5, win ? PALETTE.gold : PALETTE.red);
    pxTextCenter(ctx, win ? '+20 COINS' : 'NO COINS', W / 2, by + 78, 4, win ? PALETTE.green : PALETTE.dim);
    pxTextCenter(ctx, 'reached row ' + this.farthest, W / 2, by + 116, 2, PALETTE.dim);
    if (this.endTimer > 0.4 && button(ctx, W / 2 - 80, by + bh - 50, 160, 36, 'BACK TO OFFICE', { scale: 2 })) {
      this.app.exitGame(win ? 'win' : 'lose', win ? 20 : 0);
    }
  }
  rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
}
