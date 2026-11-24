// fernwell — an overgrown stone wishing well in a garden corner at golden
// hour: ivy on the posts, a robin visiting the bucket, a butterfly crossing
// the flagstones. All motion is closed-form f(t). Authored uv [0,1] is
// remapped into the camera-visible vUv band at BACK_FRAG.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../../engine/scene.js';

const ss = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// --- envelopes (beat times from storyboard.md) -------------------------------
// robin: off → bucket (4.5) → crank (8.4) → gone (11.5)
const robinPos = (t: number): [number, number, number] => {
  // returns x, y, alpha
  if (t < 4.5) return [0.30, 0.95, 0];
  if (t < 5.0) { // flutter in from above-left
    const u = ss(4.5, 5.0, t);
    return [0.30 + (0.50 - 0.30) * u, 0.95 - (0.95 - 0.585) * u, 1];
  }
  if (t < 8.4) return [0.50, 0.585, 1];
  if (t < 8.8) { // hop to the crank
    const u = ss(8.4, 8.8, t);
    return [0.50 + 0.075 * u, 0.585 + 0.05 * u, 1];
  }
  if (t < 10.8) return [0.575, 0.635, 1];
  if (t < 11.5) { // flies off up-right
    const u = ss(10.8, 11.5, t);
    return [0.575 + 0.45 * u, 0.635 + 0.25 * u, 1 - u * 0.3];
  }
  return [1.0, 0.9, 0];
};
const headDip = (t: number) => ss(6.0, 6.25, t) * (1 - ss(6.5, 6.8, t));
const tailFlick = (t: number) => ss(9.4, 9.55, t) * (1 - ss(9.7, 9.9, t));
const buttU = (t: number) => Math.min(1.1, Math.max(0, (t - 13.0) / 3.5));      // butterfly x-drive
const leafU = (t: number) => Math.min(1, Math.max(0, (t - 15.0) / 3.0));       // leaf fall
const beeU = (t: number) => Math.min(1, Math.max(0, (t - 6.5) / 4.0));         // bee along ivy
const wrenU = (t: number) => Math.min(1, Math.max(0, (t - 16.4) / 1.2));       // wren dash
const glintW = (t: number) =>
  ss(2.5, 3.0, t) * (1 - ss(4.0, 4.8, t)) + ss(17.4, 17.9, t) * (1 - ss(18.6, 19.3, t));

const PW = 300, PH = 114, PY = 8, PZ = -80;
const uvToWorld = (ux: number, uy: number, out: THREE.Vector3) =>
  out.set((ux - 0.5) * PW, PY + (uy - 0.5) * PH, PZ);
const aToV = (ux: number, uy: number, out: THREE.Vector3) =>
  uvToWorld(0.269 + ux * 0.462, 0.159 + (uy - 0.03) / 1.107, out);

const BACK_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BACK_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform float uT;
uniform float uHead, uTail, uButt, uLeaf, uBee, uWren, uGlint;
uniform vec3 uRobin;

float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), u.x),
             mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), u.x), u.y);
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
// golden beam: wedge from the hedge gap upper-left sweeping right-down
float beam(vec2 uv) {
  float d = ((1.0 - uv.x) * 0.55 + (1.0 - uv.y) * 0.45) - 0.34;
  float w = exp(-d * d / (0.18 * 0.18)) * (1.0 - smoothstep(0.80, 0.98, uv.y));
  // hedge-gap slats: the beam arrives as raking stripes
  w *= 0.55 + 0.45 * smoothstep(0.30, 0.55, fract((-uv.x * 0.6 - uv.y * 0.8) * 9.0));
  return w;
}

