// clawshop.js — claw machine prize shop + employee sticker collection
import { clamp, lerp, rand, randInt, choice, TAU, PALETTE, Particles, pxText, pxTextCenter, Store, roundRect as roundRectM } from './util.js';
import { W, H, button, panel, hover, pointer, consumeClick } from './ui.js';
import { EMPLOYEES, descriptor, drawCharacter, drawSticker } from './characters.js';
import { Sfx } from './audio.js';

const COST = 1;
const DUPE_BONUS = 0;

export class ClawShop {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this.parts = new Particles();
  }
  onEnter() {
    this.t = 0;
    this.phase = 'idle';
    this.timer = 0;
    this.page = 0;
    this.perPage = 24;
    this.clawX = 230; this.clawY = 60; this.clawOpen = 1;
    this.capsule = null;
    this.reveal = null; // {name, isNew, scale, life}
    this.prizes = this.makePrizes();
    this.autoPlay = false;
    this.autoCount = 0;
    this.msg = 'Insert coins to win a teammate sticker!';
  }
  makePrizes() {
    // floating capsule prizes inside the machine
    const cols = [PALETTE.red, PALETTE.blue, PALETTE.green, PALETTE.gold, PALETTE.purple, PALETTE.accent];
    const arr = [];
    for (let i = 0; i < 9; i++) {
      arr.push({ x: 110 + (i % 3) * 95, y: 230 + Math.floor(i / 3) * 70, baseX: 110 + (i % 3) * 95, baseY: 230 + Math.floor(i / 3) * 70, color: cols[i % cols.length], phase: rand(0, TAU), name: EMPLOYEES[i] });
    }
    return arr;
  }
  get pages() { return Math.ceil(EMPLOYEES.length / this.perPage); }

  update(dt) {
    this.t += dt;
    this.parts.update(dt);
    // prizes bob
    for (const p of this.prizes) { p.phase += dt; p.x = p.baseX + Math.sin(p.phase) * 4; p.y = p.baseY + Math.cos(p.phase * 1.3) * 3; }

    if (this.phase === 'playing') this.updatePlay(dt);
    if (this.phase === 'reveal') this.updateReveal(dt);
  }  updatePlay(dt) {
    this.timer += dt;
    const T = this.timer;
    const target = this._target;
    const chuteX = 300, railY = 60, grabY = 260;
    if (T < 0.9) { // slide
      const k = clamp(T / 0.9, 0, 1);
      this.clawX = lerp(230, target.baseX, k); this.clawY = railY; this.clawOpen = 1;
    } else if (T < 1.7) { // drop
      const k = clamp((T - 0.9) / 0.8, 0, 1); this.clawY = lerp(railY, grabY, k); this.clawOpen = 1;
    } else if (T < 2.0) { // grab
      this.clawOpen = lerp(1, 0.1, clamp((T - 1.7) / 0.3, 0, 1));
      if (!this.capsule) { this.capsule = { x: target.baseX, y: grabY + 14, color: target.color, name: this._winner, held: true, vy: 0 }; }
    } else if (T < 2.7) { // lift
      const k = clamp((T - 2.0) / 0.7, 0, 1); this.clawY = lerp(grabY, railY, k);
      if (this.capsule) { this.capsule.x = this.clawX; this.capsule.y = this.clawY + 14; }
    } else if (T < 3.7) { // move to chute
      const k = clamp((T - 2.7) / 1.0, 0, 1); this.clawX = lerp(target.baseX, chuteX, k);
      if (this.capsule) { this.capsule.x = this.clawX; this.capsule.y = this.clawY + 14; }
    } else if (T < 4.2) { // drop
      const k = clamp((T - 3.7) / 0.5, 0, 1);
      this.clawOpen = lerp(0.1, 1, k);
      if (this.capsule) { this.capsule.held = false; this.capsule.y = lerp(this.clawY + 14, 410, k); this.capsule.x = chuteX; }
    } else {
      // reveal
      this.startReveal(this._winner);
    }
  }
  updateReveal(dt) {
    if (this.reveal) {
      this.reveal.life += dt;
      this.reveal.scale = lerp(this.reveal.scale, 1, 1 - Math.pow(0.001, dt));
      if (this.reveal.life > 0.2 && !this.reveal._burst) { this.reveal._burst = true; for (let i = 0; i < 30; i++) this.parts.burst(W / 2, 300, 1, { color: this.reveal.isNew ? PALETTE.gold : PALETTE.blue, speed: 200, life: 0.9, size: 4, up: 40 }); Sfx.clawWin(); }
    }
    // auto-play: auto-collect after 1.2s and immediately play again
    if (this.autoPlay && this.reveal && this.reveal.life > 1.2) {
      this.capsule = null; this.reveal = null;
      if (Store.coins >= COST) {
        this.phase = 'idle';
        this.tryPlay();
      } else {
        this.phase = 'idle'; this.autoPlay = false;
        this.msg = 'Out of coins! Collected ' + this.autoCount + ' stickers.';
      }
    }
  }
  startReveal(name) {
    const isNew = !Store.owns(name);
    this.phase = 'reveal';
    this.reveal = { name, isNew, scale: 0.2, life: 0, _burst: false };
    if (isNew) { Store.addOwned(name); this.msg = 'NEW TEAMMATE! ' + name; }
    else { this.msg = 'Duplicate! ' + name; }
    this.capsule = null;
  }
  tryPlay() {
    if (this.phase !== 'idle') return;
    if (Store.coins < COST) { Sfx.deny(); this.msg = 'Not enough coins!'; return; }
    Store.addCoins(-COST);
    if (this.autoPlay) this.autoCount++;
    Sfx.clawGrab();
    // choose winner (favor unowned)
    const unowned = EMPLOYEES.filter(n => !Store.owns(n));
    let winner;
    if (unowned.length && Math.random() < 0.8) winner = choice(unowned);
    else winner = choice(EMPLOYEES);
    this._winner = winner;
    this._target = choice(this.prizes);
    this.phase = 'playing'; this.timer = 0;
    this.msg = 'Grabbing a prize...';
  }
  startAutoPlay() {
    if (Store.coins < COST) { Sfx.deny(); this.msg = 'Not enough coins!'; return; }
    this.autoPlay = true;
    this.autoCount = 0;
    this.tryPlay();
  }
  stopAutoPlay() {
    this.autoPlay = false;
  }

  draw(ctx) {
    // dim backdrop
    ctx.fillStyle = 'rgba(6,8,16,0.9)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(123,92,255,0.05)';
    for (let x = 0; x < W; x += 40) for (let y = 0; y < H; y += 40) if ((x + y) % 80 === 0) ctx.fillRect(x, y, 20, 20);

    pxTextCenter(ctx, 'CLAW MACHINE', W / 2, 20, 5, PALETTE.gold);
    pxTextCenter(ctx, this.msg, W / 2, 56, 2, PALETTE.ink);

    this.drawMachine(ctx);
    this.drawCollection(ctx);

    // insert 1 coin button (bottom of machine)
    const enough = Store.coins >= COST;
    if (this.phase === 'idle' && !this.autoPlay && button(ctx, 60, 470, 130, 44, 'INSERT 1', { scale: 2, fg: enough ? PALETTE.gold : PALETTE.dim, bg: enough ? '#2a2140' : PALETTE.panel, border: enough ? PALETTE.gold : 'rgba(255,255,255,0.08)' })) {
      this.tryPlay();
    }
    // insert all coins button
    const canAll = Store.coins >= COST;
    const allLabel = 'INSERT ALL (' + Store.coins + ')';
    if (this.phase === 'idle' && !this.autoPlay && button(ctx, 200, 470, 200, 44, allLabel, { scale: 2, fg: canAll ? PALETTE.accent : PALETTE.dim, bg: canAll ? '#1a3a30' : PALETTE.panel, border: canAll ? PALETTE.accent : 'rgba(255,255,255,0.08)' })) {
      this.startAutoPlay();
    }
    // stop auto-play button
    if (this.autoPlay && button(ctx, 60, 470, 200, 44, 'STOP', { scale: 2, fg: PALETTE.red, bg: '#3a1a20', border: PALETTE.red })) {
      this.stopAutoPlay();
      this.msg = 'Stopped. Insert coins to play again.';
    }
    if (this.phase === 'idle' && !this.autoPlay) { pxText(ctx, 'YOU HAVE ' + Store.coins + ' COINS', 60, 446, 2, PALETTE.dim); }
    if (this.autoPlay) { pxText(ctx, 'AUTO-PLAYING... ' + this.autoCount + ' won', 60, 446, 2, PALETTE.accent); }

    this.parts.draw(ctx);

    if (button(ctx, W - 120, H - 52, 104, 36, 'CLOSE', { scale: 2, fg: PALETTE.dim })) { Sfx.click(); this.app.closeShop(); }

    if (this.phase === 'reveal' && this.reveal) this.drawReveal(ctx);
  }
  drawMachine(ctx) {
    const mx = 60, my = 90, mw = 340, mh = 380;
    // body
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24;
    ctx.fillStyle = '#2a1f3a'; roundRectM(ctx, mx, my, mw, mh, 16); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#3a2a4a'; roundRectM(ctx, mx, my, mw, 40, 16); ctx.fill();
    pxTextCenter(ctx, 'ai& PRIZES', mx + mw / 2, my + 14, 2, PALETTE.gold);
    // glass
    ctx.fillStyle = 'rgba(150,200,255,0.10)'; roundRectM(ctx, mx + 16, my + 48, mw - 32, 300, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; roundRectM(ctx, mx + 16, my + 48, mw - 32, 300, 8); ctx.stroke();
    // rail
    ctx.fillStyle = '#9aa3bd'; ctx.fillRect(mx + 20, my + 56, mw - 40, 5);
    // prizes inside
    ctx.save();
    roundRectM(ctx, mx + 16, my + 48, mw - 32, 300, 8); ctx.clip();
    for (const p of this.prizes) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 12, 12, 4, 0, 0, TAU); ctx.fill();
      // capsule
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(p.x - 4, p.y - 4, 4, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // claw + capsule
    this.drawClaw(ctx, mx);
    ctx.restore();
    // chute
    ctx.fillStyle = '#1a1228'; roundRectM(ctx, mx + 110, my + 360, 120, 14, 4); ctx.fill();
    // legs
    ctx.fillStyle = '#2a1f3a'; ctx.fillRect(mx + 20, my + mh, 16, 14); ctx.fillRect(mx + mw - 36, my + mh, 16, 14);
    // marquee lights
    for (let i = 0; i < 8; i++) { ctx.fillStyle = (Math.sin(this.t * 4 + i) > 0) ? PALETTE.gold : '#5a4a1a'; ctx.beginPath(); ctx.arc(mx + 30 + i * 38, my + 30, 3, 0, TAU); ctx.fill(); }
  }
  drawClaw(ctx, mx) {
    const cx = this.clawX, cy = this.clawY;
    // cable
    ctx.strokeStyle = '#888'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, 60); ctx.lineTo(cx, cy); ctx.stroke();
    // head
    ctx.fillStyle = '#c9a227'; ctx.fillRect(cx - 8, cy, 16, 8);
    // jaws (open factor 0..1)
    const o = this.clawOpen * 10;
    ctx.fillStyle = '#e8c24a';
    ctx.beginPath(); ctx.moveTo(cx - 8, cy + 8); ctx.lineTo(cx - 8 - o, cy + 20); ctx.lineTo(cx - 2, cy + 16); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 8, cy + 8); ctx.lineTo(cx + 8 + o, cy + 20); ctx.lineTo(cx + 2, cy + 16); ctx.closePath(); ctx.fill();
    // capsule being held
    if (this.capsule) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(this.capsule.x, this.capsule.y + 12, 12, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = this.capsule.color; ctx.beginPath(); ctx.arc(this.capsule.x, this.capsule.y, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(this.capsule.x - 4, this.capsule.y - 4, 4, 0, TAU); ctx.fill();
    }
  }
  drawCollection(ctx) {
    const px = 430, py = 90, pw = 490, ph = 380;
    panel(ctx, px, py, pw, ph, { r: 14 });
    pxText(ctx, 'STICKER COLLECTION', px + 16, py + 12, 2, PALETTE.gold);
    const owned = EMPLOYEES.filter(n => Store.owns(n)).length;
    pxText(ctx, owned + '/' + EMPLOYEES.length, px + pw - 70, py + 12, 2, PALETTE.ink);

    const cols = 6, cell = 74;
    const gx = px + 16, gy = py + 40;
    const start = this.page * this.perPage;
    for (let i = 0; i < this.perPage; i++) {
      const idx = start + i;
      if (idx >= EMPLOYEES.length) break;
      const cx = gx + (i % cols) * cell, cy = gy + Math.floor(i / cols) * cell;
      if (cx + cell > px + pw - 12) break;
      drawSticker(ctx, EMPLOYEES[idx], cx, cy, cell - 8, this.t, { owned: Store.owns(EMPLOYEES[idx]) });
    }
    // page nav
    if (button(ctx, px + 16, py + ph - 36, 80, 26, '< PREV', { scale: 2 }) && this.page > 0) { this.page--; Sfx.hover(); }
    if (button(ctx, px + pw - 96, py + ph - 36, 80, 26, 'NEXT >', { scale: 2 }) && this.page < this.pages - 1) { this.page++; Sfx.hover(); }
    pxTextCenter(ctx, 'PAGE ' + (this.page + 1) + '/' + this.pages, px + pw / 2, py + ph - 30, 2, PALETTE.dim);
  }
  drawReveal(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
    const r = this.reveal;
    const size = 220 * r.scale;
    // rays
    ctx.save(); ctx.translate(W / 2, 300); ctx.globalAlpha = 0.5;
    for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.fillStyle = r.isNew ? 'rgba(255,207,77,0.12)' : 'rgba(93,184,255,0.10)'; ctx.fillRect(-6, -200, 12, 200); }
    ctx.restore();
    drawSticker(ctx, r.name, W / 2 - size / 2, 300 - size / 2, size, this.t, { owned: true });
    pxTextCenter(ctx, r.isNew ? 'NEW TEAMMATE!' : 'DUPLICATE!', W / 2, 180, 4, r.isNew ? PALETTE.gold : PALETTE.blue);
    if (!r.isNew) pxTextCenter(ctx, 'DUPLICATE', W / 2, 420, 3, PALETTE.dim);
    if (button(ctx, W / 2 - 90, 470, 180, 40, 'COLLECT', { scale: 2, fg: PALETTE.gold, border: PALETTE.gold })) {
      this.capsule = null; this.reveal = null; this.phase = 'idle'; this.msg = 'Insert coins to win a teammate sticker!'; Sfx.coin();
    }
  }
}
