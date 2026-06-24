// characters.js — employee roster + deterministic 8-bit avatar generation
import { mulberry32, hashStr, clamp, roundRect as roundRectSt, pxTextCenter, TAU } from './util.js';

// Company directory (prizes in the claw machine). Preserved as given.
export const EMPLOYEES = [
  'Saria','Noa','Feifan','Noah','Hana','Sumer','Shimpei','Misaki','David',
  'Rajendra','Richard','Shinon','Lamu','Atul Anand','Sakuarko','Amelia','Mike',
  'Millan','Mao','Nao','Tetsuya','Mutsumi','Mario','Sophia','Matt','Alex',
  'Masamichi','Kazunori','Samantha','Mustafa','Yushi','Yagiz','Takanori','Takeru',
  'Yu','Uchida','Obama','Jun','Ryuei','Ayuki','Satoshi','Hirokazu','Hiroyuki',
  'John','Shearin','Akimitsu','Steven','Matthew','Yuhei',
];

const SKIN = ['#f6cda0', '#ecb382', '#d99a63', '#bb7a48', '#8a4f2c', '#f0d9bf', '#6e4326'];
const HAIR = ['#241a12', '#43301f', '#6b4226', '#8c6d3f', '#caa21f', '#d9dbe6', '#9aa0b4',
  '#5a3a22', '#e85d75', '#3a4a8c', '#2e8c5a', '#1a1a1a', '#b645d6', '#ff7a18'];
const SHIRT = ['#e25c5c', '#5c8ae2', '#43c97a', '#e2a35c', '#9b5ce2', '#e25cb8', '#5ce2cf',
  '#d6c24a', '#3aa6c9', '#cf5c8a', '#6fce5c', '#e26b3a', '#7a5ce2', '#5cd6a0'];
const HAT = ['#2b2b3a', '#3a2a1a', '#5a2a3a', '#1a3a3a', '#3a1a3a', '#1a1a2a'];

// Skin tones by ethnicity
const SKIN_ASIAN = ['#f0d9bf', '#f6cda0', '#ecb382', '#e0c096', '#d9b88a', '#e8ccaa'];
const SKIN_SOUTH_ASIAN = ['#bb7a48', '#a86a3e', '#c4884f', '#b07040'];
const SKIN_BLACK = ['#8a4f2c', '#6e4326', '#5a3818', '#7a4020'];
const SKIN_WHITE = ['#f6cda0', '#f0d9bf', '#ecb382', '#f8d8b8'];

// Hair colors
const HAIR_BLONDE = ['#caa21f', '#e0bc3a', '#d4b830', '#f0d048'];
const HAIR_ASIAN = ['#1a1a1a', '#241a12', '#2a1f15', '#332518'];
const HAIR_SOUTH_ASIAN = ['#1a1a1a', '#241a12', '#3a2a18'];
const HAIR_BLACK = ['#1a1a1a', '#241a12', '#2a1f15'];
const HAIR_WHITE = ['#43301f', '#5a3a22', '#6b4226', '#8c6d3f', '#1a1a1a'];

// Per-name ethnicity overrides (defaults to Asian for Japanese/Chinese-sounding names)
const NAME_OVERRIDES = {
  'Saria':       { eth: 'black' },
  'Feifan':      { eth: 'asian', hair: 'blonde' },
  'David':       { eth: 'white', hair: 'blonde' },
  'Atul Anand': { eth: 'south_asian' },
  'Sumer':       { eth: 'south_asian' },
  'Rajendra':    { eth: 'south_asian' },
  'Richard':     { eth: 'white' },
  'Amelia':      { eth: 'white' },
  'Mike':        { eth: 'white' },
  'Matt':        { eth: 'white' },
  'Alex':        { eth: 'white' },
  'Samantha':    { eth: 'white' },
  'Mustafa':     { eth: 'south_asian' },
  'Yagiz':       { eth: 'white' },
  'John':        { eth: 'white' },
  'Steven':      { eth: 'white' },
  'Matthew':     { eth: 'white' },
  'Mario':       { eth: 'white' },
  'Sophia':      { eth: 'white' },
  'Lamu':        { eth: 'asian' },
  'Obama':       { eth: 'black' },
};

const HAIR_STYLES = 6;

