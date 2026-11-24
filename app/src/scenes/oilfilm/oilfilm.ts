// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// oilfilm — petrol thin-film interference on wet tarmac at night, seen nearly
// top-down in a locked macro shot. A seeded amoeba slick spreads via a
// closed-form radial growth front; inside it an analytic thickness field
// (thinner toward the rim, advected by a slow closed-form swirl) drives an
// iridescent cosine palette, so rainbow bands drift, separate as the slick
// grows, then thin and sharpen at the edges late in the take. Near-black
// asphalt carries faint aggregate sparkle; one dim sodium-lamp smear sits in
// the upper right as the only warm event. All f(t): growth, swirl, thickness
// and sparkle are closed-form — no accumulators, no Math.random at render.
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform float uT;
out vec4 fragColor;

const float PI = 3.14159265358979;
const float TAU = 6.28318530717959;

// seeded hash → static organic perturbations (no noise textures needed)
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

// amoeba growth front: smooth global spread modulated by a fixed few-lobed
// angular perturbation so the rim is organic but deterministic.
float frontRadius(float theta, float g) {
  float wob = 0.10 * sin(theta * 3.0 + 1.3)
            + 0.07 * sin(theta * 5.0 + 4.1)
            + 0.05 * sin(theta * 8.0 + 2.2)
            + 0.04 * sin(theta * 13.0 + 5.6);
  // lobes grow at slightly different rates so the outline keeps evolving
  float breathe = 0.05 * sin(theta * 2.0 - uT * 0.21)
                + 0.03 * sin(theta * 7.0 + uT * 0.13);
  return g * (0.62 + wob + breathe * g);
}

// thin-film iridescence: film thickness (in nm-ish units) → spectral band
// colour via the standard three-phase cosine approximation.
vec3 filmColor(float d) {
  vec3 phase = vec3(d * 0.0210, d * 0.0195, d * 0.0172);
  vec3 c = 0.5 + 0.5 * cos(TAU * phase + vec3(0.0, 0.35, 0.72));
  // nearly saturated — the oily rainbow, not pastel
  return mix(vec3(dot(c, vec3(0.3333))), c, 0.95);
}

