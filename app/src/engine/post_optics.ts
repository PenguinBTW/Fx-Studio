// Photon optics: a physical-ish point-spread function applied to HDR pixels above a threshold.
//   bright (half-res, thresholded) -> diffraction spikes (3-pass star streaks per aperture axis, per-channel length)
//                                  -> airy disk (21x21 gather with a CPU-built per-channel kernel) -> added in post's final pass.
// Every kernel has unit energy, so the result does not depend on resolution; `intensity` scales the added light.
// Wavelength dependence: red diffracts wider than blue (OPTICS_WAVELENGTH_SCALE) for spike length and airy radius.
import * as THREE from 'three';
import { FSPass, makeRT, W, H, SCALE } from './gl';

type V3 = [number, number, number];

export interface OpticsParams {
  /** Linear max-channel level where a pixel starts to feed the optics (default 2: only true HDR highlights). */
  threshold: number;
  /** Aperture blades: 4 (2 crossing lines), 6 (3 lines, hexagonal aperture), 0 = airy disk only. */
  spikes: 0 | 4 | 6;
  /** Spike reach in logical px for green (red is 1.3x longer, blue 0.75x). Brightness has fallen to ~3% at this distance. */
  spikeLength: number;
  /** Radius in logical px of the first dark ring of the green airy pattern, 1..8 (0 = no airy disk). */
  airyRadius: number;
  /** Strength of the added light (1 = the thresholded highlight energy is re-spread once, per kernel). */
  intensity: number;
  /** Linear RGB multiplier on the result: the wavelength-tint hook (e.g. a spectrum colour). Plain value, no dependencies. */
  tint: V3;
  /** Rotation of the spike pattern in radians. */
  angle: number;
}

export const DEFAULT_OPTICS: OpticsParams = {
  threshold: 2, spikes: 6, spikeLength: 160, airyRadius: 4, intensity: 0.6, tint: [1, 1, 1], angle: 0,
};

/** Relative diffraction scale of the R, G, B channels (~ 630 / 530 / 450 nm, softened). */
export const OPTICS_WAVELENGTH_SCALE: V3 = [1.3, 1.0, 0.75];

const AIRY_R = 10; // kernel half-size in half-res texels (21 x 21); airy radius is capped so this still holds >= 2.5 rings
const MASK_CELL = 16; // half-res texels per mask cell (empty-neighbourhood early-out of the airy gather)
const STREAK_TAPS = 3; // taps each side per pass; 3 passes with steps 1, 7, 49 cover +-171 steps without gaps
const FIRST_ZERO = 3.8317059702; // first zero of J1

// J1 by its integral form with a periodic trapezoid rule (exponentially convergent; 512 points is exact for x < ~200)
function besselJ1(x: number): number {
  const n = 512;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const tau = (Math.PI * (i + 0.5)) / n;
    s += Math.cos(tau - x * Math.sin(tau));
  }
  return s / n;
}

function airyIntensity(x: number): number {
  if (x < 1e-6) return 1;
  const a = (2 * besselJ1(x)) / x;
  return a * a;
}

/** RGBA32F (2R+1)^2 kernel, sum of each channel = 1. Exported for tests. */
export function buildAiryKernel(airyRadius: number): Float32Array {
  const n = AIRY_R * 2 + 1;
  const data = new Float32Array(n * n * 4);
  const sums = [0, 0, 0];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const rLogical = Math.hypot(i - AIRY_R, j - AIRY_R) * 2;
      for (let c = 0; c < 3; c++) {
        const v = airyIntensity((FIRST_ZERO * rLogical) / (airyRadius * OPTICS_WAVELENGTH_SCALE[c]!));
        data[(j * n + i) * 4 + c] = v;
        sums[c]! += v;
      }
    }
  }
  for (let k = 0; k < n * n; k++) for (let c = 0; c < 3; c++) data[k * 4 + c]! /= sums[c]!;
  return data;
}

