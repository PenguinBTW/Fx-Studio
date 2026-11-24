/**
 * godrays.ts — closed-form analytic light shafts (crepuscular rays).
 *
 * Why analytic rather than screen-space radial blur: the engine's determinism
 * contract is f(t) with zero drift. Radial-blur shafts sample an occlusion buffer
 * over many taps — noisy, resolution-dependent, and cost a full extra pass.
 * Analytic shaft volumes (cones with density falloff) are pure closed-form
 * geometry: the in-shaft segment of any camera ray is computed exactly and
 * inscattered radiance integrated analytically — bit-reproducible at any
 * resolution, composing directly with atmosphere.ts transmittance.
 */

import { fogTransmittance } from './atmosphere';

export interface Shaft {
  apex: [number, number, number];
  dir: [number, number, number]; // unit axis direction
  cosAngle: number; // cosine of half-angle
  length: number;
  density: number;
  color: [number, number, number];
}

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Closed-form cone–ray intersection: [tEnter, tExit] inside the shaft volume
 * (positive cone nappe, clipped to shaft length), or null on miss.
 * Sign analysis: q(t) = (cov+t·dv)² − cos²·|co+t·rd|² is POSITIVE inside the cone
 * angle; inside-intervals derived exactly from the quadratic, including rays
 * starting inside and degenerate axis-aligned cases.
 */
export function shaftRaySegment(shaft: Shaft, rayO: V3, rayD: V3): [number, number] | null {
  const { apex, dir, cosAngle, length } = shaft;
  const co = sub(rayO, apex);
  const cos2 = cosAngle * cosAngle;
  const dv = dot(rayD, dir);
  const cov = dot(co, dir);
  const a = dv * dv - cos2 * dot(rayD, rayD);
  const b = 2 * (dv * cov - cos2 * dot(rayD, co));
  const c = cov * cov - cos2 * dot(co, co);
  const intervals: [number, number][] = [];
  const disc = b * b - 4 * a * c;
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) {
      if (c > 0) intervals.push([-Infinity, Infinity]);
    } else {
      const r = -c / b;
      intervals.push(b > 0 ? [r, Infinity] : [-Infinity, r]);
    }
  } else if (disc < 0) {
    if (a > 0) intervals.push([-Infinity, Infinity]);
  } else {
    const sq = Math.sqrt(Math.max(0, disc));
    let r0 = (-b - sq) / (2 * a);
    let r1 = (-b + sq) / (2 * a);
    if (r0 > r1) [r0, r1] = [r1, r0];
    if (a > 0) intervals.push([-Infinity, r0], [r1, Infinity]);
    else intervals.push([r0, r1]);
  }
  // axial bounds 0 ≤ cov + t·dv ≤ length
  let lo = -Infinity, hi = Infinity;
  if (Math.abs(dv) < 1e-12) {
    if (cov < 0 || cov > length) return null;
  } else {
    const ta0 = (0 - cov) / dv;
    const ta1 = (length - cov) / dv;
    lo = Math.min(ta0, ta1);
    hi = Math.max(ta0, ta1);
  }
  let best: [number, number] | null = null;
  for (const [s0, s1] of intervals) {
    const t0 = Math.max(s0, lo, 0);
    const t1 = Math.min(s1, hi);
    if (t1 > t0) {
      const seg: [number, number] = [t0, isFinite(t1) ? t1 : 1e9];
      if (!best || seg[0] < best[0]) best = seg;
    }
  }
  return best;
}

/**
 * Inscattered radiance along a camera ray through a shaft, composed with height
 * fog via atmosphere.ts closed-form transmittance. Pure f(geometry) — no stepping.
 */
