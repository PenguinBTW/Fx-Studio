import { mapWalkToTree, walkToStreamlines } from '../src/engine/treewalk';
import {
  treeOrder,
  resampleTree,
  treeToCurve,
  treeMorph,
  morphBranches,
  curveLength,
  turningAngles,
  type Tree,
  type Curve,
  type V3,
} from '../src/engine/curvemorph';
import { CORE_WALK, generateCoreWalk } from '../src/scenes/first_light/photon';

let failed = 0;
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
  if (!ok) failed++;
};

const d3 = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const finite = (c: Curve) => c.every((p) => p.every(Number.isFinite));
const totalCurv = (c: Curve) => turningAngles(c, false).reduce((a, b) => a + b, 0);

console.log('--- 1. mapWalkToTree specifications & Tree compatibility ---');
{
  const B = 6;
  const tree = mapWalkToTree(CORE_WALK, B, { maxDepth: 3, spread: 0.6 });

  check('tree is non-empty', tree.branches.length > 0);
  check('correct branch count', tree.branches.length === B, `expected ${B}, got ${tree.branches.length}`);
  check('parent array matches branch count', tree.parent.length === B);
  check('root branch parent is -1', tree.parent[0] === -1);

  // Parent hierarchy validity
  const validParents = tree.parent.every((p, i) => i === 0 ? p === -1 : p >= 0 && p < i);
  check('all child branch parents are valid earlier indices', validParents);

  // Depth verification
  const depths = new Array<number>(B).fill(0);
  for (let i = 1; i < B; i++) {
    depths[i] = depths[tree.parent[i]] + 1;
  }
  const maxObservedDepth = Math.max(...depths);
  check('maxDepth strictly respected (<= 3)', maxObservedDepth <= 3, `max depth: ${maxObservedDepth}`);

  // Attachment point verification: each child branch starts at an exact vertex of its parent
  let allAttached = true;
  for (let i = 1; i < B; i++) {
    const p = tree.parent[i];
    const parentBranch = tree.branches[p];
    const startPt = tree.branches[i][0];
    const minD = Math.min(...parentBranch.map((v) => d3(v, startPt)));
    if (minD > 1e-12) allAttached = false;
  }
  check('every child branch starts at an exact vertex of its parent branch', allAttached);

  // Coordinate validity
  check('all branch vertices are finite (no NaN/Inf)', tree.branches.every(finite));
  check('all branches have at least 2 vertices', tree.branches.every((b) => b.length >= 2));

  // curvemorph.ts compatibility: treeOrder
  const order = treeOrder(tree);
  check('treeOrder visits all branches', order.length === B && new Set(order).size === B);

  // curvemorph.ts compatibility: resampleTree
  const resampled = resampleTree(tree, 16);
  check('resampleTree succeeds', resampled.branches.length === B && resampled.branches.every((b) => b.length === 16));
  check('resampled tree finite', resampled.branches.every(finite));

  // curvemorph.ts compatibility: treeToCurve
  const bm = treeToCurve(tree, CORE_WALK, { vertsPerBranch: 16 });
  const mid = morphBranches(bm, 1);
  let chainGap = 0;
  for (let k = 1; k < bm.order.length; k++) {
    chainGap = Math.max(chainGap, d3(mid[bm.order[k - 1]][15], mid[bm.order[k]][0]));
  }
  check('treeToCurve branches chain into continuous curve at s=1', chainGap < 1e-9);

  // curvemorph.ts compatibility: treeMorph
  const tree2 = mapWalkToTree(CORE_WALK, 4, { maxDepth: 2 });
  const tm = treeMorph(tree, tree2, { vertsPerBranch: 12 });
  check('treeMorph succeeds between different walk trees', tm.from.length >= B && tm.to.length >= B);
  check('treeMorph results finite', tm.from.every(finite) && tm.to.every(finite));

  // Spread variation test
  const tZeroSpread = mapWalkToTree(CORE_WALK, 5, { spread: 0 });
  const tLargeSpread = mapWalkToTree(CORE_WALK, 5, { spread: 1.5 });
  check('spread=0 produces valid finite tree', tZeroSpread.branches.every(finite));
  check('spread=1.5 produces valid finite tree', tLargeSpread.branches.every(finite));

  // Edge cases
  check('empty walk returns empty tree', mapWalkToTree([], 5).branches.length === 0);
  check('single point walk returns 1 branch tree', mapWalkToTree([[0, 0, 0]], 5).branches.length === 1);
  check('branchCount=1 returns 1 branch tree', mapWalkToTree(CORE_WALK, 1).branches.length === 1);
  check('short walk (N=3, B=10) clamps branch count safely', mapWalkToTree([[0, 0, 0], [1, 0, 0], [1, 1, 0]], 10).branches.length === 2);
}