function ethnicityFor(name) {
  if (NAME_OVERRIDES[name]) return NAME_OVERRIDES[name].eth;
  // Default: Asian for the majority of names (Japanese, Chinese, etc.)
  return 'asian';
}

function skinFor(eth, rng) {
  switch (eth) {
    case 'south_asian': return SKIN_SOUTH_ASIAN[Math.floor(rng() * SKIN_SOUTH_ASIAN.length)];
    case 'black': return SKIN_BLACK[Math.floor(rng() * SKIN_BLACK.length)];
    case 'white': return SKIN_WHITE[Math.floor(rng() * SKIN_WHITE.length)];
    default: return SKIN_ASIAN[Math.floor(rng() * SKIN_ASIAN.length)];
  }
}

function hairFor(name, eth, rng) {
  // Check for blonde override
  if (NAME_OVERRIDES[name]?.hair === 'blonde') return HAIR_BLONDE[Math.floor(rng() * HAIR_BLONDE.length)];
  switch (eth) {
    case 'south_asian': return HAIR_SOUTH_ASIAN[Math.floor(rng() * HAIR_SOUTH_ASIAN.length)];
    case 'black': return HAIR_BLACK[Math.floor(rng() * HAIR_BLACK.length)];
    case 'white': return HAIR_WHITE[Math.floor(rng() * HAIR_WHITE.length)];
    default: return HAIR_ASIAN[Math.floor(rng() * HAIR_ASIAN.length)];
  }
}

export function descriptor(name) {
  const rng = mulberry32(hashStr(name.toLowerCase()));
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const eth = ethnicityFor(name);
  return {
    name,
    skin: skinFor(eth, rng),
    hair: hairFor(name, eth, rng),
    shirt: pick(SHIRT),
    hat: rng() < 0.35 ? pick(HAT) : null,
    hatStyle: Math.floor(rng() * 3),
    glasses: rng() < 0.4,
    hairStyle: Math.floor(rng() * HAIR_STYLES),
    phase: rng() * TAU,
    hasBow: rng() < 0.2,
    bow: pick(['#ff5d8f', '#ffd23f', '#43d17a']),
    sparkle: rng() < 0.3,
    rng,
  };
};

