// main.js — ArcAIdia app: state machine, loop, scaling, audio, side shop button
import { W, H, init, setView, endFrame, button, pointer, Input, drawLogo, LOGO_SVG } from './ui.js';
import { clamp, lerp, PALETTE, pxText, pxTextCenter, updateShake, applyShake, Store, roundRect as roundRectS } from './util.js';
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
      // wait for first click handled in loop
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
    const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W);
    g.addColorStop(0, '#1a2342'); g.addColorStop(1, '#06080f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // floating dust
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 40; i++) { const x = (i * 137.5 % W), y = (i * 53.3 % H + performance.now() * 0.02 * (i % 3 + 1)) % H; ctx.fillRect(x, y, 2, 2); }
    const t = performance.now() / 1000;
    drawLogo(ctx, W / 2 - 48, 110, 96, t);
    pxTextCenter(ctx, 'ArcAIdia', W / 2, 230, 6, PALETTE.ink);
    pxTextCenter(ctx, 'an ai& office arcade', W / 2, 290, 3, PALETTE.dim);
    const pulse = 0.6 + Math.sin(t * 3) * 0.4;
    ctx.globalAlpha = pulse;
    pxTextCenter(ctx, 'CLICK TO PLAY', W / 2, 380, 4, PALETTE.gold);
    ctx.globalAlpha = 1;
    pxTextCenter(ctx, 'WASD/ARROWS MOVE   SPACE INTERACT   MOUSE FOR GAMES', W / 2, 470, 2, PALETTE.dim);
    if (Store.coins > 0 || (Store.owned && Store.owned.length)) pxTextCenter(ctx, 'wallet: ' + Store.coins + ' coins   stickers: ' + (Store.owned?.length || 0), W / 2, 500, 2, PALETTE.accent);
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
