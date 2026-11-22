// S0 cold open (0-5.6 s): pure black, one white cursor blinking on the riff; the agent introduces itself.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { bar } from '../agent_promo/kit';
import { overlayTextDuck } from '../../engine/transition';
import { term, type TLine } from './term';

export const S0_LINES: TLine[] = [{ text: "everything you're about to see is me.", at: bar(1) + 0.15, hold: 0.9, cps: 17 }];

export default class S0Open extends Scene {
  private layer = new Layer2D();
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const g = this.layer.ctx; this.layer.clear();
    term(g, S0_LINES, f.t, { size: 46, alpha: overlayTextDuck(f.tin, f.tout) });
    const r = this.ctx.renderer; r.setRenderTarget(out); r.setClearColor(0x000000, 1); r.clear(true, true, true);
    this.ctx.comp.draw(r, this.layer.upload(), out, { mode: 'normal', opacity: 1 }); r.resetState();
    return { toneMap: 'aces', exposure: 1.0, bloom: 0.35, bloomThreshold: 0.6, grain: 0.06, vignette: 0.3 };
  }
  override dispose() { this.layer.texture.dispose(); }
}
