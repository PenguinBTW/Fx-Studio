// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// desertstorm — a haboob dust-front rolling over a desert highway at last
// light. One fullscreen GLSL pass holds the whole scene: cracked desert
// floor, a straight two-lane road receding to a vanishing point (heat
// shimmer pools on the tarmac), telephone poles shrinking left with
// vibrating wires, a broken fence line right, and a distant mesa rim under
// a low off-frame amber sun. The haboob is an fbm-billowed ochre wall that
// advances left→right over ~7s — stratified brown bands, a ragged top
// edge, brief god-ray slits, a darker base — swallowing road, poles and
// fence in sequence, then thinning to a trailing tan haze. Dust is three
// depth layers of seeded streaks; 4 tumbleweeds bounce toward camera on
// the road; a plastic bag whips on a fence post; a crow fights the wind
// and gives up on the fence; a truck's headlights grow inside the haze
// then die as the front swallows them. CameraRig holds a near-static low
// shot down the road with a slight push and a micro shake on arrival.
// Everything is closed-form f(t), hash seeds only — no accumulators.
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

// JS mirror of the shader's gustEnv so ∫gustEnv dt (uGi) can be evaluated
// once per frame on the CPU instead of per-pixel in GLSL.
const gustEnvJS = (t: number) =>
  0.25 + 0.55 * ss(4.5, 8.5, t) * (1 - ss(14.0, 18.5, t))
  + 0.20 * Math.sin(t * 1.7) * ss(4.5, 7.0, t) * (1 - ss(14.0, 18.0, t));
const gustIntJS = (t: number) => {
  let s = 0;
  for (let i = 0; i < 32; i++) s += gustEnvJS((t * i) / 32);
  return (s * t) / 32;
};

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// uv-space scene: HZ is the horizon; below it the ground uses compressed
// perspective z = HZ/(HZ - y) so the road narrows to a vanishing point.
// The haboob wall is applied AFTER the clean scene: its coverage mask
// swallows everything sequentially as the front crosses left→right.
const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
uniform float uGi;
out vec4 fragColor;
const float HZ = 0.40;
const float RW = 0.30;
const float ASPECT = ${(16 / 9).toFixed(4)};

float h1(float p) { return fract(sin(p * 127.1) * 43758.5453123); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float vn1(float x) {
  float i = floor(x), f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(h1(i), h1(i + 1.0), u);
}
float vn2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h1(i.x + i.y * 57.0), h1(i.x + 1.0 + i.y * 57.0), u.x),
             mix(h1(i.x + (i.y + 1.0) * 57.0), h1(i.x + 1.0 + (i.y + 1.0) * 57.0), u.x), u.y);
}
float fbm2(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vn2(p); p = p * 2.13 + 7.7; a *= 0.5; }
  return s;
}
float fbm3(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * vn2(p); p = p * 2.13 + 7.7; a *= 0.5; }
  return s;
}
// GLSL ES leaves smoothstep(edge0>edge1) undefined; sstep keeps the same
// semantics on every driver by flipping to the descending complement.
float sstep(float e0, float e1, float x) {
  return e0 < e1 ? smoothstep(e0, e1, x) : 1.0 - smoothstep(e1, e0, x);
}
float seg(vec2 uv, vec2 a, vec2 b, float w) {
  vec2 pa = uv - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return 1.0 - smoothstep(w, w * 2.2, length(pa - ba * h));
}

// ---- storm envelopes (shared by wall, dust, props, camera shake) ----
// uF: haboob front edge in uv.x, sweeping left→right over ~7s
float front(float t) { return -0.18 + 1.38 * sstep(4.5, 11.5, t); }
// pre-front lifted dust dimming ahead of the wall
float preDust(float t) { return sstep(5.0, 10.0, t) * (1.0 - sstep(15.0, 18.5, t) * 0.6); }
// gust surge powering streaks, bag, wires
float gustEnv(float t) {
  return 0.25 + 0.55 * sstep(4.5, 8.5, t) * (1.0 - sstep(14.0, 18.5, t))
       + 0.20 * sin(t * 1.7) * sstep(4.5, 7.0, t) * (1.0 - sstep(14.0, 18.0, t));
}
// ∫gustEnv dt is carried in on uGi (computed once per frame on the CPU —
// it depends only on t, so a per-pixel 32-tap quadrature would be wasted
// work). Positions must integrate the gust: t*g reverses when g falls.

