// 3D Spatial Audio Processor & Air Absorption DSP (f(x) Studio v0.8.0)
// Pure Bun/TypeScript Float32 PCM spatializer with zero-delay Cytomic SVF filtering,
// distance attenuation, vector panning, and smooth k-rate to a-rate parameter interpolation.

import type { SpatialSourceConfig, SpatialConfig, ModulationConfig } from './manifest';
import type { TelemetryFrame, AudioTelemetryPoint } from './telemetry';
import { ParameterSmoother, createPanSmoother, createGainSmoother, createCutoffSmoother } from './smoother';

/**
 * 2-Pole Zero-Delay Feedback Cytomic State Variable Filter (SVF)
 * Provides unconditionally stable, alias-free lowpass filtering up to Nyquist.
 */
export class CytomicSVF {
  private s1 = 0;
  private s2 = 0;
  private g = 0;
  private k = 0;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;

  constructor(public sampleRate = 48000) {
    this.setCutoffAndQ(20000, 0.7071);
  }

  public setCutoffAndQ(cutoffHz: number, q = 0.7071): void {
    const clampedCutoff = Math.max(20, Math.min(this.sampleRate * 0.48, cutoffHz));
    this.g = Math.tan((Math.PI * clampedCutoff) / this.sampleRate);
    this.k = 1.0 / Math.max(0.1, q);
    this.a1 = 1.0 / (1.0 + this.g * (this.g + this.k));
    this.a2 = this.g * this.a1;
    this.a3 = this.g * this.a2;
  }

  public process(sample: number): { lp: number; hp: number; bp: number } {
    const v3 = sample - this.s2;
    const v1 = this.a1 * this.s1 + this.a2 * v3;
    const v2 = this.s2 + this.a2 * this.s1 + this.a3 * v3;
    this.s1 = 2.0 * v1 - this.s1;
    this.s2 = 2.0 * v2 - this.s2;
    const lp = v2;
    const hp = sample - this.k * v1 - v2;
    const bp = v1;
    return { lp, hp, bp };
  }

  public reset(): void {
    this.s1 = 0;
    this.s2 = 0;
  }
}

/**
 * Equal-power stereo vector pan gains with unity at centre.
 * pan in [-1, +1] -> returns [gainL, gainR]
 */
export function calculateVectorPanGains(pan: number, maxPan = 0.65): [number, number] {
  const clampedPan = Math.max(-maxPan, Math.min(maxPan, pan));
  const angle = ((clampedPan + 1.0) * Math.PI) / 4.0;
  return [Math.cos(angle) * Math.SQRT2, Math.sin(angle) * Math.SQRT2];
}

/**
 * Inverse-square distance attenuation with clamped dB floor.
 */
export function calculateDistanceAttenuation(
  distance: number,
  refDistance = 1.0,
  maxAttenDb = 18.0
): number {
  if (distance <= 0) return 1.0;
  const d = Math.max(0, distance);
  const minGain = Math.pow(10, -Math.abs(maxAttenDb) / 20);
  const gain = refDistance / (refDistance + d);
  return Math.max(minGain, Math.min(1.0, gain));
}

/**
 * Air absorption high-frequency roll-off cutoff calculation (Hz).
 * Cutoff drops exponentially from fMax down to fMin as distance increases.
 */
export function calculateAirAbsorptionCutoff(
  distance: number,
  rangeHz: [number, number] = [20000, 2500],
  airDistReference = 8.0
): number {
  const [fMax, fMin] = rangeHz;
  const d = Math.max(0, distance);
  return fMin + (fMax - fMin) * Math.exp(-d / airDistReference);
}

export interface SpatializationOptions {
  sampleRate?: number;
  refDistance?: number;
  airDistReference?: number;
}

/**
 * Spatializes an audio buffer based on visual telemetry frames.
 *
 * @param sourcePcm Interleaved stereo Float32Array PCM buffer.
 * @param telemetry Array of TelemetryFrame snapshots sampled over time (typically 60 Hz).
 * @param config SpatialSourceConfig defining spatial and modulation parameters.
 * @param options Spatialization options including sample rate.
 * @returns Spatialized interleaved stereo Float32Array PCM buffer.
 */
