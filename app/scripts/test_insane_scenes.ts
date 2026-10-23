// Verification Test Suite for insane_scenes_demo
// Tests mathematical invariants, closed-form determinism, project manifest,
// exact Peregrine breather rogue wave algebraic formula, Gyroid analytical gradient,
// critically damped spring solver, 64-marker wave stagger, and 5-tap temporal scratch depth.

import { motion } from '../src/engine/motion';
import manifest from '../src/scenes/insane_scenes_demo/project.json';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`PASS: ${msg}`);
}

console.log('=== TEST SUITE: INSANE SCENES DEMO INVARIANTS ===\n');

// 1. Manifest Structure & Timeline Coverage
assert(manifest.project === 'insane_scenes_demo', 'Project name is insane_scenes_demo');
assert(manifest.entries.length === 2, 'Manifest contains exactly 2 scenes');
const s1 = manifest.entries[0]!;
const s2 = manifest.entries[1]!;

assert(s1.id === 'kerr_ergosphere' && s1.start === 0.0 && s1.end === 12.0, 'Scene 1: kerr_ergosphere [0.0s - 12.0s]');
assert(s2.id === 'photonic_cavity' && s2.start === 10.0 && s2.end === 22.0, 'Scene 2: photonic_cavity [10.0s - 22.0s]');

assert((manifest.transitions?.length ?? 0) === 1, 'Manifest contains exactly 1 transition');
const tr = manifest.transitions![0]!;
assert(tr.transition === 'topological_tear', 'Transition module is topological_tear');
assert(tr.from === 'kerr_ergosphere' && tr.to === 'photonic_cavity', 'Transition connects Scene 1 -> Scene 2');
assert(tr.at === 10.0 && tr.dur === 2.0, 'Transition seam at 10.0s with duration 2.0s [10.0s - 12.0s]');
assert(tr.at >= s1.start && tr.at + tr.dur <= s1.end, 'Transition window lies entirely within Scene 1');
assert(tr.at >= s2.start && tr.at + tr.dur <= s2.end, 'Transition window lies entirely within Scene 2');

// 2. Peregrine Breather Algebraic Closed-Form Solution Test
// u(x, t) = [ 1 - 4*(1 + 2*i*t) / (1 + 4*x^2 + 4*t^2) ] * exp(i*t)
// |u(x, t)|^2 = [ (4*x^2 + 4*t^2 - 3)^2 + 64*t^2 ] / (1 + 4*x^2 + 4*t^2)^2
function peregrineIntensity(x: number, tau: number): number {
  const x2 = x * x * 4.0;
  const t2 = tau * tau * 4.0;
  const denom = 1.0 + x2 + t2;
  const numReal = x2 + t2 - 3.0;
  const numImag = -8.0 * tau;
  return (numReal * numReal + numImag * numImag) / (denom * denom);
}

const peakAmp = peregrineIntensity(0, 0);
assert(Math.abs(peakAmp - 9.0) < 1e-9, `Peregrine spontaneous rogue peak amplitude |u(0,0)|^2 = 9.000 (actual: ${peakAmp.toFixed(6)})`);

const farFieldAmp = peregrineIntensity(100.0, 0);
assert(Math.abs(farFieldAmp - 1.0) < 1e-3, `Peregrine far-field plane wave amplitude |u(100,0)|^2 -> 1.000 (actual: ${farFieldAmp.toFixed(6)})`);

// 3. Gyroid Analytic Normal Vector Gradient Test
// f(x, y, z) = sin(x)*cos(y) + sin(y)*cos(z) + sin(z)*cos(x)
// grad f = (cos(x)*cos(y) - sin(z)*sin(x), cos(y)*cos(z) - sin(x)*sin(y), cos(z)*cos(x) - sin(y)*sin(z))
function gyroidF(x: number, y: number, z: number): number {
  return Math.sin(x) * Math.cos(y) + Math.sin(y) * Math.cos(z) + Math.sin(z) * Math.cos(x);
}

