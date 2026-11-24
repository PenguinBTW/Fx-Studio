// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// jacobsladder (~20 s): a Jacob's ladder — two dark electrode rails diverging
// upward against a near-black void; a violet-white ionized arc strikes at the
// narrow base and climbs as the gap widens, stretching until it starves and
// re-strikes. Everything is closed-form f(p, t): the arc bridge height, its
// lateral sum-of-sines wiggle, the strike/extinguish envelopes and the
// micro-sparks are all analytic — no Math.random, no accumulators.
//
// Arc model: the channel bridges the rail gap at height h(t) (climbs over a
// ~4.6 s cycle, extinguishes at the top, re-strikes at the base). In-y wiggle
// y_arc(x) = h + Σ a_k·sin(b_k·u + φ_k(t)) snakes the filament across the
// gap; the jitter "chain" is hash-seeded phases drifting at fixed rates, so
// the path crackles continuously without integration.

import * as THREE from 'three';
import { Scene, Frame, SceneCtx, PostOverrides } from '../../engine/scene';
import { FSPass, W, H } from '../../engine/gl';

const END = 20.0;

const FRAG = /* glsl */ `
uniform float uT;
uniform vec2 uRes;
uniform float uFade;

const float CYCLE = 4.6;   // seconds per strike→climb→starve cycle
const float NARC = 3.0;    // staggered arc slots so a new one is always climbing

const vec3 VIOLET = vec3(0.62, 0.45, 1.0);
const vec3 CORE   = vec3(0.98, 0.96, 1.0);
const vec3 OZONE  = vec3(0.10, 0.16, 0.30);
const vec3 AMBER  = vec3(0.9, 0.55, 0.18);

// rail half-gap as f(y): narrow at the base, diverging to the top
float gapHalf(float y) { return 0.028 + 0.30 * y * y; }

// Arc bridge height inside cycle phase ph ∈ [0,1): climbs from the base
// (y≈0.10) to near the top (y≈0.80), easing as the gap widens.
float arcH(float ph) {
  float c = 1.0 - exp(-ph * 3.2);          // fast start, slow top
  return 0.10 + 0.70 * c;
}

// Burn envelope over the cycle: bright strike flash, steady burn, starved
// flicker-out at the top of the climb.
float arcBurn(float ph) {
  float ignite = smoothstep(0.0, 0.02, ph) * (0.7 + 0.3 * exp(-ph * 9.0));
  float starve = 1.0 - smoothstep(0.86, 0.985, ph);
  float flick  = 1.0 - 0.5 * smoothstep(0.80, 0.97, ph) * (0.5 + 0.5 * sin(ph * 340.0));
  return ignite * starve * flick;
}

// Lateral in-y wiggle of the channel across the gap, u ∈ [0,1] left→right.
// Seeded phases drift at fixed rates → analytic crackle, no integration.
float arcWiggle(float u, float t, float seed) {
  float w = 0.0;
  w += 0.55 * sin(u * 21.0 + seed * 7.1 + t * 9.0);
  w += 0.30 * sin(u * 47.0 + seed * 13.7 - t * 13.0);
  w += 0.15 * sin(u * 90.0 + seed * 29.3 + t * 23.0);
  return w;
}

// One arc slot: distance from p to the channel + its burn weight.
float arcDens(vec2 p, float t, float slot) {
  float ph = fract(t / CYCLE + slot / NARC);
  float h = arcH(ph);
  float g = gapHalf(h);
  float cx = 0.5 * (uRes.x / uRes.y) + 0.02;
  float xL = cx - g, xR = cx + g;
  if (abs(p.x - cx) > g + 0.10) return 0.0;     // outside the bridge reach
  float u = clamp((p.x - xL) / max(2.0 * g, 1e-4), 0.0, 1.0);
  float seed = slot * 17.0 + floor(t / CYCLE);  // new jitter chain per strike
  float amp = 0.016 + 0.030 * (h / 0.80);       // wiggle grows with the gap
  float ya = h + amp * arcWiggle(u, t, seed);
  float dy = abs(p.y - ya);
  // end taper: the channel dims where it meets the rails
  float taper = smoothstep(0.0, 0.06, u) * (1.0 - smoothstep(0.94, 1.0, u));
  float core = exp(-dy * dy * 4.0e5);
  float halo = exp(-dy * 90.0) * 0.25;
  return (core + halo) * taper * arcBurn(ph);
}

void main() {
  vec2 p = gl_FragCoord.xy / uRes;               // y: 0 bottom → 1 top
  // subtle push-in + hand-held drift, closed form
  float push = 1.0 + 0.05 * smoothstep(0.0, 20.0, uT);
  vec2 drift = 0.004 * vec2(sin(uT * 0.43 + 1.7), sin(uT * 0.31));
  p = (p - 0.5) / push + 0.5 + drift;
  float aspect = uRes.x / uRes.y;
  p.x *= aspect;
  float cx = 0.5 * aspect + 0.02;                // rail axis, slightly right-biased

  vec3 c = vec3(0.006, 0.007, 0.011)             // void
         + OZONE * (0.010 + 0.010 * p.y);        // ozone-blue ambient lift toward top

  // rails: dark rods with a faint amber specular edge on the inner faces
  for (int side = -1; side <= 1; side += 2) {
    float fs = float(side);
    // rail x at this row; rods have a slight bow outward near the top
    float xr = cx + fs * (gapHalf(p.y) + 0.004 * p.y * p.y);
    float d = abs(p.x - xr);
    float rod = 1.0 - smoothstep(0.0, 0.0035, d);
    float edgeL = (1.0 - smoothstep(0.0, 0.012, d)) * (1.0 - rod) * 0.5;
    c = mix(c, vec3(0.016, 0.016, 0.020), rod * 0.9);            // rod body (near-black)
    c += AMBER * edgeL * (fs < 0.0 ? 1.0 : 0.55) * 0.35;         // warm inner glint
  }

  // arcs: sum the slots; also lift the rails near the bridge height
  float a = 0.0;
  for (int s = 0; s < 3; s++) a += arcDens(p, uT, float(s));
  float aCl = min(a, 1.5);

  // rail light spill: rails brighten faintly near each burning bridge height
  for (int s = 0; s < 3; s++) {
    float ph = fract(uT / CYCLE + float(s) / NARC);
    float h = arcH(ph);
    float g = gapHalf(p.y);
    float spill = exp(-abs(p.y - h) * 22.0) * arcBurn(ph)
                * (1.0 - smoothstep(0.0, 0.02, abs(abs(p.x - cx) - (g + 0.004 * p.y * p.y))));
    c += VIOLET * spill * 0.30 + AMBER * spill * 0.10;
  }

  // channel: violet halo under a white-hot core
  c += VIOLET * min(aCl, 1.0) * 0.55;
  float coreHot = max(0.0, a - 0.55) * 2.2;
  c += CORE * min(coreHot, 1.2);

  // micro-sparks: sparse motes seeded along the channel, flashing on a
  // hash clock — extra burst near each extinguish (ph ∈ [0.86,1))
  for (int i = 0; i < 14; i++) {
    float fi = float(i);
    float slot = floor(fi / 5.0);
    float ph = fract(uT / CYCLE + slot / NARC);
    float h = arcH(ph);
    float g = gapHalf(h);
    float h1 = hash11(fi * 7.31 + slot * 3.7);
    float h2 = hash11(fi * 13.7 + slot * 11.3);
    float h3 = hash11(fi * 5.9 + slot * 23.1);
    float sx = cx + (h1 * 2.0 - 1.0) * g * 0.9;
    float u = clamp((sx - cx + g) / max(2.0 * g, 1e-4), 0.0, 1.0);
    float seed = slot * 17.0 + floor(uT / CYCLE);
    float sy = h + (0.016 + 0.030 * (h / 0.80)) * arcWiggle(u, uT, seed)
             + (h2 - 0.5) * 0.03;
    float clock = fract(uT * (1.5 + h3 * 3.0) + h1 * 9.0);
    float burst = 1.0 + 2.5 * smoothstep(0.86, 0.96, ph);        // starve burst
    float spark = smoothstep(0.93, 1.0, clock) * burst;
    float d2 = (p.x - sx) * (p.x - sx) + (p.y - sy) * (p.y - sy);
    c += CORE * spark * exp(-d2 * 3.0e5) * 0.8;
  }

  // deep vignette — the void swallows the edges
  float v = length((p - vec2(cx, 0.48)) * vec2(1.0, 1.25));
  c *= 1.0 - 0.78 * smoothstep(0.42, 0.95, v);

  c *= uFade;
  fragColor = vec4(c, 1.0);
}
`;

export default class JacobsLadder extends Scene {
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
      bloom: 0.55,
      bloomThreshold: 0.4,
      halation: 0.35,
      vignette: 0.30,
      grain: 0.03,
      ca: 0.0,
    };
  }

  override dispose() {
    this.pass.dispose(); // fsGeom is a shared singleton — never dispose it here
  }
}
