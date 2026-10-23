// GENERATIVE MANIFESTO — Pure 2D Swiss Graphic Design & Bauhaus Constructivism:
// progressive single-stroke plotter calligraphy with animated spark pen,
// multi-axis modular drafting grids, millimeter border rulers, Lissajous waveform monitor,
// 24-band frequency spectrum, and monumental typography with knockout ink halos.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';
import { strokeText, drawStrokeText, type StrokeText } from '../../engine/stroke';

export default defineScene({
  id: 'generative_manifesto',
  rigMode: 'perspective',
  particleCapacity: 64,
  lineCapacity: 64,
  sdfCapacity: 2048,

  setup: async (_ctx: SceneContext) => {},

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.layer2d.clear();
    ctx.sdf.clear();
    const c2d = ctx.layer2d.ctx;

    // 1. Deep Ink Background
    c2d.save();
    c2d.fillStyle = '#060608';
    c2d.fillRect(0, 0, W, H);

    // 2. Architectural Drafting Grid & Millimeter Rulers
    c2d.strokeStyle = 'rgba(255, 255, 255, 0.035)';
    c2d.lineWidth = 1;
    const gridStep = 48;
    for (let x = gridStep; x < W; x += gridStep) {
      c2d.beginPath();
      c2d.moveTo(x, 0);
      c2d.lineTo(x, H);
      c2d.stroke();
    }
    for (let y = gridStep; y < H; y += gridStep) {
      c2d.beginPath();
      c2d.moveTo(0, y);
      c2d.lineTo(W, y);
      c2d.stroke();
    }

    // Border Millimeter Calibration Ticks
    c2d.fillStyle = 'rgba(238, 233, 223, 0.35)';
    c2d.font = '500 9px "IBMPlexMono", monospace';
    for (let x = 48; x < W - 48; x += 24) {
      const isMajor = x % 96 === 0;
      c2d.fillRect(x, 0, 1, isMajor ? 12 : 5);
      if (isMajor) c2d.fillText(`${x}`, x + 4, 16);
    }
    for (let y = 48; y < H - 48; y += 24) {
      const isMajor = y % 96 === 0;
      c2d.fillRect(0, y, isMajor ? 12 : 5, 1);
      if (isMajor) c2d.fillText(`${y}`, 16, y + 4);
    }
    c2d.restore();

    // 3. Parametric Lissajous Vector Oscilloscope (center right)
    c2d.save();
    const oscX = W - 360, oscY = H - 280;
    c2d.strokeStyle = 'rgba(255, 77, 18, 0.9)';
    c2d.lineWidth = 2.2;
    c2d.shadowColor = 'rgba(255, 77, 18, 0.65)';
    c2d.shadowBlur = 12;
    c2d.beginPath();
    const oscSteps = 160;
    const oscPhase = t * 3.2;
    for (let i = 0; i <= oscSteps; i++) {
      const a = (i / oscSteps) * TAU;
      const x = oscX + Math.sin(4 * a + oscPhase) * 115;
      const y = oscY + Math.cos(5 * a + oscPhase * 0.7) * 85;
      if (i === 0) c2d.moveTo(x, y);
      else c2d.lineTo(x, y);
    }
    c2d.stroke();
    c2d.restore();

    // 4. Technical 24-Band Frequency Equalizer Spectrum (bottom left)
    c2d.save();
    const eqX = 84, eqY = H - 120;
    const bands = 24;
    const barWidth = 14;
    const barGap = 6;
    for (let b = 0; b < bands; b++) {
      const freq = Math.sin(t * 3.8 + b * 0.4) * 0.5 + Math.cos(t * 2.2 - b * 0.35) * 0.5;
      const barH = Math.max(6, Math.abs(freq) * 78 * Math.min(1, progress * 3.0));
      const bx = eqX + b * (barWidth + barGap);
      const isPeak = barH > 58;

      c2d.fillStyle = isPeak ? 'rgba(255, 77, 18, 0.95)' : 'rgba(238, 233, 223, 0.45)';
      c2d.fillRect(bx, eqY - barH, barWidth, barH);

      c2d.fillStyle = 'rgba(255, 77, 18, 0.9)';
      c2d.fillRect(bx, eqY - barH - 4, barWidth, 2);
    }
    c2d.restore();

    // 5. Progressive Single-Stroke Plotter Typography with Animated Spark Pen
    try {
      const plotText = 'f(t): TEMPORAL DETERMINISM IS THE SOUL OF KINEMATICS';
      const st: StrokeText = strokeText(plotText, 'tech', 24, 1.6);
      const maxLen = st.total;
      const penProgress = Math.min(1, Math.max(0, (progress - 0.08) * 2.8));
      const curLen = maxLen * ease.inOutCubic(penProgress);

      c2d.save();
      c2d.translate(84, 430);
      c2d.strokeStyle = 'rgba(238, 233, 223, 0.88)';
      c2d.lineWidth = 1.8;
      const penHead = drawStrokeText(c2d, st, curLen);

      if (penHead && penProgress > 0 && penProgress < 0.999) {
        c2d.fillStyle = '#FF4D12';
        c2d.shadowColor = '#FF4D12';
        c2d.shadowBlur = 14;
        c2d.beginPath();
        c2d.arc(penHead.x, penHead.y, 4.5, 0, TAU);
        c2d.fill();

        c2d.strokeStyle = 'rgba(255, 175, 40, 0.9)';
        c2d.lineWidth = 1.2;
        for (let r = 0; r < 4; r++) {
          const sparkAngle = penHead.angle + (r / 4) * TAU + t * 12.0;
          c2d.beginPath();
          c2d.moveTo(penHead.x, penHead.y);
          c2d.lineTo(penHead.x + Math.cos(sparkAngle) * 12, penHead.y + Math.sin(sparkAngle) * 12);
          c2d.stroke();
        }
      }
      c2d.restore();
    } catch {}

    // 6. SDF Technical Dials & Telemetry Cards
    const cardSpring = ctx.motion.spring(0.1, t, { freq: 3.2, damping: 0.72, v0: 2.2 });
    const cardAlpha = Math.min(1, Math.max(0, cardSpring));
    if (cardAlpha > 0.01) {
      ctx.card('gen_card', {
        x: W - 520, y: 84, w: 440, h: 220,
        radius: [12, 12, 12, 12],
        fill: [lin.ink2[0], lin.ink2[1], lin.ink2[2], 0.9 * cardAlpha],
        stroke: [lin.signal[0], lin.signal[1], lin.signal[2], 0.75 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 24, color: [0, 0, 0, 0.5 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      // Radar sweep dial inside card
      ctx.ring({ cx: W - 160, cy: 194, radius: 48, thickness: 4, trim: [0, 1], color: [lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.35 * cardAlpha] });
      const radarAngle = (t * 1.8) % 1.0;
      ctx.ring({ cx: W - 160, cy: 194, radius: 48, thickness: 4, trim: [0, Math.max(0.04, radarAngle)], color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * cardAlpha], glow: 1.4 });
      ctx.ring({ cx: W - 160, cy: 194, radius: 24, thickness: 2.5, trim: [0, 1], color: [lin.bone[0], lin.bone[1], lin.bone[2], 0.4 * cardAlpha] });
      ctx.reticle({ cx: W - 160, cy: 194, size: 16, thickness: 1.5, color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.9 * cardAlpha] });
    }

    // 7. Monumental Swiss Typography
    const hero = ctx.text('gen_hero', 'GENERATIVE MANIFESTO', {
      fontSize: 78, fontWeight: 900, color: ctx.rgba('bone', 0.98), letterSpacing: 8, role: 'headline',
    }).withKnockoutHalo(5, ctx.rgba('ink', 0.95));
    const heroStates = hero.stagger(t, { unit: 'word', start: f.start + 0.1, staggerDuration: 0.6, inDuration: 0.35, motion: 'slide-up' });
    ctx.renderText('gen_hero', c2d, t, 80, 175, heroStates);

    ctx.text('gen_kicker', 'SWISS INTERNATIONAL STYLE · BAUHAUS RHYTHM · PURE CLOSED-FORM MATHEMATICS', {
      fontSize: 16, fontWeight: 600, color: ctx.rgba('signal', 0.95), letterSpacing: 4, role: 'callout',
    }).withKnockoutHalo(2.5, ctx.rgba('ink', 0.92));
    const kickEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.8)));
    ctx.renderText('gen_kicker', c2d, t, 84, 235 - (1 - kickEnter) * 24);

    // Architectural spec paragraph
    c2d.save();
    c2d.fillStyle = 'rgba(238, 233, 223, 0.65)';
    c2d.font = '500 15px "IBMPlexMono", monospace';
    c2d.fillText('GRID: 48PX MODULAR COLUMNS | RULERS: METRIC MM | FONTS: ARCHIVO DISPLAY + IBM PLEX MONO', 84, 300);
    c2d.fillText('STATUS: SYNCHRONIZED | STROKE INTERPOLATION: C¹ CONTINUOUS | AA: fwidth(SDF)', 84, 330);
    c2d.restore();

    // Numeric Rollers
    const frameRoll = ctx.text('gen_frames', '0000', {
      fontSize: 38, fontWeight: 700, color: ctx.rgba('signal', 0.95), role: 'hud',
    });
    const curFrame = Math.round(progress * 1920);
    frameRoll.numericRoll(curFrame, (n) => `${n.toString().padStart(4, '0')} FRAMES`);
    ctx.renderText('gen_frames', c2d, t, W - 490, 150);

    const accuracyRoll = ctx.text('gen_acc', '99.99%', {
      fontSize: 16, fontWeight: 600, color: ctx.rgba('bone', 0.85), role: 'hud',
    });
    accuracyRoll.numericRoll(Math.round(progress * 9999), (n) => `PRECISION: ${(n / 100).toFixed(2)}% REAL`);
    ctx.renderText('gen_acc', c2d, t, W - 490, 240);

    // 8. Composite 2D Canvas + SDF Batch directly into Target
    const sdfRT = ctx.sceneCtx.comp;
    const layerTex = ctx.layer2d.upload();
    sdfRT.draw(renderer, layerTex, out, { mode: 'replace', opacity: 1.0 });

    ctx.sdf.flush(renderer, out);

    ctx.sceneGraph.syncTelemetry(t);
    renderer.resetState();
  },
});
