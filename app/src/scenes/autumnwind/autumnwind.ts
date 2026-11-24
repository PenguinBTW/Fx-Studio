// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// autumnwind — momiji leaves spiraling through a temple garden at golden hour.
// Backdrop quad: warm dusk sky, fbm maple-canopy hills, radial god-ray shafts,
// torii gate + stone lantern silhouettes. Ground quad: raked gravel lines,
// long shadows, a pond patch with a single koi-shadow crossing. One points
// cloud carries ~200 leaves on closed-form helical descents with a global
// gust envelope, a brief leaf vortex, birds, and touchdown settling — no sim
// state, no Math.random after build.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { GLSL_NOISE } from '../../engine/glsl/noise';
import { mulberry32 } from '../../engine/util';

// shared descent law, duplicated in TS (camera guides) and GLSL.
// Gust envelope: swells t≈9→13, released by ~15.
const GROUND_Y = -3.35;

function camPos(t: number): [number, number, number] {
  const s = Math.min(1, Math.max(0, (t - 2) / 20));
  return [1.6 + 2.2 * s + 0.15 * Math.sin(t * 0.11), 0.9 - 1.6 * s, 24 - 4.5 * s];
}
function camTarget(t: number): [number, number, number] {
  const s = Math.min(1, Math.max(0, (t - 2) / 20));
  return [-0.6 + 3.6 * s, 0.4 - 2.6 * s, -6];
}

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// --- backdrop: dusk sky, canopy hills, god rays, torii, stone lantern -------
const BACK_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;

float gustEnv(float t) {
  return smoothstep(9.0, 12.5, t) * (1.0 - smoothstep(13.0, 15.5, t));
}

// canopy silhouette: returns sky color or canopy color for a given layer
vec3 canopyLayer(vec2 uv, float top, float seed, vec3 skyCol, vec3 canCol, float detail) {
  float edge = top + 0.05 * fbm3(vec3(uv.x * detail, seed, 0.7), 3, 2.0, 0.5)
             + 0.015 * fbm3(vec3(uv.x * detail * 3.1, seed + 9.0, 1.1), 3, 2.0, 0.5);
  float inC = step(uv.y, edge);
  // leaf speckle near the canopy edge for texture
  float speck = fbm3(vec3(uv.x * detail * 6.0, uv.y * 30.0, seed + 3.0), 3, 2.0, 0.5);
  canCol *= 0.85 + 0.3 * speck;
  return mix(skyCol, canCol, inC);
}

