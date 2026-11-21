// fxp_flash_forward (cold open, 0 - 1.3 s): before the first line is plotted the film flashes forward through four of its
// future worlds for a few frames each (random access: any t, any order), black frames between, then the paper opens.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/fx_promo/tkit';

const SHOTS: [string, number][] = [['a4_city', 74.2], ['a7_paper', 148.3], ['s7_tunnel', 104.1], ['s3_type', 44.6], ['a4_city', 92.0], ['s10_finale', 214.0]];
const DUR = 1.3, ON = 0.16, GAP = 0.04, LEAD = 0;

const FRAG = `uniform float uK; uniform float uSl;
void main(){
  vec2 q = vec2(vUv.x + uSl * (step(0.5, fract(vUv.y * 3.0)) - 0.5) * 0.04, vUv.y);
  vec3 c = texture2D(texA, q).rgb * uK;
  float l = 0.0;
  gl_FragColor = vec4(c + SIGNAL * l, 1.0);
}`;

export default class FxpFlashForward implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG, { uK: { value: 0 }, uSl: { value: 0 } }); }
  render(_f: Frame, out: THREE.WebGLRenderTarget, _a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    const t = api.u * DUR - LEAD;
    const i = Math.floor(t / (ON + GAP)), lt = t - i * (ON + GAP);
    if (t < 0 || i >= SHOTS.length) { this.pass.draw(out, t < 0 ? null : b, null, api.u, { uK: t < 0 ? 0 : 1, uSl: 0 }); return; }
    if (lt > ON) { this.pass.draw(out, null, null, api.u, { uK: 0, uSl: 0 }); return; }
    const [id, at] = SHOTS[i]!;
    this.pass.draw(out, api.sampleScene(id, at + lt), null, api.u, { uK: 1, uSl: 1 - lt / ON });
    return { ca: 1.5, grain: 0.08, fade: 0, exposure: 1 };
  }
  dispose() { this.pass.dispose(); }
}
