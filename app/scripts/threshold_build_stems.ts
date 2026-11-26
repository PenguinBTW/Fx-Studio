#!/usr/bin/env bun
// Procedural THRESHOLD Z1 sound-stem generator. All source audio is synthesized here;
// generated WAVs are evidence/build products and are never committed.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SR = 48000;
const OUT = path.join(import.meta.dir, '../src/scenes/threshold/sound/generated');
mkdirSync(OUT, { recursive: true });

function roomize(input: Float32Array, wet = 0.12): Float32Array {
  const out = new Float32Array(input);
  const frames = input.length / 2;
  for (const [ms, gain] of [[19, 0.55], [43, 0.31], [71, 0.18]] as const) {
    const d = Math.round(ms * SR / 1000);
    for (let f = d; f < frames; f++) {
      out[f * 2] += input[(f - d) * 2]! * gain * wet;
      out[f * 2 + 1] += input[(f - d) * 2 + 1]! * gain * wet * (ms === 19 ? 0.82 : 1);
    }
  }
  return out;
}

function wav(file: string, pcmIn: Float32Array): void {
  const pcm = roomize(pcmIn);
  const n = pcm.length, buf = Buffer.alloc(44 + n * 3);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 3, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 6, 28);
  buf.writeUInt16LE(6, 32); buf.writeUInt16LE(24, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 3, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const q = Math.max(-8388608, Math.min(8388607, Math.round(Math.max(-1, Math.min(1, pcm[i]! * 0.5)) * 8388608)));
    buf.writeIntLE(q, o, 3); o += 3;
  }
  writeFileSync(path.join(OUT, file), buf);
}
const noise = (() => { let x = 0x5eed; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 0xffffffff) * 2 - 1; })();
function stem(sec: number, fn: (t: number) => [number, number]): Float32Array {
  const frames = Math.round(sec * SR), out = new Float32Array(frames * 2);
  for (let i = 0; i < frames; i++) {
    const [l, r] = fn(i / SR);
    out[i * 2] = l; out[i * 2 + 1] = r;
  }
  return out;
}
const env = (t: number, a: number, d: number) => t < 0 ? 0 : Math.min(1, t / Math.max(1e-4, a)) * Math.exp(-Math.max(0, t - a) / d);

// Fluorescent office bed: 60 Hz hum, odd harmonics, HVAC hiss, two failing-tube ticks.
wav('z1_fluorescent_bed.wav', stem(27, (t) => {
  const hum = Math.sin(t * Math.PI * 120) * 0.027 + Math.sin(t * Math.PI * 240) * 0.010 + Math.sin(t * Math.PI * 360) * 0.006;
  const hiss = noise() * 0.012 * (0.75 + 0.25 * Math.sin(t * 0.31));
  const tickA = t > 2.42 && t < 2.49 ? noise() * 0.09 : 0;
  const tickB = t > 8.72 && t < 8.78 ? noise() * 0.07 : 0;
  const fade = Math.min(1, t / 1.15, (27 - t) / 1.4);
  const v = (hum + hiss + tickA + tickB) * Math.max(0, fade);
  return [v * 0.96, v];
}));

// Two old mechanical bell bursts.
wav('z1_phone_ring.wav', stem(2.8, (t) => {
  let v = 0;
  for (const start of [0.02, 1.18]) {
    const u = t - start;
    if (u >= 0 && u < 0.88) {
      const trem = 0.45 + 0.55 * (Math.sin(u * Math.PI * 40) > 0 ? 1 : 0);
      v += (Math.sin(u * Math.PI * 2 * 1280) * 0.21 + Math.sin(u * Math.PI * 2 * 1735) * 0.13) * Math.exp(-u * 3.1) * trem;
    }
  }
  return [v * 0.96, v];
}));

// Receiver silence/breathing: close, dry, delayed-feeling slow breath noise.
wav('z1_receiver_breath.wav', stem(4.2, (t) => {
  const cyc = Math.max(0, Math.sin(t * Math.PI * 0.72 - 0.6));
  const breath = noise() * 0.055 * cyc * cyc;
  const close = Math.sin(t * Math.PI * 2 * 92) * 0.008 * cyc;
  return [breath + close, breath * 0.85 + close];
}));

