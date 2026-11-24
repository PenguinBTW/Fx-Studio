// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// cindercourt — a medieval castle courtyard at dusk. One fullscreen GLSL pass
// holds the shot: a dark sliver of sky over three walls of rough stone, a
// wooden gallery of black arches across the back, worn flagstone paths, and a
// stone well at centre with a rope hanging into it. A wall torch right of the
// well kindles early and throws a flickering warm pool across the flagstones;
// a faint blue window glows upper-left. Banners stir on the parapet in gusts —
// one ripped, trailing. A torch-lit sentry walks the parapet left→right,
// pauses mid-wall, and exits through a doorway glow. A raven lands on the
// well's crossbar once and hops off; a cat crosses the gallery shadow; two
// pigeons drop onto the parapet on the settle beat. All closed-form f(t),
// hash seeds only. CameraRig is near-static and low, drifting slightly up
// the courtyard toward the parapet; Layer2D holds the anchored captions.
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
// courtyard layout in uv
const float SKYTOP = 1.0;      // sky band above the parapet
const float PARAPET = 0.815;   // parapet walk line (sentry's floor)
const float WALLTOP = 0.79;    // top of back wall face
const float GALLERY_Y = 0.545; // gallery arch band centre
const float FLOOR_Y = 0.47;    // where the back wall meets the flagstones
const vec2 WELL = vec2(0.50, 0.335);
const vec2 TORCH = vec2(0.655, 0.575); // wall torch, right of the well
// beats
const float KINDLE = 2.2;    // wall torch catches
const float WALK_IN = 5.0;   // sentry enters the parapet
const float WALK_OUT = 13.4; // sentry exits through the doorway
const float RAVEN_IN = 9.8;  // raven drops to the crossbar
const float RAVEN_OUT = 12.6;
const float CAT = 13.6;      // cat crosses the gallery shadow
const float PIGEONS = 14.4;  // pigeons settle on the parapet

float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x),
             mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y);
}
float fbm2(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vn2(p); p = p * 2.13 + 7.7; a *= 0.5; }
  return s;
}
// descending edges: evaluate on the ordered span and flip — smoothstep
// itself never sees e0 >= e1 (gap clamped too)
float sstep(float e0, float e1, float x) {
  float lo = min(e0, e1);
  float hi = max(e0, e1);
  float m = smoothstep(lo, lo + max(hi - lo, 0.001), x);
  return e0 < e1 ? m : 1.0 - m;
}
float sdist(vec2 p, vec2 c, vec2 r) {
  vec2 q = (p - c) / r;
  return length(q);
}
// distance to segment — ropes, legs, cat body
float dseg(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float k = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(p - a - ab * k);
}
// box mask centred at c with half-extents r
float boxm(vec2 p, vec2 c, vec2 r, float soft) {
  vec2 d = abs(p - c) - r;
  return sstep(soft, -soft, max(d.x, d.y));
}
// gust envelope shared by banners and the torch flame — wind arrives mid-shot
float gust(float t, float ph) {
  return 0.35 + 0.65 * sstep(3.0, 7.0, t) * (0.5 + 0.5 * sin(t * 0.55 + ph))
       * (0.7 + 0.3 * vn2(vec2(t * 0.22, ph)));
}

// sentry x along the parapet — walks in, pauses mid-wall, continues, exits
float sentryX(float t) {
  // pause window: holds position while s in [0.42, 0.58]
  float s = sstep(WALK_IN, WALK_OUT, t);
  float u = s < 0.42 ? s / 0.42 * 0.5
                   : s < 0.58 ? 0.5
                              : 0.5 + (s - 0.58) / 0.42 * 0.5;
  return mix(0.20, 0.80, u); // ends at the doorway's x
}

