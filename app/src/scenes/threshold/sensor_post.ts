// Shared THRESHOLD camera-sensor post layer. Values are deliberately restrained:
// the film should feel optically imperfect without ever becoming a HUD or effect reel.
import type { PostOverrides } from '../../engine/scene';
import { batteryAt, clamp, lerp, sm } from './kit';

export interface SensorOptions {
  /** Extra artistic exposure multiplier from the scene/beat. */
  exposure?: number;
  /** 0..1 darkness in the room; increases exposure adaptation and grain slightly. */
  darkness?: number;
  /** 0..1 panic/chromatic stress. */
  stress?: number;
  /** Fade the whole frame to black when needed (for example the dead-beam beats). */
  fade?: number;
}

/** Eye/sensor adaptation is a deterministic envelope, not accumulated state. */
export function exposureAdapt(t: number, blackInAt = 0, seconds = 1): number {
  return lerp(0.05, 1, sm(blackInAt, blackInAt + seconds, t));
}

export function thresholdPost(t: number, o: SensorOptions = {}): PostOverrides {
  const darkness = clamp(o.darkness ?? 0.55);
  const stress = clamp(o.stress ?? 0);
  const battery = batteryAt(t);
  const exposure = (o.exposure ?? 1) * lerp(1.08, 0.82, darkness) * lerp(1, 0.92, 1 - battery);
  return {
    exposure,
    toneMap: 'aces',
    toneMapHue: 0.55,
    bloom: lerp(0.08, 0.2, battery) + stress * 0.08,
    bloomThreshold: 1.05,
    bloomKnee: 0.45,
    bloomRadius: 0.65,
    halation: 0.08,
    ca: 0.7 + stress * 0.8,
    grain: 0.032 + darkness * 0.018 + stress * 0.008,
    vignette: 0.25 + darkness * 0.1,
    blackPoint: 0.012,
    fade: clamp(o.fade ?? 0),
    hud: 0,
    metricReadout: 0,
    frame: 0,
    grade: {
      lift: [0.002, 0.0015, 0.003],
      gamma: [1.02, 1.0, 0.98],
      gain: [0.96, 1.0, 1.05],
      saturation: 0.82,
    },
  };
}

/** Barrel-distortion amount required by the looks bible; scene/custom optics passes can use this constant. */
export const THRESHOLD_LENS = {
  barrelK1: 0.03,
  caOuterPx: 1.5,
  vignetteStop: 0.25,
} as const;
