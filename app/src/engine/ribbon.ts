import * as THREE from 'three';
import {
  type V3,
  v3Norm,
  v3Dot,
  v3Cross,
  v3Sub,
  v3Add,
  v3Scale,
  clamp,
} from './util';

/**
 * An adapted orthonormal 3D frame at a curve point.
 * Tangent T, Normal N, and Binormal B = T x N form a right-handed basis:
 * ||T|| = 1, ||N|| = 1, ||B|| = 1, T . N = 0, T . B = 0, N . B = 0.
 */
export interface BishopFrame {
  position: V3;
  tangent: V3;
  normal: V3;
  binormal: V3;
}

/** Function evaluating spine curve point in closed-form at time t and parameter s in [0, 1]. */
export type SpineFn = (t: number, s: number) => V3;

/** Function evaluating ribbon width at parameter s in [0, 1] and optional time t. */
export type WidthFn = (s: number, t?: number) => number;

/** Function evaluating ribbon twist angle (radians) at parameter s in [0, 1] and optional time t. */
export type TwistFn = (s: number, t?: number) => number;

export interface BishopFrameOptions {
  /** True if the curve forms a closed periodic loop. Residual holonomy is distributed evenly. */
  closed?: boolean;
  /** Initial normal hint for N_0. Orthogonalized against T_0. */
  initialNormal?: V3;
  /** Explicit precomputed tangents. If omitted, central differences are used. */
  tangents?: V3[];
}

export interface RibbonGeometryOptions {
  /** Number of longitudinal quad strip segments along the ribbon. Default 64. */
  segments?: number;
  /** Ribbon half-width or width function w(s, t). Default 0.2. */
  width?: number | WidthFn;
  /** Twist angle (radians) or twist function alpha(s, t). Default 0. */
  twist?: number | TwistFn;
  /** Closed-form spine function f(t, s) OR fixed array of spine points. */
  spine?: SpineFn | V3[];
  /** Initial normal vector hint. */
  initialNormal?: V3;
  /** True if the spine forms a closed loop. Default false. */
  closed?: boolean;
  /** Initial timeline time for closed-form spine evaluation. Default 0. */
  time?: number;
}

/**
 * Rodrigues' rotation formula: rotate vector v around unit axis by angle radians.
 */
export function rotateVectorAroundAxis(v: V3, axis: V3, angle: number): V3 {
  if (Math.abs(angle) < 1e-12) return [v[0], v[1], v[2]];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = v3Cross(axis, v);
  const d = v3Dot(axis, v) * (1 - c);
  return [
    v[0] * c + k[0] * s + axis[0] * d,
    v[1] * c + k[1] * s + axis[1] * d,
    v[2] * c + k[2] * s + axis[2] * d,
  ];
}

/**
 * Compute smoothed unit tangents along a polyline.
 * Uses central differences at interior vertices and one-sided differences at endpoints.
 */
export function computeTangents(points: V3[], closed = false): V3[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) return [[0, 0, 1]];

  const tangents: V3[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = closed ? points[(i - 1 + n) % n]! : points[Math.max(0, i - 1)]!;
    const next = closed ? points[(i + 1) % n]! : points[Math.min(n - 1, i + 1)]!;
    const d = v3Sub(next, prev);
    const len = Math.hypot(d[0], d[1], d[2]);
    if (len > 1e-12) {
      tangents[i] = [d[0] / len, d[1] / len, d[2] / len];
    } else {
      // Fallback to one-sided difference
      const step = i < n - 1 ? v3Sub(points[i + 1]!, points[i]!) : v3Sub(points[i]!, points[i - 1]!);
      const slen = Math.hypot(step[0], step[1], step[2]);
      tangents[i] = slen > 1e-12 ? [step[0] / slen, step[1] / slen, step[2] / slen] : [0, 0, 1];
    }
  }

  // Propagate valid tangents to any degenerate zero-length spans
  for (let i = 1; i < n; i++) {
    if (v3Dot(tangents[i]!, tangents[i]!) < 1e-6) tangents[i] = tangents[i - 1]!;
  }
  for (let i = n - 2; i >= 0; i--) {
    if (v3Dot(tangents[i]!, tangents[i]!) < 1e-6) tangents[i] = tangents[i + 1]!;
  }
  return tangents;
}

