// beachglass — golden-hour light refracting through beach glass on wet sand.
// All motion is closed-form f(t). Authored uv [0,1] is remapped into the
// camera-visible vUv band (x~[0.27,0.73], y~[0.16,0.84]) at the BACK_FRAG
// call site.

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
const surfP = (t: number) => ss(4.0, 6.5, t) * (1 - ss(10.0, 13.0, t));   // lace edge advance/hold/ebb
const laneX = (t: number) => 1.15 - 1.35 * ss(7.0, 12.0, t);              // glint lane sweeps left
const heroF = (t: number) => ss(8.6, 9.4, t) * (1 - ss(9.8, 11.0, t));    // hero flare
const gullX = (t: number) => -0.25 + 1.5 * ss(13.5, 15.0, t);             // gull shadow
const shellA = (t: number) => ss(11.0, 11.8, t);                          // shell deposit
const goldT = (t: number) => 0.55 + 0.45 * ss(15.0, 20.0, t);             // deepening gold
const piperX = (t: number) => 0.30 + 0.45 * ss(5.0, 17.0, t) + 0.008 * Math.sin(t * 1.7);
const peck = (t: number) =>                                              // peck bursts on a seeded rhythm
  ss(0.80, 0.92, Math.abs(Math.sin(t * 2.1 + 0.4))) * step01(t, 5.2, 17.5);
function step01(x: number, a: number, b: number) { return x >= a && x <= b ? 1 : 0; }

// crab dart positions: pause -> dart -> pause on piecewise anchors
const crabPos = (t: number, i: number): [number, number] => {
  const ax = [0.18, 0.52, 0.33, 0.70, 0.44][((i * 3 + 1) % 5)];
  const bx = [0.44, 0.24, 0.66, 0.38, 0.58][((i * 2 + 2) % 5)];
  const ay = [0.30, 0.36, 0.28, 0.40, 0.33][((i * 3) % 5)];
  const w0 = 11.8 + i * 0.9, w1 = w0 + 0.55, w2 = w1 + 1.6, w3 = w2 + 0.7;
  if (t < w0) return [ax, ay];
  if (t < w1) return [ax + (bx - ax) * ss(w0, w1, t), ay + 0.02 * Math.sin((t - w0) * 40)];
  if (t < w2) return [bx, ay];
  if (t < w3) return [bx + (ax - bx) * ss(w2, w3, t), ay];
  return [ax, ay];
};

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
uniform float uSurf;    // lace edge progress 0..1
uniform float uLane;    // glint lane x centre (authored)
uniform float uHero;    // hero flare pulse
uniform float uGull;    // gull shadow x
uniform float uShell;   // shell fade-in
uniform float uGold;    // late gold deepening
uniform vec2  uPiper;   // sandpiper pos
uniform float uPeck;    // peck bob
uniform vec2  uC1, uC2, uC3;
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

// shard record: pos, size, colour index, rot — decoded from a seed
vec3 shardCol(float idx) {
  if (idx < 0.20) return vec3(0.35, 0.62, 0.55); // seafoam
  if (idx < 0.40) return vec3(0.72, 0.48, 0.16); // amber
  if (idx < 0.58) return vec3(0.20, 0.38, 0.68); // cobalt
  if (idx < 0.78) return vec3(0.80, 0.82, 0.78); // white
  if (idx < 0.92) return vec3(0.30, 0.55, 0.34); // green
  return vec3(0.65, 0.55, 0.45);                 // frosted brown
}

float shardShape(vec2 uv, vec2 c, float r, float rot, float seed) {
  vec2 q = uv - c;
  float ca = cos(rot), sa = sin(rot);
  q = vec2(q.x * ca - q.y * sa, q.x * sa + q.y * ca);
  // wobbly rounded lump
  float w = 1.0 + 0.16 * sin(atan(q.y, q.x) * 3.0 + seed * 20.0);
  return 1.0 - smoothstep(r * w * 0.72, r * w, length(q * vec2(1.0, 1.22)));
}

