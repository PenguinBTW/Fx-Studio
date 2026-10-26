// P4 demo: three raymarched shots from one scene module (entry params.shot = 'a' | 'b' | 'c').
//   a: blobby metal on a satin floor (march, normal, AO, soft shadow, one reflection bounce)
//   b: low-sun cumulus bank, camera flying up into it (volumetric scatter + light march)
//   c: solar granulation: Voronoi cells, blackbody emission, limb darkening, rising plumes (volume emission)
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../../engine/dsl';
import { type Frame, type PostOverrides } from '../../../engine/scene';
import { RaymarchPass, type RmQuality } from '../../../engine/raymarch';

const SHADE_A = /* glsl */ `
const float FLOOR_Y = -1.1;
const vec3 KEY = vec3(-0.55, 0.72, 0.42);
float blobs(vec3 p) {
  float t = rmTime, d = 1e9;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec3 c = vec3(0.95 * sin(t * 0.55 + fi * 1.9), 0.2 + 0.45 * sin(t * 0.7 + fi * 2.7), 0.95 * cos(t * 0.45 + fi * 2.3));
    d = smin(d, length(p - c) - (0.62 + 0.1 * sin(fi * 3.1)), 0.6);
  }
  return d + 0.018 * nzSimplex(p * 2.6 + vec3(0.0, t * 0.15, 0.0));
}
float map(vec3 p) { return min(blobs(p), p.y - FLOOR_Y); }
vec3 envMap(vec3 d) {
  vec3 k = normalize(KEY);
  vec3 c = mix(vec3(0.012, 0.013, 0.018), vec3(0.07, 0.085, 0.12), pow(d.y * 0.5 + 0.5, 2.0));
  c += vec3(7.0, 5.6, 4.2) * smoothstep(0.90, 0.935, dot(d, k));
  c += vec3(0.5, 0.65, 1.0) * 5.0 * exp(-pow((d.x - 0.72) * 7.0, 2.0)) * smoothstep(0.0, 0.3, -d.z + 0.1) * smoothstep(-0.1, 0.4, d.y);
  c += vec3(1.0, 0.45, 0.2) * 1.6 * exp(-pow((d.x + 0.85) * 9.0, 2.0)) * smoothstep(0.2, -0.5, d.z) * smoothstep(-0.2, 0.3, d.y);
  return c;
}
vec3 floorCol(vec3 p) {
  float r = length(p.xz);
  return vec3(0.045, 0.046, 0.052) * (0.5 + 0.5 * smoothstep(7.0, 0.0, r));
}
vec3 shadeFlat(vec3 p, vec3 n, vec3 rd, bool isFloor) {
  vec3 L = normalize(KEY);
  float sh = rmSoftShadow(p + n * 0.01, L, 0.02, 10.0, 8.0);
  vec3 r = reflect(rd, n);
  if (isFloor) {
    float pool = smoothstep(7.0, 0.5, length(p.xz - vec2(-1.0, 0.7)));
    return floorCol(p) * (0.4 + 3.5 * max(dot(n, L), 0.0) * sh * pool) + envMap(r) * 0.03;
  }
  vec3 F0 = vec3(0.96, 0.62, 0.45);
  float f = pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  return (F0 + (1.0 - F0) * f) * envMap(r) * 0.9;
}
vec4 rmShade(vec3 ro, vec3 rd, out float depth) {
  depth = rmNearFar.y;
  RmHit h = rmMarch(ro, rd, 0.05, 60.0);
  vec3 bg = envMap(rd) * 0.35;
  vec3 col = bg;
  if (h.hit) {
    vec3 p = ro + rd * h.t;
    vec3 n = rmNormal(p, 0.0008 + h.t * 0.0006);
    depth = rmViewDepth(h.t, rd);
    bool isFloor = (p.y - FLOOR_Y) < blobs(p);
    vec3 L = normalize(KEY);
    float ao = rmAO(p, n, 0.55, 1.0);
    float sh = rmSoftShadow(p + n * 0.01, L, 0.02, 10.0, 8.0);
    vec3 r = reflect(rd, n);
    float ndv = max(dot(n, -rd), 0.0);
    if (isFloor) {
      float pool = smoothstep(7.0, 0.5, length(p.xz - vec2(-1.0, 0.7)));
      vec3 base = floorCol(p);
      vec3 refl = envMap(r);
      RmHit rh = rmMarch(p + n * 0.02, r, 0.02, 14.0);
      if (rh.hit) {
        vec3 q = p + n * 0.02 + r * rh.t;
        refl = shadeFlat(q, rmNormal(q, 0.002), r, false);
      }
      float fr = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
      col = base * (0.35 + 3.5 * max(dot(n, L), 0.0) * sh * pool) * ao + refl * (0.12 + fr) * (0.4 + 0.6 * ao);
      col *= smoothstep(26.0, 6.0, length(p.xz)) ;
    } else {
      vec3 F0 = vec3(0.96, 0.62, 0.45);
      float f = pow(1.0 - ndv, 5.0);
      vec3 Fr = F0 + (1.0 - F0) * f;
      vec3 refl = envMap(r);
      RmHit rh = rmMarch(p + n * 0.01, r, 0.01, 14.0);
      if (rh.hit) {
        vec3 q = p + n * 0.01 + r * rh.t;
        bool qf = (q.y - FLOOR_Y) < blobs(q);
        refl = shadeFlat(q, rmNormal(q, 0.002), r, qf);
      }
      vec3 hv = normalize(L - rd);
      float spec = pow(max(dot(n, hv), 0.0), 220.0) * sh;
      col = Fr * refl * mix(0.35, 1.0, ao) * (0.35 + 0.65 * sh + 0.0) + vec3(1.0, 0.85, 0.7) * spec * 3.0;
      col += vec3(0.02, 0.012, 0.01) * ao;
    }
    float fog = exp(-h.t * 0.012);
    col = mix(bg, col, fog);
  }
  return vec4(col, 1.0);
}
`;