vec3 skyCol(vec2 uv, float t) {
  // late afternoon: amber horizon warming toward the off-frame sun (right),
  // dusty steel-blue zenith
  vec3 c = mix(vec3(0.98, 0.72, 0.38), vec3(0.42, 0.50, 0.66), sstep(HZ, 0.85, uv.y));
  float sunD = length((uv - vec2(1.16, 0.44)) * vec2(ASPECT, 1.0));
  c += vec3(1.0, 0.80, 0.45) * 0.45 * exp(-sunD * 3.5);
  c += vec3(1.0, 0.72, 0.35) * 0.14 * exp(-sunD * 1.4);
  // thin dust streamers already aloft, drifting right
  float strm = fbm2(vec2(uv.x * 6.0 - t * 0.05, uv.y * 22.0));
  c = mix(c, vec3(0.88, 0.70, 0.45), sstep(0.62, 0.85, strm) * 0.18 * sstep(0.95, 0.5, uv.y));
  // dust front glow: as the wall nears, the left sky browns out
  float f = front(t);
  c = mix(c, vec3(0.52, 0.36, 0.20), sstep(f + 0.5, f + 0.1, uv.x) * 0.35 * sstep(4.0, 7.0, t));
  return c;
}

// telephone pole mask at depth z on the LEFT shoulder; crossarm + insulators
float pole(vec2 uv, float z) {
  float y0 = HZ - HZ / z;
  float hgt = 0.34 / z;
  float cx = 0.5 - (0.52 / z + 0.004);
  float dx = uv.x - cx;
  float wdt = 0.0018 * (10.0 / z);
  float post = step(abs(dx), wdt) * step(y0 - 0.01 / z, uv.y) * step(uv.y, y0 + hgt);
  float arm = step(abs(uv.y - (y0 + hgt * 0.86)), hgt * 0.035) * step(abs(dx), 6.0 * wdt);
  float arm2 = step(abs(uv.y - (y0 + hgt * 0.70)), hgt * 0.03) * step(abs(dx), 4.6 * wdt);
  float insul = step(abs(uv.y - (y0 + hgt * 0.90)), hgt * 0.02)
              * step(abs(abs(dx) - 5.2 * wdt), wdt * 0.9);
  return max(post, max(arm, max(arm2, insul)));
}
vec2 poleTop(float z) { return vec2(0.5 - (0.52 / z + 0.004), HZ - HZ / z + 0.34 / z * 0.86); }

// fence post at depth z on the RIGHT shoulder; tilt = leaning posts
float fencePost(vec2 uv, float z, float tilt) {
  float y0 = HZ - HZ / z;
  float hgt = 0.085 / z;
  float cx = 0.5 + (0.62 / z + 0.002);
  float dx = uv.x - cx - tilt * (uv.y - y0);
  float wdt = 0.0014 * (10.0 / z);
  return step(abs(dx), wdt) * step(y0 - 0.01 / z, uv.y) * step(uv.y, y0 + hgt);
}
vec2 fenceTop(float z, float tilt) { return vec2(0.5 + (0.62 / z + 0.002) + tilt * 0.085 / z, HZ - HZ / z + 0.085 / z); }

