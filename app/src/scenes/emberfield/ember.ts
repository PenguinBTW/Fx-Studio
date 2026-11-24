// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// emberfield (~20 s): embers rising off a smoldering seam at night — a low
// ridgeline of glowing coals. ~150 hash-seeded motes drift upward on closed-
// form paths (rise + wander + fade lifetime as pure f(ember, t)); they pulse
// hot near the bed and cool as they climb; a crackle burst near t=14 scatters
// bright sparks. One restrained cold accent: a faint star field up high.
//
// Determinism: every ember position/brightness is evaluated analytically
// from (seed, t) — births, lifetimes and crackle flashes are all fixed
// constants of the seed. No Math.random, no accumulators.

import * as THREE from 'three';
import { Scene, Frame, SceneCtx, PostOverrides } from '../../engine/scene';
import { FSPass, W, H } from '../../engine/gl';

const END = 20.0;

const FRAG = /* glsl */ `
uniform float uT;
uniform vec2 uRes;
uniform float uFade;

const int EMBERS = 150;
const int STARS = 22;
const float RIDGE = 0.24;

// --- narrative envelopes ---------------------------------------------

// gust: sideways shear that builds near t≈8 and relaxes by t≈12.5
float gust(float t) {
  return smoothstep(6.0, 8.5, t) * (1.0 - smoothstep(10.5, 12.5, t));
}

// crackle burst: a gaussian flash window centred on t=14
float burstEnv(float t) {
  float d = (t - 14.0) / 0.85;
  return exp(-d * d);
}

// --- terrain ----------------------------------------------------------

// low ridge of smoldering coals — gentle ridge + sharper char detail
float ridgeY(float x) {
  float ridge = fbm(vec2(x * 2.0, 3.7), 4) * 0.05;
  float char2 = abs(sin(x * 83.0 + fbm(vec2(x * 9.0, 1.3), 3) * 7.0));
  return RIDGE + ridge + pow(char2, 3.0) * 0.022;
}

// seam emissivity along the ridge: patchy glowing coal segments that
// breathe slowly (fbm gate + a slow global pulse)
float seamGlow(float x, float t) {
  float seg = fbm(vec2(x * 9.0, 4.4), 4);          // which segments are live
  seg = smoothstep(0.42, 0.62, seg);
  float pulse = 0.72 + 0.28 * sin(t * 0.6 + fbm(vec2(x * 6.0, 9.1), 3) * 9.0);
  return seg * pulse;
}

vec3 skyGrad(vec2 p) {
  vec3 c = mix(vec3(0.008, 0.010, 0.018), vec3(0.022, 0.026, 0.045),
               1.0 - smoothstep(0.35, 1.0, p.y));
  // faint warm wash climbing from the seam
  c += vec3(0.045, 0.022, 0.006) * (1.0 - smoothstep(0.26, 0.55, p.y))
       * smoothstep(0.14, 0.26, p.y);
  return c;
}

void main() {
  vec2 p = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  float t = uT;
  float g = gust(t);
  float crackle = burstEnv(t);

  vec3 c = skyGrad(p);

  // --- faint star field high in frame (the one cold accent) ---
  for (int i = 0; i < STARS; i++) {
    vec2 sp = vec2(hash11(float(i) * 13.7), 0.68 + 0.30 * hash11(float(i) * 29.1));
    vec2 d = (p - sp) * vec2(aspect, 1.0);
    float tw = 0.5 + 0.5 * sin(t * (0.25 + 0.35 * hash11(float(i) * 7.7)) + float(i));
    float s = 1.0 - smoothstep(0.0, 0.0022 + 0.0010 * hash11(float(i) * 3.3), length(d));
    c += vec3(0.70, 0.78, 0.95) * s * 0.075 * (0.4 + 0.6 * tw);
  }

  // --- ground + smolder seam ---
  float ry = ridgeY(p.x);
  float below = 1.0 - smoothstep(ry - 0.002, ry + 0.002, p.y);
  vec3 ground = vec3(0.020, 0.018, 0.016)
              + fbm(p * vec2(26.0, 14.0), 3) * vec3(0.012);
  // warm bounce climbing a few pixels above the seam
  float warmBand = exp(-abs(p.y - ry) * 60.0);
  float sg = seamGlow(p.x, t);
  vec3 seamCol = mix(vec3(0.35, 0.10, 0.02), vec3(1.0, 0.55, 0.18), sg);
  ground += seamCol * warmBand * (0.25 + 0.75 * sg);
  // hot pinpricks right on the ridge crest
  float prick = smoothstep(0.90, 1.0, fbm(vec2(p.x * 160.0, ry * 40.0), 3))
              * (1.0 - smoothstep(0.0, 0.012, abs(p.y - ry)));
  ground += vec3(1.0, 0.72, 0.30) * prick * 1.6;
  c = mix(c, ground, below);
  // seam glow also reaches a little above the ridgeline
  c += seamCol * sg * exp(-(p.y - ry) * 34.0) * (1.0 - below) * 0.55;

  // --- smoke haze: fbm veil lifting off the seam, lit warm underneath ---
  vec2 hp = vec2(p.x * 3.0 + t * 0.02, p.y * 1.6 - t * 0.045);
  float haze = fbm(hp, 4) * (1.0 - smoothstep(ry + 0.05, ry + 0.34, p.y))
             * smoothstep(ry - 0.02, ry + 0.06, p.y);
  c += vec3(0.10, 0.09, 0.085) * haze * 0.5;                       // grey body
  c += vec3(0.30, 0.13, 0.03) * haze * exp(-(p.y - ry) * 10.0);    // warm under-light

  // --- embers ---------------------------------------------------------
  for (int i = 0; i < EMBERS; i++) {
    float fi = float(i);
    float seed = fi * 7.23;

    // ~30% crackle-burst embers born 13.2–14.2 s (short, bright, fast);
    // the steady population is born 0.4–12 s, and ~12% of those are late
    // stragglers born 14.6–17.2 s so a few motes still drift at t=18
    bool burst = hash11(seed + 4.1) > 0.70;
    float bsel = hash11(seed + 0.3);
    float birth = burst
      ? 13.2 + 1.0 * bsel
      : (bsel > 0.88 ? 14.6 + 2.6 * hash11(seed + 9.4)
                     : 0.4 + 11.6 * bsel);
    float life = burst
      ? 1.3 + 1.0 * hash11(seed + 1.1)
      : 2.4 + 2.8 * hash11(seed + 1.1);
    float age = t - birth;
    if (age < 0.0 || age > life) continue;
    float u = age / life;

    float x0 = 0.06 + 0.88 * hash11(seed + 2.0);
    float baseY = ridgeY(x0) + 0.004;

    // closed-form rise: decelerating climb + growing wander + gust shear
    float v0 = (burst ? 0.16 : 0.085) + (burst ? 0.14 : 0.10) * hash11(seed + 3.0);
    float rise = v0 * age * (1.0 - 0.28 * u);
    float wander = 0.012 * sin(t * (1.1 + 0.9 * hash11(seed + 5.0)) + seed)
                 * (0.25 + u);
    float shear = g * 0.06 * (rise / 0.25);
    // burst sparks scatter sideways as well as up
    float scatter = burst ? (hash11(seed + 6.0) - 0.5) * 0.14 * min(age, 1.2) : 0.0;
    vec2 ep = vec2(x0 + wander + shear + scatter, baseY + rise);
    if (ep.y < baseY || ep.x < -0.02 || ep.x > 1.02) continue;

    // heat: bone-white near the bed, orange mid-flight, dim red at fade
    float heat = exp(-2.6 * u);
    vec3 ecol = mix(vec3(0.32, 0.30, 0.30),              // ash grey (dying)
                    mix(vec3(0.85, 0.18, 0.02),          // dim red
                        vec3(1.0, 0.62, 0.22), heat),    // ember orange
                    smoothstep(0.05, 0.5, heat));

    // intensity: fade in fast, out slow; per-ember flicker; crackle flash
    float amp = smoothstep(0.0, 0.05, u) * (1.0 - smoothstep(0.72, 1.0, u));
    float flick = 0.62 + 0.38 * sin(t * (6.0 + 5.0 * hash11(seed + 7.0)) + seed * 3.1);
    // occasional spark crackle — flash window loosens during the burst
    float th = 0.986 - 0.10 * crackle;
    float flash = smoothstep(th, 1.0, 0.5 + 0.5 * sin(t * (2.2 + 1.8 * hash11(seed + 8.0)) + seed * 5.0));
    amp *= flick * (1.0 + 2.4 * flash) * (burst ? 1.7 : 1.0);

    vec2 d = (p - ep) * vec2(aspect, 1.0);
    float r = burst ? 0.0044 : 0.0028 + 0.0016 * hash11(seed + 9.0);
    float glow = exp(-dot(d, d) / (r * r));
    float core = exp(-dot(d, d) / (r * r * 0.16));
    c += ecol * amp * (0.55 * glow + 0.9 * core) * 0.9;
    // white-hot speck at the very core while the ember is young
    c += vec3(1.0, 0.92, 0.72) * amp * heat * core * 0.5;
  }

  c *= uFade;
  fragColor = vec4(c, 1.0);
}
`;

