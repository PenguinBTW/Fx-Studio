// fxp_flash_insert (intro snares): a 2-frame flash-forward to a future world, black gap, a second world, then back.
// Shots are picked from the pool by absolute time, so each insert is different and still deterministic.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';

const POOL: [string, number][] = [
  ['a4_city', 72.5], ['s7_tunnel', 110.3], ['a7_paper', 137.2], ['s10_finale', 203.5],
  ['a4_city', 60.4], ['s7_tunnel', 121.0], ['a7_paper', 152.4], ['s2_surface', 30.1],
];

const FRAG = `uniform float uK; uniform float uSl;
void main(){
  vec2 q = vec2(vUv.x + uSl * (step(0.5, fract(vUv.y * 3.0)) - 0.5) * 0.04, vUv.y);
  vec3 c = texture2D(texA, q).rgb * uK;
  float l = 0.0;
  gl_FragColor = vec4(c + SIGNAL * l, 1.0);
}`;

export default class FxpFlashInsert implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG, { uK: { value: 0 }, uSl: { value: 0 } }); }
  render(f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    const u = api.u;
    if (u < 0.22) { this.pass.draw(out, a, null, u, { uK: 1, uSl: 0 }); return; }
    if (u >= 0.8) { this.pass.draw(out, b, null, u, { uK: 1, uSl: 0 }); return; }
    if (u >= 0.48 && u < 0.54) { this.pass.draw(out, null, null, u, { uK: 0, uSl: 0 }); return; }
    const base = Math.floor(api.from.length * 7 + f.t * 0.37) * 2;
    const second = u >= 0.54;
    const [id, at] = POOL[(base + (second ? 1 : 0)) % POOL.length]!;
    const lu = second ? (u - 0.54) / 0.26 : (u - 0.22) / 0.26;
    this.pass.draw(out, api.sampleScene(id, at + 0.1 * lu), null, u, { uK: 1, uSl: 1 - lu });
    return { ca: 1.5, grain: 0.08, fade: 0, exposure: 1 };
  }
  dispose() { this.pass.dispose(); }
}
