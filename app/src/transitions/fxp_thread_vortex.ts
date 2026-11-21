// fxp_thread_vortex (A9 rush -> A10 finale): the outgoing world is wound into a swirl about the centre and sucked
// into it; its brightest pixels streak as orange threads and the finale's vortex unwinds out of the same eye.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';
import { ease } from '../engine/util';

const FRAG = `vec2 swirl(vec2 uv, float k){ vec2 p = (uv - 0.5) * vec2(uAsp, 1.0); float r = length(p);
  float a = k * 9.0 * exp(-r * 1.6); p = mat2(cos(a), -sin(a), sin(a), cos(a)) * p; p *= 1.0 + k * 1.5 * (1.0 - r);
  return p / vec2(uAsp, 1.0) + 0.5; }
void main(){
  vec3 A = texture2D(texA, swirl(vUv, u)).rgb;
  vec3 B = texture2D(texB, swirl(vUv, -(1.0 - u) * 0.8)).rgb;
  float lum = dot(A, vec3(0.3, 0.6, 0.1));
  A += SIGNAL * smoothstep(0.6, 1.2, lum) * u * 2.0;
  float r = length((vUv - 0.5) * vec2(uAsp, 1.0));
  float m = smoothstep(u * 1.3, u * 1.3 - 0.25, r);
  gl_FragColor = vec4(mix(A, B, m), 1.0);
}`;

export default class FxpThreadVortex implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, ease.inOutCubic(api.u));
  }
  dispose() { this.pass.dispose(); }
}
