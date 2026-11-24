// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// brokendale — a derelict stone bothy in a high dale at dusk. One fullscreen
// GLSL pass holds the shot: a grass hillside falling to a dark valley band, a
// roofless ruin mid-frame (one gable still standing, dark window hole,
// collapsed end wall spilling blocks, chimney stump), heather on the slope, a
// dry stone wall crossing it, and a thin mist ribbon drifting the valley floor.
// Last light catches the gable's top edge in a warm thin line. Sheep graze the
// slope (one lifts its head, one steps past the ruin); a hare bounds once
// between heather clumps; a curlew crosses the valley band; a raven circles
// the chimney stump once. All closed-form f(t), hash seeds only. CameraRig is
// low and near-static with a slight drift up the slope toward the gable;
// Layer2D holds anchored captions.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { CameraRig } from '../../engine/rig';
import { Layer2D, W, H } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { F } from '../../engine/type';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const VERT = /* glsl */ `
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
out vec4 fragColor;

const float ASPECT = 320.0 / 140.0; // uv x→world x vs y — /ASPECT for round shapes
// beats
const float HEADLIFT = 3.5;  // near sheep raises its head
const float WALK = 6.0;      // far sheep steps past the ruin 6→10s
const float GUST = 7.0;      // one gust stirs the heather
const float HARE = 8.5;      // hare bounds between heather clumps
const float CURLEW = 10.5;   // curlew crosses the valley band
const float RAVEN = 12.5;    // raven circles the chimney stump
const float STAR = 12.0;     // the one faint star fades in
const float SETTLE = 15.5;

float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec2 h2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}
float vn(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(h2(i).x, h2(i + vec2(1.0, 0.0)).x, u.x),
    mix(h2(i + vec2(0.0, 1.0)).x, h2(i + vec2(1.0, 1.0)).x, u.x),
    u.y);
}
float sstep(float a, float b, float x) {
  float t = clamp((x - a) / (b - a), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}
float sdist(vec2 a, vec2 b, vec2 r) {
  vec2 d = (a - b) / r;
  return dot(d, d);
}
float sbox(vec2 p, vec2 c, vec2 b) {
  vec2 d = abs(p - c) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * t);
}

// hillside edge: falls left→right into the valley
float hillAt(float x) { return 0.66 - 0.22 * x; }

// the still-standing gable: wall polygon x 0.58–0.68 on the slope
float gableTop(float x) {
  return 0.86 - 0.06 * (x - 0.58) + 0.015 * vn(vec2(x * 60.0, 3.0));
}
float gableAt(vec2 uv) {
  if (uv.x < 0.58 || uv.x > 0.68) return 0.0;
  float base = hillAt(uv.x) - 0.015;
  float top = gableTop(uv.x);
  return (uv.y > base && uv.y < top) ? 1.0 : 0.0;
}
// collapsed end wall: stub west of the gable
float stubAt(vec2 uv) {
  if (uv.x < 0.50 || uv.x > 0.585) return 0.0;
  float base = hillAt(uv.x) - 0.02;
  float top = base + 0.045 + 0.02 * vn(vec2(uv.x * 70.0, 7.0));
  return (uv.y > base && uv.y < top) ? 1.0 : 0.0;
}
// scattered blocks spilled downhill of the collapse
float blocksAt(vec2 uv) {
  float m = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    vec2 c = vec2(0.475 + 0.016 * fi + 0.012 * h1(fi * 13.7),
                  hillAt(0.475 + 0.016 * fi) - 0.006 - 0.028 * h1(fi * 31.1));
    vec2 sz = vec2(0.008 + 0.005 * h1(fi * 7.3), 0.005 + 0.004 * h1(fi * 9.1));
    float d = sbox(uv, c, sz);
    m = max(m, 1.0 - sstep(0.0, 0.003, d));
  }
  return m;
}
// chimney stump on the gable's west corner
float chimneyAt(vec2 uv) {
  return (uv.x > 0.573 && uv.x < 0.594 && uv.y > gableTop(0.584) - 0.055 && uv.y < gableTop(0.584) + 0.038) ? 1.0 : 0.0;
}
// dry stone wall line crossing the slope
float wallAt(vec2 uv) {
  float d = seg(uv, vec2(0.04, 0.645), vec2(0.52, 0.545));
  float courses = 0.6 + 0.4 * step(0.5, fract(uv.x * 210.0));
  return (1.0 - sstep(0.0018, 0.0035, d)) * courses;
}
// heather clumps on the slope — seeded blobs, stirred by the gust
float heatherAt(vec2 uv, float t) {
  float g = sstep(GUST, GUST + 0.6, t) * sstep(GUST + 2.6, GUST + 1.8, t);
  float m = 0.0;
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float x = 0.10 + 0.42 * h1(fi * 17.3);
    float y = hillAt(x) - 0.012 - 0.05 * h1(fi * 23.9);
    vec2 c = vec2(x + g * 0.004 * sin(t * 9.0 + fi * 2.0), y);
    float d = sdist(uv, c, vec2(0.020 + 0.010 * h1(fi * 5.7), 0.010 + 0.006 * h1(fi * 3.1)));
    m = max(m, (1.0 - sstep(0.6, 1.1, d)));
  }
  return m;
}
// grazing sheep silhouette: body oval + head blob (head lifts on the beat)
float sheepAt(vec2 uv, vec2 c, float headLift, float t, float seed) {
  float d = sdist(uv, c, vec2(0.020, 0.011));
  vec2 hc = c + vec2(0.018, 0.004 + headLift * 0.009);
  d = min(d, sdist(uv, hc, vec2(0.007, 0.006)));
  float legs = (uv.x > c.x - 0.014 && uv.x < c.x + 0.012 && uv.y < c.y && uv.y > c.y - 0.008)
    ? step(0.5, fract(uv.x * 480.0 + seed)) : 0.0;
  return max(1.0 - sstep(0.55, 1.0, d), legs * 0.8);
}
// bounding hare: 3 hops through the heather zone
float hareAt(vec2 uv, float t) {
  float u = sstep(HARE, HARE + 1.6, t);
  if (u <= 0.0 || u >= 1.0) return 0.0;
  float x = mix(0.18, 0.40, u);
  float y = hillAt(x) - 0.015 + 0.030 * abs(sin(u * 9.425));
  float d = sdist(uv, vec2(x, y), vec2(0.012, 0.007));
  d = min(d, sdist(uv, vec2(x - 0.008, y + 0.010), vec2(0.004, 0.008))); // ears
  return 1.0 - sstep(0.6, 1.0, d);
}
// curlew silhouette crossing the valley band, slow wingbeat
float curlewAt(vec2 uv, float t) {
  float u = sstep(CURLEW, CURLEW + 2.4, t);
  if (u <= 0.0 || u >= 1.0) return 0.0;
  float x = mix(-0.02, 1.02, u);
  float y = 0.395 + 0.012 * sin(u * 5.0);
  vec2 p = vec2(x, y);
  float flap = sin(t * 12.0) * 0.9 + 0.4;
  float d = sdist(uv, p, vec2(0.011, 0.005));
  // wings: swept arcs above the body
  d = min(d, sdist(uv, p + vec2(-0.012, 0.004 * flap + 0.006), vec2(0.011, 0.003)));
  d = min(d, sdist(uv, p + vec2(0.010, 0.004 * flap + 0.005), vec2(0.009, 0.003)));
  // decurved bill forward
  d = min(d, sdist(uv, p + vec2(0.016, -0.004), vec2(0.006, 0.002)));
  return 1.0 - sstep(0.6, 1.0, d);
}
// raven circling the chimney stump once, then gone
float ravenAt(vec2 uv, float t) {
  float u = sstep(RAVEN, RAVEN + 2.6, t);
  if (u <= 0.0 || u >= 1.0) return 0.0;
  float a = u * 6.2832;
  vec2 c = vec2(0.584, gableTop(0.584) + 0.05);
  vec2 p = c + vec2(cos(a) * 0.055, sin(a) * 0.028 + 0.012 * u);
  float d = sdist(uv, p, vec2(0.008, 0.004));
  d = min(d, sdist(uv, p + vec2(-0.009, 0.003), vec2(0.008, 0.0025)));
  return (1.0 - sstep(0.6, 1.0, d)) * sstep(RAVEN, RAVEN + 0.15, t);
}
// mist ribbons drifting the valley floor leftward
float mistAt(vec2 uv, float t) {
  if (uv.y > 0.46) return 0.0;
  float m = 0.0;
  float w1 = 0.415 + 0.020 * sin(uv.x * 9.0 + t * 0.22) + 0.012 * vn(vec2(uv.x * 14.0 + t * 0.10, 2.0));
  { float dm = (uv.y - w1) / 0.010; m += 0.5 * exp(-(dm * dm)); }
  float w2 = 0.372 + 0.016 * sin(uv.x * 12.0 - t * 0.16 + 3.0);
  { float dm = (uv.y - w2) / 0.008; m += 0.35 * exp(-(dm * dm)); }
  return m * sstep(2.0, 4.0, t);
}

void main() {
  vec2 uv = vUv;
  float t = uT;

  // dusk sky: deep blue up top, slate band toward the horizon
  vec3 col = mix(vec3(0.240, 0.290, 0.385), vec3(0.078, 0.102, 0.175), sstep(0.42, 0.95, uv.y));
  { float dh = (uv.y - 0.60) / 0.10; col += vec3(0.05, 0.035, 0.02) * exp(-(dh * dh)) * sstep(1.0, 0.0, uv.x); }

  // one faint star, fading in late
  float star = exp(-sdist(uv, vec2(0.73, 0.92), vec2(0.0035, 0.0035)) * 6.0);
  col += vec3(0.9, 0.92, 1.0) * star * sstep(STAR, STAR + 2.0, t) * (0.55 + 0.25 * sin(t * 2.7));

  // dark valley band below the hill's foot
  float valley = sstep(0.47, 0.40, uv.y);
  col = mix(col, vec3(0.075, 0.090, 0.125), valley * 0.9);

  // grass hillside below the edge line — darker with distance
  float he = hillAt(uv.x);
  if (uv.y < he) {
    float depth = sstep(he, he - 0.30, uv.y);
    vec3 grass = mix(vec3(0.135, 0.150, 0.105), vec3(0.075, 0.085, 0.065), depth);
    grass += (vn(uv * vec2(90.0, 60.0)) - 0.5) * 0.022;
    col = mix(col, grass, 1.0 - valley);
    // dry stone wall crossing the slope
    col = mix(col, vec3(0.10, 0.10, 0.11), wallAt(uv) * 0.85);
    // heather clumps
    col = mix(col, vec3(0.145, 0.110, 0.140), heatherAt(uv, t) * 0.7);
  }

  // mist ribbons sit on the valley floor (behind the hill's foot too)
  col = mix(col, vec3(0.36, 0.40, 0.49), mistAt(uv, t) * 0.42);

  // ---- the ruin ----
  float wall = max(gableAt(uv), max(stubAt(uv), max(blocksAt(uv), chimneyAt(uv))));
  if (wall > 0.0) {
    vec3 stone = vec3(0.115, 0.115, 0.125) + (vn(uv * vec2(160.0, 120.0)) - 0.5) * 0.035;
    // stone-course banding
    stone *= 0.92 + 0.08 * step(0.5, fract(uv.y * 300.0));
    col = mix(col, stone, wall);
    // last light: warm thin rim on the gable + chimney top edges
    float rim = 0.0;
    if (uv.x > 0.573 && uv.x < 0.685) {
      float gt = (uv.x < 0.594) ? gableTop(0.584) + 0.038 : gableTop(uv.x);
      rim = 1.0 - sstep(0.0, 0.007, gt - uv.y);
    }
    col += vec3(0.85, 0.52, 0.22) * rim * 0.8;
  }
  // window hole: pure darkness inside the gable
  float win = (uv.x > 0.616 && uv.x < 0.644 && uv.y > 0.70 && uv.y < 0.762) ? 1.0 : 0.0;
  col = mix(col, vec3(0.008, 0.008, 0.012), win);

  // ---- sheep ----
  float sA = sheepAt(uv, vec2(0.30, hillAt(0.30) - 0.010), sstep(HEADLIFT, HEADLIFT + 0.5, t) * sstep(HEADLIFT + 2.2, HEADLIFT + 1.4, t), t, 1.0);
  float sB = sheepAt(uv, vec2(0.42, hillAt(0.42) - 0.012), 0.0, t, 2.0);
  float wx = mix(0.50, 0.72, sstep(WALK, WALK + 4.0, t));
  float sC = sheepAt(uv, vec2(wx, hillAt(wx) - 0.008), 0.0, t, 3.0) * sstep(WALK - 0.5, WALK, t);
  col = mix(col, vec3(0.40, 0.39, 0.36), clamp(sA + sB + sC, 0.0, 1.0) * 0.85);

  // ---- life ----
  col = mix(col, vec3(0.10, 0.10, 0.11), hareAt(uv, t) * 0.9);
  col = mix(col, vec3(0.09, 0.09, 0.10), curlewAt(uv, t) * 0.9);
  col = mix(col, vec3(0.07, 0.07, 0.08), ravenAt(uv, t) * 0.95);

  // vignette — keep the pass wide, not boxed
  col *= 1.0 - 0.24 * sdist(uv, vec2(0.5, 0.45), vec2(0.8, 0.9));
  fragColor = vec4(col, 1.0);
}
`;

