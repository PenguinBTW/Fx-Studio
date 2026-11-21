// fxp_page_fold (A7 paper -> A8 plotter): the frame folds over along a moving diagonal crease like a page being turned;
// the folded flap shows A's mirrored back (darker, paper-tinted), the plotter's carbon sheet lies beneath.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';
import { ease } from '../engine/util';

const FRAG = `void main(){
  vec2 p = vec2(vUv.x * uAsp, vUv.y);
  vec2 n = normalize(vec2(-1.0, -0.6));
  vec2 o = vec2(uAsp, 1.0) + n * (u * 2.6);
  float d = dot(p - o, n);
  vec3 c;
  if (d > 0.0) { c = texture2D(texB, vUv).rgb * (0.65 + 0.35 * smoothstep(0.0, 0.25, d)); }
  else {
    vec2 m = p - 2.0 * d * n;
    vec2 mu = vec2(m.x / uAsp, m.y);
    bool onFlap = m.x >= 0.0 && m.x <= uAsp && m.y >= 0.0 && m.y <= 1.0 && dot(m - o, n) > 0.0;
    c = texture2D(texA, vUv).rgb;
    if (onFlap) c = mix(vec3(0.88, 0.85, 0.78) * (0.75 + 0.25 * smoothstep(0.0, 0.3, -d)), texture2D(texA, mu).rgb, 0.12);
  }
  c += SIGNAL * smoothstep(0.004, 0.0, abs(d)) * 2.5 * sin(3.14159 * u);
  gl_FragColor = vec4(c, 1.0);
}`;

export default class FxpPageFold implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, ease.inOutCubic(api.u));
  }
  dispose() { this.pass.dispose(); }
}
