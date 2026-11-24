// orchidsteam — steaming orchid terrarium in a dark conservatory at night.
// All motion is closed-form f(t); particles are instanced quads displaced in
// the vertex shader. Authored uv [0,1] is remapped into the camera-visible
// vUv band (x~[0.27,0.73], y~[0.16,0.84]) at the BACK_FRAG call site.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../../engine/scene.js';

const hash = (n: number) => {
  const s = Math.sin(n * 91.7) * 43758.5453;
  return s - Math.floor(s);
};
const ss = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// --- envelopes (beat times from storyboard.md) -------------------------------
const mistP = (t: number) => ss(8.2, 9.0, t) * (1 - ss(10.5, 11.8, t));   // mister fires
// analytic integral of a smoothstep window (rise a..b) and of mistP's
// rise-hold-fall window — keeps particle positions proportional to drift
// actually travelled, so nothing rewinds when the burst envelope decays.
const issT = (a: number, b: number, t: number) => {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return (b - a) * (u * u * u * (1 - 0.5 * u)) + (t > b ? t - b : 0);
};
const mistI = (t: number) =>
  issT(8.2, 9.0, Math.min(t, 10.5)) + (t > 10.5 ? t - 10.5 - issT(10.5, 11.8, t) : 0);
const fogT = (t: number) =>
  0.22 + 0.55 * ss(9.0, 12.0, t) * (1 - ss(15.5, 18.5, t));              // fog blooms then recedes
const lightT = (t: number) => 0.55 + 0.45 * Math.sin(t * 0.5);           // lightbar breath
const moonT = (t: number) => ss(0.0, 6.0, t) * (1 - ss(9.0, 13.0, t));   // moon dimmed by fog
const hopP = (t: number) => ss(14.0, 14.9, t);                            // one-hop progress
const flexT = (t: number) =>                                            // leaf dips under drips
  Math.sin(Math.max(0, t - 12.8) * 14.0) * Math.exp(-Math.max(0, t - 12.8) * 5.0) +
  Math.sin(Math.max(0, t - 15.4) * 14.0) * Math.exp(-Math.max(0, t - 15.4) * 5.0);
const snailT = (t: number) => ss(0.0, 20.0, t);

const FOG = 140;
const DRIPS = 24;

// pw/ph/py/pz: world quad bounds — the uv space every layer shares
const PW = 300, PH = 114, PY = 8, PZ = -80;
const uvToWorld = (ux: number, uy: number, out: THREE.Vector3) =>
  out.set((ux - 0.5) * PW, PY + (uy - 0.5) * PH, PZ);
// authored [0,1] → camera-visible vUv band (matches the BACK_FRAG call-site remap)
const aToV = (ux: number, uy: number, out: THREE.Vector3) =>
  uvToWorld(0.269 + ux * 0.462, 0.159 + uy * 0.904, out);

// --- backdrop --------------------------------------------------------------
const BACK_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BACK_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
uniform float uMist;   // mister pulse 0..1
uniform float uFog;    // fog density 0..~0.8
uniform float uLight;  // lightbar breath 0.1..1
uniform float uMoon;   // moon strength
uniform float uFlex;   // leaf flex (signed, decaying)
uniform float uSnail;  // snail trail progress
out vec4 fragColor;

float h1(float p) { return fract(sin(p * 91.7) * 43758.5); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x),
             mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * n2(p); p *= 2.03; a *= 0.5; }
  return v;
}
// distance to a quadratic bezier (stem arc)
float bezierD(vec2 uv, vec2 a, vec2 b, vec2 c) {
  float d = 1e3;
  vec2 p0 = a;
  for (int i = 1; i <= 12; i++) {
    float u = float(i) / 12.0;
    vec2 p1 = mix(mix(a, b, u), mix(b, c, u), u);
    vec2 pa = uv - p0, ba = p1 - p0;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    d = min(d, length(pa - ba * h));
    p0 = p1;
  }
  return d;
}

