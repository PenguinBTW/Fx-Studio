// Blast Shutter: Industrial diegetic blast door slam (Act 3 -> Act 4)
// A heavy steel blast shutter slides down in rapid frames with mechanical recoil,
// holds total industrial occlusion at seam midpoint, then raises to reveal the dawn facility.

import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { FSPass } from '../engine/gl';
import { clamp, ease } from '../engine/util';

export default class BlastShutter implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const frag = /* glsl */ `
      uniform sampler2D texA;
      uniform sampler2D texB;
      uniform float shutterY; // 0.0 = top of screen, 1.0 = bottom
      uniform float seamPhase; // 0 = closing, 1 = opening

      void main() {
        vec2 uv = vUv;
        float screenY = 1.0 - uv.y;

        vec4 col;
        bool isShutter = false;

        if (seamPhase < 0.5) {
          if (screenY < shutterY) isShutter = true;
          else col = texture(texA, uv);
        } else {
          if (screenY > shutterY) isShutter = true;
          else col = texture(texB, uv);
        }

        if (isShutter) {
          // Dark industrial gunmetal steel plate with horizontal grooves
          float groove = step(0.96, fract(uv.y * 12.0)) * 0.04;
          float rivet = step(0.85, sin(uv.x * 40.0) * sin(uv.y * 24.0)) * 0.06;
          vec3 steel = vec3(0.09, 0.09, 0.11) - vec3(groove) + vec3(rivet);

          // Bold yellow/black hazard chevron stripe at bottom edge of shutter
          float edgeDist = abs(screenY - shutterY);
          if (edgeDist < 0.035) {
            float stripe = step(0.5, fract((uv.x * 1.7778 + uv.y * 1.0) * 12.0));
            vec3 warnColor = mix(vec3(0.95, 0.75, 0.05), vec3(0.05), stripe);
            steel = warnColor;
          }

          col = vec4(steel, 1.0);
        }

        fragColor = col;
      }
    `;

    this.pass = new FSPass(frag, {
      texA: { value: null },
      texB: { value: null },
      shutterY: { value: 0 },
      seamPhase: { value: 0 },
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

    let shutterY = 0;
    let seamPhase = 0;

    if (u < 0.5) {
      seamPhase = 0;
      const progress = clamp(u / 0.46, 0, 1);
      shutterY = ease.outBack(progress);
    } else {
      seamPhase = 1;
      const progress = clamp((u - 0.54) / 0.46, 0, 1);
      shutterY = ease.inCubic(progress);
    }

    this.pass.u.texA!.value = a;
    this.pass.u.texB!.value = b;
    this.pass.u.shutterY!.value = shutterY;
    this.pass.u.seamPhase!.value = seamPhase;

    this.pass.render(renderer, out);
    renderer.resetState();

    const hit = Math.sin(clamp((u - 0.4) / 0.2, 0, 1) * Math.PI);
    return {
      exposure: 1.0,
      bloom: 0.45 + hit * 0.35,
      ca: 0.6 + hit * 3.0,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}