vec3 skyAt(vec2 uv, float t) {
  // narrow dusk sliver: deep slate top to a last amber seam on the wall tops
  vec3 sky = mix(vec3(0.048, 0.042, 0.065), vec3(0.016, 0.018, 0.036),
                 sstep(WALLTOP + 0.02, SKYTOP, uv.y));
  // seam of remaining warmth right at the parapet line
  sky += vec3(0.22, 0.09, 0.03) * sstep(WALLTOP + 0.045, WALLTOP - 0.01, uv.y)
         * sstep(0.12, 0.55, uv.x) * sstep(0.95, 0.60, uv.x);
  // first stars in the top of the sliver
  if (uv.y > WALLTOP + 0.10) {
    vec2 cell = floor(uv * vec2(70.0, 30.0));
    float sh = h2(cell);
    if (sh > 0.93) {
      vec2 sp = fract(uv * vec2(70.0, 30.0)) - 0.5;
      sky += vec3(0.7, 0.75, 0.9) * sstep(0.05, 0.0, length(sp)) * 0.4;
    }
  }
  return sky;
}

// stone noise for walls and floor — blocky mortar pattern + fbm wear
vec3 stone(vec2 uv, float cellN, vec3 base, float wear) {
  vec2 g = uv * cellN;
  g.x += step(0.5, fract(g.y * 0.5)) * 0.5; // running bond
  vec2 f = abs(fract(g) - 0.5);
  float mortar = sstep(0.46, 0.50, max(f.x, f.y));
  float shade = 0.82 + 0.36 * h2(floor(g)) + wear * fbm2(uv * 40.0);
  return base * shade * mix(1.0, 0.55, mortar * 0.8);
}

vec3 floorAt(vec2 uv, float t, float flick) {
  // flagstones with perspective — rows squeeze toward the wall base
  vec2 q = vec2(uv.x, uv.y);
  float row = floor(q.y * 18.0);
  float px = q.x * (10.5 + row * 0.5); // stones narrow into the distance
  float py = q.y * 18.0;
  vec2 f = abs(fract(vec2(px + mod(row, 2.0) * 0.5, py)) - 0.5);
  float joint = sstep(0.42, 0.50, max(f.x, f.y));
  float shade = 0.7 + 0.5 * h2(vec2(px, py)) + 0.25 * fbm2(uv * 55.0);
  vec3 col = vec3(0.030, 0.028, 0.032) * shade * mix(1.0, 0.45, joint * 0.9);
  // shadow seam where the floor meets the back wall
  col *= mix(0.55, 1.0, sstep(FLOOR_Y - 0.02, FLOOR_Y - 0.10, uv.y));
  // worn walking paths: softened arcs from the gate line toward the well
  float path = sdist(uv, vec2(0.28, -0.05), vec2(0.09, 0.42));
  float path2 = sdist(uv, vec2(0.78, -0.02), vec2(0.08, 0.36));
  col *= 1.0 - 0.25 * sstep(1.0, 0.6, min(path, path2));
  // distance falloff + foreground falls away into dusk
  col *= mix(1.0, 0.55, sstep(FLOOR_Y, 0.0, uv.y));
  col *= mix(0.62, 1.0, sstep(0.0, 0.30, uv.y));
  // torch pool: warm flicker over the flagstones, strongest near the wall base
  float pool = sdist(uv, vec2(TORCH.x - 0.02, FLOOR_Y - 0.06), vec2(0.16, 0.16));
  col += vec3(0.9, 0.45, 0.16) * exp(-pool * pool * 3.2) * 0.5 * flick
         * sstep(FLOOR_Y, FLOOR_Y - 0.30, uv.y);
  return col;
}

