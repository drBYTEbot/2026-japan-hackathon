// office.js — the main hub: an ai& office with 3 game platforms, claw machine, spawn point
import { clamp, lerp, rand, TAU, PALETTE, Particles, pxText, pxTextCenter, dist, roundRect as roundRectC, Store } from './util.js';
import { W, H, Input, button, pointer, hover } from './ui.js';
import { drawCharacter, descriptor, EMPLOYEES } from './characters.js';
import { Sfx } from './audio.js';

export const WORLD_W = 960, WORLD_H = 1000;
const OY = 260; // office offset: main office shifts down 260px, CEO office above
const TILE = 48;

// game platform definitions
export const GAMES = [
  { id: 'rush', name: 'DESK JAM', sub: 'Rush Hour', diff: 'EASY', reward: 20, color: PALETTE.green, desc: 'Slide desks aside. Escape the office!' },
  { id: 'crossy', name: 'CROSSWALK', sub: 'Crossy Road', diff: 'MEDIUM', reward: 20, color: PALETTE.blue, desc: 'Cross the road. Dodge the cars.' },
  { id: 'fight', name: 'PIXEL BRAWL', sub: 'Turn Battle', diff: 'HARD', reward: 20, color: PALETTE.red, desc: '8-bit party battle. 3 floors.' },
  { id: 'boss', name: 'BEAT THE CEO', sub: 'Final Boss', diff: 'BOSS', reward: 20, color: PALETTE.gold, desc: 'Cross, escape, then fight David solo!' },
];

const PLAYER_DESC = (() => { const d = descriptor('ArcAIdia-Hero'); d.shirt = '#3a6df0'; d.hair = '#241a12'; d.hat = null; d.glasses = false; return d; })();

