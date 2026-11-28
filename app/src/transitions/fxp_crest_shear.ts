// fxp_crest_shear (A2 terrain -> A3 type canyon): the frame is cut into letter-width vertical bands that shear upward
// at staggered rates, terrain peaks lifting into monoliths; the canyon is revealed behind and rises after them.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';

const FRAG = `void main(){
  float n = 24.0, i = floor(vUv.x * n);
  float k = clamp(u * 1.7 - th(vec2(i, 3.0)) * 0.7, 0.0, 1.0);
  float lift = k * k * (3.0 - 2.0 * k) * 1.15;
  vec2 ua = vec2(vUv.x, vUv.y - lift);
  float kb = clamp(u * 1.7 - 0.7 - th(vec2(i, 9.0)) * 0.3 + 0.3, 0.0, 1.0);
  vec2 ub = vec2(vUv.x, vUv.y + (1.0 - kb) * 0.12);
  vec3 B = texture2D(texB, ub).rgb * (0.55 + 0.45 * kb);
  vec3 c = B;
  if (ua.y >= 0.0) { vec3 A = texture2D(texA, ua).rgb; float edge = smoothstep(0.02, 0.0, ua.y) * k; c = A + SIGNAL * edge * 3.0; }
  float seam = smoothstep(0.0015, 0.0, abs(fract(vUv.x * n) - 0.0)) * k * (1.0 - k) * 4.0;
  gl_FragColor = vec4(c + SIGNAL * seam, 1.0);
}`;

export default class FxpCrestShear implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, api.u);
    return { shake: [0, 0] };
  }
  dispose() { this.pass.dispose(); }
}