// Wet overhead breathing, deliberately too slow and too large.
let wetLp = 0;
wav('z1_ceiling_breath.wav', stem(7.0, (t) => {
  wetLp = wetLp * 0.86 + noise() * 0.14;
  const period = 2.65;
  const x = (t % period) / period;
  const gate = Math.sin(Math.PI * x) ** 1.8;
  const closeFade = Math.min(1, t / 0.45, (7 - t) / 0.8);
  const wet = wetLp * 0.19 * gate;
  const chest = Math.sin(t * Math.PI * 2 * 54 + Math.sin(t * 2.2) * 0.7) * 0.030 * gate;
  const gurgle = Math.sin(t * Math.PI * 2 * (37 + Math.sin(t * 1.1) * 8)) * 0.020 * gate * (x > 0.45 ? 1 : 0.35);
  const lip = x > 0.82 && x < 0.86 ? noise() * 0.08 : 0;
  const v = (wet + chest + gurgle + lip) * Math.max(0, closeFade);
  return [v, v * 0.78];
}));

// Grid creaks and cracking tile: pitched metal groans first, then short mineral cracks.
wav('z1_ceiling_creaks.wav', stem(2.2, (t) => {
  let v = 0;
  for (const [at, dur, f0, f1, amp] of [[0.10, 0.48, 118, 82, 0.11], [0.66, 0.38, 170, 126, 0.075], [1.20, 0.30, 96, 71, 0.10]] as const) {
    const u = t - at;
    if (u >= 0 && u < dur) {
      const k = u / dur;
      const hz = f0 + (f1 - f0) * k;
      v += Math.sin(u * Math.PI * 2 * hz + Math.sin(u * 31) * 0.35) * amp * Math.sin(Math.PI * k) ** 1.4;
      v += Math.sin(u * Math.PI * 2 * hz * 2.03) * amp * 0.24 * Math.sin(Math.PI * k);
    }
  }
  for (const at of [1.38, 1.47, 1.61]) {
    const u = t - at;
    if (u > 0 && u < 0.09) v += noise() * 0.24 * Math.exp(-u * 36) + Math.sin(u * Math.PI * 2 * 260) * 0.055 * Math.exp(-u * 24);
  }
  return [v, v * 0.88];
}));

// Carpet run, ceiling rasp, and a separate escalating tile-slam chain behind.
wav('z1_run_carpet.wav', stem(8.4, (t) => {
  let l = noise() * 0.010, r = noise() * 0.010;
  const rate = 3.05;
  const idx = Math.floor(t * rate);
  const step = t - idx / rate;
  if (step < 0.052) {
    const k = 1 - step / 0.052;
    const thud = (noise() * 0.10 + Math.sin(step * Math.PI * 2 * 58) * 0.07) * k;
    if (idx % 2) r += thud * 1.2, l += thud * 0.72;
    else l += thud * 1.2, r += thud * 0.72;
  }
  let slam = 0;
  for (const [i, at] of [0.85, 1.55, 2.2, 2.85, 3.45, 4.05, 4.65, 5.2, 5.8, 6.35, 6.9].entries()) {
    const u = t - at;
    if (u > 0 && u < 0.24) {
      const size = 0.65 + i * 0.055;
      slam += (noise() * 0.16 + Math.sin(u * Math.PI * 2 * (88 - i * 2)) * 0.12 + Math.sin(u * Math.PI * 2 * 244) * 0.035) * Math.exp(-u * 15) * size;
    }
  }
  const rasp = noise() * 0.018 * (0.5 + 0.5 * Math.sin(t * Math.PI * 0.8));
  const fade = Math.min(1, t / 0.18, (8.4 - t) / 0.35);
  return [(l + slam + rasp) * fade, (r + slam * 0.93 + rasp * 1.08) * fade];
}));

// Music-box approach, metal push-bar clank, door burst, then the jingle blooms in daylight.
const notes = [880, 1046.5, 1318.5, 1046.5, 880, 783.99, 1046.5, 1318.5, 1568, 1318.5];
wav('z1_door_jingle_hit.wav', stem(3.0, (t) => {
  let v = 0;
  for (const [i, hz] of notes.entries()) {
    const u = t - i * 0.16;
    if (u > 0 && u < 0.9) {
      const bloom = t < 1.9 ? 0.32 + t * 0.18 : 0.9;
      v += (Math.sin(u * Math.PI * 2 * hz) * 0.105 + Math.sin(u * Math.PI * 2 * hz * 2.01) * 0.026) * Math.exp(-u * 4.2) * bloom;
    }
  }
  const u = t - 1.98;
  if (u > 0 && u < 0.55) {
    const transient = noise() * 0.20 * Math.exp(-u * 30);
    const metal = Math.sin(u * Math.PI * 2 * 214) * 0.18 + Math.sin(u * Math.PI * 2 * 517) * 0.12 + Math.sin(u * Math.PI * 2 * 893) * 0.055;
    const burst = noise() * 0.09 * Math.exp(-u * 8);
    v += (transient + metal + burst) * Math.exp(-u * 6.5);
  }
  return [v, v * 0.94];
}));

console.log(`wrote procedural Z1 stems to ${OUT}`);
