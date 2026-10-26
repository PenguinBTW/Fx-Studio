// Refraction and chromatic dispersion optics module for "First Light" (P8).
// Models wavelength-dependent Cauchy dispersion, Fresnel reflection, Total Internal Reflection (TIR),
// and Descartes droplet ray geometry (primary and secondary rainbow caustics).
import * as THREE from 'three';
import { spectralSamples, wavelengthToLinearSRGB, type RGB } from './spectrum';
import { clamp } from './util';

export type V3 = [number, number, number];

// ---------------------------------------------------------------------------------------------
// 1. Cauchy Dispersion Formula
// ---------------------------------------------------------------------------------------------
/**
 * Cauchy dispersion equation for visible water:
 * n(lambda) = A + B / lambda^2
 *
 * Blueprint default constants (from First Light P8 specification):
 * A = 1.3199, B = 5150 nm^2 (= 0.00515 um^2).
 */
export const CAUCHY_A_WATER = 1.3199;
export const CAUCHY_B_WATER = 5150; // nm^2

/**
 * Empirically fitted 2-term Cauchy coefficients across the visible spectrum (380 - 700 nm):
 * Yields n(700 nm) = 1.331 and n(400 nm) = 1.344 exactly, reproducing the primary bow apex
 * at 42.0° (red) and 40.5° (violet).
 */
export const CAUCHY_A_WATER_EMPIRICAL = 1.3247;
export const CAUCHY_B_WATER_EMPIRICAL = 3088.5; // nm^2

/**
 * Evaluates the Cauchy index of refraction at wavelength `lambdaNm`.
 * @param lambdaNm Wavelength in nanometers (380 - 780 nm).
 * @param a Cauchy base constant A (default: CAUCHY_A_WATER = 1.3199).
 * @param b Cauchy dispersion constant B in nm^2 (default: CAUCHY_B_WATER = 5150).
 */
export function waterIOR(lambdaNm: number, a = CAUCHY_A_WATER, b = CAUCHY_B_WATER): number {
  return a + b / (lambdaNm * lambdaNm);
}

/**
 * Evaluates water refractive index using empirical visible-band Cauchy fit
 * (n(700)=1.331, n(400)=1.344).
 */
export function waterIOREmpirical(lambdaNm: number): number {
  return CAUCHY_A_WATER_EMPIRICAL + CAUCHY_B_WATER_EMPIRICAL / (lambdaNm * lambdaNm);
}

// ---------------------------------------------------------------------------------------------
// 2. Fresnel, Snell & Total Internal Reflection (TIR)
// ---------------------------------------------------------------------------------------------
/**
 * Critical angle for Total Internal Reflection (TIR) in radians:
 * theta_c = arcsin(n2 / n1) when n1 > n2. Returns NaN if n1 <= n2.
 */
export function criticalAngle(n1: number, n2 = 1.0): number {
  if (n1 <= n2) return NaN;
  return Math.asin(n2 / n1);
}

/**
 * Schlick Fresnel approximation: F = F0 + (1 - F0) * (1 - cosTheta)^5.
 * Correctly accounts for transmission into rarer medium (n1 > n2) and Total Internal Reflection.
 */
export function fresnelSchlick(cosThetaI: number, n1: number, n2: number): number {
  const r0 = Math.pow((n1 - n2) / (n1 + n2), 2);
  const cosI = clamp(Math.abs(cosThetaI), 0, 1);

  if (n1 <= n2) {
    return r0 + (1 - r0) * Math.pow(1 - cosI, 5);
  }

  // Dense to rare: check for TIR
  const sinT2 = (n1 / n2) * (n1 / n2) * (1 - cosI * cosI);
  if (sinT2 >= 1.0) return 1.0; // Total Internal Reflection
  const cosT = Math.sqrt(1 - sinT2);
  return r0 + (1 - r0) * Math.pow(1 - cosT, 5);
}

/**
 * Exact unpolarized dielectric Fresnel reflection coefficient:
 * Computes s- and p-polarization reflectance. Beyond critical angle theta_c, returns R = 1.0 (TIR).
 */
