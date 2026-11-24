import * as THREE from 'three';
import { Scene, SceneCtx, Frame, PostOverrides } from '../../engine/scene';

// threshing — a threshing barn doorway at harvest dusk, dust motes in the
// raking shaft, a sparrow darting through, an owl gliding past the roofline,
// a cat on a grain sack. Authored in flat uv space on one SDF quad.

const ss = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// beat envelopes
const moteU = (t: number) => ss(3.5, 5, t) * (1 - ss(17.5, 19.5, t));
const spInU = (t: number) => ss(8.2, 8.9, t) * (1 - ss(9.1, 9.6, t));
const spOutU = (t: number) => ss(9.8, 10.3, t) * (1 - ss(10.5, 11.1, t));
const spIn2U = (t: number) => ss(10.8, 11.3, t) * (1 - ss(11.5, 12.0, t));
const perchU = (t: number) => ss(12.6, 13.1, t) * (1 - ss(15.2, 15.8, t));
const owlU = (t: number) => ss(13.8, 14.4, t) * (1 - ss(15.6, 16.4, t));
const mouseU = (t: number) => ss(11.3, 11.6, t) * (1 - ss(12.1, 12.5, t));

// sparrow positions (closed form) — dart-in: right jamb -> left inside; dart
// out: left -> right through the shaft; second in: low crossing to perch base.
const sparrowPos = (t: number): [number, number, number] => {
  const i1 = spInU(t), o1 = spOutU(t), i2 = spIn2U(t), p = perchU(t);
  if (p > 0.02 && i1 < 0.02 && o1 < 0.02 && i2 < 0.02) {
    // perched on the lintel, tail flick, then darts off at the end of perchU
    const off = ss(0.86, 1.0, p);
    const x = 0.52 + off * 0.9;
    const y = 0.765 - off * 0.4;
    return [x, y, off > 0.99 ? 0 : 1];
  }
  if (i2 > 0.02) {
    const d = i2;
    // low crossing that finishes under the lintel, inside the shaft band
    return [0.68 - d * 0.16, 0.32 + Math.abs(Math.sin(d * Math.PI)) * 0.09, 1];
  }
  if (o1 > 0.02) {
    const d = o1;
    // out through the beam: left-mid -> right jamb, staying lit
    return [0.50 + d * 0.24, 0.50 + Math.abs(Math.sin(d * Math.PI * 1.4)) * 0.10, 1];
  }
  if (i1 > 0.02) {
    const d = i1;
    // in through the beam: right jamb -> mid-shaft
    return [0.68 - d * 0.16, 0.55 - Math.abs(Math.sin(d * Math.PI)) * 0.13, 1];
  }
  return [0, 0, 0];
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
uniform float uT, uMote, uOwl, uMouse, uSpx, uSpy, uSpv;

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
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}
float ellipse(vec2 p, vec2 c, vec2 r) { return length((p - c) / r) - 1.0; }
float boxMask(vec2 uv, vec2 b, vec2 e) {
  return smoothstep(b.x - 0.004, b.x, uv.x) * (1.0 - smoothstep(e.x, e.x + 0.004, uv.x))
       * smoothstep(b.y - 0.004, b.y, uv.y) * (1.0 - smoothstep(e.y, e.y + 0.004, uv.y));
}

// door opening bounds
const vec2 DOOR_LO = vec2(0.38, 0.12);
const vec2 DOOR_HI = vec2(0.66, 0.74);

