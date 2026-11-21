// fxp_prism_slit (A1 plot -> Prism): the collapsed plot line at mid-frame splits into a spectral slit; its edges
// disperse R/G/B apart as it opens and the glass cathedral is revealed through it.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';
import { ease } from '../engine/util';

const FRAG = `void main(){
  float y = vUv.y - 0.5;
  float w = 0.004 + 0.56 * u * u;
  vec3 A = texture2D(texA, vUv).rgb;
  float sh = 0.012 * sin(3.14159 * u);
  vec3 B = vec3(texture2D(texB, vUv + vec2(0.0, sh)).r, texture2D(texB, vUv).g, texture2D(texB, vUv - vec2(0.0, sh)).b);
  float m = smoothstep(w, w - 0.01 - 0.03 * u, abs(y));
  float edge = exp(-abs(abs(y) - w) * 160.0) * (1.0 - u * 0.6);
  vec3 spec = 0.5 + 0.5 * cos(6.2831 * (vUv.x * 1.3 + vec3(0.0, 0.33, 0.67) + u));
  vec3 c = mix(A * (1.0 - 0.7 * u), B, m);
  c += mix(SIGNAL, spec, smoothstep(0.1, 0.5, u)) * edge * 2.4;
  gl_FragColor = vec4(c, 1.0);
}`;

export default class FxpPrismSlit implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, ease.inOutCubic(api.u));
  }
  dispose() { this.pass.dispose(); }
}
