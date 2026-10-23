// KINETIC — 2D kinetic-typography showcase (no 3D stage): staggered hero,
// live lyric karaoke driven by the real vocal timing grid, numeric rollers,
// wipe dividers. Pure Canvas2D; the text-probe hook captures everything.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { Lyrics } from '../../engine/lyrics';
import { ease } from '../../engine/util';

export default defineScene({
  id: 'kinetic',
  rigMode: 'perspective',
  particleCapacity: 64,
  lineCapacity: 64,
  sdfCapacity: 64,

  setup: async (_ctx: SceneContext) => {},

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    // Paper background wash.
    c2d.save();
    c2d.fillStyle = '#0A0A0B';
    c2d.fillRect(0, 0, W, H);
    c2d.restore();

    // Hero: staggered character entrance.
    const hero = ctx.text('kin_hero', 'KINETIC TYPE', {
      fontSize: 92, fontWeight: 900, color: ctx.rgba('bone', 0.98), letterSpacing: 8, role: 'headline',
    }).withKnockoutHalo(5, ctx.rgba('ink', 0.95));
    const states = hero.stagger(t, { unit: 'char', start: f.start + 0.15, staggerDuration: 0.9, inDuration: 0.4, motion: 'slide-up' });
    ctx.renderText('kin_hero', c2d, t, 80, 200, states);

    ctx.text('kin_kicker', 'CLOSED-FORM CHOREOGRAPHY · FRAME = f(t)', {
      fontSize: 17, fontWeight: 600, color: ctx.rgba('signal', 0.92), letterSpacing: 4, role: 'callout',
    }).withKnockoutHalo(2, ctx.rgba('ink', 0.9));
    const kickEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
    ctx.renderText('kin_kicker', c2d, t, 86, 150 - (1 - kickEnter) * 26);

    // Live karaoke: current lyric line, words lit by sung progress.
    const line = ctx.sceneCtx.lyrics.lineAt(t);
    c2d.save();
    // Engine overlay duck (1 outside transitions): outgoing lyric overlays
    // exit fast / incoming ones enter late, matching renderText overlays.
    c2d.globalAlpha *= ctx.overlayDuck;
    c2d.textBaseline = 'alphabetic';
    if (line && line.words.length > 0) {
      const fontPx = 54;
      c2d.font = `700 ${fontPx}px Archivo, sans-serif`;
      let x = 84;
      const baseY = 560;
      // Dim full line first.
      c2d.fillStyle = 'rgba(156,151,143,0.35)';
      c2d.fillText(line.text, x, baseY);
      // Sung words over the top in bone with per-word alpha.
      for (const w of line.words) {
        const p = Lyrics.wordProgress(w, t);
        if (p <= 0) {
          x += c2d.measureText(w.w + ' ').width;
          continue;
        }
        const ww = c2d.measureText(w.w).width;
        c2d.fillStyle = `rgba(238,233,223,${0.25 + 0.75 * p})`;
        c2d.fillText(w.w, x, baseY);
        if (p < 1) {
          // Wipe edge: signal tick at the frontier.
          c2d.fillStyle = 'rgba(255,77,18,0.95)';
          c2d.fillRect(x + ww * p - 2, baseY - fontPx, 4, fontPx * 1.1);
        }
        x += ww + c2d.measureText(' ').width;
      }
      // Line progress rail.
      const lp = Lyrics.lineCharProgress(line, t) / Math.max(1, line.text.length);
      c2d.fillStyle = 'rgba(94,91,87,0.6)';
      c2d.fillRect(84, baseY + 26, 900, 3);
      c2d.fillStyle = '#FF4D12';
      c2d.fillRect(84, baseY + 26, 900 * Math.min(1, Math.max(0, lp)), 3);
    } else {
      c2d.fillStyle = 'rgba(156,151,143,0.5)';
      c2d.font = '600 30px "IBMPlexMono", monospace';
      c2d.fillText('(vocal rest — instrumental window)', 84, 560);
    }
    c2d.restore();

    // Numeric rollers row.
    const stats = ctx.text('kin_stats', '00', {
      fontSize: 44, fontWeight: 700, color: ctx.rgba('signal', 0.95), align: 'left', role: 'hud',
    });
    stats.numericRoll(Math.round(progress * 1560), (n) => `${n} FRAMES`);
    ctx.renderText('kin_stats', c2d, t, 84, H - 220);
    const words = ctx.text('kin_words', '00', {
      fontSize: 44, fontWeight: 700, color: ctx.rgba('bone', 0.9), align: 'left', role: 'hud',
    });
    words.numericRoll(line ? line.words.length : 0, (n) => `${n} WORDS`);
    ctx.renderText('kin_words', c2d, t, 420, H - 220);

    // Animated wipe divider.
    const wipe = ease.inOutCubic(Math.min(1, Math.max(0, (progress - 0.55) * 2.2)));
    c2d.save();
    c2d.fillStyle = '#FF4D12';
    c2d.fillRect(80, H - 140, (W - 160) * wipe, 2);
    c2d.restore();

    // 2D-only path: upload canvas straight into the frame target.
    const layerTex = ctx.layer2d.upload();
    ctx.sceneCtx.comp.draw(renderer, layerTex, out, { mode: 'replace', opacity: 1.0 });

    ctx.sceneGraph.syncTelemetry(t);
    renderer.resetState();
  },
});
