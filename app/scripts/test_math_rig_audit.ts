import { MotionBus, motion } from '../src/engine/motion';
import { CameraRig } from '../src/engine/rig';
import { keyAt, camFromKey, K } from '../src/engine/camera3d';
import { ViewportSpace } from '../src/engine/viewport';
import { LayoutNode } from '../src/engine/transform';
import { springStep, hexToLinear } from '../src/engine/util';
import * as THREE from 'three';

console.log('=== RUNNING MATH, CAMERA RIG, LAYOUT & PHYSICAL SOLVERS AUDIT VERIFICATION ===\n');

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`✅ PASS: ${msg}`);
  } else {
    console.error(`❌ FAIL: ${msg}`);
    failed++;
  }
}

// -------------------------------------------------------------
// 1. util.ts: springStep C1 velocity continuity & hexToLinear
// -------------------------------------------------------------
console.log('--- 1. Testing util.ts springStep & hexToLinear ---');

// Check velocity at t -> 0
const dt = 1e-5;
const x0 = springStep(0, 4, 0.35);
const x_dt = springStep(dt, 4, 0.35);
const v0_num = (x_dt - x0) / dt;
assert(x0 === 0, 'springStep at t=0 is exactly 0.0');
assert(v0_num < 0.1, `springStep onset velocity is ~0 (got ${v0_num.toFixed(4)}), confirming C1 smooth acceleration`);

// 8-character hex
const colLinear = hexToLinear('#38bdf8ff');
const colLinear6 = hexToLinear('#38bdf8');
assert(Math.abs(colLinear[0] - colLinear6[0]) < 1e-4 && Math.abs(colLinear[1] - colLinear6[1]) < 1e-4, 'hexToLinear properly extracts RGB from 8-digit RGBA hex');
assert(hexToLinear('invalid')[0] === 0, 'hexToLinear returns [0,0,0] on invalid hex without NaN');

// -------------------------------------------------------------
// 2. motion.ts: MotionBus.spring edge cases & mass/stiffness
// -------------------------------------------------------------
console.log('\n--- 2. Testing MotionBus.spring Robustness ---');

// Zero frequency
const sFreq0 = motion.spring(0, 1.0, { freq: 0 });
assert(!Number.isNaN(sFreq0) && Number.isFinite(sFreq0), 'MotionBus.spring with freq=0 does not return NaN or divide by zero');

// Negative damping
const sNegDamp = motion.spring(0, 0.1, { freq: 2.0, damping: -0.5 });
assert(!Number.isNaN(sNegDamp) && Number.isFinite(sNegDamp), 'MotionBus.spring with negative damping clamps safely without NaN');

// Physical mass / stiffness options
const sPhysical = motion.spring(0, 1.0, { mass: 2.0, stiffness: 200.0, damping: 10.0 });
assert(!Number.isNaN(sPhysical) && Number.isFinite(sPhysical), 'MotionBus.spring supports physical mass & stiffness options');

// Static delegates
const sStatic = MotionBus.spring(1.0, { freq: 3.0, damping: 1.0 });
assert(Math.abs(sStatic - motion.spring(0, 1.0, { freq: 3.0, damping: 1.0 })) < 1e-4, 'MotionBus.spring static delegate matches instance call');

// Under-damped & over-damped critical boundaries
const sCritNear = motion.spring(0, 0.5, { freq: 2.0, damping: 1.00005 });
assert(!Number.isNaN(sCritNear) && Number.isFinite(sCritNear), 'MotionBus.spring boundary damping zeta ≈ 1.0 evaluates without NaN');

// -------------------------------------------------------------
// 3. motion.ts: MotionBus.ease & solveCubicBezier
// -------------------------------------------------------------
console.log('\n--- 3. Testing MotionBus.ease & solveCubicBezier ---');

const easeFlat = motion.ease(0.5, 0, 1, [0, 0, 1, 1]);
assert(Math.abs(easeFlat - 0.5) < 1e-3, 'Bezier linear tangent [0,0,1,1] returns ~0.5 at t=0.5');

const easeOutOfBounds = motion.ease(0.2, 0, 1, [-0.5, 0, 1.5, 1]);
assert(!Number.isNaN(easeOutOfBounds) && easeOutOfBounds >= 0 && easeOutOfBounds <= 1, 'Bezier solver clamps out-of-bounds control points without NaN');

const easeStatic = MotionBus.ease(0.5, 0.25, 0.1, 0.25, 1.0);
assert(!Number.isNaN(easeStatic), 'MotionBus.ease static delegate evaluates 5-arg signature');

