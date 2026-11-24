// quayfeast — a night quayside food-stall row under a sagging string of bare
// festoon bulbs: steam off the middle stall's pot, a customer paying at the
// right stall, a cat weaving between the trestle legs. All motion is
// closed-form f(t). Authored uv [0,1] is remapped into the camera-visible
// vUv band (x~[0.27,0.73], y~[0.16,0.84]) at BACK_FRAG.

import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides, type SceneCtx } from '../../engine/scene.js';

const ss = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// --- envelopes (beat times from storyboard.md) -------------------------------
const catX = (t: number) => {
  // enters t=4, weaves to the middle stall by 8, pauses to 10, exits by 13
  if (t < 4.0) return -0.06;
  if (t < 8.0) return -0.06 + 0.61 * (t - 4.0) / 4.0;
  if (t < 10.0) return 0.55;
  return Math.min(1.06, 0.55 + 0.51 * (t - 10.0) / 3.0);
};
const custX = (t: number) => (t < 10.3 ? 0.80 : Math.min(1.08, 0.80 + 0.28 * (t - 10.3) / 3.7));
const armW = (t: number) =>
  ss(6.0, 6.6, t) * (1 - ss(7.4, 8.0, t)) + ss(15.0, 15.6, t) * (1 - ss(16.4, 17.0, t));
const puffW = (t: number) => ss(11.5, 11.9, t) * (1 - ss(12.0, 12.6, t));   // lid-lift

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
uniform float uArm, uPuff;
uniform vec2 uCat, uCust;

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
// festoon catenary between poles x=0.18..0.92, sag ~0.065 at midspan
float wireY(float x) {
  float u = (x - 0.18) / 0.74;
  return 0.845 - 0.065 * sin(3.14159 * u);
}
// bulb i of 9 — position + on/off (bulb 6 flickers)
vec3 bulbState(int i, float t) {
  float u = (float(i) + 0.5) / 9.0;
  float x = 0.18 + 0.74 * u;
  float sway = 0.004 * sin(t * 0.9 + float(i) * 1.7);
  float on = 1.0;
  if (i == 6) on = step(0.42, h1(floor(t * 7.0) * 0.913)) * step(0.15, h1(floor(t * 23.0) * 0.377));
  return vec3(x + sway, wireY(x) - 0.012 + sway * 0.6, on);
}

