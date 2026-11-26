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
const hashLike = (t: number, salt: number) => { const x = Math.sin(Math.floor(t * 24) * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };

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
let carpetLp = 0, slamLp = 0;
wav('z1_run_carpet.wav', stem(8.4, (t) => {
  carpetLp = carpetLp * 0.82 + noise() * 0.18;
  slamLp = slamLp * 0.68 + noise() * 0.32;
  let l = carpetLp * 0.075, r = carpetLp * 0.075;
  const rate = 3.05;
  const idx = Math.floor(t * rate);
  const step = t - idx / rate;
  if (step < 0.075) {
    const k = 1 - step / 0.075;
    const thud = (noise() * 0.07 + carpetLp * 0.34 + Math.sin(step * Math.PI * 2 * 58) * 0.17) * k;
    if (idx % 2) r += thud * 1.2, l += thud * 0.72;
    else l += thud * 1.2, r += thud * 0.72;
  }
  let slam = 0;
  for (const [i, at] of [0.85, 1.55, 2.2, 2.85, 3.45, 4.05, 4.65, 5.2, 5.8, 6.35, 6.9].entries()) {
    const u = t - at;
    if (u > 0 && u < 0.24) {
      const size = 0.65 + i * 0.055;
      slam += (noise() * 0.08 + slamLp * 0.18 + Math.sin(u * Math.PI * 2 * (88 - i * 2)) * 0.24 + Math.sin(u * Math.PI * 2 * 244) * 0.045) * Math.exp(-u * 11) * size;
    }
  }
  const rasp = (noise() * 0.016 + carpetLp * 0.025) * (0.5 + 0.5 * Math.sin(t * Math.PI * 0.8));
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
      const bloom = t < 2.08 ? 0.20 + t * 0.08 : 1.05;
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

// Full-timeline room-tone beds. These are architectural continuity layers, not final creature/cue passes:
// every zone has a distinct physical space tone and edge fades overlap the engine transition windows.
function edgeFade(t: number, dur: number, fadeIn: number, fadeOut: number): number {
  return Math.max(0, Math.min(1, t / fadeIn, (dur - t) / fadeOut));
}
function bed(file: string, dur: number, fadeIn: number, fadeOut: number, fn: (t: number, lp: () => number) => [number, number]): void {
  let lpState = 0;
  const lp = () => (lpState = lpState * 0.86 + noise() * 0.14);
  wav(file, stem(dur, (t) => {
    const [l, r] = fn(t, lp);
    const e = edgeFade(t, dur, fadeIn, fadeOut);
    return [l * e, r * e];
  }));
}

bed('z0_machine_room_tone.wav', 4.2, 0.18, 0.42, (t, lp) => {
  const hum = Math.sin(t * Math.PI * 2 * 58) * 0.018 + Math.sin(t * Math.PI * 2 * 117) * 0.006;
  const fan = lp() * 0.036;
  const relay = (t > 1.16 && t < 1.20) || (t > 2.04 && t < 2.075) ? noise() * 0.055 : 0;
  const v = hum + fan + relay;
  return [v, v * 0.86];
});

bed('z2_playroom_room_tone.wav', 25.8, 0.65, 0.85, (t, lp) => {
  const air = noise() * 0.009 + lp() * 0.018;
  const plastic = Math.sin(t * Math.PI * 2 * 310) * 0.0022 * Math.max(0, Math.sin(t * 0.71));
  const balls = (hashLike(t, 3.1) > 0.988 ? noise() * 0.032 : 0);
  const v = air + plastic + balls;
  return [v * 0.92, v];
});

bed('z3_pool_room_tone.wav', 26.0, 0.75, 1.1, (t, lp) => {
  const wet = lp() * 0.042;
  const water = Math.sin(t * Math.PI * 2 * 0.53) * 0.006 + Math.sin(t * Math.PI * 2 * 1.17) * 0.003;
  let drip = 0;
  for (const at of [3.2, 8.9, 14.4, 21.7]) {
    const u = t - at;
    if (u > 0 && u < 0.28) drip += Math.sin(u * Math.PI * 2 * 930) * 0.035 * Math.exp(-u * 22);
  }
  const v = wet * 0.55 + water + drip;
  return [v, v * 0.82];
});

bed('z4_library_room_tone.wav', 25.9, 0.9, 0.75, (t, lp) => {
  const hush = lp() * 0.018;
  const lamp = Math.sin(t * Math.PI * 2 * 118) * 0.004;
  let flutter = 0;
  for (const at of [4.4, 11.2, 18.8]) {
    const u = t - at;
    if (u > 0 && u < 0.5) flutter += noise() * 0.025 * Math.sin(Math.PI * u / 0.5);
  }
  const v = hush + lamp + flutter;
  return [v * 0.9, v];
});

bed('z5_motel_room_tone.wav', 25.9, 0.55, 1.0, (t, lp) => {
  const rain = noise() * 0.014 + lp() * 0.023;
  const neon = Math.sin(t * Math.PI * 2 * 119) * 0.009 + Math.sin(t * Math.PI * 2 * 238) * 0.003;
  const pipe = Math.sin(t * Math.PI * 2 * 47) * 0.004 * (0.5 + 0.5 * Math.sin(t * 0.23));
  const v = rain + neon + pipe;
  return [v, v * 0.9];
});

bed('z6_theatre_room_tone.wav', 21.1, 0.95, 0.9, (t, lp) => {
  const feltAir = lp() * 0.014;
  const cloth = Math.sin(t * Math.PI * 2 * 36) * 0.004;
  let creak = 0;
  for (const at of [5.1, 12.6, 17.4]) {
    const u = t - at;
    if (u > 0 && u < 0.65) creak += Math.sin(u * Math.PI * 2 * (112 - u * 35)) * 0.022 * Math.sin(Math.PI * u / 0.65);
  }
  const v = feltAir + cloth + creak;
  return [v * 0.86, v];
});

bed('z7_cathedral_room_tone.wav', 46.1, 0.8, 1.1, (t, lp) => {
  const fans = lp() * 0.045;
  const hum = Math.sin(t * Math.PI * 2 * 59) * 0.015 + Math.sin(t * Math.PI * 2 * 177) * 0.004;
  let relay = 0;
  for (const at of [6.2, 13.5, 22.8, 34.1, 41.3]) {
    const u = t - at;
    if (u > 0 && u < 0.08) relay += noise() * 0.07 * Math.exp(-u * 40);
  }
  let coin = 0;
  for (const at of [18.2, 31.7]) {
    const u = t - at;
    if (u > 0 && u < 0.38) coin += (Math.sin(u * Math.PI * 2 * 1730) + Math.sin(u * Math.PI * 2 * 2410) * 0.4) * 0.018 * Math.exp(-u * 12);
  }
  const v = fans + hum + relay + coin;
  return [v, v * 0.88];
});

bed('z8_home_room_tone.wav', 30.6, 0.8, 1.8, (t, lp) => {
  const room = lp() * 0.017;
  const clock = t % 1 < 0.025 ? noise() * 0.022 : 0;
  const warm = Math.sin(t * Math.PI * 2 * 60) * 0.004;
  let settling = 0;
  for (const at of [7.4, 18.9]) {
    const u = t - at;
    if (u > 0 && u < 0.22) settling += noise() * 0.028 * Math.exp(-u * 18);
  }
  const v = room + clock + warm + settling;
  return [v * 0.94, v];
});

bed('end_office_afterimage_tone.wav', 10.0, 0.4, 2.4, (t, lp) => {
  const hum = Math.sin(t * Math.PI * 2 * 60) * 0.011 + Math.sin(t * Math.PI * 2 * 180) * 0.003;
  const hiss = noise() * 0.006 + lp() * 0.012;
  const v = hum + hiss;
  return [v, v * 0.96];
});

console.log(`wrote procedural THRESHOLD stems to ${OUT}`);