export function fresnelDielectric(cosThetaI: number, n1: number, n2: number): { r: number; t: number; tir: boolean } {
  const cosI = clamp(Math.abs(cosThetaI), 0, 1);
  const sinI = Math.sqrt(Math.max(0, 1 - cosI * cosI));
  const sinT = (n1 / n2) * sinI;

  if (sinT >= 1.0) {
    return { r: 1.0, t: 0.0, tir: true }; // Total Internal Reflection
  }

  const cosT = Math.sqrt(Math.max(0, 1 - sinT * sinT));
  const rs = (n1 * cosI - n2 * cosT) / (n1 * cosI + n2 * cosT);
  const rp = (n2 * cosI - n1 * cosT) / (n2 * cosI + n1 * cosT);
  const r = 0.5 * (rs * rs + rp * rp);
  return { r, t: 1.0 - r, tir: false };
}

/**
 * Vector Snell refraction: computes unit direction of refracted ray.
 * @param d Incoming unit ray direction.
 * @param n Surface unit normal (facing against d, so dot(d, n) <= 0).
 * @param eta Relative index of refraction (n_incident / n_transmitted).
 * Returns null if Total Internal Reflection occurs.
 */
export function refractVector(d: V3, n: V3, eta: number): V3 | null {
  const cosI = -(d[0] * n[0] + d[1] * n[1] + d[2] * n[2]);
  const sinT2 = eta * eta * (1 - cosI * cosI);
  if (sinT2 > 1.0) return null; // TIR
  const cosT = Math.sqrt(Math.max(0, 1 - sinT2));
  const factor = eta * cosI - cosT;
  return [
    eta * d[0] + factor * n[0],
    eta * d[1] + factor * n[1],
    eta * d[2] + factor * n[2],
  ];
}

/**
 * Vector reflection off surface with unit normal n.
 */
export function reflectVector(d: V3, n: V3): V3 {
  const dot = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
  return [
    d[0] - 2 * dot * n[0],
    d[1] - 2 * dot * n[1],
    d[2] - 2 * dot * n[2],
  ];
}

// ---------------------------------------------------------------------------------------------
// 3. Descartes Droplet Ray Geometry (Rainbow Mechanics)
// ---------------------------------------------------------------------------------------------
/**
 * Descartes rainbow caustic condition:
 * For k internal bounces, the deflection angle extremum satisfies:
 *   cos^2(theta_1) = (n^2 - 1) / (k^2 + 2k)
 * For primary bow (k = 1): cos(theta_1) = sqrt((n^2 - 1) / 3).
 * For secondary bow (k = 2): cos(theta_1) = sqrt((n^2 - 1) / 8).
 */

/**
 * Primary rainbow angle (relative to antisolar point) in radians.
 * Typical values: ~42.0° (0.733 rad) for red (n~1.331), ~40.5° (0.707 rad) for violet (n~1.344).
 */
export function primaryRainbowAngle(n: number): number {
  const cos1 = Math.sqrt((n * n - 1) / 3);
  const theta1 = Math.acos(clamp(cos1, 0, 1));
  const theta2 = Math.asin(clamp(Math.sin(theta1) / n, 0, 1));
  return 4 * theta2 - 2 * theta1;
}

/** Primary rainbow angle in degrees. */
export function primaryRainbowAngleDeg(n: number): number {
  return (primaryRainbowAngle(n) * 180) / Math.PI;
}

/**
 * Secondary rainbow angle (relative to antisolar point) in radians.
 * Typical values: ~50.5° for red, ~53.5° for violet (color order reversed from primary).
 */
export function secondaryRainbowAngle(n: number): number {
  const cos1 = Math.sqrt((n * n - 1) / 8);
  const theta1 = Math.acos(clamp(cos1, 0, 1));
  const theta2 = Math.asin(clamp(Math.sin(theta1) / n, 0, 1));
  return Math.PI + 2 * theta1 - 6 * theta2;
}

/** Secondary rainbow angle in degrees. */
export function secondaryRainbowAngleDeg(n: number): number {
  return (secondaryRainbowAngle(n) * 180) / Math.PI;
}

/**
 * Total deflection angle Theta(theta1, n, k) for k internal bounces:
 * Theta = 2 * (theta1 - theta2) + k * (pi - 2 * theta2).
 */
export function dropletDeflection(theta1: number, n: number, bounces = 1): number {
  const theta2 = Math.asin(clamp(Math.sin(theta1) / n, -1, 1));
  return 2 * (theta1 - theta2) + bounces * (Math.PI - 2 * theta2);
}

// ---------------------------------------------------------------------------------------------
// 4. Analytic Ray-Sphere Tracing
// ---------------------------------------------------------------------------------------------
export interface SphereHit {
  hit: boolean;
  t0: number; // Entry distance
  t1: number; // Exit distance
}

/**
 * Analytic ray-sphere intersection test.
 */