export class Office {
  constructor(app) {
    this.app = app;
    this.player = { x: 480, y: 400 + OY, vx: 0, vy: 0, face: 1, anim: 0, speed: 175 };
    this.cam = { y: 0 };
    this.spawn = { x: 480, y: 400 + OY };
    this.activePlatform = null;
    this.enterTimer = 0;       // counts up while on a platform
    this.enterGame = null;     // game id pending
    this.lockout = 0;          // prevents instant re-entry after returning
    this.t = 0;
    this.dust = new Particles();
    this.trail = [];
    this.npcs = [];
    this.build();
    this.populateNpcs();
  }
  build() {
    this.furn = [];
    const wall = 22;
    // CEO office walls (top section, y=0 to OY)
    this.walls = [
      { x: 0, y: 0, w: WORLD_W, h: wall }, { x: 0, y: WORLD_H - wall, w: WORLD_W, h: wall },
      { x: 0, y: 0, w: wall, h: WORLD_H }, { x: WORLD_W - wall, y: 0, w: wall, h: WORLD_H },
      // dividing wall between CEO office and main office (with doorway gap at center)
      { x: 0, y: OY, w: 400, h: wall }, { x: 540, y: OY, w: 420, h: wall },
    ];
    // === CEO office (David's office, top section) ===
    this.ceoDesk = { x: 360, y: 80, w: 240, h: 70 };
    this.furn.push({ ...this.ceoDesk, type: 'ceoDesk' });
    // CEO bookshelf
    this.furn.push({ x: 60, y: 50, w: 120, h: 30, type: 'shelf' });
    // CEO plant
    this.furn.push({ x: 60, y: 130, w: 30, h: 30, type: 'plant' });
    this.furn.push({ x: 890, y: 130, w: 30, h: 30, type: 'plant' });
    // CEO couch
    this.furn.push({ x: 750, y: 50, w: 120, h: 44, type: 'couch' });
    // nameplate (decoration)
    this.ceoNameplate = { x: 380, y: 22, w: 200, h: 22 };

    // === Main office (shifted down by OY) ===
    // reception desk (top-left)
    this.furn.push({ x: 60, y: 70 + OY, w: 150, h: 44, type: 'reception' });
    // whiteboard with logo (decoration, not collision)
    this.logoBoard = { x: 384, y: 22 + OY, w: 192, h: 70 };
    // engineering desk bays
    const bays = [
      [70, 200 + OY], [250, 200 + OY], [640, 200 + OY], [820, 200 + OY],
      [70, 320 + OY], [250, 320 + OY], [640, 320 + OY], [820, 320 + OY],
    ];
    for (const [bx, by] of bays) this.furn.push({ x: bx, y: by, w: 86, h: 56, type: 'desk', hue: rand(0, 360) });
    // meeting table (center)
    this.furn.push({ x: 410, y: 250 + OY, w: 140, h: 70, type: 'table' });
    // plants
    this.furn.push({ x: 40, y: 150 + OY, w: 30, h: 30, type: 'plant' });
    this.furn.push({ x: 890, y: 150 + OY, w: 30, h: 30, type: 'plant' });
    this.furn.push({ x: 40, y: 660 + OY, w: 30, h: 30, type: 'plant' });
    this.furn.push({ x: 890, y: 660 + OY, w: 30, h: 30, type: 'plant' });
    // water cooler
    this.furn.push({ x: 430, y: 470 + OY, w: 34, h: 34, type: 'cooler' });
    // couch (lounge)
    this.furn.push({ x: 70, y: 470 + OY, w: 120, h: 44, type: 'couch' });
    // bookshelf
    this.furn.push({ x: 770, y: 470 + OY, w: 120, h: 30, type: 'shelf' });
    // coffee machine
    this.furn.push({ x: 600, y: 470 + OY, w: 40, h: 34, type: 'coffee' });
    // claw machine (top-right corner of main office)
    this.claw = { x: 820, y: 90 + OY, w: 80, h: 64 };
    // platforms (bottom row)
    this.platforms = [
      { ...GAMES[0], x: 200, y: 600 + OY, w: 120, h: 80 },
      { ...GAMES[1], x: 480, y: 600 + OY, w: 120, h: 80 },
      { ...GAMES[2], x: 760, y: 600 + OY, w: 120, h: 80 },
    ];
    // CEO boss platform (in David's office, in front of his desk)
    this.bossPlatform = { ...GAMES[3], x: 480, y: 170, w: 100, h: 60 };
    // collision boxes = walls + furniture (claw machine too)
    this.solid = [...this.walls, ...this.furn, { ...this.claw, type: 'claw' }, { ...this.ceoDesk, type: 'ceoDesk' }];
  }
  // Define activity spots for collected employees
  populateNpcs() {
    this.npcs = [];
    const owned = Store.owned;
    if (!owned.length) return;
    // Desk seats (sit and type) — match the desk bay positions
    const deskSeats = [
      { x: 113, y: 265 + OY, type: 'type' },   // desk bay [70, 200+OY] w=86 -> center 113, seat in front
      { x: 293, y: 265 + OY, type: 'type' },
      { x: 683, y: 265 + OY, type: 'type' },
      { x: 863, y: 265 + OY, type: 'type' },
      { x: 113, y: 385 + OY, type: 'phone' },
      { x: 293, y: 385 + OY, type: 'write' },
      { x: 683, y: 385 + OY, type: 'type' },
      { x: 863, y: 385 + OY, type: 'write' },
      // reception
      { x: 135, y: 135 + OY, type: 'phone' },
      // lounge couch
      { x: 130, y: 510 + OY, type: 'lounge' },
      // meeting table seats
      { x: 430, y: 335 + OY, type: 'write' },
      { x: 530, y: 335 + OY, type: 'write' },
      // coffee machine area
      { x: 580, y: 515 + OY, type: 'lounge' },
      // water cooler
      { x: 470, y: 515 + OY, type: 'lounge' },
      // CEO office couch
      { x: 810, y: 95, type: 'lounge' },
      // walking paths
      { x: 0, y: 0, type: 'walk', path: [[200, 450 + OY], [760, 450 + OY], [760, 550 + OY], [200, 550 + OY]] },
      { x: 0, y: 0, type: 'walk', path: [[300, 450 + OY], [600, 450 + OY], [600, 620 + OY], [300, 620 + OY]] },
      { x: 0, y: 0, type: 'walk', path: [[100, 400 + OY], [860, 400 + OY]] },
    ];
    // Assign owned employees to spots (capped at available spots)
    const walkSpots = deskSeats.filter(s => s.type === 'walk');
    const sitSpots = deskSeats.filter(s => s.type !== 'walk');
    let sitIdx = 0, walkIdx = 0;
    for (const name of owned) {
      if (name === 'David') continue; // David is at his desk already
      const desc = descriptor(name);
      if (sitIdx < sitSpots.length) {
        const spot = sitSpots[sitIdx++];
        this.npcs.push({
          name, desc, type: spot.type,
          x: spot.x, y: spot.y, baseX: spot.x, baseY: spot.y,
          anim: rand(0, TAU), phase: rand(0, TAU), face: 1,
          walkPath: null, walkIdx: 0, walkT: 0,
        });
      } else if (walkIdx < walkSpots.length) {
        const spot = walkSpots[walkIdx++];
        this.npcs.push({
          name, desc, type: 'walk',
          x: spot.path[0][0], y: spot.path[0][1],
          baseX: spot.path[0][0], baseY: spot.path[0][1],
          anim: 0, phase: rand(0, TAU), face: 1,
          walkPath: spot.path, walkIdx: 0, walkT: 0,
        });
      }
    }
  }
  onEnter() {
    this.player.x = this.spawn.x; this.player.y = this.spawn.y;
    this.player.vx = 0; this.player.vy = 0;
    this.lockout = 0.9;
    this.activePlatform = null; this.enterTimer = 0; this.enterGame = null;
    this.populateNpcs();
  }
  update(dt) {
    this.t += dt;
    if (this.lockout > 0) this.lockout -= dt;

    // ---- movement ----
    const ax = Input.axis();
    const len = Math.hypot(ax.x, ax.y) || 1;
    const sp = this.player.speed;
    this.player.vx = (ax.x / len) * sp * (ax.x || ax.y ? 1 : 0);
    this.player.vy = (ax.y / len) * sp * (ax.x || ax.y ? 1 : 0);
    if (ax.x) this.player.face = ax.x < 0 ? -1 : 1;
    if (ax.x || ax.y) this.player.anim += dt * 10; else this.player.anim = 0;

    // move + collide (axis separated)
    this.moveAxis(this.player.vx * dt, 0);
    this.moveAxis(0, this.player.vy * dt);
    this.player.x = clamp(this.player.x, 30, WORLD_W - 30);
    this.player.y = clamp(this.player.y, 40, WORLD_H - 30);

    // camera follow — snap if player is off-screen, otherwise smooth follow
    const screenY = this.player.y - this.cam.y;
    const targetCam = clamp(this.player.y - H / 2 - 20, 0, WORLD_H - H);
    // if player is outside the visible band, snap camera immediately
    if (screenY < 60 || screenY > H - 80) {
      this.cam.y = targetCam;
    } else {
      this.cam.y = lerp(this.cam.y, targetCam, 1 - Math.pow(0.001, dt));
    }

    // press R to recenter on player (in case they get lost)
    if (Input.pressed('r')) { this.cam.y = targetCam; Sfx.click(); }

    // ---- platform activation ----
    let onPlat = null;
    // check regular platforms
    for (const p of this.platforms) {
      const px = this.player.x, py = this.player.y;
      if (px > p.x - p.w / 2 - 20 && px < p.x + p.w / 2 + 20 && py > p.y - p.h / 2 - 10 && py < p.y + p.h / 2 + 30) {
        onPlat = p; break;
      }
    }
    // check boss platform
    if (!onPlat) {
      const bp = this.bossPlatform;
      const px = this.player.x, py = this.player.y;
      if (px > bp.x - bp.w / 2 - 20 && px < bp.x + bp.w / 2 + 20 && py > bp.y - bp.h / 2 - 10 && py < bp.y + bp.h / 2 + 30) {
        onPlat = bp;
      }
    }
    // claw machine proximity
    let nearClaw = false;
    if (px2(this.player, this.claw, 60)) nearClaw = true;

    if (this.lockout <= 0) {
      if (onPlat) {
        if (this.activePlatform !== onPlat) { this.activePlatform = onPlat; this.enterTimer = 0; this.enterGame = onPlat.id; }
        this.enterTimer += dt;
        if (this.enterTimer >= 1.4) { this.app.enterGame(this.enterGame); this.enterTimer = 0; }
        if (Input.pressed(' ') || Input.pressed('enter')) { this.app.enterGame(onPlat.id); this.enterTimer = 0; }
      } else if (nearClaw) {
        this.activePlatform = null;
        if ((Input.pressed(' ') || Input.pressed('enter') || this.clickWorld(this.claw)) && !pointer.consumed) {
          pointer.consumed = true; this.app.openShop();
        }
      } else {
        this.activePlatform = null; this.enterTimer = 0; this.enterGame = null;
      }
      // click a platform to enter instantly
      if (onPlat && this.clickWorld({ x: onPlat.x - 60, y: onPlat.y - 40, w: 120, h: 80 }) && !pointer.consumed) {
        pointer.consumed = true; this.app.enterGame(onPlat.id);
      }
    } else {
      this.activePlatform = null;
    }

    // dust motes
    if (Math.random() < dt * 6) this.dust.burst(rand(0, W), rand(0, H) + this.cam.y, 1, { color: 'rgba(255,255,255,0.25)', speed: 8, life: 4, size: 2 });
    this.dust.update(dt);

    // update NPCs
    this.updateNpcs(dt);

    // glowing trail when all stickers collected
    if (Store.allStickersCollected()) {
      this.trail.push({ x: this.player.x, y: this.player.y - 20, life: 0.8, max: 0.8, hue: (this.t * 120) % 360 });
      if (this.trail.length > 30) this.trail.shift();
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= dt;
      if (this.trail[i].life <= 0) this.trail.splice(i, 1);
    }
  }
  moveAxis(dx, dy) {
    this.player.x += dx; this.player.y += dy;
    const pb = this.feetBox();
    for (const s of this.solid) {
      const sb = { x: s.x, y: s.y, w: s.w, h: s.h };
      if (pb.x < sb.x + sb.w && pb.x + pb.w > sb.x && pb.y < sb.y + sb.h && pb.y + pb.h > sb.y) {
        if (dx > 0) this.player.x = sb.x - pb.w - 0.01;
        else if (dx < 0) this.player.x = sb.x + sb.w + 0.01;
        if (dy > 0) this.player.y = sb.y - pb.h - 0.01;
        else if (dy < 0) this.player.y = sb.y + sb.h + 0.01;
        pb.x = this.player.x - pb.w / 2; pb.y = this.player.y - pb.h;
      }
    }
  }
  feetBox() { return { x: this.player.x - 9, y: this.player.y - 8, w: 18, h: 16 }; }
  clickWorld(box) {
    if (!pointer.clicked || pointer.consumed) return false;
    const wx = pointer.x, wy = pointer.y + this.cam.y;
    return wx >= box.x && wx <= box.x + box.w && wy >= box.y && wy <= box.y + box.h;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(0, -this.cam.y);
    this.drawFloor(ctx);
    // CEO office decorations
    this.drawCeoOffice(ctx);
    // spawn pad
    this.drawSpawnPad(ctx);
    // furniture (sorted by y for depth)
    const items = [...this.furn, { ...this.claw, type: 'claw' }].sort((a, b) => (a.y + a.h) - (b.y + b.h));
    for (const f of items) this.drawFurniture(ctx, f);
    // logo board on wall
    this.drawLogoBoard(ctx);
    // NPCs (collected employees working in the office)
    this.drawNpcs(ctx);
    // platforms
    for (const p of this.platforms) this.drawPlatform(ctx, p);
    // boss platform
    this.drawPlatform(ctx, this.bossPlatform);
    // glowing trail (drawn before player)
    this.drawTrail(ctx);
    // player
    this.drawPlayer(ctx);
    this.dust.draw(ctx);
    ctx.restore();

    // screen-space prompts
    this.drawPrompts(ctx);
  }
  drawCeoOffice(ctx) {
    // different floor color for CEO office
    ctx.fillStyle = '#d8c8a0'; ctx.fillRect(22, 22, WORLD_W - 44, OY - 22);
    // tile grid
    ctx.strokeStyle = 'rgba(160,130,80,0.15)'; ctx.lineWidth = 1;
    for (let x = TILE; x < WORLD_W; x += TILE) { ctx.beginPath(); ctx.moveTo(x, 22); ctx.lineTo(x, OY); ctx.stroke(); }
    for (let y = TILE; y < OY; y += TILE) { ctx.beginPath(); ctx.moveTo(22, y); ctx.lineTo(WORLD_W - 22, y); ctx.stroke(); }
    // fancy rug under desk
    ctx.save(); ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#8a3a3a'; roundRectC(ctx, 320, 40, 320, 100, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; roundRectC(ctx, 332, 52, 296, 76, 4); ctx.fill();
    ctx.restore();
    // nameplate on wall
    const np = this.ceoNameplate;
    ctx.fillStyle = '#2a1f3a'; roundRectC(ctx, np.x, np.y, np.w, np.h, 4); ctx.fill();
    ctx.fillStyle = PALETTE.gold; roundRectC(ctx, np.x + 2, np.y + 2, np.w - 4, np.h - 4, 3); ctx.fill();
    pxTextCenter(ctx, 'DAVID  CEO', np.x + np.w / 2, np.y + 6, 2, '#2a1f3a');
    // doorway label
    pxTextCenter(ctx, 'CEO OFFICE', 480, OY - 4, 2, 'rgba(120,90,40,0.5)');
  }
  drawFloor(ctx) {
    // base
    ctx.fillStyle = '#cfd6e6'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // carpet border (main office only)
    ctx.fillStyle = '#b9c2d8'; ctx.fillRect(22, OY, WORLD_W - 44, WORLD_H - OY - 44);
    // tile grid (main office)
    ctx.strokeStyle = 'rgba(120,130,160,0.18)'; ctx.lineWidth = 1;
    for (let x = TILE; x < WORLD_W; x += TILE) { ctx.beginPath(); ctx.moveTo(x, OY); ctx.lineTo(x, WORLD_H - 22); ctx.stroke(); }
    for (let y = OY + TILE; y < WORLD_H; y += TILE) { ctx.beginPath(); ctx.moveTo(22, y); ctx.lineTo(WORLD_W - 22, y); ctx.stroke(); }
    // meeting rug
    ctx.save(); ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#7b6bd6'; roundRectC(ctx, 390, 240 + OY, 180, 90, 10); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; roundRectC(ctx, 404, 254 + OY, 152, 62, 6); ctx.fill();
    ctx.restore();
    // wall top highlight
    ctx.fillStyle = '#9aa3bd'; ctx.fillRect(0, 0, WORLD_W, 22);
    ctx.fillStyle = '#7f88a4'; ctx.fillRect(0, 0, WORLD_W, 6);
    // dividing wall highlight
    ctx.fillStyle = '#9aa3bd'; ctx.fillRect(0, OY, 400, 4); ctx.fillRect(540, OY, 420, 4);
  }
  drawSpawnPad(ctx) {
    const { x, y } = this.spawn;
    const p = 0.5 + Math.sin(this.t * 2) * 0.2;
    ctx.save();
    ctx.globalAlpha = 0.5 * p;
    const g = ctx.createRadialGradient(x, y, 4, x, y, 40);
    g.addColorStop(0, 'rgba(0,224,198,0.6)'); g.addColorStop(1, 'rgba(0,224,198,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 40, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = 'rgba(0,224,198,0.7)'; ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]); ctx.lineDashOffset = -this.t * 12;
    ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    pxTextCenter(ctx, 'HOME', x, y - 4, 2, 'rgba(0,180,160,0.8)');
    ctx.restore();
  }
  drawLogoBoard(ctx) {
    const b = this.logoBoard;
    ctx.save();
    ctx.fillStyle = '#e9edf7'; roundRectC(ctx, b.x, b.y, b.w, b.h, 6); ctx.fill();
    ctx.fillStyle = '#d4dae8'; ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
    pxText(ctx, 'WELCOME', b.x + 16, b.y + 20, 3, '#2a3050');
    pxText(ctx, 'HAVE A NICE DAY', b.x + 16, b.y + 44, 2, '#6b7393');
    ctx.restore();
  }
  drawPlatform(ctx, p) {
    const active = this.activePlatform === p;
    const cy = p.y - 30 + Math.sin(this.t * 2) * 4;
    ctx.save();
    // pad
    ctx.globalAlpha = active ? 0.9 : 0.55;
    const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 70);
    g.addColorStop(0, p.color + 'cc'); g.addColorStop(1, p.color + '00');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, 64, 34, 0, 0, TAU); ctx.fill();
    // ring
    ctx.globalAlpha = active ? 1 : 0.7;
    ctx.strokeStyle = p.color; ctx.lineWidth = active ? 3 : 2;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 54, 28, 0, 0, TAU); ctx.stroke();
    // beam
    ctx.globalAlpha = active ? 0.22 : 0.10;
    const bg = ctx.createLinearGradient(0, cy - 120, 0, cy);
    bg.addColorStop(0, p.color + '00'); bg.addColorStop(1, p.color + 'aa');
    ctx.fillStyle = bg; ctx.beginPath();
    ctx.moveTo(p.x - 30, cy); ctx.lineTo(p.x + 30, cy); ctx.lineTo(p.x + 18, cy - 120); ctx.lineTo(p.x - 18, cy - 120); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    // floating cabinet icon
    this.drawCabinetIcon(ctx, p.x, cy - 80, p.color, active);
    // label
    pxTextCenter(ctx, p.name, p.x, cy - 110, 3, '#fff');
    pxTextCenter(ctx, p.diff + '  +' + p.reward, p.x, cy - 92, 2, p.color);
    // enter progress
    if (active && this.enterTimer > 0) {
      const r = this.enterTimer / 1.4;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, 38, -Math.PI / 2, -Math.PI / 2 + r * TAU); ctx.stroke();
    }
    ctx.restore();
  }
  drawCabinetIcon(ctx, x, y, color, glow) {
    ctx.save();
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 16; }
    ctx.fillStyle = '#222a40'; roundRectC(ctx, x - 16, y - 24, 32, 40, 3); ctx.fill();
    ctx.fillStyle = color; ctx.fillRect(x - 12, y - 20, 24, 18);
    ctx.fillStyle = '#0a0e18'; ctx.fillRect(x - 10, y - 18, 20, 14);
    ctx.fillStyle = color; ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = '#222a40'; ctx.fillRect(x - 16, y + 16, 32, 4);
    ctx.restore();
  }
  drawPlayer(ctx) {
    const p = this.player;
    // shadow
    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 12, 5, 0, 0, TAU); ctx.fill(); ctx.restore();
    const bob = Math.sin(p.anim) * 1.5;
    // aura glow when all stickers collected
    if (Store.allStickersCollected()) {
      ctx.save();
      const r = 30 + Math.sin(this.t * 3) * 6;
      const g = ctx.createRadialGradient(p.x, p.y - 20, 0, p.x, p.y - 20, r);
      g.addColorStop(0, 'rgba(255,207,77,0.3)'); g.addColorStop(1, 'rgba(255,207,77,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y - 20, r, 0, TAU); ctx.fill();
      ctx.restore();
    }
    drawCharacter(ctx, p.x, p.y - 40 + bob, 2, PLAYER_DESC, { t: this.t, flip: p.face < 0 });
  }
  drawTrail(ctx) {
    if (this.trail.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const a = p.life / p.max;
      const size = a * 8 + 2;
      const hue = p.hue;
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
      ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }
  updateNpcs(dt) {
    for (const npc of this.npcs) {
      npc.anim += dt;
      if (npc.type === 'walk' && npc.walkPath) {
        npc.walkT += dt * 60; // speed
        const from = npc.walkPath[npc.walkIdx];
        const to = npc.walkPath[(npc.walkIdx + 1) % npc.walkPath.length];
        const segLen = dist(from[0], from[1], to[0], to[1]);
        const k = clamp(npc.walkT / segLen, 0, 1);
        npc.x = lerp(from[0], to[0], k);
        npc.y = lerp(from[1], to[1], k);
        npc.face = to[0] < from[0] ? -1 : 1;
        if (k >= 1) { npc.walkIdx = (npc.walkIdx + 1) % npc.walkPath.length; npc.walkT = 0; }
      }
    }
  }
  drawNpcs(ctx) {
    // sort by y for depth
    const sorted = [...this.npcs].sort((a, b) => a.y - b.y);
    for (const npc of sorted) {
      const bob = Math.sin(npc.anim * 2.4 + npc.phase) * 0.6;
      // shadow
      ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(npc.x, npc.y + 2, 10, 4, 0, 0, TAU); ctx.fill(); ctx.restore();

      if (npc.type === 'type') {
        // sitting at desk, typing — small bob, facing desk
        const typeBob = Math.sin(npc.anim * 8) * 1;
        drawCharacter(ctx, npc.x, npc.y - 38 + typeBob, 2, npc.desc, { t: this.t, flip: false });
      } else if (npc.type === 'phone') {
        // phone call — slight sway
        const sway = Math.sin(npc.anim * 1.5 + npc.phase) * 2;
        drawCharacter(ctx, npc.x + sway, npc.y - 38, 2, npc.desc, { t: this.t, flip: npc.face < 0 });
        // phone icon
        ctx.fillStyle = '#2a2f44'; ctx.fillRect(npc.x + sway + 6, npc.y - 52, 4, 6);
      } else if (npc.type === 'write') {
        // writing — lean forward
        const lean = Math.sin(npc.anim * 3 + npc.phase) * 1;
        drawCharacter(ctx, npc.x, npc.y - 38 + lean, 2, npc.desc, { t: this.t, flip: false });
      } else if (npc.type === 'lounge') {
        // lounging — relaxed bob
        drawCharacter(ctx, npc.x, npc.y - 36 + bob, 2, npc.desc, { t: this.t, flip: npc.face < 0 });
      } else if (npc.type === 'walk') {
        // walking
        const walkBob = Math.sin(npc.anim * 10) * 1.5;
        drawCharacter(ctx, npc.x, npc.y - 38 + walkBob, 2, npc.desc, { t: this.t, flip: npc.face < 0 });
      }
    }
  }
  drawFurniture(ctx, f) {
    ctx.save();
    switch (f.type) {
      case 'desk': this.desk(ctx, f); break;
      case 'ceoDesk': this.ceoDeskDraw(ctx, f); break;
      case 'reception': this.reception(ctx, f); break;
      case 'table': this.table(ctx, f); break;
      case 'plant': this.plant(ctx, f); break;
      case 'cooler': this.cooler(ctx, f); break;
      case 'couch': this.couch(ctx, f); break;
      case 'shelf': this.shelf(ctx, f); break;
      case 'coffee': this.coffee(ctx, f); break;
      case 'claw': this.clawMachine(ctx, f); break;
    }
    ctx.restore();
  }
  ceoDeskDraw(ctx, f) {
    this.shadowBox(ctx, f.x, f.y, f.w, f.h);
    // executive desk — darker, richer wood
    const g = ctx.createLinearGradient(f.x, f.y, f.x, f.y + f.h);
    g.addColorStop(0, '#8a5a2a'); g.addColorStop(1, '#6a4220');
    ctx.fillStyle = g; roundRectC(ctx, f.x, f.y, f.w, f.h, 6); ctx.fill();
    ctx.fillStyle = '#5a3618'; ctx.fillRect(f.x, f.y + f.h - 8, f.w, 8);
    // big monitor
    ctx.fillStyle = '#1a1f30'; roundRectC(ctx, f.x + f.w / 2 - 40, f.y - 36, 80, 30, 3); ctx.fill();
    ctx.fillStyle = '#2a3050'; ctx.fillRect(f.x + f.w / 2 - 37, f.y - 33, 74, 24);
    ctx.fillStyle = '#39d2a0'; ctx.fillRect(f.x + f.w / 2 - 33, f.y - 30, 66, 18);
    // name plate on desk
    ctx.fillStyle = PALETTE.gold; ctx.fillRect(f.x + 10, f.y + 8, 50, 12);
    pxText(ctx, 'DAVID', f.x + 14, f.y + 11, 1, '#2a1f3a');
    // coffee mug
    ctx.fillStyle = '#e25c5c'; ctx.fillRect(f.x + f.w - 24, f.y - 8, 14, 12);
    // chair behind desk
    ctx.fillStyle = '#2a1f3a'; roundRectC(ctx, f.x + f.w / 2 - 20, f.y + f.h + 4, 40, 30, 6); ctx.fill();
    ctx.fillStyle = '#1a1525'; ctx.fillRect(f.x + f.w / 2 - 20, f.y + f.h + 4, 40, 8);
  }
  shadowBox(ctx, x, y, w, h) { ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#000'; roundRectC(ctx, x + 3, y + 4, w, h, 6); ctx.fill(); ctx.restore(); }
  desk(ctx, f) {
    this.shadowBox(ctx, f.x, f.y, f.w, f.h);
    ctx.fillStyle = '#d8b072'; roundRectC(ctx, f.x, f.y, f.w, f.h, 5); ctx.fill();
    ctx.fillStyle = '#c29658'; ctx.fillRect(f.x, f.y + f.h - 6, f.w, 6);
    ctx.fillStyle = '#5b6b8c'; ctx.fillRect(f.x + 8, f.y - 16, 30, 18); // monitor stand
    ctx.fillStyle = '#0e1320'; roundRectC(ctx, f.x + 6, f.y - 26, 34, 22, 2); ctx.fill();
    ctx.fillStyle = '#39d2a0'; ctx.fillRect(f.x + 9, f.y - 23, 28, 16);
    ctx.fillStyle = '#1a2030'; ctx.fillRect(f.x + f.w / 2 - 6, f.y + 8, 12, 4); // keyboard
    // chair
    ctx.fillStyle = '#2a2f44'; roundRectC(ctx, f.x + f.w / 2 - 10, f.y + f.h + 4, 20, 12, 4); ctx.fill();
  }
  reception(ctx, f) {
    this.shadowBox(ctx, f.x, f.y, f.w, f.h);
    ctx.fillStyle = '#8a93b4'; roundRectC(ctx, f.x, f.y, f.w, f.h, 6); ctx.fill();
    ctx.fillStyle = '#6b7393'; ctx.fillRect(f.x, f.y + f.h - 8, f.w, 8);
    pxTextCenter(ctx, 'RECEPTION', f.x + f.w / 2, f.y + 12, 2, '#fff');
    // bell
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(f.x + f.w - 18, f.y + 16, 5, 0, TAU); ctx.fill();
  }
  table(ctx, f) {
    this.shadowBox(ctx, f.x, f.y, f.w, f.h);
    ctx.fillStyle = '#9aa3bd'; roundRectC(ctx, f.x, f.y, f.w, f.h, 8); ctx.fill();
    ctx.fillStyle = '#b9c2d8'; roundRectC(ctx, f.x + 4, f.y + 4, f.w - 8, f.h - 8, 6); ctx.fill();
  }
  plant(ctx, f) {
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(f.x + 4, f.y + 14, f.w - 8, 16);
    const g = ctx.createLinearGradient(0, f.y, 0, f.y + 20);
    g.addColorStop(0, '#43c97a'); g.addColorStop(1, '#2e8c5a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x + f.w / 2, f.y + 8, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2e8c5a'; ctx.beginPath(); ctx.arc(f.x + f.w / 2 - 8, f.y + 2, 8, 0, TAU); ctx.fill();
  }
  cooler(ctx, f) {
    this.shadowBox(ctx, f.x, f.y - 20, f.w, f.h + 20);
    ctx.fillStyle = '#d9dbe6'; roundRectC(ctx, f.x, f.y - 20, f.w, f.h + 20, 4); ctx.fill();
    ctx.fillStyle = '#5db8ff'; ctx.fillRect(f.x + 4, f.y - 16, f.w - 8, 18);
    ctx.fillStyle = '#9aa0b4'; ctx.fillRect(f.x + f.w / 2 - 3, f.y + 4, 6, 8);
  }
  couch(ctx, f) {
    this.shadowBox(ctx, f.x, f.y, f.w, f.h);
    ctx.fillStyle = '#7b5cff'; roundRectC(ctx, f.x, f.y, f.w, f.h, 8); ctx.fill();
    ctx.fillStyle = '#6a4ce0'; roundRectC(ctx, f.x, f.y, f.w, 12, 6); ctx.fill();
    ctx.fillStyle = '#9b7eff'; ctx.fillRect(f.x + 6, f.y + 16, f.w - 12, 8);
  }
  shelf(ctx, f) {
    this.shadowBox(ctx, f.x, f.y - 30, f.w, f.h + 30);
    ctx.fillStyle = '#6b4226'; roundRectC(ctx, f.x, f.y - 30, f.w, f.h + 30, 3); ctx.fill();
    const cols = ['#e25c5c', '#5c8ae2', '#43c97a', '#e2a35c', '#9b5ce2'];
    for (let i = 0; i < 8; i++) { ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(f.x + 6 + i * 14, f.y - 26, 10, 22); }
  }
  coffee(ctx, f) {
    this.shadowBox(ctx, f.x, f.y - 6, f.w, f.h + 6);
    ctx.fillStyle = '#2a2f44'; roundRectC(ctx, f.x, f.y - 6, f.w, f.h + 6, 4); ctx.fill();
    ctx.fillStyle = '#1a1f30'; ctx.fillRect(f.x + 6, f.y, f.w - 12, 12);
    ctx.fillStyle = '#6b4226'; ctx.fillRect(f.x + 10, f.y + 2, 8, 8);
  }
  clawMachine(ctx, f) {
    const active = px2(this.player, f, 60) && this.lockout <= 0;
    const isVending = Store.allStickersCollected();
    ctx.save();
    if (active) { ctx.shadowColor = isVending ? PALETTE.accent : PALETTE.gold; ctx.shadowBlur = 16 + Math.sin(this.t * 4) * 6; }
    if (isVending) {
      // vending machine
      ctx.fillStyle = '#1a3a30'; roundRectC(ctx, f.x, f.y, f.w, f.h + 40, 4); ctx.fill();
      ctx.fillStyle = '#0c2018'; roundRectC(ctx, f.x + 4, f.y + 4, f.w - 8, f.h + 20, 3); ctx.fill();
      // snack slots
      const snackCols = ['#e2a35c', '#43d17a', '#e25c5c', '#ffd23f', '#b07bff'];
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(f.x + 8 + i * 13, f.y + 8, 10, 16);
        ctx.fillStyle = snackCols[i]; ctx.fillRect(f.x + 10 + i * 13, f.y + 10, 6, 12);
      }
      // dispenser slot
      ctx.fillStyle = '#000'; ctx.fillRect(f.x + f.w / 2 - 12, f.y + f.h + 10, 24, 8);
      // buttons
      for (let i = 0; i < 3; i++) { ctx.fillStyle = (Math.sin(this.t * 3 + i) > 0) ? PALETTE.accent : '#1a3a30'; ctx.beginPath(); ctx.arc(f.x + 20 + i * 18, f.y + f.h + 2, 4, 0, TAU); ctx.fill(); }
      pxTextCenter(ctx, 'SNACKS', f.x + f.w / 2, f.y - 10, 2, PALETTE.accent);
    } else {
      // claw machine (original)
      ctx.fillStyle = '#3a2a4a'; roundRectC(ctx, f.x, f.y + 40, f.w, 24, 4); ctx.fill();
      ctx.fillStyle = 'rgba(120,180,255,0.12)'; roundRectC(ctx, f.x, f.y, f.w, 44, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; roundRectC(ctx, f.x, f.y, f.w, 44, 4); ctx.stroke();
      ctx.fillStyle = '#9aa3bd'; ctx.fillRect(f.x + 4, f.y + 4, f.w - 8, 4);
      const cx = f.x + f.w / 2 + Math.sin(this.t) * 18;
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(cx - 2, f.y + 8, 4, 10);
      ctx.fillStyle = '#e8a35c';
      ctx.beginPath(); ctx.moveTo(cx - 6, f.y + 18); ctx.lineTo(cx + 6, f.y + 18); ctx.lineTo(cx + 3, f.y + 24); ctx.lineTo(cx, f.y + 20); ctx.lineTo(cx - 3, f.y + 24); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = ['#e25c5c', '#5db8ff', '#43d17a', '#ffd23f', '#b07bff'][i];
        ctx.beginPath(); ctx.arc(f.x + 14 + i * 13, f.y + 36, 5, 0, TAU); ctx.fill();
      }
      pxTextCenter(ctx, 'SHOP', f.x + f.w / 2, f.y - 10, 2, PALETTE.gold);
    }
    if (active) pxTextCenter(ctx, 'PRESS SPACE', f.x + f.w / 2, f.y + 70, 2, '#fff');
    ctx.restore();
  }
  drawPrompts(ctx) {
    // platform info card when standing on one
    const p = this.activePlatform;
    if (p && this.lockout <= 0) {
      const w = 360, h = 96, x = W / 2 - w / 2, y = H - h - 16;
      ctx.save();
      ctx.globalAlpha = 0.96;
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#11172a'; roundRectC(ctx, x, y, w, h, 12); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = p.color; ctx.lineWidth = 2; roundRectC(ctx, x + 1, y + 1, w - 2, h - 2, 11); ctx.stroke();
      pxText(ctx, p.name, x + 16, y + 14, 3, '#fff');
      pxText(ctx, p.diff + '  +' + p.reward + ' COINS', x + 56, y + 40, 2, p.color);
      pxText(ctx, p.desc, x + 16, y + 64, 2, PALETTE.dim);
      ctx.restore();
    }
    // controls hint (fade after movement)
    if (this.t < 8) {
      const a = clamp((8 - this.t) / 2, 0, 1);
      ctx.save(); ctx.globalAlpha = a;
      pxTextCenter(ctx, 'WASD/ARROWS MOVE   SPACE INTERACT   R RECENTER', W / 2, H - 30, 2, 'rgba(255,255,255,0.7)');
      ctx.restore();
    }
    // off-screen player indicator
    this.drawOffscreenIndicator(ctx);
  }
  drawOffscreenIndicator(ctx) {
    const sy = this.player.y - this.cam.y;
    const sx = this.player.x;
    // player is visible — no indicator needed
    if (sy > 20 && sy < H - 20 && sx > 20 && sx < W - 20) return;
    // clamp arrow to screen edge
    const ay = clamp(sy, 30, H - 30);
    const ax = clamp(sx, 30, W - 30);
    const dy = sy < 20 ? -1 : (sy > H - 20 ? 1 : 0);
    const dx = sx < 20 ? -1 : (sx > W - 20 ? 1 : 0);
    ctx.save();
    ctx.translate(ax, ay);
    if (dy) ctx.rotate(dy > 0 ? Math.PI / 2 : -Math.PI / 2);
    if (dx < 0 && !dy) ctx.rotate(Math.PI);
    // pulsing arrow
    const pulse = 0.7 + Math.sin(this.t * 6) * 0.3;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 4); ctx.lineTo(-10, 4); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function px2(p, b, pad = 0) {
  return p.x > b.x - pad && p.x < b.x + b.w + pad && p.y > b.y - pad && p.y < b.y + b.h + pad;
}
