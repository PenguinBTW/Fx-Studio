// VECTOR LAB — Pure 2D Swiss kinetic vector showcase: progressive single-stroke
// font plotting with animated spark tracers, architectural drafting grids,
// Lissajous vector oscilloscope, 16-band technical equalizer, and staggered
// typographical hierarchy with knockout ink halos.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';
import { strokeText, drawStrokeText, type StrokeText } from '../../engine/stroke';

export default defineScene({
  id: 'vector_lab',
  rigMode: 'perspective', // rigMode unused in pure 2D, but required by SceneContextOptions
  particleCapacity: 64,
  lineCapacity: 64,
  sdfCapacity: 2048,

  setup: async (_ctx: SceneContext) => {},

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    // Clear 2D layer and SDF batch
    ctx.layer2d.clear();
    ctx.sdf.clear();
    const c2d = ctx.layer2d.ctx;

    // 1. Deep Ink Background with precision technical drafting paper
    c2d.save();
    c2d.fillStyle = '#08080A';
    c2d.fillRect(0, 0, W, H);

    // 2. Architectural Drafting Grid & Millimeter Rulers along edges
    c2d.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    c2d.lineWidth = 1;
    const gridStep = 60;
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

    // Top & Left Ruler Calibration Ticks
    c2d.fillStyle = 'rgba(238, 233, 223, 0.35)';
    c2d.font = '500 9px "IBMPlexMono", monospace';
    for (let x = 60; x < W - 60; x += 30) {
      const isMajor = x % 120 === 0;
      c2d.fillRect(x, 0, 1, isMajor ? 12 : 6);
      if (isMajor) c2d.fillText(`${x}`, x + 4, 16);
    }
    for (let y = 60; y < H - 60; y += 30) {
      const isMajor = y % 120 === 0;
      c2d.fillRect(0, y, isMajor ? 12 : 6, 1);
      if (isMajor) c2d.fillText(`${y}`, 16, y + 4);
    }
    c2d.restore();

    // 3. Vector Oscilloscope (Lissajous waveform in center-right)
    c2d.save();
    const oscX = W - 380, oscY = H - 280;
    c2d.strokeStyle = 'rgba(255, 77, 18, 0.85)';
    c2d.lineWidth = 2.0;
    c2d.shadowColor = 'rgba(255, 77, 18, 0.6)';
    c2d.shadowBlur = 10;
    c2d.beginPath();
    const oscSteps = 180;
    const oscPhase = t * 3.5;
    for (let i = 0; i <= oscSteps; i++) {
      const a = (i / oscSteps) * TAU;
      const x = oscX + Math.sin(3 * a + oscPhase) * 110;
      const y = oscY + Math.cos(4 * a + oscPhase * 0.5) * 80;
      if (i === 0) c2d.moveTo(x, y);
      else c2d.lineTo(x, y);
    }
    c2d.stroke();
    c2d.restore();

    // 4. Technical 16-Band Equalizer Spectrum
    c2d.save();
    const eqX = 84, eqY = H - 120;
    const bands = 24;
    const barWidth = 14;
    const barGap = 6;
    for (let b = 0; b < bands; b++) {
      // Harmonic audio frequencies modulated deterministically
      const freq = Math.sin(t * 4.2 + b * 0.45) * 0.5 + Math.cos(t * 2.8 - b * 0.3) * 0.5;
      const barHeight = Math.max(6, Math.abs(freq) * 75 * Math.min(1, progress * 3.0));
      const bx = eqX + b * (barWidth + barGap);
      const isPeak = barHeight > 55;

      c2d.fillStyle = isPeak ? 'rgba(255, 77, 18, 0.95)' : 'rgba(238, 233, 223, 0.45)';
      c2d.fillRect(bx, eqY - barHeight, barWidth, barHeight);

      // Peak hold indicator tick
      c2d.fillStyle = 'rgba(255, 77, 18, 0.9)';
      c2d.fillRect(bx, eqY - barHeight - 4, barWidth, 2);
    }
    c2d.restore();

    // 5. Progressive Single-Stroke Plotter Typography with Animated Spark Pen
    try {
      const plotText = 'f(t) = ∇ × A + ∂Ψ/∂t [DETERMINISTIC VECTOR FLOW]';
      const st: StrokeText = strokeText(plotText, 'tech', 26, 1.5);
      const maxLen = st.total;
      // Pen writes across the first 4 seconds
      const penProgress = Math.min(1, Math.max(0, (progress - 0.08) * 2.8));
      const curLen = maxLen * ease.inOutCubic(penProgress);

      c2d.save();
      c2d.translate(84, 440);
      c2d.strokeStyle = 'rgba(238, 233, 223, 0.85)';
      c2d.lineWidth = 1.8;
      const penHead = drawStrokeText(c2d, st, curLen);

      // Draw glowing spark head at current pen tip
      if (penHead && penProgress > 0 && penProgress < 0.999) {
        c2d.fillStyle = '#FF4D12';
        c2d.shadowColor = '#FF4D12';
        c2d.shadowBlur = 14;
        c2d.beginPath();
        c2d.arc(penHead.x, penHead.y, 4.5, 0, TAU);
        c2d.fill();

        // Radiating spark rays
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
    } catch {
      // Graceful fallback if font is still hydrating
    }

    // 6. SDF Technical Cards, Dials, and Badges
    const cardSpring = ctx.motion.spring(0.1, t, { freq: 3.2, damping: 0.72, v0: 2.2 });
    const cardAlpha = Math.min(1, Math.max(0, cardSpring));
    if (cardAlpha > 0.01) {
      // Telemetry Card
      ctx.card('lab_card', {
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

    // 7. Monumental Typography
    const hero = ctx.text('lab_hero', 'PRECISION DYNAMICS', {
      fontSize: 82, fontWeight: 900, color: ctx.rgba('bone', 0.98), letterSpacing: 8, role: 'headline',
    }).withKnockoutHalo(5, ctx.rgba('ink', 0.95));
    const heroStates = hero.stagger(t, { unit: 'char', start: f.start + 0.1, staggerDuration: 0.8, inDuration: 0.4, motion: 'slide-up' });
    ctx.renderText('lab_hero', c2d, t, 80, 175, heroStates);

    ctx.text('lab_kicker', 'CLOSED-FORM VECTOR ENGINE · ZERO DRIFT · PIXEL-PERFECT SUB-FRAME AA', {
      fontSize: 16, fontWeight: 600, color: ctx.rgba('signal', 0.95), letterSpacing: 4, role: 'callout',
    }).withKnockoutHalo(2.5, ctx.rgba('ink', 0.92));
    const kickEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.8)));
    ctx.renderText('lab_kicker', c2d, t, 84, 235 - (1 - kickEnter) * 24);

    // Architectural spec paragraph
    c2d.save();
    c2d.fillStyle = 'rgba(238, 233, 223, 0.65)';
    c2d.font = '500 15px "IBMPlexMono", monospace';
    c2d.fillText('INPUT: t ∈ ℝ⁺ | SPATIAL: 1920×1080 LOGICAL | SHUTTER: 0.50 | TAP: 4-WAY ROTATION', 84, 300);
    c2d.fillText('STATUS: SYNCHRONIZED | STROKE INTERPOLATION: C¹ CONTINUOUS | AA: fwidth(SDF)', 84, 330);
    c2d.restore();

    // Numeric Rollers
    const frameRoll = ctx.text('lab_frames', '0000', {
      fontSize: 38, fontWeight: 700, color: ctx.rgba('signal', 0.95), role: 'hud',
    });
    const curFrame = Math.round(progress * 1410);
    frameRoll.numericRoll(curFrame, (n) => `${n.toString().padStart(4, '0')} FRAMES`);
    ctx.renderText('lab_frames', c2d, t, W - 490, 150);

    const accuracyRoll = ctx.text('lab_acc', '99.99%', {
      fontSize: 16, fontWeight: 600, color: ctx.rgba('bone', 0.85), role: 'hud',
    });
    accuracyRoll.numericRoll(Math.round(progress * 9999), (n) => `STABILITY: ${(n / 100).toFixed(2)}% LOCKED`);
    ctx.renderText('lab_acc', c2d, t, W - 490, 240);

    // 8. Composite 2D Canvas + SDF Batch directly into Frame Target
    const sdfRT = ctx.sceneCtx.comp; // low-level compositor
    const layerTex = ctx.layer2d.upload();
    sdfRT.draw(renderer, layerTex, out, { mode: 'replace', opacity: 1.0 });

    // Flush SDF primitives over the top
    ctx.sdf.flush(renderer, out);

    ctx.sceneGraph.syncTelemetry(t);
    renderer.resetState();
  },
});