export function intersectSphere(ro: V3, rd: V3, center: V3, radius: number): SphereHit {
  const oc: V3 = [ro[0] - center[0], ro[1] - center[1], ro[2] - center[2]];
  const b = oc[0] * rd[0] + oc[1] * rd[1] + oc[2] * rd[2];
  const c = oc[0] * oc[0] + oc[1] * oc[1] + oc[2] * oc[2] - radius * radius;
  const h = b * b - c;
  if (h < 0) return { hit: false, t0: -1, t1: -1 };
  const sqrtH = Math.sqrt(h);
  return { hit: true, t0: -b - sqrtH, t1: -b + sqrtH };
}

export interface DropletRayPath {
  hit: boolean;
  /** Points along the ray path: [entry, bounce1, bounce2..., exit, ...] */
  path: V3[];
  /** Direction of ray after exiting droplet */
  exitDir: V3;
  /** Net intensity throughput accounting for Fresnel transmission and reflection */
  throughput: number;
}

/**
 * Traces a monochromatic ray into a spherical droplet with single or multiple internal reflections.
 */
export function traceDropletRay(
  ro: V3,
  rd: V3,
  center: V3,
  radius: number,
  lambdaNm: number,
  bounces = 1,
): DropletRayPath {
  const hit = intersectSphere(ro, rd, center, radius);
  if (!hit.hit || hit.t0 < 0) {
    return { hit: false, path: [ro, [ro[0] + rd[0] * 10, ro[1] + rd[1] * 10, ro[2] + rd[2] * 10]], exitDir: rd, throughput: 1.0 };
  }

  const n = waterIOR(lambdaNm);
  const pEntry: V3 = [ro[0] + rd[0] * hit.t0, ro[1] + rd[1] * hit.t0, ro[2] + rd[2] * hit.t0];
  const nEntry: V3 = [(pEntry[0] - center[0]) / radius, (pEntry[1] - center[1]) / radius, (pEntry[2] - center[2]) / radius];

  // External Fresnel at entry
  const cosI = clamp(-(rd[0] * nEntry[0] + rd[1] * nEntry[1] + rd[2] * nEntry[2]), 0, 1);
  const fresnel1 = fresnelDielectric(cosI, 1.0, n);
  const tEntry = fresnel1.t;

  // Refract into droplet
  const rDir = refractVector(rd, nEntry, 1.0 / n);
  if (!rDir) {
    // Total reflection on entry (impossible for air -> water, but for safety)
    const refl = reflectVector(rd, nEntry);
    return { hit: true, path: [pEntry], exitDir: refl, throughput: fresnel1.r };
  }

  const path: V3[] = [pEntry];
  let currPos = pEntry;
  let currDir = rDir;
  let throughput = tEntry;

  for (let b = 0; b < bounces; b++) {
    // Chord length to next sphere intersection:
    // (c - pos) . dir * 2
    const toC: V3 = [center[0] - currPos[0], center[1] - currPos[1], center[2] - currPos[2]];
    const chord = 2 * (toC[0] * currDir[0] + toC[1] * currDir[1] + toC[2] * currDir[2]);
    const nextPos: V3 = [
      currPos[0] + currDir[0] * chord,
      currPos[1] + currDir[1] * chord,
      currPos[2] + currDir[2] * chord,
    ];
    path.push(nextPos);

    // Inward normal at reflection point
    const nInward: V3 = [
      (center[0] - nextPos[0]) / radius,
      (center[1] - nextPos[1]) / radius,
      (center[2] - nextPos[2]) / radius,
    ];
    const cosBounce = clamp(-(currDir[0] * nInward[0] + currDir[1] * nInward[1] + currDir[2] * nInward[2]), 0, 1);
    const fresnelInternal = fresnelDielectric(cosBounce, n, 1.0);

    throughput *= fresnelInternal.r;
    currDir = reflectVector(currDir, nInward);
    currPos = nextPos;
  }

  // Refract out of droplet
  const toCOut: V3 = [center[0] - currPos[0], center[1] - currPos[1], center[2] - currPos[2]];
  const exitChord = 2 * (toCOut[0] * currDir[0] + toCOut[1] * currDir[1] + toCOut[2] * currDir[2]);
  const exitPos: V3 = [
    currPos[0] + currDir[0] * exitChord,
    currPos[1] + currDir[1] * exitChord,
    currPos[2] + currDir[2] * exitChord,
  ];
  path.push(exitPos);

  const nInwardExit: V3 = [
    (center[0] - exitPos[0]) / radius,
    (center[1] - exitPos[1]) / radius,
    (center[2] - exitPos[2]) / radius,
  ];
  const cosExit = clamp(-(currDir[0] * nInwardExit[0] + currDir[1] * nInwardExit[1] + currDir[2] * nInwardExit[2]), 0, 1);
  const fresnelExit = fresnelDielectric(cosExit, n, 1.0);
  throughput *= fresnelExit.t;

  const exitDir = refractVector(currDir, nInwardExit, n) ?? currDir;
  return { hit: true, path, exitDir, throughput };
}

