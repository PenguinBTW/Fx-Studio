// Curve / tree morphing with vertex correspondence. Pure and deterministic:
// everything here is a function of its inputs only (no clocks, no RNG).
// Curves are plain V3[] polylines, directly usable with LineBatch.polyline
// (via toPoints) or a ribbon builder.

import { clamp, type V3 } from './util';

export type { V3 };
export type Curve = V3[];
export type EaseName =
  | 'linear'
  | 'smoothstep'
  | 'smootherstep'
  | 'inOutCubic'
  | 'inOutSine'
  | 'inCubic'
  | 'outCubic'
  | 'inOutQuint';
export type Ease = EaseName | ((s: number) => number);

export function ease(s: number, e: Ease = 'smoothstep'): number {
  const t = clamp(s);
  if (typeof e === 'function') return e(t);
  switch (e) {
    case 'linear': return t;
    case 'smoothstep': return t * t * (3 - 2 * t);
    case 'smootherstep': return t * t * t * (t * (t * 6 - 15) + 10);
    case 'inOutCubic': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'inOutSine': return -(Math.cos(Math.PI * t) - 1) / 2;
    case 'inCubic': return t * t * t;
    case 'outCubic': return 1 - Math.pow(1 - t, 3);
    case 'inOutQuint': return t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2;
  }
}

const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lerp3 = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export function curveLength(pts: Curve, closed = false): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  if (closed && pts.length > 1) L += dist(pts[pts.length - 1], pts[0]);
  return L;
}

/** Unsigned turning angle (radians) at every vertex. Open-curve endpoints get 0. */
export function turningAngles(pts: Curve, closed = false): number[] {
  const n = pts.length;
  const out = new Array<number>(n).fill(0);
  const seg = (i: number): V3 => {
    const a = pts[i % n];
    const b = pts[(i + 1) % n];
    return [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  };
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) continue;
    const d0 = seg((i - 1 + n) % n);
    const d1 = seg(i);
    const l0 = Math.hypot(d0[0], d0[1], d0[2]);
    const l1 = Math.hypot(d1[0], d1[1], d1[2]);
    if (l0 < 1e-12 || l1 < 1e-12) continue;
    const c = (d0[0] * d1[0] + d0[1] * d1[1] + d0[2] * d1[2]) / (l0 * l1);
    out[i] = Math.acos(clamp(c, -1, 1));
  }
  return out;
}

export interface ResampleOpts {
  closed?: boolean;
  /** 0 = uniform arc length. >0 concentrates vertices at high-curvature spots so corners of both curves line up. */
  curvWeight?: number;
}

/**
 * Resample to exactly n vertices. Open: endpoints kept (n >= 2). Closed: n
 * vertices around the loop, first vertex = pts[0], no duplicated end vertex.
 */
export function resample(pts: Curve, n: number, opts: ResampleOpts = {}): Curve {
  const closed = !!opts.closed;
  const m = pts.length;
  if (m === 0) return [];
  if (m === 1 || n < 1) return Array.from({ length: Math.max(n, 0) }, () => [...pts[0]] as V3);
  const cw = opts.curvWeight ?? 0;
  const ring: Curve = closed ? [...pts, pts[0]] : pts;
  const segs = ring.length - 1;
  const lens = new Array<number>(segs);
  let total = 0;
  for (let i = 0; i < segs; i++) {
    lens[i] = dist(ring[i], ring[i + 1]);
    total += lens[i];
  }
  const w = new Array<number>(segs);
  if (cw > 0 && total > 0) {
    const ang = turningAngles(pts, closed);
    const dens = ang.map((a, i) => {
      const l = (lens[Math.max(0, i - 1) % segs] + lens[i % segs]) * 0.5;
      return l > 1e-12 ? a / l : 0;
    });
    const mean = dens.reduce((x, y) => x + y, 0) / dens.length || 1;
    for (let i = 0; i < segs; i++) {
      const d = (dens[i] + dens[(i + 1) % m]) * 0.5;
      w[i] = lens[i] * (1 + cw * Math.min(d / mean, 8));
    }
  } else {
    for (let i = 0; i < segs; i++) w[i] = lens[i];
  }
  let W = 0;
  const cum = new Array<number>(segs + 1);
  cum[0] = 0;
  for (let i = 0; i < segs; i++) {
    W += w[i];
    cum[i + 1] = W;
  }
  if (W <= 1e-12) return Array.from({ length: n }, () => [...pts[0]] as V3);
  const out: Curve = new Array(n);
  let j = 0;
  for (let k = 0; k < n; k++) {
    if (!closed && k === n - 1) {
      out[k] = [...ring[ring.length - 1]] as V3;
      continue;
    }
    const target = closed ? (k / n) * W : n === 1 ? 0 : (k / (n - 1)) * W;
    while (j < segs - 1 && cum[j + 1] < target) j++;
    const span = cum[j + 1] - cum[j];
    const f = span > 1e-12 ? clamp((target - cum[j]) / span) : 0;
    out[k] = lerp3(ring[j], ring[j + 1], f);
  }
  return out;
}

