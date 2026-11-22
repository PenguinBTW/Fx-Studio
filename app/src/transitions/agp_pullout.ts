// agp_pullout (a7->a8): the shot shrinks into a clip and drops onto the timeline's orange playhead.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/agent_promo/tkit';

const FRAG = `
void main(){
  float e = u < 0.5 ? 4.0*u*u*u : 1.0 - pow(-2.0*u + 2.0, 3.0) / 2.0;
  float s = mix(1.0, 0.16, e); vec2 c = mix(vec2(0.5), vec2(0.5, 0.36), e);
  vec2 q = (vUv - c) / s + 0.5;
  float inA = step(max(abs(q.x - 0.5), abs(q.y - 0.5)), 0.5);
  vec2 bq = abs(q - 0.5) * 2.0; float edge = inA * step(1.0 - 0.06 / max(s, 0.2) * 0.4, max(bq.x, bq.y)) * step(0.02, e);
  vec3 B = texture2D(texB, 0.5 + (vUv - 0.5) * mix(0.8, 1.0, e)).rgb * smoothstep(0.1, 0.8, e);
  vec3 col = mix(B, texture2D(texA, q).rgb, inA);
  col = mix(col, SIGNAL * 1.5, edge * (1.0 - smoothstep(0.85, 1.0, u)));
  col = mix(col, B, smoothstep(0.8, 1.0, u));
  gl_FragColor = vec4(col, 1.0);
}`;

export default class AgpPullout implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, api.u);
  }
  dispose() { this.pass.dispose(); }
}
