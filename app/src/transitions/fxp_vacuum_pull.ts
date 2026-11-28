// fxp_vacuum_pull (A4 collapsing city -> A5 vacuum): the whole frame is sucked vertically into the horizon line with a
// horizontal luminance smear; what is left is one bright line: the Thread, on black.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';
import { ease } from '../engine/util';

const FRAG = `void main(){
  float s = max(0.002, 1.0 - u);
  float y = 0.5 + (vUv.y - 0.5) / s;
  vec3 A = vec3(0.0);
  if (y > 0.0 && y < 1.0) {
    for (int k = -3; k <= 3; k++) A += texture2D(texA, vec2(vUv.x + float(k) * 0.012 * u, y)).rgb;
    A /= 7.0;
    A *= 1.0 + 2.5 * u;
  }
  vec3 B = texture2D(texB, vUv).rgb;
  float line = smoothstep(0.004 + 0.02 * (1.0 - u), 0.0, abs(vUv.y - 0.5)) * u;
  vec3 c = mix(A, B, smoothstep(0.75, 1.0, u)) + SIGNAL * line * 2.0;
  gl_FragColor = vec4(c, 1.0);
}`;

export default class FxpVacuumPull implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, ease.inCubic(api.u));
  }
  dispose() { this.pass.dispose(); }
}
