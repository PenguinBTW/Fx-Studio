#!/usr/bin/env bun
// =============================================================================================
// Acceptance Test Suite for P6: Ribbons and Aurora Curtains
//
// Verifies:
// 1. Bishop Frame Stability: Rotation-Minimizing Frame eliminates Frenet 180° twist singularities.
//    Successive vertex normal dot products > 0.98 across inflection points without sign flips.
// 2. Spectral Profile: Altitude-dependent emission matches quantum atmospheric lines:
//    - Molecular Nitrogen Blue (391.4 nm) at lower boundary (< 110 km).
//    - Oxygen Green (557.7 nm) at base (100-150 km).
//    - Oxygen Red (630.0 nm) at top (150-300 km).
// 3. Scrub Determinism: Closed-form time-dependent evaluation f(t, s) produces 100% byte-identical
//    buffer outputs when scrubbing arbitrarily across the timeline.
// =============================================================================================

import { createHash } from 'node:crypto';
import {
  computeBishopFrames,
  computeFrenetFrames,
  computeTangents,
  RibbonGeometry,
  sampleSpine,
  type BishopFrame,
} from '../src/engine/ribbon';
import {
  AURORA_BASE_KM,
  AURORA_TOP_KM,
  AURORA_HEIGHT_KM,
  AURORA_WAVELENGTH_NITROGEN_BLUE,
  AURORA_WAVELENGTH_OXYGEN_GREEN,
  AURORA_WAVELENGTH_OXYGEN_RED,
  AURORA_COLOR_BLUE,
  AURORA_COLOR_GREEN,
  AURORA_COLOR_RED,
  sampleAuroraEmission,
  sampleAuroraCPU,
  AuroraCurtainGeometry,
  altitudeKmToNormalized,
} from '../src/engine/aurora';
import { GLSL_AURORA } from '../src/engine/glsl/aurora';
import { type V3, v3Dot, v3Norm } from '../src/engine/util';

let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
  if (!ok) fails++;
};

const sha256 = (buf: ArrayBufferView | ArrayBuffer) => {
  const u8 = ArrayBuffer.isView(buf)
    ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    : new Uint8Array(buf);
  return createHash('sha256').update(u8).digest('hex');
};

console.log('================================================================');
console.log('TEST SUITE: P6 Ribbons & Aurora Curtains');
console.log('================================================================\n');

// =============================================================================================
// TEST 1: Bishop Frame Stability & Elimination of Frenet 180° Twist Singularities
// =============================================================================================
console.log('--- 1. Bishop Frame Stability Across Inflection Points ---');

// Inflection Curve: S-curve cubic spline y(x) = x^3 - 0.25*x for x in [-1.5, 1.5]
// Second derivative y''(x) = 6x, which crosses zero at x = 0 (inflection point).
// Curvature kappa = |y''| / (1 + y'^2)^(3/2) vanishes at x = 0.
const N_SAMPLES = 200;
const inflectionPoints: V3[] = [];
for (let i = 0; i <= N_SAMPLES; i++) {
  const x = -1.5 + (3.0 * i) / N_SAMPLES;
  const y = x * x * x - 0.25 * x;
  inflectionPoints.push([x, y, 0]);
}

// 1.1 Frenet Frame: Verify the standard Frenet normal flips by 180° across the inflection point
const frenetFrames = computeFrenetFrames(inflectionPoints);
let frenetMinDot = Infinity;
let frenetFlipped = false;
for (let i = 0; i < frenetFrames.length - 1; i++) {
  const dot = v3Dot(frenetFrames[i]!.normal, frenetFrames[i + 1]!.normal);
  if (dot < frenetMinDot) frenetMinDot = dot;
  if (dot < 0) frenetFlipped = true;
}
check(
  'Frenet frame demonstrates 180° twist flip at inflection point',
  frenetFlipped && frenetMinDot < -0.9,
  `Frenet min successive normal dot: ${frenetMinDot.toFixed(4)} (dot < 0 confirmed singularity)`
);

