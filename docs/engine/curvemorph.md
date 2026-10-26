# Curve Morph (`engine/curvemorph.ts`)

Pure, deterministic polyline/tree morphing with vertex correspondence. Curves are `V3[]`; use `toPoints(c)` for `LineBatch.polyline`, or feed the vertex list straight to a ribbon builder. Test: `bun run test:curvemorph`.

## Core API
- `resample(pts, n, {closed, curvWeight})`: exactly `n` vertices by arc length (open: endpoints kept; closed: no duplicated end vertex). `curvWeight > 0` bunches vertices at corners.
- `alignCurves(a, b, n?, {closed, allowReverse, allowRotate, curvatureCost, centered})`: resamples both, then picks the orientation (and, for closed curves, the start-index rotation) minimising squared position distance plus a turning-angle mismatch term. Returns `{a, b, reversed, shift, cost}`; `a`/`b` are morph-ready.
- `morph(a, b, s, ease)` / `morphInto(out, a, b, s, ease)`: blend aligned curves. `s` is raw 0..1; easing is applied inside. Easings: `linear, smoothstep, smootherstep, inOutCubic, inOutSine, inCubic, outCubic, inOutQuint` or a function.
- `alignSequence(curves, n, opts)` + `tween(curves, s, {ease, interp: 'linear'|'catmull'})`: multi-curve tween (`s` spans all keys; ease is per interval).
- `pathToStreamline(path, {sigma, passes, closed})`: Gaussian low-pass in arc length with the same vertex count; open endpoints are exact (odd reflection). Default sigma = 4 mean segments.
- `rotationMinimizingFrames(pts, {closed})` / `morphFrames(a, b, s, ease)`: parallel-transport frames (minimum twist; closed curves spread the holonomy) for ribbons on a morphing curve.

## Trees
`Tree = {branches: V3[][], parent: number[]}` (branch = attachment point to tip).
- `treeToCurve(tree, curve, {vertsPerBranch})`: assigns branches (depth-first) to consecutive stretches of a curve by arc-length share; at s=1 the branches chain into the curve. Returns `{from, to, order}`.
- `treeMorph(A, B)`: greedy pairing of branches (length, root distance, direction). Unpaired A branches retract onto their parent's target; unpaired B branches grow from the parent's source. Output indexes `[A..., extra B...]`.
- `morphBranches(bm, s, ease)`: per-branch vertex lists for LineBatch/ribbons.

## Limits / known gaps
- Correspondence is by arc-length index (rotation/reversal search only); no dynamic-time-warp on curvature, so very different shapes can pass through each other mid-morph (linear vertex paths, not geodesic).
- Closed-rotation search is O(n^2) (strided coarse-to-fine above 256 vertices).
- Tree matching is greedy, not globally optimal. The bespoke dendrite-to-walk mapper is not part of this module.
- Per-step vertex motion is bounded by the vertex displacement times the ease derivative (max 1.5 for smoothstep).
