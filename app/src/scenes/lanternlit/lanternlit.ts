// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// lanternlit — a night river-lantern release (Loy Krathong mood). Indigo dusk
// valley, arched footbridge + tiered shore platforms in silhouette, ~40 paper
// lanterns rising on seeded bobbing paths with stretch-smeared reflections in
// the river, drifting krathong lights near the bank, and a final close lantern
// crossing with a bloom flare. Everything is closed-form f(t): positions are
// evaluated in the vertex shader from per-vertex seed attributes — no sim
// state, no Math.random after build.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { GLSL_NOISE } from '../../engine/glsl/noise';
import { mulberry32 } from '../../engine/util';

const smooth01 = (x: number) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};

// shared lantern position law, duplicated in TS (camera guides) and GLSL.
// t0 lift-off, v ascent rate, sway = sinusoidal bob + slow downwind drift.
const WATER_Y = -4.0;

// camera: slow pan following the cluster's ascent, gentle rise + push
function camPos(t: number): [number, number, number] {
  const s = Math.min(1, Math.max(0, (t - 1.5) / 19));
  return [-2.4 + 3.4 * s + 0.2 * Math.sin(t * 0.09), -1.5 + 0.7 * s, 25 - 4.0 * s];
}
function camTarget(t: number): [number, number, number] {
  const s = Math.min(1, Math.max(0, (t - 1.5) / 19));
  return [-0.4 + 1.6 * s, 0.2 + 1.6 * s, -6];
}

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// --- backdrop: dusk sky + silhouette ridge, bridge and tiered platforms -----
const BACK_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
void main() {
  // dusk gradient: rose horizon melting into indigo
  vec3 top = vec3(0.016, 0.022, 0.075);
  vec3 hor = vec3(0.34, 0.13, 0.17);
  vec3 col = mix(hor, top, smoothstep(0.30, 0.78, vUv.y));
  // faint dusk band glow along the horizon
  float band = (vUv.y - 0.42) / 0.09;
  col += vec3(0.10, 0.05, 0.03) * exp(-band * band);

  // far ridge silhouette (fbm hills)
  float ridge = 0.335 + 0.065 * fbm3(vec3(vUv.x * 5.0, 0.0, 1.3), 3, 2.0, 0.5)
                      + 0.02 * fbm3(vec3(vUv.x * 14.0, 4.7, 2.9), 3, 2.0, 0.5);
  float ground = step(vUv.y, ridge);
  // tiered shore platforms: stepped dark masses at both banks
  float bankL = step(vUv.x, 0.16) + step(vUv.x, 0.24) * 0.5;
  float bankR = step(0.84, vUv.x) + step(0.76, vUv.x) * 0.5;
  float tiers = max(bankL, bankR);
  float tierTop = 0.32 + 0.05 * floor(tiers * 2.999);
  ground = max(ground, step(vUv.y, tierTop) * step(0.5, tiers));
  // arched footbridge: carve a sky gap beneath the deck so the arch + end
  // piers read against the dusk gradient, then lay deck + railing on top
  float bx = (vUv.x - 0.5) / 0.17;                      // bridge spans ±0.17 uv
  float deckTop = 0.435 + 0.018 * (1.0 - bx * bx);
  // masonry arch: opening apex nearly touches the deck at crown, pinching
  // shut toward the springlines — silhouette survives only above it
  float archTop = 0.385 - 0.12 * bx * bx;
  float carve = step(abs(bx), 0.85) * step(0.24, vUv.y) * step(vUv.y, archTop);
  float deckBand = step(abs(bx), 1.0)
    * step(archTop, vUv.y) * step(vUv.y, deckTop);
  float piers = step(abs(bx), 1.0) * step(0.82, abs(bx))
    * step(0.24, vUv.y) * step(vUv.y, archTop);
  // railing: sparse thin posts + a continuous slim handrail
  float posts = step(abs(bx), 1.0)
    * step(deckTop, vUv.y) * step(vUv.y, deckTop + 0.016)
    * step(0.68, fract(bx * 9.0 + 0.5));
  float railLine = step(abs(bx), 1.0)
    * step(deckTop + 0.016, vUv.y) * step(vUv.y, deckTop + 0.021);
  float rails = posts + railLine;
  float sil = max(ground * (1.0 - carve), max(deckBand, piers)) + rails;
  sil = min(sil, 1.0);
  col = mix(col, vec3(0.008, 0.010, 0.028), sil);
  gl_FragColor = vec4(col, 1.0);
}
`;

// --- river: dark water + ripple shimmer --------------------------------------
const RIVER_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
void main() {
  // vUv.y=1 at waterline (top of quad), 0 at bottom of frame
  vec3 deep = vec3(0.010, 0.016, 0.045);
  vec3 near = vec3(0.020, 0.030, 0.070);
  vec3 col = mix(near, deep, vUv.y);
  // horizontal ripple shimmer, brighter near the light sources above
  float rip = fbm3(vec3(vUv.x * 24.0, vUv.y * 60.0 - uT * 0.35, 3.1), 3, 2.0, 0.5);
  float glint = pow(sat(rip - 0.52) * 2.4, 2.0);
  col += vec3(0.06, 0.07, 0.10) * glint * (0.35 + 0.65 * vUv.y);
  // warm residue where lantern light pools near the waterline
  float res = (vUv.y - 0.97) / 0.10;
  col += vec3(0.10, 0.05, 0.02) * exp(-res * res) * (0.5 + 0.5 * rip);
  gl_FragColor = vec4(col, 1.0);
}
`;

