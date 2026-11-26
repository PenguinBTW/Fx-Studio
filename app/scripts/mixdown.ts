#!/usr/bin/env bun
// Multi-track mixdown (f(x) Studio v0.8.0 Unified Audiovisual Production Engine)
// Stems & Spatial Sources -> buses -> sidechain duck -> pre-master -> loudnorm two-pass
// -> sample-exact hard-mute gate (applied last, so the zeros survive the limiter).
// ffmpeg only decodes audio files and runs loudnorm; summing, ducking, spatialization,
// and gating are executed on Float32 PCM in memory.
// Docs: docs/audio/mixdown.md, docs/architecture/v0.8.0-unified-audiovisual-production.md

import path from 'node:path';
import { existsSync, mkdirSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  type MixBus,
  type MixConfig,
  type SoundtrackConfig,
  type SpatialSourceConfig,
  type TelemetryFrame,
  assembleSoundtrackStems,
  spatializeSource,
  parseTelemetryStream,
  applyVocalSanctuary,
  applySplitBandDuck,
  applyLookaheadLimiter,
  applyLowLevelLift,
  applyReconstructionLowpass,
  applyDownwardCompressor,
  applyPreDropVacuum,
} from '../src/engine/audio';

export type { MixBus };

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
  stems?: MixStem[];
  soundtracks?: SoundtrackConfig[];
  spatialSources?: SpatialSourceConfig[];
  buses?: Partial<Record<MixBus, { gainDb?: number; vocalSanctuary?: any; splitBandDuck?: any } | any>>;
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
    /** Whether to use split-band ducking preserving sub-bass below splitHz. */
    splitBand?: boolean;
    splitHz?: number;
  };
  vocalSanctuary?: { centerHz?: number; q?: number; cutDb?: number };
  mutes?: MixMute[];
  /** fadeOut: linear master fade over [at, at + dur] in project time (s), applied after loudnorm. */
  master?: { lufs?: number; truePeak?: number; normalize?: boolean; limiterLookaheadMs?: number; limiter?: boolean; reconstructionLowpassHz?: number; fadeOut?: { at: number; dur: number }; lowLevelLift?: { thresholdDb?: number; ratio?: number; maxLiftDb?: number }; downwardCompress?: { thresholdDb?: number; ratio?: number } };
  /** Optional second output: foley_guide bus only. */
  foleyGuide?: { out?: string };
}

