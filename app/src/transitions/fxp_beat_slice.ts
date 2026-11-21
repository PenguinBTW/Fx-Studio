// fxp_beat_slice (recap rush): six horizontal slices; the incoming world slides in slice by slice on 16ths, alternating
// directions, with motion smear on the moving slice and an orange seam at each slice edge.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';
import { ease } from '../engine/util';

const FRAG = `void main(){
  float n = 6.0, i = floor(vUv.y * n);
  float k = clamp(u * 1.6 - i / n * 0.6, 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  float dir = mod(i, 2.0) < 0.5 ? 1.0 : -1.0;
  float off = (1.0 - k) * dir;
  float x = vUv.x + off;
  vec3 c = texture2D(texA, vec2(vUv.x - k * dir * 0.3, vUv.y)).rgb;
  if (x >= 0.0 && x <= 1.0) {
    vec3 B = vec3(0.0);
    for (int j = 0; j < 4; j++) B += texture2D(texB, vec2(x + float(j) * 0.01 * (1.0 - k) * dir, vUv.y)).rgb;
    c = B / 4.0;
  }
  float seam = smoothstep(0.003, 0.0, abs(x - (dir > 0.0 ? 0.0 : 1.0))) * (1.0 - k);
  gl_FragColor = vec4(c + SIGNAL * seam * 3.0, 1.0);
}`;

export default class FxpBeatSlice implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, api.u);
  }
  dispose() { this.pass.dispose(); }
}
