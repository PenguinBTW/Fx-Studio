// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Bespoke Transition: Aperture Momentum Punch-Through (Scene 1 -> Scene 2)
// For 'The Memory Wall' (Viopls Flagship Production)
// Pure forward-carrier handoff with exponential aperture expansion and downbeat optical flash.

import * as THREE from 'three';
import type { Frame, PostOverrides } from '../../../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../../../engine/transition';
import { FSPass } from '../../../engine/gl';
import { clamp } from '../../../engine/util';

export default class AperturePush implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const frag = /* glsl */ `
      uniform sampler2D texA;
      uniform sampler2D texB;
      uniform float progress;

      void main() {
        vec2 uv = vUv;
        vec2 center = vec2(0.5, 0.5);

        // Aspect ratio correction (16:9)
        vec2 d = uv - center;
        d.x *= 1.7777778;
        float dist = length(d);

        // Continuous zoom punch
        float zoomA = 1.0 + progress * 0.45;
        vec2 uvA = center + (uv - center) / zoomA;

        float zoomB = 0.75 + progress * 0.25;
        vec2 uvB = center + (uv - center) / zoomB;

        vec4 colA = texture(texA, uvA);
        vec4 colB = texture(texB, uvB);

        // Expanding aperture iris
        float radius = pow(progress, 1.8) * 2.8;
        float edgeWidth = 0.04;
        float inside = smoothstep(radius, radius - edgeWidth, dist);

        vec4 col = mix(colA, colB, inside);

        // High-contrast tungsten/white aperture rim glow
        float rim = 1.0 - smoothstep(0.0, edgeWidth * 1.8, abs(dist - radius));
        if (progress > 0.02 && progress < 0.98) {
          vec3 rimColor = vec3(1.0, 0.92, 0.85); // 3200K tungsten specular
          col.rgb += rimColor * rim * 1.8 * sin(progress * 3.14159265);
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

    // Downbeat optical transient flash at u = 0.5 (landing at 11.29s)
    const flashEnv = Math.exp(-Math.pow((u - 0.5) * 14.0, 2.0));
    const caEnv = Math.sin(u * Math.PI);

    return {
      flash: flashEnv * 0.45,
      bloom: 0.35 + 0.25 * caEnv,
      ca: 1.5 + 2.5 * caEnv,
      grain: 0.05,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}