vec3 terrarium(vec2 uv, float t) {
  // conservatory night — deep blue-black, faint cold gradient
  vec3 col = mix(vec3(0.035, 0.045, 0.070), vec3(0.012, 0.018, 0.032),
                 smoothstep(0.0, 1.0, uv.y));

  // glass roof mullions: dark grid over a slightly lighter pane sheen
  float pane = smoothstep(0.58, 1.0, uv.y);
  float mullX = smoothstep(0.494, 0.499, abs(fract(uv.x * 5.0) - 0.5));
  float mullY = smoothstep(0.492, 0.499, abs(fract(uv.y * 8.0) - 0.5));
  col += vec3(0.05, 0.07, 0.11) * pane * 0.5;
  col = mix(col, vec3(0.010, 0.014, 0.024), pane * clamp(mullX + mullY, 0.0, 1.0) * 0.8);

  // moon disc + halo, upper-left; dimmed when fog thickens
  float md = length((uv - vec2(0.17, 0.70)) * vec2(1.4, 1.0));
  col += vec3(0.55, 0.62, 0.75) * uMoon * (0.16 * exp(-md * md * 26.0) + 0.55 * exp(-md * md * 900.0));

  // leaf shadows sliding across the roof panes
  float shad = fbm(vec2(uv.x * 6.0 - t * 0.05, uv.y * 3.0));
  col *= 1.0 - pane * 0.35 * smoothstep(0.45, 0.75, shad) * (0.4 + 0.6 * uMoon);

  // grow lightbar: warm strip across mid-frame, breathing
  float bar = smoothstep(0.305, 0.315, uv.y) * (1.0 - smoothstep(0.330, 0.340, uv.y));
  bar *= smoothstep(0.08, 0.14, uv.x) * (1.0 - smoothstep(0.86, 0.94, uv.x));
  col += vec3(1.0, 0.62, 0.28) * bar * (0.25 + 0.75 * uLight) * 0.9;
  // bar glow bleeding downward into the tank
  col += vec3(0.55, 0.30, 0.10) * exp(-abs(uv.y - 0.30) * 9.0) * uLight * 0.35
       * smoothstep(0.08, 0.20, uv.x) * (1.0 - smoothstep(0.80, 0.95, uv.x));

  // mossy substrate
  float moss = 1.0 - smoothstep(0.07, 0.115, uv.y + n2(uv * 30.0) * 0.02);
  col = mix(col, vec3(0.045, 0.09, 0.05) * (0.6 + 0.5 * n2(uv * 55.0)), moss * 0.9);

  // broad leaf bottom-right; dips when a drip lands (uFlex signed kick)
  vec2 lf = vec2(0.78, 0.16 + uFlex * 0.010);
  float leaf = 1.0 - smoothstep(0.16, 0.19,
      length((uv - lf) * vec2(0.7, 2.6) + vec2(0.0, -0.02 * sin(uv.x * 20.0))));
  leaf *= 1.0 - smoothstep(0.86, 0.98, uv.x);               // tapers right
  vec3 leafCol = vec3(0.05, 0.16, 0.07);
  leafCol += vec3(0.35, 0.20, 0.05) * uLight * exp(-abs(uv.y - 0.30) * 7.0); // bar spill
  col = mix(col, leafCol, clamp(leaf, 0.0, 1.0) * 0.95);

  // pane edge glints: warm shelf light catching glass edges
  col += vec3(0.9, 0.55, 0.25) * uLight *
      (exp(-abs(uv.x - 0.045) * 90.0) + exp(-abs(uv.x - 0.955) * 90.0)) * 0.25;

  // mister nozzle: brass stub at the left edge, shimmer while pulsing
  float nz = 1.0 - smoothstep(0.006, 0.010, length((uv - vec2(0.105, 0.52)) * vec2(1.0, 1.8)));
  col = mix(col, vec3(0.45, 0.35, 0.18), nz);
  col += vec3(0.7, 0.8, 0.9) * uMist * exp(-length(uv - vec2(0.105, 0.52)) * 14.0)
       * (0.5 + 0.5 * n2(uv * 60.0 + t * 9.0));

  // fog banks advecting upward, gated by uFog
  vec2 fp = vec2(uv.x * 3.0 + fbm(uv * 4.0 + t * 0.1) * 0.8,
                 uv.y * 2.0 - t * 0.06);
  float fog = fbm(fp) * smoothstep(0.02, 0.4, uv.y) * (0.35 + 0.65 * uFog);
  fog += fbm(vec2(uv.x * 7.0, uv.y * 5.0 - t * 0.11)) * uMist * 0.55;
  col = mix(col, vec3(0.62, 0.70, 0.74), clamp(fog * 0.85, 0.0, 0.82));

  // orchid sits in front of the fog bank (ghosts through at peak)
  // orchid stems — three arcs from substrate, curving right
  vec3 stemCol = vec3(0.16, 0.36, 0.14) + vec3(0.30, 0.18, 0.05) * uLight;
  float stem = 1.0 - smoothstep(0.0045, 0.008,
      min(min(bezierD(uv, vec2(0.30, 0.08), vec2(0.34, 0.30), vec2(0.47, 0.44)),
              bezierD(uv, vec2(0.52, 0.08), vec2(0.55, 0.34), vec2(0.66, 0.52))),
              bezierD(uv, vec2(0.68, 0.08), vec2(0.71, 0.30), vec2(0.82, 0.42))));
  col = mix(col, stemCol, stem * 0.95 * (1.0 - 0.40 * uFog));

  // blossoms: 5-petal rosettes at the arc tips
  vec2 blooms[4] = vec2[](vec2(0.47, 0.44), vec2(0.54, 0.49), vec2(0.66, 0.52), vec2(0.82, 0.42));
  for (int i = 0; i < 4; i++) {
    vec2 bp = blooms[i];
    float fi = float(i);
    float bl = 0.0;
    for (int k = 0; k < 5; k++) {
      float ang = 6.2832 * (float(k) / 5.0) + fi * 0.7;
      vec2 pc = bp + vec2(cos(ang), sin(ang)) * 0.018;
      bl = max(bl, 1.0 - smoothstep(0.012, 0.016, length((uv - pc) * vec2(1.0, 1.35))));
    }
    float core = 1.0 - smoothstep(0.008, 0.011, length(uv - bp));
    vec3 petal = mix(vec3(0.82, 0.72, 0.80), vec3(0.92, 0.80, 0.86), h1(fi * 7.0));
    // warm rim when the bar breathes up — lit edge on the bar side (below)
    float rim = smoothstep(0.0, 1.0, uLight) * (1.0 - smoothstep(bp.y - 0.02, bp.y, uv.y));
    petal += vec3(0.35, 0.16, 0.04) * rim * 0.6;
    col = mix(col, petal, bl * 0.92 * (1.0 - 0.45 * uFog));
    col = mix(col, vec3(0.55, 0.28, 0.40), core * 0.95 * (1.0 - 0.45 * uFog));
  }

  // snail trail: glistening curve creeping right, specular shimmer
  float sx = 0.60 + 0.12 * uSnail;
  float ty = 0.40 + 0.02 * sin((uv.x - 0.60) * 40.0);
  float trail = (1.0 - smoothstep(0.0010, 0.0026, abs(uv.y - ty)))
              * step(0.60, uv.x) * step(uv.x, sx);
  col += vec3(0.55, 0.62, 0.70) * trail * (0.5 + 0.5 * sin(t * 6.0 + uv.x * 240.0)) * 0.8;

  return col;
}

