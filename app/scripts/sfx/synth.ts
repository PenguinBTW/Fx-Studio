/**
 * Deterministic SFX synthesiser (P3b). No native deps, no sample files, no Math.random.
 * Renders 48 kHz / 24-bit stereo PCM WAV, one cue-local stem per cue.
 *
 *   bun scripts/sfx/synth.ts --cues sfx_cues.json --out <dir> [--events events.json]
 *   bun scripts/sfx/synth.ts --list
 *
 * Docs: docs/audio/sfx-synth.md
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { mulberry32 } from "../../src/engine/util";

export const SR = 48000;
const TAU = Math.PI * 2;
const db2lin = (d: number) => Math.pow(10, d / 20);
const lin2db = (v: number) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const smooth = (u: number) => {
  u = clamp(u, 0, 1);
  return u * u * (3 - 2 * u);
};

export type Rng = () => number;
export interface Stereo {
  l: Float64Array;
  r: Float64Array;
}
export const mkStereo = (n: number): Stereo => ({ l: new Float64Array(n), r: new Float64Array(n) });

// ---------------------------------------------------------------- automation lanes

export type LanePts = Array<[number, number]>;
export type Lane =
  | number
  | Float64Array
  | LanePts
  | { pts: LanePts; curve?: "lin" | "exp" | "smooth" }
  | { adsr: { a: number; d: number; s: number; r: number; gate: number } };

/** Turns a JSON lane (constant, [[t,v],...], {pts,curve} or {adsr}) into f(t). */
export function lane(spec: Lane | undefined, def = 0): (t: number) => number {
  if (spec === undefined || spec === null) spec = def;
  if (typeof spec === "number") {
    const v = spec;
    return () => v;
  }
  if (spec instanceof Float64Array) {
    const a = spec;
    return (t) => a[clamp(Math.round(t * SR), 0, a.length - 1)];
  }
  if (!Array.isArray(spec) && "adsr" in spec) {
    const { a, d, s, r, gate } = spec.adsr;
    return (t) => {
      if (t < 0) return 0;
      if (t < gate) {
        if (t < a) return a > 0 ? t / a : 1;
        if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
        return s;
      }
      const lvl = t < a ? t / a : t < a + d ? 1 - (1 - s) * ((t - a) / d) : s;
      return r > 0 ? Math.max(0, lvl * (1 - (t - gate) / r)) : 0;
    };
  }
  const pts = (Array.isArray(spec) ? spec : spec.pts).slice().sort((a, b) => a[0] - b[0]);
  const curve = Array.isArray(spec) ? "lin" : (spec.curve ?? "lin");
  return (t) => {
    if (t <= pts[0][0]) return pts[0][1];
    const last = pts[pts.length - 1];
    if (t >= last[0]) return last[1];
    let i = 1;
    while (pts[i][0] < t) i++;
    const [t0, v0] = pts[i - 1];
    const [t1, v1] = pts[i];
    let u = (t - t0) / (t1 - t0);
    if (curve === "smooth") u = u * u * (3 - 2 * u);
    if (curve === "exp" && v0 > 0 && v1 > 0) return v0 * Math.pow(v1 / v0, u);
    return v0 + (v1 - v0) * u;
  };
}

// ---------------------------------------------------------------- oscillators

