// SPATIAL HOLOGRAM — Spatial Computing & Futuristic Volumetric OS:
// Multi-layer floating glassmorphic 3D interface planes, volumetric ray interaction,
// depth parallax, holographic dust particles, and spatial computing OS telemetry.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

export default defineScene({
  id: 'spatial_hologram',
  rigMode: 'perspective',
  particleCapacity: 3072,
  lineCapacity: 8192,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(32);
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 1.5, -8.5], target: [0, 0.1, 0.0], roll: -0.04, focalLength: 32 },
      { t: 0.35, pos: [3.8, 0.8, -4.5], target: [0.5, 0.0, 1.0], roll: 0.06, focalLength: 35 },
      { t: 0.7, pos: [-3.2, -1.2, 3.5], target: [0, 0.0, 0.0], roll: -0.05, focalLength: 38 },
      { t: 1.0, pos: [0.0, 1.8, 6.5], target: [0, 0.2, 0.0], roll: 0.0, focalLength: 40 },
    ]);

    // Ambient floating holographic dust & emitter motes
    ctx.particles.addEmitter('hologram_dust', {
      capacity: 800,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 0.12,
      spread: 1.5,
      lifetime: 5.5,
      gravity: [0, 0.01, 0],
      turbulence: 0.25,
      size: 0.018,
      color: [ctx.lin.bone[0], ctx.lin.bone[1], ctx.lin.bone[2], 0.35],
      glow: 0.6,
    });

    // Interaction pointer pulse sparkles on primary window
    ctx.particles.addEmitter('cursor_sparkles', {
      capacity: 250,
      origin: [-1.8, 0.2, -1.2],
      direction: [0, 1, 0],
      speed: 0.2,
      spread: 0.8,
      lifetime: 2.5,
      turbulence: 0.25,
      size: 0.025,
      color: [ctx.lin.signal[0], ctx.lin.signal[1], ctx.lin.signal[2], 0.85],
      glow: 1.8,
    });

    ctx.node('win_main', { role: 'callout', size: [160, 36, 0] });
    ctx.node('win_side', { role: 'callout', size: [160, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);
    ctx.lines.clear();

    // 1. 3D Floating Window Wireframe Rigs (3 planes in spatial depth)
    interface SpatialWindow {
      cx: number; cy: number; cz: number;
      w: number; h: number;
      isPrimary?: boolean;
    }

    const windows: SpatialWindow[] = [
      { cx: -1.8, cy: 0.2, cz: -1.2, w: 2.8, h: 2.0, isPrimary: true },
      { cx: 2.2, cy: 0.6, cz: 0.5, w: 2.4, h: 1.8 },
      { cx: 0.4, cy: -1.4, cz: 1.8, w: 3.2, h: 1.4 },
    ];

    for (let w = 0; w < windows.length; w++) {
      const win = windows[w]!;
      const halfW = win.w * 0.5;
      const halfH = win.h * 0.5;

      const col = win.isPrimary ? lin.signal : lin.bone;
      const alpha = win.isPrimary ? 0.9 : 0.6;
      const width = win.isPrimary ? 2.0 : 1.2;

      // 4 Window borders
      ctx.lines.seg(win.cx - halfW, win.cy - halfH, win.cz, win.cx + halfW, win.cy - halfH, win.cz, width, col[0], col[1], col[2], alpha);
      ctx.lines.seg(win.cx + halfW, win.cy - halfH, win.cz, win.cx + halfW, win.cy + halfH, win.cz, width, col[0], col[1], col[2], alpha);
      ctx.lines.seg(win.cx + halfW, win.cy + halfH, win.cz, win.cx - halfW, win.cy + halfH, win.cz, width, col[0], col[1], col[2], alpha);
      ctx.lines.seg(win.cx - halfW, win.cy + halfH, win.cz, win.cx - halfW, win.cy - halfH, win.cz, width, col[0], col[1], col[2], alpha);

      // Title bar divider
      const barY = win.cy + halfH - 0.3;
      ctx.lines.seg(win.cx - halfW, barY, win.cz, win.cx + halfW, barY, win.cz, 0.9, lin.graphite[0], lin.graphite[1], lin.graphite[2], alpha * 0.7);

      // Window corner handles
      const ch = 0.15;
      ctx.lines.seg(win.cx - halfW, win.cy - halfH + ch, win.cz, win.cx - halfW + ch, win.cy - halfH, win.cz, 1.8, col[0], col[1], col[2], 0.95);
      ctx.lines.seg(win.cx + halfW - ch, win.cy + halfH, win.cz, win.cx + halfW, win.cy + halfH - ch, win.cz, 1.8, col[0], col[1], col[2], 0.95);
    }

    // 2. Spatial Interaction Ray Beam from origin to primary window
    const rayTargetX = -1.8 + Math.sin(t * 1.8) * 0.8;
    const rayTargetY = 0.2 + Math.cos(t * 1.5) * 0.5;
    const rayTargetZ = -1.2;

    const rayStartX = 0.8;
    const rayStartY = -1.2;
    const rayStartZ = -3.5;

    ctx.lines.seg(rayStartX, rayStartY, rayStartZ, rayTargetX, rayTargetY, rayTargetZ, 2.4, lin.signal[0], lin.signal[1], lin.signal[2], 0.85);

    // Target reticle on primary window surface
    const reticleSize = 0.2;
    ctx.lines.seg(rayTargetX - reticleSize, rayTargetY, rayTargetZ, rayTargetX + reticleSize, rayTargetY, rayTargetZ, 2.0, lin.signal[0], lin.signal[1], lin.signal[2], 0.95);
    ctx.lines.seg(rayTargetX, rayTargetY - reticleSize, rayTargetZ, rayTargetX, rayTargetY + reticleSize, rayTargetZ, 2.0, lin.signal[0], lin.signal[1], lin.signal[2], 0.95);

    // Pin Callouts
    const mainNode = ctx.node('win_main');
    mainNode.pinToWorldVertex([-1.8, 0.2 + 1.0, -1.2], ctx.threeCam, { screenOffset: [0, -40], minScale: 0.7, maxScale: 1.2 });
    const sideNode = ctx.node('win_side');
    sideNode.pinToWorldVertex([2.2, 0.6 + 0.9, 0.5], ctx.threeCam, { screenOffset: [0, -40], minScale: 0.7, maxScale: 1.2 });

    // Text & HUD Ducking during transitions
    const textDuck = Math.min(
      Math.min(1, Math.max(0, f.p / 0.08)),
      Math.min(1, Math.max(0, (1.0 - f.p) / 0.08))
    );

    // 2D Vector UI
    ctx.sdf.clear();
    const cardAlpha = Math.min(1, Math.max(0, ease.outExpo(Math.min(1, progress * 4.0)))) * textDuck;
    if (cardAlpha > 0.01) {
      ctx.card('spatial_card', {
        x: W - 530, y: 84, w: 450, h: 180,
        radius: [14, 14, 14, 14],
        fill: [lin.ink2[0], lin.ink2[1], lin.ink2[2], 0.88 * cardAlpha],
        stroke: [lin.signal[0], lin.signal[1], lin.signal[2], 0.75 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 24, color: [0, 0, 0, 0.55 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      // Spatial refresh rate & tracking latency gauge
      ctx.ring({ cx: W - 140, cy: 172, radius: 38, thickness: 4.5, trim: [0, 1], color: [lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.35 * cardAlpha] });
      ctx.ring({
        cx: W - 140, cy: 172, radius: 38, thickness: 4.5,
        trim: [0, 0.98],
        color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * cardAlpha],
        glow: 1.4,
      });
    }

    if (!mainNode.isOccluded && textDuck > 0.1) {
      const p = mainNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 45, size: 12, thickness: 1.5, color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * textDuck] });
    }
    if (!sideNode.isOccluded && textDuck > 0.1) {
      const p = sideNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 50, size: 14, thickness: 1.5, color: [lin.bone[0], lin.bone[1], lin.bone[2], 0.85 * textDuck] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      const title = ctx.text('spatial_title', 'SPATIAL HOLOGRAM OS', {
        fontSize: 52, fontWeight: 900, color: ctx.rgba('bone', 0.98 * textDuck), letterSpacing: 8, role: 'headline',
      }).withKnockoutHalo(4, ctx.rgba('ink', 0.95 * textDuck));
      const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
      ctx.renderText('spatial_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

      ctx.text('spatial_sub', 'VOLUMETRIC GLASSMORPHIC UI · 6-DOF POINTER TRACKING · PARALLAX DEPTH MESH', {
        fontSize: 14, fontWeight: 600, color: ctx.rgba('signal', 0.92 * textDuck), letterSpacing: 3, role: 'callout',
      }).withKnockoutHalo(2, ctx.rgba('ink', 0.9 * textDuck));
      const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
      ctx.renderText('spatial_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

      // Telemetry metrics
      const fpsRoll = ctx.text('spatial_fps', '120 FPS', {
        fontSize: 32, fontWeight: 700, color: ctx.rgba('signal', 0.95 * textDuck), role: 'hud',
      });
      fpsRoll.numericRoll(120, (n) => `REFRESH: ${n} FPS (STABLE)`);
      ctx.renderText('spatial_fps', c2d, t, W - 500, 142);

      const latText = ctx.text('spatial_lat', 'TRACKING LATENCY: 3.2 MS · EYE CONVERGENCE: 99.4%', {
        fontSize: 13, fontWeight: 600, color: ctx.rgba('bone', 0.85 * textDuck), role: 'hud',
      });
      ctx.renderText('spatial_lat', c2d, t, W - 500, 195);

      if (!mainNode.isOccluded) {
        ctx.text('spatial_main_lbl', 'PRIMARY VIEWPORT [DEPTH Z: -1.2M]', {
          fontSize: 12, fontWeight: 600, color: ctx.rgba('signal', 0.9 * textDuck), letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9 * textDuck));
        const mp = mainNode.position;
        ctx.renderText('spatial_main_lbl', c2d, t, mp[0] + 16, mp[1] - 32);
      }

      if (!sideNode.isOccluded) {
        ctx.text('spatial_side_lbl', 'INSPECTOR DOCK [DEPTH Z: +0.5M]', {
          fontSize: 12, fontWeight: 600, color: ctx.rgba('bone', 0.85 * textDuck), letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9 * textDuck));
        const sp = sideNode.position;
        ctx.renderText('spatial_side_lbl', c2d, t, sp[0] + 16, sp[1] - 32);
      }
    }

    // Compositing
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
  },
});
