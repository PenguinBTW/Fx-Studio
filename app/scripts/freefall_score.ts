// FREEFALL score: an original 38 s piece in D minor at 120 bpm (19 bars of i-VI-III-VII), written in code so it ships
// with the repo. Sections follow the dive: orbit bells -> storm kick -> bullet-time drop-out -> plankton plucks ->
// the "closer." stop -> the slam at 20 s -> quark snare roll -> glitch stutter -> silence on "that's your screen." ->
// pull-back swell into the opening. Everything is scheduled on [0, 38) and tails past 38 s wrap into the start, so
// the stem loops sample-exactly with the picture.
//   bun scripts/freefall_score.ts   ->   src/scenes/freefall/stems/music.flac
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { SR, Osc, SVF, Noise, mkStereo, makeIR, reverb, encodeWav, type Stereo } from './sfx/synth';
import { mulberry32 } from '../src/engine/util';

const L = 38, TAIL = 4, N = (L + TAIL) * SR, LN = L * SR, BEAT = 0.5, BAR = 2, TAU = Math.PI * 2;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const CH = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]]; // Dm Bb F C
const chordAt = (t: number) => CH[Math.floor(t / BAR) % 4]!;
const inR = (t: number, ...r: [number, number][]) => r.some(([a, b]) => t >= a && t < b);
const pts = (p: [number, number][]) => (t: number) => {
  if (t <= p[0]![0]) return p[0]![1];
  for (let i = 1; i < p.length; i++) if (t < p[i]![0]) { const [a, va] = p[i - 1]!, [b, vb] = p[i]!; return va + ((vb - va) * (t - a)) / (b - a); }
  return p[p.length - 1]![1];
};

const dry = mkStereo(N), send = mkStereo(N), pad = mkStereo(N), low = mkStereo(N), bass = mkStereo(N);
function put(dst: Stereo, t0: number, len: number, fn: (t: number) => number, pan = 0, g = 1, sendG = 0) {
  const i0 = Math.round(t0 * SR), n = Math.round(len * SR), th = ((pan + 1) * Math.PI) / 4, gl = Math.cos(th) * g, gr = Math.sin(th) * g;
  for (let i = 0; i < n && i0 + i < N; i++) {
    const v = fn(i / SR), j = i0 + i; dst.l[j] += v * gl; dst.r[j] += v * gr;
    if (sendG) { send.l[j] += v * gl * sendG; send.r[j] += v * gr * sendG; }
  }
}

const kicks: number[] = [];
function kick(t0: number, g = 1) {
  kicks.push(t0); let ph = 0;
  put(low, t0, 0.45, (t) => { ph += (44 + 90 * Math.exp(-t / 0.028)) / SR; return Math.sin(TAU * ph) * Math.exp(-t / 0.16) * Math.min(1, t / 0.001) + (t < 0.004 ? (1 - t / 0.004) * 0.3 : 0); }, 0, 0.9 * g);
}
function clap(t0: number, g = 1) {
  const nz = new Noise(mulberry32(Math.round(t0 * 1000) + 1), 'white'), f = new SVF();
  put(dry, t0, 0.25, (t) => f.process(nz.next(), 1400, 1.1, 'bp') * [0, 0.011, 0.022].reduce((s, d) => s + (t >= d ? Math.exp(-(t - d) / (d === 0.022 ? 0.09 : 0.008)) : 0), 0), 0, 0.55 * g, 0.25);
}
function hat(t0: number, g = 1) {
  const nz = new Noise(mulberry32(Math.round(t0 * 997) + 5), 'white'), f = new SVF();
  put(dry, t0, 0.06, (t) => f.process(nz.next(), 8000, 0.8, 'hp') * Math.exp(-t / 0.022), 0.25, 0.22 * g);
}
function bassNote(t0: number, m: number, len: number, g = 1) {
  const o = new Osc('saw'), s = new Osc('sine'), f = new SVF(), fq = mtof(m);
  put(bass, t0, len + 0.08, (t) => (f.process(o.next(fq), 180 + 900 * Math.exp(-t / 0.06), 1.2, 'lp') * 0.6 + s.next(fq) * 0.7) * Math.min(1, t / 0.004) * (t < len ? 1 : Math.exp(-(t - len) / 0.02)) * Math.exp(-t / 0.5), 0, 0.55 * g);
}
function pluck(t0: number, m: number, g: number, bright: number, pan: number) {
  const o = new Osc('saw'), o2 = new Osc('saw', 0.3), f = new SVF(), fq = mtof(m);
  put(dry, t0, 0.4, (t) => f.process(o.next(fq) + o2.next(fq * 1.006), 400 + bright * Math.exp(-t / 0.07), 1.4, 'lp') * Math.exp(-t / 0.16) * Math.min(1, t / 0.002), pan, 0.16 * g, 0.4);
}
function bell(t0: number, m: number, g: number, pan: number) {
  const c = new Osc('sine'), mo = new Osc('sine'), fq = mtof(m);
  put(dry, t0, 2.2, (t) => c.next(fq, (1.6 * Math.exp(-t / 0.25) * mo.next(fq * 3.5)) / TAU) * Math.exp(-t / 0.7) * Math.min(1, t / 0.003), pan, 0.14 * g, 0.7);
}

