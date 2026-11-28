// agp_shutter (a4->a5): CHECK. The city freezes on the seam's first frame (sampled at a fixed t), an orange-edged
// hexagonal iris closes on it like a camera taking the still, and opens again inside the print room.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/agent_promo/tkit';

const AT = 57.7;
const FRAG = `
void main(){
  vec2 p = (vUv - 0.5) * vec2(uAsp, 1.0);
  float a = atan(p.y, p.x), sector = 3.14159 / 3.0;
  float rot = u * 1.2;
  float k = mod(a + rot, sector) - sector * 0.5;
  float hex = length(p) * cos(k) / cos(sector * 0.5);
  float close = u < 0.5 ? 1.0 - smoothstep(0.0, 0.5, u) : smoothstep(0.5, 1.0, u);
  float R = max(close * 1.15, 0.035);
  vec3 src = u < 0.5 ? texture2D(texA, vUv).rgb : texture2D(texB, 0.5 + (vUv - 0.5) * (1.0 + 0.1 * (1.0 - u))).rgb;
  float open = step(hex, R);
  float f = fract((a + rot) / sector);
  float seam = 1.0 - smoothstep(0.0, 0.012, abs(f - 0.5) * hex);
  vec3 metal = vec3(0.07, 0.072, 0.08) * (0.45 + 0.9 * f) * (0.7 + 0.5 * smoothstep(1.2, 0.0, hex));
  metal = mix(metal, SIGNAL * 0.9, seam * 0.6);
  vec3 col = mix(metal, src, open);
  col = mix(col, SIGNAL * 1.6, (1.0 - smoothstep(0.0, 0.006, abs(hex - R))) * step(0.01, R));
  gl_FragColor = vec4(col, 1.0);
}`;

export default class AgpShutter implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, _a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, api.sampleScene(api.from, AT), b, api.u);
  }
  dispose() { this.pass.dispose(); }
}
