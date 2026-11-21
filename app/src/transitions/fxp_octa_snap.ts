// fxp_octa_snap (A5 vacuum line -> A6 tunnel drop): on the drop the line snaps into an octagon (the tunnel's own
// cross-section) that expands from centre, the tunnel inside it; an orange rim and a decaying flash ride the edge.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';
import { ease } from '../engine/util';

const FRAG = `float oct(vec2 p, float r){ p = abs(p); float d = max(p.x, p.y); d = max(d, (p.x + p.y) * 0.70710678); return d - r; }
void main(){
  vec2 p = (vUv - 0.5) * vec2(uAsp, 1.0);
  float r = u * u * 1.25;
  float d = oct(p, r);
  vec3 A = texture2D(texA, vUv).rgb, B = texture2D(texB, 0.5 + (vUv - 0.5) * (1.0 + 0.25 * (1.0 - u))).rgb;
  vec3 c = d < 0.0 ? B : A * (1.0 - 0.6 * u);
  float rim = smoothstep(0.012, 0.0, abs(d)) * (1.0 - u * 0.5);
  float flash = exp(-u * 9.0) * 0.22;
  gl_FragColor = vec4(c + SIGNAL * rim * 3.0 + vec3(flash), 1.0);
}`;

export default class FxpOctaSnap implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, ease.outCubic(api.u));
  }
  dispose() { this.pass.dispose(); }
}