// 1.2 Bishop Frame: Verify normal vector NEVER flips sign and stays stable (> 0.98)
const bishopFrames = computeBishopFrames(inflectionPoints);
let bishopMinDot = Infinity;
let bishopAnyNegative = false;
for (let i = 0; i < bishopFrames.length - 1; i++) {
  const dot = v3Dot(bishopFrames[i]!.normal, bishopFrames[i + 1]!.normal);
  if (dot < bishopMinDot) bishopMinDot = dot;
  if (dot < 0) bishopAnyNegative = true;
}
check(
  'Bishop frame eliminates twist singularity across inflection points',
  !bishopAnyNegative && bishopMinDot > 0.98,
  `Bishop min successive normal dot: ${bishopMinDot.toFixed(6)} (> 0.98 requirement satisfied)`
);

// 1.3 High-Curvature 3D Loop (Solar Prominence loop with 3D torsion)
// r(s) = [5*cos(s), 4*sin(2s), 2.5*sin(3s)]
const loopPoints: V3[] = [];
const N_LOOP = 250;
for (let i = 0; i <= N_LOOP; i++) {
  const s = (i / N_LOOP) * Math.PI * 2;
  loopPoints.push([5 * Math.cos(s), 4 * Math.sin(2 * s), 2.5 * Math.sin(3 * s)]);
}
const loopFrames = computeBishopFrames(loopPoints, { closed: true });
let loopMinDot = Infinity;
let loopOrthonormal = true;
for (let i = 0; i < loopFrames.length; i++) {
  const f = loopFrames[i]!;
  const lenT = Math.hypot(...f.tangent);
  const lenN = Math.hypot(...f.normal);
  const lenB = Math.hypot(...f.binormal);
  const dotTN = Math.abs(v3Dot(f.tangent, f.normal));
  const dotTB = Math.abs(v3Dot(f.tangent, f.binormal));
  const dotNB = Math.abs(v3Dot(f.normal, f.binormal));

  if (
    Math.abs(lenT - 1) > 1e-5 ||
    Math.abs(lenN - 1) > 1e-5 ||
    Math.abs(lenB - 1) > 1e-5 ||
    dotTN > 1e-5 ||
    dotTB > 1e-5 ||
    dotNB > 1e-5
  ) {
    loopOrthonormal = false;
  }

  if (i < loopFrames.length - 1) {
    const dot = v3Dot(f.normal, loopFrames[i + 1]!.normal);
    if (dot < loopMinDot) loopMinDot = dot;
  }
}
check(
  'Bishop frames along 3D solar prominence loop maintain strict orthonormality',
  loopOrthonormal,
  'T, N, B are unit-length and mutually orthogonal'
);
check(
  'Bishop frame on 3D loop never flips sign (successive dot > 0.98)',
  loopMinDot > 0.98,
  `Loop min dot: ${loopMinDot.toFixed(6)}`
);

// 1.4 RibbonGeometry Quad Strip Construction
const ribbon = new RibbonGeometry({
  segments: 80,
  width: (s) => 0.4 * Math.sin(s * Math.PI) + 0.1, // Width taper w(s)
  twist: (s) => s * Math.PI * 2,                   // Twist angle alpha(s)
  spine: (_t, s) => [s * 10 - 5, Math.sin(s * Math.PI * 2) * 2, Math.cos(s * Math.PI * 2) * 2],
});

const posAttr = ribbon.getAttribute('position');
const normAttr = ribbon.getAttribute('normal');
const uvAttr = ribbon.getAttribute('uv');
const idxAttr = ribbon.getIndex();

let noNaNs = true;
for (let i = 0; i < posAttr.array.length; i++) {
  if (!Number.isFinite(posAttr.array[i])) noNaNs = false;
}
for (let i = 0; i < normAttr.array.length; i++) {
  if (!Number.isFinite(normAttr.array[i])) noNaNs = false;
}

check(
  'RibbonGeometry generates complete quad strip without NaNs/Infs',
  noNaNs && posAttr.count === 162 && idxAttr !== null && idxAttr.count === 80 * 6,
  `Vertices: ${posAttr.count}, Triangles: ${idxAttr!.count / 3}`
);

