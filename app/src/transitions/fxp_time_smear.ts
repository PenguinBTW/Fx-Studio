// fxp_time_smear (A8 plotter -> A9a rewind city): random access as a seam. The outgoing scene is re-evaluated at three
// earlier times through api.sampleScene() and stacked as fading echoes while the rewinding city comes up underneath.
import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { ease } from '../engine/util';

const TAPS = [0.18, 0.42, 0.75];

export default class FxpTimeSmear implements Transition {
  private acc: THREE.WebGLRenderTarget;
  constructor(private ctx: TransitionCtx) {
    this.acc = new THREE.WebGLRenderTarget(1920, 1080, { type: THREE.HalfFloatType, depthBuffer: false });
  }
  render(f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    const { renderer: r, comp } = this.ctx;
    const u = ease.inOutCubic(api.u);
    comp.draw(r, b, this.acc, { mode: 'replace' });
    comp.draw(r, a, this.acc, { mode: 'normal', opacity: (1 - u) * 0.85 });
    for (let k = 0; k < TAPS.length; k++) {
      const echo = api.sampleScene(api.from, f.t - TAPS[k]! * (0.5 + 2 * u));
      comp.draw(r, echo, this.acc, { mode: 'screen', opacity: 0.45 * (1 - u * 0.6) * (1 - k / TAPS.length), tint: [1, 0.55 + 0.15 * k, 0.35 + 0.2 * k] });
    }
    comp.draw(r, this.acc.texture, out, { mode: 'replace' });
    r.resetState();
    return { ca: 1.5 * Math.sin(Math.PI * u) };
  }
  dispose() { this.acc.dispose(); }
}
