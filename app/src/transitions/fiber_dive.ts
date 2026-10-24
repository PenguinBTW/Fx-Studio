// FIBER DIVE: Transition Seam 3 (16.0s - 17.0s)
// Exponential macro zoom into the physical paper grain, organic fiber emergence,
// and silent pre-roll handoff into the 2D boiling ink universe.
// Strictly Closed-Form Frame = f(t)

import * as THREE from 'three';
import { FSPass, W, H } from '../engine/gl';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';

const FIBER_DIVE_FRAG = /* glsl */ `
uniform sampler2D texA; // Outgoing Scene 3: Rapid Flutter (Title Page Dive)
uniform sampler2D texB; // Incoming Scene 4: Scrawly Odyssey (Boiling Ink)
uniform float u;        // 0..1 transition progress
uniform float time;     // continuous timeline time
uniform vec2 res;       // [W, H]

#define PI 3.14159265359

// Procedural paper grain noise
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 center = vec2(0.5, 0.5);

  // Exponential zoom into the center of the page
  float zoom = 1.0 + pow(u, 2.5) * 1.8;
  vec2 uvZoomA = (uv - center) / zoom + center;

  // Vignette dark edges as camera plunges into fibers
  float edgeDist = length(uv - center);
  float fiberDark = smoothstep(0.4, 0.9, edgeDist) * pow(u, 1.8) * 0.45;

  vec3 colA = texture(texA, uvZoomA).rgb;
  vec3 colB = texture(texB, uv).rgb;

  // Paper fiber micro-texture emergence
  float grain = (hash21(uv * res + fract(time * 12.0)) - 0.5) * 0.08 * sin(u * PI);

  // Smooth handoff centered at u = 0.65
  float dissolve = smoothstep(0.35, 0.85, u);
  vec3 finalColor = mix(colA, colB, dissolve);

  finalColor -= fiberDark;
  finalColor += grain;

  fragColor = vec4(finalColor, 1.0);
}
`;

export default class FiberDive implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const { W, H } = ctx;
    this.pass = new FSPass(FIBER_DIVE_FRAG, {
      texA: { value: null },
      texB: { value: null },
      u: { value: 0 },
      time: { value: 0 },
      res: { value: new THREE.Vector2(W, H) },
    });
  }

  render(
    f: Frame,
    out: THREE.WebGLRenderTarget,
    a: THREE.Texture,
    b: THREE.Texture,
    api: TransitionAPI,
  ): PostOverrides | void {
    const u = Math.min(1.0, Math.max(0.0, api.u));
    const { renderer } = this.ctx;

    this.pass.u.texA!.value = a;
    this.pass.u.texB!.value = b;
    this.pass.u.u!.value = u;
    this.pass.u.time!.value = f.t;

    this.pass.render(renderer, out);
    renderer.resetState();

    const peak = Math.sin(u * Math.PI);
    return {
      bloom: 0.4 + peak * 0.3,
      ca: 0.8 + peak * 4.0,
      exposure: 1.05,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}
