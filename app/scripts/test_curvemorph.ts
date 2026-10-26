import { alignCurves, morph, pathToStreamline, resample, tween, treeToCurve, treeMorph, morphBranches, morphFrames, curveLength, type Curve, type Tree } from '../src/engine/curvemorph';
import { mulberry32, type V3 } from '../src/engine/util';

let failed = 0;
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
  if (!ok) failed++;
};
const d3 = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const maxSeg = (c: Curve) => {
  let m = 0;
  for (let i = 1; i < c.length; i++) m = Math.max(m, d3(c[i - 1], c[i]));
  return m;
};
const finite = (c: Curve) => c.every((p) => p.every(Number.isFinite));

function walk(n: number, seed: number): Curve {
  const r = mulberry32(seed);
  const p: Curve = [[0, 0, 0]];
  for (let i = 0; i < n; i++) {
    let x = r() * 2 - 1, y = r() * 2 - 1, z = r() * 2 - 1;
    const l = Math.hypot(x, y, z) || 1;
    const q = p[p.length - 1];
    p.push([q[0] + x / l, q[1] + y / l, q[2] + z / l]);
  }
  return p;
}

// 1. walk -> streamline
{
  const w = walk(2400, 7);
  const sl = pathToStreamline(w);
  check('streamline same vertex count', sl.length === w.length);
  check('streamline endpoints kept', d3(sl[0], w[0]) === 0 && d3(sl[sl.length - 1], w[w.length - 1]) === 0);
  check('streamline finite', finite(sl));
  check('streamline smoother (shorter)', curveLength(sl) < curveLength(w) * 0.6, `${curveLength(sl).toFixed(1)} vs ${curveLength(w).toFixed(1)}`);
  check('streamline segs <= walk max seg', maxSeg(sl) <= maxSeg(w) + 1e-9);
  const al = alignCurves(w, sl, w.length, { allowReverse: true });
  check('open alignment not reversed', !al.reversed);
  const N = 200;
  let prev: Curve | null = null;
  let worstStep = 0, worstRatio = 0, reversals = 0, nan = 0;
  const bound = Math.max(maxSeg(al.a), maxSeg(al.b));
  let maxDisp = 0;
  for (let i = 0; i < al.a.length; i++) maxDisp = Math.max(maxDisp, d3(al.a[i], al.b[i]));
  for (let k = 0; k <= N; k++) {
    const s = k / N;
    const c = morph(al.a, al.b, s);
    if (!finite(c)) nan++;
    worstRatio = Math.max(worstRatio, maxSeg(c) / bound);
    if (k === 0 || k === N) {
      const ref = k === 0 ? al.a : al.b;
      check(`s=${s} reproduces endpoint curve`, c.every((p, i) => d3(p, ref[i]) < 1e-12));
    }
    check_endpoints: if (c[0] && (d3(c[0], w[0]) > 1e-12 || d3(c[c.length - 1], w[w.length - 1]) > 1e-12)) nan += 1000;
    if (prev) {
      for (let i = 0; i < c.length; i++) worstStep = Math.max(worstStep, d3(c[i], prev[i]));
      for (let i = 1; i < c.length; i++) {
        const a0: V3 = [prev[i][0] - prev[i - 1][0], prev[i][1] - prev[i - 1][1], prev[i][2] - prev[i - 1][2]];
        const a1: V3 = [c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1], c[i][2] - c[i - 1][2]];
        const l0 = Math.hypot(...a0), l1 = Math.hypot(...a1);
        if (l0 > 0.15 * bound && l1 > 0.15 * bound && a0[0] * a1[0] + a0[1] * a1[1] + a0[2] * a1[2] < 0) reversals++;
      }
    }
    prev = c;
  }
  check('no NaN, endpoints preserved at every s', nan === 0);
  check('no vertex flipping (per-step move bounded)', worstStep <= (1.5 * maxDisp) / N * 1.05 + 1e-9, `worst ${worstStep.toFixed(4)} bound ${((1.5 * maxDisp) / N * 1.05).toFixed(4)}`);
  check('no segment direction reversal between consecutive s', reversals === 0, `${reversals}`);
  check('continuity: max seg <= max endpoint seg * 1.05', worstRatio <= 1.05, `ratio ${worstRatio.toFixed(4)}`);
}

