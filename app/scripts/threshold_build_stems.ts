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
const hash01 = (n: number, salt: number) => { const x = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };
const smoothstep = (a: number, b: number, x: number) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };

// Fluorescent office bed: 60 Hz hum, odd harmonics, HVAC hiss, two failing-tube ticks.
let z1AirL = 0, z1AirR = 0;
wav('z1_fluorescent_bed.wav', stem(27, (t) => {
  const hum = Math.sin(t * Math.PI * 120) * 0.027 + Math.sin(t * Math.PI * 240) * 0.010 + Math.sin(t * Math.PI * 360) * 0.006;
  const hiss = noise() * 0.012 * (0.75 + 0.25 * Math.sin(t * 0.31));
  if ((t > 2.42 && t < 2.49) || (t > 8.72 && t < 8.78)) noise();
  const fade = Math.max(0, Math.min(1, t / 1.15, (27 - t) / 1.4));
  const center = hum + hiss * 0.45;
  const si = Math.floor(t * SR + 0.5);
  z1AirL = z1AirL * 0.935 + (hash01(si, 3.1) - 0.5) * 0.065;
  z1AirR = z1AirR * 0.935 + (hash01(si, 4.7) - 0.5) * 0.065;
  return [(center * 0.96 + z1AirL * 0.34) * fade, (center + z1AirR * 0.34) * fade];
}));

// Failing-tube ticks are discrete events, kept outside the bed so negative-space
// bed dips cannot suppress them.
wav('z1_fluorescent_ticks.wav', stem(27, (t) => {
  const si = Math.floor(t * SR + 0.5);
  const tickA = t > 2.42 && t < 2.49 ? (hash01(si, 6.1) * 2 - 1) * 0.09 : 0;
  const tickB = t > 8.72 && t < 8.78 ? (hash01(si, 7.3) * 2 - 1) * 0.07 : 0;
  const v = tickA + tickB;
  return [v * 0.96, v];
}));