/** Point at arc-length fraction f in [0,1] of an open polyline (no resampling). */
export function pointAt(pts: Curve, f: number): V3 {
  return sub(pts, f, f, 1)[0];
}

/** Extract the part of an open polyline between arc fractions f0..f1 as m uniformly spaced points. */
export function sub(pts: Curve, f0: number, f1: number, m: number): Curve {
  const n = pts.length;
  if (n === 0) return [];
  if (n === 1) return Array.from({ length: m }, () => [...pts[0]] as V3);
  const cum = new Array<number>(n);
  cum[0] = 0;
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + dist(pts[i - 1], pts[i]);
  const L = cum[n - 1];
  const out: Curve = new Array(m);
  let j = 0;
  for (let k = 0; k < m; k++) {
    const u = m === 1 ? f0 : f0 + ((f1 - f0) * k) / (m - 1);
    const target = clamp(u) * L;
    while (j < n - 2 && cum[j + 1] < target) j++;
    const span = cum[j + 1] - cum[j];
    const f = span > 1e-12 ? clamp((target - cum[j]) / span) : 0;
    out[k] = lerp3(pts[j], pts[j + 1], f);
  }
  return out;
}

export interface MatchOpts extends ResampleOpts {
  /** Weight of the curvature mismatch term relative to squared position distance. Default 0.25. */
  curvatureCost?: number;
  /** Allow flipping direction of b (open and closed). Default true. */
  allowReverse?: boolean;
  /** Allow start-index rotation for closed curves. Default true. */
  allowRotate?: boolean;
  /** Compare shapes after removing translation (centroid). Output keeps true positions. Default false. */
  centered?: boolean;
}

export interface Alignment {
  a: Curve;
  b: Curve;
  closed: boolean;
  reversed: boolean;
  shift: number;
  cost: number;
}

function centroid(p: Curve): V3 {
  const c: V3 = [0, 0, 0];
  for (const v of p) {
    c[0] += v[0];
    c[1] += v[1];
    c[2] += v[2];
  }
  const k = p.length || 1;
  return [c[0] / k, c[1] / k, c[2] / k];
}

function applyOrder(b: Curve, reversed: boolean, shift: number, closed: boolean): Curve {
  const n = b.length;
  const out: Curve = new Array(n);
  if (closed) {
    for (let i = 0; i < n; i++) {
      const k = reversed ? (((shift - i) % n) + n) % n : (shift + i) % n;
      out[i] = b[k];
    }
  } else {
    for (let i = 0; i < n; i++) out[i] = reversed ? b[n - 1 - i] : b[i];
  }
  return out;
}

/**
 * Align curve b to curve a: both resampled to n vertices (default max of the
 * two counts), then the orientation (and for closed curves the start-index
 * rotation) minimising position + curvature mismatch is chosen. Exhaustive for
 * n <= 256 candidates per orientation, coarse-to-fine above that.
 */