// pad: three detuned saws per chord tone plus an octave voice, one chord per bar, filtered on the bus below
for (let b = 0; b < L / BAR; b++) {
  const t0 = b * BAR, ch = CH[b % 4]!;
  for (const [ni, m] of [...ch, ch[0]! + 12].entries()) for (let v = 0; v < 3; v++) {
    const o = new Osc('saw', ((b * 7 + ni * 3 + v) % 10) / 10), fq = mtof(m) * Math.pow(2, ((v - 1) * 9) / 1200);
    put(pad, t0, BAR + 1.2, (t) => o.next(fq) * Math.min(1, t / 0.35) * (t < BAR ? 1 : Math.exp(-(t - BAR) / 0.35)), (v - 1) * 0.6, ni === 3 ? 0.035 : 0.06, 0.35);
  }
}
// orbit drone: D1 tuned to a whole number of cycles in 38 s, so it is phase-continuous across the loop
{ const f = 1395 / L, g = pts([[0, 0.35], [3.8, 0.35], [4.1, 0], [33, 0], [36, 0.3], [38, 0.35]]); put(low, 0, L, (t) => Math.sin(TAU * f * t) * g(t), 0, 0.5); }

const drums = (t: number) => inR(t, [4, 9.4], [10.7, 18.1], [20, 30.6]);
for (let k = 0; k < L / BEAT; k++) {
  const t = k * BEAT, bt = k % 4, ch = chordAt(t);
  if (drums(t)) kick(t, t >= 20 ? 1.1 : 1);
  if (inR(t, [15, 18.1], [20, 29]) && (bt === 1 || bt === 3)) clap(t);
  if (inR(t, [4, 9.4], [10.7, 18.1])) bassNote(t, ch[0]! - 12, 0.38);
  if (inR(t, [20, 30.6])) bassNote(t + 0.25, ch[0]! - 12 + (k % 2 ? 12 : 0), 0.2, 1.1);
  if (inR(t, [8, 9.4], [10.7, 18.1])) hat(t + 0.25);
  if (inR(t, [20, 30.6])) for (let s = 0; s < 4; s++) hat(t + s * 0.125, s === 2 ? 1.2 : 0.6);
}
const PAT = [0, 2, 1, 2, 0, 2, 1, 3, 0, 2, 1, 2, 3, 2, 1, 2];
for (let j = 0; j < L / 0.125; j++) {
  const t = j * 0.125; if (!inR(t, [11, 18.1], [20, 30.6])) continue;
  const ch = chordAt(t), tones = [ch[0]! + 12, ch[1]! + 12, ch[2]! + 12, ch[0]! + 24], hi = t >= 20;
  pluck(t, tones[PAT[j % 16]!]!, hi ? 1 : 0.7, hi ? 3500 + (t - 20) * 250 : 1800, ((j % 4) - 1.5) * 0.3);
}
const BR = mulberry32(19);
for (let j = 0; j < L / 0.25; j++) {
  const t = j * 0.25, r = BR(), r2 = BR(); if (!inR(t, [0, 3.6], [35, 38]) || r < 0.4) continue;
  const ch = chordAt(t), tones = [ch[0]! + 24, ch[1]! + 24, ch[2]! + 24, ch[0]! + 36, ch[2]! + 12];
  bell(t, tones[Math.floor(r2 * 5)]!, 1, (r2 - 0.5) * 1.2);
}
for (let t = 29, g = 0.3; t < 30.6;) { clap(t, g); t += t < 29.75 ? 0.25 : t < 30.25 ? 0.125 : 0.0625; g = Math.min(1, g + 0.05); }

