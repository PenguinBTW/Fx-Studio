// CPU mirror of the shared GLSL noise library (glsl/noise.ts). Same integer hash, same algorithms,
// so a CPU path (the walk, particle seeding, tests) sees the field the GPU draws.
// Everything is a pure function of its arguments and the seed. All per-seed constants come from
// mulberry32(seed); there is no clock and no Math.random. See docs/engine/noise.md.
import { mulberry32 } from './util';

export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

/** 12 edge-midpoint gradients (Perlin 2002, "Improving Noise"). */
export const NOISE_GRADS: readonly Vec3[] = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

/** Hash channels reserved by the library (fbm octave i uses channel i). */
export const CH_CURL = 64;
export const CH_VORO_POS = 1;
export const CH_VORO_ID = 7;
/** Slow drift (units per second of `t`) applied to the lattice by curlNoise3. */
export const CURL_DRIFT: Vec3 = [0.31, 0.17, 0.23];
/** Potential scale: brings the curl RMS magnitude to ~1 (curl of unit-range simplex is ~4). */
export const CURL_GAIN = 0.25;

/** Four 32-bit salts that make the integer hash a different field per seed. */
export function noiseSalts(seed: number): [number, number, number, number] {
  const r = mulberry32(seed);
  const s = () => Math.floor(r() * 4294967296) >>> 0;
  return [s(), s(), s(), s()];
}

const mix = (h: number): number => {
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
};

/** Kernel radius^2 0.5 (not Gustavson's 0.6: at 0.6 a fifth lattice point can fall inside the radius and the field has tiny gradient jumps). */
export const NZ_R2 = 0.5;
export const NZ_SCALE = 74;
const F3 = 1 / 3, G3 = 1 / 6;
const INV24 = 1 / 16777216;

export interface SimplexGrad { value: number; grad: Vec3 }
export interface SimplexHess extends SimplexGrad { hess: number[] }
export interface CurlResult { curl: Vec3; jac: number[] }
export interface Voronoi3 { f1: number; f2: number; cell: Vec3; id: number }
export interface Voronoi2 { f1: number; f2: number; cell: Vec2; id: number }