export function alignCurves(a: Curve, b: Curve, n = Math.max(a.length, b.length), opts: MatchOpts = {}): Alignment {
  const closed = !!opts.closed;
  const ra = resample(a, n, opts);
  const rb = resample(b, n, opts);
  const ca = centroid(ra);
  const cb = opts.centered ? centroid(rb) : ca;
  const ka = turningAngles(ra, closed);
  const kb = turningAngles(rb, closed);
  let rms = 0;
  for (const p of ra) rms += (p[0] - ca[0]) ** 2 + (p[1] - ca[1]) ** 2 + (p[2] - ca[2]) ** 2;
  const L2 = Math.max(rms / (ra.length || 1), 1e-12);
  const wc = (opts.curvatureCost ?? 0.25) * L2;
  const off = opts.centered ? [cb[0] - ca[0], cb[1] - ca[1], cb[2] - ca[2]] : [0, 0, 0];

  const costOf = (rev: boolean, shift: number, stride: number): number => {
    let c = 0;
    let cnt = 0;
    for (let i = 0; i < n; i += stride) {
      let k: number;
      if (closed) k = rev ? (((shift - i) % n) + n) % n : (shift + i) % n;
      else k = rev ? n - 1 - i : i;
      const p = ra[i];
      const q = rb[k];
      const dx = p[0] - (q[0] - off[0]);
      const dy = p[1] - (q[1] - off[1]);
      const dz = p[2] - (q[2] - off[2]);
      const dk = ka[i] - kb[k];
      c += dx * dx + dy * dy + dz * dz + wc * dk * dk;
      cnt++;
    }
    return c / Math.max(cnt, 1);
  };

  const revs = opts.allowReverse === false ? [false] : [false, true];
  let best = { rev: false, shift: 0, cost: Infinity };
  const rotate = closed && opts.allowRotate !== false;
  const stride = Math.max(1, Math.ceil(n / 256));
  for (const rev of revs) {
    if (!rotate) {
      const c = costOf(rev, 0, 1);
      if (c < best.cost - 1e-15) best = { rev, shift: 0, cost: c };
      continue;
    }
    let loc = { shift: 0, cost: Infinity };
    for (let s = 0; s < n; s += stride) {
      const c = costOf(rev, s, stride);
      if (c < loc.cost - 1e-15) loc = { shift: s, cost: c };
    }
    if (stride > 1) {
      let rb2 = { shift: loc.shift, cost: Infinity };
      for (let d = -stride; d <= stride; d++) {
        const s = (((loc.shift + d) % n) + n) % n;
        const c = costOf(rev, s, 1);
        if (c < rb2.cost - 1e-15) rb2 = { shift: s, cost: c };
      }
      loc = rb2;
    }
    if (loc.cost < best.cost - 1e-15) best = { rev, shift: loc.shift, cost: loc.cost };
  }
  return {
    a: ra,
    b: applyOrder(rb, best.rev, best.shift, closed),
    closed,
    reversed: best.rev,
    shift: best.shift,
    cost: best.cost,
  };
}

/** Blend two aligned curves (same vertex count). `s` is raw; the easing is applied here. */
export function morph(a: Curve, b: Curve, s: number, e: Ease = 'smoothstep'): Curve {
  if (a.length !== b.length) throw new Error(`curvemorph.morph: vertex counts differ (${a.length} vs ${b.length}); use alignCurves first`);
  const t = ease(s, e);
  const out: Curve = new Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = lerp3(a[i], b[i], t);
  return out;
}

/** Same as morph but writes packed xyz into a Float32Array/number[] (length >= 3*n); allocation-free per frame. */
export function morphInto(out: ArrayLike<number> & { [i: number]: number }, a: Curve, b: Curve, s: number, e: Ease = 'smoothstep'): void {
  const t = ease(s, e);
  for (let i = 0; i < a.length; i++) {
    out[i * 3] = a[i][0] + (b[i][0] - a[i][0]) * t;
    out[i * 3 + 1] = a[i][1] + (b[i][1] - a[i][1]) * t;
    out[i * 3 + 2] = a[i][2] + (b[i][2] - a[i][2]) * t;
  }
}

