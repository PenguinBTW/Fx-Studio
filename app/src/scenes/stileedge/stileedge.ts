// stileedge — a field-edge stile on a footpath at a windy dusk: a crow rocks on
// the top rail holding position, bramble canes reach over the step, a wind-bent
// hawthorn leans behind the low stone wall. All motion is closed-form f(t).
// Authored uv [0,1] is remapped into the camera-visible vUv band at BACK_FRAG.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../../engine/scene.js';

const ss = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// --- envelopes (beat times from storyboard.md) -------------------------------
const gust = (t: number) => Math.min(1, 0.35 + 0.65 * Math.exp(-((t - 14.0) * (t - 14.0)) / 1.2));
const rabU = (t: number) => Math.min(1, Math.max(0, (t - 10.0) / 3.5));   // rabbit lopes L→R on the wall
const bat1U = (t: number) => Math.min(1, Math.max(0, (t - 5.5) / 2.2));  // bat pass 1
const bat2U = (t: number) => Math.min(1, Math.max(0, (t - 16.8) / 1.8)); // bat pass 2
const blowU = (t: number) => Math.min(1, Math.max(0, (t - 14.2) / 2.0)); // cane detaches at the gust peak

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
uniform float uT, uGust, uRab, uBat1, uBat2, uBlow;

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
float box(vec2 p, vec2 c, vec2 hs) {
  vec2 d = abs(p - c) - hs;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float ellipse(vec2 p, vec2 c, vec2 r) { return length((p - c) / r) - 1.0; }

void main() {
  float t = uT;
  vec2 uv = vec2((vUv.x - 0.269) / 0.462, 0.03 + (vUv.y - 0.159) * 1.107);
  float g = uGust;                       // 0.35 steady .. 1.0 at the gust peak
  float lean = g * 0.030 + 0.004 * sin(t * 2.2);   // everything pushed right

  // ---- dusk sky: ink up top, last amber-violet strip over the field edge
  vec3 col = mix(vec3(0.34, 0.22, 0.19), vec3(0.065, 0.075, 0.125),
                 smoothstep(0.58, 0.82, uv.y));
  col = mix(col, vec3(0.24, 0.17, 0.20), smoothstep(0.55, 0.62, uv.y) * (1.0 - smoothstep(0.62, 0.75, uv.y)) * 0.5);
  // thin wind-torn cloud streaks
  float cl = vnoise(vec2(uv.x * 6.0 - t * 0.15, uv.y * 30.0));
  col += vec3(0.05, 0.045, 0.05) * cl * smoothstep(0.66, 0.80, uv.y) * (1.0 - smoothstep(0.86, 0.98, uv.y));

  // ---- far pasture y 0.55-0.62 (wind-combed dark grass)
  if (uv.y < 0.62 && uv.y > 0.545) {
    float f = vnoise(vec2(uv.x * 120.0, uv.y * 60.0));
    vec3 pas = mix(vec3(0.055, 0.06, 0.045), vec3(0.075, 0.07, 0.05), f);
    pas *= 1.0 - 0.25 * smoothstep(0.3, 0.5, abs(fract(uv.y * 90.0 - lean * 40.0) - 0.5));
    col = mix(col, pas, smoothstep(0.545, 0.552, uv.y) * (1.0 - smoothstep(0.612, 0.62, uv.y)));
  }

  // ---- wind-bent hawthorn behind the wall (x ~0.62), canopy pressed downwind
  {
    vec2 trA = vec2(0.615, 0.545), trB = vec2(0.628 + lean * 0.6, 0.645);
    float trunk = 1.0 - smoothstep(0.002, 0.007, sdSeg(uv, trA, trB));
    float twig = 1.0 - smoothstep(0.001, 0.005, sdSeg(uv, trB, trB + vec2(-0.03 - lean * 0.4, 0.045)));
    vec2 cc = vec2(0.655 + lean * 0.9, 0.685 + 0.004 * sin(t * 1.7));
    float can = ellipse(uv, cc, vec2(0.105 + lean * 0.5, 0.052));
    can = smoothstep(0.012, -0.02, can + (vnoise(uv * 90.0) - 0.5) * 0.05);
    col = mix(col, vec3(0.05, 0.055, 0.04), clamp(trunk + twig + can, 0.0, 1.0) * 0.9);
  }

  // ---- stone wall y 0.42-0.55, full width
  if (uv.y < 0.555 && uv.y > 0.415) {
    float row = floor(uv.y * 9.0);
    float bid = floor(uv.x * 26.0 + h1(row) * 3.0);
    float mort = max(1.0 - smoothstep(0.0, 0.006, abs(fract(uv.y * 9.0) - 0.5) * 0.111),
                     1.0 - smoothstep(0.0, 0.008, abs(fract(uv.x * 26.0 + h1(row) * 3.0) - 0.5) * 0.038));
    vec3 st = vec3(0.115, 0.11, 0.095) * (0.75 + 0.5 * h2(vec2(bid, row)));
    st = mix(st, vec3(0.05, 0.048, 0.04), mort * 0.8);
    // pale last-light rim on the wall top
    st += vec3(0.10, 0.08, 0.06) * (1.0 - smoothstep(0.550, 0.555, uv.y)) * smoothstep(0.543, 0.553, uv.y);
    col = mix(col, st, smoothstep(0.415, 0.42, uv.y) * (1.0 - smoothstep(0.550, 0.555, uv.y)));
  }
  // grass tufts on the wall top and verge, all leaning
  for (int k = 0; k < 16; k++) {
    float fk = float(k);
    float bx = 0.03 + 0.058 * fk + 0.02 * h1(fk * 3.1);
    float len = 0.022 + 0.016 * h1(fk * 5.7);
    float dir = 0.006 + lean * 0.7 + 0.004 * sin(t * 3.0 + fk * 2.0);
    float tuft = 1.0 - smoothstep(0.0015, 0.005,
      sdSeg(uv, vec2(bx, 0.552), vec2(bx + dir, 0.552 + len)));
    col = mix(col, vec3(0.06, 0.075, 0.04), tuft * 0.85);
  }

  // ---- foreground path: ruts from the stile base splaying to the corners
  if (uv.y < 0.415) {
    col = mix(col, vec3(0.075, 0.065, 0.05) * (0.8 + 0.4 * vnoise(uv * 30.0)), 0.9);
  }
  // wet rut ribbons catch the last light
  for (int s = 0; s < 2; s++) {
    float side = s == 0 ? -1.0 : 1.0;
    vec2 ra = vec2(0.50 + side * 0.045, 0.42);
    vec2 rb = vec2(0.50 + side * 0.22, 0.02);
    float rut = 1.0 - smoothstep(0.004, 0.011, sdSeg(uv, ra, rb));
    float sheen = 1.0 - smoothstep(0.001, 0.004, sdSeg(uv, ra + vec2(side * 0.002, 0.0), rb));
    col = mix(col, vec3(0.14, 0.125, 0.10), rut * 0.8);
    col = mix(col, vec3(0.30, 0.26, 0.20), sheen * 0.5 * smoothstep(0.06, 0.30, uv.y));
  }
  // leaf debris sliding along the path, stronger on the gust
  for (int k = 0; k < 4; k++) {
    float fk = float(k) + 40.0;
    float lx = fract(0.2 + fk * 0.31 + t * 0.045 * (0.6 + g));
    vec2 lp = vec2(lx, 0.30 - lx * 0.20 + 0.02 * h1(fk));
    float lf = 1.0 - smoothstep(0.002, 0.006, ellipse(uv, lp, vec2(0.006, 0.003)));
    col = mix(col, vec3(0.16, 0.12, 0.06), lf * 0.55 * g);
  }

  // ---- the stile: two uprights, top rail, two worn step planks
  {
    vec3 wood = vec3(0.11, 0.09, 0.07);
    float post = max(1.0 - smoothstep(0.002, 0.006, box(uv, vec2(0.452, 0.56), vec2(0.011, 0.145))),
                     1.0 - smoothstep(0.002, 0.006, box(uv, vec2(0.548, 0.56), vec2(0.011, 0.145))));
    float rail = 1.0 - smoothstep(0.002, 0.005, box(uv, vec2(0.50, 0.672), vec2(0.075, 0.013)));
    float step1 = 1.0 - smoothstep(0.002, 0.005, box(uv, vec2(0.50, 0.528), vec2(0.058, 0.010)));
    float step2 = 1.0 - smoothstep(0.002, 0.005, box(uv, vec2(0.50, 0.585), vec2(0.048, 0.010)));
    col = mix(col, wood * (0.7 + 0.5 * vnoise(vec2(uv.x * 200.0, uv.y * 40.0))),
              clamp(post + rail + step1 + step2, 0.0, 1.0) * 0.95);
    // worn pale edge on each plank top
    col = mix(col, vec3(0.20, 0.17, 0.13),
              max((1.0 - smoothstep(0.000, 0.004, abs(uv.y - 0.540))) * step(abs(uv.x - 0.50), 0.058),
                  (1.0 - smoothstep(0.000, 0.004, abs(uv.y - 0.597))) * step(abs(uv.x - 0.50), 0.048)) * 0.4);
  }

  // ---- bramble canes arcing left over the step (from lower right)
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    if (k == 5 && uBlow > 0.0) continue;          // this cane tears away at the gust
    float bx = 0.575 + 0.045 * fk + 0.02 * h1(fk * 7.1);
    float sw = lean * (0.6 + 0.5 * h1(fk * 3.3)) + 0.006 * sin(t * 2.6 + fk * 1.7);
    vec2 mid = vec2(bx - 0.05, 0.47 + 0.05 * h1(fk * 5.9));
    vec2 tip = vec2(bx - 0.13 - 0.04 * h1(fk * 9.7) - sw * 0.5, 0.50 + 0.09 * h1(fk * 11.3));
    float cane = min(sdSeg(uv, vec2(bx, 0.415), mid), sdSeg(uv, mid, tip));
    col = mix(col, vec3(0.055, 0.05, 0.035), (1.0 - smoothstep(0.0015, 0.0045, cane)) * 0.9);
    // a few leaf dots along the upper half
    for (int j = 0; j < 2; j++) {
      vec2 ld = mix(mid, tip, 0.45 + 0.35 * float(j));
      float leaf = 1.0 - smoothstep(0.002, 0.006, ellipse(uv, ld + vec2(sw * 0.2, 0.004), vec2(0.005, 0.003)));
      col = mix(col, vec3(0.07, 0.09, 0.04), leaf * 0.7);
    }
  }
  // the torn cane tumbling across the frame
  if (uBlow > 0.0 && uBlow < 1.0) {
    vec2 cp = vec2(0.68 + uBlow * 0.55, 0.52 + 0.10 * sin(uBlow * 6.0) + uBlow * 0.06);
    float tum = sin(uBlow * 12.0);
    float cane = sdSeg(uv, cp - vec2(0.03, tum * 0.02), cp + vec2(0.03, tum * 0.02));
    col = mix(col, vec3(0.055, 0.05, 0.035), (1.0 - smoothstep(0.002, 0.005, cane)) * (1.0 - uBlow));
  }

  // ---- rabbit loping along the wall top, left to right
  if (uRab > 0.0 && uRab < 1.0) {
    float rx = 0.08 + uRab * 0.32;
    float hop = abs(sin(uRab * 22.0)) * 0.014;
    vec2 rp = vec2(rx, 0.558 + hop);
    float rb = 1.0 - smoothstep(0.004, 0.008, ellipse(uv, rp, vec2(0.016, 0.009)));
    float re = min(sdSeg(uv, rp + vec2(0.006, 0.008), rp + vec2(0.008, 0.020)),
                   sdSeg(uv, rp + vec2(0.010, 0.008), rp + vec2(0.012, 0.019)));
    float head = 1.0 - smoothstep(0.003, 0.006, ellipse(uv, rp + vec2(0.013, -0.002), vec2(0.007, 0.006)));
    col = mix(col, vec3(0.04, 0.035, 0.03), clamp(rb + (1.0 - smoothstep(0.001, 0.004, re)) + head, 0.0, 1.0) * 0.9);
  }

  // ---- the crow on the top rail: rocks, tail counter-tips, one wing flare
  {
    float rock = 0.004 * sin(t * 1.15) + g * 0.006 * sin(t * 6.8);
    float flare = exp(-((t - 9.35) * (t - 9.35)) / 0.05)
                + 0.35 * exp(-((t - 5.5) * (t - 5.5)) / 0.02)
                + 0.35 * exp(-((t - 12.3) * (t - 12.3)) / 0.02);
    vec2 bp = vec2(0.50 + rock, 0.705);
    // body + head + beak (faces left, into the wind)
    float body = 1.0 - smoothstep(0.004, 0.010, ellipse(uv, bp, vec2(0.017, 0.011)));
    float head = 1.0 - smoothstep(0.002, 0.006, ellipse(uv, bp + vec2(-0.013 + rock * 0.5, 0.014), vec2(0.008, 0.007)));
    float beak = 1.0 - smoothstep(0.001, 0.004, sdSeg(uv, bp + vec2(-0.019, 0.013), bp + vec2(-0.028, 0.011)));
    // tail tips up off the rear (right side), counter to the rock
    float tail = 1.0 - smoothstep(0.0015, 0.005,
      sdSeg(uv, bp + vec2(0.012, 0.004), bp + vec2(0.034, 0.013 - rock * 2.0)));
    // folded wing ridge; flares open for balance
    float wing = 1.0 - smoothstep(0.002, 0.006, ellipse(uv, bp + vec2(-0.002, 0.004), vec2(0.012, 0.006)));
    float wingUp = 1.0 - smoothstep(0.003, 0.008,
      sdSeg(uv, bp + vec2(-0.004, 0.008), bp + vec2(-0.022, 0.030 + flare * 0.02)));
    // legs to the rail
    float legs = min(sdSeg(uv, bp + vec2(-0.004, -0.010), bp + vec2(-0.004, -0.022)),
                     sdSeg(uv, bp + vec2(0.005, -0.010), bp + vec2(0.005, -0.022)));
    col = mix(col, vec3(0.03, 0.028, 0.032),
              clamp(body + head + beak + tail + wing + wingUp * min(1.0, flare) + (1.0 - smoothstep(0.001, 0.004, legs)), 0.0, 1.0));
  }

  // ---- a bat flickering past, twice
  for (int b = 0; b < 2; b++) {
    float bu = b == 0 ? uBat1 : uBat2;
    float dir = b == 0 ? 1.0 : -1.0;
    if (bu > 0.0 && bu < 1.0) {
      float bx = dir > 0.0 ? bu : 1.0 - bu;
      float by = 0.78 + 0.035 * sin(bu * 34.0) + 0.012 * sin(bu * 57.0);
      float fl = abs(sin(t * 16.0 + float(b) * 4.0));
      vec2 bp2 = vec2(bx, by);
      float w1 = 1.0 - smoothstep(0.002, 0.006, sdSeg(uv, bp2, bp2 + vec2(-0.012, 0.008 * fl - 0.002)));
      float w2 = 1.0 - smoothstep(0.002, 0.006, sdSeg(uv, bp2, bp2 + vec2(0.012, 0.008 * fl - 0.002)));
      float bd = 1.0 - smoothstep(0.002, 0.005, ellipse(uv, bp2, vec2(0.005, 0.004)));
      col = mix(col, vec3(0.03, 0.03, 0.035), clamp(w1 + w2 + bd, 0.0, 1.0) * 0.85);
    }
  }

  fragColor = vec4(col, 1.0);
}`;

export default class StileedgeScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private bu = {
    uT: { value: 0 }, uGust: { value: 0 }, uRab: { value: 0 },
    uBat1: { value: 0 }, uBat2: { value: 0 }, uBlow: { value: 0 },
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
    // low near-static; slight drift along the wall
    this.cam.position.x = -0.6 + t * 0.06;
    this.cam.lookAt(this.cam.position.x * 0.3, 6.5, PZ + 10);

    this.bu.uT.value = t;
    this.bu.uGust.value = gust(t);
    this.bu.uRab.value = rabU(t);
    this.bu.uBat1.value = bat1U(t);
    this.bu.uBat2.value = bat2U(t);
    this.bu.uBlow.value = blowU(t);

    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const W = P.width || 1920, H = P.height || 1080;
        this.cam.updateMatrixWorld();
        aToV(0.50, 0.735, this.p).project(this.cam);
        const cx = (this.p.x * 0.5 + 0.5) * W, cy = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'crow',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#14121a', globalAlpha: 0.9, layerId: 'stileedge',
          bbox: [cx - 22, cy - 18, cx + 22, cy + 12],
          w: 44, h: 30, cx, cy, hPct: (30 / H) * 100, isStroke: false,
        });
        aToV(0.50, 0.60, this.p).project(this.cam);
        const sx = (this.p.x * 0.5 + 0.5) * W, sy = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'stile',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#2a2318', globalAlpha: 0.75, layerId: 'stileedge',
          bbox: [sx - 20, sy - 18, sx + 20, sy + 12],
          w: 40, h: 30, cx: sx, cy: sy, hPct: (30 / H) * 100, isStroke: false,
        });
      }
    }

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 1.05,
      bloom: 0.12,
      bloomThreshold: 0.7,
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
  }
}
