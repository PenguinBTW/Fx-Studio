import * as THREE from 'three';
import {
  OXYGEN_GREEN,
  OXYGEN_RED,
  NITROGEN_N2P_VIOLET,
  wavelengthToLinearSRGB,
  type RGB,
} from './spectrum';
import { createNoise } from './noise';
import {
  type V3,
  v3Lerp,
  v3Norm,
  v3Cross,
  v3Sub,
  smoothstep,
  clamp,
} from './util';
import {
  GLSL_AURORA,
  createAuroraCurtainMaterial,
  createAuroraRaymarchMaterial,
  type AuroraCurtainMaterialOpts,
  type AuroraRaymarchMaterialOpts,
} from './glsl/aurora';

export {
  GLSL_AURORA,
  createAuroraCurtainMaterial,
  createAuroraRaymarchMaterial,
  type AuroraCurtainMaterialOpts,
  type AuroraRaymarchMaterialOpts,
};

// ---------------------------------------------------------------------------------------------
// Atmospheric Altitude and Quantum Transition Constants
// ---------------------------------------------------------------------------------------------
/** Auroral base altitude (km): energetic particle penetration floor. */
export const AURORA_BASE_KM = 100;
/** Auroral upper limit (km): thermosphere boundary. */
export const AURORA_TOP_KM = 300;
/** Total vertical curtain thickness (km). */
export const AURORA_HEIGHT_KM = 200;

/** N2+ first negative band, 391.4 nm: violet-blue curtain bottom boundary. */
export const AURORA_WAVELENGTH_NITROGEN_BLUE = NITROGEN_N2P_VIOLET; // 391.4 nm
/** [OI] 557.7 nm: atomic oxygen green (forbidden transition at 100-150 km). */
export const AURORA_WAVELENGTH_OXYGEN_GREEN = OXYGEN_GREEN;         // 557.7 nm
/** [OI] 630.0 nm: atomic oxygen red (long radiative lifetime ~110s at 150-300 km). */
export const AURORA_WAVELENGTH_OXYGEN_RED = OXYGEN_RED;             // 630.0 nm

/** Linear sRGB emission color for Molecular Nitrogen 391.4 nm. */
export const AURORA_COLOR_BLUE: RGB = wavelengthToLinearSRGB(AURORA_WAVELENGTH_NITROGEN_BLUE, 'peak');
/** Linear sRGB emission color for Atomic Oxygen 557.7 nm. */
export const AURORA_COLOR_GREEN: RGB = wavelengthToLinearSRGB(AURORA_WAVELENGTH_OXYGEN_GREEN, 'peak');
/** Linear sRGB emission color for Atomic Oxygen 630.0 nm. */
export const AURORA_COLOR_RED: RGB = wavelengthToLinearSRGB(AURORA_WAVELENGTH_OXYGEN_RED, 'peak');

/** Default CPU noise field instance (seed 0 matches GLSL_NOISE default). */
const cpuNoise = createNoise(0);

/**
 * Normalized altitude coordinate [0..1] mapped from kilometers:
 * 100 km -> 0.0, 300 km -> 1.0.
 */
export function altitudeKmToNormalized(altKm: number): number {
  return clamp((altKm - AURORA_BASE_KM) / AURORA_HEIGHT_KM, 0, 1);
}

/**
 * Compute the quantum atmospheric spectral emission color at normalized altitude in [0, 1].
 *
 *  - alt in [0.0..0.2] (100-140 km): Nitrogen violet-blue (391.4 nm) transitioning to Oxygen green.
 *  - alt in [0.2..0.3] (140-160 km): Pure forbidden Oxygen green (557.7 nm).
 *  - alt in [0.3..0.9] (160-280 km): Transition from Oxygen green to long-lived Oxygen red (630.0 nm).
 *  - alt in [0.9..1.0] (280-300 km): Pure Oxygen red upper veil.
 */
export function sampleAuroraEmission(alt01: number): RGB {
  const alt = clamp(alt01, 0, 1);
  const blueToGreen = smoothstep(0.0, 0.2, alt);
  const greenToRed = smoothstep(0.3, 0.9, alt);

  const baseBlend = v3Lerp(AURORA_COLOR_BLUE, AURORA_COLOR_GREEN, blueToGreen);
  return v3Lerp(baseBlend, AURORA_COLOR_RED, greenToRed);
}

export interface AuroraSampleOpts {
  baseY?: number;
  height?: number;
}

export interface AuroraSampleResult {
  alt: number;
  curtainDensity: number;
  finalDensity: number;
  spectralCol: RGB;
  emission: RGB;
}

/**
 * CPU evaluation of sampleAurora(pos, time) matching GLSL shader sampleAurora().
 */