/** LineBatch.polyline expects {x,y,z}; this converts without changing vertex count. */
export function toPoints(pts: Curve): { x: number; y: number; z: number }[] {
  return pts.map((p) => ({ x: p[0], y: p[1], z: p[2] }));
}

/** Align every curve in a sequence to its predecessor so all share one vertex count and orientation. */
export function alignSequence(curves: Curve[], n = Math.max(...curves.map((c) => c.length)), opts: MatchOpts = {}): Curve[] {
  if (curves.length === 0) return [];
  const out: Curve[] = [resample(curves[0], n, opts)];
  for (let i = 1; i < curves.length; i++) out.push(alignCurves(out[i - 1], curves[i], n, opts).b);
  return out;
}

export interface TweenOpts {
  ease?: Ease;
  /** 'linear' blends piecewise; 'catmull' gives a C1 path through the keys (may overshoot). Default 'linear'. */
  interp?: 'linear' | 'catmull';
}

/** Tween across k >= 1 aligned curves with s in [0,1] spanning all intervals; `ease` applies per interval. */
export function tween(curves: Curve[], s: number, opts: TweenOpts = {}): Curve {
  const k = curves.length;
  if (k === 0) return [];
  if (k === 1) return curves[0].map((p) => [...p] as V3);
  const x = clamp(s) * (k - 1);
  const i = Math.min(Math.floor(x), k - 2);
  const u = ease(x - i, opts.ease ?? 'linear');
  if (opts.interp !== 'catmull') return morph(curves[i], curves[i + 1], u, 'linear');
  const p0 = curves[Math.max(i - 1, 0)];
  const p1 = curves[i];
  const p2 = curves[i + 1];
  const p3 = curves[Math.min(i + 2, k - 1)];
  const u2 = u * u;
  const u3 = u2 * u;
  return p1.map((_, v) => {
    const r: V3 = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      r[c] = 0.5 * (2 * p1[v][c] + (-p0[v][c] + p2[v][c]) * u + (2 * p0[v][c] - 5 * p1[v][c] + 4 * p2[v][c] - p3[v][c]) * u2 + (-p0[v][c] + 3 * p1[v][c] - 3 * p2[v][c] + p3[v][c]) * u3);
    }
    return r;
  });
}

// ---- smoothing ----

export interface StreamlineOpts {
  /** Gaussian sigma in world units of arc length. Default: 4 * mean segment length. */
  sigma?: number;
  closed?: boolean;
  /** Repeat the filter this many times (effective sigma grows by sqrt). Default 1. */
  passes?: number;
}

/**
 * Low-pass a rough polyline (e.g. a random walk) in arc length. Same vertex
 * count, vertex i stays tied to vertex i, endpoints of an open path are kept
 * exactly (odd reflection about the end points). Per-segment length never
 * exceeds the original's longest segment, so a morph path -> streamline never
 * stretches.
 */
export function pathToStreamline(path: Curve, opts: StreamlineOpts = {}): Curve {
  const n = path.length;
  if (n < 3) return path.map((p) => [...p] as V3);
  const closed = !!opts.closed;
  const total = curveLength(path, closed);
  const sigma = opts.sigma ?? (4 * total) / (closed ? n : n - 1);
  let cur: Curve = path.map((p) => [...p] as V3);
  const passes = Math.max(1, opts.passes ?? 1);
  for (let p = 0; p < passes; p++) cur = gaussianPass(cur, sigma, closed);
  if (!closed) {
    cur[0] = [...path[0]] as V3;
    cur[n - 1] = [...path[n - 1]] as V3;
  }
  return cur;
}