void main() {
  // golden-hour gradient: warm amber low, dusty violet high
  vec3 top = vec3(0.16, 0.12, 0.22);
  vec3 hor = vec3(0.92, 0.52, 0.22);
  vec3 col = mix(hor, top, smoothstep(0.28, 0.95, vUv.y));

  // sun glow upper-left
  vec2 sun = vec2(0.16, 0.80);
  vec2 toSun = vUv - sun;
  float dSun = length(toSun);
  col += vec3(0.55, 0.30, 0.10) * exp(-pow(dSun / 0.22, 2.0));
  col += vec3(0.30, 0.16, 0.05) * exp(-pow(dSun / 0.55, 2.0));

  // god-ray shafts radiating from the sun — fbm streaks over angle,
  // brighter during the gust (leaves catch the light)
  float ang = atan(toSun.y, toSun.x);
  float beamN = fbm3(vec3(ang * 6.0, uT * 0.05, 2.2), 3, 2.0, 0.5);
  float beam = pow(sat(beamN - 0.38) * 1.8, 1.5);
  float beamMask = smoothstep(0.02, 0.10, dSun) * exp(-dSun * 2.0)
                 * (1.0 - smoothstep(0.0, 0.45, toSun.y)); // rays point down-right
  col += vec3(0.55, 0.38, 0.14) * beam * beamMask * (0.9 + 0.8 * gustEnv(uT));

  // layered canopy hills, far → near: cool violet haze → deep autumn silhouette
  col = canopyLayer(vUv, 0.46, 4.0, col, vec3(0.42, 0.24, 0.30), 4.0);
  col = canopyLayer(vUv, 0.40, 8.0, col, vec3(0.52, 0.22, 0.12), 6.0);
  col = canopyLayer(vUv, 0.335, 2.0, col, vec3(0.30, 0.10, 0.07), 9.0);

  // torii gate silhouette (right third): kasagi + nuki lintels, twin pillars
  float gate = 0.0;
  float px = (vUv.x - 0.68) / 0.075;                    // gate centerline, ±1 span
  float py = vUv.y;
  // curved kasagi (upper lintel): upturned ends
  float kasagi = step(abs(px), 1.12)
    * step(0.545 + 0.030 * px * px, py) * step(py, 0.585 + 0.035 * px * px);
  // shimaki (thin lintel just under kasagi)
  float shimaki = step(abs(px), 1.05) * step(0.528, py) * step(py, 0.545 + 0.018 * px * px);
  // nuki (lower tie-beam) through the pillars
  float nuki = step(abs(px), 1.0) * step(0.472, py) * step(py, 0.492);
  // gakuzuka center strut between lintels
  float gaku = step(abs(px), 0.10) * step(0.492, py) * step(py, 0.545);
  // twin pillars, slight inward lean
  float lean = 0.05 * (0.49 - py);
  float pL = step(abs(px - 0.62 - lean), 0.11) * step(0.0, py) * step(py, 0.472);
  float pR = step(abs(px + 0.62 + lean), 0.11) * step(0.0, py) * step(py, 0.472);
  gate = max(max(max(kasagi, shimaki), max(nuki, gaku)), max(pL, pR));
  col = mix(col, vec3(0.24, 0.05, 0.05), min(gate, 1.0));
  // warm rim on the gate's sun side
  col += vec3(0.25, 0.10, 0.02) * min(gate, 1.0) * (1.0 - smoothstep(-0.6, 0.6, px)) * 0.4;

  // stone lantern (left-of-center): stacked silhouette rising from the
  // canopy line (base at py≈0.305 so it reads as sitting on the hill garden)
  float lx = (vUv.x - 0.30) / 0.030;
  float lyy = py - 0.305;
  float lantern = 0.0;
  lantern = max(lantern, step(abs(lx), 0.85) * step(0.0, lyy) * step(lyy, 0.020));      // base slab
  lantern = max(lantern, step(abs(lx), 0.34) * step(0.020, lyy) * step(lyy, 0.068));    // pillar
  lantern = max(lantern, step(abs(lx), 0.62) * step(0.068, lyy) * step(lyy, 0.108));    // firebox
  lantern = max(lantern, step(abs(lx), 0.80 - 0.35 * (lyy - 0.108) * 18.0) * step(0.108, lyy) * step(lyy, 0.128)); // umbrella roof
  lantern = max(lantern, step(abs(lx), 0.18) * step(0.128, lyy) * step(lyy, 0.142));    // hōju orb
  col = mix(col, vec3(0.10, 0.09, 0.10), min(lantern, 1.0));
  // lit firebox windows — two small warm rectangles flickering gently
  col += vec3(0.9, 0.45, 0.12) * min(lantern, 1.0)
       * step(abs(lx - 0.18), 0.09) * step(0.074, lyy) * step(lyy, 0.100) * (0.8 + 0.2 * sin(uT * 2.7));
  col += vec3(0.9, 0.45, 0.12) * min(lantern, 1.0)
       * step(abs(lx + 0.18), 0.09) * step(0.074, lyy) * step(lyy, 0.100) * (0.8 + 0.2 * sin(uT * 3.1 + 2.0));

  gl_FragColor = vec4(col, 1.0);
}
`;

// --- ground: raked gravel, long shadows, pond patch with koi shadow ---------
const GROUND_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
void main() {
  // vUv.y=1 at top of quad (far edge of gravel), 0 at bottom (near)
  vec3 sand = vec3(0.48, 0.37, 0.24);
  vec3 sandNear = vec3(0.37, 0.28, 0.19);
  vec3 col = mix(sandNear, sand, vUv.y);

  // raked lines: warped horizontal ridges
  float warp = fbm3(vec3(vUv.x * 6.0, vUv.y * 2.0, 1.7), 3, 2.0, 0.5);
  float rake = abs(fract(vUv.y * 14.0 + warp * 1.6) - 0.5);
  float ridge = (1.0 - smoothstep(0.02, 0.06, rake)) * 0.5 + (1.0 - smoothstep(0.30, 0.5, rake)) * 0.15;
  col *= 1.0 - ridge * 0.35;
  // gravel speckle
  float speck = fbm3(vec3(vUv.x * 40.0, vUv.y * 80.0, 4.2), 3, 2.0, 0.5);
  col *= 0.88 + 0.24 * speck;

  // long shadows cast right→left (sun upper-left): soft diagonal bands
  float shN = fbm3(vec3(vUv.x * 3.0 - vUv.y * 4.0, 1.1, 0.0), 3, 2.0, 0.5);
  col *= 1.0 - 0.22 * smoothstep(0.45, 0.75, shN) * vUv.y;
  // warm sun-wash on the left
  col += vec3(0.12, 0.07, 0.02) * (1.0 - smoothstep(0.15, 0.75, vUv.x)) * vUv.y;

  // pond patch: lower-left of the visible gravel — dark water + shimmer
  vec2 pc = vec2((vUv.x - 0.37) / 0.16, (vUv.y - 0.56) / 0.16);
  float pond = 1.0 - smoothstep(0.92, 1.0, length(pc));
  vec3 water = mix(vec3(0.02, 0.05, 0.06), vec3(0.05, 0.08, 0.09), vUv.y);
  float rip = fbm3(vec3(vUv.x * 30.0, vUv.y * 44.0 - uT * 0.4, 3.3), 3, 2.0, 0.5);
  water += vec3(0.12, 0.08, 0.03) * pow(sat(rip - 0.55) * 2.0, 2.0);
  // koi shadow: one elongated dark blob crossing the pond t≈12.5→16
  float kt = clamp((uT - 12.5) / 3.5, 0.0, 1.0);
  vec2 koi = vec2(mix(0.60, -0.60, kt), -0.10 + 0.08 * sin(uT * 1.3));
  float koiD = length(vec2((pc.x - koi.x) / 0.34, (pc.y - koi.y) / 0.11));
  float koiVis = smoothstep(0.0, 0.3, kt) * (1.0 - smoothstep(0.8, 1.0, kt));
  water *= 1.0 - 0.65 * (1.0 - smoothstep(0.5, 1.0, koiD)) * koiVis;
  col = mix(col, water, pond);

  gl_FragColor = vec4(col, 1.0);
}
`;