export function shaftInscatter(
  shaft: Shaft,
  rayO: V3,
  rayD: V3, // MUST be unit length — ray parameters are world distances throughout
  fog: { baseDensity: number; heightFalloff: number } | null,
  edgeSoftness = 0.15,
  maxDepth?: number, // clamp integration to the first opaque surface along the ray
): [number, number, number] {
  const seg = shaftRaySegment(shaft, rayO, rayD);
  if (!seg) return [0, 0, 0];
  let [t0, t1] = seg;
  if (maxDepth !== undefined) t1 = Math.min(t1, maxDepth); // never integrate past opaque surfaces
  if (t1 <= t0) return [0, 0, 0];
  const pathLen = t1 - t0;
  // weight profile along the segment: radial cosine density × axial depletion.
  // Simpson quadrature (endpoints + midpoint) — closed-form deterministic, and crucially
  // NOT single-midpoint: as a camera enters the shaft the entry endpoint weight is
  // evaluated honestly instead of reapplying a brighter midpoint over the whole path.
  const w = (t: number): number => {
    const p: V3 = [rayO[0] + rayD[0] * t, rayO[1] + rayD[1] * t, rayO[2] + rayD[2] * t];
    const co = sub(p, shaft.apex);
    const axial = dot(co, shaft.dir);
    const radial = Math.sqrt(Math.max(0, dot(co, co) - axial * axial));
    const coneR = Math.max(1e-9, axial * Math.sqrt(1 - shaft.cosAngle * shaft.cosAngle) / shaft.cosAngle);
    const rr = Math.min(1, radial / coneR);
    const edge = 0.5 + 0.5 * Math.cos(Math.PI * rr);
    const axialFade = 1 - Math.min(1, Math.max(0, axial) / shaft.length) * 0.6;
    return edge * axialFade;
  };
  const tm = (t0 + t1) / 2;
  const integral = ((w(t0) + 4 * w(tm) + w(t1)) / 6) * pathLen;
  const mid: V3 = [rayO[0] + rayD[0] * tm, rayO[1] + rayD[1] * tm, rayO[2] + rayD[2] * tm];
  let T = 1;
  if (fog) T = fogTransmittance(rayO[1], mid[1], tm, fog.baseDensity, fog.heightFalloff);
  const L = shaft.density * integral * T;
  return [shaft.color[0] * L, shaft.color[1] * L, shaft.color[2] * L];
}

/** GLSL chunk mirroring shaftRaySegment — same formula, float32 rounding differs. */
export const SHAFT_GLSL = /* glsl */ `
// full interval logic mirroring the TS shaftRaySegment — including cap-facing rays
// (both quadratic intervals kept through axial clipping) and the linear a≈0 solve
vec2 shaftRaySegment(vec3 apex, vec3 dir, float cosAngle, float len, vec3 ro, vec3 rd) {
  vec3 co = ro - apex;
  float cos2 = cosAngle * cosAngle;
  float dv = dot(rd, dir);
  float cov = dot(co, dir);
  float a = dv * dv - cos2 * dot(rd, rd);
  float b = 2.0 * (dv * cov - cos2 * dot(rd, co));
  float c = cov * cov - cos2 * dot(co, co);
  // axial bounds
  float lo = -1e30, hi = 1e30;
  if (abs(dv) < 1e-12) {
    if (cov < 0.0 || cov > len) return vec2(-1.0);
  } else {
    float ta0 = (0.0 - cov) / dv;
    float ta1 = (len - cov) / dv;
    lo = min(ta0, ta1); hi = max(ta0, ta1);
  }
  float bestT0 = 1e30, bestT1 = -1e30;
  float disc = b * b - 4.0 * a * c;
  // candidate inside-intervals (q > 0): up to two, evaluated pairwise
  float i0a = -1e30, i1a = -1e30, i0b = -1e30, i1b = -1e30; float nb = 0.0;
  if (abs(a) < 1e-12) {
    if (abs(b) < 1e-12) {
      if (c > 0.0) { i0a = -1e30; i1a = 1e30; }
    } else {
      float r = -c / b;
      if (b > 0.0) { i0a = r; i1a = 1e30; } else { i0a = -1e30; i1a = r; }
    }
  } else if (disc < 0.0) {
    if (a > 0.0) { i0a = -1e30; i1a = 1e30; }
  } else {
    float sq = sqrt(max(disc, 0.0));
    float r0 = (-b - sq) / (2.0 * a);
    float r1 = (-b + sq) / (2.0 * a);
    if (r0 > r1) { float tt = r0; r0 = r1; r1 = tt; }
    if (a > 0.0) {
      i0a = -1e30; i1a = r0; i0b = r1; i1b = 1e30; nb = 1.0;
    } else {
      i0a = r0; i1a = r1;
    }
  }
  for (int k = 0; k < 2; k++) {
    float s0 = k == 0 ? i0a : i0b;
    float s1 = k == 0 ? i1a : i1b;
    if (k == 1 && nb < 0.5) break;
    float t0 = max(max(s0, lo), 0.0);
    float t1 = min(s1, hi);
    if (t1 > t0 && t0 < bestT0) { bestT0 = t0; bestT1 = t1; }
  }
  if (bestT1 <= bestT0 || bestT0 >= 1e29) return vec2(-1.0);
  return vec2(bestT0, min(bestT1, 1e29));
}
`;