// tumbleweed: fbm-edged tumbling knot at road depth z, lateral xw
vec4 weedMask(vec2 uv, float z, float xw, float ph) {
  float y0 = HZ - HZ / z;
  float r = 0.030 / z * 4.0;                    // near ~0.03 uv
  vec2 c = vec2(0.5 + xw * RW / z, y0 + r * 0.95 + abs(sin(ph)) * 0.045 / z);
  vec2 q = (uv - c) * vec2(ASPECT, 1.0);
  float ang = atan(q.y, q.x + 1e-5);
  float rr = r * (0.82 + 0.28 * fbm3(vec2(ang * 2.0 + ph * 2.0, ph)));
  float body = 1.0 - smoothstep(rr * 0.8, rr, length(q));
  float inner = fbm3(vec2(ang * 3.0 + ph * 3.0, length(q) * 90.0 / r));
  return vec4(body, inner, 0.0, 0.0);
}

// crow silhouette: body + two wings bobbing with flap around (cx, cy)
float crow(vec2 uv, vec2 c, float flap, float s) {
  vec2 q = (uv - c) * vec2(ASPECT, 1.0) / s;
  float body = 1.0 - smoothstep(0.55, 0.95, length(q / vec2(1.6, 0.55)));
  float wl = 1.0 - smoothstep(0.55, 0.95, length((q - vec2(-1.25, 0.25 + flap * 0.8)) / vec2(1.5, 0.45)));
  float wr = 1.0 - smoothstep(0.55, 0.95, length((q - vec2(1.25, 0.25 + flap * 0.8)) / vec2(1.5, 0.45)));
  return max(body, max(wl, wr));
}

