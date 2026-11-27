#!/usr/bin/env bun
// Procedural THRESHOLD Z1 sound-stem generator. All source audio is synthesized here;
// generated WAVs are evidence/build products and are never committed.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { coloredNoise, impactStrike, musicBoxTine, plasticKnock, ceramicImpact, carpetStep, clockTick, crtSpeakerBurst, paperRustle, paperTear, paperSlam, woodCreak, bodyCough, waterDrop, waterDisplace, wetScrape, muffledBellStrike, renderBellPhone, renderCrtProgram, renderConvolutionRoom, slowNoise01, softImpact, tileClatter, type RoomOptions } from './threshold_audio_lib';

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
  add(paperTear(at - 120.48, 0.62, 332.2, 0.24), -0.04);
  add(plasticKnock(at - 120.82, 170, 333.3, 0.11), 0.05);
  add(ceramicImpact(at - 121.04, 190, 334.4, 0.09), -0.03);
  add(woodCreak(at - 121.12, 0.46, 335.5, 0.28), 0);

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
 if(at>=150&&at<176){const breath=Math.min(0.005+0.995*((1-smoothstep(150.25,150.55,at))+smoothstep(152.0,152.3,at)),0.005+0.995*((1-smoothstep(165.62,165.85,at))+smoothstep(166.55,166.85,at)));add((z7lp*.016+Math.sin(at*Math.PI*2*38)*.005)*breath,0)}
 if(at>=154&&at<173.35){const sw=smoothstep(154,158,at);const off=at<168.2?0:Math.max(0,Math.min(15,Math.floor((at-168.2)/.48)+1));const subtract=1-off*.045;const revealBreath=0.005+0.995*((1-smoothstep(165.62,165.85,at))+smoothstep(166.55,166.85,at));for(let row=0;row<8;row++){const hz=54+row*7+hash01(row,31)*3;const pan=-.52+row*.15;const rowWake=smoothstep(154+row*.28,157.2+row*.28,at);add((Math.sin(at*Math.PI*2*hz)*.010+Math.sin(at*Math.PI*2*hz*1.5)*.004)*sw*rowWake*subtract*revealBreath,pan)}}
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
}, (t) => 1 - smoothstep(9.15, 10.0, t));

console.log(`wrote procedural THRESHOLD stems to ${OUT}`);
