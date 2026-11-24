// hedgelight — a field-edge hawthorn hedge backlit by low sun: a wren darts
// perch to perch, a snail extends its antennae on a lit leaf edge, a skylark
// spirals out of the field. All motion is closed-form f(t), silhouettes only.
// Authored uv [0,1] is remapped into the camera-visible vUv band at BACK_FRAG.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../../engine/scene.js';

const ss = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// --- envelopes (beat times from storyboard.md) -------------------------------
const wrenAU = (t: number) => Math.min(1, Math.max(0, (t - 4.0) / 4.0));   // dart 1: perch→dart→hide
const wrenBU = (t: number) => Math.min(1, Math.max(0, (t - 14.0) / 3.0));  // re-emerge + dart off
const snailU = (t: number) => Math.min(1, Math.max(0, (t - 8.0) / 3.0));   // antennae extension
const larkU = (t: number) => Math.min(1, Math.max(0, (t - 11.0) / 3.0));   // skylark spiral out
const bflyU = (t: number) => Math.min(1, Math.max(0, (t - 15.0) / 3.5));   // butterfly cross
const robinU = (t: number) => Math.min(1, Math.max(0, (t - 15.8) / 0.6)) * Math.min(1, Math.max(0, (18.2 - t) / 0.6));

// wren A perch run: u<0.45 perched at x .25 flicking; 0.45–0.75 dart to x .55;
// >0.75 slips down into the hedge mass
const wrenAPos = (u: number): [number, number, number] => {
  const hy = 0.60 + 0.05 * Math.sin(0.25 * 7) + 0.03 * Math.sin(0.25 * 17 + 2);
  if (u < 0.45) return [0.25, hy + 0.012, 1];
  const d = ss(0.45, 0.75, u);
  const x = 0.25 + d * 0.30;
  const top = 0.60 + 0.05 * Math.sin(x * 7) + 0.03 * Math.sin(x * 17 + 2);
  const hop = Math.abs(Math.sin(d * Math.PI * 2.5)) * 0.045 * (1 - d);
  const vis = u < 0.75 ? 1 : Math.max(0, 1 - (u - 0.75) / 0.2);
  return [x, top + 0.012 + hop - Math.max(0, u - 0.75) * 0.08, vis];
};
// wren B: climbs out higher at x .62, flicks, then darts off right
const wrenBPos = (u: number, aspect = 16 / 9): [number, number, number] => {
  const top = 0.60 + 0.05 * Math.sin(0.62 * 7) + 0.03 * Math.sin(0.62 * 17 + 2);
  if (u < 0.3) return [0.62, top - 0.04 + u / 0.3 * 0.06, Math.min(1, u / 0.3)];
  const d = ss(0.7, 1.0, u);
  const x = 0.62 + d * 0.55;
  // the world plane is height-fitted, so the visible authored-x range tracks
  // aspect: frame right edge sits at 0.5 + (PH/2)/PW*aspect; hide once the
  // wren's body clears it so probes stop recording off-frame
  const edge = 0.5 + (PH / 2 / PW) * aspect + 0.03;
  return [x, top + 0.02 + d * 0.06 + Math.abs(Math.sin(d * 9)) * 0.03, x > edge ? 0 : 1];
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
uniform float uT, uWrenA, uWrenB, uSnail, uLark, uBfly, uRobin, uWrAx, uWrAy, uWrAv, uWrBx, uWrBy, uWrBv;

float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), u.x),
             mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), u.y), u.y);
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float ellipse(vec2 p, vec2 c, vec2 r) { return length((p - c) / r) - 1.0; }

