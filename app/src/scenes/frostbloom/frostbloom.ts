// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame } from '../../engine/scene';
import { GLSL_COMMON } from '../../engine/glsl/common';
import { GLSL_NOISE } from '../../engine/glsl/noise';
import { mulberry32 } from '../../engine/util';

function smooth01(x: number) {
  const v = Math.min(1, Math.max(0, x));
  return v * v * (3 - 2 * v);
}

// dawn envelope: deep indigo night → frost blue → peach edge-light
const DAWN = (t: number) => smooth01((t - 13) / 9);
// breath fog: swells over the pane then recedes to reveal the fuller bloom
const FOG = (t: number) => smooth01((t - 19.0) / 1.6) * (1 - smooth01((t - 21.4) / 2.0));

// camera: slow macro push across the pane, drifting toward the densest arm
function camPos(t: number): [number, number, number] {
  const s = smooth01((t - 4) / 18);
  return [0.4 - 2.2 * s + 0.15 * Math.sin(t * 0.11), -0.2 - 0.7 * s, 26 - 6.5 * s];
}
function camTarget(t: number): [number, number, number] {
  const s = smooth01((t - 4) / 18);
  return [-1.2 + 1.4 * s, -0.6 - 0.3 * s, 0];
}

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

// --- pane backdrop: cold night glass → warm dawn rim, faint glass sheen ------
const PANE_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
uniform float uDawn;
void main() {
  // night: near-black indigo, slightly deeper at the top
  vec3 night = mix(vec3(0.012, 0.015, 0.035), vec3(0.006, 0.008, 0.022), smoothstep(0.2, 1.0, vUv.y));
  // faint uneven glass sheen
  night += vec3(0.010, 0.014, 0.028) * sat(fbm3(vec3(vUv * 3.0, 1.7), 3, 2.0, 0.5));

  // dawn ambient: frost blue wash from the lower edge
  vec3 dawnCol = mix(vec3(0.035, 0.065, 0.13), vec3(0.09, 0.13, 0.19), smoothstep(0.0, 0.55, vUv.y));
  // peachy edge light crawling up from bottom-right
  vec2 sun = vec2(0.78, -0.05);
  float rim = exp(-pow(length(vUv - sun) / 0.55, 2.0));
  dawnCol += vec3(0.7, 0.34, 0.14) * rim * uDawn;

  vec3 col = mix(night, dawnCol, uDawn);
  // soft frame vignette — the pane sits inside a dark sash
  float vig = smoothstep(0.0, 0.055, vUv.x) * smoothstep(1.0, 0.945, vUv.x)
            * smoothstep(0.0, 0.075, vUv.y) * smoothstep(1.0, 0.925, vUv.y);
  col *= mix(0.25, 1.0, vig);
  // clear centre lets the bokeh ghost through the glass; sash stays opaque
  gl_FragColor = vec4(col, mix(0.78, 1.0, 1.0 - vig));
}
`;

// --- breath fog: fbm veil that swells over the crystals then recedes ---------
const FOG_FRAG = /* glsl */ `
${GLSL_COMMON}
${GLSL_NOISE}
varying vec2 vUv;
uniform float uT;
uniform float uFog;
uniform float uDawn;
void main() {
  // breath blooms from lower-centre, feathery edge
  vec2 src = vec2(0.5, 0.08);
  float r = length((vUv - src) * vec2(1.4, 1.0));
  float body = exp(-pow(r / 0.85, 2.0));
  float wisp = sat(fbm3(vec3(vUv * 5.0 + vec2(0.0, uT * 0.10), 3.0), 4, 2.0, 0.55) * 1.5 - 0.25);
  float a = body * (0.35 + 0.65 * wisp) * uFog * 0.85;
  vec3 col = mix(vec3(0.55, 0.65, 0.72), vec3(0.85, 0.72, 0.60), uDawn);
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}
`;

// --- bokeh: out-of-focus city discs behind the glass -------------------------
const BOKEH_VERT = /* glsl */ `
attribute float aSeed;    // hash: size, hue pick, twinkle rate
uniform float uT;
uniform float uDawn;
varying float vA;
varying float vHue;
void main() {
  float size = 14.0 + fract(aSeed * 13.7) * 40.0;
  vHue = fract(aSeed * 7.31);
  // city lights twinkle slowly; they melt (fade) as morning comes
  float tw = 0.7 + 0.3 * sin(uT * (0.2 + fract(aSeed * 5.0) * 0.5) + aSeed * 90.0);
  float melt = 1.0 - 0.75 * uDawn;
  vA = tw * melt;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(size * 240.0 / max(1.0, -mv.z), 90.0);
  gl_Position = projectionMatrix * mv;
}
`;
const BOKEH_FRAG = /* glsl */ `
${GLSL_COMMON}
varying float vA;
varying float vHue;
uniform float uDawn;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p) * 2.0;
  // soft out-of-focus disc: flat-ish core, feathered rim, faint ring brightening
  float disc = 1.0 - smoothstep(0.55, 1.0, d);
  float rim = exp(-pow(abs(d - 0.82) / 0.12, 2.0)) * 0.25;
  // cold palette: indigo/cyan with sparse sodium amber
  vec3 cold = mix(vec3(0.10, 0.16, 0.34), vec3(0.08, 0.28, 0.38), step(0.5, vHue));
  cold = mix(cold, vec3(0.42, 0.26, 0.10), step(0.86, vHue));
  vec3 morn = mix(vec3(0.35, 0.38, 0.42), vec3(0.5, 0.36, 0.28), step(0.86, vHue));
  vec3 col = mix(cold, morn, uDawn);
  float a = (disc * 0.55 + rim) * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col, a);
}
`;

// --- dendrites: pre-seeded skeleton, each point born at aBirth ---------------
// vertex attrs: position (on the pane), aBirth, aSeed, aWarm (edge rim factor),
// aKind (0 arm flesh, 1 tip glint, 2 seed sparkle)
const DEND_VERT = /* glsl */ `
attribute float aBirth;
attribute float aSeed;
attribute float aWarm;
attribute float aKind;
uniform float uT;
varying float vA;
varying float vWarm;
varying float vKind;
void main() {
  float age = uT - aBirth;
  float born = step(0.0, age);
  // growth-in: points pop on then settle; fresh tips carry a glint that fades
  float grow = smoothstep(0.0, 0.35, age);
  float glint = exp(-max(age, 0.0) * 2.2);
  float tw = 0.85 + 0.3 * sin(uT * (1.5 + fract(aSeed * 9.0) * 2.0) + aSeed * 60.0);
  vA = born * grow * tw;
  vWarm = aWarm;
  vKind = aKind;
  float base = (aKind > 0.5) ? 2.0 : 1.2;
  float size = base * (1.0 + glint * 2.4);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min(size * 300.0 / max(1.0, -mv.z), 14.0);
  gl_Position = projectionMatrix * mv;
}
`;
const DEND_FRAG = /* glsl */ `
${GLSL_COMMON}
varying float vA;
varying float vWarm;
varying float vKind;
uniform float uDawn;
uniform float uT;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p) * 2.0;
  float core = 1.0 - smoothstep(0.05, 1.0, d);
  // ice: pale blue-white; dawn rims edges warm where aWarm says so
  vec3 ice = vec3(0.72, 0.84, 0.95);
  vec3 dawnRim = vec3(1.0, 0.72, 0.45);
  vec3 col = mix(ice, dawnRim, vWarm * uDawn * 0.8);
  // fresh growth glints cold-bright
  col += vec3(0.25, 0.30, 0.34) * step(0.5, vKind);
  float a = core * vA;
  if (a < 0.008) discard;
  gl_FragColor = vec4(col * (0.5 + 0.4 * uDawn + 0.3), a * 0.82);
}
`;

// --- seed glints: tiny sparks at pane edges before growth starts -------------
const SEED_VERT = /* glsl */ `
attribute float aSeed;
uniform float uT;
varying float vA;
void main() {
  float tw = 0.5 + 0.5 * sin(uT * (2.0 + fract(aSeed * 11.0) * 3.0) + aSeed * 40.0);
  vA = tw * smoothstep(0.0, 2.0, uT);            // fade in after t≈2
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = min((1.5 + fract(aSeed * 3.0) * 2.0) * 300.0 / max(1.0, -mv.z), 8.0);
  gl_Position = projectionMatrix * mv;
}
`;
const SEED_FRAG = /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.1, 1.0, d)) * vA;
  if (a < 0.006) discard;
  gl_FragColor = vec4(vec3(0.85, 0.93, 1.0), a);
}
`;

