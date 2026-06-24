// fighting.js — PIXEL BRAWL (Hard, 50 coins). 8-bit turn-based RPG, 3 floors.
import { clamp, lerp, randInt, choice, chance, mulberry32, hashStr, TAU, PALETTE, Particles, pxText, pxTextCenter, addShake, fillRoundRect, strokeRoundRect } from './util.js';
import { W, H, Input, button, panel, bar, hover, pointer, consumeClick } from './ui.js';
import { drawCharacter, descriptor, EMPLOYEES, drawSticker } from './characters.js';
import { Sfx } from './audio.js';

const SPECIALS = ['CODE BLAST', 'COFFEE RUSH', 'BUG SWARM', 'OVERDRIVE', 'DEPLOY', 'REFACTOR'];
const POTIONS = 2;

function statsFor(name) {
  const d = descriptor(name);
  const rng = mulberry32(hashStr(name + '#stats'));
  return {
    name, desc: d,
    maxhp: 90 + Math.floor(rng() * 60),
    atk: 16 + Math.floor(rng() * 14),
    def: 7 + Math.floor(rng() * 10),
    spd: 8 + Math.floor(rng() * 12),
    special: { name: choice(SPECIALS), max: 3, uses: 3, pow: 30 + Math.floor(rng() * 24) },
    potions: POTIONS,
  };
}

const ENEMIES = [
  { name: 'PAPER JAM', hp: 170, atk: 22, def: 10, spd: 9, color: '#d8b072', shape: 0 },
  { name: 'MEETING', hp: 300, atk: 30, def: 14, spd: 12, color: '#9b5ce2', shape: 1 },
  { name: 'THE DEADLINE', hp: 460, atk: 40, def: 18, spd: 14, color: '#e25c5c', shape: 2 },
];

