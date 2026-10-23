// Paperclip Dive: Macro wire-core entry transition (Act 4 -> Act 5)
// Camera dives straight into the whiteboard paperclip wire core, which blooms into
// an intense specular cylindrical flare and unrolls into the 100,000 fractal engine bay.

import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { FSPass } from '../engine/gl';
import { clamp, ease } from '../engine/util';

export default class PaperclipDive implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const frag = /* glsl */ `
      uniform sampler2D texA;
      uniform sampler2D texB;
      uniform float progress;

      void main() {
        vec2 uv = vUv;
        vec2 center = vec2(0.5);

        vec4 col;
        if (progress < 0.5) {
          float zoom = 1.0 + pow(progress * 2.0, 3.0) * 4.0;
          vec2 zoomUv = (uv - center) / zoom + center;
          col = texture(texA, zoomUv);
        } else {
          float outU = (progress - 0.5) * 2.0;
          float zoom = 0.5 + outU * 0.5;
          vec2 zoomUv = (uv - center) / zoom + center;
          col = texture(texB, zoomUv);
        }

        // Specular chrome core flash peaking at seam midpoint
        float flashPeak = 1.0 - abs(progress - 0.5) / 0.12;
        if (flashPeak > 0.0) {
          vec3 coreGlow = vec3(0.95, 0.25, 0.2); // Red alarm/wire heat
          col.rgb = mix(col.rgb, coreGlow, flashPeak * 0.85);
        }

        fragColor = col;
      }
    `;

    this.pass = new FSPass(frag, {
      texA: { value: null },
      texB: { value: null },
      progress: { value: 0 },
    });
  }

  render(
    _f: Frame,
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

    const peak = Math.sin(u * Math.PI);

    return {
      bloom: 0.55 + peak * 0.6,
      ca: 0.8 + peak * 8.0,
      exposure: 1.0,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}