export default class EmberField extends Scene {
  override stateful = false;
  override prerollMax = 0;
  override handlesTransition = false;

  private pass = new FSPass(FRAG, {
    uT: { value: 0 },
    uRes: { value: new THREE.Vector2(W, H) },
    uFade: { value: 0 },
  });

  constructor(ctx: SceneCtx) {
    super(ctx);
  }

  override init() {}
  override reset() {}

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const u = this.pass.u;
    u.uT!.value = t;
    (u.uRes!.value as THREE.Vector2).set(out.width, out.height);

    // two-phase fades keep the near-black run under F16's 0.3 s threshold
    const fadeIn = 0.8 * Math.min(1, t / 0.3) + 0.2 * Math.min(1, Math.max(0, t - 0.3) / 1.5);
    const rem = END - t;
    const fadeOut = rem > 0.25 ? 0.55 + 0.45 * Math.min(1, (rem - 0.25) / 0.75) : 0.55 * (rem / 0.25);
    u.uFade!.value = fadeIn * fadeOut;

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(0x000000, 1);
    rr.clear(true, true, true);
    this.pass.render(rr, out);
    rr.setRenderTarget(null);
    rr.resetState();

    return {
      toneMap: 'aces',
      exposure: 1.0,
      bloom: 0.6,
      bloomThreshold: 0.4,
      halation: 0.3,
      vignette: 0.34,
      grain: 0.03,
      ca: 0.0,
    };
  }

  override dispose() {
    this.pass.dispose(); // fsGeom is a shared singleton — never dispose it here
  }
}