export function createNoise(seed = 0) {
  const [S0, S1, S2, S3] = noiseSalts(seed);

  const hashU3 = (x: number, y: number, z: number, ch = 0): number => {
    let h = mix((S3 + Math.imul(ch, 0x9e3779b9)) >>> 0);
    h = mix((h ^ ((x + S0) >>> 0)) >>> 0);
    h = mix((h ^ ((y + S1) >>> 0)) >>> 0);
    return mix((h ^ ((z + S2) >>> 0)) >>> 0);
  };
  const hashF3 = (x: number, y: number, z: number, ch = 0): number => (hashU3(x, y, z, ch) >>> 8) * INV24;
  const hash3F3 = (x: number, y: number, z: number, ch = 0): Vec3 => {
    const h = hashU3(x, y, z, ch);
    return [(h >>> 8) * INV24, (mix((h ^ 0x68e31da4) >>> 0) >>> 8) * INV24, (mix((h ^ 0xb5297a4d) >>> 0) >>> 8) * INV24];
  };

  /** Value (+ gradient, + Hessian when `H` is given), scaled so |value| <= ~1. */
  function core(px: number, py: number, pz: number, ch: number, gr: Vec3, H: number[] | null): number {
    const s = (px + py + pz) * F3;
    const fi = Math.floor(px + s), fj = Math.floor(py + s), fk = Math.floor(pz + s);
    const t0 = (fi + fj + fk) * G3;
    const x0 = px - fi + t0, y0 = py - fj + t0, z0 = pz - fk + t0;
    const gx = x0 >= y0 ? 1 : 0, gy = y0 >= z0 ? 1 : 0, gz = z0 >= x0 ? 1 : 0;
    const lx = 1 - gx, ly = 1 - gy, lz = 1 - gz;
    const i1 = Math.min(gx, lz), j1 = Math.min(gy, lx), k1 = Math.min(gz, ly);
    const i2 = Math.max(gx, lz), j2 = Math.max(gy, lx), k2 = Math.max(gz, ly);
    let n = 0;
    gr[0] = 0; gr[1] = 0; gr[2] = 0;
    if (H) H.fill(0);
    const corner = (ix: number, iy: number, iz: number, dx: number, dy: number, dz: number) => {
      const t = NZ_R2 - (dx * dx + dy * dy + dz * dz);
      if (t <= 0) return;
      const g = NOISE_GRADS[(hashU3(ix, iy, iz, ch) >>> 8) % 12]!;
      const gd = g[0] * dx + g[1] * dy + g[2] * dz;
      const t2 = t * t, t3 = t2 * t, t4 = t3 * t;
      n += t4 * gd;
      gr[0] += t4 * g[0] - 8 * t3 * gd * dx;
      gr[1] += t4 * g[1] - 8 * t3 * gd * dy;
      gr[2] += t4 * g[2] - 8 * t3 * gd * dz;
      if (H) {
        const d = [dx, dy, dz];
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
          H[a * 3 + b] += -8 * t3 * (g[a]! * d[b]! + g[b]! * d[a]!) + 48 * t2 * gd * d[a]! * d[b]! - (a === b ? 8 * t3 * gd : 0);
        }
      }
    };
    corner(fi, fj, fk, x0, y0, z0);
    corner(fi + i1, fj + j1, fk + k1, x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3);
    corner(fi + i2, fj + j2, fk + k2, x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3);
    corner(fi + 1, fj + 1, fk + 1, x0 - 0.5, y0 - 0.5, z0 - 0.5);
    gr[0] *= NZ_SCALE; gr[1] *= NZ_SCALE; gr[2] *= NZ_SCALE;
    if (H) for (let i = 0; i < 9; i++) H[i] = H[i]! * NZ_SCALE;
    return NZ_SCALE * n;
  }

  const scratch: Vec3 = [0, 0, 0];
  const simplex = (p: Vec3, ch = 0): number => core(p[0], p[1], p[2], ch, scratch, null);
  const simplexGrad = (p: Vec3, ch = 0): SimplexGrad => {
    const grad: Vec3 = [0, 0, 0];
    return { value: core(p[0], p[1], p[2], ch, grad, null), grad };
  };
  const simplexHess = (p: Vec3, ch = 0): SimplexHess => {
    const grad: Vec3 = [0, 0, 0];
    const hess = new Array<number>(9).fill(0);
    return { value: core(p[0], p[1], p[2], ch, grad, hess), grad, hess };
  };

  /** Normalised by total amplitude: range ~[-1, 1]. Octave i uses hash channel i, so octave 0 == simplex(p). */
  function fbmGrad(p: Vec3, oct = 5, lac = 2, gain = 0.5): SimplexGrad {
    let v = 0, a = 1, f = 1, norm = 0;
    const g: Vec3 = [0, 0, 0];
    const gi: Vec3 = [0, 0, 0];
    for (let i = 0; i < Math.min(oct, 8); i++) {
      v += a * core(p[0] * f, p[1] * f, p[2] * f, i, gi, null);
      g[0] += a * f * gi[0]; g[1] += a * f * gi[1]; g[2] += a * f * gi[2];
      norm += a; a *= gain; f *= lac;
    }
    const k = norm > 0 ? 1 / norm : 1;
    return { value: v * k, grad: [g[0] * k, g[1] * k, g[2] * k] };
  }
  const fbm = (p: Vec3, oct = 5, lac = 2, gain = 0.5): number => fbmGrad(p, oct, lac, gain).value;

  /**
   * Divergence-free field: curl of the vector potential (n_64, n_65, n_66), three decorrelated
   * simplex fields. `t` translates the lattice (CURL_DRIFT per second), so the field stays
   * exactly divergence-free at every t. Same call shape as particles.ts's curlNoise(p, t).
   */
  function curlNoise3(p: Vec3, t = 0): Vec3 {
    const x = p[0] + t * CURL_DRIFT[0], y = p[1] + t * CURL_DRIFT[1], z = p[2] + t * CURL_DRIFT[2];
    const gx: Vec3 = [0, 0, 0], gy: Vec3 = [0, 0, 0], gz: Vec3 = [0, 0, 0];
    core(x, y, z, CH_CURL, gx, null);
    core(x, y, z, CH_CURL + 1, gy, null);
    core(x, y, z, CH_CURL + 2, gz, null);
    return [(gz[1] - gy[2]) * CURL_GAIN, (gx[2] - gz[0]) * CURL_GAIN, (gy[0] - gx[1]) * CURL_GAIN];
  }
  /** Curl and its Jacobian (row-major, jac[3*i+m] = d curl_i / d x_m; trace is exactly 0 up to rounding). */
  function curlNoise3J(p: Vec3, t = 0): CurlResult {
    const x = p[0] + t * CURL_DRIFT[0], y = p[1] + t * CURL_DRIFT[1], z = p[2] + t * CURL_DRIFT[2];
    const gx: Vec3 = [0, 0, 0], gy: Vec3 = [0, 0, 0], gz: Vec3 = [0, 0, 0];
    const hx = new Array<number>(9), hy = new Array<number>(9), hz = new Array<number>(9);
    core(x, y, z, CH_CURL, gx, hx);
    core(x, y, z, CH_CURL + 1, gy, hy);
    core(x, y, z, CH_CURL + 2, gz, hz);
    const jac: number[] = [];
    for (let m = 0; m < 3; m++) jac[m] = (hz[3 + m]! - hy[6 + m]!) * CURL_GAIN;
    for (let m = 0; m < 3; m++) jac[3 + m] = (hx[6 + m]! - hz[m]!) * CURL_GAIN;
    for (let m = 0; m < 3; m++) jac[6 + m] = (hy[m]! - hx[3 + m]!) * CURL_GAIN;
    return { curl: [(gz[1] - gy[2]) * CURL_GAIN, (gx[2] - gz[0]) * CURL_GAIN, (gy[0] - gx[1]) * CURL_GAIN], jac };
  }

  /** F1/F2 are Euclidean distances to the nearest / second-nearest feature point (3x3x3 cell search). */
  function voronoi3(p: Vec3, jit = 1): Voronoi3 {
    const ix = Math.floor(p[0]), iy = Math.floor(p[1]), iz = Math.floor(p[2]);
    const fx = p[0] - ix, fy = p[1] - iy, fz = p[2] - iz;
    let d1 = 8, d2 = 8, bx = 0, by = 0, bz = 0, cx = 0, cy = 0, cz = 0;
    for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const h = hash3F3(ix + i, iy + j, iz + k, CH_VORO_POS);
      const rx = i + 0.5 + (h[0] - 0.5) * jit, ry = j + 0.5 + (h[1] - 0.5) * jit, rz = k + 0.5 + (h[2] - 0.5) * jit;
      const dx = rx - fx, dy = ry - fy, dz = rz - fz;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < d1) { d2 = d1; d1 = d; bx = ix + i; by = iy + j; bz = iz + k; cx = rx; cy = ry; cz = rz; } else if (d < d2) d2 = d;
    }
    return { f1: Math.sqrt(d1), f2: Math.sqrt(d2), cell: [ix + cx, iy + cy, iz + cz], id: hashF3(bx, by, bz, CH_VORO_ID) };
  }
  function voronoi2(p: Vec2, jit = 1): Voronoi2 {
    const ix = Math.floor(p[0]), iy = Math.floor(p[1]);
    const fx = p[0] - ix, fy = p[1] - iy;
    let d1 = 8, d2 = 8, bx = 0, by = 0, cx = 0, cy = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const h = hash3F3(ix + i, iy + j, 0, CH_VORO_POS);
      const rx = i + 0.5 + (h[0] - 0.5) * jit, ry = j + 0.5 + (h[1] - 0.5) * jit;
      const dx = rx - fx, dy = ry - fy;
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; bx = ix + i; by = iy + j; cx = rx; cy = ry; } else if (d < d2) d2 = d;
    }
    return { f1: Math.sqrt(d1), f2: Math.sqrt(d2), cell: [ix + cx, iy + cy], id: hashF3(bx, by, 0, CH_VORO_ID) };
  }

  return {
    seed, salts: [S0, S1, S2, S3] as [number, number, number, number],
    hashU3, hashF3, hash3F3,
    simplex, simplexGrad, simplexHess, fbm, fbmGrad,
    curlNoise3, curlNoise3J, voronoi3, voronoi2,
  };
}

