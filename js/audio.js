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

// ---- looping background music via scheduled notes ----
let musicTimer = null, musicStep = 0;
let musicGain2 = null;
function midiToFreq(n) { return 440 * Math.pow(2, (n - 69) / 12); }
function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

// ---- drum synthesis ----
function kick(dest) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(130, t0);
  o.frequency.exponentialRampToValueAtTime(40, t0 + 0.1);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.7, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
  o.connect(g); g.connect(dest || musicGain); o.start(t0); o.stop(t0 + 0.2);
}
function snare(dest) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const n = Math.floor(ctx.sampleRate * 0.12);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
  src.connect(f); f.connect(g); g.connect(dest || musicGain); src.start(t0);
  // body tone
  const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t0);
  const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.15, t0); g2.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
  o.connect(g2); g2.connect(dest || musicGain); o.start(t0); o.stop(t0 + 0.1);
}
function hat(dest, open) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const dur = open ? 0.06 : 0.02;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
  const g = ctx.createGain(); g.gain.setValueAtTime(open ? 0.12 : 0.08, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(dest || musicGain); src.start(t0);
}

// ---- note player (connects to music gain) ----
function mnote(freq, dur, type = 'square', vol = 0.18, attack = 0.005, release = 0.06) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.setValueAtTime(vol, t0 + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(musicGain); o.start(t0); o.stop(t0 + dur + release);
}
function mbass(freq, dur, vol = 0.4) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t0);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(800, t0);
  f.frequency.exponentialRampToValueAtTime(200, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(f); f.connect(g); g.connect(musicGain); o.start(t0); o.stop(t0 + dur + 0.05);
}

// ---- track definitions ----
// Each track: { bpm, pattern: function(step) }
// step = 0..63 (4 bars × 16 sixteenths)

const TRACKS = {
  hub: {
    bpm: 100,
    pattern(step) {
      const s = step % 16;
      const bar = Math.floor(step / 16) % 4;
      const roots = [62, 58, 65, 60]; // Dm Bb F C
      const root = roots[bar];
      // bass on 8th notes
      if (s % 2 === 0) mbass(midiToFreq(root - 12), 0.3);
      // soft kick
      if (s === 0 || s === 8) kick();
      // hat
      if (s % 2 === 1) hat(null, false);
      // gentle melody
      const melody = [0, 3, 5, 7, 5, 3, 0, 0, 3, 5, 7, 10, 7, 5, 3, 0];
      if (s % 2 === 0) mnote(midiToFreq(root + melody[s]), 0.2, 'triangle', 0.12);
    }
  },

  rush: {
    bpm: 120,
    pattern(step) {
      const s = step % 16;
      const bar = Math.floor(step / 16) % 4;
      const roots = [57, 60, 62, 55]; // Am C Dm G
      const root = roots[bar];
      if (s % 2 === 0) mbass(midiToFreq(root - 12), 0.25);
      if (s === 0 || s === 8) kick();
      if (s === 4 || s === 12) snare();
      if (s % 2 === 1) hat(null, false);
      const mel = [0, 4, 7, 4, 0, 4, 7, 9, 7, 4, 0, 4, 7, 9, 7, 4];
      if (s % 2 === 0) mnote(midiToFreq(root + 12 + mel[s]), 0.18, 'square', 0.14);
    }
  },

  crossy: {
    bpm: 140,
    pattern(step) {
      const s = step % 16;
      const bar = Math.floor(step / 16) % 4;
      const roots = [60, 62, 65, 67]; // C Dm F G
      const root = roots[bar];
      // driving 16th bass
      if (s % 1 === 0) mbass(midiToFreq(root - 12), 0.12, 0.3);
      // drums
      if (s === 0 || s === 6 || s === 8 || s === 14) kick();
      if (s === 4 || s === 12) snare();
      if (s % 2 === 0) hat(null, s % 4 === 2);
      // melody
      const mel = [12, 14, 15, 17, 15, 14, 12, 10, 12, 14, 15, 17, 19, 17, 15, 14];
      if (s % 2 === 0) mnote(midiToFreq(root + mel[s]), 0.15, 'square', 0.16);
    }
  },

  fight: {
    bpm: 138,
    pattern(step) {
      const s = step % 16;
      const bar = Math.floor(step / 16) % 4;
      // Dm - Bb - F - C progression (classic dramatic)
      const roots = [62, 58, 65, 60];
      const chordTones = [
        [62, 65, 69], // Dm: D F A
        [58, 62, 65], // Bb: Bb D F
        [65, 69, 72], // F: F A C
        [60, 64, 67], // C: C E G
      ];
      const root = roots[bar];

      // === driving 16th-note bassline ===
      const bassPat = [0, 0, 7, 0, 0, 0, 7, 0, 0, 0, 7, 0, 5, 0, 7, 0];
      mbass(midiToFreq(root - 12 + bassPat[s]), 0.08, 0.35);

      // === drums: kick on 1,3 + syncopation; snare on 2,4 ===
      if (s === 0 || s === 8) kick();
      if (s === 6 || s === 14) kick(); // syncopated kick
      if (s === 4 || s === 12) snare();
      if (s % 2 === 1) hat(null, false);
      if (s === 2 || s === 10) hat(null, true); // open hat

      // === chord stabs on offbeats ===
      if (s % 4 === 2) {
        const ct = chordTones[bar];
        ct.forEach(n => mnote(midiToFreq(n), 0.12, 'sawtooth', 0.08));
      }

      // === lead melody (changes per bar, 32-step phrase) ===
      // Bar 1-2: tense ascending phrase
      // Bar 3-4: descending resolution
      const melodies = [
        [69, 0, 72, 0, 74, 72, 69, 0, 72, 0, 74, 77, 74, 72, 69, 0],     // bar 1
        [69, 0, 72, 0, 74, 77, 79, 77, 74, 72, 69, 0, 72, 0, 0, 0],     // bar 2
        [77, 0, 74, 0, 72, 69, 65, 0, 69, 0, 72, 0, 74, 72, 69, 0],     // bar 3
        [69, 0, 65, 0, 62, 0, 58, 0, 65, 69, 72, 74, 72, 69, 0, 0],     // bar 4
      ];
      const note = melodies[bar][s];
      if (note > 0) {
        mnote(midiToFreq(note), 0.14, 'square', 0.16);
        // octave layer for richness
        mnote(midiToFreq(note + 12), 0.12, 'square', 0.06);
      }
    }
  },
};

let currentTrack = 'hub';

export function playMusic(name) {
  if (!ctx) return;
  if (name === currentTrack && musicTimer) return;
  currentTrack = name; stopMusic();
  if (!musicOn) return;
  const tr = TRACKS[name] || TRACKS.hub;
  const stepMs = (60 / tr.bpm / 4) * 1000; // 16th note interval
  musicStep = 0;
  musicTimer = setInterval(() => {
    if (!ctx || !musicOn) return;
    tr.pattern(musicStep);
    musicStep++;
  }, stepMs);
}
