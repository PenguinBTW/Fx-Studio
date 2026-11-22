// agp_cursor_dive (a0->a1): the camera dives into the orange cursor; the cursor's face opens onto the tape.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/agent_promo/tkit';

const FRAG = `
float ease(float x){ return x < 0.5 ? 4.0*x*x*x : 1.0 - pow(-2.0*x + 2.0, 3.0) / 2.0; }
void main(){
  vec2 c = vec2(0.5, 0.5); float e = ease(u);
  vec2 p = (vUv - c) * vec2(uAsp, 1.0);
  vec2 ha = vec2(0.012, 0.022) * pow(60.0, e);          // cursor half-size grows as we dive
  vec3 A = texture2D(texA, c + (vUv - c) / (1.0 + 7.0 * e * e)).rgb;
  vec2 q = abs(p) / ha;
  float inside = step(max(q.x, q.y), 1.0);
  vec3 B = texture2D(texB, c + (vUv - c) * mix(0.35, 1.0, e)).rgb * smoothstep(0.25, 0.9, e);
  float rim = smoothstep(0.82, 1.0, max(q.x, q.y)) * inside;
  vec3 col = mix(A, mix(SIGNAL * 1.4, B, smoothstep(0.2, 0.75, e)), inside);
  col = mix(col, SIGNAL * 2.0, rim * (1.0 - e));
  gl_FragColor = vec4(col, 1.0);
}`;

export default class AgpCursorDive implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, api.u);
  }
  dispose() { this.pass.dispose(); }
}
