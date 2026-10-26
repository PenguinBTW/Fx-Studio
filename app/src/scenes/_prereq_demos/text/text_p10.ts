// P10a demo: odometer counter with carries, stroke-plotted reveal with pen glow synced to note times,
// letter-position markers on Canvas2D text and on extruded 3D type, tracked word-by-word reveal.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../../engine/dsl';
import { type Frame } from '../../../engine/scene';
import { ease, TAU } from '../../../engine/util';
import { strokeText, type StrokeText } from '../../../engine/stroke';
import { strokePlot, drawStrokePlot, drawPenGlow, odometerRects } from '../../../engine/textfx';
import { ExtrudedText } from '../../../engine/text3d';

const NOTES = [2.0, 2.45, 2.9, 3.55, 3.9, 4.3, 4.85, 5.3, 5.6, 6.1];
const PLOT_TEXT = '8 MIN 20 S';
let stroke: StrokeText | null = null;
let extruded: THREE.Group | null = null;

export default defineScene({
  id: 'text_p10',
  rigMode: 'perspective',
  particleCapacity: 64,
  lineCapacity: 64,
  sdfCapacity: 64,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(35);
    ctx.rig.setPath([
      { t: 0, pos: [0, 0, 9], target: [0, 0, 0], roll: 0, focalLength: 35 },
      { t: 1, pos: [0, 0, 9], target: [0, 0, 0], roll: 0, focalLength: 35 },
    ]);
    ctx.scene3D.background = new THREE.Color(0x08080a);
    ctx.scene3D.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xfff0dd, 2.4);
    key.position.set(-3, 4, 6);
    ctx.scene3D.add(key);
    extruded = ctx.text3D('d3', 'IT DOES NOT BEND', { size: 0.55, depth: 0.18, letterSpacing: 0.1, position: [3.1, -1.9, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H } = ctx;
    const t = f.t;
    ctx.updateCamera(t, 0);
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    // 1. Odometer: 0 -> 8,760,000,000 over 0.3..4.3 s, then a second counter that rolls through 999 -> 1,000
    const v = 8_760_000_000 * ease.inOutQuart(Math.min(1, Math.max(0, (t - 0.3) / 4.0)));
    const big = ctx.text('odo', '0', { fontSize: 120, fontWeight: 700, color: ctx.rgba('bone', 1), align: 'left', role: 'headline' });
    const st = big.odometer(v, { minDigits: 13 });
    big.renderOdometer(c2d, 120, 70);
    const rects = odometerRects(st, 120, 70, 120);
    c2d.save();
    c2d.strokeStyle = 'rgba(255,77,18,0.35)';
    c2d.lineWidth = 1;
    for (const r of rects) if (r.cell.kind === 'digit') c2d.strokeRect(r.x, r.y, r.w, r.h);
    c2d.restore();

    const small = ctx.text('odo2', '0', { fontSize: 64, fontWeight: 600, color: ctx.rgba('signal', 1), role: 'hud' });
    const carry = 980 + 40 * Math.min(1, Math.max(0, (t - 0.5) / 5));
    small.odometer(carry, { decimals: 1, minDigits: 4 });
    small.renderOdometer(c2d, 120, 260);
    const neg = ctx.text('odo3', '0', { fontSize: 64, fontWeight: 600, color: ctx.rgba('ash', 1), role: 'hud' });
    neg.odometer(-5 + 10 * Math.min(1, Math.max(0, (t - 0.5) / 5)), { decimals: 2, minDigits: 1 });
    neg.renderOdometer(c2d, 760, 260);

    // 2. Stroke reveal synced to note times, with pen glow
    try {
      stroke ??= strokeText(PLOT_TEXT, 'tech', 120, 6);
      const s = strokePlot(stroke, t, { noteTimes: NOTES, ease: ease.outCubic, glowDecay: 0.35 });
      c2d.save();
      c2d.translate(120, 480);
      c2d.strokeStyle = 'rgba(238,233,223,0.95)';
      c2d.lineWidth = 3.2;
      c2d.lineCap = 'round';
      c2d.lineJoin = 'round';
      drawStrokePlot(c2d, stroke, s.perStroke);
      drawPenGlow(c2d, s.pen, s.glow, { radius: 46 });
      c2d.restore();
      c2d.fillStyle = 'rgba(238,233,223,0.5)';
      c2d.font = '16px IBM Plex Mono, monospace';
      c2d.fillText(`pen glow ${s.glow.toFixed(2)}  overall ${s.overall.toFixed(2)}`, 120, 660);
      for (const nt of NOTES) {
        c2d.fillStyle = t >= nt ? 'rgba(255,77,18,0.9)' : 'rgba(255,255,255,0.2)';
        c2d.fillRect(120 + (nt - 2) * 80, 690, 4, 14);
      }
    } catch { /* stroke fonts still loading */ }

    // 3. Tracked +0.1em, centred, word-by-word, with per-letter position markers
    const coda = ctx.text('coda', 'YOU WERE ITS DESTINATION.', {
      fontSize: 54, fontWeight: 700, color: ctx.rgba('bone', 1), letterSpacing: '5.4px', align: 'left', role: 'headline',
    });
    const states = coda.stagger(t, { unit: 'word', start: 1.0, staggerDuration: 3.0, inDuration: 0.5, motion: 'fade' });
    const codaX = 120, codaY = 800;
    ctx.renderText('coda', c2d, t, codaX, codaY, states);
    const gl2 = coda.glyphs(c2d, codaX, codaY);
    c2d.save();
    c2d.strokeStyle = 'rgba(255,77,18,0.8)';
    for (const g of gl2) {
      c2d.beginPath();
      c2d.arc(g.cx, g.y + g.h + 8, 3, 0, TAU);
      c2d.stroke();
    }
    c2d.restore();

    // 4. Extruded type: word-by-word reveal, tracked, markers from ExtrudedText.glyphs
    if (extruded) {
      ExtrudedText.reveal(extruded, t, { unit: 'word', start: 1.5, interval: 0.9, inDuration: 0.5, motion: 'fade' });
      const gl3 = ExtrudedText.glyphs(extruded, ctx.threeCam, W, H);
      c2d.save();
      c2d.strokeStyle = 'rgba(80,200,255,0.9)';
      for (const g of gl3) {
        if (!g.screen) continue;
        c2d.beginPath();
        c2d.arc(g.screen[0], g.screen[1] - 70, 4, 0, TAU);
        c2d.stroke();
      }
      c2d.restore();
    }

    ctx.flush(out, true);
    ctx.sceneGraph.syncTelemetry(t);
    renderer.resetState();
  },
});