// Two old mechanical bell bursts.
wav('z1_phone_ring.wav' , stem(2.8, (t) => {
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
    // Keep the low footstep weight, but shave the noisy attack crest that otherwise
    // makes the master limiter pump throughout the first chase.
    const stepVar = 0.82 + hash01(idx, 5.1) * 0.36;
    const thud = (noise() * 0.03 + carpetLp * 0.16 + Math.sin(step * Math.PI * 2 * 58) * 0.22) * k * stepVar;
    if (idx % 2) r += thud * 1.2, l += thud * 0.72;
    else l += thud * 1.2, r += thud * 0.72;
  }
  let slam = 0;
  for (const [i, at] of [0.85, 1.55, 2.2, 2.85, 3.45, 4.05, 4.65, 5.2, 5.8, 6.35, 6.9].entries()) {
    const u = t - at;
    if (u > 0 && u < 0.24) {
      const size = 0.65 + i * 0.055;
      // Keep the low tile-slam body intact but shave the noise/top-edge transient crest;
      // otherwise the master lookahead limiter pumps the whole chase underneath it.
      const slamBody = Math.sin(u * Math.PI * 2 * (88 - i * 2)) * 0.24;
      const slamEdge = noise() * 0.036 + slamLp * 0.095 + Math.sin(u * Math.PI * 2 * 244) * 0.020;
      slam += (slamBody + slamEdge) * Math.exp(-u * 8) * size * 0.58;
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



// Silent sidechain key for the 40.5s freeze vacuum; carried on foley_guide so it is
// never audible in the master.
wav('z2_freeze_duck_key.wav', stem(0.5, () => [0, 0]));

// Z2 playroom cue pass from z2_z4_audio_cue_spec.md. Local stem time starts at 29.6;
// `at` is project time so every event matches the sheet exactly.
const z2HeartTimes: number[] = [];
{
  let t = 40.8;
  while (t < 47.5) {
    z2HeartTimes.push(t);
    const k = Math.max(0, Math.min(1, (t - 40.8) / 6.7));
    const bpm = 72 + (95 - 72) * k;
    t += 60 / bpm;
  }
}
let z2NoiseLp = 0;
let z2FrictionLp = 0;
wav('z2_playroom_events.wav', stem(25.8, (t) => {
  const at = t + 29.6;
  z2NoiseLp = z2NoiseLp * 0.82 + noise() * 0.18;
  z2FrictionLp = z2FrictionLp * 0.9 + noise() * 0.1;
  let l = 0, r = 0;
  const add = (v: number, pan = 0) => {
    const a = (pan + 1) * Math.PI / 4;
    l += v * Math.cos(a);
    r += v * Math.sin(a);
  };

  // Music-box bed: bright, slightly too slow, note 6 drops out only after 36.0,
  // then the whole jingle is removed into the freeze vacuum at 40.5.
  if (at >= 30.0 && at < 40.46) {
    const pos = at - 30.0;
    const noteLen = 0.34;
    const idx = Math.floor(pos / noteLen) % 8;
    const u = pos % noteLen;
    const scale = [880, 1046.5, 1318.5, 1568, 1318.5, 1174.7, 1046.5, 987.8];
    const missing = at >= 36.0 && idx === 5;
    if (!missing && u < 0.31) {
      const hz = scale[idx]!;
      const e = Math.min(1, u / 0.008) * Math.exp(-u * 5.8);
      const tone = (Math.sin(u * Math.PI * 2 * hz) * 0.028 + Math.sin(u * Math.PI * 2 * hz * 2.72) * 0.009) * e;
      add(tone, -0.08);
    }
  }

  // Sparse distant child-like laugh pulses and skylight birds, deliberately faint.
  for (const start of [30.8, 36.55]) {
    for (let k = 0; k < 5; k++) {
      const u = at - start - k * 0.105;
      if (u > 0 && u < 0.065) {
        const hz = 690 + k * 55 - u * 620;
        add(Math.sin(u * Math.PI * 2 * hz) * 0.006 * Math.sin(Math.PI * u / 0.065), -0.25);
      }
    }
  }
  for (const [start, pan] of [[30.35, -0.5], [32.75, 0.35], [35.65, -0.2], [37.35, 0.5]] as const) {
    const u = at - start;
    if (u > 0 && u < 0.16) {
      const hz = 2450 + Math.sin(u * 42) * 420 + u * 900;
      add(Math.sin(u * Math.PI * 2 * hz) * 0.0038 * Math.sin(Math.PI * u / 0.16), pan);
    }
  }

  // Stepped hard-plastic shelf-animal clicks.
  for (const [hit, pan] of [[33.2, 0.18], [34.1, 0.08], [35.0, 0.28]] as const) {
    const u = at - hit;
    if (u > 0 && u < 0.075) {
      add((noise() * 0.10 + Math.sin(u * Math.PI * 2 * 2140) * 0.032) * Math.exp(-u * 58), pan);
    }
  }

  // Slow foam-mat footfalls during the first careful walk.
  for (const step of [32.8, 33.45, 34.1, 34.75, 35.4]) {
    const u = at - step;
    if (u > 0 && u < 0.11) {
      add((z2NoiseLp * 0.06 + Math.sin(u * Math.PI * 2 * 72) * 0.035) * Math.exp(-u * 24), step % 2 ? 0.12 : -0.12);
    }
  }

  // Ball micro-rattle approach, swelling as the bulge closes.
  if (at >= 38.0 && at < 40.5) {
    const k = (at - 38.0) / 2.5;
    // Granular plastic-ball micro-impacts: many short bright clicks, not generic noise.
    const cell = (at - 38.0) * 30.0;
    const idx = Math.floor(cell);
    const u = (cell - idx) / 30.0;
    const density = 0.42 + k * 0.38;
    let grit = noise() * (0.004 + 0.009 * k);
    if (hash01(idx, 8.2) < density && u < 0.018) {
      const bright = noise() * (0.055 + k * 0.055) + Math.sin(u * Math.PI * 2 * (1700 + hash01(idx, 2.4) * 900)) * 0.018;
      grit += bright * Math.exp(-u * 150);
    }
    add(grit, -0.15 + k * 0.25);
  }

  // Freeze heartbeat: accelerating low thump with a smaller second valve-like thud.
  for (const hit of z2HeartTimes) {
    for (const [off, mul] of [[0, 1], [0.16, 0.55]] as const) {
      const u = at - hit - off;
      if (u > 0 && u < 0.13) {
        const swell = 0.65 + Math.max(0, Math.min(1, (at - 40.8) / 6.7)) * 0.8;
        add((Math.sin(u * Math.PI * 2 * 54) * 0.088 + Math.sin(u * Math.PI * 2 * 108) * 0.024 + z2NoiseLp * 0.012) * Math.exp(-u * 24) * mul * swell, 0);
      }
    }
  }

  // Pit Swimmer surface cascade and hollow vinyl/tube breath.
  if (at >= 44.5 && at < 45.2) {
    const u = at - 44.5;
    add((noise() * 0.038 + Math.sin(u * Math.PI * 2 * 1150) * 0.014) * Math.exp(-u * 6.5) * Math.min(1, u / 0.06), 0.18);
    const cell = Math.floor(u * 24);
    const cu = (u * 24 - cell) / 24;
    if (cu < 0.026 && hash01(cell, 16.2) < 0.52) {
      const hz = 190 + hash01(cell, 16.4) * 360;
      const knock = Math.sin(cu * Math.PI * 2 * hz) * 0.019 + noise() * 0.011;
      add(knock * Math.exp(-cu * 72) * (1 - u / 0.9), 0.10 + (hash01(cell, 16.6) - 0.5) * 0.34);
    }
  }
  if (at >= 44.6 && at < 47.5) {
    const period = 0.86;
    const x = ((at - 44.6) % period) / period;
    const gate = Math.sin(Math.PI * x) ** 1.5;
    // Hollow resonance first, noise second: the breath should read as air inside a
    // ribbed vinyl tube rather than undifferentiated low rumble.
    const tubeHz = 164 + Math.sin(at * 1.7) * 18;
    const breathVar = 0.86 + hash01(Math.floor((at - 44.6) / period), 17.1) * 0.24;
    const ribbed = 0.86 + 0.14 * Math.sin(at * Math.PI * 2 * 7.3);
    const resonance = (Math.sin(at * Math.PI * 2 * tubeHz) * 0.034 + Math.sin(at * Math.PI * 2 * tubeHz * 2.01) * 0.015) * gate * breathVar * ribbed;
    const breath = z2NoiseLp * 0.045 * gate + resonance;
    const vinyl = Math.sin(at * Math.PI * 2 * (118 + Math.sin(at * 3.1) * 12)) * 0.010 * gate;
    add(breath + vinyl, 0.12);
  }

  // Toy-phone electronic warble, right side, then the Swimmer dives toward it.
  if (at >= 47.5 && at < 49.5) {
    const u0 = at - 47.5;
    const cycle = u0 % 0.7;
    if (cycle < 0.36) {
      const warble = 980 + Math.sin(cycle * Math.PI * 2 * 9) * 210;
      const e = Math.sin(Math.PI * cycle / 0.36);
      add((Math.sin(cycle * Math.PI * 2 * warble) * 0.055 + Math.sin(cycle * Math.PI * 2 * warble * 1.51) * 0.018) * e, 0.42);
    }
  }
  if (at >= 48.4 && at < 49.3) {
    const u = at - 48.4;
    const sweep = noise() * 0.044 * Math.sin(Math.PI * u / 0.9) + z2NoiseLp * 0.026;
    const gulp = u > 0.68 ? Math.sin((u - 0.68) * Math.PI * 2 * 210) * 0.038 * Math.exp(-(u - 0.68) * 18) : 0;
    add(sweep + gulp, 0.28 - u * 0.25);
    const cell = Math.floor(u * 18);
    const cu = (u * 18 - cell) / 18;
    if (u > 0.12 && cu < 0.032 && hash01(cell, 18.2) < 0.44) {
      const hz = 150 + hash01(cell, 18.4) * 270;
      const roll = Math.sin(cu * Math.PI * 2 * hz) * 0.016 + noise() * 0.010;
      add(roll * Math.exp(-cu * 58) * Math.sin(Math.PI * u / 0.9), 0.20 - u * 0.18 + (hash01(cell, 18.6) - 0.5) * 0.22);
    }
  }

  // Crawl friction inside the ribbed plastic tunnel, then watery squeaks as the material turns.
  if (at >= 49.5 && at < 55.0) {
    const crawl = Math.max(0, Math.sin((at - 49.5) * Math.PI * 2 * 1.18)) ** 1.8;
    const rib = 0.5 + 0.5 * Math.sin((at - 49.5) * Math.PI * 2 * 9.5);
    const ribScratch = Math.sin((at - 49.5) * Math.PI * 2 * (620 + rib * 170)) * 0.014 * crawl;
    add((z2FrictionLp * (0.022 + crawl * 0.034) + noise() * crawl * 0.010) * (0.6 + rib * 0.4) + ribScratch, -0.05);
    if (at >= 53.4) {
      const wet = Math.min(1, (at - 53.4) / 1.2);
      add(Math.sin(at * Math.PI * 2 * (420 + Math.sin(at * 5) * 90)) * 0.014 * wet * crawl, 0.12);
    }
  }

  // Tenant crossing the far light: brief pressure dip plus distant plastic scrape.
  if (at >= 52.2 && at < 52.7) {
    const u = at - 52.2;
    const pressure = -Math.sin(Math.PI * u / 0.5) * 0.018;
    const scrape = u > 0.18 ? z2FrictionLp * 0.06 * Math.exp(-(u - 0.18) * 5) : 0;
    add(pressure + scrape, 0);
  }

  return [l, r];
}));


// Z3 tiled pool cue pass from z2_z4_audio_cue_spec.md. The stem starts at 54.6;
// `at` is project time. Viewer water steps use broad gait windows from z3_pool.ts,
// while Mirrorling landings follow its exact 0.9 s late-step cycle at 72.5/73.4/74.3.
const z3HumPhase = (at: number): number => {
  const F = 51.5;
  const q = 1 - Math.pow(2, -1 / 12);
  const a = 62.7, b = 63.2, D = b - a;
  if (at < a) return F * (at - 55.0);
  if (at < b) {
    const u = at - a;
    const x = u / D;
    return F * (a - 55.0) + F * u - F * q * D * (x ** 3 - 0.5 * x ** 4);
  }
  return F * (b - 55.0) - F * q * D * 0.5 + F * (1 - q) * (at - b);
};
const z3ViewerSteps: number[] = [];
{
  for (let t = 55.05; t < 62.5; t += 0.72) z3ViewerSteps.push(t);
  for (let t = 65.0; t < 68.2; t += 1.08) z3ViewerSteps.push(t);
  let t = 74.55;
  while (t < 78.2) {
    z3ViewerSteps.push(t);
    const k = Math.max(0, Math.min(1, (t - 74.55) / 3.65));
    t += 0.56 - k * 0.18;
  }
}
const z3MirrorlingSteps = [72.50, 73.40, 74.30];
const z3Drips = [55.8, 57.4, 60.2, 63.6, 66.1, 69.4, 71.7, 75.2, 77.6];
let z3NoiseLp = 0;
let z3AirLp = 0;
wav('z3_pool_events.wav', stem(25.8, (t) => {
  const at = t + 54.6;
  z3NoiseLp = z3NoiseLp * 0.86 + noise() * 0.14;
  z3AirLp = z3AirLp * 0.94 + noise() * 0.06;
  let l = 0, r = 0;
  const add = (v: number, pan = 0) => {
    const a = (pan + 1) * Math.PI / 4;
    l += v * Math.cos(a);
    r += v * Math.sin(a);
  };

  // Reverberant pool-hall pressure bed: low hum, tiled air, sparse distant drips.
  if (at >= 55.0 && at < 79.4) {
    const phase = z3HumPhase(at);
    const hum = Math.sin(phase * Math.PI * 2) * 0.018 + Math.sin(phase * Math.PI * 2 * 1.99) * 0.007;
    const air = z3AirLp * 0.028;
    const breath = 0.005 + 0.995 * ((1 - smoothstep(63.4, 63.7, at)) + smoothstep(67.0, 67.3, at));
    add((hum + air) * breath, 0);
  }
  for (const drip of z3Drips) {
    const u = at - drip;
    if (u > 0 && u < 0.34) {
      const hz = 980 - u * 1300;
      const ping = Math.sin(u * Math.PI * 2 * Math.max(360, hz)) * 0.012 * Math.exp(-u * 12);
      add(ping, hash01(Math.floor(drip * 10), 3.3) * 0.9 - 0.45);
    }
  }

  // Knee-deep viewer steps: close splash transient plus tiled-hall repeats.
  const waterStep = (hit: number, amp: number, pan: number, alien = false) => {
    for (const [echo, mul, width] of [[0, 1, 0], [0.48, 0.42, 0.25], [1.08, 0.24, -0.35], [1.82, 0.13, 0.42], [2.72, 0.07, -0.2]] as const) {
      const u = at - hit - echo;
      if (u > 0 && u < 0.34) {
        const splash = noise() * 0.070 * amp * Math.exp(-u * 24) + z3NoiseLp * 0.045 * amp * Math.exp(-u * 10);
        const cavity = Math.sin(u * Math.PI * 2 * (alien ? 164 : 132)) * 0.030 * amp * Math.exp(-u * 16);
        add((splash + cavity) * mul, pan + width);
      }
    }
  };
  for (let i = 0; i < z3ViewerSteps.length; i++) {
    const hit = z3ViewerSteps[i]!;
    const retreat = hit > 74.5 ? 1.18 : 0.82;
    waterStep(hit, retreat, (i % 2 ? 0.13 : -0.13));
  }

  // Reflection mismatch: nearly subliminal air/lap delayed after the viewer movement.
  if (at >= 58.5 && at < 61.0) {
    const lagged = Math.max(0, Math.sin((at - 58.5 - 0.4) * Math.PI * 2 * 0.7));
    add(z3NoiseLp * 0.012 * lagged + Math.sin(at * Math.PI * 2 * 210) * 0.004 * lagged, -0.18);
  }

  // One isolated step that is not ours, ahead/right.
  waterStep(64.8, 1.05, 0.36, true);

  // Very low submerged Tenant pressure swell.
  if (at >= 68.0 && at < 68.5) {
    const u = at - 68.0;
    add((Math.sin(u * Math.PI * 2 * 37) * 0.055 + z3NoiseLp * 0.024) * Math.sin(Math.PI * u / 0.5), 0);
  }

  // Wet/muffled beige-phone ring, right side, recognizable but distorted through water and foam.
  if (at >= 70.0 && at < 72.0) {
    const u0 = at - 70.0;
    const cycle = u0 % 0.68;
    if (cycle < 0.34) {
      const wet = 470 + Math.sin(cycle * Math.PI * 2 * 6.5) * 70;
      const e = Math.sin(Math.PI * cycle / 0.34);
      add((Math.sin(cycle * Math.PI * 2 * wet) * 0.044 + Math.sin(cycle * Math.PI * 2 * wet * 0.51) * 0.019 + noise() * 0.006) * e, 0.38);
    }
  }

  // Mirrorling emergence: wet tile scrape and a sheet of water shedding off chrome.
  if (at >= 72.0 && at < 72.5) {
    const u = at - 72.0;
    const scrape = z3NoiseLp * 0.18 * Math.min(1, u / 0.08) + Math.sin(u * Math.PI * 2 * (260 + u * 720)) * 0.044;
    const sheet = noise() * 0.105 * Math.exp(-u * 4.2) + Math.sin(u * Math.PI * 2 * (1150 + u * 900)) * 0.014 * Math.exp(-u * 7);
    add((scrape + sheet) * Math.exp(-u * 1.8), -0.04);
  }

  // Discrete late wet-tile Mirrorling landings with a circular splash under each.
  for (let i = 0; i < z3MirrorlingSteps.length; i++) {
    const hit = z3MirrorlingSteps[i]!;
    const u = at - hit;
    if (u > 0 && u < 0.42) {
      const ceramic = Math.sin(u * Math.PI * 2 * 420) * 0.052 * Math.exp(-u * 22);
      const ringSplash = noise() * 0.055 * Math.exp(-u * 9) + z3NoiseLp * 0.045 * Math.exp(-u * 7);
      add(ceramic + ringSplash, -0.08 + i * 0.08);
    }
  }

  // Heel catches the submerged step; cloth and water rise before the full fall.
  if (at >= 78.0 && at < 78.5) {
    const u = at - 78.0;
    const knock = u < 0.12 ? Math.sin(u * Math.PI * 2 * 640) * 0.070 * Math.exp(-u * 34) : 0;
    const cloth = noise() * 0.035 * Math.sin(Math.PI * u / 0.5);
    add(knock + cloth + z3NoiseLp * 0.035 * u, 0.08);
  }

  // Frame-filling splash, cut quickly into underwater low-pass pressure for T3 ink.
  if (at >= 78.4 && at < 80.0) {
    const u = at - 78.4;
    const cut = smoothstep(0.06, 0.30, u);
    const splash = (noise() * 0.20 + Math.sin(u * Math.PI * 2 * (1350 - u * 500)) * 0.028) * Math.exp(-u * 3.4) * (1 - cut);
    const submerged = z3NoiseLp * 0.18 * cut + Math.sin(u * Math.PI * 2 * 58) * 0.042 * cut;
    add(splash + submerged, 0);
  }

  return [l, r];
}));


// Z4 paper-library cue pass from z2_z4_audio_cue_spec.md. Stem starts at 79.4;
// `at` is project time. Conflicting rule-line duration is resolved conservatively:
// writing stops dead when the clock stops at 88.0.
const z4StepTimes = [81.0, 81.8, 82.6, 83.35, 84.05, 84.75, 85.45, 86.15, 86.85, 87.55, 95.65, 96.12, 96.59, 97.05, 97.51, 97.96, 98.40, 98.84, 99.27, 99.69, 100.10, 100.51, 100.91, 101.30, 101.68, 102.05, 102.41, 102.76, 103.10, 103.43];
const z4ToppleTimes: number[] = [];
for (let t = 95.5; t <= 103.7; t += 1.2) z4ToppleTimes.push(t);
let z4PaperLp = 0;
wav('z4_library_events.wav', stem(25.9, (t) => {
  const at = t + 79.4;
  z4PaperLp = z4PaperLp * 0.88 + noise() * 0.12;
  let l = 0, r = 0;
  const add = (v: number, pan = 0) => {
    const a = (pan + 1) * Math.PI / 4;
    l += v * Math.cos(a);
    r += v * Math.sin(a);
  };

  // Dead paper-room microtone: dry air, leaf-like rustles and clock teeth until 88.0.
  if (at >= 80.0 && at < 94.0) {
    const breath = 0.005 + 0.995 * ((1 - smoothstep(88.1, 88.35, at)) + smoothstep(89.45, 89.7, at));
    add(z4PaperLp * 0.018 * breath, 0);
    const leafCell = Math.floor((at - 80) * 3.0);
    const lu = ((at - 80) * 3.0) - leafCell;
    if (hash01(leafCell, 12.4) < 0.34 && lu < 0.22) {
      add(noise() * 0.010 * Math.sin(Math.PI * lu / 0.22), hash01(leafCell, 2.9) - 0.5);
    }
  }
  if (at >= 80.0 && at < 88.0) {
    const u = (at - 80) % 1.0;
    if (u < 0.035) add((noise() * 0.030 + Math.sin(u * Math.PI * 2 * 1600) * 0.012) * Math.exp(-u * 90), -0.24);
  }

  // One distant human cough, dry paper-room tail.
  for (const [off, hz, amp] of [[0, 210, 0.088], [0.13, 160, 0.060]] as const) {
    const u = at - 81.8 - off;
    if (u > 0 && u < 0.18) add((z4PaperLp * 0.07 + Math.sin(u * Math.PI * 2 * hz) * amp) * Math.exp(-u * 18), 0.42);
  }

  // Folded paper moth flutters; one lower/fabric-like flutter voice for Lint.
  for (const start of [80.4, 80.9, 81.45, 82.0]) {
    const u = at - start;
    if (u > 0 && u < 0.18) {
      const wing = Math.abs(Math.sin(u * Math.PI * 2 * 24));
      const fuzzy = start > 81.7 ? 0.55 : 1.0;
      add((noise() * 0.020 * wing + Math.sin(u * Math.PI * 2 * 520 * fuzzy) * 0.008 * wing) * Math.exp(-u * 8), -0.28 + hash01(Math.floor(start * 10), 4.5) * 0.55);
    }
  }

  // Fountain-pen `step.` scratches synchronized to footfalls and quieter continuous rule lines.
  for (let i = 0; i < z4StepTimes.length; i++) {
    const hit = z4StepTimes[i]!;
    const u = at - hit;
    if (hit < 86.2 && u > 0 && u < 0.11) {
      add((noise() * 0.044 + Math.sin(u * Math.PI * 2 * 2300) * 0.017) * Math.exp(-u * 32), i % 2 ? 0.09 : -0.09);
    }
    if (hit >= 95.5 && u > 0 && u < 0.13) {
      const crunch = z4PaperLp * 0.065 + noise() * 0.035;
      add(crunch * Math.exp(-u * 20), i % 2 ? 0.11 : -0.11);
    }
  }
  if (at >= 86.0 && at < 88.0) {
    const scratch = noise() * 0.016 * (0.6 + 0.4 * Math.sin(at * 17));
    add(scratch, -0.12);
  }
  // Final clock tooth-click and noticeable absence afterward.
  {
    const u = at - 88.0;
    if (u > 0 && u < 0.08) add((noise() * 0.045 + Math.sin(u * Math.PI * 2 * 1350) * 0.018) * Math.exp(-u * 50), -0.24);
  }

  // Tenant shadow crossing as a long paper sweep over the canyon wall.
  if (at >= 89.7 && at < 91.6) {
    const u = at - 89.7;
    const pan = -0.45 + (u / 1.9) * 0.9;
    add((z4PaperLp * 0.11 + noise() * 0.016) * Math.sin(Math.PI * u / 1.9), pan);
  }

  // Folded phone ring through a cardboard tube; each ring rattles brittle paper.
  if (at >= 91.8 && at < 93.2) {
    const cycle = (at - 91.8) % 0.62;
    if (cycle < 0.28) {
      const tubeHz = 390 + Math.sin(cycle * Math.PI * 2 * 5.5) * 55;
      const e = Math.sin(Math.PI * cycle / 0.28);
      add((Math.sin(cycle * Math.PI * 2 * tubeHz) * 0.060 + noise() * 0.025) * e, 0.38);
    }
  }

  // Archivist reveal: tearing sheet/page-riffle roar and segmented party-blower arms.
  if (at >= 94.2 && at < 95.5) {
    const u = at - 94.2;
    const tear = z4PaperLp * 0.18 + noise() * 0.075;
    const riffle = Math.sin(u * Math.PI * 2 * (180 + u * 420)) * 0.050;
    add((tear + riffle) * Math.min(1, u / 0.16) * Math.exp(-u * 1.2), 0);
    const tearCell=Math.floor(u*22),tq=(u*22-tearCell)/22;
    if(tq<.028)add((noise()*.052+Math.sin(tq*Math.PI*2*(900+hash01(tearCell,14)*1300))*.014)*Math.exp(-tq*90),(hash01(tearCell,15)-.5)*.5);
  }
  if (at >= 95.0 && at < 96.2) {
    const cell = Math.floor((at - 95.0) * 18);
    const cu = ((at - 95.0) * 18 - cell) / 18;
    if (cu < 0.022) {
      add((noise() * 0.072 + Math.sin(cu * Math.PI * 2 * 1200) * 0.025) * Math.exp(-cu * 120), cell % 2 ? 0.45 : -0.45);
    }
  }

  // Repeated topple/unfold locomotion and giant canyon-stack slam chain approaching camera.
  for (let i = 0; i < z4ToppleTimes.length; i++) {
    const hit = z4ToppleTimes[i]!;
    const u = at - hit;
    if (u > 0 && u < 0.48) {
      const closeK = i / Math.max(1, z4ToppleTimes.length - 1);
      const slam = Math.sin(u * Math.PI * 2 * 72) * (0.060 + closeK * 0.050) * Math.exp(-u * 12);
      const fibre = z4PaperLp * (0.070 + closeK * 0.040) * Math.exp(-u * 8);
      const snap = noise() * (0.030 + closeK * 0.020) * Math.exp(-u * 30);
      const fold=Math.sin(u*Math.PI*2*(240+closeK*180+i*13))*.018*Math.exp(-u*34);
      add(slam + fibre + snap + fold, (i % 2 ? 0.12 : -0.12) * (1 - closeK * 0.5));
    }
    if (hit >= 97.0) {
      const bu = at - hit - 0.28;
      if (bu > 0 && bu < 0.42) {
        const closeK = i / Math.max(1, z4ToppleTimes.length - 1);
        add((Math.sin(bu * Math.PI * 2 * 54) * 0.048 + z4PaperLp * 0.070 + noise() * 0.030) * Math.exp(-bu * 11) * (0.6 + closeK), 0);
      }
    }
  }

  // Loose sheets whip past the microphone intermittently as the canyon closes.
  for (const start of [97.15, 98.05, 98.95, 99.9, 100.65, 101.45, 102.2, 103.0, 103.65]) {
    const u = at - start;
    if (u > 0 && u < 0.32) {
      add((noise() * 0.034 + Math.sin(u * Math.PI * 2 * 720) * 0.010) * Math.sin(Math.PI * u / 0.32), hash01(Math.floor(start * 10), 7.1) * 1.1 - 0.55);
    }
  }

  // Pre-silence pressure rise into T4's page-slam handoff.
  if (at >= 102.5 && at < 104.7) {
    const k = (at - 102.5) / 2.2;
    add(z4PaperLp * (0.030 + k * 0.055) + Math.sin(at * Math.PI * 2 * (82 + k * 35)) * 0.012 * k, 0);
  }

  return [l, r];
}));


// Z5 motel cue pass from z5_z8_audio_cue_spec.md. Stem starts at 104.7; `at` is project time.
let z5lp=0;
wav('z5_motel_events.wav', stem(25.7,(t)=>{
 const at=t+104.7; z5lp=z5lp*.87+noise()*.13; let l=0,r=0;
 const add=(v:number,pan=0)=>{const a=(pan+1)*Math.PI/4;l+=v*Math.cos(a);r+=v*Math.sin(a)};
 // End-window rain and unstable neon/ice-machine electrical bed.
 if(at>=105&&at<130){const bedDuck=1-.5*smoothstep(114.48,114.55,at)*(1-smoothstep(115.85,116.05,at));const breath=0.005+0.995*((1-smoothstep(117.0,117.3,at))+smoothstep(119.9,120.2,at));const bedGain=bedDuck*breath;const rain=noise()*.009*(.55+.45*hash01(Math.floor(at*19),5));add(rain*bedGain,.18);add(Math.sin(at*Math.PI*2*120)*.004*(1+.25*Math.sin(at*19))*bedGain,.28);add(z5lp*.012*bedGain,-.32)}
 // occasional compressor relay ticks
 for(const hit of[107.2,113.8,121.4,126.9]){const u=at-hit;if(u>0&&u<.05)add((noise()*.028+Math.sin(u*Math.PI*2*900)*.01)*Math.exp(-u*70),-.32)}
 // wet shoes compressing dense carpet, gait windows broad and deterministic
 const steps=[105.3,106.0,106.75,107.5,108.25,109,109.75,110.5,111.25,112,112.75,113.5,114.25,115.0,115.65,116.3,116.95,117.6,118.25,118.9,119.55,120.2,120.9,121.55,122.2,122.85,123.5,124.15,124.8,125.45,126.1,126.75,127.4];
 for(let i=0;i<steps.length;i++){const hit=steps[i]!;const u=at-hit;if(at<122.4&&u>0&&u<.13){const stationary=hit>=115.5&&hit<121.2?.18:1;add((z5lp*.07+Math.sin(u*Math.PI*2*78)*.026+noise()*.008)*stationary*Math.exp(-u*24),i%2?.1:-.1)}}
 // muffled nonverbal TV murmurs alternating doors
 for(const [st,pan] of[[105.6,.36],[107.4,-.34],[109.4,.34],[111.1,-.36],[113.2,.3]] as const){const u=at-st;if(at<114.5&&u>0&&u<1.1){const syll=Math.max(0,Math.sin(u*Math.PI*2*3.2));add((Math.sin(u*Math.PI*2*(160+60*Math.sin(u*8)))*.009+z5lp*.012)*syll*Math.exp(-u*.8),pan)}}
 // passing CRT static and cheap delayed CCTV feeds; all cut dead at 114.5
 if(at>=108.5&&at<111.5)add(noise()*.018*(.4+.6*hash01(Math.floor(at*37),8)),.34);
 if(at>=111.5&&at<114.5){add((noise()*.006+Math.sin(at*Math.PI*2*700)*.0025)*(0.5+0.5*Math.sin(at*9)),.2);for(let i=0;i<steps.length;i++){const u=at-steps[i]!-.16;if(u>0&&u<.13)add((z5lp*.024+Math.sin(u*Math.PI*2*190)*.009)*Math.exp(-u*24),(i%2?.18:-.18)+.08)}}
 // Lint at the sconce: felt wing bats plus tiny warm chirp
 if(at>=112.1&&at<112.8){const u=at-112.1;const flap=Math.abs(Math.sin(u*Math.PI*2*8));add(z5lp*.06*flap+Math.sin(u*Math.PI*2*980)*.006*flap,-.38)}
 // held breath negative space: tiny cloth movement and sparse rear drips only
 for(const st of[117.1,117.7,118.35,119.2]){const u=at-st;if(u>0&&u<.12)add(z5lp*.025*Math.sin(Math.PI*u/.12),0)}
 for(const st of[117.25,118.1,118.85,119.55]){const u=at-st;if(u>0&&u<.28)add(Math.sin(u*Math.PI*2*760)*.009*Math.exp(-u*16),-.05)}
 // Tenant reveal material collage and composite neck creak
 if(at>=120.45&&at<121.65){const u=at-120.45;add((noise()*.035+z5lp*.07+Math.sin(u*Math.PI*2*(180+u*500))*.025)*Math.exp(-u*2.4),0)}
 if(at>=121&&at<121.5){const u=at-121;add((z5lp*.09+Math.sin(u*Math.PI*2*(92+u*45))*.02)*Math.sin(Math.PI*u/.5),0)}
 // door 217 slam/latch/body against panel
 if(at>=121.8&&at<122.4){const u=at-121.8;add((Math.sin(u*Math.PI*2*72)*.10+z5lp*.09+noise()*.025)*Math.exp(-u*10),.28)}
 // hiding breath and corridor footsteps outside door
 if(at>=124&&at<128){const cyc=(at-124)%1.8;const gate=Math.sin(Math.PI*cyc/1.8)**2;add(z5lp*.028*gate,.08)}
 for(const st of[125.2,126.6]){const u=at-st;if(u>0&&u<.2)add((z5lp*.09+Math.sin(u*Math.PI*2*66)*.035)*Math.exp(-u*15),.18)}
 // handle rotates, sticks, releases
 if(at>=126.8&&at<127.3){const u=at-126.8;add((Math.sin(u*Math.PI*2*(420+120*Math.sin(u*30)))*.018+noise()*.012)*Math.sin(Math.PI*u/.5),.22)}
 // TV self-static broadens and softens toward felt transition
 if(at>=128&&at<130){const u=(at-128)/2;add(noise()*(.028-u*.012)+z5lp*u*.045,.1)}
 return[l,r]
}));


// Exact cold-open arm/beam recurrence. The same generated stem is placed at Z0 1.2s
// and Z7 171.3s so the replay is sample-identical rather than a reinterpretation.
wav('coldopen_arm_replay.wav', stem(2.1,(t)=>{
 let v=0;
 // Motor torque, brush noise, and metal-spring partials keep the arm physical rather than UI-synthetic.
 const torque=Math.sin(t*Math.PI*2*(38+t*11))*.026*(1-t/2.4);
 const servo=Math.sin(t*Math.PI*2*(72+t*38))*.012*(1-t/2.4)+noise()*.007*(1-smoothstep(1.35,1.9,t));
 const springHz=240+Math.sin(t*8)*35;
 const coil=(Math.sin(t*Math.PI*2*springHz)*.006+Math.sin(t*Math.PI*2*springHz*1.51)*.004+Math.sin(t*Math.PI*2*springHz*2.17)*.002)*Math.max(0,Math.sin(t*Math.PI*2*3));
 const mass=t<.32?(Math.sin(t*Math.PI*2*54)*.035+noise()*.012)*Math.exp(-t*10):0;
 const beam=noise()*.007*(1-smoothstep(1.55,2.05,t));
 const die=t>1.82?(Math.sin((t-1.82)*Math.PI*2*520)*.014+Math.sin((t-1.82)*Math.PI*2*96)*.018)*Math.exp(-(t-1.82)*28):0;
 v=torque+servo+coil+mass+beam+die; return [v*.9,v*.86];
}));

// Z6 felt theatre cue pass from z5_z8_audio_cue_spec.md. Stem starts at 129.4.
let z6lp=0;
wav('z6_theatre_events.wav', stem(21.2,(t)=>{
 const at=t+129.4; z6lp=z6lp*.90+noise()*.10; let l=0,r=0;
 const add=(v:number,pan=0)=>{const a=(pan+1)*Math.PI/4;l+=v*Math.cos(a);r+=v*Math.sin(a)};
 // absorbent felt room tone: very little high air or reflection
 if(at>=130&&at<150){const breath=0.005+0.995*((1-smoothstep(141.75,142.05,at))+smoothstep(143.55,143.85,at));add(z6lp*.010*breath,0)}
 // slowed music box, missing note restored; after 139 it stumbles and dies by 141.5
 if(at>=130&&at<141.5){
   const slow=at<139?1:Math.max(0,1-(at-139)/2.5); const pos=at-130; const nl=.52; const idx=Math.floor(pos/nl)%8; const u=pos%nl;
   const scale=[704,837,1055,1254,1055,940,837,790];
   if(u<.46&&slow>0&&!(at>=139&&idx===5)&&at<141.1){const e=Math.min(1,u/.012)*Math.exp(-u*4.2)*slow;add((Math.sin(u*Math.PI*2*scale[idx]!)*.020+Math.sin(u*Math.PI*2*scale[idx]!*2.71)*.006)*e,-.08)}
 }
 // stepped heavy curtains opening at a 12fps stop-motion feel
 if(at>=130.2&&at<132.8){const cell=Math.floor((at-130.2)*12);const cu=((at-130.2)*12-cell)/12;if(cu<.28)add((z6lp*.09+noise()*.012)*Math.sin(Math.PI*cu/.28),0)}
 // viewer settling into seat
 if(at>=130&&at<130.8){const u=at-130;add((z6lp*.10+Math.sin(u*Math.PI*2*92)*.024)*Math.exp(-u*4),0)}
 // backdrop roller knocks and cloth unrolls
 for(const hit of[134,135.5,137,138.5]){const u=at-hit;if(u>0&&u<.55)add((Math.sin(u*Math.PI*2*110)*.035*Math.exp(-u*20)+z6lp*.075*Math.exp(-u*5)+noise()*.012*Math.exp(-u*8)),0)}
 // miniature recap props/material transformations
 if(at>=133&&at<135){const tap=Math.max(0,Math.sin((at-133)*Math.PI*2*2.2));add((noise()*.008+Math.sin(at*Math.PI*2*1800)*.003)*tap,-.05)}
 if(at>=135&&at<136.8){const cell=Math.floor((at-135)*7);const u=((at-135)*7-cell)/7;if(hash01(cell,14)<.55&&u<.12)add(noise()*.012*Math.exp(-u*25),.03)}
 if(at>=136.5&&at<138){const u=(at-136.5)%0.7;if(u<.05)add(Math.sin(u*Math.PI*2*620)*.007*Math.exp(-u*35),.12)}
 if(at>=138&&at<139){const u=at-138;add((z6lp*.13+Math.sin(u*Math.PI*2*86)*.045)*Math.exp(-u*6),0)}
 // tiny puppet squeaks/foot taps across recap and chase
 for(const st of[133.2,133.8,134.35,135.2,136.1,136.9,137.6,138.35,139.1,139.35,139.62,139.9,140.16,140.42,140.7,140.98,141.24]){const u=at-st;if(u>0&&u<.12){const pan=(hash01(Math.floor(st*10),4)-.5)*.4;const hz=700+hash01(Math.floor(st*10),3)*300;add((noise()*.014+Math.sin(u*Math.PI*2*hz)*.006)*Math.exp(-u*30),pan);add((Math.sin(u*Math.PI*2*(120+hash01(Math.floor(st*10),5)*70))*.012+z6lp*.026)*Math.exp(-u*22),pan*.8)}}
 // rapid long-arm fabric swipes in puppet chase
 if(at>=139&&at<141.5){const u=at-139;const scurry=Math.max(0,Math.sin(u*Math.PI*2*4));add(z6lp*(.030+.045*scurry)+noise()*(.005+.007*scurry),0);const cell=Math.floor(u*8);const cu=(u*8-cell)/8;if(cu<.055)add((Math.sin(cu*Math.PI*2*(150+hash01(cell,12)*90))*.018+z6lp*.028)*Math.exp(-cu*38),(hash01(cell,13)-.5)*.45)}
 // Lint armrest landing and warm close chirps
 if(at>=141.5&&at<142){const u=at-141.5;add(z6lp*.08*Math.sin(Math.PI*u/.5)+Math.sin(u*Math.PI*2*1120)*.008*Math.exp(-u*10),.38)}
 for(const st of[142.3,142.65,143.0]){const u=at-st;if(u>0&&u<.18)add(Math.sin(u*Math.PI*2*(880+Math.sin(u*20)*120))*.012*Math.sin(Math.PI*u/.18),.34)}
 // viewer follows: carpet then hollow wooden stage steps
 for(let i=0;i<8;i++){const hit=143.5+i*.46;const u=at-hit;if(at<147&&u>0&&u<.12){const wood=hit>145.7?1:0;add((z6lp*.055+Math.sin(u*Math.PI*2*(wood?118:72))*(wood?.038:.025))*Math.exp(-u*22),i%2?.09:-.09)}}
 // backstage hand-built mechanics
 for(const st of[145.2,146.1,146.8,147.7,148.4]){const u=at-st;if(u>0&&u<.16)add((noise()*.012+Math.sin(u*Math.PI*2*520)*.006)*Math.exp(-u*20),(hash01(Math.floor(st*10),8)-.5)*.7)}
 // exit door compressed felt/fabric/wood push
 if(at>=147.2&&at<150){const u=at-147.2;add((z6lp*.085+noise()*.010)*Math.min(1,u/.5)*(1-smoothstep(2.2,2.8,u)),0)}
 // cold organ precue swelling through the gap into cathedral scale
 if(at>=148.5&&at<150.5){const u=at-148.5;const sw=smoothstep(0,2,u);add((Math.sin(at*Math.PI*2*64)*.018+Math.sin(at*Math.PI*2*96)*.010+Math.sin(at*Math.PI*2*128)*.006)*sw,0)}
 return[l,r]
}));


// Z7 vending cathedral cue pass. Stem starts at 149.5; `at` is project time.
let z7lp=0;
wav('z7_cathedral_events.wav', stem(45.8,(t)=>{
 const at=t+149.5; z7lp=z7lp*.91+noise()*.09; let l=0,r=0;
 const add=(v:number,pan=0)=>{const a=(pan+1)*Math.PI/4;l+=v*Math.cos(a);r+=v*Math.sin(a)};
 // vast stone/machine nave pressure, then compressor-organ wake stack
 if(at>=150&&at<176){const breath=0.005+0.995*((1-smoothstep(150.25,150.55,at))+smoothstep(152.0,152.3,at));add((z7lp*.016+Math.sin(at*Math.PI*2*38)*.005)*breath,0)}
 if(at>=154&&at<173.35){const sw=smoothstep(154,158,at);const off=at<168.2?0:Math.max(0,Math.min(15,Math.floor((at-168.2)/.48)+1));const subtract=1-off*.045;for(let row=0;row<8;row++){const hz=54+row*7+hash01(row,31)*3;const pan=-.52+row*.15;const rowWake=smoothstep(154+row*.28,157.2+row*.28,at);add((Math.sin(at*Math.PI*2*hz)*.010+Math.sin(at*Math.PI*2*hz*1.5)*.004)*sw*rowWake*subtract,pan)}}
 // sparse far coin drops with long nave echoes
 for(const hit of[151.4,154.8,156.7]){for(const [eo,m] of[[0,1],[.7,.38],[1.5,.18],[2.5,.08]] as const){const u=at-hit-eo;if(u>0&&u<.22)add((Math.sin(u*Math.PI*2*1150)*.018+noise()*.008)*Math.exp(-u*28)*m,0)}}
 // relay clunk wave sweeping row by row toward the camera
 for(let i=0;i<17;i++){const hit=154+i*.18;const u=at-hit;if(at<157&&u>0&&u<.09)add((noise()*.035+Math.sin(u*Math.PI*2*160)*.025)*Math.exp(-u*42),-.55+i*.065)}
 // close individual machine fan/compressor and product-glass buzz
 if(at>=158&&at<163)add((z7lp*.035+Math.sin(at*Math.PI*2*132)*.008+noise()*.003),-.35);
 // beige-phone ring behind vending glass
 if(at>=160&&at<163){const c=(at-160)%.68;if(c<.32){const hz=520+Math.sin(c*Math.PI*2*7)*70;add((Math.sin(c*Math.PI*2*hz)*.048+Math.sin(c*Math.PI*2*hz*2.1)*.015)*Math.sin(Math.PI*c/.32),-.42)}}
 // product-drop cascade: balls, tile, paper, felt, coils converging center
 if(at>=163&&at<165.2){const u=at-163;const cell=Math.floor(u*28);const cu=(u*28-cell)/28;if(cu<.16){const hz=260+hash01(cell,9)*1450;const pan=(hash01(cell,10)-.5)*(1-u/2.2);add((noise()*.042+Math.sin(cu*Math.PI*2*hz)*.018)*Math.exp(-cu*35),pan)}}
 // Tenant assembly: object-specific snaps, creases, knocks and extending coils.
 // Matches the visual chain sort: spine/rib/limb/head complete by 164.92, then releases before the 165.6 reveal hold.
 if(at>=163&&at<165.58){
   const u=at-163;
   const formation=1.9206;
   const sort=smoothstep(.12,formation,u);
   const release=Math.exp(-Math.max(0,u-formation)*7.5);
   const endGate=1-smoothstep(2.28,2.58,u);
   const envelope=(.14+.86*sort)*release*endGate;
   const pulse=Math.max(0,Math.sin((u*2.4+.6406)*Math.PI*2));
   add((z7lp*(.035+.07*sort)+noise()*(.012+.02*sort)+Math.sin((190*u+27.5*u*u)*Math.PI*2)*(.012+.018*sort))*pulse*envelope,0);
   for(const [hit,pan,hz] of [[164.592,-.08,180],[164.731,.05,230],[164.852,-.03,290],[164.921,0,360]] as const){
     const q=at-hit;
     if(q>0&&q<.18)add((noise()*.07+Math.sin(q*Math.PI*2*hz)*.05)*Math.exp(-q*24),pan);
   }
 }
 // huge hollow material inhalation, intermittent pressure rather than voice
 if(at>=166.5&&at<173.35){const c=(at-166.5)%2.7;if(c<1.15){const gate=Math.sin(Math.PI*c/1.15)**1.4;add((z7lp*.13+Math.sin(at*Math.PI*2*74)*.024)*gate,0)}}
 // hard stone chase steps with nave slap
 for(let i=0;i<18;i++){const hit=168+i*.44;const pan=i%2?.10:-.10;const stepVar=.82+hash01(i,20.1)*.36;for(const [eo,m] of[[0,1],[.38,.28],[.9,.12]] as const){const u=at-hit-eo;if(at<173.35&&u>0&&u<.12)add((noise()*.042+Math.sin(u*Math.PI*2*95)*.040+z7lp*.04)*Math.exp(-u*28)*m*stepVar,pan)}}
 // machines relay off behind the runner and subtract the organ bed perceptually
 for(let i=0;i<16;i++){const hit=168.2+i*.48;const u=at-hit;if(at<173.35&&u>0&&u<.16)add((Math.sin(u*Math.PI*2*88)*.055+noise()*.018)*Math.exp(-u*24),-.3+i*.04)}
 // uneven composite Tenant rattling pursuit
 for(let i=0;i<14;i++){const hit=168.15+i*.56+(hash01(i,17)-.5)*.09;const u=at-hit;if(at<173.35&&u>0&&u<.25)add((z7lp*.11+noise()*.038+Math.sin(u*Math.PI*2*(130+hash01(i,18)*180))*.025)*Math.exp(-u*16),(hash01(i,19)-.5)*.35)}
 // final dead flashlight click, Lint relight flutter/warm bloom
 for(const [hit,pan] of[[173.38,0],[173.72,0]] as const){const u=at-hit;if(u>0&&u<.055)add((noise()*.045+Math.sin(u*Math.PI*2*1500)*.016)*Math.exp(-u*60),pan)}
 if(at>=174&&at<175){const u=at-174;add(z7lp*.055*Math.abs(Math.sin(u*Math.PI*2*7))+Math.sin(u*Math.PI*2*940)*.013*Math.exp(-u*4),.12)}
 // Tenant composite recoil screech: metal, tile shriek, tearing paper
 if(at>=174.7&&at<176){const u=at-174.7;add((Math.sin((700*u+350*u*u)*Math.PI*2)*.045+noise()*.045+z7lp*.06)*Math.sin(Math.PI*u/1.3),-.1)}
 // floor rift fracture and cascading debris: subsonic stone displacement first, then granular rockfall
 if(at>=176&&at<180.8){
   const u=at-176;
   const fracture=(Math.sin(u*Math.PI*2*(34+u*7))*.105+Math.sin(u*Math.PI*2*(68+u*11))*.036+z7lp*.10+noise()*.018)*Math.min(1,u/.35)*(1-smoothstep(3.4,4.8,u));
   add(fracture,0);
   const cell=Math.floor(u*18);
   const cu=(u*18-cell)/18;
   if(cu<.045)add((noise()*.038+Math.sin(cu*Math.PI*2*(240+hash01(cell,22)*420))*.010)*Math.exp(-cu*55)*(1-smoothstep(3.2,4.4,u)),(hash01(cell,23)-.5)*.75);
 }
 // intermittent vending-machine topples: heavy shell/sub impact, glass spray, then long staggered nave tails
 for(const [hit,pan] of[[176.4,-.45],[178.1,.42],[180.0,-.36],[182.2,.38],[184.4,-.28]] as const){
   const u=at-hit;
   if(u>0&&u<3.4){
     const attack=Math.min(1,u/.028);
     const toppleVar=.86+hash01(Math.floor(hit*10),21.1)*.28;
     const sub=Math.sin(u*Math.PI*2*(47-u*7))*.115*toppleVar*Math.exp(-u*2.15)*attack;
     const shell=(noise()*.052+z7lp*.082+Math.sin(u*Math.PI*2*(82-u*13))*.046)*Math.exp(-u*2.8)*attack;
     add(sub+shell,pan);
     for(const [eo,m,spread] of[[.34,.42,.18],[.78,.24,-.24],[1.38,.13,.31],[2.15,.07,-.18]] as const){
       const q=u-eo;
       if(q>0&&q<.72)add((z7lp*.075+Math.sin(q*Math.PI*2*(64-q*5))*.024+noise()*.012)*Math.exp(-q*4.4)*m,pan+spread);
     }
     const glassCell=Math.floor(u*34);
     const gu=(u*34-glassCell)/34;
     if(u<1.45&&gu<.022&&hash01(glassCell+hit,24)<.72){
       const hz=1450+hash01(glassCell,25)*2900;
       add((noise()*.032+Math.sin(gu*Math.PI*2*hz)*.010)*Math.exp(-gu*95),pan+(hash01(glassCell,26)-.5)*.62);
     }
   }
 }
 // overwhelming machine/glass/stone roar as rift widens, with slower pressure motion rather than a flat noise shelf
 if(at>=180&&at<186){const u=at-180,k=u/6;add((noise()*(.040+k*.060)+z7lp*(.065+k*.045)+Math.sin((31*u+.75*u*u)*Math.PI*2)*(.012+k*.020))*(.58+.42*Math.sin(at*2.1)),0)}
 // abrupt fall wind narrowing into warmer descent
 if(at>=186&&at<192){
   const u=at-186;const narrow=smoothstep(1.2,5,u);
   const rollAngle=u*Math.PI*2/6;
   const rotatingPan=Math.sin(rollAngle)*.72;
   const wind=noise()*(.006-narrow*.004)+z7lp*(.022+narrow*.016);
   add(wind,rotatingPan);
   // Decorrelated air edges rotate once with the 360° camera roll, widening the fall
   // without adding new event density or breaking the mono-compatible wind core.
   const sampleIndex=Math.floor(at*SR);
   const airA=(hash01(sampleIndex,22.1)*2-1)*(.014+narrow*.009);
   const airB=(hash01(sampleIndex,22.9)*2-1)*(.014+narrow*.009);
   const curl=Math.cos(rollAngle);
   l+=airA*(.62+.38*curl)+airB*(.18-.18*Math.sin(rollAngle));
   r+=airB*(.62-.38*curl)+airA*(.18+.18*Math.sin(rollAngle));
 }
 // dense physical impact cascade: separate bottles, cans, glass and stone chips
for(let k=0;k<30;k++){
  const st=186.08+k*.185+(hash01(k,30.1)-.5)*.055;
  const u=at-st;
  if(u>0&&u<.30){
    const metalHz=170+hash01(k,30.2)*390;
    const glassHz=1450+hash01(k,30.3)*1500;
    const pan=(hash01(k,30.4)-.5)*1.35+Math.sin((at-186)*Math.PI*2/6)*.25;
    const attack=Math.min(1,u/.006);
    const impact=noise()*.105*Math.exp(-u*48)+Math.sin(u*Math.PI*2*metalHz)*.066*Math.exp(-u*21)+Math.sin(u*Math.PI*2*metalHz*.51)*.040*Math.exp(-u*15);
    const glass=Math.sin(u*Math.PI*2*glassHz)*.018*Math.exp(-u*58)+noise()*.038*Math.exp(-u*86);
    add((impact+glass)*attack,Math.max(-.92,Math.min(.92,pan)));
  }
}
// physical debris cascade: metal mass, glass spray and stone clatter passing upward
for(const st of[186.18,186.55,186.92,187.35,187.72,188.18,188.62,189.05,189.48,189.92,190.35,190.82,191.25,191.62]){
  const u=at-st;
  if(u>0&&u<.48){
    const seed=Math.floor(st*100);
    const metalHz=210+hash01(seed,31)*260;
    const glassHz=1250+hash01(seed,32)*900;
    const pan=(hash01(seed,33)-.5)*1.2+Math.sin((at-186)*Math.PI*2/6)*.28;
    const mass=(Math.sin(u*Math.PI*2*metalHz)*.048+Math.sin(u*Math.PI*2*(metalHz*.49))*.032+z7lp*.042)*Math.exp(-u*17);
    const clatter=(noise()*.040+Math.sin(u*Math.PI*2*glassHz)*.014)*Math.exp(-u*28);
    add((mass+clatter)*Math.min(1,u/.025),Math.max(-.9,Math.min(.9,pan)));
  }
}
// upward-passing machine/glass streaks during fall
 for(const st of[186.4,187.2,188.1,189.0,190.1,191.2]){const u=at-st;if(u>0&&u<.32){const chasePan=Math.sin((at-186)*Math.PI*2/6)*.48+(hash01(Math.floor(st*10),21)-.5)*.42;add((noise()*.024+Math.sin((900*u+250*u*u)*Math.PI*2)*.018)*Math.exp(-u*8),Math.max(-.92,Math.min(.92,chasePan)))}}
 // calm descending tonal pressure: temperature shift, not score
 if(at>=188&&at<194.4){const u=at-188;add((Math.sin((160*u-6.5*u*u)*Math.PI*2)*.006+Math.sin((80*u-3.25*u*u)*Math.PI*2)*.004)*smoothstep(0,2,u),0)}
 // warm carpet landing and first domestic precues
 if(at>=192&&at<193.2){const u=at-192;add((z7lp*.13+Math.sin(u*Math.PI*2*70)*.065+noise()*.024)*Math.exp(-u*5),0)}
 if(at>=192.5&&at<195){const u=(at-192.5)%1;if(u<.035)add((noise()*.018+Math.sin(u*Math.PI*2*1300)*.006)*Math.exp(-u*80),.28)}
 return[l,r]
}));


// Z8 home and end-office cue pass. Stems start at 194.4 and 225.0.
let z8lp=0;
wav('z8_home_events.wav', stem(30.8,(t)=>{
 const at=t+194.4; z8lp=z8lp*.90+noise()*.10; let l=0,r=0;
 const add=(v:number,pan=0)=>{const a=(pan+1)*Math.PI/4;l+=v*Math.cos(a);r+=v*Math.sin(a)};
 const z8Dip=(a:number,b:number,c:number,d:number)=>0.005+0.995*((1-smoothstep(a,b,at))+smoothstep(c,d,at));
 const z8BedBreath=Math.min(z8Dip(198.0,198.3,199.8,200.1),z8Dip(214.8,215.1,217.15,217.35));
 // warm clock tick, quiet domestic air, birds and distant mower; mower becomes an exact 2s loop at 203
 if(at>=195&&at<225){const u=(at-195)%1;if(u<.032)add((noise()*.018+Math.sin(u*Math.PI*2*320)*.009+Math.sin(u*Math.PI*2*1280)*.0015)*Math.exp(-u*85),.3);add(z8lp*.010*z8BedBreath,0)}
 if(at>=195&&at<206){for(const st of[195.4,197.2,199.7,202.1,204.8]){const u=at-st;if(u>0&&u<.16)add(Math.sin(u*Math.PI*2*(1650+Math.sin(u*40)*180))*.002*Math.sin(Math.PI*u/.16),-.34)};const loopT=at<203?at:203+((at-203)%2);const mowerNoise=at<203?z8lp*.012:(Math.sin(loopT*Math.PI*2*91)*.004+Math.sin(loopT*Math.PI*2*176)*.002);add((Math.sin(loopT*Math.PI*2*88)*.006+mowerNoise)*smoothstep(195,198,at)*z8BedBreath,-.28)}
 // kettle slowly rises then cuts dead at 214
 if(at>=195&&at<214){const k=smoothstep(200,210,at);add((noise()*.006+z8lp*.018)*(.15+.85*k)*z8BedBreath,.34)}
 // slow wood/rug footsteps, switching material by position and then carpet at office threshold
 for(let i=0;i<45;i++){const hit=195.2+i*.58;if(hit>222)break;const u=at-hit;if(u>0&&u<.12){const rug=(i%5===2||i%5===3)?1:0;const stationary=hit>=213.5?.22:1;add((z8lp*(rug?.075:.045)+noise()*.010+Math.sin(u*Math.PI*2*(rug?76:105))*(rug?.022:.032))*stationary*Math.exp(-u*24),i%2?.08:-.08)}}
 // nearly subliminal photo-frame glass ticks
 for(const st of[199.3,201.1,202.6]){const u=at-st;if(u>0&&u<.07)add((Math.sin(u*Math.PI*2*1800)*.003+noise()*.004)*Math.exp(-u*70),-.32)}
 // wrong-window fluorescent leak and shadowless lamp filament hiss
 if(at>=203&&at<206){add((Math.sin(at*Math.PI*2*120)*.006+noise()*.002),-.38);add(noise()*.004+z8lp*.008,.24)}
 // exact original beige-phone ring motif at the wall phone
 if(at>=206&&at<210){for(const base of[206,208.8])for(const off of[.02,1.18]){const u=at-base-off;if(u>=0&&u<.88){const trem=.45+.55*(Math.sin(u*Math.PI*40)>0?1:0);add((Math.sin(u*Math.PI*2*1280)*.003+Math.sin(u*Math.PI*2*1735)*.001+Math.sin(u*Math.PI*2*960)*.007+Math.sin(u*Math.PI*2*640)*.017+Math.sin(u*Math.PI*2*320)*.009+noise()*.012)*Math.exp(-u*3.1)*trem,.34)}}}
 // receiver lifts by itself, hook click, curled cord tension and small hollow tapping
 if(at>=210&&at<210.8){const u=at-210;add((noise()*.018+Math.sin(u*Math.PI*2*420)*.018)*Math.sin(Math.PI*u/.8),.34)}
 if(at>=210.8&&at<214){const u=at-210.8;add((Math.sin(u*Math.PI*2*(220+Math.sin(u*4)*30))*.010+z8lp*.028)*(.4+.6*Math.max(0,Math.sin(u*Math.PI*2*1.7))),.33)}
 // receiver earpiece carries Z1 fluorescent/tube material, band-limited in character
 if(at>=210&&at<214)add((Math.sin(at*Math.PI*2*120)*.010+Math.sin(at*Math.PI*2*240)*.004+noise()*.003),.36);
 // kettle whistle peak then hard cutoff
 if(at>=213.2&&at<214.0){const u=at-213.2;add((Math.sin((1250*u+150*u*u)*Math.PI*2)*(.004+u*.005)+noise()*.009)*Math.sin(Math.PI*u/.8),.34)}
 // front-door handle turns by itself, latch stress, then wooden door opens into office air
 if(at>=214&&at<216){const u=at-214;add((Math.sin(u*Math.PI*2*(360+70*Math.sin(u*18)))*.018+noise()*.010)*Math.sin(Math.PI*u/2),.32)}
 if(at>=217.5&&at<220){const u=at-217.5;add((z8lp*.07+Math.sin(u*Math.PI*2*(95+u*30))*.025)*Math.sin(Math.PI*u/2.5),.2)}
 // office loop reasserts: fluorescent swell and desk-phone ring returning to origin
 if(at>=218&&at<225){const sw=smoothstep(218,224,at);add((Math.sin(at*Math.PI*2*120)*(.008+sw*.018)+noise()*.002)*1,.18)}
 if(at>=218&&at<225){for(const base of[218,220.8,223.6])for(const off of[.02,1.18]){const u=at-base-off;if(u>=0&&u<.88){const trem=.45+.55*(Math.sin(u*Math.PI*40)>0?1:0);add((Math.sin(u*Math.PI*2*1280)*.0025+Math.sin(u*Math.PI*2*1735)*.0008+Math.sin(u*Math.PI*2*960)*.005+Math.sin(u*Math.PI*2*640)*.013+Math.sin(u*Math.PI*2*320)*.007+noise()*.010)*Math.exp(-u*3.1)*trem,.12)}}}
 // threshold steps cross warm wood into damp office carpet
 for(let i=0;i<6;i++){const hit=222+i*.48;const u=at-hit;if(u>0&&u<.13){const office=smoothstep(222.5,224,at);add((z8lp*(.045+office*.04)+noise()*.010+Math.sin(u*Math.PI*2*(102-office*35))*.030)*Math.exp(-u*24),i%2?.08:-.08)}}
 return[l,r]
}));
wav('end_office_events.wav', stem(10.0,(t)=>{
 const at=t+225;let l=0,r=0;const add=(v:number,pan=0)=>{const a=(pan+1)*Math.PI/4;l+=v*Math.cos(a);r+=v*Math.sin(a)};
 // beige phone repeats, each 2 dB quieter, while office air loses high-frequency content
 const idx=Math.floor((at-225)/2.8);for(const base of[225,227.8,230.6,233.4])for(const off of[.02,1.18]){if(base+off+.88>235)continue;const u=at-base-off;if(u>=0&&u<.88){const trem=.45+.55*(Math.sin(u*Math.PI*40)>0?1:0);const gain=Math.pow(.794,idx);add((Math.sin(u*Math.PI*2*1280)*.0025+Math.sin(u*Math.PI*2*1735)*.0008+Math.sin(u*Math.PI*2*960)*.005+Math.sin(u*Math.PI*2*640)*.013+Math.sin(u*Math.PI*2*320)*.007+noise()*.010)*Math.exp(-u*3.1)*trem*gain,.14)}}
 const airloss=1-smoothstep(225,235,at);add((Math.sin(at*Math.PI*2*60)*.0025+Math.sin(at*Math.PI*2*120)*.0008+noise()*.0022*airloss),.05);
 const si=Math.floor(at*SR+.5);
 l+=(hash01(si,41.1)*2-1)*.0012*airloss;
 r+=(hash01(si,42.7)*2-1)*.0012*airloss;
 const endFade=1-smoothstep(234.15,235,at);
 return[l*endFade,r*endFade]
}));

// Transition-specific sound continuity. These short cues bind the material handoffs together;
// zone beds underneath already crossfade, so these stems carry only the physical seam events.
wav('t2_plastic_to_water.wav', stem(1.4, (t) => {
  let plastic = 0;
  for (const at of [0.10, 0.25, 0.42, 0.58]) {
    const u = t - at;
    if (u > 0 && u < 0.11) plastic += (noise() * 0.06 + Math.sin(u * Math.PI * 2 * 620) * 0.045) * Math.exp(-u * 34) * (1 - t / 1.2);
  }
  let water = 0;
  for (const at of [0.55, 0.82, 1.08]) {
    const u = t - at;
    if (u > 0 && u < 0.42) water += noise() * 0.075 * Math.exp(-u * 9) * Math.min(1, u / 0.035);
  }
  const wetness = Math.min(1, Math.max(0, (t - 0.45) / 0.65));
  const hollow = (Math.sin(t * Math.PI * 2 * (92 - wetness * 28)) * 0.022 + noise() * 0.010) * (1 - wetness);
  const v = plastic * (1 - wetness) + water * wetness + hollow;
  return [v, v * 0.82];
}));

let inkLp = 0;
wav('t3_ink_to_paper.wav', stem(1.6, (t) => {
  inkLp = inkLp * 0.9 + noise() * 0.1;
  const submerge = inkLp * 0.18 * Math.sin(Math.PI * Math.min(1, t / 0.72)) ** 1.2;
  const pressure = Math.sin(t * Math.PI * 2 * (54 - t * 9)) * 0.028 * Math.exp(-t * 1.8);
  const paperAt = t - 0.78;
  let paper = 0;
  if (paperAt > 0) {
    paper = noise() * 0.045 * Math.min(1, paperAt / 0.12) * Math.exp(-paperAt * 1.3);
    for (const at of [0.92, 1.18]) {
      const u = t - at;
      if (u > 0 && u < 0.16) paper += noise() * 0.055 * Math.exp(-u * 18);
    }
  }
  const v = submerge * (1 - Math.min(1, paperAt / 0.3)) + pressure + paper;
  return [v * 0.92, v];
}));

wav('t4_page_slam_neon.wav', stem(1.0, (t) => {
  let v = 0;
  if (t < 0.115) {
    const k = t / 0.115;
    v += noise() * 0.065 * Math.sin(Math.PI * k) + Math.sin(t * Math.PI * 2 * 190) * 0.012 * k;
  }
  const u = t - 0.108;
  if (u > 0 && u < 0.10) {
    v += noise() * 0.16 * Math.exp(-u * 42) + Math.sin(u * Math.PI * 2 * 72) * 0.16 * Math.exp(-u * 28);
  }
  // 0.12-0.20 stays deliberately empty: the master mute guarantees true black silence.
  for (const at of [0.23, 0.39, 0.57]) {
    const q = t - at;
    if (q > 0 && q < 0.07) {
      v += noise() * 0.045 * Math.exp(-q * 65) + Math.sin(q * Math.PI * 2 * 118) * 0.035 * Math.exp(-q * 28);
    }
  }
  const neonOn = Math.max(0, Math.min(1, (t - 0.57) / 0.1));
  v += (Math.sin(t * Math.PI * 2 * 119) * 0.022 + Math.sin(t * Math.PI * 2 * 238) * 0.006) * neonOn;
  return [v, v * 0.9];
}));

let staticLp = 0;
wav('t5_static_to_felt.wav', stem(1.4, (t) => {
  staticLp = staticLp * 0.74 + noise() * 0.26;
  const staticAmt = Math.max(0, 1 - t / 0.78);
  const staticNoise = noise() * 0.09 * staticAmt + Math.sin(t * Math.PI * 2 * 60) * 0.012 * staticAmt;
  const felt = staticLp * 0.16 * Math.min(1, Math.max(0, (t - 0.38) / 0.5));
  let brush = 0;
  for (const at of [0.66, 0.88, 1.08]) {
    const u = t - at;
    if (u > 0 && u < 0.24) brush += staticLp * 0.11 * Math.sin(Math.PI * u / 0.24);
  }
  const v = staticNoise + felt + brush;
  return [v * 0.86, v];
}));

wav('t6_felt_door_push.wav', stem(1.2, (t) => {
  let v = 0;
  if (t < 0.42) {
    const k = t / 0.42;
    v += noise() * 0.045 * Math.sin(Math.PI * k) + Math.sin(t * Math.PI * 2 * (86 + k * 42)) * 0.022 * k;
  }
  const u = t - 0.38;
  if (u > 0 && u < 0.16) {
    v += noise() * 0.13 * Math.exp(-u * 24) + Math.sin(u * Math.PI * 2 * 142) * 0.08 * Math.exp(-u * 18);
  }
  const bloom = Math.max(0, Math.min(1, (t - 0.55) / 0.35));
  v += (Math.sin(t * Math.PI * 2 * 58) * 0.028 + Math.sin(t * Math.PI * 2 * 116) * 0.008) * bloom;
  return [v, v * 0.74];
}));

wav('t7_lightfall_home.wav', stem(1.4, (t) => {
  let v = 0;
  for (const [i, at] of [0.05, 0.28, 0.53, 0.82].entries()) {
    const u = t - at;
    if (u > 0 && u < 0.38) {
      const fallHz = 980 - i * 140 - u * 290;
      const warmth = Math.min(1, t / 1.1);
      v += Math.sin(u * Math.PI * 2 * fallHz) * (0.030 - i * 0.003) * Math.exp(-u * 4.5) * (0.8 + warmth * 0.35);
    }
  }
  const air = noise() * 0.012 * Math.max(0, (t - 0.55) / 0.6);
  const curtain = noise() * 0.026 * Math.max(0, Math.min(1, (t - 0.82) / 0.28)) * Math.exp(-Math.max(0, t - 1.1) * 2.2);
  v += air + curtain;
  return [v * 0.9, v];
}));

// Full-timeline room-tone beds. These are architectural continuity layers, not final creature/cue passes:
// every zone has a distinct physical space tone and edge fades overlap the engine transition windows.
function edgeFade(t: number, dur: number, fadeIn: number, fadeOut: number): number {
  return Math.max(0, Math.min(1, t / fadeIn, (dur - t) / fadeOut));
}
function bed(file: string, dur: number, fadeIn: number, fadeOut: number, fn: (t: number, lp: () => number) => [number, number]): void {
  let lpState = 0;
  let airL = 0, airR = 0;
  const lp = () => (lpState = lpState * 0.86 + noise() * 0.14);
  const seed = file.length * 3.17;
  const pcm = stem(dur, (t) => {
    const [bl, br] = fn(t, lp);
    // Independent low-passed air fields decorrelate the bed without moving its body off-center.
    // They are added before edge fades so zone crossfades never hard-cut the stereo hiss.
    const si = Math.floor(t * SR + 0.5);
    airL = airL * 0.935 + (hash01(si, seed) - 0.5) * 0.065;
    airR = airR * 0.935 + (hash01(si, seed + 19.7) - 0.5) * 0.065;
    const e = edgeFade(t, dur, fadeIn, fadeOut);
    return [(bl + airL * 0.18) * e, (br + airR * 0.18) * e];
  });
  wav(file, pcm);
}

bed('z0_machine_room_tone.wav', 4.2, 0.18, 0.42, (t, lp) => {
  const transformer = Math.sin(t * Math.PI * 2 * 58) * 0.015 + Math.sin(t * Math.PI * 2 * 116) * 0.004;
  const floorMass = Math.sin(t * Math.PI * 2 * 31) * 0.009 + lp() * 0.020;
  const fan = lp() * 0.020 + noise() * 0.004;
  const relayGate = (t > 1.16 && t < 1.20) || (t > 2.04 && t < 2.075);
  const relay = relayGate ? (noise() * 0.028 + Math.sin(t * Math.PI * 2 * 168) * 0.018) : 0;
  const v = transformer + floorMass + fan + relay;
  return [v, v * 0.82];
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
  const hum = Math.sin(t * Math.PI * 2 * 60) * 0.0065 + Math.sin(t * Math.PI * 2 * 120) * 0.0006 + Math.sin(t * Math.PI * 2 * 180) * 0.0004;
  const sharedHiss = noise() * 0.004 + lp() * 0.010;
  const si = Math.floor(t * SR + 0.5);
  const airL = (hash01(si, 51.3) * 2 - 1) * 0.006;
  const airR = (hash01(si, 52.9) * 2 - 1) * 0.006;
  const endFade = 1 - smoothstep(9.15, 10.0, t);
  const v = (hum + sharedHiss) * endFade;
  return [(v + airL * endFade) * 0.98, (v + airR * endFade) * 0.94];
});

console.log(`wrote procedural THRESHOLD stems to ${OUT}`);
