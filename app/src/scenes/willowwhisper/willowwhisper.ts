// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from "three";
import { defineScene, type SceneContext } from "../../engine/dsl";

// ---------------------------------------------------------------------------
// willowwhisper — a massive willow veiling a river bend at dusk. Strand
// curtain over black-green water, kingfisher perch→dive→return, ducks with
// gated wakes, moorhen at the roots, a bat pass as the light fades.
// All motion is closed-form f(t); silhouettes are flat shapes at z ≈ -2 seen
// by a near-static low camera.
// ---------------------------------------------------------------------------

const DUR = 24.0;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const sstep = (a: number, b: number, v: number) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };
const mix = (a: number, b: number, u: number) => a + (b - a) * u;
const sCurve = (u: number) => u * u * (3 - 2 * u);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// beat anchors
const DUCKS = { t0: 5.2, t1: 10.5 };
const KING = { arrive: 9.2, perch: 9.6, dive: 12.0, hit: 12.5, rise: 13.0, back: 13.5, gulp: 14.3 };
const BAT = { t0: 15.5, t1: 17.6 };
const FISH_T = 8.4;                  // far-right jump
const MOOR_T0 = 18.5;                // moorhen active from here
const LEAVES = [3.8, 7.6, 13.8, 19.4]; // leaf detach times
const DRIP_X = 0.4;                  // strand tip that drips

// waterline — bank silhouette above, water below
const bankY = (x: number) => 0.06 + 0.02 * Math.sin(x * 2.3 + 1.1) + 0.015 * Math.sin(x * 5.1);

// ---------------------------------------------------------------------------
// geometry helpers — flat ribbons/polygons in the z=-2 picture plane
// ---------------------------------------------------------------------------

function poly(pos: number[], col: number[], verts: number[][], c: number[]) {
  for (let i = 1; i < verts.length - 1; i++) {
    pos.push(verts[0][0], verts[0][1], -2.0, verts[i][0], verts[i][1], -2.0, verts[i + 1][0], verts[i + 1][1], -2.0);
    for (let k = 0; k < 3; k++) col.push(...c);
  }
}

// tapered ribbon along points — perimeter order (no bowtie)
function ribbon(pos: number[], col: number[], pts: number[][], w0: number, w1: number, c: number[]) {
  for (let i = 0; i < pts.length - 1; i++) {
    const t0 = i / (pts.length - 1), t1 = (i + 1) / (pts.length - 1);
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const wa = mix(w0, w1, t0) / 2, wb = mix(w0, w1, t1) / 2;
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const A: number[][] = [
      [ax + nx * wa, ay + ny * wa], [ax - nx * wa, ay - ny * wa],
      [bx + nx * wb, by + ny * wb], [bx - nx * wb, by - ny * wb]
    ];
    poly(pos, col, [A[0], A[1], A[3], A[2]], c);
  }
}

