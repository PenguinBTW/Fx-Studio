// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// inkpool (~20 s): a drop of bone-white ink blooming in near-black water.
// The bloom is an analytic radial density field — radius grows as a smooth
// f(t), edge raggedness grows with age, spiral tendril arms tighten their
// pitch over time. A second drop lands ~t=12 and merges. One restrained warm
// accent: a single amber-tinted tendril. Macro stillness: tiny drift, deep
// vignette.
//
// Determinism: density at every point is f(p, t) — radius, edge warp,
// tendril twist and the strike flashes are all closed-form. No Math.random,
// no accumulators, no per-frame integration.

import * as THREE from 'three';
import { Scene, Frame, SceneCtx, PostOverrides } from '../../engine/scene';
import { FSPass, W, H } from '../../engine/gl';

const END = 20.0;

const FRAG = /* glsl */ `
uniform float uT;
uniform vec2 uRes;
uniform float uFade;

const int ARMS = 9;
const float T_HIT = 1.1;   // first drop strikes
const float T_HIT2 = 12.0; // second drop strikes
const vec2 C1 = vec2(0.465, 0.52);
const vec2 C2 = vec2(0.615, 0.44);
const vec3 INK = vec3(0.82, 0.84, 0.80);   // bone-white ink
const vec3 AMBER = vec3(0.95, 0.55, 0.16); // the one warm accent

// --- bloom envelopes ----------------------------------------------------

// radius: explosive strike then a slow viscous creep
float bloomR(float age) {
  if (age <= 0.0) return 0.0;
  return 0.045 + 0.46 * (1.0 - exp(-age / 4.6));
}

// edge raggedness grows as the bloom ages into wisps
float edgeAmp(float age) {
  return 0.10 + 0.62 * (1.0 - exp(-max(age, 0.0) / 8.0));
}

// tendril visibility fades in as the bloom unfurls
float tendrilEnv(float age) {
  return smoothstep(2.5, 7.0, age) * (1.0 - smoothstep(17.0, 20.0, age));
}

// --- one bloom ----------------------------------------------------------

float inkBloom(vec2 p, vec2 c0, float age, float seed, out float tendAmber) {
  tendAmber = 0.0;
  if (age <= 0.0) return 0.0;
  vec2 q = p - c0;
  float r = length(q);
  float a = atan(q.y, q.x);
  float R = bloomR(age);

  // slow internal swirl — rotates the texture domain, falling off with radius
  float sw = 1.6 * (1.0 - exp(-age / 7.0)) * (R - r) + age * 0.015;
  float cs = cos(sw), sn = sin(sw);
  vec2 wq = mat2(cs, -sn, sn, cs) * q;
  float n = fbm(wq * 6.0 + seed, 4);

  // ragged boundary: angle-varying radius grows more complex over time
  float rag = fbm(vec2(cos(a), sin(a)) * 2.6 + seed * 1.7 + age * 0.02, 3);
  float edge = R * (0.55 + edgeAmp(age) * 0.35 * rag);

  // body: dense core feathering to the edge — wisps floor stays high enough
  // that interior noise never punches holes into the ink
  float body = 1.0 - smoothstep(edge * 0.30, edge, r);
  float wisps = 0.48 + 0.80 * (0.5 + 0.5 * n);
  float dens = body * wisps;

  // tendrils: thin seeded filaments riding the ragged edge. Each arm has its
  // own reach L_i, angular half-width that tapers to the tip, and a quadratic
  // curl so the tip coils — growth of reach/curl is a smooth f(age).
  float reach = 0.45 + 0.75 * smoothstep(1.5, 9.0, age);
  float curlAmt = 0.6 + 2.6 * smoothstep(3.0, 13.0, age);
  float tenv = tendrilEnv(age);
  for (int i = 0; i < ARMS; i++) {
    float fi = float(i);
    float h1 = hash11(seed * 31.0 + fi * 7.13);
    float h2 = hash11(seed * 31.0 + fi * 11.71);
    float h3 = hash11(seed * 31.0 + fi * 17.37);
    float th = 6.28318 * (fi / float(ARMS)) + h1 * 0.9;
    float Li = R * reach * (0.55 + 0.45 * h2);
    float x = clamp(r / max(Li, 1e-4), 0.0, 1.2);
    // signed angular distance to the curling arm centerline
    float da = atan(sin(a - (th + (h2 - 0.5) * 2.0 * curlAmt * x * x)),
                    cos(a - (th + (h2 - 0.5) * 2.0 * curlAmt * x * x)));
    float width = (0.028 + 0.030 * h3) * (1.0 - 0.72 * x);
    float arm = (1.0 - smoothstep(0.0, max(width, 1e-4), abs(da)))
              * smoothstep(R * 0.20, R * 0.38, r)
              * (1.0 - smoothstep(0.82, 1.0, x))
              * tenv;
    // arms are inky wisps — mottled by the same swirl field
    arm *= 0.55 + 0.7 * (0.5 + 0.5 * n);
    dens += arm * 0.5;
    if (i == 3 && seed < 1.5) tendAmber = arm;
  }
  return dens;
}

// strike flash: tight core + expanding ring in the instant after impact
float strike(vec2 p, vec2 c0, float age) {
  if (age < 0.0 || age > 1.0) return 0.0;
  float rr = length(p - c0);
  float ring = 1.0 - smoothstep(0.0, 0.010 + 0.05 * age, abs(rr - 0.11 * age));
  float core = exp(-rr * rr / (0.0035 + 0.012 * age));
  return (ring * 0.7 + core) * (1.0 - age / 1.0);
}

void main() {
  vec2 p = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  float t = uT;

  // macro stillness — a few pixels of slow drift
  p += vec2(sin(t * 0.13), cos(t * 0.11)) * 0.0045;

  vec2 pa = vec2(p.x * aspect, p.y);

  // near-black water with the faintest top-light
  vec3 c = vec3(0.008, 0.009, 0.013)
         + vec3(0.012, 0.013, 0.018) * (1.0 - smoothstep(0.30, 1.0, p.y));

  // the two drops
  float amber1;
  float d1 = inkBloom(pa, vec2(C1.x * aspect, C1.y), t - T_HIT, 1.0, amber1);
  float amber2;
  float d2 = inkBloom(pa, vec2(C2.x * aspect, C2.y), t - T_HIT2, 7.0, amber2);

  float s1 = strike(pa, vec2(C1.x * aspect, C1.y), t - T_HIT);
  float s2 = strike(pa, vec2(C2.x * aspect, C2.y), t - T_HIT2);

  // top-light catches the bloom's face: brighter toward frame top
  float top = 0.55 + 0.65 * (1.0 - p.y);

  c += INK * min(d1 + d2, 1.45) * top;
  c += AMBER * amber1 * top * 0.55;
  c += INK * (s1 + s2) * 1.4;

  // deep macro vignette
  vec2 vc = (p - 0.5) * vec2(aspect, 1.0);
  c *= 1.0 - 0.72 * smoothstep(0.30, 0.85, length(vc));

  c *= uFade;
  fragColor = vec4(c, 1.0);
}
`;

export default class InkPool extends Scene {
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
      bloom: 0.5,
      bloomThreshold: 0.42,
      halation: 0.3,
      vignette: 0.30,
      grain: 0.03,
      ca: 0.0,
    };
  }

  override dispose() {
    this.pass.dispose(); // fsGeom is a shared singleton — never dispose it here
  }
}