float hedgeTop(float x) {
  return 0.60 + 0.05 * sin(x * 7.0) + 0.03 * sin(x * 17.0 + 2.0);
}
// hedge silhouette: column noise eats into the top edge, gap columns let
// shafts through at hashed x positions
float hedgeMask(vec2 uv) {
  float top = hedgeTop(uv.x) + (vnoise(vec2(uv.x * 46.0, 7.0)) - 0.5) * 0.05;
  float inside = (1.0 - smoothstep(top - 0.008, top, uv.y)) * smoothstep(0.285, 0.30, uv.y);
  float leafTex = vnoise(uv * vec2(150.0, 110.0));
  inside *= 0.75 + 0.25 * leafTex;
  float gap = 0.0;
  for (int k = 0; k < 3; k++) {
    float gx = 0.18 + 0.27 * float(k) + 0.05 * h1(float(k) * 4.1);
    gap = max(gap, 1.0 - smoothstep(0.004, 0.014, abs(uv.x - gx)));
  }
  // gaps only nick the upper half, like missing leaf clusters
  inside *= 1.0 - gap * smoothstep(0.44, 0.58, uv.y) * 0.85;
  return inside;
}
// shaft band value at a point: angled light through the hedge gaps
float shaftAt(vec2 uv, float t) {
  float s = 0.0;
  for (int k = 0; k < 3; k++) {
    float gx = 0.18 + 0.27 * float(k) + 0.05 * h1(float(k) * 4.1);
    float sway = 0.004 * sin(t * 0.5 + float(k) * 2.0);
    // ray runs down-left from the gap at the hedge top toward the grass
    float line = uv.y - (0.60 + (uv.x - gx - sway) * 0.55);
    float band = 1.0 - smoothstep(0.006, 0.03, abs(line));
    // shaft runs down-left to the dirt track (x ≈ gx-0.55 at y ≈ 0.30)
    float reach = (1.0 - smoothstep(gx - 0.02, gx + 0.16, uv.x)) * smoothstep(gx - 0.60, gx - 0.55, uv.x);
    s = max(s, band * reach);
  }
  return s;
}