// Draw a chibi character. cx = center x, topY = top of bounding box, scale = px size of one "pixel".
// opts: { t, face: 'happy'|'fight'|'sad', flip, alpha }
export function drawCharacter(ctx, cx, topY, scale, d, opts = {}) {
  const t = opts.t || 0;
  const bob = Math.sin(t * 2.4 + d.phase) * 0.6 * scale;
  const blink = (Math.sin(t * 0.9 + d.phase * 3) > 0.96) || opts.face === 'sad';
  const face = opts.face || 'happy';
  const sc = scale;

  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (opts.flip) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }

  const headW = 10 * sc, headH = 9 * sc;
  const headX = cx - headW / 2;
  const headY = topY + 2 * sc + bob;

  // ---- body / shirt ----
  const bodyW = 12 * sc, bodyH = 9 * sc;
  const bodyX = cx - bodyW / 2;
  const bodyY = headY + headH - 2 * sc;
  // arms
  ctx.fillStyle = d.shirt;
  ctx.fillRect(bodyX - sc, bodyY + 2 * sc, 2 * sc, 6 * sc);
  ctx.fillRect(bodyX + bodyW - sc, bodyY + 2 * sc, 2 * sc, 6 * sc);
  // torso
  ctx.fillRect(bodyX, bodyY + sc, bodyW, bodyH);
  // collar / chest detail
  ctx.fillStyle = shade(d.shirt, -20);
  ctx.fillRect(bodyX, bodyY + sc, bodyW, sc);
  ctx.fillStyle = d.skin;
  ctx.fillRect(bodyX + sc, bodyY, 2 * sc, 2 * sc); // neck
  // little badge
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(bodyX + bodyW - 3 * sc, bodyY + 3 * sc, sc, sc);

  // ---- legs ----
  ctx.fillStyle = '#3a4254';
  ctx.fillRect(bodyX + 2 * sc, bodyY + bodyH + sc, 3 * sc, 4 * sc);
  ctx.fillRect(bodyX + bodyW - 5 * sc, bodyY + bodyH + sc, 3 * sc, 4 * sc);
  ctx.fillStyle = '#222';
  ctx.fillRect(bodyX + 2 * sc, bodyY + bodyH + 5 * sc, 3 * sc, sc);
  ctx.fillRect(bodyX + bodyW - 5 * sc, bodyY + bodyH + 5 * sc, 3 * sc, sc);

  // ---- head ----
  ctx.fillStyle = d.skin;
  ctx.fillRect(headX, headY + 2 * sc, headW, headH - sc);
  // ears
  ctx.fillRect(headX - sc, headY + 5 * sc, sc, 2 * sc);
  ctx.fillRect(headX + headW, headY + 5 * sc, sc, 2 * sc);

  // ---- hair (styles) ----
  ctx.fillStyle = d.hair;
  drawHair(ctx, headX, headY, headW, headH, sc, d.hairStyle);

  // ---- eyes ----
  const eyeY = headY + 5 * sc;
  const lx = headX + 3 * sc, rx = headX + 6 * sc;
  if (face === 'fight') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(lx, eyeY, 2 * sc, 2 * sc);
    ctx.fillRect(rx, eyeY, 2 * sc, 2 * sc);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(lx + sc, eyeY + sc, sc, sc);
    ctx.fillRect(rx + sc, eyeY + sc, sc, sc);
    // angry brows
    ctx.fillStyle = d.hair;
    ctx.fillRect(lx - sc, eyeY - sc, 3 * sc, sc);
    ctx.fillRect(rx, eyeY - sc, 3 * sc, sc);
  } else if (blink) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(lx, eyeY + sc, 2 * sc, sc);
    ctx.fillRect(rx, eyeY + sc, 2 * sc, sc);
  } else {
    ctx.fillStyle = '#fff';
    ctx.fillRect(lx, eyeY, 2 * sc, 2 * sc);
    ctx.fillRect(rx, eyeY, 2 * sc, 2 * sc);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(lx + sc, eyeY + sc, sc, sc);
    ctx.fillRect(rx + sc, eyeY + sc, sc, sc);
  }

  // glasses
  if (d.glasses) {
    ctx.fillStyle = 'rgba(120,200,255,0.35)';
    ctx.fillRect(lx - sc, eyeY - sc, 4 * sc, 3 * sc);
    ctx.fillRect(rx - sc, eyeY - sc, 4 * sc, 3 * sc);
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = sc * 0.6;
    ctx.strokeRect(lx - sc + 0.5, eyeY - sc + 0.5, 4 * sc - 1, 3 * sc - 1);
    ctx.strokeRect(rx - sc + 0.5, eyeY - sc + 0.5, 4 * sc - 1, 3 * sc - 1);
  }

  // mouth
  ctx.fillStyle = '#9a3a3a';
  if (face === 'sad') { ctx.fillRect(headX + 4 * sc, headY + 7 * sc, 2 * sc, sc); }
  else if (face === 'fight') { ctx.fillRect(headX + 3 * sc, headY + 7 * sc, 4 * sc, sc); }
  else { ctx.fillRect(headX + 4 * sc, headY + 7 * sc, 3 * sc, sc); }

  // bow / hair accessory
  if (d.hasBow) {
    ctx.fillStyle = d.bow;
    ctx.fillRect(headX + headW - 2 * sc, headY + 2 * sc, 2 * sc, 2 * sc);
    ctx.fillRect(headX + headW, headY + 2 * sc, sc, sc);
    ctx.fillRect(headX + headW, headY + 3 * sc, sc, sc);
  }

  // hat
  if (d.hat) drawHat(ctx, cx, headX, headY, headW, sc, d.hat, d.hatStyle);

  ctx.restore();
}

