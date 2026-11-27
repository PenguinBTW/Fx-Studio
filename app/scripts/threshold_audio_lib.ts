import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Deterministic procedural acoustics and physical-voice primitives for THRESHOLD.
// Offline Float32 DSP only: no Math.random, no sampled/audio-file dependencies.

export interface RoomOptions {
  /** Room scale multiplier for reflection and tail delay lengths. */
  size?: number;
  /** Seconds for the tail to decay by roughly 60 dB. */
  decaySec?: number;
  /** Feedback damping low-pass cutoff in Hz. Lower is darker. */
  dampingHz?: number;
  /** Pre-delay before the reverberant tail, milliseconds. */
  predelayMs?: number;
  /** Early reflection level in dB relative to source. */
  earlyDb?: number;
  /** Feedback tail level in dB relative to source. */
  tailDb?: number;
  /** Dry level in dB. */
  dryDb?: number;
}

const db = (x: number) => Math.pow(10, x / 20);

const hash01 = (n: number, salt: number) => {
  const x = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Smoothly interpolated deterministic control noise, for organic slow envelope variation. */
export function slowNoise01(t: number, seed: number, rate = 3): number {
  const x = Math.max(0, t * rate);
  const i = Math.floor(x);
  const u = x - i;
  const sm = u * u * (3 - 2 * u);
  return hash01(i, seed) * (1 - sm) + hash01(i + 1, seed) * sm;
}



function writeWavF32(file: string, pcm: Float32Array, sampleRate: number): void {
  const n = pcm.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20);
  buf.writeUInt16LE(2, 22); buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 8, 28);
  buf.writeUInt16LE(8, 32); buf.writeUInt16LE(32, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) buf.writeFloatLE(pcm[i]!, 44 + i * 4);
  writeFileSync(file, buf);
}

function diffuseIr(sampleRate: number, options: RoomOptions): Float32Array {
  const size = options.size ?? 1;
  const decaySec = options.decaySec ?? 1.1;
  const dampingHz = options.dampingHz ?? 2100;
  const predelayMs = options.predelayMs ?? 9;
  const frames = Math.max(256, Math.round(decaySec * sampleRate));
  const ir = new Float32Array(frames * 2);
  const diffuseStart = Math.min(frames - 8, Math.round((predelayMs + 28 * size) * sampleRate / 1000));
  const tailSpan = Math.max(1, frames - diffuseStart);
  let seedL = 0x51f15e;
  let seedR = 0x9e3779;
  let lpL1 = 0, lpL2 = 0, lpR1 = 0, lpR2 = 0;
  const nextL = () => ((seedL = (seedL * 1664525 + 1013904223) >>> 0) / 0xffffffff) * 2 - 1;
  const nextR = () => ((seedR = (seedR * 1664525 + 1013904223) >>> 0) / 0xffffffff) * 2 - 1;
  const baseAlpha = Math.max(0.025, Math.min(0.28, dampingHz / 11500));
  for (let f = diffuseStart; f < frames; f++) {
    const k = (f - diffuseStart) / tailSpan;
    const alpha = baseAlpha * (1 - k * 0.68) + 0.012;
    const env = Math.exp(-6.907755 * (f - diffuseStart) / tailSpan);
    lpL1 += alpha * (nextL() - lpL1);
    lpL2 += alpha * (lpL1 - lpL2);
    lpR1 += alpha * (nextR() - lpR1);
    lpR2 += alpha * (lpR1 - lpR2);
    const density = Math.min(1, Math.pow(Math.max(0, k) / 0.16, 0.72));
    const bloom = Math.sqrt(density) * Math.min(1, k / 0.055);
    ir[f * 2] = (hash01(f, 3.1) < density ? lpL2 : 0) * env * bloom;
    ir[f * 2 + 1] = (hash01(f, 9.7) < density ? lpR2 : 0) * env * bloom;
  }
  // Unit-energy tail: wet gain then means what it says independent of room length.
  let eL = 1e-12, eR = 1e-12;
  for (let f = 0; f < frames; f++) { eL += ir[f * 2]! ** 2; eR += ir[f * 2 + 1]! ** 2; }
  const nL = 1 / Math.sqrt(eL), nR = 1 / Math.sqrt(eR);
  for (let f = 0; f < frames; f++) { ir[f * 2] *= nL; ir[f * 2 + 1] *= nR; }
  return ir;
}

