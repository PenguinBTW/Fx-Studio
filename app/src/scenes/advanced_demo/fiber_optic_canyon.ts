// FIBER OPTIC CANYON — Sub-Sea Global Telecommunications & High-Speed Data Highways:
// High-velocity optical soliton pulses traveling down 3D fiber bundle conduits,
// sub-sea EDFA optical repeaters, DWDM wavelength multiplexing, and 800 Tb/s telemetry.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

// 8 Sub-sea fiber conduits forming a deep trench canyon
const NUM_CABLES = 8;
const SEGMENTS_PER_CABLE = 36;
const CANYON_LENGTH = 32.0;

export default defineScene({
  id: 'fiber_optic_canyon',
  rigMode: 'perspective',
  particleCapacity: 3072,
  lineCapacity: 8192,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(20);
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 1.2, -18.0], target: [0, 0.2, 0.0], roll: -0.08, focalLength: 20 },
      { t: 0.35, pos: [2.5, 0.8, -6.0], target: [0.5, 0.0, 10.0], roll: 0.12, focalLength: 24 },
      { t: 0.7, pos: [-2.2, 0.5, 6.0], target: [0, 0.1, 20.0], roll: -0.09, focalLength: 28 },
      { t: 1.0, pos: [0.0, 2.8, 18.0], target: [0, 0.4, 30.0], roll: 0.0, focalLength: 32 },
    ]);

    // High-energy optical soliton photon packets surging along the core
    ctx.particles.addEmitter('soliton_photons', {
      capacity: 1200,
      origin: [0, 0, -10.0],
      direction: [0, 0, 1],
      speed: 1.8,
      spread: 0.5,
      lifetime: 4.2,
      gravity: [0, 0, 0.05],
      turbulence: 0.15,
      size: 0.018,
      color: [ctx.lin.signal[0], ctx.lin.signal[1], ctx.lin.signal[2], 0.85],
      glow: 1.6,
    });

    // Rayleigh scattering backscatter motes in the abyss (subtle marine snow)
    ctx.particles.addEmitter('abyss_backscatter', {
      capacity: 400,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 0.1,
      spread: 1.8,
      lifetime: 6.0,
      turbulence: 0.2,
      size: 0.012,
      color: [ctx.lin.bone[0], ctx.lin.bone[1], ctx.lin.bone[2], 0.2],
      glow: 0.4,
    });

    ctx.node('repeater_edfa', { role: 'callout', size: [160, 36, 0] });
    ctx.node('wdm_coupler', { role: 'callout', size: [160, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);
    ctx.lines.clear();

    // 1. Fiber Cable Trunk Bundles
    for (let c = 0; c < NUM_CABLES; c++) {
      const angle = (c / NUM_CABLES) * TAU;
      const canyonRadiusX = 3.6 + Math.cos(angle) * 1.5;
      const canyonRadiusY = 1.8 + Math.sin(angle) * 1.2;

      let prevX = 0, prevY = 0, prevZ = 0;

      for (let s = 0; s < SEGMENTS_PER_CABLE; s++) {
        const u = s / (SEGMENTS_PER_CABLE - 1);
        const z = (u - 0.5) * CANYON_LENGTH;

        // Undulating submarine trench seabed curvature
        const undulatingWave = Math.sin(z * 0.25 + c * 0.4) * 0.5;
        const x = Math.cos(angle) * canyonRadiusX + Math.sin(z * 0.15) * 1.2;
        const y = Math.sin(angle) * canyonRadiusY + undulatingWave;

        if (s > 0) {
          // Soliton traveling pulses along the cable: sech(z - vt)
          const pulseSpeed = 14.0;
          const pulsePhase = (z - t * pulseSpeed) % 8.0;
          const solitonGlow = Math.exp(-Math.pow(pulsePhase, 2) * 2.0);

          const isCore = c % 2 === 0;
          const col = isCore ? lin.signal : lin.bone;
          const width = 1.2 + solitonGlow * 2.2;
          const alpha = 0.45 + solitonGlow * 0.55;

          ctx.lines.seg(prevX, prevY, prevZ, x, y, z, width, col[0], col[1], col[2], alpha);
        }

        prevX = x;
        prevY = y;
        prevZ = z;
      }
    }

    // 2. Sub-Sea Optical EDFA Repeaters (placed every 10m along the trunk)
    const repeaterZ = 2.0;
    const repeaterRadius = 2.2;
    const numRingSteps = 24;

    for (let i = 0; i < numRingSteps; i++) {
      const a1 = (i / numRingSteps) * TAU;
      const a2 = ((i + 1) / numRingSteps) * TAU;

      const r1x = Math.cos(a1) * repeaterRadius;
      const r1y = Math.sin(a1) * repeaterRadius * 0.7;
      const r2x = Math.cos(a2) * repeaterRadius;
      const r2y = Math.sin(a2) * repeaterRadius * 0.7;

      ctx.lines.seg(r1x, r1y, repeaterZ, r2x, r2y, repeaterZ, 2.2, lin.signal[0], lin.signal[1], lin.signal[2], 0.95);
      ctx.lines.seg(r1x, r1y, repeaterZ + 0.8, r2x, r2y, repeaterZ + 0.8, 1.4, lin.bone[0], lin.bone[1], lin.bone[2], 0.75);

      if (i % 3 === 0) {
        ctx.lines.seg(r1x, r1y, repeaterZ, r1x, r1y, repeaterZ + 0.8, 1.2, lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.6);
      }
    }

    // Pin Callouts
    const repeaterNode = ctx.node('repeater_edfa');
    repeaterNode.pinToWorldVertex([0, repeaterRadius * 0.7, repeaterZ], ctx.threeCam, { screenOffset: [0, -40], minScale: 0.7, maxScale: 1.2 });
    const couplerNode = ctx.node('wdm_coupler');
    couplerNode.pinToWorldVertex([2.5, 0.8, 8.5], ctx.threeCam, { screenOffset: [0, -40], minScale: 0.7, maxScale: 1.2 });

    // Text & HUD Ducking during transitions
    const textDuck = Math.min(
      Math.min(1, Math.max(0, f.p / 0.08)),
      Math.min(1, Math.max(0, (1.0 - f.p) / 0.08))
    );

    // 2D Vector UI
    ctx.sdf.clear();
    const cardAlpha = Math.min(1, Math.max(0, ease.outExpo(Math.min(1, progress * 4.0)))) * textDuck;
    if (cardAlpha > 0.01) {
      ctx.card('fiber_card', {
        x: W - 530, y: 84, w: 450, h: 180,
        radius: [14, 14, 14, 14],
        fill: [lin.ink2[0], lin.ink2[1], lin.ink2[2], 0.88 * cardAlpha],
        stroke: [lin.signal[0], lin.signal[1], lin.signal[2], 0.75 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 24, color: [0, 0, 0, 0.55 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      // Optical Signal-to-Noise Ratio (OSNR) gauge dial
      ctx.ring({ cx: W - 140, cy: 172, radius: 38, thickness: 4.5, trim: [0, 1], color: [lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.35 * cardAlpha] });
      ctx.ring({
        cx: W - 140, cy: 172, radius: 38, thickness: 4.5,
        trim: [0, 0.85],
        color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * cardAlpha],
        glow: 1.4,
      });
    }

    if (!repeaterNode.isOccluded && textDuck > 0.1) {
      const p = repeaterNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 45, size: 12, thickness: 1.5, color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * textDuck] });
    }
    if (!couplerNode.isOccluded && textDuck > 0.1) {
      const p = couplerNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 50, size: 14, thickness: 1.5, color: [lin.bone[0], lin.bone[1], lin.bone[2], 0.85 * textDuck] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      const title = ctx.text('fiber_title', 'FIBER OPTIC CANYON', {
        fontSize: 52, fontWeight: 900, color: ctx.rgba('bone', 0.98 * textDuck), letterSpacing: 8, role: 'headline',
      }).withKnockoutHalo(4, ctx.rgba('ink', 0.95 * textDuck));
      const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
      ctx.renderText('fiber_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

      ctx.text('fiber_sub', 'SUB-SEA TRANS-OCEANIC TRUNK · DWDM 96 CHANNELS · OPTICAL SOLITON TRANSMISSION', {
        fontSize: 14, fontWeight: 600, color: ctx.rgba('signal', 0.92 * textDuck), letterSpacing: 3, role: 'callout',
      }).withKnockoutHalo(2, ctx.rgba('ink', 0.9 * textDuck));
      const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
      ctx.renderText('fiber_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

      // Telemetry metrics
      const bwRoll = ctx.text('fiber_bw', '800 TB/S', {
        fontSize: 32, fontWeight: 700, color: ctx.rgba('signal', 0.95 * textDuck), role: 'hud',
      });
      bwRoll.numericRoll(800, (n) => `THROUGHPUT: ${n} TB/S`);
      ctx.renderText('fiber_bw', c2d, t, W - 500, 142);

      const snrText = ctx.text('fiber_osnr', 'OSNR: 34.2 DB · BER: 10⁻¹⁵ · 1,550 NM C-BAND', {
        fontSize: 13, fontWeight: 600, color: ctx.rgba('bone', 0.85 * textDuck), role: 'hud',
      });
      ctx.renderText('fiber_osnr', c2d, t, W - 500, 195);

      if (!repeaterNode.isOccluded) {
        ctx.text('fiber_rep_lbl', 'EDFA OPTICAL REPEATER #04', {
          fontSize: 12, fontWeight: 600, color: ctx.rgba('signal', 0.9 * textDuck), letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9 * textDuck));
        const rp = repeaterNode.position;
        ctx.renderText('fiber_rep_lbl', c2d, t, rp[0] + 16, rp[1] - 32);
      }

      if (!couplerNode.isOccluded) {
        ctx.text('fiber_wdm_lbl', 'DWDM DEMUX COUPLER (96-CH)', {
          fontSize: 12, fontWeight: 600, color: ctx.rgba('bone', 0.85 * textDuck), letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9 * textDuck));
        const cp = couplerNode.position;
        ctx.renderText('fiber_wdm_lbl', c2d, t, cp[0] + 16, cp[1] - 32);
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
