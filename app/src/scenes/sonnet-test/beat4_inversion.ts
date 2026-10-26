// BEAT 4: THE INVERSION (58 - 70 s, window 58.0 - 70.0)
// Zoom into the input ring, which resolves into a 20k-particle figure. The figure reaches; a pulse
// (the same pulse_sparks system as Beat 1) leaves the hand and dies in the red gap; ~4% of the
// particles peel off the hand. 67 - 69.3: the scale reveal in reverse, 3x faster.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { makeRT, W, H, SCALE } from '../../engine/gl';
import { LineBatch } from '../../engine/lines';
import { smoothstep, ease, prog, clamp } from '../../engine/util';
import { ZoomFold, ringView, reverseView, RING_SPX, SPX_G8 } from './zoomfold';
import { HumanFigure } from './figure';
import { emitPulse, flareAt, type PulseSpec } from './pulse_sparks';
import { GLOW, LIN } from './palette';
import { MARKERS } from './timing';

const REACH0 = 62.7, REACH1 = 63.5;
const PULSE: PulseSpec = { t0: MARKERS.YOU_REACH, travel: 0.52, from: [0, 540, 0], to: [1324, 540, 0], sparks: 52, seed: 77, yDown: true };
const IMPACT = PULSE.t0 + PULSE.travel;

export default class Beat4Inversion extends Scene {
  private zf = new ZoomFold();
  private fig = new HumanFigure();
  private figScene = new THREE.Scene();
  private figCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private lines = new LineBatch(4000, { blend: 'add', screen2D: true });
  private ink = new LineBatch(400, { blend: 'max', screen2D: true });

  override init() { this.figScene.add(this.fig.points); }

  probe(f: Frame) { return { youReach: f.t >= MARKERS.YOU_REACH ? 1 : 0 }; }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const reversing = t >= 67;
    let view, Z = 1e6;
    if (reversing) { const r = reverseView(t); view = r.view; Z = r.Z; } else view = ringView(t);

    const chainK = reversing ? smoothstep(66.8, 67.6, t) : 1 - smoothstep(59.2, 62.0, t);
    this.zf.set(view, { dim: 1, parentK: 1, chainK, latt: 0.6, emph: 1 });
    this.zf.render(renderer, out);

    // figure + lever + pulse, only while the ring is the close-up (58.0 - 67.4)
    const k = clamp(view.spx / RING_SPX, 0, 1) * (RING_SPX / 1100);
    const cx = 960 + (-0.8 - view.offx) * view.spx;
    const figA = smoothstep(60.2, 62.4, t) * (1 - smoothstep(67.0, 67.5, t));
    const reach = ease.inOutCubic(prog(t, REACH0, REACH1)) * (1 - smoothstep(67.0, 67.6, t));
    const u = this.fig.mat.uniforms;
    u.uT!.value = t; (u.uC!.value as THREE.Vector2).set(cx, 540); u.uK!.value = k; u.uAlpha!.value = figA;
    u.uReach!.value = reach; u.uLeakT!.value = IMPACT; u.uPx!.value = SCALE;
    if (figA > 0.002) {
      renderer.setRenderTarget(out);
      renderer.render(this.figScene, this.figCam);
      renderer.resetState();
    }

    this.lines.clear(); this.ink.clear();
    let flare = 0;
    if (t >= 62.0 && t < 67.6) {
      const [hx, hy] = this.fig.hand(cx, 540, k, reach);
      const leverX = cx + 0.2 * 1100;
      // lever: the input end of the line, tilting as the hand closes on it
      const la = 0.0 - 0.5 * smoothstep(REACH1, REACH1 + 0.1, t) * (1 - smoothstep(IMPACT + 0.2, IMPACT + 1.2, t) * 0);
      const bone = GLOW.bone, ash = GLOW.ash;
      const fade = figA;
      this.ink.seg2(leverX, 540, leverX + Math.cos(la) * 46 * k, 540 + Math.sin(la) * 46 * k, 2.0, bone, 0.9 * fade);
      void ash; void hx; void hy;
      const spec: PulseSpec = { ...PULSE, from: [leverX + 6 * k, 540, 0], to: [cx + (-0.233 + 0.8) * 1100 * (k / (RING_SPX / 1100)) - 3, 540, 0] };
      emitPulse(this.lines, t, spec, 1 - smoothstep(67.0, 67.4, t));
      flare = flareAt(t, spec);
    }
    this.ink.render(renderer, out);
    this.lines.render(renderer, out);

    void SPX_G8; void W; void H; void LIN; void makeRT;
    return {
      exposure: 1.0, bloom: 0.6 + 0.3 * flare, bloomThreshold: 0.8, bloomRadius: 0.5, halation: 0,
      vignette: 0.25, grain: 0.035, ca: 0.0006 * 960, dof: 0,
    };
  }

  override dispose() { this.zf.dispose(); this.fig.dispose(); this.lines.dispose(); this.ink.dispose(); }
}
