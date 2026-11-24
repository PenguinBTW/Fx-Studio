// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// rustedgate — an iron field gate half-open on a farm track at golden hour.
// One fullscreen GLSL pass: warm low sun off-frame left, five-bar gate ajar
// mid-frame (closed-form gateAng: breeze swing → tuft catch → wider swing),
// its shadow sheared across the ruts, a robin working the latch, a distant
// tractor on the horizon strip, a pheasant burst, two crows, a dog down the
// track. Backlit dust motes in the gap, hinge glint, warm rim on the bars.
// All closed-form f(t), hash seeds only. CameraRig drifts gently through
// the gate gap keyed to the same swing; Layer2D holds anchored captions
// (the canvas probe hook records them).
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
// beats
const float SWAY = 2.5;    // breeze starts moving the gate
const float CATCH = 4.2;   // tuft catch holds it
const float FREE = 7.0;    // tuft lets go — wider swing
const float ROBIN = 5.0;   // robin on the latch
const float PHEAS = 10.0;  // pheasant burst
const float CROWS = 13.0;  // crow pair on the gate top
const float DOG = 15.0;    // dog runs down the track
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

// ---------- gate ----------
const vec2 HINGE = vec2(0.345, 0.46);  // hinge post base
const float GY = 0.455;                // gate foot line
const float GW = 0.205;                // gate span (closed, uv x-units)

// closed-form gate angle (radians, in-plane): open ajar → breeze pushes to
// the tuft catch → catches → lets go → swings wider → relaxes at settle
float gateAng(float t) {
  return 0.10
    + 0.18 * sstep(3.5, CATCH, t)
    + 0.17 * sstep(FREE, 9.0, t)
    - 0.07 * sstep(15.0, 17.0, t)
    + 0.012 * sin(t * 1.1) * sstep(SWAY, 3.5, t) * (1.0 - sstep(SETTLE, 17.5, t));
}
// latch end of the gate, drooping slightly as it swings toward the camera
vec2 gateEnd(float t) {
  float a = gateAng(t);
  return vec2(HINGE.x + GW * cos(a), GY + 0.150 - 0.075 * sin(a));
}
// gate mask: 5 bars + end post + mid upright + hinge straps; 'rim' carries
// the sun-facing edge highlight
float gateAt(vec2 uv, float t, out float rim) {
  float a = gateAng(t);
  vec2 e = gateEnd(t);
  float m = 0.0; rim = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float yh = GY + 0.028 + fi * 0.0305;
    float ye = yh - 0.075 * sin(a) - 0.004 * sin(a * 0.5); // droop + sag
    vec2 pa = vec2(HINGE.x, yh), pb = vec2(e.x, ye);
    float d = seg(uv, pa, pb);
    m += sstep(0.0028, 0.0016, d);
    rim += sstep(0.0016, 0.0006, d) * 0.5; // lit top edge of each bar
  }
  // latch-end post + mid upright
  m += sstep(0.0030, 0.0018, seg(uv, e, vec2(e.x, GY - 0.045 * sin(a))));
  // mid upright spans bottom bar to top bar at its x
  vec2 midB = vec2(mix(HINGE.x, e.x, 0.55), GY + 0.028 - 0.075 * sin(a) * 0.55);
  vec2 midT = vec2(midB.x, GY + 0.150 - 0.075 * sin(a) * 0.55);
  m += sstep(0.0024, 0.0014, seg(uv, midB, midT));
  // diagonal brace: hinge-top to latch-foot
  m += sstep(0.0020, 0.0012, seg(uv, vec2(HINGE.x, GY + 0.150), vec2(e.x, GY - 0.075 * sin(a))));
  // hinge post
  m += sstep(0.0050, 0.0030, seg(uv, HINGE, vec2(HINGE.x, GY + 0.175)));
  // two hinge straps
  m += sstep(0.0018, 0.0009, seg(uv, vec2(HINGE.x, GY + 0.045), vec2(HINGE.x + 0.016, GY + 0.045)));
  m += sstep(0.0018, 0.0009, seg(uv, vec2(HINGE.x, GY + 0.130), vec2(HINGE.x + 0.016, GY + 0.130)));
  // latch loop at the far end
  m += sstep(0.0020, 0.0010, seg(uv, vec2(e.x - 0.006, e.y + 0.005), vec2(e.x + 0.007, e.y + 0.002)));
  return clamp(m, 0.0, 1.0);
}

