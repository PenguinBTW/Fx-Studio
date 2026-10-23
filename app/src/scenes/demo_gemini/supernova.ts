// SUPERNOVA — Grand Finale: Supercritical tokamak fusion reactor core,
// 16 toroidal magnetic confinement coils, counter-rotating helical plasma
// filaments, explosive relativistic particle blasts, dynamic camera trauma,
// and culminating in an ethereal pure white optical bloom resolve.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

export default defineScene({
  id: 'supernova',
  rigMode: 'perspective',
  particleCapacity: 4096,
  lineCapacity: 8192,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(32);
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 1.4, -6.5], target: [0, 0.4, 0], roll: -0.06, focalLength: 32 },
      { t: 0.35, pos: [4.8, 3.2, -9.2], target: [0, 0.5, 0], roll: 0.1, focalLength: 38 },
      { t: 0.7, pos: [0.0, 4.8, -12.5], target: [0, 0.4, 0], roll: 0.0, focalLength: 50 },
      { t: 1.0, pos: [0.0, 2.2, -8.0], target: [0, 0.5, 0], roll: 0.0, focalLength: 65 },
    ]);

    // Core supercritical plasma eruption
    ctx.particles.addEmitter('core_blast', {
      capacity: 1024,
      origin: [0, 0.4, 0],
      direction: [0, 1, 0],
      speed: 6.8,
      spread: 1.6,
      lifetime: 2.2,
      gravity: [0, -1.5, 0],
      turbulence: 0.55,
      size: 0.12,
      color: [ctx.lin.signal[0], ctx.lin.signal[1], ctx.lin.signal[2], 0.98],
      glow: 2.8,
    });

    // High-velocity explosive sparks
    ctx.particles.addEmitter('fusion_sparks', {
      capacity: 1024,
      origin: [0, 0.4, 0],
      direction: [0, 0, 1],
      speed: 7.5,
      spread: 1.8,
      lifetime: 1.8,
      turbulence: 0.35,
      size: 0.045,
      color: [ctx.lin.ember[0], ctx.lin.ember[1], ctx.lin.ember[2], 0.95],
      glow: 2.2,
    });

    // Toroidal magnetic confinement vortex embers
    ctx.particles.addEmitter('tokamak_vortex', {
      capacity: 1024,
      origin: [0, 0.4, 0],
      direction: [1, 0, 0],
      speed: 3.2,
      spread: 1.2,
      lifetime: 3.2,
      turbulence: 0.65,
      size: 0.08,
      color: [ctx.lin.bone[0], ctx.lin.bone[1], ctx.lin.bone[2], 0.75],
      glow: 1.8,
    });

    // Expanding shockwave dust ring
    ctx.particles.addEmitter('shockwave_dust', {
      capacity: 800,
      origin: [0, -0.8, 0],
      direction: [0, 1, 0],
      speed: 4.5,
      spread: 1.8,
      lifetime: 2.0,
      turbulence: 0.3,
      size: 0.065,
      color: [ctx.lin.graphite[0], ctx.lin.graphite[1], ctx.lin.graphite[2], 0.5],
      glow: 1.0,
    });

    // Trauma kicks at critical fusion ignition pulses
    ctx.rig.addTrauma(0.65, 0.25, 2.0);
    ctx.rig.addTrauma(0.55, 4.2, 2.2);

    ctx.node('core_callout', { role: 'callout', size: [140, 36, 0] });
    ctx.node('separatrix_callout', { role: 'callout', size: [140, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);

    ctx.lines.clear();

    // 1. Toroidal Tokamak Confinement Coils (16 circular coils arranged around a ring)
    const majorRadius = 3.2; // R: distance from center to tube center
    const minorRadius = 1.35; // r: tube radius
    const coilCount = 18;
    const coilSegs = 48;

    for (let c = 0; c < coilCount; c++) {
      const phi = (c / coilCount) * TAU;
      const cosP = Math.cos(phi), sinP = Math.sin(phi);
      const isKeyCoil = c % 3 === 0;
      const col = isKeyCoil ? lin.signal : lin.bone;
      const alpha = isKeyCoil ? 0.85 : 0.35;
      const lw = isKeyCoil ? 1.8 : 1.0;

      // Center of this cross-section coil
      const cx = cosP * majorRadius;
      const cz = sinP * majorRadius;
      const cy = 0.4;

      let prevX = 0, prevY = 0, prevZ = 0;
      for (let s = 0; s <= coilSegs; s++) {
        const theta = (s / coilSegs) * TAU;
        // Minor circle in the plane perpendicular to the major ring
        const rx = Math.cos(theta) * minorRadius;
        const ry = Math.sin(theta) * minorRadius;

        const x = cx + cosP * rx;
        const y = cy + ry;
        const z = cz + sinP * rx;

        if (s > 0) {
          ctx.lines.seg(prevX, prevY, prevZ, x, y, z, lw, col[0], col[1], col[2], alpha);
        }
        prevX = x; prevY = y; prevZ = z;
      }
    }

    // 2. Dual Counter-Rotating Helical Plasma Filaments inside the Torus
    const helixPoints = 160;
    const helixTurns = 6.0;
    const spin1 = t * 3.8;
    const spin2 = -t * 3.8;

    for (let strand = 0; strand < 2; strand++) {
      const strandSpin = strand === 0 ? spin1 : spin2;
      const col = strand === 0 ? lin.signal : lin.ember;
      let px = 0, py = 0, pz = 0;
      for (let i = 0; i <= helixPoints; i++) {
        const u = i / helixPoints;
        const phi = u * TAU;
        const theta = u * TAU * helixTurns + strandSpin;

        const rMajor = majorRadius;
        const rMinor = minorRadius * 0.75;

        const cosP = Math.cos(phi), sinP = Math.sin(phi);
        const cosT = Math.cos(theta), sinT = Math.sin(theta);

        const x = (rMajor + rMinor * cosT) * cosP;
        const y = 0.4 + rMinor * sinT;
        const z = (rMajor + rMinor * cosT) * sinP;

        if (i > 0) {
          ctx.lines.seg(px, py, pz, x, y, z, 2.4, col[0], col[1], col[2], 0.95);
        }
        px = x; py = y; pz = z;
      }
    }

    // 3. Expanding Relativistic Shockwave Rings
    for (let ring = 0; ring < 3; ring++) {
      const age = (t * 1.2 - ring * 0.7) % 2.1;
      if (age < 0) continue;
      const ringRad = 0.8 + age * 5.2;
      const ringAlpha = Math.max(0, 0.85 * (1 - age / 2.1));
      const segs = 64;
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * TAU;
        const a1 = ((i + 1) / segs) * TAU;
        ctx.lines.seg(
          Math.cos(a0) * ringRad, 0.4, Math.sin(a0) * ringRad,
          Math.cos(a1) * ringRad, 0.4, Math.sin(a1) * ringRad,
          2.0, lin.signal[0], lin.signal[1], lin.signal[2], ringAlpha,
        );
      }
    }

    // Pin Callouts
    const coreNode = ctx.node('core_callout');
    coreNode.pinToWorldVertex([0, 0.4, 0], ctx.threeCam, { screenOffset: [0, -60], minScale: 0.7, maxScale: 1.2 });

    const sepNode = ctx.node('separatrix_callout');
    sepNode.pinToWorldVertex([majorRadius, 0.4 + minorRadius, 0], ctx.threeCam, { screenOffset: [60, -35], minScale: 0.7, maxScale: 1.2 });

    // SDF HUD
    ctx.sdf.clear();
    const cardSpring = ctx.motion.spring(0.1, t, { freq: 3.2, damping: 0.7, v0: 2.4 });
    const cardAlpha = Math.min(1, Math.max(0, cardSpring));
    if (cardAlpha > 0.01) {
      ctx.card('super_card', {
        x: W / 2 - 280, y: 84, w: 560, h: 140,
        radius: [14, 14, 14, 14],
        fill: [lin.ink2[0], lin.ink2[1], lin.ink2[2], 0.9 * cardAlpha],
        stroke: [lin.signal[0], lin.signal[1], lin.signal[2], 0.8 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 28, color: [0, 0, 0, 0.55 * cardAlpha], offset: [0, 10] },
        role: 'hud', opacity: cardAlpha,
      });

      // Triple gauge rings for Q factor, Beta ratio, and Tesla field
      const qTrim = ease.inOutCubic(progress);
      ctx.ring({ cx: W / 2 + 210, cy: 154, radius: 36, thickness: 4.5, trim: [0, 1], color: [lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.35 * cardAlpha] });
      ctx.ring({ cx: W / 2 + 210, cy: 154, radius: 36, thickness: 4.5, trim: [0, Math.max(0.04, qTrim)], color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * cardAlpha], glow: 1.4 });
    }

    if (!coreNode.isOccluded) {
      const p = coreNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 60, size: 14, thickness: 1.5, color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95] });
    }
    if (!sepNode.isOccluded) {
      const p = sepNode.position;
      ctx.reticle({ cx: p[0] - 60, cy: p[1] + 35, size: 12, thickness: 1.5, color: [lin.bone[0], lin.bone[1], lin.bone[2], 0.85] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    const title = ctx.text('super_title', 'SUPERCRITICAL FUSION CORE', {
      fontSize: 48, fontWeight: 900, color: ctx.rgba('bone', 0.98), letterSpacing: 8, role: 'headline',
    }).withKnockoutHalo(4, ctx.rgba('ink', 0.95));
    const titleStates = title.stagger(t, { unit: 'word', start: f.start + 0.1, staggerDuration: 0.5, inDuration: 0.35, motion: 'slide-up' });
    ctx.renderText('super_title', c2d, t, W / 2 - 245, 140, titleStates);

    ctx.text('super_sub', 'MAGNETIC CONFINEMENT 100% · Q = 14.8 GAIN · GEMINI RUNTIME COMPLETE', {
      fontSize: 13, fontWeight: 600, color: ctx.rgba('signal', 0.92), letterSpacing: 3, role: 'callout',
    }).withKnockoutHalo(2, ctx.rgba('ink', 0.9));
    const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.12) * 2.5)));
    ctx.renderText('super_sub', c2d, t, W / 2 - 245, 190 - (1 - subEnter) * 18);

    if (!coreNode.isOccluded) {
      ctx.text('super_clabel', 'PLASMA CORE · 150 MK', {
        fontSize: 12, fontWeight: 600, color: ctx.rgba('signal', 0.9), letterSpacing: 1, role: 'callout',
      }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9));
      const cp = coreNode.position;
      ctx.renderText('super_clabel', c2d, t, cp[0] + 18, cp[1] - 40);
    }

    if (!sepNode.isOccluded) {
      ctx.text('super_slabel', 'MAGNETIC SEPARATRIX', {
        fontSize: 12, fontWeight: 600, color: ctx.rgba('bone', 0.85), letterSpacing: 1, role: 'callout',
      }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9));
      const sp = sepNode.position;
      ctx.renderText('super_slabel', c2d, t, sp[0] + 18, sp[1] - 20);
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

    // Closing Ethereal White Bloom Flash Resolve in the final 1.2s
    const tailProgress = Math.max(0, t - (f.end - 1.2)) / 1.2;
    if (tailProgress > 0.001) {
      const flashEase = ease.inCubic(tailProgress);
      return {
        flash: flashEase * 0.95,
        exposure: 1.0 + flashEase * 0.8,
        bloom: 0.55 + flashEase * 1.2,
        ca: 1.2 + flashEase * 10.0,
      };
    }
  },
});