const CLOUD_DENSITY = /* glsl */ `
const float CY0 = 1.7, CY1 = 4.6;
float volDensity(vec3 p, int lod) {
  float h = (p.y - CY0) / (CY1 - CY0);
  if (h <= 0.0 || h >= 1.0) return 0.0;
  vec3 q = p * 0.30 + vec3(rmTime * 0.05, 0.0, rmTime * 0.02);
  float prof = smoothstep(0.0, 0.14, h) * (1.0 - smoothstep(0.35, 1.0, h));
  float cover = fbm3(vec3(p.x * 0.06 + 3.1, 7.0, p.z * 0.06 - 1.7), 2);
  float base = fbm3(q, lod == 0 ? 4 : 2);
  float d = base * 0.5 + cover * 0.55 + prof * 0.8 - 0.46;
  if (d <= 0.0) return 0.0;
  if (lod == 0) d -= 0.12 * (0.5 + 0.5 * nzSimplex(q * 4.3 + 11.0)) * (1.0 - prof * 0.5);
  return max(d, 0.0) * 5.5;
}
`;
const CLOUD_AMBIENT = /* glsl */ `vec3 volAmbient(vec3 p) {
  float h = clamp((p.y - CY0) / (CY1 - CY0), 0.0, 1.0);
  return mix(vec3(0.16, 0.15, 0.17), vec3(0.20, 0.30, 0.50), h) * 0.55;
}
`;

const SHADE_B = /* glsl */ `
const vec3 SUN = normalize(vec3(-0.55, 0.085, -0.83));
vec3 skyCol(vec3 rd) {
  float y = max(rd.y, 0.0);
  vec3 hor = vec3(1.0, 0.62, 0.38) * 0.9;
  vec3 mid = vec3(0.36, 0.45, 0.68);
  vec3 top = vec3(0.07, 0.15, 0.40);
  vec3 c = mix(hor, mid, pow(smoothstep(0.0, 0.35, y), 0.6));
  c = mix(c, top, smoothstep(0.25, 0.95, y));
  float s = max(dot(rd, SUN), 0.0);
  c += vec3(1.0, 0.7, 0.4) * (pow(s, 12.0) * 0.8 + pow(s, 220.0) * 6.0);
  c = mix(c, vec3(0.18, 0.16, 0.16), smoothstep(0.0, -0.25, rd.y));
  return c;
}
vec4 rmShade(vec3 ro, vec3 rd, out float depth) {
  depth = rmNearFar.y;
  vec3 sky = skyCol(rd);
  float ty0 = rd.y > 1e-4 ? (CY0 - ro.y) / rd.y : (rd.y < -1e-4 ? (CY1 - ro.y) / rd.y : 0.0);
  float ty1 = rd.y > 1e-4 ? (CY1 - ro.y) / rd.y : (rd.y < -1e-4 ? (CY0 - ro.y) / rd.y : 1e9);
  float tmin = max(max(min(ty0, ty1), 0.0), 0.02), tmax = min(max(ty0, ty1), 90.0);
  if (ro.y > CY0 && ro.y < CY1) { tmin = 0.02; }
  vec3 col = sky;
  if (tmax > tmin) {
    RmVol v = rmVolume(ro, rd, tmin, tmax);
    float fog = exp(-v.depth * 0.018);
    vec3 haze = mix(skyCol(normalize(vec3(rd.x, 0.02, rd.z))), vec3(0.8, 0.6, 0.5), 0.0);
    col = sky * (1.0 - v.alpha) + v.rgb * fog + haze * v.alpha * (1.0 - fog);
    depth = v.depth;
  }
  return vec4(col, 1.0);
}
`;

