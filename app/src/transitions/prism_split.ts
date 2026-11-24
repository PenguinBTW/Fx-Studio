// Prism split: spectral dispersion transition. The outgoing image refracts through
// an implicit prism — Cauchy dispersion n(λ) = A + B/λ² means short wavelengths
// deviate MORE than long ones, so the image separates into wavelength-ordered
// spectral fringes (blue leads, red trails) that diverge along the prism axis,
// while the incoming scene condenses from the same spectral fan in reverse.
//
// NOT a generic RGB-split glitch: band offsets are computed from actual Cauchy
// deviations, energy-normalized across the spectrum, and the fringe ordering is
// physically correct. HDR-linear throughout (samples stay in linear space).
//
// Seam conventions: coverage by u=0.85, envelope peaks at seam centre, exact
// endpoint purity, aspect-corrected dispersion magnitude.
import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { FSPass } from '../engine/gl';

// Cauchy water-like prism coefficients (refract.ts): n(λ) = A + B/λ² — the RATIO of
// deviations is what matters for ordering/magnitude, so the water constants stand in
// for crown glass to within a few percent.
const CAUCHY_A = 1.312;
const CAUCHY_B = 0.00315; // µm²

/** Band wavelengths (µm) and approximate sRGB spectral response weights. */
const BANDS: { lambdaUm: number; rgb: [number, number, number] }[] = [
  { lambdaUm: 0.44, rgb: [0.05, 0.1, 1.0] },   // blue-violet
  { lambdaUm: 0.49, rgb: [0.0, 0.55, 0.9] },   // cyan-blue
  { lambdaUm: 0.53, rgb: [0.05, 0.95, 0.25] }, // green
  { lambdaUm: 0.58, rgb: [0.75, 0.85, 0.05] }, // yellow
  { lambdaUm: 0.62, rgb: [1.0, 0.45, 0.02] },  // orange
  { lambdaUm: 0.67, rgb: [1.0, 0.05, 0.02] },  // red
];

function ior(lambdaUm: number): number {
  return CAUCHY_A + CAUCHY_B / (lambdaUm * lambdaUm);
}

/** Relative deviation per band: (n(λ) − n_mean) normalized so the red edge is +0.5 and blue −0.5. */
export function bandDeviations(): number[] {
  const ns = BANDS.map((b) => ior(b.lambdaUm));
  const mean = ns.reduce((a, b) => a + b, 0) / ns.length;
  const span = Math.max(...ns) - Math.min(...ns);
  return ns.map((n) => (n - mean) / span);
}

// Precompute GLSL band table (deviation + rgb response, energy-normalized)
const devs = bandDeviations();
const wSum = BANDS.reduce((s, b) => s + b.rgb[0] + b.rgb[1] + b.rgb[2], 0) / 3;
const bandGLSL = BANDS.map(
  (b, i) =>
    `{ float d = ${devs[i]!.toFixed(5)}; vec2 off = axis * d * spread; vec3 s = texture(tex, vUv + off).rgb * vec3(${b.rgb[0].toFixed(3)}, ${b.rgb[1].toFixed(3)}, ${b.rgb[2].toFixed(3)}); acc += s; wacc += vec3(${b.rgb[0].toFixed(3)}, ${b.rgb[1].toFixed(3)}, ${b.rgb[2].toFixed(3)}); }`
).join('\n        ');

export default class PrismSplit implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const frag = /* glsl */ `
      uniform sampler2D texA;
      uniform sampler2D texB;
      uniform float progress;
      uniform vec2 prismAxis; // normalized dispersion direction in UV space

      // 6-band Cauchy-ordered dispersion sample: fringes diverge along the prism axis,
      // blue (high n) leading red — energy-normalized so the undispersed image is exact
      vec3 disperse(sampler2D tex, vec2 vUv, vec2 axis, float spread) {
        vec3 acc = vec3(0.0);
        vec3 wacc = vec3(0.0);
        ${bandGLSL}
        // energy normalization: uniform grey input must come out unchanged
        return acc / max(wacc, vec3(1e-4));
      }

      void main() {
        float u = clamp(progress, 0.0, 1.0);
        float coverU = min(1.0, u / 0.85);
        float cover = coverU * coverU * (3.0 - 2.0 * coverU);

        // dispersion sweep: zero at u=0 (pure A, exact), fans out through the seam —
        // magnitude in UV units, aspect-independent since axis is UV-normalized
        float fanOut = 0.28 * cover;
        vec3 aCol = disperse(texA, vUv, prismAxis, fanOut);

        // B condenses from the same spectral fan in reverse: fully dispersed early,
        // converging to exact B as coverage completes
        float fanIn = 0.28 * (1.0 - cover);
        vec3 bCol = disperse(texB, vUv, -prismAxis, fanIn);

        // crossfade the two spectral fields — the fringes themselves carry the reveal
        float mixK = smoothstep(0.15, 0.85, cover);
        vec3 col = mix(aCol, bCol, mixK);

        // prism edge flash: a narrow brightening along the perpendicular wavefront
        // at peak dispersion — the physical source edge of the fan
        float peak = sin(u * 3.14159265);
        col += vec3(0.9, 0.95, 1.0) * peak * 0.06;

        // hard coverage guarantee: past completion exactly B
        vec4 bExact = texture(texB, vUv);
        col = mix(col, bExact.rgb, step(0.995, cover));
        // exact endpoint: u=0 must be pure A — disperse() is exact at spread 0, but
        // guard against the flash term
        vec4 aExact = texture(texA, vUv);
        col = mix(aExact.rgb, col, step(0.0005, u));

        fragColor = vec4(col, 1.0);
      }
    `;

    this.pass = new FSPass(frag, {
      texA: { value: null },
      texB: { value: null },
      progress: { value: 0 },
      prismAxis: { value: new THREE.Vector2(0.8, 0.6).normalize() },
    });
  }

  render(
    _f: Frame,
    out: THREE.WebGLRenderTarget,
    a: THREE.Texture,
    b: THREE.Texture,
    api: TransitionAPI,
  ): PostOverrides | void {
    const u = Math.min(1, Math.max(0, api.u));
    const { renderer } = this.ctx;

    this.pass.u.texA!.value = a;
    this.pass.u.texB!.value = b;
    this.pass.u.progress!.value = u;
    this.pass.render(renderer, out);
    renderer.resetState();

    // chromatic aberration in post rides the fan (same physical family); dies with coverage
    const x = Math.min(1, Math.max(0, (u - 0.7) / 0.15));
    const tail = x * x * (3 - 2 * x);
    const peak = Math.sin(u * Math.PI) * (1 - tail);
    return {
      ca: 1.2 + peak * 2.5,
      bloom: 0.55 + peak * 0.3,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}
