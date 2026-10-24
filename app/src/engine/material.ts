import * as THREE from 'three';
import { LIN } from './palette';

export interface BrushedMetalOpts {
  baseColor?: string | [number, number, number];
  roughnessX?: number; // Tangent roughness (e.g. 0.15)
  roughnessY?: number; // Bitangent roughness (e.g. 0.65)
  grooveScale?: number; // Micro-groove density
  rimGlow?: number; // Fresnel rim intensity
  anisotropic?: boolean;
}

export interface WireframeGlowOpts {
  surfaceColor?: string | [number, number, number];
  edgeColor?: string | [number, number, number];
  lineWidth?: number; // Screen-space line width in pixels
  bloomBoost?: number; // Emissive boost for optical post
}

export interface FrostedGlassOpts {
  baseColor?: string | [number, number, number];
  internalColor?: string | [number, number, number];
  opacity?: number;
  roughness?: number;
  fresnelPower?: number;
}

export interface MattePolymerOpts {
  color?: string | [number, number, number];
  roughness?: number;
  grain?: number;
}

export interface EmissivePulseOpts {
  baseColor?: string | [number, number, number];
  pulseColor?: string | [number, number, number];
  speed?: number;
  frequency?: number;
  sharpness?: number;
}

function toVec3Color(c: string | [number, number, number] | undefined, fallback: [number, number, number]): THREE.Vector3 {
  if (!c) return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
  if (Array.isArray(c)) return new THREE.Vector3(c[0], c[1], c[2]);
  if (typeof c === 'string') {
    if (c.startsWith('#') || c.startsWith('rgb')) {
      const col = new THREE.Color(c);
      return new THREE.Vector3(col.r, col.g, col.b);
    }
    const lin = (LIN as any)[c];
    if (lin && Array.isArray(lin) && lin.length === 3) {
      return new THREE.Vector3(lin[0], lin[1], lin[2]);
    }
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

/**
 * ProceduralMaterial: Studio-grade procedural shader material factory for f(x) Studio.
 * Generates closed-form, deterministic mathematical materials without external texture maps.
 */
export class ProceduralMaterial {
  /**
   * Procedural Anisotropic Brushed Metal (Titanium / Milled Aluminum).
   * Ward anisotropic specular reflection with high-frequency procedural tool-mark grain.
   * Singular-safe tangent frame derivation and safe squaring eliminating NaNs.
   */
  static brushedMetal(opts: BrushedMetalOpts = {}): THREE.ShaderMaterial {
    const baseCol = toVec3Color(opts.baseColor, [LIN.bone[0] ?? 0.85, LIN.bone[1] ?? 0.81, LIN.bone[2] ?? 0.74]);
    const rx = opts.roughnessX ?? 0.18;
    const ry = opts.roughnessY ?? 0.65;
    const scale = opts.grooveScale ?? 350.0;
    const rim = opts.rimGlow ?? 0.25;

    return new THREE.ShaderMaterial({
      uniforms: {
        uBaseColor: { value: baseCol },
        uRoughnessX: { value: rx },
        uRoughnessY: { value: ry },
        uGrooveScale: { value: scale },
        uRimGlow: { value: rim },
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
        uniform vec3 uBaseColor;
        uniform float uRoughnessX;
        uniform float uRoughnessY;
        uniform float uGrooveScale;
        uniform float uRimGlow;

        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        float hash21(vec2 p) {
          p = fract(p * vec2(233.34, 851.73));
          p += dot(p, p + 23.45);
          return fract(p.x * p.y);
        }

        void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 L = normalize(vec3(0.5, 0.8, 0.6));
          vec3 H = normalize(L + V);

          // Anisotropic tangent space derived from world normal (singular-safe on floors/roofs)
          vec3 T = cross(N, vec3(0.0, 1.0, 0.0));
          if (dot(T, T) < 1e-4) {
            T = cross(N, vec3(1.0, 0.0, 0.0));
          }
          float tLen2 = dot(T, T);
          T = tLen2 > 1e-6 ? T * inversesqrt(tLen2) : vec3(1.0, 0.0, 0.0);
          vec3 B = cross(N, T);
          float bLen2 = dot(B, B);
          B = bLen2 > 1e-6 ? B * inversesqrt(bLen2) : vec3(0.0, 0.0, 1.0);

          // Micro-toolmark grain displacement
          float noise = (hash21(vUv * uGrooveScale) - 0.5) * 0.12;
          N = normalize(N + T * noise);

          // Ward Anisotropic formulation using direct multiplication (strictly avoids pow(neg, 2.0) NaNs)
          float dotNL = max(dot(N, L), 0.001);
          float dotNV = max(dot(N, V), 0.001);
          float dotNH = max(dot(N, H), 0.001);
          float dotTH = dot(T, H);
          float dotBH = dot(B, H);

          float th = dotTH / max(uRoughnessX, 0.001);
          float bh = dotBH / max(uRoughnessY, 0.001);
          float exponent = -(th * th + bh * bh) / max(1.0 + dotNH, 0.001);
          float spec = exp(exponent) / (12.566 * max(uRoughnessX, 0.001) * max(uRoughnessY, 0.001) * sqrt(max(dotNL * dotNV, 1e-6)));

          // Fresnel edge rim
          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0) * uRimGlow;

          vec3 diffuse = uBaseColor * (dotNL * 0.75 + 0.25);
          vec3 specular = vec3(1.0) * spec * dotNL;
          vec3 rimLight = vec3(0.9, 0.95, 1.0) * fresnel;

          gl_FragColor = vec4(diffuse + specular + rimLight, 1.0);
        }
      `,
    });
  }

  /**
   * Single-Pass Barycentric Wireframe Edge Glow.
   * Produces anti-aliased emissive edges on dark volumetric bodies via screen-space fwidth().
   */
  static wireframeGlow(opts: WireframeGlowOpts = {}): THREE.ShaderMaterial {
    const surfCol = toVec3Color(opts.surfaceColor, [LIN.void[0] ?? 0.02, LIN.void[1] ?? 0.02, LIN.void[2] ?? 0.02]);
    const edgeCol = toVec3Color(opts.edgeColor, [LIN.bone[0] ?? 0.91, LIN.bone[1] ?? 0.89, LIN.bone[2] ?? 0.85]);
    const lw = opts.lineWidth ?? 1.5;
    const boost = opts.bloomBoost ?? 1.4;

    return new THREE.ShaderMaterial({
      uniforms: {
        uSurfaceColor: { value: surfCol },
        uEdgeColor: { value: edgeCol },
        uLineWidth: { value: lw },
        uBloomBoost: { value: boost },
      },
      vertexShader: /* glsl */ `
        attribute vec3 barycentric;
        varying vec3 vBarycentric;
        varying vec3 vNormal;
        varying vec3 vWorldPos;

        void main() {
          #ifdef USE_BARYCENTRIC
            vBarycentric = barycentric;
          #else
            // Fallback barycentric estimation from vertex position (GLSL 1.0 safe)
            vec3 m = mod(position, vec3(2.0));
            vBarycentric = step(m, vec3(0.5));
          #endif
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uSurfaceColor;
        uniform vec3 uEdgeColor;
        uniform float uLineWidth;
        uniform float uBloomBoost;
        varying vec3 vBarycentric;
        varying vec3 vNormal;
        varying vec3 vWorldPos;

        void main() {
          vec3 d = max(fwidth(vBarycentric), vec3(1e-5));
          vec3 a3 = smoothstep(d * (uLineWidth - 0.5), d * (uLineWidth + 0.5) + 1e-4, vBarycentric);
          float edgeFactor = min(min(a3.x, a3.y), a3.z);

          // Subtle ambient shading on dark face
          vec3 V = normalize(cameraPosition - vWorldPos);
          float facing = max(dot(normalize(vNormal), V), 0.1);
          vec3 faceCol = uSurfaceColor * facing;

          vec3 finalEdge = uEdgeColor * uBloomBoost;
          vec3 col = mix(finalEdge, faceCol, edgeFactor);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }

  /**
   * Frosted Optical Conduit / Glass.
   * Translucent internal luminescence with edge fresnel glow.
   */
  static frostedGlass(opts: FrostedGlassOpts = {}): THREE.ShaderMaterial {
    const baseCol = toVec3Color(opts.baseColor, [0.08, 0.10, 0.12]);
    const intCol = toVec3Color(opts.internalColor, [LIN.signal[0] ?? 1.0, LIN.signal[1] ?? 0.16, LIN.signal[2] ?? 0.12]);
    const op = opts.opacity ?? 0.85;
    const pwr = opts.fresnelPower ?? 2.5;

    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uBaseColor: { value: baseCol },
        uInternalColor: { value: intCol },
        uOpacity: { value: op },
        uFresnelPower: { value: pwr },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uBaseColor;
        uniform vec3 uInternalColor;
        uniform float uOpacity;
        uniform float uFresnelPower;
        varying vec3 vNormal;
        varying vec3 vWorldPos;

        void main() {
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 N = normalize(vNormal);
          float fresnel = pow(1.0 - max(dot(N, V), 0.0), uFresnelPower);

          vec3 col = mix(uBaseColor, uInternalColor, fresnel);
          float alpha = clamp(uOpacity + fresnel * 0.4, 0.0, 1.0);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
  }

  /**
   * Matte Dark Polymer / Vulcanized Rubber.
   * Deep light-absorbing surface with high micro-roughness and micro-surface grain.
   */
  static mattePolymer(opts: MattePolymerOpts = {}): THREE.ShaderMaterial {
    const col = toVec3Color(opts.color, [0.06, 0.06, 0.07]);
    const rough = opts.roughness ?? 0.85;
    const grain = opts.grain ?? 0.04;

    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: col },
        uRoughness: { value: rough },
        uGrain: { value: grain },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uRoughness;
        uniform float uGrain;
        varying vec3 vNormal;
        varying vec3 vWorldPos;

        float hash21(vec2 p) {
          p = fract(p * vec2(233.34, 851.73));
          p += dot(p, p + 23.45);
          return fract(p.x * p.y);
        }

        void main() {
          vec3 N = normalize(vNormal);
          vec3 L = normalize(vec3(0.4, 0.9, 0.3));
          float diff = max(dot(N, L), 0.05);
          // Roughness absorption curve
          diff = mix(diff, pow(diff, 1.0 + uRoughness), 0.55);
          float microGrain = (hash21(vWorldPos.xy * 120.0 + vWorldPos.z * 80.0) - 0.5) * uGrain;
          vec3 col = uColor * (diff + microGrain);
          gl_FragColor = vec4(max(vec3(0.0), col), 1.0);
        }
      `,
    });
  }

  /**
   * Closed-Form Emissive Pulse Track (for wires, conduits, spark gaps).
   * Generates a traveling light pulse along coordinate vectors.
   */
  static emissivePulse(opts: EmissivePulseOpts = {}): THREE.ShaderMaterial {
    const baseCol = toVec3Color(opts.baseColor, [LIN.ash[0] ?? 0.42, LIN.ash[1] ?? 0.41, LIN.ash[2] ?? 0.40]);
    const pulseCol = toVec3Color(opts.pulseColor, [LIN.signal[0] ?? 1.0, LIN.signal[1] ?? 0.16, LIN.signal[2] ?? 0.12]);
    const spd = opts.speed ?? 1.5;
    const freq = opts.frequency ?? 2.0;
    const sharp = opts.sharpness ?? 12.0;

    return new THREE.ShaderMaterial({
      uniforms: {
        uBaseColor: { value: baseCol },
        uPulseColor: { value: pulseCol },
        uSpeed: { value: spd },
        uFrequency: { value: freq },
        uSharpness: { value: sharp },
        uTime: { value: 0.0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uBaseColor;
        uniform vec3 uPulseColor;
        uniform float uSpeed;
        uniform float uFrequency;
        uniform float uSharpness;
        uniform float uTime;
        varying vec2 vUv;

        void main() {
          // Continuous traveling wave along UV x axis
          float phase = fract(vUv.x * uFrequency - uTime * uSpeed);
          float pulse = pow(max(0.0, sin(phase * 3.14159265)), uSharpness);

          vec3 col = mix(uBaseColor, uPulseColor * 2.0, pulse);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }
}
