// Chase: object-level transition — the incoming scene is RE-DRIVEN on
// eased local time through api.sampleScene(), so its intro choreography
// "catches up" through the seam while fading in over the outgoing frame.
// Impossible with finished textures alone: the transition evaluates B at
// times the normal timeline never plays (f.start is the to-entry start;
// at u=1 the eased time equals f.t, so the seam lands exactly on B).
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';

export default class Chase implements Transition {
  constructor(private ctx: TransitionCtx) {}

  render(
    f: Frame,
    out: THREE.WebGLRenderTarget,
    a: THREE.Texture,
    _b: THREE.Texture,
    api: TransitionAPI,
  ): PostOverrides | void {
    const u = Math.min(1, Math.max(0, api.u));
    const eased = u * u * (3 - 2 * u);
    const tB = f.start + eased * Math.max(0, f.t - f.start);
    const bEarly = api.sampleScene(api.to, tB);
    const { renderer, comp } = this.ctx;
    comp.draw(renderer, a, out, { mode: 'replace' });
    if (u > 0) comp.draw(renderer, bEarly, out, { mode: 'normal', opacity: u });
    renderer.resetState();
    return;
  }
}
