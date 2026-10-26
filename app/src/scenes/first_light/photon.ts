import * as THREE from 'three';
import { type V3, mulberry32, lerp, v3Lerp } from '../../engine/util';

export interface PhotonState {
  /** 3D world-space position */
  worldPos: V3;
  /** Normalized tangent direction of motion */
  dir: V3;
  /** Projected 1080p screen-space pixel coordinates [0..1920, 0..1080] */
  screenPos: [number, number];
  /** Current act index (0..5 for the 6 primary acts, up to 9 for transitions/codas) */
  act: number;
  /** Atmospheric optical depth [0..1] driving the sky color grade and scatter */
  depth: number;
  /** Core luminance / energy multiplier [0..1+] */
  intensity: number;
  /** Dominant emission wavelength in nanometers (e.g. 550nm green, 650nm red) */
  wavelength: number;
}

export interface ActCameraSpec {
  pos: V3;
  target: V3;
  fov: number; // vertical FOV in degrees (default 45)
  near: number;
  far: number;
}

/**
 * Deterministically generates the Solar Core Brownian random walk path.
 */
export function generateCoreWalk(seed = 1337, steps = 1000): V3[] {
  const rng = mulberry32(seed);
  const path: V3[] = [[0, 0, 0]];
  let cur: V3 = [0, 0, 0];
  for (let i = 0; i < steps; i++) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const stepLen = 0.05 + rng() * 0.1;
    cur = [
      cur[0] + stepLen * Math.sin(phi) * Math.cos(theta),
      cur[1] + stepLen * Math.sin(phi) * Math.sin(theta),
      cur[2] + stepLen * Math.cos(phi),
    ];
    path.push(cur);
  }
  return path;
}

/** Precomputed singleton of the Act 1 / Act 6 Brownian walk */
export const CORE_WALK: V3[] = generateCoreWalk(1337, 1000);

/** Standalone generator alias for Coda reuse */
export const walkPath = generateCoreWalk;

/** Downbeat-synchronized bounds for all 6 acts */
export const ACT_BOUNDS = [
  { act: 0, name: 'core',         start: 0.0,   end: 22.0  },
  { act: 1, name: 'radiative',    start: 22.0,  end: 64.0  },
  { act: 2, name: 'convection',   start: 64.0,  end: 110.0 },
  { act: 3, name: 'vacuum',       start: 110.0, end: 154.0 },
  { act: 4, name: 'droplet',      start: 154.0, end: 198.0 },
  { act: 5, name: 'retina',       start: 198.0, end: 256.0 },
] as const;

/** Trajectory anchor waypoints connecting consecutive acts */
const P0: V3 = [0, 0, 0];
const P1: V3 = CORE_WALK[CORE_WALK.length - 1]!;
const P2: V3 = [0, 20, 0];
const P3: V3 = [0, 60, 0];
const P4: V3 = [100, 60, 0];
const P5: V3 = [140, 30, 0];
const P6: V3 = [150, 30, 0];

export const WAYPOINTS: readonly V3[] = [P0, P1, P2, P3, P4, P5, P6];

/**
 * Returns the active act index (0..5) for a given timeline timestamp.
 */
export function getAct(t: number): number {
  if (t < ACT_BOUNDS[0].start) return 0;
  for (let i = 0; i < ACT_BOUNDS.length; i++) {
    const b = ACT_BOUNDS[i]!;
    if (t < b.end || i === ACT_BOUNDS.length - 1) {
      return b.act;
    }
  }
  return 5;
}

/**
 * Returns the world position of the photon at time t.
 * Pure function of timeline time, continuous across all act boundaries.
 */
export function photonWorldPosAt(t: number): V3 {
  const act = getAct(t);
  const b = ACT_BOUNDS[act]!;
  const s = Math.max(0, Math.min(1, (t - b.start) / (b.end - b.start)));
  if (act === 0) {
    const idxFloat = s * (CORE_WALK.length - 1);
    const idx = Math.min(CORE_WALK.length - 2, Math.floor(idxFloat));
    const frac = idxFloat - idx;
    return v3Lerp(CORE_WALK[idx]!, CORE_WALK[idx + 1]!, frac);
  }
  const startP = WAYPOINTS[act]!;
  const endP = WAYPOINTS[act + 1]!;
  return v3Lerp(startP, endP, s);
}

/**
 * Returns camera specifications for a given act and timeline timestamp.
 * Perfectly continuous at act boundaries.
 */
