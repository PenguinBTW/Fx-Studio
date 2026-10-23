// Iris: Circular aperture / volumetric portal transition.
// Expands an expanding circular portal from center revealing scene B inside
// scene A, with an anti-aliased luminous rim and chromatic aberration kick.
import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { FSPass } from '../engine/gl';

export default class Iris implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const frag = /* glsl */ `
      uniform sampler2D texA;
      uniform sampler2D texB;
      uniform float progress;
      uniform vec2 aspect;

      void main() {
        // Normalized coordinates centered at (0.5, 0.5) corrected for aspect ratio
        vec2 uvCenter = (vUv - 0.5) * aspect;
        float dist = length(uvCenter);

        // Max radius to cover corners of 16:9 frame is ~0.8
        float smoothU = progress * progress * (3.0 - 2.0 * progress);
        float radius = smoothU * 0.85;

        // Anti-aliased boundary
        float edge = fwidth(dist) * 2.0;
        float mask = smoothstep(radius - edge, radius + edge, dist);

        vec4 colA = texture(texA, vUv);
        vec4 colB = texture(texB, vUv);

        // Mix: inside circle is B, outside is A
        vec4 col = mix(colB, colA, mask);

        // High-energy signal rim glow at the circular boundary
        float rim = abs(dist - radius);
        if (rim < 0.015 && progress > 0.01 && progress < 0.99) {
          float rimAlpha = 1.0 - rim / 0.015;
          col.rgb += vec3(1.0, 0.35, 0.08) * rimAlpha * 1.6;
        }

        fragColor = col;
      }
    `;

    this.pass = new FSPass(frag, {
      texA: { value: null },
      texB: { value: null },
      progress: { value: 0 },
      aspect: { value: new THREE.Vector2(16.0 / 9.0, 1.0) },
    });
  }

  render(
    _f: Frame,
    out: THREE.WebGLRenderTarget,
    a: THREE.Texture,
    b: THREE.Texture,
    api: TransitionAPI,
  ): PostOverrides | void {
    const u = Math.min(1, Math.max(0, api.u));
    const { renderer } = this.ctx;

    this.pass.u.texA!.value = a;
    this.pass.u.texB!.value = b;
    this.pass.u.progress!.value = u;

    this.pass.render(renderer, out);
    renderer.resetState();

    const peak = Math.sin(u * Math.PI);
    return {
      bloom: 0.55 + peak * 0.45,
      ca: 1.2 + peak * 5.0,
      exposure: 1.0 + peak * 0.2,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}