// bus processing: kick sidechain on pad + bass, pad filter/gain lanes, shared plate
const duck = new Float64Array(N).fill(1);
for (const k of kicks) { const i0 = Math.round(k * SR); for (let i = 0; i < 0.5 * SR && i0 + i < N; i++) duck[i0 + i] = Math.min(duck[i0 + i]!, 1 - 0.45 * Math.exp(-i / SR / 0.14)); }
const cut = pts([[0, 800], [3.6, 900], [4, 500], [8, 600], [9.4, 300], [10.7, 900], [11, 1200], [15, 1500], [18.1, 700], [19.6, 900], [20, 2200], [24, 2600], [28, 3200], [30.6, 4200], [31, 500], [33, 600], [36.8, 1400], [38, 800]]);
const padG = pts([[0, 0.8], [4, 0.7], [9.4, 0.5], [10.7, 0.7], [18.1, 0.75], [18.5, 0.35], [19.6, 0.5], [20, 0.8], [30.6, 0.9], [31, 0], [31.15, 0], [31.8, 0.4], [33, 0.4], [36.8, 0.9], [38, 0.8]]);
for (const ch of ['l', 'r'] as const) {
  const f = new SVF(), p = pad[ch], b = bass[ch];
  for (let i = 0; i < N; i++) { const t = i / SR, tt = t >= L ? t - L : t; p[i] = f.process(p[i]!, cut(tt), 0.9, 'lp') * padG(tt) * duck[i]!; b[i] = b[i]! * duck[i]!; }
}
const wet = reverb(send, makeIR({ seconds: 3, rt60: 2.2, hiHz: 7000, loHz: 500, seed: 38 }), 1, 0);
const out = mkStereo(N);
for (const ch of ['l', 'r'] as const) for (let i = 0; i < N; i++) out[ch][i] = dry[ch][i]! + low[ch][i]! + pad[ch][i]! + bass[ch][i]! + wet[ch][i]! * 0.5;

// 30.6-31.0: buffer stutter (32nd -> 64th -> 128th-note repeats at 120 bpm) with a bitcrushed end, then a dead stop on "that's your screen."
{
  const i0 = Math.round(30.6 * SR), i1 = Math.round(31.0 * SR);
  for (const ch of ['l', 'r'] as const) for (let i = i0; i < i1; i++) {
    const loc = i - i0, sl = Math.round((loc < 0.2 * SR ? 0.0625 : loc < 0.3 * SR ? 0.03125 : 0.015625) * SR);
    let v = out[ch][i0 + (loc % sl)]!; if (loc > 0.3 * SR) v = Math.round(v * 24) / 24; out[ch][i] = v;
  }
  const gate = pts([[30.98, 1], [31.0, 0], [31.12, 0], [31.6, 1]]);
  for (const ch of ['l', 'r'] as const) for (let i = Math.round(30.9 * SR); i < Math.round(31.7 * SR); i++) out[ch][i] *= gate(i / SR);
}
// wrap the tail into the start and cut to exactly 38 s
const fin = mkStereo(LN);
for (const ch of ['l', 'r'] as const) { for (let i = 0; i < LN; i++) fin[ch][i] = out[ch][i]!; for (let i = LN; i < N; i++) fin[ch][i - LN] += out[ch][i]!; }
let pk = 0;
for (const ch of ['l', 'r'] as const) for (let i = 0; i < LN; i++) pk = Math.max(pk, Math.abs(fin[ch][i]!));
const sc = Math.pow(10, -3 / 20) / pk;
for (const ch of ['l', 'r'] as const) for (let i = 0; i < LN; i++) fin[ch][i] *= sc;

const dir = path.resolve(import.meta.dir, '../src/scenes/freefall/stems');
mkdirSync(dir, { recursive: true });
const wav = path.join(dir, 'music.tmp.wav');
writeFileSync(wav, encodeWav(fin));
const enc = Bun.spawnSync(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-c:a', 'flac', path.join(dir, 'music.flac')]);
rmSync(wav);
if (enc.exitCode !== 0) throw new Error('flac encode failed');
console.log(`wrote ${path.join(dir, 'music.flac')} (${L} s, peak -3 dBFS)`);