console.log('\n--- 2. walkToStreamlines s=0 exact match & s=1 laminar properties ---');
{
  const K = 4;
  const s0 = walkToStreamlines(CORE_WALK, K, 0);
  const s1 = walkToStreamlines(CORE_WALK, K, 1);

  check('s=0 produces correct streamline count', s0.length === K);
  check('s=1 produces correct streamline count', s1.length === K);

  // s=0 exact walk polyline reproduction
  const s0Exact = s0.every((sl) =>
    sl.length === CORE_WALK.length && sl.every((p, i) => d3(p, CORE_WALK[i]) === 0)
  );
  check('s=0 exactly reproduces original walk polyline at every vertex', s0Exact);

  // Endpoints match input endpoints at s=0 and s=1
  const start0 = CORE_WALK[0];
  const end0 = CORE_WALK[CORE_WALK.length - 1];

  const s0Endpoints = s0.every((sl) => d3(sl[0], start0) === 0 && d3(sl[sl.length - 1], end0) === 0);
  check('s=0 matches input endpoints exactly', s0Endpoints);

  const s1Endpoints = s1.every((sl) => d3(sl[0], start0) < 1e-12 && d3(sl[sl.length - 1], end0) < 1e-12);
  check('s=1 preserves input endpoints (C0 continuity)', s1Endpoints);

  // s=1 strictly reduced path length and total curvature
  const origLen = curveLength(CORE_WALK);
  const origCurv = totalCurv(CORE_WALK);

  const allReducedLen = s1.every((sl) => curveLength(sl) < origLen * 0.4);
  const allReducedCurv = s1.every((sl) => totalCurv(sl) < origCurv * 0.1);

  check(
    's=1 streamlines have strictly reduced path length (>60% reduction)',
    allReducedLen,
    `orig: ${origLen.toFixed(1)}, max streamline: ${Math.max(...s1.map((sl) => curveLength(sl))).toFixed(1)}`
  );
  check(
    's=1 streamlines have strictly reduced total curvature (>90% reduction)',
    allReducedCurv,
    `orig: ${origCurv.toFixed(1)}, max streamline: ${Math.max(...s1.map((sl) => totalCurv(sl))).toFixed(1)}`
  );

  // Multiple streamlines are non-identical (diverging bundle)
  let maxDivergence = 0;
  for (let k = 1; k < K; k++) {
    for (let i = 0; i < s1[k].length; i++) {
      maxDivergence = Math.max(maxDivergence, d3(s1[k][i], s1[0][i]));
    }
  }
  check('s=1 multi-streamlines diverge smoothly in mid-body', maxDivergence > 0.5, `max divergence: ${maxDivergence.toFixed(3)}`);

  // Single streamline test
  const single = walkToStreamlines(CORE_WALK, 1, 1);
  check('numStreamlines=1 produces 1 streamline', single.length === 1);
  check('single streamline has reduced curvature', totalCurv(single[0]) < origCurv * 0.1);
}

