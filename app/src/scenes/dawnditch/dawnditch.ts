// dawnditch — a dew-covered drainage ditch in a flat arable field at dawn: a
// water vole slips along the far bank and swims a stretch, the first sun strip
// crosses the field right-to-left, mist thins in the hollows. All motion is
// closed-form f(t). Authored uv [0,1] is remapped into the camera-visible vUv
// band at BACK_FRAG.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../../engine/scene.js';

const ss = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// --- envelopes (beat times from storyboard.md) -------------------------------
// vole phases: walk far bank 4.5-7.5 → tuft pause 7.5-8.3 → swim 8.3-12.5 →
// out into tussock 12.5-13.2
const volePos = (t: number): [number, number, number] => {
  // x, mode (0 walk / 0.5 pause / 1 swim / -1 gone)
  if (t < 4.5) return [-0.05, 0, -1];
  if (t < 7.5) return [0.18 + (t - 4.5) * 0.07, 0, 0];
  if (t < 8.3) return [0.39, 0.5, 0];
  if (t < 8.7) return [0.39 + (t - 8.3) * 0.075, 0.5 + (t - 8.3) * 1.25, 0];   // dip in over 0.4s
  if (t < 12.5) return [0.39 + (t - 8.3) * 0.075, 1, 0];
  if (t < 12.9) return [0.705 + (t - 12.5) * 0.03, 1.0 - (t - 12.5) * 1.25, 0]; // climb out over 0.4s
  if (t < 13.2) return [0.717 + (t - 12.9) * 0.03, 0.5, 0];
  return [1.0, 0, -1];
};
const sunX = (t: number) => 1.05 - 1.15 * ss(2, 9, t);   // strip sweeps right→left
const larkU = (t: number) => Math.min(1, Math.max(0, (t - 11.0) / 2.4));  // skylark spiral (11.0-13.4, under the act-lark caption)
const hensU = (t: number) => Math.min(1, Math.max(0, (t - 14.0) / 1.5));  // moorhen step-out
const crowU = (t: number) => Math.min(1, Math.max(0, (t - 16.0) / 3.0));  // far crow walk
const bubU = (t: number) => Math.min(1, Math.max(0, (t - 13.5) / 1.2));   // bubble trail

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
uniform float uT, uSun, uLark, uHen, uCrow, uBub, uGlow;
uniform vec3 uVole;

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
// traveling sun strip (bright inside, warm fringe)
float strip(vec2 uv, float cx) {
  float d = uv.x - cx;
  return exp(-d * d / (0.11 * 0.11));
}