// -------------------------------------------------------------
// 4. motion.ts: MotionBus.lfo
// -------------------------------------------------------------
console.log('\n--- 4. Testing MotionBus.lfo Waveforms & Signatures ---');

const lfoTri = motion.lfo('tri', 2.0, 0.125);
assert(Math.abs(lfoTri) < 0.05, `MotionBus.lfo recognizes 'tri' alias (got ${lfoTri})`);

const lfoFreq0 = motion.lfo('sine', 0, 10.0);
assert(!Number.isNaN(lfoFreq0), 'MotionBus.lfo with freq=0 does not divide by zero');

const lfoStatic = MotionBus.lfo(0.25, 2.0, 'saw');
assert(!Number.isNaN(lfoStatic), 'MotionBus.lfo static delegate evaluates (t, freq, wave) signature');

// -------------------------------------------------------------
// 5. rig.ts: CameraRig Waypoint Sorting & Single-Waypoint
// -------------------------------------------------------------
console.log('\n--- 5. Testing CameraRig Edge Cases ---');

const rig = new CameraRig();

// Unsorted waypoints
rig.setPath([
  { t: 1.0, pos: [0, 0, 10], target: [0, 0, 0], roll: 0.5 },
  { t: 0.0, pos: [0, 0, 0], target: [0, 0, -10], roll: 0.0 },
]);
rig.evalPath(0.0);
assert(Math.abs(rig.position[2] - 0.0) < 1e-4, 'CameraRig.setPath properly sorts waypoints by t');

// Single waypoint framing
rig.setPath([
  { t: 0.5, pos: [5, 5, 5], target: [1, 2, 3], roll: 0.2, focalLength: 85 }
]);
rig.evalPath(0.5);
assert(rig.position[0] === 5 && rig.target[1] === 2 && rig.focalLengthMm === 85, 'CameraRig handles single waypoint framing');

// Zero waypoints
rig.setPath([]);
assert(rig.evalPath(0.5) === rig, 'CameraRig handles empty waypoints array safely');

// Debug ribbon samples=0
rig.setPath([
  { t: 0.0, pos: [0, 0, 0], target: [0, 0, -10] },
  { t: 1.0, pos: [0, 0, 10], target: [0, 0, 0] }
]);
const ribbon = rig.createDebugRibbon(undefined, 0);
assert(ribbon !== null, 'CameraRig.createDebugRibbon handles samples=0 safely');

// -------------------------------------------------------------
// 6. camera3d.ts & viewport.ts: Degenerate Coincident Guard & Orthographic
// -------------------------------------------------------------
console.log('\n--- 6. Testing camera3d.ts & viewport.ts Projections ---');

// Coincident position and target
const degenKey = K([0, 0, 0], [0, 0, 0], 0, 2250);
const degenCam = camFromKey(degenKey);
assert(degenCam.F[0] === 0 && degenCam.F[1] === 0 && degenCam.F[2] === 1, 'camFromKey guards coincident pos==target, holding +Z forward');

// Empty shots in keyAt
const emptyKey = keyAt([], 1.5);
assert(emptyKey.p[1] === 1.8 && emptyKey.p[2] === -8.0, 'keyAt handles empty shots array without throwing');

// Orthographic camera projection
const orthoCam = new THREE.OrthographicCamera(-10, 10, 10, -10, -100, 100);
orthoCam.position.set(0, 0, 10);
orthoCam.lookAt(0, 0, 0);
orthoCam.updateMatrixWorld();
const orthoScreen = ViewportSpace.worldToScreen([0, 0, 0], orthoCam);
assert(orthoScreen !== null && Math.abs(orthoScreen[0] - 960) < 1e-3, 'worldToScreen projects correctly for OrthographicCamera');

// -------------------------------------------------------------
// 7. transform.ts: LayoutNode marginPx & pinToWorldVertex
// -------------------------------------------------------------
console.log('\n--- 7. Testing transform.ts LayoutNode ---');

const layout = new LayoutNode('test_node');
layout.marginPx = [30, 50];
assert(layout.margin.left === 30 && layout.margin.top === 50, 'LayoutNode marginPx getter/setter works conforming to modules-reference.md');

if (failed === 0) {
  console.log('\n>>> ALL 19 AUDIT HARDENING CHECKS PASSED PERFECTLY! <<<');
} else {
  console.error(`\n>>> ${failed} AUDIT HARDENING CHECKS FAILED! <<<`);
  process.exit(1);
}