// --- flame points: lanterns, reflections, krathongs, stars, close pass -------
// attrs: aSeed (hash), aKind (0 lantern, 1 reflection, 2 krathong, 3 star,
// 4 close lantern), aAux = (t0, v, swayA, phase/drift)
const FLAME_VERT = /* glsl */ `
attribute float aSeed;
attribute float aKind;
attribute vec4 aAux;
uniform float uT;
varying float vA;
varying float vKind;
varying float vSeed;
varying float vHalo;

vec3 lanternPos(vec4 aux, float t) {
  float lift = t - aux.x;                    // seconds since lift-off
  float up = max(lift, 0.0);
  float y = -3.6 + aux.y * up;               // ascent
  float x = position.x + aAux.z * sin(t * (0.5 + fract(aSeed * 3.7)) + aAux.w)
          + (t - 12.0) * 0.22;               // bob + shared downwind drift
  return vec3(x, y, position.z);
}

void main() {
  vKind = aKind;
  vSeed = aSeed;
  vHalo = 0.0;
  vec3 pos = position;
  float alpha = 1.0;
  float size = 1.0;

  if (aKind < 0.5 || aKind == 4.0) {
    // lantern (kind 0) or close-pass lantern (kind 4)
    vec3 lp = lanternPos(aAux, uT);
    float lift = uT - aAux.x;
    if (aKind == 4.0) {
      // finale: one large lantern crossing close, lower and slower
      lp = vec3(position.x + (uT - aAux.x) * 1.5, -1.6 + 0.35 * (uT - aAux.x), 10.0);
    }
    pos = lp;
    float lit = smoothstep(0.0, 0.8, lift);           // candle catches
    float fade = 1.0 - smoothstep(13.0, 20.0, lift);  // thins into stars
    alpha = lit * fade;
    if (aKind == 4.0) alpha = smoothstep(0.0, 1.2, lift) * (1.0 - smoothstep(6.5, 8.5, lift));
    float flick = 0.85 + 0.15 * sin(uT * (3.0 + fract(aSeed * 7.0) * 3.0) + aSeed * 80.0);
    alpha *= flick;
    size = (aKind == 4.0) ? 10.0 : (2.2 + fract(aSeed * 5.3) * 1.4);
    // shrink + brighten as it climbs (perspective-ish feel)
    size *= 1.0 - 0.35 * smoothstep(0.0, 14.0, lift);
    vHalo = (aKind == 4.0) ? smoothstep(3.0, 5.5, lift) : 0.0;
  } else if (aKind < 1.5) {
    // reflection: mirror about the waterline, wobble-synced to the lantern bob
    vec3 lp = lanternPos(aAux, uT);
    float lift = uT - aAux.x;
    pos = vec3(lp.x + 0.18 * sin(uT * 1.7 + aSeed * 50.0),
               -4.0 - (lp.y + 4.0) * 0.20 - 0.2,
               -13.0); // pin to just in front of the river quad — farther lanterns' reflections must not depth-test behind it
    alpha = smoothstep(0.0, 0.8, lift) * (1.0 - smoothstep(10.0, 16.0, lift)) * 0.9;
    alpha *= 0.8 + 0.2 * sin(uT * (2.4 + fract(aSeed * 7.0) * 3.0) + aSeed * 80.0);
    size = 1.7 + fract(aSeed * 5.3) * 1.1;
  } else if (aKind < 2.5) {
    // krathong: drifting light skimming the near bank
    pos = vec3(position.x + mod(uT * (0.25 + fract(aSeed * 4.1) * 0.2) + aSeed * 30.0, 34.0) - 17.0,
               position.y + 0.06 * sin(uT * 0.9 + aSeed * 70.0),
               position.z);
    alpha = 0.75 + 0.2 * sin(uT * (2.0 + fract(aSeed * 6.0)) + aSeed * 40.0);
    size = 0.55 + fract(aSeed * 3.3) * 0.3;
  } else {
    // star
    alpha = 0.5 + 0.5 * sin(uT * (0.5 + fract(aSeed * 8.0) * 0.8) + aSeed * 120.0);
    size = 0.5 + fract(aSeed * 2.7) * 0.6;
  }

  vA = alpha;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = min(size * 320.0 / max(1.0, -mv.z), (aKind == 4.0) ? 620.0 : 44.0);
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(0.0, 0.0, -10.0, 1.0); // cull dead sprites
}
`;

