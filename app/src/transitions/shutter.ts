// Shutter: Precision multi-band horizontal razor wipe.
// Slices between scenes A and B across 12 alternating interlaced bands with
// an ultra-bright signal laser frontier at each razor edge.
import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { FSPass } from '../engine/gl';

export default class Shutter implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const frag = /* glsl */ `
      uniform sampler2D texA;
      uniform sampler2D texB;
      uniform float progress;
      uniform float bands;

      void main() {
        float bandIdx = floor(vUv.y * bands);
        float dir = mod(bandIdx, 2.0) == 0.0 ? 1.0 : -1.0;
        
        // Eased wave with stagger across vertical bands
        float stagger = (bandIdx / bands) * 0.2;
        float u = clamp((progress - stagger) / 0.8, 0.0, 1.0);
        float smoothU = u * u * (3.0 - 2.0 * u);
        
        float wipeX = dir > 0.0 ? smoothU : (1.0 - smoothU);
        bool isB = dir > 0.0 ? (vUv.x < wipeX) : (vUv.x > wipeX);

        vec4 col = isB ? texture(texB, vUv) : texture(texA, vUv);

        // High-energy signal neon edge at the cutting frontier
        float dist = abs(vUv.x - wipeX);
        if (dist < 0.004 && progress > 0.01 && progress < 0.99) {
          float edgeAlpha = 1.0 - dist / 0.004;
          col.rgb += vec3(1.0, 0.3, 0.07) * edgeAlpha * 1.8;
        }

        fragColor = col;
      }
    `;

    this.pass = new FSPass(frag, {
      texA: { value: null },
      texB: { value: null },
      progress: { value: 0 },
      bands: { value: 12.0 },
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
    this.pass.u.bands!.value = 12.0;

    this.pass.render(renderer, out);
    renderer.resetState();

    const peak = Math.sin(u * Math.PI);
    return {
      bloom: 0.55 + peak * 0.45,
      flash: peak * 0.15,
      ca: 1.2 + peak * 4.0,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}
