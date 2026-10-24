// Mirror Shatter: Voronoi crystalline fracture transition (Act 5 -> Act 6)
// At the climax bass drop, the central silvered mirror plane shatters into explosive
// reflective polygonal shards with Cauchy chromatic dispersion, parting away to reveal the cosmic void.

import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { FSPass } from '../engine/gl';
import { clamp, ease } from '../engine/util';

export default class MirrorShatter implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const frag = /* glsl */ `
      uniform sampler2D texA;
      uniform sampler2D texB;
      uniform float progress;

      vec2 hash2(vec2 p) {
        return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
      }

      void main() {
        vec2 uv = vUv;
        vec2 p = uv * 9.0;
        vec2 i_p = floor(p);
        vec2 f_p = fract(p);

        float m_dist = 10.0;
        vec2 cellCenter = vec2(0.0);

        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = hash2(i_p + neighbor);
            vec2 diff = neighbor + point - f_p;
            float dist = length(diff);
            if (dist < m_dist) {
              m_dist = dist;
              cellCenter = (i_p + neighbor + point) / 9.0;
            }
          }
        }

        vec2 fromCenter = cellCenter - vec2(0.5);
        float fcLen = length(fromCenter);
        float explodeDist = fcLen + 0.1;
        vec2 explodeDir = fcLen > 1e-4 ? fromCenter / fcLen : vec2(0.0, 1.0);

        float crackGap = smoothstep(0.0, 0.7, progress) * 0.25;
        bool isCrack = m_dist < crackGap || progress > 0.82;

        vec4 colB = texture(texB, uv);

        if (isCrack) {
          fragColor = colB;
        } else {
          vec2 shardUv = uv - explodeDir * progress * 0.35 * explodeDist;
          vec4 colA;
          colA.r = texture(texA, shardUv + explodeDir * 0.015 * progress).r;
          colA.g = texture(texA, shardUv).g;
          colA.b = texture(texA, shardUv - explodeDir * 0.015 * progress).b;
          colA.a = 1.0;

          float edge = smoothstep(crackGap + 0.04, crackGap, m_dist);
          colA.rgb += vec3(0.9, 0.95, 1.0) * edge * (1.0 - progress) * 2.5;

          fragColor = colA;
        }
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
    this.pass.u.progress!.value = ease.inCubic(u);

    this.pass.render(renderer, out);
    renderer.resetState();

    const hit = Math.sin(clamp((u - 0.2) / 0.5, 0, 1) * Math.PI);

    return {
      bloom: 0.6 + hit * 0.8,
      ca: 1.0 + hit * 12.0,
      exposure: 1.0,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}