export type Wave = "sine" | "saw" | "square" | "tri";
const blep = (p: number, dt: number) => {
  if (p < dt) {
    const x = p / dt;
    return x + x - x * x - 1;
  }
  if (p > 1 - dt) {
    const x = (p - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
};

/** Phase-accumulator oscillator; saw/square are PolyBLEP band-limited. `pm` is phase modulation in cycles (FM). */
export class Osc {
  ph: number;
  constructor(public wave: Wave = "sine", ph0 = 0) {
    this.ph = ph0;
  }
  next(freq: number, pm = 0): number {
    const p = this.ph;
    const dt = Math.min(Math.abs(freq) / SR, 0.5);
    let y: number;
    switch (this.wave) {
      case "sine":
        y = Math.sin(TAU * (p + pm));
        break;
      case "saw":
        y = 2 * p - 1 - blep(p, dt);
        break;
      case "square":
        y = (p < 0.5 ? 1 : -1) + blep(p, dt) - blep((p + 0.5) % 1, dt);
        break;
      default:
        y = 4 * Math.abs(p - 0.5) - 1;
    }
    this.ph = p + freq / SR;
    this.ph -= Math.floor(this.ph);
    return y;
  }
}

/** Two-operator FM voice: carrier phase-modulated by a sine modulator at freq*ratio with index lane. */
export class FMVoice {
  c = new Osc("sine");
  m = new Osc("sine");
  next(freq: number, ratio: number, index: number) {
    const mod = this.m.next(freq * ratio);
    return this.c.next(freq, (index * mod) / TAU);
  }
}

export function ringMod(buf: Float64Array, freq: number, mix = 1) {
  const o = new Osc("sine");
  for (let i = 0; i < buf.length; i++) {
    const m = o.next(freq);
    buf[i] = buf[i] * (1 - mix) + buf[i] * m * mix;
  }
  return buf;
}

// ---------------------------------------------------------------- noise and filters

export type NoiseColor = "white" | "pink" | "brown";
export class Noise {
  private b = [0, 0, 0, 0, 0, 0, 0];
  private last = 0;
  constructor(
    private rng: Rng,
    public color: NoiseColor = "white",
  ) {}
  next(): number {
    const w = this.rng() * 2 - 1;
    if (this.color === "white") return w;
    if (this.color === "brown") {
      this.last = (this.last + 0.02 * w) / 1.02;
      return this.last * 3.5;
    }
    const b = this.b;
    b[0] = 0.99886 * b[0] + w * 0.0555179;
    b[1] = 0.99332 * b[1] + w * 0.0750759;
    b[2] = 0.969 * b[2] + w * 0.153852;
    b[3] = 0.8665 * b[3] + w * 0.3104856;
    b[4] = 0.55 * b[4] + w * 0.5329522;
    b[5] = -0.7616 * b[5] - w * 0.016898;
    const y = (b[0] + b[1] + b[2] + b[3] + b[4] + b[5] + b[6] + w * 0.5362) * 0.11;
    b[6] = w * 0.115926;
    return y;
  }
}

export type FilterMode = "lp" | "bp" | "hp";
/** Zero-delay-feedback state-variable filter; cutoff and Q can change every sample. */
export class SVF {
  private s1 = 0;
  private s2 = 0;
  process(x: number, fc: number, q = 0.707, mode: FilterMode = "lp"): number {
    const g = Math.tan((Math.PI * clamp(fc, 10, SR * 0.45)) / SR);
    const k = 1 / Math.max(0.05, q);
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = x - this.s2;
    const v1 = a1 * this.s1 + a2 * v3;
    const v2 = this.s2 + a2 * this.s1 + a3 * v3;
    this.s1 = 2 * v1 - this.s1;
    this.s2 = 2 * v2 - this.s2;
    return mode === "lp" ? v2 : mode === "bp" ? v1 : x - k * v1 - v2;
  }
}

export interface FNoiseOpts {
  color?: NoiseColor;
  cutoff: Lane;
  q?: Lane;
  mode?: FilterMode;
  gain?: Lane;
}
/** Coloured noise through an SVF with automated cutoff / Q / gain. */
export function filteredNoise(n: number, rng: Rng, o: FNoiseOpts): Float64Array {
  const out = new Float64Array(n);
  const noise = new Noise(rng, o.color ?? "white");
  const f = new SVF();
  const cut = lane(o.cutoff);
  const q = lane(o.q, 0.707);
  const g = lane(o.gain, 1);
  const mode = o.mode ?? "lp";
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = f.process(noise.next(), cut(t), q(t), mode) * g(t);
  }
  return out;
}

// ---------------------------------------------------------------- mixing helpers

export function gen(n: number, fn: (t: number, i: number) => number): Float64Array {
  const o = new Float64Array(n);
  for (let i = 0; i < n; i++) o[i] = fn(i / SR, i);
  return o;
}
export const secs = (s: number) => Math.max(1, Math.round(s * SR));

export function pan(mono: Float64Array, panLane: Lane | undefined = 0): Stereo {
  const p = lane(panLane, 0);
  const o = mkStereo(mono.length);
  for (let i = 0; i < mono.length; i++) {
    const th = ((clamp(p(i / SR), -1, 1) + 1) * Math.PI) / 4;
    o.l[i] = mono[i] * Math.cos(th);
    o.r[i] = mono[i] * Math.sin(th);
  }
  return o;
}

export function addInto(dst: Stereo, src: Stereo, offset = 0, gain = 1) {
  const n = Math.min(src.l.length, dst.l.length - offset);
  for (let i = 0; i < n; i++) {
    dst.l[offset + i] += src.l[i] * gain;
    dst.r[offset + i] += src.r[i] * gain;
  }
}
function stamp(dst: Stereo, grain: Float64Array, i0: number, gain: number, p: number) {
  const th = ((clamp(p, -1, 1) + 1) * Math.PI) / 4;
  const gl = Math.cos(th) * gain;
  const gr = Math.sin(th) * gain;
  const n = Math.min(grain.length, dst.l.length - i0);
  for (let i = 0; i < n; i++) {
    dst.l[i0 + i] += grain[i] * gl;
    dst.r[i0 + i] += grain[i] * gr;
  }
}
const scaleSt = (s: Stereo, g: number) => {
  for (let i = 0; i < s.l.length; i++) {
    s.l[i] *= g;
    s.r[i] *= g;
  }
  return s;
};
const peakOf = (s: Stereo) => {
  let m = 0;
  for (let i = 0; i < s.l.length; i++) m = Math.max(m, Math.abs(s.l[i]), Math.abs(s.r[i]));
  return m;
};
const rmsOf = (s: Stereo) => {
  let a = 0;
  for (let i = 0; i < s.l.length; i++) a += s.l[i] * s.l[i] + s.r[i] * s.r[i];
  return Math.sqrt(a / Math.max(1, s.l.length * 2));
};
const mono2 = (m: Float64Array): Stereo => ({ l: m, r: Float64Array.from(m) });
const reversed = (a: Float64Array) => Float64Array.from(a).reverse();

// ---------------------------------------------------------------- granular engine

export type GrainKind = "sine" | "saw" | "noise" | "tick";
export interface GranularOpts {
  dur: number;
  kind?: GrainKind;
  freq?: Lane;
  /** pitch distribution around freq, in semitones */
  pitchSpread?: number;
  dist?: "uniform" | "gauss" | "set";
  set?: number[];
  grainMs?: Lane;
  /** grains per second */
  density?: Lane;
  /** 0 = metronomic, 1 = Poisson */
  jitter?: number;
  pan?: Lane;
  panSpread?: number;
  amp?: Lane;
  /** 0..1 random level variation per grain */
  ampSpread?: number;
}

export function renderGrain(kind: GrainKind, freq: number, len: number, rng: Rng): Float64Array {
  const g = new Float64Array(len);
  if (kind === "sine" || kind === "saw") {
    const o = new Osc(kind, rng());
    for (let i = 0; i < len; i++) g[i] = o.next(freq) * (0.5 - 0.5 * Math.cos((TAU * (i + 0.5)) / len));
  } else if (kind === "noise") {
    const nz = new Noise(rng, "white");
    const f = new SVF();
    for (let i = 0; i < len; i++) g[i] = f.process(nz.next(), freq, 2, "bp") * 2.5 * (0.5 - 0.5 * Math.cos((TAU * (i + 0.5)) / len));
  } else {
    const nz = new Noise(rng, "white");
    const f = new SVF();
    const att = Math.max(2, Math.round(0.0003 * SR));
    for (let i = 0; i < len; i++) g[i] = f.process(nz.next(), freq, 3.5, "bp") * 3 * Math.exp((-5 * i) / len) * Math.min(1, (i + 1) / att);
  }
  return g;
}

export function granular(o: GranularOpts, rng: Rng): Stereo {
  const n = secs(o.dur);
  const out = mkStereo(n);
  const freq = lane(o.freq, 1000);
  const grainMs = lane(o.grainMs, 30);
  const dens = lane(o.density, 40);
  const pn = lane(o.pan, 0);
  const amp = lane(o.amp, 1);
  const jit = o.jitter ?? 1;
  const spread = o.pitchSpread ?? 0;
  const dist = o.dist ?? "uniform";
  let t = 0;
  while (t < o.dur) {
    const u1 = rng(), u2 = rng(), u3 = rng(), u4 = rng(), u5 = rng();
    let st = 0;
    if (dist === "uniform") st = (u1 * 2 - 1) * spread;
    else if (dist === "gauss") st = Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(TAU * u2) * (spread / 2);
    else if (o.set && o.set.length) st = o.set[Math.floor(u1 * o.set.length) % o.set.length];
    const len = Math.max(2, Math.round((grainMs(t) * SR) / 1000));
    const grain = renderGrain(o.kind ?? "sine", freq(t) * Math.pow(2, st / 12), len, rng);
    const p = pn(t) + (u3 * 2 - 1) * (o.panSpread ?? 0);
    const a = amp(t) * (1 - (o.ampSpread ?? 0) * u4);
    stamp(out, grain, Math.floor(t * SR), a, p);
    const d = Math.max(0.01, dens(t));
    t += (1 / d) * (1 - jit + jit * -Math.log(1 - u5));
  }
  return out;
}

// ---------------------------------------------------------------- Shepard / Risset

export interface ShepardOpts {
  fmin?: number;
  octaves?: number;
  /** octaves per second; negative falls */
  rate?: Lane;
  amp?: Lane;
  startPos?: number;
}
/** Continuous Shepard glissando: octave-spaced partials under a fixed gaussian spectral envelope. */
export function shepard(n: number, o: ShepardOpts = {}): Float64Array {
  const fmin = o.fmin ?? 27.5;
  const N = o.octaves ?? 9;
  const rate = lane(o.rate, 0.2);
  const amp = lane(o.amp, 1);
  const out = new Float64Array(n);
  const phase = new Float64Array(N);
  let pos = o.startPos ?? 0;
  const sigma = N * 0.18;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    for (let k = 0; k < N; k++) {
      let x = (k + pos) % N;
      if (x < 0) x += N;
      const f = fmin * Math.pow(2, x);
      const w = Math.exp(-0.5 * Math.pow((x - N / 2) / sigma, 2));
      phase[k] += f / SR;
      phase[k] -= Math.floor(phase[k]);
      s += w * Math.sin(TAU * phase[k]);
    }
    out[i] = (s / Math.sqrt(N)) * amp(t) * 0.5;
    pos += rate(t) / SR;
  }
  return out;
}

