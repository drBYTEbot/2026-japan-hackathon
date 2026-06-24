// hud.js — persistent top HUD: ai& brand, animated coin counter, sound toggles, toasts
import { Store, pxText, pxTextCenter, lerp, clamp, PALETTE, roundRect, strokeRoundRect } from './util.js';
import { button, W, H } from './ui.js';
import { Audio, Sfx } from './audio.js';

export class HUD {
  constructor() {
    this.coinDisplay = Store.coins;
    this.coinBump = 0;
    this.lastCoins = Store.coins;
    this.toasts = [];
    this.t = 0;
  }
  addToast(text, color = PALETTE.gold) {
    this.toasts.push({ text, color, life: 2.4, max: 2.4, y: 0 });
    if (this.toasts.length > 4) this.toasts.shift();
  }
  flashCoins() { this.coinBump = 1; }
  update(dt) {
    this.t += dt;
    const target = Store.coins;
    if (target !== this.lastCoins) { this.coinBump = 1; this.lastCoins = target; }
    this.coinDisplay = lerp(this.coinDisplay, target, 1 - Math.pow(0.001, dt));
    if (Math.abs(this.coinDisplay - target) < 0.5) this.coinDisplay = target;
    this.coinBump = Math.max(0, this.coinBump - dt * 2.2);
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const tw = this.toasts[i];
      tw.life -= dt;
      const k = clamp(tw.life / tw.max, 0, 1);
      tw.y = lerp(tw.y, (this.toasts.length - 1 - i) * 46, 1 - Math.pow(0.001, dt));
      if (tw.life <= 0) this.toasts.splice(i, 1);
    }
  }
  draw(ctx) {
    // ---- top bar background ----
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(10,14,28,0.92)'); g.addColorStop(1, 'rgba(10,14,28,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 70);
    ctx.restore();

    // ---- brand (text only, no logo) ----
    pxText(ctx, 'ArcAIdia', 14, 16, 4, PALETTE.ink);
    pxText(ctx, 'by ai&', 14, 42, 2, PALETTE.dim);

    // ---- coin counter (top-right) ----
    const cw = 168, ch = 38, cx = W - cw - 16, cy = 14;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    roundRect(ctx, cx, cy, cw, ch, ch / 2); ctx.fillStyle = 'rgba(20,26,46,0.9)'; ctx.fill();
    ctx.restore();
    strokeRoundRect(ctx, cx, cy, cw, ch, ch / 2, 2, 'rgba(255,207,77,0.3)');
    // coin icon
    const bump = 1 + this.coinBump * 0.4;
    this.drawCoin(ctx, cx + 24, cy + ch / 2, 11 * bump);
    const n = Math.round(this.coinDisplay);
    pxText(ctx, String(n), cx + 46, cy + (ch - 28) / 2, 4, n > 0 ? '#ffe9a8' : PALETTE.dim);
    pxText(ctx, 'COINS', cx + 46 + pxTextW(n) + 6, cy + 14, 2, PALETTE.dim);

    // ---- sound toggles ----
    this.iconBtn(ctx, W - 60, 16, 'MUTE', !Audio.isMusicOn(), () => { const on = !Audio.isMusicOn(); Audio.setMusic(on); if (on) requireMusic(); Sfx.click(); });
    this.iconBtn(ctx, W - 60, 58, 'SFX', !Audio.isSfxOn(), () => { Audio.setSfx(!Audio.isSfxOn()); Sfx.click(); });

    // ---- toasts ----
    for (let i = 0; i < this.toasts.length; i++) {
      const tw = this.toasts[i];
      const k = clamp(tw.life / tw.max, 0, 1);
      const a = k < 0.2 ? k / 0.2 : (k > 0.8 ? (1 - k) / 0.2 : 1);
      const w = tw.text.length * 6 * 3 + 40;
      const x = W / 2 - w / 2, y = 86 + i * 0 - tw.y;
      ctx.globalAlpha = a;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12;
      roundRect(ctx, x, y, w, 34, 17); ctx.fillStyle = 'rgba(16,20,38,0.95)'; ctx.fill();
      ctx.restore();
      strokeRoundRect(ctx, x, y, w, 34, 17, 2, tw.color + '55');
      pxTextCenter(ctx, tw.text, W / 2, y + 8, 3, tw.color);
      ctx.globalAlpha = 1;
    }
  }
  drawCoin(ctx, x, y, r) {
    r = Math.max(2, r);
    ctx.save();
    ctx.translate(x, y);
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#ffe27a'); g.addColorStop(1, '#e89a1a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9a5e0a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#9a5e0a'; ctx.font = `bold ${r}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('&', 0, 1);
    ctx.restore();
  }
  iconBtn(ctx, x, y, label, active, onClick) {
    const s = 36;
    const click = button(ctx, x, y, s, s, '', { bg: active ? '#3a2230' : PALETTE.panel, border: active ? PALETTE.red + '88' : 'rgba(255,255,255,0.08)' });
    // icon
    ctx.fillStyle = active ? PALETTE.red : PALETTE.ink;
    if (label === 'MUTE') this.drawSpeaker(ctx, x + s / 2, y + s / 2, 8, active);
    else this.drawNote(ctx, x + s / 2, y + s / 2, 8, active);
    if (click) onClick();
  }
  drawSpeaker(ctx, cx, cy, s, muted) {
    ctx.beginPath();
    ctx.moveTo(cx - s, cy - s / 2); ctx.lineTo(cx - s / 2, cy - s / 2); ctx.lineTo(cx, cy - s);
    ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s / 2, cy + s / 2); ctx.lineTo(cx - s, cy + s / 2); ctx.closePath();
    ctx.fill();
    if (!muted) {
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx + 2, cy, s * 0.8, -0.6, 0.6); ctx.stroke();
    } else {
      ctx.strokeStyle = PALETTE.red; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + 2, cy - s); ctx.lineTo(cx + s + 2, cy + s); ctx.stroke();
    }
  }
  drawNote(ctx, cx, cy, s, off) {
    ctx.beginPath();
    ctx.moveTo(cx - s / 2, cy + s); ctx.arc(cx - s / 2, cy + s, s / 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - s / 2, cy - s, 2.5, s * 2);
    ctx.beginPath(); ctx.moveTo(cx - s / 2, cy - s); ctx.quadraticCurveTo(cx + s, cy - s, cx + s, cy); ctx.quadraticCurveTo(cx + s, cy, cx - s / 2, cy); ctx.fill();
    if (off) { ctx.strokeStyle = PALETTE.red; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - s, cy - s * 1.4); ctx.lineTo(cx + s, cy + s * 1.4); ctx.stroke(); }
  }
}

// music re-starter hook (set by main.js so HUD can resume current track)
let _musicHook = null;
export function setMusicHook(fn) { _musicHook = fn; }
function requireMusic() { if (_musicHook) _musicHook(); }
function pxTextW(n) { return String(n).length * 6 * 4; }
