/**
 * Raymarch chunks (GLSL ES 3.0). Compose with `buildMarcher()` from engine/raymarch.ts rather than
 * importing these directly. Requires GLSL_COMMON and GLSL_NOISE (noiseJitter) before it.
 * See docs/engine/raymarch.md.
 */

/** Step budgets and tolerances per quality tier (0 preview, 1 preview+, 2 offline). Mirrored in docs. */
export const RM_TIERS = {
  marchSteps: [64, 112, 256],
  epsMul: [1.0, 0.6, 0.3],
  shadowSteps: [28, 48, 96],
  aoSamples: [4, 5, 8],
  volSteps: [40, 64, 160],
  volStepMul: [1.0, 0.7, 0.35],
  lightSteps: [3, 5, 8],
  emptySkip: [2.0, 1.5, 1.0],
} as const;

const arr = (a: readonly number[], f = false) => `(rmQuality == 0 ? ${f ? a[0]!.toFixed(3) : a[0]} : rmQuality == 1 ? ${f ? a[1]!.toFixed(3) : a[1]} : ${f ? a[2]!.toFixed(3) : a[2]})`;

export const GLSL_RM_CORE = /* glsl */ `
// ---- raymarch core ----
uniform mat4 rmInvVP;
uniform vec3 rmCamPos;
uniform vec3 rmCamFwd;
uniform vec2 rmNearFar;
uniform vec2 rmRes;
uniform float rmTime;
uniform int rmFrame;
uniform float rmPixelAngle;
uniform float rmRelax;
uniform float rmEpsMin;
uniform int rmStepsOverride;
uniform int rmQuality;
int rmTapIdx = -1;
vec2 rmSubPixel() { return rmTapIdx < 0 ? vec2(0.0) : rgss(rmTapIdx & 3); }
vec2 rmPixel() { return gl_FragCoord.xy + rmSubPixel(); }
vec2 rmUV() { return rmPixel() / rmRes; }
void rmRay(out vec3 ro, out vec3 rd) {
  vec4 f = rmInvVP * vec4(rmUV() * 2.0 - 1.0, 1.0, 1.0);
  ro = rmCamPos;
  rd = normalize(f.xyz / f.w - ro);
}
float rmViewDepth(float t, vec3 rd) { return t * dot(rd, rmCamFwd); }
float rmJitter() { return noiseJitter(gl_FragCoord.xy, rmFrame); }
float rmEps(float t) { return rmEpsMin + t * rmPixelAngle * ${arr(RM_TIERS.epsMul, true)}; }
int rmMarchBudget() { return rmStepsOverride > 0 ? rmStepsOverride : ${arr(RM_TIERS.marchSteps)}; }
`;

export const GLSL_RM_MARCH = /* glsl */ `
// ---- sphere tracing (needs RM_MAP(p) -> signed distance) ----
struct RmHit { float t; float minD; float steps; bool hit; };
RmHit rmMarchS(vec3 ro, vec3 rd, float tmin, float tmax, float sgn) {
  int budget = rmMarchBudget();
  float omega = max(rmRelax, 1.0);
  float t = tmin, prevR = 0.0, stepLen = 0.0;
  float candT = tmin, candErr = 1e20, minD = 1e20;
  bool hit = false, exhausted = true;
  int i = 0;
  for (; i < 512; i++) {
    if (i >= budget) break;
    float sd = sgn * RM_MAP(ro + rd * t);
    float r = abs(sd);
    bool fail = omega > 1.0 && (r + prevR) < stepLen;
    if (fail) {
      stepLen *= (1.0 - omega) / omega;
      omega = 1.0;
    } else {
      stepLen = sd * omega;
      minD = min(minD, r);
      float err = r / rmEps(t);
      if (err < candErr) { candErr = err; candT = t; }
      if (err < 1.0) { hit = true; exhausted = false; break; }
    }
    prevR = r;
    t += stepLen;
    if (t > tmax) { exhausted = false; break; }
  }
  if (!hit && exhausted && candErr < 6.0) hit = true;
  return RmHit(hit ? candT : min(t, tmax), minD, float(i), hit);
}
RmHit rmMarch(vec3 ro, vec3 rd, float tmin, float tmax) { return rmMarchS(ro, rd, tmin, tmax, 1.0); }

vec3 rmNormal(vec3 p, float h) {
  const vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * RM_MAP(p + k.xyy * h) + k.yyx * RM_MAP(p + k.yyx * h) +
                   k.yxy * RM_MAP(p + k.yxy * h) + k.xxx * RM_MAP(p + k.xxx * h));
}

float rmAO(vec3 p, vec3 n, float maxDist, float strength) {
  int N = ${arr(RM_TIERS.aoSamples)};
  float occ = 0.0, sca = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= N) break;
    float h = 0.01 + maxDist * float(i) / float(N - 1);
    occ += (h - RM_MAP(p + n * h)) * sca;
    sca *= 0.95;
  }
  return clamp(1.0 - 0.36 * strength * (occ * 5.0 / float(N)) / maxDist, 0.0, 1.0);
}

float rmSoftShadow(vec3 ro, vec3 rd, float tmin, float tmax, float k) {
  int N = ${arr(RM_TIERS.shadowSteps)};
  float res = 1.0, t = tmin, ph = 1e20;
  for (int i = 0; i < 128; i++) {
    if (i >= N) break;
    float h = RM_MAP(ro + rd * t);
    float y = h * h / (2.0 * ph);
    float d = sqrt(max(h * h - y * y, 0.0));
    res = min(res, k * d / max(1e-4, t - y));
    ph = h;
    t += clamp(h, 0.002, 0.5);
    if (res < 0.0005 || t > tmax) break;
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}
`;