/**
 * Natural diffuse room renderer. Sparse early reflections are generated in TS;
 * the dense late field is deterministic convolution with a generated, darkening
 * noise impulse response using ffmpeg's optimized partitioned convolution.
 */
export function renderConvolutionRoom(input: Float32Array, sampleRate = 48000, options: RoomOptions = {}): Float32Array {
  const size = options.size ?? 1;
  const earlyGain = db(options.earlyDb ?? -19);
  const tailGain = db(options.tailDb ?? -15);
  const dryGain = db(options.dryDb ?? 0);
  const frames = Math.floor(input.length / 2);
  const ir = diffuseIr(sampleRate, options);
  const irFrames = Math.floor(ir.length / 2);
  const outFrames = frames + irFrames;
  const out = new Float32Array(outFrames * 2);
  const paddedInput = new Float32Array(outFrames * 2);
  paddedInput.set(input);

  const earlyTaps = [13.7, 21.9, 31.7, 47.3, 67.9].map((x) => Math.max(1, Math.round(x * size * sampleRate / 1000)));
  const earlyGains = [0.56, 0.42, 0.31, 0.22, 0.15];
  const earlyPans = [-0.55, 0.48, -0.25, 0.34, -0.12];
  for (let f = 0; f < frames; f++) {
    const dryL = input[f * 2] ?? 0;
    const dryR = input[f * 2 + 1] ?? 0;
    let wetL = 0, wetR = 0;
    for (let tap = 0; tap < earlyTaps.length; tap++) {
      const d = earlyTaps[tap]!;
      if (f >= d) {
        const mono = ((input[(f - d) * 2] ?? 0) + (input[(f - d) * 2 + 1] ?? 0)) * 0.5;
        const pan = earlyPans[tap]!;
        const a = (pan + 1) * Math.PI / 4;
        wetL += mono * Math.cos(a) * earlyGains[tap]! * earlyGain;
        wetR += mono * Math.sin(a) * earlyGains[tap]! * earlyGain;
      }
    }
    out[f * 2] = dryL * dryGain + wetL;
    out[f * 2 + 1] = dryR * dryGain + wetR;
  }

  const tmp = mkdtempSync(path.join(tmpdir(), 'threshold-room-'));
  try {
    const inWav = path.join(tmp, 'in.wav');
    const irWav = path.join(tmp, 'ir.wav');
    const rawOut = path.join(tmp, 'wet.f32');
    writeWavF32(inWav, paddedInput, sampleRate);
    writeWavF32(irWav, ir, sampleRate);
    execFileSync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', inWav, '-i', irWav,
      '-filter_complex', '[0:a][1:a]afir=dry=1:wet=1:gtype=none:irfmt=input[a]',
      '-map', '[a]', '-f', 'f32le', '-ac', '2', '-ar', String(sampleRate), rawOut,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    const raw = readFileSync(rawOut);
    const wet = new Float32Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 4));
    const n = Math.min(outFrames, Math.floor(wet.length / 2));
    const hpAlpha = 1 - Math.exp(-2 * Math.PI * 105 / sampleRate);
    let hpLpL = 0, hpLpR = 0;
    for (let f = 0; f < n; f++) {
      const rawL = wet[f * 2]!;
      const rawR = wet[f * 2 + 1]!;
      hpLpL += hpAlpha * (rawL - hpLpL);
      hpLpR += hpAlpha * (rawR - hpLpR);
      out[f * 2] += (rawL - hpLpL) * tailGain;
      out[f * 2 + 1] += (rawR - hpLpR) * tailGain;
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return out;
}

/**
 * Deterministic offline stereo room renderer: sparse early reflections followed by
 * a damped four-line feedback delay network per channel. Delay lengths are fixed,
 * mutually prime-ish, and offset between channels so the tail is wide without using
 * noise or time-varying random modulation.
 */