vec3 sceneCol(vec2 uv, float t) {
  float g = gustEnv(t);
  // crow: fights the headwind from the right, gives up, lands on the fence
  // (computed before the sky/ground split so the flying silhouette — which
  // lives above HZ — actually reaches pixels; the perch sits below HZ)
  float ct = sstep(4.5, 9.0, t);
  float land = sstep(9.0, 10.0, t);
  // perches on the second fence post (z=7.1, tilt of loop index 1)
  vec2 perch = fenceTop(7.1, (h1(10.1) - 0.5) * 0.9) + vec2(0.0, 0.004);
  vec2 fly = vec2(1.06 - 0.62 * ct + 0.05 * sin(t * 6.0) * g,
                  0.62 + 0.08 * sin(t * 4.2) * g - 0.05 * ct);
  vec2 cp = mix(fly, perch, land);
  float flap = sin(t * mix(13.0, 2.0, land)) * 0.55 * (1.0 - land * 0.9);
  float cm = crow(uv, cp, flap, 0.012);

  if (uv.y >= HZ) {
    vec3 c = skyCol(uv, t);
    // mesa rim: flat-topped silhouette band right of centre, plus a faint
    // far-left ridge; brown-purple against the amber horizon
    float mesa = 0.0;
    float mx = (uv.x - 0.55) * 3.0;
    if (uv.x > 0.5) {
      float rim = HZ + 0.012 + 0.030 * step(0.35, fbm3(vec2(floor(mx * 4.0) * 0.25, 3.7)))
                + 0.012 * step(0.6, fbm3(vec2(floor(mx * 9.0) * 0.11, 8.2)));
      mesa = sstep(rim, rim - 0.004, uv.y);
    }
    float leftRim = HZ + 0.006 + 0.010 * fbm3(vec2(uv.x * 8.0, 2.0));
    float lm = sstep(leftRim, leftRim - 0.003, uv.y) * sstep(0.5, 0.2, uv.x);
    vec3 mesaC = mix(vec3(0.36, 0.24, 0.20), vec3(0.45, 0.30, 0.24), sstep(0.0, 0.03, uv.y - HZ));
    c = mix(c, mesaC, clamp(mesa + lm, 0.0, 1.0) * 0.9);
    c = mix(c, vec3(0.06, 0.05, 0.06), cm * 0.95);      // crow vs the sky
    return c;
  }

  float z = HZ / (HZ - uv.y + 1e-5);
  float xw = (uv.x - 0.5) * z / RW;
  float road = 1.0 - sstep(0.95, 1.05, abs(xw));

  // desert floor: dusty tan with cracking polygon ridges on the verges
  // (cracks are a near-field detail — fade out with depth, not in)
  float crack = 1.0 - sstep(0.028, 0.055, abs(fbm2(vec2(xw * 0.9, z * 0.55)) - 0.5));
  vec3 dirt = mix(vec3(0.66, 0.51, 0.32), vec3(0.80, 0.64, 0.42), fbm2(vec2(xw * 0.4 + z * 0.2, z * 0.6)));
  dirt = mix(dirt, dirt * 0.55, crack * (1.0 - sstep(9.0, 28.0, z)) * 0.8);
  vec3 c = dirt;

  // tarmac: worn asphalt, wheel-polish bands, dashed centreline, edge lines
  float grain = fbm2(vec2(xw * 7.0, z * 2.2)) * 0.5 + vn1(z * 45.0) * 0.1;
  vec3 tar = mix(vec3(0.17, 0.15, 0.13), vec3(0.36, 0.32, 0.27), grain);
  tar *= 1.0 - 0.25 * sstep(0.30, 0.10, abs(abs(xw) - 0.48));        // wheel tracks
  float dash = step(abs(xw), 0.02) * step(0.5, fract(z * 0.35));
  tar = mix(tar, vec3(0.92, 0.82, 0.55), dash * 0.8);
  float edge = sstep(0.055, 0.03, abs(abs(xw) - 0.92));
  tar = mix(tar, vec3(0.85, 0.78, 0.60), edge * 0.6);
  c = mix(c, tar, road);

  // heat-shimmer pools on the tarmac (subtle at this hour)
  float pool = sstep(0.68, 0.88, fbm2(vec2(uv.x * 9.0, z * 0.5 + t * 0.35)))
             * sstep(1.5, 4.0, z) * (1.0 - sstep(16.0, 36.0, z)) * road;
  c = mix(c, skyCol(vec2(uv.x, HZ + 0.02), t), pool * 0.30);

  // telephone poles + sagging wires, LEFT side, receding
  for (int i = 0; i < 6; i++) {
    float zz = 4.5 + float(i) * 5.8;
    float p = pole(uv, zz);
    // warm rim on the sun side until the front swallows it
    float rimSide = sstep(0.0, 0.5, uv.x - (0.5 - (0.52 / zz + 0.004)) + 0.002);
    c = mix(c, vec3(0.10, 0.09, 0.08), p * sstep(40.0, 10.0, zz));
    c += vec3(1.0, 0.72, 0.38) * p * rimSide * 0.30 * sstep(40.0, 12.0, zz);
    if (i < 5) {
      vec2 a = poleTop(zz), b = poleTop(zz + 5.8);
      vec2 m = (a + b) * 0.5;
      float sag = 0.012 / zz;
      vec2 s0 = uv;
      // wire curve: midpoint sags; vibrate under gust
      float vib = sin(uv.x * 300.0 + t * (16.0 + float(i) * 3.0)) * 0.0018 * g;
      vec2 a2 = a, b2 = b;
      m.y -= sag; m.y += vib * 3.0;
      float w1 = seg(s0, a2, m, 0.0008) + seg(s0, m, b2, 0.0008);
      float w2 = seg(s0, a2 + vec2(0.0, -0.008 / zz), m + vec2(0.0, -0.008 / zz - sag * 0.6), 0.0007)
               + seg(s0, m + vec2(0.0, -0.008 / zz - sag * 0.6), b2 + vec2(0.0, -0.008 / zz), 0.0007);
      c = mix(c, vec3(0.10, 0.08, 0.07), clamp(w1 + w2, 0.0, 1.0) * sstep(40.0, 10.0, zz) * 0.9);
    }
  }

  // broken fence line, RIGHT side: posts receding, some leaning, 2 strands
  for (int i = 0; i < 8; i++) {
    float zz = 3.5 + float(i) * 3.6;
    float tilt = (h1(float(i) * 3.1 + 7.0) - 0.5) * 0.9 * sstep(12.0, 4.0, zz);
    if (i == 4) tilt = 1.6;                       // one fully fallen post
    float p = fencePost(uv, zz, tilt);
    c = mix(c, vec3(0.30, 0.22, 0.15), p * sstep(35.0, 8.0, zz));
    if (i < 7) {
      vec2 a = fenceTop(zz, tilt);
      vec2 b = fenceTop(zz + 3.6, (h1(float(i + 1) * 3.1 + 7.0) - 0.5) * 0.9 * sstep(12.0, 4.0, zz + 3.6));
      if (i == 4) b = fenceTop(zz + 3.6, 0.0) + vec2(0.0, -0.06 / zz);   // strand droops at the gap
      float s1 = seg(uv, a + vec2(0.0, -0.006 / zz), b + vec2(0.0, -0.006 / zz), 0.0007);
      float s2 = seg(uv, a + vec2(0.0, -0.030 / zz), b + vec2(0.0, -0.030 / zz), 0.0006);
      c = mix(c, vec3(0.25, 0.19, 0.13), clamp(s1 + s2, 0.0, 1.0) * sstep(35.0, 8.0, zz));
    }
  }

  // plastic bag snagged on the nearest fence post (z=3.5, tilt of loop
  // index 0 — sstep(12,4,3.5)=1 so the envelope is at full weight)
  {
    vec2 post = fenceTop(3.5, (h1(7.0) - 0.5) * 0.9);
    float whip = (0.6 + 0.4 * g);
    vec2 bp = post + vec2(0.012 * sin(t * 7.3) * whip + 0.006 * sin(t * 12.7) * g,
                          0.006 * sin(t * 9.1) * whip - 0.004 * g);
    vec2 q = (uv - bp) * vec2(ASPECT, 1.0) / 0.012;
    float ang = t * (3.0 + 9.0 * g) + sin(t * 11.0);
    q = vec2(q.x * cos(ang * 0.3) - q.y * sin(ang * 0.3), q.x * sin(ang * 0.3) + q.y * cos(ang * 0.3));
    float bag = 1.0 - smoothstep(0.55, 0.9, length(q / vec2(1.0 + 0.3 * sin(t * 8.0), 0.75)));
    bag *= 0.7 + 0.3 * fbm3(vec2(q.x * 4.0, t * 9.0));               // crinkle
    c += vec3(0.95, 0.92, 0.86) * bag * 0.85;                        // sunlit plastic
    c = mix(c, vec3(0.30, 0.24, 0.16), seg(uv, post, bp, 0.0006) * 0.7);
  }

  // tumbleweeds: 4 seeded knots bouncing down-road toward camera, wind-driven
  for (int i = 0; i < 4; i++) {
    float seed = float(i) * 17.31 + 3.7;
    float pr = fract(t * 0.055 + h1(seed) * 1.9);                    // approach phase
    float zz = mix(11.0, 3.2, pr);
    float xw2 = mix(h1(seed + 1.0) * 1.4 - 0.7, h1(seed + 2.0) * 2.6 - 1.3, pr); // drift to shoulder
    vec4 wmk = weedMask(uv, zz, xw2, t * (5.0 + h1(seed + 3.0) * 3.0) + seed);
    // shadow on the tarmac
    float y0w = HZ - HZ / zz;
    vec2 sh = (uv - vec2(0.5 + xw2 * RW / zz, y0w)) * vec2(ASPECT, 1.0);
    float shdw = 1.0 - smoothstep(0.012, 0.028, length(sh / vec2(1.6, 0.45)));
    c = mix(c, vec3(0.25, 0.19, 0.12), shdw * 0.35 * sstep(11.5, 3.5, zz));
    vec3 weedC = mix(vec3(0.24, 0.16, 0.09), vec3(0.46, 0.33, 0.17), wmk.y);
    c = mix(c, weedC, wmk.x * 0.95 * sstep(11.5, 9.5, zz) * sstep(2.8, 3.2, zz));
  }

  // crow vs the ground (perched side of its arc; flight side painted above HZ)
  c = mix(c, vec3(0.06, 0.05, 0.06), cm * 0.95);

  // truck headlights: two glows inside the advancing haze, growing then cut
  {
    float tz = mix(26.0, 7.0, sstep(6.5, 11.5, t));
    float ty = HZ - HZ / tz;
    float flick = 0.85 + 0.15 * sin(t * 23.0 + vn1(t * 8.0) * 4.0);
    for (int i = 0; i < 2; i++) {
      float lx = 0.5 + (i == 0 ? -0.10 : 0.10) * RW / tz;
      vec2 lp = (uv - vec2(lx, ty + 0.006 / tz)) * vec2(ASPECT, 1.0);
      float glow = exp(-dot(lp, lp) / (0.0004 / tz + 0.00002));
      c += vec3(1.0, 0.85, 0.55) * glow * 1.6 * flick * sstep(6.5, 8.0, t) * (1.0 - sstep(11.0, 12.0, t));
    }
    // faint beam column under the lamps
    float beam = sstep(0.5, 0.2, abs(uv.x - 0.5)) * sstep(ty + 0.002, ty - 0.05, uv.y)
               * sstep(HZ - 0.35, ty, uv.y);
    c += vec3(1.0, 0.82, 0.5) * beam * 0.15 * sstep(7.0, 9.0, t) * (1.0 - sstep(11.0, 12.0, t));
  }

  // far dust haze swallows the horizon line
  c = mix(c, vec3(0.85, 0.68, 0.44), sstep(12.0, 60.0, z) * 0.55);
  return c;
}

