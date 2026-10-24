// Push: incoming scene slides in from the right over the outgoing frame.
// Texture-only slide via compositor UV offsets: A shifts left by u, B
// shifts right by (1-u), so the seam sits at screen x = 1-u.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';

export default class Push implements Transition {
  constructor(private ctx: TransitionCtx) {}

  render(
    _f: Frame,
    out: THREE.WebGLRenderTarget,
    a: THREE.Texture,
    b: THREE.Texture,
    api: TransitionAPI,
  ): PostOverrides | void {
    const u = Math.min(1, Math.max(0, api.u));
    const { renderer, comp } = this.ctx;
    comp.draw(renderer, a, out, { mode: 'replace', offset: [u, 0] });
    comp.draw(renderer, b, out, { mode: 'normal', offset: [-(1 - u), 0] });
    renderer.resetState();
    return;
  }
}
