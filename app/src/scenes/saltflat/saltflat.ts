// saltflat — a cracked salt flat at dawn; one walker trails a kite-string of
// light to a small diamond kite. All motion is closed-form f(t). Authored uv
// [0,1] is remapped into the camera-visible vUv band (x~[0.27,0.73],
// y~[0.16,0.84]) at the BACK_FRAG call site.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../../engine/scene.js';

const ss = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// --- envelopes (beat times from storyboard.md) -------------------------------
const walkX = (t: number) => 0.62 - 0.20 * ss(3.0, 17.0, t);              // walker paces left
const walkMove = (t: number) => ss(2.8, 3.6, t) * (1 - ss(16.4, 17.2, t));  // 1 while striding
const threadT = (t: number) => ss(3.5, 14.0, t);                          // thread unspool 0→1
const kiteF = (t: number) => ss(9.8, 10.2, t) * (1 - ss(10.6, 11.4, t));  // kite sun-flash
const devilT = (t: number) => ss(13.8, 14.6, t) * (1 - ss(15.8, 16.8, t));// salt-devil spin-up
const hareB = (t: number) => ss(7.4, 8.4, t);                             // hare bound progress
const hareUp = (t: number) => ss(6.9, 7.2, t);                            // head lift
const birdsT = (t: number) => ss(16.5, 19.5, t);                          // far flock crossing
const sunY = (t: number) => 0.625 + 0.012 * ss(0.0, 20.0, t);              // sun cresting

const PW = 300, PH = 114, PY = 8, PZ = -80;
const uvToWorld = (ux: number, uy: number, out: THREE.Vector3) =>
  out.set((ux - 0.5) * PW, PY + (uy - 0.5) * PH, PZ);
// authored [0,1] → camera-visible vUv band (exact inverse of the remap)
const aToV = (ux: number, uy: number, out: THREE.Vector3) =>
  uvToWorld(0.269 + ux * 0.462, 0.159 + (uy - 0.03) / 1.107, out);

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
uniform float uWalk;    // walker x (authored)
uniform float uMove;    // walking gate: 1 while striding, 0 in the holds
uniform float uThread;  // thread unspool 0..1
uniform float uKite;    // kite flash
uniform float uDevil;   // salt-devil envelope
uniform float uHareB;   // hare bound progress
uniform float uHareU;   // hare head lift
uniform float uBirds;   // bird crossing 0..1
uniform float uSun;     // sun y
out vec4 fragColor;

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
// jittered voronoi → (f1, f2)
vec2 voro(vec2 p) {
  vec2 g = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0;
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y));
    vec2 r = o + vec2(h2(g + o), h2(g + o + 19.19)) - f;
    float d = dot(r, r);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  return sqrt(vec2(f1, f2));
}