vec3 beach(vec2 uv, float t) {
  // wet-sand mirror: sky reflection peach -> teal
  vec3 col = mix(vec3(0.30, 0.22, 0.18), vec3(0.55, 0.40, 0.32),
                 smoothstep(0.0, 0.55, uv.y));
  col = mix(col, vec3(0.75, 0.52, 0.35), smoothstep(0.45, 0.80, uv.y));   // peach band far
  col = mix(col, vec3(0.28, 0.45, 0.50), 1.0 - smoothstep(0.0, 0.05, uv.y)); // teal pool near

  // ripple grain + fine sand noise
  float rip = n2(vec2(uv.x * 60.0, uv.y * 140.0 - t * 0.15));
  col += vec3(0.03, 0.03, 0.035) * (rip - 0.5);
  col *= 1.0 + 0.05 * (n2(uv * 220.0) - 0.5);

  // dunes + grass silhouettes along the far edge
  float dune = smoothstep(0.78, 0.88, uv.y + fbm(vec2(uv.x * 4.0, 0.0)) * 0.06);
  col = mix(col, vec3(0.16, 0.13, 0.10) * (0.7 + 0.5 * n2(uv * 90.0)), dune * 0.85);
  float grass = smoothstep(0.74, 0.76, uv.y) * (1.0 - smoothstep(0.80, 0.85, uv.y));
  grass *= smoothstep(0.60, 0.92, n2(vec2(uv.x * 90.0, uv.y * 26.0)));
  col = mix(col, vec3(0.10, 0.12, 0.06), grass * 0.35);

  // specular glint lane sweeping the sand (low sun, right to left)
  float lane = exp(-pow(abs(uv.x - uLane) * 9.0, 2.0)) * smoothstep(0.05, 0.3, uv.y) * 0.45;
  lane += exp(-pow(abs(uv.x - uLane) * 3.5, 2.0)) * 0.18;
  lane *= 1.0 - smoothstep(12.0, 14.0, t);   // stripe exits with the sweep
  col += vec3(1.0, 0.78, 0.42) * lane * (0.75 + 0.25 * n2(vec2(uv.x * 80.0, uv.y * 200.0)));

  // surf lace edge — thin foam band riding the edge, not a flood
  float edgeY = 0.06 + uSurf * 0.32 + n2(vec2(uv.x * 14.0, t * 0.4)) * 0.022;
  float lace = (1.0 - smoothstep(edgeY, edgeY + 0.010, uv.y))
             * smoothstep(edgeY - 0.050, edgeY - 0.008, uv.y);
  float laceFoam = lace * (0.35 + 0.65 * n2(uv * vec2(160.0, 260.0) + t * 0.5));
  col = mix(col, vec3(0.92, 0.95, 0.94), clamp(laceFoam, 0.0, 1.0) * 0.8);
  // residual foam flecks the lace leaves behind as it ebbs
  float fleck = (1.0 - smoothstep(edgeY - 0.14, edgeY - 0.05, uv.y))
              * smoothstep(0.75, 0.95, n2(uv * 210.0 + t * 0.3)) * uSurf * 0.35;
  col = mix(col, vec3(0.88, 0.91, 0.90), clamp(fleck, 0.0, 1.0));
  // wet-dark band just ahead of the lace
  col *= 1.0 - 0.18 * (1.0 - smoothstep(edgeY + 0.02, edgeY + 0.10, uv.y)) * smoothstep(edgeY - 0.01, edgeY, uv.y);

  // sea-glass shards — seeded placement across the mid band
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float sx = 0.12 + 0.76 * h1(fi * 17.0 + 3.0);
    float sy = 0.16 + 0.42 * h1(fi * 29.0 + 7.0);
    float r  = 0.016 + 0.014 * h1(fi * 43.0 + 1.0);
    float rot = h1(fi * 59.0) * 6.28;
    float ci = h1(fi * 71.0 + 5.0);
    float sh = shardShape(uv, vec2(sx, sy), r, rot, fi);
    // glow when the lane crosses this shard
    float gd = (sx - uLane) * 5.0;
    float glow = exp(-gd * gd);
    vec3 scol = shardCol(ci) * (0.30 + 0.70 * glow);
    // half-bedded: darker at the sand line, brighter top facet
    scol *= 0.85 + 0.35 * smoothstep(sy - r, sy + r, uv.y);
    col = mix(col, scol, sh * 0.95);
    // caustic speckle under the shard while lit
    col += shardCol(ci) * glow * 0.5 * sh
         * smoothstep(0.55, 0.95, n2(uv * 300.0 + fi * 10.0));
    // foam halo wraps the base while the lace edge passes
    float halo = exp(-abs(edgeY - sy) * 60.0) * (1.0 - smoothstep(r * 0.6, r * 1.6, length(uv - vec2(sx, sy))));
    col = mix(col, vec3(0.90, 0.93, 0.92), halo * uSurf * 0.5);
  }

  // hero frosted bottle-glass piece
  vec2 hc = vec2(0.62, 0.42);
  float hh = shardShape(uv, hc, 0.055, 0.5, 9.0);
  float hd = (hc.x - uLane) * 5.0;
  float heroGlow = exp(-hd * hd) + uHero * 1.6;
  vec3 hcol = mix(vec3(0.42, 0.50, 0.46), vec3(0.62, 0.72, 0.66), n2(uv * 24.0)); // frosted
  hcol += vec3(0.85, 0.85, 0.75) * heroGlow * (0.3 + 0.7 * n2(uv * 120.0));
  col = mix(col, hcol, hh * 0.96);
  // hard flare ray while lit
  col += vec3(1.0, 0.95, 0.80) * uHero * hh * 0.8;
  col += vec3(1.0, 0.9, 0.6) * uHero * exp(-pow(abs(uv.y - hc.y) * 30.0, 2.0))
       * exp(-pow(abs(uv.x - hc.x) * 3.0, 2.0)) * 0.5;

  // shell deposited by the last wash — small ridged fan
  vec2 shellC = vec2(0.30, 0.30);
  float sd = length((uv - shellC) * vec2(1.0, 1.4));
  float shell = (1.0 - smoothstep(0.020, 0.026, sd)) * uShell;
  shell *= 0.7 + 0.3 * sin(atan(uv.y - shellC.y, uv.x - shellC.x) * 14.0);
  col = mix(col, vec3(0.78, 0.70, 0.62), shell * 0.9);

  // sand crabs — tiny dark dashes darting between shards
  vec2 crabs[3] = vec2[](uC1, uC2, uC3);
  for (int i = 0; i < 3; i++) {
    float cd = length((uv - crabs[i]) * vec2(1.0, 2.2));
    col = mix(col, vec3(0.10, 0.07, 0.05), (1.0 - smoothstep(0.006, 0.010, cd)) * 0.85);
  }

  // sandpiper silhouette at the waterline — body + bobbing head + legs
  {
    vec2 bp = uPiper;
    float body = 1.0 - smoothstep(0.030, 0.038, length((uv - bp) * vec2(1.0, 2.1)));
    // neck: bounded segment from breast to head — never a global cone
    vec2 nq = uv - (bp + vec2(0.010, 0.008));
    vec2 nv = vec2(0.016, 0.024);
    float hseg = clamp(dot(nq, nv) / dot(nv, nv), 0.0, 1.0);
    float neck = 1.0 - smoothstep(0.004, 0.008, length(nq - nv * hseg));
    float headBob = uPeck * 0.030;
    float head = 1.0 - smoothstep(0.011, 0.015,
        length(uv - (bp + vec2(0.030 + headBob * 0.5, 0.038 - headBob))));
    float legs = (1.0 - smoothstep(0.003, 0.006, min(abs(uv.x - bp.x - 0.004), abs(uv.x - bp.x + 0.006))))
               * step(uv.y, bp.y) * step(bp.y - 0.028, uv.y);
    float bird = max(max(body, head), neck) + legs;
    col = mix(col, vec3(0.06, 0.05, 0.04), clamp(bird, 0.0, 1.0) * 0.9);
  }

  // gull shadow — one soft ellipse crossing
  float gd = length((uv - vec2(uGull, 0.55 + 0.04 * sin(t * 2.0))) * vec2(1.0, 1.9));
  col *= 1.0 - 0.25 * (1.0 - smoothstep(0.10, 0.16, gd));

  // gold deepening toward dusk + vignette
  col *= mix(vec3(1.0), vec3(1.15, 0.88, 0.62), (uGold - 0.55) / 0.45 * 0.5);
  col *= 1.0 - 0.35 * smoothstep(0.55, 1.0, length(uv - vec2(0.5, 0.45)));
  return col;
}

