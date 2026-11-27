#!/usr/bin/env bun
// Procedural THRESHOLD Z1 sound-stem generator. All source audio is synthesized here;
// generated WAVs are evidence/build products and are never committed.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { coloredNoise, impactStrike, musicBoxTine, plasticKnock, ceramicImpact, naveMassHit, stoneStep, glassShard, carpetStep, clothDrag, clockTick, crtSpeakerBurst, paperRustle, paperTear, paperSlam, woodCreak, bodyCough, waterDrop, waterDisplace, wetScrape, muffledBellStrike, renderBellPhone, renderCrtProgram, renderConvolutionRoom, slowNoise01, softImpact, tileClatter, type RoomOptions } from './threshold_audio_lib';

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

function writeWav(file: string, pcm: Float32Array): void {
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

function wav(file: string, pcmIn: Float32Array): void {
  writeWav(file, roomize(pcmIn));
}

function wavRoom(file: string, pcmIn: Float32Array, room: RoomOptions): void {
  writeWav(file, renderConvolutionRoom(pcmIn, SR, room));
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

const z1OfficeRoom: RoomOptions = { size: 1.0, decaySec: 1.05, dampingHz: 2600, predelayMs: 11, earlyDb: -12, tailDb: -8, dryDb: 0 };
const z1BedRoom: RoomOptions = { size: 0.72, decaySec: 0.65, dampingHz: 1250, predelayMs: 8, earlyDb: -38, tailDb: -34, dryDb: 0 };

// Redesigned office bed: silence is the default. The fluorescent ballast is a low,
// unstable electrical body rather than a bright hiss bed; most of the zone remains
// below audibility until a discrete physical event earns attention.
let z1AirL = 0, z1AirR = 0, z1HumWander = 0;
wavRoom('z1_fluorescent_bed.wav', stem(27, (t) => {
  z1HumWander = z1HumWander * 0.995 + Math.sin(t * 0.37) * 0.00012;
  const hum = Math.sin(t * Math.PI * 120 + z1HumWander) * 0.0038 + Math.sin(t * Math.PI * 240) * 0.0012 + Math.sin(t * Math.PI * 360) * 0.00038;
  const si = Math.floor(t * SR + 0.5);
  z1AirL = z1AirL * 0.982 + (hash01(si, 3.1) - 0.5) * 0.018;
  z1AirR = z1AirR * 0.982 + (hash01(si, 4.7) - 0.5) * 0.018;
  const fade = Math.max(0, Math.min(1, t / 1.15, (27 - t) / 1.4));
  // Rare transformer instability, felt as a sagging electrical mass rather than noise.
  const sag = 1 - 0.22 * smoothstep(13.8, 14.1, t) * (1 - smoothstep(14.9, 15.3, t));
  return [(hum * 0.92 + z1AirL * 0.020) * fade * sag, (hum + z1AirR * 0.020) * fade * sag];
}), z1BedRoom);

// Failing-tube ticks become small ballast/relay contacts in the ceiling metalwork.
wavRoom('z1_fluorescent_ticks.wav', stem(27, (t) => {
  let v = 0;
  for (const [start, seed] of [[2.42, 6.1], [8.72, 7.3]] as const) {
    for (let k = 0; k < 3; k++) {
      const u = t - start - k * 0.031;
      v += impactStrike(u, 620 - k * 55, seed + k, 0.022 - k * 0.005);
    }
  }
  return [v * 0.92, v];
}), z1OfficeRoom);

// A real twin-bell telephone: noise-driven clapper excitation through damped metal
// resonator banks, then office reflections. No periodic oscillator or gated ring tone.
wavRoom('z1_phone_ring.wav', renderBellPhone(2.8, SR), { ...z1OfficeRoom, decaySec: 1.75, tailDb: -3.8, earlyDb: -8.0 });

// Receiver breathing: one uneven close airway cycle. Turbulence is heavily damped by
// the plastic earpiece; the silence after the exhale is part of the source rather
// than an editorial mute or gate.
let z1ReceiverLp = 0, z1ReceiverLp2 = 0, z1ReceiverLp3 = 0;
wavRoom('z1_receiver_breath.wav', stem(4.2, (t) => {
  z1ReceiverLp = z1ReceiverLp * 0.948 + noise() * 0.052;
  z1ReceiverLp2 = z1ReceiverLp2 * 0.900 + z1ReceiverLp * 0.100;
  z1ReceiverLp3 = z1ReceiverLp3 * 0.82 + z1ReceiverLp2 * 0.18;
  const inhale = smoothstep(0.10, 0.43, t) * (1 - smoothstep(0.70, 1.02, t));
  const exhale = smoothstep(1.22, 1.50, t) * (1 - smoothstep(2.02, 2.48, t)) * 0.76;
  const airway = inhale + exhale;
  const band = z1ReceiverLp2 * 0.58 + (z1ReceiverLp2 - z1ReceiverLp3) * 0.72;
  const organic = 0.66 + slowNoise01(t, 132.7, 2.1) * 0.24 + slowNoise01(t, 133.9, 10.7) * 0.34;
  const v = band * 0.22 * airway * organic * Math.min(1, t / 0.18);
  return [v, v * 0.82];
}), { ...z1OfficeRoom, earlyDb: -14, tailDb: -9, predelayMs: 5 });

// Wet overhead breathing in three uneven efforts separated by actual pauses. The
// body is turbulent air and low chest pressure, with no tonal oscillator voice.
let wetLp = 0, wetLp2 = 0;
wavRoom('z1_ceiling_breath.wav', stem(5.1, (t) => {
  wetLp = wetLp * 0.956 + noise() * 0.044;
  wetLp2 = wetLp2 * 0.88 + wetLp * 0.12;
  const si = Math.floor(t * SR + 0.5);
  let v = 0;
  for (const [j, at, dur, scale, release] of [[0, 0.20, 1.12, 1.0, 0], [1, 1.82, 0.86, 0.68, 1], [2, 3.34, 0.74, 0.42, 0]] as const) {
    const u = t - at;
    if (u >= 0 && u < dur) {
      const x = u / dur;
      const shaped = release ? Math.sin(Math.PI * x) ** 1.1 * (0.72 + 0.28 * x) : Math.sin(Math.PI * x) ** 1.45;
      const fatigue = 1 - j * 0.055;
      const organic = 0.62 + slowNoise01(u, 141.5 + j * 3.3, 1.65 + j * 0.17) * 0.24 + slowNoise01(u, 145.8 + j * 2.1, 9.2 + j) * 0.42;
      const air = wetLp2 * 0.22 * shaped * fatigue * organic;
      const chest = coloredNoise(si, 112.4 + j, 31) * 0.045 * shaped * (0.75 + slowNoise01(u, 151.2 + j, 1.1) * 0.5);
      const seam = release && x > 0.68 && x < 0.76 ? coloredNoise(si, 118.9 + j, 11) * 0.014 * Math.sin(Math.PI * (x - 0.68) / 0.08) : 0;
      v += (air + chest + seam) * scale;
    }
  }
  return [v, v * 0.78];
}), { ...z1OfficeRoom, earlyDb: -13, tailDb: -9 });

// Grid creaks and cracking tile: strained painted metal, then small mineral fractures.
wavRoom('z1_ceiling_creaks.wav', stem(2.2, (t) => {
  let v = 0;
  for (const [at, dur, f0, f1, amp] of [[0.10, 0.48, 118, 82, 0.11], [0.66, 0.38, 170, 126, 0.075], [1.20, 0.30, 96, 71, 0.10]] as const) {
    const u = t - at;
    if (u >= 0 && u < dur) {
      const k = u / dur;
      const hz = f0 + (f1 - f0) * k;
      const strain = Math.sin(u * Math.PI * 2 * hz + Math.sin(u * 31) * 0.55) * amp * Math.sin(Math.PI * k) ** 1.4;
      const friction = noise() * amp * 0.09 * Math.sin(Math.PI * k) ** 2;
      v += strain + friction + Math.sin(u * Math.PI * 2 * hz * 2.03) * amp * 0.18 * Math.sin(Math.PI * k);
    }
  }
  for (const [j, at] of [1.38, 1.47, 1.61].entries()) {
    const u = t - at;
    v += impactStrike(u, 310 - j * 38, 14.5 + j, 0.065 - j * 0.012);
  }
  return [v, v * 0.88];
}), z1OfficeRoom);

// Carpet run, ceiling rasp, and irregular tile impacts behind. Footsteps are event-based
// rather than a loop: stride interval, weight, pitch, pan, and surface noise vary step to step.
const z1StepEvents: Array<{ at: number; hz: number; amp: number; pan: number; seed: number; toe: number; drag: number }> = [];
{
  let tt = 0.05;
  for (let i = 0; tt < 8.15; i++) {
    z1StepEvents.push({
      at: tt,
      hz: 42 + hash01(i, 51.2) * 34,
      amp: 0.072 + hash01(i, 52.3) * 0.095,
      pan: (i % 2 ? 0.22 : -0.20) + (hash01(i, 53.4) - 0.5) * 0.18,
      seed: 60.1 + i * 1.73,
      toe: hash01(i, 57.8) < 0.35 ? 0.16 + hash01(i, 58.9) * 0.04 : 0.052 + hash01(i, 55.6) * 0.042,
      drag: 0.45 + hash01(i, 56.7) * 0.9,
    });
    tt += 0.27 + hash01(i, 54.5) * 0.20;
  }
}
const z1SlamEvents: Array<{ at: number; hz: number; amp: number; pan: number; seed: number }> = [];
{
  let tt = 0.72;
  for (let i = 0; tt < 7.65; i++) {
    z1SlamEvents.push({
      at: tt,
      hz: 76 + hash01(i, 61.2) * 48,
      amp: 0.10 + hash01(i, 62.3) * 0.13,
      pan: -0.42 + hash01(i, 63.4) * 0.84,
      seed: 80.2 + i * 2.11,
    });
    tt += 0.43 + hash01(i, 64.5) * 0.34;
  }
}
const z1Colored = (si: number, seed: number) => (hash01(si, seed) * 0.46 + hash01(si - 1, seed) * 0.31 + hash01(si - 2, seed) * 0.23 - 0.5) * 2;
let z1RunLpL = 0, z1RunLpR = 0;
wavRoom('z1_run_carpet.wav', stem(8.4, (t) => {
  let l = 0, r = 0;
  const si = Math.floor(t * SR + 0.5);
  const add = (v: number, pan: number) => {
    const a = (pan + 1) * Math.PI / 4;
    l += v * Math.cos(a);
    r += v * Math.sin(a);
  };

  for (const e of z1StepEvents) {
    const u = t - e.at;
    if (u >= 0 && u < 0.14) {
      const heel = softImpact(u, e.hz, e.seed, e.amp * 0.86);
      const toeU = u - e.toe;
      const toe = toeU >= 0 ? softImpact(toeU, e.hz * 1.18, e.seed + 2.4, e.amp * 0.16) : 0;
      const sole = coloredNoise(si, e.seed, 23) * Math.exp(-u * 52) * e.amp * 0.045;
      const carpetDrag = coloredNoise(si, e.seed + 4.0, 25) * Math.exp(-u * 9) * e.amp * 0.050 * e.drag;
      add(heel + toe + sole + carpetDrag, e.pan);
    }
  }

  for (const e of z1SlamEvents) {
    const u = t - e.at;
    if (u >= 0 && u < 0.72) {
      const mineral = z1Colored(si, e.seed + 8.0) * Math.exp(-u * 105) * e.amp * 0.30;
      const body = tileClatter(u, e.hz, e.seed, e.amp) + mineral;
      add(body, e.pan);
    }
  }

  // The breather moves overhead in separate wet bursts rather than a continuous noise bed.
  for (const [j, at, dur, pan] of [[0, 1.28, 0.62, -0.24], [1, 3.18, 0.74, 0.08], [2, 5.36, 0.68, 0.31], [3, 6.92, 0.55, -0.12]] as const) {
    const u = t - at;
    if (u >= 0 && u < dur) {
      const gate = Math.sin(Math.PI * u / dur) ** 1.7;
      const rasp = z1Colored(si, 96.5 + j) * gate * 0.030 + Math.sin(u * Math.PI * 2 * (47 + j * 5)) * gate * 0.012;
      add(rasp, pan);
    }
  }

  const fade = Math.min(1, t / 0.18, (8.4 - t) / 0.35);
  const alpha = 1 - Math.exp(-2 * Math.PI * 850 / SR);
  z1RunLpL += alpha * (l * fade * 1.28 - z1RunLpL);
  z1RunLpR += alpha * (r * fade * 1.28 - z1RunLpR);
  return [z1RunLpL, z1RunLpR];
}), { ...z1OfficeRoom, size: 1.0, decaySec: 1.05, tailDb: -7.5, earlyDb: -11 });

// Broken toy mechanism behind the fire door, then a physical push-bar impact.
// The music box is detuned metal tines with irregular wind-up spacing, muffled by the
// door until the bar opens it; no electronic arpeggio or clean sine melody.
const z1MusicNotes = [523.25, 659.25, 783.99, 659.25, 523.25, 493.88, 659.25, 783.99, 880.0, 783.99];
const z1MusicTimes = [0.05, 0.29, 0.50, 0.75, 0.96, 1.22, 2.10, 2.28, 2.49, 2.72];
let z1JingleLpL = 0, z1JingleLpR = 0;
wavRoom('z1_door_jingle_hit.wav', stem(3.0, (t) => {
  let music = 0;
  for (const [i, hz] of z1MusicNotes.entries()) {
    const u = t - z1MusicTimes[i]!;
    const detune = 1 + (hash01(i, 17.2) - 0.5) * 0.025;
    const behindDoor = z1MusicTimes[i]! < 2.0 ? 0.28 : 0.72;
    music += musicBoxTine(u, hz * detune, 21.4 + i, 0.105 * behindDoor);
  }
  const bar = impactStrike(t - 1.98, 218, 29.1, 0.34) + impactStrike(t - 2.035, 91, 31.4, 0.20);
  const doorWood = impactStrike(t - 2.08, 132, 33.9, 0.13);
  const rawL = music * 0.90 + bar + doorWood * 0.85;
  const rawR = music + bar * 0.82 + doorWood;
  const open = smoothstep(2.0, 2.35, t);
  const alpha = 0.045 + open * 0.085;
  z1JingleLpL += alpha * (rawL - z1JingleLpL);
  z1JingleLpR += alpha * (rawR - z1JingleLpR);
  return [z1JingleLpL, z1JingleLpR];
}), { ...z1OfficeRoom, size: 1.05, decaySec: 1.55, tailDb: -8, earlyDb: -11 });



// Silent sidechain key for the 40.5s freeze vacuum; carried on foley_guide so it is
// never audible in the master.
wav('z2_freeze_duck_key.wav', stem(0.5, () => [0, 0]));

// Z2 playroom redesign: the cartoon room is almost silent except for physical plastic,
// foam, ball-shell, and broken toy-mechanism events. Birds/child loops and electronic
// warbles are deliberately removed; they read as cute/digital rather than eerie.
const z2PlayroomRoom: RoomOptions = { size: 1.05, decaySec: 0.55, dampingHz: 2350, predelayMs: 13, earlyDb: -11, tailDb: -18, dryDb: 0 };

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

const z2MusicEvents: Array<{ at: number; hz: number; amp: number; seed: number }> = [];
{
  // Not a melody: the cylinder is damaged and keeps catching on isolated teeth.
  // Wide irregular gaps, octave-sagged tines, and 90-260 cent detuning make the
  // mechanism physically wrong before any performance embellishment.
  const fragments = [
    [30.25, 523.25, -35, 1.0, 0.017],
    [31.72, 783.99, -88, 1.0, 0.015],
    [33.38, 523.25, -122, 0.5, 0.014],
    [35.08, 587.33, -176, 0.5, 0.012],
    [36.72, 659.25, -214, 1.0, 0.010],
    [38.18, 783.99, -260, 0.5, 0.008],
    [39.56, 493.88, -190, 0.5, 0.007],
  ] as const;
  for (const [i, spec] of fragments.entries()) {
    const [at, hz, cents, octave, amp] = spec;
    z2MusicEvents.push({
      at: at + (hash01(i, 63.1) - 0.5) * 0.09,
      hz: hz * Math.pow(2, cents / 1200) * octave,
      amp,
      seed: 90.1 + i * 1.37,
    });
  }
}

const z2BallEvents: Array<{ at: number; hz: number; amp: number; pan: number; seed: number }> = [];
{
  let tt = 38.05;
  for (let i = 0; tt < 40.44; i++) {
    const k = (tt - 38.05) / 2.39;
    z2BallEvents.push({
      at: tt,
      hz: 260 + hash01(i, 70.2) * 410,
      amp: 0.025 + k * 0.055 + hash01(i, 71.3) * 0.018,
      pan: -0.18 + k * 0.30 + (hash01(i, 72.4) - 0.5) * 0.18,
      seed: 100.2 + i * 1.71,
    });
    tt += 0.48 - k * 0.15 + hash01(i, 73.5) * 0.10;
  }
}
const z2CascadeEvents: Array<{ at: number; hz: number; amp: number; pan: number; seed: number }> = [];
{
  let tt = 44.48;
  for (let i = 0; tt < 45.32; i++) {
    z2CascadeEvents.push({
      at: tt,
      hz: 135 + hash01(i, 76.2) * 150,
      amp: 0.026 + hash01(i, 77.3) * 0.034,
      pan: 0.02 + hash01(i, 78.4) * 0.42,
      seed: 130.2 + i * 2.03,
    });
    tt += 0.16 + hash01(i, 79.5) * 0.18;
  }
}

const z2ToyPhone = renderBellPhone(2.35, SR);
let z2NoiseLp = 0;
wavRoom('z2_playroom_events.wav', stem(25.8, (t) => {
  const at = t + 29.6;
  z2NoiseLp = z2NoiseLp * 0.90 + noise() * 0.10;
  const si = Math.floor(t * SR + 0.5);
  let l = 0, r = 0;
  const add = (v: number, pan = 0) => {
    const a = (pan + 1) * Math.PI / 4;
    l += v * Math.cos(a);
    r += v * Math.sin(a);
  };
  const addStereo = (vl: number, vr: number) => { l += vl; r += vr; };

  // A broken wind-up mechanism, distant in the playroom. Notes are irregular and mute
  // quickly; there is no bright looping electronic arpeggio.
  for (const e of z2MusicEvents) {
    add(musicBoxTine(at - e.at, e.hz, e.seed, e.amp), -0.18);
  }
  for (const [j, atc] of [31.15, 35.05, 37.65, 39.85].entries()) {
    add(plasticKnock(at - atc, 310 - j * 28, 84.2 + j, 0.018), -0.16);
  }

  // Stepped hard-plastic shelf animals: small shell rotations, not high electronic clicks.
  for (const [j, hit, pan] of [[0, 33.2, 0.18], [1, 34.1, 0.08], [2, 35.0, 0.28]] as const) {
    add(plasticKnock(at - hit, 330 - j * 24, 86.1 + j, 0.040 - j * 0.006), pan);
  }

  // Slow foam-mat contacts during the first careful walk.
  for (const [j, step] of [32.8, 33.45, 34.1, 34.75, 35.4].entries()) {
    add(softImpact(at - step, 46 + hash01(j, 87.2) * 18, 88.3 + j, 0.045 + hash01(j, 88.4) * 0.024), j % 2 ? 0.12 : -0.12);
  }

  // Ball-shell displacement as the submerged bulge approaches: irregular hollow plastic
  // knocks and low rolling friction, increasing in density but never becoming static.
  for (const e of z2BallEvents) {
    add(plasticKnock(at - e.at, e.hz, e.seed, e.amp), e.pan);
  }
  // Freeze heartbeat: dull internal pressure contacts with a smaller second valve motion.
  for (const hit of z2HeartTimes) {
    for (const [off, mul] of [[0, 1], [0.16, 0.50]] as const) {
      const u = at - hit - off;
      if (u > 0 && u < 0.16) {
        const swell = 0.62 + Math.max(0, Math.min(1, (at - 40.8) / 6.7)) * 0.72;
        const pressure = Math.sin(Math.PI * Math.min(1, u / 0.052)) ** 2;
        const body = coloredNoise(si, 116.2 + hit, 29) * pressure * 0.040 + Math.sin(u * Math.PI * 2 * 48) * 0.006 * Math.exp(-u * 44);
        add(body * mul * swell, 0);
      }
    }
  }

  // Pit Swimmer surface cascade: many hollow plastic shells shifting under weight.
  for (const e of z2CascadeEvents) {
    add(plasticKnock(at - e.at, e.hz, e.seed, e.amp), e.pan);
  }

  // Hollow tube breath in two uneven efforts, mostly turbulent air inside vinyl.
  for (const [j, start, dur, scale] of [[0, 44.70, 0.38, 0.82], [1, 45.26, 0.30, 0.58]] as const) {
    const u = at - start;
    if (u >= 0 && u < dur) {
      const x = u / dur;
      const envb = Math.sin(Math.PI * x) ** 1.35;
      const organic = 0.64 + slowNoise01(u, 141.2 + j, 1.5) * 0.26 + slowNoise01(u, 149.4 + j, 8.7) * 0.34;
      const air = coloredNoise(si, 142.5 + j, 19) * envb * organic * 0.038;
      const tube = Math.sin(u * Math.PI * 2 * (128 + j * 14 + Math.sin(u * 2.1) * 5)) * envb * 0.005;
      add((air + tube) * scale, 0.14);
    }
  }

  // The toy phone is still a mechanical bell object, only smaller and further away.
  // No electronic warble or toy-bird chirp.
  {
    const pi = Math.floor((at - 47.5) * SR);
    if (pi >= 0 && pi * 2 + 1 < z2ToyPhone.length) {
      addStereo(z2ToyPhone[pi * 2]! * 0.22, z2ToyPhone[pi * 2 + 1]! * 0.20);
    }
  }

  // Swimmer dives toward the phone: hollow shell displacement and a vinyl pressure gulp.
  if (at >= 48.35 && at < 49.25) {
    const u = at - 48.35;
    const envd = Math.sin(Math.PI * u / 0.9);
    const sweep = coloredNoise(si, 154.8, 21) * envd * 0.050;
    const gulp = u > 0.64 ? plasticKnock(u - 0.64, 190, 155.2, 0.12) : 0;
    add(sweep + gulp, 0.25 - u * 0.22);
  }

  // Crawl friction inside the ribbed plastic tunnel: clothing and hands on plastic,
  // irregular pressure rather than a tonal scratch loop.
  for (const [j, start, dur, pan] of [[0, 49.85, 0.38, -0.05], [1, 51.05, 0.34, 0.02], [2, 52.45, 0.42, 0.08], [3, 53.80, 0.36, 0.14]] as const) {
    const u = at - start;
    if (u >= 0 && u < dur) {
      const envc = Math.sin(Math.PI * u / dur) ** 1.25;
      const micro = 0.70 + slowNoise01(u, 163.4 + j, 8.2) * 0.55;
      add(coloredNoise(si, 164.5 + j, 29) * envc * micro * 0.075, pan);
    }
  }
  for (const [j, hit] of [50.05, 51.36, 52.88, 54.28].entries()) {
    add(plasticKnock(at - hit, 250 + hash01(j, 165.1) * 130, 166.2 + j, 0.024 + hash01(j, 166.8) * 0.020), -0.03 + j * 0.04);
  }

  // Tenant crossing the far light: air pressure drops and distant plastic is displaced.
  if (at >= 52.2 && at < 52.7) {
    const u = at - 52.2;
    const pressure = -Math.sin(Math.PI * u / 0.5) * 0.007;
    const scrape = u > 0.18 ? coloredNoise(si, 171.4, 25) * 0.022 * Math.exp(-(u - 0.18) * 5) : 0;
    add(pressure + scrape, 0);
  }

  // First wet evidence at the tube end: two low physical drips, no bright chime.
  for (const [j, hit] of [53.85, 54.55].entries()) {
    add(impactStrike(at - hit, 420 - j * 55, 176.2 + j, 0.028 - j * 0.007), 0.15);
  }

  return [l, r];
}), z2PlayroomRoom);


// Z3 tiled pool redesign: huge wet darkness, sparse physical water movement, and
// long tiled convolution tails. No interface tones, sonar pings, sweeps, or bright chimes.
const z3PoolRoom: RoomOptions = { size: 1.8, decaySec: 2.35, dampingHz: 1450, predelayMs: 17, earlyDb: -9, tailDb: -9, dryDb: -1 };
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
const z3Drips = [56.20, 64.15, 67.15, 69.75, 76.20];
wavRoom('z3_pool_events.wav', stem(25.8, (t) => {
  const at = t + 54.6;
  const si = Math.floor(t * SR + 0.5);
  let l = 0, r = 0;
  const add = (v: number, pan = 0) => {
    const a = (pan + 1) * Math.PI / 4;
    l += v * Math.cos(a);
    r += v * Math.sin(a);
  };

  // Rare droplets from the tiled ceiling. Their length comes from the room, not a tonal tail.
  for (const [j, drip] of z3Drips.entries()) {
    add(waterDrop(at - drip, 235 + hash01(j, 181.2) * 105, 181.7 + j, 0.078 + hash01(j, 182.5) * 0.024), -0.36 + hash01(j, 183.4) * 0.70);
  }

  // First-person knee-deep movement: lowpassed displaced water and cavity pressure.
  // Steps are close but deliberately dark; the tiled room carries the fear.
  for (let i = 0; i < z3ViewerSteps.length; i++) {
    const hit = z3ViewerSteps[i]!;
    const retreat = hit > 74.5 ? 0.085 : (hit < 62.5 ? 0.026 : 0.038);
    add(waterDisplace(at - hit, 190.2 + i * 1.43, retreat, hit > 74.5 ? 104 : 124), (i % 2 ? 0.12 : -0.12));
  }

  // Reflection mismatch: after the viewer stops, two small laps arrive late and too far left.
  for (const [j, hit] of [63.08, 63.58].entries()) {
    add(waterDisplace(at - hit, 205.2 + j, 0.028 - j * 0.006, 92), -0.32);
  }

  // One isolated step that is not ours, ahead/right: heavier, lower, and out of cadence.
  add(waterDisplace(at - 64.82, 211.4, 0.105, 88), 0.35);

  // Distant submerged pressure impact: felt through the pool mass more than heard.
  if (at >= 68.0 && at < 68.65) {
    const u = at - 68.0;
    const pressure = Math.sin(Math.PI * Math.min(1, u / 0.28)) ** 2;
    add((Math.sin(u * Math.PI * 2 * 39) * 0.020 + coloredNoise(si, 214.5, 31) * 0.020) * pressure, 0.04);
  }

  // The submerged beige phone: a few muffled mechanical clapper strikes, never an electronic ringtone.
  for (let k = 0; k < 16; k++) {
    const hit = 70.05 + k * 0.052 + (hash01(k, 217.2) - 0.5) * 0.006;
    add(muffledBellStrike(at - hit, k % 2 ? 505 : 418, 218.3 + k, 0.026 * (0.75 + hash01(k, 219.4) * 0.35)), 0.35);
  }

  // Mirrorling emergence: wet ceramic friction and a sheet of water shedding from metal.
  add(wetScrape(at - 72.02, 0.46, 221.2, 0.105), -0.05);
  add(waterDisplace(at - 72.20, 222.6, 0.125, 96), -0.03);

  // Discrete late Mirrorling landings: ceramic contact plus circular water displacement.
  for (let i = 0; i < z3MirrorlingSteps.length; i++) {
    const hit = z3MirrorlingSteps[i]!;
    add(ceramicImpact(at - hit, 205 - i * 14, 225.1 + i, 0.040), -0.08 + i * 0.08);
    add(waterDisplace(at - hit - 0.018, 226.4 + i, 0.070, 110), -0.08 + i * 0.08);
  }

  // Heel catches the submerged step; cloth and water rise before the fall.
  add(ceramicImpact(at - 78.02, 190, 231.2, 0.060), 0.08);
  add(waterDisplace(at - 78.10, 232.5, 0.080, 112), 0.08);

  // Frame-filling splash, then immediate underwater pressure. The impact is loud but brief;
  // no sustained broadband roar is allowed to become static.
  add(waterDisplace(at - 78.42, 235.8, 0.22, 72), 0);
  if (at >= 78.72 && at < 79.55) {
    const u = at - 78.72;
    const pressure = Math.sin(Math.PI * Math.min(1, u / 0.72)) ** 1.4;
    add((Math.sin(u * Math.PI * 2 * 43) * 0.026 + coloredNoise(si, 236.5, 35) * 0.028) * pressure, 0);
  }

  return [l, r];
}), z3PoolRoom);


// Z4 dry paper-canyon redesign: intimate fibre texture after the pool's wet scale.
// Paper acoustics are absorbent and close; convolution is short and restrained.
const z4LibraryRoom: RoomOptions = { size: 1.05, decaySec: 0.62, dampingHz: 1750, predelayMs: 10, earlyDb: -14, tailDb: -15, dryDb: 0 };
const z4StepTimes = [81.0, 81.8, 82.6, 83.35, 84.05, 84.75, 85.45, 86.15, 86.85, 87.55, 95.65, 96.12, 96.59, 97.05, 97.51, 97.96, 98.40, 98.84, 99.27, 99.69, 100.10, 100.51, 100.91, 101.30, 101.68, 102.05, 102.41, 102.76, 103.10, 103.43];
const z4ToppleTimes: number[] = [];
for (let t = 95.5; t <= 103.7; t += 1.2) z4ToppleTimes.push(t);
wavRoom('z4_library_events.wav', stem(25.9, (t) => {
  const at = t + 79.4;
  let l = 0, r = 0;
  const add = (v: number, pan = 0) => {
    const a = (pan + 1) * Math.PI / 4;
    l += v * Math.cos(a);
    r += v * Math.sin(a);
  };

  // Fountain-pen footnote marks: short dry fibre scratches synchronized to the walk.
  for (let i = 0; i < z4StepTimes.length; i++) {
    const hit = z4StepTimes[i]!;
    if (hit < 86.2) add(paperRustle(at - hit, 0.085 + hash01(i, 250.2) * 0.035, 250.7 + i, 0.20), i % 2 ? 0.09 : -0.09);
    if (hit >= 95.5) {
      const closeK = Math.max(0, Math.min(1, (hit - 95.5) / 8.0));
      add(paperRustle(at - hit, 0.11, 254.7 + i, 0.24 + closeK * 0.12), i % 2 ? 0.11 : -0.11);
    }
  }

  // Rule-line writing is intermittent physical strokes with true gaps, not a continuous scratch bed.
  for (const [j, hit, dur] of [[0, 86.15, 0.24], [1, 86.72, 0.18], [2, 87.35, 0.27]] as const) {
    add(paperRustle(at - hit, dur, 260.2 + j, 0.13 - j * 0.015), -0.12);
  }

  // Faint mechanical clock teeth. No bright oscillator ping: only tiny escapement contacts.
  for (let k = 0; k < 8; k++) {
    const hit = 80.15 + k * 0.96 + (hash01(k, 263.2) - 0.5) * 0.018;
    add(clockTick(at - hit, 265.3 + k, 0.040), -0.24);
  }
  add(clockTick(at - 88.0, 266.4, 0.070), -0.24);

  // One distant human cough in the paper room.
  add(bodyCough(at - 81.80, 267.2, 0.16), 0.42);
  add(bodyCough(at - 81.94, 268.2, 0.10), 0.40);

  // Folded paper moth flutters: dry fibre only, no wing-tone oscillator.
  for (const [j, start] of [80.4, 80.9, 81.45, 82.0].entries()) {
    for (let flap = 0; flap < 3; flap++) {
      add(paperRustle(at - start - flap * 0.055, 0.042, 270.2 + j * 3 + flap, 0.085 - flap * 0.012), -0.28 + hash01(j, 271.5) * 0.55);
    }
  }

  // Tenant shadow crossing: a long paper sweep built from irregular fibre surges and gaps.
  if (at >= 89.7 && at < 91.6) {
    const u = at - 89.7;
    const pan = -0.45 + (u / 1.9) * 0.9;
    const gates = Math.max(0, Math.sin(u * Math.PI * 2 * 1.45 + 0.5)) ** 1.6;
    add(paperRustle(u, 1.9, 274.2, 0.22) * gates, pan);
  }

  // Folded phone through a cardboard tube: muffled bell hits plus brittle paper rattle.
  for (let k = 0; k < 10; k++) {
    const hit = 91.86 + k * 0.055 + (hash01(k, 276.2) - 0.5) * 0.006;
    add(muffledBellStrike(at - hit, k % 2 ? 440 : 365, 277.3 + k, 0.025), 0.38);
    add(paperRustle(at - hit - 0.012, 0.055, 278.4 + k, 0.060), 0.32);
  }

  // Archivist reveal: one substantial sheet tear and segmented paper-arm unfurling.
  add(paperTear(at - 94.20, 1.18, 281.2, 0.34), 0);
  for (let k = 0; k < 7; k++) {
    const hit = 94.75 + k * 0.105 + hash01(k, 282.3) * 0.025;
    add(paperRustle(at - hit, 0.070, 283.4 + k, 0.16 - k * 0.008), (hash01(k, 284.5) - 0.5) * 0.70);
  }

  // Topple/unfold locomotion: paper-mass slams grow closer, with shelf stress between hits.
  for (let i = 0; i < z4ToppleTimes.length; i++) {
    const hit = z4ToppleTimes[i]!;
    const closeK = i / Math.max(1, z4ToppleTimes.length - 1);
    add(paperSlam(at - hit, 286.2 + i * 1.31, 0.25 + closeK * 0.22, closeK), (i % 2 ? 0.12 : -0.12) * (1 - closeK * 0.5));
    if (hit >= 97.0) add(paperSlam(at - hit - 0.27, 288.5 + i, 0.14 + closeK * 0.13, closeK), 0);
  }
  for (const [j, hit, dur] of [[0, 95.85, 0.72], [1, 98.20, 0.55], [2, 101.15, 0.66]] as const) {
    add(woodCreak(at - hit, dur, 292.2 + j, 0.28 + j * 0.055), -0.18 + j * 0.14);
  }

  // Loose sheets whip past intermittently; each is a discrete fibre event.
  for (const [j, start] of [97.15, 98.05, 98.95, 99.9, 100.65, 101.45, 102.2, 103.0, 103.65].entries()) {
    add(paperRustle(at - start, 0.18 + hash01(j, 295.2) * 0.08, 296.3 + j, 0.13 + hash01(j, 297.4) * 0.05), hash01(j, 298.5) * 1.1 - 0.55);
  }

  // Pressure before T4 arrives in separated swells with true air between them.
  for (const [j, hit] of [102.72, 103.42, 104.05].entries()) {
    const u = at - hit;
    if (u > 0 && u < 0.30) {
      const pressure = Math.sin(Math.PI * u / 0.30) ** 2;
      add((Math.sin(u * Math.PI * 2 * (48 + j * 4)) * 0.018 + paperRustle(u, 0.30, 301.2 + j, 0.16)) * pressure, 0);
    }
  }

  return [l, r];
}), z4LibraryRoom);


// Z5 motel redesign: low dark rain pressure, intermittent weak neon, tactile carpet,
// physical CRT/speaker fragments, and a nearly empty hiding beat. No static beds or chirps.
const z5MotelRoom: RoomOptions = { size: 1.0, decaySec: 0.78, dampingHz: 1500, predelayMs: 10, earlyDb: -11, tailDb: -12, dryDb: 0 };
const z5DoorTv = [0, 1, 2, 3, 4].map((j) => renderCrtProgram(1.05, SR, 360.2 + j));
const z5NearTv = [0, 1, 2, 3, 4].map((j) => renderCrtProgram(0.72, SR, 370.2 + j));
const z5FinalTv = [renderCrtProgram(0.78, SR, 380.2), renderCrtProgram(0.52, SR, 381.2)];
wavRoom('z5_motel_events.wav', stem(25.7, (t) => {
  const at = t + 104.7;
  const si = Math.floor(t * SR + 0.5);
  let l = 0, r = 0;
  const add = (v: number, pan = 0) => {
    const a = (pan + 1) * Math.PI / 4;
    l += v * Math.cos(a);
    r += v * Math.sin(a);
  };

  // Wet shoes compressing dense carpet: close, soft, and dark. Stationary hiding steps are almost absent.
  const steps = [105.3,106.0,106.75,107.5,108.25,109,109.75,110.5,111.25,112,112.75,113.5,114.25,115.0,115.65,116.3,116.95,117.6,118.25,118.9,119.55,120.2,120.9,121.55,122.2,122.85,123.5,124.15,124.8,125.45,126.1,126.75,127.4];
  for (let i = 0; i < steps.length; i++) {
    const hit = steps[i]!;
    if (at < 122.4) {
      let stationary = hit >= 115.5 && hit < 121.2 ? 0.055 : 0.16;
      if (hit >= 108.5 && hit < 113.2) stationary *= 0.55;
      add(carpetStep(at - hit, 311.3 + i, stationary), i % 2 ? 0.10 : -0.10);
    }
  }

  // Muffled program audio through alternating motel doors: physical small-speaker fragments,
  // never a continuous TV-static bed. Each fragment has real silence around it.
  for (const [j, st, pan] of [[0,105.6,0.36],[1,107.4,-0.34],[2,109.4,0.34],[3,111.1,-0.36],[4,113.2,0.30]] as const) {
    {
      const idx = Math.floor((at - st) * SR + 0.5);
      const buf = z5DoorTv[j]!;
      if (idx >= 0 && idx < buf.length / 2) add((buf[idx * 2]! + buf[idx * 2 + 1]!) * 0.5 * 0.72, pan);
    }
  }
  // The passing CRT itself: tinny boxy fragments only when the camera is near it.
  for (const [j, st, dur] of [[0,108.65,0.52],[1,109.55,0.64],[2,110.62,0.48],[3,111.50,0.58],[4,112.65,0.42]] as const) {
    {
      const idx = Math.floor((at - st) * SR + 0.5);
      const buf = z5NearTv[j]!;
      if (idx >= 0 && idx < buf.length / 2) add((buf[idx * 2]! + buf[idx * 2 + 1]!) * 0.5 * 0.92, 0.31);
    }
  }

  // Weak neon/ice-machine relays: sparse mechanical contact ticks with true gaps.
  for (const [j, hit] of [107.2,113.8,121.4,126.9].entries()) {
    add(clockTick(at - hit, 322.2 + j, 0.060), -0.32);
  }

  // Lint at the sconce: felt/wing movement only; the warm chirp is removed.
  for (const [j, st] of [112.14,112.31,112.49].entries()) {
    add(paperRustle(at - st, 0.08, 325.2 + j, 0.12 - j * 0.015), -0.38);
  }

  // Hiding beat: nearly empty. Only two tiny cloth pressure movements and one distant pipe tick.
  for (const [j, st] of [117.25,118.62].entries()) {
    const u = at - st;
    if (u > 0 && u < 0.24) {
      const envb = Math.sin(Math.PI * u / 0.24) ** 1.6;
      add(coloredNoise(si, 328.2 + j, 27) * envb * 0.012, 0.02);
    }
  }
  add(clockTick(at - 119.35, 330.2, 0.014), -0.18);

  // Tenant reveal as a sparse physical material collage: paper, plastic, ceramic, wood stress.
  add(paperTear(at - 120.48, 0.62, 332.2, 0.20), -0.04);
  add(plasticKnock(at - 120.82, 150, 333.3, 0.085), 0.05);
  add(ceramicImpact(at - 121.04, 165, 334.4, 0.065), -0.03);
  add(woodCreak(at - 121.12, 0.46, 335.5, 0.34), 0);

  // Door 217 slam, latch, and body against panel: physical wood mass.
  add(impactStrike(at - 121.82, 92, 337.2, 0.27), 0.28);
  add(woodCreak(at - 121.96, 0.34, 338.3, 0.20), 0.25);
  add(clockTick(at - 122.14, 339.4, 0.055), 0.24);

  // Corridor footsteps outside the door: distant, soft, and few.
  for (const [j, st] of [125.2,126.6].entries()) {
    add(carpetStep(at - st, 341.2 + j, 0.12), 0.18);
  }

  // Handle rotates, sticks, releases: stick-slip metal/wood contact without tonal sweep.
  add(woodCreak(at - 126.82, 0.42, 343.2, 0.26), 0.22);
  add(ceramicImpact(at - 127.18, 260, 344.3, 0.10), 0.20);

  // Final TV-in-room presence before the felt transition: two small-speaker fragments and
  // one weak intermittent electrical pressure swell, then absence.
  {
    const idx = Math.floor((at - 128.12) * SR + 0.5);
    const buf = z5FinalTv[0]!;
    if (idx >= 0 && idx < buf.length / 2) add((buf[idx * 2]! + buf[idx * 2 + 1]!) * 0.5 * 0.68, 0.10);
  }
  {
    const idx = Math.floor((at - 129.05) * SR + 0.5);
    const buf = z5FinalTv[1]!;
    if (idx >= 0 && idx < buf.length / 2) add((buf[idx * 2]! + buf[idx * 2 + 1]!) * 0.5 * 0.54, 0.08);
  }
  if (at >= 128.55 && at < 129.10) {
    const u = at - 128.55;
    const envn = Math.sin(Math.PI * u / 0.55) ** 2;
    add(Math.sin(u * Math.PI * 2 * 59) * 0.006 * envn, 0.12);
  }

  return [l, r];
}), z5MotelRoom);


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

// Z6 felt-theatre redesign: extreme quiet, absorbent acoustics, small handmade motion,
// and a broken sparse music box. No chiptune loop, puppet squeak melody, or organ synth swell.
const z6TheatreRoom: RoomOptions = { size: 0.82, decaySec: 0.48, dampingHz: 1150, predelayMs: 8, earlyDb: -18, tailDb: -17, dryDb: 0 };
wavRoom('z6_theatre_events.wav', stem(21.2, (t) => {
  const at = t + 129.4;
  let l = 0, r = 0;
  const add = (v: number, pan = 0) => {
    const a = (pan + 1) * Math.PI / 4;
    l += v * Math.cos(a);
    r += v * Math.sin(a);
  };

  // Broken theatre music box: isolated flattened teeth, wide wrongness gaps, octave sag,
  // and a spring dying after 139. No melodic run, no chiptune arpeggio.
  const fragments = [
    [130.35, 523.25, -55, 0.75, 0.036],
    [132.10, 659.25, -118, 0.75, 0.031],
    [134.25, 493.88, -82, 0.75, 0.027],
    [136.75, 587.33, -166, 0.5, 0.023],
    [139.15, 523.25, -218, 0.5, 0.018],
    [140.55, 659.25, -264, 0.5, 0.012],
  ] as const;
  for (const [j, spec] of fragments.entries()) {
    const [hit, hz, cents, octave, amp] = spec;
    add(musicBoxTine(at - hit - (hash01(j, 390.2) - 0.5) * 0.10, hz * Math.pow(2, cents / 1200) * octave, 391.3 + j, amp), -0.08);
  }
  for (const [j, hit] of [131.2, 135.4, 139.7].entries()) {
    add(plasticKnock(at - hit, 250 - j * 25, 394.2 + j, 0.012), -0.12);
  }

  // Heavy curtain opening in sparse stop-motion cloth drags, not a continuous noise loop.
  for (const [j, hit, dur] of [[0,130.35,0.34],[1,131.05,0.28],[2,131.95,0.38],[3,132.55,0.24]] as const) {
    add(clothDrag(at - hit, dur, 397.2 + j, 0.16 - j * 0.015), -0.04 + j * 0.025);
  }

  // Viewer settling into seat: felt compression and a small wooden frame response.
  add(clothDrag(at - 130.08, 0.52, 401.2, 0.17), 0);
  add(woodCreak(at - 130.35, 0.36, 402.3, 0.12), 0.02);

  // Backdrop roller knocks and cloth unrolling: separated physical events.
  for (const [j, hit] of [134.0,135.5,137.0,138.5].entries()) {
    add(ceramicImpact(at - hit, 150 - j * 8, 404.2 + j, 0.035), 0);
    add(clothDrag(at - hit - 0.08, 0.42, 405.3 + j, 0.11), 0.02);
  }

  // Miniature recap props: tiny wood, paper, and ceramic handling at intimate scale.
  for (const [j, hit] of [133.25,134.15,135.35,136.55,137.75].entries()) {
    add(j % 2 ? paperRustle(at - hit, 0.08, 408.2 + j, 0.07) : plasticKnock(at - hit, 210 + j * 12, 409.3 + j, 0.024), (hash01(j, 410.4) - 0.5) * 0.32);
  }

  // Puppet chase: small soft foot taps and fabric swipes; handmade, close, and not cute.
  for (const [j, hit] of [139.10,139.42,139.78,140.15,140.48,140.86,141.18].entries()) {
    add(softImpact(at - hit, 64 + hash01(j, 412.2) * 18, 413.3 + j, 0.028), (hash01(j, 414.4) - 0.5) * 0.38);
  }
  for (const [j, hit] of [139.32,140.32,141.05].entries()) {
    add(clothDrag(at - hit, 0.18, 416.2 + j, 0.10), (j - 1) * 0.16);
  }

  // Lint armrest landing: soft felt weight only. No warm chirp voice.
  add(clothDrag(at - 141.52, 0.36, 418.2, 0.14), 0.36);
  add(softImpact(at - 141.66, 58, 419.3, 0.035), 0.34);

  // Viewer follows: carpet then hollow wooden stage steps.
  for (let i = 0; i < 8; i++) {
    const hit = 143.5 + i * 0.46;
    const wood = hit > 145.7;
    if (wood) add(ceramicImpact(at - hit, 150 + i * 4, 421.2 + i, 0.040), i % 2 ? 0.08 : -0.08);
    else add(carpetStep(at - hit, 422.3 + i, 0.070), i % 2 ? 0.08 : -0.08);
  }

  // Backstage hand-built mechanics: sparse wooden pegs and small metal escapement contacts.
  for (const [j, hit] of [145.2,146.1,146.8,147.7,148.4].entries()) {
    add(j % 2 ? clockTick(at - hit, 425.2 + j, 0.035) : plasticKnock(at - hit, 190 + j * 14, 426.3 + j, 0.032), (hash01(j, 427.4) - 0.5) * 0.55);
  }

  // Exit door compressed felt/fabric/wood push, in separated strains with air.
  for (const [j, hit, dur] of [[0,147.35,0.46],[1,148.20,0.40],[2,149.05,0.52]] as const) {
    add(clothDrag(at - hit, dur, 430.2 + j, 0.14 + j * 0.02), 0);
    add(woodCreak(at - hit - 0.04, dur * 0.8, 431.3 + j, 0.13), 0);
  }

  // Cathedral pressure precue: two separated low air swells, not an organ chord.
  for (const [j, hit] of [148.8,149.75].entries()) {
    const u = at - hit;
    if (u > 0 && u < 0.42) {
      const envp = Math.sin(Math.PI * u / 0.42) ** 2;
      add(Math.sin(u * Math.PI * 2 * (38 + j * 5)) * 0.010 * envp, 0);
    }
  }

  return [l, r];
}), z6TheatreRoom);


// Z7 vending-cathedral redesign: monumental mass through sparse physical events and
// long stone convolution tails. No compressor-organ drone, noise-wall chase, electronic
// phone, tonal fall sweep, or white-noise wind bed. Exact replay remains in its own stem.
const z7NaveRoom: RoomOptions = { size: 2.35, decaySec: 3.4, dampingHz: 1250, predelayMs: 22, earlyDb: -9, tailDb: -12, dryDb: -1 };
wavRoom('z7_cathedral_events.wav', stem(45.8, (t) => {
  const at = t + 149.5;
  const si = Math.floor(t * SR + 0.5);
  let l = 0, r = 0;
  const add = (v: number, pan = 0) => {
    const a = (pan + 1) * Math.PI / 4;
    l += v * Math.cos(a);
    r += v * Math.sin(a);
  };

  // Vast nave pressure as rare structural contacts; silence remains the default.
  for (const [j, hit] of [150.4,156.8,162.4,166.9].entries()) {
    add(naveMassHit(at - hit, 54 + j * 4, 450.2 + j, 0.055), 0);
  }

  // Far coin drops: small metal physical impacts whose length comes from the nave.
  for (const [j, hit] of [151.4,154.8,156.7].entries()) {
    add(glassShard(at - hit, 920 + j * 90, 454.2 + j, 0.11), -0.18 + j * 0.11);
  }

  // Machine wake as a row-by-row relay wave. Each relay has a short compressor-pressure
  // swell that decays instead of joining a constant organ bed.
  for (let i = 0; i < 17; i++) {
    const hit = 154 + i * 0.18;
    const pan = -0.55 + i * 0.065;
    add(naveMassHit(at - hit, 105 + i * 4, 458.2 + i, 0.075), pan);
  }

  // Close machine detail: sparse shell contact and product-glass ticks.
  for (const [j, hit] of [158.2,159.4,160.9,162.1].entries()) {
    add(naveMassHit(at - hit, 115 + j * 7, 464.2 + j, 0.035), -0.35);
    add(glassShard(at - hit - 0.18, 1250 + j * 110, 465.3 + j, 0.020), -0.32);
  }

  // Beige phone muffled behind vending glass: mechanical bell strikes, boxy and distant.
  for (let k = 0; k < 18; k++) {
    const hit = 160.12 + k * 0.052 + (hash01(k, 468.2) - 0.5) * 0.006;
    add(muffledBellStrike(at - hit, k % 2 ? 470 : 392, 469.3 + k, 0.030), -0.42);
  }

  // Product drop cascade converging center: sparse discrete balls, tile, paper, felt, coils.
  const productTimes = [163.05,163.22,163.48,163.70,163.91,164.08,164.25,164.43,164.62,164.82,165.03,165.22];
  for (const [j, hit] of productTimes.entries()) {
    const pan = (hash01(j, 472.2) - 0.5) * (0.9 - j * 0.045);
    const kind = j % 4;
    if (kind === 0) add(plasticKnock(at - hit, 185 + hash01(j, 473.2) * 90, 474.3 + j, 0.070), pan);
    else if (kind === 1) add(naveMassHit(at - hit, 180 + hash01(j, 475.2) * 80, 476.3 + j, 0.060), pan);
    else if (kind === 2) add(paperRustle(at - hit, 0.10, 477.3 + j, 0.13), pan);
    else add(naveMassHit(at - hit, 150 + hash01(j, 478.2) * 80, 479.3 + j, 0.050), pan);
  }

  // Tenant assembly: material snaps and coil extension. Sharp enough to read as construction,
  // but never a screech/noise burst.
  for (const [j, hit, pan] of [[0,163.35,-0.18],[1,163.78,0.12],[2,164.20,-0.08],[3,164.59,0.05],[4,164.92,0]] as const) {
    add(plasticKnock(at - hit, 160 + j * 28, 482.2 + j, 0.085), pan);
    if (j > 1) add(naveMassHit(at - hit - 0.04, 150 + j * 30, 483.3 + j, 0.065), pan);
  }
  add(paperTear(at - 164.35, 0.45, 486.2, 0.16), 0);
  add(woodCreak(at - 164.72, 0.42, 487.3, 0.20), 0);

  // Huge hollow material inhalation: intermittent pressure/material resonance, not voice.
  for (const [j, hit] of [166.55,168.85,171.15].entries()) {
    const u = at - hit;
    if (u > 0 && u < 1.05) {
      const e = Math.sin(Math.PI * u / 1.05) ** 1.35;
      add((coloredNoise(si, 490.2 + j, 61) * 0.010) * e, 0);
    }
  }

  // Chase: close stone running steps, heavy machine-off relays behind, and uneven composite
  // Tenant contacts. Dense at the peak, but every sound is a discrete physical event.
  for (let i = 0; i < 18; i++) {
    const hit = 168 + i * 0.38 + (hash01(i, 493.2) - 0.5) * 0.045;
    if (hit < 173.35) add(stoneStep(at - hit, 494.2 + i, 0.085 + hash01(i, 495.3) * 0.035), i % 2 ? 0.10 : -0.10);
  }
  for (let i = 0; i < 11; i++) {
    const hit = 168.2 + i * 0.48;
    add(naveMassHit(at - hit, 82 + i * 2, 498.2 + i, 0.070), -0.30 + i * 0.055);
  }
  for (let i = 0; i < 14; i++) {
    const hit = 168.15 + i * 0.50 + (hash01(i, 501.2) - 0.5) * 0.08;
    const pan = (hash01(i, 502.3) - 0.5) * 0.34;
    if (i % 3 === 0) add(plasticKnock(at - hit, 180 + hash01(i, 503.4) * 90, 504.5 + i, 0.060), pan);
    else if (i % 3 === 1) add(naveMassHit(at - hit, 175 + hash01(i, 505.4) * 70, 506.5 + i, 0.050), pan);
    else add(paperRustle(at - hit, 0.12, 507.5 + i, 0.14), pan);
  }

  // Dead flashlight switch clicks, then Lint's small soft relight flutter.
  for (const [j, hit] of [173.38,173.72].entries()) add(clockTick(at - hit, 510.2 + j, 0.070), 0);
  add(clothDrag(at - 174.05, 0.45, 512.2, 0.16), 0.12);
  if (at >= 174.35 && at < 174.95) {
    const u = at - 174.35;
    add(Math.sin(u * Math.PI * 2 * 118) * 0.005 * Math.sin(Math.PI * u / 0.60) ** 2, 0.12);
  }

  // Tenant recoil: grounded material recoil/scrape, not a tonal shriek or noise blast.
  add(wetScrape(at - 174.72, 0.68, 515.2, 0.18), -0.10);
  add(paperTear(at - 174.92, 0.52, 516.3, 0.16), -0.08);

  // Floor rift fracture: low stone displacement and discrete granular rock impacts.
  for (const [j, hit] of [176.0,176.45,177.1,178.0,179.2].entries()) {
    add(naveMassHit(at - hit, 58 + j * 5, 519.2 + j, 0.16 + j * 0.018), -0.15 + j * 0.08);
    add(naveMassHit(at - hit - 0.08, 165 + j * 15, 520.3 + j, 0.07), -0.2 + j * 0.1);
  }
  for (let i = 0; i < 6; i++) {
    const hit = 176.25 + i * 0.23 + hash01(i, 523.2) * 0.05;
    add(naveMassHit(at - hit, 190 + hash01(i, 524.3) * 120, 525.4 + i, 0.022), (hash01(i, 526.5) - 0.5) * 0.8);
  }

  // Vending-machine topples: separated shell impacts, glass shards, long nave tails.
  for (const [j, hit, pan] of [[0,176.4,-0.45],[1,178.1,0.42],[2,180.0,-0.36],[3,182.2,0.38],[4,184.4,-0.28]] as const) {
    add(naveMassHit(at - hit, 72 + j * 4, 529.2 + j, 0.26), pan);
    add(plasticKnock(at - hit - 0.05, 120 + j * 12, 530.3 + j, 0.13), pan);
    for (let k = 0; k < 2; k++) add(glassShard(at - hit - 0.10 - k * 0.055, 1050 + hash01(k + j * 7, 531.4) * 900, 532.5 + j * 5 + k, 0.045), pan + (hash01(k, 533.6) - 0.5) * 0.5);
  }

  // Rift widening: additional massed mechanical/stone events instead of a flat roar shelf.
  for (let i = 0; i < 6; i++) {
    const hit = 180.15 + i * 0.34 + (hash01(i, 536.2) - 0.5) * 0.07;
    const pan = (hash01(i, 537.3) - 0.5) * 0.85;
    add(i % 2 ? naveMassHit(at - hit, 150 + hash01(i, 538.4) * 90, 539.5 + i, 0.048) : naveMassHit(at - hit, 85 + hash01(i, 540.4) * 35, 541.5 + i, 0.060), pan);
  }

  // Fall: short separated dark air swells, never a continuous white-noise wall.
  for (const [j, hit] of [186.0,186.9,188.1,189.4,190.7].entries()) {
    const u = at - hit;
    if (u > 0 && u < 0.62) {
      const envf = Math.sin(Math.PI * u / 0.62) ** 1.8;
      const air = coloredNoise(si, 545.2 + j, 127) * envf * 0.011;
      add(air, Math.sin((hit - 186) * 1.3) * 0.42);
    }
  }
  for (let i = 0; i < 8; i++) {
    const hit = 186.12 + i * 0.25 + (hash01(i, 548.2) - 0.5) * 0.08;
    const pan = (hash01(i, 549.3) - 0.5) * 1.1 + Math.sin((at - 186) * Math.PI * 2 / 6) * 0.20;
    if (i % 3 === 0) add(naveMassHit(at - hit, 135 + hash01(i, 550.4) * 90, 551.5 + i, 0.070), pan);
    else if (i % 3 === 1) add(glassShard(at - hit, 950 + hash01(i, 552.4) * 850, 553.5 + i, 0.050), pan);
    else add(naveMassHit(at - hit, 170 + hash01(i, 554.4) * 100, 555.5 + i, 0.050), pan);
  }

  // Descending warmth as separated pressure swells, not a musical falling tone.
  for (const [j, hit] of [188.2,189.6,190.8].entries()) {
    const u = at - hit;
    if (u > 0 && u < 0.72) add((coloredNoise(si, 558.2 + j, 79) * 0.008) * Math.sin(Math.PI * u / 0.72) ** 2, 0);
  }

  // Warm carpet landing and first domestic clock precue; no bird chirps.
  add(carpetStep(at - 192.02, 561.2, 0.22), 0);
  add(clothDrag(at - 192.12, 0.52, 562.3, 0.16), 0);

  return [l, r];
}), z7NaveRoom);


// Z8 homecoming and END redesign: warm domestic near-silence, small physical details,
// and the exact bell-phone language returning home. No birds, mower loop, fluorescent
// drone, continuous kettle noise, electronic ring imitation, or closure music.
const z8HomeRoom: RoomOptions = { size: 0.68, decaySec: 0.48, dampingHz: 2100, predelayMs: 8, earlyDb: -14, tailDb: -15, dryDb: 0 };
const z8ExactPhone = renderBellPhone(4.8, SR);
const endExactPhone = renderBellPhone(2.8, SR);
wavRoom('z8_home_events.wav', stem(30.8, (t) => {
  const at = t + 194.4;
  const si = Math.floor(t * SR + 0.5);
  let l = 0, r = 0;
  const add = (v: number, pan = 0) => {
    const a = (pan + 1) * Math.PI / 4;
    l += v * Math.cos(a);
    r += v * Math.sin(a);
  };
  const addStereo = (vl: number, vr: number) => { l += vl; r += vr; };
  const addPhone = (start: number, gain: number) => {
    const pi = Math.floor((at - start) * SR + 0.5);
    if (pi >= 0 && pi * 2 + 1 < z8ExactPhone.length) addStereo(z8ExactPhone[pi * 2]! * gain, z8ExactPhone[pi * 2 + 1]! * gain * 0.94);
  };

  // Domestic clock as tiny mechanical tooth noise; sparse enough to preserve silence.
  for (const [j, hit] of [195.25,196.25,197.25,198.25,199.25,200.25,201.25,202.25,203.25,204.25,205.25].entries()) {
    add(clockTick(at - hit, 570.2 + j, 0.014), 0.30);
  }

  // Slow warm-wood/rug walk. Steps are separated contacts, with occasional floor stress.
  for (let i = 0; i < 34; i++) {
    const hit = 195.2 + i * 0.76 + (hash01(i, 573.2) - 0.5) * 0.08;
    if (hit > 222.0) break;
    const rug = i % 5 === 2 || i % 5 === 3;
    const pan = i % 2 ? 0.08 : -0.08;
    if (rug) add(carpetStep(at - hit, 574.3 + i, 0.045), pan);
    else add(naveMassHit(at - hit, 104 + hash01(i, 575.4) * 24, 576.5 + i, 0.026), pan);
    if (i % 7 === 4) add(woodCreak(at - hit - 0.04, 0.20, 577.6 + i, 0.035), pan);
  }

  // Nearly subliminal photo-frame glass ticks.
  for (const [j, hit] of [199.3,201.1,202.6].entries()) add(glassShard(at - hit, 1500 + j * 130, 580.2 + j, 0.009), -0.32);

  // Kettle restraint: separated small bubbles and pressure swells, then a brief physical
  // whistle thread that cuts dead. It never becomes a continuous noise bed.
  for (const [j, hit] of [201.4,204.0,207.2,210.1,212.6].entries()) {
    add(waterDrop(at - hit, 145 + j * 8, 583.2 + j, 0.020), 0.34);
    const u = at - hit - 0.18;
    if (u > 0 && u < 0.42) add(coloredNoise(si, 584.3 + j, 73) * Math.sin(Math.PI * u / 0.42) ** 2 * 0.007, 0.34);
  }
  if (at >= 213.45 && at < 214.0) {
    const u = at - 213.45;
    const e = Math.sin(Math.PI * u / 0.55) ** 1.4;
    add((Math.sin(u * Math.PI * 2 * (720 + u * 80)) * 0.006 + coloredNoise(si, 588.2, 31) * 0.006) * e, 0.34);
  }

  // The wall-phone payoff: the same generated mechanical twin-bell object as z1, now close
  // in the small domestic room. One full burst, then true silence before the receiver lifts.
  addPhone(206.0, 0.34);

  // Receiver lifts by itself: hollow plastic contact, hook click, curled-cord tension.
  add(plasticKnock(at - 210.02, 260, 591.2, 0.075), 0.34);
  add(clockTick(at - 210.22, 592.3, 0.060), 0.34);
  add(clothDrag(at - 210.82, 0.58, 593.4, 0.11), 0.33);
  for (const [j, hit] of [211.55,212.35,213.12].entries()) add(plasticKnock(at - hit, 220 - j * 18, 594.5 + j, 0.025), 0.33);

  // Front-door handle rotates slowly: small latch contacts and wood stress, no voice.
  for (const [j, hit] of [214.10,214.55,215.05,215.55].entries()) {
    add(clockTick(at - hit, 597.2 + j, 0.050), 0.32);
    if (j === 2) add(woodCreak(at - hit - 0.03, 0.28, 598.3 + j, 0.10), 0.32);
  }

  // Wooden front door opens into the office return: dry hinge stress, then restrained air.
  add(woodCreak(at - 217.55, 1.15, 601.2, 0.28), 0.18);
  add(naveMassHit(at - 218.65, 88, 602.3, 0.050), 0.12);

  // The office phone returns once at the threshold, recognizably the same bell mechanism.
  addPhone(218.0, 0.22);

  // Threshold steps cross from wood/rug into damp office carpet.
  for (let i = 0; i < 6; i++) {
    const hit = 222.0 + i * 0.48;
    add(carpetStep(at - hit, 606.2 + i, 0.055 + i * 0.004), i % 2 ? 0.08 : -0.08);
  }
  return [l, r];
}), z8HomeRoom);

wavRoom('end_office_events.wav', stem(10.0, (t) => {
  const at = t + 225;
  let l = 0, r = 0;
  const addStereo = (vl: number, vr: number) => { l += vl; r += vr; };
  const addEndPhone = (start: number, gain: number) => {
    const pi = Math.floor((at - start) * SR + 0.5);
    if (pi >= 0 && pi * 2 + 1 < endExactPhone.length) addStereo(endExactPhone[pi * 2]! * gain, endExactPhone[pi * 2 + 1]! * gain * 0.92);
  };
  // END is almost nothing: one return ring, one distant repetition, then room silence.
  addEndPhone(225.15, 0.16);
  addEndPhone(230.55, 0.085);
  const endFade = 1 - smoothstep(231.15, 235, at);
  return [l * endFade, r * endFade];
}), { ...z1OfficeRoom, decaySec: 0.82, tailDb: -13, earlyDb: -16 });

// Transition-specific sound continuity. These short cues bind the material handoffs together;
// zone beds underneath already crossfade, so these stems carry only the physical seam events.
wavRoom('t2_plastic_to_water.wav', stem(1.4, (t) => {
  // Playroom shells give way to pool water as discrete material contacts.
  let v = 0;
  for (const [j, at] of [0.10,0.28,0.46].entries()) v += plasticKnock(t - at, 240 - j * 28, 626.2 + j, 0.055) * (1 - t / 1.3);
  v += waterDrop(t - 0.62, 155, 629.2, 0.12);
  v += waterDrop(t - 0.92, 132, 630.3, 0.10);
  v += waterDisplace(t - 1.02, 631.4, 0.09, 105);
  return [v, v * 0.82];
}), { size: 1.35, decaySec: 1.35, dampingHz: 1500, predelayMs: 13, earlyDb: -10, tailDb: -9, dryDb: -1 });

wavRoom('t3_ink_to_paper.wav', stem(1.6, (t) => {
  // Submerged pressure dries into the first paper fibres; no tonal dive or noise sweep.
  let v = waterDisplace(t - 0.04, 634.2, 0.10, 96) * Math.max(0, 1 - t / 0.85);
  v += waterDrop(t - 0.42, 128, 635.3, 0.075);
  v += paperRustle(t - 0.82, 0.24, 636.4, 0.16);
  v += paperRustle(t - 1.10, 0.18, 637.5, 0.13);
  v += paperTear(t - 1.25, 0.22, 638.6, 0.055);
  return [v * 0.92, v];
}), { size: 0.9, decaySec: 0.72, dampingHz: 1700, predelayMs: 9, earlyDb: -13, tailDb: -13, dryDb: 0 });

wavRoom('t4_page_slam_neon.wav', stem(1.0, (t) => {
  // Paper mass slams to true-black silence; two small exterior relay contacts re-open the motel.
  let v = paperSlam(t - 0.105, 641.2, 0.25, 0.5);
  v += paperRustle(t - 0.01, 0.12, 642.3, 0.10);
  // 0.12-0.20 remains deliberately empty under the exact master mute.
  v += clockTick(t - 0.24, 643.4, 0.045);
  v += clockTick(t - 0.43, 644.5, 0.035);
  if (t > 0.57 && t < 0.86) {
    const u = t - 0.57;
    v += coloredNoise(Math.floor(t * SR + 0.5), 645.6, 57) * Math.sin(Math.PI * u / 0.29) ** 2 * 0.008;
  }
  return [v, v * 0.9];
}), { size: 0.85, decaySec: 0.58, dampingHz: 1550, predelayMs: 8, earlyDb: -13, tailDb: -13, dryDb: 0 });

wavRoom('t5_static_to_felt.wav', stem(1.4, (t) => {
  // The motel TV collapses into handmade felt: small-speaker fragment, then cloth absorption.
  let v = 0;
  const tv = z5FinalTv[1]!;
  const idx = Math.floor((t - 0.03) * SR + 0.5);
  if (idx >= 0 && idx * 2 + 1 < tv.length) v += (tv[idx * 2]! + tv[idx * 2 + 1]!) * 0.5 * 0.30 * Math.max(0, 1 - t / 0.55);
  v += clothDrag(t - 0.48, 0.52, 648.2, 0.18);
  v += clothDrag(t - 0.82, 0.36, 649.3, 0.13);
  v += carpetStep(t - 1.02, 650.4, 0.055);
  return [v * 0.86, v];
}), { size: 0.72, decaySec: 0.44, dampingHz: 1250, predelayMs: 7, earlyDb: -17, tailDb: -17, dryDb: 0 });

wav('t6_felt_door_push.wav', stem(1.2, (t) => {
  let v = 0;
  v += clothDrag(t, 0.58, 440.2, 0.20);
  v += woodCreak(t - 0.08, 0.52, 441.3, 0.22);
  const u = t - 0.42;
  if (u > 0 && u < 0.30) v += impactStrike(u, 105, 442.4, 0.16);
  return [v, v * 0.74];
}));

wav('t7_lightfall_home.wav', stem(1.4, (t) => {
  // Lightfall resolves into home through material, not a descending synth whistle:
  // falling grit passes overhead, then cloth and warm wood arrive close.
  let v = 0;
  for (const [i, at] of [0.08,0.31,0.56].entries()) {
    const u = t - at;
    if (u > 0 && u < 0.18) v += glassShard(u, 760 + i * 130, 612.2 + i, 0.020);
  }
  v += clothDrag(t - 0.58, 0.42, 615.2, 0.12);
  v += carpetStep(t - 0.86, 616.3, 0.10);
  v += woodCreak(t - 1.02, 0.28, 617.4, 0.08);
  return [v * 0.9, v];
}));

// Full-timeline room-tone beds. These are architectural continuity layers, not final creature/cue passes:
// every zone has a distinct physical space tone and edge fades overlap the engine transition windows.
function edgeFade(t: number, dur: number, fadeIn: number, fadeOut: number): number {
  return Math.max(0, Math.min(1, t / fadeIn, (dur - t) / fadeOut));
}
function bed(file: string, dur: number, fadeIn: number, fadeOut: number, fn: (t: number, lp: () => number) => [number, number], widthMod: (t: number) => number = () => 1): void {
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
    const wm = widthMod(t);
    return [(bl + airL * 0.035 * wm) * e, (br + airR * 0.035 * wm) * e];
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
  // Padded plastic rooms are acoustically dead: only deep building air and two tiny
  // ball-settling events remain. No continuous static, birds, or cute loop.
  const deepAir = lp() * 0.0045;
  let settle = 0;
  for (const [j, at] of [9.4, 18.7].entries()) {
    const u = t - at;
    if (u > 0 && u < 0.18) settle += coloredNoise(Math.floor(t * SR), 190.2 + j, 19) * 0.012 * Math.exp(-u * 24);
  }
  const v = deepAir + settle;
  return [v * 0.92, v];
});

bed('z3_pool_room_tone.wav', 26.0, 0.75, 1.1, (t, lp) => {
  // Tiled water space is not a hiss bed: only deep building pressure and two tiny settling laps.
  const deepAir = lp() * 0.0015;
  const waterMass = Math.sin(t * Math.PI * 2 * 0.43) * 0.0003;
  let settle = 0;
  for (const [j, at] of [9.8, 20.6].entries()) {
    const u = t - at;
    if (u > 0 && u < 0.32) settle += coloredNoise(Math.floor(t * SR), 241.2 + j, 27) * 0.003 * Math.exp(-u * 16);
  }
  const v = deepAir + waterMass + settle;
  return [v * 0.9, v];
});

bed('z4_library_room_tone.wav', 25.9, 0.9, 0.75, (t, lp) => {
  // Paper absorbs nearly everything: faint building pressure only, no constant lamp/hiss bed.
  const hush = lp() * 0.0016;
  let settle = 0;
  for (const [j, at] of [6.8, 17.4].entries()) {
    const u = t - at;
    if (u > 0 && u < 0.14) settle += paperRustle(u, 0.14, 305.2 + j, 0.018);
  }
  const v = hush + settle;
  return [v * 0.9, v];
});

bed('z5_motel_room_tone.wav', 25.9, 0.55, 1.0, (t, lp) => {
  // Exterior rain is pressure against the building, not a hiss/static bed. The weak neon
  // appears only as two short unstable swells with silence around them.
  const rainPressure = lp() * 0.016 * (0.65 + 0.35 * slowNoise01(t, 350.2, 0.7));
  let neon = 0;
  for (const [j, at] of [6.4, 18.2].entries()) {
    const u = t - at;
    if (u > 0 && u < 0.75) neon += Math.sin(u * Math.PI * 2 * (118 + j * 2)) * 0.0085 * Math.sin(Math.PI * u / 0.75) ** 2;
  }
  const v = rainPressure + neon;
  return [v, v * 0.9];
});

bed('z6_theatre_room_tone.wav', 21.1, 0.95, 0.9, (t, lp) => {
  // Felt swallows the room: almost no continuous air, only two tiny settling cloth noises.
  const feltAir = lp() * 0.0014;
  let settle = 0;
  for (const [j, at] of [6.8, 15.9].entries()) {
    const u = t - at;
    if (u > 0 && u < 0.16) settle += clothDrag(u, 0.16, 435.2 + j, 0.014);
  }
  const v = feltAir + settle;
  return [v * 0.86, v];
});

bed('z7_cathedral_room_tone.wav', 46.1, 0.8, 1.1, (t, lp) => {
  // Monumental air pressure in sparse wandering swells; no continuous fan/hum drone.
  const deep = lp() * 0.0022;
  let swell = 0;
  for (const [j, at] of [5.8, 18.4, 31.2, 40.6].entries()) {
    const u = t - at;
    if (u > 0 && u < 1.25) swell += (Math.sin(u * Math.PI * 2 * (34 + j * 3)) * 0.0035 + lp() * 0.003) * Math.sin(Math.PI * u / 1.25) ** 2;
  }
  const v = deep + swell;
  return [v, v * 0.88];
});

bed('z8_home_room_tone.wav', 30.6, 0.8, 1.8, (t, lp) => {
  // Warm domestic air is almost silent: no hum, birds, mower, kettle bed, or static.
  const room = lp() * 0.0012;
  let settling = 0;
  for (const [j, at] of [7.4, 18.9].entries()) {
    const u = t - at;
    if (u > 0 && u < 0.16) settling += clothDrag(u, 0.16, 620.2 + j, 0.010);
  }
  const v = room + settling;
  return [v * 0.94, v];
});

bed('end_office_afterimage_tone.wav', 10.0, 0.4, 2.4, (t, lp) => {
  // END is almost nothing: a trace of dark office air decaying toward silence.
  const endFade = 1 - smoothstep(6.1, 10.0, t);
  const v = lp() * 0.00045 * endFade;
  return [v, v * 0.94];
}, (t) => 1 - smoothstep(9.15, 10.0, t));

console.log(`wrote procedural THRESHOLD stems to ${OUT}`);