// Verify UV mapping: u in [0, 1] across width, v in [0, 1] along path length
const uvArr = uvAttr.array as Float32Array;
const leftU0 = uvArr[0], leftV0 = uvArr[1];
const rightU0 = uvArr[2], rightV0 = uvArr[3];
const leftUn = uvArr[uvArr.length - 4], leftVn = uvArr[uvArr.length - 3];
const rightUn = uvArr[uvArr.length - 2], rightVn = uvArr[uvArr.length - 1];

check(
  'Ribbon UV mapping spans u in [0, 1] across width and v in [0, 1] along length',
  leftU0 === 0 && rightU0 === 1 && leftV0 === 0 && rightV0 === 0 &&
  leftUn === 0 && rightUn === 1 && Math.abs(leftVn - 1) < 1e-4 && Math.abs(rightVn - 1) < 1e-4,
  `UV start: (${leftU0}, ${leftV0}) - (${rightU0}, ${rightV0}), UV end: (${leftUn}, ${leftVn.toFixed(2)}) - (${rightUn}, ${rightVn.toFixed(2)})`
);

console.log('');

// =============================================================================================
// TEST 2: Spectral Profile & Quantum Atmospheric Emission Lines
// =============================================================================================
console.log('--- 2. Spectral Profile & Quantum Atmospheric Emission ---');

// 2.1 Spectral Wavelengths match quantum atmospheric physics
check(
  'Molecular Nitrogen violet-blue line matches 391.4 nm',
  AURORA_WAVELENGTH_NITROGEN_BLUE === 391.4
);
check(
  'Atomic Oxygen green forbidden line matches 557.7 nm',
  AURORA_WAVELENGTH_OXYGEN_GREEN === 557.7
);
check(
  'Atomic Oxygen red thermospheric line matches 630.0 nm',
  AURORA_WAVELENGTH_OXYGEN_RED === 630.0
);

// 2.2 Quantum line linear sRGB chromaticities
check(
  '391.4 nm color is Blue-dominant (B > 0.8, G < 0.05)',
  AURORA_COLOR_BLUE[2] >= 0.8 && AURORA_COLOR_BLUE[1] < 0.05,
  `RGB: [${AURORA_COLOR_BLUE.map((v) => v.toFixed(3)).join(', ')}]`
);
check(
  '557.7 nm color is Green-dominant (G = 1.0, G > R, G > B)',
  AURORA_COLOR_GREEN[1] >= 0.99 && AURORA_COLOR_GREEN[1] > AURORA_COLOR_GREEN[0] && AURORA_COLOR_GREEN[1] > AURORA_COLOR_GREEN[2],
  `RGB: [${AURORA_COLOR_GREEN.map((v) => v.toFixed(3)).join(', ')}]`
);
check(
  '630.0 nm color is Red-dominant (R = 1.0, R > G, R > B)',
  AURORA_COLOR_RED[0] >= 0.99 && AURORA_COLOR_RED[0] > AURORA_COLOR_RED[1] && AURORA_COLOR_RED[0] > AURORA_COLOR_RED[2],
  `RGB: [${AURORA_COLOR_RED.map((v) => v.toFixed(3)).join(', ')}]`
);

// 2.3 Altitude-Dependent Emission Profile Matches Physics
// Lower boundary (100 km -> alt = 0.0): Nitrogen Blue fringe
const col100km = sampleAuroraEmission(altitudeKmToNormalized(100));
check(
  'Altitude 100 km (base boundary): Nitrogen Blue/Violet dominates',
  col100km[2] > col100km[0] && col100km[2] > col100km[1] && col100km[2] > 0.9,
  `RGB: [${col100km.map((v) => v.toFixed(3)).join(', ')}]`
);

// Base region (130-150 km -> alt = 0.2): Pure Oxygen Green
const col140km = sampleAuroraEmission(altitudeKmToNormalized(140));
check(
  'Altitude 140 km (base core): Oxygen Green dominates (557.7 nm)',
  col140km[1] > col140km[0] && col140km[1] > col140km[2] && col140km[1] > 0.9,
  `RGB: [${col140km.map((v) => v.toFixed(3)).join(', ')}]`
);

