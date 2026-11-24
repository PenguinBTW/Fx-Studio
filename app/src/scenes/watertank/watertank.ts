// watertank — a lone rusted water tank on a rooftop at noon in a heat-hazed
// desert city: pigeons roosting under it, a rope hanging from the rim, a
// plastic bag tumbling past. All motion is closed-form f(t). Authored uv
// [0,1] is remapped into the camera-visible vUv band (x~[0.27,0.73],
// y~[0.16,0.84]) at BACK_FRAG.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../../engine/scene.js';

const ss = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// --- envelopes (beat times from storyboard.md) -------------------------------
const loopU = (t: number) => ss(5.0, 5.8, t) * (1 - ss(9.0, 9.8, t));      // pigeon orbit gate
const bagU = (t: number) => ss(9.5, 10.0, t) * (1 - ss(12.8, 13.4, t));    // bag tumbles by
const paraU = (t: number) => ss(11.0, 14.0, t);                            // pigeon B to parapet
const sparrowW = (t: number) => ss(7.4, 7.8, t) * (1 - ss(8.8, 9.4, t));   // rim sparrow cameo
const heliU = (t: number) => Math.min(1, Math.max(0, (t - 12.0) / 6.0));   // heli speck crosses
const creakW = (t: number) => ss(6.2, 6.5, t) * (1 - ss(7.0, 7.3, t)) + ss(15.5, 15.8, t) * (1 - ss(16.4, 16.8, t));

