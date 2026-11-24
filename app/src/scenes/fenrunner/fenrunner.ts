// fenrunner — dusk fenland: a Chinese water deer trotting the near bank of a
// reed-fringed drain while mist sits on the water. All motion is closed-form
// f(t). Authored uv [0,1] is remapped into the camera-visible vUv band
// (x~[0.27,0.73], y~[0.16,0.84]) at BACK_FRAG.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../../engine/scene.js';

const ss = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// --- envelopes (beat times from storyboard.md) -------------------------------
const deerWalk = (t: number) => {
  // enters at t=3, walks to 0.5 by 9.5, pauses to look 9.5–13, exits by 16.5
  if (t < 3.0) return 0.0;
  if (t < 9.5) return 0.5 * (t - 3.0) / 6.5;
  if (t < 13.0) return 0.5;
  return Math.min(1, 0.5 + (t - 13.0) / 3.5 * 0.5);
};
const lookW = (t: number) => ss(9.5, 10.2, t) * (1 - ss(12.4, 13.0, t));   // pause-and-look
const owlU = (t: number) => Math.min(1, Math.max(0, (t - 5.0) / 9.0));     // owl quarters once
const fishW = (t: number) => ss(7.8, 8.0, t) * (1 - ss(8.8, 9.2, t));      // fish rise rings
const moorU = (t: number) => Math.min(1, Math.max(0, (t - 12.0) / 4.0));   // moorhen crosses
const gustW = (t: number) => ss(5.8, 6.4, t) * (1 - ss(7.4, 8.0, t));      // reed gust beat
const starU = (t: number) => ss(10.0, 18.0, t);                            // star pricks through

const deerX = (t: number) => 1.06 - 0.64 * deerWalk(t);                    // 1.06 → 0.42
const deerY = (t: number) =>
  0.285 - 0.030 * deerWalk(t) + (deerWalk(t) > 0 && deerWalk(t) < 1 && lookW(t) < 0.5 ? 0.004 * Math.abs(Math.sin(t * 9.0)) : 0);

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
uniform float uWalk, uLook, uOwl, uFish, uMoor, uGust, uStar;
uniform vec2 uDeer;

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
// drain centerline + half-width (diagonal, wider near camera left)
float drainC(float x) { return 0.215 + 0.13 * x; }
float drainW(float x) { return 0.052 + 0.035 * x; }
// deer silhouette: returns body/leg/head coverage
vec3 deer(vec2 uv, vec2 c, float walk, float look, float t) {
  float gait = (walk > 0.0 && walk < 1.0 && look < 0.5) ? sin(t * 9.0) : 0.0;
  // body: low-slung ellipse
  float body = 1.0 - smoothstep(0.010, 0.016, length((uv - c) / vec2(2.1, 1.0)));
  // neck + head, angled toward the water on the pause
  vec2 hd = c + vec2(-0.030, 0.012 - 0.012 * look);
  float neck = 1.0 - smoothstep(0.004, 0.008, sdSeg(uv, c + vec2(-0.014, 0.002), hd));
  float head = 1.0 - smoothstep(0.005, 0.009, length((uv - hd) / vec2(1.5, 1.0)));
  // ears: occasional flick
  float fl = step(0.92, fract(t * 0.5)) * 0.003;
  float ear = 1.0 - smoothstep(0.0015, 0.004, sdSeg(uv, hd + vec2(0.002, 0.004), hd + vec2(0.006, 0.011 + fl)));
  // legs: two pairs phase-offset
  float legs = 0.0;
  for (int i = 0; i < 4; i++) {
    float ph = gait * (mod(float(i), 2.0) * 2.0 - 1.0);
    vec2 hip = c + vec2(-0.012 + floor(float(i) / 2.0) * 0.020, -0.006);
    vec2 foot = hip + vec2(ph * 0.004, -0.020);
    legs = max(legs, 1.0 - smoothstep(0.0018, 0.0045, sdSeg(uv, hip, foot)));
  }
  float tail = 1.0 - smoothstep(0.0018, 0.005, sdSeg(uv, c + vec2(0.024, 0.002), c + vec2(0.030, 0.006)));
  return vec3(clamp(body + neck + head + ear + legs + tail, 0.0, 1.0), 0.0, 0.0);
}

