// IGNITION — particle eruption showcase: stacked analytical emitters
// (core jet, fireball remnant, falling sparks, dust ring), trauma-kicked
// dolly camera, spring-driven SDF title card.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { ease } from '../../engine/util';

export default defineScene({
  id: 'ignition',
  rigMode: 'perspective',
  particleCapacity: 2048,
  lineCapacity: 512,
  sdfCapacity: 512,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(38);
    ctx.rig.setPath([
      { t: 0.0, pos: [0, 1.4, -11.0], target: [0, 0.8, 0], roll: 0, focalLength: 38 },
      { t: 0.55, pos: [2.8, 2.0, -8.2], target: [0, 0.9, 0], roll: 0.05, focalLength: 42 },
      { t: 1.0, pos: [0, 2.6, -6.0], target: [0, 1.0, 0], roll: 0, focalLength: 50 },
    ]);
    // Single global gravity for the whole scene (shared uniform).
    ctx.particles.addEmitter('core_jet', {
      capacity: 640,
      origin: [0, -1.6, 0],
      direction: [0, 1, 0],
      speed: 5.2,
      spread: 0.22,
      lifetime: 1.9,
      gravity: [0, -2.2, 0],
      turbulence: 0.35,
      size: 0.075,
      color: [ctx.lin.signal[0], ctx.lin.signal[1], ctx.lin.signal[2], 0.9],
      glow: 2.4,
    });
    ctx.particles.addEmitter('fireball', {
      capacity: 420,
      origin: [0, 0.4, 0],
      direction: [0, 1, 0],
      speed: 1.1,
      spread: 1.1,
      lifetime: 2.6,
      turbulence: 0.55,
      size: 0.16,
      color: [ctx.lin.ember[0], ctx.lin.ember[1], ctx.lin.ember[2], 0.55],
      glow: 1.6,
    });
    ctx.particles.addEmitter('sparks', {
      capacity: 480,
      origin: [0, 3.4, 0],
      direction: [0, -1, 0],
      speed: 2.4,
      spread: 0.5,
      lifetime: 2.2,
      turbulence: 0.15,
      size: 0.035,
      color: [ctx.lin.bone[0], ctx.lin.bone[1], ctx.lin.bone[2], 0.8],
      glow: 1.2,
    });
    ctx.particles.addEmitter('dust_ring', {
      capacity: 360,
      origin: [0, -1.7, 0],
      direction: [0, 1, 0],
      speed: 3.1,
      spread: 1.45,
      lifetime: 1.6,
      turbulence: 0.4,
      size: 0.09,
      color: [ctx.lin.graphite[0], ctx.lin.graphite[1], ctx.lin.graphite[2], 0.5],
      glow: 0.8,
    });
    // Trauma kick synced to the eruption (song-time t0 within entry window).
    ctx.rig.addTrauma(0.65, 0.4, 1.8);
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);

    // Shockwave rings expanding on the ground plane (LineBatch circles).
    ctx.lines.clear();
    for (let r = 0; r < 3; r++) {
      const age = (t * 0.9 - r * 0.55) % 1.65;
      if (age < 0) continue;
      const rad = 0.6 + age * 4.2;
      const alpha = Math.max(0, 0.6 * (1 - age / 1.65));
      const segs = 64;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 1) / segs) * Math.PI * 2;
        ctx.lines.seg(
          Math.cos(a0) * rad, -1.7, Math.sin(a0) * rad,
          Math.cos(a1) * rad, -1.7, Math.sin(a1) * rad,
          1.5, lin.signal[0], lin.signal[1], lin.signal[2], alpha,
        );
      }
    }

    // Title card with spring entrance + counter.
    ctx.sdf.clear();
    const enter = ctx.motion.spring(0.15, t, { freq: 2.6, damping: 0.68, v0: 2.0 });
    const cardAlpha = Math.min(1, Math.max(0, enter));
    if (cardAlpha > 0.01) {
      ctx.card('ignite_card', {
        x: 84, y: H - 300, w: 460, h: 150,
        radius: [14, 14, 14, 14],
        fill: [lin.ink2[0], lin.ink2[1], lin.ink2[2], 0.85 * cardAlpha],
        stroke: [lin.signal[0], lin.signal[1], lin.signal[2], 0.65 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 28, color: [0, 0, 0, 0.5 * cardAlpha], offset: [0, 10] },
        role: 'hud',
        opacity: cardAlpha,
      });
    }

    // 2D typography.
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;
    ctx.text('ign_title', 'IGNITION', {
      fontSize: 64, fontWeight: 900, color: ctx.rgba('bone', 0.98), letterSpacing: 10, role: 'headline',
    }).withKnockoutHalo(4, ctx.rgba('ink', 0.95));
    const titleEnter = ease.outExpo(Math.min(1, progress * 4));
    ctx.renderText('ign_title', c2d, t, 96, 120 - (1 - titleEnter) * 40);

    const counter = ctx.text('ign_count', '00', {
      fontSize: 30, fontWeight: 700, color: ctx.rgba('signal', 0.95), align: 'center', role: 'hud',
    });
    counter.numericRoll(Math.round(progress * 100), (n) => `${n}%`);
    ctx.renderText('ign_count', c2d, t, 314, H - 262);

    // Compositor: 3D stage + vectors.
    ctx.compositor.clear();
    ctx.compositor.createLayer('stage_3d', {
      render: (target) => {
        ctx.particles.render(renderer, ctx.threeCam, target, t);
        ctx.lines.render(renderer, target, ctx.threeCam);
      },
      blend: 'normal',
      opacity: 1.0,
    });
    ctx.compositor.createLayer('hud_vectors', {
      render: (target) => {
        ctx.sdf.flush(renderer, target);
        const layerTex = ctx.layer2d.upload();
        ctx.sceneCtx.comp.draw(renderer, layerTex, target, { mode: 'normal', opacity: 1.0 });
      },
      blend: 'normal',
      opacity: 1.0,
    });
    ctx.compositor.evaluate(renderer, out);

    ctx.sceneGraph.syncTelemetry(t);
    renderer.resetState();

    // Heat flash peaking on the eruption beat (t=0.4s), quiet at entry.
    const flash = Math.exp(-Math.abs(t - 0.4) * 6) * 0.35;
    if (flash > 0.003) return { flash };
  },
});
