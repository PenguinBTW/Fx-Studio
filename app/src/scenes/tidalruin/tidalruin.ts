// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// tidalruin — the broken remains of a sea-washed fort on a tidal flat, the
// tide coming in. One fullscreen GLSL pass holds the shot: a pale grey-green
// sky over a distant sea band, then a wide wet-sand flat cut by winding
// channels, and the ruin at centre — a lone arch, two tower stumps, fallen
// blocks with a barnacle-dark band at their bases. A thin waterline creeps in
// from the right, filling the channels first, then glossing the sand until
// the ruin stands in a shallow mirror. A gull sits the arch top; a crow hops
// on a fallen block once; far out a fisherman drags a line; a heron walks the
// channel, freezes, stabs; sanderlings skitter ahead of the waterline. All
// closed-form f(t), hash seeds only. CameraRig is low and near-static with a
// slight drift along the channel direction; Layer2D holds anchored captions.
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
// layout in uv — a low horizon keeps most of the frame on the flat
const float SKYBASE = 0.62;   // sky meets the sea band
const float SEABASE = 0.575;  // sea band meets the flat
const float FLAT_TOP = 0.575; // far edge of the tidal flat
const float RUIN_BASE = 0.545; // ground line the ruin stands on
// beats
const float WATER_IN = 4.0;   // the waterline starts its creep
const float CHANNEL_FILL = 8.0;  // channels take water early
const float COVER = 13.0;     // the flat glosses over
const float CROW = 7.5;       // crow hops on the fallen block
const float HERON = 10.5;     // heron walks the channel
const float SETTLE = 15.0;    // still mirror

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
// distance to segment — ropes, legs, masts
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

// ---- the incoming tide: a waterline creeping right→left across the flat ----
float wlX(float t) {
  return mix(1.18, 0.56, sstep(WATER_IN, COVER, t));
}
// coverage 0..1 — water sits right of the front; channels wet early
float waterAt(vec2 uv, float t, float chan) {
  float wl = wlX(t) + 0.045 * sin(uv.y * 9.0 + 1.3) + 0.02 * sin(uv.y * 23.0);
  float cov = sstep(wl - 0.006, wl + 0.010, uv.x);
  // channels fill first — their interior turns wet well ahead of the front
  cov = max(cov, chan * sstep(CHANNEL_FILL, CHANNEL_FILL + 4.0, t));
  // by the settle beat the whole flat is a shallow mirror
  cov = max(cov, sstep(COVER, SETTLE + 1.5, t));
  return cov * sstep(FLAT_TOP + 0.01, FLAT_TOP - 0.01, uv.y);
}

// ---- winding channels: S-curved bands carved through the sand ----
float channelAt(vec2 uv) {
  // two meanders, darker-wet centres; only inside the flat band
  float c1 = uv.x - (0.30 + 0.10 * sin(uv.y * 14.0 + 0.8) + 0.04 * sin(uv.y * 31.0));
  float c2 = uv.x - (0.62 + 0.12 * sin(uv.y * 11.0 + 2.6) + 0.05 * sin(uv.y * 27.0 + 1.0));
  float w1 = 0.016 + 0.010 * sstep(0.30, 0.58, uv.y); // channels widen seaward
  float w2 = 0.020 + 0.012 * sstep(0.28, 0.58, uv.y);
  float m = sstep(w1, w1 - 0.008, abs(c1)) + sstep(w2, w2 - 0.010, abs(c2));
  return clamp(m, 0.0, 1.0) * sstep(FLAT_TOP + 0.005, FLAT_TOP - 0.03, uv.y);
}

