import * as THREE from 'three';
import {
  OXYGEN_GREEN,
  OXYGEN_RED,
  NITROGEN_N2P_VIOLET,
  wavelengthToLinearSRGB,
  type RGB,
} from '../spectrum';
import { GLSL_NOISE } from './noise';

const f5 = (x: number) => x.toFixed(5);
const v3 = (c: RGB) => `vec3(${f5(c[0])}, ${f5(c[1])}, ${f5(c[2])})`;

// Precomputed linear sRGB spectral emission colors at quantum lines
const COL_BLUE = wavelengthToLinearSRGB(NITROGEN_N2P_VIOLET, 'peak');
const COL_GREEN = wavelengthToLinearSRGB(OXYGEN_GREEN, 'peak');
const COL_RED = wavelengthToLinearSRGB(OXYGEN_RED, 'peak');

export interface AuroraShaderOptions {
  includeNoise?: boolean;
  baseY?: number;
  height?: number;
}

/**
 * Build the GLSL chunk for procedural Aurora curtains.
 * Contains:
 *  - Spectral line constants: N2+ (391.4 nm), OI Green (557.7 nm), OI Red (630.0 nm)
 *  - sampleAuroraEmission(float alt): Altitude-dependent quantum emission blend
 *  - sampleAurora(vec3 pos, float time): Full curl-noise modulated curtain emission
 *  - auroraVolDensity / auroraVolEmission: Volume integration interfaces for RaymarchPass
 */
export function buildGLSLAurora(opts: AuroraShaderOptions = {}): string {
  const incNoise = opts.includeNoise ?? false;
  const baseY = opts.baseY ?? 0.0;
  const height = opts.height ?? 10.0;

  return /* glsl */ `
${incNoise ? GLSL_NOISE : ''}

// ---- Atmospheric Auroral Quantum Emission Lines ----
const float AURORA_NM_BLUE  = ${NITROGEN_N2P_VIOLET.toFixed(1)}; // 391.4 nm: N2+ first negative band
const float AURORA_NM_GREEN = ${OXYGEN_GREEN.toFixed(1)};         // 557.7 nm: [OI] forbidden transition
const float AURORA_NM_RED   = ${OXYGEN_RED.toFixed(1)};           // 630.0 nm: [OI] high-altitude red

const vec3 AURORA_COL_BLUE  = ${v3(COL_BLUE)};
const vec3 AURORA_COL_GREEN = ${v3(COL_GREEN)};
const vec3 AURORA_COL_RED   = ${v3(COL_RED)};

#ifndef AURORA_BASE
#define AURORA_BASE ${f5(baseY)}
#endif
#ifndef AURORA_HEIGHT
#define AURORA_HEIGHT ${f5(height)}
#endif

/**
 * Altitude-dependent spectral emission profile.
 * - alt in [0.0..0.2]: N2+ violet-blue fringe transitioning to oxygen green (100-150 km)
 * - alt in [0.2..0.3]: Pure forbidden oxygen green (150 km)
 * - alt in [0.3..0.9]: Transition to long-lifetime oxygen red (150-300 km)
 * - alt in [0.9..1.0]: Pure oxygen red upper veil (300 km)
 */
vec3 sampleAuroraEmission(float alt) {
  float a = clamp(alt, 0.0, 1.0);
  vec3 emission = mix(AURORA_COL_BLUE, AURORA_COL_GREEN, smoothstep(0.0, 0.2, a));
  emission = mix(emission, AURORA_COL_RED, smoothstep(0.3, 0.9, a));
  return emission;
}

/**
 * Sample aurora curtain radiance at 3D world coordinate and time.
 * Evaluates:
 *  1. Altitude coordinate [0..1]
 *  2. Curl noise 3D curtain displacement and folds
 *  3. Fast vertical precipitation striations
 *  4. Altitude exponential rarefaction
 */
vec3 sampleAurora(vec3 pos, float time) {
  float alt = clamp((pos.y - AURORA_BASE) / AURORA_HEIGHT, 0.0, 1.0);

  // Ribbon curtain folds driven by divergence-free curl noise
  vec3 noiseOffset = curlNoise3(vec3(pos.x * 0.1, 0.0, pos.z * 0.1), time * 0.05);
  float curtainDensity = smoothstep(0.4, 0.0, abs(pos.z + noiseOffset.x * 2.0));

  // Fast vertical striations (charged particle precipitation along field lines)
  float rayFold = sin(pos.x * 5.0 + noiseOffset.y * 3.0);
  curtainDensity *= (0.6 + 0.4 * rayFold);

  // Spectral emission blend
  vec3 emission = sampleAuroraEmission(alt);

  // Upper ionosphere rarefaction falloff
  return emission * curtainDensity * exp(-alt * 1.5);
}

/**
 * Volume extinction density for RaymarchPass (volDensity).
 */
float auroraVolDensity(vec3 pos, float time) {
  float alt = clamp((pos.y - AURORA_BASE) / AURORA_HEIGHT, 0.0, 1.0);
  if (alt <= 0.0 || alt >= 1.0) return 0.0;

  vec3 noiseOffset = curlNoise3(vec3(pos.x * 0.1, 0.0, pos.z * 0.1), time * 0.05);
  float curtainDensity = smoothstep(0.4, 0.0, abs(pos.z + noiseOffset.x * 2.0));
  float rayFold = sin(pos.x * 5.0 + noiseOffset.y * 3.0);

  return curtainDensity * (0.6 + 0.4 * rayFold) * exp(-alt * 1.5);
}

/**
 * Volume emitted radiance for RaymarchPass (volEmission).
 */
vec3 auroraVolEmission(vec3 pos, float time) {
  float alt = clamp((pos.y - AURORA_BASE) / AURORA_HEIGHT, 0.0, 1.0);
  return sampleAuroraEmission(alt);
}
`;
}