interface FbState {
  paneMat: THREE.ShaderMaterial;
  fogMat: THREE.ShaderMaterial;
  bokehMat: THREE.ShaderMaterial;
  dendMat: THREE.ShaderMaterial;
  seedMat: THREE.ShaderMaterial;
}
const fbStates = new WeakMap<SceneContext, FbState>();

// --- dendrite skeleton ------------------------------------------------------
// Recursive seeded branching on the pane plane (z=0). Six-fold tendency: side
// branches leave at ±60° with jitter. Each emitted vertex carries aBirth so the
// shader reveals it f(t)-wise — no sim state.
interface SkelVert { x: number; y: number; birth: number; seed: number; warm: number; kind: number; }

function growArm(
  out: SkelVert[],
  rng: () => number,
  x: number, y: number,
  angle: number,
  len: number,
  t0: number, growDur: number,
  depth: number,
  warm: number,
) {
  const STEPS = Math.max(30, Math.round(len * 8));
  let cx = x, cy = y, a = angle;
  const segs: { x: number; y: number; s: number }[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const s = i / STEPS;
    // gentle wandering of the growth direction
    a += (rng() - 0.5) * 0.3 * (1 - s * 0.4);
    const step = len / STEPS;
    cx += Math.cos(a) * step;
    cy += Math.sin(a) * step;
    segs.push({ x: cx, y: cy, s });
    out.push({
      x: cx, y: cy,
      birth: t0 + s * growDur,
      seed: rng() * 100,
      warm,
      kind: 0,
    });
    // filigree side-branches, spaced along the arm — six-fold ±60°
    if (depth < 3 && i > 0 && i % 6 === 0 && rng() < 0.8) {
      const side = rng() < 0.5 ? -1 : 1;
      const childLen = len * (0.22 + rng() * 0.18) * (1 - s * 0.5);
      const childAng = a + side * (Math.PI / 3 + (rng() - 0.5) * 0.3);
      growArm(out, rng, cx, cy, childAng, childLen, t0 + s * growDur + 0.15, growDur * 0.35, depth + 1, warm);
    }
  }
  // tip glint point
  out.push({ x: cx, y: cy, birth: t0 + growDur, seed: rng() * 100, warm, kind: 1 });
}