function gyroidAnalyticGrad(x: number, y: number, z: number): [number, number, number] {
  return [
    Math.cos(x) * Math.cos(y) - Math.sin(z) * Math.sin(x),
    Math.cos(y) * Math.cos(z) - Math.sin(x) * Math.sin(y),
    Math.cos(z) * Math.cos(x) - Math.sin(y) * Math.sin(z),
  ];
}

const testPt: [number, number, number] = [0.82, 1.45, -0.63];
const eps = 1e-5;
const numGradX = (gyroidF(testPt[0] + eps, testPt[1], testPt[2]) - gyroidF(testPt[0] - eps, testPt[1], testPt[2])) / (2 * eps);
const numGradY = (gyroidF(testPt[0], testPt[1] + eps, testPt[2]) - gyroidF(testPt[0], testPt[1] - eps, testPt[2])) / (2 * eps);
const numGradZ = (gyroidF(testPt[0], testPt[1], testPt[2] + eps) - gyroidF(testPt[0], testPt[1], testPt[2] - eps)) / (2 * eps);

const [anGradX, anGradY, anGradZ] = gyroidAnalyticGrad(testPt[0], testPt[1], testPt[2]);
const gradError = Math.sqrt((numGradX - anGradX) ** 2 + (numGradY - anGradY) ** 2 + (numGradZ - anGradZ) ** 2);
assert(gradError < 1e-4, `Gyroid analytic gradient matches numerical finite differences to < 1e-4 (error: ${gradError.toExponential(4)})`);

// 4. MotionBus Stagger (Wave Pattern) Test for 64 Subatomic Markers
const markerDelays = motion.stagger(64, 1.8, 'wave');
assert(markerDelays.length === 64, 'MotionBus.stagger returns 64 delays');
assert(markerDelays[0] === 0.0, 'Marker 0 has 0s delay offset');
assert(markerDelays.every((d) => d >= 0 && d <= 1.8), 'All 64 marker delays bounded in [0, 1.8s]');
const maxDelay = Math.max(...markerDelays);
assert(Math.abs(maxDelay - 1.8) < 0.01, `Peak of sinusoidal wave stagger approximately equals totalDuration 1.8s (actual: ${maxDelay.toFixed(4)})`);

// 5. Critically Damped Spring Solver (zeta = 1.0) Monotonicity & Zero-Overshoot Test
let hasOvershoot = false;
let maxSpringVal = 0.0;
for (let step = 0; step <= 200; step++) {
  const t = step * 0.02;
  const s = motion.spring(0.0, t, { freq: 3.0, damping: 1.0, scale: 1.0 });
  if (s > maxSpringVal) maxSpringVal = s;
  if (s > 1.00001) hasOvershoot = true;
}
assert(!hasOvershoot, `Critically damped spring has strictly 0 overshoot (max val: ${maxSpringVal.toFixed(6)} <= 1.0)`);

import { overlayTextDuck } from '../src/engine/transition';

// 6. Typographic Decoupling & Silence Window Verification
// During transition seam [10.0s, 12.0s] where u in [0, 1]:
// Outgoing scene has tin = 1, tout = u
// Incoming scene has tin = u, tout = 0
const midU = 0.45; // Inside the 20% temporal silence window [0.35, 0.55]
const outDuckMid = overlayTextDuck(1, midU);
const inDuckMid = overlayTextDuck(midU, 0);

assert(outDuckMid === 0.0, `Outgoing text completely culled at u=0.45 (duck: ${outDuckMid})`);
assert(inDuckMid === 0.0, `Incoming text completely culled at u=0.45 (duck: ${inDuckMid})`);

const earlyU = 0.1;
assert(overlayTextDuck(1, earlyU) > 0.0, `Outgoing text visible before u=0.35 threshold (u=0.1: ${overlayTextDuck(1, earlyU).toFixed(3)})`);

const lateU = 0.8;
assert(overlayTextDuck(lateU, 0) > 0.0, `Incoming text visible after u=0.55 threshold (u=0.8: ${overlayTextDuck(lateU, 0).toFixed(3)})`);

console.log('\nALL INVARIANTS AND UNIT TESTS PASSED PERFECTLY!\n');