// Pigeon A's orbit around the tank — mirror of the GLSL path for the probe.
const pigeonLoopXY = (t: number): [number, number] => {
  const g = loopU(t);
  const a = Math.min(1, Math.max(0, (t - 5.0) / 4.4)) * Math.PI * 2;
  const lx = 0.56 + 0.11 * Math.cos(a) * g * (2 - g);
  const ly = 0.55 + 0.14 * Math.sin(a) * g * (2 - g);
  return [0.50 + (lx - 0.50) * g, 0.275 + (ly - 0.275) * g];
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
uniform float uLoop, uBag, uPara, uSparrow, uHeli, uCreak;

float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), u.x),
             mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), u.x), u.y);
}
float box(vec2 p, vec2 c, vec2 b) {
  vec2 d = abs(p - c) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float sdSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
// small bird blob: body + wing flick
float bird(vec2 uv, vec2 c, float s, float flap) {
  float b = 1.0 - smoothstep(s * 0.7, s * 1.1, length((uv - c) / vec2(1.4, 1.0)));
  vec2 w1 = c + vec2(-s * 1.4, s * (0.6 + 0.8 * flap));
  vec2 w2 = c + vec2(s * 1.4, s * (0.6 + 0.8 * flap));
  b = max(b, (1.0 - smoothstep(s * 0.5, s * 0.9, sdSeg(uv, c, w1))) * 0.9);
  b = max(b, (1.0 - smoothstep(s * 0.5, s * 0.9, sdSeg(uv, c, w2))) * 0.9);
  return clamp(b, 0.0, 1.0);
}

void main() {
  float t = uT;
  // authored uv + faint heat shimmer on the distance bands
  vec2 uv = vec2((vUv.x - 0.269) / 0.462, 0.03 + (vUv.y - 0.159) * 1.107);
  float shBand = smoothstep(0.46, 0.56, uv.y) * (1.0 - smoothstep(0.66, 0.78, uv.y));
  uv.x += shBand * 0.0016 * sin(uv.y * 240.0 + t * 3.0 + sin(uv.x * 60.0));

  // ---- bleached noon sky
  vec3 col = mix(vec3(0.84, 0.83, 0.80), vec3(0.60, 0.68, 0.76), uv.y);
  // hazed sun disc
  {
    vec2 sc = vec2(0.72, 0.80);
    float d = length(uv - sc);
    float g1 = exp(-d * d / (0.020 * 0.020));
    float g2 = exp(-d * d / (0.006 * 0.006));
    col += vec3(1.0, 0.95, 0.80) * (g1 * 0.45 + g2 * 0.8);
    col = mix(col, vec3(1.0, 0.98, 0.90), (1.0 - smoothstep(0.012, 0.020, d)));
  }

  // ---- city rooftops receding in three haze layers
  for (int L = 0; L < 3; L++) {
    float lf = float(L);
    float yb = 0.485 + lf * 0.045;
    float hgt = yb + 0.018 * vnoise(vec2(floor(uv.x * (10.0 + lf * 6.0)) * 7.0, lf * 3.0));
    float inB = 1.0 - smoothstep(hgt - 0.004, hgt, uv.y);
    inB *= smoothstep(0.30, 0.34, uv.y);
    vec3 haze = mix(vec3(0.52, 0.50, 0.49), vec3(0.74, 0.74, 0.74), lf / 2.0);
    col = mix(col, haze, inB * (0.75 - lf * 0.15));
    // sparse rooftop boxes + a water-tower silhouette far back
    float bn = floor(uv.x * (10.0 + lf * 6.0));
    float bx = fract(uv.x * (10.0 + lf * 6.0)) - 0.5;
    float boxh = h1(bn + lf * 13.0) * 0.02;
    float inBox = (1.0 - smoothstep(0.16, 0.20, abs(bx))) *
                  smoothstep(hgt - 0.002, hgt + 0.002, uv.y) *
                  (1.0 - smoothstep(hgt + boxh - 0.004, hgt + boxh, uv.y));
    col = mix(col, haze * 0.9, inBox * (0.6 - lf * 0.10));
  }

  // ---- foreground rooftop: parapet edge then tar roof
  {
    float para = 1.0 - smoothstep(0.105, 0.115, uv.y);
    col = mix(col, vec3(0.09, 0.07, 0.06), para);
    col = mix(col, vec3(0.16, 0.13, 0.11), para * (1.0 - smoothstep(0.108, 0.112, uv.y)) * 0.7);
  }
  float roof = (1.0 - smoothstep(0.235, 0.245, uv.y)) * smoothstep(0.105, 0.115, uv.y);
  if (roof > 0.0) {
    vec3 tar = vec3(0.20, 0.17, 0.14) + vnoise(uv * 90.0) * 0.04;
    col = mix(col, tar, roof);
    // two vents
    for (int i = 0; i < 2; i++) {
      vec2 vc = vec2(0.30 + float(i) * 0.46, 0.145 + float(i) * 0.02);
      float v = 1.0 - smoothstep(0.0, 0.004, box(uv, vc, vec2(0.018, 0.016)));
      float cap = 1.0 - smoothstep(0.0, 0.004, box(uv, vc + vec2(0.0, 0.020), vec2(0.024, 0.005)));
      col = mix(col, vec3(0.30, 0.26, 0.22), max(v, cap) * roof * 0.9);
      
    }
    // hard noon shadow pool under the tank
    float sh = 1.0 - smoothstep(0.05, 0.10, length((uv - vec2(0.56, 0.238)) / vec2(1.9, 0.32)));
    col = mix(col, vec3(0.10, 0.08, 0.07), sh * roof * 0.88);
    // cast stilt shadows stretching slightly left
    for (int i = 0; i < 4; i++) {
      vec2 top = vec2(0.485 + float(i) * 0.05, 0.225);
      col = mix(col, vec3(0.10, 0.08, 0.07),
        (1.0 - smoothstep(0.002, 0.006, sdSeg(uv, top, top + vec2(-0.055, -0.02)))) * roof * 0.55);
    }
    // plastic bag tumbling across, bouncing arcs
    if (uBag > 0.0) {
      float bu = min(1.0, (t - 9.5) / 3.6);
      vec2 bp = vec2(-0.04 + 0.86 * bu, 0.16 + 0.055 * abs(sin(bu * 12.5)) * (1.0 - bu * 0.5));
      float bag = 1.0 - smoothstep(0.008, 0.015, length((uv - bp) / vec2(1.3 + 0.5 * sin(t * 9.0), 1.0)));
      col = mix(col, vec3(0.95, 0.95, 0.93), bag * 0.85);
    }
  }
  // wasp circling the parapet edge (straddles roof/parapet — drawn over both)
  {
    vec2 wc = vec2(0.30, 0.115);
    vec2 wp = wc + vec2(cos(t * 3.4) * 0.025, sin(t * 4.6) * 0.012);
    float wasp = 1.0 - smoothstep(0.0018, 0.004, length(uv - wp));
    col = mix(col, vec3(0.10, 0.08, 0.04), wasp * 0.9 * smoothstep(0.09, 0.20, uv.y));
  }

  // ---- the tank on wooden stilts (faint creak jitter)
  vec2 jx = vec2(0.0012 * sin(t * 31.0) * uCreak, 0.0008 * sin(t * 43.0 + 1.0) * uCreak);
  {
    // stilts + cross braces
    for (int i = 0; i < 4; i++) {
      float fx = 0.485 + float(i) * 0.05;
      float lean = (float(i) - 1.5) * 0.010;
      float leg = 1.0 - smoothstep(0.003, 0.007, sdSeg(uv - jx, vec2(fx + lean, 0.235), vec2(fx, 0.435)));
      col = mix(col, vec3(0.22, 0.16, 0.10), leg);
    }
    for (int i = 0; i < 2; i++) {
      float b = 1.0 - smoothstep(0.002, 0.005, sdSeg(uv - jx, vec2(0.49 + float(i) * 0.10, 0.24), vec2(0.54 - float(i) * 0.10, 0.42)));
      col = mix(col, vec3(0.28, 0.20, 0.13), b * 0.8);
    }
    // octagonal stave body
    float body = 1.0 - smoothstep(0.0, 0.004, box(uv - jx, vec2(0.56, 0.525), vec2(0.098, 0.088)));
    if (body > 0.0) {
      vec3 wood = vec3(0.36, 0.26, 0.17);
      wood *= 0.85 + 0.3 * vnoise(uv * vec2(220.0, 30.0));
      // stave seams
      float seam = step(0.965, fract(uv.x * 60.0));
      wood *= 1.0 - seam * 0.25;
      // rust streaks running down from the bands
      float rust = 0.0;
      for (int i = 0; i < 6; i++) {
        float rx = 0.48 + h1(float(i) * 3.7) * 0.16;
        float rw = 0.004 + h1(float(i) * 7.1) * 0.006;
        float str = smoothstep(rx - rw, rx, uv.x) * (1.0 - smoothstep(rx, rx + rw * 2.0, uv.x));
        rust = max(rust, str * smoothstep(0.55 - h1(float(i)) * 0.1, 0.62, uv.y));
      }
      wood = mix(wood, vec3(0.45, 0.18, 0.07), rust * 0.9);
      // metal bands with sun glints
      for (int i = 0; i < 3; i++) {
        float by = 0.455 + float(i) * 0.055;
        float band = 1.0 - smoothstep(0.003, 0.006, abs(uv.y - by));
        col = mix(col, vec3(0.35, 0.32, 0.30), band * body);
        float gl = band * body * step(0.82, h1(floor(uv.x * 140.0) + float(i) * 31.0 + floor(t * 6.0)));
        col += vec3(1.0, 0.95, 0.8) * gl * 0.9;
      }
      col = mix(col, wood, body * 0.95);
    }
    // conical cap
    float capY = 0.613 + (0.098 - abs(uv.x - jx.x - 0.56)) * 0.55;
    float inCap = (1.0 - smoothstep(capY - 0.004, capY, uv.y)) * smoothstep(0.612, 0.616, uv.y) * (1.0 - smoothstep(0.095, 0.100, abs(uv.x - jx.x - 0.56)));
    col = mix(col, vec3(0.30, 0.19, 0.12), inCap);
    col += vec3(0.9, 0.8, 0.6) * inCap * (1.0 - smoothstep(0.0, 0.05, abs(uv.x - 0.60))) * 0.3;
    // rope hanging from the rim, swaying
    vec2 ra = vec2(0.635, 0.60);
    vec2 rb = ra + vec2(0.010 * sin(t * 1.3) + 0.004 * sin(t * 3.1), -0.105);
    float rope = 1.0 - smoothstep(0.0015, 0.004, sdSeg(uv - jx, ra, rb));
    col = mix(col, vec3(0.24, 0.18, 0.10), rope);
    // sparrow on the rim once
    if (uSparrow > 0.0) {
      float sp = bird(uv - jx, vec2(0.60 + 0.01 * sin(t * 2.0), 0.672), 0.0055, max(0.0, sin(t * 18.0)) * 0.3);
      col = mix(col, vec3(0.20, 0.14, 0.10), sp * uSparrow);
    }
  }

  // ---- pigeons: shaded cluster under the tank
  for (int i = 0; i < 5; i++) {
    vec2 pc = vec2(0.49 + h1(float(i) * 5.3) * 0.14, 0.252 + h1(float(i) * 9.1) * 0.012);
    pc.y += 0.002 * sin(t * (2.0 + h1(float(i) * 4.0) * 2.0) + float(i) * 2.0);
    float pg = bird(uv, pc, 0.0055, max(0.0, sin(t * 7.0 + float(i) * 3.0)) * 0.15);
    if (i == 4) pg *= 1.0 - uLoop;   // this one is the orbiter
    col = mix(col, vec3(0.16, 0.14, 0.16), pg);
  }
  // pigeon A: the loop around the tank
  if (uLoop > 0.0) {
    float a = min(1.0, (t - 5.0) / 4.4) * 6.2831853;
    vec2 lp = vec2(0.56 + 0.11 * cos(a) * uLoop * (2.0 - uLoop),
                   0.55 + 0.14 * sin(a) * uLoop * (2.0 - uLoop));
    float pa = bird(uv, mix(vec2(0.50, 0.275), lp, uLoop), 0.006,
                    0.5 + 0.5 * sin(t * 14.0));
    col = mix(col, vec3(0.18, 0.16, 0.18), pa);
  }
  // pigeon B: to the parapet, then shuffles along it
  if (uPara > 0.0) {
    float fly = min(1.0, (t - 11.0) / 2.6);
    vec2 bp = mix(vec2(0.62, 0.27), vec2(0.34, 0.135), fly);
    if (fly >= 1.0) bp.x += 0.030 * smoothstep(14.0, 19.5, t) + 0.002 * sin(t * 6.0);
    float pb = bird(uv, bp, 0.006, fly < 1.0 ? 0.5 + 0.5 * sin(t * 13.0) : 0.0);
    col = mix(col, vec3(0.18, 0.16, 0.18), pb);
  }

  // ---- helicopter speck crossing the sky band
  if (uHeli > 0.0 && uHeli < 1.0) {
    vec2 hp = vec2(0.18 + 0.64 * uHeli, 0.78 + 0.008 * sin(uHeli * 20.0));
    float hb = 1.0 - smoothstep(0.003, 0.006, length((uv - hp) / vec2(2.2, 0.8)));
    float rot = (1.0 - smoothstep(0.001, 0.003, abs(uv.y - hp.y - 0.004))) * (1.0 - smoothstep(0.012, 0.014, abs(uv.x - hp.x)));
    col = mix(col, vec3(0.35, 0.34, 0.34), max(hb, rot * 0.6) * 0.8);
  }

  fragColor = vec4(col, 1.0);
}`;

export default class WatertankScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private bu = {
    uT: { value: 0 }, uLoop: { value: 0 }, uBag: { value: 0 }, uPara: { value: 0 },
    uSparrow: { value: 0 }, uHeli: { value: 0 }, uCreak: { value: 0 },
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
    // low near-static: a slow drift up so the tank settles against the sky band
    this.cam.position.x = Math.sin(t * 0.04) * 1.2;
    this.cam.position.y = 4.5 + 1.1 * ss(0, 20, t);
    this.cam.lookAt(this.cam.position.x * 0.4, 7.4 + 0.4 * ss(0, 20, t), PZ + 10);

    this.bu.uT.value = t;
    this.bu.uLoop.value = loopU(t);
    this.bu.uBag.value = bagU(t);
    this.bu.uPara.value = paraU(t);
    this.bu.uSparrow.value = sparrowW(t);
    this.bu.uHeli.value = heliU(t);
    this.bu.uCreak.value = creakW(t);

    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const W = P.width || 1920, H = P.height || 1080;
        this.cam.updateMatrixWorld();
        const [px0, py0] = pigeonLoopXY(t);
        if (py0 < 0.99) {
          aToV(px0, py0 + 0.012, this.p).project(this.cam);
          const px = (this.p.x * 0.5 + 0.5) * W, py = (0.5 - this.p.y * 0.5) * H;
          P.textProbes.push({
            frameIdx: P.currentFrameIdx ?? 0, t, text: 'pigeon',
            fontFamily: 'Archivo, sans-serif', fontPx: 20,
            fillStyle: '#241d1d', globalAlpha: 0.9, layerId: 'watertank',
            bbox: [px - 26, py - 20, px + 26, py + 12],
            w: 52, h: 32, cx: px, cy: py, hPct: (32 / H) * 100, isStroke: false,
          });
        }
        aToV(0.56, 0.63, this.p).project(this.cam);
        const tx = (this.p.x * 0.5 + 0.5) * W, ty = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'tank',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#5a3d22', globalAlpha: 0.7, layerId: 'watertank',
          bbox: [tx - 32, ty - 18, tx + 32, ty + 14],
          w: 64, h: 32, cx: tx, cy: ty, hPct: (32 / H) * 100, isStroke: false,
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
  }
}