void main() {
  vec2 uv = vUv;
  vec3 col = beach(vec2((uv.x - 0.269) / 0.462, 0.03 + (uv.y - 0.159) * 1.107), uT);
  fragColor = vec4(col, 1.0);
}`;

export default class BeachglassScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private bu = {
    uT: { value: 0 }, uSurf: { value: 0 }, uLane: { value: -0.15 },
    uHero: { value: 0 }, uGull: { value: -0.25 }, uShell: { value: 0 },
    uGold: { value: 0.55 }, uPiper: { value: new THREE.Vector2(0.3, 0.16) },
    uPeck: { value: 0 },
    uC1: { value: new THREE.Vector2() }, uC2: { value: new THREE.Vector2() },
    uC3: { value: new THREE.Vector2() },
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
    this.cam.position.set(0, 3.5, 26);
    this.cam.lookAt(0, 6, PZ + 10);
  }

  override render(_f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const r = this.ctx.renderer;
    const t = _f.t;
    const surf = surfP(t);
    const lane = laneX(t);
    const hero = heroF(t);

    this.bu.uT.value = t;
    this.bu.uSurf.value = surf;
    this.bu.uLane.value = lane;
    this.bu.uHero.value = hero;
    this.bu.uGull.value = gullX(t);
    this.bu.uShell.value = shellA(t);
    this.bu.uGold.value = goldT(t);
    this.bu.uPeck.value = peck(t);
    // piper rides the lace edge
    this.bu.uPiper.value.set(piperX(t), 0.075 + surf * 0.30);
    const c1 = crabPos(t, 0), c2 = crabPos(t, 1), c3 = crabPos(t, 2);
    this.bu.uC1.value.set(c1[0], c1[1]);
    this.bu.uC2.value.set(c2[0], c2[1]);
    this.bu.uC3.value.set(c3[0], c3[1]);

    // low macro drift tracking the glint lane; settle as the ebb ends
    const track = ss(7.0, 12.0, t) * (1 - ss(16.0, 19.0, t));
    this.cam.position.set(
      -8 + Math.max(lane - 1.15, -0.85) * 30 * track + Math.sin(t * 0.12) * 0.8,
      3.5 - track * 0.8,
      26 - track * 4.0,
    );
    this.cam.lookAt(-6 + Math.max(lane - 1.15, -0.85) * 26 * track, 6.5, PZ + 10);

    // diagnostics: hero glass + surf line probes
    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const W = P.width || 1920, H = P.height || 1080;
        this.cam.updateMatrixWorld();
        aToV(0.62, 0.42, this.p).project(this.cam);
        const hx = (this.p.x * 0.5 + 0.5) * W, hy = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'hero-glass',
          fontFamily: 'Archivo, sans-serif', fontPx: 22,
          fillStyle: '#9adfbe', globalAlpha: 0.9, layerId: 'beachglass',
          bbox: [hx - 40, hy - 24, hx + 40, hy + 16],
          w: 80, h: 40, cx: hx, cy: hy, hPct: (40 / H) * 100, isStroke: false,
        });
        aToV(0.5, 0.06 + surf * 0.32, this.p).project(this.cam);
        const lx = (this.p.x * 0.5 + 0.5) * W, ly = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'surf-line',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#e8f2f0', globalAlpha: 0.7, layerId: 'beachglass',
          bbox: [lx - 55, ly - 18, lx + 55, ly + 18],
          w: 110, h: 36, cx: lx, cy: ly, hPct: (36 / H) * 100, isStroke: false,
        });
      }
    }

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 1.0 + 0.10 * hero,
      bloom: 0.18 + 0.35 * hero + 0.20 * lane * 0.4,
      bloomThreshold: 0.75,
      bloomRadius: 0.5,
      grade: { saturation: 1.12, gamma: 0.98 },
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
