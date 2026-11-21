// fxp_glass_shatter (Prism -> A2 signal field): the frame cracks into Voronoi glass shards on the downbeat. Each
// shard refracts and slides away with its own chromatic offset, edges flaring spectral, revealing the terrain.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';

const FRAG = `
vec3 vor(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0; vec2 id = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(th(i + g), th(i + g + 17.3)); float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) d2 = d; }
  return vec3(id, d2 - d1); }
void main(){
  vec2 p = vec2(vUv.x * uAsp, vUv.y) * 7.0;
  vec3 v = vor(p);
  float r = th(v.xy + 3.1);
  float crack = smoothstep(0.0, 0.25, u);
  float go = clamp((u - 0.15 - 0.5 * r) * 2.6, 0.0, 1.0);
  vec2 dir = normalize(vec2(th(v.xy + 5.0) - 0.5, th(v.xy + 9.0) - 0.9));
  vec2 off = dir * go * go * 0.6;
  float ca = 0.01 * crack + 0.03 * go;
  vec2 uv = vUv + off;
  vec3 A = vec3(texture2D(texA, uv + vec2(ca, 0.0)).r, texture2D(texA, uv).g, texture2D(texA, uv - vec2(ca, 0.0)).b);
  vec3 B = texture2D(texB, vUv).rgb;
  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0) * (1.0 - smoothstep(0.75, 1.0, go));
  vec3 spec = 0.5 + 0.5 * cos(6.2831 * (r + vec3(0.0, 0.33, 0.67)));
  float edge = smoothstep(0.05, 0.0, v.z) * crack * (1.0 - go);
  vec3 c = mix(B, A * (1.0 + 0.3 * go), inside);
  gl_FragColor = vec4(c + spec * edge * 1.8, 1.0);
}`;

export default class FxpGlassShatter implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.draw(out, a, b, api.u);
  }
  dispose() { this.pass.dispose(); }
}