// Upper thermosphere (280-300 km -> alt = 0.9..1.0): Pure Oxygen Red
const col290km = sampleAuroraEmission(altitudeKmToNormalized(290));
check(
  'Altitude 290 km (upper veil): Oxygen Red dominates (630.0 nm)',
  col290km[0] > col290km[1] && col290km[0] > col290km[2] && col290km[0] > 0.9,
  `RGB: [${col290km.map((v) => v.toFixed(3)).join(', ')}]`
);

// 2.4 Monotonicity of Spectral Transitions
let greenMonotonicRise = true;
let prevGreen = -1;
for (let alt = 0.0; alt <= 0.2; alt += 0.02) {
  const c = sampleAuroraEmission(alt);
  if (c[1] < prevGreen - 1e-6) greenMonotonicRise = false;
  prevGreen = c[1];
}
check(
  'Oxygen green channel rises smoothly and monotonically from 100 to 140 km',
  greenMonotonicRise
);

let redMonotonicRise = true;
let prevRed = -1;
for (let alt = 0.3; alt <= 0.9; alt += 0.05) {
  const c = sampleAuroraEmission(alt);
  if (c[0] < prevRed - 1e-6) redMonotonicRise = false;
  prevRed = c[0];
}
check(
  'Oxygen red channel rises smoothly and monotonically from 160 to 280 km',
  redMonotonicRise
);

// 2.5 GLSL Shader Mirror Alignment
const expectedBlueStr = `vec3(${AURORA_COLOR_BLUE.map((x) => x.toFixed(5)).join(', ')})`;
const expectedGreenStr = `vec3(${AURORA_COLOR_GREEN.map((x) => x.toFixed(5)).join(', ')})`;
const expectedRedStr = `vec3(${AURORA_COLOR_RED.map((x) => x.toFixed(5)).join(', ')})`;

check(
  'GLSL_AURORA shader mirrors CPU spectral emission constants exactly',
  GLSL_AURORA.includes(expectedBlueStr) &&
  GLSL_AURORA.includes(expectedGreenStr) &&
  GLSL_AURORA.includes(expectedRedStr),
  'GLSL contains identical Rec.709 linear sRGB constants'
);

console.log('');

// =============================================================================================
// TEST 3: Scrub Determinism (Out-of-Order / Arbitrary Timeline Times)
// =============================================================================================
console.log('--- 3. Scrub Determinism (Bitwise Byte Output Identity) ---');

// 3.1 Closed-form time-dependent RibbonGeometry evaluation
const determinismRibbon = new RibbonGeometry({
  segments: 64,
  width: (s, t) => 0.25 + 0.15 * Math.sin(s * 8 + (t ?? 0)),
  twist: (s, t) => Math.sin(t ?? 0) * s * Math.PI,
  spine: (t, s) => [
    Math.cos(s * Math.PI * 2 + t * 0.5) * 6,
    Math.sin(s * Math.PI * 4 + t * 0.3) * 2,
    (s - 0.5) * 12 + Math.sin(t + s * 3) * 1.5,
  ],
});

// Sample points across arbitrary times
const testTimes = [1.42, 5.89, 12.07, 24.68, 0.0, 100.333];

// First pass: Record SHA-256 hashes of position, normal, and UV buffer bytes
const firstHashes = new Map<number, string>();
for (const t of testTimes) {
  determinismRibbon.updateFromTime(t);
  const posBytes = determinismRibbon.getAttribute('position').array as Float32Array;
  const normBytes = determinismRibbon.getAttribute('normal').array as Float32Array;
  const hPos = sha256(posBytes);
  const hNorm = sha256(normBytes);
  firstHashes.set(t, `${hPos}:${hNorm}`);
}

// Verify that different times produced different outputs (animation is active)
const uniqueHashes = new Set(firstHashes.values());
check(
  'Different timeline times produce distinct, non-trivial ribbon frames',
  uniqueHashes.size === testTimes.length,
  `${uniqueHashes.size} unique hashes across ${testTimes.length} times`
);

// Scrub away to unrelated chaotic times
for (const t of [999.1, 42.42, -13.7, 77.01, 3.14159]) {
  determinismRibbon.updateFromTime(t);
}