// well at courtyard centre: ellipse mouth, drum, posts + little gable,
// crossbar and a rope vanishing into the dark
void wellAt(vec2 uv, float t, inout vec3 col, out float wellMask) {
  wellMask = 0.0;
  // drum: squat stone box with a rim course, dark mouth on top
  float drum = boxm(uv, vec2(WELL.x, WELL.y - 0.035), vec2(0.050, 0.040), 0.004);
  vec3 drumCol = stone(uv, 90.0, vec3(0.085, 0.078, 0.075), 0.2);
  float rim = boxm(uv, vec2(WELL.x, WELL.y + 0.006), vec2(0.056, 0.008), 0.003);
  float mouth = sdist(uv, vec2(WELL.x, WELL.y + 0.008), vec2(0.042 / ASPECT, 0.010));
  // posts rise from the rim to the crossbar
  float pl = boxm(uv, vec2(WELL.x - 0.042, WELL.y + 0.075), vec2(0.0035, 0.068), 0.003);
  float pr = boxm(uv, vec2(WELL.x + 0.042, WELL.y + 0.075), vec2(0.0035, 0.068), 0.003);
  // dark gable roof over the posts — clear silhouette against the wall
  float rx = abs(uv.x - WELL.x);
  float roofY = WELL.y + 0.165 - rx * 1.35;
  float roof = sstep(0.006, -0.004, uv.y - roofY) * sstep(0.058, 0.052, rx)
               * sstep(WELL.y + 0.128, WELL.y + 0.140, uv.y);
  // crossbar + rope down into the mouth
  float bar = dseg(uv, vec2(WELL.x - 0.045, WELL.y + 0.140), vec2(WELL.x + 0.045, WELL.y + 0.140));
  float rope = dseg(uv, vec2(WELL.x + 0.006, WELL.y + 0.140), vec2(WELL.x + 0.012, WELL.y - 0.002));
  col = mix(col, drumCol, drum);
  col = mix(col, vec3(0.12, 0.11, 0.10), rim);
  col = mix(col, vec3(0.008, 0.006, 0.006), sstep(1.0, 0.85, mouth));
  col = mix(col, vec3(0.055, 0.045, 0.038), max(pl, pr));
  col = mix(col, vec3(0.035, 0.028, 0.024), roof);
  col = mix(col, vec3(0.07, 0.058, 0.045), sstep(0.004, 0.001, bar));
  col = mix(col, vec3(0.09, 0.078, 0.06), sstep(0.0025, 0.0008, rope));
  wellMask = max(max(drum, sstep(1.0, 0.85, mouth)), max(max(pl, pr), roof));
}

// a banner strip hanging from the parapet — sways in gusts, ripped ones trail
float bannerAt(vec2 uv, float bx, float len, float rip, float ph, float t) {
  float g = gust(t, ph);
  // sway: horizontal offset grows toward the free end
  float hang = clamp((PARAPET - 0.005 - uv.y) / len, 0.0, 1.0);
  float sway = sin(t * 1.1 * g + ph + hang * (2.2 + 1.8 * g)) * 0.010 * hang * g;
  float w = uv.x - (bx + sway);
  float wHalf = 0.0085 * (1.0 - 0.25 * hang * rip); // ripped narrows toward the tail
  float inW = sstep(wHalf, wHalf - 0.003, abs(w));
  float inL = sstep(0.0, 0.006, hang) * sstep(1.0, 0.985, hang);
  // ragged bite on the ripped tail
  if (rip > 0.5 && hang > 0.55) {
    inL *= sstep(0.02, 0.08, fbm2(vec2(uv.y * 160.0, ph * 9.0)));
  }
  return inW * inL;
}

// a small human silhouette at (x, y) — head + torso + moving legs by phase
float figureAt(vec2 uv, vec2 at, float scale, float legPhase) {
  float head = sdist(uv, at + vec2(0.0, 0.024 * scale), vec2(0.007 / ASPECT, 0.009) * scale);
  float m = sstep(1.0, 0.85, head);
  m = max(m, boxm(uv, at + vec2(0.0, 0.006 * scale), vec2(0.0065, 0.014) * scale, 0.004));
  vec2 hip = at + vec2(0.0, -0.008 * scale);
  float l1 = dseg(uv, hip, hip + vec2(sin(legPhase) * 0.0035, -0.020) * scale);
  float l2 = dseg(uv, hip, hip + vec2(sin(legPhase + 3.14) * 0.0035, -0.020) * scale);
  m = max(m, sstep(0.004, 0.0015, min(l1, l2)));
  return m;
}