// ---------- robin ----------
// perch at the latch end of the top bar → two hops → fly off ~9.5 →
// back ~12.5. 'fly' = wing-flap amount, 'gone' hides it mid-flight
vec2 robinPos(float t, out float fly) {
  vec2 e = gateEnd(t) + vec2(0.0, 0.012);
  fly = 0.0;
  float hop = sstep(6.1, 6.25, t) * 0.018 + sstep(6.55, 6.7, t) * 0.020;
  vec2 perch = e - vec2(hop, 0.0);
  // flight arcs
  float out_ = sstep(9.5, 10.1, t) * (1.0 - sstep(10.1, 10.5, t));
  float back = sstep(12.0, 12.8, t);
  vec2 away = perch + vec2(0.10, 0.16);
  // glide in from high right at the robin beat; perched before it
  vec2 p = mix(vec2(1.06, 0.92), perch, sstep(ROBIN - 0.3, ROBIN + 0.3, t));
  p = mix(p, away, out_);
  // off-frame while away, then glides back to the latch
  p = mix(p, vec2(1.06, 0.92), sstep(10.0, 10.4, t) * (1.0 - sstep(12.0, 12.8, t)));
  p = mix(p, perch + vec2(0.012, 0.004), back);
  // hop bounce while hopping
  float hopB = abs(sin(t * 14.0)) * (sstep(6.0, 6.2, t) - sstep(6.9, 7.1, t)) * 0.006;
  p.y += hopB;
  fly = max(out_, back * (1.0 - sstep(12.6, 12.8, t))) + hopB * 30.0;
  return p;
}
float robinAt(vec2 uv, vec2 p, float t, float fly) {
  vec2 dd = uv - p; dd.x *= ASPECT;
  float bob = sin(t * 6.5) * (1.0 - fly);
  float body = 1.0 - sstep(0.4, 1.0, sdist(uv, p, vec2(0.0060 / ASPECT, 0.0052)));
  float head = 1.0 - sstep(0.4, 1.0, sdist(uv, p + vec2(0.004, 0.006), vec2(0.0036 / ASPECT, 0.0034)));
  // orange breast hint
  float tail = sstep(0.0018, 0.0, seg(uv, p + vec2(-0.005, 0.002), p + vec2(-0.011, 0.004 + 0.004 * bob)));
  float wing = fly * sstep(0.0020, 0.0, seg(uv, p + vec2(-0.002, 0.004), p + vec2(-0.012, 0.010 + 0.006 * sin(t * 22.0))));
  float legs = (1.0 - fly) * sstep(0.0009, 0.0, seg(uv, p + vec2(0.0, -0.004), p + vec2(0.001, -0.010)));
  return clamp(body + head + tail + wing + legs, 0.0, 1.0);
}