const FLAME_FRAG = /* glsl */ `
${GLSL_COMMON}
varying float vA;
varying float vKind;
varying float vSeed;
varying float vHalo;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  vec3 col;
  float a;
  if (vKind == 4.0) {
    // close lantern: bright candle core, paper shell, wide bloom halo
    float d = length(p) * 2.0;
    float core = exp(-pow(d / 0.16, 2.0));
    float shell = exp(-pow(d / 0.55, 2.0)) * 0.8;
    float halo = exp(-pow(d / 0.62, 2.0)) * (0.22 + vHalo * 0.3);
    col = vec3(1.0, 0.62, 0.30) * core + vec3(0.95, 0.45, 0.18) * shell + vec3(0.6, 0.3, 0.12) * halo;
    a = sat(core + shell + halo) * vA;
  } else if (vKind < 0.5) {
    // distant lantern: soft warm disc — candle core + paper gradient
    float d = length(p) * 2.0;
    float core = exp(-pow(d / 0.30, 2.0));
    float shell = exp(-pow(d / 0.95, 2.0)) * 0.55;
    col = vec3(1.0, 0.66, 0.34) * core + vec3(0.9, 0.42, 0.16) * shell;
    a = sat(core + shell) * vA;
  } else if (vKind < 1.5) {
    // reflection: vertically stretched, downward-fading smear
    float d = length(vec2(p.x * 2.6, p.y * 0.42)) * 2.0;
    float streak = exp(-pow(d / 0.8, 2.0)) * (1.0 - smoothstep(-0.1, 0.5, p.y));
    col = vec3(0.95, 0.5, 0.2) * streak;
    a = streak * vA;
  } else if (vKind < 2.5) {
    // krathong: small warm point
    float d = length(p) * 2.0;
    float dot = exp(-pow(d / 0.45, 2.0));
    col = vec3(1.0, 0.58, 0.26) * dot;
    a = dot * vA;
  } else {
    // star
    float d = length(p) * 2.0;
    float dot = exp(-pow(d / 0.5, 2.0));
    col = mix(vec3(0.6, 0.7, 0.95), vec3(0.95, 0.9, 0.8), step(0.7, fract(vSeed * 3.3))) * dot;
    a = dot * vA;
  }
  if (a < 0.006) discard;
  gl_FragColor = vec4(col, a);
}
`;

interface LlState {
  backMat: THREE.ShaderMaterial;
  riverMat: THREE.ShaderMaterial;
  flameMat: THREE.ShaderMaterial;
}
const llStates = new WeakMap<SceneContext, LlState>();

