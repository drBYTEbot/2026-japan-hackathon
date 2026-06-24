// main.js — ArcAIdia app: state machine, loop, scaling, audio, side shop button
import { W, H, init, setView, endFrame, button, pointer, Input, drawLogo, LOGO_SVG } from './ui.js';
import { clamp, lerp, rand, TAU, PALETTE, pxText, pxTextCenter, updateShake, applyShake, Store, roundRect as roundRectS } from './util.js';
import { descriptor, drawCharacter, EMPLOYEES } from './characters.js';
import { initAudio, resumeAudio, playMusic, Audio, Sfx } from './audio.js';
import { HUD, setMusicHook } from './hud.js';
import { Office, GAMES } from './office.js';
import { RushHour } from './rushhour.js';
import { CrossyRoad } from './crossyroad.js';
import { Fighting } from './fighting.js';
import { ClawShop } from './clawshop.js';

const GAME_FOR = { rush: { scene: 'rush', music: 'rush' }, crossy: { scene: 'crossy', music: 'crossy' }, fight: { scene: 'fight', music: 'fight' } };

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
      shop: new ClawShop(this),
    };
    this.scenes.office.onEnter();
    this.last = performance.now();
    this.music = 'hub';
    setMusicHook(() => playMusic(this.music));
    this.titleT = 0;
    this.titleStars = Array.from({ length: 55 }, () => ({
      x: rand(0, W), y: rand(0, H * 0.48), s: rand(1, 2.5), tw: rand(0, TAU), spd: rand(1, 3),
    }));
    this.titleChars = [
      { desc: descriptor('Saria'), x: -60, dir: 1, spd: 34 },
      { desc: descriptor('David'), x: W * 0.35, dir: 1, spd: 27 },
      { desc: descriptor('Misaki'), x: W + 60, dir: -1, spd: 31 },
      { desc: descriptor('Yagiz'), x: W * 0.7, dir: -1, spd: 38 },
    ];
    this.titleBuildings = [
      { x: 0, w: 70, h: 50 }, { x: 70, w: 45, h: 35 }, { x: 115, w: 60, h: 65 },
      { x: 175, w: 35, h: 30 }, { x: 210, w: 75, h: 48 }, { x: 285, w: 50, h: 38 },
      { x: 625, w: 55, h: 42 }, { x: 680, w: 70, h: 60 }, { x: 750, w: 45, h: 35 },
      { x: 795, w: 65, h: 52 }, { x: 860, w: 50, h: 40 }, { x: 910, w: 50, h: 45 },
    ];
    this.titleIcons = [
      { x: 130, y: 195, ph: 0, type: 'desk' },
      { x: 830, y: 215, ph: 1.6, type: 'car' },
      { x: 480, y: 175, ph: 3.1, type: 'sword' },
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

    // === background gradient ===
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0820'); g.addColorStop(0.45, '#12103a');
    g.addColorStop(0.52, '#1a1340'); g.addColorStop(1, '#06050f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // === twinkling stars (upper half) ===
    for (const s of this.titleStars) {
      const tw = 0.3 + Math.sin(t * s.spd + s.tw) * 0.7;
      ctx.globalAlpha = tw * 0.6; ctx.fillStyle = '#fff';
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    const horizon = H * 0.52;

    // === horizon glow ===
    const hg = ctx.createRadialGradient(W / 2, horizon, 0, W / 2, horizon, 220);
    hg.addColorStop(0, 'rgba(255,100,150,0.18)'); hg.addColorStop(1, 'rgba(255,100,150,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, horizon - 120, W, 240);

    // === synthwave grid floor ===
    const vx = W / 2; ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(123,92,255,0.22)';
    for (let i = -10; i <= 10; i++) {
      if (i === 0) continue;
      ctx.beginPath(); ctx.moveTo(vx, horizon); ctx.lineTo(vx + i * (W / 5), H); ctx.stroke();
    }
    const scroll = (t * 0.5) % 1;
    for (let i = 0; i < 25; i++) {
      const z = (i + scroll) / 25;
      const y = horizon + Math.pow(z, 2.5) * (H - horizon);
      if (y > H || y < horizon) continue;
      const a = clamp(z * 1.8, 0, 0.3);
      ctx.strokeStyle = `rgba(0,224,198,${a})`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // === office building silhouettes on horizon ===
    ctx.fillStyle = 'rgba(8,6,24,0.85)';
    for (const b of this.titleBuildings) ctx.fillRect(b.x, horizon - b.h, b.w, b.h);
    ctx.fillStyle = 'rgba(255,207,77,0.12)';
    for (const b of this.titleBuildings)
      for (let wy = horizon - b.h + 6; wy < horizon - 4; wy += 10)
        for (let wx = b.x + 4; wx < b.x + b.w - 4; wx += 12)
          if ((wx * 7 + wy * 3) % 5 < 2) ctx.fillRect(wx, wy, 3, 3);

    // === walking demo characters on the grid ===
    for (const c of this.titleChars) {
      const baseY = horizon + 30;
      const bob = Math.sin(t * 8 + c.x * 0.04) * 1.5;
      ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(c.x, baseY + 2, 10, 4, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      drawCharacter(ctx, c.x, baseY - 36 + bob, 2, c.desc, { t, flip: c.dir < 0 });
    }

    // === title glow aura ===
    const tg = ctx.createRadialGradient(W / 2, 95, 0, W / 2, 95, 180);
    tg.addColorStop(0, 'rgba(123,92,255,0.16)'); tg.addColorStop(1, 'rgba(123,92,255,0)');
    ctx.fillStyle = tg; ctx.fillRect(W / 2 - 200, 0, 400, 200);

    // === ai& logo ===
    drawLogo(ctx, W / 2 - 18, 28 + Math.sin(t * 2) * 2, 36, t);

    // === title text — wave + rainbow color cycle ===
    const title = 'ARCAIDIA', sc = 3, adv = 6 * sc;
    const totalW = title.length * adv - sc;
    const startX = W / 2 - totalW / 2;
    ctx.save();
    for (let i = 0; i < title.length; i++) {
      const wave = Math.sin(t * 3 + i * 0.4) * 2;
      const hue = (t * 25 + i * 18) % 360;
      ctx.shadowColor = `hsl(${hue},90%,50%)`; ctx.shadowBlur = 12;
      pxText(ctx, title[i], startX + i * adv, 78 + wave, sc, `hsl(${hue},80%,65%)`);
    }
    ctx.restore();

    // === subtitle ===
    pxTextCenter(ctx, 'AN AI& OFFICE ARCADE', W / 2, 112, 2, 'rgba(139,148,184,0.7)');

    // === floating game icons ===
    for (const ic of this.titleIcons) {
      const ix = ic.x + Math.cos(t * 0.8 + ic.ph) * 6;
      const iy = ic.y + Math.sin(t * 1.5 + ic.ph) * 10;
      this.drawTitleIcon(ctx, ix, iy, ic.type);
    }

    // === blinking "CLICK TO PLAY" ===
    if (Math.sin(t * 4) > -0.3) {
      ctx.save();
      ctx.shadowColor = PALETTE.gold; ctx.shadowBlur = 8;
      pxTextCenter(ctx, 'CLICK TO PLAY', W / 2, 340, 2, PALETTE.gold);
      ctx.restore();
    }

    // === controls hint ===
    pxTextCenter(ctx, 'WASD/ARROWS: MOVE   SPACE: INTERACT   MOUSE: GAMES', W / 2, 378, 1, 'rgba(139,148,184,0.5)');

    // === save info ===
    if (Store.coins > 0 || (Store.owned && Store.owned.length))
      pxTextCenter(ctx, 'WALLET: ' + Store.coins + ' COINS   STICKERS: ' + (Store.owned?.length || 0) + '/' + EMPLOYEES.length, W / 2, 406, 1, PALETTE.accent);

    // === marquee lights (border) ===
    const lc = 50;
    for (let i = 0; i < lc; i++) {
      const on = (Math.floor(t * 6) + i) % 3 === 0;
      ctx.fillStyle = on ? PALETTE.gold : '#2a2418';
      const x = (i / lc) * W;
      ctx.fillRect(x, 2, 5, 3); ctx.fillRect(x, H - 5, 5, 3);
    }
    const lc2 = 30;
    for (let i = 0; i < lc2; i++) {
      const on = (Math.floor(t * 6) + i + 8) % 3 === 0;
      ctx.fillStyle = on ? PALETTE.gold : '#2a2418';
      const y = (i / lc2) * H;
      ctx.fillRect(2, y, 3, 5); ctx.fillRect(W - 5, y, 3, 5);
    }

    // === CRT scanlines ===
    ctx.globalAlpha = 0.025; ctx.fillStyle = '#000';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.globalAlpha = 1;
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