// ---------- distant tractor ----------
float tractorAt(vec2 uv, float t, out float puff) {
  float tx = 0.18 + clamp(t - 3.0, 0.0, 14.0) * 0.040;
  float ty = 0.612;
  vec2 q = vec2(tx, ty);
  float m = 0.0;
  m += 1.0 - sstep(0.4, 1.0, sdist(uv, q + vec2(-0.004, 0.002), vec2(0.0075 / ASPECT, 0.0075))); // rear wheel
  m += 1.0 - sstep(0.4, 1.0, sdist(uv, q + vec2(0.011, 0.0), vec2(0.0050 / ASPECT, 0.0050)));     // front wheel
  m += sstep(0.0024, 0.0, sbox(uv, q + vec2(0.0, 0.008), vec2(0.010 / ASPECT, 0.003)));   // chassis
  m += sstep(0.0024, 0.0, sbox(uv, q + vec2(-0.006, 0.016), vec2(0.005 / ASPECT, 0.006))); // cab
  m += sstep(0.0009, 0.0, seg(uv, q + vec2(-0.011, 0.014), q + vec2(-0.011, 0.022))); // exhaust
  // trailing dust puff behind the rear wheel, aging off
  puff = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 dp = q + vec2(-0.010 - fi * 0.006 - 0.002 * sin(t * 2.0 + fi), -0.002 + fi * 0.002);
    puff += (1.0 - sstep(0.4, 1.0, sdist(uv, dp, vec2((0.004 + fi * 0.002) / ASPECT, 0.003 + fi * 0.0015)))) * (0.5 - fi * 0.1);
  }
  // one glint as it "turns" ~11.2 s
  float glint = (1.0 - sstep(0.0, 0.003, length((uv - q - vec2(-0.004, 0.016)) * vec2(ASPECT, 1.0))))
              * sstep(11.0, 11.2, t) * (1.0 - sstep(11.3, 11.6, t));
  return clamp(m, 0.0, 1.0) + glint * 2.0;
}

// ---------- pheasant ----------
float pheasantAt(vec2 uv, float t) {
  if (t < PHEAS || t > PHEAS + 0.85) return 0.0;
  float u = (t - PHEAS) / 0.85;
  vec2 p = vec2(0.285 + 0.110 * pow(u, 0.8), 0.50 + 0.30 * u * u * (1.0 + u));
  float flap = abs(sin(t * 21.0));
  float m = 1.0 - sstep(0.4, 1.0, sdist(uv, p, vec2(0.010 / ASPECT, 0.0065)));
  m += sstep(0.0020, 0.0, seg(uv, p + vec2(-0.007, 0.0), p + vec2(-0.020, -0.006)));   // long tail
  m += sstep(0.0022, 0.0, seg(uv, p, p + vec2(-0.004, 0.008 + 0.010 * flap)));          // near wing
  m += sstep(0.0022, 0.0, seg(uv, p, p + vec2(0.007, 0.010 * (1.0 - flap))));           // far wing
  m += 1.0 - sstep(0.4, 1.0, sdist(uv, p + vec2(0.009, 0.004), vec2(0.003 / ASPECT, 0.0028))); // head
  return clamp(m, 0.0, 1.0) * sstep(0.0, 0.06, u) * (1.0 - sstep(0.92, 1.0, u));
}

// ---------- crows on the gate top ----------
float crowsAt(vec2 uv, float t) {
  if (t < CROWS - 0.5 || t > CROWS + 2.2) return 0.0;
  float m = 0.0;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float tin = CROWS + fi * 0.35;
    float u = sstep(tin - 0.4, tin + 0.1, t);         // descending in
    float out_ = sstep(CROWS + 1.55 + fi * 0.2, CROWS + 1.8 + fi * 0.2, t); // lifting
    vec2 e = gateEnd(t);
    vec2 perch = vec2(e.x - 0.05 - fi * 0.03, e.y + 0.012 + fi * 0.004);
    vec2 from = perch + vec2(0.38 - fi * 0.06, 0.30);
    vec2 away = perch + vec2(0.40 + fi * 0.06, 0.30);
    vec2 p = mix(mix(from, perch, u), away, out_);
    float wing = (1.0 - u) + out_;
    float body = 1.0 - sstep(0.4, 1.0, sdist(uv, p, vec2(0.0075 / ASPECT, 0.0052)));
    float head = 1.0 - sstep(0.4, 1.0, sdist(uv, p + vec2(0.005, 0.005), vec2(0.0035 / ASPECT, 0.003)));
    float tail = sstep(0.0020, 0.0, seg(uv, p + vec2(-0.006, 0.0), p + vec2(-0.014, -0.003)));
    float flaps = wing * sstep(0.0024, 0.0, seg(uv, p, p + vec2(-0.008, 0.008 + 0.008 * sin(t * 18.0 + fi))));
    m += clamp(body + head + tail + flaps, 0.0, 1.0);
  }
  return clamp(m, 0.0, 1.0);
}

