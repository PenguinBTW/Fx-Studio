// Warp: Hyper-dimensional zoom-warp transition.
// Outgoing scene scales inward with exponential acceleration while incoming scene
// expands into place from a hyperspace focal point, driven with chromatic
// aberration bursts and optical bloom flares peaking at seam center (u = 0.5).
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';

export default class Warp implements Transition {
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

    // Eased scale curves:
    // Outgoing shrinks UV bounds (zooms into center)
    const scaleA = 1 - 0.4 * (u * u);
    // Incoming starts slightly expanded and snaps to unity
    const invU = 1 - u;
    const scaleB = 1 + 0.35 * (invU * invU);

    // Draw outgoing scene
    comp.draw(renderer, a, out, {
      mode: 'replace',
      scale: [scaleA, scaleA],
      opacity: Math.max(0, 1 - u * 1.15),
    });

    // Draw incoming scene over the top
    if (u > 0.001) {
      comp.draw(renderer, b, out, {
        mode: 'normal',
        scale: [scaleB, scaleB],
        opacity: Math.min(1, u * 1.2),
      });
    }
    renderer.resetState();

    // Dynamic optical post kick peaking mid-seam
    const peak = Math.sin(u * Math.PI);
    return {
      flash: peak * 0.35,
      bloom: 0.55 + peak * 0.75,
      ca: 1.2 + peak * 14.0,
      zoom: 1.0 + peak * 0.08,
      exposure: 1.0 + peak * 0.25,
    };
  }
}
