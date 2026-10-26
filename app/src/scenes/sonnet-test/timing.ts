// Shared timeline constants, markers and camera functions (pure functions of t).
import { ease, prog, lerp, springStep } from '../../engine/util';

export const MARKERS = {
  LOCK_CLICK: 5.2,
  PULL_1: 10.0,
  PULL_2: 12.2,
  PULL_3: 13.8,
  GLYPH_REVEAL: 27.0,
  ONE_LOCK: 55.0,
  YOU_REACH: 63.5,
  HALFWAY: 70.0,
} as const;

/** Metres per glyph unit: the glyph "G" spans +-1 unit, i.e. +-0.15 m in the mechanism world. */
export const MU = 0.15;
const RAD = Math.PI / 180;

// ---------------------------------------------------------------- Beat 0 / door edge
export const DOOR_FOV = 16; // ~85 mm on a 24 mm tall sensor
export const SLOT_HALF_LEN = 0.015;
export const SLOT_HALF_W = 0.004;
export const KNOB_X0 = -0.0098;
export const KNOB_TRAVEL = 0.014;
export const KNOB_HALF = 0.00475;
export const SLOT_FLOOR_X0 = -0.0145;

/** 0..~1.02. Slow 0.6 s start, then a fast snap (damping 0.78 gives ~2% overshoot). */
export function knobCurve(t: number): number {
  const t0 = MARKERS.LOCK_CLICK;
  if (t < t0 - 0.6) return 0;
  if (t < t0) {
    const u = (t - (t0 - 0.6)) / 0.6;
    return 0.06 * u * u;
  }
  return 0.06 + 0.94 * springStep(t - t0, 4.5, 0.78);
}

/** Camera distance to the door plate: 2 cm dolly over 8 s, then the push into the slot (8..9 s). */
export function doorCamZ(t: number): number {
  const slow = lerp(0.18, 0.16, ease.inOutCubic(prog(t, 0, 8)));
  if (t <= 8) return slow;
  return 0.16 * Math.pow(0.012 / 0.16, ease.inQuad(prog(t, 8, 9)));
}
export const DOOR_REST_Z = 0.16;

// ---------------------------------------------------------------- Beat 1 + 2 / mechanism
export const GLYPH_K = MU / (0.4 * (16 / 9)); // half frame height (m) at which the glyph spans 40% of frame width

export interface Cam {
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
  near: number;
  far: number;
}

export function mechCamera(t: number): Cam {
  let D: number;
  if (t < 10) D = lerp(0.95, 0.42, ease.outCubic(prog(t, 8, 10)));
  else if (t < 14.5) D = lerp(0.42, 0.36, ease.inOutCubic(prog(t, 10, 14.5)));
  else if (t < 16) D = lerp(0.36, 0.355, prog(t, 14.5, 16));
  else D = lerp(0.355, 0.075, ease.inOutCubic(prog(t, 16, 20)));
  let fov = 30;

  // Beat 2: dolly-zoom. K = D*tan(fov/2) is the framing at the subject; FOV -> 1 deg while D grows.
  const u2 = prog(t, 20, 27, ease.inOutCubic);
  if (t > 20) {
    const K0 = 0.075 * Math.tan(15 * RAD);
    const K = K0 * Math.pow(GLYPH_K / K0, u2);
    fov = 30 * Math.pow(1 / 30, u2);
    D = K / Math.tan((fov * RAD) / 2);
  }

  const tx = lerp(-0.06, 0, ease.inOutCubic(prog(t, 14, 18)));
  const az = 25 * RAD * ease.inOutCubic(prog(t, 8, 20)) * (1 - ease.inOutCubic(prog(t, 20.5, 27)));
  const el = 6 * RAD * (1 - u2);
  return {
    pos: [tx + D * Math.cos(el) * Math.sin(az), D * Math.sin(el), D * Math.cos(el) * Math.cos(az)],
    target: [tx, 0, 0],
    fov,
    near: Math.max(0.003, D - 0.6),
    far: D + 0.8,
  };
}

/** World x of the dissolve front (sweeps latch -> handle between 20 and 26.4 s). */
export function dissolveFront(t: number): number {
  return lerp(0.175, -0.42, ease.inOutCubic(prog(t, 20, 26.4)));
}
