// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// millpond — a derelict watermill on a quiet pond at dusk. One fullscreen GLSL
// pass holds the shot: dark still water below the mill's reflection line, a
// stone mill building mid-frame (slate roof edge, timber wheel leaning on the
// far side), a low spill on the right edge, willows dipping at the banks. The
// mossy wheel turns a few degrees a second and drips; bats dart over the
// spill; a heron stands on the weir and turns its head; a kingfisher darts
// once; a fish rises near the wheel; a water rat swims the left bank. Last
// light catches the roof edge and the wheel's top. All closed-form f(t), hash
// seeds only. CameraRig is low and near-static, drifting across the pond
// toward the wheel; Layer2D holds anchored captions (the canvas probe hook
// records them).
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

const float ASPECT = 320.0 / 140.0;
const float WATER = 0.50;        // reflection line
const vec2 WC = vec2(0.660, 0.545); // wheel axle (uv)
const float WR = 0.115;          // wheel radius (uv y-units)
// beats
const float DRIP0 = 2.0;   // wheel drips begin
const float FISH = 6.0;    // fish rises near the wheel
const float BATS = 7.5;    // bats dart over the spill 7.5→10s
const float HERON = 10.5;  // heron head-turn beat
const float KING = 13.0;   // kingfisher dart
const float RAT = 14.5;    // water rat swims the bank
const float SETTLE = 16.5;

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

