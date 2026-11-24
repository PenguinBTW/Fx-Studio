// kestrelhover — a single kestrel hovering head-to-wind over a chalk hillside
// verge: locked in place while grass, gusts, a skylark and a stoop move around
// it. All motion is closed-form f(t). Authored uv [0,1] is remapped into the
// camera-visible vUv band (x~[0.27,0.73], y~[0.16,0.84]) at BACK_FRAG.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../../engine/scene.js';

const ss = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// --- envelopes (beat times from storyboard.md) -------------------------------
const gustW = (t: number) => ss(4.6, 5.6, t) * (1 - ss(7.4, 8.6, t));      // the big gust
const larkU = (t: number) => ss(8.6, 9.0, t);                               // skylark pops up
const larkLv = (t: number) => ss(10.2, 11.0, t);                            // levels off and exits
const stoopU = (t: number) => Math.min(1, Math.max(0, (t - 12.8) / 0.85));  // dive progress
const retU = (t: number) => ss(15.2, 16.8, t);                              // glide back to hover
const earsW = (t: number) => ss(6.1, 6.3, t) * (1 - ss(6.7, 6.9, t));       // rabbit ears flash
const dipA = (t: number) => ss(3.9, 4.2, t) * (1 - ss(4.8, 5.6, t));        // drop-and-rise 1
const dipB = (t: number) => ss(10.9, 11.2, t) * (1 - ss(11.7, 12.4, t));    // drop-and-rise 2

// Kestrel position — mirror of the GLSL path for the tracking probe.
// Stoop: exits bottom-right; return: glides in from upper-left.
const kestrelXY = (t: number): [number, number] => {
  const u = stoopU(t), v = retU(t);
  let x = 0.52 + 0.003 * Math.sin(t * 7.0) + u * u * 0.34;
  let y = 0.63 + 0.004 * Math.sin(t * 5.3) - 0.045 * dipA(t) - 0.045 * dipB(t) - u * u * 0.75;
  if (v > 0) return [0.22 + 0.30 * v, 1.06 - 0.43 * v]; // glide in from off-frame upper-left
  return [x, y];
};

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
uniform float uGust, uStoop, uRet;
uniform float uLarkU, uLarkLv, uEars, uDipA, uDipB;

float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), u.x),
             mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return v;
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * t);
}

// rolling chalk hillside silhouette
float hillY(float x) {
  return 0.20 + 0.045 * sin(x * 2.6 + 0.8) + 0.02 * sin(x * 7.0);
}
// kestrel piecewise position (mirrors kestrelXY in TS)
vec2 kestrel(float t) {
  float u = uStoop, v = uRet;
  vec2 kp = vec2(0.52 + 0.003 * sin(t * 7.0),
                 0.63 + 0.004 * sin(t * 5.3)
                 - 0.045 * uDipA - 0.045 * uDipB);
  kp += vec2(u * u * 0.34, -u * u * 0.75);
  if (v > 0.0) return mix(vec2(0.22, 1.06), vec2(0.52, 0.63), v);
  return kp;
}


// kestrel silhouette: returns 0..1 body darkness + pale-chest shading in .y
vec2 kestrelSDF(vec2 uv, float t, out float wingL, out float wingR) {
  vec2 kp = kestrel(t);
  vec2 d = uv - kp;
  float inStoop = clamp(uStoop * (1.0 - uRet), 0.0, 1.0);
  // body — small tilted ellipse, pitched into the dive
  float pitch = inStoop * 1.1;
  mat2 R = mat2(cos(pitch), -sin(pitch), sin(pitch), cos(pitch));
  vec2 bd = R * d;
  float body = length(bd / vec2(0.014, 0.022)) ;
  // tail fanned below (closed into a slit during the stoop)
  float fan = 1.0 - inStoop;
  vec2 tp = bd - vec2(0.0, -0.023);
  float tail = max(abs(tp.x) - (0.004 + 0.010 * fan * (1.0 - smoothstep(0.0, 0.024, -tp.y))), tp.y * 0.5);
  tail = max(tail, tp.y);
  tail = max(tail, -0.019 - tp.y);
  // head + beak pointing down while scanning; tucked in stoop
  float headDown = 1.0 - inStoop;
  vec2 hd = bd - vec2(0.0, 0.024 - 0.012 * inStoop);
  float head = length(hd / vec2(0.0105, 0.011));
  // wings: shoulder origin, tip rides a fast flap; folded to a V in the stoop
  float flap = sin(t * 27.0) * (0.55 - 0.35 * inStoop) + 0.15 * sin(t * 54.0 + 1.7);
  float ang = (1.35 + flap) * (1.0 - inStoop) + 2.45 * inStoop;  // radians from +x
  vec2 shL = vec2(-0.007, 0.006), shR = vec2(0.007, 0.006);
  vec2 dirL = vec2(-cos(ang), sin(ang)), dirR = vec2(cos(ang), sin(ang));
  vec2 tL = shL + dirL * 0.046, tR = shR + dirR * 0.046;
  vec2 mL = shL + dirL * 0.026 + vec2(0.0, 0.008), mR = shR + dirR * 0.026 + vec2(0.0, 0.008);
  wingL = min(sdSeg(bd, shL, mL), sdSeg(bd, mL, tL)) - 0.005;
  wingR = min(sdSeg(bd, shR, mR), sdSeg(bd, mR, tR)) - 0.005;
  float sd = min(min(body - 1.0, tail), min(head - 1.0, min(wingL, wingR)));
  float m = 1.0 - smoothstep(-0.0015, 0.0015, sd);
  float chest = m * (1.0 - smoothstep(0.003, 0.017, length(bd - vec2(0.0, -0.006))));
  return vec2(m, chest);
}

