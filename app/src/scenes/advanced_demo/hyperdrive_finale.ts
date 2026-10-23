// 11: HYPERDRIVE FINALE — Relativistic Alcubierre Warp & Ethereal Resolve
// Spacetime metric contraction, 192 Doppler-shifted relativistic starfield streaks,
// Alcubierre warp bubble metric rings, violent jump trauma, white-hot optical burst,
// and stark museum-grade bone-on-void monolith typographic resolve (v0.5.0 · 330.0s).
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

// 192 Relativistic starfield warp streak lines
const NUM_STREAKS = 192;

interface WarpStreak {
  angle: number;
  baseRadius: number;
  zOffset: number;
  length: number;
  speed: number;
  dopplerType: 'blue' | 'red' | 'core';
}

const STREAKS: WarpStreak[] = [];
for (let i = 0; i < NUM_STREAKS; i++) {
  const seed = Math.sin(i * 17.123 + 89.456) * 43758.5453;
  const rnd1 = seed - Math.floor(seed);
  const seed2 = Math.sin(i * 43.789 + 12.345) * 43758.5453;
  const rnd2 = seed2 - Math.floor(seed2);

  const radius = 0.5 + rnd1 * 8.5;
  let dopplerType: 'blue' | 'red' | 'core' = 'core';
  if (radius < 2.8) {
    dopplerType = 'blue';
  } else if (radius > 5.5) {
    dopplerType = 'red';
  }

  STREAKS.push({
    angle: (i / NUM_STREAKS) * TAU + rnd1 * 0.25,
    baseRadius: radius,
    zOffset: (rnd2 - 0.5) * 42.0,
    length: 2.5 + rnd1 * 8.0,
    speed: 22.0 + rnd2 * 32.0,
    dopplerType,
  });
}