function drawHair(ctx, x, y, w, h, sc, style) {
  ctx.fillStyle = ctx.fillStyle; // keep current (hair color already set)
  switch (style) {
    case 0: // bowl
      ctx.fillRect(x, y, w, 3 * sc);
      ctx.fillRect(x - sc, y + 2 * sc, sc, 4 * sc);
      ctx.fillRect(x + w, y + 2 * sc, sc, 4 * sc);
      break;
    case 1: // spiky top
      ctx.fillRect(x + sc, y, w - 2 * sc, 2 * sc);
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 2 * sc + i * 2 * sc, y - sc, sc, sc);
      ctx.fillRect(x, y + 2 * sc, sc, 2 * sc);
      ctx.fillRect(x + w - sc, y + 2 * sc, sc, 2 * sc);
      break;
    case 2: // side part long
      ctx.fillRect(x, y, w, 2 * sc);
      ctx.fillRect(x - sc, y + 2 * sc, sc, 6 * sc);
      ctx.fillRect(x + w, y + 2 * sc, sc, 6 * sc);
      ctx.fillRect(x, y, sc, 4 * sc);
      break;
    case 3: // bun / round
      ctx.fillRect(x, y, w, 3 * sc);
      ctx.fillRect(x + 3 * sc, y - sc, w - 6 * sc, sc);
      break;
    case 4: // buzz short
      ctx.fillRect(x + sc, y + sc, w - 2 * sc, sc);
      ctx.fillRect(x + 2 * sc, y, w - 4 * sc, sc);
      break;
    case 5: // mohawk
      ctx.fillRect(x + w / 2 - sc, y - 2 * sc, 2 * sc, 4 * sc);
      ctx.fillRect(x + 2 * sc, y, sc, sc);
      ctx.fillRect(x + w - 3 * sc, y, sc, sc);
      break;
  }
}

function drawHat(ctx, cx, x, y, w, sc, color, style) {
  ctx.fillStyle = color;
  switch (style) {
    case 0: // cap
      ctx.fillRect(x - sc, y + sc, w + 2 * sc, sc);
      ctx.fillRect(x + sc, y - sc, w - 2 * sc, 2 * sc);
      ctx.fillStyle = shade(color, 30);
      ctx.fillRect(x + w, y + sc, 3 * sc, sc);
      break;
    case 1: // beanie
      ctx.fillRect(x - sc, y + sc, w + 2 * sc, 2 * sc);
      ctx.fillRect(x + sc, y - sc, w - 2 * sc, 2 * sc);
      ctx.fillStyle = shade(color, 40);
      ctx.fillRect(x + sc, y + 2 * sc, w - 2 * sc, sc);
      break;
    case 2: // top hat
      ctx.fillRect(x + sc, y - 3 * sc, w - 2 * sc, 4 * sc);
      ctx.fillRect(x - 2 * sc, y + sc, w + 4 * sc, sc);
      ctx.fillStyle = shade(color, 50);
      ctx.fillRect(x + sc, y - sc, w - 2 * sc, sc);
      break;
  }
}

// lighten/darken a hex color
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 0xff) + amt, 0, 255), b = clamp((n & 0xff) + amt, 0, 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Draw a framed sticker: avatar + name plate. (x,y) top-left, size = square edge.
export function drawSticker(ctx, name, x, y, size, t, opts = {}) {
  const d = descriptor(name);
  const owned = opts.owned !== false;
  ctx.save();
  // sticker frame
  const r = size * 0.12;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
  roundRectSt(ctx, x, y, size, size, r);
  const g = ctx.createLinearGradient(x, y, x, y + size);
  g.addColorStop(0, owned ? '#232b48' : '#14182a');
  g.addColorStop(1, owned ? '#171e36' : '#0c0f1d');
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
  // inner border
  ctx.strokeStyle = owned ? 'rgba(255,207,77,0.55)' : 'rgba(120,130,170,0.25)';
  ctx.lineWidth = 2; roundRectSt(ctx, x + 3, y + 3, size - 6, size - 6, r - 2); ctx.stroke();

  // avatar
  const avail = size - size * 0.28;
  const scale = Math.max(1, Math.floor(avail / 20));
  drawCharacter(ctx, x + size / 2, y + size * 0.12, scale, d, { t, alpha: owned ? 1 : 0.25 });

  // name plate
  const np = size * 0.2;
  ctx.fillStyle = owned ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.3)';
  roundRectSt(ctx, x + size * 0.08, y + size - np - 6, size * 0.84, np, np * 0.4); ctx.fill();
  const fs = Math.max(1, Math.floor((size * 0.8) / Math.max(name.length, 6) / 6));
  pxTextCenter(ctx, name, x + size / 2, y + size - np - 6 + (np - 7 * fs) / 2, fs, owned ? '#ffe9a8' : '#6b7393');

  // sparkle for rare
  if (d.sparkle && owned) {
    const a = t * 3 + d.phase;
    for (let i = 0; i < 3; i++) {
      const ang = a + i * 2.1;
      const sx = x + size * 0.5 + Math.cos(ang) * size * 0.32;
      const sy = y + size * 0.3 + Math.sin(ang) * size * 0.2;
      drawSparkle(ctx, sx, sy, fs * 1.4, '#fff6c0');
    }
  }
  ctx.restore();
}