// torch-lit sentry walking the parapet line
float sentryAt(vec2 uv, float t) {
  if (t < WALK_IN || t > WALK_OUT) return 0.0;
  float x = sentryX(t);
  float s = sstep(WALK_IN, WALK_OUT, t);
  float walking = (s < 0.42 || s > 0.58) ? 1.0 : 0.0; // paused mid-wall
  float bob = walking * 0.0035 * sin(t * 7.0);
  vec2 at = vec2(x, PARAPET + 0.012 + bob);
  float m = figureAt(uv, at, 1.0, t * 7.0 * walking);
  return m * sstep(WALK_IN, WALK_IN + 0.5, t) * sstep(WALK_OUT, WALK_OUT - 0.4, t);
}

vec3 backWallAt(vec2 uv, float t, float flick) {
  // back wall face: stone, wooden gallery with dark arches, parapet, banners,
  // the blue window glow, torch, doorway glow far right, sentry
  vec3 col = stone(uv, 34.0, vec3(0.058, 0.053, 0.055), 0.3);
  // top edge: last light still catches the wall crown
  col += vec3(0.25, 0.13, 0.06) * sstep(WALLTOP - 0.02, WALLTOP + 0.005, uv.y) * 0.35;
  // gallery beam line + dark arches under it
  float beamY = GALLERY_Y + 0.075;
  col = mix(col, vec3(0.030, 0.020, 0.016), boxm(uv, vec2(0.5, beamY), vec2(0.32, 0.006), 0.003));
  float archX = fract(uv.x * 9.0 + 0.5) - 0.5;
  float archTop = GALLERY_Y + 0.048 - archX * archX * 0.28;
  float inArchBand = sstep(GALLERY_Y - 0.05, GALLERY_Y - 0.04, uv.y) * sstep(archTop, archTop - 0.01, uv.y);
  float archMask = inArchBand * sstep(0.34, 0.30, abs(archX))
                   * sstep(0.16, 0.22, uv.x) * sstep(0.86, 0.80, uv.x);
  col = mix(col, vec3(0.010, 0.008, 0.008), archMask);
  // faint timber posts between arches
  col *= 1.0 - 0.35 * sstep(0.30, 0.34, abs(archX)) * inArchBand * 0.9;
  // blue window glow, upper left on the back wall — slow breath
  float win = boxm(uv, vec2(0.20, 0.70), vec2(0.008, 0.016), 0.004);
  float winGlow = win * (0.7 + 0.3 * sin(t * 0.35 + 2.0));
  col += vec3(0.10, 0.16, 0.28) * winGlow;
  col += vec3(0.05, 0.08, 0.15) * exp(-sdist(uv, vec2(0.20, 0.70), vec2(0.05, 0.06)) * 6.0) * 0.5;
  // doorway glow far right where the sentry exits — opens as he nears
  float doorOpen = sstep(0.70, 0.77, sentryX(t));
  float door = boxm(uv, vec2(0.80, PARAPET - 0.03), vec2(0.010, 0.030), 0.005);
  col += vec3(0.85, 0.50, 0.20) * door * (0.15 + 0.85 * doorOpen);
  // wall torch: bracket, flame and cast light
  float br = dseg(uv, TORCH + vec2(0.0, -0.018), TORCH + vec2(0.006, -0.055));
  col = mix(col, vec3(0.09, 0.06, 0.04), sstep(0.004, 0.001, br));
  float kindle = sstep(KINDLE, KINDLE + 0.5, t);
  float fl = vn2(vec2(t * 6.0, 3.0)) * 0.5 + vn2(vec2(t * 13.0, 9.0)) * 0.5;
  vec2 fp = TORCH + vec2(sin(t * 9.0) * 0.0015 * gust(t, 1.7), 0.010 + 0.004 * fl);
  float flame = sdist(uv, fp, vec2(0.006 / ASPECT, 0.014) * (0.8 + 0.5 * fl));
  col = mix(col, vec3(1.0, 0.62, 0.18) * (0.8 + 0.6 * fl), sstep(1.0, 0.55, flame) * kindle);
  col += vec3(0.95, 0.55, 0.20) * exp(-flame * 1.1) * 0.30 * flick * kindle;
  // cast light on the wall around the torch
  float wash = sdist(uv, vec2(TORCH.x, TORCH.y - 0.05), vec2(0.11, 0.16));
  col += vec3(0.85, 0.42, 0.15) * exp(-wash * wash * 3.0) * 0.35 * flick * kindle;
  // parapet: merlon notches silhouetted on the wall top
  float merlon = step(0.5, fract(uv.x * 12.0));
  float notch = sstep(WALLTOP + 0.004, WALLTOP + 0.030, uv.y) * sstep(PARAPET + 0.055, PARAPET + 0.02, uv.y);
  col = mix(col, vec3(0.030, 0.030, 0.045), notch * merlon);
  // banners on the parapet line — 3 whole + 1 ripped trailing
  float b1 = bannerAt(uv, 0.24, 0.16, 0.0, 0.0, t);
  float b2 = bannerAt(uv, 0.40, 0.13, 0.0, 1.9, t);
  float b3 = bannerAt(uv, 0.585, 0.17, 1.0, 4.1, t); // the ripped one
  float b4 = bannerAt(uv, 0.80, 0.14, 0.0, 2.7, t);
  col = mix(col, vec3(0.19, 0.055, 0.045) * (0.7 + 0.4 * gust(t, 0.0)), b1);
  col = mix(col, vec3(0.06, 0.08, 0.16) * (0.7 + 0.4 * gust(t, 1.9)), b2);
  col = mix(col, vec3(0.17, 0.05, 0.04) * (0.6 + 0.3 * gust(t, 4.1)), b3);
  col = mix(col, vec3(0.07, 0.065, 0.13) * (0.7 + 0.4 * gust(t, 2.7)), b4);
  return col;
}