void main() {
  float t = uT;
  vec2 uv = vec2((vUv.x - 0.269) / 0.462, 0.03 + (vUv.y - 0.159) * 1.107);
  vec2 sun = vec2(0.93, 0.62);

  // ---- warm backlit sky: brightest at the low sun, rose haze above the hedge
  vec3 col = mix(vec3(0.98, 0.62, 0.30), vec3(0.42, 0.30, 0.38),
                 smoothstep(0.60, 0.95, uv.y));
  float sunD = length((uv - sun) / vec2(1.0, 1.35));
  col += vec3(1.0, 0.72, 0.34) * exp(-sunD * sunD * 14.0) * 0.85;
  col += vec3(1.0, 0.85, 0.55) * exp(-sunD * sunD * 90.0) * 0.6;
  // faint field haze band above the hedge line
  col += vec3(0.9, 0.62, 0.4) * 0.10 * smoothstep(0.58, 0.66, uv.y) * (1.0 - smoothstep(0.66, 0.78, uv.y));

  // ---- field grass in front of the hedge (y 0.15-0.42), lit at blade tops
  if (uv.y < 0.42 && uv.y > 0.13) {
    float f = vnoise(vec2(uv.x * 160.0, uv.y * 60.0));
    vec3 grass = mix(vec3(0.16, 0.11, 0.06), vec3(0.30, 0.20, 0.10), f);
    float sh = shaftAt(uv, t);
    grass += vec3(0.95, 0.62, 0.28) * sh * 0.55;
    // blade tips catching the sun along the grass top edge
    for (int k = 0; k < 26; k++) {
      float fk = float(k);
      float bx = fract(0.03 + fk * 0.039 + 0.02 * h1(fk * 3.7));
      float tipY = 0.30 + 0.10 * h1(fk * 6.3);
      float bl = 1.0 - smoothstep(0.0015, 0.004,
        sdSeg(uv, vec2(bx, tipY - 0.03), vec2(bx + 0.008 * sin(t * 1.3 + fk), tipY)));
      grass += vec3(1.0, 0.7, 0.32) * bl * (0.35 + 0.65 * sh) * 0.5;
    }
    col = mix(col, grass, smoothstep(0.13, 0.145, uv.y) * (1.0 - smoothstep(0.405, 0.42, uv.y)));
  }

  // ---- dirt track at the hedge base (y 0.28-0.42 in front band overlap)
  if (uv.y < 0.32 && uv.y > 0.20) {
    float d = vnoise(vec2(uv.x * 90.0, uv.y * 160.0));
    vec3 dirt = mix(vec3(0.20, 0.14, 0.09), vec3(0.30, 0.21, 0.13), d);
    dirt += vec3(0.9, 0.55, 0.25) * shaftAt(uv, t) * 0.4;
    col = mix(col, dirt, smoothstep(0.20, 0.215, uv.y) * (1.0 - smoothstep(0.305, 0.32, uv.y)) * 0.9);
  }

  // ---- the hedge mass with rim-lit leaf edges
  {
    float m = hedgeMask(uv);
    float top = hedgeTop(uv.x) + (vnoise(vec2(uv.x * 46.0, 7.0)) - 0.5) * 0.05;
    vec3 hedge = vec3(0.055, 0.075, 0.035);
    hedge *= 0.8 + 0.5 * vnoise(uv * vec2(200.0, 140.0));
    // rim: near the top edge or facing the sun side of a leaf cluster
    float rimTop = 1.0 - smoothstep(0.004, 0.045, top - uv.y);
    // rim strongest on the sun side (right) and at the lit top edge
    float rim = rimTop * (0.25 + 0.75 * smoothstep(0.0, 0.85, uv.x));
    hedge += vec3(1.0, 0.72, 0.30) * rim * 0.9;
    // stray leaf-edge glints inside the mass near gaps
    float gl = shaftAt(uv, t) * step(0.93, vnoise(uv * vec2(300.0, 220.0)));
    hedge += vec3(1.0, 0.8, 0.45) * gl * 0.9;
    col = mix(col, hedge, m);
    // thin shafts visible over the hedge face + into the grass
    col += vec3(0.95, 0.6, 0.26) * shaftAt(uv, t) * 0.16 * (1.0 - m);
  }

  // ---- snail on a backlit leaf edge at frame right (x ~0.85, y ~0.34)
  {
    float bend = uSnail * 0.012;                    // leaf dips as it settles
    vec2 lc = vec2(0.86, 0.345 - bend);
    float leaf = 1.0 - smoothstep(0.001, 0.006, ellipse(uv, lc, vec2(0.045, 0.014)));
    col = mix(col, vec3(0.10, 0.16, 0.06), leaf * 0.9);
    col += vec3(1.0, 0.75, 0.35) * leaf * 0.4 * smoothstep(0.86, 0.905, uv.x);
    vec2 sp = vec2(0.848, 0.362 - bend);
    float shell = 1.0 - smoothstep(0.002, 0.007, ellipse(uv, sp, vec2(0.012, 0.011)));
    float body = 1.0 - smoothstep(0.0015, 0.005, sdSeg(uv, vec2(0.842, 0.352 - bend), vec2(0.862, 0.355 - bend)));
    vec3 sn = vec3(0.09, 0.07, 0.05);
    col = mix(col, sn, clamp(shell + body, 0.0, 1.0) * 0.95);
    // antennae extend over the snail beat — gated so sdSeg never sees a
    // zero-length segment while they are retracted
    float ae = uSnail;
    if (ae > 0.02) {
    float a1 = 1.0 - smoothstep(0.0008, 0.003, sdSeg(uv, sp + vec2(0.010, 0.004),
      sp + vec2(0.010 + 0.010 * ae, 0.004 + 0.014 * ae)));
    float a2 = 1.0 - smoothstep(0.0008, 0.003, sdSeg(uv, sp + vec2(0.012, 0.002),
      sp + vec2(0.012 + 0.014 * ae, 0.002 + 0.010 * ae)));
    col = mix(col, sn, clamp(a1 + a2, 0.0, 1.0) * ae * 0.95);
    }
    // dew bead on the shell rim — glints once mid-beat
    float glint = exp(-((t - 10.0) * (t - 10.0)) / 0.18);
    float dew = 1.0 - smoothstep(0.0008, 0.003, ellipse(uv, sp + vec2(0.004, 0.011), vec2(0.003)));
    col += vec3(1.0, 0.9, 0.6) * dew * (0.4 + glint * 2.2);
  }

  // ---- skylark: spiral rise from the field left, out right
  if (uLark > 0.0 && uLark < 1.0) {
    float u = uLark;
    // exit push carries it fully off-frame right before uLark ends
    vec2 lp = vec2(0.30 + 0.06 * sin(u * 18.0) + smoothstep(0.75, 1.0, u) * 0.9,
                   0.36 + u * 0.34);
    float fl = abs(sin(t * 13.0)) * 0.010;
    float bd = 1.0 - smoothstep(0.001, 0.005, ellipse(uv, lp, vec2(0.007, 0.004)));
    float w1 = 1.0 - smoothstep(0.001, 0.004, sdSeg(uv, lp, lp + vec2(-0.010, 0.004 + fl)));
    float w2 = 1.0 - smoothstep(0.001, 0.004, sdSeg(uv, lp, lp + vec2(0.010, 0.004 + fl)));
    col = mix(col, vec3(0.05, 0.045, 0.04), clamp(bd + w1 + w2, 0.0, 1.0) * 0.9);
  }

  // ---- robin silhouette sitting on the hedge top, briefly
  if (uRobin > 0.0) {
    vec2 rp = vec2(0.47, hedgeTop(0.47) + 0.012 + abs(sin(t * 2.2)) * 0.004);
    float rb = 1.0 - smoothstep(0.002, 0.006, ellipse(uv, rp, vec2(0.011, 0.009)));
    float rh = 1.0 - smoothstep(0.001, 0.004, ellipse(uv, rp + vec2(-0.008, 0.010), vec2(0.006)));
    float rt = 1.0 - smoothstep(0.0008, 0.003, sdSeg(uv, rp + vec2(0.008, 0.004), rp + vec2(0.018, 0.012)));
    col = mix(col, vec3(0.06, 0.045, 0.035), clamp(rb + rh + rt, 0.0, 1.0) * uRobin * 0.9);
  }

  // ---- wren A: perch→flick→dart→hide (position from uWrA* uniforms)
  if (uWrAv > 0.01) {
    vec2 wp = vec2(uWrAx, uWrAy);
    float flick = (uWrenA < 0.45 || (uWrenB > 0.3 && uWrenB < 0.7)) ? abs(sin(t * 9.0)) * 0.5 : 0.0;
    float bd = 1.0 - smoothstep(0.0015, 0.005, ellipse(uv, wp, vec2(0.009, 0.006)));
    float hd = 1.0 - smoothstep(0.001, 0.004, ellipse(uv, wp + vec2(0.007, 0.006), vec2(0.005)));
    float tl = 1.0 - smoothstep(0.0008, 0.003,
      sdSeg(uv, wp + vec2(-0.007, 0.003), wp + vec2(-0.015, 0.008 + flick * 0.010)));
    vec3 wc = vec3(0.05, 0.04, 0.032) + vec3(0.9, 0.6, 0.25) * shaftAt(wp, t) * 0.35;
    col = mix(col, wc, clamp(bd + hd + tl, 0.0, 1.0) * uWrAv * 0.95);
  }
  // ---- wren B: re-emerge higher, dart off right
  if (uWrBv > 0.01) {
    vec2 wp = vec2(uWrBx, uWrBy);
    float flick = uWrenB < 0.7 ? abs(sin(t * 9.0)) * 0.5 : 0.0;
    float bd = 1.0 - smoothstep(0.0015, 0.005, ellipse(uv, wp, vec2(0.009, 0.006)));
    float hd = 1.0 - smoothstep(0.001, 0.004, ellipse(uv, wp + vec2(0.007, 0.006), vec2(0.005)));
    float tl = 1.0 - smoothstep(0.0008, 0.003,
      sdSeg(uv, wp + vec2(-0.007, 0.003), wp + vec2(-0.015, 0.008 + flick * 0.010)));
    vec3 wc = vec3(0.05, 0.04, 0.032) + vec3(0.9, 0.6, 0.25) * shaftAt(wp, t) * 0.35;
    col = mix(col, wc, clamp(bd + hd + tl, 0.0, 1.0) * uWrBv * 0.95);
  }

  // ---- butterfly fluttering across, once
  if (uBfly > 0.0 && uBfly < 1.0) {
    float u = uBfly;
    vec2 bp = vec2(-0.04 + u * 1.12, 0.46 + 0.05 * sin(u * 20.0) + 0.02 * sin(u * 47.0));
    float fl = abs(sin(t * 15.0)) * 0.006;
    float w1 = 1.0 - smoothstep(0.0008, 0.003, ellipse(uv, bp + vec2(-0.004, fl), vec2(0.005, 0.004)));
    float w2 = 1.0 - smoothstep(0.0008, 0.003, ellipse(uv, bp + vec2(0.004, fl), vec2(0.005, 0.004)));
    col = mix(col, vec3(0.06, 0.05, 0.04), clamp(w1 + w2, 0.0, 1.0) * 0.85);
  }

  fragColor = vec4(col, 1.0);
}`;

export default class HedgelightScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private bu = {
    uT: { value: 0 }, uWrenA: { value: 0 }, uWrenB: { value: 0 },
    uSnail: { value: 0 }, uLark: { value: 0 }, uBfly: { value: 0 },
    uRobin: { value: 0 },
    uWrAx: { value: 0 }, uWrAy: { value: 0 }, uWrAv: { value: 0 },
    uWrBx: { value: 0 }, uWrBy: { value: 0 }, uWrBv: { value: 0 },
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
    // low near-static; slight drift along the hedge
    this.cam.position.x = -0.5 + t * 0.05;
    this.cam.lookAt(this.cam.position.x * 0.3, 6.5, PZ + 10);

    const ua = wrenAU(t), ub = wrenBU(t);
    const [ax, ay, av] = wrenAPos(ua);
    const [bx, by, bv] = wrenBPos(ub, this.cam.aspect);
    this.bu.uT.value = t;
    this.bu.uWrenA.value = ua;
    this.bu.uWrenB.value = ub;
    this.bu.uSnail.value = snailU(t);
    this.bu.uLark.value = larkU(t);
    this.bu.uBfly.value = bflyU(t);
    this.bu.uRobin.value = robinU(t);
    this.bu.uWrAx.value = ax; this.bu.uWrAy.value = ay; this.bu.uWrAv.value = av;
    this.bu.uWrBx.value = bx; this.bu.uWrBy.value = by; this.bu.uWrBv.value = bv;

    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const W = P.width || 1920, H = P.height || 1080;
        this.cam.updateMatrixWorld();
        const boxFor = (ux0: number, uy0: number, ux1: number, uy1: number) => {
          aToV(ux0, uy0, this.p).project(this.cam);
          const x0 = (this.p.x * 0.5 + 0.5) * W, y0 = (0.5 - this.p.y * 0.5) * H;
          aToV(ux1, uy1, this.p).project(this.cam);
          const x1 = (this.p.x * 0.5 + 0.5) * W, y1 = (0.5 - this.p.y * 0.5) * H;
          const l = Math.min(x0, x1), r2 = Math.max(x0, x1);
          const tp = Math.min(y0, y1), bt = Math.max(y0, y1);
          return { bbox: [l, tp, r2, bt] as number[], w: r2 - l, h: bt - tp, cx: (l + r2) / 2, cy: (tp + bt) / 2 };
        };
        // wren probe tracks the active wren's live position
        const [wx, wy, wv] = av > bv ? [ax, ay, av] : [bx, by, bv];
        if (wv > 0.01) {
          const wb = boxFor(wx - 0.03, wy - 0.03, wx + 0.03, wy + 0.035);
          P.textProbes.push({
            frameIdx: P.currentFrameIdx ?? 0, t, text: 'wren',
            fontFamily: 'Archivo, sans-serif', fontPx: 20,
            fillStyle: '#1a1410', globalAlpha: 0.9, layerId: 'hedgelight',
            bbox: wb.bbox, w: wb.w, h: wb.h, cx: wb.cx, cy: wb.cy,
            hPct: (wb.h / H) * 100, isStroke: false,
          });
        }
        const hb = boxFor(0.40, 0.52, 0.62, 0.72);
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'hedge',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#241a10', globalAlpha: 0.75, layerId: 'hedgelight',
          bbox: hb.bbox, w: hb.w, h: hb.h, cx: hb.cx, cy: hb.cy,
          hPct: (hb.h / H) * 100, isStroke: false,
        });
      }
    }

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 1.05,
      bloom: 0.14,
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
