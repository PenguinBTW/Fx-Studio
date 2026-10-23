// THE FLYING TOME: Transition Seam 2 (10.0s - 13.5s)
// Macro rack-focus, directional motion blur tracking the flying tome,
// and cushioned desk impact handoff into the page flutter scene.
// Strictly Closed-Form Frame = f(t)

import * as THREE from 'three';
import { FSPass, W, H } from '../engine/gl';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';

const FLYING_TOME_FRAG = /* glsl */ `
uniform sampler2D texA; // Outgoing Scene 2: Chromatic Bloom (Flying Book)
uniform sampler2D texB; // Incoming Scene 3: Rapid Flutter (Book on Desk)
uniform float u;        // 0..1 transition progress
uniform float time;     // continuous timeline time
uniform vec2 res;       // [W, H]

#define PI 3.14159265359

void main() {
  vec2 uv = gl_FragCoord.xy / res;

  // Impact rack-focus & subtle optical chromatic split during the seam
  float blurAmount = sin(u * PI) * 0.007;
  vec2 blurDir = normalize(vec2(-0.4, -0.9));

  // Cushioned impact camera tremor right at u = 0.50
  float impactTau = (u - 0.45) * 12.0;
  float impactShake = 0.0;
  if (impactTau > 0.0 && impactTau < 2.0) {
    impactShake = exp(-impactTau * 3.5) * sin(impactTau * 26.0) * 0.006;
  }
  vec2 shakeUv = uv + vec2(0.0, impactShake);

  vec3 colA = vec3(0.0);
  vec3 colB = vec3(0.0);
  for (int i = -3; i <= 3; i++) {
    float fi = float(i);
    colA += texture(texA, shakeUv + blurDir * fi * blurAmount).rgb / 7.0;
    colB += texture(texB, shakeUv + blurDir * fi * blurAmount).rgb / 7.0;
  }

  // Smooth handoff centered at u = 0.5
  float handoff = smoothstep(0.35, 0.65, u);
  vec3 finalColor = mix(colA, colB, handoff);

  fragColor = vec4(finalColor, 1.0);
}

`;

export default class FlyingTome implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx) {
    const { W, H } = ctx;
    this.pass = new FSPass(FLYING_TOME_FRAG, {
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

    // Dynamic optical post kick at landing impact
    const impactEnv = Math.exp(-Math.pow((u - 0.88) * 12.0, 2.0));
    return {
      bloom: 0.55 + impactEnv * 0.4,
      ca: 1.0 + impactEnv * 5.0,
      exposure: 1.1 + impactEnv * 0.1,
    };
  }
}
