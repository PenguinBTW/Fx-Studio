// Stem Non-Linear Editor & Timeline Assembly (f(x) Studio v0.8.0)
// High-precision multi-stem timeline assembly in pure Bun/TypeScript operating on Float32Array stereo PCM buffers.

import type { SoundtrackConfig, Excision, StemEditOptions } from './manifest';

function resolvePath(base?: string, rel?: string): string {
  if (!base || !rel) return rel ?? '';
  if (rel.startsWith('/') || rel.startsWith('\\') || /^[a-zA-Z]:/.test(rel)) return rel;
  const sep = base.includes('\\') ? '\\' : '/';
  return base.endsWith('/') || base.endsWith('\\') ? `${base}${rel}` : `${base}${sep}${rel}`;
}

/**
 * Pre-attack kick transient lock offset in milliseconds (-2.38ms, ~114 samples at 48kHz).
 * Ensures downbeat transient pre-rings are never clipped or comb-filtered across Demucs stems.
 */
export const PRE_ATTACK_KICK_OFFSET_MS = -2.38;

/**
 * Seam fade-out duration in milliseconds (3ms asymmetric cosine fade-out).
 */
export const SEAM_FADE_OUT_MS = 3.0;

/**
 * Default harmonic tail spillover duration in seconds.
 */
export const DEFAULT_SPILL_SEC = 2.0;

/**
 * Default harmonic tail analytical decay time constant (tau) in seconds.
 */
export const DEFAULT_TAU_SEC = 0.7;

/**
 * Default search radius in milliseconds for vocal breath gate zero-crossing detection.
 */
export const BREATH_GATE_SEARCH_MS = 120.0;

export interface AudioTimeData {
  downbeats: number[];
  beats?: number[];
  bpm?: number;
}

export interface AssembleOptions {
  sampleRate: number;
  baseDir?: string;
  loader: (file: string, sr: number) => Promise<Float32Array>;
}

export interface StemSegmentPlan {
  fromSourceFrame: number;
  toSourceFrame: number;
  isCutOut: boolean;
  isResumption: boolean;
  spillSourceFrame?: number;
}

/**
 * Converts a bar index (0-based) to time in seconds using downbeats analysis or BPM extrapolation.
 */
export function barToSeconds(barIndex: number, downbeats: number[], beats?: number[], bpm = 120): number {
  if (barIndex <= 0) {
    return downbeats.length > 0 && downbeats[0] !== undefined ? Math.max(0, downbeats[0]) : 0;
  }

  if (barIndex < downbeats.length && downbeats[barIndex] !== undefined) {
    return downbeats[barIndex]!;
  }

  // Extrapolate beyond existing downbeats array
  if (downbeats.length > 0) {
    const lastIdx = downbeats.length - 1;
    const lastTime = downbeats[lastIdx]!;
    const barDuration = beats && beats.length >= 4
      ? (beats[beats.length - 1]! - beats[0]!) / Math.max(1, (beats.length - 1) / 4)
      : (60 / bpm) * 4;
    return lastTime + (barIndex - lastIdx) * barDuration;
  }

  const barDuration = (60 / bpm) * 4;
  return barIndex * barDuration;
}

/**
 * Converts seconds to PCM sample frame count at given sample rate.
 */
export function secondsToSamples(seconds: number, sampleRate: number): number {
  return Math.max(0, Math.round(seconds * sampleRate));
}

/**
 * Resolves a bar index (0-based) directly to a sample frame index.
 */
export function barToSample(
  barIndex: number,
  downbeats: number[],
  sampleRate: number,
  beats?: number[],
  bpm = 120,
): number {
  const sec = barToSeconds(barIndex, downbeats, beats, bpm);
  return secondsToSamples(sec, sampleRate);
}

/**
 * Calculates the exact pre-attack transient lock sample offset for a sample rate.
 */
export function getPreAttackKickOffsetSamples(sampleRate: number): number {
  return Math.round((PRE_ATTACK_KICK_OFFSET_MS / 1000) * sampleRate);
}