function buildSkeleton(rng: () => number): SkelVert[] {
  const out: SkelVert[] = [];
  // mother arms rooted along the pane edges / corners, creeping inward
  const roots: { x: number; y: number; ang: number; t0: number; dur: number; len: number }[] = [
    { x: -15.5, y: -6.5, ang: 0.55, t0: 2.6, dur: 9.0, len: 16 },  // lower-left corner → centre
    { x: -15.8, y: 4.5, ang: -0.35, t0: 5.0, dur: 10.0, len: 13 }, // left edge
    { x: -6.0, y: -8.2, ang: 1.30, t0: 8.0, dur: 9.0, len: 12 },   // bottom edge
    { x: 5.5, y: -8.2, ang: 1.75, t0: 12.0, dur: 8.5, len: 11 },   // bottom-right
    { x: 15.6, y: -3.0, ang: 2.75, t0: 15.5, dur: 6.5, len: 9 },   // right edge, late
    { x: -8.0, y: 8.0, ang: -1.35, t0: 10.5, dur: 8.0, len: 10 },  // top edge
    { x: 15.5, y: 6.0, ang: 3.55, t0: 17.5, dur: 5.5, len: 8 },    // top-right, latest
  ];
  for (const r of roots) {
    // warmth: arms nearer the dawn corner (bottom-right) rim more strongly
    const w = Math.min(1, Math.max(0, (r.x + 15) / 30 * 0.6 + (8 - r.y) / 16 * 0.4));
    growArm(out, rng, r.x, r.y, r.ang, r.len, r.t0, r.dur, 0, w);
  }
  return out;
}