const PW = 320, PH = 140, PZ = -80, PY = 8;
const uv2w = (u: number, v: number): [number, number] => [
  (u - 0.5) * PW,
  PY + (v - 0.5) * PH,
];

const CAPTIONS: Array<[number, number, string, [number, number]]> = [
  [0.8, 3.0, 'a bothy open to the sky', [0.5, 0.26]],
  [3.6, 4.4, 'baa', [0.32, 0.40]],
  [6.4, 9.6, 'sheep keep the slope', [0.5, 0.24]],
  [10.4, 13.0, 'a curlew over the valley', [0.5, 0.24]],
  [14.0, 17.0, 'the dale keeps the dark', [0.5, 0.26]],
];

export default class BrokendaleScene extends Scene {
  private rig = new CameraRig();
  private cam = new THREE.PerspectiveCamera();
  private three = new THREE.Scene();
  private layer = new Layer2D();
  private v = new THREE.Vector3();
  private u = { uT: { value: 0 } };

  constructor(ctx: SceneCtx) {
    super(ctx);
    const geo = new THREE.PlaneGeometry(PW, PH);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.u,
      glslVersion: THREE.GLSL3,
    });
    const back = new THREE.Mesh(geo, mat);
    back.position.set(0, PY, PZ);
    this.three.add(back);
  }

  /** Beat probe for headless tooling. */
  probe(f: Frame) {
    const t = f.lt;
    return {
      graze: t >= 1.0 && t <= 5.5 ? 1 : 0,
      hare: t >= 8.5 && t <= 10.2 ? 1 : 0,
      settle: t >= 15.5 && t <= 17.8 ? 1 : 0,
    };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    // CameraRig: low, near-static — a slight drift up the slope toward the
    // gable, tiny push as the raven circles.
    const drift = ss(2.0, 14.0, t);
    this.rig.position = [
      1.6 * drift + 0.3 * Math.sin(t * 0.05),
      3.2 + 0.8 * ss(6.0, 12.0, t) + 0.15 * Math.sin(t * 0.06 + 1.0),
      76.0 - 1.2 * ss(12.0, 14.5, t),
    ];
    this.rig.target = [
      6.0 * drift + 0.3 * Math.sin(t * 0.045),
      12.0 + 0.5 * ss(6.0, 12.0, t),
      PZ,
    ];
    this.rig.roll = 0.0012 * Math.sin(t * 0.05);
    this.rig.focalLengthPx = (this.ctx.H / 2) / Math.tan(0.5 * 40 * Math.PI / 180);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    if (CAPTIONS.some(([a, b]) => t >= a && t <= b)) {
      const c = this.layer.ctx;
      c.clearRect(0, 0, W, H);
      const duck = overlayTextDuck(f.tin, f.tout);
      for (const [tin, tout, text, auv] of CAPTIONS) {
        const a = ss(tin, tin + 0.4, t) * (1 - ss(tout - 0.4, tout, t)) * duck;
        if (a <= 0.001) continue;
        const [awx, awy] = uv2w(auv[0], auv[1]);
        const ndc = this.v.set(awx, awy, PZ + 0.4).project(this.cam);
        if (ndc.z > 1) continue;
        const cx0 = (ndc.x * 0.5 + 0.5) * W;
        const cy = Math.min(Math.max((0.5 - ndc.y * 0.5) * H + H * 0.18, 44), H - 44);
        c.save();
        c.globalAlpha = a;
        c.font = `46px "${F.archivo(112, 500)}", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const tw = c.measureText(text).width;
        const cx = Math.min(Math.max(cx0, tw / 2 + 16), W - tw / 2 - 16);
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(10, 14, 20, 0.85)';
        c.lineWidth = 12;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#e8edf3';
        c.fillText(text, cx, cy);
        c.restore();
        if (typeof window !== 'undefined') {
          const P = (window as any).__motion || (window as any).__pdoom;
          if (P?.probe && P?.textProbes && P.recordText !== false) {
            P.textProbes.push({
              frameIdx: P.currentFrameIdx ?? 0, t, text,
              fontFamily: 'Archivo, sans-serif', fontPx: 46,
              fillStyle: '#e8edf3', globalAlpha: a, layerId: 'captions',
              bbox: [cx - tw / 2, cy - 30, cx + tw / 2, cy + 30], w: tw, h: 60,
              cx, cy, hPct: (46 / 1080) * 100, isStroke: false,
            });
          }
        }
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }

    return {
      exposure: 1.0,
      bloom: 0.4,
      bloomThreshold: 0.65,
      bloomRadius: 0.7,
      ca: 0.08,
      grain: 0.07,
      vignette: 0.45,
      level: ss(0, 0.9, t) * (1 - ss(this.ctx.end - 0.9, this.ctx.end, t)),
    };
  }

  override dispose() {
    this.layer.dispose();
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
  }
}