function gaussianPass(pts: Curve, sigma: number, closed: boolean): Curve {
  const n = pts.length;
  const s = new Array<number>(n);
  s[0] = 0;
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + dist(pts[i - 1], pts[i]);
  const L = closed ? s[n - 1] + dist(pts[n - 1], pts[0]) : s[n - 1];
  if (L <= 1e-12 || sigma <= 1e-12) return pts.map((p) => [...p] as V3);
  const reach = 3 * sigma;
  const ds = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const nxt = i === n - 1 ? (closed ? L : s[i]) : s[i + 1];
    const prv = i === 0 ? (closed ? s[0] - (L - s[n - 1]) : s[0]) : s[i - 1];
    ds[i] = (nxt - prv) * 0.5 || 1e-9;
  }
  const out: Curve = new Array(n);
  for (let i = 0; i < n; i++) {
    let sw = 0;
    const acc: V3 = [0, 0, 0];
    const add = (p: V3, d: number, wgt: number) => {
      const g = Math.exp(-0.5 * (d / sigma) ** 2) * wgt;
      sw += g;
      acc[0] += p[0] * g;
      acc[1] += p[1] * g;
      acc[2] += p[2] * g;
    };
    if (closed) {
      for (const sh of [-L, 0, L]) {
        for (let j = 0; j < n; j++) {
          const d = s[j] + sh - s[i];
          if (Math.abs(d) <= reach) add(pts[j], d, ds[j]);
        }
      }
    } else {
      for (let j = 0; j < n; j++) {
        const d = s[j] - s[i];
        if (d < -reach) continue;
        if (d > reach) break;
        add(pts[j], d, ds[j]);
      }
      // odd reflection about both ends: P' = 2*End - P(mirror)
      if (s[i] < reach) {
        for (let j = 1; j < n && s[j] <= reach; j++) {
          const d = -s[j] - s[i];
          if (d >= -reach) add([2 * pts[0][0] - pts[j][0], 2 * pts[0][1] - pts[j][1], 2 * pts[0][2] - pts[j][2]], d, ds[j]);
        }
      }
      if (L - s[i] < reach) {
        for (let j = n - 2; j >= 0 && L - s[j] <= reach; j--) {
          const d = 2 * L - s[j] - s[i];
          if (d <= reach) {
            const e = pts[n - 1];
            add([2 * e[0] - pts[j][0], 2 * e[1] - pts[j][1], 2 * e[2] - pts[j][2]], d, ds[j]);
          }
        }
      }
    }
    out[i] = sw > 0 ? [acc[0] / sw, acc[1] / sw, acc[2] / sw] : ([...pts[i]] as V3);
  }
  return out;
}

// ---- ribbon frames (minimum twist) ----

export interface Frames {
  tangents: V3[];
  normals: V3[];
}

function nrm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l < 1e-14 ? [0, 0, 0] : [v[0] / l, v[1] / l, v[2] / l];
}
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function rotateAround(v: V3, axis: V3, ang: number): V3 {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const k = cross3(axis, v);
  const d = dot3(axis, v) * (1 - c);
  return [v[0] * c + k[0] * s + axis[0] * d, v[1] * c + k[1] * s + axis[1] * d, v[2] * c + k[2] * s + axis[2] * d];
}

/**
 * Rotation-minimising (parallel transport, double reflection) frames. For a
 * closed curve the residual holonomy twist is spread linearly so the frame
 * closes seamlessly. Degenerate (zero length) tangents inherit the previous one.
 */
