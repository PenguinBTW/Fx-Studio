// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// tidepool (~20 s): a shallow tidepool at dusk from just above the water —
// dark wet rock rim framing a pool basin; expanding gaussian ripple rings
// from hash-seeded drip points (radius, amplitude all f(t)); drifting light
// caustics on the sandy floor (two phase-animated cosine fields); tiny warm
// anemone pulses; dusk-sky reflection in the still patches; floating motes.
// One cold accent: cyan bioluminescent speckle under the ripples ~t=14.
//
// Determinism: drip times, ring radii, caustic phases, mote drift, sky and
// camera breathing are analytic f(t). No Math.random, no accumulators.

import * as THREE from 'three';
import { Scene, Frame, SceneCtx, PostOverrides } from '../../engine/scene';
import { FSPass, W, H } from '../../engine/gl';

const END = 20.0;

const FRAG = /* glsl */ `
uniform float uT;
uniform vec2 uRes;
uniform float uFade;

const int DRIPS = 4;
const int MOTES = 9;
const int ANEM = 6;

// drip i's j-th event time: a steady cadence per drip, staggered by seed;
// first ring lands at/just before t=2; last start ~17.9 so t=18 stays calm
float dripTime(int i, int j) {
  float fj = float(j);
  float seed = hash11(float(i) * 7.13 + 0.37) * 1.2;
  return 1.4 + fj * 2.2 + seed + (float(i) * 0.7);
}

vec2 dripPos(int i) {
  float fi = float(i);
  return vec2(0.30 + 0.42 * hash11(fi * 3.71 + 0.5),
              0.38 + 0.34 * hash11(fi * 5.17 + 0.9));
}

// ripple height field from all drips — expanding gaussian rings
float rippleH(vec2 p, float t) {
  float h = 0.0;
  for (int i = 0; i < DRIPS; i++) {
    vec2 c = dripPos(i);
    float d = length(p - c);
    for (int j = 0; j < 7; j++) {
      float t0 = dripTime(i, j);
      float age = t - t0;
      if (age <= 0.0 || age > 3.2) continue;
      float r = 0.16 * age;                     // expansion speed, f(t)
      float w = 0.006 + 0.012 * age;            // thin ring, widens slowly
      float x = (d - r) / w;
      float amp = 0.35 * exp(-age * 1.4) * exp(-d * 2.2); // decay in time + space
      h += amp * exp(-x * x) * (1.0 - exp(-d * 40.0));
    }
  }
  return h;
}

// caustic shimmer on the pool floor: two phase-animated cosine fields
float caustic(vec2 p, float t) {
  float a = cos(p.x * 22.0 + t * 0.9 + sin(p.y * 14.0 - t * 0.5) * 1.6);
  float b = cos((p.x * 0.7 + p.y) * 19.0 - t * 0.65 + sin(p.x * 11.0 + t * 0.4));
  float c = max(a * b, 0.0);
  return c * c * c * max(fbm(p * 14.0 + t * 0.15, 2), 0.0); // fbm mask breaks up streaks
}

void main() {
  vec2 p = gl_FragCoord.xy / uRes;
  float t = uT;

  // camera: near-static macro, tiny breathing drift
  p += vec2(sin(t * 0.31) * 0.004, cos(t * 0.23) * 0.003);
  float aspect = uRes.x / uRes.y;
  vec2 q = vec2(p.x * aspect, p.y);

  // ---- basin shape: ellipse of pool inside a rock rim --------------------
  vec2 ctr = vec2(0.5 * aspect, 0.44);
  vec2 e = (q - ctr) / vec2(0.62, 0.46);
  float basin = length(e);                    // <1 water, >1 rock
  float rockMask = smoothstep(0.96, 1.04, basin);

  // ---- water surface ------------------------------------------------------
  float rh = rippleH(q, t);
  vec2 grad = vec2(rippleH(q + vec2(0.004, 0.0), t) - rh,
                   rippleH(q + vec2(0.0, 0.004), t) - rh);

  // ---- dusk sky reflection (flipped v — looking down at a mirror) --------
  // the ripple slope warps the lookup, so rings bend the reflected sky
  float skyY = 1.0 - p.y + grad.y * 14.0 + grad.x * 4.0;
  vec3 skyRef = mix(vec3(0.42, 0.20, 0.15),   // warm band at the horizon
                    vec3(0.035, 0.05, 0.10),  // deep zenith blue
                    smoothstep(0.1, 0.95, skyY));
  skyRef += vec3(0.30, 0.12, 0.02) * exp(-abs(skyY - 0.72) * 9.0) * 0.6;

  vec3 water = mix(skyRef, vec3(0.02, 0.045, 0.065), 0.72);  // deeper pool water
  water += vec3(0.9, 0.75, 0.55) * max(rh, 0.0) * 0.9;         // crest glints
  water -= vec3(0.02, 0.03, 0.04) * max(-rh, 0.0) * 1.4;       // trough shade
  water += grad.x * vec3(0.5, 0.3, 0.15) * 0.8;

  // ---- sandy floor + caustics under the surface --------------------------
  float sandN = fbm(q * 9.0 + 3.0, 3);
  vec3 sand = mix(vec3(0.045, 0.035, 0.028), vec3(0.10, 0.08, 0.055), sandN);
  float still = 1.0 - min(abs(rh) * 6.0, 0.8);  // caustics fade under ripples
  float depth = smoothstep(0.3, 1.0, basin);    // darker toward the rim
  vec3 floor_ = sand * (0.35 + 0.65 * depth);
  floor_ += vec3(0.85, 0.55, 0.25) * caustic(q, t) * 0.55 * still * depth;
  // water tints the floor; ripples refract it slightly
  vec3 poolCol = mix(floor_, water, 0.72 - 0.18 * still);

  // cyan bioluminescent speckle under the ripples ~t=14 (round pinpricks)
  float bioWin = exp(-((t - 14.0) / 1.9) * ((t - 14.0) / 1.9));
  vec2 cell = floor(q * 130.0);
  float seed = hash11(dot(cell, vec2(127.1, 311.7)) + floor(t * 3.0) * 0.11);
  vec2 cuv = fract(q * 130.0) - 0.5;
  float speck = step(0.994, seed) * exp(-dot(cuv, cuv) / 0.02);
  poolCol += vec3(0.05, 0.5, 0.6) * speck * bioWin * (1.0 - rockMask) * 0.8;

  // floating motes caught in the surface film
  for (int i = 0; i < MOTES; i++) {
    float fi = float(i);
    vec2 m = vec2(hash11(fi * 3.3 + 0.2), hash11(fi * 7.7 + 0.6));
    m += vec2(sin(t * 0.12 + fi) * 0.012, cos(t * 0.09 + fi * 1.3) * 0.008);
    float dm = length(q - vec2(m.x * aspect, m.y));
    poolCol += vec3(0.35, 0.30, 0.22) * exp(-dm * dm / 0.00006) * (1.0 - rockMask) * 0.7;
  }

  // ---- rock rim: dark wet stone, tighter edge, sheen at the waterline ------
  float rockN = fbm(q * 13.0 + 9.0, 5);
  float rockGrain = 0.5 + 0.5 * fbm(q * 42.0 + 5.0, 3);       // fine stone grain
  vec3 rock = mix(vec3(0.008, 0.008, 0.009), vec3(0.045, 0.038, 0.034), rockN * 0.6 + rockGrain * 0.4);
  float wet = 1.0 - smoothstep(1.0, 1.22, basin);  // wet band near the water
  rock += vec3(0.09, 0.08, 0.07) * wet * rockGrain;
  rock += vec3(0.22, 0.14, 0.06) * exp(-abs(basin - 1.01) * 30.0) * 0.6; // waterline sheen

  vec3 c = mix(poolCol, rock, rockMask);

  // ---- warm anemone / barnacle accents pulsing faintly --------------------
  for (int i = 0; i < ANEM; i++) {
    float fi = float(i);
    vec2 a = vec2((0.18 + 0.64 * hash11(fi * 5.9 + 0.3)) * aspect,
                  0.30 + 0.42 * hash11(fi * 9.1 + 0.8));
    float da = length(q - a);
    float pulse = 0.45 + 0.55 * sin(t * 2.1 + fi * 2.4);
    vec3 glow = vec3(0.9, 0.38, 0.10) * exp(-da * da / 0.00018) * (0.35 + 0.65 * pulse);
    c += glow * 0.5;
  }

  // vignette + dusk grade
  float vig = 1.0 - smoothstep(0.45, 1.15, length(p - 0.5) * 1.35);
  c *= 0.55 + 0.45 * vig;
  c *= uFade;

  fragColor = vec4(c, 1.0);
}
`;

export default class TidePool extends Scene {
  static stateful = false;
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
  override dispose() {
    this.pass.dispose();
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const u = this.pass.u;
    u.uT!.value = t;
    (u.uRes!.value as THREE.Vector2).set(out.width, out.height);

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
    };
  }
}