// 2. closed rotation + reversal
{
  const n = 64;
  const ring: Curve = Array.from({ length: n }, (_, i) => [Math.cos((i / n) * 2 * Math.PI), Math.sin((i / n) * 2 * Math.PI), 0]);
  const rot = 17;
  const rotated = ring.map((_, i) => ring[(i + rot) % n]);
  const al = alignCurves(ring, rotated, n, { closed: true });
  check('closed rotation recovered', al.cost < 1e-12 && !al.reversed, `shift ${al.shift} cost ${al.cost.toExponential(2)}`);
  const revd = [...ring].reverse();
  const al2 = alignCurves(ring, revd, n, { closed: true });
  check('closed reversal recovered', al2.cost < 1e-12 && al2.reversed, `cost ${al2.cost.toExponential(2)}`);
  const op = alignCurves(ring.slice(0, 30), ring.slice(0, 30).reverse(), 30);
  check('open reversal recovered', op.reversed && op.cost < 1e-12);
  let maxD = 0;
  for (let k = 0; k <= 20; k++) for (const p of morph(al.a, al.b, k / 20, 'linear')) maxD = Math.max(maxD, Math.abs(Math.hypot(p[0], p[1]) - 1));
  check('closed morph stays on ring', maxD < 1e-9);
  const wavy: Curve = ring.map((p, i) => [p[0], p[1], 0.3 * Math.cos((3 * i * 2 * Math.PI) / n)]);
  const wr = wavy.map((_, i) => wavy[(i + 23) % n]);
  const aw = alignCurves(wavy, wr, n, { closed: true });
  const off = Math.min((aw.shift + 23) % n, n - ((aw.shift + 23) % n));
  check('closed rotation recovered on non-uniform curve (+-1)', off <= 1 && !aw.reversed, `shift ${aw.shift} cost ${aw.cost.toExponential(2)}`);
}

// 3. resample + tween + frames
{
  const w = walk(300, 3);
  const r = resample(w, 100);
  check('resample count and endpoints', r.length === 100 && d3(r[0], w[0]) === 0 && d3(r[99], w[300]) === 0);
  const a = resample(w, 80), b = pathToStreamline(a), c = pathToStreamline(a, { sigma: 20 });
  const t = tween([a, b, c], 0.5, { ease: 'linear' });
  check('tween hits middle key', t.every((p, i) => d3(p, b[i]) < 1e-12));
  check('tween catmull finite', finite(tween([a, b, c], 0.7, { interp: 'catmull' })));
  const f = morphFrames(a, b, 0.5);
  check('frames orthonormal', f.normals.every((nv, i) => Math.abs(nv[0] * f.tangents[i][0] + nv[1] * f.tangents[i][1] + nv[2] * f.tangents[i][2]) < 1e-6 && Math.abs(Math.hypot(...nv) - 1) < 1e-6));
}

// 4. trees
{
  const tree: Tree = {
    branches: [
      [[0, 0, 0], [0, 1, 0], [0, 2, 0]],
      [[0, 2, 0], [-1, 3, 0], [-2, 4, 0]],
      [[0, 2, 0], [1, 3, 0], [2, 3.5, 0]],
    ],
    parent: [-1, 0, 0],
  };
  const target = walk(200, 5);
  const bm = treeToCurve(tree, target, { vertsPerBranch: 12 });
  const mid = morphBranches(bm, 1);
  let gap = 0;
  for (let k = 1; k < bm.order.length; k++) gap = Math.max(gap, d3(mid[bm.order[k - 1]][11], mid[bm.order[k]][0]));
  check('treeToCurve branches chain into one curve at s=1', gap < 1e-9 && mid.every((c) => c.length === 12));
  const tree2: Tree = { branches: [tree.branches[0], tree.branches[1]], parent: [-1, 0] };
  const tm = treeMorph(tree, tree2, { vertsPerBranch: 10 });
  check('treeMorph covers all branches, finite', tm.from.length === 3 && tm.to.length === 3 && tm.from.every(finite) && tm.to.every(finite) && tm.pairs.filter((x) => x >= 0).length === 2);
  const tm2 = treeMorph(tree2, tree, { vertsPerBranch: 10 });
  check('treeMorph grows extra branch', tm2.from.length === 3 && tm2.to.every(finite));
}

console.log(failed ? `\n${failed} FAILED` : '\nall curvemorph tests passed');
process.exit(failed ? 1 : 0);