// the raking shaft: enters through the upper-right of the opening and lands
// in a pool on the floor, leaning left as it drops
float shaftAt(vec2 uv, float t) {
  float sway = 0.010 * sin(t * 0.35);
  // shaft centerline: x = 0.63 at y 0.74 -> x = 0.44 at floor
  float cx = 0.44 + (uv.y - 0.12) / 0.62 * 0.19 + sway * (uv.y - 0.12);
  float inside = 1.0 - smoothstep(0.02, 0.075, abs(uv.x - cx));
  // clip to the doorway opening and the floor pool it spills into
  float inDoor = smoothstep(DOOR_LO.x - 0.05, DOOR_LO.x, uv.x)
               * (1.0 - smoothstep(DOOR_HI.x, DOOR_HI.x + 0.02, uv.x))
               * smoothstep(DOOR_LO.y - 0.06, DOOR_LO.y, uv.y)
               * (1.0 - smoothstep(DOOR_HI.y, DOOR_HI.y + 0.02, uv.y));
  float pool = (1.0 - smoothstep(0.13, 0.18, uv.y)) * smoothstep(0.30, 0.36, uv.x)
             * (1.0 - smoothstep(0.62, 0.68, uv.x));
  return inside * max(inDoor, pool * 1.2);
}

// weathered plank shading for the barn wall
vec3 plankShade(vec2 uv, vec3 base) {
  float plank = floor(uv.x * 26.0);
  float seam = 1.0 - smoothstep(0.002, 0.006, abs(fract(uv.x * 26.0) - 0.5) - 0.46);
  float v = 0.82 + 0.18 * h1(plank * 3.7);
  float weather = vnoise(uv * vec2(60.0, 160.0));
  vec3 c = base * v * (0.85 + 0.15 * weather);
  return c * (1.0 - seam * 0.35);
}