export class OpticsPass {
  private bright: FSPass;
  private maskPass: FSPass;
  private streak: FSPass;
  private airy: FSPass;
  private rtBright = makeRT(W >> 1, H >> 1, { depthBuffer: false, pxScale: 1 });
  private rtA = makeRT(W >> 1, H >> 1, { depthBuffer: false, pxScale: 1 });
  private rtB = makeRT(W >> 1, H >> 1, { depthBuffer: false, pxScale: 1 });
  private rtC0 = makeRT(W >> 1, H >> 1, { depthBuffer: false, pxScale: 1 });
  private rtC1 = makeRT(W >> 1, H >> 1, { depthBuffer: false, pxScale: 1 });
  private rtMask = makeRT(Math.ceil((W >> 1) / MASK_CELL), Math.ceil((H >> 1) / MASK_CELL), {
    depthBuffer: false, pxScale: 1, type: THREE.HalfFloatType, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter,
  });
  private kernelTex: THREE.DataTexture;
  private kernelKey = NaN;

  constructor() {
    const hw = W >> 1, hh = H >> 1;
    this.bright = new FSPass(/* glsl */ `
      uniform sampler2D src; uniform vec2 texel; uniform float threshold;
      vec3 th(vec3 c) {
        c = min(c, vec3(500.0));
        float m = max(c.r, max(c.g, c.b));
        return c * (max(m - threshold, 0.0) / max(m, 1e-5));
      }
      void main() {
        // every physical px of the 2x2-logical-px block, thresholded one by one so a single hot pixel keeps its energy
        const int N = ${SCALE * 2};
        vec3 c = vec3(0.0);
        for (int j = 0; j < N; j++) for (int i = 0; i < N; i++)
          c += th(texture(src, vUv + texel * (vec2(float(i), float(j)) * 2.0 - float(N - 1)) / (2.0 * PX_SCALE)).rgb);
        fragColor = vec4(c / float(N * N), 1.0);
      }`, { src: { value: null }, texel: { value: new THREE.Vector2(1 / W, 1 / H) }, threshold: { value: 2 } });

    this.maskPass = new FSPass(/* glsl */ `
      uniform sampler2D src; uniform ivec2 size;
      void main() {
        ivec2 base = ivec2(gl_FragCoord.xy) * ${MASK_CELL};
        float m = 0.0;
        for (int j = 0; j < ${MASK_CELL}; j++) for (int i = 0; i < ${MASK_CELL}; i++) {
          vec3 b = texelFetch(src, min(base + ivec2(i, j), size - 1), 0).rgb;
          m = max(m, max(b.r, max(b.g, b.b)));
        }
        fragColor = vec4(m, 0.0, 0.0, 1.0);
      }`, { src: { value: null }, size: { value: new THREE.Vector2(hw, hh) } });

    this.streak = new FSPass(/* glsl */ `
      uniform sampler2D src; uniform sampler2D prev;
      uniform vec2 texel; uniform vec2 dir; uniform float stepTex, decayStep, gain; uniform vec3 scales; uniform bool addPrev;
      void main() {
        vec3 acc = vec3(0.0); float ws = 0.0;
        for (int j = -${STREAK_TAPS}; j <= ${STREAK_TAPS}; j++) {
          float w = exp(-abs(float(j)) * decayStep);
          vec2 o = dir * texel * (float(j) * stepTex);
          acc += w * vec3(texture(src, vUv + o * scales.r).r, texture(src, vUv + o * scales.g).g, texture(src, vUv + o * scales.b).b);
          ws += w;
        }
        vec3 r = acc / ws * gain;
        if (addPrev) r += texture(prev, vUv).rgb;
        fragColor = vec4(r, 1.0);
      }`, {
      src: { value: null }, prev: { value: null }, texel: { value: new THREE.Vector2(1 / hw, 1 / hh) }, dir: { value: new THREE.Vector2(1, 0) },
      stepTex: { value: 1 }, decayStep: { value: 0 }, gain: { value: 1 }, scales: { value: new THREE.Vector3(...OPTICS_WAVELENGTH_SCALE) }, addPrev: { value: false },
    });

    const n = AIRY_R * 2 + 1;
    this.kernelTex = new THREE.DataTexture(new Float32Array(n * n * 4), n, n, THREE.RGBAFormat, THREE.FloatType);
    this.kernelTex.minFilter = this.kernelTex.magFilter = THREE.NearestFilter;
    this.kernelTex.generateMipmaps = false;

    this.airy = new FSPass(/* glsl */ `
      uniform sampler2D bright; uniform sampler2D mask; uniform sampler2D kernel; uniform sampler2D spikeTex;
      uniform vec2 texel; uniform vec2 maskTexel; uniform bool spikeOn, airyOn;
      void main() {
        vec3 o = spikeOn ? texture(spikeTex, vUv).rgb : vec3(0.0);
        if (airyOn) {
          float m = 0.0;
          for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) m = max(m, texture(mask, vUv + vec2(i, j) * maskTexel).r);
          if (m > 0.0) {
            vec3 a = vec3(0.0);
            for (int j = -${AIRY_R}; j <= ${AIRY_R}; j++) for (int i = -${AIRY_R}; i <= ${AIRY_R}; i++)
              a += texture(bright, vUv + vec2(i, j) * texel).rgb * texelFetch(kernel, ivec2(i + ${AIRY_R}, j + ${AIRY_R}), 0).rgb;
            o += a;
          }
        }
        fragColor = vec4(o, 1.0);
      }`, {
      bright: { value: null }, mask: { value: null }, kernel: { value: this.kernelTex }, spikeTex: { value: null },
      texel: { value: new THREE.Vector2(1 / hw, 1 / hh) }, maskTexel: { value: new THREE.Vector2(MASK_CELL / hw, MASK_CELL / hh) },
      spikeOn: { value: false }, airyOn: { value: true },
    });
  }