export function renderRoom(input: Float32Array, sampleRate = 48000, options: RoomOptions = {}): Float32Array {
  const size = options.size ?? 1;
  const decaySec = options.decaySec ?? 1.1;
  const dampingHz = options.dampingHz ?? 2100;
  const predelayMs = options.predelayMs ?? 9;
  const earlyGain = db(options.earlyDb ?? -19);
  const tailGain = db(options.tailDb ?? -15);
  const dryGain = db(options.dryDb ?? 0);
  const frames = Math.floor(input.length / 2);
  const out = new Float32Array(input.length);

  const earlyTaps = [17.3, 29.7, 43.1, 61.9, 83.3].map((x) => Math.max(1, Math.round(x * size * sampleRate / 1000)));
  const earlyGains = [0.62, 0.46, 0.34, 0.24, 0.16];
  const earlyPans = [-0.55, 0.48, -0.25, 0.34, -0.12];

  const baseDelays = [1421, 1663, 1879, 2131, 2389, 2707, 2999, 3313];
  const channelOffsets = [0, 53];
  type Line = { buf: Float32Array; pos: number; gain: number; damp: number; dampState: number; inject: number };
  const channels: Line[][] = [];
  for (let ch = 0; ch < 2; ch++) {
    const lines: Line[] = [];
    for (let i = 0; i < 8; i++) {
      const len = Math.max(32, Math.round((baseDelays[i]! + channelOffsets[ch]! + i * 17) * size));
      const gain = Math.pow(10, -3 * len / (decaySec * sampleRate));
      const damp = 1 - Math.exp(-2 * Math.PI * Math.max(80, dampingHz) / sampleRate);
      lines.push({ buf: new Float32Array(len), pos: 0, gain, damp, dampState: 0, inject: ch === 0 ? 1 : (i % 2 ? -0.72 : 0.82) });
    }
    channels.push(lines);
  }

  const predelay = Math.max(0, Math.round(predelayMs * sampleRate / 1000));
  const preL = new Float32Array(predelay + 1);
  const preR = new Float32Array(predelay + 1);
  let prePos = 0;

  for (let f = 0; f < frames; f++) {
    const dryL = input[f * 2] ?? 0;
    const dryR = input[f * 2 + 1] ?? 0;
    let wetL = 0;
    let wetR = 0;

    // Discrete early room boundaries, with alternating pan signs and slight level decay.
    for (let tap = 0; tap < earlyTaps.length; tap++) {
      const d = earlyTaps[tap]!;
      if (f >= d) {
        const srcL = input[(f - d) * 2] ?? 0;
        const srcR = input[(f - d) * 2 + 1] ?? 0;
        const mono = (srcL + srcR) * 0.5;
        const pan = earlyPans[tap]!;
        const a = (pan + 1) * Math.PI / 4;
        wetL += mono * Math.cos(a) * earlyGains[tap]! * earlyGain;
        wetR += mono * Math.sin(a) * earlyGains[tap]! * earlyGain;
      }
    }

    const delayedL = predelay ? preL[prePos]! : dryL;
    const delayedR = predelay ? preR[prePos]! : dryR;
    if (predelay) {
      preL[prePos] = dryL;
      preR[prePos] = dryR;
      prePos = (prePos + 1) % predelay;
    }

    const ins = [delayedL * 0.42, delayedR * 0.42];
    const tail: [number, number] = [0, 0];
    for (let ch = 0; ch < 2; ch++) {
      const lines = channels[ch]!;
      const reads = lines.map((line) => line.buf[line.pos]!);
      tail[ch === 0 ? 0 : 1] = (reads[0]! + reads[1]! * 0.82 + reads[2]! * 0.74 + reads[3]! * 0.66) * 0.72;
      const fb = [
        (reads[0]! + reads[1]! + reads[2]! + reads[3]!) * 0.5,
        (reads[0]! - reads[1]! + reads[2]! - reads[3]!) * 0.5,
        (reads[0]! + reads[1]! - reads[2]! - reads[3]!) * 0.5,
        (reads[0]! - reads[1]! - reads[2]! + reads[3]!) * 0.5,
      ];
      for (let i = 0; i < 8; i++) {
        const line = lines[i]!;
        line.dampState += line.damp * (fb[i]! - line.dampState);
        line.buf[line.pos] = ins[ch]! * line.inject + line.dampState * line.gain;
        line.pos = (line.pos + 1) % line.buf.length;
      }
    }
    wetL += tail[0] * tailGain;
    wetR += tail[1] * tailGain;

    out[f * 2] = dryL * dryGain + wetL;
    out[f * 2 + 1] = dryR * dryGain + wetR;
  }
  return out;
}

export interface Mode {
  hz: number;
  gain: number;
  decay: number;
  phase?: number;
}

/** Sum a set of exponentially damped physical resonances after a contact at u=0. */
export function modalRing(u: number, modes: readonly Mode[]): number {
  if (u < 0) return 0;
  let v = 0;
  for (const m of modes) v += Math.sin(u * Math.PI * 2 * m.hz + (m.phase ?? 0)) * m.gain * Math.exp(-u * m.decay);
  return v;
}