vec3 sideWallsAt(vec2 uv, float t, vec3 col, float flick) {
  // left and right walls recede from the frame edges to the back wall —
  // same stone, darker with depth, a hint of the torch's reach on the right
  float lw = sstep(0.185, 0.14, uv.x) * sstep(FLOOR_Y - 0.03, FLOOR_Y + 0.02, uv.y);
  float rw = sstep(0.815, 0.86, uv.x) * sstep(FLOOR_Y - 0.03, FLOOR_Y + 0.02, uv.y);
  float wallTopL = WALLTOP - (0.19 - uv.x) * 0.32;
  float wallTopR = WALLTOP - (uv.x - 0.81) * 0.30;
  lw *= sstep(wallTopL, wallTopL - 0.03, uv.y);
  rw *= sstep(wallTopR, wallTopR - 0.03, uv.y);
  vec3 wcol = stone(uv, 26.0, vec3(0.048, 0.044, 0.048), 0.35);
  float depth = sstep(0.185, 0.02, uv.x) + sstep(0.815, 0.98, uv.x);
  wcol *= mix(1.0, 0.5, clamp(depth, 0.0, 1.0));
  wcol += vec3(0.8, 0.4, 0.14) * rw * exp(-sdist(uv, TORCH, vec2(0.16, 0.20)) * 5.0) * 0.3 * flick;
  return mix(col, wcol, max(lw, rw));
}

