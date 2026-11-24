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

        // Radius must reach the CORNER distance at u=1 or the corners keep showing
        // scene A through the whole window and then pop to B when the seam ends.
        // Derived from the actual aspect (not hardcoded) so vertical projects close too.
        float maxR = length(0.5 * aspect) + 0.03; // small margin so the AA rim also clears
        // Full coverage must arrive BEFORE u=1: the window is end-exclusive, so the last
        // sampled frame is always at u<1 — coverage timed for u=1 never displays, and the
        // corners pop to pure B on the first post-window frame. Match portal_dive's
        // convention: fully covered by u=0.85, tail of the window is already pure B.
        float coverU = min(1.0, progress / 0.85);
        float smoothU = coverU * coverU * (3.0 - 2.0 * coverU);
        float radius = smoothU * maxR;

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
      aspect: { value: new THREE.Vector2(ctx.W / ctx.H, 1.0) },
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

    // Effects must die with the wipe: coverage completes at u=0.85, but the sin(u·π)
    // envelope still sits near half-strength there — without fading it, bloom/CA/exposure
    // ride the already-pure-B tail of the window and then snap off at the seam end.
    // full strength through the seam centre; fade over the coverage-completion phase
    // (u 0.7→0.85) so the tail is pure B at base post values before the window closes
    const x = Math.min(1, Math.max(0, (u - 0.7) / 0.15));
    const tail = x * x * (3 - 2 * x);
    const peak = Math.sin(u * Math.PI) * (1 - tail);
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
