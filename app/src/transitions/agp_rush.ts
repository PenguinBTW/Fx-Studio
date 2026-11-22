// agp_rush (a8->a9, bars 81-93): the rush. Every act is re-sampled at a chosen moment (live, not a still) and cut on an
// accelerating grid: 2 beats, 1 beat, 1/2, 1/4. Each cut is marked by the orange cut bar. Every fourth slot is the
// print tunnel (a9); the last bar is the tunnel alone. At most two scene samples per frame.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ShaderPass } from '../scenes/agent_promo/tkit';
import { BEAT, bar } from '../scenes/agent_promo/kit';

const CLIPS: [string, number][] = [
  ['a1_tape', 10.5], ['a2_plan', 24], ['a3_swarm', 33], ['a4_build', 41], ['a5_print', 64.5], ['a6_critique', 79.5],
  ['a7_rewrite', 109.5], ['a8_meta', 131], ['a0_cursor', 2.6], ['a2_plan', 21], ['a4_build', 47], ['a6_critique', 86],
  ['a3_swarm', 30], ['a7_rewrite', 116], ['a5_print', 61], ['a1_tape', 14], ['a4_build', 53], ['a8_meta', 146],
];
const SEG: [number, number][] = [[81, 2], [85, 1], [89, 0.5], [91, 0.25], [93, 0]];
/** Cut grid: returns [slot index, slot start time, slot length]. */
export function slotAt(t: number): [number, number, number] {
  let idx = 0;
  for (let s = 0; s < SEG.length - 1; s++) {
    const [b0, beats] = SEG[s]!, b1 = SEG[s + 1]![0], len = beats * BEAT, t0 = bar(b0), n = Math.round((bar(b1) - t0) / len);
    if (t < bar(b1) || s === SEG.length - 2) { const k = Math.min(n - 1, Math.max(0, Math.floor((t - t0) / len))); return [idx + k, t0 + k * len, len]; }
    idx += n;
  }
  return [0, 0, 1];
}
const FRAG = `
uniform float uLocal; uniform float uLen; uniform float uTail;
void main(){
  float z = 1.0 + 0.06 * uLocal / max(uLen, 0.01);
  vec3 col = mix(texture2D(texA, 0.5 + (vUv - 0.5) / z).rgb, texture2D(texB, vUv).rgb, uTail);
  float bx = uLocal / 0.09;
  if (bx < 1.0) { float x = mix(-0.1, 1.1, bx); col = mix(col, SIGNAL * 1.5, step(abs(vUv.x - x), 0.035)); }
  gl_FragColor = vec4(col, 1.0);
}`;

export default class AgpRush implements Transition {
  private pass: ShaderPass;
  constructor(ctx: TransitionCtx) { this.pass = new ShaderPass(ctx, FRAG, { uLocal: { value: 0 }, uLen: { value: 1 }, uTail: { value: 0 } }); }
  render(f: Frame, out: THREE.WebGLRenderTarget, _a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    const t = f.t, [i, t0, len] = slotAt(t), local = t - t0;
    const tunnel = t >= bar(92.5) || i % 4 === 3;
    const tail = t >= bar(92.5) ? 1 : 0;
    const [id, ct] = CLIPS[i % CLIPS.length]!;
    const src = tunnel ? b : api.sampleScene(id, ct + local);
    this.pass.draw(out, src, b, api.u, { uLocal: tail ? 9 : local, uLen: len, uTail: tail });
  }
  dispose() { this.pass.dispose(); }
}
