// agp_flare (a2->a3): the plan's orange marker flares and the flare becomes the lead drone light. Orange, never white.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/agent_promo/tkit';

const FRAG = `
void main(){
  vec2 p = (vUv - 0.5) * vec2(uAsp, 1.0); float d = length(p);
  float bell = sin(3.14159 * u);
  float m = smoothstep(0.42, 0.58, u);
  vec3 A = texture2D(texA, 0.5 + (vUv - 0.5) / (1.0 + 0.3 * u)).rgb, B = texture2D(texB, 0.5 + (vUv - 0.5) * (1.0 + 0.25 * (1.0 - u))).rgb;
  vec3 col = mix(A, B, m);
  float streak = exp(-abs(p.y) * 60.0) * exp(-abs(p.x) * 2.5);
  col += SIGNAL * (exp(-d * mix(30.0, 4.0, bell)) * 2.2 + streak * 1.4) * bell;
  col *= 1.0 - 0.6 * bell * smoothstep(0.2, 0.9, d);
  gl_FragColor = vec4(min(col, vec3(2.0, 1.2, 1.0)), 1.0);
}`;

export default class AgpFlare implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, api.u);
  }
  dispose() { this.pass.dispose(); }
}
