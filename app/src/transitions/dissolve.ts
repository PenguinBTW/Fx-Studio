// Dissolve: plain crossfade owned by a standalone block instead of the
// engine default. Texture-only; no scene driving needed.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';

export default class Dissolve implements Transition {
  constructor(private ctx: TransitionCtx) {}

  render(
    _f: Frame,
    out: THREE.WebGLRenderTarget,
    a: THREE.Texture,
    b: THREE.Texture,
    api: TransitionAPI,
  ): PostOverrides | void {
    const { renderer, comp } = this.ctx;
    comp.draw(renderer, a, out, { mode: 'replace' });
    if (api.u > 0) comp.draw(renderer, b, out, { mode: 'normal', opacity: Math.min(1, api.u) });
    return;
  }
}