void main() {
  vec2 uv = vUv;
  float t = uT;
  float g = gustEnv(t);
  float gi = uGi;

  // mild shimmer wobble in the road band only (front-lit, subtle)
  float band = sstep(HZ, HZ - 0.10, uv.y) * sstep(HZ - 0.30, HZ - 0.06, uv.y);
  vec2 q = uv + vec2(sin(uv.y * 140.0 - t * 6.0 + fbm2(uv * 8.0 + t * 0.2) * 8.0) * 0.0012 * band, 0.0);
  vec3 c = sceneCol(q, t);

  // pre-front lifted-dust dimming ahead of the wall
  float f = front(t);
  float ahead = sstep(f + 0.02, f + 0.26, uv.x) * sstep(f + 0.45, f + 0.15, uv.x);
  float outr = sstep(f + 0.02, f + 0.26, uv.x);  // 1 left of front.. transition
  float pd = preDust(t);
  c = mix(c, vec3(0.72, 0.55, 0.34), clamp((1.0 - outr) * 0.35 + ahead * 0.55, 0.0, 1.0) * pd);

  // ---- the haboob wall ----
  // ragged front edge: top leans ahead, fbm billows + rolling lobes
  float rag = fbm2(vec2(uv.y * 5.0 - t * 0.35, 4.2)) * 0.16
            + fbm3(vec2(uv.y * 14.0 + t * 0.5, 9.1)) * 0.07
            + 0.04 * sin(uv.y * 21.0 - t * 1.1);
  float edge = f + 0.09 * (uv.y - HZ) + rag;
  float inWall = sstep(edge, edge - 0.03, uv.x);
  // ragged top: wall fades to wisps above topEdge (kept under the frame's
  // ~0.79 visible ceiling so the crest + god-ray band stay in shot)
  float topEdge = 0.70 + 0.11 * fbm2(vec2(uv.x * 4.0 + t * 0.12, 7.7));
  float topFade = 1.0 - sstep(topEdge - 0.02, topEdge + 0.10, uv.y);
  // stratified bands: darker churned base, mid ochre, brighter top
  float strata = fbm2(vec2(uv.y * 26.0, uv.x * 3.0 + t * 0.4));
  vec3 wallBase = mix(vec3(0.30, 0.20, 0.12), vec3(0.55, 0.38, 0.22), sstep(0.0, 0.30, uv.y));
  wallBase = mix(wallBase, vec3(0.78, 0.58, 0.34), sstep(0.30, topEdge, uv.y) * 0.7);
  float billow = fbm2(vec2(uv.x * 6.0 - t * 0.7, uv.y * 4.5));
  wallBase *= 0.82 + 0.36 * billow + 0.15 * strata;
  // god-ray slits in the upper band as the wall crosses
  float ray = sstep(0.78, 0.85, fbm3(vec2(uv.x * 11.0 + t * 0.06, 2.2)))
            * sstep(topEdge - 0.22, topEdge - 0.05, uv.y) * sstep(6.0, 8.5, t) * (1.0 - sstep(11.5, 13.0, t));
  wallBase += vec3(1.0, 0.82, 0.5) * ray * 1.2;
  // deeper interior = featureless thick dust (fully swallowed)
  float thick = sstep(edge - 0.10, edge - 0.45, uv.x);
  vec3 thickC = vec3(0.55, 0.40, 0.24)
              * (0.72 + 0.50 * fbm2(vec2(uv.x * 3.5 - t * 0.6, uv.y * 2.5)))
              * (0.80 + 0.35 * strata)
              * (0.88 + 0.24 * fbm3(vec2(uv.x * 9.0 - t * 1.2, uv.y * 7.0)));
  wallBase = mix(wallBase, thickC, thick);
  // approaching face: before the edge crosses into frame, the wall shows
  // as a ridge rising on the left skyline (growing as it nears)
  float faceTop = 0.42 + 0.34 * sstep(4.0, 8.5, t) + 0.06 * fbm3(vec2(uv.x * 9.0, t * 0.2));
  float faceX = 0.62 * sstep(4.5, 9.0, t);
  float faceM = (1.0 - sstep(faceTop - 0.04, faceTop + 0.09, uv.y))
              * step(HZ - 0.02, uv.y)
              * sstep(faceX, faceX - 0.18, uv.x)
              * sstep(3.8, 5.0, t)
              * (1.0 - sstep(0.15, 0.45, f));           // hands off as the real edge crosses
  c = mix(c, wallBase * 0.92, clamp(faceM, 0.0, 1.0));
  // trailing haze: once the front is past, the veil thins and the scene re-emerges
  float wallA = inWall * topFade * (1.0 - 0.78 * sstep(13.5, 18.5, t) * sstep(1.0, 1.3, f));
  c = mix(c, wallBase, clamp(wallA, 0.0, 1.0));
  // inside the storm: residual dim over whatever shows through
  c = mix(c, c * vec3(0.85, 0.75, 0.62), inWall * sstep(1.0, 1.3, f) * (1.0 - sstep(13.5, 18.5, t)));

  // ---- 3 depth layers of sand-grain streaks, horizontal wind-aligned ----
  for (int k = 0; k < 3; k++) {
    float kk = float(k);
    float spd = 0.55 + kk * 0.45;
    float n = 12.0 + kk * 4.0;
    for (float i = 0.0; i < 20.0; i++) {
      if (i >= n) break;
      float sd = h1(i * 7.13 + kk * 31.7);
      float yy = 0.04 + 0.80 * h1(i * 3.3 + kk * 13.0 + 0.4);
      float xx = fract(h1(i * 11.7 + kk * 5.0) + spd * (0.35 * t + 0.35 * gi) * (1.0 + sd));
      float len = 0.015 + 0.030 * sd + 0.02 * kk;
      float d = abs(uv.y - yy);
      float dx = abs(uv.x - xx);
      float stk = (1.0 - smoothstep(0.0004, 0.0022 + 0.001 * kk, d))
                * sstep(len, len * 0.55, dx) * sstep(len * 0.05, len * 0.4, dx);
      float inDust = inWall * 0.7 + 0.3;
      c += vec3(0.95, 0.78, 0.50) * stk * (0.10 + 0.25 * g) * (0.4 + 0.6 * sd) * inDust * (1.0 - 0.2 * kk);
    }
  }

  // atmospheric grade: storm dims the whole frame slightly as it swallows
  c *= 1.0 - 0.25 * sstep(5.0, 11.0, t) * (1.0 - sstep(14.0, 19.0, t) * 0.5);
  fragColor = vec4(c, 1.0);
}`;

// Backdrop plane mapping (must match the mesh below): uv → world.
const PW = 320, PH = 140, PY = 8, PZ = -80;
const uv2w = (ux: number, uy: number): [number, number] => [(ux - 0.5) * PW, PY + (uy - 0.5) * PH];

// [tin, tout, text, anchorUv]
const CAPTIONS: Array<[number, number, string, [number, number]]> = [
  [0.8, 3.6, 'route 17 — 6:40 pm', [0.50, 0.30]],
  [4.2, 7.4, 'haboob front on the horizon', [0.20, 0.55]],
  [8.0, 11.2, 'the wall arrives', [0.42, 0.62]],
  [11.8, 14.6, 'zero visibility', [0.50, 0.52]],
  [15.2, 18.8, 'the tail drags east', [0.55, 0.46]],
];

export default class DesertstormScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private rig = new CameraRig();
  private layer = new Layer2D(W, H);
  private u = { uT: { value: 0 }, uGi: { value: 0 } };
  private v = new THREE.Vector3();

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(40, ctx.W / ctx.H, 0.1, 400);
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, glslVersion: THREE.GLSL3 }),
    );
    back.position.set(0, PY, PZ);
    this.three.add(back);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;
    this.u.uGi.value = gustIntJS(t);

    // CameraRig: near-static low shot down the road. Slight push through
    // the take; micro shake for ~1.5s when the front arrives (~t 9–12).
    const push = ss(1.5, 17, t);
    const shake = ss(8.6, 9.8, t) * (1 - ss(11.5, 13.0, t));
    this.rig.position = [
      0.3 * Math.sin(t * 0.05) + 0.35 * shake * Math.sin(t * 31.0),
      5.4 + 0.22 * shake * Math.sin(t * 37.0 + 1.0),
      24.0 - 3.0 * push,
    ];
    this.rig.target = [0.4 * Math.sin(t * 0.03), 9.5 + 0.4 * push, PZ];
    this.rig.roll = 0.006 * shake * Math.sin(t * 27.0);
    this.rig.focalLengthPx = (this.ctx.H / 2) / Math.tan(0.5 * 40 * Math.PI / 180);
    this.rig.syncToThreeCamera(this.rig.evalCam(t), this.cam);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    // probe captions (textProbes auto-emit via the main.ts canvas hook)
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
        // ground-anchored captions can project below the canvas — clamp cy
        // like cx so the caption always lands inside the frame
        const cy = Math.min(Math.max((0.5 - ndc.y * 0.5) * H + H * 0.18, 44), H - 44);
        c.save();
        c.globalAlpha = a;
        c.font = `46px "${F.archivo(112, 500)}", sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const tw = c.measureText(text).width;
        const cx = Math.min(Math.max(cx0, tw / 2 + 16), W - tw / 2 - 16);
        c.lineJoin = 'round';
        c.strokeStyle = 'rgba(5, 6, 10, 0.9)';
        c.lineWidth = 12;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#f6ead8';
        c.fillText(text, cx, cy);
        c.restore();
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }

    return {
      exposure: 0.6,
      bloom: 0.35,
      bloomThreshold: 0.70,
      bloomRadius: 0.75,
      ca: 0.09,
      grain: 0.06,
      vignette: 0.45,
      level: ss(0, 0.9, t) * (1 - ss(this.ctx.end - 0.9, this.ctx.end, t)),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.layer.dispose();
    this.three.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}
