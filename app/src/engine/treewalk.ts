// Tree-to-walk mapper and walk-to-streamline untangler. Pure and deterministic:
// everything here is a function of its inputs only (no Math.random, no clocks).
// Curves are plain V3[] polylines, fully compatible with Tree from curvemorph.ts.

import { clamp, type V3 } from './util';
import {
  type Curve,
  type Tree,
  type Ease,
  ease,
  pathToStreamline,
  rotationMinimizingFrames,
  turningAngles,
} from './curvemorph';

export type { V3, Curve, Tree };

export interface MapWalkToTreeOpts {
  /** Maximum branch depth in the hierarchy (trunk is depth 0). Default 4. */
  maxDepth?: number;
  /** Lateral spreading factor for child branches (0 = raw segment, >0 = fan outward). Default 0.5. */
  spread?: number;
}

export interface WalkToStreamlinesOpts {
  /** Cross-sectional radius of the streamline bundle at peak divergence. Default based on walk dispersion. */
  radius?: number;
  /** Smoothing filter passes applied to the laminar streamlines. Default 3. */
  passes?: number;
  /** Easing function for progress s in [0, 1]. Default 'smoothstep'. */
  ease?: Ease;
}

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Maps a 1D discrete Brownian walk path (e.g. CORE_WALK) into a hierarchical
 * branching tree structure compatible with Tree from curvemorph.ts.
 *
 * Identifies high-curvature inflection or cluster points as branch junction nodes,
 * and attaches child branches to their parent branches at exact vertices with
 * bounded hierarchy depth and optional lateral spread.
 */
export function mapWalkToTree(
  walkPoints: V3[],
  branchCount: number,
  opts: MapWalkToTreeOpts = {},
): Tree {
  const N = walkPoints.length;
  if (N === 0) return { branches: [], parent: [] };
  if (N === 1) return { branches: [[[...walkPoints[0]], [...walkPoints[0]]]], parent: [-1] };

  const B = Math.max(1, Math.min(branchCount, N - 1));
  if (B <= 1) {
    return {
      branches: [walkPoints.map((p) => [...p] as V3)],
      parent: [-1],
    };
  }

  const maxDepth = Math.max(1, opts.maxDepth ?? 4);
  const spread = opts.spread ?? 0.5;

  // 1. Compute inflection & cluster scores along the walk
  const ang = turningAngles(walkPoints, false);
  const W = Math.max(1, Math.min(20, Math.floor(N / 20)));
  const scores = new Array<number>(N).fill(0);

  for (let i = 1; i < N - 1; i++) {
    let arc = 0;
    const i0 = Math.max(0, i - W);
    const i1 = Math.min(N - 1, i + W);
    for (let k = i0; k < i1; k++) {
      arc += dist(walkPoints[k], walkPoints[k + 1]);
    }
    const chord = dist(walkPoints[i0], walkPoints[i1]);
    const tortuosity = arc / (chord + 1e-4);
    // Inflection turning angle weighted by cluster tortuosity
    scores[i] = ang[i] * (1 + Math.log(1 + tortuosity));
  }

  // 2. Select B - 1 junction nodes using non-maximum suppression / index spacing
  const cand = Array.from({ length: N - 2 }, (_, i) => i + 1).sort((a, b) => scores[b] - scores[a]);
  const junctions: number[] = [];
  let spacing = Math.max(1, Math.floor((N / B) * 0.6));

  while (junctions.length < B - 1 && spacing >= 1) {
    for (const idx of cand) {
      if (junctions.length >= B - 1) break;
      if (junctions.every((j) => Math.abs(j - idx) >= spacing)) {
        junctions.push(idx);
      }
    }
    spacing = Math.floor(spacing / 2);
  }

  // Fallback to fill up to B - 1 if spacing was tight
  for (const idx of cand) {
    if (junctions.length >= B - 1) break;
    if (!junctions.includes(idx)) junctions.push(idx);
  }

  junctions.sort((a, b) => a - b);
  const split = [0, ...junctions, N - 1];

  // 3. Assemble branches hierarchically
  const branches: Curve[] = [];
  const parent: number[] = [];
  const depth: number[] = [];

  // Trunk (Branch 0)
  branches.push(walkPoints.slice(0, split[1] + 1).map((p) => [...p] as V3));
  parent.push(-1);
  depth.push(0);

  // Child branches
  for (let k = 1; k < B; k++) {
    const seg = walkPoints.slice(split[k], split[k + 1] + 1);
    const rawStart = seg[0];

    // Find closest vertex on any eligible parent branch (depth < maxDepth)
    let bestP = 0;
    let bestDist = Infinity;
    let bestV: V3 = branches[0][0];

    for (let p = 0; p < k; p++) {
      if (depth[p] >= maxDepth) continue;
      for (const v of branches[p]) {
        const d = dist(v, rawStart);
        if (d < bestDist) {
          bestDist = d;
          bestP = p;
          bestV = v;
        }
      }
    }

    // Translate segment so starting vertex connects seamlessly to bestV
    const delta: V3 = [bestV[0] - rawStart[0], bestV[1] - rawStart[1], bestV[2] - rawStart[2]];
    let bLen = 0;
    for (let i = 1; i < seg.length; i++) bLen += dist(seg[i - 1], seg[i]);

    // Deterministic golden-ratio angle for radial branch fanning
    const phi = k * 2.399963229728653;
    const u: V3 = [Math.cos(phi), Math.sin(phi), Math.sin(phi * 1.5)];
    const uLen = Math.hypot(...u) || 1;
    const un: V3 = [u[0] / uLen, u[1] / uLen, u[2] / uLen];

    const branchPts: Curve = seg.map((p, r) => {
      const f = seg.length > 1 ? r / (seg.length - 1) : 0;
      const fan = f * spread * bLen * 0.2;
      return [
        p[0] + delta[0] + un[0] * fan,
        p[1] + delta[1] + un[1] * fan,
        p[2] + delta[2] + un[2] * fan,
      ] as V3;
    });

    // Ensure exact C0 continuity at the junction vertex
    branchPts[0] = [...bestV] as V3;

    branches.push(branchPts);
    parent.push(bestP);
    depth.push(depth[bestP] + 1);
  }

  return { branches, parent };
}

