// fxp_ink_bleed (A1 paper -> A2 signal field): indigo ink soaks outward through the paper fibres from the plotted
// line at mid-frame; the line itself stays lit as the orange Thread and becomes the terrain crest.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';
import { ease } from '../engine/util';

const FRAG = `void main(){
  vec2 p = vec2(vUv.x * uAsp, vUv.y);
  float line = vUv.y - 0.5 - 0.06 * sin(vUv.x * 7.0 + 1.3) * sin(vUv.x * 2.3);
  float d = abs(line) + 0.22 * (tfbm(p * 6.0) - 0.5) - 0.08 * (tfbm(p * 30.0) - 0.5);
  float front = u * 1.05;
  float m = smoothstep(front, front - 0.03, d);
  float ring = smoothstep(0.05, 0.0, abs(d - front)) * (1.0 - u);
  vec3 A = texture2D(texA, vUv).rgb, B = texture2D(texB, vUv).rgb;
  vec3 ink = vec3(0.04, 0.05, 0.22);
  vec3 c = mix(A, ink, ring * 0.9);
  c = mix(c, B, m);
  float thread = smoothstep(0.006, 0.0, abs(line)) * sin(3.14159 * u) * 2.4;
  gl_FragColor = vec4(c + SIGNAL * thread, 1.0);
}`;

export default class FxpInkBleed implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, ease.inOutCubic(api.u));
  }
  dispose() { this.pass.dispose(); }
}
