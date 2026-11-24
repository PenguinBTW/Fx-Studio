// monarchflow — monarch butterflies streaming across a dusk meadow, in five
// beats: empty field → first strays → swarm ribbon → dispersal → hero landing.
// Backdrop = one GLSL3 quad (dusk sky, ridge + deer, layered grass/milkweed,
// high birds). Foreground = ~300 instanced monarchs on a braided ribbon
// (closed-form braid + gust density + perch lifts + dispersal), one hero
// monarch on a slow-flap approach to a milkweed head, and additive seed motes.
// All closed-form f(t) on hash seeds — no accumulators, no RNG.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const frac = (x: number) => x - Math.floor(x);
const hash = (i: number) => frac(Math.sin(i * 127.1 + 311.7) * 43758.5453);
const w0 = (i: number) => hash(i * 23 + 9);

// --- narrative envelopes ---------------------------------------------------
const straysT = (t: number) => ss(2.5, 5.0, t) * (1 - ss(6.5, 8.0, t));
const swarmT = (t: number) => ss(4.5, 7.0, t) * (1 - ss(11.5, 14.0, t));
const disperseT = (t: number) => ss(11.5, 16.5, t);
const heroT = (t: number) => ss(12.5, 16.5, t);
const calmT = (t: number) => 1 - ss(4.0, 6.0, t) + ss(16.5, 19.0, t); // deer beats
const gustT = (t: number) => 0.55 + 0.45 * Math.sin(t * 1.15) * Math.sin(t * 0.53 + 1.7);

const PW = 300, PH = 114, PY = 8, PZ = -80;
const uvToWorld = (ux: number, uy: number, out: THREE.Vector3) =>
  out.set((ux - 0.5) * PW, PY + (uy - 0.5) * PH, PZ + 0.05);

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
uniform float uCalm;   // deer visible when ~1 (early + late)
uniform float uSwarm;  // swarm beat — extra backlit haze
uniform float uBirds;  // one bird pass during the swarm
out vec4 fragColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
float fbm2(vec2 p) { return vnoise(p) * 0.65 + vnoise(p * 2.13 + 7.3) * 0.35; }

