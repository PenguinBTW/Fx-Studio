// agp_drop (a5->a6): push into the wall of prints, impact on the drop; the frame lands with a decaying jolt.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/agent_promo/tkit';

const FRAG = `
void main(){
  float e = u * u * u; float j = u > 0.5 ? exp(-(u - 0.5) * 14.0) * sin((u - 0.5) * 60.0) : 0.0;
  vec2 sh = vec2(0.0, 0.012 * j);
  vec3 A = texture2D(texA, 0.5 + (vUv - 0.5) / (1.0 + 0.9 * e)).rgb;
  vec3 B = texture2D(texB, 0.5 + (vUv - 0.5) * (1.0 + 0.18 * (1.0 - smoothstep(0.5, 1.0, u))) + sh).rgb;
  float m = smoothstep(0.46, 0.54, u);
  vec3 col = mix(A * (1.0 - 0.7 * smoothstep(0.3, 0.5, u)), B, m);
  col += SIGNAL * 0.05 * exp(-abs(u - 0.5) * 30.0);
  gl_FragColor = vec4(col, 1.0);
}`;

export default class AgpDrop implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, api.u);
  }
  dispose() { this.pass.dispose(); }
}