// ---------- building ----------
// roofline height (for the gable mask + the last-light rim)
float roofEdge(vec2 uv) {
  return 0.79 - abs(uv.x - 0.53) * 1.8;
}
// stone mill body: x 0.42→0.64, walls WATER..0.72, gabled slate roof to 0.79
float millMask(vec2 uv) {
  float wall = (uv.x > 0.42 && uv.x < 0.64 && uv.y > WATER && uv.y < 0.72) ? 1.0 : 0.0;
  float roof = (uv.x > 0.415 && uv.x < 0.645 && uv.y >= 0.72 && uv.y < roofEdge(uv))
    ? 1.0
    : 0.0;
  return max(wall, roof);
}
// ---------- wheel ----------
// mossy undershot wheel at WC, turning ~3.5 deg/s with a faint creak wobble
float wheelAngle(float t) { return t * 0.06 + 0.008 * sin(t * 1.3); }
// mask of the rim + paddles (round in uv via ASPECT on dx)
float wheelMask(vec2 uv, float t) {
  vec2 d = uv - WC; d.x *= ASPECT;
  float r = length(d);
  float rim = sstep(0.006, 0.0, abs(r - WR)) + sstep(0.004, 0.0, abs(r - WR * 0.45));
  float a = atan(d.y, d.x) + wheelAngle(t);
  float paddles = sstep(0.90, 0.98, cos(a * 8.0)) * sstep(WR * 0.42, WR * 0.55, r) * sstep(WR + 0.012, WR - 0.006, r);
  return clamp(rim + paddles, 0.0, 1.0);
}
// drip bead: bottom paddle sheds a drop every ~2.2s after DRIP0
vec4 dripBead(float t) {
  if (t < DRIP0) return vec4(0.0);
  float cyc = (t - DRIP0) / 2.2;
  float ph = fract(cyc);
  if (ph > 0.45) return vec4(0.0);
  // bead forms at the bottom rim, then falls
  float id = floor(cyc);
  float jx = (h1(id * 7.7) - 0.5) * 0.006;
  vec2 p = vec2(WC.x - 0.046 / ASPECT + jx, WATER + 0.010 - ph * ph * 0.05);
  return vec4(p, 0.0, sstep(0.0, 0.05, ph) * (1.0 - sstep(0.38, 0.45, ph)));
}
// ---------- water ----------
// expanding ring, origin + start time
float ring(vec2 uv, vec2 o, float start, float t, float rate) {
  if (t < start) return 0.0;
  float age = t - start;
  vec2 d = uv - o; d.x *= ASPECT;
  float dd = length(d) - age * rate;
  float dd2 = dd / 0.004;
  return exp(-(dd2 * dd2)) * exp(-age * 2.2);
}
// ---------- heron on the spill ----------
float heronAt(vec2 uv, float t) {
  if (t < HERON - 1.0) return 0.0;
  // standing on the weir at x≈0.80: legs, body, neck — head turns at HERON+0.7
  vec2 o = vec2(0.800, WATER + 0.004);
  float body = sdist(uv, o + vec2(0.0, 0.055), vec2(0.020 / ASPECT, 0.013));
  float turn = sstep(HERON + 0.7, HERON + 0.85, t);
  vec2 head = o + vec2(mix(-0.006, 0.014, turn), 0.088);
  float neck = sstep(0.004, 0.0, seg(uv, o + vec2(-0.004, 0.062), head));
  float skull = sdist(uv, head, vec2(0.0045 / ASPECT, 0.0035));
  float legs = sstep(0.0022, 0.0, seg(uv, o + vec2(-0.003, 0.045), o + vec2(-0.003, 0.0)));
  float m = clamp((1.0 - sstep(0.5, 1.0, body)) + neck + (1.0 - sstep(0.4, 1.0, skull)) + legs, 0.0, 1.0);
  return m * sstep(HERON - 0.6, HERON - 0.2, t);
}
// ---------- kingfisher dart ----------
vec4 kingAt(float t) {
  if (t < KING || t > KING + 0.9) return vec4(0.0);
  float u = (t - KING) / 0.9;
  vec2 p = vec2(0.85 - u * 0.62, 0.46 + 0.05 * sin(u * 9.0));
  return vec4(p, 0.0, sstep(0.0, 0.06, u) * (1.0 - sstep(0.94, 1.0, u)));
}
// ---------- bats: seeded zigzag flits ----------
float batsAt(vec2 uv, float t) {
  if (t < BATS || t > BATS + 3.4) return 0.0;
  float m = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float u = (t - BATS) / 3.4;
    // piecewise jitter path — quick flits, not arcs
    float k = floor(u * 9.0 + fi * 3.0);
    float fr = fract(u * 9.0 + fi * 3.0);
    float x0 = 0.72 + 0.16 * h1(k + fi * 17.0);
    float x1 = 0.72 + 0.16 * h1(k + 1.0 + fi * 17.0);
    float y0 = 0.62 + 0.10 * h1(k * 3.1 + fi * 29.0);
    float y1 = 0.62 + 0.10 * h1((k + 1.0) * 3.1 + fi * 29.0);
    vec2 p = vec2(mix(x0, x1, fr), mix(y0, y1, fr) + 0.012 * sin(t * (14.0 + fi * 3.0)));
    // figure-8 wing flick: two tiny wings flapping fast
    vec2 dd = uv - p; dd.x *= ASPECT;
    float flap = abs(sin(t * (22.0 + fi * 4.0)));
    m += (1.0 - sstep(0.0, 0.007, length(dd + vec2(0.0, 0.002 * flap)))) * sstep(0.0, 0.1, u) * (1.0 - sstep(0.94, 1.0, u));
  }
  return m;
}
// ---------- fish rise / water rat ----------
float fishAt(vec2 uv, float t) {
  if (t < FISH || t > FISH + 1.4) return 0.0;
  float u = (t - FISH) / 1.4;
  vec2 o = vec2(0.61, WATER - 0.005);
  float arc = sin(u * 3.1416) * 0.045;
  vec2 d = uv - (o + vec2(0.02 * (u - 0.5), arc));
  d.x *= ASPECT;
  float body = 1.0 - sstep(0.0, 0.006, length(d / vec2(2.4, 1.0)));
  return clamp(body, 0.0, 1.0) * (1.0 - sstep(0.8, 1.0, u));
}
float ratAt(vec2 uv, float t) {
  if (t < RAT || t > RAT + 2.6) return 0.0;
  float u = (t - RAT) / 2.6;
  vec2 p = vec2(0.24 + u * 0.12, WATER - 0.012 + 0.004 * sin(u * 12.0));
  vec2 d = uv - p; d.x *= ASPECT;
  float body = 1.0 - sstep(0.0, 0.007, length(d / vec2(2.0, 0.9)));
  // vee wake trailing behind
  float wake = sstep(0.003, 0.0, abs((uv.y - p.y) + 0.35 * (uv.x - p.x)) - 0.001)
    * sstep(0.0, -0.06, uv.x - p.x) * 0.4;
  return clamp(body + wake, 0.0, 1.0) * sstep(0.0, 0.08, u) * (1.0 - sstep(0.9, 1.0, u));
}