  /** Returns a half-res HDR texture of the added light (before `intensity` and `tint`, applied by the caller). */
  render(renderer: THREE.WebGLRenderer, src: THREE.Texture, p: OpticsParams): THREE.Texture {
    this.bright.u.src!.value = src;
    this.bright.u.threshold!.value = p.threshold;
    this.bright.render(renderer, this.rtBright);

    const airyRadius = Math.min(8, Math.max(1, p.airyRadius));
    const airyOn = p.airyRadius > 0;
    if (airyOn) {
      if (this.kernelKey !== airyRadius) {
        (this.kernelTex.image.data as Float32Array).set(buildAiryKernel(airyRadius));
        this.kernelTex.needsUpdate = true;
        this.kernelKey = airyRadius;
      }
      this.maskPass.u.src!.value = this.rtBright.texture;
      this.maskPass.render(renderer, this.rtMask);
    }

    const axes = p.spikes === 4 ? 2 : p.spikes === 6 ? 3 : 0;
    let acc: THREE.WebGLRenderTarget | null = null;
    if (axes > 0) {
      const u = this.streak.u;
      const s0 = (0.75 * Math.max(p.spikeLength, 1)) / (STREAK_TAPS * (1 + 7 + 49)); // texels, green
      u.gain!.value = 1;
      for (let a = 0; a < axes; a++) {
        const ang = p.angle + (a * Math.PI) / axes;
        (u.dir!.value as THREE.Vector2).set(Math.cos(ang), Math.sin(ang));
        let from = this.rtBright;
        for (let k = 0; k < 3; k++) {
          const step = s0 * Math.pow(7, k);
          u.stepTex!.value = step;
          u.decayStep!.value = (step * 2 * 3.5) / Math.max(p.spikeLength, 1); // e-fold per tap, the same for every channel
          u.src!.value = from.texture;
          const last = k === 2;
          const to: THREE.WebGLRenderTarget = k === 0 ? this.rtA : k === 1 ? this.rtB : (acc === this.rtC0 ? this.rtC1 : this.rtC0);
          if (last) {
            u.addPrev!.value = acc !== null;
            u.prev!.value = acc ? acc.texture : this.rtBright.texture;
            u.gain!.value = 1 / axes;
          } else {
            u.addPrev!.value = false;
            u.gain!.value = 1;
          }
          this.streak.render(renderer, to);
          from = to;
          if (last) acc = to;
        }
      }
    }

    const au = this.airy.u;
    au.bright!.value = this.rtBright.texture;
    au.mask!.value = this.rtMask.texture;
    au.spikeTex!.value = acc ? acc.texture : this.rtBright.texture;
    au.spikeOn!.value = acc !== null;
    au.airyOn!.value = airyOn;
    this.airy.render(renderer, this.rtA);
    return this.rtA.texture;
  }

  dispose() {
    for (const rt of [this.rtBright, this.rtA, this.rtB, this.rtC0, this.rtC1, this.rtMask]) rt.dispose();
    this.kernelTex.dispose();
    this.bright.dispose();
    this.maskPass.dispose();
    this.streak.dispose();
    this.airy.dispose();
  }
}
