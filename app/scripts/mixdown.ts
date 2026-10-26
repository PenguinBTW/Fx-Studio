#!/usr/bin/env bun
// Multi-track mixdown (P3d). Stems -> buses -> sidechain duck -> pre-master -> loudnorm two-pass
// -> sample-exact hard-mute gate (applied last, so the zeros survive the limiter).
// ffmpeg only decodes stems and runs loudnorm; summing, ducking and gating are done on PCM here
// because ffmpeg cannot guarantee exact digital zero after resampling/limiting.
//   bun scripts/mixdown.ts --mix mix.json [--events events.json] [--from 0] [--to 120] --out mix.wav [--foley-out guide.wav]
// Docs: docs/audio/mixdown.md
import path from 'node:path';
import { existsSync, mkdirSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

export type MixBus = 'music' | 'sfx' | 'sub' | 'foley_guide';

export interface MixStem {
  id: string;
  file: string;
  bus: MixBus;
  gainDb?: number;
  /** -1 (left) .. 1 (right); equal-power, unity at centre. */
  pan?: number;
  /** Absolute project time (s) at which the stem file's t=0 plays. Default 0. */
  at?: number;
  /** Place at the resolved time of this event (events.json). */
  eventId?: string;
  /** Seconds added to the event/at time. */
  offset?: number;
  /** Seconds into the file where the hit lands; placement is shifted so this lands on the event. */
  onset?: number;
  /** Gain automation in dB over project time (linear interpolation, held outside the range). */
  automation?: Array<{ t: number; gainDb: number }>;
}

export interface MixMute {
  id?: string;
  /** Project time (s) or events.json ids. [from, to) in samples. */
  from?: number;
  to?: number;
  fromEvent?: string;
  toEvent?: string;
}

export interface MixManifest {
  sampleRate?: number;
  stems: MixStem[];
  buses?: Partial<Record<MixBus, { gainDb?: number }>>;
  duck?: {
    bus?: MixBus;
    /** Stem ids or event ids; ducks while the cue plays. */
    cues: string[];
    amountDb?: number;
    /** Seconds to reach ~95% of the duck; ducking starts this long before the cue. */
    attack?: number;
    release?: number;
    /** Seconds the duck is held from cue start. Default: the cue stem's duration. */
    hold?: number;
  };
  mutes?: MixMute[];
  master?: { lufs?: number; truePeak?: number; normalize?: boolean };
  /** Optional second output: foley_guide bus only. */
  foleyGuide?: { out?: string };
}

export interface MixOptions {
  mix: string | MixManifest;
  /** Directory stem paths are relative to (default: dirname of mix path, else cwd). */
  baseDir?: string;
  events?: string | { events: Array<{ id: string; t: number }> } | null;
  from?: number;
  to: number;
  out: string;
  foleyOut?: string;
  keepTemp?: boolean;
  log?: (m: string) => void;
}

export interface MixReport {
  sampleRate: number;
  from: number;
  to: number;
  samples: number;
  mutes: Array<{ id: string; from: number; to: number; s0: number; s1: number }>;
  cues: Array<{ stem: string; eventId?: string; expectedT: number; onset: number }>;
  duck: Array<{ cue: string; t: number; hold: number }>;
  loudnorm?: Record<string, string>;
  out: string;
  foleyOut?: string;
}

const CH = 2;
const db = (x: number) => Math.pow(10, x / 20);

async function run(cmd: string[], stdin?: Uint8Array): Promise<{ out: Uint8Array; err: string }> {
  const p = Bun.spawn(cmd, { stdin: stdin ? new Blob([stdin as BlobPart]) : 'ignore', stdout: 'pipe', stderr: 'pipe' });
  const [out, err] = await Promise.all([new Response(p.stdout).arrayBuffer(), new Response(p.stderr).text(), p.exited]);
  if (p.exitCode !== 0) throw new Error(`${cmd[0]} failed (${p.exitCode}): ${err.slice(-600)}`);
  return { out: new Uint8Array(out), err };
}

export async function decodeStereoF32(file: string, sr: number): Promise<Float32Array> {
  const { out } = await run(['ffmpeg', '-v', 'error', '-i', file, '-vn', '-ac', String(CH), '-ar', String(sr), '-f', 'f32le', '-']);
  return new Float32Array(out.buffer, out.byteOffset, Math.floor(out.byteLength / 4));
}

export function writeWav(file: string, data: Float32Array, sr: number, bits: 24 | 32 = 24): void {
  const bytes = bits / 8;
  const n = data.length;
  const buf = Buffer.alloc(44 + n * bytes);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * bytes, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(bits === 32 ? 3 : 1, 20);
  buf.writeUInt16LE(CH, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * CH * bytes, 28);
  buf.writeUInt16LE(CH * bytes, 32); buf.writeUInt16LE(bits, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * bytes, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    if (bits === 32) { buf.writeFloatLE(data[i]!, o); o += 4; continue; }
    const v = Math.max(-1, Math.min(1, data[i]!));
    const q = Math.max(-8388608, Math.min(8388607, Math.round(v * 8388608)));
    buf.writeIntLE(q, o, 3); o += 3;
  }
  writeFileSync(file, buf);
}

/** Equal-power balance, unity at centre. */
export function panGains(pan: number): [number, number] {
  const th = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(th) * Math.SQRT2, Math.sin(th) * Math.SQRT2];
}

