// Bespoke Project-Local Transition: Hangar Airlock (f(x) Studio v0.8.0)
// Demonstrates Tier-1 Project-Local Bespoke Transition in the Two-Tier Transition Cascade!
// Simulates an orbital station airlock depressurization / pressurized iris clamp cycle:
// - Phase 1 (u < 0.5): Heavy multi-segment hydraulic blast iris slides shut over approach exterior.
// - Midpoint (u = 0.5): Total industrial occlusion, warning chevrons lock, optical atmospheric bloom burst.
// - Phase 2 (u > 0.5): Pressure equalization vent vapor dissipates and inner docking bay opens.

import * as THREE from 'three';
import type { Frame, PostOverrides } from '../../../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../../../engine/transition';
import { FSPass } from '../../../engine/gl';
import { clamp, ease } from '../../../engine/util';

export default class HangarAirlock implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const frag = /* glsl */ `
      uniform sampler2D texA;
      uniform sampler2D texB;
      uniform float irisRadius; // 0.0 = fully closed, 1.0 = fully open
      uniform float seamPhase;  // 0 = closing on scene A, 1 = opening on scene B
      uniform float shockwave;

      void main() {
        vec2 uv = vUv;
        vec2 centered = (uv - 0.5) * vec2(1.7778, 1.0);
        float r = length(centered);
        float angle = atan(centered.y, centered.x);

        // 8-blade mechanical iris aperture distortion
        float blades = 8.0;
        float bladeMod = sin(angle * blades + (1.0 - irisRadius) * 2.5) * 0.08 * (1.0 - irisRadius);
        float effRadius = irisRadius * 1.1 + bladeMod;

        vec4 colA = texture(texA, uv);
        vec4 colB = texture(texB, uv);

        bool isDoor = (r > effRadius);

        if (seamPhase < 0.5) {
          // Closing outer doors over scene A
          if (!isDoor) {
            fragColor = colA;
          } else {
            // Industrial titanium alloy blast plating with hexagonal pattern
            float hex = step(0.92, fract(r * 24.0));
            vec3 steel = vec3(0.08, 0.09, 0.11) + vec3(hex * 0.04);

            // Hazard perimeter ring along iris edge
            float rim = abs(r - effRadius);
            if (rim < 0.035) {
              float stripe = step(0.5, fract((angle * 4.0 + r * 10.0)));
              vec3 chevron = mix(vec3(0.95, 0.70, 0.05), vec3(0.05), stripe);
              steel = chevron;
            }

            fragColor = vec4(steel, 1.0);
          }
        } else {
          // Opening inner hangar bay into scene B
          if (isDoor) {
            float hex = step(0.92, fract(r * 24.0));
            vec3 steel = vec3(0.10, 0.11, 0.13) + vec3(hex * 0.04);
            float rim = abs(r - effRadius);
            if (rim < 0.035) {
              float stripe = step(0.5, fract((angle * 4.0 - r * 10.0)));
              vec3 chevron = mix(vec3(0.10, 0.85, 0.95), vec3(0.05), stripe);
              steel = chevron;
            }
            fragColor = vec4(steel, 1.0);
          } else {
            // Equalization vapor optical bloom on entry
            vec3 mist = vec3(0.12, 0.18, 0.22) * shockwave * 0.5;
            fragColor = vec4(colB.rgb + mist, colB.a);
          }
        }
      }
    `;

    this.pass = new FSPass(frag, {
      texA: { value: null },
      texB: { value: null },
      irisRadius: { value: 1.0 },
      seamPhase: { value: 0.0 },
      shockwave: { value: 0.0 },
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

    let irisRadius = 1.0;
    let seamPhase = 0.0;

    if (u < 0.5) {
      seamPhase = 0.0;
      const progress = clamp(u / 0.48, 0, 1);
      irisRadius = 1.0 - ease.inCubic(progress);
    } else {
      seamPhase = 1.0;
      const progress = clamp((u - 0.52) / 0.48, 0, 1);
      irisRadius = ease.outCubic(progress);
    }

    const shock = Math.sin(clamp((u - 0.35) / 0.3, 0, 1) * Math.PI);

    this.pass.u.texA!.value = a;
    this.pass.u.texB!.value = b;
    this.pass.u.irisRadius!.value = irisRadius;
    this.pass.u.seamPhase!.value = seamPhase;
    this.pass.u.shockwave!.value = shock;

    this.pass.render(renderer, out);
    renderer.resetState();

    return {
      exposure: 1.0 + shock * 0.25,
      bloom: 0.4 + shock * 0.55,
      ca: 0.5 + shock * 2.8,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}