void main() {
  float t = uT;
  vec2 uv = vec2((vUv.x - 0.269) / 0.462, 0.03 + (vUv.y - 0.159) * 1.107);
  vec3 gold = vec3(0.98, 0.64, 0.30);
  vec3 shade = vec3(0.16, 0.17, 0.20);

  // ---- ambient: cool shadow field, warm only where the beam lands
  vec3 col = shade * (0.85 + 0.15 * vnoise(uv * 24.0));
  float bm = beam(uv);
  col = mix(col, gold * 0.85, bm * 0.55);

  // ---- back stone wall (y > 0.55): mossy courses, hairline cracks
  if (uv.y > 0.55) {
    vec3 stone = mix(vec3(0.16, 0.15, 0.14), vec3(0.20, 0.18, 0.15), vnoise(uv * vec2(60.0, 26.0)));
    float cy = abs(fract(uv.y * 22.0) - 0.5);
    stone *= 1.0 - 0.30 * smoothstep(0.42, 0.5, cy);
    float cx = abs(fract(uv.x * 30.0 + floor(uv.y * 22.0) * 0.5) - 0.5);
    stone *= 1.0 - 0.30 * smoothstep(0.44, 0.5, cx);
    // hairline cracks
    float crack = 1.0 - smoothstep(0.001, 0.004,
      abs(uv.x - (0.28 + 0.06 * sin(uv.y * 30.0)) * (uv.y > 0.62 ? 1.0 : 1.0)));
    stone *= 1.0 - 0.4 * crack * step(0.7, h1(floor(uv.x * 9.0)));
    // moss patches
    stone = mix(stone, vec3(0.10, 0.15, 0.07), step(0.72, vnoise(uv * vec2(18.0, 9.0))) * 0.5);
    col = mix(col, stone * (1.0 + bm * 0.7), smoothstep(0.55, 0.555, uv.y));
    // shadow line where the wall meets the garden floor
    col *= 1.0 - 0.5 * exp(-(uv.y - 0.552) * (uv.y - 0.552) / (0.006 * 0.006)) * step(0.50, uv.y);
  }
  // ---- ivy spilling over the wall top + climbing the left post
  {
    float spill = 0.0;
    for (int k = 0; k < 10; k++) {
      float fk = float(k);
      vec2 ic = vec2(0.53 + 0.045 * fk + 0.025 * h1(fk * 3.1), 0.605 + 0.035 * h1(fk * 5.7));
      vec2 iq = (uv - ic) / vec2(0.028 + 0.014 * h1(fk * 9.2), 0.024 + 0.018 * h1(fk * 4.4));
      float b = 1.0 - smoothstep(0.55, 1.05, length(iq + vnoise(uv * 60.0 + fk) * 0.5 - 0.25));
      spill = max(spill, b);
    }
    col = mix(col, vec3(0.045, 0.085, 0.035) * (0.7 + 0.6 * vnoise(uv * 90.0)), spill * 0.95);
    // ivy mass on the left post
    vec2 pq = (uv - vec2(0.44 + 0.008 * sin(uv.y * 40.0), 0.60)) / vec2(0.018, 0.075);
    float ivyPost = 1.0 - smoothstep(0.7, 1.0, length(pq));
    col = mix(col, vec3(0.07, 0.11, 0.05), ivyPost * 0.9);
  }

  // ---- flagstone ground (y < 0.50): seams + long raking shadows
  if (uv.y < 0.50) {
    vec3 flag = vec3(0.13, 0.12, 0.115) + vnoise(uv * vec2(40.0, 26.0)) * 0.05;
    float sx = abs(fract(uv.x * 6.0 + floor(uv.y * 5.0) * 0.5) - 0.5);
    float sy = abs(fract(uv.y * 5.0) - 0.5);
    flag *= 1.0 - 0.28 * smoothstep(0.40, 0.5, max(sx, sy));
    // long shadows raking right-down from the well + posts
    float d1 = (uv.x - 0.50) - (0.50 - uv.y) * 0.9;
    flag *= 1.0 - 0.55 * exp(-d1 * d1 / (0.09 * 0.09));
    col = mix(col, flag * (1.0 + bm * 1.1), (1.0 - smoothstep(0.495, 0.50, uv.y)));
  }

  // ---- dust motes inside the beam
  for (int k = 0; k < 10; k++) {
    float fk = float(k);
    vec2 mp = vec2(h1(fk * 7.3) * 0.7, 0.35 + h1(fk * 3.7) * 0.5);
    mp += vec2(0.008 * sin(t * 0.4 + fk * 2.0), -0.010 * fract(t * 0.03 + fk * 0.37));
    float m = 1.0 - smoothstep(0.0012, 0.0035, length(uv - mp));
    col += gold * m * bm * 0.5 * step(0.3, h1(fk + floor(t * 2.0) * 0.1));
  }

  // ---- ferns at the well base: seeded fronds, subtle sway
  for (int k = 0; k < 7; k++) {
    float fk = float(k);
    float bx = 0.38 + 0.24 * h1(fk * 3.3);
    float dir = (h1(fk * 5.1) - 0.5) * 0.09;
    float len = 0.045 + 0.030 * h1(fk * 7.7);
    float sway = 0.003 * sin(t * 1.1 + fk * 1.3);
    float fr = 1.0 - smoothstep(0.004, 0.009,
      sdSeg(uv, vec2(bx, 0.385), vec2(bx + dir + sway, 0.385 + len)));
    col = mix(col, vec3(0.10, 0.18, 0.08) * (0.8 + 0.7 * bm + 0.3 * h1(fk)), fr * 0.95);
  }
  // one long frond arcing over a flagstone seam
  col = mix(col, vec3(0.10, 0.17, 0.08) * (1.0 + bm * 0.5),
            (1.0 - smoothstep(0.002, 0.005,
              abs(uv.y - (0.40 + 0.025 * sin((uv.x - 0.30) * 18.0))))) *
              step(0.30, uv.x) * step(uv.x, 0.44) * 0.85);

  // ---- the well: drum, mouth (with beat-gated water glint), posts, roof, rope, bucket
  {
    // drum of rough-cut stone
    float drum = step(abs(uv.x - 0.50), 0.075) * smoothstep(0.36, 0.365, uv.y) * step(uv.y, 0.50);
    vec3 dstone = vec3(0.22, 0.20, 0.18) * (0.8 + 0.4 * vnoise(uv * vec2(50.0, 40.0)));
    float dj = abs(fract(uv.y * 40.0) - 0.5);
    dstone *= 1.0 - 0.3 * smoothstep(0.4, 0.5, dj);
    col = mix(col, dstone * (1.0 + bm * 0.8), drum * 0.97);
    // mouth ellipse + water glint on the beat
    vec2 mq = (uv - vec2(0.50, 0.505)) / vec2(1.0, 0.32);
    float mouth = 1.0 - smoothstep(0.068, 0.078, length(mq));
    col = mix(col, vec3(0.03, 0.03, 0.04), mouth * 0.97);
    col += vec3(0.9, 0.75, 0.5) * (1.0 - smoothstep(0.01, 0.03, length((uv - vec2(0.495, 0.505)) / vec2(2.0, 1.0)))) * uGlint;
    // posts
    float post = (1.0 - smoothstep(0.005, 0.010, abs(uv.x - 0.44)) +
                  1.0 - smoothstep(0.005, 0.010, abs(uv.x - 0.56))) *
                 smoothstep(0.50, 0.51, uv.y) * step(uv.y, 0.665);
    col = mix(col, vec3(0.13, 0.09, 0.05) * (1.0 + bm * 0.6), clamp(post, 0.0, 1.0));
    // peaked timber roof
    float roof = step(uv.y, 0.72 - abs(uv.x - 0.50) * 0.55) * step(0.64, uv.y) * step(abs(uv.x - 0.50), 0.115);
    col = mix(col, vec3(0.16, 0.10, 0.05) * (1.0 + bm * 1.2), roof * 0.97);
    // crank on the right post
    col = mix(col, vec3(0.10, 0.08, 0.06),
              (1.0 - smoothstep(0.003, 0.006, sdSeg(uv, vec2(0.56, 0.60), vec2(0.585, 0.615)))) +
              (1.0 - smoothstep(0.005, 0.009, length(uv - vec2(0.585, 0.615)))));
    // rope + bucket (slight sway)
    float sway = 0.006 * sin(t * 0.9);
    col = mix(col, vec3(0.08, 0.07, 0.05),
              1.0 - smoothstep(0.0012, 0.003, sdSeg(uv, vec2(0.50, 0.665), vec2(0.50 + sway, 0.605))));
    vec2 bk = vec2(0.50 + sway, 0.585);
    float bucket = step(abs(uv.x - bk.x), 0.012) * smoothstep(0.565, 0.57, uv.y) * step(uv.y, 0.60);
    bucket = max(bucket, step(abs(uv.x - bk.x), 0.014) * step(abs(uv.y - 0.60), 0.003));
    col = mix(col, vec3(0.12, 0.08, 0.05) * (1.0 + bm * 1.3), bucket);
    // bucket rim catching the beam
    col += gold * (1.0 - smoothstep(0.0015, 0.004, abs(uv.y - 0.60))) *
           step(abs(uv.x - bk.x), 0.013) * bm * 0.5;
  }
  // ivy tendril tapping the roof edge — drawn over the roof so it reads
  {
    float tw = 0.004 * sin(t * 1.7);
    col = mix(col, vec3(0.08, 0.12, 0.06),
              1.0 - smoothstep(0.002, 0.005, sdSeg(uv, vec2(0.44, 0.665), vec2(0.465 + tw, 0.645))));
  }

  // ---- bee working along the wall ivy
  if (uBee > 0.0 && uBee < 1.0) {
    vec2 bp = vec2(0.60 + 0.30 * uBee, 0.60 + 0.02 * sin(uBee * 20.0));
    col += gold * (1.0 - smoothstep(0.004, 0.008, length((uv - bp) / vec2(1.5, 1.0)))) * 0.7;
  }

  // ---- butterfly crossing low over the flagstones
  if (uButt > 0.0 && uButt < 1.0) {
    vec2 bp = vec2(0.02 + 0.9 * uButt, 0.40 + 0.03 * sin(uButt * 14.0));
    float fl = abs(sin(t * 10.0));
    float w1 = 1.0 - smoothstep(0.003, 0.007, length((uv - (bp + vec2(-0.008, 0.004 * fl))) / vec2(1.4, 0.9)));
    float w2 = 1.0 - smoothstep(0.003, 0.007, length((uv - (bp + vec2(0.008, 0.004 * fl))) / vec2(1.4, 0.9)));
    col = mix(col, vec3(0.55, 0.35, 0.15), max(w1, w2) * 0.9);
  }

  // ---- wren dashing along the wall top
  if (uWren > 0.0 && uWren < 1.0) {
    vec2 wp = vec2(0.20 + 0.75 * uWren, 0.575);
    float wb = 1.0 - smoothstep(0.005, 0.009, length((uv - wp) / vec2(1.7, 0.85)));
    float wh = 1.0 - smoothstep(0.003, 0.005, length((uv - (wp + vec2(-0.008, 0.008))) / vec2(1.0, 1.0)));
    col = mix(col, vec3(0.06, 0.05, 0.04), max(wb, wh) * 0.9);
  }

  // ---- single leaf spiralling down off the ivy
  if (uLeaf > 0.0 && uLeaf < 1.0) {
    vec2 lp = vec2(0.72 + 0.05 * uLeaf + 0.020 * sin(uLeaf * 12.0), 0.615 - 0.21 * uLeaf);
    float lf = 1.0 - smoothstep(0.004, 0.008, length((uv - lp) / vec2(1.0, 1.5)));
    col = mix(col, vec3(0.14, 0.20, 0.08), lf * 0.9);
  }

  // ---- the robin: silhouette, head-dip + tail-flick beats
  if (uRobin.z > 0.01) {
    vec2 rc = uRobin.xy;
    float dip = uHead * 0.008;
    float body = 1.0 - smoothstep(0.010, 0.016, length((uv - rc) / vec2(1.0, 1.3)));
    float head = 1.0 - smoothstep(0.006, 0.010, length((uv - (rc + vec2(-0.006, 0.016 - dip))) / vec2(1.0, 1.0)));
    float beak = 1.0 - smoothstep(0.0015, 0.004, sdSeg(uv, rc + vec2(-0.012, 0.014 - dip), rc + vec2(-0.020, 0.012 - dip)));
    float tail = 1.0 - smoothstep(0.002, 0.006, sdSeg(uv, rc + vec2(0.012, 0.006), rc + vec2(0.024, 0.016 + uTail * 0.012)));
    col = mix(col, vec3(0.05, 0.04, 0.035), clamp(body + head + beak + tail, 0.0, 1.0) * uRobin.z * 0.95);
  }

  fragColor = vec4(col, 1.0);
}`;

export default class FernwellScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private bu = {
    uT: { value: 0 }, uHead: { value: 0 }, uTail: { value: 0 },
    uButt: { value: 0 }, uLeaf: { value: 0 }, uBee: { value: 0 },
    uWren: { value: 0 }, uGlint: { value: 0 },
    uRobin: { value: new THREE.Vector3(0, 0, 0) },
  };
  private p = new THREE.Vector3();

  constructor(ctx: SceneCtx) {
    super(ctx);
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.bu, vertexShader: BACK_VERT, fragmentShader: BACK_FRAG }),
    );
    uvToWorld(0.5, 0.5, quad.position);
    this.three.add(quad);
    this.cam.position.set(0, 4.5, 30);
    this.cam.lookAt(0, 7, PZ + 10);
  }

  override render(_f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const r = this.ctx.renderer;
    const t = _f.t;
    this.cam.aspect = out.width / out.height;
    this.cam.updateProjectionMatrix();
    // low near-static; slight drift toward the well
    this.cam.position.x = -1.2 + t * 0.10;
    this.cam.lookAt(this.cam.position.x * 0.35 + 0.5, 6.8, PZ + 10);

    const [rx, ry, ra] = robinPos(t);
    this.bu.uT.value = t;
    this.bu.uHead.value = headDip(t);
    this.bu.uTail.value = tailFlick(t);
    this.bu.uButt.value = buttU(t);
    this.bu.uLeaf.value = leafU(t);
    this.bu.uBee.value = beeU(t);
    this.bu.uWren.value = wrenU(t);
    this.bu.uGlint.value = glintW(t);
    this.bu.uRobin.value.set(rx, ry, ra);

    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const W = P.width || 1920, H = P.height || 1080;
        this.cam.updateMatrixWorld();
        if (ra > 0.01 && rx > -0.02 && rx < 0.99) {
          aToV(rx, ry + 0.02, this.p).project(this.cam);
          const px = (this.p.x * 0.5 + 0.5) * W, py = (0.5 - this.p.y * 0.5) * H;
          P.textProbes.push({
            frameIdx: P.currentFrameIdx ?? 0, t, text: 'robin',
            fontFamily: 'Archivo, sans-serif', fontPx: 20,
            fillStyle: '#1c1a18', globalAlpha: 0.9, layerId: 'fernwell',
            bbox: [px - 26, py - 20, px + 26, py + 12],
            w: 52, h: 32, cx: px, cy: py, hPct: (32 / H) * 100, isStroke: false,
          });
        }
        aToV(0.50, 0.50, this.p).project(this.cam);
        const wx = (this.p.x * 0.5 + 0.5) * W, wy = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'well',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#4a4038', globalAlpha: 0.75, layerId: 'fernwell',
          bbox: [wx - 26, wy - 18, wx + 26, wy + 14],
          w: 52, h: 32, cx: wx, cy: wy, hPct: (32 / H) * 100, isStroke: false,
        });
      }
    }

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 1.05,
      bloom: 0.15,
      bloomThreshold: 0.68,
      bloomRadius: 0.5,
      grade: { saturation: 1.08, gamma: 1.0 },
    } as PostOverrides;
  }

  override dispose() {
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      (m.material as THREE.Material | undefined)?.dispose?.();
      (m.geometry as THREE.BufferGeometry | undefined)?.dispose?.();
    });
  }
}