const SHADE_C = /* glsl */ `
const float SR = 40.0, SHELL = 3.2, CELLS = 1.7;
const vec3 SC = vec3(0.0, -40.0, 0.0);
float g_alt, g_plume;
vec2 cellP(vec3 p) {
  vec2 q = p.xz * CELLS;
  return q + 0.32 * curlNoise3(vec3(q * 0.33, 0.7), rmTime * 0.1).xz;
}
vec3 bbEmit(float K) {
  return blackbodyToLinearSRGB(K) * pow(K / 5800.0, 4.0);
}
float volDensity(vec3 p, int lod) {
  float alt = length(p - SC) - SR;
  g_alt = alt; g_plume = 0.0;
  float haze = 0.05 * exp(-alt * 1.1);
  if (alt > 2.6) return haze;
  NzVoronoi2 v = voronoi2(cellP(p), 1.0);
  float cc = exp(-pow(v.f1 * 1.7, 2.0));
  float n = fbm3(vec3(p.x * 1.2, alt * 2.4 - rmTime * 0.9 + v.id * 9.0, p.z * 1.2), 3) * 0.5 + 0.5;
  float pl = cc * smoothstep(0.35, 0.85, n) * exp(-alt * 1.1) * (1.0 - smoothstep(1.6, 2.6, alt));
  pl *= 0.7 + 0.5 * sin(rmTime * 0.35 + v.id * 6.28);
  g_plume = pl;
  return haze + 3.0 * pl;
}
vec3 volEmission(vec3 p, float sig) {
  float alt = g_alt;
  float K = mix(5000.0, 3000.0, smoothstep(0.0, 2.4, alt));
  vec3 plume = bbEmit(K) * 3.0 * g_plume * 4.0;
  vec3 hazeE = bbEmit(mix(4300.0, 3200.0, smoothstep(0.0, 3.0, alt))) * 1.7 * 0.05 * exp(-alt * 1.1);
  return plume + hazeE;
}
vec3 surfaceEmit(vec3 p, vec3 rd, float t) {
  vec3 n = normalize(p - SC);
  float mu = max(dot(n, -rd), 0.0);
  vec2 q = cellP(p);
  NzVoronoi2 v = voronoi2(q, 1.0);
  float fp = clamp(t * rmPixelAngle * CELLS / max(mu, 0.12), 0.0, 4.0);
  float edge = smoothstep(0.0, 0.34 + fp * 0.9, v.f2 - v.f1);
  float cb = 1.0 - smoothstep(0.0, 0.8, v.f1);
  float ph = 0.5 + 0.5 * sin(rmTime * 0.31 + v.id * 6.28318);
  float B = mix(0.0, 1.0, pow(edge, 0.8)) * (0.55 + 0.45 * cb) * (0.8 + 0.3 * ph);
  float fine = nzSimplex(vec3(q * 3.1, rmTime * 0.2)) * 0.5 + 0.5;
  B *= 0.8 + 0.4 * fine * edge;\n  B *= 0.88 + 0.24 * (nzSimplex(vec3(q * 7.0, 1.3)) * 0.5 + 0.5);
  B = mix(B, 0.5, smoothstep(0.35, 1.6, fp));
  float limb = 0.3 + 0.7 * mu;\n  float K = (3300.0 + 2600.0 * pow(clamp(B, 0.0, 1.0), 0.8)) * (0.78 + 0.22 * mu);\n  return bbEmit(K) * 1.15 * limb;
}
vec4 rmShade(vec3 ro, vec3 rd, out float depth) {
  depth = rmNearFar.y;
  vec3 oc = ro - SC;
  float b = dot(oc, rd), cc = dot(oc, oc);
  float RO = SR + SHELL;
  float d2 = b * b - (cc - RO * RO);
  vec3 col = vec3(0.0006, 0.0008, 0.0016);
  if (d2 <= 0.0) return vec4(col, 1.0);
  float tin = cc > RO * RO ? -b - sqrt(d2) : 0.0;
  float tout = -b + sqrt(d2);
  float d1 = b * b - (cc - SR * SR);
  bool hit = d1 > 0.0 && -b - sqrt(d1) > 0.0;
  float ts = hit ? -b - sqrt(d1) : tout;
  if (tout < 0.0) return vec4(col, 1.0);
  RmVol v = rmVolume(ro, rd, max(tin, 0.0), ts);
  vec3 surf = vec3(0.0);
  if (hit) {
    surf = surfaceEmit(ro + rd * ts, rd, ts);
    depth = rmViewDepth(ts, rd);
  } else depth = v.depth;
  col = v.rgb + (1.0 - v.alpha) * (hit ? surf : col);
  return vec4(col, 1.0);
}
`;