// ---------------------------------------------------------------- FFT, IR, convolution

const twCache = new Map<number, [Float64Array, Float64Array]>();
export function fft(re: Float64Array, im: Float64Array, inverse = false) {
  const n = re.length;
  let tw = twCache.get(n);
  if (!tw) {
    const c = new Float64Array(n / 2), s = new Float64Array(n / 2);
    for (let k = 0; k < n / 2; k++) {
      c[k] = Math.cos((TAU * k) / n);
      s[k] = Math.sin((TAU * k) / n);
    }
    tw = [c, s];
    twCache.set(n, tw);
  }
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1, step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < half; k++) {
        const wr = tw[0][k * step], wi = sign * tw[1][k * step];
        const a = i + k, b = a + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
const pow2 = (n: number) => { let p = 1; while (p < n) p <<= 1; return p; };

/** Full linear convolution (length a+b-1) via FFT. */
export function convolve(x: Float64Array, h: Float64Array): Float64Array {
  const n = x.length + h.length - 1;
  const N = pow2(n);
  const xr = new Float64Array(N), xi = new Float64Array(N);
  const hr = new Float64Array(N), hi = new Float64Array(N);
  xr.set(x); hr.set(h);
  fft(xr, xi); fft(hr, hi);
  for (let i = 0; i < N; i++) {
    const r = xr[i] * hr[i] - xi[i] * hi[i];
    xi[i] = xr[i] * hi[i] + xi[i] * hr[i];
    xr[i] = r;
  }
  fft(xr, xi, true);
  return xr.slice(0, n);
}

export interface IROpts {
  seconds: number;
  rt60: number;
  predelay?: number;
  /** lowpass cutoff at the start / end of the tail (damping) */
  hiHz?: number;
  loHz?: number;
  early?: number;
  seed?: number;
}
/** Procedural stereo IR: decorrelated decaying noise, tail darkening over time, sparse early reflections, unit energy. */
export function makeIR(o: IROpts): Stereo {
  const n = secs(o.seconds);
  const ir = mkStereo(n);
  const pre = o.predelay ?? 0.004;
  const hi = o.hiHz ?? 9000, lo = o.loHz ?? 700;
  [ir.l, ir.r].forEach((ch, c) => {
    const rng = mulberry32((o.seed ?? 1) * 7919 + c * 104729);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR - pre;
      if (t < 0) { rng(); continue; }
      const env = Math.exp((-6.9078 * t) / o.rt60) * Math.min(1, t / 0.002);
      const fc = hi * Math.pow(lo / hi, Math.min(1, t / o.rt60));
      y += (1 - Math.exp((-TAU * fc) / SR)) * ((rng() * 2 - 1) - y);
      ch[i] = y * env;
    }
    for (let e = 0; e < (o.early ?? 6); e++) {
      const idx = Math.floor((pre + 0.006 + rng() * 0.07) * SR);
      if (idx < n) ch[idx] += (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.5) * 0.35;
    }
    let e2 = 0;
    for (let i = 0; i < n; i++) e2 += ch[i] * ch[i];
    const s = 1 / Math.sqrt(e2 || 1);
    for (let i = 0; i < n; i++) ch[i] *= s;
  });
  return ir;
}

/** Convolution reverb. Output includes the full tail (length n + ir - 1). */
export function reverb(src: Stereo, ir: Stereo, wet = 0.3, dry = 1): Stereo {
  const wl = convolve(src.l, ir.l);
  const wr = convolve(src.r, ir.r);
  const out = mkStereo(wl.length);
  for (let i = 0; i < wl.length; i++) {
    out.l[i] = wl[i] * wet + (i < src.l.length ? src.l[i] * dry : 0);
    out.r[i] = wr[i] * wet + (i < src.r.length ? src.r[i] * dry : 0);
  }
  return out;
}

/**
 * Reverse reverb: reverse, reverb, reverse. The swell peaks `landing` samples after the source's start
 * (landing = ir length - 1), so mix the dry sound at `landing` to have it land on the swell.
 */
export function reverseReverb(src: Stereo, ir: Stereo): { audio: Stereo; landing: number } {
  const a = convolve(reversed(src.l), ir.l).reverse();
  const b = convolve(reversed(src.r), ir.r).reverse();
  return { audio: { l: a, r: b }, landing: ir.l.length - 1 };
}

// ---------------------------------------------------------------- WAV + analysis

export function encodeWav(st: Stereo): Buffer {
  const n = st.l.length;
  const dataBytes = n * 6;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 6, 28);
  buf.writeUInt16LE(6, 32);
  buf.writeUInt16LE(24, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);
  let o = 44;
  const q = (x: number) => {
    const v = Math.round(clamp(x, -1, 1) * 8388607);
    buf.writeIntLE(v, o, 3);
    o += 3;
  };
  for (let i = 0; i < n; i++) { q(st.l[i]); q(st.r[i]); }
  return buf;
}

/** Whole-signal spectral centroid (Hz) of the mono mix. */
export function spectralCentroid(st: Stereo): number {
  const n = st.l.length;
  const N = pow2(n);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < n; i++) re[i] = (st.l[i] + st.r[i]) * 0.5 * (0.5 - 0.5 * Math.cos((TAU * (i + 0.5)) / n));
  fft(re, im);
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) {
    const m = Math.hypot(re[k], im[k]);
    num += m * ((k * SR) / N);
    den += m;
  }
  return den > 0 ? num / den : 0;
}

// ---------------------------------------------------------------- recipes

type P = Record<string, any>;
interface RecipeOut { audio: Stereo; hitOffset?: number }
export interface Recipe {
  doc: string;
  /** default peak level of the stem (dBFS) */
  peakDb: number;
  defaults: P;
  render: (p: P, rng: Rng) => Stereo | RecipeOut;
}

