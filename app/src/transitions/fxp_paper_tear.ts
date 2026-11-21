// fxp_paper_tear (A6 tunnel -> A7 paper diorama): the tunnel mouth blows out to white, then a torn paper edge with
// fibrous white margin rips diagonally across, revealing the paper world on the far side.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';
import { ease } from '../engine/util';

const FRAG = `void main(){
  vec2 p = vec2(vUv.x * uAsp, vUv.y);
  vec3 A = texture2D(texA, vUv).rgb;
  float bloom = smoothstep(0.0, 0.45, u);
  A = mix(A, vec3(1.4, 1.35, 1.25), bloom * smoothstep(0.9, 0.1, length((vUv - 0.5) * vec2(uAsp, 1.0))) * 0.9);
  float edge = (p.x * 0.55 + p.y * 0.45) - (u * 1.9 - 0.35) + 0.06 * tfbm(p * vec2(4.0, 22.0)) + 0.012 * tfbm(p * 140.0);
  vec3 B = texture2D(texB, vUv).rgb;
  float fib = smoothstep(0.0, 0.012, edge) * smoothstep(0.035 + 0.02 * tn(p * 60.0), 0.012, edge);
  vec3 c = edge < 0.0 ? B * (1.0 - 0.25 * smoothstep(-0.03, 0.0, edge)) : A;
  c = mix(c, vec3(0.97, 0.95, 0.9), fib);
  gl_FragColor = vec4(c, 1.0);
}`;

export default class FxpPaperTear implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, ease.inOutCubic(api.u));
  }
  dispose() { this.pass.dispose(); }
}
