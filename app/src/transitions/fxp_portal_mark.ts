// fxp_portal_mark (s10 finale -> s11_mark, bar 105 to the end): feeds the portal wordmark. Each frame six worlds of the
// film are sampled live (api.sampleScene) into kit.portals, then the wordmark scene is re-rendered with them so its
// letters are windows into the film. The first 0.15 s dissolves out of the finale vortex.
import * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { overlay, portals } from '../scenes/fx_promo/kit';

const WORLDS: [string, number][] = [['a4_city', 80], ['a7_paper', 140], ['s7_tunnel', 110], ['s2b_prism', 23.5], ['a4_city', 62], ['a7_paper', 152]];
const DUR = 10.56;

export default class FxpPortalMark implements Transition {
  private rts: THREE.WebGLRenderTarget[];
  constructor(private ctx: TransitionCtx) {
    this.rts = WORLDS.map(() => new THREE.WebGLRenderTarget(1280, 720, { type: THREE.HalfFloatType, depthBuffer: false }));
  }
  render(f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, _b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    const { renderer: r, comp } = this.ctx;
    const el = api.u * DUR;
    overlay.on = false;
    try { WORLDS.forEach(([id, base], i) => comp.draw(r, api.sampleScene(id, base + (el % 6)), this.rts[i]!, { mode: 'replace' })); } finally { overlay.on = true; }
    portals.tex = this.rts.map((rt) => rt.texture);
    comp.draw(r, api.sampleScene(api.to, f.t), out, { mode: 'replace' });
    if (el < 0.15) comp.draw(r, a, out, { mode: 'normal', opacity: 1 - el / 0.15 });
  }
  dispose() { this.rts.forEach((rt) => rt.dispose()); }
}