const hann = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.pow(Math.sin(Math.PI * u), 2));
const plate = (seconds: number, seed: number, hi = 8000, lo = 900) => makeIR({ seconds, rt60: seconds * 0.85, hiHz: hi, loHz: lo, seed });
const withTail = (dry: Stereo, ir: Stereo, wet: number, dryG = 1) => reverb(dry, ir, wet, dryG);
const stereoNoise = (n: number, rng: Rng, o: FNoiseOpts): Stereo => ({ l: filteredNoise(n, rng, o), r: filteredNoise(n, rng, o) });

export const recipes: Record<string, Recipe> = {
  ignition: {
    doc: "Act 0: 4 kHz sine rising out of nothing over a 30 Hz / 31 Hz beating sub. hitOffset = end of rise.",
    peakDb: -3,
    defaults: { rise: 3, tail: 1, fStart: 3600, fHigh: 4000, subHz: 30, beatHz: 1, subLevel: 1, pan: 0 },
    render(p) {
      const n = secs(p.rise + p.tail);
      const o = new Osc("sine"), s1 = new Osc("sine"), s2 = new Osc("sine"), h1 = new Osc("sine"), h2 = new Osc("sine");
      const m = gen(n, (t) => {
        const r = Math.min(t / p.rise, 1);
        const f = p.fStart + (p.fHigh - p.fStart) * r * r;
        const tailE = t < p.rise ? 1 : Math.exp(-(t - p.rise) * 5);
        const hi = o.next(f) * Math.pow(r, 3) * tailE * 0.45;
        const subE = Math.pow(Math.min(1, t / (p.rise * 0.8)), 2) * (t < p.rise ? 1 : Math.exp(-(t - p.rise) * 3));
        const sub = (s1.next(p.subHz) + s2.next(p.subHz + p.beatHz)) * 0.5 + 0.3 * (h1.next(p.subHz * 2) + h2.next(p.subHz * 2 + p.beatHz * 2)) * 0.5;
        return hi + sub * subE * 0.6 * p.subLevel;
      });
      return { audio: pan(m, p.pan), hitOffset: p.rise };
    },
  },

  tick: {
    doc: "Act 1: sharp granular tick(s), seeded pitch, panned with the photon. accent scales level for kick-locked hits.",
    peakDb: -6,
    defaults: { count: 1, spacing: 0.05, freq: 3200, spread: 7, pan: 0, panSpread: 0, accent: 1, decayMs: 6, jitter: 0.3 },
    render(p, rng) {
      const out = mkStereo(secs(p.count * p.spacing + 0.1));
      const pn = lane(p.pan);
      for (let i = 0; i < p.count; i++) {
        const t = i * p.spacing * (1 + (rng() * 2 - 1) * p.jitter * 0.3);
        const f = p.freq * Math.pow(2, ((rng() * 2 - 1) * p.spread) / 12);
        const g = renderGrain("tick", f, secs((p.decayMs * 5) / 1000), rng);
        stamp(out, g, Math.floor(t * SR), (0.6 + 0.4 * rng()) * (i === 0 ? p.accent : 1), pn(t) + (rng() * 2 - 1) * p.panSpread);
      }
      return out;
    },
  },

  pressure: {
    doc: "Act 1: filtered brown noise; cutoff opens with the pull-back (cutoff lane in Hz).",
    peakDb: -8,
    defaults: { dur: 8, cutLo: 70, cutHi: 1800, q: 0.8, cutoff: null, level: null },
    render(p, rng) {
      const cutoff = p.cutoff ?? { pts: [[0, p.cutLo], [p.dur, p.cutHi]], curve: "exp" };
      const level = p.level ?? [[0, 0.35], [p.dur, 1]];
      return stereoNoise(secs(p.dur), rng, { color: "brown", cutoff, q: p.q, gain: level });
    },
  },

  convection: {
    doc: "Act 2: slow band-passed pink roar with a rising Shepard layer.",
    peakDb: -6,
    defaults: { dur: 10, center: 160, wobble: 0.15, bandQ: 1.5, shepardLevel: 0.5, shepardRate: 0.12, fmin: 30 },
    render(p, rng) {
      const n = secs(p.dur);
      const roar = mkStereo(n);
      const wob = new SVF(), wob2 = new SVF();
      const nzL = new Noise(rng, "pink"), nzR = new Noise(rng, "pink");
      for (let i = 0; i < n; i++) {
        const t = i / SR;
        const c = p.center * Math.pow(2, 0.6 * Math.sin(TAU * p.wobble * t));
        const a = (0.6 + 0.4 * Math.sin(TAU * p.wobble * 1.7 * t + 1)) * 4;
        roar.l[i] = wob.process(nzL.next(), c, p.bandQ, "bp") * a;
        roar.r[i] = wob2.process(nzR.next(), c * 1.03, p.bandQ, "bp") * a;
      }
      const sh = shepard(n, { fmin: p.fmin, rate: p.shepardRate, amp: [[0, 0], [p.dur, p.shepardLevel]] });
      const sh2 = shepard(n, { fmin: p.fmin, rate: p.shepardRate, amp: [[0, 0], [p.dur, p.shepardLevel]], startPos: 0.37 });
      for (let i = 0; i < n; i++) {
        const e = Math.min(1, (i / SR) / 0.5) * Math.min(1, (p.dur - i / SR) / 0.5);
        roar.l[i] = (roar.l[i] + sh[i]) * e;
        roar.r[i] = (roar.r[i] + sh2[i]) * e;
      }
      return roar;
    },
  },

  rupture: {
    doc: "Act 3: taut saw tone bending up, then a wet tearing crackle. hitOffset = end of bend / start of crackle.",
    peakDb: -3,
    defaults: { bend: 2.5, tail: 2.5, f0: 55, f1: 130, crackleRate: 90, crackleLevel: 0.8, wet: 0.25 },
    render(p, rng) {
      const n = secs(p.bend + p.tail);
      const o = new Osc("saw"), f = new SVF();
      const tone = gen(n, (t) => {
        const fr = t < p.bend ? p.f0 * Math.pow(p.f1 / p.f0, Math.pow(t / p.bend, 2)) : p.f1;
        const e = t < p.bend ? Math.pow(t / p.bend, 1.5) * 0.9 + 0.1 * (t / p.bend) : Math.exp(-(t - p.bend) * 2.2);
        return f.process(o.next(fr), fr * 5, 3, "lp") * e * 0.5;
      });
      const st = pan(tone, 0);
      const filt = new SVF();
      let t = p.bend;
      while (t < p.bend + p.tail) {
        const decay = Math.exp(-(t - p.bend) * 1.3);
        const len = secs(0.001 + rng() * 0.005);
        const hz = 1500 + rng() * 4500;
        const g = new Float64Array(len);
        for (let i = 0; i < len; i++) g[i] = filt.process(rng() * 2 - 1, hz, 2.5, "bp") * 3 * Math.exp((-4 * i) / len);
        stamp(st, g, Math.floor(t * SR), p.crackleLevel * Math.pow(rng(), 3) * decay, (rng() * 2 - 1) * 0.8);
        t += (-Math.log(1 - rng())) / (p.crackleRate * (0.3 + decay));
      }
      return { audio: withTail(st, plate(1.2, 3, 6000, 600), p.wet), hitOffset: p.bend };
    },
  },

  thrum: {
    doc: "Act 3: deep AM thrum that follows the prominence loop across the stereo field (pan lane).",
    peakDb: -4,
    defaults: { dur: 6, f: 44, am: 5.5, amDepth: 0.4, pan: null },
    render(p) {
      const n = secs(p.dur);
      const pn = p.pan ?? { pts: [[0, -0.85], [p.dur / 2, 0.85], [p.dur, -0.85]], curve: "smooth" };
      const a = new Osc("sine"), b = new Osc("tri"), c = new Osc("sine");
      const m = gen(n, (t) => {
        const am = 1 - p.amDepth + p.amDepth * (0.5 + 0.5 * Math.sin(TAU * p.am * t));
        return (a.next(p.f) + 0.25 * b.next(p.f * 2) + 0.35 * c.next(p.f * 1.5)) * am * hann(t / p.dur) ** 0.4 * Math.min(1, t / 0.4) * Math.min(1, (p.dur - t) / 0.6);
      });
      return pan(m, pn);
    },
  },

  subHit: {
    doc: "Hero impact: pitch-dropping sine, soft click, dark short reverb. hitOffset = 0.",
    peakDb: -1,
    defaults: { dur: 2.2, f0: 130, f1: 38, drop: 0.22, decay: 0.7, click: 0.15, wet: 0.15 },
    render(p, rng) {
      const n = secs(p.dur);
      let ph = 0;
      const body = gen(n, (t) => {
        const f = p.f1 + (p.f0 - p.f1) * Math.exp((-3 * t) / p.drop);
        ph += f / SR;
        return (Math.sin(TAU * ph) + 0.2 * Math.sin(TAU * 2 * ph)) * Math.exp(-t / p.decay) * Math.min(1, t / 0.002);
      });
      const lane0 = Float64Array.from(body);
      const f = new SVF();
      const nz = new Noise(rng, "white");
      for (let i = 0; i < Math.min(n, secs(0.02)); i++) lane0[i] += f.process(nz.next(), 2000, 0.7, "lp") * p.click * Math.exp(-(i / SR) / 0.004);
      const dry = pan(lane0, 0);
      const tail = withTail(dry, plate(1.2, 5, 700, 150), p.wet);
      const out = mkStereo(n);
      addInto(out, tail);
      return { audio: out, hitOffset: 0 };
    },
  },

  airSwell: {
    doc: "Act 4: barely-there low 'air' swell, very quiet under the piano.",
    peakDb: -22,
    defaults: { dur: 10, cutLo: 200, cutHi: 600, sub: 55, subLevel: 0.15 },
    render(p, rng) {
      const n = secs(p.dur);
      const st = stereoNoise(n, rng, { color: "pink", cutoff: { pts: [[0, p.cutLo], [p.dur / 2, p.cutHi], [p.dur, p.cutLo]], curve: "smooth" }, q: 0.7 });
      const o = new Osc("sine");
      for (let i = 0; i < n; i++) {
        const t = i / SR, e = hann(t / p.dur);
        const s = o.next(p.sub) * p.subLevel;
        st.l[i] = (st.l[i] * 2 + s) * e;
        st.r[i] = (st.r[i] * 2 + s) * e;
      }
      return st;
    },
  },

  shimmer: {
    doc: "Act 5: crystalline FM shimmer. freq is a lane so the pitch can track a drawn line; amp lane optional.",
    peakDb: -10,
    defaults: { dur: 3, freq: 2400, voices: 6, partials: [1, 1.5, 2, 3, 4, 5.01], ratio: 3.5, index: 2.2, indexDecay: 1.5, attack: 0.02, decay: 1.2, spread: 0.9, detuneCents: 8, stagger: 0.08, amp: null, wet: 0.3 },
    render(p, rng) {
      const n = secs(p.dur);
      const fr = lane(p.freq), amp = lane(p.amp, 1);
      const out = mkStereo(n);
      for (let v = 0; v < p.voices; v++) {
        const ratio = p.partials[v % p.partials.length];
        const det = Math.pow(2, ((rng() * 2 - 1) * p.detuneCents) / 1200);
        const onset = rng() * p.stagger;
        const pn = (rng() * 2 - 1) * p.spread;
        const fm = new FMVoice();
        const m = gen(n, (t) => {
          const tt = t - onset;
          if (tt < 0) return 0;
          const e = Math.min(1, tt / p.attack) * Math.exp(-tt / p.decay);
          return fm.next(fr(t) * ratio * det, p.ratio, p.index * Math.exp(-tt / p.indexDecay)) * e * amp(t) / (1 + v * 0.3);
        });
        addInto(out, pan(m, pn));
      }
      return withTail(out, plate(1.5, 11, 12000, 3000), p.wet);
    },
  },

  auroraPad: {
    doc: "Act 5: very quiet, broad, slowly beating harmonic pad. beat = Hz between each detuned partial pair.",
    peakDb: -20,
    defaults: { dur: 12, f0: 110, partials: 8, beat: 0.35 },
    render(p, rng) {
      const n = secs(p.dur);
      const out = mkStereo(n);
      for (let h = 1; h <= p.partials; h++) {
        const a = new Osc("sine", rng()), b = new Osc("sine", rng());
        const lfoR = 0.05 + rng() * 0.15, lfoPh = rng() * TAU, pn = (rng() * 2 - 1) * 0.8;
        const w = 1 / Math.pow(h, 1.2);
        const m1 = gen(n, (t) => a.next(p.f0 * h - p.beat / 2) * w * (0.6 + 0.4 * Math.sin(TAU * lfoR * t + lfoPh)));
        const m2 = gen(n, (t) => b.next(p.f0 * h + p.beat / 2) * w * (0.6 + 0.4 * Math.sin(TAU * lfoR * t + lfoPh + 1.7)));
        addInto(out, pan(m1, Math.max(-1, pn - 0.2)));
        addInto(out, pan(m2, Math.min(1, pn + 0.2)));
      }
      for (let i = 0; i < n; i++) {
        const e = hann(i / SR / p.dur);
        out.l[i] *= e;
        out.r[i] *= e;
      }
      return out;
    },
  },

  windRise: {
    doc: "Act 6: rising filtered wind with high fizz for the scattering shot.",
    peakDb: -8,
    defaults: { dur: 6, cutLo: 250, cutHi: 3500, q: 1.6, fizz: 0.5, fizzHz: 6000 },
    render(p, rng) {
      const n = secs(p.dur);
      const ramp = (e: number) => (t: number) => Math.pow(Math.min(1, t / p.dur), e) * Math.min(1, (p.dur - t) / (p.dur * 0.1) + 0.0);
      const wind = stereoNoise(n, rng, { color: "pink", cutoff: { pts: [[0, p.cutLo], [p.dur, p.cutHi]], curve: "exp" }, q: p.q, mode: "bp", gain: gen(n, ramp(1.5)) as any });
      return wind;
    },
  },

  rain: {
    doc: "Act 6: granular rain whose density lane follows the droplets (grains/s).",
    peakDb: -10,
    defaults: { dur: 8, density: 40, freq: 5000, spread: 12, grainMs: 7, panSpread: 0.9, bed: 0.1 },
    render(p, rng) {
      const out = granular({ dur: p.dur, kind: "tick", freq: p.freq, pitchSpread: p.spread, dist: "gauss", grainMs: p.grainMs, density: p.density, jitter: 1, panSpread: p.panSpread, ampSpread: 0.7 }, rng);
      const dens = lane(p.density);
      const bed = stereoNoise(out.l.length, rng, { color: "pink", cutoff: 2500, mode: "hp", q: 0.7 });
      for (let i = 0; i < out.l.length; i++) {
        const g = p.bed * Math.sqrt(dens(i / SR) / 40);
        out.l[i] += bed.l[i] * g;
        out.r[i] += bed.r[i] * g;
      }
      return out;
    },
  },

  glassPing: {
    doc: "Act 7: glassy ping with reverse-reverb lead-in landing on the surface crossing. hitOffset = landing.",
    peakDb: -6,
    defaults: { freq: 1760, decay: 1.4, leadIn: 0.9, wet: 0.35, leadLevel: 0.7 },
    render(p) {
      const ratios = [1, 2.76, 5.4, 8.93], amps = [1, 0.5, 0.3, 0.15];
      const n = secs(p.decay * 5);
      const os = ratios.map(() => new Osc("sine"));
      const dry = gen(n, (t) => {
        let s = 0;
        for (let k = 0; k < 4; k++) s += os[k].next(p.freq * ratios[k]) * amps[k] * Math.exp((-t * (1 + 0.8 * k)) / p.decay * 3);
        return s * Math.min(1, t / 0.0015) * 0.4;
      });
      const src = mono2(dry.slice(0, secs(0.06)));
      for (let i = 0; i < src.l.length; i++) { const f = Math.min(1, (src.l.length - i) / 200); src.l[i] *= f; src.r[i] *= f; }
      const { audio: lead, landing } = reverseReverb(src, makeIR({ seconds: p.leadIn, rt60: p.leadIn * 0.9, hiHz: 10000, loHz: 3000, seed: 21, early: 0 }));
      const dryPk = Math.max(1e-9, Math.max(...dry.map(Math.abs)));
      const leadPk = Math.max(1e-9, peakOf(lead));
      scaleSt(lead, (p.leadLevel * dryPk) / leadPk);
      const total = landing + n + secs(1.5);
      const out = mkStereo(total);
      const cut = landing;
      for (let i = 0; i < cut && i < lead.l.length; i++) {
        const f = Math.min(1, (cut - i) / 150);
        out.l[i] += lead.l[i] * f;
        out.r[i] += lead.r[i] * f;
      }
      const wetDry = withTail(pan(dry, 0), plate(1.5, 31, 12000, 3000), p.wet);
      addInto(out, wetDry, landing);
      return { audio: out, hitOffset: landing / SR };
    },
  },

  reverseReverb: {
    doc: "Generic reverse-reverb swell into a dry hit. source: ping | noise | sub. hitOffset = landing.",
    peakDb: -6,
    defaults: { source: "noise", srcMs: 120, lead: 1.2, tail: 1.2, freq: 1200 },
    render(p, rng) {
      const n = secs(p.srcMs / 1000);
      let m: Float64Array;
      if (p.source === "sub") {
        const o = new Osc("sine");
        m = gen(n, (t) => o.next(60) * Math.exp(-t / 0.05));
      } else if (p.source === "ping") {
        const o = new Osc("sine");
        m = gen(n, (t) => o.next(p.freq) * Math.exp(-t / 0.04));
      } else m = filteredNoise(n, rng, { color: "white", cutoff: p.freq, q: 1, mode: "lp", gain: gen(n, (t) => Math.exp(-t / 0.03)) as any });
      const src = mono2(m);
      const { audio: lead, landing } = reverseReverb(src, makeIR({ seconds: p.lead, rt60: p.lead * 0.9, hiHz: 8000, loHz: 800, seed: 41 }));
      scaleSt(lead, peakOf(src) / Math.max(1e-9, peakOf(lead)));
      const out = mkStereo(landing + n + secs(p.tail));
      for (let i = 0; i < landing; i++) { const f = Math.min(1, (landing - i) / 150); out.l[i] = lead.l[i] * f; out.r[i] = lead.r[i] * f; }
      addInto(out, withTail(src, plate(p.tail, 43), 0.4), landing);
      return { audio: out, hitOffset: landing / SR };
    },
  },

  splitVoices: {
    doc: "Act 7: seven sine voices fanning in pitch (and pan) with the rays. fan lane 0..1 drives the spread.",
    peakDb: -8,
    defaults: { dur: 4, voices: 7, f0: 330, fanSemis: 2, fan: null },
    render(p) {
      const n = secs(p.dur);
      const fan = lane(p.fan ?? { pts: [[0, 0], [p.dur * 0.7, 1]], curve: "smooth" });
      const env = lane({ adsr: { a: 0.3, d: 0.2, s: 0.8, r: 1, gate: p.dur - 1 } });
      const out = mkStereo(n);
      const mid = (p.voices - 1) / 2;
      for (let v = 0; v < p.voices; v++) {
        const a = new Osc("sine"), b = new Osc("sine");
        const m = gen(n, (t) => {
          const f = p.f0 * Math.pow(2, (((v - mid) * p.fanSemis) / 12) * fan(t));
          return (a.next(f) + 0.2 * b.next(f * 2)) * env(t) / p.voices * 2;
        });
        addInto(out, pan(m, { pts: [[0, 0], [p.dur * 0.7, ((v - mid) / mid) * 0.85]], curve: "smooth" }));
      }
      return out;
    },
  },

  rainbowSwell: {
    doc: "Act 7: full-spectrum shimmer swell into the climax downbeat. hitOffset = rise.",
    peakDb: -3,
    defaults: { rise: 4, tail: 2, lo: 900, hi: 7000, voices: 14, noise: 0.5, wet: 0.3 },
    render(p, rng) {
      const n = secs(p.rise + p.tail);
      const env = (t: number) => (t < p.rise ? Math.pow(t / p.rise, 2.2) : Math.exp(-(t - p.rise) * 2.5));
      const out = mkStereo(n);
      for (let v = 0; v < p.voices; v++) {
        const f = p.lo * Math.pow(p.hi / p.lo, v / (p.voices - 1)) * Math.pow(2, (rng() - 0.5) / 6);
        const fm = new FMVoice();
        const m = gen(n, (t) => fm.next(f, 2.01, 1.5 * env(t)) * env(t) / Math.sqrt(p.voices));
        addInto(out, pan(m, (rng() * 2 - 1) * 0.9));
      }
      const nz = stereoNoise(n, rng, { color: "white", cutoff: { pts: [[0, 2000], [p.rise, 9000]], curve: "exp" }, q: 0.8, mode: "bp", gain: gen(n, (t) => env(t) * p.noise) as any });
      addInto(out, nz);
      return { audio: withTail(out, plate(1.5, 51, 12000, 3000), p.wet), hitOffset: p.rise };
    },
  },

  pupil: {
    doc: "Act 8: soft, muffled organic tightening. hitOffset = hit.",
    peakDb: -8,
    defaults: { dur: 1.4, hit: 0.7, thumpHz: 70 },
    render(p, rng) {
      const n = secs(p.dur);
      const e = (t: number) => (t < p.hit ? Math.pow(t / p.hit, 1.5) : Math.exp(-(t - p.hit) * 8));
      const noise = filteredNoise(n, rng, { color: "brown", cutoff: { pts: [[0, 500], [p.hit, 150]], curve: "exp" }, q: { pts: [[0, 1], [p.hit, 5]] }, mode: "bp", gain: gen(n, (t) => e(t) * 6) as any });
      const o = new Osc("sine");
      const m = gen(n, (t) => {
        const th = t >= p.hit ? 0.5 * Math.sin(TAU * p.thumpHz * (t - p.hit)) * Math.exp(-(t - p.hit) * 12) : 0;
        return noise[Math.floor(t * SR)] * (1 + 0.3 * o.next(9)) + th;
      });
      return { audio: pan(m, 0), hitOffset: p.hit };
    },
  },

  click: {
    doc: "Act 8: molecule click: tiny, dry, mono, centred.",
    peakDb: -18,
    defaults: { freq: 3200 },
    render(p, rng) {
      const n = secs(0.06);
      const nz = new Noise(rng, "white");
      const f = new SVF();
      const o = new Osc("sine");
      const m = gen(n, (t) => (o.next(p.freq) * Math.exp(-t / 0.0012) + f.process(nz.next(), 5000, 2, "bp") * 1.2 * Math.exp(-t / 0.0004)));
      return { audio: mono2(m), hitOffset: 0 };
    },
  },

  pops: {
    doc: "Act 8: soft electrical pops quantised to a scale (semitones above root). One cue per piano onset, or count>1.",
    peakDb: -12,
    defaults: { count: 1, spacing: 0.12, root: 392, scale: [0, 2, 4, 7, 9, 12], crackle: 0.3, decayMs: 14, panSpread: 0.5 },
    render(p, rng) {
      const out = mkStereo(secs(p.count * p.spacing + 0.1));
      for (let i = 0; i < p.count; i++) {
        const f = p.root * Math.pow(2, p.scale[Math.floor(rng() * p.scale.length) % p.scale.length] / 12);
        const len = secs((p.decayMs * 6) / 1000);
        const g = new Float64Array(len);
        const o = new Osc("sine"), o2 = new Osc("sine"), nz = new Noise(rng, "white"), flt = new SVF();
        for (let k = 0; k < len; k++) {
          const t = k / SR;
          g[k] = (o.next(f) + 0.3 * o2.next(f * 2)) * Math.exp((-t * 1000) / p.decayMs) * Math.min(1, t / 0.0003) + flt.process(nz.next(), 4000, 2, "bp") * 1.5 * p.crackle * Math.exp(-t / 0.002);
        }
        stamp(out, g, Math.floor(i * p.spacing * SR), 0.6 + 0.4 * rng(), (rng() * 2 - 1) * p.panSpread);
      }
      return out;
    },
  },

  collapse: {
    doc: "Act 9: every layer converges to one sine and fades with the light.",
    peakDb: -6,
    defaults: { dur: 6, voices: 8, f: 440, spreadSemis: 7, noise: 0.3 },
    render(p, rng) {
      const n = secs(p.dur);
      const conv = (t: number) => Math.pow(1 - Math.min(t / (p.dur * 0.75), 1), 2);
      const fade = lane({ pts: [[0, 1], [p.dur * 0.6, 0.8], [p.dur, 0]], curve: "smooth" });
      const out = mkStereo(n);
      for (let v = 0; v < p.voices; v++) {
        const sw = new Osc("saw", rng()), si = new Osc("sine"), lp = new SVF();
        const semis = (v / (p.voices - 1)) * 2 - 1;
        const m = gen(n, (t) => {
          const f = p.f * Math.pow(2, (semis * p.spreadSemis * conv(t)) / 12);
          const c = conv(t);
          const saw = lp.process(sw.next(f), f * 3, 0.8, "lp");
          return (saw * c * 0.5 + si.next(f) * (1 - c * 0.5)) * fade(t) / Math.sqrt(p.voices);
        });
        addInto(out, pan(m, semis * 0.8 * conv(0)));
      }
      const nz = stereoNoise(n, rng, { color: "pink", cutoff: { pts: [[0, 800], [p.dur, 200]], curve: "exp" }, q: 0.8, mode: "bp", gain: gen(n, (t) => conv(t) * fade(t) * p.noise * 3) as any });
      addInto(out, nz);
      return out;
    },
  },

  voidSilence: {
    doc: "The Void Cut: exact digital silence (all-zero samples).",
    peakDb: 0,
    defaults: { dur: 0.5 },
    render: (p) => ({ audio: mkStereo(secs(p.dur)), hitOffset: 0 }),
  },

  whoosh: {
    doc: "Sweeping noise whoosh with a pan lane (default left to right).",
    peakDb: -6,
    defaults: { dur: 1.2, cutLo: 300, cutHi: 6000, q: 1.2, peakAt: 0.5, pan: null },
    render(p, rng) {
      const n = secs(p.dur);
      const pk = p.peakAt * p.dur;
      const env = (t: number) => (t < pk ? Math.pow(Math.sin((Math.PI / 2) * (t / pk)), 2) : Math.pow(Math.cos((Math.PI / 2) * ((t - pk) / (p.dur - pk))), 2));
      const m = filteredNoise(n, rng, { color: "pink", cutoff: { pts: [[0, p.cutLo], [pk, p.cutHi], [p.dur, p.cutLo * 1.5]], curve: "exp" }, q: p.q, mode: "bp", gain: gen(n, (t) => env(t) * 4) as any });
      return { audio: pan(m, p.pan ?? [[0, -0.9], [p.dur, 0.9]]), hitOffset: pk };
    },
  },

  riser: {
    doc: "Generic build: detuned PolyBLEP saw stack with opening lowpass plus noise. hitOffset = end.",
    peakDb: -6,
    defaults: { dur: 4, fLo: 200, fHi: 2400, voices: 5, detuneCents: 12, noise: 0.4 },
    render(p, rng) {
      const n = secs(p.dur);
      const out = mkStereo(n);
      for (let v = 0; v < p.voices; v++) {
        const o = new Osc("saw", rng()), f = new SVF();
        const det = Math.pow(2, (((v / (p.voices - 1)) * 2 - 1) * p.detuneCents) / 1200);
        const m = gen(n, (t) => {
          const fr = p.fLo * Math.pow(p.fHi / p.fLo, Math.pow(t / p.dur, 1.5));
          return f.process(o.next(fr * det), fr * 4, 1.2, "lp") * Math.pow(t / p.dur, 2) / p.voices * 2;
        });
        addInto(out, pan(m, ((v / (p.voices - 1)) * 2 - 1) * 0.7));
      }
      const nz = stereoNoise(n, rng, { color: "white", cutoff: { pts: [[0, 500], [p.dur, 9000]], curve: "exp" }, q: 0.9, mode: "bp", gain: gen(n, (t) => Math.pow(t / p.dur, 2.5) * p.noise * 2) as any });
      addInto(out, nz);
      return { audio: out, hitOffset: p.dur };
    },
  },

  shepardRise: {
    doc: "Standalone Shepard glissando (stereo, channels offset in phase of the cycle). rate in octaves/s.",
    peakDb: -8,
    defaults: { dur: 8, rate: 0.25, fmin: 27.5, octaves: 9, level: 1 },
    render(p) {
      const n = secs(p.dur);
      const fade = (t: number) => Math.min(1, t / 0.5) * Math.min(1, (p.dur - t) / 0.5);
      const mk = (start: number) => {
        const s = shepard(n, { fmin: p.fmin, octaves: p.octaves, rate: p.rate, amp: p.level, startPos: start });
        for (let i = 0; i < n; i++) s[i] *= fade(i / SR);
        return s;
      };
      return { l: mk(0), r: mk(0.5) };
    },
  },

  granularCloud: {
    doc: "Generic granular cloud (kind sine|saw|noise|tick; dist uniform|gauss|set).",
    peakDb: -8,
    defaults: { dur: 5, kind: "sine", freq: 1200, spread: 12, dist: "gauss", set: [], grainMs: 40, density: 60, panSpread: 1, jitter: 1, amp: null },
    render(p, rng) {
      const out = granular({ dur: p.dur, kind: p.kind, freq: p.freq, pitchSpread: p.spread, dist: p.dist, set: p.set, grainMs: p.grainMs, density: p.density, jitter: p.jitter, panSpread: p.panSpread, amp: p.amp ?? 1 }, rng);
      const fade = (t: number) => Math.min(1, t / 0.2) * Math.min(1, (p.dur - t) / 0.3);
      for (let i = 0; i < out.l.length; i++) { const f = fade(i / SR); out.l[i] *= f; out.r[i] *= f; }
      return out;
    },
  },
};