void main() {
  // tarmac plate coordinates; x stretched for the 16:9 plane
  vec2 p = (vUv - 0.5) * vec2(2.6, 1.62);
  float r = length(p);
  float theta = atan(p.y, p.x);

  // ---- asphalt base -------------------------------------------------------
  // near-black with a faint blue cast and very dim sheen toward the lamp
  vec3 col = vec3(0.0035, 0.0045, 0.0065);
  col += vec3(0.004, 0.005, 0.007) * (1.0 - smoothstep(0.0, 1.6, r));

  // aggregate sparkle: sparse glints on a hashed cell grid, dimmer at range.
  // Two crossed hash thresholds keep it rare; twinkle is a slow f(t) gate.
  vec2 cell = floor(p * 38.0);
  vec2 cf = fract(p * 38.0) - 0.5;
  float h = hash2(cell);
  if (h > 0.988) {
    float tw = 0.55 + 0.45 * sin(uT * (0.6 + h * 3.0) + h * 40.0);
    float fall = 1.0 - smoothstep(0.4, 1.5, r);
    // point glint at the cell centre — not a lit rectangle
    float dot_ = exp(-dot(cf, cf) * 60.0);
    col += vec3(0.55, 0.6, 0.7) * 0.12 * tw * fall * dot_;
  }
  // micro asphalt grain — static value noise, cheap two-tap hash lerp
  vec2 g2 = p * 90.0;
  vec2 gi = floor(g2);
  vec2 gf = fract(g2);
  gf = gf * gf * (3.0 - 2.0 * gf);
  float grain = mix(mix(hash2(gi), hash2(gi + vec2(1, 0)), gf.x),
                    mix(hash2(gi + vec2(0, 1)), hash2(gi + vec2(1, 1)), gf.x),
                    gf.y);
  col += vec3(0.008) * grain;

  // ---- slick mask -----------------------------------------------------------
  // growth g(t): small slick at t=2, spreading by 8, full frame by ~14-16
  float g = 0.10 + 0.92 * smoothstep(0.5, 16.5, uT);
  float R = frontRadius(theta, g);
  float rim = smoothstep(R - 0.015, R + 0.010, r);   // 0 inside → 1 outside
  float inside = 1.0 - rim;

  if (inside > 0.0) {
    // ---- thickness field ----------------------------------------------------
    // swirl: rotate the domain by a closed-form angle that slows toward the
    // rim — differential rotation visibly advects the fringes.
    float rn = clamp(r / max(R, 1e-4), 0.0, 1.0);
    float swirlA = uT * 0.055 * (1.0 - 0.55 * rn * rn);
    float cs = cos(swirlA), sn = sin(swirlA);
    vec2 ps = vec2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);
    float ths = atan(ps.y, ps.x);
    float rs = length(ps);

    // base wedge: thick centre → thin rim (nm-ish scale 150..950)
    float d = mix(950.0, 150.0, pow(rn, 0.8));
    // drifting lobes make the bands read as flowing contours, not a bullseye
    d += 170.0 * sin(ths * 3.0 + rs * 9.0 - uT * 0.34)
       + 90.0 * sin(ths * 5.0 - rs * 14.0 + uT * 0.22)
       + 55.0 * sin(ths * 9.0 + rs * 22.0 - uT * 0.47);
    // late-take sharpening: near the rim the film thins hard, squeezing bands
    float rimThin = smoothstep(0.55, 0.98, rn) * smoothstep(10.0, 17.0, uT);
    d = mix(d, d * 0.35 + 40.0 * sin(rn * 60.0 - uT * 0.9), rimThin * 0.8);

    vec3 film = filmColor(d);
    // fringe luminance: mostly dark oil with thin bright interference
    // contours — cubic banding keeps the gaps near-black.
    // integer angular multiple — a non-integer ths term would seam at the
    // atan ±π cut
    float band = 0.5 + 0.5 * sin(d * 0.030 + ths * 2.0);
    band = band * band * band;
    vec3 slick = film * (0.05 + band * 0.95);

    // oily darkening of the tarmac under the film + bright wet rim edge
    slick += vec3(0.005, 0.006, 0.010);
    float edgeGlow = smoothstep(0.10, 0.0, abs(r - R) / max(R, 1e-4));
    slick += film * edgeGlow * 0.4;

    // faint dim sheen — the slick is glossy even where fringes are dark
    slick += vec3(0.006, 0.008, 0.013) * (0.5 + 0.5 * sin(ths * 2.0 + uT * 0.3));

    col = mix(col, slick, inside);
    // wet highlight ring exactly on the growth front
    float rimD = (r - R) / 0.012;
    col += filmColor(620.0) * exp(-rimD * rimD) * 0.35 * step(0.02, g);
  }

  // ---- sodium-lamp smear ----------------------------------------------------
  // dim warm vertical streak upper-right — the only warm light in the frame
  vec2 lampD = (vUv - vec2(0.74, 0.30)) * vec2(2.6, 1.62);
  float lamp = exp(-(lampD.x * lampD.x) / 0.006 - (lampD.y * lampD.y) / 0.35);
  col += vec3(1.0, 0.55, 0.18) * lamp * 0.08;

  // gentle overall brightness ramp — the eye adjusts as the slick spreads
  col *= 0.85 + 0.15 * smoothstep(0.0, 6.0, uT);

  fragColor = vec4(col, 1.0);
}`;

export default class OilfilmScene extends Scene {
  private three = new THREE.Scene();
  private cam: THREE.PerspectiveCamera;
  private u = { uT: { value: 0 } };

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.cam = new THREE.PerspectiveCamera(38, ctx.W / ctx.H, 0.1, 200);

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(130, 81),
      new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: VERT, fragmentShader: FRAG, glslVersion: THREE.GLSL3 }),
    );
    plane.rotation.x = -Math.PI / 2;
    this.three.add(plane);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.lt;
    const r = this.ctx.renderer;
    this.u.uT.value = t;

    // tripod-locked macro with a tiny drift: imperceptible sway + settle
    const drift = smooth(0, this.ctx.end, t);
    this.cam.position.set(
      0.30 * Math.sin(t * 0.05) + 0.4 * drift,
      26.0 - 0.8 * drift,
      7.0 - 0.6 * drift,
    );
    this.cam.lookAt(0.2 * drift, 0, -1.0);

    r.setRenderTarget(out);
    r.clear(true, true, true);
    r.render(this.three, this.cam);
    r.resetState();

    return {
      exposure: 0.42,
      bloom: 0.9,
      bloomThreshold: 0.32,
      bloomRadius: 0.8,
      ca: 0.2,
      grain: 0.08,
      vignette: 0.55,
      level: smooth(0, 0.9, t) * (1 - smooth(this.ctx.end - 0.9, this.ctx.end, t)),
      toneMap: 'agx',
    };
  }

  override dispose() {
    this.three.traverse((o: THREE.Object3D) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(x => x.dispose());
      else if (mat) mat.dispose();
    });
  }
}