export function sampleAuroraCPU(
  pos: V3,
  time = 0,
  opts: AuroraSampleOpts = {}
): AuroraSampleResult {
  const baseY = opts.baseY ?? 0.0;
  const height = opts.height ?? 10.0;
  const alt = clamp((pos[1] - baseY) / height, 0, 1);

  // Divergence-free curl noise curtain folds
  const noiseOffset = cpuNoise.curlNoise3([pos[0] * 0.1, 0, pos[2] * 0.1], time * 0.05);
  const curtainDist = Math.abs(pos[2] + noiseOffset[0] * 2.0);
  let curtainDensity = smoothstep(0.4, 0.0, curtainDist);

  // Vertical particle precipitation striations
  const rayFold = Math.sin(pos[0] * 5.0 + noiseOffset[1] * 3.0);
  curtainDensity *= (0.6 + 0.4 * rayFold);

  // Quantum spectral emission blend
  const spectralCol = sampleAuroraEmission(alt);

  // Exponential rarefaction with altitude
  const rarefaction = Math.exp(-alt * 1.5);
  const finalDensity = curtainDensity * rarefaction;

  const emission: RGB = [
    spectralCol[0] * finalDensity,
    spectralCol[1] * finalDensity,
    spectralCol[2] * finalDensity,
  ];

  return {
    alt,
    curtainDensity,
    finalDensity,
    spectralCol,
    emission,
  };
}

export interface AuroraCurtainOptions {
  /** Number of segments along curtain length (horizontal). Default 128. */
  segmentsX?: number;
  /** Number of segments along curtain altitude (vertical). Default 32. */
  segmentsY?: number;
  /** World Y coordinate of curtain bottom boundary. Default 0. */
  baseY?: number;
  /** Vertical curtain height in world units. Default 10. */
  height?: number;
  /** Curtain horizontal length (for default arc). Default 30. */
  length?: number;
  /** Curl noise folding amplitude. Default 1.5. */
  foldAmplitude?: number;
  /** Custom horizontal guide curve (s in [0, 1], t?: number) => [x, z]. */
  pathFn?: (s: number, t?: number) => [number, number];
  /** Timeline time for procedural folding. Default 0. */
  time?: number;
}

/**
 * Procedural Aurora Curtain Geometry.
 *
 * Generates an extruded vertical curtain sheet along an auroral oval arc or spline path.
 * Per-vertex attributes:
 *  - position: 3D coordinates displaced by curl noise folds
 *  - normal: Surface normal for shading
 *  - uv: (u in [0, 1] along path, v in [0, 1] along altitude)
 *  - color: Pre-evaluated linear sRGB quantum spectral emission color
 *  - altitude: Normalized altitude scalar in [0, 1]
 */
export class AuroraCurtainGeometry extends THREE.BufferGeometry {
  private segmentsX: number;
  private segmentsY: number;
  private baseY: number;
  private height: number;
  private length: number;
  private foldAmplitude: number;
  private pathFn?: (s: number, t?: number) => [number, number];

  constructor(opts: AuroraCurtainOptions = {}) {
    super();

    this.segmentsX = Math.max(2, opts.segmentsX ?? 128);
    this.segmentsY = Math.max(2, opts.segmentsY ?? 32);
    this.baseY = opts.baseY ?? 0.0;
    this.height = opts.height ?? 10.0;
    this.length = opts.length ?? 30.0;
    this.foldAmplitude = opts.foldAmplitude ?? 1.5;
    this.pathFn = opts.pathFn;

    this.buildBuffers(opts.time ?? 0);
  }

  /**
   * Update the curtain geometry at timeline time t.
   * Deterministic, zero allocation in-place buffer update.
   */
  update(time: number): this {
    const posAttr = this.getAttribute('position') as THREE.BufferAttribute;
    const normAttr = this.getAttribute('normal') as THREE.BufferAttribute;
    const colAttr = this.getAttribute('color') as THREE.BufferAttribute;

    const pos = posAttr.array as Float32Array;
    const norm = normAttr.array as Float32Array;
    const col = colAttr.array as Float32Array;

    this.computeCurtainData(time, pos, norm, col);

    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.computeBoundingBox();
    this.computeBoundingSphere();
    return this;
  }

  private defaultPath(s: number): [number, number] {
    // Default auroral arc: gentle sinusoidal S-curve
    const x = (s - 0.5) * this.length;
    const z = Math.sin((s - 0.5) * Math.PI * 1.5) * (this.length * 0.15);
    return [x, z];
  }

