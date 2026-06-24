// main.js — ArcAIdia app: state machine, loop, scaling, audio, side shop button
import { W, H, init, setView, endFrame, button, pointer, Input } from './ui.js';
import { clamp, lerp, rand, TAU, PALETTE, pxText, pxTextCenter, updateShake, applyShake, Store, roundRect as roundRectS } from './util.js';
import { descriptor, drawCharacter, EMPLOYEES } from './characters.js';
import { initAudio, resumeAudio, playMusic, Audio, Sfx } from './audio.js';
import { HUD, setMusicHook } from './hud.js';
import { Office, GAMES } from './office.js';
import { RushHour } from './rushhour.js';
import { CrossyRoad } from './crossyroad.js';
import { Fighting } from './fighting.js';
import { ClawShop } from './clawshop.js';
import { BossGame } from './bossgame.js';

const GAME_FOR = { rush: { scene: 'rush', music: 'rush' }, crossy: { scene: 'crossy', music: 'crossy' }, fight: { scene: 'fight', music: 'fight' }, boss: { scene: 'boss', music: 'fight' } };

class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.state = 'title';
    this.hud = new HUD();
    this.scenes = {
      office: new Office(this),
      rush: new RushHour(this),
      crossy: new CrossyRoad(this),
      fight: new Fighting(this),
      boss: new BossGame(this),
      shop: new ClawShop(this),
    };
    this.scenes.office.onEnter();
    this.last = performance.now();
    this.music = 'hub';
    setMusicHook(() => playMusic(this.music));
    this.titleT = 0;
    this.titleClouds = Array.from({ length: 5 }, () => ({
      x: rand(0, W), y: rand(10, 80), s: rand(0.5, 1.2), spd: rand(4, 12),
    }));
    this.titleChars = [
      { desc: descriptor('Saria'), x: -60, dir: 1, spd: 30 },
      { desc: descriptor('Misaki'), x: W + 60, dir: -1, spd: 26 },
    ];
    this.titleBuildings = [
      { x: -10, w: 95, h: 110, c: '#9aa6c4' },
      { x: 85, w: 70, h: 85, c: '#8893b4' },
      { x: 155, w: 110, h: 140, c: '#9aa6c4' },
      { x: 265, w: 60, h: 95, c: '#7f8aaa' },
      { x: 325, w: 85, h: 120, c: '#9aa6c4' },
      { x: 550, w: 75, h: 100, c: '#8893b4' },
      { x: 625, w: 100, h: 150, c: '#9aa6c4', sign: true },
      { x: 725, w: 65, h: 90, c: '#7f8aaa' },
      { x: 790, w: 90, h: 130, c: '#9aa6c4' },
      { x: 880, w: 80, h: 105, c: '#8893b4' },
    ];
    this.titleIcons = [
      { x: 150, y: 360, ph: 0, type: 'desk' },
      { x: 810, y: 370, ph: 1.6, type: 'car' },
      { x: 480, y: 340, ph: 3.1, type: 'sword' },
    ];
  }
  get ctx2d() { return this.ctx; }

  enterGame(id) {
    const g = GAME_FOR[id];
    if (!g) return;
    this.state = g.scene;
    this.scenes[g.scene].onEnter();
    this.music = g.music; playMusic(this.music);
    Sfx.door();
  }
  exitGame(outcome, reward) {
    if (outcome === 'win' && reward > 0) {
      Store.addCoins(reward);
      this.hud.addToast('+' + reward + ' COINS!', PALETTE.gold);
      this.hud.flashCoins();
      Sfx.coin();
    } else {
      this.hud.addToast('NO COINS — TRY AGAIN', PALETTE.red);
    }
    this.state = 'office';
    this.scenes.office.onEnter();
    this.music = 'hub'; playMusic('hub');
  }
  openShop() { this.state = 'shop'; this.scenes.shop.onEnter(); Sfx.door(); }
  closeShop() { this.state = 'office'; this.scenes.office.onEnter(); }

  update(dt) {
    this.hud.update(dt);
    if (this.state === 'title') {
      this.titleT += dt;
      for (const c of this.titleChars) {
        c.x += c.dir * c.spd * dt;
        if (c.dir > 0 && c.x > W + 60) c.x = -60;
        if (c.dir < 0 && c.x < -60) c.x = W + 60;
      }
      for (const cl of this.titleClouds) { cl.x += cl.spd * dt; if (cl.x > W + 60) cl.x = -60; }
    } else if (this.state === 'office') {
      this.scenes.office.update(dt);
    } else if (this.state === 'shop') {
      this.scenes.shop.update(dt);
    } else {
      this.scenes[this.state].update(dt);
    }
    updateShake(dt);
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    applyShake(ctx);
    if (this.state === 'title') this.drawTitle(ctx);
    else {
      const s = this.state === 'shop' ? 'office' : this.state;
      // draw office behind shop
      if (this.state === 'shop') { ctx.globalAlpha = 0.25; this.scenes.office.draw(ctx); ctx.globalAlpha = 1; }
      else if (this.state === 'office') this.scenes.office.draw(ctx);
      else this.scenes[this.state].draw(ctx);

      if (this.state === 'shop') this.scenes.shop.draw(ctx);

      // side shop button on office
      if (this.state === 'office') this.drawShopButton(ctx);

      // global HUD on office & shop only
      if (this.state === 'office' || this.state === 'shop') this.hud.draw(ctx);
    }
    ctx.restore();
    // vignette
    this.drawVignette(ctx);
  }

  drawTitle(ctx) {
    const t = this.titleT;
    const sill = H * 0.58; // window sill line (interior below, sky above)

    // === day sky gradient ===
    const sky = ctx.createLinearGradient(0, 0, 0, sill);
    sky.addColorStop(0, '#6cb4e8'); sky.addColorStop(0.5, '#a8d5f0'); sky.addColorStop(1, '#d4e8f5');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, sill);

    // === sun ===
    ctx.save();
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff8d8';
    ctx.beginPath(); ctx.arc(W * 0.82, 70, 32, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.15; ctx.beginPath(); ctx.arc(W * 0.82, 70, 50, 0, TAU); ctx.fill();
    ctx.restore();

    // === clouds ===
    for (const cl of this.titleClouds) {
      ctx.save();
      ctx.globalAlpha = 0.75; ctx.fillStyle = '#fff';
      const cx = cl.x, cy = cl.y, s = cl.s;
      ctx.beginPath(); ctx.arc(cx, cy, 14 * s, 0, TAU); ctx.arc(cx + 16 * s, cy, 18 * s, 0, TAU);
      ctx.arc(cx + 34 * s, cy, 14 * s, 0, TAU); ctx.arc(cx + 16 * s, cy - 10 * s, 12 * s, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // === distant city buildings (daylight) ===
    for (const b of this.titleBuildings) {
      const by = sill - b.h;
      // building body
      ctx.fillStyle = b.c; ctx.fillRect(b.x, by, b.w, b.h);
      // darker bottom shadow
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(b.x, sill - 14, b.w, 14);
      // top edge highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(b.x, by, b.w, 3);
      // windows grid (daytime — lit and unlit)
      for (let wy = by + 10; wy < sill - 10; wy += 14) {
        for (let wx = b.x + 6; wx < b.x + b.w - 6; wx += 12) {
          const lit = ((wx * 3 + wy * 7 + b.x) % 7) < 3;
          ctx.fillStyle = lit ? 'rgba(180,210,255,0.5)' : 'rgba(60,75,110,0.45)';
          ctx.fillRect(wx, wy, 7, 9);
        }
      }
      // ai& sign on designated building
      if (b.sign) {
        const sx = b.x + b.w / 2, sy = by - 24;
        // sign backing
        ctx.fillStyle = '#1a1f35'; ctx.fillRect(sx - 28, sy - 4, 56, 22);
        ctx.strokeStyle = '#ffcf4d'; ctx.lineWidth = 1.5; ctx.strokeRect(sx - 28, sy - 4, 56, 22);
        // ai& text on sign
        const w1 = pxText(ctx, 'ai', sx - 16, sy + 1, 2, '#ffffff');
        pxText(ctx, '&', sx - 16 + w1 + 2, sy + 1, 2, '#ffcf4d');
        // glow
        ctx.save(); ctx.globalAlpha = 0.2 + Math.sin(t * 3) * 0.1; ctx.fillStyle = '#ffcf4d';
        ctx.fillRect(sx - 30, sy - 6, 60, 26); ctx.restore();
      }
    }

    // === window frame (we're inside the office looking out) ===
    ctx.fillStyle = '#3a2e22'; // frame color
    // vertical mullions
    ctx.fillRect(W * 0.33 - 4, 0, 8, sill);
    ctx.fillRect(W * 0.66 - 4, 0, 8, sill);
    // top transom bar
    ctx.fillRect(0, 0, W, 10);
    ctx.fillRect(0, sill - 8, W, 8);

    // === office interior (below window sill) ===
    const intG = ctx.createLinearGradient(0, sill, 0, H);
    intG.addColorStop(0, '#e8edf7'); intG.addColorStop(1, '#c8d0e0');
    ctx.fillStyle = intG; ctx.fillRect(0, sill + 8, W, H - sill);

    // floor line
    ctx.fillStyle = '#b8c2d8'; ctx.fillRect(0, sill + 8, W, 4);

    // === desk (left side, visible interior) ===
    this.drawTitleDesk(ctx, 40, sill + 40);
    // === desk (right side) ===
    this.drawTitleDesk(ctx, W - 220, sill + 40);
    // === plant in corner ===
    this.drawTitlePlant(ctx, W - 50, sill + 12);

    // === walking demo characters (in the office) ===
    for (const c of this.titleChars) {
      const baseY = sill + 80;
      const bob = Math.sin(t * 8 + c.x * 0.04) * 1.5;
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(c.x, baseY + 2, 10, 4, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      drawCharacter(ctx, c.x, baseY - 36 + bob, 2, c.desc, { t, flip: c.dir < 0 });
    }

    // === title text — wave + color cycle ===
    const title = 'ARCAIDIA', sc = 4, adv = 6 * sc;
    const totalW = title.length * adv - sc;
    const startX = W / 2 - totalW / 2;
    ctx.save();
    for (let i = 0; i < title.length; i++) {
      const wave = Math.sin(t * 3 + i * 0.4) * 3;
      const hue = (t * 25 + i * 18) % 360;
      ctx.shadowColor = `hsl(${hue},90%,50%)`; ctx.shadowBlur = 10;
      pxText(ctx, title[i], startX + i * adv, 36 + wave, sc, `hsl(${hue},80%,60%)`);
    }
    ctx.restore();

    // === subtitle ===
    pxTextCenter(ctx, 'AN AI& OFFICE ARCADE', W / 2, 78, 2, 'rgba(30,35,60,0.6)');

    // === floating game icons ===
    for (const ic of this.titleIcons) {
      const ix = ic.x + Math.cos(t * 0.8 + ic.ph) * 6;
      const iy = ic.y + Math.sin(t * 1.5 + ic.ph) * 8;
      this.drawTitleIcon(ctx, ix, iy, ic.type);
    }

    // === blinking "CLICK TO PLAY" ===
    if (Math.sin(t * 4) > -0.3) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6;
      pxTextCenter(ctx, 'CLICK TO PLAY', W / 2, H - 76, 3, '#1a4a8a');
      ctx.restore();
    }

    // === controls hint ===
    pxTextCenter(ctx, 'WASD/ARROWS: MOVE   SPACE: INTERACT   MOUSE: GAMES', W / 2, H - 36, 1, 'rgba(30,35,60,0.4)');

    // === save info ===
    if (Store.coins > 0 || (Store.owned && Store.owned.length))
      pxTextCenter(ctx, 'WALLET: ' + Store.coins + ' COINS   STICKERS: ' + (Store.owned?.length || 0) + '/' + EMPLOYEES.length, W / 2, H - 16, 1, 'rgba(0,160,140,0.7)');
  }
  drawTitleDesk(ctx, x, y) {
    const t = this.titleT;
    // desk surface
    ctx.fillStyle = '#d8b072'; ctx.fillRect(x, y, 180, 12);
    ctx.fillStyle = '#c29658'; ctx.fillRect(x, y + 12, 180, 6);
    // legs
    ctx.fillStyle = '#8a6a36'; ctx.fillRect(x + 4, y + 18, 6, 40); ctx.fillRect(x + 170, y + 18, 6, 40);
    // monitor
    ctx.fillStyle = '#1a1f30'; ctx.fillRect(x + 50, y - 40, 80, 34);
    ctx.fillStyle = '#2a3050'; ctx.fillRect(x + 52, y - 38, 76, 30);
    // screen content (animated)
    ctx.fillStyle = '#39d2a0'; ctx.fillRect(x + 56, y - 34, 68, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 4; i++) { const lx = x + 58 + i * 16; ctx.fillRect(lx, y - 32 + Math.sin(t * 2 + i) * 2, 3, 4); }
    // stand
    ctx.fillStyle = '#1a1f30'; ctx.fillRect(x + 86, y - 6, 8, 8);
    // keyboard
    ctx.fillStyle = '#2a2f44'; ctx.fillRect(x + 60, y + 4, 60, 4);
    // coffee mug
    ctx.fillStyle = '#e25c5c'; ctx.fillRect(x + 130, y - 6, 14, 12);
    ctx.fillStyle = '#c04040'; ctx.fillRect(x + 144, y - 4, 3, 8);
  }
  drawTitlePlant(ctx, x, y) {
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x, y + 30, 28, 26);
    const g = ctx.createLinearGradient(0, y, 0, y + 30);
    g.addColorStop(0, '#43c97a'); g.addColorStop(1, '#2e8c5a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 14, y + 16, 18, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2e8c5a'; ctx.beginPath(); ctx.arc(x + 4, y + 8, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#43c97a'; ctx.beginPath(); ctx.arc(x + 24, y + 10, 8, 0, TAU); ctx.fill();
  }
  drawTitleIcon(ctx, x, y, type) {
    ctx.save(); ctx.globalAlpha = 0.6;
    switch (type) {
      case 'desk':
        ctx.fillStyle = '#d8b072'; ctx.fillRect(x - 10, y - 6, 20, 10);
        ctx.fillStyle = '#c29658'; ctx.fillRect(x - 10, y + 4, 20, 3);
        ctx.fillStyle = '#0e1320'; ctx.fillRect(x - 7, y - 16, 14, 10);
        ctx.fillStyle = '#39d2a0'; ctx.fillRect(x - 5, y - 14, 10, 6);
        break;
      case 'car':
        ctx.fillStyle = '#e25c5c'; ctx.fillRect(x - 12, y - 5, 24, 8);
        ctx.fillStyle = '#bfe6ff'; ctx.fillRect(x - 7, y - 9, 10, 5);
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(x - 7, y + 3, 2.5, 0, TAU); ctx.arc(x + 7, y + 3, 2.5, 0, TAU); ctx.fill();
        break;
      case 'sword':
        ctx.fillStyle = '#c0c8e0'; ctx.fillRect(x - 1, y - 14, 3, 16);
        ctx.fillStyle = '#8a6a36'; ctx.fillRect(x - 5, y + 2, 11, 2);
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 1, y + 4, 2, 4);
        break;
    }
    ctx.restore();
  }
  drawShopButton(ctx) {
    const x = W - 64, y = H / 2 - 50, w = 50, h = 100;
    if (button(ctx, x, y, w, h, '', { bg: PALETTE.panel, border: PALETTE.gold + '66' })) { this.openShop(); }
    // claw icon
    ctx.save();
    const cx = x + w / 2, cy = y + 30;
    ctx.fillStyle = '#2a1f3a'; roundRectS(ctx, cx - 14, cy - 12, 28, 30, 3); ctx.fill();
    ctx.fillStyle = 'rgba(150,200,255,0.12)'; roundRectS(ctx, cx - 12, cy - 10, 24, 20, 2); ctx.fill();
    ctx.fillStyle = '#c9a227'; ctx.fillRect(cx - 2, cy - 14, 4, 8); ctx.fillRect(cx - 6, cy - 8, 12, 3);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(cx - 3, cy + 2, 6, 4);
    ctx.fillStyle = '#9aa3bd'; ctx.fillRect(cx - 12, cy + 18, 24, 3);
    pxTextCenter(ctx, 'SHOP', cx, y + 64, 2, PALETTE.gold);
    ctx.restore();
  }
  drawVignette(ctx) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  loop(now) {
    let dt = (now - this.last) / 1000; this.last = now;
    dt = Math.min(dt, 0.05);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.update(dt);
    this.draw();
    endFrame();
    requestAnimationFrame(this.loopBound);
  }
  start() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.last = performance.now();
    const boot = document.getElementById('boot');
    if (boot) boot.classList.add('hide');
    requestAnimationFrame(this.loopBound);
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.canvas.width = W * dpr; this.canvas.height = H * dpr;
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    this.canvas.style.width = (W * scale) + 'px';
    this.canvas.style.height = (H * scale) + 'px';
    setView(scale, (window.innerWidth - W * scale) / 2, (window.innerHeight - H * scale) / 2);
  }
}

// boot
const canvas = document.getElementById('game');
init(canvas);
const app = new App(canvas);
app.loopBound = app.loop.bind(app);
app.start();
if (typeof window !== 'undefined') window.__app = app;

// title -> office on first gesture (unlocks audio)
let started = false;
function firstGesture() {
  if (started) return; started = true;
  initAudio(); resumeAudio(); playMusic('hub');
  app.state = 'office';
  app.scenes.office.onEnter();
}
canvas.addEventListener('pointerdown', () => { if (app.state === 'title') firstGesture(); });
window.addEventListener('keydown', () => { if (app.state === 'title') firstGesture(); });