/**
 * Small metal bell strike: inharmonic damped partials plus a very short contact-noise
 * burst. The base frequency is the bell body, not a sustained electronic tone.
 */
export function bellStrike(u: number, baseHz: number, seed: number, amp = 1): number {
  if (u < 0 || u > 0.72) return 0;
  const bend = 1 - 0.0018 * Math.exp(-u * 24);
  const tremolo = 1 + 0.11 * Math.sin(u * Math.PI * 2 * (13.0 + hash01(seed, 1.7) * 5.0)) * Math.exp(-u * 15);
  const modes: Mode[] = [
    { hz: baseHz * 0.49 * bend, gain: 0.16, decay: 23, phase: hash01(seed, 2.0) * 6.283 },
    { hz: baseHz * 0.996 * bend, gain: 0.55, decay: 16, phase: hash01(seed, 3.0) * 6.283 },
    { hz: baseHz * 1.007 * bend, gain: 0.43, decay: 13.5, phase: hash01(seed, 4.0) * 6.283 },
    { hz: baseHz * 1.49 * bend, gain: 0.30, decay: 19, phase: hash01(seed, 5.0) * 6.283 },
    { hz: baseHz * 1.526 * bend, gain: 0.20, decay: 22, phase: hash01(seed, 6.0) * 6.283 },
    { hz: baseHz * 2.07 * bend, gain: 0.13, decay: 29, phase: hash01(seed, 7.0) * 6.283 },
    { hz: baseHz * 2.79 * bend, gain: 0.050, decay: 38, phase: hash01(seed, 8.0) * 6.283 },
  ];
  let v = 0;
  for (const m of modes) {
    const fm = 0.018 * Math.sin(u * Math.PI * 2 * (17 + hash01(seed, m.hz) * 11) + (m.phase ?? 0)) * Math.exp(-u * 44);
    v += Math.sin(u * Math.PI * 2 * m.hz + fm + (m.phase ?? 0)) * m.gain * Math.exp(-u * m.decay);
  }
  const si = Math.floor(u * 48000 + 0.5);
  const colored = (hash01(si, seed) * 0.46 + hash01(si - 1, seed) * 0.31 + hash01(si - 2, seed) * 0.23 - 0.5) * 2;
  const contact = colored * 0.22 * Math.exp(-u * 210) + colored * 0.055 * Math.exp(-u * 72);
  return (v * tremolo + contact) * amp * Math.min(1, u * 1500);
}


/** Hollow plastic object contact: damped shell modes with very little metallic edge. */
export function plasticKnock(u: number, baseHz: number, seed: number, amp = 1): number {
  if (u < 0 || u > 0.55) return 0;
  const si = Math.floor(u * 48000 + 0.5);
  const contact = coloredNoise(si, seed, 9) * 0.11 * Math.exp(-u * 120);
  const shell = modalRing(u, [
    { hz: baseHz * 0.72, gain: 0.30, decay: 18 },
    { hz: baseHz, gain: 0.36, decay: 24 },
    { hz: baseHz * 1.43, gain: 0.15, decay: 34 },
    { hz: baseHz * 2.08, gain: 0.035, decay: 48 },
  ]);
  return (shell + contact) * amp * Math.min(1, u * 240);
}

/** Low metal/wood object impact for bars, doors, rails, and structural contact. */
export function impactStrike(u: number, baseHz: number, seed: number, amp = 1): number {
  if (u < 0 || u > 1.0) return 0;
  const modes: Mode[] = [
    { hz: baseHz * 0.52, gain: 0.55, decay: 9 },
    { hz: baseHz, gain: 0.72, decay: 12 },
    { hz: baseHz * 1.72, gain: 0.25, decay: 18 },
    { hz: baseHz * 2.61, gain: 0.10, decay: 25 },
  ];
  const si = Math.floor(u * 48000 + 0.5);
  const contact = (hash01(si, seed) - 0.5) * 0.16 * Math.exp(-u * 150);
  return (modalRing(u, modes) + contact) * amp * Math.min(1, u * 190);
}