export function spatializeSource(
  sourcePcm: Float32Array,
  telemetry: TelemetryFrame[],
  config: SpatialSourceConfig,
  options: SpatializationOptions = {}
): Float32Array {
  const sampleRate = options.sampleRate ?? 48000;
  const refDistance = options.refDistance ?? 1.0;
  const airDistRef = options.airDistReference ?? 8.0;

  const spatial = config.spatial ?? {};
  const maxPan = spatial.maxPan ?? 0.65;
  const maxAttenDb = spatial.distanceAttenDb ?? 18.0;
  const distanceLpfHz = spatial.distanceLpfHz ?? [20000, 2500];
  const occlusionNotchDb = spatial.occlusionNotchDb ?? 6.0;
  const occlusionHighAtten = Math.pow(10, -Math.abs(occlusionNotchDb) / 20); // ~0.50 for -6dB

  const modulation = config.modulation;

  const totalFrames = sourcePcm.length / 2;
  const output = new Float32Array(sourcePcm.length);

  // Smoothers for k-rate to a-rate interpolation
  const panSmootherL = createGainSmoother(1.0, sampleRate);
  const panSmootherR = createGainSmoother(1.0, sampleRate);
  const distGainSmoother = createGainSmoother(1.0, sampleRate);
  const cutoffSmoother = createCutoffSmoother(distanceLpfHz[0], sampleRate);
  const occlusionSmoother = createGainSmoother(1.0, sampleRate); // 1.0 = clear, <1.0 = occluded highs
  const velGainSmoother = createGainSmoother(1.0, sampleRate);

  // Left and Right Air Absorption and Occlusion Filters
  const svfL = new CytomicSVF(sampleRate);
  const svfR = new CytomicSVF(sampleRate);

  // Build telemetry lookup or timeline interpolator
  const pointHistory: Array<{ t: number; point: AudioTelemetryPoint }> = [];
  for (const frame of telemetry) {
    const pt = frame.sources[config.bindTo];
    if (pt) {
      pointHistory.push({ t: frame.t, point: pt });
    }
  }

  // Sort history by time
  pointHistory.sort((a, b) => a.t - b.t);

  // Helper to interpolate telemetry at sample time t
  let histIdx = 0;
  function getTelemetryAt(t: number): AudioTelemetryPoint {
    if (pointHistory.length === 0) {
      return { sourceId: config.bindTo, pan: 0, distance: 1.0, velocity: 0, occluded: false };
    }
    while (histIdx < pointHistory.length - 1 && pointHistory[histIdx + 1]!.t <= t) {
      histIdx++;
    }
    const cur = pointHistory[histIdx]!;
    if (histIdx >= pointHistory.length - 1 || cur.t >= t) {
      return cur.point;
    }
    const next = pointHistory[histIdx + 1]!;
    const alpha = (t - cur.t) / (next.t - cur.t + 1e-9);

    // Linear interpolate numerical parameters
    const pan = (cur.point.pan ?? 0) * (1 - alpha) + (next.point.pan ?? 0) * alpha;
    const distance = (cur.point.distance ?? 1.0) * (1 - alpha) + (next.point.distance ?? 1.0) * alpha;
    const velocity = (cur.point.velocity ?? 0) * (1 - alpha) + (next.point.velocity ?? 0) * alpha;
    const occluded = alpha > 0.5 ? next.point.occluded : cur.point.occluded;
    return {
      sourceId: config.bindTo,
      pan,
      distance,
      velocity,
      occluded,
      zone: cur.point.zone,
    };
  }

  // Process in k-rate blocks (every 128 samples, ~2.6ms) for filter coefficient updates,
  // while parameter smoothers operate at a-rate (per-sample).
  const BLOCK_SIZE = 64;

  for (let blockStart = 0; blockStart < totalFrames; blockStart += BLOCK_SIZE) {
    const blockEnd = Math.min(totalFrames, blockStart + BLOCK_SIZE);
    const blockTime = blockStart / sampleRate;

    // Sample telemetry at block time
    const pt = getTelemetryAt(blockTime);

    // Calculate targets
    const pan = pt.pan ?? 0.0;
    const [targetPanL, targetPanR] = calculateVectorPanGains(pan, maxPan);
    const targetDistGain = calculateDistanceAttenuation(pt.distance ?? 1.0, refDistance, maxAttenDb);
    const targetCutoff = calculateAirAbsorptionCutoff(pt.distance ?? 1.0, distanceLpfHz, airDistRef);
    const targetOcclusion = pt.occluded ? occlusionHighAtten : 1.0;

    let targetVelGain = 1.0;
    if (modulation?.velocityToGainDb && pt.velocity !== undefined) {
      const [minDb, maxDb] = modulation.velocityToGainDb;
      const normVel = Math.min(1.0, Math.max(0.0, pt.velocity / 30.0));
      const velDb = minDb + normVel * (maxDb - minDb);
      targetVelGain = Math.pow(10, velDb / 20);
    }

    // Set smoother targets
    panSmootherL.setTarget(targetPanL);
    panSmootherR.setTarget(targetPanR);
    distGainSmoother.setTarget(targetDistGain);
    cutoffSmoother.setTarget(targetCutoff);
    occlusionSmoother.setTarget(targetOcclusion);
    velGainSmoother.setTarget(targetVelGain);

    // Filter coefficients update at block rate from the smoother's current
    // value — the smoother itself advances per-sample inside the loop.
    svfL.setCutoffAndQ(cutoffSmoother.getValue(), 0.7071);
    svfR.setCutoffAndQ(cutoffSmoother.getValue(), 0.7071);

    // Process samples within block
    for (let f = blockStart; f < blockEnd; f++) {
      const inIdx = f * 2;
      const inL = sourcePcm[inIdx] ?? 0;
      const inR = sourcePcm[inIdx + 1] ?? 0;

      // Advance smoothers — including the cutoff smoother, which previously
      // was never advanced inside the sample loop: its value stayed frozen at
      // the initial 20 kHz forever, so distance-based air absorption filtering
      // silently never engaged no matter how far the source moved.
      const gPanL = panSmootherL.next();
      const gPanR = panSmootherR.next();
      const gDist = distGainSmoother.next();
      const gOcc = occlusionSmoother.next();
      const gVel = velGainSmoother.next();
      cutoffSmoother.next();

      // Overall master modulation & distance gain
      const totalGain = gDist * gVel;

      // Air absorption & occlusion filtering
      const { lp: lpL, hp: hpL, bp: bpL } = svfL.process(inL);
      const { lp: lpR, hp: hpR, bp: bpR } = svfR.process(inR);

      // Recombine with occlusion shelf: lows pass through untouched, highs are attenuated by gOcc.
      // The SVF allpass identity is lp + k·bp + hp = input — omitting the bandpass term
      // (as lp + hp·g did) leaves a notch at the cutoff even when fully unoccluded,
      // sweeping through the audible band as the source recedes. k = 1/Q.
      const kOcc = 1.0 / 0.7071;
      const filteredL = lpL + gOcc * (hpL + kOcc * bpL);
      const filteredR = lpR + gOcc * (hpR + kOcc * bpR);

      // Apply panning and distance
      output[inIdx] = filteredL * gPanL * totalGain;
      output[inIdx + 1] = filteredR * gPanR * totalGain;
    }
  }

  return output;
}
