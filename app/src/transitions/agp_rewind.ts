// agp_rewind (a6->a7): REWRITE. The critique wall plays backwards (sampled at decreasing t) with tape-warble
// tracking bands while the orange playhead sweeps right-to-left; behind it is the v1 city that is about to be rewritten.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/agent_promo/tkit';

const AT = 98.8, BACK = 6;
const FRAG = `
void main(){
  float x = mix(1.04, -0.04, u * u * (3.0 - 2.0 * u));
  float band = step(0.82, tn(vec2(vUv.y * 14.0, u * 40.0)));
  vec2 ua = vUv + vec2(band * 0.03 * (tn(vec2(vUv.y * 90.0, u * 70.0)) - 0.5), 0.0);
  vec3 A = texture2D(texA, ua).rgb; A = mix(A, vec3(dot(A, vec3(0.3, 0.59, 0.11))), 0.35) * (1.0 - 0.25 * band);
  vec3 B = texture2D(texB, vUv).rgb;
  vec3 col = vUv.x < x ? A : B;
  float d = abs(vUv.x - x) * uAsp;
  col += SIGNAL * (exp(-d * 260.0) * 3.0 + exp(-d * 18.0) * 0.25);
  gl_FragColor = vec4(col, 1.0);
}`;

export default class AgpRewind implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, _a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    const u = api.u;
    this.pass.draw(out, api.sampleScene(api.from, AT - BACK * u * u), b, u);
  }
  dispose() { this.pass.dispose(); }
}