function drawSparkle(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - s, y - s / 3, s * 2, (s * 2) / 3);
  ctx.fillRect(x - s / 3, y - s, (s * 2) / 3, s * 2);
  ctx.fillRect(x - s / 2, y - s / 6, s, s / 3);
  ctx.fillRect(x - s / 6, y - s / 2, s / 3, s);
}

// ---------- Japanese/Asian snack stickers ----------
export const SNACKS = [
  'Onigiri', 'Bento Box', 'Ramen', 'Sushi Roll', 'Taiyaki', 'Mochi',
  'Takoyaki', 'Dango', 'Melon Pan', 'Pocky', 'Matcha Latte', 'Onigiri Tuna',
  'Tempura', 'Yakitori', 'Curry Rice', 'Gyoza', 'Miso Soup', 'Udon',
  'Soba', 'Tonkatsu', 'Furikake', 'Sashimi', 'Edamame', 'Yakisoba',
  'Crepe Cake', 'Shaved Ice', 'Egg Tart', 'Pork Bun', 'Spring Roll', 'Dumplings',
  'Matcha Cake', 'Red Bean', 'Lychee', 'Mango Pomelo', 'Bubble Tea', 'Egg Waffle',
  'Pineapple Bun', 'Coconut Jelly', 'Sesame Ball', 'Rice Cake', 'Mochi Ice', 'Dorayaki',
  'Sukiyaki', 'Okonomiyaki', 'Natto', 'Unagi', 'Wagyu', 'Sake',
];

const SNACK_COLORS = {
  'Onigiri': '#f0e8d0', 'Bento Box': '#d8b072', 'Ramen': '#e2a35c', 'Sushi Roll': '#2a3050',
  'Taiyaki': '#d4a040', 'Mochi': '#f0c8e8', 'Takoyaki': '#c8853a', 'Dango': '#e8c8a0',
  'Melon Pan': '#a0d870', 'Pocky': '#5a3a22', 'Matcha Latte': '#7ab86a', 'Onigiri Tuna': '#d09870',
  'Tempura': '#d4a850', 'Yakitori': '#b85a2a', 'Curry Rice': '#d4a020', 'Gyoza': '#e8d8b0',
  'Miso Soup': '#8a7a5a', 'Udon': '#f0e8d0', 'Soba': '#a08868', 'Tonkatsu': '#b8703a',
  'Furikake': '#5a4a3a', 'Sashimi': '#e8807a', 'Edamame': '#6ab84a', 'Yakisoba': '#d4a040',
  'Crepe Cake': '#f5e8d0', 'Shaved Ice': '#a0d8f0', 'Egg Tart': '#e8c850', 'Pork Bun': '#e8d0b0',
  'Spring Roll': '#d4b860', 'Dumplings': '#e8e0c8', 'Matcha Cake': '#8ab86a',
  'Red Bean': '#a0403a', 'Lychee': '#f0d0d0', 'Mango Pomelo': '#f0c850',
  'Bubble Tea': '#d4a070', 'Egg Waffle': '#e8b840', 'Pineapple Bun': '#d4a050',
  'Coconut Jelly': '#f0f0e0', 'Sesame Ball': '#a0682a', 'Rice Cake': '#f0e8d0',
  'Mochi Ice': '#c8a0e0', 'Dorayaki': '#c88848', 'Sukiyaki': '#8a4a2a',
  'Okonomiyaki': '#d4a878', 'Natto': '#a08840', 'Unagi': '#6a5a3a',
  'Wagyu': '#a0403a', 'Sake': '#f0e0c0',
};

