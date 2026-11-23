// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Procedural Materials for 'The Memory Singularity'
// Studio-grade procedural shaders: iridescent silicon wafer, animated circuit logic,
// brushed dark titanium, and emissive superconductor conduits.

import * as THREE from 'three';

/**
 * Procedural Silicon Wafer Shader:
 * - Micro-circuit logic traces with animated pulse currents.
 * - Photorealistic thin-film diffraction grating iridescence modulated by Fresnel grazing angles.
 * - Deep obsidian base with sharp specular response.
 */
export function createSiliconWaferMaterial(opts: {
  baseColor?: THREE.ColorRepresentation;
  traceColor?: THREE.ColorRepresentation;
  pulseColor?: THREE.ColorRepresentation;
  scale?: number;
  iridescence?: number;
} = {}): THREE.ShaderMaterial {
  const baseCol = new THREE.Color(opts.baseColor ?? 0x06070a);
  const traceCol = new THREE.Color(opts.traceColor ?? 0x181c24);
  const pulseCol = new THREE.Color(opts.pulseColor ?? 0x00e5ff);

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Vector3(baseCol.r, baseCol.g, baseCol.b) },
      uTraceColor: { value: new THREE.Vector3(traceCol.r, traceCol.g, traceCol.b) },
      uPulseColor: { value: new THREE.Vector3(pulseCol.r, pulseCol.g, pulseCol.b) },
      uPulseIntensity: { value: 0.0 },
      uScale: { value: opts.scale ?? 40.0 },
      uIridescence: { value: opts.iridescence ?? 0.35 },
      uRoughness: { value: 0.14 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uBaseColor;
      uniform vec3 uTraceColor;
      uniform vec3 uPulseColor;
      uniform float uPulseIntensity;
      uniform float uScale;
      uniform float uIridescence;
      uniform float uRoughness;

      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;

      // Thin-film spectral color palette
      vec3 spectralPalette(float t) {
        vec3 a = vec3(0.5, 0.5, 0.5);
        vec3 b = vec3(0.5, 0.5, 0.5);
        vec3 c = vec3(1.0, 1.0, 1.0);
        vec3 d = vec3(0.00, 0.33, 0.67);
        return a + b * cos(6.28318 * (c * t + d));
      }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = normalize(vec3(0.6, 1.2, 0.8));
        vec3 H = normalize(L + V);

        // Procedural Manhattan circuit grid traces
        vec2 grid = fract(vUv * uScale);
        vec2 lines = step(vec2(0.90), grid) + step(grid, vec2(0.10));
        float isTrace = clamp(lines.x + lines.y, 0.0, 1.0);

        // Secondary sub-grid micro-registers
        vec2 subGrid = fract(vUv * (uScale * 3.0));
        float subLines = step(0.94, subGrid.x) * step(0.94, subGrid.y);

        // Sub-die blocks
        vec2 blockId = floor(vUv * (uScale * 0.25));
        float blockHash = fract(sin(dot(blockId, vec2(127.1, 311.7))) * 43758.5453);

        // Animated current pulses running along traces
        float pulseSpeed = 4.0;
        float pulseWave = sin(vUv.x * 60.0 - uTime * pulseSpeed + blockHash * 6.28) *
                          cos(vUv.y * 60.0 + uTime * (pulseSpeed * 0.7));
        float pulse = smoothstep(0.78, 0.98, pulseWave) * uPulseIntensity;

        // Thin-film diffraction grating: only shows on grazing Fresnel and specular glints
        float NdotV = max(dot(N, V), 0.0);
        float fresnel = pow(1.0 - NdotV, 3.2);
        float anglePhase = fresnel * 3.0 + dot(vUv, vec2(1.5, 1.0)) * 0.25;
        vec3 iridCol = spectralPalette(anglePhase) * (uIridescence * (fresnel * 0.85 + 0.15));

        // Lighting calculation
        float NdotL = max(dot(N, L), 0.0);
        float NdotH = max(dot(N, H), 0.0);
        float spec = pow(NdotH, 64.0) * (1.0 - uRoughness);

        // Base surface mix: deep obsidian silicon + crisp logic lines
        vec3 surface = mix(uBaseColor, uTraceColor, isTrace * 0.75 + subLines * 0.35);
        // Iridescence shimmers as specular highlight on wafer flats
        surface += iridCol * (1.0 - isTrace) * (spec * 1.8 + fresnel * 0.4);

        // Active pulse emission
        vec3 emissive = uPulseColor * (pulse * 3.5 + (1.0 - isTrace) * uPulseIntensity * 0.2);

        vec3 finalColor = surface * (NdotL * 0.75 + 0.25) + vec3(spec * 0.95) + emissive;
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
}

/**
 * Procedural Brushed Obsidian Basalt (Subterranean structural chassis)
 */
export function createBasaltMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x08090c),
    roughness: 0.82,
    metalness: 0.18,
  });
}

/**
 * Procedural Brushed Milled Titanium (Pylons, frames, gantry bridges)
 */
export function createBrushedTitaniumMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x222120),
    roughness: 0.26,
    metalness: 0.90,
  });
}

/**
 * High-Conductivity Copper Busbar Material
 */
export function createCopperMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xdf7232),
    roughness: 0.10,
    metalness: 0.98,
  });
}

/**
 * Polished Dielectric Chrome Material (Dampers, mirror rings, connectors)
 */
export function createChromeMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xdce2ea),
    roughness: 0.04,
    metalness: 1.0,
  });
}