export interface MixOptions {
  mix: string | MixManifest | MixConfig;
  /** Directory stem paths are relative to (default: dirname of mix path, else cwd). */
  baseDir?: string;
  events?: string | { events: Array<{ id: string; t: number }> } | null;
  analysisPath?: string;
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
  lowLevelLift?: Record<string, string>;
  reconstructionLowpassHz?: string;
  downwardCompress?: Record<string, string>;
  measuredTruePeak?: string;
  measuredTruePeakPreTrim?: string;
  limiterInputMarginDb?: string;
  truePeakTrimDb?: string;
  truePeakFinalTrimDb?: string;
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

export function applyGate(pcm: Float32Array, regions: Array<{ s0: number; s1: number }>, edgeFadeSamples = 0): void {
  const frames = pcm.length / CH;
  for (const r of regions) {
    const s0 = Math.max(0, Math.min(frames, r.s0));
    const s1 = Math.max(0, Math.min(frames, r.s1));
    if (s1 <= s0) continue;
    if (edgeFadeSamples > 0) {
      const preN = Math.min(edgeFadeSamples, s0);
      const postN = Math.min(edgeFadeSamples, frames - s1);
      for (let k = 0; k < preN; k++) {
        const x = (k + 1) / (preN + 1);
        const g = x * x * (3 - 2 * x);
        const pre = s0 - preN + k;
        for (let c = 0; c < CH; c++) pcm[pre * CH + c] = pcm[pre * CH + c]! * (1 - g);
      }
      for (let k = 0; k < postN; k++) {
        const x = (k + 1) / (postN + 1);
        const g = x * x * (3 - 2 * x);
        const post = s1 + k;
        for (let c = 0; c < CH; c++) pcm[post * CH + c] = pcm[post * CH + c]! * g;
      }
    }
    pcm.fill(0, s0 * CH, s1 * CH);
  }
}

export function placeStem(
  dst: Float32Array,
  src: Float32Array,
  startSample: number,
  gain: number,
  pan: number,
  auto: Array<{ t: number; gainDb: number }> | undefined,
  winFrom: number,
  sr: number,
  opts: { frames?: number } = {}
): void {
  const [gl, gr] = panGains(pan);
  const dstFrames = opts.frames ?? (dst.length / CH);
  const srcFrames = src.length / CH;
  const d0 = Math.max(0, startSample);
  const d1 = Math.min(dstFrames, startSample + srcFrames);
  const sortedAuto = auto && auto.length ? [...auto].sort((a, b) => a.t - b.t) : undefined;
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
  for (const h of hits) {
    const a = Math.max(0, h.s0 - look);
    const b = Math.min(frames, h.s1);
    if (b > a) target.fill(lo, a, b);
  }
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

function computeVoEnvelope(voPcm: Float32Array, sr: number): Float32Array {
  const frames = voPcm.length / CH;
  const env = new Float32Array(frames);
  const attackAlpha = 1 - Math.exp(-1 / (sr * 0.005)); // 5ms attack
  const releaseAlpha = 1 - Math.exp(-1 / (sr * 0.080)); // 80ms release
  let val = 0;
  for (let i = 0; i < frames; i++) {
    const peak = Math.max(Math.abs(voPcm[i * CH] ?? 0), Math.abs(voPcm[i * CH + 1] ?? 0));
    const alpha = peak > val ? attackAlpha : releaseAlpha;
    val += alpha * (peak - val);
    env[i] = Math.min(1.0, val * 3.0);
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

  // Load manifest (supports JSON string path, .ts script export, or direct object)
  let manifest: MixManifest;
  if (typeof o.mix === 'string') {
    const absPath = path.resolve(o.mix);
    if (absPath.endsWith('.ts') || absPath.endsWith('.js')) {
      const mod = await import(absPath);
      manifest = mod.default ?? mod.mix ?? mod;
    } else {
      manifest = JSON.parse(readFileSync(absPath, 'utf8'));
    }
  } else {
    manifest = o.mix as any;
  }

  const baseDir = o.baseDir ?? (typeof o.mix === 'string' ? path.dirname(path.resolve(o.mix)) : process.cwd());
  const sr = manifest.sampleRate ?? 48000;
  const from = o.from ?? 0;
  const dur = o.to - from;
  if (!(dur > 0)) throw new Error(`[mixdown] invalid window ${from}..${o.to}`);
  const frames = Math.round(dur * sr);

  // Parse events (JSON or NDJSON)
  let evJson: any = null;
  let telemetryFrames: TelemetryFrame[] = [];

  if (typeof o.events === 'string') {
    const evFile = path.resolve(o.events);
    if (existsSync(evFile)) {
      const text = readFileSync(evFile, 'utf8').trim();
      if (evFile.endsWith('.jsonl') || (text.startsWith('{') && text.includes('\n{'))) {
        telemetryFrames = parseTelemetryStream(text);
      } else {
        try { evJson = JSON.parse(text); } catch {}
      }
    }
  } else if (o.events) {
    evJson = o.events;
  }

  const ev = new Map<string, number>((evJson?.events ?? []).map((e: any) => [e.id, e.t]));
  const evT = (id: string) => {
    const t = ev.get(id);
    if (t === undefined) throw new Error(`[mixdown] unknown event id '${id}' (not in events.json)`);
    return t;
  };

  const buses: Record<MixBus, Float32Array> = {
    music: new Float32Array(frames * CH),
    sfx: new Float32Array(frames * CH),
    sub: new Float32Array(frames * CH),
    vo: new Float32Array(frames * CH),
    foley_guide: new Float32Array(frames * CH),
    ambient: new Float32Array(frames * CH),
  };

  const report: MixReport = { sampleRate: sr, from, to: o.to, samples: frames, mutes: [], cues: [], duck: [], out: o.out };
  const stemSpan = new Map<string, { s0: number; s1: number; t: number }>();
  const ids = new Set<string>();

  if ((manifest as any).build) {
    const builder = path.resolve(baseDir, (manifest as any).build);
    if (!existsSync(builder)) throw new Error(`[mixdown] missing stem builder ${builder}`);
    await run([process.execPath, builder]);
  }

  // 1. Process Legacy Stems (manifest.stems)
  if (manifest.stems && manifest.stems.length > 0) {
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
  }

  // 2. Process Multi-Stem NLE Soundtracks (manifest.soundtracks)
  if (manifest.soundtracks && manifest.soundtracks.length > 0) {
    const audioJsonPath = o.analysisPath ?? (existsSync(path.resolve(baseDir, 'analysis/audio.json')) ? path.resolve(baseDir, 'analysis/audio.json') : path.resolve(baseDir, '../public/data/audio.json'));
    let audioData: { downbeats: number[]; beats: number[]; bpm?: number } = { downbeats: [0], beats: [0], bpm: 120 };
    if (existsSync(audioJsonPath)) {
      try {
        const aj = JSON.parse(readFileSync(audioJsonPath, 'utf8'));
        audioData = { downbeats: aj.downbeats ?? [0], beats: aj.beats ?? [0], bpm: aj.bpm ?? 120 };
      } catch {}
    }

    for (const track of manifest.soundtracks) {
      log(`[mixdown] Assembling multi-stem soundtrack '${track.id}'...`);
      const assembled = await assembleSoundtrackStems(
        track,
        audioData,
        {
          sampleRate: sr,
          baseDir,
          loader: decodeStereoF32,
        }
      );

      const targetBus: MixBus = track.bus ?? 'music';
      const trackGain = db(track.gainDb ?? 0) * db((manifest.buses as any)?.[targetBus]?.gainDb ?? 0);
      const trackPan = track.pan ?? 0;
      const atSec = track.at ?? 0;
      const start = Math.round((atSec - from) * sr);

      for (const [stemName, src] of Object.entries(assembled)) {
        placeStem(buses[targetBus], src, start, trackGain, trackPan, undefined, from, sr, { frames });
      }
    }
  }

  // 3. Process 3D Spatial Sources (manifest.spatialSources)
  if (manifest.spatialSources && manifest.spatialSources.length > 0) {
    for (const spSrc of manifest.spatialSources) {
      const file = path.resolve(baseDir, spSrc.file);
      if (!existsSync(file)) {
        log(`[mixdown] warning: spatial source '${spSrc.id}' missing file: ${file}`);
        continue;
      }
      log(`[mixdown] Spatializing 3D source '${spSrc.id}' bound to '${spSrc.bindTo}'...`);
      const src = await decodeStereoF32(file, sr);
      const spatialPcm = spatializeSource(src, telemetryFrames, spSrc, { sampleRate: sr });
      const targetBus: MixBus = spSrc.bus ?? 'sfx';
      const busGain = db((manifest.buses as any)?.[targetBus]?.gainDb ?? 0);
      placeStem(buses[targetBus], spatialPcm, 0, busGain, 0, undefined, from, sr, { frames });
    }
  }

  // 4. Bus Ducking
  const busSplitDuck = (manifest.buses as any)?.music?.splitBandDuck;
  const d: MixManifest['duck'] = manifest.duck ?? (busSplitDuck ? {
    bus: 'music' as MixBus,
    cues: busSplitDuck.cues,
    amountDb: Math.abs(busSplitDuck.attenDb ?? 4.5),
    attack: busSplitDuck.attackMs !== undefined ? busSplitDuck.attackMs / 1000 : 0.02,
    release: busSplitDuck.releaseMs !== undefined ? busSplitDuck.releaseMs / 1000 : 0.4,
    splitBand: true,
    splitHz: busSplitDuck.splitHz ?? 250,
  } : undefined);
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
    const busKey = d.bus ?? 'music';
    const bus = buses[busKey];
    const busSplitCfg = (manifest.buses as any)?.[busKey]?.splitBandDuck;
    const isSplit = d.splitBand || busSplitCfg !== undefined;
    if (isSplit) {
      const splitHz = busSplitCfg?.splitHz ?? d.splitHz ?? 250;
      const lo = db(-amount);
      const duckNorm = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        const norm = (1 - env[i]!) / Math.max(1e-6, 1 - lo);
        duckNorm[i] = Math.max(0, Math.min(1, norm));
      }
      buses[busKey] = applySplitBandDuck(bus, duckNorm, {
        splitHz,
        attenDb: -amount,
        sampleRate: sr,
      });
    } else {
      for (let i = 0; i < frames; i++) { bus[i * CH] *= env[i]!; bus[i * CH + 1] *= env[i]!; }
    }
  }

  // 4b. Vocal Sanctuary Dynamic Notch Filter
  const voBus = buses.vo;
  let voHasSignal = false;
  for (let i = 0; i < voBus.length; i++) {
    if (Math.abs(voBus[i]!) > 1e-4) {
      voHasSignal = true;
      break;
    }
  }

  if (voHasSignal) {
    const voEnv = computeVoEnvelope(voBus, sr);
    for (const bName of ['music', 'sfx'] as const) {
      const vsCfg = (manifest.buses as any)?.[bName]?.vocalSanctuary ?? manifest.vocalSanctuary;
      if (vsCfg) {
        log(`[mixdown] Applying Vocal Sanctuary dynamic notch to '${bName}' bus around VO...`);
        buses[bName] = applyVocalSanctuary(buses[bName], voEnv, {
          centerHz: vsCfg.centerHz ?? 2200,
          q: vsCfg.q ?? 1.2,
          cutDb: vsCfg.cutDb ?? -3.5,
          sampleRate: sr,
        });
      }
    }
  }

  // 5. Mutes & Zero Gates
  const regions = (manifest.mutes ?? []).map((m, i) => {
    const a = m.fromEvent !== undefined ? evT(m.fromEvent) : m.from;
    const b = m.toEvent !== undefined ? evT(m.toEvent) : m.to;
    if (a === undefined || b === undefined || !(b > a)) throw new Error(`[mixdown] mute #${i} needs from/to (or fromEvent/toEvent) with to > from`);
    const r = { id: m.id ?? `mute${i}`, from: a, to: b, s0: Math.round((a - from) * sr), s1: Math.round((b - from) * sr) };
    report.mutes.push(r);
    return r;
  });

  // 6. Master Bus Summing
  const pre = new Float32Array(frames * CH);
  for (const k of ['music', 'sfx', 'sub', 'vo', 'ambient'] as const) {
    for (let i = 0; i < pre.length; i++) pre[i] += buses[k][i]!;
  }
  applyGate(pre, regions);

  // 7. EBU R128 Loudnorm Two-Pass & WAV Export
  const tmp = mkdtempSync(path.join(tmpdir(), 'mixdown-'));
  try {
    const outDir = path.dirname(path.resolve(o.out));
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    let master: Float32Array = pre;
    const m = manifest.master ?? {};
    const hasSignal = pre.some((v) => v !== 0);
    if (m.lowLevelLift && hasSignal) {
      const lift = m.lowLevelLift;
      master = applyLowLevelLift(master, lift.thresholdDb ?? -30, lift.ratio ?? 2, lift.maxLiftDb ?? 12, sr);
      report.lowLevelLift = {
        thresholdDb: (lift.thresholdDb ?? -30).toFixed(2),
        ratio: (lift.ratio ?? 2).toFixed(2),
        maxLiftDb: (lift.maxLiftDb ?? 12).toFixed(2),
      };
    }
    if (m.downwardCompress && hasSignal) {
      const comp = m.downwardCompress;
      master = applyDownwardCompressor(master, comp.thresholdDb ?? -30, comp.ratio ?? 2, sr);
      report.downwardCompress = {
        thresholdDb: (comp.thresholdDb ?? -30).toFixed(2),
        ratio: (comp.ratio ?? 2).toFixed(2),
      };
    }
    if (m.reconstructionLowpassHz && hasSignal) {
      master = applyReconstructionLowpass(master, m.reconstructionLowpassHz, sr, CH);
      report.reconstructionLowpassHz = m.reconstructionLowpassHz.toFixed(0);
    }
    if ((m as any).normalize !== false && hasSignal) {
      const I = m.lufs ?? -14;
      // Internal true-peak ceiling sits 0.5 dB under the requested one to absorb the 192k->48k resample.
      const tp = (m.truePeak ?? -1) - 0.5;
      const preWav = path.join(tmp, 'pre.wav');
      writeWav(preWav, master, sr, 32);
      const p1 = await run(['ffmpeg', '-hide_banner', '-nostats', '-i', preWav, '-af', `loudnorm=I=${I}:TP=${tp}:LRA=11:print_format=json`, '-f', 'null', '-']);
      const ms = parseLoudnormJson(p1.err);
      // loudnorm's linear mode refuses high-dynamic-range cinema mixes (hard silence
      // vacuums + loud stingers) and silently falls back to a conservative dynamic
      // normalization several dB below target. The measurement itself is still the
      // correct EBU R128 integrated loudness, so apply that gain explicitly and let
      // the deterministic lookahead limiter below enforce the true-peak ceiling.
      const inputI = Number.parseFloat(ms.input_i);
      const gainDb = Number.isFinite(inputI) ? I - inputI : 0;
      const gain = Math.pow(10, gainDb / 20);
      for (let i = 0; i < master.length; i++) master[i] = master[i]! * gain;
      report.loudnorm = {
        ...ms,
        applied_gain_db: gainDb.toFixed(2),
        normalization_mode: 'ebu_gain_plus_lookahead_limiter',
      };
    } else if (!hasSignal) {
      log('[mixdown] mix is silent: skipping loudnorm');
    }
    // Master lookahead limiter. Sample-peak limiting alone can still overshoot after
    // ffmpeg's 192 kHz true-peak reconstruction, so iterate the deterministic limiter
    // input ceiling downward until the reconstructed waveform complies. This preserves
    // more loudness than a global post-limiter trim while keeping the ceiling strict.
    if (m.limiter !== false && hasSignal) {
      const tpCeiling = m.truePeak ?? -1.0;
      const lookaheadMs = m.limiterLookaheadMs ?? 1.5;
      const preLimit = master;
      const limitedWav = path.join(tmp, 'limited.wav');
      let marginDb = 0;
      let measuredTp = Infinity;
      for (let attempt = 0; attempt < 4; attempt++) {
        master = applyLookaheadLimiter(preLimit, tpCeiling - marginDb, lookaheadMs, sr);
        writeWav(limitedWav, master, sr, 32);
        const tpMeasure = await run(['ffmpeg', '-hide_banner', '-nostats', '-i', limitedWav, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-']);
        const tpMs = parseLoudnormJson(tpMeasure.err);
        measuredTp = Number.parseFloat(tpMs.input_tp);
        report.measuredTruePeakPreTrim = tpMs.input_tp;
        if (!Number.isFinite(measuredTp) || measuredTp <= tpCeiling) break;
        marginDb += measuredTp - tpCeiling + 0.22;
      }
      report.limiterInputMarginDb = marginDb.toFixed(2);
      if (Number.isFinite(measuredTp) && measuredTp > tpCeiling) {
        const trimDb = tpCeiling - measuredTp - 0.05;
        const trim = Math.pow(10, trimDb / 20);
        for (let i = 0; i < master.length; i++) master[i] *= trim;
        report.truePeakTrimDb = trimDb.toFixed(2);
      }
    }
    applyGate(master, regions, Math.round(0.003 * sr));
    if (m.fadeOut && m.fadeOut.dur > 0) {
      const { at, dur: fd } = m.fadeOut;
      for (let i = 0; i < frames; i++) {
        const g = Math.min(1, Math.max(0, 1 - (from + i / sr - at) / fd));
        if (g < 1) { master[i * CH] *= g; master[i * CH + 1] *= g; }
      }
      log(`[mixdown] master fade-out ${at.toFixed(2)}s +${fd.toFixed(2)}s`);
    }
    writeWav(o.out, master, sr, 24);
    if (m.limiter !== false && hasSignal) {
      const measureOut = async () => {
        const finalMeasure = await run(['ffmpeg', '-hide_banner', '-nostats', '-i', o.out, '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-']);
        return Number.parseFloat(parseLoudnormJson(finalMeasure.err).input_tp);
      };
      let finalTp = await measureOut();
      const tpCeiling = m.truePeak ?? -1.0;
      if (Number.isFinite(finalTp) && finalTp > tpCeiling) {
        const trimDb = tpCeiling - finalTp - 0.05;
        const trim = Math.pow(10, trimDb / 20);
        for (let i = 0; i < master.length; i++) master[i] *= trim;
        writeWav(o.out, master, sr, 24);
        report.truePeakFinalTrimDb = trimDb.toFixed(2);
        finalTp = await measureOut();
      }
      report.measuredTruePeak = Number.isFinite(finalTp) ? finalTp.toFixed(2) : undefined;
      if (report.loudnorm && Number.isFinite(finalTp)) {
        // loudnorm's output_* fields are a simulation of the reference ffmpeg chain;
        // this master uses explicit EBU gain plus the lookahead limiter, so report the
        // artifact's measured reconstruction peak instead of the unused simulated value.
        report.loudnorm.output_tp = finalTp.toFixed(2);
      }
    }
    log(`[mixdown] wrote ${o.out} (${frames} samples @ ${sr} Hz, ${dur.toFixed(3)} s)`);

    const foleyOut = o.foleyOut ?? (manifest.foleyGuide?.out ? path.resolve(baseDir, manifest.foleyGuide.out) : undefined);
    if (foleyOut) {
      const g = buses.foley_guide;
      applyGate(g, regions, Math.round(0.003 * sr));
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
  const mix = opt('mix'), out = opt('out'), to = opt('to'), analysis = opt('analysis');
  if (!mix || !out || to === undefined) {
    console.error('usage: bun scripts/mixdown.ts --mix mix.json --to <s> [--from 0] [--events events.json] [--analysis audio.json] --out mix.wav [--foley-out guide.wav]');
    process.exit(2);
  }
  await mixdown({
    mix,
    to: +to,
    from: +(opt('from') ?? 0),
    events: opt('events') ?? null,
    analysisPath: analysis ? path.resolve(analysis) : undefined,
    out: path.resolve(out),
    foleyOut: opt('foley-out') ? path.resolve(opt('foley-out')!) : undefined,
  });
}