export const GLSL_RM_VOLUME_UNIFORMS = /* glsl */ `
// ---- volumetric marcher ----
uniform float rmVolDt;
uniform float rmVolGrow;
uniform float rmVolCutoff;
uniform float rmLightDist;
uniform float rmPowder;
uniform vec3 rmSunDir;
uniform vec3 rmSunColor;
uniform vec3 rmSkyColor;
uniform vec3 rmAlbedo;
uniform vec3 rmPhase;
`;

export const GLSL_RM_VOLUME = /* glsl */ `
struct RmVol { vec3 rgb; float alpha; float depth; float steps; };
float rmHG(float cs, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * cs, 1e-4), 1.5)); }
int rmVolBudget() { return rmStepsOverride > 0 ? rmStepsOverride : ${arr(RM_TIERS.volSteps)}; }

float rmLightDepth(vec3 p, vec3 ld, float jit) {
  int n = ${arr(RM_TIERS.lightSteps)};
  float wsum = (pow(1.5, float(n)) - 1.0) * 2.0;
  float od = 0.0, cum = 0.0, w = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= n) break;
    float seg = rmLightDist * w / wsum;
    float tm = cum + seg * (0.5 + (jit - 0.5) * 0.9);
    od += volDensity(p + ld * tm, 1) * seg;
    cum += seg;
    w *= 1.5;
  }
  return od;
}

vec3 rmVolInScatter(vec3 p, vec3 rd, float sig, float jit) {
  float od = rmLightDepth(p, rmSunDir, jit);
  float cs = dot(rd, rmSunDir);
  float s = 0.0, a = 1.0, b = 1.0, c = 1.0;
  for (int n = 0; n < 3; n++) {
    float ph = mix(rmHG(cs, -rmPhase.y * c), rmHG(cs, rmPhase.x * c), rmPhase.z);
    s += b * ph * exp(-od * a);
    a *= 0.5; b *= 0.5; c *= 0.5;
  }
  s *= mix(1.0, 1.0 - exp(-2.0 * sig), rmPowder);
  return rmAlbedo * (rmSunColor * s * 4.0 * PI + volAmbient(p));
}

RmVol rmVolume(vec3 ro, vec3 rd, float tmin, float tmax) {
  int budget = rmVolBudget();
  float stepMul = ${arr(RM_TIERS.volStepMul, true)};
  float skip = ${arr(RM_TIERS.emptySkip, true)};
  float dt0 = rmVolDt > 0.0 ? rmVolDt : (tmax - tmin) / float(budget);
  float jit = rmJitter();
  float t = tmin + jit * dt0 * stepMul;
  vec3 acc = vec3(0.0);
  float T = 1.0, dsum = 0.0;
  int i = 0;
  for (; i < 512; i++) {
    if (i >= budget || t >= tmax) break;
    float dt = max(dt0, t * rmVolGrow) * stepMul;
    vec3 p = ro + rd * t;
    float sig = volDensity(p, 0);
    if (sig > 1e-4) {
      float Ts = exp(-sig * dt);
      float absorbed = 1.0 - Ts;
#if RM_VOL_EMIT
      acc += T * volEmission(p, sig) * (absorbed / sig);
#endif
#if RM_VOL_SCATTER
      acc += T * absorbed * rmVolInScatter(p, rd, sig, fract(jit + 0.381966 * float(i)));
#endif
      dsum += T * absorbed * t;
      T *= Ts;
      if (T < rmVolCutoff) { acc /= (1.0 - T); T = 0.0; break; }
    } else {
      t += dt * (skip - 1.0);
    }
    t += dt;
  }
  float alpha = 1.0 - T;
  return RmVol(acc, alpha, alpha > 1e-4 ? dsum / alpha : rmNearFar.y, float(i));
}
`;