vec3 flatScene(vec2 uv, float t) {
  // --- sky: lavender -> peach dawn gradient
  vec3 col = mix(vec3(0.55, 0.38, 0.50), vec3(0.80, 0.72, 0.88), smoothstep(0.62, 0.95, uv.y));
  col = mix(col, vec3(0.98, 0.70, 0.45), (1.0 - smoothstep(0.62, 0.78, uv.y)) * 0.85);

  // --- sun disc just clearing the horizon + halo
  float sund = length((uv - vec2(0.30, uSun)) * vec2(1.0, 1.15));
  col += vec3(1.0, 0.82, 0.55) * (1.0 - smoothstep(0.022, 0.030, sund)) * 1.6;
  col += vec3(1.0, 0.70, 0.45) * exp(-sund * 7.0) * 0.35;

  // --- two mountain silhouettes on the horizon
  float m1 = 0.648 + 0.030 * fbm(vec2(uv.x * 5.0 + 2.0, 3.0)) - 0.045 * smoothstep(0.55, 0.75, abs(uv.x - 0.72));
  float m2 = 0.660 + 0.020 * fbm(vec2(uv.x * 7.0 + 9.0, 6.0)) - 0.030 * smoothstep(0.62, 0.80, abs(uv.x - 0.38));
  float mtn = (1.0 - smoothstep(m1 - 0.004, m1, uv.y)) * smoothstep(0.60, 0.64, uv.y)
            + (1.0 - smoothstep(m2 - 0.004, m2, uv.y)) * smoothstep(0.62, 0.66, uv.y);
  col = mix(col, vec3(0.36, 0.30, 0.44), clamp(mtn, 0.0, 1.0) * 0.85);

  // --- thin white horizon band + mirage shimmer hugging it
  col = mix(col, vec3(0.98, 0.95, 0.92), (1.0 - smoothstep(0.608, 0.618, uv.y)) * smoothstep(0.592, 0.600, uv.y) * 0.9);
  float shim = smoothstep(0.56, 0.60, uv.y) * (1.0 - smoothstep(0.62, 0.68, uv.y));
  uv.x += sin(uv.y * 260.0 + t * 3.2) * 0.004 * shim;
  uv.y += sin(uv.x * 140.0 - t * 2.1) * 0.002 * shim;

  // --- salt flat: crust gets darker/denser toward the top of the flat band
  float flatA = 1.0 - smoothstep(0.600, 0.610, uv.y);
  vec3 sand = mix(vec3(0.88, 0.82, 0.78), vec3(0.94, 0.90, 0.86), uv.y);
  sand *= 0.92 + 0.08 * n2(uv * vec2(40.0, 90.0));

  // polygon cracks — vertical compress toward the horizon (monotone warp, no fold)
  vec2 vv = vec2(uv.x * 20.0, uv.y * 20.0 / (0.35 + uv.y * 1.2)) + vec2(0.0, t * 0.02);
  vec2 vf = voro(vv);
  float crack = 1.0 - smoothstep(0.02, 0.09, vf.y - vf.x);
  sand = mix(sand, vec3(0.62, 0.58, 0.55), crack * (0.55 + 0.25 * (1.0 - uv.y)));
  // soft per-cell tint so plates read as separate pans
  sand *= 0.94 + 0.06 * n2(floor(vv) * 3.7);
  col = mix(col, sand, flatA);

  // crystal glints near the camera — sparse twinkle cells
  float gzone = (1.0 - smoothstep(0.18, 0.30, uv.y)) * flatA;
  float glint = step(0.985, h2(floor(uv * vec2(90.0, 160.0)) + floor(t * 2.5) * 7.31)) * gzone;
  col += vec3(1.0, 0.95, 0.85) * glint * (0.5 + 0.5 * sin(t * 6.0 + uv.x * 50.0));

  // --- vicuña/hare silhouette far back: stands, lifts head, bounds off right
  {
    vec2 hp = vec2(0.78 + 0.30 * uHareB, 0.565 + abs(sin(uHareB * 9.4)) * 0.02 * step(0.01, uHareB));
    float esc = 1.0 - step(0.999, uHareB);                       // gone once off
    float body = 1.0 - smoothstep(0.010, 0.014, length((uv - hp) * vec2(1.0, 1.7)));
    vec2 ear = vec2(0.006 + 0.004 * uHareU, 0.018 + 0.006 * uHareU);
    float head = 1.0 - smoothstep(0.005, 0.007, length(uv - (hp + ear)));
    col = mix(col, vec3(0.30, 0.24, 0.30), max(body, head) * esc * 0.85);
  }

  // --- walker silhouette (~2% frame) pacing left, legs striding
  {
    vec2 wp = vec2(uWalk, 0.385);
    float bob = 0.0025 * abs(sin(t * 6.5)) * uMove;
    float body = 1.0 - smoothstep(0.0035, 0.0055, abs(uv.x - wp.x));
    body *= smoothstep(wp.y - 0.002, wp.y, uv.y) * (1.0 - smoothstep(wp.y + 0.014 + bob, wp.y + 0.020 + bob, uv.y));
    float head = 1.0 - smoothstep(0.0035, 0.0050, length(uv - (wp + vec2(0.0, 0.019 + bob))));
    float stride = sin(t * 6.5) * 0.006 * uMove;
    float legs = (1.0 - smoothstep(0.0020, 0.0035, abs(uv.x - wp.x + stride)))
               * (1.0 - smoothstep(wp.y - 0.010, wp.y, uv.y)) * step(wp.y - 0.012, uv.y)
               + (1.0 - smoothstep(0.0020, 0.0035, abs(uv.x - wp.x - stride)))
               * (1.0 - smoothstep(wp.y - 0.010, wp.y, uv.y)) * step(wp.y - 0.012, uv.y);
    float w = max(max(body, head), clamp(legs, 0.0, 1.0));
    col = mix(col, vec3(0.16, 0.12, 0.18), w * 0.92);
  }

  // --- kite-string of light: unspools behind the walker up to the kite
  {
    vec2 kpos = vec2(0.66, 0.735 + 0.010 * sin(t * 1.3));
    float n = clamp((uv.y - 0.385) / (kpos.y - 0.385), 0.0, 1.0);
    float tx = uWalk + (kpos.x - uWalk) * n + 0.015 * sin(n * 9.0 + uv.y * 55.0 + t * 2.4) * 4.0 * n * (1.0 - n);
    float onY = smoothstep(0.383, 0.387, uv.y) * (1.0 - smoothstep(kpos.y - 0.002, kpos.y, uv.y));
    float lit = step(n, uThread);                                 // unspooled so far
    float td = abs(uv.x - tx);
    float thread = exp(-td * td * 90000.0) * onY * lit;
    float halo = exp(-td * td * 9000.0) * onY * lit * 0.25;
    col += vec3(1.0, 0.85, 0.60) * (thread * 1.1 + halo);

    // kite diamond + one hard flash
    vec2 kd = abs(uv - kpos);
    float kite = 1.0 - smoothstep(0.011, 0.015, kd.x + kd.y);
    vec3 kcol = mix(vec3(0.30, 0.22, 0.38), vec3(0.95, 0.55, 0.30), 0.35 + 0.65 * uKite);
    col = mix(col, kcol, kite);
    // star flash rays when it catches the sun
    float rays = (exp(-kd.x * kd.x * 6000.0) + exp(-kd.y * kd.y * 6000.0)) * exp(-dot(kd, kd) * 180.0) * uKite;
    col += vec3(1.0, 0.9, 0.65) * rays * 0.20;
  }

  // --- salt-devil: brief dust spiral right-of-center, then collapse
  {
    vec2 dc = vec2(0.72, 0.42);
    vec2 dq = uv - dc;
    float hh = clamp(dq.y / 0.14, 0.0, 1.0);
    float w = 0.030 + 0.050 * hh;
    float inside = (1.0 - smoothstep(w * 0.65, w, abs(dq.x))) * smoothstep(0.0, 0.008, dq.y) * (1.0 - smoothstep(0.15, 0.18, dq.y));
    float swirl = 0.5 + 0.5 * sin(dq.x * 160.0 - t * 22.0 + dq.y * 60.0);
    col = mix(col, vec3(0.78, 0.68, 0.58), inside * swirl * uDevil * 0.80);
    // dust mound at the base
    float mound = 1.0 - smoothstep(0.030, 0.070, length((uv - dc) * vec2(1.0, 2.4)));
    col = mix(col, vec3(0.80, 0.72, 0.62), mound * uDevil * 0.6);
  }

  // --- far birds crossing the pink band once (small Vs)
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 b = vec2(1.05 - 0.55 * uBirds + fi * 0.028, 0.72 + fi * 0.014 + 0.004 * sin(t * 3.0 + fi));
    vec2 bd = uv - b;
    float wing = abs(bd.y - abs(bd.x) * 0.55 - 0.002 * sin(t * 9.0 + fi * 2.0));
    float bird = (1.0 - smoothstep(0.0015, 0.0035, wing)) * (1.0 - smoothstep(0.010, 0.016, abs(bd.x)));
    col = mix(col, vec3(0.25, 0.18, 0.28), bird * 0.8);
  }

  // vignette + faint dawn haze at the edges
  col *= 1.0 - 0.30 * smoothstep(0.55, 1.05, length(uv - vec2(0.5, 0.45)));
  return col;
}