// deer silhouette: ellipse body + sloped neck + head blob + 4 leg bars,
// at center c with half-width s (soft-unioned parts)
float sdEllipse(vec2 p, vec2 c, vec2 r) { return length((p - c) / r) - 1.0; }
float sdBox(vec2 p, vec2 c, vec2 b) {
  vec2 d = abs(p - c) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float deer(vec2 p, vec2 c, float s) {
  vec2 q = (p - c) / s;
  float d = sdEllipse(q, vec2(0.0, 0.30), vec2(1.0, 0.55));
  // neck: sloped box up-right, head: blob at its top
  vec2 nq = q - vec2(0.62, 0.72); nq = mat2(0.86, -0.5, 0.5, 0.86) * nq;
  d = min(d, sdBox(nq, vec2(0.0), vec2(0.13, 0.42)));
  d = min(d, sdEllipse(q, vec2(1.02, 1.18), vec2(0.26, 0.20)));
  d = min(d, sdBox(q - vec2(0.98, 1.34), vec2(0.0), vec2(0.05, 0.22))); // nose
  for (int li = 0; li < 4; li++) {
    float lx = -0.72 + float(li) * 0.48;
    d = min(d, sdBox(q - vec2(lx, -0.55), vec2(0.0), vec2(0.06, 0.65)));
  }
  return 1.0 - smoothstep(0.0, 0.06, d);
}

void main() {
  vec2 uv = vUv;
  float x = uv.x, y = uv.y, t = uT;

  // dusk sky: burnt orange low -> violet high, sun wafer low-right
  vec3 col = mix(vec3(0.93, 0.52, 0.24), vec3(0.30, 0.16, 0.42), smoothstep(0.12, 0.95, y));
  vec2 sunP = vec2(0.78, 0.30);
  float sunD = length((uv - sunP) * vec2(1.4, 1.0));
  col += vec3(1.0, 0.72, 0.38) * (exp(-sunD * sunD * 60.0) * 0.9 + exp(-sunD * sunD * 8.0) * 0.25);

  // far ridge + deer during calm beats
  float ridge = 0.30 + 0.05 * fbm2(vec2(x * 6.0, 0.0)) - 0.03 * x;
  float onRidge = 1.0 - smoothstep(ridge, ridge + 0.012, y);
  vec3 ridgeCol = vec3(0.13, 0.09, 0.16);
  vec2 deerP = vec2(0.42, ridge + 0.05);
  float d = deer(uv, deerP, 0.035) * uCalm;
  col = mix(col, ridgeCol, onRidge * 0.9);
  col = mix(col, vec3(0.05, 0.03, 0.07), d);

  // birds: one high pass L->R across the swarm beat
  if (uBirds > 0.01) {
    float bx = fract(0.15 + t * 0.045);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      vec2 bp = vec2(bx - fi * 0.035, 0.82 + fi * 0.02 + sin(t * 3.0 + fi) * 0.005);
      vec2 bd = (uv - bp) * vec2(1.0, 3.0);
      float wing = abs(bd.x) * 0.5 + bd.y;
      float b = (1.0 - smoothstep(0.004, 0.012, abs(wing))) * (1.0 - smoothstep(0.02, 0.035, length(bd)));
      col = mix(col, vec3(0.06, 0.04, 0.09), b * uBirds);
    }
  }

  // meadow layers: far thin grass, mid band, near milkweed + grass silhouette
  float horizon = 0.30;
  // mid meadow band (soft, swaying top edge)
  float mid = 0.26 + 0.02 * vnoise(vec2(x * 18.0 + t * 0.4, 3.0));
  col = mix(col, vec3(0.16, 0.11, 0.13), (1.0 - smoothstep(mid - 0.01, mid + 0.02, y)) * 0.85);
  // near grass row: blade cells, swaying tips
  if (y < 0.20) {
    float cell = floor(x * 60.0);
    float h1 = hash12(vec2(cell, 7.0));
    float sway = sin(t * (0.7 + h1) + cell) * 0.012;
    float bladeTop = 0.05 + 0.15 * h1;
    float inBlade = step(abs(fract(x * 60.0) - 0.5 + sway * 40.0 * (bladeTop - y + 0.05)), 0.10 + y * 1.6);
    float grass = (1.0 - smoothstep(bladeTop - 0.01, bladeTop + 0.01, y)) * inBlade;
    col = mix(col, vec3(0.07, 0.05, 0.08), grass);
  }
  // milkweed stalks: thin stems + lobed seed heads (backlit rim)
  for (int k = 0; k < 5; k++) {
    float fk = float(k);
    float sx = 0.08 + fk * 0.21 + 0.05 * sin(fk * 3.3);
    float lean = sin(t * 0.5 + fk * 2.0) * 0.006;
    float stemX = sx + lean * (0.30 - y);
    float head = 0.30 + 0.03 * sin(fk * 1.7);
    float stem = (1.0 - smoothstep(0.0012, 0.0030, abs(x - stemX))) * step(y, head) * step(0.02, y);
    float hd = length((uv - vec2(stemX + lean * (0.30 - head), head)) * vec2(2.2, 1.4));
    float headM = 1.0 - smoothstep(0.028, 0.042, hd - 0.010 * fbm2(uv * 90.0 + fk));
    float rim = smoothstep(0.026, 0.036, hd) * (1.0 - smoothstep(0.040, 0.058, hd));
    col = mix(col, vec3(0.09, 0.06, 0.09), clamp(stem + headM, 0.0, 1.0) * 0.95);
    col += vec3(1.0, 0.75, 0.45) * rim * 0.12; // backlit rim on seed heads
  }
  // swarm-beat haze: warm veil while the ribbon crosses
  col += vec3(0.30, 0.14, 0.05) * uSwarm * 0.12 * (1.0 - smoothstep(0.15, 0.6, abs(y - 0.42)));
  fragColor = vec4(col, 1.0);
}`;

// monarch wing shader (shared by swarm instances + hero)
const BIRD_VERT = /* glsl */ `
in float aSeed;
uniform float uT;
uniform float uSwarm;
uniform float uDisperse;
uniform float uHero;      // >0 = hero mode (single mesh path, not ribbon)
uniform float uLanded;
out vec2 vUv;
out float vSeed;

vec3 ribbonPos(float s, float lane, float seed) {
  float x = mix(75.0, -75.0, s);
  float braid = sin(s * 14.0 + lane * 2.0944 + uT * 0.3);
  float y = 6.0 + braid * 7.0 + sin(s * 31.0 + seed * 40.0) * 2.0 + lane * 1.5;
  float z = -42.0 + cos(s * 9.0 + lane * 2.0944) * 14.0 + sin(seed * 20.0) * 4.0;
  return vec3(x, y, z);
}