// --- leaf points: drifting, vortex, settled, birds ---------------------------
// attrs: aSeed, aKind (0 drift, 1 vortex, 2 settled, 3 bird),
// aAux = (t0, fallRate, helixR, phase)
const LEAF_VERT = /* glsl */ `
attribute float aSeed;
attribute float aKind;
attribute vec4 aAux;
uniform float uT;
varying float vA;
varying float vKind;
varying float vSeed;
varying float vRot;

float gustEnv(float t) {
  return smoothstep(9.0, 12.5, t) * (1.0 - smoothstep(13.0, 15.5, t));
}

void main() {
  vKind = aKind;
  vSeed = aSeed;
  vec3 pos = position;
  float alpha = 1.0;
  float size = 1.0;

  if (aKind < 2.5) {
    // ----- leaf: helical descent with gust modulation + touchdown settle
    float t0 = aAux.x;
    float fall = aAux.y;
    float R = aAux.z;
    float ph = aAux.w;
    float live = max(uT - t0, 0.0);
    float g = gustEnv(uT);
    float om = 1.1 + fract(aSeed * 5.1) * 1.2; // helix rate (per-leaf constant)

    // gust displacement: a monotone dose so a fading gust never rewinds the
    // path — leaves keep the distance the wind already carried them
    float gustDose = smoothstep(9.0, 16.5, uT) - smoothstep(9.0, 16.5, t0);
    // helices tighten as the gust accumulates (radius dose, no phase rewind)
    float gR = R * (1.0 - 0.35 * gustDose);

    // drift path: corkscrew + downwind drift, gust adds lift oscillation
    vec3 d = vec3(
      position.x - 0.28 * live - 3.0 * gustDose + gR * sin(om * live + ph),
      position.y - fall * live + 0.45 * g * sin(uT * 3.1 + ph)
                + gR * 0.35 * cos(om * live * 0.9 + ph * 1.3),
      position.z + gR * cos(om * live + ph)
    );

    // touchdown: closed-form landing time, then freeze on the gravel.
    // Landing height grades with depth — far leaves touch down near the
    // horizon edge of the painted gravel, near ones lower in frame.
    float yG = min(-2.62, -2.5 - 0.15 * (position.z + 16.0))
             - fract(aSeed * 7.7) * 0.25;
    float tLand = t0 + max(0.0, position.y - yG) / max(fall, 0.05);
    // vortex leaves stay airborne through the swirl window (t≈12.5–16.5)
    if (aKind > 0.5 && aKind < 1.5)
      tLand = max(tLand, 16.8 + fract(aSeed * 9.1) * 2.6);
    float sLand = smoothstep(0.0, 0.9, uT - tLand);
    float liveL = tLand - t0;
    float doseL = smoothstep(9.0, 16.5, tLand) - smoothstep(9.0, 16.5, t0);
    float gRL = R * (1.0 - 0.35 * doseL);
    vec3 dLand = vec3(
      position.x - 0.28 * liveL - 3.0 * doseL + gRL * sin(om * liveL + ph),
      yG,
      position.z + gRL * cos(om * liveL + ph)
    );
    pos = mix(d, dLand, sLand);
    pos.y = max(pos.y, yG);

    // vortex blend (kind 1 only): shrinking orbit over the gravel t≈12.5→16.5
    if (aKind > 0.5 && aKind < 1.5) {
      float w = smoothstep(12.5, 13.5, uT) * (1.0 - smoothstep(15.5, 16.5, uT));
      float vt = uT - 12.5;
      vec2 vc = vec2(3.2, -5.0);                       // vortex site (x, z)
      float vr = R * 0.9 * (1.0 - 0.55 * clamp(vt / 4.0, 0.0, 1.0));
      float va = ph + (2.6 + fract(aSeed * 3.3)) * vt;
      vec3 vpos = vec3(vc.x + vr * cos(va),
                       -2.6 + 0.55 * sin(va * 0.7 + ph) + 0.3 * vr,
                       vc.y + vr * sin(va));
      pos = mix(pos, vpos, w * (1.0 - sLand));
    }

    // spin while airborne, freeze at a seeded rest tilt on landing
    float airRot = (0.9 + fract(aSeed * 2.9) * 1.6) * live + ph * 3.0;
    vRot = mix(airRot, ph * 3.0 + fract(aSeed * 11.0) * 6.28, sLand);
    alpha = smoothstep(0.0, 0.4, live);
    size = 0.85 + fract(aSeed * 4.7) * 0.7;
    // settled pre-placed leaves (kind 2): start on the ground, tiny gust shiver
    if (aKind > 1.5) {
      pos = vec3(position.x + 0.05 * g * sin(uT * 7.0 + ph), position.y, position.z);
      alpha = 1.0;
      vRot = ph * 3.0 + fract(aSeed * 11.0) * 6.28;
    }
  } else {
    // ----- bird: gliding v silhouette across the calm beat t≈17→21
    float t0 = aAux.x;
    float live = max(uT - t0, 0.0);
    pos = vec3(position.x + (0.9 + 0.4 * fract(aSeed * 3.0)) * live * 4.0,
               position.y + 0.35 * sin(uT * 0.8 + aAux.w),
               position.z);
    alpha = smoothstep(0.0, 1.0, live) * (1.0 - smoothstep(6.5, 8.5, live));
    size = 1.9 + fract(aSeed * 6.0) * 0.8;
    vRot = 0.0;
  }

  vA = alpha;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = min(size * 300.0 / max(1.0, -mv.z), 40.0);
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(0.0, 0.0, -10.0, 1.0);
}
`;