/**
 * Multi-spectral ray trace of a droplet sampling N equal-energy wavelengths
 * and accumulating their linear sRGB contributions via spectralSamples().
 *
 * @param ro Ray origin
 * @param rd Ray unit direction
 * @param center Droplet center
 * @param radius Droplet radius
 * @param samples Number of spectral wavelength samples (8 to 16)
 * @param sampleEnv Function evaluating linear sRGB radiance from environment direction
 */
export function traceDropletSpectral(
  ro: V3,
  rd: V3,
  center: V3,
  radius: number,
  samples = 16,
  sampleEnv: (dir: V3) => RGB = () => [1, 1, 1],
): RGB {
  const hit = intersectSphere(ro, rd, center, radius);
  if (!hit.hit || hit.t0 < 0) {
    return sampleEnv(rd);
  }

  const spec = spectralSamples(samples, 380, 700);
  const accum: RGB = [0, 0, 0];

  for (let i = 0; i < spec.nm.length; i++) {
    const wl = spec.nm[i]!;
    const weight = spec.rgb[i]!;
    const trace = traceDropletRay(ro, rd, center, radius, wl, 1);

    const envCol = trace.hit ? sampleEnv(trace.exitDir) : sampleEnv(rd);
    accum[0] += envCol[0] * weight[0];
    accum[1] += envCol[1] * weight[1];
    accum[2] += envCol[2] * weight[2];
  }

  return accum;
}

// ---------------------------------------------------------------------------------------------
// 5. Helper: createDropletRayFan (THREE.LineSegments Visualization)
// ---------------------------------------------------------------------------------------------
export interface RayFanOptions {
  /** Incident light direction. Defaults to [0, 0, 1]. */
  lightDir?: THREE.Vector3 | V3;
  /**
   * Impact parameter relative to radius (0 to 1).
   * Defaults to Descartes primary caustic b/R ~ 0.861.
   */
  impactParam?: number;
  /** Whether to include the incoming incident ray segment. Defaults to true. */
  includeIncident?: boolean;
  /** Whether to include the emerging dispersed rays exiting the droplet. Defaults to true. */
  includeEmerging?: boolean;
  /** Tail length for incident and emerging rays. Defaults to radius * 1.5. */
  rayLength?: number;
  /** Custom material (defaults to LineBasicMaterial with vertexColors). */
  material?: THREE.LineBasicMaterial;
}

/**
 * Generates a `THREE.LineSegments` geometry visualizing the internal rainbow ray fan
 * and chromatic dispersion inside a spherical droplet for macro close-ups.
 *
 * @param center Droplet center vector or [x, y, z]
 * @param radius Droplet radius
 * @param SAMPLES Number of spectral wavelength samples (default 16)
 * @param options Customization options (light direction, impact parameter, tails)
 */