void main() {
  vec2 uv = vec2((vUv.x - 0.269) / 0.462, 0.03 + (vUv.y - 0.159) * 1.107);
  vec3 col = flatScene(uv, uT);
  fragColor = vec4(col, 1.0);
}`;

export default class SaltflatScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private bu = {
    uT: { value: 0 }, uWalk: { value: 0.62 }, uThread: { value: 0 },
    uKite: { value: 0 }, uDevil: { value: 0 }, uHareB: { value: 0 }, uMove: { value: 0 },
    uHareU: { value: 0 }, uBirds: { value: 0 }, uSun: { value: 0.625 },
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
    const kite = kiteF(t);

    this.bu.uT.value = t;
    this.bu.uWalk.value = walkX(t);
    this.bu.uMove.value = walkMove(t);
    this.bu.uThread.value = threadT(t);
    this.bu.uKite.value = kite;
    this.bu.uDevil.value = devilT(t);
    this.bu.uHareB.value = hareB(t);
    this.bu.uHareU.value = hareUp(t);
    this.bu.uBirds.value = birdsT(t);
    this.bu.uSun.value = sunY(t);

    // low slow track matching the walker's pace; brief rack when the kite flashes
    const pace = ss(3.0, 17.0, t);
    this.cam.position.set(-2 - 5.0 * pace + Math.sin(t * 0.10) * 0.5, 4.5, 30 - 3.0 * kite);
    this.cam.lookAt(-3 - 4.0 * pace, 7, PZ + 10);

    // diagnostics: walker + kite probes
    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const W = P.width || 1920, H = P.height || 1080;
        this.cam.updateMatrixWorld();
        aToV(walkX(t), 0.40, this.p).project(this.cam);
        const wx = (this.p.x * 0.5 + 0.5) * W, wy = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'walker',
          fontFamily: 'Archivo, sans-serif', fontPx: 22,
          fillStyle: '#e8b4a0', globalAlpha: 0.9, layerId: 'saltflat',
          bbox: [wx - 34, wy - 24, wx + 34, wy + 16],
          w: 68, h: 40, cx: wx, cy: wy, hPct: (40 / H) * 100, isStroke: false,
        });
        aToV(0.66, 0.735 + 0.010 * Math.sin(t * 1.3), this.p).project(this.cam);
        const kx = (this.p.x * 0.5 + 0.5) * W, ky = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'kite',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#ffe9b0', globalAlpha: 0.75, layerId: 'saltflat',
          bbox: [kx - 30, ky - 20, kx + 30, ky + 16],
          w: 60, h: 36, cx: kx, cy: ky, hPct: (36 / H) * 100, isStroke: false,
        });
      }
    }

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 1.0 + 0.07 * kite,
      bloom: 0.22 + 0.24 * kite,
      bloomThreshold: 0.72,
      bloomRadius: 0.55,
      grade: { saturation: 1.08, gamma: 0.99 },
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