console.log('\n--- 3. Continuous progression across s in [0, 1] without NaN/Inf ---');
{
  const K = 3;
  const N_STEPS = 100;
  let allFinite = true;
  let endpointsContinuous = true;
  let maxStepDelta = 0;
  let prevSample: V3[][] | null = null;

  const start0 = CORE_WALK[0];
  const end0 = CORE_WALK[CORE_WALK.length - 1];

  for (let step = 0; step <= N_STEPS; step++) {
    const s = step / N_STEPS;
    const streamlines = walkToStreamlines(CORE_WALK, K, s);

    for (const sl of streamlines) {
      if (!finite(sl)) allFinite = false;
      if (d3(sl[0], start0) > 1e-12 || d3(sl[sl.length - 1], end0) > 1e-12) {
        endpointsContinuous = false;
      }
    }

    if (prevSample) {
      for (let k = 0; k < K; k++) {
        for (let i = 0; i < streamlines[k].length; i++) {
          maxStepDelta = Math.max(maxStepDelta, d3(streamlines[k][i], prevSample[k][i]));
        }
      }
    }
    prevSample = streamlines;
  }

  check('all vertex coordinates finite across s in [0, 1]', allFinite);
  check('C0 endpoint continuity holds for every s in [0, 1]', endpointsContinuous);
  check('continuous motion without vertex jumps (step delta bounded)', maxStepDelta < 0.5, `max step delta: ${maxStepDelta.toFixed(4)}`);
}

console.log('\n--- 4. Scrub determinism & purity ---');
{
  // Tree scrub determinism
  const treeA = mapWalkToTree(CORE_WALK, 6, { maxDepth: 3, spread: 0.8 });
  const treeB = mapWalkToTree(CORE_WALK, 6, { maxDepth: 3, spread: 0.8 });
  let treeExact = treeA.parent.every((p, i) => p === treeB.parent[i]);
  for (let i = 0; i < treeA.branches.length; i++) {
    for (let j = 0; j < treeA.branches[i].length; j++) {
      if (d3(treeA.branches[i][j], treeB.branches[i][j]) !== 0) treeExact = false;
    }
  }
  check('mapWalkToTree repeat calls are bit-exact deterministic', treeExact);

  // Streamlines scrub determinism (consecutive)
  const slA = walkToStreamlines(CORE_WALK, 4, 0.42);
  const slB = walkToStreamlines(CORE_WALK, 4, 0.42);
  let slExact = true;
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < slA[k].length; i++) {
      if (d3(slA[k][i], slB[k][i]) !== 0) slExact = false;
    }
  }
  check('walkToStreamlines repeat calls are bit-exact deterministic', slExact);

  // Out-of-order timeline scrub determinism
  const slProbe1 = walkToStreamlines(CORE_WALK, 3, 0.73);
  walkToStreamlines(CORE_WALK, 5, 0.12); // intermediate scrub
  walkToStreamlines(CORE_WALK, 2, 0.99); // another intermediate scrub
  const slProbe2 = walkToStreamlines(CORE_WALK, 3, 0.73);
  let scrubSafe = true;
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < slProbe1[k].length; i++) {
      if (d3(slProbe1[k][i], slProbe2[k][i]) !== 0) scrubSafe = false;
    }
  }
  check('out-of-order scrub returns bit-exact identical coordinates', scrubSafe);

  // Other walk seeds
  const altWalk = generateCoreWalk(42, 500);
  const altTree = mapWalkToTree(altWalk, 5);
  check('alt seed walk generates valid non-empty tree', altTree.branches.length === 5 && altTree.branches.every(finite));
  const altSL = walkToStreamlines(altWalk, 3, 0.5);
  check('alt seed walk generates valid streamlines', altSL.length === 3 && altSL.every(finite));
}

console.log(failed ? `\n${failed} FAILED` : '\nall treewalk tests passed');
process.exit(failed ? 1 : 0);