/** Broken music-box tine: detuned metallic resonance with a wound, uneven feel. */
export function musicBoxTine(u: number, hz: number, seed: number, amp = 1): number {
  if (u < 0 || u > 1.4) return 0;
  const wobble = 1 + (hash01(Math.floor(u * 48000), seed) - 0.5) * 0.0008;
  const modes: Mode[] = [
    { hz: hz * wobble, gain: 0.60, decay: 4.6 },
    { hz: hz * 2.017, gain: 0.16, decay: 8.5 },
    { hz: hz * 3.31, gain: 0.016, decay: 18.5 },
  ];
  const si = Math.floor(u * 48000 + 0.5);
  const pluck = (hash01(si, seed + 4.1) - 0.5) * 0.09 * Math.exp(-u * 310);
  return (modalRing(u, modes) + pluck) * amp * Math.min(1, u * 550);
}

/**
 * Sample-accurate twin-bell telephone physical model. Noise-like clapper excitation
 * is injected into banks of narrowly damped resonators, so the bell partials are
 * energized differently on every hit instead of replaying clean oscillator tones.
 */
export function renderBellPhone(durationSec: number, sampleRate = 48000): Float32Array {
  const frames = Math.round(durationSec * sampleRate);
  const out = new Float32Array(frames * 2);
  interface Resonator { hz: number; r: number; c: number; z1: number; z2: number; gain: number; pan: number; bell: number }
  const resonators: Resonator[] = [];
  const makeBell = (base: number, bell: number, pan: number) => {
    const ratios = [0.49, 0.996, 1.007, 1.31, 1.49, 1.526, 2.07, 2.79, 3.55];
    const gains = [0.08, 0.42, 0.34, 0.12, 0.23, 0.16, 0.11, 0.050, 0.025];
    const decays = [12, 5.2, 4.8, 8.2, 6.4, 7.2, 11.5, 15, 19];
    for (let i = 0; i < ratios.length; i++) {
      const jitter = 1 + (hash01(i + bell * 20, base * 0.01) - 0.5) * 0.006;
      const hz = base * ratios[i]! * jitter;
      const r = Math.exp(-decays[i]! / sampleRate);
      resonators.push({ hz, r, c: 2 * r * Math.cos(2 * Math.PI * hz / sampleRate), z1: 0, z2: 0, gain: gains[i]!, pan, bell });
    }
  };
  makeBell(760, 0, -0.18);
  makeBell(952, 1, 0.16);

  interface Hit { at: number; bell: number; amp: number; seed: number }
  const hits: Hit[] = [];
  // Mechanical bells are bursted rather than continuous. For short phone cues (the
  // receiver is lifted before a second ring) this yields one full ~1.5s burst followed
  // by true source silence; longer uses get the normal ~4.8s ring cycle.
  for (let burst = 0, start = 0.02; start < durationSec - 0.4; burst++, start += 4.8) {
    for (let k = 0; k < 29; k++) {
      const jitter = (hash01(k + burst * 29, 41.2) - 0.5) * 0.006;
      const engage = Math.min(1, k / 3) * Math.min(1, (28 - k) / 4);
      hits.push({
        at: start + k * (0.0495 + (hash01(k, 44.2) - 0.5) * 0.003) + jitter,
        bell: k % 2,
        amp: engage * (k % 2 ? 0.72 : 1.0) * (0.82 + hash01(k + burst * 31, 45.3) * 0.30),
        seed: 71.3 + k * 2.17 + burst * 31.1,
      });
    }
  }

  let mechLp = 0;
  let mechLp2 = 0;
  for (let f = 0; f < frames; f++) {
    const t = f / sampleRate;
    let excite0 = 0;
    let excite1 = 0;
    let mech = 0;
    for (const hit of hits) {
      const u = t - hit.at;
      if (u >= 0 && u < 0.0032) {
        const env = Math.sin(Math.PI * u / 0.0032) ** 0.55;
        const colored = (hash01(f, hit.seed) * 0.46 + hash01(f - 1, hit.seed) * 0.31 + hash01(f - 2, hit.seed) * 0.23 - 0.5) * 2;
        const exc = colored * env * hit.amp;
        if (hit.bell === 0) excite0 += exc;
        else excite1 += exc;
        mech += colored * env * hit.amp * 0.22;
      } else if (u >= 0.0032 && u < 0.021) {
        // Armature rebound/spring noise: quieter, darker, and irregular.
        const u2 = u - 0.0032;
        const env = Math.exp(-u2 * 150);
        mech += (hash01(f, hit.seed + 9.1) - 0.5) * env * hit.amp * 0.055;
      }
    }
    mechLp = mechLp * 0.86 + mech * 0.14;
    mechLp2 = mechLp2 * 0.94 + mechLp * 0.06;

    let l = mechLp2 * 0.20;
    let r = mechLp2 * 0.17;
    for (const rs of resonators) {
      const input = (rs.bell === 0 ? excite0 : excite1) + (rs.bell === 0 ? excite1 : excite0) * 0.08;
      const y = input * 0.060 + rs.c * rs.z1 - rs.r * rs.r * rs.z2;
      rs.z2 = rs.z1;
      rs.z1 = y;
      const v = y * rs.gain;
      const a = (rs.pan + 1) * Math.PI / 4;
      l += v * Math.cos(a);
      r += v * Math.sin(a);
    }

    // Cradle/receiver knock near the cutoff, also filtered through the room rather than dry click.
    const cu = t - 2.38;
    if (cu >= 0 && cu < 0.09) {
      const knock = impactStrike(cu, 390, 8.2, 0.15);
      l += knock * 0.9;
      r += knock * 0.78;
    }
    out[f * 2] = l;
    out[f * 2 + 1] = r;
  }

  // Normalize the physical model into predictable mix headroom while preserving
  // internal hit-to-hit dynamics.
  let peak = 1e-9;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]!));
  const scale = 0.32 / peak;
  for (let i = 0; i < out.length; i++) out[i] *= scale;
  return out;
}

