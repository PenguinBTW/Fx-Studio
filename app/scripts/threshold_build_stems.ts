#!/usr/bin/env bun
// Procedural THRESHOLD Z1 sound-stem generator. All source audio is synthesized here;
// generated WAVs are evidence/build products and are never committed.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SR = 48000;
const OUT = path.join(import.meta.dir, '../src/scenes/threshold/sound/generated');
mkdirSync(OUT, { recursive: true });

function wav(file: string, pcm: Float32Array): void {
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
  const v = hum + hiss + tickA + tickB;
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
wav('z1_ceiling_breath.wav', stem(7.0, (t) => {
  const phase = Math.sin(t * Math.PI * 0.42);
  const gate = Math.max(0, phase) ** 2;
  const wet = noise() * 0.072 * gate + Math.sin(t * Math.PI * 2 * 73 + Math.sin(t * 3.1)) * 0.018 * gate;
  const gurgle = Math.sin(t * Math.PI * 2 * (41 + Math.sin(t * 0.9) * 7)) * 0.012 * gate;
  return [wet + gurgle, wet * 0.82 + gurgle];
}));

// Grid creaks and cracking tile.
wav('z1_ceiling_creaks.wav', stem(2.2, (t) => {
  const c1 = env(t - 0.12, 0.035, 0.23) * Math.sin(t * Math.PI * 2 * (140 - t * 22));
  const c2 = env(t - 0.72, 0.025, 0.18) * noise() * 1.9;
  const crack = env(t - 1.38, 0.012, 0.09) * noise() * 2.8;
  const v = (c1 + c2 + crack) * 0.16;
  return [v, v * 0.9];
}));

// Carpet run, ceiling rasp, and tile impacts behind.
wav('z1_run_carpet.wav', stem(8.4, (t) => {
  let v = noise() * 0.014;
  const step = t % (1 / 3.05);
  if (step < 0.045) v += (noise() * 0.16 + Math.sin(step * Math.PI * 2 * 64) * 0.06) * (1 - step / 0.045);
  for (const at of [1.0, 2.25, 3.55, 4.7, 6.15]) {
    const u = t - at;
    if (u > 0 && u < 0.18) v += noise() * 0.22 * Math.exp(-u * 18) + Math.sin(u * Math.PI * 2 * 96) * 0.10 * Math.exp(-u * 12);
  }
  const rasp = noise() * 0.025 * (0.5 + 0.5 * Math.sin(t * Math.PI * 0.8));
  return [v + rasp, v * 0.92 + rasp * 1.08];
}));

// Music-box approach, door-bar clank, then hard daylight cut cue.
const notes = [880, 1046.5, 1318.5, 1046.5, 880, 783.99, 1046.5, 1318.5];
wav('z1_door_jingle_hit.wav', stem(3.0, (t) => {
  let v = 0;
  for (const [i, hz] of notes.entries()) {
    const u = t - i * 0.18;
    if (u > 0 && u < 0.7) v += Math.sin(u * Math.PI * 2 * hz) * 0.07 * Math.exp(-u * 5) * (0.35 + t * 0.35);
  }
  const u = t - 2.02;
  if (u > 0 && u < 0.42) v += (noise() * 0.22 + Math.sin(u * Math.PI * 2 * 210) * 0.18 + Math.sin(u * Math.PI * 2 * 517) * 0.09) * Math.exp(-u * 10);
  return [v, v * 0.95];
}));

console.log(`wrote procedural Z1 stems to ${OUT}`);
