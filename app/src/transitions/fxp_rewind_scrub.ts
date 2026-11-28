// fxp_rewind_scrub: the outgoing world is scrubbed backwards like a tape: horizontal tear bands slide and
// chroma-split, then the incoming (rewinding) world locks in band by band from the top.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';

const FRAG = `float hh(float n){ return fract(sin(n * 91.7) * 43758.5453); }
void main(){
  float rows = 18.0;
  float r = floor(vUv.y * rows);
  float w = sin(3.14159 * u);
  float off = (hh(r + floor(u * 14.0) * 7.0) - 0.5) * 0.35 * w + w * 0.06 * sin(vUv.y * 90.0 + u * 40.0);
  float lock = smoothstep(0.0, 0.08, u * 1.25 - (1.0 - vUv.y) * 0.9 - hh(r) * 0.25);
  vec2 q = vec2(fract(vUv.x + off), vUv.y);
  float ca = 0.012 * w;
  vec3 a = vec3(texture2D(texA, q + vec2(ca, 0.0)).r, texture2D(texA, q).g, texture2D(texA, q - vec2(ca, 0.0)).b);
  vec3 b = vec3(texture2D(texB, q - vec2(ca, 0.0)).r, texture2D(texB, q).g, texture2D(texB, q + vec2(ca, 0.0)).b);
  vec3 c = mix(a, b, lock);
  float edge = smoothstep(0.02, 0.0, abs(fract(vUv.y * rows) - 0.5) - 0.47) * w;
  c = mix(c, c * 0.55, edge) + SIGNAL * edge * 0.35 * step(0.6, hh(r * 3.1 + floor(u * 20.0)));
  c *= 0.92 + 0.08 * sin(vUv.y * 1080.0);
  gl_FragColor = vec4(c, 1.0);
}`;

export default class FxpRewindScrub implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, api.u);
  }
}