/**
 * Ensures a PCM buffer is stereo interleaved Float32Array (channels = 2, length = frames * 2).
 */
export function ensureStereoBuffer(buffer: Float32Array, isMono = false): Float32Array {
  if (!isMono && buffer.length % 2 === 0) {
    return buffer;
  }

  // Convert mono to interleaved stereo [L0, R0, L1, R1, ...]
  const frames = buffer.length;
  const stereo = new Float32Array(frames * 2);
  for (let i = 0; i < frames; i++) {
    const s = buffer[i]!;
    stereo[i * 2] = s;
    stereo[i * 2 + 1] = s;
  }
  return stereo;
}

/**
 * Calculates total stereo frames in an interleaved stereo Float32Array.
 */
export function getStereoFrameCount(buffer: Float32Array): number {
  return Math.floor(buffer.length / 2);
}

/**
 * Applies a 3ms asymmetric cosine fade-out to the end of a stereo PCM segment in-place.
 */
export function applyAsymmetricCosineFadeOut(
  buffer: Float32Array,
  startFrame: number,
  fadeFrames: number,
): void {
  const totalFrames = getStereoFrameCount(buffer);
  const actualFrames = Math.min(fadeFrames, totalFrames - startFrame);
  if (actualFrames <= 0) return;

  for (let i = 0; i < actualFrames; i++) {
    const t = i / actualFrames;
    // Cosine fade-out from 1.0 to 0.0: cos(t * pi / 2)
    const gain = Math.cos((t * Math.PI) / 2);
    const frameIdx = startFrame + i;
    buffer[frameIdx * 2] *= gain;
    buffer[frameIdx * 2 + 1] *= gain;
  }
}

/**
 * Detects the nearest zero-crossing or low-energy boundary before targetCutFrame to prevent breath chops.
 */
export function findBreathGateBoundary(
  buffer: Float32Array,
  targetCutFrame: number,
  searchRadiusFrames: number,
): number {
  const totalFrames = getStereoFrameCount(buffer);
  const end = Math.min(totalFrames - 1, targetCutFrame);
  const start = Math.max(0, end - searchRadiusFrames);

  if (start >= end) return targetCutFrame;

  let bestFrame = targetCutFrame;
  let minAmp = Infinity;

  // Search backwards for the lowest absolute amplitude zero-crossing
  for (let f = end; f >= start; f--) {
    const l = Math.abs(buffer[f * 2] ?? 0);
    const r = Math.abs(buffer[f * 2 + 1] ?? 0);
    const amp = Math.max(l, r);

    if (amp < 0.001) {
      // True zero-crossing found
      return f;
    }

    if (amp < minAmp) {
      minAmp = amp;
      bestFrame = f;
    }
  }

  return bestFrame;
}

/**
 * Additively blends an analytically decaying harmonic tail (exp(-t / tau)) over destination buffer.
 */
export function blendDecayingTail(
  dest: Float32Array,
  destStartFrame: number,
  src: Float32Array,
  srcStartFrame: number,
  spillFrames: number,
  tauSec: number,
  sampleRate: number,
): void {
  const destTotalFrames = getStereoFrameCount(dest);
  const srcTotalFrames = getStereoFrameCount(src);

  const framesToBlend = Math.min(
    spillFrames,
    destTotalFrames - destStartFrame,
    srcTotalFrames - srcStartFrame,
  );

  if (framesToBlend <= 0) return;

  const invTau = 1.0 / Math.max(0.001, tauSec);
  const dt = 1.0 / sampleRate;

  for (let i = 0; i < framesToBlend; i++) {
    const t = i * dt;
    const decay = Math.exp(-t * invTau);

    const dIdx = (destStartFrame + i) * 2;
    const sIdx = (srcStartFrame + i) * 2;

    dest[dIdx] = (dest[dIdx] ?? 0) + (src[sIdx] ?? 0) * decay;
    dest[dIdx + 1] = (dest[dIdx + 1] ?? 0) + (src[sIdx + 1] ?? 0) * decay;
  }
}