void main() {
  vec2 uv = vUv;
  float t = uT;
  // shared torch flicker signal
  float kindle = sstep(KINDLE, KINDLE + 0.5, t);
  float flick = (0.72 + 0.28 * vn2(vec2(t * 7.0, 5.0))) * kindle;

  vec3 col = skyAt(uv, t);
  // ---- geometry stack ----
  if (uv.y < WALLTOP + 0.10 && uv.y > FLOOR_Y - 0.05) {
    col = sideWallsAt(uv, t, col, flick);
  }
  if (uv.y > FLOOR_Y - 0.02 && uv.y < WALLTOP + 0.035 &&
      uv.x > 0.14 && uv.x < 0.86) {
    col = backWallAt(uv, t, flick);
  }
  // flagstones
  if (uv.y < FLOOR_Y + 0.005) {
    col = floorAt(uv, t, flick);
  }

  // ---- well ----
  float wellMask;
  wellAt(uv, t, col, wellMask);

  // ---- raven on the well crossbar ----
  if (t > RAVEN_IN && t < RAVEN_OUT) {
    float hop = abs(sin(t * 3.2)) * 0.004 * sstep(RAVEN_IN + 2.0, RAVEN_IN + 3.0, t);
    vec2 rp = vec2(WELL.x - 0.018 + 0.006 * floor(sin(t * 1.6) + 0.5), WELL.y + 0.152 + hop);
    float body = sdist(uv, rp, vec2(0.007 / ASPECT, 0.010));
    float head = sdist(uv, rp + vec2(0.006, 0.010), vec2(0.0045 / ASPECT, 0.005));
    float tail = dseg(uv, rp, rp + vec2(-0.011, 0.014));
    float raven = max(sstep(1.0, 0.8, min(body, head)), sstep(0.0035, 0.0015, tail));
    raven *= sstep(RAVEN_IN, RAVEN_IN + 0.15, t) * sstep(RAVEN_OUT, RAVEN_OUT - 0.15, t);
    col = mix(col, vec3(0.012, 0.010, 0.014), raven);
  }
  // raven flight silhouettes on the way in/out (two short arcs)
  if (t > RAVEN_IN - 0.7 && t < RAVEN_IN + 0.15) {
    float u = (t - (RAVEN_IN - 0.7)) / 0.85;
    vec2 fp = mix(vec2(0.80, PARAPET + 0.06), vec2(WELL.x - 0.015, WELL.y + 0.14),
                  u + 0.15 * sin(u * 3.14));
    float wings = sstep(1.0, 0.55, sdist(uv, fp + vec2(0.0, abs(sin(u * 18.0)) * 0.006),
                    vec2(0.012 / ASPECT, 0.006)));
    wings *= 1.0 - sstep(RAVEN_IN - 0.05, RAVEN_IN + 0.12, t); // dissolve into the perched bird
    col = mix(col, vec3(0.012, 0.010, 0.014), wings);
  }

  // ---- sentry + his torch ----
  float sent = sentryAt(uv, t);
  col = mix(col, vec3(0.012, 0.010, 0.012), sent);
  // the torch he carries: a bright dot above and ahead of him — drawn outside
  // the silhouette gate so the flame shows against the sky band
  if (t > WALK_IN && t < WALK_OUT) {
    float s = sentryX(t);
    vec2 tp = vec2(s + 0.012, PARAPET + 0.052 + 0.002 * sin(t * 9.0));
    float dot2 = sdist(uv, tp, vec2(0.009 / ASPECT, 0.011));
    float flameOn = sstep(WALK_IN, WALK_IN + 0.4, t) * sstep(WALK_OUT, WALK_OUT - 0.3, t);
    float sglow = sstep(1.0, 0.4, dot2) * flameOn;
    col = mix(col, vec3(1.0, 0.72, 0.30), sglow);
    col += vec3(0.95, 0.55, 0.20) * exp(-dot2 * 0.9) * 0.45 * flameOn;
  }

  // ---- cat crossing the gallery shadow ----
  if (t > CAT && t < CAT + 2.4) {
    float u = (t - CAT) / 2.4;
    float cx = mix(0.30, 0.72, u);
    float cy = GALLERY_Y - 0.058 + abs(sin(u * 9.42)) * 0.004; // padding gait
    float cbody = sdist(uv, vec2(cx, cy), vec2(0.014 / ASPECT, 0.0065));
    float chead = sdist(uv, vec2(cx + 0.013, cy + 0.005), vec2(0.005 / ASPECT, 0.0045));
    float ctail = dseg(uv, vec2(cx - 0.012, cy), vec2(cx - 0.024, cy + 0.010));
    float cat = max(sstep(1.0, 0.8, min(cbody, chead)), sstep(0.0028, 0.001, ctail));
    col = mix(col, vec3(0.008, 0.007, 0.008), cat);
  }

  // ---- pigeons settling on the parapet on the settle beat ----
  if (t > PIGEONS) {
    for (int i = 0; i < 2; i++) {
      float fi = float(i);
      float land = PIGEONS + fi * 0.9;
      float u = clamp((t - land) / 1.2, 0.0, 1.0);
      vec2 from = vec2(0.90 - fi * 0.06, PARAPET + 0.16);
      vec2 to = vec2(0.66 + fi * 0.07, PARAPET + 0.023); // perch on the merlon tops
      vec2 pp = mix(from, to, u + 0.12 * sin(u * 3.14));
      float puff = u < 1.0 ? abs(sin(t * 14.0)) * 0.5 + 0.5 : 1.0;
      float b = sdist(uv, pp, vec2(0.006 / ASPECT, 0.007) * puff);
      // lighter than the merlon silhouette so the birds read on the walk
      col = mix(col, vec3(0.11, 0.10, 0.11), sstep(1.0, 0.7, b));
    }
  }

  // vignette-darkened corners of the courtyard
  col *= 1.0 - 0.30 * sdist(uv, vec2(0.5, 0.5), vec2(0.75, 0.85));
  fragColor = vec4(col, 1.0);
}
`;

// shader uv to world space for caption anchoring.
const PW = 320, PH = 140, PZ = -80, PY = 8;
const uv2w = (u: number, v: number): [number, number] => [
  (u - 0.5) * PW,
  PY + (v - 0.5) * PH,
];

const CAPTIONS: Array<[number, number, string, [number, number]]> = [
  [0.8, 3.4, 'the courtyard keeps its own hours', [0.5, 0.30]],
  [4.2, 6.6, 'a torch wakes on the wall', [0.5, 0.26]],
  [7.4, 9.6, 'the watch makes its round', [0.5, 0.30]],
  [10.2, 12.4, 'a raven takes the crossbar', [0.5, 0.24]],
  [14.6, 17.2, 'even the birds settle early here', [0.5, 0.30]],
];

export default class CindercourtScene extends Scene {
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
      sentryWalk: t >= 5.0 && t <= 13.4 ? 1 : 0,
      raven: t >= 9.8 && t <= 12.6 ? 1 : 0,
      settle: t >= 14.4 && t <= 17.6 ? 1 : 0,
    };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    // CameraRig: near-static, low — a slight drift up the courtyard toward
    // the parapet as the sentry walks, easing back on the settle.
    const lift = ss(5.0, 13.0, t) * (1 - ss(15.5, 17.5, t));
    this.rig.position = [
      0.4 * Math.sin(t * 0.04),
      3.0 + 2.6 * lift + 0.3 * Math.sin(t * 0.05 + 1.0),
      76.0 - 2.0 * ss(9.8, 10.6, t) * (1 - ss(12.2, 13.0, t)),
    ];
    this.rig.target = [
      0.2 * Math.sin(t * 0.045),
      8.0 + 1.6 * lift,
      PZ,
    ];
    this.rig.roll = 0.002 * Math.sin(t * 0.05);
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
        c.strokeStyle = 'rgba(6, 8, 14, 0.85)';
        c.lineWidth = 12;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#e8ecf4';
        c.fillText(text, cx, cy);
        c.restore();
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }

    return {
      exposure: 0.9,
      bloom: 0.35,
      bloomThreshold: 0.68,
      bloomRadius: 0.75,
      ca: 0.08,
      grain: 0.08,
      vignette: 0.52,
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