// ---- the ruin: arch, two tower stumps, fallen blocks — one silhouette ----
vec2 RUIN = vec2(0.50, RUIN_BASE);
float archAt(vec2 uv) {
  // partial arch mid-frame: two legs and a broken ring — stands on the base
  float legL = boxm(uv, vec2(RUIN.x - 0.020, RUIN_BASE + 0.055), vec2(0.010, 0.055), 0.003);
  float legR = boxm(uv, vec2(RUIN.x + 0.020, RUIN_BASE + 0.055), vec2(0.010, 0.055), 0.003);
  // arch ring: outer ellipse minus inner opening, sitting on the legs
  vec2 c = vec2(RUIN.x, RUIN_BASE + 0.082);
  float outer = sdist(uv, c, vec2(0.040 / ASPECT, 0.046));
  float inner = sdist(uv, c, vec2(0.021 / ASPECT, 0.028));
  float ring = sstep(1.0, 0.96, outer) * sstep(0.96, 1.0, inner);
  ring *= sstep(RUIN_BASE + 0.060, RUIN_BASE + 0.066, uv.y); // only above leg tops
  // broken crown: bite off the upper right of the ring
  ring *= sstep(0.0, 0.05, (uv.x - RUIN.x) * 2.6 - (RUIN_BASE + 0.112 - uv.y));
  return max(max(legL, legR), ring);
}
float towersAt(vec2 uv) {
  // left stump taller, right stump lower and ragged — tapered tops
  float l = boxm(uv, vec2(RUIN.x - 0.105, RUIN_BASE + 0.060), vec2(0.017, 0.060), 0.003);
  l *= sstep(RUIN_BASE + 0.120, RUIN_BASE + 0.085, uv.y + 0.04 * vn2(vec2(uv.x * 300.0, 1.0)));
  float r = boxm(uv, vec2(RUIN.x + 0.115, RUIN_BASE + 0.042), vec2(0.019, 0.042), 0.003);
  r *= sstep(RUIN_BASE + 0.084, RUIN_BASE + 0.055, uv.y + 0.035 * vn2(vec2(uv.x * 320.0, 2.0)));
  return max(l, r);
}
float blocksAt(vec2 uv) {
  // collapsed blocks scattered at the ruin's feet — 5 seeded leaning slabs
  float m = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 bp = vec2(RUIN.x - 0.15 + 0.075 * fi + 0.02 * (h1(fi * 7.1) - 0.5),
                   RUIN_BASE - 0.010 + 0.012 * h1(fi * 3.3));
    vec2 half_ = vec2(0.012 + 0.008 * h1(fi * 5.7), 0.010 + 0.006 * h1(fi * 9.2));
    float tilt = (h1(fi * 11.9) - 0.5) * 0.5;
    vec2 q = uv - bp;
    q = vec2(q.x * cos(tilt) - q.y * sin(tilt), q.x * sin(tilt) + q.y * cos(tilt));
    m = max(m, boxm(q, vec2(0.0), half_, 0.003));
  }
  return m;
}
float ruinMask(vec2 uv) {
  return max(archAt(uv), max(towersAt(uv), blocksAt(uv)));
}

// stone shading for the ruin — grey with a barnacle-dark band at the bases
vec3 ruinColAt(vec2 uv, float m) {
  vec3 base = vec3(0.150, 0.155, 0.150) * (0.8 + 0.4 * h2(floor(uv * vec2(240.0, 160.0))));
  base *= 0.9 + 0.3 * fbm2(uv * 60.0);
  // barnacle / algae band hugging the waterline of the stones
  float barn = sstep(RUIN_BASE + 0.024, RUIN_BASE + 0.004, uv.y);
  base = mix(base, vec3(0.045, 0.055, 0.050), barn * 0.85);
  // raking sun from the left: warm rim on the left edge of the stones
  float rimL = sstep(0.003, -0.002, uv.x - (RUIN.x - 0.122)) * m;
  base += vec3(0.30, 0.20, 0.09) * rimL;
  return base;
}

vec3 skyAt(vec2 uv, float t) {
  // pale grey-green polar light; a low warm smear where the sun rakes in
  vec3 sky = mix(vec3(0.30, 0.34, 0.33), vec3(0.20, 0.24, 0.26),
                 sstep(SEABASE, 1.0, uv.y));
  sky += vec3(0.30, 0.18, 0.08) * exp(-sdist(uv, vec2(0.10, 0.66), vec2(0.30, 0.10)) * 3.0);
  return sky;
}