void main() {
  vec2 uv = vUv;
  float t = uT;

  // dusk sky: deep indigo top, slate to a faint warm smear at the horizon
  vec3 col = mix(vec3(0.235, 0.280, 0.370), vec3(0.075, 0.098, 0.170), sstep(0.40, 0.95, uv.y));
  { float dh = (uv.y - 0.60) / 0.12; col += vec3(0.06, 0.04, 0.02) * exp(-(dh * dh)) * sstep(0.75, 0.2, uv.x); }

  // bank silhouette behind the pond (y just over the waterline)
  float bank = sstep(0.50, 0.505, uv.y);
  // willow canopy + hanging fronds at both banks
  float willow = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 c = vec2((i < 3) ? 0.20 + fi * 0.05 : 0.70 + (fi - 3.0) * 0.045,
                  0.58 + 0.05 * h1(fi * 3.7));
    willow += 1.0 - sstep(0.4, 1.0, sdist(uv, c, vec2(0.030 / ASPECT, 0.038)));
  }
  float fronds = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float bx = (i < 4) ? 0.21 + fi * 0.045 : 0.71 + (fi - 4.0) * 0.04;
    fronds += sstep(0.0018, 0.0, seg(uv, vec2(bx, 0.56), vec2(bx + 0.008 * sin(t * 0.4 + fi), 0.505)));
  }
  // mill building
  float mill = millMask(uv);
  // waterline base: pond surface
  float below = 1.0 - bank;

  // --- water shading: dark, faint sky reflection band near the mirror line
  vec3 water = mix(vec3(0.115, 0.135, 0.185), vec3(0.045, 0.055, 0.085), sstep(0.50, 0.36, uv.y));
  col = mix(col, water, below);
  // mill + willow reflections: mirrored, damped, quivering slightly
  vec2 ruv = vec2(uv.x + 0.003 * sin(t * 0.7 + uv.y * 60.0), 2.0 * WATER - uv.y);
  float refl = below * (millMask(ruv) * 0.35 + clamp(willow, 0.0, 1.0) * 0.2);
  col = mix(col, vec3(0.085, 0.095, 0.125), refl * (0.75 + 0.25 * vn(vec2(uv.x * 80.0, t * 0.5))));

  // thin mist hovering over the pond, drifting left
  { float dm = (uv.y - (0.46 + 0.012 * sin(uv.x * 8.0 + t * 0.18))) / 0.012;
    col += vec3(0.10, 0.11, 0.13) * exp(-(dm * dm)) * below * (0.5 + 0.5 * vn(vec2(uv.x * 20.0 - t * 0.10, 4.0))); }

  // bank + willows (above waterline)
  vec3 bankCol = vec3(0.06, 0.075, 0.06) * (0.85 + 0.3 * vn(uv * vec2(90.0, 60.0)));
  col = mix(col, bankCol, bank * 0.9 * sstep(0.56, 0.50, uv.y));
  col = mix(col, vec3(0.050, 0.060, 0.045), clamp(willow, 0.0, 1.0) * 0.65);
  col = mix(col, vec3(0.06, 0.07, 0.05), fronds * 0.8);

  // the mill itself: dark stone, slate roof
  vec3 stone = vec3(0.10, 0.10, 0.115) + (vn(uv * vec2(140.0, 110.0)) - 0.5) * 0.03;
  stone *= 0.92 + 0.08 * step(0.5, fract(uv.y * 240.0));
  vec3 roof = vec3(0.075, 0.08, 0.095);
  col = mix(col, (uv.y >= 0.72) ? roof : stone, mill);
  // warm window glow with a slow flicker
  float win = sbox(uv, vec2(0.485, 0.615), vec2(0.011 / ASPECT, 0.016));
  float flick = 0.75 + 0.25 * sin(t * 6.3) * sin(t * 1.7);
  col += vec3(0.80, 0.46, 0.16) * sstep(0.0, 0.002, -win) * flick * 0.85;
  // last light: warm rim on the roof edge + the wheel's top arc
  float rim = 0.0;
  if (uv.y >= 0.72 && uv.y < 0.79) rim = (1.0 - sstep(0.0, 0.007, roofEdge(uv) - uv.y)) * mill;
  vec2 wd = uv - WC; wd.x *= ASPECT;
  if (length(wd) < WR + 0.01 && wd.y > WR * 0.35) rim = max(rim, sstep(0.35, 0.95, wd.y / WR) * wheelMask(uv, t));
  col += vec3(0.85, 0.52, 0.22) * rim * 0.8;

  // the wheel: dark timber + mossy rim, slow turn
  float wm = wheelMask(uv, t);
  vec3 wheelCol = vec3(0.075, 0.062, 0.045) + vec3(0.015, 0.04, 0.012) * vn(uv * vec2(200.0, 160.0));
  col = mix(col, wheelCol, wm * 0.95);
  // drip bead + its ripple on the water
  vec4 bead = dripBead(t);
  if (bead.w > 0.0) {
    col = mix(col, vec3(0.35, 0.40, 0.48), (1.0 - sstep(0.0, 0.0035, sdist(uv, bead.xy, vec2(0.003 / ASPECT, 0.004)))) * bead.w);
  }
  // bead lands ~0.3s into the 2.2s cycle; no ring before the first landing
  float dripAge = mod(t - DRIP0 - 0.3, 2.2);
  col += vec3(0.10, 0.12, 0.15) * step(DRIP0 + 0.3, t) * ring(uv, vec2(WC.x - 0.046 / ASPECT, WATER - 0.004), 0.0, dripAge, 0.05) * below;

  // fish rise near the wheel + ring
  col = mix(col, vec3(0.16, 0.17, 0.19), fishAt(uv, t) * 0.85);
  col += vec3(0.10, 0.12, 0.15) * ring(uv, vec2(0.61, WATER - 0.004), FISH + 0.35, t, 0.06) * below;
  // water rat by the left bank
  col = mix(col, vec3(0.07, 0.07, 0.065), ratAt(uv, t) * 0.9);

  // the spill: bright overflow line at the right edge, glinting run
  float spill = sstep(0.775, 0.782, uv.x) * sstep(0.502, 0.499, uv.y) * sstep(0.488, 0.491, uv.y);
  float run = 0.5 + 0.5 * sin(uv.x * 160.0 - t * 2.4 + vn(uv * 60.0) * 3.0);
  col += vec3(0.14, 0.17, 0.22) * spill * (0.5 + 0.5 * run);
  col += vec3(0.4, 0.45, 0.5) * spill * sstep(0.88, 0.97, run) * 0.22;

  // heron on the spill edge
  col = mix(col, vec3(0.10, 0.10, 0.11), heronAt(uv, t) * 0.95);
  // kingfisher: silhouette with a bright teal edge flash
  vec4 kf = kingAt(t);
  if (kf.w > 0.0) {
    vec2 kd = uv - kf.xy; kd.x *= ASPECT;
    float km = 1.0 - sstep(0.0, 0.006, length(kd / vec2(2.0, 0.8)));
    col = mix(col, vec3(0.12, 0.30, 0.34), km * kf.w * 0.9);
    col += vec3(0.1, 0.5, 0.55) * (1.0 - sstep(0.0, 0.003, abs(kd.y - 0.003))) * abs(kd.x) * kf.w * 18.0 * step(0.0, kd.y) * step(abs(kd.x), 0.010);
  }
  // bats over the spill and wheel
  col = mix(col, vec3(0.05, 0.05, 0.06), clamp(batsAt(uv, t), 0.0, 1.0));

  // faint dusk grade
  col *= 0.92;
  fragColor = vec4(col, 1.0);
}
`;

const PW = 320, PH = 140, PZ = -80, PY = 8;
const uv2w = (u: number, v: number): [number, number] => [
  (u - 0.5) * PW,
  PY + (v - 0.5) * PH,
];

const CAPTIONS: Array<[number, number, string, [number, number]]> = [
  [0.8, 3.0, 'the pond keeps the mill', [0.5, 0.26]],
  [5.8, 7.2, 'a fish rises', [0.55, 0.40]],
  [7.6, 9.8, 'bats over the spill', [0.6, 0.30]],
  [10.6, 12.6, 'the heron looks up', [0.62, 0.30]],
  [14.5, 17.2, 'dusk takes the wheel', [0.5, 0.26]],
];

export default class MillpondScene extends Scene {
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
      wheel: t >= 0 && t <= 18 ? 1 : 0,
      bats: t >= 7.5 && t <= 10.9 ? 1 : 0,
      settle: t >= 16.5 && t <= 18.0 ? 1 : 0,
    };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    // CameraRig: low, near-static — a slow drift across the pond toward the
    // wheel, a tiny push as the kingfisher darts.
    const drift = ss(1.5, 14.0, t);
    this.rig.position = [
      -1.2 + 2.4 * drift + 0.25 * Math.sin(t * 0.05),
      3.0 + 0.5 * ss(6.0, 12.0, t) + 0.12 * Math.sin(t * 0.06 + 1.0),
      74.0 - 1.0 * ss(12.5, 14.0, t),
    ];
    this.rig.target = [
      10.0 + 3.0 * drift + 0.3 * Math.sin(t * 0.045),
      11.0 + 0.4 * ss(6.0, 12.0, t),
      PZ,
    ];
    this.rig.roll = 0.001 * Math.sin(t * 0.05);
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