export function getActCamera(act: number, t: number): ActCameraSpec {
  const clampedAct = Math.max(0, Math.min(5, Math.floor(act)));
  const b = ACT_BOUNDS[clampedAct]!;
  const s = Math.max(0, Math.min(1, (t - b.start) / (b.end - b.start)));
  const startP = WAYPOINTS[clampedAct]!;
  const endP = WAYPOINTS[clampedAct + 1]!;

  const baseTarget = v3Lerp(startP, endP, s);
  // Boundary-vanishing sway offset ensures continuous seams
  const sway = Math.sin(s * Math.PI) * 1.5;
  const target: V3 = [baseTarget[0] - sway, baseTarget[1], baseTarget[2]];
  const pos: V3 = [target[0] + sway * 0.5, target[1], target[2] + 16];

  return {
    pos,
    target,
    fov: 45,
    near: 0.1,
    far: 1000,
  };
}

/**
 * Projects a 3D world-space coordinate to 1080p pixel coordinates [0..1920, 0..1080]
 * using camera specifications. Exact mathematical equivalent to Three.js camera projection,
 * optimized to zero allocations for high-frequency evaluation.
 */
export function projectWorldToScreen(
  worldPos: V3,
  cam: ActCameraSpec,
  width = 1920,
  height = 1080,
): [number, number] {
  const ex = cam.pos[0], ey = cam.pos[1], ez = cam.pos[2];
  const tx = cam.target[0], ty = cam.target[1], tz = cam.target[2];

  let zx = ex - tx, zy = ey - ty, zz = ez - tz;
  const zlen = Math.hypot(zx, zy, zz) || 1;
  zx /= zlen; zy /= zlen; zz /= zlen;

  let upx = 0, upy = 1, upz = 0;
  if (Math.abs(zy) > 0.9999) {
    upx = 0; upy = 0; upz = 1;
  }

  let xx = upy * zz - upz * zy;
  let xy = upz * zx - upx * zz;
  let xz = upx * zy - upy * zx;
  const xlen = Math.hypot(xx, xy, xz) || 1;
  xx /= xlen; xy /= xlen; xz /= xlen;

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  const dx = worldPos[0] - ex;
  const dy = worldPos[1] - ey;
  const dz = worldPos[2] - ez;

  const xc = dx * xx + dy * xy + dz * xz;
  const yc = dx * yx + dy * yy + dz * yz;
  const zc = dx * zx + dy * zy + dz * zz;
  const wClip = -zc;

  const fovRad = (cam.fov * Math.PI) / 180;
  const fy = 1.0 / Math.tan(fovRad * 0.5);
  const fx = fy * (height / width);

  const invW = wClip > 1e-6 ? 1.0 / wClip : 1.0;
  const ndcX = (xc * fx) * invW;
  const ndcY = (yc * fy) * invW;

  return [
    (ndcX * 0.5 + 0.5) * width,
    (1.0 - (ndcY * 0.5 + 0.5)) * height,
  ];
}

/**
 * Central Photon State Contract.
 * Pure closed-form function of global timeline time t.
 */
export function photonState(t: number): PhotonState {
  const act = getAct(t);
  const worldPos = photonWorldPosAt(t);

  // Finite difference tangent
  const dt = 0.001;
  const pNext = photonWorldPosAt(t + dt);
  const pPrev = photonWorldPosAt(Math.max(0, t - dt));
  const dx = pNext[0] - pPrev[0];
  const dy = pNext[1] - pPrev[1];
  const dz = pNext[2] - pPrev[2];
  const len = Math.hypot(dx, dy, dz);
  const dir: V3 = len > 1e-6 ? [dx / len, dy / len, dz / len] : [1, 0, 0];

  const cam = getActCamera(act, t);
  const screenPos = projectWorldToScreen(worldPos, cam);

  const b = ACT_BOUNDS[act]!;
  const s = Math.max(0, Math.min(1, (t - b.start) / (b.end - b.start)));

  let depth = 0;
  if (act === 4) {
    depth = s;
  } else if (act === 5) {
    depth = 1.0;
  }

  let intensity = 1.0;
  if (act === 0) {
    intensity = lerp(1.5, 1.2, s);
  } else if (act === 1) {
    intensity = lerp(1.2, 1.0, s);
  } else if (act === 2 || act === 3) {
    intensity = 1.0;
  } else if (act === 4) {
    intensity = lerp(1.0, 1.2, Math.sin(s * Math.PI));
  } else if (act === 5) {
    intensity = lerp(1.0, 0.0, s);
  }

  let wavelength = 550;
  if (act === 0) {
    wavelength = 400;
  } else if (act === 1) {
    wavelength = lerp(400, 520, s);
  } else if (act === 2) {
    wavelength = lerp(520, 580, s);
  } else if (act === 3) {
    wavelength = lerp(580, 550, s);
  } else if (act === 4) {
    wavelength = lerp(550, 650, s);
  } else if (act === 5) {
    wavelength = 650;
  }

  return {
    worldPos,
    dir,
    screenPos,
    act,
    depth,
    intensity,
    wavelength,
  };
}

/**
 * Returns aspect-corrected 1080p pixel coordinates [0..1920, 0..1080] of the photon at time t.
 */
export function photonScreenPosAt(t: number): [number, number] {
  return photonState(t).screenPos;
}
