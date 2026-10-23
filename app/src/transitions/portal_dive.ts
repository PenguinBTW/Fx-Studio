// Portal Dive: Cinematic expanding aperture doorway breach (Act 1 -> Act 2)
// As camera reaches door #1000, an expanding optical cyan portal opens from center,
// revealing the infinite coordinate void inside without any muddy alpha double exposure.

import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { FSPass } from '../engine/gl';
import { clamp, ease } from '../engine/util';

export default class PortalDive implements Transition {
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

        // Portal aperture radius expands exponentially with progress, clearing full screen by u = 0.82
        float radius = pow(progress, 2.2) * 2.6;

        vec4 colA = texture(texA, uv);
        vec4 colB = texture(texB, uv);

        // Hard aperture boundary with cyan threshold glow
        float edgeWidth = 0.035;
        float inside = smoothstep(radius, radius - edgeWidth, dist);
        vec4 col = mix(colA, colB, inside);

        // Radiant cyan rim on the portal boundary
        float rim = 1.0 - smoothstep(0.0, edgeWidth * 1.5, abs(dist - radius));
        if (progress > 0.02 && progress < 0.85) {
          vec3 rimColor = vec3(0.02, 0.71, 0.83); // #06b6d4
          col.rgb += rimColor * rim * 2.5;
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

    const flare = Math.sin(u * Math.PI);

    return {
      bloom: 0.45 + flare * 0.65,
      ca: 0.6 + flare * 6.0,
      exposure: 1.05,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}
