// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// sandwave — desert dunes at dusk. A near-static long-lens frame: layered
// ridged dune silhouettes recede into warm haze while fine ripple striations
// migrate leeward across the nearest crest. ~300 instanced ticks are
// saltating sand grains: hash-seeded closed-form hop arcs hugging the front
// crest, brightening as they crest into the light, swelling under a gust
// envelope mid-take. One cold accent: a pale planet rising in the amber sky.
// Everything is a deterministic f(t) — no accumulators, no Math.random.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const frac = (x: number) => x - Math.floor(x);

// The front crest in uv space, duplicated verbatim in the fragment shader —
// grains sit on it in 3D, so the two must stay identical.
const CREST_GLSL = `
float crestFront(float x, float t) {
  float p = x + t * 0.004;                      // slow leeward migration
  return 0.265 + 0.040 * sin(p * 6.5 + 1.3)
              + 0.022 * sin(p * 13.7 + 4.1)
              + 0.011 * sin(p * 31.3 + 2.7);
}`;
const crestFront = (x: number, t: number) => {
  const p = x + t * 0.004;
  return 0.265 + 0.040 * Math.sin(p * 6.5 + 1.3)
             + 0.022 * Math.sin(p * 13.7 + 4.1)
             + 0.011 * Math.sin(p * 31.3 + 2.7);
};

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
out vec4 fragColor;

float hash1(float p) { return fract(sin(p * 127.1) * 43758.5453123); }
float vnoise(float x) {
  float i = floor(x), f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash1(i), hash1(i + 1.0), u);
}
float ridge(float x) { return 1.0 - abs(2.0 * vnoise(x) - 1.0); }
float rfbm(float x) {
  return ridge(x) * 0.6 + ridge(x * 2.13 + 17.7) * 0.3 + ridge(x * 5.3 + 43.1) * 0.1;
}
${CREST_GLSL}

