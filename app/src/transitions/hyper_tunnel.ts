// Hyper Tunnel: Hypersonic anamorphic velocity corridor transition (Act 2 -> Act 3)
// Driven by snapping boundary cables, stretching outgoing space with directional
// horizontal anamorphic streaks and snapping cleanly into the training flight at u = 0.5.

import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { FSPass } from '../engine/gl';
import { clamp, ease } from '../engine/util';

export default class HyperTunnel implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const frag = /* glsl */ `
      uniform sampler2D texA;
      uniform sampler2D texB;
      uniform float progress;

      void main() {
        vec2 uv = vUv;
        vec2 center = vec2(0.5);

        // Directional anamorphic stretch from center
        float dist = length(uv - center);
        float streak = pow(progress, 3.0) * 0.4;
        vec2 streakUv = uv + (uv - center) * streak;

        vec4 col;
        if (progress < 0.5) {
          // Outgoing scene accelerating into speed streaks
          col = texture(texA, streakUv);
          col.r = texture(texA, streakUv + vec2(streak * 0.04, 0.0)).r;
          col.b = texture(texA, streakUv - vec2(streak * 0.04, 0.0)).b;
        } else {
          // Incoming scene expanding out from hypersonic tunnel
          float inU = (progress - 0.5) * 2.0;
          float inStreak = (1.0 - inU) * 0.3;
          vec2 inUv = uv - (uv - center) * inStreak;
          col = texture(texB, inUv);
          col.r = texture(texB, inUv + vec2(inStreak * 0.03, 0.0)).r;
          col.b = texture(texB, inUv - vec2(inStreak * 0.03, 0.0)).b;
        }

        // Anamorphic horizontal laser streak peaking at seam center
        float flashPeak = 1.0 - abs(progress - 0.5) / 0.12;
        if (flashPeak > 0.0) {
          float horizLine = 1.0 - abs(uv.y - 0.5) / 0.04;
          if (horizLine > 0.0) {
            col.rgb += vec3(0.55, 0.36, 0.96) * horizLine * flashPeak * 2.5; // Hyper violet
          }
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
      bloom: 0.55 + peak * 0.8,
      ca: 1.0 + peak * 10.0,
      exposure: 1.0,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}