void main() {
  float t = uT;
  vec2 uv = vec2((vUv.x - 0.269) / 0.462, 0.03 + (vUv.y - 0.159) * 1.107);
  vec3 warm = vec3(1.00, 0.72, 0.34);

  // ---- night sky + far quay line
  vec3 col = mix(vec3(0.020, 0.024, 0.045), vec3(0.035, 0.030, 0.050), smoothstep(0.55, 0.95, uv.y));
  col = mix(col, vec3(0.045, 0.038, 0.058), exp(-(uv.y - 0.52) * (uv.y - 0.52) / (0.030 * 0.030)) * 0.6);

  // ---- harbor water: dark rolling band on the left, bulb glints at the edge
  float inW = 1.0 - smoothstep(0.155, 0.175, uv.x);
  if (inW > 0.0) {
    float sw = vnoise(vec2(uv.x * 30.0, uv.y * 8.0 - t * 0.25));
    vec3 water = vec3(0.012, 0.018, 0.032) + sw * vec3(0.012, 0.014, 0.020);
    // rolling swell catching bulb glints at the quay edge
    float glint = (1.0 - smoothstep(0.002, 0.009, abs(uv.y - (0.50 + 0.012 * sin(uv.x * 60.0 + t * 0.7))))) *
                  smoothstep(0.10, 0.16, uv.x) * (0.4 + 0.6 * sw);
    water += warm * glint * 0.35;
    col = mix(col, water, inW);
  }

  // ---- moored barge silhouette upper-left, one porthole glow
  if (uv.x < 0.16 && uv.y > 0.545 && uv.y < 0.615) {
    float hull = step(uv.y, 0.585 - abs(uv.x - 0.075) * 0.35) * step(0.555, uv.y);
    float cabin = step(uv.y, 0.612) * step(0.585, uv.y) * step(0.045, uv.x) * step(uv.x, 0.115);
    col = mix(col, vec3(0.004, 0.005, 0.010), max(hull, cabin) * inW * 0.98);
    float port = 1.0 - smoothstep(0.007, 0.013, length((uv - vec2(0.082, 0.597)) / vec2(1.2, 1.0)));
    col += warm * port * (0.85 + 0.15 * sin(t * 1.3));
  }

  // ---- cobbled quay: dark stone + warm pools under the festoon
  {
    vec3 cob = vec3(0.030, 0.027, 0.032) + vnoise(uv * vec2(160.0, 90.0)) * 0.030;
    // cobble joints
    float jx = abs(fract(uv.x * 90.0) - 0.5), jy = abs(fract(uv.y * 55.0) - 0.5);
    cob *= 1.0 - 0.45 * smoothstep(0.40, 0.5, max(jx, jy));
    for (int i = 0; i < 9; i++) {
      vec3 b = bulbState(i, t);
      vec2 pq = (uv - vec2(b.x, 0.435)) / vec2(0.080, 0.036);
      float pool = exp(-dot(pq, pq));
      cob += warm * pool * b.z * 0.22;
    }
    col = mix(col, cob, (1.0 - smoothstep(0.495, 0.50, uv.y)));
    // foreground props: crate left, barrel right
    float crate = step(abs(uv.x - 0.115), 0.055) * step(abs(uv.y - 0.375), 0.030) * (1.0 - smoothstep(0.495, 0.50, uv.y));
    col = mix(col, vec3(0.050, 0.040, 0.030), crate * 0.95);
    // crate top edge catches the festoon light
    float crim = step(abs(uv.x - 0.115), 0.055) * (1.0 - smoothstep(0.002, 0.006, abs(uv.y - 0.405)));
    col += warm * crim * 0.18;
    col = mix(col, vec3(0.09, 0.07, 0.05), crate * step(0.45, fract(uv.y * 60.0)) * 0.4);
    float barrel = step(length((uv - vec2(0.885, 0.37)) / vec2(1.5, 1.0)), 0.045) * (1.0 - smoothstep(0.495, 0.50, uv.y));
    col = mix(col, vec3(0.048, 0.038, 0.030), barrel * 0.95);
    float band = step(abs(uv.y - 0.37), 0.004) + step(abs(uv.y - 0.352), 0.004);
    col = mix(col, vec3(0.10, 0.075, 0.05), barrel * band * 0.7);
    float brim = 1.0 - smoothstep(0.002, 0.006, abs(uv.y - (0.37 + 0.045 * sqrt(max(0.0, 1.0 - (uv.x - 0.885) * (uv.x - 0.885) / (0.067 * 0.067))))));
    col += warm * brim * barrel * 0.16;
    // rope over the quay edge
    col = mix(col, vec3(0.06, 0.05, 0.04),
              (1.0 - smoothstep(0.0018, 0.004, abs(uv.x - 0.185 - 0.006 * sin(uv.y * 40.0)))) *
              (1.0 - smoothstep(0.49, 0.50, uv.y)) * smoothstep(0.40, 0.42, uv.y) * 0.8);
  }

  // ---- festoon poles + wire + bulbs
  {
    float p1 = (1.0 - smoothstep(0.003, 0.007, abs(uv.x - 0.18))) * step(0.62, uv.y) * step(uv.y, 0.855);
    float p2 = (1.0 - smoothstep(0.003, 0.007, abs(uv.x - 0.92))) * step(0.62, uv.y) * step(uv.y, 0.855);
    col = mix(col, vec3(0.03, 0.028, 0.030), max(p1, p2));
    if (uv.x > 0.18 && uv.x < 0.92) {
      float wy = wireY(uv.x) + 0.002 * sin(t * 0.9 + uv.x * 20.0);
      col = mix(col, vec3(0.05, 0.045, 0.05), 1.0 - smoothstep(0.0009, 0.0022, abs(uv.y - wy)));
    }
    for (int i = 0; i < 9; i++) {
      vec3 b = bulbState(i, t);
      float d = length((uv - b.xy) / vec2(1.0, 1.15));
      float bulb = 1.0 - smoothstep(0.0045, 0.0075, d);
      float halo = exp(-d * d / (0.030 * 0.030));
      col += warm * (bulb * 1.7 + halo * 0.85) * b.z;
    }
  }

  // ---- stall row: legs, counters, striped awnings (x 0.30 / 0.55 / 0.78)
  for (int s = 0; s < 3; s++) {
    float sx = 0.30 + float(s) * 0.245;
    // trestle legs
    float leg = (1.0 - smoothstep(0.002, 0.005, abs(uv.x - sx - 0.085)) +
                 1.0 - smoothstep(0.002, 0.005, abs(uv.x - sx + 0.085))) *
                (1.0 - smoothstep(0.50, 0.505, uv.y)) * smoothstep(0.385, 0.39, uv.y);
    // counter body
    float body = step(abs(uv.x - sx), 0.095) * smoothstep(0.50, 0.505, uv.y) * step(uv.y, 0.615);
    // awning: striped, slight scalloped lower edge
    float aw = step(abs(uv.x - sx), 0.105) * smoothstep(0.615, 0.62, uv.y) * step(uv.y, 0.705 + 0.010 * sin(uv.x * 60.0));
    float stripe = step(0.5, fract((uv.x - sx) * 22.0));
    vec3 acol = mix(vec3(0.10, 0.035, 0.035), vec3(0.13, 0.09, 0.05), stripe) * (0.7 + 0.3 * float(s == 1));
    col = mix(col, vec3(0.055, 0.045, 0.042), clamp(leg + body, 0.0, 1.0) * 0.95);
    col = mix(col, acol * (1.0 + 0.6 * exp(-(uv.y - 0.66) * (uv.y - 0.66) / (0.06 * 0.06))), aw * 0.96);
    // bulb-light spill across each stall front
    vec2 sq = (uv - vec2(sx, 0.58)) / vec2(0.16, 0.09);
    col += warm * exp(-dot(sq, sq)) * 0.10;
  }

  // ---- steam column off the middle stall's pot (curls right in the breeze)
  {
    float puff = uPuff;
    // continuous thin column rising off the pot, bending right as it climbs
    float colm = 1.0 - smoothstep(0.006, 0.020,
      abs(uv.x - (0.575 + 0.05 * (uv.y - 0.615) * (uv.y - 0.615) * 30.0 + 0.008 * sin(uv.y * 40.0 + t * 1.1))));
    colm *= smoothstep(0.615, 0.63, uv.y) * (1.0 - smoothstep(0.74, 0.86, uv.y));
    col = mix(col, vec3(0.40, 0.38, 0.37), colm * 0.30 * (1.0 + puff));
    float sc = 0.0;
    for (int k = 0; k < 4; k++) {
      float fi = float(k);
      float ph = fract(t * 0.10 + fi * 0.25);
      vec2 sp = vec2(0.575 + 0.045 * ph * ph + 0.012 * sin(t * 0.8 + fi * 2.0),
                     0.615 + 0.26 * ph);
      float rr = 0.014 + 0.028 * ph + 0.012 * puff;
      sc = max(sc, (1.0 - smoothstep(rr * 0.45, rr, length(uv - sp))) * (1.0 - ph) * (0.40 + 0.60 * puff));
    }
    col = mix(col, vec3(0.52, 0.48, 0.46), sc * 0.60);
    // the pot itself, glinting
    col += warm * (1.0 - smoothstep(0.008, 0.014, length((uv - vec2(0.575, 0.617)) / vec2(1.6, 1.0)))) * 0.12;
  }

  // ---- vendor silhouette behind the middle stall (straightens + gestures)
  {
    float lean = 0.012 * (1.0 - uArm) * sin(t * 0.5);
    vec2 vc = vec2(0.525 + lean, 0.585);
    float torso = 1.0 - smoothstep(0.012, 0.020, length((uv - vc) / vec2(0.9, 1.35)));
    float head = 1.0 - smoothstep(0.006, 0.010, length((uv - (vc + vec2(0.0, 0.042))) / vec2(0.85, 1.1)));
    // arm gesture: raises on uArm
    float arm = 0.0;
    if (uArm > 0.01) {
      vec2 ah = vc + vec2(-0.020, 0.010 + 0.022 * uArm);
      arm = 1.0 - smoothstep(0.003, 0.007, sdSeg(uv, vc + vec2(-0.006, 0.015), ah));
    }
    col = mix(col, vec3(0.040, 0.032, 0.030), clamp(torso + head + arm, 0.0, 1.0) * 0.95);
  }

  // ---- customer at the right stall: pays ~9.5, walks off with the parcel
  if (uCust.x < 1.05) {
    float cc = uCust.x;
    float bob = (uCust.x > 0.81 ? abs(sin(t * 7.0)) * 0.004 : 0.0);
    vec2 cp = vec2(cc + 0.03, 0.505 + bob);
    float legs = (1.0 - smoothstep(0.003, 0.006, sdSeg(uv, cp, cp + vec2(-0.008, -0.075)))) +
                 (1.0 - smoothstep(0.003, 0.006, sdSeg(uv, cp, cp + vec2(0.008, -0.075))));
    float torso = 1.0 - smoothstep(0.011, 0.018, length((uv - cp) / vec2(0.85, 1.5)));
    float head = 1.0 - smoothstep(0.005, 0.009, length((uv - (cp + vec2(0.0, 0.038))) / vec2(0.9, 1.1)));
    float parcel = uCust.y * (1.0 - smoothstep(0.006, 0.011, length((uv - (cp + vec2(-0.018, -0.010))))));
    col = mix(col, vec3(0.042, 0.034, 0.032), clamp(legs + torso + head + parcel, 0.0, 1.0) * 0.95);
  }

  // ---- the cat: weaves between the stall legs
  if (uCat.x > -0.04 && uCat.x < 1.05) {
    float wv = 0.010 * sin(uCat.x * 22.0);            // weave path
    float gait = (uCat.x != 0.55 ? sin(t * 11.0) : 0.0);
    vec2 cp = vec2(uCat.x, 0.410 + wv);
    float body = 1.0 - smoothstep(0.008, 0.015, length((uv - cp) / vec2(2.0, 0.75)));
    float head = 1.0 - smoothstep(0.005, 0.010, length((uv - (cp + vec2(-0.026, 0.010))) / vec2(1.1, 1.0)));
    float ear = 1.0 - smoothstep(0.003, 0.006, sdSeg(uv, cp + vec2(-0.032, 0.016), cp + vec2(-0.029, 0.027)));
    float tail = 1.0 - smoothstep(0.0035, 0.007, sdSeg(uv, cp + vec2(0.022, 0.006), cp + vec2(0.038, 0.029 + 0.006 * gait)));
    float legs = (1.0 - smoothstep(0.0028, 0.006, sdSeg(uv, cp + vec2(-0.013 + gait * 0.005, -0.006), cp + vec2(-0.013, -0.022)))) +
                 (1.0 - smoothstep(0.0028, 0.006, sdSeg(uv, cp + vec2(0.010 - gait * 0.005, -0.006), cp + vec2(0.010, -0.022))));
    col = mix(col, vec3(0.020, 0.018, 0.020), clamp(body + head + ear + tail + legs, 0.0, 1.0) * 0.95);
  }

  // ---- gull settled on the far bollard
  {
    vec2 gp = vec2(0.955, 0.50);
    float bol = 1.0 - smoothstep(0.004, 0.008, sdSeg(uv, vec2(0.955, 0.475), gp));
    float gb = 1.0 - smoothstep(0.006, 0.010, length((uv - (gp + vec2(0.0, 0.010))) / vec2(1.6, 0.9)));
    float gh = 1.0 - smoothstep(0.003, 0.006, length((uv - (gp + vec2(-0.008, 0.020))) / vec2(1.0, 1.0)));
    col = mix(col, vec3(0.030, 0.028, 0.030), max(bol, gb + gh) * 0.95);
  }

  fragColor = vec4(col, 1.0);
}`;

export default class QuayfeastScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private bu = {
    uT: { value: 0 }, uArm: { value: 0 }, uPuff: { value: 0 },
    uCat: { value: new THREE.Vector2(0, 0) }, uCust: { value: new THREE.Vector2(0, 0) },
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
    // low near-static; slight drift along the stall row
    this.cam.position.x = -1.4 + t * 0.14;
    this.cam.lookAt(this.cam.position.x * 0.4 + 0.8, 6.8, PZ + 10);

    this.bu.uT.value = t;
    this.bu.uArm.value = armW(t);
    this.bu.uPuff.value = puffW(t);
    this.bu.uCat.value.set(catX(t), 0.415);
    this.bu.uCust.value.set(custX(t), ss(9.5, 9.9, t));

    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const W = P.width || 1920, H = P.height || 1080;
        this.cam.updateMatrixWorld();
        const cx = catX(t);
        if (cx > -0.02 && cx < 0.99) {
          aToV(cx, 0.44, this.p).project(this.cam);
          const px = (this.p.x * 0.5 + 0.5) * W, py = (0.5 - this.p.y * 0.5) * H;
          P.textProbes.push({
            frameIdx: P.currentFrameIdx ?? 0, t, text: 'cat',
            fontFamily: 'Archivo, sans-serif', fontPx: 20,
            fillStyle: '#1c1a18', globalAlpha: 0.9, layerId: 'quayfeast',
            bbox: [px - 22, py - 18, px + 22, py + 12],
            w: 44, h: 30, cx: px, cy: py, hPct: (30 / H) * 100, isStroke: false,
          });
        }
        aToV(0.55, 0.83, this.p).project(this.cam);
        const bx = (this.p.x * 0.5 + 0.5) * W, by = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'festoon',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#5a4632', globalAlpha: 0.75, layerId: 'quayfeast',
          bbox: [bx - 34, by - 18, bx + 34, by + 14],
          w: 68, h: 32, cx: bx, cy: by, hPct: (32 / H) * 100, isStroke: false,
        });
      }
    }

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 1.05,
      bloom: 0.16,
      bloomThreshold: 0.66,
      bloomRadius: 0.55,
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
