// ELASTIC POP: Transition Seam 1 (4.5s - 6.0s)
// Radial under-damped harmonic shockwave wave ripping through the room,
// transforming wireframe blueprint lines into solid chalk/clay mass with squash-and-stretch distortion.
// Strictly Closed-Form Frame = f(t)

import * as THREE from 'three';
import { FSPass, W, H } from '../engine/gl';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';

const ELASTIC_POP_FRAG = /* glsl */ `
uniform sampler2D texA; // Outgoing Scene 1: Blueprint Study
uniform sampler2D texB; // Incoming Scene 2: Chromatic Bloom (Solid Pop)
uniform float u;        // 0..1 transition progress
uniform float time;     // continuous timeline time
uniform vec2 res;       // [W, H]

#define PI 3.14159265359

void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 center = vec2(0.5, 0.46); // Desk center in normalized viewport coords

  // Aspect-corrected radial distance from desk center
  vec2 dVec = (uv - center);
  dVec.x *= res.x / res.y;
  float dist = length(dVec);

  // Radial shockwave wavefront expanding outward across u = 0..1
  float wavefront = u * 1.45;
  float waveDelta = dist - wavefront;

  // Under-damped harmonic ripple at wavefront (zeta ~ 0.52)
  float ripple = sin(waveDelta * 28.0) * exp(-abs(waveDelta) * 16.0) * (1.0 - smoothstep(0.7, 1.0, u));
  vec2 uvDistort = uv + normalize(dVec + vec2(1e-5)) * ripple * 0.035;

  // Sample outgoing blueprint lines and incoming solid pop
  vec4 colA = texture(texA, uvDistort);
  vec4 colB = texture(texB, uvDistort);

  // Smoothstep mask across wavefront
  float mask = smoothstep(wavefront - 0.06, wavefront + 0.02, dist);

  // Inside wavefront: solid popping geometry. Outside wavefront: blueprint lines
  vec3 finalRgb = mix(colB.rgb, colA.rgb, mask);

  // Luminous shockwave ring glow
  float ringGlow = exp(-abs(waveDelta) * 32.0) * sin(u * PI) * 0.45;
  vec3 ringColor = vec3(0.38, 0.74, 0.98); // Luminous electric drafting cyan
  finalRgb += ringColor * ringGlow;

  fragColor = vec4(finalRgb, 1.0);
}
`;

export default class ElasticPop implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const { W, H } = ctx;
    this.pass = new FSPass(ELASTIC_POP_FRAG, {
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
      bloom: 0.65 + peak * 0.6,
      ca: 1.0 + peak * 6.0,
      exposure: 1.1 + peak * 0.15,
    };
  }

  dispose(): void {
    this.pass.dispose();
  }
}