// Draw a snack sticker. (x,y) top-left, size = square edge.
export function drawSnackSticker(ctx, name, x, y, size, t, opts = {}) {
  const owned = opts.owned !== false;
  ctx.save();
  const r = size * 0.12;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
  roundRectSt(ctx, x, y, size, size, r);
  const g = ctx.createLinearGradient(x, y, x, y + size);
  g.addColorStop(0, owned ? '#2a1f30' : '#14182a');
  g.addColorStop(1, owned ? '#1a1420' : '#0c0f1d');
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();
  ctx.strokeStyle = owned ? 'rgba(255,150,80,0.5)' : 'rgba(120,130,170,0.25)';
  ctx.lineWidth = 2; roundRectSt(ctx, x + 3, y + 3, size - 6, size - 6, r - 2); ctx.stroke();

  if (owned) {
    drawSnack(ctx, name, x + size / 2, y + size * 0.38, size * 0.28, t);
  } else {
    ctx.globalAlpha = 0.2;
    drawSnack(ctx, name, x + size / 2, y + size * 0.38, size * 0.28, t);
    ctx.globalAlpha = 1;
  }

  // name plate
  const np = size * 0.2;
  ctx.fillStyle = owned ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.3)';
  roundRectSt(ctx, x + size * 0.08, y + size - np - 6, size * 0.84, np, np * 0.4); ctx.fill();
  const fs = Math.max(1, Math.floor((size * 0.8) / Math.max(name.length, 6) / 6));
  pxTextCenter(ctx, name, x + size / 2, y + size - np - 6 + (np - 7 * fs) / 2, fs, owned ? '#ffe9a8' : '#6b7393');
  ctx.restore();
}