// hanging strand: ribbon from (tx,ty) down length L with a slight bow
function strand(pos: number[], col: number[], flex: number[], ph: number[],
  tx: number, ty: number, L: number, bow: number, w: number, c: number[], phase: number) {
  const S = 4;
  const pts: number[][] = [];
  for (let i = 0; i <= S; i++) {
    const u = i / S;
    pts.push([tx + bow * u * u, ty - L * u]);
  }
  // same ribbon code but records flex/phase per vertex
  for (let i = 0; i < S; i++) {
    const t0 = i / S, t1 = (i + 1) / S;
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    const wa = w * (1 - t0 * 0.75) / 2, wb = w * (1 - t1 * 0.75) / 2;
    const V = [
      [ax + nx * wa, ay + ny * wa, t0], [ax - nx * wa, ay - ny * wa, t0],
      [bx - nx * wb, by - ny * wb, t1], [bx + nx * wb, by + ny * wb, t1]
    ];
    for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3]]) {
      for (const k of [i0, i1, i2]) {
        pos.push(V[k]![0], V[k]![1], -2.0);
        col.push(...c);
        flex.push(V[k]![2]);
        ph.push(phase);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// shaders
// ---------------------------------------------------------------------------

const BACK_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// dusk river bend: dim teal sky, apricot remnant at the hedge line, dark
// hedge silhouette, water with drifting streaks + last-light lane + rings.
// q-space = world × (10/12.5, 7/7.5) on a 12.5×7.5 plane.
const BACK_FRAG = /* glsl */ `
precision mediump float;
varying vec2 vUv;
uniform float uT;
uniform vec2 uRing0;   // [t0, x] kingfisher splash
uniform vec2 uRing1;   // [t0, x] strand drip (t0 updated per frame)
uniform vec2 uRing2;   // [t0, x] fish jump
uniform vec2 uRing3;   // [t0, x] latest leaf landing
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec2 q = (vUv - 0.5) * vec2(10.0, 7.0);
  // dusk sky — deep teal overhead, faint apricot remnant low
  vec3 col = mix(vec3(0.055, 0.085, 0.08), vec3(0.028, 0.05, 0.055), smoothstep(0.6, 3.4, q.y));
  float dusk = clamp(1.0 - uT / 24.0 * 0.55, 0.0, 1.0);       // light fades
  col += vec3(0.11, 0.055, 0.02) * dusk * (1.0 - smoothstep(0.0, 1.1, q.y)) * smoothstep(-0.4, 0.5, q.y);
  // willow canopy mass — dark ragged band filling the top third
  float canTop = 1.35 + 0.28 * sin(q.x * 1.9 + 0.7) + 0.14 * sin(q.x * 4.3 + 2.2) + 0.4 * smoothstep(2.0, 3.5, -q.x);
  float inCan = smoothstep(canTop - 0.12, canTop + 0.18, q.y);
  vec3 canCol = vec3(0.035, 0.075, 0.045) * (0.8 + 0.4 * hash21(floor(q * vec2(6.0, 8.0))));
  // last light on canopy tips — gold flecks right under the canopy edge
  float tip = inCan * (1.0 - smoothstep(0.0, 0.35, q.y - (canTop - 0.35)));
  float g = step(0.82, hash21(floor(q * vec2(14.0, 18.0)))) * tip;
  canCol += vec3(0.45, 0.34, 0.10) * g * dusk;
  col = mix(col, canCol, inCan);
  // far hedge silhouette — lumpy dark band at the bank line
  float hedge = 0.55 + 0.10 * sin(q.x * 1.4 + 0.5) + 0.06 * sin(q.x * 3.7 + 1.9);
  float inHedge = smoothstep(hedge - 0.06, hedge + 0.04, q.y) * (1.0 - smoothstep(0.9, 1.5, q.y));
  inHedge *= (1.0 - inCan);                                  // canopy covers it
  col = mix(col, vec3(0.03, 0.05, 0.04), inHedge * 0.9);
  // water — black-green with horizontal drift streaks, mirror darker
  float bank = 0.06 + 0.02 * sin(q.x * 2.3 + 1.1) + 0.015 * sin(q.x * 5.1);
  float inWater = 1.0 - smoothstep(bank - 0.015, bank + 0.03, q.y);
  vec3 water = mix(vec3(0.012, 0.045, 0.035), vec3(0.03, 0.075, 0.055), 0.5 + 0.5 * sin(q.y * 2.0));
  // current streaks drifting left→right
  float streak = sin(q.y * 26.0 + q.x * 3.0 - uT * 0.55 + sin(q.x * 2.0 + uT * 0.2) * 1.5);
  float streakCell = step(0.35, hash21(floor(q * vec2(1.2, 8.0))));
  water += vec3(0.018, 0.026, 0.020) * smoothstep(0.90, 1.0, streak) * streakCell * (0.4 + 0.6 * dusk);
  // streaked canopy reflection — vertical smear under the canopy mass,
  // strongest just below the bankline and weighted toward the canopy side
  float canRefl = smoothstep(-1.6, -0.05, q.y) * (0.55 + 0.45 * (1.0 - smoothstep(-0.5, 2.0, q.x)));
  water += vec3(0.02, 0.05, 0.03) * canRefl * (0.5 + 0.5 * sin(q.x * 9.0 + sin(q.y * 30.0) * 2.0));
  // last-light gold lane on the water, fading with the dusk
  float lane = (1.0 - smoothstep(0.6, 1.6, abs(q.x - 1.3))) * smoothstep(-2.6, -0.2, q.y);
  water += vec3(0.18, 0.11, 0.04) * lane * dusk * (0.30 + 0.15 * sin(q.y * 40.0 + uT * 0.8));
  // ripple rings — splash, drip, fish, leaf (ages clamped, gated)
  for (int i = 0; i < 4; i++) {
    float t0 = i == 0 ? uRing0.x : i == 1 ? uRing1.x : i == 2 ? uRing2.x : uRing3.x;
    // uniforms carry world-x of the life plane (z=-2); the back plane sits
    // at z=-4, so q-space = world * (dBack/dLife) * (qSpan/planeSpan)
    float cxx = (i == 0 ? uRing0.y : i == 1 ? uRing1.y : i == 2 ? uRing2.y : uRing3.y) * 1.049;
    float age = max(0.0, uT - t0);
    float rr = age * (i == 0 ? 0.55 : 0.30);
    float dd = distance(q, vec2(cxx, -0.115));
    float wdt = max(0.01, 0.03 + 0.045 * age);
    float ring = 1.0 - smoothstep(0.0, wdt, abs(dd - rr));
    float amp = (i == 0 ? 0.5 : 0.22) * exp(-age * 0.85) * step(0.001, age);
    water += vec3(0.20, 0.24, 0.18) * ring * amp;
  }
  col = mix(col, water, inWater);
  // wet sheen on the bank line
  col += vec3(0.05, 0.06, 0.04) * (1.0 - inWater) * (1.0 - smoothstep(0.0, 0.05, abs(q.y - bank)));
  gl_FragColor = vec4(col, 1.0);
}`;

// silhouette material — vertex colour, tiny wobble so nothing reads frozen
const LIFE_VERT = /* glsl */ `
uniform float uT;
uniform float uWob;
varying vec3 vC;
void main() {
  vC = color;
  vec3 p = position;
  p.y += uWob * 0.004 * sin(uT * 9.0 + p.x * 20.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const LIFE_FRAG = /* glsl */ `
precision mediump float;
uniform float uA;
varying vec3 vC;
void main() { gl_FragColor = vec4(vC, uA); }`;

// willow strands — per-vertex flex (0 root → 1 tip) and phase group;
// three sway phases + a slow gust envelope
const STRAND_VERT = /* glsl */ `
uniform float uT;
uniform float uAmp;
attribute float aFlex;
attribute float aPh;
varying vec3 vC;
void main() {
  vC = color;
  vec3 p = position;
  float gust = 0.7 + 0.3 * sin(uT * 0.23 + aPh * 0.4);
  float s = sin(uT * 1.05 + aPh + p.y * 0.8) + 0.45 * sin(uT * 1.9 + aPh * 1.7 + p.y * 1.9);
  p.x += uAmp * gust * s * 0.06 * aFlex;
  p.y += uAmp * sin(uT * 1.4 + aPh + p.x * 2.0) * 0.015 * aFlex;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const STRAND_FRAG = LIFE_FRAG;

// duck wake — flat V ribbon, fragment fades where the duck hasn't passed
const WAKE_VERT = /* glsl */ `
varying vec3 vC;
varying vec2 vP;
void main() {
  vC = color; vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const WAKE_FRAG = /* glsl */ `
precision mediump float;
uniform float uA;
uniform float uDx;   // duck head x — wake only behind it
varying vec3 vC;
varying vec2 vP;
void main() {
  float behind = 1.0 - smoothstep(0.0, 0.15, vP.x - uDx);
  float fade = smoothstep(-1.9, -0.1, vP.x - uDx);   // dissipates astern
  gl_FragColor = vec4(vC, uA * behind * fade);
}`;

// ---------------------------------------------------------------------------
// scene
// ---------------------------------------------------------------------------

interface St {
  back: THREE.ShaderMaterial; strandMat: THREE.ShaderMaterial; lifeMat: THREE.ShaderMaterial;
  dragger: THREE.Mesh; draggerMat: THREE.ShaderMaterial; wake: THREE.Mesh;
  ducks: THREE.Group[]; wakeMats: THREE.ShaderMaterial[];
  king: THREE.Group; kingWing: THREE.Mesh; glint: THREE.Mesh;
  moorhen: THREE.Mesh; bat: THREE.Mesh; batMat: THREE.ShaderMaterial;
  leaves: THREE.Mesh[]; leafMats: THREE.ShaderMaterial[];
  fish: THREE.Mesh; fishMat: THREE.ShaderMaterial;
  splash: THREE.Points; splashMat: THREE.ShaderMaterial;
}
const STATE = new WeakMap<object, St>();

// closed-form kingfisher perch position + body pitch along its arc
function kingPos(t: number): { x: number; y: number; pitch: number; flying: number } {
  const P = { x: 1.55, y: 0.42 };            // perch on the low branch
  if (t < KING.arrive) return { x: 9, y: 3, pitch: 0, flying: 0 };
  if (t < KING.perch) {                      // glide in from upper right
    const u = sCurve(clamp01((t - KING.arrive) / (KING.perch - KING.arrive)));
    return { x: mix(4.6, P.x, u), y: mix(2.6, P.y, u * u * (3 - 2 * u)), pitch: -0.2, flying: 1 };
  }
  if (t < KING.dive) return { ...P, pitch: 0.04 * Math.sin(t * 2.2), flying: 0 }; // perched, tail flicks
  if (t < KING.hit) {                        // dive — parabola to the water
    const u = clamp01((t - KING.dive) / (KING.hit - KING.dive));
    return { x: mix(P.x, 1.95, u), y: P.y - (P.y + 0.12) * u * u, pitch: -1.1, flying: 1 };
  }
  if (t < KING.rise) return { x: 1.95, y: -0.14, pitch: -0.4, flying: 0 }; // submerged beat
  if (t < KING.back) {                       // burst up, arc back to perch
    const u = sCurve(clamp01((t - KING.rise) / (KING.back - KING.rise)));
    return { x: mix(1.95, P.x, u), y: mix(-0.14, P.y, u * (1.6 - 0.6 * u)), pitch: -0.3 + 0.3 * u, flying: 1 };
  }
  if (t < KING.gulp) {                       // swallow — head tosses back
    const u = sstep(KING.back + 0.15, KING.gulp, t);
    return { ...P, pitch: -0.35 * Math.sin(u * Math.PI), flying: 0 };
  }
  return { ...P, pitch: 0.03 * Math.sin(t * 1.8), flying: 0 };
}

export default defineScene({
  id: "willowwhisper",
  setup: async (ctx: SceneContext) => {
    const rng = mulberry32(4711);
    const st = {} as St;
    STATE.set(ctx, st);

    // camera — very low near-static, slight drift so the strand curtain
    // parallaxes over the water
    ctx.rig.setLensMm(62);
    ctx.rig.setPath([
      { t: 0.00, pos: [-0.15, 0.48, 4.70], target: [0.20, 0.10, -2.0] },
      { t: 0.45, pos: [0.05, 0.46, 4.55], target: [0.30, 0.06, -2.0] },
      { t: 0.80, pos: [0.15, 0.44, 4.45], target: [0.10, 0.02, -2.0] },
      { t: 1.00, pos: [0.10, 0.43, 4.40], target: [0.15, 0.00, -2.0] },
    ]);

    // --- backdrop -----------------------------------------------------------
    const backMat = new THREE.ShaderMaterial({
      vertexShader: BACK_VERT, fragmentShader: BACK_FRAG,
      uniforms: {
        uT: { value: 0 },
        uRing0: { value: new THREE.Vector2(KING.hit, 1.95) },
        uRing1: { value: new THREE.Vector2(-99, DRIP_X) },
        uRing2: { value: new THREE.Vector2(FISH_T, 1.7) },
        uRing3: { value: new THREE.Vector2(-99, -0.6) },
      },
      depthWrite: false,
    });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(12.5, 7.5), backMat);
    back.position.z = -4; back.renderOrder = -10;
    ctx.scene3D.add(back);
    st.back = backMat;

    // --- trunk — two heavy leaning boughs from upper left over the water ----
    st.lifeMat = new THREE.ShaderMaterial({
      vertexShader: LIFE_VERT, fragmentShader: LIFE_FRAG, vertexColors: true,
      side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uWob: { value: 0 }, uA: { value: 1 } },
      transparent: true,
    });
    const trunkPos: number[] = [], trunkCol: number[] = [];
    const trunkC = [0.045, 0.05, 0.035];
    ribbon(trunkPos, trunkCol, [[-4.8, 3.2], [-3.9, 2.5], [-3.0, 1.95], [-2.2, 1.55], [-1.6, 1.35]], 0.55, 0.16, trunkC);
    ribbon(trunkPos, trunkCol, [[-4.9, 2.6], [-4.0, 2.1], [-3.2, 1.65], [-2.6, 1.30]], 0.34, 0.12, trunkC);
    // exposed roots at the right bank where the moorhen pokes
    for (let i = 0; i < 3; i++) {
      const rx = 1.85 + i * 0.16;
      ribbon(trunkPos, trunkCol, [[rx, 0.28], [rx + 0.05, 0.14], [rx + 0.12, 0.02]], 0.06, 0.02, trunkC);
    }
    const trunkGeo = new THREE.BufferGeometry();
    trunkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(trunkPos), 3));
    trunkGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(trunkCol), 3));
    const trunk = new THREE.Mesh(trunkGeo, st.lifeMat);
    trunk.frustumCulled = false;
    ctx.scene3D.add(trunk);

    // kingfisher's low branch — thin diagonal over the water right of centre
    const brPos: number[] = [], brCol: number[] = [];
    ribbon(brPos, brCol, [[2.6, 0.95], [2.1, 0.62], [1.55, 0.40], [1.0, 0.28]], 0.07, 0.02, trunkC);
    const brGeo = new THREE.BufferGeometry();
    brGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(brPos), 3));
    brGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(brCol), 3));
    const branch = new THREE.Mesh(brGeo, st.lifeMat);
    branch.frustumCulled = false;
    ctx.scene3D.add(branch);

    // --- strand curtain — ~150 hanging ribbons, 3 phase groups --------------
    const sPos: number[] = [], sCol: number[] = [], sFlex: number[] = [], sPh: number[] = [];
    const greens = [[0.045, 0.10, 0.045], [0.06, 0.13, 0.05], [0.035, 0.085, 0.04], [0.075, 0.12, 0.05]];
    for (let i = 0; i < 150; i++) {
      const tx = -4.6 + rng() * 8.8;
      const canopyEdge = 1.35 + 0.28 * Math.sin(tx * 1.9 + 0.7) + 0.14 * Math.sin(tx * 4.3 + 2.2) + 0.4 * sstep(2.0, 3.5, -tx);
      const ty = canopyEdge + rng() * 1.6;
      const L = 0.6 + rng() * rng() * 1.9;                  // few reach the water
      const bow = (rng() - 0.35) * 0.3;
      const w = 0.022 + rng() * 0.03;
      const c = greens[Math.floor(rng() * greens.length)]!;
      const phase = (i % 3) * 2.1 + rng() * 0.4;
      // strands whose tips catch the last light go subtly warmer
      const lit = ty - L < 0.35 && rng() < 0.18;
      strand(sPos, sCol, sFlex, sPh, tx, ty, L, bow, w,
        lit ? [c[0] * 1.9 + 0.05, c[1] * 1.6 + 0.03, c[2] * 0.7] : c, phase);
    }
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(sPos), 3));
    sGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(sCol), 3));
    sGeo.setAttribute("aFlex", new THREE.BufferAttribute(new Float32Array(sFlex), 1));
    sGeo.setAttribute("aPh", new THREE.BufferAttribute(new Float32Array(sPh), 1));
    const strandMat = new THREE.ShaderMaterial({
      vertexShader: STRAND_VERT, fragmentShader: STRAND_FRAG, vertexColors: true,
      side: THREE.DoubleSide, uniforms: { uT: { value: 0 }, uAmp: { value: 1 }, uA: { value: 0.92 } },
      transparent: true, depthWrite: false,
    });
    const strands = new THREE.Mesh(sGeo, strandMat);
    strands.frustumCulled = false;
    ctx.scene3D.add(strands);
    st.strandMat = strandMat;

    // --- the dragger — one stray strand reaching the water, trailing a wake --
    const dPos: number[] = [], dCol: number[] = [], dFlex: number[] = [], dPh: number[] = [];
    strand(dPos, dCol, dFlex, dPh, DRIP_X, 2.2, 2.42, 0.25, 0.05, [0.09, 0.18, 0.08], 1.0);
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(dPos), 3));
    dGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(dCol), 3));
    dGeo.setAttribute("aFlex", new THREE.BufferAttribute(new Float32Array(dFlex), 1));
    dGeo.setAttribute("aPh", new THREE.BufferAttribute(new Float32Array(dPh), 1));
    st.draggerMat = strandMat.clone();
    st.dragger = new THREE.Mesh(dGeo, st.draggerMat);
    st.dragger.frustumCulled = false;
    ctx.scene3D.add(st.dragger);

    // its wake — a thin ribbon drifting right as the strand drags
    const wkPos: number[] = [], wkCol: number[] = [];
    ribbon(wkPos, wkCol, [[DRIP_X - 0.9, -0.11], [DRIP_X - 0.45, -0.10], [DRIP_X, -0.09]], 0.012, 0.028, [0.10, 0.16, 0.12]);
    const wkGeo = new THREE.BufferGeometry();
    wkGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(wkPos), 3));
    wkGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(wkCol), 3));
    st.wake = new THREE.Mesh(wkGeo, st.lifeMat.clone());
    (st.wake.material as THREE.ShaderMaterial).uniforms.uA!.value = 0.5;
    st.wake.frustumCulled = false;
    ctx.scene3D.add(st.wake);

    // --- ducks — two silhouettes crossing with gated V wakes ----------------
    st.ducks = []; st.wakeMats = [];
    for (let i = 0; i < 2; i++) {
      const grp = new THREE.Group();
      const dp: number[] = [], dc: number[] = [];
      poly(dp, dc, [[-0.16, 0], [-0.10, 0.05], [0.06, 0.05], [0.14, 0.02], [0.10, -0.02], [-0.12, -0.02]], [0.02, 0.025, 0.02]);
      poly(dp, dc, [[0.05, 0.04], [0.10, 0.09], [0.13, 0.085], [0.10, 0.04]], [0.02, 0.025, 0.02]); // head
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(dp), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(dc), 3));
      const m = new THREE.Mesh(g, st.lifeMat.clone());
      m.frustumCulled = false;
      grp.add(m);
      // V wake — diverging ribbons behind, gated by uDx per duck
      const wp: number[] = [], wc: number[] = [];
      ribbon(wp, wc, [[-0.05, -0.01], [-0.75, 0.09], [-1.9, 0.16]], 0.015, 0.05, [0.09, 0.13, 0.10]);
      ribbon(wp, wc, [[-0.05, -0.01], [-0.75, -0.09], [-1.9, -0.14]], 0.015, 0.05, [0.09, 0.13, 0.10]);
      const wg = new THREE.BufferGeometry();
      wg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(wp), 3));
      wg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(wc), 3));
      const wm = new THREE.ShaderMaterial({
        vertexShader: WAKE_VERT, fragmentShader: WAKE_FRAG, vertexColors: true,
        side: THREE.DoubleSide, transparent: true,
        // group space: duck head sits at local x≈0.13 — wake lives behind it
        uniforms: { uA: { value: 0.55 }, uDx: { value: 0.05 } },
      });
      const wm2 = new THREE.Mesh(wg, wm);
      wm2.frustumCulled = false;
      grp.add(wm2);
      st.wakeMats.push(wm);
      ctx.scene3D.add(grp);
      st.ducks.push(grp);
    }

    // --- kingfisher — teal back, orange chest, dagger beak, fan wing --------
    const kGrp = new THREE.Group();
    {
      const body: number[] = [], bodyC: number[] = [];
      poly(body, bodyC, [[-0.09, 0.02], [-0.02, 0.075], [0.08, 0.05], [0.10, 0.0], [0.02, -0.05], [-0.07, -0.04]], [0.05, 0.38, 0.44]); // teal back
      poly(body, bodyC, [[-0.07, -0.04], [0.02, -0.05], [0.10, 0.0], [0.04, 0.03], [-0.04, 0.01]], [0.72, 0.38, 0.12]);            // orange chest
      poly(body, bodyC, [[0.08, 0.045], [0.20, 0.02], [0.085, 0.015]], [0.06, 0.05, 0.05]);                                       // beak
      poly(body, bodyC, [[-0.09, 0.02], [-0.20, -0.03], [-0.16, 0.01]], [0.04, 0.30, 0.34]);                                      // tail
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(body), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(bodyC), 3));
      const bm = new THREE.Mesh(g, st.lifeMat.clone());
      (bm.material as THREE.ShaderMaterial).uniforms.uWob!.value = 0.15;
      bm.frustumCulled = false;
      kGrp.add(bm);
      // wing fan — folds when perched, blurs in flight via scale pulse
      const wPos: number[] = [], wCol: number[] = [];
      for (let i = 0; i <= 4; i++) {
        const a = Math.PI * (0.35 + 0.5 * (i / 4));
        const r = 0.13;
        wPos.push(0, 0.03, -2.0, Math.cos(a) * r, 0.03 + Math.sin(a) * r, -2.0, Math.cos(a + Math.PI * 0.125) * r, 0.03 + Math.sin(a + Math.PI * 0.125) * r, -2.0);
        for (let k = 0; k < 3; k++) wCol.push(0.04, 0.26, 0.30);
      }
      const wg = new THREE.BufferGeometry();
      wg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(wPos), 3));
      wg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(wCol), 3));
      st.kingWing = new THREE.Mesh(wg, st.lifeMat.clone());
      st.kingWing.frustumCulled = false;
      kGrp.add(st.kingWing);
      // silver glint — the fish, visible only on the return
      const gp: number[] = [], gc: number[] = [];
      poly(gp, gc, [[0.16, 0.015], [0.23, -0.005], [0.16, -0.02]], [0.85, 0.88, 0.80]);
      const gg = new THREE.BufferGeometry();
      gg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(gp), 3));
      gg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(gc), 3));
      st.glint = new THREE.Mesh(gg, st.lifeMat.clone());
      (st.glint.material as THREE.ShaderMaterial).uniforms.uA!.value = 0;
      st.glint.frustumCulled = false;
      kGrp.add(st.glint);
    }
    ctx.scene3D.add(kGrp);
    st.king = kGrp;

    // --- splash droplets — burst at the dive hit -----------------------------
    const N_SP = 14;
    const spPos = new Float32Array(N_SP * 3), spSeed = new Float32Array(N_SP);
    for (let i = 0; i < N_SP; i++) { spSeed[i] = rng(); }
    const spGeo = new THREE.BufferGeometry();
    spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3));
    spGeo.setAttribute("aSeed", new THREE.BufferAttribute(spSeed, 1));
    const SPL_VERT = /* glsl */ `
uniform float uT;
uniform float uT0;
uniform float uPx;
attribute float aSeed;
varying float vA;
void main() {
  float age = uT - uT0;
  float act = step(0.0, age) * step(age, 0.9);
  float dir = aSeed * 6.2831;
  float v = 0.6 + aSeed * 0.8;
  vec3 p = vec3(1.95 + cos(dir) * v * age * 0.6, -0.12 + 1.3 * v * age - 1.5 * age * age, -2.0);
  vA = act * (1.0 - age / 0.9);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = 3.5 * uPx * vA;
}`;
    const SPL_FRAG = /* glsl */ `
precision mediump float;
varying float vA;
void main() {
  vec2 f = gl_PointCoord - 0.5;
  if (dot(f, f) > 0.25) discard;
  gl_FragColor = vec4(0.55, 0.65, 0.60, vA);
}`;
    st.splashMat = new THREE.ShaderMaterial({
      vertexShader: SPL_VERT, fragmentShader: SPL_FRAG, transparent: true,
      uniforms: { uT: { value: 0 }, uT0: { value: KING.hit }, uPx: { value: 1 } },
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    st.splash = new THREE.Points(spGeo, st.splashMat);
    st.splash.frustumCulled = false;
    ctx.scene3D.add(st.splash);

    // --- moorhen — dark bird pecking at the right roots ----------------------
    {
      const mp: number[] = [], mc: number[] = [];
      poly(mp, mc, [[-0.10, 0.02], [-0.02, 0.07], [0.09, 0.05], [0.12, 0.0], [0.04, -0.03], [-0.08, -0.03]], [0.03, 0.03, 0.03]);
      poly(mp, mc, [[0.06, 0.05], [0.11, 0.11], [0.14, 0.105], [0.10, 0.045]], [0.03, 0.03, 0.03]);
      poly(mp, mc, [[0.12, 0.09], [0.17, 0.075], [0.12, 0.065]], [0.5, 0.1, 0.08]); // red bill
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(mp), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(mc), 3));
      st.moorhen = new THREE.Mesh(g, st.lifeMat.clone());
      st.moorhen.position.set(1.95, 0.09, 0.02);
      st.moorhen.frustumCulled = false;
      ctx.scene3D.add(st.moorhen);
    }

    // --- bat — dark flutter crossing the upper frame once --------------------
    {
      const bp: number[] = [], bc: number[] = [];
      poly(bp, bc, [[-0.10, 0.02], [-0.03, 0.07], [0, 0.02], [0.03, 0.07], [0.10, 0.02], [0.03, -0.02], [0, -0.04], [-0.03, -0.02]], [0.015, 0.015, 0.02]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bp), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(bc), 3));
      st.batMat = st.lifeMat.clone();
      (st.batMat as THREE.ShaderMaterial).uniforms.uA!.value = 0;
      st.bat = new THREE.Mesh(g, st.batMat);
      st.bat.frustumCulled = false;
      ctx.scene3D.add(st.bat);
    }

    // --- leaves — 4 detached drifts at seeded times --------------------------
    st.leaves = []; st.leafMats = [];
    for (let i = 0; i < LEAVES.length; i++) {
      const lp: number[] = [], lc: number[] = [];
      poly(lp, lc, [[0, 0.03], [0.025, 0], [0, -0.045], [-0.025, 0]], [0.16, 0.22, 0.08]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lp), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(lc), 3));
      const m = st.lifeMat.clone();
      m.uniforms.uA!.value = 0;
      const leaf = new THREE.Mesh(g, m);
      leaf.position.set(-3.5 + i * 1.9 + rng() * 0.8, 2.3 + rng() * 0.5, 0.02);
      leaf.frustumCulled = false;
      ctx.scene3D.add(leaf);
      st.leaves.push(leaf); st.leafMats.push(m);
    }

    // --- fish — far-right jump arc -------------------------------------------
    {
      const fp: number[] = [], fc: number[] = [];
      poly(fp, fc, [[-0.10, 0], [-0.02, 0.05], [0.08, 0.04], [0.13, 0], [0.05, -0.02], [-0.05, -0.02]], [0.35, 0.42, 0.36]);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(fp), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(fc), 3));
      st.fishMat = st.lifeMat.clone();
      (st.fishMat as THREE.ShaderMaterial).uniforms.uA!.value = 0;
      st.fish = new THREE.Mesh(g, st.fishMat);
      st.fish.frustumCulled = false;
      ctx.scene3D.add(st.fish);
    }
  },

  render: (ctx, f, out) => {
    const st = STATE.get(ctx)!;
    const t = f.t;
    const drag = sstep(0, DUR, t) * 0.55;
    st.back.uniforms.uT!.value = t;
    st.back.uniforms.uRing1!.value.set(2.0 + 1.9 * Math.floor(Math.max(0, t - 2.0) / 1.9), DRIP_X + drag);
    // latest leaf landing t0 into ring 3
    let leafT0 = -99, leafX = -0.6;
    for (let i = 0; i < LEAVES.length; i++) {
      const land = LEAVES[i]! + 3.2;
      if (t >= land && land > leafT0) {
        leafT0 = land;
        // landing x in closed form — reading position.x here picks up whatever
        // the still frame left behind, so the ring could sit beside the leaf
        const leaf = st.leaves[i]!;
        leafX = (leaf.userData.x0 ?? leaf.position.x) + Math.sin(3.2 * 2.1 + i) * 0.22;
      }
    }
    st.back.uniforms.uRing3!.value.set(leafT0, leafX);
    st.strandMat.uniforms.uT!.value = t;
    st.draggerMat.uniforms.uT!.value = t;
    st.lifeMat.uniforms.uT!.value = t;
    (st.wake.material as THREE.ShaderMaterial).uniforms.uT!.value = t;

    // dragger strand — sways and slowly drags right; wake follows its tip
    st.dragger.position.x = drag;
    st.wake.position.x = drag;
    (st.wake.material as THREE.ShaderMaterial).uniforms.uA!.value = 0.35 + 0.2 * Math.sin(t * 0.7);

    // ducks — drift left→right, slight bob; wakes gate behind each head
    for (let i = 0; i < 2; i++) {
      const grp = st.ducks[i]!;
      const off = i * 0.55;
      const u = clamp01((t - DUCKS.t0 - off) / (DUCKS.t1 - DUCKS.t0));
      const on = t > DUCKS.t0 + off && t < DUCKS.t1 + 1.0;
      const x = mix(-4.8, 4.9, u);
      grp.position.set(x, -0.10 + 0.02 * Math.sin(t * 2.4 + i * 2), 0.02 + i * 0.01);
      grp.visible = on;
    }

    // kingfisher — piecewise closed-form perch/dive/return
    {
      const k = kingPos(t);
      st.king.position.set(k.x, k.y, 0.05);
      st.king.rotation.z = k.pitch;
      // hidden while submerged (hit→rise) — the splash ring covers the gap
      st.king.visible = k.x < 8 && (t < KING.hit || t >= KING.rise);
      const flap = k.flying > 0 ? (0.5 + 0.5 * Math.sin(t * 26)) : 0.12;
      st.kingWing.scale.set(1, flap, 1);
      const gm = st.glint.material as THREE.ShaderMaterial;
      gm.uniforms.uA!.value = t > KING.rise && t < KING.gulp ? 0.95 : 0;
    }
    st.splashMat.uniforms.uT!.value = t;
    st.splashMat.uniforms.uPx!.value = out.height / 1080;

    // moorhen — peck dips at seeded moments once dusk settles
    {
      const m = st.moorhen.material as THREE.ShaderMaterial;
      m.uniforms.uT!.value = t;
      const on = sstep(MOOR_T0 - 0.5, MOOR_T0 + 0.5, t);
      m.uniforms.uA!.value = on;
      const peck = Math.max(0, Math.sin(t * 3.1)) * sstep(0.82, 0.98, Math.sin(t * 0.9));
      st.moorhen.rotation.z = -0.5 * peck * on;
    }

    // bat — one looping pass, wings flap by scale pulse
    {
      const u = clamp01((t - BAT.t0) / (BAT.t1 - BAT.t0));
      st.bat.position.set(mix(-4.8, 4.8, u), 1.35 + 0.5 * Math.sin(u * Math.PI * 2.6), 0.06);
      st.bat.scale.set(1, 0.6 + 0.5 * Math.abs(Math.sin(t * 13)), 1);
      (st.batMat as THREE.ShaderMaterial).uniforms.uA!.value = 0.8 * Math.sin(Math.PI * u) * (u > 0 && u < 1 ? 1 : 0);
    }

    // leaves — detach, sway down, land and rest on the water
    for (let i = 0; i < st.leaves.length; i++) {
      const leaf = st.leaves[i]!, m = st.leafMats[i]!;
      const t0 = LEAVES[i]!, age = t - t0;
      const x0 = leaf.userData.x0 ?? (leaf.userData.x0 = leaf.position.x);
      const y0 = leaf.userData.y0 ?? (leaf.userData.y0 = leaf.position.y);
      if (age < 0) { m.uniforms.uA!.value = 0; continue; }
      const fall = Math.min(age, 3.2);
      // sway + spin freeze at their landing values — no sideways/orientation snap
      leaf.position.x = x0 + Math.sin(fall * 2.1 + i) * 0.22;
      leaf.position.y = y0 - (y0 + 0.10) * sCurve(fall / 3.2);
      leaf.rotation.z = fall * 1.7;
      m.uniforms.uA!.value = Math.max(0, age < 8 ? 0.9 : 0.9 * (1 - (age - 8) / 4));
    }

    // fish — one arc above the far-right water at FISH_T
    {
      const age = t - FISH_T;
      const on = age > 0 && age < 0.7;
      st.fish.visible = on;
      if (on) {
        st.fish.position.set(1.7 + age * 0.9, -0.10 + 0.55 * age - 0.9 * age * age, 0.02);
        st.fish.rotation.z = -1.2 * age;
        (st.fishMat as THREE.ShaderMaterial).uniforms.uA!.value = 0.9;
      }
    }

    ctx.updateCamera(t, t / DUR);
    ctx.flush(out, true);
  },
});