export default defineScene({
  id: 'frostbloom/pane',

  setup(ctx: SceneContext) {
    const sc = ctx.scene3D;
    sc.background = new THREE.Color(0x04050d);
    const rng = mulberry32(90417);

    // --- bokeh backdrop: hash-seeded out-of-focus city lights behind the pane
    const NB = 46;
    const bp = new Float32Array(NB * 3);
    const bs = new Float32Array(NB);
    for (let i = 0; i < NB; i++) {
      bp[i * 3] = -22 + rng() * 44;
      bp[i * 3 + 1] = -9 + rng() * 16;
      bp[i * 3 + 2] = -14 - rng() * 6;
      bs[i] = rng() * 100;
    }
    const bokehGeo = new THREE.BufferGeometry();
    bokehGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    bokehGeo.setAttribute('aSeed', new THREE.BufferAttribute(bs, 1));
    const bokehMat = new THREE.ShaderMaterial({
      vertexShader: BOKEH_VERT,
      fragmentShader: BOKEH_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: { uT: { value: 0 }, uDawn: { value: 0 } },
    });
    const bokeh = new THREE.Points(bokehGeo, bokehMat);
    bokeh.frustumCulled = false;
    bokeh.renderOrder = 0;
    sc.add(bokeh);

    // --- pane glass backdrop
    const paneMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: PANE_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: { uT: { value: 0 }, uDawn: { value: 0 } },
    });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(34, 18.6), paneMat);
    pane.position.set(0, 0, -0.5);
    pane.renderOrder = 1;
    sc.add(pane);

    // --- seed glints at the edges (pre-growth sparkle)
    const NS2 = 26;
    const gp = new Float32Array(NS2 * 3);
    const gs = new Float32Array(NS2);
    for (let i = 0; i < NS2; i++) {
      // hug the frame edges
      const edge = i % 4;
      const x = edge === 0 ? -15.5 + rng() * 1.4 : edge === 1 ? 14.2 + rng() * 1.4 : -14 + rng() * 28;
      const y = edge === 2 ? -8.0 + rng() * 1.2 : edge === 3 ? 6.9 + rng() * 1.2 : -7.6 + rng() * 15;
      gp[i * 3] = x; gp[i * 3 + 1] = y; gp[i * 3 + 2] = 0.05;
      gs[i] = rng() * 100;
    }
    const seedGeo = new THREE.BufferGeometry();
    seedGeo.setAttribute('position', new THREE.BufferAttribute(gp, 3));
    seedGeo.setAttribute('aSeed', new THREE.BufferAttribute(gs, 1));
    const seedMat = new THREE.ShaderMaterial({
      vertexShader: SEED_VERT,
      fragmentShader: SEED_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 } },
    });
    const seeds = new THREE.Points(seedGeo, seedMat);
    seeds.frustumCulled = false;
    seeds.renderOrder = 3;
    sc.add(seeds);

    // --- dendrite skeleton (seeded, static geometry, revealed by aBirth)
    const skel = buildSkeleton(rng);
    const n = skel.length;
    const dp = new Float32Array(n * 3);
    const db = new Float32Array(n);
    const dsd = new Float32Array(n);
    const dw = new Float32Array(n);
    const dk = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = skel[i]!;
      dp[i * 3] = v.x; dp[i * 3 + 1] = v.y; dp[i * 3 + 2] = 0;
      db[i] = v.birth; dsd[i] = v.seed; dw[i] = v.warm; dk[i] = v.kind;
    }
    const dendGeo = new THREE.BufferGeometry();
    dendGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    dendGeo.setAttribute('aBirth', new THREE.BufferAttribute(db, 1));
    dendGeo.setAttribute('aSeed', new THREE.BufferAttribute(dsd, 1));
    dendGeo.setAttribute('aWarm', new THREE.BufferAttribute(dw, 1));
    dendGeo.setAttribute('aKind', new THREE.BufferAttribute(dk, 1));
    const dendMat = new THREE.ShaderMaterial({
      vertexShader: DEND_VERT,
      fragmentShader: DEND_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uDawn: { value: 0 } },
    });
    const dend = new THREE.Points(dendGeo, dendMat);
    dend.frustumCulled = false;
    dend.renderOrder = 4;
    sc.add(dend);

    // --- breath fog veil
    const fogMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: FOG_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: { uT: { value: 0 }, uFog: { value: 0 }, uDawn: { value: 0 } },
    });
    const fog = new THREE.Mesh(new THREE.PlaneGeometry(34, 18.6), fogMat);
    fog.position.set(0, 0, 0.4);
    fog.renderOrder = 6;
    sc.add(fog);

    // --- camera: slow macro push, waypoints keyed to this entry's window
    ctx.rig.setLensMm(52);
    const wps: { t: number; pos: [number, number, number]; target: [number, number, number] }[] = [];
    for (let i = 0; i <= 24; i++) {
      const wt = ctx.sceneCtx.start + (i / 24) * (ctx.sceneCtx.end - ctx.sceneCtx.start);
      wps.push({ t: i / 24, pos: camPos(wt), target: camTarget(wt) });
    }
    ctx.rig.setPath(wps);
    ctx.updateCamera(0, 0);

    fbStates.set(ctx, { paneMat, fogMat, bokehMat, dendMat, seedMat });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t;
    const S = fbStates.get(ctx)!;
    const dawn = DAWN(t);
    S.paneMat.uniforms.uT.value = t;
    S.paneMat.uniforms.uDawn.value = dawn;
    S.fogMat.uniforms.uT.value = t;
    S.fogMat.uniforms.uFog.value = FOG(t);
    S.fogMat.uniforms.uDawn.value = dawn;
    S.bokehMat.uniforms.uT.value = t;
    S.bokehMat.uniforms.uDawn.value = dawn;
    S.dendMat.uniforms.uT.value = t;
    S.dendMat.uniforms.uDawn.value = dawn;
    S.seedMat.uniforms.uT.value = t;

    ctx.updateCamera(t, f.p);
    ctx.flush(out, true);
  },
});