function evalAutomationDb(a: Array<{ t: number; gainDb: number }>, t: number): number {
  if (t <= a[0]!.t) return a[0]!.gainDb;
  for (let i = 1; i < a.length; i++) {
    if (t <= a[i]!.t) {
      const p = a[i - 1]!, q = a[i]!;
      const k = q.t === p.t ? 1 : (t - p.t) / (q.t - p.t);
      return p.gainDb + (q.gainDb - p.gainDb) * k;
    }
  }
  return a[a.length - 1]!.gainDb;
}

/** Zero [s0, s1) in every channel (interleaved stereo). Exact: writes literal 0. */
export function applyGate(buf: Float32Array, regions: Array<{ s0: number; s1: number }>): void {
  const frames = buf.length / CH;
  for (const r of regions) {
    const a = Math.max(0, r.s0), b = Math.min(frames, r.s1);
    if (b > a) buf.fill(0, a * CH, b * CH);
  }
}

function placeStem(
  dst: Float32Array, src: Float32Array, startSample: number, gain: number, pan: number,
  auto: MixStem['automation'] | undefined, winFrom: number, sr: number, pos: { frames: number },
) {
  const [gl, gr] = panGains(pan);
  const srcFrames = src.length / CH;
  const d0 = Math.max(0, startSample);
  const d1 = Math.min(pos.frames, startSample + srcFrames);
  const sortedAuto = auto && auto.length > 1 ? auto.slice().sort((p, q) => p.t - q.t) : auto;
  for (let d = d0; d < d1; d++) {
    const s = d - startSample;
    let g = gain;
    if (sortedAuto && sortedAuto.length) g *= db(evalAutomationDb(sortedAuto, winFrom + d / sr));
    dst[d * CH] += src[s * CH]! * g * gl;
    dst[d * CH + 1] += src[s * CH + 1]! * g * gr;
  }
}

function duckEnvelope(frames: number, sr: number, hits: Array<{ s0: number; s1: number }>, amountDb: number, attack: number, release: number): Float32Array {
  const target = new Float32Array(frames).fill(1);
  const lo = db(-amountDb);
  const look = Math.round(attack * sr);
  for (const h of hits) target.fill(lo, Math.max(0, h.s0 - look), Math.min(frames, h.s1));
  const ca = Math.exp(-3 / Math.max(1, attack * sr));
  const cr = Math.exp(-3 / Math.max(1, release * sr));
  const env = new Float32Array(frames);
  let g = 1;
  for (let i = 0; i < frames; i++) {
    const c = target[i]! < g ? ca : cr;
    g = target[i]! + (g - target[i]!) * c;
    env[i] = g;
  }
  return env;
}

function parseLoudnormJson(err: string): Record<string, string> {
  const m = err.match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (!m) throw new Error('[mixdown] could not parse loudnorm measurement');
  return JSON.parse(m[0]);
}