/** Default shared GLSL aurora snippet (without re-declaring GLSL_NOISE). */
export const GLSL_AURORA = buildGLSLAurora({ includeNoise: false });

/** Aurora snippet bundled with GLSL_NOISE for standalone passes. */
export const GLSL_AURORA_STANDALONE = buildGLSLAurora({ includeNoise: true });

export interface AuroraCurtainMaterialOpts {
  baseY?: number;
  height?: number;
  intensity?: number;
  foldGain?: number;
  striationSpeed?: number;
  time?: number;
}

/**
 * Create a specialized ShaderMaterial for Aurora curtain mesh sheets.
 * Uses additive blending and high-precision depth-independent emission.
 */
export function createAuroraCurtainMaterial(opts: AuroraCurtainMaterialOpts = {}): THREE.ShaderMaterial {
  const baseY = opts.baseY ?? 0.0;
  const height = opts.height ?? 10.0;
  const intensity = opts.intensity ?? 1.5;
  const foldGain = opts.foldGain ?? 1.0;
  const striationSpeed = opts.striationSpeed ?? 1.0;
  const initialTime = opts.time ?? 0.0;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: initialTime },
      uBaseY: { value: baseY },
      uHeight: { value: height },
      uIntensity: { value: intensity },
      uFoldGain: { value: foldGain },
      uStriationSpeed: { value: striationSpeed },
    },
    vertexShader: /* glsl */ `
      ${GLSL_NOISE}

      uniform float uTime;
      uniform float uBaseY;
      uniform float uHeight;
      uniform float uFoldGain;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vAltitude;

      void main() {
        vUv = uv;
        vAltitude = uv.y;

        // Displace curtain vertices with curl noise along normal
        vec3 p = position;
        vec3 noiseOffset = curlNoise3(vec3(p.x * 0.1, p.y * 0.05, p.z * 0.1), uTime * 0.05);
        p.xz += noiseOffset.xz * uFoldGain * (0.3 + 0.7 * uv.y);

        vec4 worldPos = modelMatrix * vec4(p, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_AURORA}

      uniform float uTime;
      uniform float uIntensity;
      uniform float uStriationSpeed;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vAltitude;

      void main() {
        float alt = vAltitude;

        // Base spectral emission
        vec3 emission = sampleAuroraEmission(alt);

        // Micro-striations
        vec3 noiseOffset = curlNoise3(vec3(vWorldPos.x * 0.15, 0.0, vWorldPos.z * 0.15), uTime * 0.05 * uStriationSpeed);
        float rayFold = sin(vWorldPos.x * 6.0 + noiseOffset.y * 4.0 + vWorldPos.y * 0.5);
        float striation = 0.65 + 0.35 * rayFold;

        // Vertical exponential rarefaction
        float falloff = exp(-alt * 1.5);
        float alpha = striation * falloff;

        // Edge fade across path endpoints
        float edgeFade = smoothstep(0.0, 0.05, vUv.x) * (1.0 - smoothstep(0.95, 1.0, vUv.x));
        alpha *= edgeFade;

        vec3 finalColor = emission * alpha * uIntensity;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
  });
}

export interface AuroraRaymarchMaterialOpts {
  baseY?: number;
  height?: number;
  intensity?: number;
  steps?: number;
  boxMin?: THREE.Vector3;
  boxMax?: THREE.Vector3;
  time?: number;
}

/**
 * Create a volumetric raymarching ShaderMaterial for full 3D aurora volume slabs.
 */
export function createAuroraRaymarchMaterial(opts: AuroraRaymarchMaterialOpts = {}): THREE.ShaderMaterial {
  const baseY = opts.baseY ?? 0.0;
  const height = opts.height ?? 10.0;
  const intensity = opts.intensity ?? 1.5;
  const steps = opts.steps ?? 48;
  const boxMin = opts.boxMin ?? new THREE.Vector3(-25, baseY, -25);
  const boxMax = opts.boxMax ?? new THREE.Vector3(25, baseY + height, 25);
  const initialTime = opts.time ?? 0.0;

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {
      uTime: { value: initialTime },
      uBaseY: { value: baseY },
      uHeight: { value: height },
      uIntensity: { value: intensity },
      uSteps: { value: steps },
      uBoxMin: { value: boxMin },
      uBoxMax: { value: boxMax },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      ${GLSL_NOISE}
      ${GLSL_AURORA}

      uniform float uTime;
      uniform float uIntensity;
      uniform int uSteps;
      uniform vec3 uBoxMin;
      uniform vec3 uBoxMax;

      varying vec3 vWorldPos;

      // Ray-box intersection
      bool intersectBox(vec3 ro, vec3 rd, vec3 boxMin, vec3 boxMax, out float tNear, out float tFar) {
        vec3 invR = 1.0 / rd;
        vec3 t0 = (boxMin - ro) * invR;
        vec3 t1 = (boxMax - ro) * invR;
        vec3 tMin = min(t0, t1);
        vec3 tMax = max(t0, t1);
        tNear = max(max(tMin.x, tMin.y), tMin.z);
        tFar  = min(min(tMax.x, tMax.y), tMax.z);
        return tFar > max(tNear, 0.0);
      }

      void main() {
        vec3 ro = cameraPosition;
        vec3 rd = normalize(vWorldPos - ro);

        float tNear, tFar;
        if (!intersectBox(ro, rd, uBoxMin, uBoxMax, tNear, tFar)) {
          discard;
        }

        tNear = max(tNear, 0.0);
        float marchDist = tFar - tNear;
        float dt = marchDist / float(uSteps);
        float t = tNear + dt * 0.5;

        vec3 accum = vec3(0.0);
        for (int i = 0; i < 96; i++) {
          if (i >= uSteps || t > tFar) break;
          vec3 p = ro + rd * t;
          vec3 rad = sampleAurora(p, uTime);
          accum += rad * dt;
          t += dt;
        }

        vec3 col = accum * uIntensity;
        float alpha = clamp(length(col), 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}