export type NoiseLib = ReturnType<typeof createNoise>;

const f32 = Math.fround;
const IGN_A = f32(0.06711056), IGN_B = f32(0.00583715), IGN_C = f32(52.9829189), IGN_FRAME = f32(5.588238), GOLDEN = f32(0.61803398875);
const fract32 = (v: number) => f32(v - Math.floor(v));
function ignRaw(x: number, y: number): number {
  return fract32(f32(IGN_C * fract32(f32(f32(x * IGN_A) + f32(y * IGN_B)))));
}

/**
 * Interleaved gradient noise (Jimenez 2014). Depends only on the pixel and an optional integer
 * frame index (never the time). Evaluated in float32 steps to track the GPU; GPU/CPU differ by
 * ~1e-5 for px < 64 and up to ~1e-3 at 1080p coordinates (float32 ulp of the dot product).
 */
export function ign(px: number, py: number, frame?: number): number {
  const ox = Math.floor(px), oy = Math.floor(py);
  if (frame === undefined) return ignRaw(ox, oy);
  const o = f32(IGN_FRAME * (frame & 63));
  return ignRaw(f32(ox + o), f32(oy + o));
}

/** Ray-march start jitter: IGN in space, golden-ratio sequence in frame index (period 256). Pixel + integer frame only. */
export function noiseJitter(px: number, py: number, frame = 0): number {
  return fract32(f32(ign(px, py) + f32(GOLDEN * (frame & 255))));
}

export const noise = createNoise(0);
