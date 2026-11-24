// snowsquall — a village rooftop line swallowed by a fast squall front
// at dusk, in five beats.
//   0–4s    calm: warm windows, cat walks a roofline, fine snow only.
//   4–10s   the front: a textured whiteout wall crosses left→right over
//           ~6s; houses dissolve into it in order.
//   9–12s   whiteout peak: near-layer flakes + lamp glow only.
//   12–16s  thinning: a hooded figure crosses the lamplit gap; rooftops
//           ghost back right→left as the haze recovers.
//   16–20s  settled snow: the row re-reads; church window smoke signal.
// Backdrop = one GLSL3 quad (sky / rooftops / windows / power line /
// lamp / chimney smoke / the squall veil itself). Foreground =
// instanced snow in 3 depth bands + rooftop kick streaks + figure and
// cat silhouette quads. All closed-form f(t) on hash seeds — no sim.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const frac = (x: number) => x - Math.floor(x);
const hash = (n: number) => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);

// --- narrative envelopes ---------------------------------------------------
const frontT = (t: number) => ss(4.0, 10.0, t);          // front sweeps left→right
const thinT = (t: number) => ss(11.5, 16.0, t);          // whiteout releases
const figT = (t: number) => ss(12.8, 14.4, t);           // figure crosses the gap
const catT = (t: number) => ss(2.2, 4.6, t);             // cat before the front
const sigT = (t: number) => ss(16.0, 17.5, t);           // church smoke signal
const duskT = (t: number) => ss(0.0, 20.0, t);           // slow dusk deepening
// gust surges: two swells riding under the front plus a post-peak breath
const gustT = (t: number) =>
  0.35 + 0.65 * Math.max(
    ss(5.0, 6.5, t) * (1 - ss(9.5, 11.0, t)),
    ss(13.0, 14.0, t) * (1 - ss(16.5, 18.0, t)) * 0.7,
  );

const FLAKES = 900;
const STREAKS = 60;

// pw/ph/py/pz: world quad bounds — the uv space every layer shares
const PW = 300, PH = 114, PY = 8, PZ = -80;
const uvToWorld = (ux: number, uy: number, out: THREE.Vector3) =>
  out.set((ux - 0.5) * PW, PY + (uy - 0.5) * PH, PZ);

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
uniform float uFront;   // front edge position, uv x (~-0.2 → 1.25)
uniform float uThin;    // whiteout thinning 0→1
uniform float uGust;    // gust surge 0..1
uniform float uSmoke;   // church smoke signal 0→1
uniform float uDusk;
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

// house i geometry — shared by body, windows, smoke, snow
vec4 houseBox(int i) {   // x0, x1, baseY, topY
  float fi = float(i);
  float x0 = 0.05 + fi * 0.125 + h1(fi * 3.1) * 0.02;
  float w = 0.100 + h1(fi * 5.3) * 0.045;
  float top = 0.235 + h1(fi * 7.7) * 0.085;
  return vec4(x0, x0 + w, 0.055, top);
}
float roofPeak(int i) {
  float fi = float(i);
  return houseBox(i).w + 0.045 + h1(fi * 9.2) * 0.035;
}