// ---------------------------------------------------------------- cue rendering

export interface Cue {
  id: string;
  eventId?: string;
  recipe: string;
  params?: P;
  seed?: number;
}
export interface Rendered {
  audio: Stereo;
  wav: Buffer;
  hitOffset: number;
  peak: number;
  rms: number;
}

export function renderCue(cue: Cue): Rendered {
  const rec = recipes[cue.recipe];
  if (!rec) throw new Error(`unknown recipe '${cue.recipe}' (cue ${cue.id}). Known: ${Object.keys(recipes).join(", ")}`);
  const p = { ...rec.defaults, ...(cue.params ?? {}) };
  const res = rec.render(p, mulberry32(cue.seed ?? 1));
  const audio = "audio" in res ? res.audio : res;
  const hitOffset = "audio" in res ? (res.hitOffset ?? 0) : 0;
  const pk = peakOf(audio);
  if (pk > 0) {
    scaleSt(audio, db2lin(Math.min(p.peakDb ?? rec.peakDb, -0.1)) / pk);
    const head = Math.min(audio.l.length, Math.round(0.0005 * SR)), tail = Math.min(audio.l.length, Math.round(0.005 * SR));
    for (let i = 0; i < head; i++) { audio.l[i] *= i / head; audio.r[i] *= i / head; }
    for (let i = 0; i < tail; i++) { const k = audio.l.length - 1 - i; audio.l[k] *= i / tail; audio.r[k] *= i / tail; }
  }
  return { audio, wav: encodeWav(audio), hitOffset, peak: peakOf(audio), rms: rmsOf(audio) };
}