export function createDropletRayFan(
  center: THREE.Vector3 | V3,
  radius: number,
  SAMPLES = 16,
  options: RayFanOptions = {},
): THREE.LineSegments {
  const cx = center instanceof THREE.Vector3 ? center.x : center[0];
  const cy = center instanceof THREE.Vector3 ? center.y : center[1];
  const cz = center instanceof THREE.Vector3 ? center.z : center[2];

  const lDirRaw = options.lightDir ?? [0, 0, 1];
  const ldx = lDirRaw instanceof THREE.Vector3 ? lDirRaw.x : lDirRaw[0];
  const ldy = lDirRaw instanceof THREE.Vector3 ? lDirRaw.y : lDirRaw[1];
  const ldz = lDirRaw instanceof THREE.Vector3 ? lDirRaw.z : lDirRaw[2];
  const lLen = Math.hypot(ldx, ldy, ldz) || 1;
  const dIn: V3 = [ldx / lLen, ldy / lLen, ldz / lLen];

  // Up vector orthogonal to dIn for impact parameter offset
  let upX = 0, upY = 1, upZ = 0;
  if (Math.abs(dIn[1]) > 0.99) {
    upX = 1; upY = 0; upZ = 0;
  }
  // Gram-Schmidt orthogonalize
  const dotUp = upX * dIn[0] + upY * dIn[1] + upZ * dIn[2];
  let ox = upX - dotUp * dIn[0];
  let oy = upY - dotUp * dIn[1];
  let oz = upZ - dotUp * dIn[2];
  const oLen = Math.hypot(ox, oy, oz) || 1;
  ox /= oLen; oy /= oLen; oz /= oLen;

  // Impact parameter: Descartes primary caustic apex b/R ~ 0.861
  const bParam = clamp(options.impactParam ?? 0.861, 0.01, 0.99);
  const b = bParam * radius;
  const entryDepth = Math.sqrt(Math.max(0, radius * radius - b * b));

  // Entry point on sphere surface
  const pEntry: V3 = [
    cx + ox * b - dIn[0] * entryDepth,
    cy + oy * b - dIn[1] * entryDepth,
    cz + oz * b - dIn[2] * entryDepth,
  ];

  // Surface outward normal at entry point
  const normEntry: V3 = [
    (pEntry[0] - cx) / radius,
    (pEntry[1] - cy) / radius,
    (pEntry[2] - cz) / radius,
  ];

  const rayLen = options.rayLength ?? radius * 1.5;
  const includeIncident = options.includeIncident !== false;
  const includeEmerging = options.includeEmerging !== false;

  const positions: number[] = [];
  const colors: number[] = [];

  const addSeg = (p1: V3, p2: V3, col: RGB) => {
    positions.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    colors.push(col[0], col[1], col[2], col[0], col[1], col[2]);
  };

  // 1. Incident white beam entering droplet
  if (includeIncident) {
    const pStart: V3 = [
      pEntry[0] - dIn[0] * rayLen,
      pEntry[1] - dIn[1] * rayLen,
      pEntry[2] - dIn[2] * rayLen,
    ];
    addSeg(pStart, pEntry, [1, 1, 1]);
  }

  // 2. Dispersed internal ray fan
  const nSamples = Math.max(2, Math.floor(SAMPLES));
  for (let i = 0; i < nSamples; i++) {
    const t = i / (nSamples - 1);
    const wl = 380 + t * (700 - 380);
    const n = waterIOR(wl);
    const col = wavelengthToLinearSRGB(wl, 'peak');

    // Refraction at entry
    const refractDir = refractVector(dIn, normEntry, 1.0 / n);
    if (!refractDir) continue;

    // Chord 1: entry point to back wall
    const toCenter1: V3 = [cx - pEntry[0], cy - pEntry[1], cz - pEntry[2]];
    const chord1 = 2 * (toCenter1[0] * refractDir[0] + toCenter1[1] * refractDir[1] + toCenter1[2] * refractDir[2]);
    const pBack: V3 = [
      pEntry[0] + refractDir[0] * chord1,
      pEntry[1] + refractDir[1] * chord1,
      pEntry[2] + refractDir[2] * chord1,
    ];
    addSeg(pEntry, pBack, col);

    // Inward normal at back wall
    const nBackInward: V3 = [
      (cx - pBack[0]) / radius,
      (cy - pBack[1]) / radius,
      (cz - pBack[2]) / radius,
    ];
    const reflectDir = reflectVector(refractDir, nBackInward);

    // Chord 2: back wall to exit wall
    const toCenter2: V3 = [cx - pBack[0], cy - pBack[1], cz - pBack[2]];
    const chord2 = 2 * (toCenter2[0] * reflectDir[0] + toCenter2[1] * reflectDir[1] + toCenter2[2] * reflectDir[2]);
    const pExit: V3 = [
      pBack[0] + reflectDir[0] * chord2,
      pBack[1] + reflectDir[1] * chord2,
      pBack[2] + reflectDir[2] * chord2,
    ];
    addSeg(pBack, pExit, col);

    // Refraction at exit back into air
    if (includeEmerging) {
      const nExitInward: V3 = [
        (cx - pExit[0]) / radius,
        (cy - pExit[1]) / radius,
        (cz - pExit[2]) / radius,
      ];
      const exitDir = refractVector(reflectDir, nExitInward, n) ?? reflectDir;
      const pOut: V3 = [
        pExit[0] + exitDir[0] * rayLen,
        pExit[1] + exitDir[1] * rayLen,
        pExit[2] + exitDir[2] * rayLen,
      ];
      addSeg(pExit, pOut, col);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = options.material ?? new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.LineSegments(geometry, material);
}