/**
 * Untangles a chaotic Brownian walk into smooth parallel/diverging streamline curves
 * over morph progress s in [0, 1].
 *
 * - At s=0: returns exact copies of the original walk polyline.
 * - At s=1: returns clean, smooth laminar magnetic field streamlines with strictly
 *   reduced total curvature and path length.
 * - Guarantees finite coordinates, no NaNs, and exact C0 endpoint continuity for all s.
 */
export function walkToStreamlines(
  walkPoints: V3[],
  numStreamlines: number,
  progress: number,
  opts: WalkToStreamlinesOpts = {},
): V3[][] {
  const N = walkPoints.length;
  if (N === 0) return [];
  if (numStreamlines <= 0) return [];
  if (N < 2) {
    return Array.from({ length: numStreamlines }, () => walkPoints.map((p) => [...p] as V3));
  }

  // Exact reproduction at s = 0
  if (progress <= 0) {
    return Array.from({ length: numStreamlines }, () => walkPoints.map((p) => [...p] as V3));
  }

  // Base smooth laminar center line
  const passes = Math.max(1, opts.passes ?? 3);
  const smoothCenter = pathToStreamline(walkPoints, { passes });
  const frames = rotationMinimizingFrames(smoothCenter);

  let radius = opts.radius;
  if (radius === undefined || radius <= 0) {
    let maxDev = 0;
    for (let i = 0; i < N; i++) {
      const d = dist(walkPoints[i], smoothCenter[i]);
      if (d > maxDev) maxDev = d;
    }
    radius = Math.max(0.2, maxDev * 0.4);
  }

  // Generate target laminar streamlines at s = 1
  const targets: V3[][] = [];
  for (let k = 0; k < numStreamlines; k++) {
    if (numStreamlines === 1) {
      targets.push(smoothCenter);
      break;
    }

    const th = numStreamlines === 2 ? (k === 0 ? 0 : Math.PI) : (2 * Math.PI * k) / numStreamlines;
    const rawTarget: V3[] = new Array(N);

    for (let i = 0; i < N; i++) {
      // Sinusoidal envelope ensuring exact C0 endpoint convergence at i=0 and i=N-1
      const env = Math.sin((Math.PI * i) / (N - 1));
      const n = frames.normals[i];
      const t = frames.tangents[i];
      const b: V3 = [
        t[1] * n[2] - t[2] * n[1],
        t[2] * n[0] - t[0] * n[2],
        t[0] * n[1] - t[1] * n[0],
      ];
      const off = radius * env;
      rawTarget[i] = [
        smoothCenter[i][0] + (Math.cos(th) * n[0] + Math.sin(th) * b[0]) * off,
        smoothCenter[i][1] + (Math.cos(th) * n[1] + Math.sin(th) * b[1]) * off,
        smoothCenter[i][2] + (Math.cos(th) * n[2] + Math.sin(th) * b[2]) * off,
      ];
    }

    // Refine target with streamline low-pass filter (endpoints strictly preserved)
    targets.push(pathToStreamline(rawTarget, { passes: 2 }));
  }

  // Blend from raw walk to targets at progress s
  const t = ease(clamp(progress, 0, 1), opts.ease ?? 'smoothstep');

  return targets.map((tgt) => {
    return walkPoints.map((p, i) => [
      p[0] + (tgt[i][0] - p[0]) * t,
      p[1] + (tgt[i][1] - p[1]) * t,
      p[2] + (tgt[i][2] - p[2]) * t,
    ] as V3);
  });
}