export default defineScene({
  id: 'hyperdrive_finale',
  rigMode: 'perspective',
  particleCapacity: 4096,
  lineCapacity: 16384,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(20);
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 0.4, -14.0], target: [0, 0.0, 12.0], roll: 0.0, focalLength: 24 },
      { t: 0.45, pos: [0.0, 0.2, -8.0], target: [0, 0.0, 24.0], roll: -0.05, focalLength: 20 },
      { t: 0.72, pos: [0.0, 0.0, -1.0], target: [0, 0.0, 36.0], roll: 0.08, focalLength: 16 },
      { t: 1.0, pos: [0.0, 0.0, 6.0], target: [0, 0.0, 50.0], roll: 0.0, focalLength: 14 },
    ]);

    // Relativistic thruster exhaust cascades
    ctx.particles.addEmitter('hyperdrive_thrusters', {
      capacity: 1200,
      origin: [0, 0, -8.0],
      direction: [0, 0, -1],
      speed: 3.2,
      spread: 0.55,
      lifetime: 3.2,
      gravity: [0, 0, -0.15],
      turbulence: 0.45,
      size: 0.045,
      color: [0.22, 0.74, 0.97, 0.75],
      glow: 1.8,
    });

    // High-energy Cherenkov radiation motes
    ctx.particles.addEmitter('cherenkov_field', {
      capacity: 600,
      origin: [0, 0, 8.0],
      direction: [0, 0, 1],
      speed: 1.8,
      spread: 1.5,
      lifetime: 3.8,
      turbulence: 0.35,
      size: 0.05,
      color: [0.97, 0.98, 1.0, 0.65],
      glow: 1.5,
    });

    ctx.node('warp_singularity', { role: 'callout', size: [180, 36, 0] });
    ctx.node('alcubierre_horizon', { role: 'callout', size: [180, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    // Phase segmentation:
    // Phase 1 (0.00 - 0.75): Relativistic acceleration & starfield warp buildup
    // Phase 2 (0.75 - 0.85): Hyperspace jump trauma & optical white-out shockwave
    // Phase 3 (0.85 - 1.00): Museum-Grade Typographic Monolith Resolve
    const isWarpPhase = progress < 0.82;
    const isResolvePhase = progress >= 0.78;

    const warpAccel = ease.inExpo(Math.min(1, progress / 0.75));
    const warpFactor = 1.0 + warpAccel * 28.0;

    // Trigger violent trauma shake during hyperspace jump initiation (0.65 - 0.80)
    if (progress > 0.65 && progress < 0.80) {
      const traumaPulse = (progress - 0.65) / 0.15;
      ctx.rig.addTrauma(Math.sin(traumaPulse * Math.PI) * 0.55);
    }

    ctx.updateCamera(t, progress);
    ctx.lines.clear();

    // 1. Relativistic Hyper-Velocity Starfield Streaks (Doppler Shifted)
    if (isWarpPhase) {
      const streakFade = progress > 0.75 ? Math.max(0, (0.82 - progress) / 0.07) : 1.0;

      for (let i = 0; i < NUM_STREAKS; i++) {
        const s = STREAKS[i]!;
        const r = s.baseRadius * (1.0 + warpAccel * 0.6);

        const x = Math.cos(s.angle) * r;
        const y = Math.sin(s.angle) * r;

        const currentZ = ((s.zOffset - t * s.speed * warpFactor) % 48.0) + 24.0;
        const streakLen = s.length * (1.0 + warpAccel * 8.0);

        const z1 = currentZ;
        const z2 = currentZ + streakLen;

        let cr = 0.95;
        let cg = 0.98;
        let cb = 1.0;
        let alpha = Math.min(1, 0.35 + warpAccel * 0.65) * streakFade;
        let width = 1.2 + warpAccel * 1.0;

        if (s.dopplerType === 'blue') {
          cr = 0.5; cg = 0.75; cb = 1.0;
          width = 1.8 + warpAccel * 1.8;
        } else if (s.dopplerType === 'red') {
          cr = 0.96; cg = 0.45; cb = 0.35;
          width = 1.4 + warpAccel * 1.2;
        }

        ctx.lines.seg(x, y, z1, x, y, z2, width, cr, cg, cb, alpha);
      }

      // 2. Alcubierre Spacetime Contraction Metric Rings
      const numMetricRings = 16;
      for (let r = 0; r < numMetricRings; r++) {
        const ringZ = -14.0 + r * 3.6;
        const contraction = 1.0 / (1.0 + Math.exp(-ringZ * 0.45));
        const ringRadius = (1.8 + contraction * 3.6) * (1.0 + Math.sin(t * 5.0 + r) * 0.04);

        const ringSteps = 36;
        for (let st = 0; st < ringSteps; st++) {
          const a1 = (st / ringSteps) * TAU;
          const a2 = ((st + 1) / ringSteps) * TAU;

          const x1 = Math.cos(a1) * ringRadius, y1 = Math.sin(a1) * ringRadius;
          const x2 = Math.cos(a2) * ringRadius, y2 = Math.sin(a2) * ringRadius;

          const isEven = r % 2 === 0;
          const cr = isEven ? 0.22 : 0.95;
          const cg = isEven ? 0.74 : 0.98;
          const cb = isEven ? 0.97 : 1.0;
          const ringAlpha = (1.0 - Math.abs(r - 8) / 9.0) * (0.55 + warpAccel * 0.35) * streakFade;

          ctx.lines.seg(x1, y1, ringZ, x2, y2, ringZ, 1.8, cr, cg, cb, ringAlpha);
        }
      }
    }

    // Pin Callouts during Warp
    const singNode = ctx.node('warp_singularity');
    singNode.pinToWorldVertex([0, 0, 18.0], ctx.threeCam, { screenOffset: [0, -40], minScale: 0.7, maxScale: 1.2 });
    const alcNode = ctx.node('alcubierre_horizon');
    alcNode.pinToWorldVertex([2.4, 1.8, 4.0], ctx.threeCam, { screenOffset: [40, -20], minScale: 0.7, maxScale: 1.2 });

    // 2D Vector UI
    ctx.sdf.clear();

    // Warp UI during Phase 1
    if (progress < 0.76) {
      const warpDuck = Math.min(1, Math.max(0, (0.76 - progress) / 0.1));
      ctx.card('warp_card', {
        x: W - 530, y: 84, w: 450, h: 185,
        radius: [12, 12, 12, 12],
        fill: [0.06, 0.08, 0.16, 0.88 * warpDuck],
        stroke: [0.22, 0.74, 0.97, 0.85 * warpDuck],
        strokeWidth: 2.0,
        shadow: { blur: 24, color: [0, 0, 0, 0.65 * warpDuck], offset: [0, 8] },
        role: 'hud', opacity: warpDuck,
      });

      // Warp speed factor dial
      ctx.ring({ cx: W - 130, cy: 175, radius: 36, thickness: 4.5, trim: [0, 1], color: [0.2, 0.3, 0.5, 0.35 * warpDuck] });
      ctx.ring({
        cx: W - 130, cy: 175, radius: 36, thickness: 4.5,
        trim: [0, Math.min(1, 0.1 + warpAccel * 0.9)],
        color: [0.22, 0.74, 0.97, 0.95 * warpDuck],
        glow: 1.6,
      });
    }

    // 2D Typography & Final Monolith Resolve
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    // Warp HUD text (Phase 1)
    if (progress < 0.76) {
      const warpDuck = Math.min(1, Math.max(0, (0.76 - progress) / 0.1));

      const title = ctx.text('warp_title', 'HYPERDRIVE ALCUBIERRE WARP', {
        fontSize: 48, fontWeight: 900, color: `rgba(240, 248, 255, ${0.98 * warpDuck})`, letterSpacing: 8, role: 'headline',
      }).withKnockoutHalo(4, `rgba(3, 2, 6, ${0.95 * warpDuck})`);
      ctx.renderText('warp_title', c2d, t, 90, 130);

      ctx.text('warp_sub', 'RELATIVISTIC METRIC CONTRACTION · DOPPLER SHIFT STREAKS · TENSOR FLUX G_00 < 0', {
        fontSize: 14, fontWeight: 600, color: `rgba(56, 189, 248, ${0.92 * warpDuck})`, letterSpacing: 3, role: 'callout',
      }).withKnockoutHalo(2, `rgba(3, 2, 6, ${0.9 * warpDuck})`);
      ctx.renderText('warp_sub', c2d, t, 94, 185);

      const velRoll = ctx.text('warp_vel', 'WARP 9.92', {
        fontSize: 32, fontWeight: 700, color: `rgba(56, 189, 248, ${0.95 * warpDuck})`, role: 'hud',
      });
      velRoll.numericRoll(Math.round(warpFactor * 10), (n) => `VELOCITY: WARP ${(n / 10).toFixed(2)}`);
      ctx.renderText('warp_vel', c2d, t, W - 500, 140);

      const metricText = ctx.text('warp_metric', 'NEGATIVE ENERGY DENSITY: -10¹⁸ J/M³ · FIELD STABLE', {
        fontSize: 12, fontWeight: 600, color: `rgba(224, 242, 254, ${0.85 * warpDuck})`, role: 'hud',
      });
      ctx.renderText('warp_metric', c2d, t, W - 500, 195);
    }

    // Phase 3: The Monumental Museum-Grade Resolve Monolith (progress >= 0.78)
    if (isResolvePhase) {
      const resAlpha = ease.outCubic(Math.min(1, (progress - 0.78) / 0.12));

      // Architectural Double Framing Box
      const fMarginX = 140, fMarginY = 120;
      const fW = W - fMarginX * 2, fH = H - fMarginY * 2;

      c2d.save();
      // Outer border
      c2d.strokeStyle = `rgba(245, 243, 238, ${0.85 * resAlpha})`;
      c2d.lineWidth = 1.5;
      c2d.strokeRect(fMarginX, fMarginY, fW, fH);

      // Inner border with padding
      c2d.strokeStyle = `rgba(245, 243, 238, ${0.35 * resAlpha})`;
      c2d.lineWidth = 1.0;
      c2d.strokeRect(fMarginX + 16, fMarginY + 16, fW - 32, fH - 32);

      // Corner technical crosses
      const crLen = 18;
      const fCorners = [
        [fMarginX, fMarginY], [fMarginX + fW, fMarginY],
        [fMarginX, fMarginY + fH], [fMarginX + fW, fMarginY + fH],
      ];
      c2d.strokeStyle = `rgba(245, 243, 238, ${0.75 * resAlpha})`;
      c2d.lineWidth = 1.5;
      for (const [cx, cy] of fCorners) {
        c2d.beginPath();
        c2d.moveTo(cx - crLen, cy); c2d.lineTo(cx + crLen, cy);
        c2d.moveTo(cx, cy - crLen); c2d.lineTo(cx, cy + crLen);
        c2d.stroke();
      }

      // Sacred Geometric Rotating Harmonic Mandala (Center Background)
      const mcx = W * 0.5, mcy = H * 0.5;
      c2d.strokeStyle = `rgba(245, 243, 238, ${0.08 * resAlpha})`;
      c2d.lineWidth = 1.0;
      for (let mr = 1; mr <= 4; mr++) {
        c2d.beginPath();
        c2d.arc(mcx, mcy, mr * 70, 0, TAU);
        c2d.stroke();
      }
      for (let sp = 0; sp < 12; sp++) {
        const sAng = (sp / 12) * TAU + t * 0.1;
        c2d.beginPath();
        c2d.moveTo(mcx, mcy);
        c2d.lineTo(mcx + Math.cos(sAng) * 280, mcy + Math.sin(sAng) * 280);
        c2d.stroke();
      }
      c2d.restore();

      // Master Typography Monolith
      const monoTitle = ctx.text('res_title', 'UNIVERSAL PROCEDURAL MOTION ENGINE', {
        fontSize: 56, fontWeight: 900, color: `rgba(248, 250, 252, ${0.98 * resAlpha})`, letterSpacing: 10, role: 'headline',
      });
      ctx.renderText('res_title', c2d, t, W * 0.5 - 620, H * 0.5 - 110);

      // Universal Versioning Badge (v0.5.0)
      const verText = ctx.text('res_ver', 'VERSION 0.5.0 · FLAGSHIP PROCEDURAL TECH DEMO', {
        fontSize: 18, fontWeight: 800, color: `rgba(56, 189, 248, ${0.95 * resAlpha})`, letterSpacing: 6, role: 'callout',
      });
      ctx.renderText('res_ver', c2d, t, W * 0.5 - 280, H * 0.5 - 55);

      // Performance & Telemetry Matrix (3 Columns)
      c2d.save();
      c2d.font = '700 13px Archivo, sans-serif';
      c2d.fillStyle = `rgba(226, 232, 240, ${0.85 * resAlpha})`;
      c2d.letterSpacing = '2px';

      // Col 1: Temporal
      c2d.fillText('TEMPORAL SPECIFICATION:', W * 0.5 - 540, H * 0.5 + 30);
      c2d.font = '600 12px monospace';
      c2d.fillStyle = `rgba(148, 163, 184, ${0.8 * resAlpha})`;
      c2d.fillText('TOTAL DURATION: 330.0 SECONDS (5M 30S)', W * 0.5 - 540, H * 0.5 + 60);
      c2d.fillText('SCENES: 11 PROCEDURAL WORLDS', W * 0.5 - 540, H * 0.5 + 85);
      c2d.fillText('SEAMLESS TRANSITIONS: 10 SEAMS (2.0S)', W * 0.5 - 540, H * 0.5 + 110);

      // Col 2: Engine Guarantees
      c2d.font = '700 13px Archivo, sans-serif';
      c2d.fillStyle = `rgba(226, 232, 240, ${0.85 * resAlpha})`;
      c2d.fillText('ENGINE GUARANTEES:', W * 0.5 - 120, H * 0.5 + 30);
      c2d.font = '600 12px monospace';
      c2d.fillStyle = `rgba(148, 163, 184, ${0.8 * resAlpha})`;
      c2d.fillText('CLOSED-FORM DETERMINISM: f(t)', W * 0.5 - 120, H * 0.5 + 60);
      c2d.fillText('SUB-FRAME MOTION BLUR: 1–324 SPP', W * 0.5 - 120, H * 0.5 + 85);
      c2d.fillText('PIPELINE: 16-BIT HDR COMPOSITOR', W * 0.5 - 120, H * 0.5 + 110);

      // Col 3: Directorial Architecture
      c2d.font = '700 13px Archivo, sans-serif';
      c2d.fillStyle = `rgba(226, 232, 240, ${0.85 * resAlpha})`;
      c2d.fillText('DIRECTORIAL ARCHITECTURE:', W * 0.5 + 260, H * 0.5 + 30);
      c2d.font = '600 12px monospace';
      c2d.fillStyle = `rgba(148, 163, 184, ${0.8 * resAlpha})`;
      c2d.fillText('ZERO-ANNOTATION TELEMETRY', W * 0.5 + 260, H * 0.5 + 60);
      c2d.fillText('HEADLESS PLAYWRIGHT CAPTURE', W * 0.5 + 260, H * 0.5 + 85);
      c2d.fillText('AUTONOMOUS AGENTIC CODEBASE', W * 0.5 + 260, H * 0.5 + 110);

      c2d.restore();

      // Bottom Status Line
      const footer = ctx.text('res_foot', 'ALL 11 SCENES FULLY PROCEDURAL · REALTIME GPU SYNTHESIS · COMPLETE v0.5.0 FLAGSHIP DEMO', {
        fontSize: 12, fontWeight: 700, color: `rgba(226, 232, 240, ${0.75 * resAlpha})`, letterSpacing: 3, role: 'hud',
      });
      ctx.renderText('res_foot', c2d, t, W * 0.5 - 420, H - fMarginY - 35);
    }

    // Compositing with Void Backdrop
    ctx.compositor.clear();
    ctx.compositor.createLayer('void_backdrop', {
      render: (target) => {
        renderer.setRenderTarget(target);
        if (typeof (renderer as any).setClearColor === 'function') {
          (renderer as any).setClearColor(0x030206, 1.0);
        }
        renderer.clear(true, true, true);
      },
      blend: 'normal',
      opacity: 1.0,
    });
    ctx.compositor.createLayer('stage_3d', {
      render: (target) => {
        if (isWarpPhase) {
          ctx.particles.render(renderer, ctx.threeCam, target, t);
          ctx.lines.render(renderer, target, ctx.threeCam);
        }
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

    // Flash spike during jump (0.75 - 0.82)
    let bloomVal = 0.55;
    if (progress > 0.74 && progress < 0.82) {
      const flash = Math.sin(((progress - 0.74) / 0.08) * Math.PI);
      bloomVal += flash * 1.8;
    } else if (isResolvePhase) {
      bloomVal = 0.15; // Clean, sharp text resolve
    }

    return { bloom: bloomVal, ca: isResolvePhase ? 0.0 : 0.6 };
  },
});
