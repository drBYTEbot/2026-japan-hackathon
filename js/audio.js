// audio.js — lightweight WebAudio SFX + simple music. No assets, all synthesized.
import { clamp } from './util.js';

let ctx = null, master = null, musicGain = null, sfxGain = null;
let musicOn = true, sfxOn = true;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
  } catch { ctx = null; }
}
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
export const Audio = {
  get ready() { return !!ctx; },
  setMusic(on) { musicOn = on; if (!on) stopMusic(); },
  setSfx(on) { sfxOn = on; },
  isMusicOn() { return musicOn; },
  isSfxOn() { return sfxOn; },
};

// ---- tone helper ----
function tone(freq, dur, type = 'square', vol = 0.3, attack = 0.005, release = 0.08, dest) {
  if (!ctx || !sfxOn) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest || sfxGain);
  o.start(t0); o.stop(t0 + dur + release);
}
function slide(f1, f2, dur, type = 'square', vol = 0.3) {
  if (!ctx || !sfxOn) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f1, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(sfxGain); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur, vol = 0.3, filterFreq = 1200) {
  if (!ctx || !sfxOn) return;
  const t0 = ctx.currentTime;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(sfxGain); src.start(t0);
}

export const Sfx = {
  coin: () => { tone(880, 0.08, 'square', 0.25); setTimeout(() => tone(1320, 0.12, 'square', 0.25), 60); },
  click: () => tone(420, 0.05, 'square', 0.2),
  hover: () => tone(660, 0.03, 'sine', 0.12),
  step: () => tone(180, 0.04, 'square', 0.12),
  win: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'square', 0.28), i * 90)); },
  lose: () => { slide(400, 80, 0.5, 'sawtooth', 0.3); },
  hit: () => { noise(0.12, 0.35, 900); tone(140, 0.12, 'square', 0.2); },
  attack: () => { slide(300, 600, 0.1, 'square', 0.25); noise(0.06, 0.2, 2000); },
  heal: () => { [523, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'sine', 0.25), i * 70)); },
  select: () => tone(700, 0.06, 'square', 0.2),
  deny: () => tone(120, 0.18, 'sawtooth', 0.25),
  clawGrab: () => { slide(200, 500, 0.3, 'square', 0.2); },
  clawWin: () => { [659, 784, 988, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.28), i * 80)); },
  car: () => noise(0.18, 0.18, 600),
  door: () => slide(120, 240, 0.2, 'square', 0.2),
};

// ---- simple looping background music via scheduled notes ----
let musicTimer = null, musicStep = 0;
// a calm chiptune-ish bass+arp loop
const SCALE = [0, 3, 5, 7, 10]; // minor pentatonic
function midiToFreq(n) { return 440 * Math.pow(2, (n - 69) / 12); }
function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

const TRACKS = {
  hub: { root: 45, bpm: 96, arp: true },
  rush: { root: 41, bpm: 120, arp: true },
  crossy: { root: 48, bpm: 132, arp: true },
  fight: { root: 40, bpm: 100, arp: false },
};
let currentTrack = 'hub';

export function playMusic(name) {
  if (!ctx) return;
  if (name === currentTrack && musicTimer) return;
  currentTrack = name; stopMusic();
  if (!musicOn) return;
  const tr = TRACKS[name] || TRACKS.hub;
  const stepMs = (60 / tr.bpm / 2) * 1000;
  musicStep = 0;
  musicTimer = setInterval(() => {
    if (!ctx || !musicOn) return;
    const s = musicStep % 16;
    // bass
    if (s % 4 === 0) tone(midiToFreq(tr.root - 12), 0.22, 'triangle', 0.5, 0.005, 0.1, musicGain);
    if (s % 4 === 2) tone(midiToFreq(tr.root - 12 + 7), 0.18, 'triangle', 0.4, 0.005, 0.1, musicGain);
    // arp / melody
    if (tr.arp && s % 2 === 0) {
      const deg = SCALE[(musicStep >> 1) % SCALE.length];
      tone(midiToFreq(tr.root + 12 + deg), 0.16, 'square', 0.18, 0.005, 0.08, musicGain);
    } else if (!tr.arp && s % 2 === 1) {
      const deg = SCALE[musicStep % SCALE.length];
      tone(midiToFreq(tr.root + deg), 0.14, 'square', 0.16, 0.005, 0.08, musicGain);
    }
    // hat
    if (s % 2 === 1) tone(9000, 0.02, 'square', 0.03, 0.001, 0.02, musicGain);
    musicStep++;
  }, stepMs);
}