vec3 seaAt(vec2 uv, float t, vec3 col) {
  // distant sea band: slightly darker than sky with faint white-crest lines
  vec3 sea = vec3(0.16, 0.20, 0.21) * (0.9 + 0.2 * vn2(vec2(uv.x * 60.0, uv.y * 80.0)));
  float crest = sstep(0.0035, 0.001, abs(uv.y - (SEABASE + 0.012 + 0.004 * sin(uv.x * 90.0 + t * 0.5))))
              + 0.6 * sstep(0.0030, 0.0008, abs(uv.y - (SEABASE + 0.032 + 0.004 * sin(uv.x * 70.0 - t * 0.4))));
  sea += vec3(0.55, 0.60, 0.60) * crest * 0.5;
  return mix(col, sea, sstep(SEABASE + 0.004, SEABASE - 0.004, uv.y));
}

vec3 sandAt(vec2 uv, float t, float chan, float cov) {
  // wet tidal flat: dark wet sand with a raking sheen and ripple marks
  vec3 sand = vec3(0.195, 0.185, 0.165);
  sand *= 0.85 + 0.30 * fbm2(uv * vec2(28.0, 90.0)); // rippled bands across the flat
  // sheen toward the raking sun left — brighter on the wet face
  sand += vec3(0.30, 0.22, 0.10) * exp(-sdist(uv, vec2(0.06, uv.y), vec2(0.28, 0.30)) * 2.6) * 0.8;
  // channels read as dark wet seams even before they fill
  sand = mix(sand, vec3(0.10, 0.115, 0.11), chan * 0.55);
  // far-flat perspective darkening toward the sea band
  sand *= mix(1.0, 0.78, sstep(0.20, FLAT_TOP, uv.y));
  return sand;
}

vec3 waterColAt(vec2 uv, float t) {
  // shallow covering water: sky-reflecting pale sheet, shimmer streaks
  vec3 w = mix(vec3(0.24, 0.28, 0.28), vec3(0.17, 0.21, 0.22),
               sstep(0.0, FLAT_TOP, uv.y));
  w *= 0.92 + 0.16 * vn2(vec2(uv.x * 90.0 + t * 0.6, uv.y * 140.0));
  w += vec3(0.20, 0.24, 0.24) * sstep(0.985, 1.0, vn2(vec2(uv.x * 160.0 - t * 1.2, uv.y * 300.0)));
  return w;
}

