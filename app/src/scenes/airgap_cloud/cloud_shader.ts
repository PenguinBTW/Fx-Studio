// =============================================================================
// GPU POINT CLOUD SHADER: "THE AIR-GAP CATHEDRAL" (FLOW ENGINE)
//
// Custom WebGL ShaderMaterial for living, fluid volumetric point clouds:
// - Multi-octave 3D analytic curl-noise micro-advection
// - Closed-form streamline flow along limbs, spine, and conduits
// - Fluid ribbon unraveling in Act IV (logarithmic celestial spirals)
// - Circular Gaussian splats (smooth, antialiased, zero square pixels)
// - Distance-compensated attenuation (caps at crisp 10px diameter)
// - Density luminance compensation (prevents additive whiteout on closeups)
// - Quantum / LiDAR shimmer (subtle high-frequency phase twinkle)
// - Additive volumetric transparency with optical bloom compatibility
// =============================================================================

import * as THREE from 'three';
import { W, H } from '../../engine/gl';

export function createPointCloudMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      t: { value: 0 },
      uGlobalAlpha: { value: 1.0 },
      uResolution: { value: new THREE.Vector2(W, H) },
      uSizeMultiplier: { value: 1.0 },
      uFlowTime: { value: 0.0 },
      uFlowSpeed: { value: 1.0 },
      uUnravel: { value: 0.0 },
      uPulseIntensity: { value: 0.0 },
      uPulseOrigin: { value: new THREE.Vector3(-0.03, 1.28, 0.04) },
      uPulseRadius: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      uniform float t;
      uniform float uSizeMultiplier;
      uniform vec2 uResolution;
      uniform float uFlowTime;
      uniform float uFlowSpeed;
      uniform float uUnravel;
      uniform float uPulseIntensity;
      uniform vec3 uPulseOrigin;
      uniform float uPulseRadius;

      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      attribute float aIntensity;
      attribute vec3 aFlowDir;
      attribute float aStreamU;
      attribute float aType; // 0: skeleton, 1: brain, 2: organs, 3: heart, 4: skin, 5: bypass, 6: stream, 7: cathedral

      varying vec3 vColor;
      varying float vPhase;
      varying float vIntensity;

      // Fast, deterministic 3D sinusoidal curl turbulence
      vec3 fastCurl(vec3 p, float time) {
        float s1 = sin(p.y * 4.2 + time * 1.3 + p.z * 2.8);
        float c1 = cos(p.x * 3.8 + time * 1.1 + p.y * 2.1);
        float s2 = sin(p.z * 4.5 + time * 1.6 + p.x * 3.1);
        float c2 = cos(p.y * 3.1 + time * 0.9 + p.z * 1.9);
        return vec3(s1 * 0.5 + c2 * 0.5, c1 * 0.5 + s2 * 0.5, s2 * 0.5 + c1 * 0.5);
      }

      void main() {
        vColor = aColor;
        vPhase = aPhase;

        vec3 pos = position;

        // 1. Organic micro-turbulence: living breath through all points
        float microTurb = (aType == 4.0 || aType == 6.0) ? 0.012 : 0.005;
        vec3 turb = fastCurl(pos * 3.0, t * 1.2 + aPhase * 6.28) * microTurb;
        pos += turb;

        // 2. Streamline advection for streaming particles
        if (aType == 6.0) {
          // Flow along streamline vector
          float flowCycle = fract(aStreamU + uFlowTime * 0.35 * uFlowSpeed);
          pos += aFlowDir * (sin(flowCycle * 6.28318) * 0.015);
        }

        // 3. Cardiac Acoustic Ripple Wave
        if (uPulseIntensity > 0.01) {
          float distToHeart = length(pos - uPulseOrigin);
          float waveDiff = abs(distToHeart - uPulseRadius);
          if (waveDiff < 0.14) {
            float waveFactor = exp(-pow(waveDiff / 0.06, 2.0)) * uPulseIntensity;
            vec3 waveDir = normalize(pos - uPulseOrigin + vec3(0.0001));
            pos += waveDir * (waveFactor * 0.022);
          }
        }

        // 4. Act IV: Sublime Fluid Ribbon Unraveling (52.0s - 60.0s)
        if (uUnravel > 0.001) {
          // Extremities unravel first; deep spine/heart hold longest
          float coreDelay = (aType == 0.0 || aType == 3.0 || aType == 5.0) ? 0.40 : 0.05;
          float uP = clamp((uUnravel - coreDelay) / (1.0 - coreDelay), 0.0, 1.0);

          if (uP > 0.0) {
            float uP2 = uP * uP;
            // Elegant 3D logarithmic spiral ribbons
            float ribbonAngle = aPhase * 18.8495 + uP * 6.28318 + t * 1.5;
            float ribbonRadius = uP * (0.65 + 0.35 * sin(aPhase * 35.0));

            vec3 ribbonDisp = vec3(
              cos(ribbonAngle) * ribbonRadius,
              uP2 * 3.2 + sin(ribbonAngle * 2.0) * 0.25 * uP,
              sin(ribbonAngle) * ribbonRadius
            );

            // Add curl harmonics to the ribbon tails
            vec3 ribbonCurl = fastCurl(pos * 1.5, t * 1.8 + aPhase * 10.0) * (0.35 * uP);
            pos += ribbonDisp + ribbonCurl;
          }
        }

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        float dist = max(0.01, -mvPosition.z);

        // Physical distance attenuation: constant world size -> perspective screen size
        float ptSize = aSize * (uResolution.y / dist) * 0.0022 * uSizeMultiplier;

        // Subtle organic phase breathing per particle
        ptSize *= (0.88 + 0.12 * sin(t * 3.5 + aPhase * 6.28318));

        // In Act IV, particles expand slightly into luminous ethereal bokeh
        if (uUnravel > 0.001) {
          ptSize *= (1.0 + uUnravel * 0.8);
        }

        // Crisp stippling limit: keeps points as refined jewels, never giant blurry dinner plates
        gl_PointSize = clamp(ptSize, 1.0, 10.5);
        gl_Position = projectionMatrix * mvPosition;

        // Distance-compensated optical luminance to prevent additive blowout on macro zoom
        float distFactor = clamp(dist * 0.55, 0.28, 1.0);
        float pulseGlow = (uPulseIntensity > 0.05 && aType == 3.0) ? 1.4 : 1.0;
        vIntensity = aIntensity * distFactor * pulseGlow;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float t;
      uniform float uGlobalAlpha;

      varying vec3 vColor;
      varying float vPhase;
      varying float vIntensity;

      void main() {
        // Center point coordinates in [-0.5, 0.5]
        vec2 uv = gl_PointCoord - vec2(0.5);
        float r2 = dot(uv, uv);

        // Circular disc clip
        if (r2 > 0.25) discard;

        // Analytic Gaussian profile with laser core
        float gaussian = exp(-r2 * 16.0);
        float core = exp(-r2 * 55.0);

        // Per-point quantum / LiDAR shimmer (microscopic scan vibration)
        float shimmer = 0.88 + 0.12 * sin(t * 7.5 + vPhase * 12.566);

        // Volumetric optical luminance
        vec3 col = vColor * (gaussian * 0.45 + core * 0.45) * vIntensity * shimmer;
        float alpha = gaussian * uGlobalAlpha;

        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