/**
 * Applies gain in dB and constant-power stereo pan to an interleaved stereo buffer.
 */
export function applyGainAndPan(
  buffer: Float32Array,
  gainDb?: number,
  pan?: number,
): void {
  if (gainDb === undefined && pan === undefined) return;

  const linearGain = gainDb !== undefined ? Math.pow(10, gainDb / 20) : 1.0;
  const panVal = pan !== undefined ? Math.max(-1, Math.min(1, pan)) : 0.0;

  // Constant-power panning law: L = cos((pan + 1) * pi / 4), R = sin((pan + 1) * pi / 4)
  const angle = ((panVal + 1.0) * Math.PI) / 4;
  const panL = Math.cos(angle) * Math.SQRT2;
  const panR = Math.sin(angle) * Math.SQRT2;

  const gainL = linearGain * panL;
  const gainR = linearGain * panR;

  const totalFrames = getStereoFrameCount(buffer);
  for (let f = 0; f < totalFrames; f++) {
    buffer[f * 2] *= gainL;
    buffer[f * 2 + 1] *= gainR;
  }
}

/**
 * Compiles an excision plan into continuous sample frame segments with transient lock offsets.
 */
export function planExcisionSegments(
  totalSourceFrames: number,
  excisions: Excision[],
  downbeats: number[],
  sampleRate: number,
  beats?: number[],
  bpm = 120,
): StemSegmentPlan[] {
  if (excisions.length === 0) {
    return [
      {
        fromSourceFrame: 0,
        toSourceFrame: totalSourceFrames,
        isCutOut: false,
        isResumption: false,
      },
    ];
  }

  // Sort excisions by fromBar ascending
  const sortedExcisions = [...excisions].sort((a, b) => a.fromBar - b.fromBar);
  const preAttackOffset = getPreAttackKickOffsetSamples(sampleRate);
  const plans: StemSegmentPlan[] = [];

  let currentSourceFrame = 0;

  for (let i = 0; i < sortedExcisions.length; i++) {
    const ex = sortedExcisions[i]!;
    const cutOutFrame = barToSample(ex.fromBar, downbeats, sampleRate, beats, bpm);
    const resumeBarFrame = barToSample(ex.toBar, downbeats, sampleRate, beats, bpm);

    // Apply collective Master Transient Lock to resumption point
    const lockedResumptionFrame = Math.max(0, resumeBarFrame + preAttackOffset);

    if (cutOutFrame > currentSourceFrame) {
      plans.push({
        fromSourceFrame: currentSourceFrame,
        toSourceFrame: Math.min(totalSourceFrames, cutOutFrame),
        isCutOut: true,
        isResumption: i > 0,
        spillSourceFrame: cutOutFrame,
      });
    }

    currentSourceFrame = Math.min(totalSourceFrames, lockedResumptionFrame);
  }

  if (currentSourceFrame < totalSourceFrames) {
    plans.push({
      fromSourceFrame: currentSourceFrame,
      toSourceFrame: totalSourceFrames,
      isCutOut: false,
      isResumption: plans.length > 0,
    });
  }

  return plans;
}

/**
 * Assembles multi-stem soundtrack audio according to MixConfig excision rules,
 * collective Master Transient Lock, seam crossfades, harmonic tail spillovers,
 * and vocal breath gating.
 */