void main() {
  vUv = uv;
  vSeed = aSeed;
  // wing fold: |x| halves rotate about body axis (local Y) — one-sided
  // upstroke so wings open flat then fold; landed holds wings upright
  float fly = 0.15 + (sin(uT * 9.0 + aSeed * 50.0) * 0.5 + 0.5) * 1.2;
  float sit = 1.35 + sin(uT * 1.1 + aSeed) * 0.05;
  float flap = mix(fly, sit, uLanded);
  vec3 p = position;
  float side = sign(p.x);
  // sign(p.x)*flap keeps both wings mirroring — abs() here used to bank
  // the silhouette (one tip up, other down) instead of flapping
  p = vec3(p.x * cos(flap * side), p.y, position.x * sin(flap * side));
  mat4 im = mat4(1.0);
  #ifdef USE_INSTANCING
    im = instanceMatrix;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * im * vec4(p, 1.0);
}`;

const BIRD_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vSeed;
uniform float uFade;
out vec4 fragColor;
float hash1(float p) { return fract(sin(p * 91.7) * 43758.5); }
void main() {
  // wing shape: two lobes (fore + hind), body strip
  vec2 q = vUv - 0.5;
  float fore = 1.0 - smoothstep(0.30, 0.33, length(q * vec2(1.0, 1.55) - vec2(0.0, 0.10)));
  float hind = 1.0 - smoothstep(0.26, 0.30, length(q * vec2(1.0, 1.8) + vec2(0.0, 0.22)));
  float wing = max(fore, hind);
  float body = (1.0 - smoothstep(0.030, 0.045, abs(q.x))) * (1.0 - smoothstep(0.38, 0.46, abs(q.y)));
  float shape = max(wing, body * 0.6);
  if (shape < 0.05) discard;
  // wing pattern: orange field, black veins (radial), black border + white dots
  float ang = atan(q.y - 0.05, q.x);
  float vein = smoothstep(0.02, 0.05, abs(fract(ang * 2.4) - 0.5));
  float border = 1.0 - smoothstep(0.55, 0.80, shape); // dark rim where coverage thins
  vec3 orange = mix(vec3(0.95, 0.45, 0.08), vec3(0.85, 0.28, 0.05), hash1(vSeed));
  vec3 col = mix(orange, vec3(0.05), (1.0 - vein) * 0.55);
  col = mix(col, vec3(0.05), border);
  // white dots on the border
  float dots = step(0.93, fract(ang * 4.8 + vSeed)) * border;
  col = mix(col, vec3(0.95), dots);
  col = mix(col, vec3(0.08), body);
  fragColor = vec4(col, uFade);
}`;

const N = 300, MOTES = 40;