// Draw a snack icon at center (cx, cy) with given radius
export function drawSnack(ctx, name, cx, cy, rad, t = 0) {
  const color = SNACK_COLORS[name] || '#d4a050';
  const s = rad;
  ctx.save();
  ctx.translate(cx, cy);

  // categorize by name for different shapes
  if (name.includes('Onigiri')) {
    // triangle rice ball
    ctx.fillStyle = '#f0e8d0';
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.9, s * 0.6); ctx.lineTo(-s * 0.9, s * 0.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a3050'; ctx.fillRect(-s * 0.6, s * 0.2, s * 1.2, s * 0.3); // nori
  } else if (name.includes('Bento') || name.includes('Box')) {
    // bento box
    ctx.fillStyle = '#8a5a2a'; ctx.fillRect(-s, -s * 0.7, s * 2, s * 1.4);
    ctx.fillStyle = '#1a1520'; ctx.fillRect(-s * 0.85, -s * 0.55, s * 1.7, s * 1.1);
    // compartments
    ctx.fillStyle = color; ctx.fillRect(-s * 0.7, -s * 0.4, s * 0.6, s * 0.4);
    ctx.fillStyle = '#e25c5c'; ctx.fillRect(0, -s * 0.4, s * 0.6, s * 0.4);
    ctx.fillStyle = '#43d17a'; ctx.fillRect(-s * 0.7, 0, s * 0.6, s * 0.4);
    ctx.fillStyle = '#e8c850'; ctx.fillRect(0, 0, s * 0.6, s * 0.4);
  } else if (name.includes('Ramen') || name.includes('Udon') || name.includes('Soba')) {
    // bowl of noodles
    ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#f0e8d0'; ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#e2a35c'; // noodle swirl
    ctx.beginPath(); ctx.arc(0, -s * 0.1, s * 0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#43d17a'; ctx.fillRect(-s * 0.2, -s * 0.4, s * 0.15, s * 0.2); // nori
    ctx.fillStyle = '#e25c5c'; ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.3, s * 0.12, 0, TAU); ctx.fill(); // narutomaki
  } else if (name.includes('Sushi') || name.includes('Sashimi')) {
    // sushi piece
    ctx.fillStyle = '#f0e8d0'; ctx.fillRect(-s * 0.7, s * 0.1, s * 1.4, s * 0.5);
    ctx.fillStyle = '#2a3050'; ctx.fillRect(-s * 0.7, -s * 0.1, s * 1.4, s * 0.2);
    ctx.fillStyle = name.includes('Sashimi') ? '#e8807a' : color;
    ctx.fillRect(-s * 0.6, -s * 0.5, s * 1.2, s * 0.4);
  } else if (name.includes('Mochi') || name.includes('Dango')) {
    // round mochi/dango
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(-s * 0.3, 0, s * 0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.3, -s * 0.1, s * 0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(0, s * 0.3, s * 0.4, 0, TAU); ctx.fill();
  } else if (name.includes('Taiyaki')) {
    // fish-shaped pastry
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.7, s * 0.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a3a22'; ctx.beginPath(); ctx.arc(-s * 0.4, -s * 0.1, s * 0.08, 0, TAU); ctx.fill(); // eye
  } else if (name.includes('Takoyaki')) {
    // round ball with sauce
    ctx.fillStyle = '#c8853a'; ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.arc(0, -s * 0.1, s * 0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8c850'; ctx.fillRect(-s * 0.1, -s * 0.4, s * 0.08, s * 0.3); // bonito
    ctx.fillRect(s * 0.1, -s * 0.4, s * 0.08, s * 0.3);
  } else if (name.includes('Pocky')) {
    // stick with coating
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(-s * 0.08, -s * 0.6, s * 0.16, s * 1.2);
    ctx.fillStyle = color; ctx.fillRect(-s * 0.1, -s * 0.6, s * 0.2, s * 0.6);
  } else if (name.includes('Matcha') || name.includes('Latte')) {
    // cup
    ctx.fillStyle = '#f0f0e0'; ctx.fillRect(-s * 0.5, -s * 0.4, s, s * 0.8);
    ctx.fillStyle = color; ctx.fillRect(-s * 0.4, -s * 0.3, s * 0.8, s * 0.5);
    ctx.fillStyle = '#f5f5f5'; ctx.fillRect(-s * 0.35, -s * 0.25, s * 0.7, s * 0.15); // foam
  } else if (name.includes('Bubble') || name.includes('Tea')) {
    // bubble tea cup
    ctx.fillStyle = '#f0f0e0'; ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
    ctx.fillStyle = color; ctx.fillRect(-s * 0.4, -s * 0.2, s * 0.8, s * 0.6);
    ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(-s * 0.2, s * 0.2, s * 0.08, 0, TAU); ctx.arc(0, s * 0.25, s * 0.08, 0, TAU); ctx.arc(s * 0.2, s * 0.2, s * 0.08, 0, TAU); ctx.fill();
  } else if (name.includes('Curry')) {
    ctx.fillStyle = '#f0e8d0'; ctx.fillRect(-s * 0.8, -s * 0.3, s * 1.6, s * 0.6);
    ctx.fillStyle = color; ctx.fillRect(-s * 0.7, -s * 0.25, s * 1.4, s * 0.5);
  } else if (name.includes('Gyoza') || name.includes('Dumpling')) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.6, s * 0.4, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#c4a860'; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.2, -s * 0.3); ctx.lineTo(i * s * 0.2 + 2, -s * 0.1); ctx.stroke(); }
  } else if (name.includes('Miso')) {
    ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, Math.PI); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#43d17a'; ctx.fillRect(-s * 0.1, -s * 0.3, s * 0.08, s * 0.2);
  } else if (name.includes('Tempura')) {
    ctx.fillStyle = '#d4a850'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.6, s * 0.45, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#a08040'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.2); ctx.lineTo(Math.cos(a) * s * 0.6, Math.sin(a) * s * 0.45); ctx.stroke(); }
  } else if (name.includes('Yakitori')) {
    ctx.fillStyle = '#8a5a2a'; ctx.fillRect(-s * 0.06, -s * 0.6, s * 0.12, s * 1.2);
    ctx.fillStyle = color; ctx.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.2);
    ctx.fillRect(-s * 0.3, 0, s * 0.6, s * 0.2);
  } else if (name.includes('Shaved')) {
    ctx.fillStyle = '#a0d8f0'; ctx.beginPath(); ctx.arc(0, 0, s * 0.7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e25c5c'; ctx.fillRect(-s * 0.3, -s * 0.5, s * 0.6, s * 0.15); // syrup
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, -s * 0.3, s * 0.1, 0, TAU); ctx.fill();
  } else if (name.includes('Sake')) {
    ctx.fillStyle = '#f0e0c0'; ctx.beginPath(); ctx.ellipse(0, 0, s * 0.4, s * 0.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8c850'; ctx.fillRect(-s * 0.1, s * 0.1, s * 0.2, s * 0.3);
  } else if (name.includes('Melon')) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.2, -s * 0.5); ctx.lineTo(i * s * 0.2, s * 0.5); ctx.stroke(); }
  } else {
    // generic snack — rounded square
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-s * 0.6, -s * 0.6, s * 1.2, s * 1.2, s * 0.15) : ctx.rect(-s * 0.6, -s * 0.6, s * 1.2, s * 1.2);
    ctx.fill();
  }
  ctx.restore();
}
