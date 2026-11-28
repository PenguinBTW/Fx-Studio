// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Bespoke Transition: Cassegrain Optical Singularity & Hexagonal Diffraction Flare
// Project: deep_field // Engine: f(x) Studio v0.8.0

import * as THREE from 'three';
import type { Frame, PostOverrides } from '../../../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../../../engine/transition';
import { FSPass } from '../../../engine/gl';
import { clamp } from '../../../engine/util';

export default class OpticalSingularity implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const frag = /* glsl */ `
      uniform sampler2D texA;
      uniform sampler2D texB;
      uniform float progress;

      // Hexagonal diffraction spike calculator for 6-fold JWST symmetry
      float diffractionSpikes(vec2 p) {
        float spikes = 0.0;
        for (int i = 0; i < 3; i++) {
          float angle = float(i) * 3.14159265 / 3.0; // 60-degree increments
          vec2 dir = vec2(cos(angle), sin(angle));
          float dist = abs(dot(p, vec2(-dir.y, dir.x)));
          float r = length(p);
          float line = exp(-dist * 85.0) * exp(-r * 2.8);
          spikes += line;
        }
        return spikes;
      }

      void main() {
        vec2 uv = vUv;
        vec2 center = vec2(0.5, 0.5);
        vec2 d = uv - center;

        // Cauchy dispersion envelope peaking at seam midpoint
        float seamIntensity = sin(progress * 3.14159265);
        float chroma = seamIntensity * 0.055;

        // Dynamic radial optical zoom
        float zoomA = 1.0 + progress * 0.95;
        float zoomB = 0.55 + progress * 0.45;

        vec2 uvA_R = center + (d * (1.0 + chroma)) / zoomA;
        vec2 uvA_G = center + d / zoomA;
        vec2 uvA_B = center + (d * (1.0 - chroma)) / zoomA;

        vec2 uvB_R = center + (d * (1.0 + chroma * 0.5)) / zoomB;
        vec2 uvB_G = center + d / zoomB;
        vec2 uvB_B = center + (d * (1.0 - chroma * 0.5)) / zoomB;

        vec3 colA = vec3(
          texture(texA, uvA_R).r,
          texture(texA, uvA_G).g,
          texture(texA, uvA_B).b
        );

        vec3 colB = vec3(
          texture(texB, uvB_R).r,
          texture(texB, uvB_G).g,
          texture(texB, uvB_B).b
        );

        // Smoothstep spatial dissolve
        float blend = smoothstep(0.38, 0.62, progress);
        vec3 col = mix(colA, colB, blend);

        // Signature 6-pointed hexagonal diffraction flare
        float spikes = diffractionSpikes(d) * seamIntensity * 1.8;
        vec3 goldSpikes = vec3(1.0, 0.88, 0.55) * spikes;

        // Center aperture core blowout
        float core = exp(-length(d) * 14.0) * seamIntensity * 0.85;
        vec3 coreGlow = vec3(1.0, 0.95, 0.82) * core;

        col += goldSpikes + coreGlow;

        fragColor = vec4(col, 1.0);
      }
    `;

    this.pass = new FSPass(frag, {
      texA: { value: null },
      texB: { value: null },
      progress: { value: 0 },
    });
  }

  render(
    f: Frame,
    out: THREE.WebGLRenderTarget,
    a: THREE.Texture,
    b: THREE.Texture,
    api: TransitionAPI,
  ): PostOverrides | void {
    const u = clamp(api.u, 0, 1);
    const { renderer } = this.ctx;

    this.pass.u.texA!.value = a;
    this.pass.u.texB!.value = b;
    this.pass.u.progress!.value = u;

    this.pass.render(renderer, out);
    renderer.resetState();

    const flashEnv = Math.exp(-Math.pow((u - 0.5) * 10.0, 2.0));
    const caEnv = Math.sin(u * Math.PI);

    return {
      flash: flashEnv * 0.22,
      bloom: 0.32 + 0.30 * caEnv,
      ca: 1.2 + 2.8 * caEnv,
      grain: 0.04,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}