void main() {
  float x = vUv.x;
  float y = vUv.y;
  float t = uT;

  // --- dusk sky ---------------------------------------------------------
  vec3 amber  = vec3(0.62, 0.26, 0.07);
  vec3 rose   = vec3(0.30, 0.11, 0.14);
  vec3 indigo = vec3(0.14, 0.12, 0.30);
  vec3 col = mix(amber, rose, smoothstep(0.44, 0.66, y));
  col = mix(col, indigo, smoothstep(0.72, 1.02, y));
  // last-light band hugging the dune horizon
  col += vec3(0.42, 0.16, 0.03) * exp(-(y - 0.56) * (y - 0.56) * 90.0);

  // pale cold planet — the single cool accent, slowly brightening
  vec2 pd = vec2(x - 0.74, y - 0.72);
  float pr = length(pd);
  float planet = smoothstep(0.014, 0.010, pr) + 0.35 * exp(-pr * pr * 3000.0);
  col += vec3(0.62, 0.70, 0.82) * planet * (0.25 + 0.75 * smoothstep(2.0, 10.0, t));

  // faint high stars
  vec2 sg = floor(vUv * vec2(240.0, 130.0));
  float star = step(0.9978, hash1(sg.x * 61.7 + sg.y * 389.1));
  col += vec3(0.8, 0.85, 1.0) * star * smoothstep(0.7, 0.95, y) * 0.3;

  // --- receding dune layers (long-lens stacked silhouettes) -------------
  // far → near; each crest drifts a little slower so depth reads as parallax
  float sunLow = smoothstep(11.5, 14.0, t) * (1.0 - smoothstep(16.0, 18.5, t));
  for (int j = 3; j >= 0; j--) {
    float fj = float(j);
    float base = 0.555 - (3.0 - fj) * 0.085;
    float amp  = 0.030 + fj * 0.012;
    float cr = base + amp * rfbm(x * (3.0 + fj * 1.4) + fj * 13.1 + t * (0.0012 + fj * 0.0008));
    float below = 1.0 - smoothstep(cr - 0.002, cr + 0.002, y);
    // near layers are dark silhouettes; far layers dissolve into the haze
    float haze = 0.16 + fj * 0.26;
    vec3 duneCol = mix(vec3(0.09, 0.05, 0.035), vec3(0.40, 0.19, 0.08), haze);
    col = mix(col, duneCol, below * (0.45 + 0.55 * (1.0 - haze)));
    // thin crest rim of last light on each layer, stretched at low sun
    float rim = below * exp(-max(0.0, cr - y) * (420.0 - 250.0 * sunLow)) * (0.08 + 0.30 * sunLow + 0.08 * fj / 3.0);
    col += vec3(0.95, 0.45, 0.15) * rim;
  }

  // --- front dune: rippled face + crest highlight -----------------------
  float cf = crestFront(x, t);
  float face = 1.0 - smoothstep(cf - 0.004, cf + 0.004, y);
  vec3 faceCol = vec3(0.16, 0.075, 0.035);
  // faint cool shadow tint on the lee side — the second half of the accent
  faceCol = mix(faceCol, vec3(0.07, 0.08, 0.12), 0.35);
  col = mix(col, faceCol, face * 0.96);
  // ripple striations migrating leeward; phase-bent by the face slope
  float bend = (cf - 0.265) * 30.0;
  float rip = sin(x * 320.0 + bend + (cf - y) * 260.0 - t * 0.9);
  float ripMask = face * smoothstep(0.0, 0.03, cf - y) * (1.0 - smoothstep(0.10, 0.16, cf - y));
  col *= 1.0 - ripMask * (0.5 + 0.5 * rip) * 0.30;
  // crest highlight, stretched hard while the sun is low
  float hl = face * exp(-max(0.0, cf - y) * (320.0 - 180.0 * sunLow)) * (0.12 + 0.5 * sunLow);
  col += vec3(1.0, 0.5, 0.18) * hl;
  // ground haze at the very bottom
  col = mix(col, vec3(0.05, 0.035, 0.03), (1.0 - smoothstep(0.0, 0.12, y)) * 0.8);

  fragColor = vec4(col, 1.0);
}`;

const GRAINS = 300;
// Backdrop plane mapping (must match the mesh below): uv → world.
const PW = 260, PH = 114, PY = 8, PZ = -80;
const uvToWorld = (ux: number, uy: number, out: THREE.Vector3) =>
  out.set((ux - 0.5) * PW, PY + (uy - 0.5) * PH, PZ + 0.05);

// Gust envelope: baseline breathing + the mid-take swell at ~t 6.5–12.
const gust = (t: number) =>
  0.30 + 0.10 * Math.sin(t * 0.9) + 0.08 * Math.sin(t * 0.53 + 1.7)
  + 0.65 * ss(5.0, 8.5, t) * (1 - ss(11.5, 15.0, t));

export default class SandwaveScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private u = { uT: { value: 0 } };
  private grains: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private p = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(40, ctx.W / ctx.H, 0.1, 400);

    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, glslVersion: THREE.GLSL3 }),
    );
    back.position.set(0, PY, PZ);
    this.three.add(back);

    // saltating sand: thin bright ticks, colour set per-frame as they crest
    const geo = new THREE.BoxGeometry(0.9, 0.09, 0.05);
    this.grains = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), GRAINS);
    this.grains.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.grains.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GRAINS * 3), 3);
    this.grains.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.three.add(this.grains);
  }

  // Closed-form grain position: a hop arc riding the front crest, plus slow
  // leeward migration (frac wrap re-enters grains off-frame — saltation
  // never ends). Hop phase, rate, height and drift are hash seeds.
  private grainPos(i: number, t: number, g: number, out: THREE.Vector3) {
    const u = frac(i * 0.6180339887);
    const v = frac(i * 0.7548776662);
    const w = frac(i * 0.5698402909);
    const x = frac(u + (0.006 + 0.010 * v) * t);
    const rate = 1.4 + 1.6 * w;
    const th = frac(t * rate + v * 7.13);
    const hop = 4 * th * (1 - th);
    const hopH = (0.004 + 0.007 * w) * (0.3 + 0.7 * g);
    const y = crestFront(x, t) + hopH * hop;
    uvToWorld(x, y, out);
    return hop;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    const g = gust(t);
    const lit = 0.35 + 0.65 * ss(11.0, 14.5, t);   // cresting grains catch more light at low sun
    for (let i = 0; i < GRAINS; i++) {
      const hop = this.grainPos(i, t, g, this.p);
      const s = 0.5 + 0.9 * hop * g;
      this.m.makeScale(s, s, s).setPosition(this.p);
      this.grains.setMatrixAt(i, this.m);
      const b = (0.03 + 0.55 * hop * hop * g) * lit;
      this.c.setRGB(b, b * 0.55, b * 0.28);
      this.grains.setColorAt(i, this.c);
    }
    this.grains.instanceMatrix.needsUpdate = true;
    this.grains.instanceColor!.needsUpdate = true;

    // near-static long lens: a breath of drift and a slow push
    const push = ss(0, this.ctx.end, t);
    this.cam.position.set(0.6 * Math.sin(t * 0.03), 7.2 - 0.4 * push, 22.0 - 0.8 * push);
    this.cam.lookAt(0, 11.0, PZ);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 0.55,
      bloom: 0.3,
      bloomThreshold: 0.5,
      bloomRadius: 0.7,
      ca: 0.12,
      grain: 0.06,
      vignette: 0.5,
      level: ss(0, 0.9, t) * (1 - ss(this.ctx.end - 0.9, this.ctx.end, t)),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.grains.dispose();
    this.three.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}
