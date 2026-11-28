// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Bespoke Transition: Thermal Seizure & Phase Collapse
// For 'The Memory Singularity' (Flagship Viopls Production)

import * as THREE from 'three';
import type { Frame, PostOverrides } from '../../../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../../../engine/transition';
import { FSPass } from '../../../engine/gl';
import { clamp } from '../../../engine/util';

export default class ThermalSeizure implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const frag = /* glsl */ `
      uniform sampler2D texA;
      uniform sampler2D texB;
      uniform float progress;

      void main() {
        vec2 uv = vUv;
        vec2 center = vec2(0.5, 0.5);

        vec2 d = uv - center;

        float chroma = sin(progress * 3.14159265) * 0.045;
        float jitter = sin(uv.y * 320.0 + progress * 40.0) * chroma * 0.35;
        vec2 dir = normalize(d + vec2(jitter, 0.0));

        float zoomA = 1.0 + progress * 0.65;
        float zoomB = 0.60 + progress * 0.40;

        vec2 uvA_R = center + (uv + dir * chroma - center) / zoomA;
        vec2 uvA_G = center + (uv - center) / zoomA;
        vec2 uvA_B = center + (uv - dir * chroma - center) / zoomA;

        vec2 uvB_R = center + (uv + dir * chroma * 0.5 - center) / zoomB;
        vec2 uvB_G = center + (uv - center) / zoomB;
        vec2 uvB_B = center + (uv - dir * chroma * 0.5 - center) / zoomB;

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

        float blend = smoothstep(0.35, 0.65, progress);
        vec3 col = mix(colA, colB, blend);

        float flash = exp(-pow((progress - 0.5) / 0.16, 2.0));
        vec3 thermalGlow = vec3(1.0, 0.88, 0.72) * flash * 0.38;
        col += thermalGlow;

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

    const flashEnv = Math.exp(-Math.pow((u - 0.5) * 12.0, 2.0));
    const caEnv = Math.sin(u * Math.PI);

    return {
      flash: flashEnv * 0.18,
      bloom: 0.35 + 0.25 * caEnv,
      ca: 1.5 + 2.5 * caEnv,
      grain: 0.05,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}
