// THRESHOLD shared timing, deterministic math helpers, scale and battery state.
// Everything here is a pure function of its inputs; no wall clock and no Math.random.
import { createNoise } from '../../engine/noise';

export const TAU = Math.PI * 2;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sm = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / Math.max(1e-6, b - a));
  return t * t * (3 - 2 * t);
};
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
export const noise = createNoise(0x7a11e5);

/** 1 unit = 1 metre. First-person eye height is fixed unless a beat explicitly crouches. */
export const EYE_HEIGHT = 1.65;
export const CROUCH_HEIGHT = 1.45;
export const SEAT_HEIGHT = 1.2;
export const DOOR_W = 0.9;
export const DOOR_H = 2.1;

export interface ZoneWindow {
  id: string;
  label: string;
  nominalStart: number;
  nominalEnd: number;
}

export const ZONES: ZoneWindow[] = [
  { id: 'coldopen', label: 'Z0', nominalStart: 0, nominalEnd: 4 },
  { id: 'office', label: 'Z1', nominalStart: 4, nominalEnd: 30 },
  { id: 'playroom', label: 'Z2', nominalStart: 30, nominalEnd: 55 },
  { id: 'pool', label: 'Z3', nominalStart: 55, nominalEnd: 80 },
  { id: 'library', label: 'Z4', nominalStart: 80, nominalEnd: 105 },
  { id: 'motel', label: 'Z5', nominalStart: 105, nominalEnd: 130 },
  { id: 'theatre', label: 'Z6', nominalStart: 130, nominalEnd: 150 },
  { id: 'cathedral', label: 'Z7', nominalStart: 150, nominalEnd: 195 },
  { id: 'home', label: 'Z8', nominalStart: 195, nominalEnd: 225 },
  { id: 'endscreen', label: 'END', nominalStart: 225, nominalEnd: 235 },
];

export interface TransitionWindow {
  id: string;
  at: number;
  dur: number;
  from: string;
  to: string;
  module: string;
}

export const TRANSITIONS: TransitionWindow[] = [
  { id: 't0', at: 3.8, dur: 0.4, from: 'coldopen', to: 'office', module: 'threshold_blackout' },
  { id: 't1', at: 29.6, dur: 0.8, from: 'office', to: 'playroom', module: 'threshold_exposure' },
  { id: 't2', at: 54.6, dur: 0.8, from: 'playroom', to: 'pool', module: 'threshold_tunnel' },
  { id: 't3', at: 79.4, dur: 1.2, from: 'pool', to: 'library', module: 'threshold_ink' },
  { id: 't4', at: 104.7, dur: 0.6, from: 'library', to: 'motel', module: 'threshold_page_slam' },
  { id: 't5', at: 129.4, dur: 1.2, from: 'motel', to: 'theatre', module: 'threshold_static_felt' },
  { id: 't6', at: 149.5, dur: 1.0, from: 'theatre', to: 'cathedral', module: 'threshold_door_push' },
  { id: 't7', at: 194.4, dur: 1.2, from: 'cathedral', to: 'home', module: 'threshold_light_fall' },
];

/** Storyboard battery steps. The relight is temporary and deliberately warm. */
export function batteryAt(t: number): number {
  if (t >= 173.4 && t < 174.0) return 0;
  if (t >= 174.0 && t < 192.0) return 0.4;
  if (t >= 192.0) return 0.25;
  if (t >= 150.0) return 0.25;
  if (t >= 102.5) return 0.5;
  if (t >= 66.0) return 0.7;
  if (t >= 27.5) return 0.85;
  if (t < 4.0) return 0.25;
  return 1;
}

export function beamDeadAt(t: number): boolean {
  return t >= 173.4 && t < 174.0;
}

/** Warmth shifts cooler-to-warmer by battery story state; returned as linear RGB multiplier. */
export function beamTintAt(t: number): [number, number, number] {
  if (t >= 174 && t < 192) return [1.0, 0.68, 0.42]; // Lint's warm relight
  if (t >= 150) return [1.0, 0.82, 0.62];
  return [1.0, 0.9, 0.76];
}

/** Deterministic irregular flicker. `threat` is an artistic 0..1 envelope supplied by the beat. */
export function flickerAt(t: number, threat: number): number {
  const cell = Math.floor(t * 18);
  const gate = hash(cell * 3.17 + 91.3);
  const pulse = hash(cell * 7.91 + 12.4);
  const dropout = gate < threat * 0.32 ? lerp(0.08, 0.65, pulse) : 1;
  const shimmer = 1 - threat * 0.12 * (0.5 + 0.5 * Math.sin(t * 67 + pulse * TAU));
  return clamp(dropout * shimmer, 0, 1);
}

export const stepCurve = (phase: number) => Math.sin(phase * TAU);
export const turnEase = (x: number) => {
  const u = clamp(x);
  return u * u * u * (u * (u * 6 - 15) + 10);
};

/** Times of footfalls in `[t0,t1)` for a step frequency and time-zero phase. */
export function footstepTimes(t0: number, t1: number, stepHz: number, phase0 = 0): number[] {
  if (!(stepHz > 0) || t1 <= t0) return [];
  const first = Math.ceil((t0 * stepHz + phase0) - 1e-6);
  const last = Math.floor((t1 * stepHz + phase0) + 1e-6);
  const out: number[] = [];
  for (let k = first; k <= last; k++) out.push((k - phase0) / stepHz);
  return out;
}