// ---------- dog down the track ----------
float dogAt(vec2 uv, float t) {
  if (t < DOG || t > DOG + 1.7) return 0.0;
  float u = (t - DOG) / 1.7;
  vec2 p = mix(vec2(0.470, 0.475), vec2(0.295, 0.395), u);
  p.y += abs(sin(u * 18.0)) * 0.004;            // gallop bounce
  float sc = 0.9 + u * 0.6;
  float m = 1.0 - sstep(0.4, 1.0, sdist(uv, p, vec2(0.011 * sc / ASPECT, 0.006 * sc)));
  m += 1.0 - sstep(0.4, 1.0, sdist(uv, p + vec2(-0.012 * sc, 0.004 * sc), vec2(0.005 * sc / ASPECT, 0.004 * sc))); // head
  float legF = sin(u * 24.0);
  m += sstep(0.0016 * sc, 0.0, seg(uv, p + vec2(-0.006 * sc, -0.004 * sc), p + vec2(-0.009 * sc, -0.012 * sc - 0.004 * legF)));
  m += sstep(0.0016 * sc, 0.0, seg(uv, p + vec2(0.007 * sc, -0.004 * sc), p + vec2(0.010 * sc, -0.012 * sc + 0.004 * legF)));
  m += sstep(0.0018, 0.0, seg(uv, p + vec2(0.011 * sc, 0.003), p + vec2(0.018 * sc, 0.008 + 0.003 * sin(u * 12.0)))); // tail up
  return clamp(m, 0.0, 1.0) * sstep(0.0, 0.05, u) * (1.0 - sstep(0.93, 1.0, u));
}