void main() {
  float t = uT;
  vec2 uv = vec2((vUv.x - 0.269) / 0.462, 0.03 + (vUv.y - 0.159) * 1.107);
  float sun = strip(uv, uSun);
  vec3 warm = vec3(0.95, 0.62, 0.28);

  // ---- dawn sky: steel → rose above the horizon (y 0.66)
  vec3 col = mix(vec3(0.16, 0.18, 0.24), vec3(0.30, 0.22, 0.24),
                 (1.0 - smoothstep(0.66, 0.85, uv.y)));
  col = mix(col, vec3(0.22, 0.20, 0.24), smoothstep(0.78, 0.98, uv.y) * 0.7);
  col += warm * sun * smoothstep(0.62, 0.85, uv.y) * 0.35;

  // ---- far tree line
  float tl = 1.0 - smoothstep(0.004, 0.012, abs(uv.y - (0.645 + 0.008 * vnoise(vec2(uv.x * 40.0, 3.0)))));
  col = mix(col, vec3(0.10, 0.11, 0.12), tl * step(0.05, uv.x) * step(uv.x, 0.95));

  // ---- ploughed field: furrow shading receding to the horizon
  if (uv.y < 0.645 && uv.y > 0.50) {
    float persp = (0.645 - uv.y) / 0.145;                     // 1 near, 0 far
    float f = vnoise(vec2(uv.x * 90.0, uv.y * 220.0));
    vec3 field = mix(vec3(0.10, 0.085, 0.070), vec3(0.14, 0.11, 0.085), f);
    field = mix(field, vec3(0.16, 0.13, 0.10), (1.0 - persp) * 0.4);
    // furrow ridges as horizontal shading bands
    field *= 1.0 - 0.30 * smoothstep(0.35, 0.5, abs(fract(uv.y * 60.0 * persp + uv.x * 2.0) - 0.5));
    col = mix(col, field * (1.0 + sun * 0.9 + 0.30 * uGlow),
              (1.0 - smoothstep(0.642, 0.645, uv.y)) * smoothstep(0.495, 0.505, uv.y));
  }

  // ---- mist patches in the hollows (thin inside the sun strip)
  for (int k = 0; k < 4; k++) {
    float fk = float(k);
    vec2 mc = vec2(0.15 + 0.24 * fk + 0.05 * h1(fk * 3.1), 0.545 + 0.035 * h1(fk * 7.7));
    vec2 mq = (uv - mc) / vec2(0.10 + 0.03 * h1(fk * 5.3), 0.012 + 0.006 * h1(fk * 9.2));
    mq.x -= 0.4 * sin(t * 0.25 + fk);
    float thin = 0.55 + 0.45 * h1(fk);                        // patch thins as sun passes
    float mist = (1.0 - smoothstep(0.7, 1.0, length(mq))) * thin *
                 max(0.0, 1.0 - 0.7 * strip(mc, uSun) - 0.35 * uGlow);
    col = mix(col, vec3(0.42, 0.40, 0.42) * (1.0 + sun * 0.5), mist * 0.5);
  }

  // ---- the ditch: dark water band y 0.44-0.50, steep bank lips
  float inD = step(0.435, uv.y) * (1.0 - step(0.50, uv.y));
  if (inD > 0.0) {
    // steep shaded lips top and bottom
    float lip = max(1.0 - smoothstep(0.0, 0.008, 0.50 - uv.y),
                    1.0 - smoothstep(0.0, 0.008, uv.y - 0.435));
    vec3 water = vec3(0.03, 0.045, 0.055) + vnoise(vec2(uv.x * 60.0 - t * 0.6, uv.y * 40.0)) * 0.015;
    // sun strip lights the water as a glinting line first
    water += warm * strip(vec2(uv.x, 0.47), uSun) * 0.55;
    // trickle shimmer streaks
    water += vec3(0.08) * step(0.96, h2(floor(vec2(uv.x * 300.0, uv.y * 120.0 - t * 2.0))));
    col = mix(col, water * (1.0 - 0.5 * lip), inD);
  }
  // bank lips
  col = mix(col, vec3(0.09, 0.08, 0.065) * (1.0 + sun),
            max(1.0 - smoothstep(0.002, 0.006, abs(uv.y - 0.50)),
                1.0 - smoothstep(0.002, 0.006, abs(uv.y - 0.435))) * 0.9);

  // ---- grass tufts + dew glints along the far lip (y ~0.51)
  for (int k = 0; k < 14; k++) {
    float fk = float(k);
    float bx = 0.05 + 0.065 * fk + 0.02 * h1(fk * 3.7);
    float len = 0.030 + 0.022 * h1(fk * 5.9);
    float dir = (h1(fk * 7.3) - 0.5) * 0.05 + 0.002 * sin(t * 1.3 + fk);
    float tuft = 1.0 - smoothstep(0.0015, 0.005,
      sdSeg(uv, vec2(bx, 0.50), vec2(bx + dir, 0.50 + len)));
    col = mix(col, vec3(0.12, 0.16, 0.08) * (0.7 + sun * 1.4), tuft * 0.9);
    // dew glint: flashes only when the sun strip is over the tuft
    float glint = step(0.985, h1(fk * 11.7 + floor(t * 6.0) * 0.07)) * strip(vec2(bx, 0.5), uSun);
    col += vec3(0.9, 0.85, 0.7) * glint *
           (1.0 - smoothstep(0.001, 0.004, length(uv - vec2(bx + dir * 0.7, 0.505 + len * 0.6))));
  }

  // near ground fill below the ditch (drawn before the tuft bases)
  if (uv.y < 0.435) {
    col = mix(col, vec3(0.10, 0.085, 0.07) * (0.8 + 0.3 * vnoise(uv * 40.0) + sun * 0.9),
              1.0 - smoothstep(0.430, 0.435, uv.y));
  }

  // ---- near bank grass row (y < 0.435): taller tufts, dew too
  for (int k = 0; k < 10; k++) {
    float fk = float(k) + 20.0;
    float bx = 0.06 + 0.09 * float(k) + 0.02 * h1(fk * 3.7);
    float len = 0.025 + 0.020 * h1(fk * 5.9);
    float dir = (h1(fk * 7.3) - 0.5) * 0.05;
    float tuft = 1.0 - smoothstep(0.0015, 0.005,
      sdSeg(uv, vec2(bx, 0.405), vec2(bx + dir, 0.405 + len)));
    col = mix(col, vec3(0.10, 0.13, 0.07) * (0.8 + sun * 1.2), tuft * 0.85);
  }

  // ---- bubble trail rising in the water (~13.5s)
  if (uBub > 0.0 && uBub < 1.0) {
    for (int k = 0; k < 4; k++) {
      float fk = float(k);
      vec2 bp = vec2(0.30 + 0.02 * fk, 0.44 + uBub * 0.05 + 0.006 * fk);
      col += vec3(0.25, 0.3, 0.3) * (1.0 - smoothstep(0.001, 0.003, length(uv - bp))) *
             (1.0 - uBub);
    }
  }

  // ---- skylark spiraling up
  if (uLark > 0.0 && uLark < 1.0) {
    vec2 lp = vec2(0.55 + 0.10 * uLark + 0.02 * sin(uLark * 14.0),
                   0.55 + 0.30 * uLark * uLark);
    float fl = abs(sin(t * 9.0));
    float w1 = 1.0 - smoothstep(0.003, 0.007, length((uv - (lp + vec2(-0.008, 0.003 * fl))) / vec2(1.6, 0.9)));
    float w2 = 1.0 - smoothstep(0.003, 0.007, length((uv - (lp + vec2(0.008, 0.003 * fl))) / vec2(1.6, 0.9)));
    col = mix(col, vec3(0.05, 0.045, 0.04), max(w1, w2) * 0.85);
  }

  // ---- moorhen stepping out on the near bank then back in
  if (uHen > 0.0 && uHen < 1.0) {
    float outU = sin(uHen * 3.14159);                          // out then back
    vec2 hp = vec2(0.62, 0.44 - outU * 0.04);
    float hb = 1.0 - smoothstep(0.005, 0.009, length((uv - hp) / vec2(1.5, 0.9)));
    float hh = 1.0 - smoothstep(0.003, 0.005, length((uv - (hp + vec2(-0.007, 0.008))) / vec2(1.0, 1.0)));
    col = mix(col, vec3(0.04, 0.035, 0.03), max(hb, hh) * 0.9);
  }

  // ---- crow walking a far plough line
  if (uCrow > 0.0 && uCrow < 1.0) {
    vec2 cp = vec2(0.15 + 0.6 * uCrow, 0.58 + 0.004 * sin(uCrow * 40.0));
    float cb = 1.0 - smoothstep(0.004, 0.007, length((uv - cp) / vec2(1.7, 0.9)));
    float ct = 1.0 - smoothstep(0.002, 0.005, sdSeg(uv, cp + vec2(0.008, 0.002), cp + vec2(0.016, 0.006)));
    col = mix(col, vec3(0.03, 0.03, 0.035), max(cb, ct) * 0.8);
  }

  // ---- the water vole
  if (uVole.z > -0.5) {
    float vx = uVole.x, mode = uVole.y;
    if (mode < 0.9) {
      // walking / pausing on the far bank (y ~0.505)
      float gait = (mode < 0.4 ? abs(sin(t * 10.0)) * 0.003 : 0.0);
      // mode in (0.5,0.9) is the dive/climb ramp: sink toward water level
      vec2 vp = vec2(vx, 0.508 + gait - max(0.0, mode - 0.5) * 0.10);
      float vb = 1.0 - smoothstep(0.006, 0.011, length((uv - vp) / vec2(1.6, 0.9)));
      float vh = 1.0 - smoothstep(0.003, 0.006, length((uv - (vp + vec2(0.010, 0.006))) / vec2(1.0, 1.0)));
      float vt = 1.0 - smoothstep(0.002, 0.005, sdSeg(uv, vp - vec2(0.012, 0.0), vp - vec2(0.022, 0.006)));
      col = mix(col, vec3(0.05, 0.04, 0.03), clamp(vb + vh + vt, 0.0, 1.0) * 0.9);
    } else {
      // swimming: back + nose above the water, trailing wake
      // steady swimming height = the dive endpoint (0.468), so dive and climb stay monotone
      vec2 vp = vec2(vx, 0.468);
      float back = 1.0 - smoothstep(0.004, 0.008, length((uv - vp) / vec2(1.7, 0.6)));
      float nose = 1.0 - smoothstep(0.002, 0.005, length((uv - (vp + vec2(0.011, 0.004))) / vec2(1.0, 0.7)));
      col = mix(col, vec3(0.05, 0.04, 0.03), clamp(back + nose, 0.0, 1.0) * 0.9);
      float wake = (1.0 - smoothstep(0.001, 0.004, abs(uv.y - (0.470 + 0.004 * sin(uv.x * 80.0 - t * 3.0))))) *
                   step(vp.x - 0.05, uv.x) * step(uv.x, vp.x);
      col = mix(col, vec3(0.10, 0.12, 0.13), wake * 0.4);
    }
  }

  fragColor = vec4(col, 1.0);
}`;

export default class DawnditchScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private bu = {
    uT: { value: 0 }, uSun: { value: 0 }, uGlow: { value: 0 }, uLark: { value: 0 },
    uHen: { value: 0 }, uCrow: { value: 0 }, uBub: { value: 0 },
    uVole: { value: new THREE.Vector3(0, 0, -1) },
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
    // low near-static; slight drift along the ditch line
    this.cam.position.x = -0.9 + t * 0.09;
    this.cam.lookAt(this.cam.position.x * 0.4, 6.5, PZ + 10);

    const [vx, vmode, vgone] = volePos(t);
    this.bu.uT.value = t;
    this.bu.uSun.value = sunX(t);
    this.bu.uGlow.value = ss(5, 16.5, t);   // lingering warmth after the strip passes
    this.bu.uLark.value = larkU(t);
    this.bu.uHen.value = hensU(t);
    this.bu.uCrow.value = crowU(t);
    this.bu.uBub.value = bubU(t);
    this.bu.uVole.value.set(vx, vmode, vgone);

    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const W = P.width || 1920, H = P.height || 1080;
        this.cam.updateMatrixWorld();
        if (vgone > -0.5 && vx > -0.02 && vx < 0.99) {
          const vy = (vmode > 0.9 ? 0.468 : 0.508 - Math.max(0, vmode - 0.5) * 0.10) + 0.008;
          aToV(vx, vy, this.p).project(this.cam);
          const px = (this.p.x * 0.5 + 0.5) * W, py = (0.5 - this.p.y * 0.5) * H;
          P.textProbes.push({
            frameIdx: P.currentFrameIdx ?? 0, t, text: 'vole',
            fontFamily: 'Archivo, sans-serif', fontPx: 20,
            fillStyle: '#191512', globalAlpha: 0.9, layerId: 'dawnditch',
            bbox: [px - 22, py - 18, px + 22, py + 12],
            w: 44, h: 30, cx: px, cy: py, hPct: (30 / H) * 100, isStroke: false,
          });
        }
        aToV(Math.min(1.05, Math.max(-0.05, sunX(t))), 0.47, this.p).project(this.cam);
        const sx = (this.p.x * 0.5 + 0.5) * W, sy = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'sun strip',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#5a4028', globalAlpha: 0.75, layerId: 'dawnditch',
          bbox: [sx - 38, sy - 18, sx + 38, sy + 12],
          w: 76, h: 30, cx: sx, cy: sy, hPct: (30 / H) * 100, isStroke: false,
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
      grade: { saturation: 1.06, gamma: 1.0 },
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