void main() {
  vec2 uv = vec2((vUv.x - 0.269) / 0.462, 0.03 + (vUv.y - 0.159) * 1.107);
  float t = uT;

  // ---- pale noon sky, thin drifting cloud streaks, faint sun halo
  vec3 col = mix(vec3(0.62, 0.68, 0.74), vec3(0.78, 0.82, 0.86), uv.y);
  {
    float g1 = (uv.x - 0.30) / 0.16, g2 = (uv.y - 0.86) / 0.10;
    col += vec3(0.10, 0.09, 0.06) * exp(-(g1 * g1 + g2 * g2));
    float h1d = (uv.x - 0.30) / 0.06, h2d = (uv.y - 0.86) / 0.05;
    col += vec3(0.18, 0.16, 0.10) * exp(-(h1d * h1d + h2d * h2d));
  }
  float cl = fbm(vec2(uv.x * 3.0 - t * 0.015, uv.y * 14.0));
  col += vec3(0.06) * smoothstep(0.55, 0.75, cl) * smoothstep(0.55, 0.75, uv.y);

  // ---- distant hedge line
  float hedge = uv.y - (0.40 + 0.008 * sin(uv.x * 9.0) + 0.004 * fbm(vec2(uv.x * 22.0, 3.0)));
  col = mix(vec3(0.13, 0.17, 0.12), col, smoothstep(-0.004, 0.004, hedge));

  // ---- hillside
  float hy = hillY(uv.x);
  float ground = 1.0 - smoothstep(hy - 0.002, hy + 0.002, uv.y);
  vec3 gcol = mix(vec3(0.34, 0.38, 0.24), vec3(0.42, 0.44, 0.28), fbm(uv * 14.0));
  col = mix(col, gcol, ground * 0.9);

  // ---- dry grass verge band: blades leaning right, whipped by gusts
  float verge = (1.0 - smoothstep(0.36, 0.42, uv.y)) * smoothstep(0.12, 0.18, uv.y);
  if (verge > 0.0) {
    float lean = 0.35 + 0.55 * uGust + 0.10 * sin(t * 2.2 + uv.x * 18.0);
    float blade = fract((uv.x + uv.y * lean) * 210.0 + 7.0 * h1(floor(uv.x * 30.0)));
    float b = 1.0 - smoothstep(0.05, 0.25, blade);
    vec3 dry = mix(vec3(0.72, 0.60, 0.30), vec3(0.82, 0.72, 0.40), h2(floor(uv * 60.0)));
    col = mix(col, dry * 0.82, verge * 0.42);          // sun-cured straw band
    col = mix(col, dry, verge * b * 0.55);
    col += verge * 0.06 * (1.0 - smoothstep(0.0, 0.4, fbm(vec2(uv.x * 24.0 - t * (0.4 + 2.0 * uGust), uv.y * 30.0))));
  }

  // ---- torn straw carried across the frame during the gust
  {
    float su = clamp((t - 5.0) / 3.6, 0.0, 1.0);
    vec2 sp = vec2(0.08 + su * 0.86, 0.50 + 0.10 * sin(su * 9.0) + 0.06 * su);
    float straw = (1.0 - smoothstep(0.003, 0.006, sdSeg(uv, sp, sp + vec2(0.010, -0.003))))
                * step(0.0, su) * (1.0 - step(1.0, su));
    col = mix(col, vec3(0.72, 0.66, 0.44), straw * uGust);
  }

  // ---- dust puff drifting along the hedge
  {
    float du = clamp((t - 8.8) / 4.0, 0.0, 1.0);
    vec2 dp = vec2(0.15 + du * 0.55, 0.405 + 0.012 * sin(du * 7.0));
    float puff = fbm((uv - dp) * 38.0 + 3.0) * exp(-length((uv - dp) / vec2(0.05, 0.02)));
    col += vec3(0.12, 0.11, 0.08) * puff * smoothstep(0.0, 0.15, du) * (1.0 - smoothstep(0.7, 1.0, du));
  }

  // ---- skylark: vertical rise from the verge then level-off exit right
  {
    float u = uLarkU; float lv = uLarkLv;
    vec2 lp = vec2(0.36 + lv * 0.68, 0.30 + u * 0.42 * (1.0 - lv) + lv * 0.42);
    vec2 ld = (uv - lp) / vec2(0.012, 0.005);
    float lark = 1.0 - smoothstep(0.5, 0.9, length(ld * vec2(1.0, 0.6)));
    lark *= 0.75 + 0.25 * sin(t * 34.0);      // flutter
    lark *= step(0.001, u) * (1.0 - smoothstep(0.94, 1.02, lp.x));
    col = mix(col, vec3(0.12, 0.10, 0.08), clamp(lark, 0.0, 1.0));
  }

  // ---- rabbit ears flash once in the grass
  {
    float ew = uEars;
    vec2 ep = vec2(0.70, 0.315);
    float e = max(
      1.0 - smoothstep(0.003, 0.007, length((uv - ep + vec2(0.005, -0.009)) / vec2(0.005, 0.012))),
      1.0 - smoothstep(0.003, 0.007, length((uv - ep - vec2(0.005, -0.009)) / vec2(0.005, 0.012))));
    col = mix(col, vec3(0.10, 0.08, 0.06), e * ew);
  }

  // ---- kestrel, locked mid-frame, everything else moving
  {
    float wl, wr;
    vec2 ks = kestrelSDF(uv, t, wl, wr);
    vec3 kcol = vec3(0.13, 0.10, 0.07);
    kcol = mix(kcol, vec3(0.38, 0.30, 0.20), ks.y * 0.8);   // pale chest
    col = mix(col, kcol, ks.x);
  }

  fragColor = vec4(col, 1.0);
}`;

export default class KestrelhoverScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private bu = {
    uT: { value: 0 }, uGust: { value: 0 }, uStoop: { value: 0 }, uRet: { value: 0 },
    uLarkU: { value: 0 }, uLarkLv: { value: 0 }, uEars: { value: 0 },
    uDipA: { value: 0 }, uDipB: { value: 0 },
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
    // tiny drift along the hillside line; kestrel stays compositional center
    this.cam.position.x = Math.sin(t * 0.05) * 1.6;
    this.cam.position.z = 30 - 0.6 * stoopU(t) * (1 - retU(t));
    this.cam.lookAt(this.cam.position.x * 0.4, 7, PZ + 10);

    this.bu.uT.value = t;
    this.bu.uGust.value = gustW(t);
    this.bu.uStoop.value = stoopU(t);
    this.bu.uRet.value = retU(t);
    this.bu.uLarkU.value = larkU(t);
    this.bu.uLarkLv.value = larkLv(t);
    this.bu.uEars.value = earsW(t);
    this.bu.uDipA.value = dipA(t);
    this.bu.uDipB.value = dipB(t);

    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const W = P.width || 1920, H = P.height || 1080;
        this.cam.updateMatrixWorld();
        const [kx, ky] = kestrelXY(t);
      if (ky > -0.02 && ky < 0.99) {
        aToV(kx, ky + 0.015, this.p).project(this.cam);
        const px = (this.p.x * 0.5 + 0.5) * W, py = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'kestrel',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#3a2c1c', globalAlpha: 0.9, layerId: 'kestrelhover',
          bbox: [px - 26, py - 20, px + 26, py + 12],
          w: 52, h: 32, cx: px, cy: py, hPct: (32 / H) * 100, isStroke: false,
        });
      }
        aToV(0.36, 0.34, this.p).project(this.cam);
      const vx = (this.p.x * 0.5 + 0.5) * W, vy = (0.5 - this.p.y * 0.5) * H;
      P.textProbes.push({
        frameIdx: P.currentFrameIdx ?? 0, t, text: 'verge',
        fontFamily: 'Archivo, sans-serif', fontPx: 20,
        fillStyle: '#8a7a46', globalAlpha: 0.7, layerId: 'kestrelhover',
        bbox: [vx - 32, vy - 18, vx + 32, vy + 14],
        w: 64, h: 32, cx: vx, cy: vy, hPct: (32 / H) * 100, isStroke: false,
      });
      }
    }

r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 1.0 + 0.05 * stoopU(t) * (1 - retU(t)),
      bloom: 0.14,
      bloomThreshold: 0.74,
      bloomRadius: 0.5,
      grade: { saturation: 1.05, gamma: 1.0 },
    } as PostOverrides;
  }

  override dispose() {
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      (m.material as THREE.Material | undefined)?.dispose?.();
      (m.geometry as THREE.BufferGeometry | undefined)?.dispose?.();
    });
    super.dispose();
  }
}
