// s6_vacuum (bars 49-50, 95.05 - 98.94 s): the breakdown. Every remaining particle is pulled into one horizontal
// line; a 3 · 2 · 1 count rides the last bar and the line collapses to a point on the silent fourth beat.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { LineBatch } from '../../engine/lines';
import { F } from '../../engine/type';
import { clamp, ease, prog, hash } from '../../engine/util';
import { C, BEAT, bar, sceneTime, present, slam, lin } from './kit';

const P = 900;

export default class S6Vacuum extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera();
  private layer = new Layer2D();
  private lines = new LineBatch(P + 16, { blend: 'add' });

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t);
    const u = prog(T, bar(49), bar(50.6), ease.inOutCubic);
    const pinch = prog(T, bar(50) + 2.6 * BEAT, bar(51) - 0.04, ease.inCubic);
    const L = this.lines;
    L.clear();
    const bone = lin(C.bone, 1.2), sig = lin(C.signal, 2.5);
    const half = 900 * (1 - pinch);
    for (let i = 0; i < P; i++) {
      const hx = hash(i, 1), hy = hash(i, 2), hs = hash(i, 3);
      const x0 = hx * 1920, y0 = hy * 1080;
      const k = clamp(u * (1.2 + hs * 0.6));
      const y = y0 + (540 - y0) * ease.inCubic(k);
      const x = 960 + (x0 - 960) * (1 - pinch);
      const vy = (540 - y0) * 0.08 * (k > 0 && k < 1 ? 1 : 0);
      const c = i % 9 === 0 ? sig : bone;
      L.seg(x, y - vy, 0, x, y, 0, 1.6, c[0], c[1], c[2], 0.35 + 0.4 * hs);
    }
    const lw = 1 + 5 * u + 6 * pinch;
    L.seg(960 - half * u, 540, 0, 960 + half * u, 540, 0, lw, sig[0] * 1.3, sig[1] * 1.3, sig[2] * 1.3, u);

    const g = this.layer.ctx;
    this.layer.clear();
    ['3', '2', '1'].forEach((d, j) => {
      const t0 = bar(50) + j * BEAT;
      slam(g, d, 960, 400, T, { t0, t1: t0 + BEAT - 0.05, size: 220, family: F.mono(600), from: 1.5, shake: 3, out: 0.06, color: j === 2 ? C.signal : C.bone });
    });
    present(this.ctx, out, this.scene, this.cam, this.layer, () => L.render(this.ctx.renderer, out));
    return { exposure: 1.0, bloom: 0.9, bloomThreshold: 0.5, vignette: 0.6 + 0.3 * pinch, ca: 0.4 + 2 * pinch, grain: 0.06, zoom: 1 + 0.08 * pinch };
  }
}