void main() {
  float t = uT;
  vec2 uv = vec2((vUv.x - 0.269) / 0.462, 0.03 + (vUv.y - 0.159) * 1.107);

  // ---- dusk sky above the roofline: rose->steel
  vec3 col = mix(vec3(0.62, 0.38, 0.30), vec3(0.30, 0.32, 0.42),
                 smoothstep(0.80, 1.0, uv.y));
  col = mix(vec3(0.16, 0.12, 0.14), col, smoothstep(0.76, 0.80, uv.y));

  // ---- barn front wall (planks), shaded umber/plum in dusk shade
  vec3 wall = plankShade(uv, vec3(0.185, 0.135, 0.11));
  float wallMask = smoothstep(0.745, 0.75, uv.y) * -1.0 + 1.0; // below roof edge
  col = mix(col, wall, wallMask * smoothstep(0.075, 0.08, uv.y));

  // ---- roofline: dark eaves band + a sliver of sky glow on it
  float eaves = smoothstep(0.74, 0.75, uv.y) * (1.0 - smoothstep(0.79, 0.795, uv.y));
  col = mix(col, vec3(0.09, 0.07, 0.08), eaves);
  col += vec3(0.55, 0.32, 0.20) * eaves * 0.25 * smoothstep(0.788, 0.795, uv.y);

  // ---- lintel beam over the door
  float lintel = smoothstep(0.72, 0.722, uv.y) * (1.0 - smoothstep(0.742, 0.744, uv.y))
               * smoothstep(0.36, 0.365, uv.x) * (1.0 - smoothstep(0.69, 0.695, uv.x));
  col = mix(col, vec3(0.16, 0.11, 0.08), lintel);
  // warm rim on the lintel's sun edge
  col += vec3(0.9, 0.55, 0.25) * lintel * 0.5 * smoothstep(0.70, 0.72, uv.x)
       * (1.0 - smoothstep(0.738, 0.742, uv.y));

  // ---- wheat stubble foreground band
  if (uv.y < 0.115) {
    float stub = vnoise(vec2(uv.x * 240.0, uv.y * 40.0));
    vec3 ground = mix(vec3(0.13, 0.10, 0.07), vec3(0.22, 0.16, 0.10), stub);
    // sparse vertical stubble strokes
    float sx = fract(uv.x * 150.0);
    float stalk = (1.0 - smoothstep(0.02, 0.08, abs(sx - 0.5)))
                * (1.0 - smoothstep(0.0, 0.02, abs(uv.y - (0.045 + 0.03 * h1(floor(uv.x * 150.0) * 7.1))) - 0.028));
    ground = mix(ground, vec3(0.30, 0.22, 0.12), stalk * 0.8);
    col = mix(col, ground, 1.0 - smoothstep(0.112, 0.118, uv.y));
  }

  // ---- doorway interior: near-black with sparse hints
  float inDoor = boxMask(uv, DOOR_LO, DOOR_HI);
  if (inDoor > 0.001) {
    vec3 inner = vec3(0.045, 0.032, 0.026);
    // haystack edge: soft mound against the right interior
    float hay = (1.0 - smoothstep(0.58, 0.62, uv.x + vnoise(uv * vec2(30.0, 20.0)) * 0.03))
              * (1.0 - smoothstep(0.44, 0.50, uv.y));
    inner = mix(inner, vec3(0.10, 0.075, 0.045), hay * 0.9);
    // hanging rope from the top of the opening, slight sway
    float rx = 0.47 + 0.006 * sin(t * 0.6) * (0.74 - uv.y);
    float rope = (1.0 - smoothstep(0.0015, 0.004, abs(uv.x - rx)))
               * (1.0 - smoothstep(0.70, 0.72, uv.y)) * (1.0 - smoothstep(0.28, 0.30, uv.y));
    inner = mix(inner, vec3(0.16, 0.12, 0.09), rope * 0.8);
    // pitchfork leaning on the left jamb
    float fork = 1.0 - smoothstep(0.0015, 0.005,
      sdSeg(uv, vec2(0.395, 0.14), vec2(0.425, 0.52)));
    float tines = 1.0 - smoothstep(0.0012, 0.004,
      sdSeg(uv, vec2(0.418, 0.50), vec2(0.432, 0.56)));
    inner = mix(inner, vec3(0.14, 0.10, 0.08), clamp(fork + tines, 0.0, 1.0) * 0.85);
    // field crack: thin lit sliver between swung door and right jamb
    float crack = smoothstep(0.650, 0.653, uv.x) * (1.0 - smoothstep(0.657, 0.660, uv.x));
    inner = mix(inner, vec3(0.55, 0.34, 0.18), crack * 0.9);
    col = mix(col, inner, inDoor);
  }

  // ---- jamb rim glow: sun rakes the right jamb edge
  float rim = (1.0 - smoothstep(0.004, 0.012, abs(uv.x - DOOR_HI.x)))
            * smoothstep(DOOR_LO.y, DOOR_LO.y + 0.02, uv.y)
            * (1.0 - smoothstep(DOOR_HI.y - 0.02, DOOR_HI.y, uv.y));
  col += vec3(0.95, 0.58, 0.26) * rim * 0.55;

  // ---- swung-open door slab, right of the opening
  float slab = smoothstep(0.665, 0.67, uv.x) * (1.0 - smoothstep(0.80, 0.805, uv.x))
             * smoothstep(0.11, 0.115, uv.y) * (1.0 - smoothstep(0.755, 0.76, uv.y));
  if (slab > 0.001) {
    vec3 doorC = plankShade(uv + vec2(0.37, 0.0), vec3(0.145, 0.10, 0.075));
    // hinge straps
    float strap = (1.0 - smoothstep(0.008, 0.02, abs(uv.x - 0.685)))
                * ((1.0 - smoothstep(0.0, 0.008, abs(uv.y - 0.62) - 0.012))
                 + (1.0 - smoothstep(0.0, 0.008, abs(uv.y - 0.24) - 0.012)));
    doorC = mix(doorC, vec3(0.10, 0.08, 0.07), clamp(strap, 0.0, 1.0) * 0.7);
    // its lit inner edge catches the raking sun
    doorC += vec3(0.9, 0.55, 0.25) * (1.0 - smoothstep(0.003, 0.012, abs(uv.x - 0.668))) * 0.5;
    // darker than the wall + a shadow line on its outer edge so it reads open
    doorC *= 0.9 - 0.5 * smoothstep(0.79, 0.80, uv.x);
    col = mix(col, doorC, slab);
  }

  // ---- the shaft + floor pool (over wall+interior, under figures)
  float sh = shaftAt(uv, t);
  vec3 shaftCol = vec3(0.95, 0.62, 0.30);
  col += shaftCol * sh * (uv.y < 0.18 ? 0.55 : 0.30);

  // ---- dust motes inside the shaft
  if (uMote > 0.01) {
    for (int k = 0; k < 42; k++) {
      float fk = float(k);
      float seed = h1(fk * 13.37);
      // mote drifts down-left along the shaft dir, loops within its band
      float fall = fract(seed + t * (0.02 + 0.03 * h1(fk * 5.1)));
      vec2 mp = vec2(0.40 + 0.24 * h1(fk * 9.7) + fall * -0.10,
                     0.16 + fall * 0.55);
      float wob = 0.004 * sin(t * (1.5 + seed) + fk);
      mp.x += wob;
      float dens = (0.35 + 0.65 * h1(fk * 3.3)) * (1.0 - (mp.y - 0.16) / 0.55);
      float tw = 0.6 + 0.4 * sin(t * 3.0 + fk * 11.0);
      float m = 1.0 - smoothstep(0.0012, 0.0032, length(uv - mp));
      col += vec3(1.0, 0.8, 0.5) * m * dens * tw * uMote
           * clamp(shaftAt(mp, t) * 3.0, 0.0, 1.0) * 0.85;
    }
  }

  // ---- grain sack + cat silhouette, grounded at the wall base
  float sack = smoothstep(0.0, -0.02, ellipse(uv, vec2(0.73, 0.085), vec2(0.045, 0.028)));
  col = mix(col, vec3(0.12, 0.09, 0.07), sack * 0.9);
  // cat body: upright sitting silhouette on the sack
  float catB = smoothstep(0.0, -0.008, ellipse(uv, vec2(0.725, 0.135), vec2(0.026, 0.042)));
  float catH = smoothstep(0.0, -0.008, ellipse(uv, vec2(0.722, 0.180), vec2(0.016, 0.015)));
  float ear = (1.0 - smoothstep(0.001, 0.005, sdSeg(uv, vec2(0.712, 0.191), vec2(0.714, 0.203))))
            + (1.0 - smoothstep(0.001, 0.005, sdSeg(uv, vec2(0.730, 0.191), vec2(0.732, 0.203))));
  float flick = 0.5 + 0.5 * sin(t * 1.9) * sin(t * 0.43);
  vec2 tailTip = vec2(0.752 + 0.018 * sin(t * 2.3 + flick * 2.0), 0.115 + 0.010 * flick);
  float tail = 1.0 - smoothstep(0.002, 0.006,
    sdSeg(uv, vec2(0.745, 0.095), tailTip));
  float cat = clamp(catB + catH + ear + tail, 0.0, 1.0);
  col = mix(col, vec3(0.06, 0.05, 0.05), cat * 0.95);

  // ---- mouse dart along the threshold
  if (uMouse > 0.01) {
    float mx = 0.40 + uMouse * 0.22;
    float mrun = abs(sin(uMouse * 30.0)) * 0.004;
    float mm = smoothstep(0.0, -0.004, ellipse(uv, vec2(mx, 0.125 + mrun), vec2(0.011, 0.006)));
    mm += 1.0 - smoothstep(0.001, 0.003, sdSeg(uv, vec2(mx - 0.010, 0.124), vec2(mx - 0.017, 0.130)));
    col = mix(col, vec3(0.05, 0.04, 0.04), clamp(mm, 0.0, 1.0) * uMouse);
  }

  // ---- owl glide above the roofline (backlit, slow)
  if (uOwl > 0.01) {
    vec2 op = vec2(0.12 + uOwl * 0.78, 0.86 + 0.02 * sin(uOwl * 6.0));
    float ow = smoothstep(0.0, -0.006, ellipse(uv, op, vec2(0.016, 0.012)));
    float wing = 1.0 - smoothstep(0.002, 0.008,
      sdSeg(uv, op + vec2(-0.055, 0.012), op + vec2(0.055, 0.012)));
    ow += wing;
    col = mix(col, vec3(0.10, 0.08, 0.10), clamp(ow, 0.0, 1.0) * uOwl * 0.9);
  }

  // ---- sparrow silhouette (cut-out in the shaft)
  if (uSpv > 0.01) {
    vec2 sp = vec2(uSpx, uSpy);
    float body = smoothstep(0.0, -0.004, ellipse(uv, sp, vec2(0.014, 0.008)));
    float wflap = sin(t * 55.0);
    vec2 wt = sp + vec2(0.012 * sign(wflap + 0.001) * (abs(wflap) > 0.3 ? 1.0 : 0.4),
                        0.010 + 0.012 * abs(wflap));
    float wing = 1.0 - smoothstep(0.001, 0.005, sdSeg(uv, sp, wt));
    float bird = clamp(body + wing, 0.0, 1.0) * uSpv;
    // caught in the shaft it reads dark against the light
    float lit = clamp(shaftAt(sp, t) * 2.0 + 0.4, 0.0, 1.0);
    col = mix(col, vec3(0.07, 0.05, 0.04), bird * 0.95 * lit);
  }

  // ---- doorway vignette edge (keep the opening's corners deep)
  col *= 1.0 - 0.18 * inDoor * (1.0 - sh);

  fragColor = vec4(col, 1.0);
}`;

export default class ThreshingScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private bu = {
    uT: { value: 0 }, uMote: { value: 0 }, uSp: { value: 0 },
    uOwl: { value: 0 }, uMouse: { value: 0 },
    uSpx: { value: 0 }, uSpy: { value: 0 }, uSpv: { value: 0 },
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
    // low near-static; slight push toward the doorway
    this.cam.position.x = -0.4 + t * 0.04;
    this.cam.position.z = 30 - t * 0.10;
    this.cam.lookAt(this.cam.position.x * 0.3, 6.5, PZ + 10);

    const [sx, sy, sv] = sparrowPos(t);
    this.bu.uT.value = t;
    this.bu.uMote.value = moteU(t);
    this.bu.uOwl.value = owlU(t);
    this.bu.uMouse.value = mouseU(t);
    this.bu.uSpx.value = sx; this.bu.uSpy.value = sy; this.bu.uSpv.value = sv;

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
        if (sv > 0.01) {
          const sb = boxFor(sx - 0.03, sy - 0.03, sx + 0.03, sy + 0.035);
          P.textProbes.push({
            frameIdx: P.currentFrameIdx ?? 0, t, text: 'sparrow',
            fontFamily: 'Archivo, sans-serif', fontPx: 20,
            fillStyle: '#1a1410', globalAlpha: 0.9, layerId: 'threshing',
            bbox: sb.bbox, w: sb.w, h: sb.h, cx: sb.cx, cy: sb.cy,
            hPct: (sb.h / H) * 100, isStroke: false,
          });
        }
        const db = boxFor(0.38, 0.12, 0.66, 0.74);
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'doorway',
          fontFamily: 'Archivo, sans-serif', fontPx: 20,
          fillStyle: '#241a10', globalAlpha: 0.75, layerId: 'threshing',
          bbox: db.bbox, w: db.w, h: db.h, cx: db.cx, cy: db.cy,
          hPct: (db.h / H) * 100, isStroke: false,
        });
      }
    }

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 1.04,
      bloom: 0.15,
      bloomThreshold: 0.68,
      bloomRadius: 0.5,
      grade: { saturation: 1.04, gamma: 1.0 },
    } as PostOverrides;
  }

  override dispose() {
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    });
  }
}

