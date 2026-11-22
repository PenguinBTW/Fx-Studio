// agp_tape_lift (a1->a2): the punched tape sweeps up through frame; its orange leading edge wipes onto the desk.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/agent_promo/tkit';

const FRAG = `
void main(){
  float e = u * u * (3.0 - 2.0 * u);
  float y = mix(-0.35, 1.35, e);                       // tape band centre
  float w = 0.28, d = vUv.y - y;
  vec3 A = texture2D(texA, vUv + vec2(0.0, -0.06 * e)).rgb, B = texture2D(texB, vUv + vec2(0.0, 0.05 * (1.0 - e))).rgb;
  vec3 col = d > w ? A : (d < -w ? B : vec3(0.0));
  if (abs(d) <= w) {
    vec2 g = vec2(vUv.x * uAsp * 18.0, (d + w) / (2.0 * w) * 9.0);
    float hole = step(length(fract(g) - 0.5), 0.22) * step(th(floor(g)), 0.45);
    float spr = step(abs((d + w) / (2.0 * w) - 0.5), 0.04) * step(length(fract(vec2(g.x * 0.5, 0.5)) - 0.5), 0.2);
    col = mix(vec3(0.62, 0.55, 0.44), vec3(0.02), max(hole, spr));
    col = mix(col, SIGNAL * 1.6, step(w - 0.012, d));
    col *= 0.85 + 0.15 * smoothstep(-w, w, d);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export default class AgpTapeLift implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, api.u);
  }
  dispose() { this.pass.dispose(); }
}
