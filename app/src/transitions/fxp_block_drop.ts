// fxp_block_drop (A3 type canyon -> A4 dawn city): the canyon frame breaks into a city-block grid; tiles drop away on
// 8th notes from the centre outward (gravity + tumble), revealing the dawn city beneath like lots being cleared.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';

const FRAG = `void main(){
  vec2 g = vec2(16.0, 9.0);
  vec3 c = texture2D(texB, vUv).rgb;
  // Each pixel may be covered by its own tile or the tile above it falling through; test both.
  for (int k = 0; k < 3; k++) {
    vec2 cell = floor(vUv * g) + vec2(0.0, float(k));
    vec2 ctr = (cell + 0.5) / g;
    float dly = floor((length((ctr - 0.5) * vec2(uAsp, 1.0)) * 1.6 + th(cell) * 0.35) * 8.0) / 8.0;
    float tt = max(0.0, u * 2.2 - dly);
    float drop = 1.6 * tt * tt;
    float ang = (th(cell + 7.0) - 0.5) * 2.4 * tt;
    vec2 q = (vUv - ctr - vec2(0.0, -drop)) * vec2(uAsp, 1.0);
    q = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * q;
    q /= vec2(uAsp, 1.0); q /= (1.0 - 0.35 * min(tt, 1.0));
    vec2 half_ = 0.5 / g;
    if (abs(q.x) < half_.x && abs(q.y) < half_.y) {
      vec3 A = texture2D(texA, ctr + q).rgb;
      float edge = step(half_.x * 0.94, abs(q.x)) + step(half_.y * 0.92, abs(q.y));
      c = mix(A * (1.0 - 0.45 * min(tt * 2.0, 1.0)), vec3(0.06), clamp(edge, 0.0, 1.0) * min(tt * 6.0, 1.0));
      break;
    }
  }
  gl_FragColor = vec4(c, 1.0);
}`;

export default class FxpBlockDrop implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, api.u);
  }
  dispose() { this.pass.dispose(); }
}
