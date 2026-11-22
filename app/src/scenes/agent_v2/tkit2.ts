// Factory for the agent_v2 seams: a fullscreen shader over both participants. freezeA/freezeB re-render a participant
// at a fixed time via api.sampleScene (bullet-time seams); rewindA re-renders the outgoing scene playing backwards.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../../engine/transition';
import { ShaderPass } from '../agent_promo/tkit';

/** extra: additional re-rendered participant states, bound as sampler2D uniforms by name (e.g. B at later beats). */
export interface V2Opts { dur: number; freezeA?: boolean; freezeB?: boolean; rewindA?: number; post?: (u: number) => PostOverrides; extra?: Record<string, (api: TransitionAPI, t0: number, t: number) => THREE.Texture> }
export function v2Transition(frag: string, o: V2Opts) {
  return class V2T implements Transition {
    private pass: ShaderPass;
    constructor(ctx: TransitionCtx) { const ex = Object.keys(o.extra ?? {}); this.pass = new ShaderPass(ctx, `uniform float uT;\n${ex.map((k) => `uniform sampler2D ${k};`).join('\n')}\n${frag}`, { uT: { value: 0 }, ...Object.fromEntries(ex.map((k) => [k, { value: null }])) }); }
    render(f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
      const t0 = f.t - api.u * o.dur; let A = a, B = b;
      if (o.freezeA) A = api.sampleScene(api.from, t0);
      else if (o.rewindA) A = api.sampleScene(api.from, t0 - o.rewindA * (f.t - t0));
      if (o.freezeB) B = api.sampleScene(api.to, t0 + o.dur);
      const set: Record<string, unknown> = { uT: f.t }; for (const [k, fn] of Object.entries(o.extra ?? {})) set[k] = fn(api, t0, f.t);
      this.pass.draw(out, A, B, api.u, set);
      return o.post?.(api.u);
    }
    dispose() { this.pass.dispose(); }
  };
}