export async function mixdown(o: MixOptions): Promise<MixReport> {
  const log = o.log ?? ((m: string) => console.log(m));
  const manifest: MixManifest = typeof o.mix === 'string' ? JSON.parse(readFileSync(o.mix, 'utf8')) : o.mix;
  const baseDir = o.baseDir ?? (typeof o.mix === 'string' ? path.dirname(path.resolve(o.mix)) : process.cwd());
  const sr = manifest.sampleRate ?? 48000;
  const from = o.from ?? 0;
  const dur = o.to - from;
  if (!(dur > 0)) throw new Error(`[mixdown] invalid window ${from}..${o.to}`);
  const frames = Math.round(dur * sr);
  const evJson = typeof o.events === 'string' ? JSON.parse(readFileSync(o.events, 'utf8')) : o.events;
  const ev = new Map<string, number>((evJson?.events ?? []).map((e: any) => [e.id, e.t]));
  const evT = (id: string) => {
    const t = ev.get(id);
    if (t === undefined) throw new Error(`[mixdown] unknown event id '${id}' (not in events.json)`);
    return t;
  };

  const buses: Record<MixBus, Float32Array> = {
    music: new Float32Array(frames * CH), sfx: new Float32Array(frames * CH),
    sub: new Float32Array(frames * CH), foley_guide: new Float32Array(frames * CH),
  };
  const report: MixReport = { sampleRate: sr, from, to: o.to, samples: frames, mutes: [], cues: [], duck: [], out: o.out };
  const stemSpan = new Map<string, { s0: number; s1: number; t: number }>();
  const ids = new Set<string>();

  for (const stemDecl of manifest.stems) {
    let st = stemDecl;
    if (ids.has(st.id)) throw new Error(`[mixdown] duplicate stem id '${st.id}'`);
    ids.add(st.id);
    if (!buses[st.bus]) throw new Error(`[mixdown] stem '${st.id}': unknown bus '${st.bus}'`);
    const file = path.resolve(baseDir, st.file);
    if (!existsSync(file)) throw new Error(`[mixdown] stem '${st.id}': missing file ${file}`);
    const base = st.eventId !== undefined ? evT(st.eventId) : (st.at ?? 0);
    if (st.onset === undefined) {
      const side = file.replace(/\.wav$/i, '.manifest.json');
      if (side !== file && existsSync(side)) {
        const hit = JSON.parse(readFileSync(side, 'utf8')).hitOffsetSec;
        if (typeof hit === 'number' && hit > 0) st = { ...st, onset: hit };
      }
    }
    const tPlay = base + (st.offset ?? 0) - (st.onset ?? 0);
    const src = await decodeStereoF32(file, sr);
    const start = Math.round((tPlay - from) * sr);
    const busGain = db(manifest.buses?.[st.bus]?.gainDb ?? 0);
    placeStem(buses[st.bus], src, start, db(st.gainDb ?? 0) * busGain, st.pan ?? 0, st.automation, from, sr, { frames });
    const span = { s0: start, s1: start + src.length / CH, t: base + (st.offset ?? 0) };
    stemSpan.set(st.id, span);
    if (st.bus !== 'foley_guide' && (st.eventId !== undefined || st.onset !== undefined)) {
      report.cues.push({ stem: st.id, eventId: st.eventId, expectedT: span.t, onset: st.onset ?? 0 });
    }
  }

  const d = manifest.duck;
  if (d) {
    const amount = d.amountDb ?? 4;
    if (!(amount > 0 && amount <= 12)) throw new Error(`[mixdown] duck.amountDb ${amount} out of range (0,12]`);
    if (amount < 3 || amount > 6) log(`[mixdown] warning: duck amount ${amount} dB is outside the usual 3..6 dB`);
    const hits: Array<{ s0: number; s1: number }> = [];
    for (const c of d.cues) {
      let t: number, hold = d.hold;
      const sp = stemSpan.get(c);
      if (sp) { t = sp.t; hold ??= (sp.s1 - sp.s0) / sr; }
      else { t = evT(c); hold ??= 0.5; }
      const s0 = Math.round((t - from) * sr);
      hits.push({ s0, s1: s0 + Math.round(hold * sr) });
      report.duck.push({ cue: c, t, hold });
    }
    const env = duckEnvelope(frames, sr, hits, amount, d.attack ?? 0.02, d.release ?? 0.4);
    const bus = buses[d.bus ?? 'music'];
    for (let i = 0; i < frames; i++) { bus[i * CH] *= env[i]!; bus[i * CH + 1] *= env[i]!; }
  }

  const regions = (manifest.mutes ?? []).map((m, i) => {
    const a = m.fromEvent !== undefined ? evT(m.fromEvent) : m.from;
    const b = m.toEvent !== undefined ? evT(m.toEvent) : m.to;
    if (a === undefined || b === undefined || !(b > a)) throw new Error(`[mixdown] mute #${i} needs from/to (or fromEvent/toEvent) with to > from`);
    const r = { id: m.id ?? `mute${i}`, from: a, to: b, s0: Math.round((a - from) * sr), s1: Math.round((b - from) * sr) };
    report.mutes.push(r);
    return r;
  });

  const pre = new Float32Array(frames * CH);
  for (const k of ['music', 'sfx', 'sub'] as const) for (let i = 0; i < pre.length; i++) pre[i] += buses[k][i]!;
  applyGate(pre, regions);

  const tmp = mkdtempSync(path.join(tmpdir(), 'mixdown-'));
  try {
    const outDir = path.dirname(path.resolve(o.out));
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    let master = pre;
    const m = manifest.master ?? {};
    const hasSignal = pre.some((v) => v !== 0);
    if (m.normalize !== false && hasSignal) {
      const I = m.lufs ?? -14;
      // Internal true-peak ceiling sits 0.5 dB under the requested one to absorb the 192k->48k resample.
      const tp = (m.truePeak ?? -1) - 0.5;
      const preWav = path.join(tmp, 'pre.wav');
      writeWav(preWav, pre, sr, 32);
      const p1 = await run(['ffmpeg', '-hide_banner', '-nostats', '-i', preWav, '-af', `loudnorm=I=${I}:TP=${tp}:LRA=11:print_format=json`, '-f', 'null', '-']);
      const ms = parseLoudnormJson(p1.err);
      report.loudnorm = ms;
      const ln = `loudnorm=I=${I}:TP=${tp}:LRA=11:measured_I=${ms.input_i}:measured_TP=${ms.input_tp}:measured_LRA=${ms.input_lra}:measured_thresh=${ms.input_thresh}:offset=${ms.target_offset}:linear=true`;
      const normWav = path.join(tmp, 'norm.wav');
      await run(['ffmpeg', '-v', 'error', '-y', '-i', preWav, '-af', `${ln},aresample=${sr},apad=whole_len=${frames},atrim=end_sample=${frames}`, '-c:a', 'pcm_f32le', normWav]);
      const dec = await decodeStereoF32(normWav, sr);
      master = new Float32Array(frames * CH);
      master.set(dec.subarray(0, Math.min(dec.length, master.length)));
    } else if (!hasSignal) {
      log('[mixdown] mix is silent: skipping loudnorm');
    }
    applyGate(master, regions);
    writeWav(o.out, master, sr, 24);
    log(`[mixdown] wrote ${o.out} (${frames} samples @ ${sr} Hz, ${dur.toFixed(3)} s)`);

    const foleyOut = o.foleyOut ?? (manifest.foleyGuide?.out ? path.resolve(baseDir, manifest.foleyGuide.out) : undefined);
    if (foleyOut) {
      const g = buses.foley_guide;
      applyGate(g, regions);
      writeWav(foleyOut, g, sr, 24);
      report.foleyOut = foleyOut;
      log(`[mixdown] wrote ${foleyOut} (foley_guide only)`);
    }
    report.out = o.out;
    writeFileSync(o.out.replace(/\.wav$/i, '') + '.mix_report.json', JSON.stringify(report, null, 2));
  } finally {
    if (!o.keepTemp) rmSync(tmp, { recursive: true, force: true });
  }
  return report;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const opt = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const mix = opt('mix'), out = opt('out'), to = opt('to');
  if (!mix || !out || to === undefined) {
    console.error('usage: bun scripts/mixdown.ts --mix mix.json --to <s> [--from 0] [--events events.json] --out mix.wav [--foley-out guide.wav]');
    process.exit(2);
  }
  await mixdown({ mix, to: +to, from: +(opt('from') ?? 0), events: opt('events') ?? null, out: path.resolve(out), foleyOut: opt('foley-out') ? path.resolve(opt('foley-out')!) : undefined });
}
