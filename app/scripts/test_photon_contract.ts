import * as THREE from 'three';
import {
  photonState,
  photonScreenPosAt,
  getActCamera,
  getAct,
  CORE_WALK,
  generateCoreWalk,
  ACT_BOUNDS,
  projectWorldToScreen,
  type PhotonState,
} from '../src/scenes/first_light/photon';
import { mulberry32 } from '../src/engine/util';

let fails = 0;
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
  if (!ok) fails++;
};

console.log('--- TEST: P1a Photon State Contract ---\n');

// 1. CORE_WALK and Generator Invariants
{
  check('CORE_WALK has 1001 steps', CORE_WALK.length === 1001, `length=${CORE_WALK.length}`);
  const origin = CORE_WALK[0]!;
  check('CORE_WALK starts at [0, 0, 0]', origin[0] === 0 && origin[1] === 0 && origin[2] === 0);
  const rewalk = generateCoreWalk(1337, 1000);
  let walkDeterministic = true;
  for (let i = 0; i < CORE_WALK.length; i++) {
    const a = CORE_WALK[i]!;
    const b = rewalk[i]!;
    if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2]) {
      walkDeterministic = false;
      break;
    }
  }
  check('generateCoreWalk(1337) is strictly deterministic', walkDeterministic);
}

// 2. Exact Equivalence to Three.js PerspectiveCamera
{
  const threeCam = new THREE.PerspectiveCamera(45, 1920 / 1080, 0.1, 1000);
  const v = new THREE.Vector3();
  const testPoints = [
    [0, 0, 0],
    [-3.0, 4.75, -1.1],
    [5, -2, 1],
    [100, 60, 0],
  ] as const;

  let maxDiff = 0;
  for (let act = 0; act < 6; act++) {
    const camSpec = getActCamera(act, ACT_BOUNDS[act]!.start);
    threeCam.fov = camSpec.fov;
    threeCam.near = camSpec.near;
    threeCam.far = camSpec.far;
    threeCam.position.set(camSpec.pos[0], camSpec.pos[1], camSpec.pos[2]);
    threeCam.lookAt(camSpec.target[0], camSpec.target[1], camSpec.target[2]);
    threeCam.updateMatrixWorld();
    threeCam.updateProjectionMatrix();

    for (const pt of testPoints) {
      v.set(pt[0], pt[1], pt[2]).project(threeCam);
      const expected: [number, number] = [
        (v.x * 0.5 + 0.5) * 1920,
        (1.0 - (v.y * 0.5 + 0.5)) * 1080,
      ];
      const actual = projectWorldToScreen(pt as any, camSpec);
      const diff = Math.hypot(actual[0] - expected[0], actual[1] - expected[1]);
      maxDiff = Math.max(maxDiff, diff);
    }
  }
  check('projectWorldToScreen matches Three.js camera projection bit-for-bit', maxDiff < 1e-10, `maxDiff=${maxDiff.toExponential(2)}`);
}

// 3. Viewport Enclosure
{
  let insideViewport = true;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let t = 0; t <= 256; t += 0.25) {
    const [sx, sy] = photonScreenPosAt(t);
    minX = Math.min(minX, sx);
    maxX = Math.max(maxX, sx);
    minY = Math.min(minY, sy);
    maxY = Math.max(maxY, sy);
    if (sx < 0 || sx > 1920 || sy < 0 || sy > 1080) {
      insideViewport = false;
    }
  }
  check(
    'screenPos stays within 1080p bounds [0..1920, 0..1080]',
    insideViewport,
    `X:[${minX.toFixed(1)}, ${maxX.toFixed(1)}] Y:[${minY.toFixed(1)}, ${maxY.toFixed(1)}]`,
  );
}

