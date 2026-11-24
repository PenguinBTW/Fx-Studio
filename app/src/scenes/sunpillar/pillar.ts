// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// sunpillar (~20 s): a winter horizon just after sunset — a sun pillar:
// a vertical column of light rising above the sun just below the ridge,
// formed by reflections off falling plate ice crystals. Near-black forested
// silhouette, deep dusk gradient, faint snow-field luminance, a few stars.
//
// Determinism: everything is closed-form f(t) in the shader — crystal
// positions wrap analytically, each mote's glint fires when its analytic
// tilt passes alignment. No Math.random, no accumulators.

import * as THREE from 'three';
import { Scene, Frame, SceneCtx, PostOverrides } from '../../engine/scene';
import { FSPass, W, H } from '../../engine/gl';

const END = 20.0;

const FRAG = /* glsl */ `
uniform float uT;
uniform vec2 uRes;
uniform float uFade;

const float SUNX = 0.5;
const float RIDGE = 0.315;  // base ridge height (normalized y)
const int MOTES = 56;
const int STARS = 26;

// narrative envelope: pillar brightness/width/height over the run
vec3 pillarEnv(float t) {
  float I = smoothstep(0.0, 6.0, t) * (1.0 - smoothstep(15.0, 19.0, t));
  I *= 0.82 + 0.18 * sin(t * 0.55);              // slow breathing
  float w = mix(0.012, 0.052, smoothstep(2.0, 14.0, t));  // widening to ~t=14
  float h = mix(0.16, 0.36, smoothstep(1.5, 12.0, t));    // rising column
  return vec3(I, w, h);
}

// forested ridgeline: low ridge + high-frequency conifer spikes
float ridgeY(float x) {
  float ridge = fbm(vec2(x * 2.2, 0.0), 4) * 0.055;
  float trees = abs(sin(x * 61.0 + fbm(vec2(x * 8.0, 4.0), 3) * 9.0));
  trees = pow(trees, 3.0) * 0.028 * (0.5 + 0.5 * fbm(vec2(x * 14.0, 8.0), 3));
  return RIDGE + ridge + trees;
}

vec3 skyGrad(vec2 p) {
  // near-black zenith -> deep indigo -> thin ember band above the ridge
  float y = p.y;
  vec3 c = mix(vec3(0.010, 0.013, 0.024), vec3(0.030, 0.040, 0.075),
               smoothstep(1.0, 0.45, y));
  c = mix(c, vec3(0.10, 0.055, 0.028),
          smoothstep(0.55, 0.34, y) * smoothstep(0.16, 0.34, y));
  return c;
}

void main() {
  vec2 p = gl_FragCoord.xy / uRes;   // 0..1
  vec3 env = pillarEnv(uT);
  float I = env.x, w = env.y, ph = env.z;

  vec3 c = skyGrad(p);

  // --- faint stars in the upper sky, slow analytic twinkle ---
  for (int i = 0; i < STARS; i++) {
    vec2 sp = vec2(hash11(float(i) * 13.7), 0.62 + 0.35 * hash11(float(i) * 29.1));
    vec2 d = (p - sp) * vec2(uRes.x / uRes.y, 1.0);
    float tw = 0.5 + 0.5 * sin(uT * (0.3 + 0.4 * hash11(float(i) * 7.7)) + float(i));
    float g = 1.0 - smoothstep(0.0, 0.0026 + 0.0012 * hash11(float(i) * 3.3), length(d));
    c += vec3(0.75, 0.82, 0.95) * g * 0.10 * (0.4 + 0.6 * tw);
  }

  // --- ridgeline silhouette + snow field ---
  float ry = ridgeY(p.x);
  float below = smoothstep(ry + 0.002, ry - 0.002, p.y);
  vec3 snow = vec3(0.055, 0.062, 0.075)
            + fbm(p * vec2(30.0, 18.0), 3) * vec3(0.015, 0.016, 0.020);
  // faint warm reflection of the pillar on the snow
  float refl = exp(-pow((p.x - SUNX) / (w * 2.4), 2.0)) * exp(-(ry - p.y) * 14.0);
  snow += vec3(0.22, 0.13, 0.05) * refl * I;
  // darken the strip just under the crest: a near-black forested treeline
  snow *= mix(1.0, 0.12, smoothstep(ry - 0.055, ry - 0.006, p.y));
  c = mix(c, snow * 0.9, below * 0.92);

  // --- the pillar itself (only above the ridge) ---
  float xo = (p.x - SUNX) / w;
  float lat = exp(-xo * xo);
  float vert = smoothstep(ph, 0.02, p.y - ry);          // fades to top of column
  vert *= smoothstep(-0.015, 0.02, p.y - ry);           // hides below ridge
  float striae = 0.75 + 0.25 * snoise(vec2(p.x * 90.0, p.y * 3.0 - uT * 0.05));
  float pillar = lat * vert * I * striae;
  // hot base where the column breaches the ridge
  float base = exp(-xo * xo * 0.55) * exp(-abs(p.y - ry - 0.015) * 55.0) * I;
  vec3 warm = vec3(1.00, 0.74, 0.38);
  vec3 bone = vec3(0.93, 0.87, 0.74);
  c += mix(warm, bone, min(1.0, pillar * 1.4)) * pillar * 0.85;
  c += warm * base * 0.55;

  // --- ice-crystal motes: fall through the column, flash on tilt align ---
  for (int i = 0; i < MOTES; i++) {
    float fi = float(i);
    float seed = fi * 17.13;
    // mote drifts down slowly, wrapping within the column volume
    float span = 0.30;
    float y0 = ry + 0.04 + span * fract(hash11(seed) - uT * (0.012 + 0.014 * hash11(seed + 1.0)));
    float x0 = SUNX + (hash11(seed + 2.0) - 0.5) * w * 2.6
             + 0.004 * sin(uT * 0.4 + fi);
    // analytic tilt: glint when the plate's tilt passes the flash angle
    float tilt = cos(uT * (0.9 + 0.7 * hash11(seed + 3.0)) + seed);
    float flash = smoothstep(0.988, 0.9995, tilt);
    if (flash < 0.01) continue;
    vec2 d = (p - vec2(x0, y0)) * vec2(uRes.x / uRes.y, 1.0);
    float g = 1.0 - smoothstep(0.0, 0.0035, length(d));
    // crystals only read inside the lit column
    float inCol = exp(-pow((x0 - SUNX) / w, 2.0)) * smoothstep(ph, 0.05, y0 - ry);
    c += bone * g * flash * inCol * I * 2.4;
  }

  c *= uFade;
  fragColor = vec4(c, 1.0);
}
`;

export default class SunPillar extends Scene {
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
      exposure: 1.05,
      bloom: 0.55,
      bloomThreshold: 0.45,
      halation: 0.25,
      vignette: 0.32,
      grain: 0.025,
      ca: 0.0,
    };
  }

  override dispose() {
    this.pass.dispose(); // fsGeom is a shared singleton — never dispose it here
  }
}