/** Deterministic triangularly weighted low-passed noise sample. */
export function coloredNoise(si: number, seed: number, taps = 9): number {
  let acc = 0;
  let norm = 0;
  for (let k = 0; k < taps; k++) {
    const w = taps - k;
    acc += hash01(si - k, seed) * w;
    norm += w;
  }
  return (acc / norm - 0.5) * 2;
}

/** Soft carpet/floor contact: broadband-but-dark friction plus weak floor-body modes. */
export function softImpact(u: number, baseHz: number, seed: number, amp = 1): number {
  if (u < 0 || u > 0.42) return 0;
  const si = Math.floor(u * 48000 + 0.5);
  // Carpet dissipates most of the impact as a short force pulse and fibrous friction.
  // Avoid sustained sine-like floor modes here: they read as repetitive synthetic thuds.
  const attack = Math.min(1, u / 0.012);
  const pressure = Math.sin(Math.PI * Math.min(1, u / 0.042)) ** 2;
  const fiber = coloredNoise(si, seed, 17);
  const edge = coloredNoise(si, seed + 3.7, 7);
  const friction = fiber * (0.34 * Math.exp(-u * 29) + 0.16 * Math.exp(-u * 9));
  const textileDetail = edge * 0.075 * Math.exp(-u * 68);
  const forcePulse = pressure * coloredNoise(si, seed + 7.1, 23) * 0.36;
  const weakFloor = modalRing(u, [
    { hz: baseHz * 0.52, gain: 0.045, decay: 24 },
    { hz: baseHz, gain: 0.050, decay: 31 },
  ]);
  return (forcePulse + friction + textileDetail + weakFloor) * amp * attack;
}

/** Brittle ceiling-tile/mineral impact with deterministic secondary clatter. */
export function tileClatter(u: number, baseHz: number, seed: number, amp = 1): number {
  if (u < 0 || u > 0.9) return 0;
  let v = 0;
  for (let k = 0; k < 5; k++) {
    const delay = k === 0 ? 0 : 0.035 + hash01(k, seed) * 0.15;
    const uu = u - delay;
    if (uu < 0) continue;
    const si = Math.floor(uu * 48000 + 0.5);
    const white = (hash01(si, seed + k * 4.3) - 0.5) * 2;
    const low = coloredNoise(si, seed + k * 4.3, 10);
    const crack = (white * 0.22 - low * 0.22) * Math.exp(-uu * (150 - k * 12));
    const mineral = modalRing(uu, [
      { hz: baseHz * (1 + k * 0.13), gain: 0.23 / (k + 1), decay: 22 + k * 7 },
      { hz: baseHz * 1.71 * (1 + k * 0.07), gain: 0.09 / (k + 1), decay: 31 + k * 8 },
      { hz: baseHz * 2.47, gain: 0.030 / (k + 1), decay: 44 + k * 8 },
    ]);
    v += (crack * 0.42 + mineral) * (1 / (1 + k * 0.55));
  }
  return v * amp * Math.min(1, u * 170);
}