export function rotationMinimizingFrames(pts: Curve, opts: { closed?: boolean; initialNormal?: V3 } = {}): Frames {
  const n = pts.length;
  const closed = !!opts.closed;
  const tan: V3[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = closed ? pts[(i - 1 + n) % n] : pts[Math.max(i - 1, 0)];
    const b = closed ? pts[(i + 1) % n] : pts[Math.min(i + 1, n - 1)];
    tan[i] = nrm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    if (i > 0 && dot3(tan[i], tan[i]) === 0) tan[i] = tan[i - 1];
  }
  if (n === 0) return { tangents: [], normals: [] };
  if (dot3(tan[0], tan[0]) === 0) for (let i = 0; i < n; i++) if (dot3(tan[i], tan[i]) > 0) { tan[0] = tan[i]; break; }
  for (let i = 1; i < n; i++) if (dot3(tan[i], tan[i]) === 0) tan[i] = tan[i - 1];
  let n0: V3 = opts.initialNormal ? nrm(opts.initialNormal) : [0, 1, 0];
  n0 = nrm([n0[0] - tan[0][0] * dot3(n0, tan[0]), n0[1] - tan[0][1] * dot3(n0, tan[0]), n0[2] - tan[0][2] * dot3(n0, tan[0])]);
  if (dot3(n0, n0) === 0) {
    const alt: V3 = Math.abs(tan[0][0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
    n0 = nrm(cross3(tan[0], alt));
  }
  const normals: V3[] = [n0];
  for (let i = 0; i < n - 1; i++) {
    const x0 = pts[i];
    const x1 = pts[i + 1];
    const v1: V3 = [x1[0] - x0[0], x1[1] - x0[1], x1[2] - x0[2]];
    const c1 = dot3(v1, v1);
    let r = normals[i];
    let t = tan[i];
    if (c1 > 1e-18) {
      const rL: V3 = [r[0] - v1[0] * (2 / c1) * dot3(v1, r), r[1] - v1[1] * (2 / c1) * dot3(v1, r), r[2] - v1[2] * (2 / c1) * dot3(v1, r)];
      const tL: V3 = [t[0] - v1[0] * (2 / c1) * dot3(v1, t), t[1] - v1[1] * (2 / c1) * dot3(v1, t), t[2] - v1[2] * (2 / c1) * dot3(v1, t)];
      const v2: V3 = [tan[i + 1][0] - tL[0], tan[i + 1][1] - tL[1], tan[i + 1][2] - tL[2]];
      const c2 = dot3(v2, v2);
      r = c2 > 1e-18 ? [rL[0] - v2[0] * (2 / c2) * dot3(v2, rL), rL[1] - v2[1] * (2 / c2) * dot3(v2, rL), rL[2] - v2[2] * (2 / c2) * dot3(v2, rL)] : rL;
    }
    normals.push(nrm(r));
  }
  if (closed && n > 2) {
    const last = normals[n - 1];
    const x0 = pts[n - 1];
    const x1 = pts[0];
    const v1: V3 = [x1[0] - x0[0], x1[1] - x0[1], x1[2] - x0[2]];
    const c1 = dot3(v1, v1) || 1;
    const rL: V3 = [last[0] - v1[0] * (2 / c1) * dot3(v1, last), last[1] - v1[1] * (2 / c1) * dot3(v1, last), last[2] - v1[2] * (2 / c1) * dot3(v1, last)];
    const tL: V3 = [tan[n - 1][0] - v1[0] * (2 / c1) * dot3(v1, tan[n - 1]), tan[n - 1][1] - v1[1] * (2 / c1) * dot3(v1, tan[n - 1]), tan[n - 1][2] - v1[2] * (2 / c1) * dot3(v1, tan[n - 1])];
    const v2: V3 = [tan[0][0] - tL[0], tan[0][1] - tL[1], tan[0][2] - tL[2]];
    const c2 = dot3(v2, v2);
    const rEnd: V3 = c2 > 1e-18 ? [rL[0] - v2[0] * (2 / c2) * dot3(v2, rL), rL[1] - v2[1] * (2 / c2) * dot3(v2, rL), rL[2] - v2[2] * (2 / c2) * dot3(v2, rL)] : rL;
    const ang = Math.atan2(dot3(cross3(rEnd, normals[0]), tan[0]), dot3(rEnd, normals[0]));
    for (let i = 1; i < n; i++) normals[i] = nrm(rotateAround(normals[i], tan[i], (ang * i) / n));
  }
  return { tangents: tan, normals };
}

/**
 * Frames for a morph at s: transported along the blended curve (no flips),
 * starting from the blend of the two endpoint frames' initial normals.
 */
export function morphFrames(a: Curve, b: Curve, s: number, e: Ease = 'smoothstep', closed = false): { points: Curve } & Frames {
  const points = morph(a, b, s, e);
  const fa = rotationMinimizingFrames(a, { closed });
  const fb = rotationMinimizingFrames(b, { closed, initialNormal: fa.normals[0] });
  const t = ease(s, e);
  const init = fa.normals.length ? lerp3(fa.normals[0], fb.normals[0], t) : undefined;
  return { points, ...rotationMinimizingFrames(points, { closed, initialNormal: init }) };
}

// ---- trees ----

export interface Tree {
  /** Each branch is a polyline from its attachment point (on its parent) to its tip. */
  branches: Curve[];
  /** parent[i] = index of parent branch or -1 for roots. */
  parent: number[];
}

export interface BranchMorph {
  /** Per-branch vertex lists at s=0 (source) and s=1 (target), same shape, ready for LineBatch/ribbons. */
  from: Curve[];
  to: Curve[];
  /** Branch indices in traversal order (for treeToCurve; identity for treeMorph). */
  order: number[];
}

export interface TreeOpts {
  vertsPerBranch?: number;
  childOrder?: 'index' | 'longestFirst';
  curvWeight?: number;
}

function branchLengths(t: Tree): number[] {
  return t.branches.map((b) => curveLength(b));
}

/** Depth-first branch order from the roots. Parents always precede their children. */
export function treeOrder(t: Tree, childOrder: 'index' | 'longestFirst' = 'index'): number[] {
  const n = t.branches.length;
  const kids: number[][] = Array.from({ length: n }, () => []);
  const roots: number[] = [];
  t.parent.forEach((p, i) => (p < 0 || p >= n ? roots : kids[p]).push(i));
  const len = branchLengths(t);
  const sub = new Array<number>(n).fill(0);
  const total = (i: number): number => (sub[i] = len[i] + kids[i].reduce((a, c) => a + total(c), 0));
  roots.forEach(total);
  const cmp = childOrder === 'longestFirst' ? (a: number, b: number) => sub[b] - sub[a] || a - b : (a: number, b: number) => a - b;
  const order: number[] = [];
  const visit = (i: number) => {
    order.push(i);
    kids[i].sort(cmp).forEach(visit);
  };
  roots.sort(cmp).forEach(visit);
  return order;
}

/** Resample every branch of a tree to the same vertex count (endpoints kept). */
export function resampleTree(t: Tree, vertsPerBranch = 24, curvWeight = 0): Tree {
  return { parent: [...t.parent], branches: t.branches.map((b) => resample(b, vertsPerBranch, { curvWeight })) };
}

/**
 * Assign the branches of tree A to consecutive stretches of one curve B by
 * arc-length share (depth-first order, so a parent is followed by its
 * subtree). Branch i gets the stretch [c_i, c_i + share_i]; stretches chain end
 * to start, so at s=1 the branches join into the one continuous curve B.
 */
export function treeToCurve(tree: Tree, curve: Curve, opts: TreeOpts = {}): BranchMorph {
  const m = opts.vertsPerBranch ?? 24;
  const order = treeOrder(tree, opts.childOrder);
  const len = branchLengths(tree);
  const sum = order.reduce((a, i) => a + len[i], 0) || 1;
  const from: Curve[] = new Array(tree.branches.length);
  const to: Curve[] = new Array(tree.branches.length);
  let c = 0;
  for (const i of order) {
    const f1 = Math.min(c + len[i] / sum, 1);
    from[i] = resample(tree.branches[i], m, { curvWeight: opts.curvWeight });
    to[i] = sub(curve, c, f1, m);
    c = f1;
  }
  return { from, to, order };
}

/** Arc-length fraction of the closest point on polyline p to point q. */
function closestFraction(p: Curve, q: V3): number {
  const cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + dist(p[i - 1], p[i]));
  const L = cum[cum.length - 1] || 1;
  let bestD = Infinity;
  let bestF = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const ab: V3 = [p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1], p[i + 1][2] - p[i][2]];
    const aq: V3 = [q[0] - p[i][0], q[1] - p[i][1], q[2] - p[i][2]];
    const l2 = dot3(ab, ab);
    const f = l2 > 1e-18 ? clamp(dot3(ab, aq) / l2) : 0;
    const d = dist(lerp3(p[i], p[i + 1], f), q);
    if (d < bestD) {
      bestD = d;
      bestF = (cum[i] + f * (cum[i + 1] - cum[i])) / L;
    }
  }
  return bestF;
}