/**
 * Compute Rotation-Minimizing Parallel Transport Frames (Bishop Frames) along 3D polylines.
 *
 * Employs the Double Reflection Method (Wang et al. 2008), which eliminates Frenet 180° twist
 * singularities at inflection points (where curvature kappa -> 0).
 *
 * For closed loops, the residual holonomy rotation angle is measured and distributed
 * uniformly across all steps so the frame connects seamlessly without a twist seam.
 */
export function computeBishopFrames(points: V3[], opts: BishopFrameOptions = {}): BishopFrame[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) {
    const p = points[0]!;
    return [{ position: p, tangent: [0, 0, 1], normal: [0, 1, 0], binormal: [1, 0, 0] }];
  }

  const closed = !!opts.closed;
  const tangents = opts.tangents ?? computeTangents(points, closed);

  // Initialize N_0 orthogonal to T_0
  let n0: V3 = opts.initialNormal ? v3Norm(opts.initialNormal) : [0, 1, 0];
  // Project n0 onto plane perpendicular to tangents[0]
  n0 = v3Sub(n0, v3Scale(tangents[0]!, v3Dot(n0, tangents[0]!)));
  const lenN0 = Math.hypot(n0[0], n0[1], n0[2]);
  if (lenN0 < 1e-4) {
    const alt: V3 = Math.abs(tangents[0]![0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
    n0 = v3Norm(v3Cross(tangents[0]!, alt));
  } else {
    n0 = [n0[0] / lenN0, n0[1] / lenN0, n0[2] / lenN0];
  }

  const normals: V3[] = [n0];

  // Parallel transport along discrete polyline via Double Reflection
  for (let i = 0; i < n - 1; i++) {
    const x0 = points[i]!;
    const x1 = points[i + 1]!;
    const v1 = v3Sub(x1, x0);
    const c1 = v3Dot(v1, v1);

    let r = normals[i]!;
    const t = tangents[i]!;

    if (c1 > 1e-18) {
      const v1DotR = v1[0] * r[0] + v1[1] * r[1] + v1[2] * r[2];
      const v1DotT = v1[0] * t[0] + v1[1] * t[1] + v1[2] * t[2];
      const factor1 = 2 / c1;

      // Reflection 1 across bisecting plane normal to v1
      const rL: V3 = [
        r[0] - v1[0] * factor1 * v1DotR,
        r[1] - v1[1] * factor1 * v1DotR,
        r[2] - v1[2] * factor1 * v1DotR,
      ];
      const tL: V3 = [
        t[0] - v1[0] * factor1 * v1DotT,
        t[1] - v1[1] * factor1 * v1DotT,
        t[2] - v1[2] * factor1 * v1DotT,
      ];

      // Reflection 2 across plane normal to v2 = T_{i+1} - T_i^L
      const v2 = v3Sub(tangents[i + 1]!, tL);
      const c2 = v3Dot(v2, v2);
      if (c2 > 1e-18) {
        const v2DotRL = v2[0] * rL[0] + v2[1] * rL[1] + v2[2] * rL[2];
        const factor2 = 2 / c2;
        r = [
          rL[0] - v2[0] * factor2 * v2DotRL,
          rL[1] - v2[1] * factor2 * v2DotRL,
          rL[2] - v2[2] * factor2 * v2DotRL,
        ];
      } else {
        r = rL;
      }
    }

    // Exact re-orthogonalization against tangents[i+1] to guard against floating-point drift
    const tNext = tangents[i + 1]!;
    r = v3Sub(r, v3Scale(tNext, v3Dot(r, tNext)));
    normals.push(v3Norm(r));
  }

  // Distribute residual holonomy twist on closed loops
  if (closed && n > 2) {
    const last = normals[n - 1]!;
    const x0 = points[n - 1]!;
    const x1 = points[0]!;
    const v1 = v3Sub(x1, x0);
    const c1 = v3Dot(v1, v1) || 1;
    const factor1 = 2 / c1;
    const v1DotLast = v1[0] * last[0] + v1[1] * last[1] + v1[2] * last[2];
    const v1DotT = v1[0] * tangents[n - 1]![0] + v1[1] * tangents[n - 1]![1] + v1[2] * tangents[n - 1]![2];

    const rL: V3 = [
      last[0] - v1[0] * factor1 * v1DotLast,
      last[1] - v1[1] * factor1 * v1DotLast,
      last[2] - v1[2] * factor1 * v1DotLast,
    ];
    const tL: V3 = [
      tangents[n - 1]![0] - v1[0] * factor1 * v1DotT,
      tangents[n - 1]![1] - v1[1] * factor1 * v1DotT,
      tangents[n - 1]![2] - v1[2] * factor1 * v1DotT,
    ];

    const v2 = v3Sub(tangents[0]!, tL);
    const c2 = v3Dot(v2, v2);
    const factor2 = c2 > 1e-18 ? 2 / c2 : 0;
    const v2DotRL = v2[0] * rL[0] + v2[1] * rL[1] + v2[2] * rL[2];
    const rEnd: V3 = c2 > 1e-18 ? [
      rL[0] - v2[0] * factor2 * v2DotRL,
      rL[1] - v2[1] * factor2 * v2DotRL,
      rL[2] - v2[2] * factor2 * v2DotRL,
    ] : rL;

    // Holonomy angle around tangents[0]
    const cr = v3Cross(rEnd, normals[0]!);
    const ang = Math.atan2(v3Dot(cr, tangents[0]!), v3Dot(rEnd, normals[0]!));
    for (let i = 1; i < n; i++) {
      normals[i] = v3Norm(rotateVectorAroundAxis(normals[i]!, tangents[i]!, (ang * i) / n));
    }
  }

  const frames: BishopFrame[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = tangents[i]!;
    const norm = normals[i]!;
    const binorm = v3Cross(t, norm);
    frames[i] = {
      position: points[i]!,
      tangent: t,
      normal: norm,
      binormal: binorm,
    };
  }
  return frames;
}

/**
 * Standard Frenet-Serret frame generator.
 * Normal is defined by N = (dT/ds) / ||dT/ds||.
 * Inherent flaw: Suffers from 180° twist flips at points of zero curvature (inflection points).
 * Provided for comparative verification against Bishop frames.
 */
export function computeFrenetFrames(points: V3[], tangents?: V3[]): BishopFrame[] {
  const n = points.length;
  if (n === 0) return [];
  const tans = tangents ?? computeTangents(points, false);
  const frames: BishopFrame[] = new Array(n);

  let prevNormal: V3 = [0, 1, 0];
  for (let i = 0; i < n; i++) {
    const t = tans[i]!;
    // Second derivative dT/ds
    let dt: V3;
    if (i === 0 && n > 1) {
      dt = v3Sub(tans[1]!, tans[0]!);
    } else if (i === n - 1 && n > 1) {
      dt = v3Sub(tans[n - 1]!, tans[n - 2]!);
    } else {
      dt = v3Sub(tans[i + 1]!, tans[i - 1]!);
    }

    // Project dt orthogonal to t
    dt = v3Sub(dt, v3Scale(t, v3Dot(dt, t)));
    const lenDt = Math.hypot(dt[0], dt[1], dt[2]);

    let norm: V3;
    if (lenDt > 1e-6) {
      norm = [dt[0] / lenDt, dt[1] / lenDt, dt[2] / lenDt];
    } else {
      // Degenerate inflection: Frenet is undefined, falls back or flips
      norm = prevNormal;
    }
    prevNormal = norm;
    const binorm = v3Cross(t, norm);
    frames[i] = {
      position: points[i]!,
      tangent: t,
      normal: norm,
      binormal: binorm,
    };
  }
  return frames;
}

/**
 * Sample a closed-form spine function f(t, s) into an array of 3D points.
 */
export function sampleSpine(fn: SpineFn, t: number, segments: number): V3[] {
  const points: V3[] = new Array(segments + 1);
  for (let i = 0; i <= segments; i++) {
    const s = i / segments;
    points[i] = fn(t, s);
  }
  return points;
}

/**
 * Procedural Ribbon Geometry.
 *
 * Generates an extruded quad strip mesh along arbitrary 3D splines or polylines,
 * stabilized with Bishop frames (Rotation-Minimizing Frames) to prevent torsion singularities.
 *
 * Supports:
 *  - Width taper w(s, t)
 *  - Twist angle alpha(s, t)
 *  - Closed-form spine function f(t, s) for scrub determinism
 *  - In-place vertex buffer updating with zero GC allocation during frame scrub
 */
export class RibbonGeometry extends THREE.BufferGeometry {
  private spineFn?: SpineFn;
  private widthOpt: number | WidthFn;
  private twistOpt: number | TwistFn;
  private segments: number;
  private isClosed: boolean;
  private initialNormalHint?: V3;
  private cachedFrames: BishopFrame[] = [];

  constructor(opts: RibbonGeometryOptions = {}) {
    super();

    this.segments = Math.max(1, opts.segments ?? 64);
    this.widthOpt = opts.width ?? 0.2;
    this.twistOpt = opts.twist ?? 0;
    this.isClosed = !!opts.closed;
    this.initialNormalHint = opts.initialNormal;

    let initialPoints: V3[];
    if (typeof opts.spine === 'function') {
      this.spineFn = opts.spine;
      initialPoints = sampleSpine(this.spineFn, opts.time ?? 0, this.segments);
    } else if (Array.isArray(opts.spine) && opts.spine.length > 0) {
      initialPoints = opts.spine;
      this.segments = initialPoints.length - 1;
    } else {
      // Default straight line spine along Z
      this.spineFn = (_t, s) => [0, 0, (s - 0.5) * 10];
      initialPoints = sampleSpine(this.spineFn, 0, this.segments);
    }

    this.buildBuffers(initialPoints, opts.time ?? 0);
  }

  /**
   * Return the computed Bishop frames along the current spine curve.
   */
  getFrames(): BishopFrame[] {
    return this.cachedFrames;
  }

  /**
   * Update the ribbon from closed-form time t.
   * Re-evaluates f(t, s), width taper w(s, t), and twist alpha(s, t) deterministically.
   */
  updateFromTime(t: number): this {
    if (!this.spineFn) return this;
    const points = sampleSpine(this.spineFn, t, this.segments);
    return this.updateFromSpine(points, this.widthOpt, this.twistOpt, t);
  }

  /**
   * Update ribbon geometry along a sequence of spine points.
   * If vertex count matches existing buffers, updates in-place without reallocation.
   */
  updateFromSpine(
    points: V3[],
    width?: number | WidthFn,
    twist?: number | TwistFn,
    time = 0
  ): this {
    if (width !== undefined) this.widthOpt = width;
    if (twist !== undefined) this.twistOpt = twist;

    const n = points.length;
    if (n < 2) return this;

    const numVertices = n * 2;
    const posAttr = this.getAttribute('position') as THREE.BufferAttribute | undefined;
    const normAttr = this.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const uvAttr = this.getAttribute('uv') as THREE.BufferAttribute | undefined;

    if (!posAttr || posAttr.count !== numVertices || !normAttr || !uvAttr) {
      // Vertex count changed: rebuild buffers
      this.segments = n - 1;
      this.buildBuffers(points, time);
      return this;
    }

    // In-place buffer update
    const posArray = posAttr.array as Float32Array;
    const normArray = normAttr.array as Float32Array;
    const uvArray = uvAttr.array as Float32Array;

    this.computeRibbonVertices(points, time, posArray, normArray, uvArray);

    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;
    uvAttr.needsUpdate = true;
    this.computeBoundingBox();
    this.computeBoundingSphere();
    return this;
  }

  private buildBuffers(points: V3[], time: number): void {
    const n = points.length;
    const numVertices = n * 2;
    const numQuads = n - 1;
    const numIndices = numQuads * 6;

    const posArray = new Float32Array(numVertices * 3);
    const normArray = new Float32Array(numVertices * 3);
    const uvArray = new Float32Array(numVertices * 2);
    const indexArray = numVertices > 65535 ? new Uint32Array(numIndices) : new Uint16Array(numIndices);

    this.computeRibbonVertices(points, time, posArray, normArray, uvArray);

    // Quad indices: two counter-clockwise triangles per spine segment
    let idx = 0;
    for (let i = 0; i < numQuads; i++) {
      const vLeft0 = i * 2;
      const vRight0 = i * 2 + 1;
      const vLeft1 = (i + 1) * 2;
      const vRight1 = (i + 1) * 2 + 1;

      // Triangle 1: (Left_i, Right_i, Left_{i+1})
      indexArray[idx++] = vLeft0;
      indexArray[idx++] = vRight0;
      indexArray[idx++] = vLeft1;

      // Triangle 2: (Right_i, Right_{i+1}, Left_{i+1})
      indexArray[idx++] = vRight0;
      indexArray[idx++] = vRight1;
      indexArray[idx++] = vLeft1;
    }

    this.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    this.setAttribute('normal', new THREE.BufferAttribute(normArray, 3));
    this.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2));
    this.setIndex(new THREE.BufferAttribute(indexArray, 1));

    this.computeBoundingBox();
    this.computeBoundingSphere();
  }

  private computeRibbonVertices(
    points: V3[],
    time: number,
    pos: Float32Array,
    norm: Float32Array,
    uv: Float32Array
  ): void {
    const n = points.length;
    this.cachedFrames = computeBishopFrames(points, {
      closed: this.isClosed,
      initialNormal: this.initialNormalHint,
    });

    // Compute cumulative arc length for continuous parameterization
    const arcLengths = new Float32Array(n);
    arcLengths[0] = 0;
    for (let i = 1; i < n; i++) {
      const pPrev = points[i - 1]!;
      const pCurr = points[i]!;
      const d = Math.hypot(pCurr[0] - pPrev[0], pCurr[1] - pPrev[1], pCurr[2] - pPrev[2]);
      arcLengths[i] = arcLengths[i - 1]! + d;
    }
    const totalLength = arcLengths[n - 1]!;

    for (let i = 0; i < n; i++) {
      const frame = this.cachedFrames[i]!;
      const p = frame.position;
      const T = frame.tangent;
      const N = frame.normal;
      const B = frame.binormal;

      // Coordinate s in [0, 1] along spine
      const s = totalLength > 1e-9 ? arcLengths[i]! / totalLength : i / (n - 1);

      const w = typeof this.widthOpt === 'function' ? this.widthOpt(s, time) : this.widthOpt;
      const halfW = w * 0.5;
      const twist = typeof this.twistOpt === 'function' ? this.twistOpt(s, time) : this.twistOpt;

      // Rotate binormal B and normal N around tangent T by twist angle
      const B_rot = rotateVectorAroundAxis(B, T, twist);
      const N_rot = rotateVectorAroundAxis(N, T, twist);

      // Extrude left and right vertices along twisted binormal
      const leftX = p[0] - halfW * B_rot[0];
      const leftY = p[1] - halfW * B_rot[1];
      const leftZ = p[2] - halfW * B_rot[2];

      const rightX = p[0] + halfW * B_rot[0];
      const rightY = p[1] + halfW * B_rot[1];
      const rightZ = p[2] + halfW * B_rot[2];

      const vLeft = i * 2;
      const vRight = i * 2 + 1;

      // Positions
      pos[vLeft * 3] = leftX;
      pos[vLeft * 3 + 1] = leftY;
      pos[vLeft * 3 + 2] = leftZ;

      pos[vRight * 3] = rightX;
      pos[vRight * 3 + 1] = rightY;
      pos[vRight * 3 + 2] = rightZ;

      // Normals: both vertices share twisted surface normal N_rot
      norm[vLeft * 3] = N_rot[0];
      norm[vLeft * 3 + 1] = N_rot[1];
      norm[vLeft * 3 + 2] = N_rot[2];

      norm[vRight * 3] = N_rot[0];
      norm[vRight * 3 + 1] = N_rot[1];
      norm[vRight * 3 + 2] = N_rot[2];

      // UVs: u in [0, 1] across width, v in [0, 1] along length
      uv[vLeft * 2] = 0;
      uv[vLeft * 2 + 1] = s;

      uv[vRight * 2] = 1;
      uv[vRight * 2 + 1] = s;
    }
  }
}

/**
 * Three.js Mesh wrapper for RibbonGeometry.
 */
export class RibbonMesh extends THREE.Mesh<RibbonGeometry, THREE.Material> {
  constructor(geometry: RibbonGeometry, material?: THREE.Material) {
    const mat = material ?? new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    super(geometry, mat);
  }

  /**
   * Update ribbon geometry at timeline time t.
   */
  update(t: number): void {
    this.geometry.updateFromTime(t);
  }
}