type Shot = 'a' | 'b' | 'c';

function build(shot: Shot): RaymarchPass {
  if (shot === 'a') { const i = SHADE_A.indexOf('vec3 envMap'); return new RaymarchPass({ map: SHADE_A.slice(0, i), shade: SHADE_A.slice(i), relax: 1.3 }); }
  if (shot === 'b') {
    const p = new RaymarchPass({
      shade: SHADE_B,
      volume: { density: CLOUD_DENSITY, scatter: true, ambient: CLOUD_AMBIENT },
    });
    p.u.rmVolDt!.value = 0.22;
    p.u.rmVolGrow!.value = 0.05;
    p.u.rmLightDist!.value = 7.0;
    p.u.rmPowder!.value = 0.7;
    p.u.rmAlbedo!.value = new THREE.Vector3(1, 1, 1);
    p.u.rmPhase!.value = new THREE.Vector3(0.62, 0.25, 0.75);
    p.setSun([-0.55, 0.085, -0.83], [3.4, 2.5, 1.7]);
    return p;
  }
  const p = new RaymarchPass({
    shade: SHADE_C.slice(SHADE_C.indexOf('vec3 surfaceEmit')),
    spectrum: true,
    volume: {
      density: SHADE_C.slice(0, SHADE_C.indexOf('vec3 volEmission')),
      emission: SHADE_C.slice(SHADE_C.indexOf('vec3 volEmission'), SHADE_C.indexOf('vec3 surfaceEmit')),
    },
  });
  return p;
}

function camera(shot: Shot, p: RaymarchPass, lt: number) {
  if (shot === 'a') {
    const a = 0.55 + lt * 0.22;
    p.lookAt([Math.cos(a) * 4.6, 1.15 + 0.15 * Math.sin(lt * 0.5), Math.sin(a) * 4.6], [0, -0.1, 0], 40);
  } else if (shot === 'b') {
    const k = lt / 5;
    p.lookAt([0.0 - lt * 0.12, 0.5 + 3.1 * k * k * (3 - 2 * k) + 0.3 * k, -lt * 1.5], [-0.9 - lt * 0.12, 2.35 + 0.2 * k, -lt * 1.5 - 7.0], 52);
  } else {
    const k = Math.min(lt / 6.5, 1), u = k * k * (3 - 2 * k);
    const y = 16 - 13.5 * u, z = -9 * u;
    const pitch = THREE.MathUtils.degToRad(-84 + 74 * u);
    p.lookAt([0, y, z], [0, y + Math.sin(pitch) * 20, z - Math.cos(pitch) * 20], 48, 0, 0.05, 200, [0, 1, 0]);
  }
}

export default defineScene({
  id: 'raymarch_demo',
  setup: (ctx: SceneContext) => {
    (ctx as any).__rm = build((ctx.sceneCtx.params.shot ?? 'a') as Shot);
  },
  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void => {
    const shot = (ctx.sceneCtx.params.shot ?? 'a') as Shot;
    const p: RaymarchPass = (ctx as any).__rm;
    const g = globalThis as any;
    p.setQuality((g.__rmQuality ?? ctx.sceneCtx.params.quality ?? 0) as RmQuality);
    p.setFrame(g.__rmFrame ?? 0);
    p.setTime(f.lt);
    camera(shot, p, f.lt);
    p.render(ctx.renderer, out);
    if (shot === 'a') return { bloom: 0.25, bloomThreshold: 1.2, halation: 0, ca: 0, grain: 0.03, vignette: 0.3, hud: 0 };
    if (shot === 'b') return { bloom: 0.2, bloomThreshold: 1.4, halation: 0, ca: 0, grain: 0.03, vignette: 0.25, hud: 0 };
    return { bloom: 0.3, bloomThreshold: 1.1, bloomRadius: 0.7, halation: 0.05, ca: 0, grain: 0.03, vignette: 0.3, hud: 0 };
  },
});