void main() {
  float t = uT;
  vec2 uv = vec2((vUv.x - 0.269) / 0.462, 0.03 + (vUv.y - 0.159) * 1.107);

  // ---- dusk sky: steel above, rose afterglow strip on the horizon
  vec3 col = mix(vec3(0.30, 0.34, 0.42), vec3(0.16, 0.19, 0.26), smoothstep(0.55, 0.95, uv.y));
  float gy = uv.y - 0.565;
  float glow = exp(-gy * gy / (0.045 * 0.045));
  col = mix(col, vec3(0.72, 0.44, 0.42), glow * 0.75);
  col = mix(col, vec3(0.82, 0.58, 0.50), exp(-(uv.y - 0.55) * (uv.y - 0.55) / (0.015 * 0.015)) * 0.5);
  // one faint star pricking through late
  {
    float d = length(uv - vec2(0.30, 0.80));
    float st = 1.0 - smoothstep(0.0012, 0.0028, d);
    col += vec3(0.9, 0.9, 0.95) * st * uStar * (0.6 + 0.4 * sin(t * 2.4));
  }

  // ---- far reed bank: dense vertical strokes above the drain
  {
    float inBank = smoothstep(0.0, 0.006, uv.y - drainC(uv.x) - drainW(uv.x));
    if (inBank > 0.0) {
      // thin dark strokes — density from a 3-per-cell jitter, not thick bars
      float bankLine = drainC(uv.x) + drainW(uv.x);
      float inReed = 0.0;
      for (int k = 0; k < 3; k++) {
        float cell = floor(uv.x * 220.0 + float(k) * 0.7);
        float rx = (cell + 0.3 + 0.4 * h1(cell * 3.1 + float(k))) / 220.0;
        float rh = 0.030 + 0.030 * h1(cell * 1.9 + float(k) * 7.0);
        float top = bankLine + rh;
        float sway = 0.005 * sin(t * 1.2 + cell) * (1.0 + uGust * 3.0 * step(0.7, h1(cell * 3.3)));
        float reed = (1.0 - smoothstep(0.0012, 0.0030, abs(uv.x - rx - sway * (uv.y - bankLine) * 25.0))) *
                     smoothstep(bankLine - 0.004, bankLine, uv.y) * (1.0 - smoothstep(top - 0.004, top, uv.y)) *
                     step(0.30, h1(cell * 7.7 + float(k)));
        inReed = max(inReed, reed);
        // small dark seed heads on some reeds
        float head = reed * step(0.55, h1(cell * 11.0 + float(k))) *
                     (1.0 - smoothstep(0.003, 0.007, abs(uv.y - top + 0.004)));
        col = mix(col, vec3(0.16, 0.13, 0.10), head * inBank * 0.9);
      }
      col = mix(col, vec3(0.09, 0.11, 0.09), inReed * inBank);
      // dark willow clumps pollarded along the far bank line
      float wn = floor(uv.x * 9.0);
      if (h1(wn * 3.1) > 0.55) {
        float wx = (wn + 0.5) / 9.0;
        float wy = drainC(wx) + drainW(wx);
        vec2 wc = vec2(wx, wy + 0.030);
        float trunk = 1.0 - smoothstep(0.002, 0.005, sdSeg(uv, vec2(wx, wy), wc));
        float wl = 1.0 - smoothstep(0.012, 0.020, length((uv - wc) / vec2(1.0, 1.2)));
        col = mix(col, vec3(0.07, 0.08, 0.08), max(trunk, wl) * inBank * 0.9);
      }
    }
  }

  // ---- the drain: pale ribbon catching the afterglow + slow drift + mist
  {
    float dd = uv.y - drainC(uv.x);
    float inW = 1.0 - smoothstep(drainW(uv.x) - 0.006, drainW(uv.x), abs(dd));
    if (inW > 0.0) {
      vec3 water = mix(vec3(0.22, 0.24, 0.30), vec3(0.62, 0.44, 0.44), glow);
      water += vnoise(vec2(uv.x * 40.0 - t * 0.8, uv.y * 60.0)) * 0.04;
      // fish rise: expanding ripple rings near the far bank
      if (uFish > 0.0) {
        vec2 fp = vec2(0.68, drainC(0.68) + 0.02);
        float rd = length((uv - fp) / vec2(1.0, 0.35));
        float ring = abs(fract(rd * 30.0 - (t - 8.0) * 3.0) - 0.5);
        water += vec3(0.7) * (1.0 - smoothstep(0.05, 0.15, ring)) * (1.0 - smoothstep(0.01, 0.05, rd)) * uFish * 0.35;
      }
      col = mix(col, water, inW);
      // moorhen crossing
      if (uMoor > 0.0 && uMoor < 1.0) {
        vec2 mp = vec2(0.52 + 0.10 * uMoor, drainC(0.52 + 0.10 * uMoor));
        float mh = 1.0 - smoothstep(0.004, 0.008, length((uv - mp) / vec2(1.6, 1.0)));
        col = mix(col, vec3(0.08, 0.07, 0.08), mh * 0.95);
        // wake
        col = mix(col, col * 1.25, (1.0 - smoothstep(0.002, 0.006, abs(uv.y - mp.y))) *
                  (1.0 - smoothstep(0.0, 0.02, mp.x - uv.x)) * 0.3);
      }
      // low mist sheet hugging the water, drifting right
      float mist = vnoise(vec2(uv.x * 8.0 - t * 0.15, uv.y * 30.0)) *
                   exp(-(dd - 0.015) * (dd - 0.015) / (0.030 * 0.030));
      col = mix(col, vec3(0.55, 0.56, 0.60), clamp(mist * 0.55, 0.0, 0.5) * inW);
    }
  }

  // ---- near bank: darker grass strip below the drain
  {
    float inNear = 1.0 - smoothstep(0.0, 0.006, uv.y - drainC(uv.x) + drainW(uv.x));
    vec3 grass = vec3(0.13, 0.14, 0.11) + vnoise(uv * 70.0) * 0.03;
    col = mix(col, grass, inNear * 0.95);
    // sparse near reeds, a near cluster swaying wider on the gust
    float rn = floor(uv.x * 130.0);
    float near = step(0.55, h1(rn * 9.7));
    float rh = 0.020 + 0.018 * h1(rn * 2.3);
    float gustNear = step(0.75, h1(rn * 5.5)) * uGust;
    float lean = 0.006 * sin(t * 1.6 + rn) * (1.0 + gustNear * 4.0);
    float top = drainC(uv.x) - drainW(uv.x) - 0.004;
    float reed = near * (1.0 - smoothstep(0.0018, 0.004, abs(uv.x - rn / 130.0 - 0.004 - lean * (uv.y - top) * 40.0))) *
                 smoothstep(top - rh, top, uv.y) * (1.0 - smoothstep(top, top + 0.002, uv.y));
    col = mix(col, vec3(0.09, 0.10, 0.08), reed * inNear);
  }

  // ---- barn owl quartering once, dim and far
  if (uOwl > 0.0 && uOwl < 1.0) {
    float a = uOwl * 6.2831853 * 1.5;
    vec2 oc = vec2(0.50 + 0.30 * sin(a), 0.66 + 0.05 * cos(a * 0.7));
    vec2 w1 = oc + vec2(-0.022, 0.010 * sin(t * 5.0));
    vec2 w2 = oc + vec2(0.022, -0.010 * sin(t * 5.0));
    float ow = max(1.0 - smoothstep(0.003, 0.007, sdSeg(uv, w1, w2)),
                   1.0 - smoothstep(0.003, 0.006, length((uv - oc) / vec2(2.0, 0.8))));
    col = mix(col, vec3(0.30, 0.30, 0.32), ow * 0.5);
  }

  // ---- the deer: trot in, pause-and-look, exit behind the willow
  if (uWalk > 0.0) {
    float behindWillow = 0.0;
    vec3 d = deer(uv, uDeer, uWalk, uLook, t);
    col = mix(col, vec3(0.07, 0.06, 0.06), d.x * 0.92);
    // willow clump it slips behind
    vec2 wc = vec2(0.40, 0.285);
    float wl = 1.0 - smoothstep(0.018, 0.028, length((uv - wc) / vec2(1.0, 1.35)));
    col = mix(col, vec3(0.07, 0.08, 0.07), wl * 0.95);
  }
  // near willow trunk line along the bank (foreground silhouettes)
  {
    float wn = floor(uv.x * 7.0 + 0.5);
    if (h1(wn * 7.3) > 0.62) {
      float wx = (wn + 0.5) / 7.0;
      float wy = drainC(wx) - drainW(wx) - 0.01;
      float trunk = 1.0 - smoothstep(0.004, 0.009, sdSeg(uv, vec2(wx, wy - 0.05), vec2(wx, wy + 0.015)));
      float crown = 1.0 - smoothstep(0.014, 0.026, length((uv - vec2(wx, wy + 0.025)) / vec2(1.0, 1.2)));
      col = mix(col, vec3(0.09, 0.10, 0.09), max(trunk, crown) * 0.85);
    }
  }

  fragColor = vec4(col, 1.0);
}`;

export default class FenrunnerScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private bu = {
    uT: { value: 0 }, uWalk: { value: 0 }, uLook: { value: 0 }, uOwl: { value: 0 },
    uFish: { value: 0 }, uMoor: { value: 0 }, uGust: { value: 0 }, uStar: { value: 0 },
    uDeer: { value: new THREE.Vector2(0, 0) },
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
    // low near-static; drift along the drain direction
    this.cam.position.x = -2.0 + t * 0.16;
    this.cam.lookAt(this.cam.position.x * 0.4 + 0.8, 6.8, PZ + 10);

    this.bu.uT.value = t;
    this.bu.uWalk.value = deerWalk(t);
    this.bu.uLook.value = lookW(t);
    this.bu.uOwl.value = owlU(t);
    this.bu.uFish.value = fishW(t);
    this.bu.uMoor.value = moorU(t);
    this.bu.uGust.value = gustW(t);
    this.bu.uStar.value = starU(t);
    this.bu.uDeer.value.set(deerX(t), deerY(t));

    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const W = P.width || 1920, H = P.height || 1080;
        this.cam.updateMatrixWorld();
        const dx = deerX(t), dy = deerY(t);
        if (deerWalk(t) > 0 && dx > -0.02 && dx < 0.99) {
          aToV(dx, dy + 0.03, this.p).project(this.cam);
          const px = (this.p.x * 0.5 + 0.5) * W, py = (0.5 - this.p.y * 0.5) * H;
          P.textProbes.push({
            frameIdx: P.currentFrameIdx ?? 0, t, text: 'deer',
            fontFamily: 'Archivo, sans-serif', fontPx: 20,
            fillStyle: '#1c1a18', globalAlpha: 0.9, layerId: 'fenrunner',
            bbox: [px - 26, py - 20, px + 26, py + 12],
            w: 52, h: 32, cx: px, cy: py, hPct: (32 / H) * 100, isStroke: false,
          });
        }
        aToV(0.52, 0.30, this.p).project(this.cam);
        const wx = (this.p.x * 0.5 + 0.5) * W, wy = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'drain',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#6a5a5c', globalAlpha: 0.7, layerId: 'fenrunner',
          bbox: [wx - 32, wy - 18, wx + 32, wy + 14],
          w: 64, h: 32, cx: wx, cy: wy, hPct: (32 / H) * 100, isStroke: false,
        });
      }
    }

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 1.0,
      bloom: 0.14,
      bloomThreshold: 0.72,
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
