// Physical Depth-Based Depth of Field & Bokeh (P7b).
// Optical thin-lens Circle of Confusion (CoC), aperture blade diaphragm simulation,
// depth-aware bilateral gather sampling, and IGN blue-noise jitter.

import * as THREE from 'three';
import { FSPass, makeRT, W, H, PW, PH } from './gl';
import { GLSL_DOF_FRAG } from './glsl/dof';

export interface DepthDoFParams {
  /** Whether physical depth DoF is enabled. */
  enabled: boolean;
  /** World units along camera forward vector where objects are in critical focus. */
  focusDistance: number;
  /** Lens opening diameter scale in pixels [0..64]. */
  aperture: number;
  /** Maximum blur radius clamp in pixels (default 24.0). */
  maxRadius?: number;
  /** Aperture diaphragm blade count: 0 = circular, 6 = hexagonal, 9 = cinema 9-blade. */
  blades?: number;
  /** Anamorphic squeeze ratio: 1.0 = spherical circular bokeh, 2.0 = 2x anamorphic vertical oval. */
  anamorphicRatio?: number;
  /** Camera near clip distance (default 0.1). */
  near?: number;
  /** Camera far clip distance (default 1000.0). */
  far?: number;
  /** Number of gather samples in Vogel's spiral (default 32, clamped 8..64). */
  samples?: number;
}

export const DEFAULT_DEPTH_DOF: DepthDoFParams = {
  enabled: false,
  focusDistance: 5.0,
  aperture: 16.0,
  maxRadius: 24.0,
  blades: 0,
  anamorphicRatio: 1.0,
  near: 0.1,
  far: 1000.0,
  samples: 32,
};

/**
 * Optical Circle of Confusion (CoC) radius in pixels.
 * C(z) = clamp(|1 - d_focus / z| * aperture, 0, maxRadius)
 */
export function calcCoC(z: number, focusDistance: number, aperture: number, maxRadius = 24.0): number {
  if (z <= 0 || focusDistance <= 0 || aperture <= 0) return 0;
  const raw = Math.abs(1.0 - focusDistance / z) * aperture;
  return Math.max(0.0, Math.min(raw, maxRadius));
}

/**
 * Convert non-linear perspective depth buffer value in [0, 1] into eye-space distance z > 0.
 * z = (near * far) / (far - zBuffer * (far - near))
 */
export function linearizeDepth(zBuffer: number, near = 0.1, far = 1000.0): number {
  const denom = far - zBuffer * (far - near);
  return (near * far) / Math.max(denom, 1e-7);
}

/**
 * Evaluate aperture diaphragm transmission at unit offset (returns 0..1).
 * Supports circular (blades < 3), polygonal blades (e.g. 6 = hexagon), and anamorphic ratio.
 */
export function evalAperture(
  x: number,
  y: number,
  blades = 0,
  anamorphicRatio = 1.0,
): number {
  const px = x * Math.max(anamorphicRatio, 0.01);
  const py = y;
  const r = Math.hypot(px, py);
  if (r < 1e-5) return 1.0;
  if (blades < 3) {
    if (r <= 0.95) return 1.0;
    if (r >= 1.05) return 0.0;
    return (1.05 - r) / 0.1;
  }
  const angle = Math.atan2(py, px);
  const n = blades;
  const segment = (2 * Math.PI) / n;
  const halfSeg = segment * 0.5;
  const phi = ((angle % segment + segment) % segment) - halfSeg;
  const rPoly = (r * Math.cos(phi)) / Math.cos(halfSeg);
  if (rPoly <= 0.95) return 1.0;
  if (rPoly >= 1.05) return 0.0;
  return (1.05 - rPoly) / 0.1;
}

/**
 * Depth-aware bilateral gather weight for sample i relative to center pixel.
 * Prevents background bleeding onto sharp foreground silhouettes while allowing
 * out-of-focus foreground to bleed over the background.
 */
export function calcBilateralWeight(
  centerZ: number,
  centerCoC: number,
  sampleZ: number,
  sampleCoC: number,
  distPx: number,
  shapeWeight = 1.0,
): number {
  if (shapeWeight <= 0) return 0;
  if (sampleZ < centerZ - 0.05) {
    // Foreground sample expands over background if distPx <= sampleCoC
    const bleed = Math.max(0, Math.min(1, (sampleCoC - distPx + 1.0) / 1.5));
    return bleed * shapeWeight;
  } else {
    // Background sample only gathered if center pixel is blurred (distPx <= centerCoC)
    const blur = Math.max(0, Math.min(1, (centerCoC - distPx + 1.0) / 1.5));
    const depthDelta = Math.max(0, sampleZ - centerZ);
    const depthAtten = Math.max(0, Math.min(1, 1.0 - depthDelta / Math.max(centerZ * 0.5, 1.0)));
    return blur * shapeWeight * depthAtten;
  }
}

export class DepthDoFPass {
  private pass: FSPass;
  private rt: THREE.WebGLRenderTarget;

  constructor() {
    this.rt = makeRT(W, H, { depthBuffer: false });
    this.pass = new FSPass(GLSL_DOF_FRAG, {
      colorTex: { value: null },
      depthTex: { value: null },
      res: { value: new THREE.Vector2(PW, PH) },
      focusDistance: { value: 5.0 },
      aperture: { value: 16.0 },
      maxRadius: { value: 24.0 },
      blades: { value: 0 },
      anamorphicRatio: { value: 1.0 },
      near: { value: 0.1 },
      far: { value: 1000.0 },
      samples: { value: 32 },
    });
  }

  /**
   * Render depth-based defocus blur & bokeh.
   * If disabled or aperture <= 0, returns colorTex directly.
   */
  render(
    renderer: THREE.WebGLRenderer,
    colorTex: THREE.Texture,
    depthTex: THREE.Texture,
    params: Partial<DepthDoFParams> = {},
    out?: THREE.WebGLRenderTarget | null,
  ): THREE.Texture {
    const p = { ...DEFAULT_DEPTH_DOF, ...params };
    if (!p.enabled || p.aperture <= 0.001 || (p.maxRadius !== undefined && p.maxRadius <= 0.001)) {
      return colorTex;
    }

    const target = out !== undefined ? out : this.rt;
    const targetW = target ? target.width : PW;
    const targetH = target ? target.height : PH;

    const u = this.pass.u;
    u.colorTex!.value = colorTex;
    u.depthTex!.value = depthTex;
    (u.res!.value as THREE.Vector2).set(targetW, targetH);
    u.focusDistance!.value = p.focusDistance;
    u.aperture!.value = p.aperture;
    u.maxRadius!.value = p.maxRadius ?? 24.0;
    u.blades!.value = p.blades ?? 0;
    u.anamorphicRatio!.value = p.anamorphicRatio ?? 1.0;
    u.near!.value = p.near ?? 0.1;
    u.far!.value = p.far ?? 1000.0;
    u.samples!.value = Math.max(8, Math.min(64, Math.round(p.samples ?? 32)));

    this.pass.render(renderer, target);
    return target ? target.texture : colorTex;
  }

  dispose() {
    this.pass.dispose();
    this.rt.dispose();
  }
}
