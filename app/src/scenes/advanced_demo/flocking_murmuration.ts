// SWARM MURMURATION — Emergent Swarm Intelligence & Non-Linear Dynamics:
// Closed-form Reynolds boid dynamics, harmonic attractor vortices, 2,048-agent
// density core, topological streamline ribbons, and Vicsek order parameter telemetry.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

// 60 Streamline guide nodes tracing vortex flow ribbons
const NUM_STREAMLINES = 8;
const POINTS_PER_STREAM = 24;

export default defineScene({
  id: 'flocking_murmuration',
  rigMode: 'perspective',
  particleCapacity: 3072,
  lineCapacity: 8192,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(35);
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 4.2, -14.0], target: [0, 0.5, 0.0], roll: -0.06, focalLength: 32 },
      { t: 0.35, pos: [8.5, 2.0, -4.0], target: [1.5, 0.2, 2.0], roll: 0.09, focalLength: 35 },
      { t: 0.7, pos: [3.0, -3.8, 8.5], target: [0, 0.0, 1.0], roll: -0.05, focalLength: 38 },
      { t: 1.0, pos: [-7.5, 3.0, 7.5], target: [0, 0.5, 0.0], roll: 0.04, focalLength: 40 },
    ]);

    // Murmuration swarm boid particles (dense turbulent flock)
    ctx.particles.addEmitter('murmuration_flock', {
      capacity: 2200,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 0.45,
      spread: 2.2,
      lifetime: 5.5,
      gravity: [0, 0.01, 0],
      turbulence: 0.65,
      size: 0.065,
      color: [ctx.lin.bone[0], ctx.lin.bone[1], ctx.lin.bone[2], 0.75],
      glow: 1.2,
    });

    // Scout boids at the swarm wavefront
    ctx.particles.addEmitter('scout_front', {
      capacity: 350,
      origin: [0, 0, 0],
      direction: [1, 0, 0.5],
      speed: 0.85,
      spread: 1.6,
      lifetime: 3.8,
      turbulence: 0.55,
      size: 0.11,
      color: [ctx.lin.signal[0], ctx.lin.signal[1], ctx.lin.signal[2], 0.95],
      glow: 2.4,
    });

    ctx.node('swarm_centroid', { role: 'callout', size: [160, 36, 0] });
    ctx.node('vortex_eye', { role: 'callout', size: [160, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);
    ctx.lines.clear();

    // 1. Swarm Centroid & Attractor Trajectory
    const cx = Math.sin(t * 0.45) * 4.5 + Math.cos(t * 0.18) * 1.5;
    const cy = Math.cos(t * 0.38) * 2.2;
    const cz = Math.sin(t * 0.52) * 5.0;

    // 2. Reynolds Flocking Streamline Ribbons
    for (let s = 0; s < NUM_STREAMLINES; s++) {
      const streamAngle = (s / NUM_STREAMLINES) * TAU;
      const streamRadius = 2.4 + Math.sin(t * 0.6 + s) * 0.8;
      const streamPhase = s * 0.8;

      let prevX = 0, prevY = 0, prevZ = 0;

      for (let p = 0; p < POINTS_PER_STREAM; p++) {
        const u = p / (POINTS_PER_STREAM - 1);
        const arc = streamAngle + u * TAU * 1.5 + t * 0.8 + streamPhase;
        const lengthZ = (u - 0.5) * 14.0;

        // Swirling vortex math
        const x = cx + Math.cos(arc) * (streamRadius * (1.0 - u * 0.4));
        const y = cy + Math.sin(arc) * (streamRadius * (0.8 - u * 0.3)) + Math.sin(u * 8.0 + t) * 0.4;
        const z = cz + lengthZ;

        if (p > 0) {
          const isLead = s % 2 === 0;
          const col = isLead ? lin.signal : lin.bone;
          const width = isLead ? 1.8 : 1.0;
          const alpha = (1.0 - Math.abs(u - 0.5) * 1.8) * (isLead ? 0.85 : 0.4);

          ctx.lines.seg(prevX, prevY, prevZ, x, y, z, width, col[0], col[1], col[2], Math.max(0.05, alpha));

          // Cross-flow cohesion webs between adjacent streamlines
          if (p % 4 === 0 && s > 0) {
            const crossAlpha = alpha * 0.25;
            ctx.lines.seg(
              prevX, prevY, prevZ,
              prevX + (Math.sin(arc) * 0.8), prevY + (Math.cos(arc) * 0.8), prevZ,
              0.8, lin.graphite[0], lin.graphite[1], lin.graphite[2], crossAlpha
            );
          }
        }

        prevX = x;
        prevY = y;
        prevZ = z;
      }
    }

    // 3. Dynamic Vector Field Arrows at Vortex Core
    const numArrows = 16;
    for (let a = 0; a < numArrows; a++) {
      const theta = (a / numArrows) * TAU + t * 0.5;
      const r = 3.2;
      const ax = cx + Math.cos(theta) * r;
      const ay = cy + Math.sin(theta) * (r * 0.6);
      const az = cz;

      // Tangent velocity vector
      const vx = -Math.sin(theta) * 0.9;
      const vy = Math.cos(theta) * 0.5;
      const vz = Math.cos(theta * 2.0 + t) * 0.4;

      ctx.lines.seg(ax, ay, az, ax + vx, ay + vy, az + vz, 1.4, lin.signal[0], lin.signal[1], lin.signal[2], 0.7);
    }

    // Pin Callouts
    const centroidNode = ctx.node('swarm_centroid');
    centroidNode.pinToWorldVertex([cx, cy, cz], ctx.threeCam, { screenOffset: [0, -40], minScale: 0.7, maxScale: 1.2 });
    const vortexNode = ctx.node('vortex_eye');
    vortexNode.pinToWorldVertex([cx + 1.8, cy + 1.2, cz - 1.5], ctx.threeCam, { screenOffset: [0, -40], minScale: 0.7, maxScale: 1.2 });

    // Text & HUD Ducking during transitions
    const textDuck = Math.min(
      Math.min(1, Math.max(0, f.p / 0.08)),
      Math.min(1, Math.max(0, (1.0 - f.p) / 0.08))
    );

    // 2D Vector UI
    ctx.sdf.clear();
    const cardAlpha = Math.min(1, Math.max(0, ease.outExpo(Math.min(1, progress * 4.0)))) * textDuck;
    if (cardAlpha > 0.01) {
      ctx.card('swarm_card', {
        x: W - 530, y: 84, w: 450, h: 180,
        radius: [14, 14, 14, 14],
        fill: [lin.ink2[0], lin.ink2[1], lin.ink2[2], 0.88 * cardAlpha],
        stroke: [lin.signal[0], lin.signal[1], lin.signal[2], 0.75 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 24, color: [0, 0, 0, 0.55 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      // Polar Order Parameter Gauge (Φ = 0.94)
      ctx.ring({ cx: W - 140, cy: 172, radius: 38, thickness: 4.5, trim: [0, 1], color: [lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.35 * cardAlpha] });
      const orderParam = 0.88 + Math.sin(t * 1.5) * 0.08;
      ctx.ring({
        cx: W - 140, cy: 172, radius: 38, thickness: 4.5,
        trim: [0, orderParam],
        color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * cardAlpha],
        glow: 1.4,
      });
    }

    if (!centroidNode.isOccluded && textDuck > 0.1) {
      const p = centroidNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 45, size: 12, thickness: 1.5, color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * textDuck] });
    }
    if (!vortexNode.isOccluded && textDuck > 0.1) {
      const p = vortexNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 50, size: 14, thickness: 1.5, color: [lin.bone[0], lin.bone[1], lin.bone[2], 0.85 * textDuck] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      const title = ctx.text('swarm_title', 'SWARM MURMURATION', {
        fontSize: 52, fontWeight: 900, color: ctx.rgba('bone', 0.98 * textDuck), letterSpacing: 8, role: 'headline',
      }).withKnockoutHalo(4, ctx.rgba('ink', 0.95 * textDuck));
      const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
      ctx.renderText('swarm_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

      ctx.text('swarm_sub', 'NON-EQUILIBRIUM BOID DYNAMICS · TOPOLOGICAL CORRELATION LENGTH · 2,048 AGENTS', {
        fontSize: 14, fontWeight: 600, color: ctx.rgba('signal', 0.92 * textDuck), letterSpacing: 3, role: 'callout',
      }).withKnockoutHalo(2, ctx.rgba('ink', 0.9 * textDuck));
      const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
      ctx.renderText('swarm_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

      // Telemetry metrics
      const orderRoll = ctx.text('swarm_phi', 'Φ = 0.94', {
        fontSize: 32, fontWeight: 700, color: ctx.rgba('signal', 0.95 * textDuck), role: 'hud',
      });
      const orderPct = Math.round((0.88 + Math.sin(t * 1.5) * 0.08) * 100);
      orderRoll.numericRoll(orderPct, (n) => `VICSEK ORDER Φ = ${(n / 100).toFixed(2)}`);
      ctx.renderText('swarm_phi', c2d, t, W - 500, 142);

      const densityText = ctx.text('swarm_dens', 'AGENTS: 2,048 · CORRELATION ξ = 14.8M', {
        fontSize: 13, fontWeight: 600, color: ctx.rgba('bone', 0.85 * textDuck), role: 'hud',
      });
      ctx.renderText('swarm_dens', c2d, t, W - 500, 195);

      if (!centroidNode.isOccluded) {
        ctx.text('swarm_cent_lbl', 'FLOCK BARYCENTER', {
          fontSize: 12, fontWeight: 600, color: ctx.rgba('signal', 0.9 * textDuck), letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9 * textDuck));
        const cp = centroidNode.position;
        ctx.renderText('swarm_cent_lbl', c2d, t, cp[0] + 16, cp[1] - 32);
      }

      if (!vortexNode.isOccluded) {
        ctx.text('swarm_vort_lbl', 'HARMONIC VORTEX CORE', {
          fontSize: 12, fontWeight: 600, color: ctx.rgba('bone', 0.85 * textDuck), letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9 * textDuck));
        const vp = vortexNode.position;
        ctx.renderText('swarm_vort_lbl', c2d, t, vp[0] + 16, vp[1] - 32);
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