/**
 * Tree-to-tree correspondence. Branches are paired greedily by descending
 * length of A against the unused branch of B with the lowest cost (length
 * difference + root-attachment distance + chord direction). Unpaired branches of
 * A collapse onto the point of their parent's target where they attach (they
 * retract); unpaired branches of B grow from the matching point of their
 * parent's source. Output arrays are indexed [A branches..., extra B branches...].
 */
export function treeMorph(A: Tree, B: Tree, opts: TreeOpts = {}): BranchMorph & { pairs: number[] } {
  const m = opts.vertsPerBranch ?? 24;
  const ra = A.branches.map((b) => resample(b, m, { curvWeight: opts.curvWeight }));
  const rb = B.branches.map((b) => resample(b, m, { curvWeight: opts.curvWeight }));
  const la = branchLengths(A);
  const lb = branchLengths(B);
  const pairs = new Array<number>(ra.length).fill(-1);
  const used = new Array<boolean>(rb.length).fill(false);
  const scale = Math.max(...la, ...lb, 1e-9);
  const idx = la.map((_, i) => i).sort((x, y) => la[y] - la[x] || x - y);
  const chord = (p: Curve): V3 => nrm([p[p.length - 1][0] - p[0][0], p[p.length - 1][1] - p[0][1], p[p.length - 1][2] - p[0][2]]);
  for (const i of idx) {
    let best = -1;
    let bc = Infinity;
    for (let j = 0; j < rb.length; j++) {
      if (used[j]) continue;
      const c = Math.abs(la[i] - lb[j]) / scale + dist(ra[i][0], rb[j][0]) / scale + (1 - dot3(chord(ra[i]), chord(rb[j]))) * 0.5;
      if (c < bc) {
        bc = c;
        best = j;
      }
    }
    if (best >= 0) {
      pairs[i] = best;
      used[best] = true;
    }
  }
  const from: Curve[] = [];
  const to: Curve[] = [];
  const pointOnTarget = (parentTo: Curve | undefined, parentFrom: Curve | undefined, q: V3, fallback: V3): V3 =>
    parentTo && parentFrom ? pointAt(parentTo, closestFraction(parentFrom, q)) : fallback;
  const tgt = new Array<Curve | undefined>(ra.length);
  for (const i of treeOrder(A)) {
    from[i] = ra[i];
    if (pairs[i] >= 0) tgt[i] = rb[pairs[i]];
    else {
      const p = A.parent[i];
      const q = ra[i][0];
      const pt = p >= 0 ? pointOnTarget(tgt[p], ra[p], q, q) : q;
      tgt[i] = ra[i].map(() => [...pt] as V3);
    }
    to[i] = tgt[i]!;
  }
  const bToA = new Array<number>(rb.length).fill(-1);
  pairs.forEach((j, i) => j >= 0 && (bToA[j] = i));
  const extra: number[] = [];
  for (const j of treeOrder(B)) {
    if (bToA[j] >= 0) continue;
    const p = B.parent[j];
    const q = rb[j][0];
    const pa = p >= 0 ? bToA[p] : -1;
    const pt = pa >= 0 ? pointAt(ra[pa], closestFraction(rb[p], q)) : q;
    from.push(rb[j].map(() => [...pt] as V3));
    to.push(rb[j]);
    extra.push(j);
  }
  return { from: from.slice(), to: to.slice(), order: from.map((_, i) => i), pairs };
}

/** Blend per-branch lists at s. */
export function morphBranches(bm: BranchMorph, s: number, e: Ease = 'smoothstep'): Curve[] {
  return bm.from.map((f, i) => morph(f, bm.to[i], s, e));
}
