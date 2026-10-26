import { noiseSalts, NOISE_GRADS, CH_CURL, CH_VORO_POS, CH_VORO_ID, CURL_DRIFT, CURL_GAIN, NZ_R2, NZ_SCALE } from '../noise';

/**
 * Shared noise library (GLSL ES 3.0), mirrored by engine/noise.ts. Original implementations,
 * see docs/engine/noise.md for provenance. Not part of GLSL_COMMON: append `${GLSL_NOISE}`
 * after it in a pass that needs it. Names are prefixed or distinct so they never clash with
 * common.ts (snoise, fbm, curl2, hash*). The hash is integer-based (no sin hash) and salted per
 * seed from mulberry32, so GPU and CPU see the same field.
 *
 * Functions: nzU/nzF/nzF3 (lattice hash), nzSimplex, snoiseGrad, snoiseHess, fbm3, fbmGrad3,
 * curlNoise3, curlNoise3J, voronoi3, voronoi2, ign, ignFrame, noiseJitter.
 */
export function buildGLSLNoise(seed = 0): string {
  const [s0, s1, s2, s3] = noiseSalts(seed);
  const grads = NOISE_GRADS.map((g) => `vec3(${g.map((x) => x.toFixed(1)).join(',')})`).join(',');
  const v3 = (v: readonly number[]) => `vec3(${v.map((x) => x.toFixed(5)).join(',')})`;
  return /* glsl */ `
// ---- noise library (seed ${seed}) ----
const uint NZ_S0 = ${s0}u, NZ_S1 = ${s1}u, NZ_S2 = ${s2}u, NZ_S3 = ${s3}u;
const int NZ_CH_CURL = ${CH_CURL}, NZ_CH_VORO_POS = ${CH_VORO_POS}, NZ_CH_VORO_ID = ${CH_VORO_ID};
const float NZ_R2 = ${NZ_R2.toFixed(3)}, NZ_SCALE = ${NZ_SCALE.toFixed(1)};
const float NZ_CURL_GAIN = ${CURL_GAIN.toFixed(5)};
const vec3 NZ_CURL_DRIFT = ${v3(CURL_DRIFT)};
const vec3 NZ_GRADS[12] = vec3[12](${grads});

uint nzMix(uint h) { h ^= h >> 16u; h *= 0x7feb352du; h ^= h >> 15u; h *= 0x846ca68bu; h ^= h >> 16u; return h; }
uint nzU(ivec3 p, int ch) {
  uint h = nzMix(NZ_S3 + uint(ch) * 0x9e3779b9u);
  h = nzMix(h ^ (uint(p.x) + NZ_S0));
  h = nzMix(h ^ (uint(p.y) + NZ_S1));
  return nzMix(h ^ (uint(p.z) + NZ_S2));
}
float nzF(ivec3 p, int ch) { return float(nzU(p, ch) >> 8u) * (1.0 / 16777216.0); }
vec3 nzF3(ivec3 p, int ch) {
  uint h = nzU(p, ch);
  return vec3(float(h >> 8u), float(nzMix(h ^ 0x68e31da4u) >> 8u), float(nzMix(h ^ 0xb5297a4du) >> 8u)) * (1.0 / 16777216.0);
}

// 3D simplex gradient noise, range ~[-1,1]. Value, analytic gradient and (optionally) Hessian.
float nzCore(vec3 p, int ch, out vec3 gr, out mat3 H, bool wantH) {
  float s = (p.x + p.y + p.z) * (1.0 / 3.0);
  vec3 fi = floor(p + s);
  float t0 = (fi.x + fi.y + fi.z) * (1.0 / 6.0);
  vec3 x0 = p - fi + t0;
  vec3 g = step(x0.yzx, x0.xyz), l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy), i2 = max(g.xyz, l.zxy);
  vec3 d[4];
  vec3 o[4];
  o[0] = vec3(0.0); o[1] = i1; o[2] = i2; o[3] = vec3(1.0);
  d[0] = x0;
  d[1] = x0 - i1 + 1.0 / 6.0;
  d[2] = x0 - i2 + 2.0 / 6.0;
  d[3] = x0 - 0.5;
  ivec3 ib = ivec3(fi);
  float n = 0.0;
  gr = vec3(0.0);
  H = mat3(0.0);
  for (int c = 0; c < 4; c++) {
    vec3 dd = d[c];
    float t = NZ_R2 - dot(dd, dd);
    if (t > 0.0) {
      vec3 gv = NZ_GRADS[(nzU(ib + ivec3(o[c]), ch) >> 8u) % 12u];
      float gd = dot(gv, dd);
      float t2 = t * t, t3 = t2 * t, t4 = t3 * t;
      n += t4 * gd;
      gr += t4 * gv - 8.0 * t3 * gd * dd;
      if (wantH) {
        H += -8.0 * t3 * (outerProduct(gv, dd) + outerProduct(dd, gv)) + 48.0 * t2 * gd * outerProduct(dd, dd);
        H[0][0] -= 8.0 * t3 * gd; H[1][1] -= 8.0 * t3 * gd; H[2][2] -= 8.0 * t3 * gd;
      }
    }
  }
  gr *= NZ_SCALE;
  H *= NZ_SCALE;
  return NZ_SCALE * n;
}
float nzSimplex(vec3 p, int ch) { vec3 g; mat3 H; return nzCore(p, ch, g, H, false); }
float nzSimplex(vec3 p) { return nzSimplex(p, 0); }
float snoiseGrad(vec3 p, int ch, out vec3 grad) { mat3 H; return nzCore(p, ch, grad, H, false); }
float snoiseGrad(vec3 p, out vec3 grad) { mat3 H; return nzCore(p, 0, grad, H, false); }
float snoiseHess(vec3 p, int ch, out vec3 grad, out mat3 H) { return nzCore(p, ch, grad, H, true); }

// fbm normalised by total amplitude (~[-1,1]); octave i uses hash channel i; max 8 octaves.
float fbmGrad3(vec3 p, int oct, float lac, float gain, out vec3 grad) {
  float v = 0.0, a = 1.0, f = 1.0, norm = 0.0;
  vec3 g = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    vec3 gi; mat3 H;
    v += a * nzCore(p * f, i, gi, H, false);
    g += a * f * gi;
    norm += a; a *= gain; f *= lac;
  }
  float k = norm > 0.0 ? 1.0 / norm : 1.0;
  grad = g * k;
  return v * k;
}
float fbm3(vec3 p, int oct, float lac, float gain) { vec3 g; return fbmGrad3(p, oct, lac, gain, g); }
float fbm3(vec3 p, int oct) { vec3 g; return fbmGrad3(p, oct, 2.0, 0.5, g); }

// Divergence-free curl noise: curl of the potential (n64,n65,n66). t drifts the lattice, so the
// field is divergence-free at every t. Same call shape as particles.ts's built-in curlNoise(p, t).
vec3 curlNoise3(vec3 p, float t) {
  p += t * NZ_CURL_DRIFT;
  vec3 gx, gy, gz;
  snoiseGrad(p, NZ_CH_CURL, gx);
  snoiseGrad(p, NZ_CH_CURL + 1, gy);
  snoiseGrad(p, NZ_CH_CURL + 2, gz);
  return vec3(gz.y - gy.z, gx.z - gz.x, gy.x - gx.y) * NZ_CURL_GAIN;
}
// J * v = directional derivative of the curl (column m = d curl / d x_m). trace(J) == 0.
vec3 curlNoise3J(vec3 p, float t, out mat3 J) {
  p += t * NZ_CURL_DRIFT;
  vec3 gx, gy, gz; mat3 hx, hy, hz;
  snoiseHess(p, NZ_CH_CURL, gx, hx);
  snoiseHess(p, NZ_CH_CURL + 1, gy, hy);
  snoiseHess(p, NZ_CH_CURL + 2, gz, hz);
  for (int m = 0; m < 3; m++) {
    J[m] = vec3(hz[m][1] - hy[m][2], hx[m][2] - hz[m][0], hy[m][0] - hx[m][1]) * NZ_CURL_GAIN;
  }
  return vec3(gz.y - gy.z, gx.z - gz.x, gy.x - gx.y) * NZ_CURL_GAIN;
}

// Voronoi: F1/F2 distances, feature point (cell centre) and a stable id in [0,1). 3x3(x3) search;
// jit in [0,1] (1 = fully random feature points, 0 = square lattice).
struct NzVoronoi3 { float f1; float f2; vec3 cell; float id; };
struct NzVoronoi2 { float f1; float f2; vec2 cell; float id; };
NzVoronoi3 voronoi3(vec3 p, float jit) {
  vec3 fl = floor(p), fr = p - fl;
  ivec3 ib = ivec3(fl);
  float d1 = 8.0, d2 = 8.0;
  vec3 cc = vec3(0.0); ivec3 bc = ivec3(0);
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec3 o = ivec3(i, j, k);
    vec3 r = vec3(o) + 0.5 + (nzF3(ib + o, NZ_CH_VORO_POS) - 0.5) * jit;
    vec3 dv = r - fr;
    float d = dot(dv, dv);
    if (d < d1) { d2 = d1; d1 = d; cc = r; bc = ib + o; } else if (d < d2) d2 = d;
  }
  return NzVoronoi3(sqrt(d1), sqrt(d2), fl + cc, nzF(bc, NZ_CH_VORO_ID));
}
NzVoronoi2 voronoi2(vec2 p, float jit) {
  vec2 fl = floor(p), fr = p - fl;
  ivec3 ib = ivec3(ivec2(fl), 0);
  float d1 = 8.0, d2 = 8.0;
  vec2 cc = vec2(0.0); ivec3 bc = ivec3(0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec3 o = ivec3(i, j, 0);
    vec2 r = vec2(o.xy) + 0.5 + (nzF3(ib + o, NZ_CH_VORO_POS).xy - 0.5) * jit;
    vec2 dv = r - fr;
    float d = dot(dv, dv);
    if (d < d1) { d2 = d1; d1 = d; cc = r; bc = ib + o; } else if (d < d2) d2 = d;
  }
  return NzVoronoi2(sqrt(d1), sqrt(d2), fl + cc, nzF(bc, NZ_CH_VORO_ID));
}

// Interleaved gradient noise (Jimenez 2014). px = gl_FragCoord.xy (physical pixels). Depends on the
// pixel and an optional integer frame index only, never the time.
float _ignRaw(vec2 px) { return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715)))); }
float ign(vec2 px) { return _ignRaw(floor(px)); }
float ignFrame(vec2 px, int frame) { return _ignRaw(floor(px) + 5.588238 * float(frame & 63)); }
// Ray-march start jitter in [0,1): IGN in space, golden-ratio sequence over frames (period 256).
float noiseJitter(vec2 px, int frame) { return fract(ign(px) + 0.61803398875 * float(frame & 255)); }
`;
}

export const GLSL_NOISE = buildGLSLNoise(0);