export default defineScene({
  id: 'lanternlit/river',

  setup(ctx: SceneContext) {
    const sc = ctx.scene3D;
    sc.background = new THREE.Color(0x02030c);
    const rng = mulberry32(66021);

    // --- far backdrop quad: sky + ridge + bridge + platforms
    const backMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: BACK_FRAG,
      depthWrite: false,
      uniforms: { uT: { value: 0 } },
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(90, 42), backMat);
    back.position.set(0, 2, -32);
    back.renderOrder = 0;
    sc.add(back);

    // --- river quad covering the lower frame
    const riverMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: RIVER_FRAG,
      uniforms: { uT: { value: 0 } },
    });
    const river = new THREE.Mesh(new THREE.PlaneGeometry(90, 12), riverMat);
    river.position.set(0, WATER_Y - 5.2, -14);
    river.renderOrder = 1;
    sc.add(river);

    // --- one points cloud: stars, krathongs, lanterns, reflections, close pass
    const NL = 40, NK = 14, NS = 110;
    const N = NS + NK + NL * 2 + 1;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    const kind = new Float32Array(N);
    const aux = new Float32Array(N * 4);
    let i = 0;
    const put = (x: number, y: number, z: number, k: number, s: number,
                 t0 = 0, v = 0, sway = 0, ph = 0) => {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      seed[i] = s; kind[i] = k;
      aux[i * 4] = t0; aux[i * 4 + 1] = v; aux[i * 4 + 2] = sway; aux[i * 4 + 3] = ph;
      i++;
    };

    // stars across the upper sky
    for (let s = 0; s < NS; s++) {
      put(-30 + rng() * 60, 2.5 + Math.pow(rng(), 0.8) * 16, -28 - rng() * 3,
          3, rng() * 100);
    }
    // krathongs: small lights skimming the near bank, drifting downstream
    for (let k = 0; k < NK; k++) {
      put(-16 + rng() * 6, WATER_Y - 0.9 - rng() * 2.2, -8 - rng() * 3,
          2, rng() * 100);
    }
    // lanterns: staggered lift-offs — sparse early, dense mid-release,
    // a straggler tail; denser near-bank spread, sparse deep
    for (let l = 0; l < NL; l++) {
      const u = l / NL;
      const t0 = u < 0.15 ? 0.5 + 2.0 * rng()
        : u < 0.78 ? 2.5 + 8.5 * rng()
        : 11.0 + 3.0 * rng();
      const x0 = (rng() - 0.5) * 26 + (rng() - 0.5) * 5;
      const z0 = -4 - 18 * Math.pow(rng(), 1.3);
      const v = 0.75 + 0.65 * rng();
      const sway = 0.3 + 0.55 * rng();
      const ph = rng() * Math.PI * 2;
      const sd = rng() * 100;
      put(x0, 0, z0, 0, sd, t0, v, sway, ph);      // lantern
      put(x0, 0, z0, 1, sd, t0, v, sway, ph);      // its reflection
    }
    // the close-pass lantern (finale): seeded path crossing near camera
    put(-8, 0, 10, 4, 42.7, 17.2, 0, 0, 0);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    geo.setAttribute('aAux', new THREE.BufferAttribute(aux, 4));
    const flameMat = new THREE.ShaderMaterial({
      vertexShader: FLAME_VERT,
      fragmentShader: FLAME_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 } },
    });
    const flames = new THREE.Points(geo, flameMat);
    flames.frustumCulled = false;
    flames.renderOrder = 2;
    sc.add(flames);

    // --- camera: slow pan following the ascent
    ctx.rig.setLensMm(58);
    const wps: { t: number; pos: [number, number, number]; target: [number, number, number] }[] = [];
    for (let w = 0; w <= 24; w++) {
      const wt = ctx.sceneCtx.start + (w / 24) * (ctx.sceneCtx.end - ctx.sceneCtx.start);
      wps.push({ t: w / 24, pos: camPos(wt), target: camTarget(wt) });
    }
    ctx.rig.setPath(wps);
    ctx.updateCamera(0, 0);

    llStates.set(ctx, { backMat, riverMat, flameMat });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t;
    const S = llStates.get(ctx)!;
    S.backMat.uniforms.uT.value = t;
    S.riverMat.uniforms.uT.value = t;
    S.flameMat.uniforms.uT.value = t;
    ctx.updateCamera(t, f.p);
    ctx.flush(out, true);
  },
});