// ---------- scene ----------
void main() {
  vec2 uv = vUv;
  float t = uT;
  float ga = gateAng(t);

  // sky: golden-hour gradient, warm core low-left off-frame
  vec3 sky = mix(vec3(0.98, 0.68, 0.34), vec3(0.42, 0.34, 0.38), sstep(0.58, 0.98, uv.y));
  sky = mix(sky, vec3(0.62, 0.42, 0.40), sstep(0.80, 1.0, uv.x) * sstep(0.62, 0.95, uv.y) * 0.6);
  vec2 sg = uv - vec2(0.02, 0.60); sg.x *= ASPECT;
  float sun = exp(-dot(sg, sg) * 6.0);
  sky += vec3(0.55, 0.30, 0.10) * sun;
  // faint high cloud streaks
  sky += vec3(0.10, 0.06, 0.03) * sstep(0.55, 0.8, vn(vec2(uv.x * 6.0, uv.y * 26.0))) * sstep(0.70, 0.9, uv.y) * 0.4;

  vec3 col = sky;

  // horizon band + hedgerow
  float hy = 0.615 + 0.006 * vn(vec2(uv.x * 8.0, 3.0));
  vec3 field = mix(vec3(0.36, 0.24, 0.11), vec3(0.16, 0.12, 0.07), sstep(0.62, 0.40, uv.y));
  // low sun rakes left→right: near field lit warm, far side falls off
  field *= 0.80 + 0.55 * (1.0 - uv.x);
  // grass rows catching the raking light
  field += vec3(0.10, 0.065, 0.02) * sstep(0.86, 0.97, vn(vec2(uv.x * 60.0, uv.y * 90.0))) * sstep(0.61, 0.48, uv.y) * (1.0 - 0.6 * uv.x);
  field += vec3(0.05, 0.03, 0.012) * sstep(0.75, 0.95, vn(vec2(uv.x * 25.0, uv.y * 200.0))) * sstep(0.60, 0.45, uv.y) * (1.0 - 0.6 * uv.x);
  float ground = sstep(hy + 0.004, hy - 0.004, uv.y);
  col = mix(col, field, ground);
  // hedgerow line
  float hedge = sstep(hy + 0.012, hy, uv.y) * sstep(hy - 0.004, hy, uv.y);
  col = mix(col, vec3(0.22, 0.17, 0.10), hedge * (0.5 + 0.5 * vn(vec2(uv.x * 30.0, 1.0))));

  // track ruts converging through the gate gap
  float rutA = abs(uv.x - mix(0.505, 0.452, sstep(0.36, 0.62, uv.y)));
  float rutB = abs(uv.x - mix(0.425, 0.436, sstep(0.36, 0.62, uv.y)));
  float rut = sstep(0.009, 0.002, min(rutA, rutB)) * sstep(0.62, 0.44, uv.y) * sstep(0.36, 0.40, uv.y);
  col = mix(col, vec3(0.10, 0.07, 0.05), rut);
  col += vec3(0.22, 0.15, 0.06) * sstep(0.004, 0.001, min(rutA, rutB)) * sstep(0.62, 0.44, uv.y) * sstep(0.36, 0.40, uv.y) * 0.6; // wet sheen

  // hawthorn silhouette on the hinge side
  vec2 hw = uv - vec2(0.300, 0.515); hw.x *= ASPECT;
  float thorn = sstep(0.045, 0.028, length(hw) - 0.03 * (vn(hw * 60.0) - 0.5));
  thorn += sstep(0.0035, 0.0, seg(uv, vec2(0.302, 0.46), vec2(0.300, 0.50)));
  col = mix(col, vec3(0.09, 0.08, 0.06), clamp(thorn, 0.0, 1.0) * 0.92);

  // long gate shadow sheared across the ruts (ground→gate space)
  {
    float rim0;
    vec2 suv = vec2(uv.x - 0.62 * (GY - uv.y), GY + 1.5 * (GY - uv.y));
    float sh = gateAt(suv, t, rim0) * sstep(GY - 0.001, GY - 0.10, uv.y) * sstep(0.34, 0.40, uv.y);
    col *= 1.0 - 0.32 * sh;
  }

  // tractor on the horizon strip
  float puff;
  float tr = tractorAt(uv, t, puff);
  col = mix(col, vec3(0.75, 0.60, 0.40), clamp(puff, 0.0, 1.0) * 0.55);
  col = mix(col, vec3(0.10, 0.09, 0.08), clamp(tr, 0.0, 1.0) * 0.95);
  col += vec3(1.0, 0.85, 0.5) * max(tr - 1.0, 0.0) * 0.8; // the turn glint

  // backlit dust motes drifting in the gate gap
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    vec2 mp = vec2(HINGE.x + 0.02 + h1(fi * 7.3) * 0.17 + 0.008 * sin(t * 0.6 + fi * 2.0),
                   0.47 + h1(fi * 3.7) * 0.13 + 0.012 * sin(t * 0.4 + fi * 3.0));
    float dm = 1.0 - sstep(0.0, 0.0014, length((uv - mp) * vec2(ASPECT, 1.0)));
    col += vec3(0.7, 0.5, 0.25) * dm * (0.5 + 0.5 * sin(t * 2.0 + fi * 5.0));
  }

  // the gate itself + warm rim + hinge glint
  float rim;
  float gate = gateAt(uv, t, rim);
  vec3 gateCol = vec3(0.10, 0.075, 0.06); // dark rusted iron
  gateCol += vec3(0.10, 0.03, 0.0) * sstep(0.5, 0.9, vn(uv * 90.0)); // rust mottle
  col = mix(col, gateCol, gate * 0.97);
  col += vec3(0.85, 0.55, 0.22) * rim * gate * (0.6 + 0.4 * sun);
  vec2 hg = uv - vec2(HINGE.x, GY + 0.132); hg.x *= ASPECT;
  col += vec3(1.0, 0.8, 0.45) * exp(-dot(hg, hg) * 9000.0)
       * (0.5 + 0.5 * sin(t * 0.5))
       * (sstep(8.3, 8.5, t) * (1.0 - sstep(8.9, 9.3, t)) + sstep(13.8, 14.0, t) * (1.0 - sstep(14.5, 14.9, t)));

  // robin
  float rfly;
  vec2 rp = robinPos(t, rfly);
  float rb = robinAt(uv, rp, t, rfly);
  col = mix(col, vec3(0.10, 0.07, 0.06), rb * 0.9);
  // orange breast hint
  vec2 bd = uv - (rp + vec2(0.003, -0.001)); bd.x *= ASPECT;
  col = mix(col, vec3(0.75, 0.30, 0.10), (1.0 - sstep(0.0, 0.0028, dot(bd, bd))) * 0.8 * step(0.01, rb));

  // pheasant burst / crows / dog
  col = mix(col, vec3(0.12, 0.09, 0.06), pheasantAt(uv, t) * 0.95);
  col = mix(col, vec3(0.06, 0.055, 0.05), crowsAt(uv, t) * 0.95);
  col = mix(col, vec3(0.10, 0.08, 0.07), dogAt(uv, t) * 0.92);

  // settle: the whole frame cools a touch and motes thin
  float settle = sstep(SETTLE, 17.8, t);
  col *= 1.0 - 0.08 * settle;

  // gentle vignette
  vec2 vc = uv - vec2(0.5, 0.55); vc.x *= ASPECT;
  col *= 1.0 - 0.30 * sstep(0.25, 0.75, dot(vc, vc));

  fragColor = vec4(col, 1.0);
}
`;

const PW = 320, PH = 140, PZ = -80, PY = 8;
const uv2w = (u: number, v: number): [number, number] => [
  (u - 0.5) * PW,
  PY + (v - 0.5) * PH,
];

const CAPTIONS: Array<[number, number, string, [number, number]]> = [
  [0.8, 2.6, 'the gate rests on its hinge', [0.5, 0.30]],
  [4.8, 6.6, 'a robin holds the latch', [0.44, 0.32]],
  [7.4, 9.2, 'the field keeps working', [0.5, 0.30]],
  [9.8, 11.4, 'wings over the wheat', [0.5, 0.30]],
  [14.6, 16.6, 'the evening lets it be', [0.5, 0.28]],
];

export default class RustedgateScene extends Scene {
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
      swing: t >= 2.5 && t <= 9.5 ? 1 : 0,
      robin: t >= 5.0 && t <= 13.0 ? 1 : 0,
      pheasant: t >= 10.0 && t <= 10.9 ? 1 : 0,
      settle: t >= 16.5 && t <= 18.0 ? 1 : 0,
    };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    // CameraRig: low near-static — a slight drift through the gate gap keyed
    // to the same closed-form swing, easing back for the settle.
    const open = (0.5 * ss(3.5, 4.2, t) + 0.5 * ss(7.0, 9.0, t)) * (1 - ss(15.5, 17.5, t));
    this.rig.position = [
      4.0 + 0.5 * Math.sin(t * 0.05) + 1.6 * open,
      10.0 + 0.3 * Math.sin(t * 0.06 + 1.0),
      78.0 - 2.0 * open,
    ];
    this.rig.target = [
      6.0 + 0.4 * Math.sin(t * 0.045),
      11.0 + 0.3 * ss(4.0, 8.0, t),
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
        const cy = Math.min(Math.max((0.5 - ndc.y * 0.5) * H + H * 0.18, 72), H - 72);
        c.save();
        c.globalAlpha = a;
        c.font = `46px "${F.archivo(112, 500)}", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const tw = c.measureText(text).width;
        const cx = Math.min(Math.max(cx0, tw / 2 + 16), W - tw / 2 - 16);
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(20, 12, 6, 0.85)';
        c.lineWidth = 12;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#f3e6d2';
        c.fillText(text, cx, cy);
        c.restore();
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }

    return {
      exposure: 1.0,
      bloom: 0.35,
      bloomThreshold: 0.7,
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
