// =============================================================================
// GPU POINT CLOUD SHADER: "CHROMA: THE DOT ODYSSEY"
//
// Custom WebGL ShaderMaterial for high-density volumetric point clouds:
// - Up to 500,000 simultaneous active procedural points
// - Analytic Gaussian disc clipping with laser specular core (zero square pixels)
// - Physical distance-compensated point sizing (1.0px - 11.0px)
// - Inverse distance luminance scaling (prevents additive blowout on macro zoom)
// - Per-point quantum / LiDAR shimmer (subtle high-frequency phase twinkle)
// - GPU 3D analytic curl-noise micro-advection
// - Additive volumetric blending with optical bloom compatibility
// =============================================================================

import * as THREE from 'three';
import { W, H } from '../../engine/gl';

export function createDotOdysseyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      t: { value: 0 },
      uGlobalAlpha: { value: 1.0 },
      uResolution: { value: new THREE.Vector2(W, H) },
      uSizeMultiplier: { value: 1.0 },
      uTurbulence: { value: 1.0 },
      uWarpSpeed: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      uniform float t;
      uniform float uSizeMultiplier;
      uniform vec2 uResolution;
      uniform float uTurbulence;
      uniform float uWarpSpeed;

      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      attribute float aIntensity;
      attribute vec3 aVelocity;

      varying vec3 vColor;
      varying float vPhase;
      varying float vIntensity;

      // Fast analytic 3D sinusoidal curl turbulence
      vec3 fastCurl(vec3 p, float time) {
        float s1 = sin(p.y * 3.8 + time * 1.4 + p.z * 2.5);
        float c1 = cos(p.x * 3.4 + time * 1.2 + p.y * 2.0);
        float s2 = sin(p.z * 4.1 + time * 1.5 + p.x * 2.9);
        float c2 = cos(p.y * 2.8 + time * 0.9 + p.z * 1.7);
        return vec3(s1 * 0.5 + c2 * 0.5, c1 * 0.5 + s2 * 0.5, s2 * 0.5 + c1 * 0.5);
      }

      void main() {
        vColor = aColor;
        vPhase = aPhase;

        vec3 pos = position;

        // 1. Organic micro-turbulence
        if (uTurbulence > 0.01) {
          vec3 turb = fastCurl(pos * 2.5, t * 1.2 + aPhase * 6.28) * (0.012 * uTurbulence);
          pos += turb;
        }

        // 2. Relativistic Warp Speed Streaks
        if (uWarpSpeed > 0.01) {
          pos += aVelocity * (uWarpSpeed * 0.8);
        }

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        float dist = max(0.01, -mvPosition.z);

        // Constant world size -> perspective screen size
        float ptSize = aSize * (uResolution.y / dist) * 0.0055 * uSizeMultiplier;

        // Subtle organic phase breathing per particle
        ptSize *= (0.90 + 0.10 * sin(t * 4.0 + aPhase * 6.28318));

        // Clamped jewel-like stippling limit
        gl_PointSize = clamp(ptSize, 1.8, 22.0);
        gl_Position = projectionMatrix * mvPosition;

        // Depth radiance scaling
        float distFactor = clamp(dist * 0.45, 0.4, 1.2);
        vIntensity = aIntensity * distFactor;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float t;
      uniform float uGlobalAlpha;

      varying vec3 vColor;
      varying float vPhase;
      varying float vIntensity;

      void main() {
        // Disc coordinates in [-0.5, 0.5]
        vec2 uv = gl_PointCoord - vec2(0.5);
        float r2 = dot(uv, uv);

        if (r2 > 0.25) discard;

        // Smooth circular falloff + intense laser specular core
        float distCenter = sqrt(r2) * 2.0; // 0.0 at center, 1.0 at edge
        float disc = smoothstep(1.0, 0.15, distCenter);
        float core = exp(-r2 * 28.0);

        // Per-point quantum shimmer
        float shimmer = 0.90 + 0.10 * sin(t * 7.0 + vPhase * 12.566);

        // Radiant volumetric color
        vec3 col = vColor * (disc * 0.85 + core * 1.6) * vIntensity * shimmer;
        float alpha = disc * uGlobalAlpha;

        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