vec3 village(vec2 uv, float t, float gust, float smokeSig) {
  vec3 sky = mix(vec3(0.86, 0.70, 0.55), vec3(0.16, 0.20, 0.27),
                 smoothstep(0.02, 0.72, uv.y));
  sky += vec3(0.10, 0.06, 0.02) * (1.0 - smoothstep(0.0, 0.30, uv.y)); // dusk rim low
  // pale wafer sun through haze, low right
  float sun = exp(-pow(length((uv - vec2(0.86, 0.16)) * vec2(9.0, 4.5)), 2.0) * 3.0);
  sky += vec3(0.28, 0.20, 0.12) * sun;
  vec3 col = sky;

  // distant roofline — paler, lower, offset
  float back = smoothstep(0.10, 0.13, uv.y)
             - smoothstep(0.10, 0.13, uv.y - 0.045 * step(uv.y, 0.145));
  col = mix(col, vec3(0.30, 0.35, 0.42),
            (1.0 - smoothstep(0.135, 0.155, uv.y))
            * smoothstep(0.095, 0.115, uv.y)
            * (0.5 + 0.5 * n2(vec2(uv.x * 40.0, 0.0))) * 0.55);

  // snow ground strip under the row
  col = mix(col, vec3(0.62, 0.68, 0.76), 1.0 - smoothstep(0.048, 0.060, uv.y));

  // lamp pool at the gap between houses 3 and 4
  vec2 lp = vec2(0.475, 0.135);
  float lampD = length((uv - lp) * vec2(1.0, 2.2));
  col += vec3(1.0, 0.72, 0.38) * 0.20 * exp(-lampD * lampD * 38.0);
  col += vec3(1.0, 0.80, 0.45) * 0.10 * exp(-lampD * 14.0);

  for (int i = 0; i < 6; i++) {
    vec4 hb = houseBox(i);
    float fi = float(i);
    float peak = roofPeak(i);
    bool church = false;

    // body
    float body = step(hb.x, uv.x) * step(uv.x, hb.y)
               * step(hb.z, uv.y) * step(uv.y, hb.w);
    vec3 wall = mix(vec3(0.24, 0.27, 0.32), vec3(0.30, 0.33, 0.37), h1(fi * 11.0));
    // roof triangle
    float midx = (hb.x + hb.y) * 0.5;
    float roofY = hb.w + (peak - hb.w) * (1.0 - abs(uv.x - midx) / ((hb.y - hb.x) * 0.5));
    float roof = step(hb.x, uv.x) * step(uv.x, hb.y)
               * step(hb.w, uv.y) * step(uv.y, roofY);
    col = mix(col, wall * (0.85 + 0.30 * uv.y), body);
    col = mix(col, vec3(0.66, 0.72, 0.80), roof);          // snow roof
    // snow lip along the roofline
    float lip = step(hb.x - 0.004, uv.x) * step(uv.x, hb.y + 0.004)
              * (1.0 - smoothstep(0.004, 0.010, abs(uv.y - hb.w)));
    col = mix(col, vec3(0.80, 0.85, 0.92), lip * 0.8);

    // windows: 1–2 warm rects, a few flicker
    for (int w = 0; w < 2; w++) {
      float wx = hb.x + (0.22 + 0.5 * float(w)) * (hb.y - hb.x);
      float wy = hb.z + (0.30 + 0.25 * h1(fi * 13.0 + float(w))) * (hb.w - hb.z);
      float on = step(0.25, h1(fi * 17.0 + float(w) * 7.0));
      float flick = 1.0 - 0.5 * step(0.72, h1(fi * 23.0 + float(w)))
                  * step(0.4, n2(vec2(t * 6.0 + fi * 31.0 + float(w) * 9.0, 0.0)));
      float win = step(abs(uv.x - wx), 0.011) * step(abs(uv.y - wy), 0.016);
      col = mix(col, vec3(0.98, 0.66, 0.28) * flick, win * on * 0.95);
    }

    // chimney + smoke torn sideways by gust
    float cx = hb.x + (hb.y - hb.x) * (0.25 + 0.5 * h1(fi * 19.0));
    float chim = step(abs(uv.x - cx), 0.006) * step(hb.w, uv.y) * step(uv.y, hb.w + 0.030);
    col = mix(col, wall * 0.7, chim);
    if (uv.x > cx && uv.y > hb.w) {
      float rise = uv.y - hb.w - 0.02;
      vec2 sp = vec2((uv.x - cx - rise * (0.35 + 0.75 * gust)) * 30.0, rise * 26.0 - t * 1.6);
      float sm = fbm(sp) * exp(-rise * 9.0) * exp(-abs(sp.x) * 0.5);
      col = mix(col, vec3(0.55, 0.60, 0.66), clamp(sm * 1.4, 0.0, 0.55));
    }
  }

  // the church — fixed at the far end so its spire always reads
  {
    vec4 cb = vec4(0.845, 0.955, 0.055, 0.42);
    float cmid = (cb.x + cb.y) * 0.5;
    float cbody = step(cb.x, uv.x) * step(uv.x, cb.y)
                * step(cb.z, uv.y) * step(uv.y, cb.w);
    col = mix(col, vec3(0.26, 0.29, 0.34), cbody);
    float ctower = (abs(uv.x - cmid) < 0.030 && uv.y > cb.w && uv.y < 0.56) ? 1.0 : 0.0;
    col = mix(col, vec3(0.15, 0.17, 0.21), ctower);
    float csx = abs(uv.x - cmid);
    float cspire = (csx < 0.028 && uv.y > 0.56 && uv.y < 0.56 + (0.74 - 0.56) * (1.0 - csx / 0.028)) ? 1.0 : 0.0;
    col = mix(col, vec3(0.05, 0.07, 0.10), cspire);
    // snow lip under the tower + the lit bell arch
    float clip = step(cb.x - 0.004, uv.x) * step(uv.x, cb.y + 0.004)
               * (1.0 - smoothstep(0.004, 0.010, abs(uv.y - cb.w)));
    col = mix(col, vec3(0.80, 0.85, 0.92), clip * 0.8);
    float cbell = step(csx, 0.011) * step(abs(uv.y - 0.545), 0.013);
    col = mix(col, vec3(0.98, 0.66, 0.28), cbell * 0.9);
    // smoke signal off the bell window
    if (smokeSig > 0.0) {
      vec2 bp = vec2(cmid, 0.57);
      float rise2 = uv.y - bp.y;
      if (rise2 > 0.0 && uv.x > bp.x - 0.01) {
        vec2 sp2 = vec2((uv.x - bp.x - rise2 * 0.18) * 22.0, rise2 * 20.0 - t * 0.9);
        float sm2 = fbm(sp2) * exp(-rise2 * 7.0) * smokeSig;
        col = mix(col, vec3(0.72, 0.74, 0.78), clamp(sm2 * 1.6, 0.0, 0.6));
      }
    }
  }

  // power line: two poles + a sagging catenary
  for (int k = 0; k < 2; k++) {
    float px = k == 0 ? 0.115 : 0.560;
    float pole = step(abs(uv.x - px), 0.0022) * step(0.055, uv.y) * step(uv.y, 0.335);
    col = mix(col, vec3(0.10, 0.12, 0.15), pole);
  }
  if (uv.x > 0.115 && uv.x < 0.560) {
    float d = (uv.x - 0.115) / 0.445;
    float lineY = 0.335 - 0.028 * (1.0 - pow(2.0 * d - 1.0, 2.0));
    float wire = 1.0 - smoothstep(0.0012, 0.0028, abs(uv.y - lineY));
    col = mix(col, vec3(0.15, 0.17, 0.21), wire);
  }
  return col;
}