const LEAF_FRAG = /* glsl */ `
${GLSL_COMMON}
varying float vA;
varying float vKind;
varying float vSeed;
varying float vRot;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  vec3 col = vec3(0.0);
  float a = 0.0;

  if (vKind < 2.5) {
    // maple leaf: 5-lobed polar silhouette, rotated by vRot
    float c = cos(vRot), s = sin(vRot);
    vec2 q = mat2(c, -s, s, c) * p;
    float r = length(q) * 2.0;
    float th = atan(q.y, q.x);
    float lobes = 0.55 + 0.45 * pow(abs(cos(th * 2.5)), 0.7);
    float leaf = step(r, lobes * 0.92);
    // stem below the blade
    float stem = step(abs(q.x), 0.03) * step(-0.62, q.y) * step(q.y, -0.30);
    leaf = max(leaf, stem);
    if (leaf < 0.5) discard;
    // autumn palette by seed: crimson → orange → gold
    float pick = fract(vSeed * 7.3);
    vec3 leafCol = pick < 0.4 ? vec3(0.62, 0.10, 0.07)
                 : pick < 0.75 ? vec3(0.80, 0.30, 0.06)
                 : vec3(0.82, 0.55, 0.10);
    // vein shading: darken along lobe creases + midrib
    float crease = 0.85 + 0.15 * cos(th * 5.0);
    leafCol *= crease * (0.85 + 0.3 * exp(-q.x * q.x / 0.0016));
    // warm rim from the sun side
    leafCol += vec3(0.18, 0.08, 0.0) * (1.0 - smoothstep(-0.4, 0.0, q.x + q.y));
    col = leafCol;
    a = vA;
  } else {
    // bird: a gull "v" — two arc strokes
    float wing = abs(p.y + 0.55 * p.x * p.x - 0.06);
    float bird = (1.0 - smoothstep(0.02, 0.05, wing)) * step(abs(p.x), 0.42);
    if (bird < 0.01) discard;
    col = vec3(0.10, 0.08, 0.10);
    a = bird * vA;
  }
  gl_FragColor = vec4(col, a);
}
`;