// 4. Seam Continuity Across Act Boundaries
{
  const seamTimes = [22.0, 64.0, 110.0, 154.0, 198.0];
  const dtFrame = 1 / 60; // 60 fps frame step

  for (const s of seamTimes) {
    const eps = 1e-6;
    const stateBefore = photonState(s - eps);
    const stateAfter = photonState(s + eps);
    const epsJump = Math.hypot(
      stateAfter.screenPos[0] - stateBefore.screenPos[0],
      stateAfter.screenPos[1] - stateBefore.screenPos[1],
    );
    check(
      `seam continuity limit at t=${s.toFixed(1)}s (jump < 0.01 px)`,
      epsJump < 0.01,
      `jump=${epsJump.toFixed(6)} px`,
    );

    const frameBefore = photonState(s - dtFrame);
    const frameAt = photonState(s);
    const frameJump = Math.hypot(
      frameAt.screenPos[0] - frameBefore.screenPos[0],
      frameAt.screenPos[1] - frameBefore.screenPos[1],
    );
    check(
      `seam 1-frame delta at t=${s.toFixed(1)}s (1/60s step < 8.0 px)`,
      frameJump < 8.0,
      `frameDelta=${frameJump.toFixed(3)} px`,
    );
  }
}

// 5. Determinism (shuffled out-of-order evaluations match sequential)
{
  const rng = mulberry32(42);
  const sampleTimes: number[] = [];
  for (let i = 0; i < 500; i++) {
    sampleTimes.push(rng() * 256.0);
  }
  // Include explicit boundary timestamps
  sampleTimes.push(0.0, 22.0, 64.0, 110.0, 154.0, 198.0, 256.0);

  // Sequential evaluation
  const seqResults = new Map<number, PhotonState>();
  for (const t of sampleTimes) {
    seqResults.set(t, photonState(t));
  }

  // Shuffle order
  const shuffledTimes = [...sampleTimes];
  for (let i = shuffledTimes.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffledTimes[i]!;
    shuffledTimes[i] = shuffledTimes[j]!;
    shuffledTimes[j] = tmp;
  }

  // Evaluate in shuffled order
  let deterministic = true;
  let mismatchInfo = '';
  for (const t of shuffledTimes) {
    const actual = photonState(t);
    const expected = seqResults.get(t)!;

    if (
      actual.worldPos[0] !== expected.worldPos[0] ||
      actual.worldPos[1] !== expected.worldPos[1] ||
      actual.worldPos[2] !== expected.worldPos[2] ||
      actual.dir[0] !== expected.dir[0] ||
      actual.dir[1] !== expected.dir[1] ||
      actual.dir[2] !== expected.dir[2] ||
      actual.screenPos[0] !== expected.screenPos[0] ||
      actual.screenPos[1] !== expected.screenPos[1] ||
      actual.act !== expected.act ||
      actual.depth !== expected.depth ||
      actual.intensity !== expected.intensity ||
      actual.wavelength !== expected.wavelength
    ) {
      deterministic = false;
      mismatchInfo = `Mismatch at t=${t}`;
      break;
    }
  }
  check('determinism: shuffled evaluation produces identical results', deterministic, mismatchInfo);
}

// 6. Tangent Normalization and Property Contracts
{
  let dirNormalized = true;
  let maxDirErr = 0;
  for (let t = 0.5; t < 255.5; t += 2.0) {
    const s = photonState(t);
    const len = Math.hypot(s.dir[0], s.dir[1], s.dir[2]);
    const err = Math.abs(len - 1.0);
    maxDirErr = Math.max(maxDirErr, err);
    if (err > 1e-4) {
      dirNormalized = false;
    }
  }
  check('tangent direction is unit normalized', dirNormalized, `maxErr=${maxDirErr.toExponential(2)}`);
}

// 7. Performance (100,000 evaluations < 100 ms)
{
  // Warmup JIT
  for (let i = 0; i < 2000; i++) {
    photonState((i % 2560) * 0.1);
  }

  const N = 100000;
  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    photonState((i % 2560) * 0.1);
  }
  const elapsedMs = performance.now() - t0;
  check(
    `performance: 100,000 evaluations execute in under 100 ms`,
    elapsedMs < 100.0,
    `elapsed=${elapsedMs.toFixed(2)} ms (${((elapsedMs / N) * 1000).toFixed(1)} ns/eval)`,
  );
}

console.log(`\n========================================`);
if (fails === 0) {
  console.log(`ALL PHOTON CONTRACT TESTS PASSED`);
} else {
  console.log(`${fails} TEST(S) FAILED`);
}
console.log(`========================================\n`);

process.exit(fails ? 1 : 0);