  private buildBuffers(time: number): void {
    const nx = this.segmentsX + 1;
    const ny = this.segmentsY + 1;
    const numVertices = nx * ny;
    const numQuads = this.segmentsX * this.segmentsY;
    const numIndices = numQuads * 6;

    const pos = new Float32Array(numVertices * 3);
    const norm = new Float32Array(numVertices * 3);
    const uv = new Float32Array(numVertices * 2);
    const col = new Float32Array(numVertices * 3);
    const alt = new Float32Array(numVertices);
    const indices = numVertices > 65535 ? new Uint32Array(numIndices) : new Uint16Array(numIndices);

    // Initialize UVs and altitude coordinates (constant across time)
    for (let j = 0; j < ny; j++) {
      const v = j / (ny - 1);
      for (let i = 0; i < nx; i++) {
        const u = i / (nx - 1);
        const idx = j * nx + i;
        uv[idx * 2] = u;
        uv[idx * 2 + 1] = v;
        alt[idx] = v;
      }
    }

    // Quad triangulation indices
    let k = 0;
    for (let j = 0; j < this.segmentsY; j++) {
      for (let i = 0; i < this.segmentsX; i++) {
        const i0 = j * nx + i;
        const i1 = j * nx + (i + 1);
        const i2 = (j + 1) * nx + i;
        const i3 = (j + 1) * nx + (i + 1);

        // Tri 1: (i0, i1, i2)
        indices[k++] = i0;
        indices[k++] = i1;
        indices[k++] = i2;

        // Tri 2: (i1, i3, i2)
        indices[k++] = i1;
        indices[k++] = i3;
        indices[k++] = i2;
      }
    }

    this.computeCurtainData(time, pos, norm, col);

    this.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
    this.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.setAttribute('altitude', new THREE.BufferAttribute(alt, 1));
    this.setIndex(new THREE.BufferAttribute(indices, 1));

    this.computeBoundingBox();
    this.computeBoundingSphere();
  }

  private computeCurtainData(
    time: number,
    pos: Float32Array,
    norm: Float32Array,
    col: Float32Array
  ): void {
    const nx = this.segmentsX + 1;
    const ny = this.segmentsY + 1;

    for (let j = 0; j < ny; j++) {
      const v = j / (ny - 1);
      const y = this.baseY + v * this.height;
      const spectralColor = sampleAuroraEmission(v);

      for (let i = 0; i < nx; i++) {
        const u = i / (nx - 1);
        const [x0, z0] = this.pathFn ? this.pathFn(u, time) : this.defaultPath(u);

        // Curl noise folding offset at current vertex
        const noiseOffset = cpuNoise.curlNoise3([x0 * 0.1, y * 0.05, z0 * 0.1], time * 0.05);

        // Folds expand higher in the atmosphere (v = 0: grounded, v = 1: swirling)
        const altitudeExpansion = 0.3 + 0.7 * v;
        const x = x0 + noiseOffset[0] * this.foldAmplitude * altitudeExpansion;
        const z = z0 + noiseOffset[2] * this.foldAmplitude * altitudeExpansion;

        const vIdx = j * nx + i;
        pos[vIdx * 3] = x;
        pos[vIdx * 3 + 1] = y;
        pos[vIdx * 3 + 2] = z;

        col[vIdx * 3] = spectralColor[0];
        col[vIdx * 3 + 1] = spectralColor[1];
        col[vIdx * 3 + 2] = spectralColor[2];
      }
    }

    // Compute smooth normals using grid finite differences
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const vIdx = j * nx + i;
        const iLeft = j * nx + Math.max(0, i - 1);
        const iRight = j * nx + Math.min(nx - 1, i + 1);
        const jDown = Math.max(0, j - 1) * nx + i;
        const jUp = Math.min(ny - 1, j + 1) * nx + i;

        const dU: V3 = [
          pos[iRight * 3]! - pos[iLeft * 3]!,
          pos[iRight * 3 + 1]! - pos[iLeft * 3 + 1]!,
          pos[iRight * 3 + 2]! - pos[iLeft * 3 + 2]!,
        ];
        const dV: V3 = [
          pos[jUp * 3]! - pos[jDown * 3]!,
          pos[jUp * 3 + 1]! - pos[jDown * 3 + 1]!,
          pos[jUp * 3 + 2]! - pos[jDown * 3 + 2]!,
        ];

        const n = v3Norm(v3Cross(dU, dV));
        norm[vIdx * 3] = n[0];
        norm[vIdx * 3 + 1] = n[1];
        norm[vIdx * 3 + 2] = n[2];
      }
    }
  }
}

/**
 * Complete Aurora Curtain Mesh with procedural geometry and specialized shader material.
 */
export class AuroraCurtainMesh extends THREE.Mesh<AuroraCurtainGeometry, THREE.ShaderMaterial> {
  constructor(geomOpts: AuroraCurtainOptions = {}, matOpts: AuroraCurtainMaterialOpts = {}) {
    const geom = new AuroraCurtainGeometry(geomOpts);
    const mat = createAuroraCurtainMaterial({
      baseY: geomOpts.baseY,
      height: geomOpts.height,
      ...matOpts,
    });
    super(geom, mat);
  }

  /**
   * Scrub/update the aurora curtain to timeline time t.
   */
  update(time: number): void {
    this.geometry.update(time);
    if (this.material.uniforms.uTime) {
      this.material.uniforms.uTime.value = time;
    }
  }
}
