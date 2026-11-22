// agp_collapse (a9->a10): the rush collapses into one orange point; the quiet desk opens out of it.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/agent_promo/tkit';

const FRAG = `
void main(){
  vec2 p = (vUv - 0.5) * vec2(uAsp, 1.0); float d = length(p);
  float k = smoothstep(0.0, 0.5, u), o = smoothstep(0.5, 1.0, u);
  vec2 ua = 0.5 + (vUv - 0.5) * (1.0 + 18.0 * k * k) ;
  vec3 A = texture2D(texA, 0.5 + (vUv - 0.5) * pow(1.0 + 30.0 * k, d * 1.5 + 0.2)).rgb * (1.0 - k);
  float r = o * 1.2;
  vec3 B = texture2D(texB, vUv).rgb;
  vec3 col = u < 0.5 ? A : mix(vec3(0.0), B, step(d, r));
  col += SIGNAL * exp(-d * 90.0) * 3.0 * sin(3.14159 * u);
  col = mix(col, SIGNAL * 1.4, (1.0 - smoothstep(0.0, 0.01, abs(d - r))) * (u > 0.5 ? 1.0 - o : 0.0));
  gl_FragColor = vec4(col, 1.0);
}`;

export default class AgpCollapse implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, api.u);
  }
  dispose() { this.pass.dispose(); }
}