void main() {
  vec2 uv = vUv;
  float t = uT;

  // ---- sky / sea / sand stack ----
  vec3 col = skyAt(uv, t);
  if (uv.y < SKYBASE && uv.y > FLAT_TOP - 0.01) {
    col = seaAt(uv, t, col);
  }
  float chan = channelAt(uv);
  float cov = waterAt(uv, t, chan);
  if (uv.y < FLAT_TOP + 0.005) {
    col = sandAt(uv, t, chan, cov);
  }

  // ---- the waterline itself: a bright glowing front where it meets the light ----
  float wl = wlX(t) + 0.045 * sin(uv.y * 9.0 + 1.3) + 0.02 * sin(uv.y * 23.0);
  float front = sstep(0.006, 0.001, abs(uv.x - wl));
  col += vec3(0.45, 0.42, 0.30) * front * 0.7 * sstep(WATER_IN, WATER_IN + 1.0, t)
         * sstep(FLAT_TOP, FLAT_TOP - 0.06, uv.y);
  // foam flecks riding just behind the front
  float fleck = sstep(0.96, 0.995, h2(floor(uv * vec2(900.0, 400.0)) + floor(t * 2.0)));
  col += vec3(0.40, 0.44, 0.42) * fleck * sstep(wl - 0.002, wl + 0.05, uv.x) * sstep(wl + 0.09, wl + 0.02, uv.x)
         * sstep(WATER_IN, WATER_IN + 1.0, t) * sstep(FLAT_TOP, FLAT_TOP - 0.05, uv.y) * 0.5;

  // covering water over the sand first, then the ruin, then its reflection
  col = mix(col, waterColAt(uv, t), cov * sstep(FLAT_TOP, FLAT_TOP - 0.02, uv.y));
  float rm = ruinMask(uv);
  vec3 rcol = ruinColAt(uv, rm);
  // covered ruin bases read darker through the water
  rcol = mix(rcol, rcol * 0.55, cov * sstep(RUIN_BASE + 0.02, RUIN_BASE - 0.01, uv.y));
  col = mix(col, rcol, rm);
  // reflection: the same silhouette flipped about the ruin's base, smeared —
  // drawn after the water sheet so it rides on top of it
  if (cov > 0.0 && uv.y < RUIN_BASE) {
    vec2 ruv = vec2(uv.x, 2.0 * RUIN_BASE - uv.y);
    ruv.x += 0.004 * sin(uv.y * 220.0 + t * 2.0); // shimmer wobble
    float refl = ruinMask(ruv) * sstep(RUIN_BASE - 0.20, RUIN_BASE - 0.01, uv.y);
    col = mix(col, vec3(0.075, 0.085, 0.085), refl * 0.55 * cov);
  }

  // ---- gull perched on the arch top — a still speck until the settle ----
  {
    vec2 gp = vec2(RUIN.x - 0.020, RUIN_BASE + 0.134);
    float gull = sstep(1.0, 0.7, sdist(uv, gp, vec2(0.005 / ASPECT, 0.006)));
    gull = max(gull, sstep(1.0, 0.7, sdist(uv, gp + vec2(0.004, 0.005), vec2(0.003 / ASPECT, 0.0035))));
    col = mix(col, vec3(0.75, 0.78, 0.78), gull * 0.9);
  }

  // ---- crow hopping on a fallen block, once ----
  if (t > CROW && t < CROW + 2.6) {
    float u = (t - CROW) / 2.6;
    vec2 bp = vec2(RUIN.x + 0.085, RUIN_BASE + 0.035);
    float hop = abs(sin(u * 6.28)) * 0.012 * sstep(0.2, 0.4, u) * sstep(1.0, 0.8, u);
    vec2 cp = bp + vec2(0.006 * floor(u * 3.0), hop);
    float crow = sstep(1.0, 0.7, sdist(uv, cp, vec2(0.006 / ASPECT, 0.007)));
    crow = max(crow, sstep(1.0, 0.7, sdist(uv, cp + vec2(0.005, 0.006), vec2(0.0035 / ASPECT, 0.004))));
    col = mix(col, vec3(0.015, 0.014, 0.016), crow * sstep(CROW, CROW + 0.3, t) * sstep(CROW + 2.6, CROW + 2.3, t));
  }

  // ---- fisherman far out on the flat, dragging a line ----
  {
    float fx = 0.22 + 0.015 * sstep(2.0, 17.0, t); // inches along over the shot
    vec2 fp = vec2(fx, 0.540);
    float fig = boxm(uv, fp + vec2(0.0, 0.020), vec2(0.0035, 0.020), 0.002);
    fig = max(fig, sstep(1.0, 0.7, sdist(uv, fp + vec2(0.0, 0.044), vec2(0.004 / ASPECT, 0.005))));
    float line = dseg(uv, fp + vec2(0.0, 0.012), fp + vec2(-0.045, -0.004));
    col = mix(col, vec3(0.05, 0.055, 0.055), max(fig, sstep(0.0018, 0.0006, line)));
    // a second speck — his shadowed reflection on the wet sand
    col = mix(col, vec3(0.09, 0.095, 0.09), fig * sstep(fp.y, fp.y - 0.03, uv.y) * 0.4);
  }

  // ---- heron walking the channel, freezes, stabs ----
  if (t > HERON && t < HERON + 4.5) {
    float u = (t - HERON) / 4.5;
    float walkU = u < 0.35 ? u / 0.35 : u < 0.75 ? 1.0 : 1.0 + (u - 0.75) / 0.25 * 0.15;
    vec2 hp = vec2(0.585 + 0.030 * walkU, 0.470 - 0.006 * walkU);
    float stab = sstep(0.72, 0.80, u) * sstep(1.0, 0.88, u);
    vec2 neck = hp + vec2(0.006 + 0.020 * stab, 0.030 - 0.018 * stab);
    float heron = boxm(uv, hp + vec2(0.0, 0.012), vec2(0.005, 0.012), 0.002);
    heron = max(heron, sstep(0.0035, 0.0012, dseg(uv, hp + vec2(0.0, 0.022), neck)));
    heron = max(heron, sstep(1.0, 0.7, sdist(uv, neck + vec2(0.004, 0.002), vec2(0.0035 / ASPECT, 0.004))));
    col = mix(col, vec3(0.10, 0.11, 0.11), heron * sstep(HERON, HERON + 0.4, t) * sstep(HERON + 4.5, HERON + 4.1, t));
  }

  // ---- sanderling cluster skittering ahead of the waterline ----
  if (t > WATER_IN - 0.5 && t < SETTLE + 1.0) {
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      float dart = h1(fi * 13.7 + floor(t * 1.4)) - 0.5; // tiny hops along the front
      vec2 sp = vec2(wl - 0.035 - 0.02 * h1(fi * 5.1), 0.30 + 0.20 * h1(fi * 9.3) + 0.010 * dart);
      float bird = sstep(1.0, 0.6, sdist(uv, sp, vec2(0.0028 / ASPECT, 0.0032)));
      col = mix(col, vec3(0.06, 0.065, 0.06), bird);
    }
  }

  // gentle vignette — the flat should feel wide, not boxed
  col *= 1.0 - 0.22 * sdist(uv, vec2(0.5, 0.45), vec2(0.8, 0.9));
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
  [0.8, 3.6, 'the sea keeps what it broke', [0.5, 0.26]],
  [4.4, 6.8, 'the tide writes itself in', [0.5, 0.24]],
  [8.4, 10.4, 'the channels remember first', [0.5, 0.26]],
  [11.4, 13.8, 'one bird walks the water', [0.5, 0.30]],
  [15.2, 17.4, 'a mirror for the ruin', [0.5, 0.24]],
];