interface AwState {
  backMat: THREE.ShaderMaterial;
  groundMat: THREE.ShaderMaterial;
  leafMat: THREE.ShaderMaterial;
}
const awStates = new WeakMap<SceneContext, AwState>();

export default defineScene({
  id: 'autumnwind/garden',

  setup(ctx: SceneContext) {
    const sc = ctx.scene3D;
    sc.background = new THREE.Color(0x0a0710);
    const rng = mulberry32(90210);

    // --- backdrop quad: sky + canopy + torii + stone lantern + rays
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

    // --- ground quad: gravel + pond patch
    const groundMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: GROUND_FRAG,
      uniforms: { uT: { value: 0 } },
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 12), groundMat);
    ground.position.set(0, GROUND_Y - 5.2, -12);
    ground.renderOrder = 1;
    sc.add(ground);

    // --- one points cloud: drifting leaves, vortex leaves, settled, birds
    const ND = 140, NV = 32, NSET = 30, NB = 4;
    const N = ND + NV + NSET + NB;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    const kind = new Float32Array(N);
    const aux = new Float32Array(N * 4);
    let i = 0;
    const put = (x: number, y: number, z: number, k: number, s: number,
                 t0 = 0, v = 0, r = 0, ph = 0) => {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      seed[i] = s; kind[i] = k;
      aux[i * 4] = t0; aux[i * 4 + 1] = v; aux[i * 4 + 2] = r; aux[i * 4 + 3] = ph;
      i++;
    };

    // drifting leaves: spawn high across the mid/far canopy, staggered starts
    for (let l = 0; l < ND; l++) {
      const t0 = l < 12 ? 0.2 + rng() * 1.5 : 1.0 + rng() * 7.0;
      const x0 = 6 + (rng() - 0.5) * 20;      // seeded right-of-center, drift left
      const y0 = 1.5 + rng() * 7.0;
      const z0 = -4 - 14 * Math.pow(rng(), 1.2);
      // pick the touchdown first (18.5–21 s), then set the fall rate so the
      // closed-form descent lands on time — mirrors the shader's yG(z) law
      const tL = 18.5 + rng() * 2.5;
      const yGEst = Math.min(-2.62, -2.5 - 0.15 * (z0 + 16)) - 0.12;
      const fall = Math.max(0.45, (y0 - yGEst) / Math.max(tL - t0, 0.5));
      const R = 0.4 + 0.7 * rng();
      const ph = rng() * Math.PI * 2;
      put(x0, y0, z0, 0, rng() * 100, t0, fall, R, ph);
    }
    // vortex leaves: pulled toward the gravel site during the gust window
    for (let v = 0; v < NV; v++) {
      const x0 = 4 + (rng() - 0.5) * 12;
      const y0 = 0.5 + rng() * 5.0;
      const z0 = -3 - 8 * rng();
      const t0v = 0.4 + rng() * 3.0;
      // land after the swirl window but before the cut (tL ≥ 16.8 in shader)
      const tL = 19.5 + rng() * 2.0;
      const yGEst = Math.min(-2.62, -2.5 - 0.15 * (z0 + 16)) - 0.12;
      const fall = Math.max(0.45, (y0 - yGEst) / Math.max(tL - t0v, 0.5));
      const R = 0.5 + 0.6 * rng();
      const ph = rng() * Math.PI * 2;
      put(x0, y0, z0, 1, rng() * 100, t0v, fall, R, ph);
    }
    // settled leaves: resting on the gravel from frame 0 (foreground texture)
    for (let s2 = 0; s2 < NSET; s2++) {
      put(-10 + rng() * 20, GROUND_Y - 0.05 - rng() * 0.4, -1.5 - rng() * 7,
          2, rng() * 100, 0, 0, 0, rng() * Math.PI * 2);
    }
    // birds: glide across the sky during the calm beat
    for (let b = 0; b < NB; b++) {
      put(-16 - b * 2.5, 3.2 + rng() * 1.4, -20 - rng() * 4,
          3, rng() * 100, 16.5 + b * 1.4, 0, 0, rng() * 6.28);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    geo.setAttribute('aAux', new THREE.BufferAttribute(aux, 4));
    const leafMat = new THREE.ShaderMaterial({
      vertexShader: LEAF_VERT,
      fragmentShader: LEAF_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: { uT: { value: 0 } },
    });
    const leaves = new THREE.Points(geo, leafMat);
    leaves.frustumCulled = false;
    leaves.renderOrder = 2;
    sc.add(leaves);

    // --- camera: gentle drift toward the vortex site
    ctx.rig.setLensMm(55);
    const wps: { t: number; pos: [number, number, number]; target: [number, number, number] }[] = [];
    for (let w = 0; w <= 24; w++) {
      const wt = ctx.sceneCtx.start + (w / 24) * (ctx.sceneCtx.end - ctx.sceneCtx.start);
      wps.push({ t: w / 24, pos: camPos(wt), target: camTarget(wt) });
    }
    ctx.rig.setPath(wps);
    ctx.updateCamera(0, 0);

    awStates.set(ctx, { backMat, groundMat, leafMat });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t;
    const st = awStates.get(ctx)!;
    st.backMat.uniforms.uT.value = t;
    st.groundMat.uniforms.uT.value = t;
    st.leafMat.uniforms.uT.value = t;
    ctx.updateCamera(t, f.p);
    ctx.flush(out, true);
  },
});