export class Fighting {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this.parts = new Particles();
    this.floats = [];
  }
  onEnter() {
    this.t = 0;
    this.phase = 'select';
    this.party = [];           // chosen unit refs
    this.selectIdx = 0;        // highlight in roster
    this.level = 0;
    this.msg = 'Form your party of 3.';
    this.floats = [];
    this.done = false; this.endTimer = 0;
    this.roster = this.pickRoster();
    this.rosterDesc = this.roster.map(n => descriptor(n));
  }
  pickRoster() {
    // deterministic-ish shuffle of a chunk of employees for variety
    const pool = EMPLOYEES.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = randInt(0, i); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, 9);
  }
  startBattle() {
    this.enemy = this.makeEnemy(this.level);
    this.buildInitiative();
    this.idx = 0;
    this.phase = 'intro';
    this.timer = 1.3;
    this.msg = `FLOOR ${this.level + 1} — ${this.enemy.name} appears!`;
    this.cursor = 0; // menu cursor
    this.target = null;
    this.busy = 0;
  }
  makeEnemy(lv) {
    const e = ENEMIES[lv];
    return { ...e, side: 'enemy', maxhp: e.hp, hp: e.hp, defending: false, dead: false, flash: 0, x: W / 2, y: 150, bob: 0 };
  }
  buildInitiative() {
    const units = [...this.party, this.enemy].filter(u => !u.dead);
    units.sort((a, b) => b.spd - a.spd);
    this.queue = units;
    this.idx = 0;
  }

  update(dt) {
    this.t += dt;
    this.parts.update(dt);
    for (let i = this.floats.length - 1; i >= 0; i--) { const f = this.floats[i]; f.life -= dt; f.y -= 30 * dt; if (f.life <= 0) this.floats.splice(i, 1); }
    if (this.enemy) { this.enemy.flash = Math.max(0, this.enemy.flash - dt * 4); this.enemy.bob = Math.sin(this.t * 2) * 6; }
    for (const p of this.party) if (typeof p === 'object') p.flash = Math.max(0, p.flash - dt * 4);

    if (this.done) { this.endTimer += dt; return; }

    if (this.phase === 'select') { this.updateSelect(dt); return; }
    if (this.phase === 'intro') {
      this.timer -= dt;
      if (this.timer <= 0) this.advanceTurn();
      return;
    }
    if (this.phase === 'menu') { this.updateMenu(dt); return; }
    if (this.phase === 'enemy') {
      this.timer -= dt;
      if (this.timer <= 0) this.doEnemyAction();
      return;
    }
    if (this.phase === 'anim') {
      this.timer -= dt;
      if (this.timer <= 0) this.afterAction();
      return;
    }
    if (this.phase === 'levelwin') {
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.level >= 2) this.win();
        else { this.level++; this.startBattle(); }
      }
      return;
    }
  }

  // ---------- party select ----------
  updateSelect(dt) {
    if (Input.pressed('arrowleft') || Input.pressed('a')) { this.selectIdx = (this.selectIdx + 8) % 9; Sfx.hover(); }
    if (Input.pressed('arrowright') || Input.pressed('d')) { this.selectIdx = (this.selectIdx + 1) % 9; Sfx.hover(); }
    if (Input.pressed('arrowup') || Input.pressed('w')) { this.selectIdx = (this.selectIdx + 6) % 9; Sfx.hover(); }
    if (Input.pressed('arrowdown') || Input.pressed('s')) { this.selectIdx = (this.selectIdx + 3) % 9; Sfx.hover(); }
    if (Input.pressed(' ')) this.togglePick(this.selectIdx);
    if (Input.pressed('enter') && this.party.length === 3) this.beginBattle();
  }
  beginBattle() {
    this.party = this.party.map(n => ({ ...statsFor(n), side: 'party', hp: 0, defending: false, dead: false, flash: 0 }));
    this.party.forEach(u => u.hp = u.maxhp);
    this.startBattle(); Sfx.door();
  }
  togglePick(i) {
    const name = this.roster[i];
    const idx = this.party.indexOf(name);
    if (idx >= 0) { this.party.splice(idx, 1); Sfx.click(); }
    else if (this.party.length < 3) { this.party.push(name); Sfx.select(); }
    else Sfx.deny();
  }

  // ---------- battle menu ----------
  current() { return this.queue[this.idx]; }
  updateMenu(dt) {
    const u = this.current();
    if (!u || u.side !== 'party') { this.advanceTurn(); return; }
    if (Input.pressed('arrowleft') || Input.pressed('a')) { this.cursor = (this.cursor + 3) % 4; Sfx.hover(); }
    if (Input.pressed('arrowright') || Input.pressed('d')) { this.cursor = (this.cursor + 1) % 4; Sfx.hover(); }
    if (Input.pressed('arrowup') || Input.pressed('w')) { this.cursor = (this.cursor + 2) % 4; Sfx.hover(); }
    if (Input.pressed('arrowdown') || Input.pressed('s')) { this.cursor = (this.cursor + 2) % 4; Sfx.hover(); }
    if (Input.pressed('enter') || Input.pressed(' ')) this.choose(this.cursor);
  }
  commands(u) {
    return [
      { label: 'ATTACK', run: () => this.actAttack(u) },
      { label: 'SPECIAL', sub: `${u.special.uses}/${u.special.max}`, disabled: u.special.uses <= 0, run: () => this.actSpecial(u) },
      { label: 'DEFEND', run: () => this.actDefend(u) },
      { label: `ITEM x${u.potions}`, disabled: u.potions <= 0, run: () => this.actItem(u) },
    ];
  }
  choose(i) {
    const u = this.current();
    const c = this.commands(u)[i];
    if (c.disabled) { Sfx.deny(); return; }
    Sfx.click();
    c.run();
  }
  actAttack(u) { this.startAnim(u, () => this.damage(u, this.enemy, randInt(u.atk - 4, u.atk + 4), false), `${u.name} attacks!`); }
  actSpecial(u) { u.special.uses--; this.startAnim(u, () => this.damage(u, this.enemy, u.special.pow + randInt(-6, 6), true), `${u.name} uses ${u.special.name}!`); Sfx.heal(); }
  actDefend(u) { u.defending = true; this.msg = `${u.name} braces!`; this.startAnim(u, null, `${u.name} braces for impact!`); }
  actItem(u) { u.potions--; const heal = randInt(50, 70); u.hp = clamp(u.hp + heal, 0, u.maxhp); this.floats.push({ x: u.x, y: u.y - 30, val: '+' + heal, color: PALETTE.green, life: 1.2 }); this.parts.burst(u.x, u.y - 20, 16, { color: PALETTE.green, speed: 90, life: 0.7 }); Sfx.heal(); this.msg = `${u.name} drinks coffee! +${heal} HP`; this.startAnim(u, null, this.msg); }

  startAnim(actor, applyFn, msg) {
    this.phase = 'anim';
    this.timer = applyFn ? 0.6 : 0.5;
    this.msg = msg || '';
    this._apply = applyFn;
    this._actor = actor;
    actor.atkAnim = 0.001;
    if (applyFn) setTimeout(() => { if (this._apply === applyFn) { this._apply(); this._apply = null; } }, 250);
  }
  afterAction() {
    // check end conditions
    if (this.enemy.dead) { this.levelWin(); return; }
    if (this.party.every(p => p.dead)) { this.lose(); return; }
    this.idx++;
    this.advanceTurn();
  }
  advanceTurn() {
    if (this.enemy.dead) { this.levelWin(); return; }
    if (this.party.every(p => p.dead)) { this.lose(); return; }
    // skip dead
    let safety = 0;
    while (this.queue[this.idx] && this.queue[this.idx].dead && safety++ < 10) this.idx++;
    if (this.idx >= this.queue.length) { this.buildInitiative(); this.idx = 0; }
    const u = this.current();
    if (!u) { this.idx = 0; return; }
    if (u.dead) { this.idx++; this.advanceTurn(); return; }
    if (u.side === 'party') { this.cursor = 0; this.phase = 'menu'; }
    else { this.phase = 'enemy'; this.timer = 0.7; }
  }
  doEnemyAction() {
    const e = this.enemy;
    const alive = this.party.filter(p => !p.dead);
    const target = choice(alive);
    if (chance(0.25) && this.level >= 1) {
      const pow = Math.floor(e.atk * 1.6);
      this.phase = 'anim'; this.timer = 0.7; this.msg = `${e.name} unleashes CRUNCH!`;
      e.atkAnim = 0.001;
      this._apply = () => this.damage(e, target, pow, true); this._actor = e;
      setTimeout(() => { if (this._apply) { this._apply(); this._apply = null; } }, 280);
    } else {
      this.phase = 'anim'; this.timer = 0.6; this.msg = `${e.name} attacks!`;
      e.atkAnim = 0.001;
      this._apply = () => this.damage(e, target, randInt(e.atk - 4, e.atk + 4), false); this._actor = e;
      setTimeout(() => { if (this._apply) { this._apply(); this._apply = null; } }, 250);
    }
  }
  damage(attacker, target, base, special) {
    let dmg = Math.max(1, base - Math.floor(target.def / 2));
    if (target.defending) { dmg = Math.floor(dmg / 2); target.defending = false; }
    dmg = Math.max(1, dmg + randInt(-2, 2));
    target.hp = clamp(target.hp - dmg, 0, target.maxhp);
    target.flash = 1;
    addShake(special ? 8 : 5, 0.25);
    Sfx.attack(); Sfx.hit();
    this.floats.push({ x: target.x, y: target.y - (target.side === 'party' ? 30 : 20), val: String(dmg), color: special ? PALETTE.gold : '#fff', life: 1.1 });
    this.parts.burst(target.x, target.y - 10, special ? 18 : 10, { color: special ? PALETTE.gold : '#ff8a8a', speed: 140, life: 0.6, size: 3 });
    if (target.hp <= 0) { target.dead = true; this.msg = `${target.name} is DOWN!`; this.parts.burst(target.x, target.y - 10, 24, { color: '#888', speed: 120, life: 0.8 }); }
  }
  levelWin() {
    if (this.phase === 'levelwin') return;
    this.phase = 'levelwin'; this.timer = 1.6;
    Sfx.win();
    this.msg = `${this.enemy.name} defeated!`;
    for (let i = 0; i < 30; i++) this.parts.burst(this.enemy.x, this.enemy.y, 1, { color: PALETTE.gold, speed: 180, life: 0.9, size: 4 });
    // partial heal
    for (const p of this.party) if (!p.dead) p.hp = clamp(p.hp + Math.floor(p.maxhp * 0.4), 0, p.maxhp);
  }
  win() { if (this.done) return; this.done = true; this.outcome = 'win'; Sfx.win(); }
  lose() { if (this.done) return; this.done = true; this.outcome = 'lose'; Sfx.lose(); }

  // ---------- draw ----------
  draw(ctx) {
    ctx.fillStyle = '#05060d'; ctx.fillRect(0, 0, W, H);
    if (this.phase === 'select') { this.drawSelect(ctx); return; }
    this.drawBattlefield(ctx);
    this.drawMenu(ctx);
    if (this.done) this.drawEnd(ctx);
  }
  drawSelect(ctx) {
    ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, 0, W, H);
    pxTextCenter(ctx, 'PIXEL BRAWL', W / 2, 16, 4, PALETTE.red);
    pxTextCenter(ctx, 'ASSEMBLE YOUR PARTY OF 3', W / 2, 52, 2, PALETTE.dim);
    pxTextCenter(ctx, this.msg, W / 2, 74, 2, PALETTE.gold);
    const cellW = 130, cellH = 120, ox = W / 2 - (3 * cellW) / 2, oy = 92;
    for (let i = 0; i < this.roster.length; i++) {
      const cx = ox + (i % 3) * cellW, cy = oy + Math.floor(i / 3) * cellH;
      const name = this.roster[i];
      const picked = this.party.includes(name);
      const sel = i === this.selectIdx;
      const rx = cx + 5, ry = cy + 5, rw = cellW - 10, rh = cellH - 10;
      const hov = hover(rx, ry, rw, rh);
      if (hov && pointer.clicked && !pointer.consumed) { consumeClick(); this.togglePick(i); }
      const border = picked ? PALETTE.green + 'aa' : (sel || hov ? PALETTE.gold : 'rgba(255,255,255,0.08)');
      const bg = picked ? '#16331f' : '#141a2e';
      fillRoundRect(ctx, rx, ry, rw, rh, 8, bg);
      strokeRoundRect(ctx, rx + 0.5, ry + 0.5, rw - 1, rh - 1, 8, 2, border);
      drawCharacter(ctx, cx + cellW / 2, cy + 22, 3, this.rosterDesc[i], { t: this.t });
      const fs = Math.max(1, Math.floor((cellW - 16) / Math.max(name.length, 8) / 6));
      pxTextCenter(ctx, name, cx + cellW / 2, cy + cellH - 22, fs, picked ? PALETTE.green : PALETTE.ink);
      if (picked) pxTextCenter(ctx, '[OK]', cx + cellW / 2, cy + 12, 2, PALETTE.green);
    }
    const ready = this.party.length === 3;
    if (button(ctx, W / 2 - 120, H - 62, 240, 40, ready ? 'ENTER THE BRAWL' : `PICK 3 (${this.party.length}/3)`, { scale: 2, fg: ready ? PALETTE.gold : PALETTE.dim, bg: ready ? PALETTE.panel2 : PALETTE.panel, border: ready ? PALETTE.gold : 'rgba(255,255,255,0.08)' })) {
      if (ready) this.beginBattle();
    }
  }
  drawBattlefield(ctx) {
    // floor
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0f22'); g.addColorStop(1, '#05060d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // floor grid
    ctx.strokeStyle = 'rgba(80,100,160,0.08)'; ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    // floor line
    ctx.fillStyle = 'rgba(123,92,255,0.15)'; ctx.fillRect(0, 280, W, 3);

    // enemy
    if (this.enemy && !this.enemy.dead) this.drawEnemy(ctx);
    // party
    this.layoutParty();
    for (const p of this.party) if (!p.dead) this.drawPartyMember(ctx, p);

    this.parts.draw(ctx);
    // floats
    for (const f of this.floats) {
      const a = clamp(f.life, 0, 1);
      ctx.globalAlpha = a;
      pxTextCenter(ctx, f.val, f.x, f.y, 3, f.color);
      ctx.globalAlpha = 1;
    }

    // top status: enemy hp
    if (this.enemy) {
      panel(ctx, 16, 14, 360, 52, {});
      pxText(ctx, this.enemy.name, 30, 22, 3, PALETTE.ink);
      pxText(ctx, 'FLOOR ' + (this.level + 1) + '/3', 250, 22, 2, PALETTE.gold);
      bar(ctx, 30, 44, 330, 10, this.enemy.hp / this.enemy.maxhp, this.enemy.hp / this.enemy.maxhp > 0.4 ? PALETTE.red : '#ff3030');
    }
    // party hp row (right)
    for (let i = 0; i < this.party.length; i++) {
      const p = this.party[i];
      const x = W - 244, y = 14 + i * 30;
      panel(ctx, x, y, 228, 26, { r: 6 });
      pxText(ctx, p.name.slice(0, 8), x + 8, y + 4, 2, p.dead ? PALETTE.dim : PALETTE.ink);
      bar(ctx, x + 90, y + 9, 130, 8, p.hp / p.maxhp, p.dead ? '#444' : PALETTE.green);
      pxText(ctx, Math.ceil(p.hp) + '/' + p.maxhp, x + 90, y + 16, 1, PALETTE.dim);
    }
    // message line
    panel(ctx, 16, H - 150, W - 32, 44, { r: 8 });
    pxText(ctx, this.msg || '', 28, H - 136, 2, PALETTE.ink);
  }
  layoutParty() {
    const n = this.party.length;
    const gap = 120;
    const startX = W / 2 - (n - 1) * gap / 2;
    for (let i = 0; i < n; i++) {
      this.party[i].x = startX + i * gap;
      this.party[i].y = 380;
    }
  }
  drawPartyMember(ctx, p) {
    const u = this.current();
    const active = u === p && (this.phase === 'menu');
    ctx.save();
    if (active) { ctx.shadowColor = PALETTE.gold; ctx.shadowBlur = 14 + Math.sin(this.t * 6) * 4; }
    if (p.atkAnim > 0) { p.atkAnim += 0; } // placeholder
    // attack lunge offset
    let dx = 0;
    if (this._actor === p && this.phase === 'anim') dx = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(p.x + dx, p.y + 2, 14, 5, 0, 0, TAU); ctx.fill();
    ctx.translate(dx, 0);
    ctx.globalAlpha = p.flash > 0 ? (0.5 + Math.sin(this.t * 40) * 0.5) : 1;
    drawCharacter(ctx, p.x, p.y - 44, 3, p.desc, { t: this.t, face: 'fight', flip: false });
    ctx.restore();
  }
  drawEnemy(ctx) {
    const e = this.enemy;
    const x = e.x, y = e.y + e.bob;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + 40, 50, 12, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = e.flash > 0 ? (0.4 + Math.sin(this.t * 40) * 0.6) : 1;
    this.drawMonster(ctx, x, y, e);
    ctx.restore();
  }
  drawMonster(ctx, x, y, e) {
    const s = 6;
    ctx.save();
    ctx.translate(x, y);
    if (e.shape === 0) { // paper jam - crumpled blob
      ctx.fillStyle = e.color;
      ctx.beginPath();
      const pts = [[-6, -4], [-4, -7], [0, -6], [4, -8], [7, -3], [6, 3], [2, 6], [-3, 5], [-7, 2]];
      ctx.moveTo(pts[0][0] * s, pts[0][1] * s);
      for (const p of pts) ctx.lineTo(p[0] * s, p[1] * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-3 * s, -2 * s, 2 * s, 2 * s); ctx.fillRect(2 * s, -2 * s, 2 * s, 2 * s);
      ctx.fillStyle = '#000'; ctx.fillRect(-2 * s, -s, s, s); ctx.fillRect(3 * s, -s, s, s);
      ctx.fillStyle = '#000'; ctx.fillRect(-2 * s, 2 * s, 4 * s, s);
    } else if (e.shape === 1) { // meeting - calendar with teeth
      ctx.fillStyle = e.color; ctx.fillRect(-6 * s, -6 * s, 12 * s, 12 * s);
      ctx.fillStyle = '#fff'; ctx.fillRect(-6 * s, -6 * s, 12 * s, 2 * s);
      ctx.fillStyle = '#e25c5c'; ctx.fillRect(-5 * s, -6 * s, 2 * s, s); ctx.fillRect(3 * s, -6 * s, 2 * s, s);
      ctx.fillStyle = '#fff'; ctx.fillRect(-4 * s, -2 * s, 2 * s, 2 * s); ctx.fillRect(2 * s, -2 * s, 2 * s, 2 * s);
      ctx.fillStyle = '#000'; ctx.fillRect(-3 * s, -s, s, s); ctx.fillRect(3 * s, -s, s, s);
      ctx.fillStyle = '#fff';
      for (let i = -5; i <= 5; i += 2) ctx.fillRect(i * s, 5 * s, s, s);
    } else { // the deadline - clock demon
      ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(0, 0, 7 * s, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2a0a0a'; ctx.lineWidth = s; ctx.beginPath(); ctx.arc(0, 0, 7 * s, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = s; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -4 * s); ctx.moveTo(0, 0); ctx.lineTo(3 * s, 0); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(-5 * s, -6 * s, 2 * s, 2 * s); ctx.fillRect(3 * s, -6 * s, 2 * s, 2 * s);
      ctx.fillStyle = '#000'; ctx.fillRect(-4 * s, -5 * s, s, s); ctx.fillRect(4 * s, -5 * s, s, s);
      // horns
      ctx.fillStyle = '#2a0a0a'; ctx.beginPath(); ctx.moveTo(-6 * s, -6 * s); ctx.lineTo(-8 * s, -9 * s); ctx.lineTo(-4 * s, -7 * s); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6 * s, -6 * s); ctx.lineTo(8 * s, -9 * s); ctx.lineTo(4 * s, -7 * s); ctx.fill();
    }
    ctx.restore();
  }
  drawMenu(ctx) {
    if (this.phase !== 'menu' || this.done) return;
    const u = this.current();
    if (!u || u.side !== 'party') return;
    const cmds = this.commands(u);
    const bw = 150, bh = 44, bx = W / 2 - bw, by = H - 96;
    panel(ctx, bx - 8, by - 8, bw * 2 + 8, bh * 2 + 16, { border: PALETTE.gold });
    for (let i = 0; i < cmds.length; i++) {
      const cx = bx + (i % 2) * bw, cy = by + Math.floor(i / 2) * bh;
      const sel = i === this.cursor;
      if (button(ctx, cx, cy, bw - 8, bh - 6, cmds[i].label, { scale: 2, bg: sel ? PALETTE.panel2 : PALETTE.panel, border: sel ? PALETTE.gold : 'rgba(255,255,255,0.08)', fg: cmds[i].disabled ? PALETTE.dim : PALETTE.ink })) {
        this.choose(i);
      }
      if (cmds[i].sub) pxText(ctx, cmds[i].sub, cx + bw - 48, cy + 8, 2, PALETTE.dim);
    }
    pxTextCenter(ctx, u.name + "'s TURN", W / 2, H - 156, 2, PALETTE.gold);
  }
  drawEnd(ctx) {
    ctx.fillStyle = 'rgba(2,3,8,0.7)'; ctx.fillRect(0, 0, W, H);
    const win = this.outcome === 'win';
    const bw = 380, bh = 200, bx = W / 2 - bw / 2, by = H / 2 - bh / 2;
    panel(ctx, bx, by, bw, bh, { border: win ? PALETTE.gold : PALETTE.red });
    pxTextCenter(ctx, win ? 'VICTORY!' : 'PARTY WIPED', W / 2, by + 30, 5, win ? PALETTE.gold : PALETTE.red);
    pxTextCenter(ctx, win ? 'You cleared all 3 floors!' : 'The deadline won...', W / 2, by + 84, 2, PALETTE.dim);
    pxTextCenter(ctx, win ? '+20 COINS' : 'NO COINS', W / 2, by + 112, 4, win ? PALETTE.green : PALETTE.dim);
    if (this.endTimer > 0.4 && button(ctx, W / 2 - 90, by + bh - 52, 180, 38, 'BACK TO OFFICE', { scale: 2 })) {
      this.app.exitGame(win ? 'win' : 'lose', win ? 20 : 0);
    }
  }
}