export async function assembleSoundtrackStems(
  soundtrack: SoundtrackConfig,
  audioData: AudioTimeData,
  options: AssembleOptions,
): Promise<Record<string, Float32Array>> {
  const { sampleRate, loader } = options;
  const { downbeats, beats, bpm = 120 } = audioData;

  const stemKeys = Object.keys(soundtrack.stems);
  if (stemKeys.length === 0) {
    return {};
  }

  // 1. Load all raw stem buffers
  const rawStems: Record<string, Float32Array> = {};
  let maxSourceFrames = 0;

  for (const [stemName, stemPath] of Object.entries(soundtrack.stems)) {
    const resolvedPath = resolvePath(options.baseDir, stemPath);
    const raw = await loader(resolvedPath, sampleRate);
    const stereo = ensureStereoBuffer(raw);
    rawStems[stemName] = stereo;
    const frames = getStereoFrameCount(stereo);
    if (frames > maxSourceFrames) {
      maxSourceFrames = frames;
    }
  }

  const excisions = soundtrack.edits?.excise ?? [];
  const fadeOutFrames = Math.round((SEAM_FADE_OUT_MS / 1000) * sampleRate);
  const breathSearchFrames = Math.round((BREATH_GATE_SEARCH_MS / 1000) * sampleRate);

  // 2. Compute master segment plan
  const segmentPlans = planExcisionSegments(
    maxSourceFrames,
    excisions,
    downbeats,
    sampleRate,
    beats,
    bpm,
  );

  // Calculate total destination frames
  let totalDestFrames = 0;
  for (const seg of segmentPlans) {
    totalDestFrames += Math.max(0, seg.toSourceFrame - seg.fromSourceFrame);
  }

  // 3. Assemble each stem
  const assembledStems: Record<string, Float32Array> = {};

  for (const stemName of stemKeys) {
    const srcBuf = rawStems[stemName]!;
    const srcTotalFrames = getStereoFrameCount(srcBuf);

    // Find specific stem edit options from excisions if present
    const isVocals = stemName === 'vocals';
    const isHarmonicOther = stemName === 'other';

    // Allocate assembled stereo buffer
    const destBuf = new Float32Array(totalDestFrames * 2);
    let destOffsetFrame = 0;

    for (let sIdx = 0; sIdx < segmentPlans.length; sIdx++) {
      const seg = segmentPlans[sIdx]!;
      let segFrom = Math.min(srcTotalFrames, seg.fromSourceFrame);
      let segTo = Math.min(srcTotalFrames, seg.toSourceFrame);

      // Vocal Breath Gate: check if seam needs gentle zero-crossing alignment
      if (isVocals && seg.isCutOut) {
        segTo = findBreathGateBoundary(srcBuf, segTo, breathSearchFrames);
      }

      const segFrames = Math.max(0, segTo - segFrom);
      if (segFrames > 0) {
        // Copy segment frames to destination
        const srcByteOffset = segFrom * 2;
        const srcByteLength = segFrames * 2;
        destBuf.set(srcBuf.subarray(srcByteOffset, srcByteOffset + srcByteLength), destOffsetFrame * 2);

        // Seam crossfade: apply 3ms asymmetric cosine fade-out at cut-out
        if (seg.isCutOut) {
          const fadeStart = destOffsetFrame + segFrames - fadeOutFrames;
          if (fadeStart >= destOffsetFrame) {
            applyAsymmetricCosineFadeOut(destBuf, fadeStart, fadeOutFrames);
          }
        }
      }

      const currentDestSeam = destOffsetFrame + segFrames;

      // Tail Spillover: for harmonic stems, blend decaying tail from excised region past the cut
      if ((isHarmonicOther || excisions[sIdx]?.stems?.other?.tailSpillover) && seg.isCutOut && seg.spillSourceFrame !== undefined) {
        const spillOptions = excisions[sIdx]?.stems?.other?.tailSpillover;
        const spillSec = spillOptions?.spillSec ?? DEFAULT_SPILL_SEC;
        const tauSec = spillOptions?.tauSec ?? DEFAULT_TAU_SEC;
        const spillFrames = Math.round(spillSec * sampleRate);

        blendDecayingTail(
          destBuf,
          currentDestSeam,
          srcBuf,
          seg.spillSourceFrame,
          spillFrames,
          tauSec,
          sampleRate,
        );
      }

      destOffsetFrame = currentDestSeam;
    }

    // Apply soundtrack-level gain and pan
    applyGainAndPan(destBuf, soundtrack.gainDb, soundtrack.pan);
    assembledStems[stemName] = destBuf;
  }

  return assembledStems;
}