void main() {
  vec2 uv = vUv;
  // vUv visible band is x~[0.27,0.73], y~[0.16,0.84]; map authored [0,1] into it
  vec3 col = terrarium(vec2((uv.x - 0.269) / 0.462, 0.03 + (uv.y - 0.159) * 1.107), uT);
  fragColor = vec4(col, 1.0);
}`;

// --- fog motes (instanced soft quads rising through the tank) ----------------
const FOG_VERT = /* glsl */ `
in float aSeed;
out vec2 vUv;
out float vA;
uniform float uT;
uniform float uFog;
uniform float uMist;
uniform float uMistI;  // integral of the mist envelope — distance added by the burst
float h1(float p) { return fract(sin(p * 91.7) * 43758.5); }
void main() {
  vUv = uv;
  float s1 = h1(aSeed * 311.0), s2 = h1(aSeed * 977.0), s3 = h1(aSeed * 131.0);
  // slow rise + lateral curl; mister burst adds a fast updraft window
  float fx = fract(s1 + uT * 0.004 * (0.5 + s2)
             + sin(uT * (0.10 + s3 * 0.2) + aSeed * 40.0) * 0.05);
  float fy = fract(s2 + uT * (0.010 + 0.020 * s3) + uMistI * (0.10 + 0.14 * s1));
  vec3 p = position * vec3((0.03 + 0.05 * s3) * ${PW}.0, (0.02 + 0.03 * s2) * ${PH}.0, 1.0);
  p.x += (fx - 0.5) * ${PW}.0;
  p.y += (fy - 0.5) * ${PH}.0;
  p.z += mix(2.0, 18.0, s3);
  vA = (0.20 + 0.45 * uFog + 0.55 * uMist) * (0.4 + 0.6 * s2);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FOG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vA;
out vec4 fragColor;
void main() {
  float d = length((vUv - 0.5) * 2.0);
  float a = (1.0 - smoothstep(0.3, 1.0, d)) * vA;
  if (a < 0.02) discard;
  fragColor = vec4(vec3(0.66, 0.73, 0.78), a * 0.30);
}`;

// --- condensation drips on the front pane ------------------------------------
const DRIP_VERT = /* glsl */ `
in float aSeed;
out vec2 vUv;
out float vA;
uniform float uT;
uniform float uMist;
float h1(float p) { return fract(sin(p * 91.7) * 43758.5); }
void main() {
  vUv = uv;
  float s1 = h1(aSeed * 311.0), s2 = h1(aSeed * 977.0), s3 = h1(aSeed * 131.0);
  // stick-slip slide: progress stalls on a per-drop stutter, then releases
  float cyc = fract(uT * (0.014 + s3 * 0.020) + s1);
  float stall = smoothstep(0.0, 0.08, cyc) * (0.4 + 0.6 * smoothstep(0.55, 0.9, cyc));
  float fy = 0.92 - cyc * (0.35 + 0.45 * stall) - s2 * 0.30;
  float fx = 0.05 + 0.90 * s1 + sin(uT * 0.3 + aSeed * 20.0) * 0.002;
  vec3 p = position * vec3((0.0035 + 0.003 * s3) * ${PW}.0, (0.006 + 0.005 * s2) * ${PH}.0, 1.0);
  p.x += (fx - 0.5) * ${PW}.0;
  p.y += (fy - 0.5) * ${PH}.0;
  p.z += 22.0;                                   // closest layer — on the glass
  // drips brighten while the mister runs, fade after each slide
  vA = (0.35 + 0.65 * uMist) * (0.5 + 0.5 * s2) * (1.0 - smoothstep(0.75, 0.9, cyc));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const DRIP_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vA;
out vec4 fragColor;
void main() {
  float d = length((vUv - 0.5) * 2.0);
  float a = (1.0 - smoothstep(0.5, 1.0, d)) * vA;
  if (a < 0.02) discard;
  vec3 col = vec3(0.75, 0.82, 0.88) + vec3(0.25) * (1.0 - smoothstep(0.0, 0.4, length(vUv - vec2(0.38, 0.38))));
  fragColor = vec4(col, a * 0.75);
}`;

// --- silhouettes -------------------------------------------------------------
const SIL_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FROG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
uniform float uHop;
out vec4 fragColor;
void main() {
  vec2 q = vec2(vUv.x - 0.5, vUv.y);
  // breathing: whole body swells a little on a slow cycle
  float breath = 1.0 + 0.05 * sin(uT * 2.6);
  // body dome + head bump + hind leg wedge
  float body = 1.0 - smoothstep(0.30, 0.36, length((q - vec2(0.0, 0.32)) * vec2(1.0, 1.6 / breath)));
  float head = 1.0 - smoothstep(0.13, 0.16, length(q - vec2(0.16, 0.52)));
  float leg  = (1.0 - smoothstep(0.10, 0.14, length(q - vec2(-0.16, 0.10)))) * step(q.y, 0.22);
  // eye glint
  float eye = 1.0 - smoothstep(0.015, 0.020, length(q - vec2(0.20, 0.56)));
  float shape = max(max(body, head), leg);
  if (shape < 0.05 && eye < 0.05) discard;
  vec3 col = vec3(0.02, 0.05, 0.03);
  col += vec3(0.30, 0.18, 0.05) * (1.0 - smoothstep(0.3, 0.9, vUv.y)) * 0.3; // warm underside
  fragColor = vec4(mix(col, vec3(0.85, 0.88, 0.70), eye), max(shape, eye) * 0.96);
}`;

export default class OrchidsteamScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private fog: THREE.InstancedMesh;
  private drips: THREE.InstancedMesh;
  private frog: THREE.Mesh;
  private bu = {
    uT: { value: 0 }, uMist: { value: 0 }, uFog: { value: 0.2 },
    uLight: { value: 0.5 }, uMoon: { value: 1 }, uFlex: { value: 0 }, uSnail: { value: 0 },
  };
  private fgU = { uT: { value: 0 }, uFog: { value: 0.2 }, uMist: { value: 0 }, uMistI: { value: 0 } };
  private drU = { uT: { value: 0 }, uMist: { value: 0 } };
  private frU = { uT: { value: 0 }, uHop: { value: 0 } };
  private p = new THREE.Vector3();

  constructor(ctx: SceneCtx) {
    super(ctx);
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.bu, vertexShader: BACK_VERT, fragmentShader: BACK_FRAG }),
    );
    uvToWorld(0.5, 0.5, quad.position);
    this.three.add(quad);

    const fogGeo = new THREE.PlaneGeometry(1, 1);
    {
      const seeds = new Float32Array(FOG);
      for (let i = 0; i < FOG; i++) seeds[i] = hash(i * 7 + 3);
      fogGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    }
    this.fog = new THREE.InstancedMesh(
      fogGeo,
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.fgU, vertexShader: FOG_VERT, fragmentShader: FOG_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      FOG,
    );
    this.three.add(this.fog);

    const drGeo = new THREE.PlaneGeometry(1, 1);
    {
      const seeds = new Float32Array(DRIPS);
      for (let i = 0; i < DRIPS; i++) seeds[i] = hash(i * 11 + 5);
      drGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    }
    this.drips = new THREE.InstancedMesh(
      drGeo,
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.drU, vertexShader: DRIP_VERT, fragmentShader: DRIP_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      DRIPS,
    );
    this.three.add(this.drips);

    this.frog = new THREE.Mesh(
      new THREE.PlaneGeometry(7.0, 5.6),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.frU, vertexShader: SIL_VERT, fragmentShader: FROG_FRAG, transparent: true, side: THREE.DoubleSide }),
    );
    this.three.add(this.frog);

    this.cam.position.set(0, 7, 30);
    this.cam.lookAt(0, 9, PZ + 10);
  }

  override render(_f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const r = this.ctx.renderer;
    const t = _f.t;
    const mist = mistP(t);
    const fog = fogT(t);
    const light = lightT(t);
    const moon = moonT(t);
    const flex = flexT(t);
    const snail = snailT(t);

    this.bu.uT.value = t;
    this.bu.uMist.value = mist;
    this.bu.uFog.value = fog;
    this.bu.uLight.value = light;
    this.bu.uMoon.value = moon;
    this.bu.uFlex.value = flex;
    this.bu.uSnail.value = snail;
    this.fgU.uT.value = t; this.fgU.uFog.value = fog; this.fgU.uMist.value = mist;
    this.fgU.uMistI.value = mistI(t);
    this.drU.uT.value = t; this.drU.uMist.value = mist;
    this.frU.uT.value = t; this.frU.uHop.value = hopP(t);

    // frog sits on the broad leaf (uv ~0.72,0.20); one hop at ~14s
    const hopY = 0.10 * Math.sin(Math.PI * hopP(t));
    aToV(0.72 + 0.06 * hopP(t), 0.215 + Math.abs(flex) * -0.006 + hopY, this.p);
    this.p.z += 12.0;
    this.frog.position.copy(this.p);

    // slow push through the fog + lookAt drifting leaf → top blossom
    const push = ss(7.5, 15.0, t);
    this.cam.position.set(
      1.2 * Math.sin(t * 0.10),
      7 + push * 1.4,
      30 - push * 7.0,
    );
    this.cam.lookAt(0.5 + push * 2.0, 9 + push * 2.5, PZ + 10);

    // diagnostics: frog + lightbar probes
    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const W = P.width || 1920, H = P.height || 1080;
        this.p.copy(this.frog.position).project(this.cam);
        const cx = (this.p.x * 0.5 + 0.5) * W, cy = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'tree-frog',
          fontFamily: 'Archivo, sans-serif', fontPx: 22,
          fillStyle: '#a8e08a', globalAlpha: 0.9, layerId: 'orchidsteam',
          bbox: [cx - 30, cy - 30, cx + 30, cy + 14],
          w: 60, h: 44, cx, cy, hPct: (44 / H) * 100, isStroke: false,
        });
        aToV(0.5, 0.3225, this.p).project(this.cam);
        const lx = (this.p.x * 0.5 + 0.5) * W, ly = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'grow-bar',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#f0c060', globalAlpha: 0.7, layerId: 'orchidsteam',
          bbox: [lx - 60, ly - 20, lx + 60, ly + 20],
          w: 120, h: 40, cx: lx, cy: ly, hPct: (40 / H) * 100, isStroke: false,
        });
      }
    }

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 0.95 - 0.15 * fog,
      bloom: 0.22 + 0.30 * mist + 0.10 * light,
      bloomThreshold: 0.72,
      bloomRadius: 0.55,
      grade: { saturation: 1.08, gamma: 0.96 },
    } as PostOverrides;
  }

  override dispose() {
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((m as THREE.InstancedMesh).isInstancedMesh) (m as THREE.InstancedMesh).dispose();
      (m.material as THREE.Material | undefined)?.dispose?.();
      (m.geometry as THREE.BufferGeometry | undefined)?.dispose?.();
    });
    super.dispose();
  }
}