void main() {
  vec2 uv = vUv;
  // village is authored low on the quad; shift it up into frame
  // vUv visible band is x~[0.27,0.73], y~[0.16,0.84]; map authored [0,1] into it
  vec3 col = village(vec2((uv.x - 0.269) / 0.462, 0.03 + (uv.y - 0.159) * 1.107), uT, uGust, uSmoke);
  col *= 1.0 - 0.10 * uDusk;

  // squall veil: wall = 1 inside the swallowed region (x < front edge)
  float wall = 1.0 - smoothstep(uFront - 0.015, uFront + 0.085, uv.x);
  // trailing haze thins with distance behind the front once uThin rises
  float behind = uFront - uv.x;
  wall *= 1.0 - uThin * smoothstep(0.12, 0.45, behind);
  wall *= 1.0 - uThin * 0.45;
  // gust stripes riding the wall, ragged where the front face leads
  float stripes = fbm(vec2(uv.x * 15.0 - uT * 1.4, uv.y * 5.0 + uT * 0.4));
  float edge = 1.0 + 0.7 * (1.0 - smoothstep(0.0, 0.10, abs(uv.x - uFront))) * (1.0 - uThin);
  float veil = wall * (0.62 + 0.38 * stripes * edge);
  vec3 squallCol = mix(vec3(0.88, 0.91, 0.94), vec3(0.70, 0.76, 0.83),
                       smoothstep(0.0, 0.5, uv.y) * 0.6 + stripes * 0.15);
  col = mix(col, squallCol, clamp(veil, 0.0, 1.0));
  // the lamp pool dims but survives the whiteout
  float lampD2 = length((uv - vec2(0.477, 0.265)) * vec2(1.0, 2.2));
  col += vec3(1.0, 0.72, 0.38) * 0.16 * exp(-lampD2 * lampD2 * 30.0) * (1.0 - veil * 0.55);
  fragColor = vec4(col, 1.0);
}`;

// --- snowflakes (instanced, 3 depth bands, all math in the vertex) -----------
const FLAKE_VERT = /* glsl */ `
in float aSeed;
out vec2 vUv;
out vec3 vKind;   // band, twinkle, alpha
uniform float uT;
uniform float uGust;
uniform float uFront;
uniform float uThin;
float h1(float p) { return fract(sin(p * 91.7) * 43758.5); }
void main() {
  vUv = uv;
  float band = floor(aSeed * 3.0);                       // 0 far, 1 mid, 2 near
  float s1 = h1(aSeed * 311.0), s2 = h1(aSeed * 977.0), s3 = h1(aSeed * 131.0);
  float spd = mix(0.16, 0.05, band * 0.5);               // fall speed (uv/s)
  float drift = mix(0.030, 0.012, band * 0.5);           // wind drift
  float gustPush = uGust * (0.05 + 0.10 * s3) * (1.0 + band * 0.4);
  float fx = fract(s1 + uT * (drift + gustPush) + sin(uT * (0.6 + s3) + aSeed * 40.0) * 0.012);
  float fy = fract(s2 - uT * spd * (0.7 + 0.6 * s3) + uGust * 0.02);
  float size = mix(0.0026, 0.0065, band * 0.5) * (0.6 + 0.8 * s3);
  vec3 p = position * vec3(size * ${PW}.0, size * ${PH}.0, 1.0);
  float z = mix(0.5, 22.0, band * 0.5);
  p.x += (fx - 0.5) * ${PW}.0;
  p.y += (fy - 0.5) * ${PH}.0;
  p.z += z;
  float tw = 0.55 + 0.45 * sin(uT * (2.0 + s3 * 4.0) + aSeed * 80.0);
  // flakes thin out where the veil is already white, brighten after
  float hidden = (1.0 - step(uFront - 0.03, fx)) * (1.0 - uThin * 0.85);
  vKind = vec3(band, tw, 1.0 - hidden * 0.75);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FLAKE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec3 vKind;
out vec4 fragColor;
void main() {
  vec2 q = vUv - 0.5;
  float d = length(q * 2.0);
  float a = (1.0 - smoothstep(0.62, 1.0, d)) * vKind.z;
  if (a < 0.02) discard;
  vec3 col = mix(vec3(0.78, 0.83, 0.90), vec3(0.96, 0.98, 1.0), vKind.y);
  fragColor = vec4(col, a * 0.85);
}`;

// --- rooftop snow kick streaks ---------------------------------------------
const STREAK_VERT = /* glsl */ `
in float aSeed;
out vec2 vUv;
out float vA;
uniform float uT;
uniform float uGust;
uniform float uFront;
uniform float uThin;
float h1(float p) { return fract(sin(p * 91.7) * 43758.5); }
void main() {
  vUv = uv;
  float s1 = h1(aSeed * 311.0), s2 = h1(aSeed * 977.0);
  // burst window: each streak lives inside a short repeating gust window
  float cyc = fract(uT * (0.35 + s2 * 0.3) + s1);
  float burst = smoothstep(0.0, 0.12, cyc) * (1.0 - smoothstep(0.12, 0.35, cyc));
  float fx = fract(s1 * 3.0 + cyc * 0.25);
  float fy = 0.37 + s2 * 0.12 + cyc * 0.02;
  vec3 p = position * vec3(0.05 * ${PW}.0, 0.010 * ${PH}.0, 1.0);
  p.x += (fx - 0.5) * ${PW}.0;
  p.y += (fy - 0.5) * ${PH}.0;
  p.z += 8.0;
  float hidden = (1.0 - step(uFront - 0.03, fx)) * (1.0 - uThin * 0.8);
  vA = burst * uGust * (1.0 - hidden);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const STREAK_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vA;
out vec4 fragColor;
void main() {
  float a = (1.0 - abs(vUv.y - 0.5) * 2.0) * (1.0 - smoothstep(0.6, 1.0, vUv.x)) * vA;
  if (a < 0.02) discard;
  fragColor = vec4(vec3(0.85, 0.89, 0.94), a * 0.5);
}`;

// --- silhouettes ------------------------------------------------------------
const SIL_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FIG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
out vec4 fragColor;
void main() {
  vec2 q = vec2(vUv.x - 0.5, vUv.y);
  // hooded figure: body capsule + head bump, lean into the wind
  q.x += (1.0 - vUv.y) * 0.06;
  float body = 1.0 - smoothstep(0.13, 0.16, abs(q.x) + max(0.0, 0.30 - q.y) * 0.10);
  body *= step(q.y, 0.66);
  float head = 1.0 - smoothstep(0.10, 0.12, length(q - vec2(0.02, 0.68)));
  float legs = step(abs(q.x), 0.09) * step(0.30, q.y + 0.15 * sin(uT * 9.0));
  float shape = max(max(body, head), legs);
  if (shape < 0.05) discard;
  // dark coat, faint warm rim from the lamp side (left)
  vec3 col = vec3(0.10, 0.11, 0.14);
  col += vec3(0.30, 0.20, 0.08) * (1.0 - smoothstep(0.0, 0.5, vUv.x)) * 0.35;
  fragColor = vec4(col, shape * 0.96);
}`;

const CAT_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
out vec4 fragColor;
void main() {
  vec2 q = vec2(vUv.x, vUv.y - 0.35);
  float body = 1.0 - smoothstep(0.14, 0.18, length(q * vec2(0.8, 2.4)));
  float head = 1.0 - smoothstep(0.07, 0.09, length(q - vec2(0.32, 0.10)));
  float tail = 1.0 - smoothstep(0.02, 0.05,
      length(q - vec2(-0.30, 0.16 + 0.10 * sin(uT * 3.0))));
  float shape = max(max(body, head), tail);
  if (shape < 0.05) discard;
  fragColor = vec4(vec3(0.09, 0.10, 0.13), shape * 0.95);
}`;

export default class SnowsquallScene extends Scene {
  private three = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 400);
  private flakes: THREE.InstancedMesh;
  private streaks: THREE.InstancedMesh;
  private figure: THREE.Mesh;
  private cat: THREE.Mesh;
  private bu = {
    uT: { value: 0 }, uFront: { value: -0.2 }, uThin: { value: 0 },
    uGust: { value: 0.3 }, uSmoke: { value: 0 }, uDusk: { value: 0 },
  };
  private flU = {
    uT: { value: 0 }, uGust: { value: 0.3 }, uFront: { value: -0.2 }, uThin: { value: 0 },
  };
  private stU = {
    uT: { value: 0 }, uGust: { value: 0.3 }, uFront: { value: -0.2 }, uThin: { value: 0 },
  };
  private figU = { uT: { value: 0 } };
  private catU = { uT: { value: 0 } };
  private p = new THREE.Vector3();

  constructor(ctx: SceneCtx) {
    super(ctx);
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.bu, vertexShader: BACK_VERT, fragmentShader: BACK_FRAG }),
    );
    uvToWorld(0.5, 0.5, quad.position);
    this.three.add(quad);

    const flakeGeo = new THREE.PlaneGeometry(1, 1);
    {
      const seeds = new Float32Array(FLAKES);
      for (let i = 0; i < FLAKES; i++) seeds[i] = hash(i * 7 + 3);
      flakeGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    }
    this.flakes = new THREE.InstancedMesh(
      flakeGeo,
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.flU, vertexShader: FLAKE_VERT, fragmentShader: FLAKE_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      FLAKES,
    );
    this.three.add(this.flakes);

    const stGeo = new THREE.PlaneGeometry(1, 1);
    {
      const seeds = new Float32Array(STREAKS);
      for (let i = 0; i < STREAKS; i++) seeds[i] = hash(i * 11 + 5);
      stGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    }
    this.streaks = new THREE.InstancedMesh(
      stGeo,
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.stU, vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      STREAKS,
    );
    this.three.add(this.streaks);

    this.figure = new THREE.Mesh(
      new THREE.PlaneGeometry(7.0, 11.0),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.figU, vertexShader: SIL_VERT, fragmentShader: FIG_FRAG, transparent: true, side: THREE.DoubleSide }),
    );
    this.three.add(this.figure);

    this.cat = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 1.6),
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: this.catU, vertexShader: SIL_VERT, fragmentShader: CAT_FRAG, transparent: true, side: THREE.DoubleSide }),
    );
    this.three.add(this.cat);

    this.cam.position.set(0, 7, 30);
    this.cam.lookAt(0, 9, PZ + 10);
  }

  override render(_f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const r = this.ctx.renderer;
    const t = _f.t;
    const front = -0.22 + 1.45 * frontT(t);   // uv x: enters -0.22, exits ~1.23
    const thin = thinT(t);
    const gust = gustT(t);
    const fig = figT(t);
    const cat = catT(t);
    const sig = sigT(t);
    const dusk = duskT(t);

    this.bu.uT.value = t;
    this.bu.uFront.value = front;
    this.bu.uThin.value = thin;
    this.bu.uGust.value = gust;
    this.bu.uSmoke.value = sig;
    this.bu.uDusk.value = dusk;
    this.flU.uT.value = t; this.flU.uGust.value = gust;
    this.flU.uFront.value = front; this.flU.uThin.value = thin;
    this.stU.uT.value = t; this.stU.uGust.value = gust;
    this.stU.uFront.value = front; this.stU.uThin.value = thin;
    this.figU.uT.value = t;
    this.catU.uT.value = t;

    // figure crosses the lamplit gap while the wall thins
    const figU = 0.415 + 0.145 * fig;
    uvToWorld(figU, 0.23, this.p);
    this.p.z += 14.0;
    this.figure.position.copy(this.p);
    this.figure.visible = fig > 0.0 && fig < 1.0;

    // cat walks a roofline before the front arrives
    const catU = 0.60 + 0.16 * cat;
    uvToWorld(catU, 0.50, this.p);
    this.p.z += 10.0;
    this.cat.position.copy(this.p);
    this.cat.visible = cat > 0.0 && cat < 1.0;

    // near-static with a slow push into the squall, settling as it thins
    const push = ss(4.0, 10.5, t) * (1 - 0.5 * thin);
    this.cam.position.set(
      1.5 * Math.sin(t * 0.11),
      7 - push * 1.2,
      30 - push * 6.0,
    );
    this.cam.lookAt(0.5 * Math.sin(t * 0.07), 9 - push * 0.8, PZ + 10);

    // diagnostics: figure + lamp probes
    if (typeof window !== 'undefined') {
      const P = (window as any).__motion || (window as any).__pdoom;
      if (P?.probe && P.textProbes && P.recordText) {
        const W = P.width || 1920, H = P.height || 1080;
        if (this.figure.visible) {
          this.p.copy(this.figure.position).project(this.cam);
          const cx = (this.p.x * 0.5 + 0.5) * W, cy = (0.5 - this.p.y * 0.5) * H;
          P.textProbes.push({
            frameIdx: P.currentFrameIdx ?? 0, t, text: 'hooded-figure',
            fontFamily: 'Archivo, sans-serif', fontPx: 24,
            fillStyle: '#e8b04a', globalAlpha: 0.9, layerId: 'snowsquall',
            bbox: [cx - 40, cy - 90, cx + 40, cy + 20],
            w: 80, h: 110, cx, cy, hPct: (110 / H) * 100, isStroke: false,
          });
        }
        uvToWorld(0.475, 0.265, this.p).project(this.cam);
        const lx = (this.p.x * 0.5 + 0.5) * W, ly = (0.5 - this.p.y * 0.5) * H;
        P.textProbes.push({
          frameIdx: P.currentFrameIdx ?? 0, t, text: 'lamp-pool',
          fontFamily: 'Archivo, sans-serif', fontPx: 22,
          fillStyle: '#f0c060', globalAlpha: 0.75, layerId: 'snowsquall',
          bbox: [lx - 60, ly - 26, lx + 60, ly + 26],
          w: 120, h: 52, cx: lx, cy: ly, hPct: (52 / H) * 100, isStroke: false,
        });
      }
    }

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 0.78 - 0.10 * ss(9.0, 12.0, t) * (1 - thin),
      bloom: 0.30 + 0.22 * gust,
      bloomThreshold: 0.74,
      bloomRadius: 0.5,
      grade: { saturation: 1.05, gamma: 0.95 },
    } as PostOverrides;
  }

  override dispose() {
    this.three.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((m as THREE.InstancedMesh).isInstancedMesh) (m as THREE.InstancedMesh).dispose();
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}