// ---------------------------------------------------------------- CLI

function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main() {
  if (process.argv.includes("--list")) {
    for (const [k, r] of Object.entries(recipes)) console.log(`${k.padEnd(15)} peak ${String(r.peakDb).padStart(4)} dB  ${r.doc}\n${"".padEnd(16)}defaults ${JSON.stringify(r.defaults)}`);
    return;
  }
  const cuesPath = arg("--cues"), outDir = arg("--out");
  if (!cuesPath || !outDir) {
    console.error("usage: bun scripts/sfx/synth.ts --cues sfx_cues.json --out <dir> [--events events.json] | --list");
    process.exit(2);
  }
  const raw = JSON.parse(readFileSync(resolve(cuesPath), "utf8"));
  const cues: Cue[] = Array.isArray(raw) ? raw : raw.cues;
  const evPath = arg("--events");
  const times = new Map<string, number>();
  if (evPath) for (const e of JSON.parse(readFileSync(resolve(evPath), "utf8")).events ?? []) times.set(e.id, e.t);
  const out = resolve(outDir);
  mkdirSync(out, { recursive: true });
  const all: any[] = [];
  for (const cue of cues) {
    const r = renderCue(cue);
    const t = cue.eventId && times.has(cue.eventId) ? times.get(cue.eventId)! : null;
    if (evPath && cue.eventId && t === null) console.warn(`warning: event '${cue.eventId}' (cue ${cue.id}) not found in events file`);
    const m = {
      id: cue.id,
      eventId: cue.eventId ?? null,
      recipe: cue.recipe,
      seed: cue.seed ?? 1,
      file: `${cue.id}.wav`,
      sampleRate: SR,
      bitDepth: 24,
      channels: 2,
      durationSec: r.audio.l.length / SR,
      hitOffsetSec: r.hitOffset,
      peak: r.peak,
      peakDb: Number.isFinite(lin2db(r.peak)) ? lin2db(r.peak) : null,
      rms: r.rms,
      rmsDb: Number.isFinite(lin2db(r.rms)) ? lin2db(r.rms) : null,
      eventTime: t,
      startTime: t === null ? null : t - r.hitOffset,
    };
    writeFileSync(join(out, `${cue.id}.wav`), r.wav);
    writeFileSync(join(out, `${cue.id}.manifest.json`), JSON.stringify(m, null, 2));
    all.push(m);
    console.log(`${cue.id.padEnd(24)} ${cue.recipe.padEnd(14)} ${m.durationSec.toFixed(2)}s peak ${m.peakDb?.toFixed(1)} dB${t !== null ? `  t=${t.toFixed(3)}` : ""}`);
  }
  writeFileSync(join(out, "manifest.json"), JSON.stringify({ cues: all }, null, 2));
}

if (import.meta.main) main();
