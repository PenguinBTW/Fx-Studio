// THE ANAMORPHIC LENS DECONSTRUCTION
// Standalone Transition Block for f(x) Studio engine (v0.5.0)
// Strictly Closed-Form Frame = f(t), Zero UI, Zero HUDs, Pure Photorealism

import * as THREE from 'three';
import { FSPass, makeRT, W, H } from '../engine/gl';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { motion } from '../engine/motion';

const LENS_DECONSTRUCTION_FRAG = /* glsl */ `
uniform sampler2D texA; // Outgoing Scene 1 (The Grand Horology)
uniform sampler2D texB; // Incoming Scene 2 (The Abyssal Siphonophore)

uniform float u;        // 0..1 transition progress
uniform float time;     // continuous timeline timestamp
uniform vec2 res;       // [W, H]

#define PI 3.14159265359

// Cauchy refractive dispersion indices
// n_red = 1.51, n_green = 1.52, n_blue = 1.54 -> eta = 1.0 / n
const float ETA_R = 1.0 / 1.51;
const float ETA_G = 1.0 / 1.52;
const float ETA_B = 1.0 / 1.54;

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / res.y;

  float apex = sin(u * PI);

  // ---------------------------------------------------------------------------
  // 1. Anamorphic Cylindrical Lens Curvature & Cauchy Dispersion
  // ---------------------------------------------------------------------------
  // Anamorphic horizontal stretch (2.39:1 aspect squeeze)
  vec2 cylDisplace = vec2(p.x * 0.08, p.y * 0.015) * apex;

  vec2 uvR = uv + cylDisplace * (1.0 - ETA_R * 1.5);
  vec2 uvG = uv + cylDisplace * (1.0 - ETA_G * 1.5);
  vec2 uvB = uv + cylDisplace * (1.0 - ETA_B * 1.5);

  // Sample Outgoing Scene 1 with chromatic separation
  float colA_R = texture(texA, uvR).r;
  float colA_G = texture(texA, uvG).g;
  float colA_B = texture(texA, uvB).b;
  vec3 colA = vec3(colA_R, colA_G, colA_B);

  // Sample Incoming Scene 2 with opposing chromatic convergence
  float colB_R = texture(texB, uvB).r;
  float colB_G = texture(texB, uvG).g;
  float colB_B = texture(texB, uvR).b;
  vec3 colB = vec3(colB_R, colB_G, colB_B);

  // ---------------------------------------------------------------------------
  // 2. Horizontal Anamorphic Blue Streak Flare (Classic 70mm Prime Flare)
  // ---------------------------------------------------------------------------
  vec3 streakColor = vec3(0.0);
  float streakEnv = smoothstep(0.18, 0.48, u) * (1.0 - smoothstep(0.52, 0.82, u));

  if (streakEnv > 0.01) {
    vec2 texel = 1.0 / res;
    // Multi-tap horizontal anamorphic smear across the X-axis
    for (int i = -16; i <= 16; i++) {
      float fi = float(i);
      float tapDist = abs(fi) / 16.0;
      float weight = exp(-tapDist * 2.8);

      vec2 offset = vec2(fi * 22.0 * texel.x, 0.0);
      vec3 tapA = texture(texA, uv + offset).rgb;
      float luma = dot(tapA, vec3(0.2126, 0.7152, 0.0722));

      if (luma > 1.6) {
        // Royal blue to vibrant electric cyan anamorphic streak
        vec3 flareTint = mix(vec3(0.12, 0.45, 1.0), vec3(0.18, 0.88, 0.98), tapDist);
        streakColor += tapA * (luma - 1.6) * weight * flareTint * 0.055;
      }
    }
    streakColor *= streakEnv * 2.8;
  }

  // ---------------------------------------------------------------------------
  // 3. Smooth Anamorphic Rack-Focus Cross-Dissolve
  // ---------------------------------------------------------------------------
  // Smooth S-curve transition handoff centered at u = 0.5
  float dissolve = smoothstep(0.35, 0.65, u);
  vec3 finalColor = mix(colA, colB, dissolve);

  // Add anamorphic streak flare
  finalColor += streakColor;

  fragColor = vec4(finalColor, 1.0);
}
`;

export default class AnamorphicLensDeconstruction implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const { W, H } = ctx;

    this.pass = new FSPass(LENS_DECONSTRUCTION_FRAG, {
      texA: { value: null },
      texB: { value: null },
      u: { value: 0.0 },
      time: { value: 0.0 },
      res: { value: new THREE.Vector2(W, H) },
    }, { blending: THREE.NoBlending });
  }

  render(
    f: Frame,
    out: THREE.WebGLRenderTarget,
    _a: THREE.Texture,
    _b: THREE.Texture,
    api: TransitionAPI,
  ): PostOverrides | void {
    const { renderer } = this.ctx;
    const u = Math.min(1.0, Math.max(0.0, api.u));
    const t = f.t;

    // 1. Sample current Outgoing Scene 1 and Incoming Scene 2
    const texA = api.sampleScene(api.from, t);
    const texB = api.sampleScene(api.to, t);

    // 2. Optical Breathing Dynamics (Smooth spring ODE settle)
    let bloom = 0.22;
    let bloomThresh = 0.88;
    let ca = 0.015;

    if (u >= 0.42 && u <= 0.58) {
      const apexU = 1.0 - Math.abs(u - 0.5) / 0.08;
      bloom = 0.35 + apexU * 0.15;
      bloomThresh = 0.85;
      ca = 0.025 + apexU * 0.02;
    } else if (u > 0.58) {
      const ringProgress = (u - 0.58) / 0.42;
      const breathingSpring = motion.spring(0.0, ringProgress, {
        freq: 4.5,
        damping: 0.42,
        v0: 3.0,
      });
      const springWeight = Math.max(0, 1.0 - ringProgress);
      ca = 0.015 + springWeight * Math.abs(breathingSpring) * 0.015;
      bloom = 0.22 + springWeight * 0.10;
    }

    // 3. Render Deconstruction Shader Pass
    this.pass.u.texA!.value = texA;
    this.pass.u.texB!.value = texB;
    this.pass.u.u!.value = u;
    this.pass.u.time!.value = t;
    this.pass.render(renderer, out);

    // 4. Return Directorial Post-Processing Overrides
    return {
      bloom,
      bloomThreshold: bloomThresh,
      ca,
      hud: 0.0,
      frame: 0.0,
      metricReadout: 0.0,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}
