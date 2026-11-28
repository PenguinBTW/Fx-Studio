// agp_slice (a3->a4): CUT. An orange blade slices the frame diagonally on the downbeat; the halves part onto the city.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/agent_promo/tkit';

const FRAG = `
void main(){
  vec2 n = normalize(vec2(1.0, -0.55)); vec2 p = (vUv - 0.5) * vec2(uAsp, 1.0);
  float s = dot(p, n), cut = smoothstep(0.0, 0.25, u), part = smoothstep(0.2, 1.0, u);
  float side = sign(s);
  vec2 off = vec2(-n.y, n.x) * side * part * 0.9 + n * side * part * 0.08;
  vec2 ua = vUv - off / vec2(uAsp, 1.0);
  vec3 A = texture2D(texA, ua).rgb * (1.0 - 0.4 * part);
  float gap = abs(s) < part * 0.06 + 0.0001 ? 1.0 : 0.0;
  float outA = step(1.0, max(abs(ua.x - 0.5), abs(ua.y - 0.5)) * 2.0);
  vec3 B = texture2D(texB, 0.5 + (vUv - 0.5) * (1.0 + 0.12 * (1.0 - part))).rgb;
  vec3 col = (part > 0.0 && (gap > 0.0 || outA > 0.0)) ? B : A;
  float along = dot(p, vec2(-n.y, n.x));
  float blade = exp(-abs(s) * 400.0) * step(along, mix(-1.2, 1.2, cut)) * (1.0 - part);
  col += SIGNAL * blade * 3.0;
  gl_FragColor = vec4(col, 1.0);
}`;

export default class AgpSlice implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, api.u);
  }
  dispose() { this.pass.dispose(); }
}
