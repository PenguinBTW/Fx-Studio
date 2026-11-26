// THRESHOLD deterministic first-person camera rig.
// The pose is closed-form in time: seeks and re-renders reproduce the same frame exactly.
import * as THREE from 'three';
import { clamp, lerp, sm, noise, TAU, EYE_HEIGHT } from './kit';

export type V3 = [number, number, number];
export type GaitName = 'still' | 'creep' | 'walk' | 'run' | 'holdBreath';

export interface GaitSpec {
  stepHz: number;
  bob: number;
  sway: number;
  roll: number;
  breath: number;
  noiseAmp: number;
}

export const GAITS: Record<GaitName, GaitSpec> = {
  still: { stepHz: 0, bob: 0.006, sway: 0.004, roll: 0.0015, breath: 0.018, noiseAmp: 0.002 },
  creep: { stepHz: 1.15, bob: 0.018, sway: 0.015, roll: 0.006, breath: 0.012, noiseAmp: 0.003 },
  walk: { stepHz: 1.85, bob: 0.034, sway: 0.026, roll: 0.010, breath: 0.014, noiseAmp: 0.004 },
  run: { stepHz: 3.15, bob: 0.075, sway: 0.050, roll: 0.030, breath: 0.026, noiseAmp: 0.009 },
  holdBreath: { stepHz: 0, bob: 0.003, sway: 0.002, roll: 0.0007, breath: 0, noiseAmp: 0.001 },
};

export interface FPKey {
  /** Seconds, local to the caller's own beat/scene clock. */
  t: number;
  pos: V3;
  /** Radians. yaw 0 looks down world -Z; positive yaw turns right. Positive pitch looks up. */
  yaw: number;
  pitch?: number;
  roll?: number;
  fov?: number;
  height?: number;
  gait?: GaitName;
}

export interface FPPose {
  pos: V3;
  target: V3;
  forward: V3;
  right: V3;
  up: V3;
  roll: number;
  fov: number;
  gait: GaitName;
  stepPhase: number;
  stepImpulse: number;
  breath: number;
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const mixv = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export function forwardFromYawPitch(yaw: number, pitch = 0): V3 {
  const cp = Math.cos(pitch);
  return norm([Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp]);
}

function angleDelta(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Deterministic smoothstep turn used for `look L/R` commands; named for readability at call sites. */
export function criticallyDampedTurn(x: number): number {
  return sm(0, 1, x);
}

export function keyAt(keys: FPKey[], t: number): Required<Omit<FPKey, 'gait'>> & { gait: GaitName } {
  if (!keys.length) return { t, pos: [0, EYE_HEIGHT, 0], yaw: 0, pitch: 0, roll: 0, fov: 74, height: EYE_HEIGHT, gait: 'still' };
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  let i = 0;
  while (i + 1 < sorted.length && t >= sorted[i + 1]!.t) i++;
  const a = sorted[i]!;
  const b = sorted[Math.min(i + 1, sorted.length - 1)]!;
  const span = Math.max(1e-6, b.t - a.t);
  const u = i === sorted.length - 1 ? 0 : clamp((t - a.t) / span);
  const k = criticallyDampedTurn(u);
  const base = {
    t,
    pos: mixv(a.pos, b.pos, k),
    yaw: a.yaw + angleDelta(a.yaw, b.yaw) * k,
    pitch: lerp(a.pitch ?? 0, b.pitch ?? 0, k),
    roll: lerp(a.roll ?? 0, b.roll ?? 0, k),
    fov: lerp(a.fov ?? 74, b.fov ?? 74, k),
    height: lerp(a.height ?? EYE_HEIGHT, b.height ?? EYE_HEIGHT, k),
    gait: (u < 0.5 ? a.gait : b.gait) ?? a.gait ?? 'still' as GaitName,
  };
  return base;
}

/**
 * Evaluate a first-person pose at time `t`. `keys` describe the deliberate camera path;
 * this function adds breath, gait bob/sway/roll and micro head noise without mutable state.
 */
export function evalFirstPerson(keys: FPKey[], t: number, gaitOverride?: GaitName): FPPose {
  const k = keyAt(keys, t);
  const gaitName = gaitOverride ?? k.gait;
  const g = GAITS[gaitName];
  const stepPhase = g.stepHz > 0 ? t * g.stepHz : 0;
  const stepWave = g.stepHz > 0 ? Math.sin(stepPhase * TAU) : 0;
  const stepImpulse = g.stepHz > 0 ? Math.max(0, Math.sin(stepPhase * TAU)) : 0;
  const breath = g.breath * Math.sin(t * TAU / 4.4 + 0.8);
  const yawN = noise.simplex([t * 0.37, 4.1, 0], 11) * g.noiseAmp;
  const pitchN = noise.simplex([t * 0.43, 9.7, 0], 12) * g.noiseAmp;
  const yaw = k.yaw + yawN + breath * 0.07;
  const pitch = k.pitch + pitchN + breath * 0.24;
  const forward = forwardFromYawPitch(yaw, pitch);
  const right = norm(cross(forward, [0, 1, 0]));
  const up = norm(cross(right, forward));
  const lateral = g.sway * Math.sin(stepPhase * TAU * 0.5 + Math.PI * 0.5);
  const bob = g.bob * Math.abs(stepWave) + breath * 0.35;
  const pos = add(add(k.pos, mul(right, lateral)), [0, k.height - EYE_HEIGHT + bob, 0]);
  const target = add(pos, forward);
  const roll = k.roll + g.roll * Math.sin(stepPhase * TAU + 0.3) + yawN * 1.7;
  return { pos, target, forward, right, up, roll, fov: k.fov, gait: gaitName, stepPhase, stepImpulse, breath };
}

export function applyFirstPersonCamera(cam: THREE.PerspectiveCamera, pose: FPPose, aspect: number): void {
  cam.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
  cam.up.set(pose.up[0], pose.up[1], pose.up[2]);
  cam.fov = pose.fov;
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
  cam.lookAt(pose.target[0], pose.target[1], pose.target[2]);
  cam.rotateZ(pose.roll);
}

/** Approximate exponential lag as a deterministic integral over past samples. Pure f(t); no filter state. */
export function laggedVec3(sample: (t: number) => V3, t: number, lagSeconds = 0.08): V3 {
  const horizon = Math.max(0.12, lagSeconds * 6);
  const n = 12;
  let acc: V3 = [0, 0, 0], ws = 0;
  for (let i = 0; i <= n; i++) {
    const dt = (i / n) * horizon;
    const w = Math.exp(-dt / lagSeconds);
    const p = sample(t - dt);
    acc = add(acc, mul(p, w));
    ws += w;
  }
  return mul(acc, 1 / ws);
}