export default class MonarchflowScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 400);
  private swarm: THREE.InstancedMesh;
  private hero: THREE.Mesh;
  private milkweed = new THREE.Group();
  private motes: THREE.InstancedMesh;
  private u = { uT: { value: 0 }, uCalm: { value: 0 }, uSwarm: { value: 0 }, uBirds: { value: 0 } };
  private bu = {
    uT: { value: 0 }, uSwarm: { value: 0 }, uDisperse: { value: 0 },
    uHero: { value: 0 }, uLanded: { value: 0 }, uFade: { value: 1 },
  };
  private heroU: typeof this.bu;
  private p = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private m = new THREE.Matrix4();
  private sv = new THREE.Vector3();
  private heroPos = new THREE.Vector3();

  constructor(ctx: SceneCtx) {
    super(ctx);
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG }),
    );
    uvToWorld(0.5, 0.5, quad.position);
    this.three.add(quad);

    // swarm: per-instance seed attribute; CPU bakes ribbon/dispersal pose
    const wingGeo = new THREE.PlaneGeometry(2.6, 1.6);
    const seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) seeds[i] = hash(i + 3);
    const swarmMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, uniforms: this.bu,
      vertexShader: BIRD_VERT, fragmentShader: BIRD_FRAG,
      transparent: true, side: THREE.DoubleSide,
    });
    this.swarm = new THREE.InstancedMesh(wingGeo, swarmMat, N);
    wingGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.three.add(this.swarm);

    // hero monarch: same shader on its own material instance
    this.heroU = {
      ...this.bu,
      uHero: { value: 1 },
      uLanded: { value: 0 }, // own slot — sharing would fold the whole swarm
      uFade: { value: 1 },
    };
    const heroGeo = new THREE.PlaneGeometry(4.2, 2.6);
    heroGeo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(4).fill(0.42), 1));
    this.hero = new THREE.Mesh(heroGeo, new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, uniforms: this.heroU,
      vertexShader: BIRD_VERT, fragmentShader: BIRD_FRAG,
      transparent: true, side: THREE.DoubleSide,
    }));
    this.three.add(this.hero);

    // milkweed head: small lobed blob cluster near camera-right
    const pod = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.4, 1),
      new THREE.MeshStandardMaterial({ color: 0x5a6b3a, roughness: 0.9 }),
    );
    pod.scale.set(1.4, 1.0, 1.0);
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.16, 16, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2418, roughness: 1 }),
    );
    stem.position.y = -8;
    const amb = new THREE.AmbientLight(0x442a3a, 1.4);
    const key = new THREE.DirectionalLight(0xff8a4a, 2.2);
    key.position.set(30, 8, -30);
    this.milkweed.add(stem, pod);
    this.milkweed.position.set(14, -2, -18);
    this.three.add(this.milkweed, amb, key);

    // drifting seeds: additive motes
    this.motes = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.4, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
      MOTES,
    );
    this.three.add(this.motes);
    this.cam.position.set(0, 8, 30);
    this.cam.lookAt(0, 10, PZ + 20);
  }

  // braided ribbon point for butterfly i at time t
  private ribbonPoint(i: number, t: number, out: THREE.Vector3): number {
    const u = hash(i * 7 + 1), w = hash(i * 13 + 5);
    const s = frac(u + t * (0.028 + 0.010 * w));
    const lane = Math.floor(hash(i * 31) * 3);
    const braid = Math.sin(s * 14 + lane * 2.0944 + t * 0.3);
    const x = (75 - 150 * s);
    const y = 6 + braid * 7 + Math.sin(s * 31 + u * 40) * 2 + lane * 1.5;
    const z = -42 + Math.cos(s * 9 + lane * 2.0944) * 14 + Math.sin(u * 20) * 4;
    // perch-lift arcs: occasional vertical hop on a seeded cycle
    const cyc = Math.floor(t / 6 + u * 7);
    const lift = hash(i * 3 + cyc) < 0.12 ? Math.sin(frac(t / 6 + u * 7) * Math.PI) * 5 : 0;
    out.set(x, y + lift, z);
    return s;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const r = this.ctx.renderer;
    this.u.uT.value = t;
    this.u.uCalm.value = calmT(t);
    this.u.uSwarm.value = swarmT(t);
    this.u.uBirds.value = ss(8.5, 9.5, t) * (1 - ss(10.5, 11.5, t));
    this.bu.uT.value = t;
    this.bu.uSwarm.value = swarmT(t);
    this.bu.uDisperse.value = disperseT(t);

    const swarm = swarmT(t), strays = straysT(t), dis = disperseT(t);
    for (let i = 0; i < N; i++) {
      const u = hash(i * 7 + 1);
      const s = this.ribbonPoint(i, t, this.p); // same s the ribbon uses
      // visibility: a seeded 12% are the early strays; the swarm gates by a
      // gust-modulated density cell; dispersal ramps a seeded drifting
      // fraction in so the ribbon thins instead of re-thickening
      const strayOk = u < 0.12;
      const gust = gustT(t + u * 6);
      const den = Math.sin(s * 21 + u * 12) * 0.5 + 0.5;
      const inSwarm = swarm > 0.05 && den < (0.35 + 0.6 * gust) * swarm;
      const drifting = dis > 0 && (inSwarm || hash(i * 3) < Math.min(1, dis * 4) * 0.7);
      const vis = (strayOk && (strays > 0.02 || swarm > 0.02)) || inSwarm || drifting;
      const gone = t > 17 && hash(i * 5) > 0.25; // most have left frame by the calm
      // dispersal: blend ribbon pos -> individual drift
      if (dis > 0) {
        this.p.x += dis * (u - 0.5) * 90;
        this.p.y += dis * (18 + u * 30);
        this.p.z += dis * (w0(i) - 0.5) * 40;
      }
      if (!vis || gone) { this.m.makeScale(0, 0, 0); this.swarm.setMatrixAt(i, this.m); continue; }
      const yaw = Math.atan2(150 * 0.03, 1) + Math.sin(t + i) * 0.3;
      this.e.set(Math.PI / 2 - 0.35, yaw, Math.sin(t * 2 + i) * 0.2);
      this.q.setFromEuler(this.e);
      // shrink through the ribbon wrap so no instance teleports onscreen
      const edge = ss(0.0, 0.03, s) * (1 - ss(0.97, 1.0, s));
      const scale = (0.8 + u * 0.7) * edge;
      this.sv.setScalar(scale);
      this.m.compose(this.p, this.q, this.sv);
      this.swarm.setMatrixAt(i, this.m);
    }
    this.swarm.instanceMatrix.needsUpdate = true;

    // hero: glides in from frame-right to a near hover, then settles onto
    // the milkweed head ~16.5 and bobs
    const hero = heroT(t);
    const land = ss(16.2, 17.0, t);
    this.heroU.uT.value = t;
    this.heroU.uLanded.value = land;
    this.heroU.uFade.value = ss(12.5, 13.5, t);
    const start = new THREE.Vector3(55, 16, -30);
    const hover = new THREE.Vector3(20, 4.0, -20);
    const perch = new THREE.Vector3(14, -0.45, -18);
    this.heroPos.lerpVectors(start, hover, ss(12.8, 15.6, t));
    this.heroPos.lerp(perch, land);
    if (land < 1) this.heroPos.y += Math.sin(t * 1.8) * (1 - land) * 2.2;
    this.hero.position.copy(this.heroPos);
    this.hero.position.y += Math.sin(t * 0.9) * land * 0.12; // perched bob
    this.hero.quaternion.setFromEuler(this.e.set(Math.PI / 2 - 0.3, Math.PI, 0));
    this.milkweed.rotation.z = Math.sin(t * 0.9) * 0.02 * land;

    // seed motes: backlit drift
    for (let i = 0; i < MOTES; i++) {
      const u = hash(i * 11), w = hash(i * 17);
      const mx = frac(u + t * (0.006 + 0.008 * w));
      const my = 0.25 + w * 0.5 + Math.sin(t * 0.3 + i) * 0.03;
      uvToWorld(mx, my, this.p);
      this.p.z += 1.5 + w * 3;
      const tw = 0.3 + 0.7 * (Math.sin(t * 2 + i * 5) * 0.5 + 0.5);
      this.sv.setScalar(tw);
      this.m.compose(this.p, this.q.identity(), this.sv);
      this.motes.setMatrixAt(i, this.m);
    }
    this.motes.instanceMatrix.needsUpdate = true;

    // camera: pan left with the ribbon, then drift to the hero perch
    const track = ss(4.5, 9.0, t);
    const toHero = ss(13.0, 17.0, t);
    this.cam.position.set(
      -14 * track + 16 * toHero + Math.sin(t * 0.06) * 0.8,
      8 - 3.5 * toHero,
      30 - 17 * toHero,
    );
    this.cam.lookAt(
      -20 * track + 30 * toHero,
      9 - 8.0 * toHero + Math.sin(t * 0.07) * 0.4,
      -50 + 32 * toHero,
    );

    // diagnostics: publish hero screen bounds so probes see the node —
    // after the camera moves so the projection uses this frame's view
    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        this.p.copy(this.hero.position).project(this.cam);
        const W = P.width || 1920, H = P.height || 1080;
        const cx = (this.p.x * 0.5 + 0.5) * W, cy = (0.5 - this.p.y * 0.5) * H;
        const rad = 4 * H * 0.04; // rough wing span in px
        if (this.heroU.uFade.value > 0.001) {
          P.textProbes.push({
            frameIdx: P.currentFrameIdx ?? 0,
            t,
            text: 'hero-monarch',
            fontFamily: 'Archivo, sans-serif',
            fontPx: 24,
            fillStyle: '#F29B38',
            globalAlpha: this.heroU.uFade.value,
            layerId: 'monarchflow',
            bbox: [cx - rad, cy - rad * 0.6, cx + rad, cy + rad * 0.6],
            w: rad * 2,
            h: rad * 1.2,
            cx,
            cy,
            hPct: (rad * 1.2 / H) * 100,
            isStroke: false,
          });
        }
      }
    }

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 0.78 + 0.04 * swarm,
      bloom: 0.35 + 0.15 * hero,
      bloomThreshold: 0.72,
      bloomRadius: 0.5,
      grade: { saturation: 1.2, gamma: 0.9 },
    } as PostOverrides;
  }

  override dispose() {
    this.swarm.dispose();
    this.motes.dispose();
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}