// Second pass: Reverse scrub order - verify 100% byte-for-byte identical output
let reverseScrubPass = true;
for (const t of [...testTimes].reverse()) {
  determinismRibbon.updateFromTime(t);
  const posBytes = determinismRibbon.getAttribute('position').array as Float32Array;
  const normBytes = determinismRibbon.getAttribute('normal').array as Float32Array;
  const currentHash = `${sha256(posBytes)}:${sha256(normBytes)}`;
  if (currentHash !== firstHashes.get(t)) {
    reverseScrubPass = false;
  }
}
check(
  'Ribbon reverse-order scrub produces byte-identical geometry buffers',
  reverseScrubPass
);

// Third pass: Shuffled / random jumps across the timeline
const shuffledTimes = [testTimes[2]!, testTimes[0]!, testTimes[4]!, testTimes[1]!, testTimes[5]!, testTimes[3]!];
let randomScrubPass = true;
for (const t of shuffledTimes) {
  determinismRibbon.updateFromTime(t);
  const posBytes = determinismRibbon.getAttribute('position').array as Float32Array;
  const normBytes = determinismRibbon.getAttribute('normal').array as Float32Array;
  const currentHash = `${sha256(posBytes)}:${sha256(normBytes)}`;
  if (currentHash !== firstHashes.get(t)) {
    randomScrubPass = false;
  }
}
check(
  'Ribbon arbitrary random-jump scrub produces byte-identical geometry buffers',
  randomScrubPass
);

// 3.2 AuroraCurtainGeometry Scrub Determinism
const curtain = new AuroraCurtainGeometry({
  segmentsX: 64,
  segmentsY: 16,
  foldAmplitude: 2.0,
});

const curtainHashes = new Map<number, string>();
for (const t of testTimes) {
  curtain.update(t);
  const posBytes = curtain.getAttribute('position').array as Float32Array;
  const normBytes = curtain.getAttribute('normal').array as Float32Array;
  const colBytes = curtain.getAttribute('color').array as Float32Array;
  curtainHashes.set(t, `${sha256(posBytes)}:${sha256(normBytes)}:${sha256(colBytes)}`);
}

// Distort timeline state
for (const t of [88.8, 123.456, 0.001, 555.5]) {
  curtain.update(t);
}

// Re-verify curtain determinism
let curtainScrubPass = true;
for (const t of [...testTimes].reverse()) {
  curtain.update(t);
  const posBytes = curtain.getAttribute('position').array as Float32Array;
  const normBytes = curtain.getAttribute('normal').array as Float32Array;
  const colBytes = curtain.getAttribute('color').array as Float32Array;
  const currentHash = `${sha256(posBytes)}:${sha256(normBytes)}:${sha256(colBytes)}`;
  if (currentHash !== curtainHashes.get(t)) {
    curtainScrubPass = false;
  }
}
check(
  'Aurora curtain geometry produces bitwise byte-identical buffers upon out-of-order scrub',
  curtainScrubPass
);

// 3.3 Volumetric Aurora Field Sample Determinism (sampleAuroraCPU)
const sampleGrid: V3[] = [
  [0, 5, 0],
  [2.5, 8, -1],
  [-4, 2, 3],
  [10, 0, 0],
  [0, 10, 0],
];

function sampleFieldBytes(t: number): string {
  const values = new Float64Array(sampleGrid.length * 5);
  for (let i = 0; i < sampleGrid.length; i++) {
    const res = sampleAuroraCPU(sampleGrid[i]!, t);
    const o = i * 5;
    values[o] = res.finalDensity;
    values[o + 1] = res.emission[0];
    values[o + 2] = res.emission[1];
    values[o + 3] = res.emission[2];
    values[o + 4] = res.alt;
  }
  return sha256(values);
}

const f1 = sampleFieldBytes(4.75);
sampleFieldBytes(100.2);
sampleFieldBytes(0.0);
const f2 = sampleFieldBytes(4.75);
check(
  'Volumetric aurora field evaluation is 100% deterministic at arbitrary timeline times',
  f1 === f2,
  `Hash: ${f1.slice(0, 16)}...`
);

console.log('\n================================================================');
if (fails === 0) {
  console.log('ALL TESTS PASSED: P6 Ribbons & Aurora Curtains verified.');
  process.exit(0);
} else {
  console.error(`FAILED: ${fails} test(s) failed.`);
  process.exit(1);
}
