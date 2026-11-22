// agp_vortex (a10->a11): the page twists into a vortex around the orange block and untwists as the mark.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/agent_promo/tkit';

const FRAG = `
vec2 tw(vec2 uv, float a){ vec2 p = (uv - 0.5) * vec2(uAsp, 1.0); float d = length(p); float t = a * exp(-d * 2.2);
  float c = cos(t), s = sin(t); p = mat2(c, -s, s, c) * p; return p / vec2(uAsp, 1.0) + 0.5; }
void main(){
  float e = u * u * (3.0 - 2.0 * u);
  vec3 A = texture2D(texA, tw(vUv, 9.0 * e)).rgb, B = texture2D(texB, tw(vUv, -9.0 * (1.0 - e))).rgb;
  vec3 col = mix(A, B, smoothstep(0.4, 0.6, u));
  float d = length((vUv - 0.5) * vec2(uAsp, 1.0));
  col += SIGNAL * exp(-d * 30.0) * 1.0 * sin(3.14159 * u);
  gl_FragColor = vec4(col, 1.0);
}`;

export default class AgpVortex implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, api.u);
  }
  dispose() { this.pass.dispose(); }
}
