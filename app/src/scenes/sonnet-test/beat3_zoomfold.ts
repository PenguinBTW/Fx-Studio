// BEAT 3: THE SAME LOCK, EVERYWHERE (30 - 58 s, window 30.0 - 58.8)
// Zoom-fold fragment shader, exp zoom of 1e6 over 28 s, pictogram labels, interlock counter,
// radial motion blur, and the single enormous G at ONE_LOCK (55.0).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D, FSPass, makeRT, W, H } from '../../engine/gl';
import { lerp, smoothstep, clamp } from '../../engine/util';
import { ZoomFold, zoomZ, zoomSpeed, zoomRot, zoomCenter, viewFromWorld, dimAt, parentK, TOP } from './zoomfold';
import { PX0, RATIO } from './glyph_glsl';
import { rgba } from './palette';

const TAGS = ['DOOR', 'PAYMENT', 'STEERING', 'FEED', 'BORDER', 'BUTTON'];

const BLUR = /* glsl */ `
uniform sampler2D src; uniform float amt; uniform vec2 ctr;
void main() {
  vec2 d = (vUv - ctr) * amt;
  vec3 c = vec3(0.0);
  for (int i = 0; i < 8; i++) c += texture(src, vUv - d * (float(i) / 7.0)).rgb;
  fragColor = vec4(c * 0.125, 1.0);
}`;

export default class Beat3ZoomFold extends Scene {
  private zf = new ZoomFold();
  private raw = makeRT(W, H, { depthBuffer: false });
  private blur = new FSPass(BLUR, { src: { value: null }, amt: { value: 0 }, ctr: { value: new THREE.Vector2(0.5, 0.5) } });
  private hud = new Layer2D();

  /** Zoom state for tooling / the transition. */
  probe(f: Frame) {
    const Z = zoomZ(f.t);
    return { zoomLog10: Math.log10(Z), onelock: f.t >= 55 ? 1 : 0 };
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = Math.max(30, f.t);
    const Z = zoomZ(t);
    const view = viewFromWorld(zoomCenter(t), Z, zoomRot(t));
    // the climax: the top glyph's lines gain weight while the lattice beneath recedes
    const climax = smoothstep(52, 55, t);
    this.zf.set(view, { dim: dimAt(f.t), parentK: parentK(Z), emph: lerp(1, 1.5, climax), latt: lerp(1, 0.55, climax) });
    this.zf.render(renderer, this.raw);

    // radial motion blur, strength tied to zoom speed
    const spd = zoomSpeed(f.t);
    this.blur.u.src!.value = this.raw.texture;
    this.blur.u.amt!.value = 0.06 * spd * spd;
    this.blur.render(renderer, out, true);
    renderer.resetState();

    // labels + counter
    const h = this.hud;
    h.clear();
    this.drawLabels(h.ctx, f.t, Z, view.root);
    this.drawCounter(h.ctx, f.t, Z);
    comp.draw(renderer, h.upload(), out, { mode: 'normal' });

    const k = spd;
    return {
      exposure: 1.0, bloom: 0.6, bloomThreshold: 0.8, bloomRadius: 0.5, halation: 0,
      vignette: 0.25, grain: 0.035, ca: 0.0006 * 960 + k * (0.0008 * 960),
      dof: 0,
    };
  }

  private drawLabels(ctx: CanvasRenderingContext2D, t: number, Z: number, _root: number) {
    const s = Math.log(Math.max(1, Z)) / Math.log(RATIO);
    ctx.font = '16px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
    ctx.textBaseline = 'alphabetic';
    for (let l = 1; l <= 6; l++) {
      // readable when the pictogram is large enough: G_l fills the frame at s ~ l
      const a = smoothstep(l - 0.95, l - 0.7, s) * (1 - smoothstep(l - 0.3, l, s));
      if (a < 0.01) continue;
      ctx.fillStyle = rgba('ash', 0.95 * a);
      (ctx as any).letterSpacing = '1.5px';
      ctx.fillText(TAGS[l - 1]!, 118, H - 96);
    }
  }

  private drawCounter(ctx: CanvasRenderingContext2D, t: number, Z: number) {
    const n = Math.round(Math.pow(RATIO, Math.min(7.7, Math.log(Math.max(1, Z)) / Math.log(RATIO) + 0.0)));
    const s = Math.min(Math.log10(1e6), Math.log(Math.max(1, Z)) / Math.log(10));
    const shown = Math.round(Math.pow(10, s));
    const txt = shown.toLocaleString('en-US');
    void n;
    ctx.font = '17px "JetBrains Mono", "Cascadia Mono", Consolas, monospace';
    ctx.textAlign = 'right';
    (ctx as any).letterSpacing = '1.6px';
    (ctx as any).fontVariantNumeric = 'tabular-nums';
    const a = smoothstep(30.5, 32, t) * (1 - smoothstep(57.2, 57.9, t) * 0.5);
    ctx.fillStyle = rgba('ash', 0.95 * a);
    ctx.fillText(txt, W - 96, H - 64);
    ctx.textAlign = 'left';
  }

  override dispose() {
    this.zf.dispose(); this.blur.dispose(); this.raw.dispose();
  }
}

void clamp; void PX0; void TOP;