export default class TidalruinScene extends Scene {
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
      waterline: t >= 4.0 && t <= 13.0 ? 1 : 0,
      heron: t >= 10.5 && t <= 15.0 ? 1 : 0,
      mirror: t >= 15.0 && t <= 17.8 ? 1 : 0,
    };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    // CameraRig: low, near-static — a slight drift along the channel's
    // direction (right→left, the way the water comes in) and a small lift as
    // the flat turns to mirror.
    const drift = ss(4.0, 16.0, t);
    this.rig.position = [
      -3.2 * drift + 0.4 * Math.sin(t * 0.05),
      4.2 + 1.2 * ss(13.0, 17.0, t) + 0.25 * Math.sin(t * 0.06 + 1.0),
      76.0 - 1.5 * ss(14.5, 16.5, t),
    ];
    this.rig.target = [
      -6.0 * drift + 0.3 * Math.sin(t * 0.045),
      12.0 + 0.8 * ss(13.0, 17.0, t),
      PZ,
    ];
    this.rig.roll = 0.0015 * Math.sin(t * 0.05);
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
        c.strokeStyle = 'rgba(14, 18, 18, 0.85)';
        c.lineWidth = 12;
        c.strokeText(text, cx, cy);
        c.fillStyle = '#eef1ef';
        c.fillText(text, cx, cy);
        c.restore();
      }
      this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 });
    }

    return {
      exposure: 1.0,
      bloom: 0.3,
      bloomThreshold: 0.72,
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
