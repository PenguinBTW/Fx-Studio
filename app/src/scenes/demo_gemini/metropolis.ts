// METROPOLIS — Procedural 3D wireframe cyber-city canyon: multi-tiered
// skyscrapers with rooftop antenna spires, glowing ground traffic light trails,
// volumetric digital rain particles, supersonic canyon-run camera flight
// executing a 90-degree vertical ascent to zenith, and 3D rooftop billboards.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

// Deterministic building layout: 7 x 7 grid of skyscrapers
interface Building {
  gridX: number;
  gridZ: number;
  width: number;
  depth: number;
  height: number;
  spireHeight: number;
  tiers: number;
}

const BUILDINGS: Building[] = [];
for (let gx = -3; gx <= 3; gx++) {
  for (let gz = -3; gz <= 4; gz++) {
    // Leave a central highway canyon open along gx = 0
    if (gx === 0 && gz >= -1 && gz <= 2) continue;
    // Deterministic pseudo-random height based on coordinates
    const seed = Math.sin(gx * 12.9898 + gz * 78.233) * 43758.5453;
    const rnd = seed - Math.floor(seed);
    const height = 2.2 + rnd * 4.8;
    BUILDINGS.push({
      gridX: gx * 2.8,
      gridZ: gz * 2.8,
      width: 1.6 + (rnd * 0.4),
      depth: 1.6 + ((1 - rnd) * 0.4),
      height,
      spireHeight: rnd > 0.5 ? 1.2 + rnd * 1.5 : 0,
      tiers: 2 + Math.floor(rnd * 3),
    });
  }
}

export default defineScene({
  id: 'metropolis',
  rigMode: 'perspective',
  particleCapacity: 3072,
  lineCapacity: 8192,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(28);
    // Camera flight: Low canyon supersonic run -> sharp vertical pull-up climbing the central spire
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 0.75, -14.5], target: [0, 0.9, -4.0], roll: 0.0, focalLength: 28 },
      { t: 0.35, pos: [0.3, 0.85, -7.2], target: [0, 1.2, 0.0], roll: -0.06, focalLength: 32 },
      { t: 0.65, pos: [0.0, 2.8, -3.2], target: [0, 5.5, 0.5], roll: 0.04, focalLength: 38 },
      { t: 1.0, pos: [0.0, 7.8, -1.8], target: [0, 9.5, 0.0], roll: 0.0, focalLength: 48 },
    ]);

    // Ground highway traffic light trails (streams of particles)
    ctx.particles.addEmitter('traffic_stream_fwd', {
      capacity: 800,
      origin: [-0.4, 0.05, -12.0],
      direction: [0, 0, 1],
      speed: 8.5,
      spread: 0.05,
      lifetime: 2.2,
      turbulence: 0.05,
      size: 0.06,
      color: [ctx.lin.signal[0], ctx.lin.signal[1], ctx.lin.signal[2], 0.95],
      glow: 2.4,
    });

    ctx.particles.addEmitter('traffic_stream_rev', {
      capacity: 800,
      origin: [0.4, 0.05, 8.0],
      direction: [0, 0, -1],
      speed: 8.5,
      spread: 0.05,
      lifetime: 2.2,
      turbulence: 0.05,
      size: 0.06,
      color: [ctx.lin.ember[0], ctx.lin.ember[1], ctx.lin.ember[2], 0.9],
      glow: 2.2,
    });

    // Atmospheric cyber rain / digital snow falling down the canyons
    ctx.particles.addEmitter('cyber_rain', {
      capacity: 1200,
      origin: [0, 8.0, -2.0],
      direction: [0, -1, 0],
      speed: 4.8,
      spread: 1.8,
      lifetime: 2.4,
      turbulence: 0.35,
      size: 0.04,
      color: [ctx.lin.bone[0], ctx.lin.bone[1], ctx.lin.bone[2], 0.45],
      glow: 1.1,
    });

    ctx.rig.addTrauma(0.5, 0.45, 1.8);
    ctx.node('tower_callout', { role: 'callout', size: [140, 36, 0] });
    ctx.node('altitude_callout', { role: 'callout', size: [140, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);

    ctx.lines.clear();

    // 1. Infinite Ground Highway Grid
    const groundGridSize = 24.0;
    const gridStep = 1.4;
    for (let x = -groundGridSize / 2; x <= groundGridSize / 2; x += gridStep) {
      const isArtery = Math.abs(x) < 0.8;
      const col = isArtery ? lin.signal : lin.graphite;
      const alpha = isArtery ? 0.75 : 0.25;
      ctx.lines.seg(x, 0, -groundGridSize / 2, x, 0, groundGridSize / 2, isArtery ? 1.8 : 0.8, col[0], col[1], col[2], alpha);
    }
    for (let z = -groundGridSize / 2; z <= groundGridSize / 2; z += gridStep) {
      const alpha = Math.abs(z % (gridStep * 4)) < 0.1 ? 0.5 : 0.2;
      ctx.lines.seg(-groundGridSize / 2, 0, z, groundGridSize / 2, 0, z, 0.8, lin.graphite[0], lin.graphite[1], lin.graphite[2], alpha);
    }

    // 2. Skyscraper Wireframe Geometry
    for (let b = 0; b < BUILDINGS.length; b++) {
      const bld = BUILDINGS[b]!;
      const halfW = bld.width * 0.5;
      const halfD = bld.depth * 0.5;
      const bx = bld.gridX;
      const bz = bld.gridZ;
      const by = bld.height;

      // 4 vertical corner columns
      const col = (bld.height > 5.0) ? lin.signal : lin.bone;
      const alpha = (bld.height > 5.0) ? 0.8 : 0.45;
      const w = (bld.height > 5.0) ? 1.6 : 1.0;

      ctx.lines.seg(bx - halfW, 0, bz - halfD, bx - halfW, by, bz - halfD, w, col[0], col[1], col[2], alpha);
      ctx.lines.seg(bx + halfW, 0, bz - halfD, bx + halfW, by, bz - halfD, w, col[0], col[1], col[2], alpha);
      ctx.lines.seg(bx + halfW, 0, bz + halfD, bx + halfW, by, bz + halfD, w, col[0], col[1], col[2], alpha);
      ctx.lines.seg(bx - halfW, 0, bz + halfD, bx - halfW, by, bz + halfD, w, col[0], col[1], col[2], alpha);

      // Horizontal floor-plate loops
      const floorCount = Math.floor(bld.height * 2.5);
      for (let fl = 1; fl <= floorCount; fl++) {
        const fy = (fl / floorCount) * by;
        const isMajor = fl === floorCount || fl % 4 === 0;
        const flAlpha = isMajor ? alpha * 0.8 : 0.18;
        ctx.lines.seg(bx - halfW, fy, bz - halfD, bx + halfW, fy, bz - halfD, 0.8, col[0], col[1], col[2], flAlpha);
        ctx.lines.seg(bx + halfW, fy, bz - halfD, bx + halfW, fy, bz + halfD, 0.8, col[0], col[1], col[2], flAlpha);
        ctx.lines.seg(bx + halfW, fy, bz + halfD, bx - halfW, fy, bz + halfD, 0.8, col[0], col[1], col[2], flAlpha);
        ctx.lines.seg(bx - halfW, fy, bz + halfD, bx - halfW, fy, bz - halfD, 0.8, col[0], col[1], col[2], flAlpha);
      }

      // Rooftop telecommunications spire
      if (bld.spireHeight > 0) {
        ctx.lines.seg(bx, by, bz, bx, by + bld.spireHeight, 1.4, lin.signal[0], lin.signal[1], lin.signal[2], 0.9);
        // Blinking beacon light at spire summit
        const beaconBlink = Math.sin(t * 8.0 + b) > 0.3;
        if (beaconBlink) {
          const sz = 0.18;
          ctx.lines.seg(bx - sz, by + bld.spireHeight, bz, bx + sz, by + bld.spireHeight, bz, 2.0, lin.signal[0], lin.signal[1], lin.signal[2], 1.0);
          ctx.lines.seg(bx, by + bld.spireHeight, bz - sz, bx, by + bld.spireHeight, bz + sz, 2.0, lin.signal[0], lin.signal[1], lin.signal[2], 1.0);
        }
      }
    }

    // 3. Central Mega-Tower (Apex destination for vertical ascent)
    const megaH = 8.5;
    const megaW = 2.4, megaD = 2.4;
    ctx.lines.seg(-megaW / 2, 0, 1.2, -megaW / 2, megaH, 1.2, 2.2, lin.signal[0], lin.signal[1], lin.signal[2], 0.95);
    ctx.lines.seg(megaW / 2, 0, 1.2, megaW / 2, megaH, 1.2, 2.2, lin.signal[0], lin.signal[1], lin.signal[2], 0.95);
    ctx.lines.seg(megaW / 2, 0, 1.2 + megaD, megaW / 2, megaH, 1.2 + megaD, 2.2, lin.signal[0], lin.signal[1], lin.signal[2], 0.95);
    ctx.lines.seg(-megaW / 2, 0, 1.2 + megaD, -megaW / 2, megaH, 1.2 + megaD, 2.2, lin.signal[0], lin.signal[1], lin.signal[2], 0.95);

    // Pin 3D Callout to Mega-Tower Apex
    const towerNode = ctx.node('tower_callout');
    towerNode.pinToWorldVertex([0, megaH, 1.2 + megaD / 2], ctx.threeCam, { screenOffset: [0, -50], minScale: 0.7, maxScale: 1.2 });

    const altNode = ctx.node('altitude_callout');
    altNode.pinToWorldVertex([0, 1.2, -5.0], ctx.threeCam, { screenOffset: [60, 40], minScale: 0.7, maxScale: 1.2 });

    // SDF HUD
    ctx.sdf.clear();
    const enterSpring = ctx.motion.spring(0.1, t, { freq: 3.0, damping: 0.7, v0: 2.2 });
    const cardAlpha = Math.min(1, Math.max(0, enterSpring));
    if (cardAlpha > 0.01) {
      ctx.card('metro_card', {
        x: 84, y: H - 320, w: 480, h: 160,
        radius: [14, 14, 14, 14],
        fill: [lin.ink2[0], lin.ink2[1], lin.ink2[2], 0.88 * cardAlpha],
        stroke: [lin.signal[0], lin.signal[1], lin.signal[2], 0.75 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 26, color: [0, 0, 0, 0.55 * cardAlpha], offset: [0, 10] },
        role: 'hud', opacity: cardAlpha,
      });

      // Altitude progress ring
      const altTrim = ease.inOutCubic(progress);
      ctx.ring({ cx: 500, cy: H - 240, radius: 36, thickness: 4, trim: [0, 1], color: [lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.35 * cardAlpha] });
      ctx.ring({ cx: 500, cy: H - 240, radius: 36, thickness: 4, trim: [0, Math.max(0.04, altTrim)], color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * cardAlpha], glow: 1.3 });
    }

    if (!towerNode.isOccluded) {
      const p = towerNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 50, size: 14, thickness: 1.5, color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95] });
    }
    if (!altNode.isOccluded) {
      const p = altNode.position;
      ctx.reticle({ cx: p[0] - 60, cy: p[1] - 40, size: 12, thickness: 1.5, color: [lin.bone[0], lin.bone[1], lin.bone[2], 0.85] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    const title = ctx.text('metro_title', 'NEO-GRID METROPOLIS', {
      fontSize: 52, fontWeight: 900, color: ctx.rgba('bone', 0.98), letterSpacing: 8, role: 'headline',
    }).withKnockoutHalo(4, ctx.rgba('ink', 0.95));
    const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
    ctx.renderText('metro_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

    ctx.text('metro_sub', 'PROCEDURAL WIREFRAME CANYON · SUPERSONIC LOW-ALTITUDE RUN · ZENITH ASCENT', {
      fontSize: 14, fontWeight: 600, color: ctx.rgba('signal', 0.92), letterSpacing: 3, role: 'callout',
    }).withKnockoutHalo(2, ctx.rgba('ink', 0.9));
    const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
    ctx.renderText('metro_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

    // Live altitude & Mach speed numeric readout
    const altRoll = ctx.text('metro_alt', '000M', {
      fontSize: 34, fontWeight: 700, color: ctx.rgba('signal', 0.95), role: 'hud',
    });
    const curAlt = Math.round(45 + progress * 780);
    altRoll.numericRoll(curAlt, (n) => `ALTITUDE: ${n}M AGL`);
    ctx.renderText('metro_alt', c2d, t, 104, H - 265);

    const speedRoll = ctx.text('metro_speed', 'MACH 2.4', {
      fontSize: 16, fontWeight: 600, color: ctx.rgba('bone', 0.85), role: 'hud',
    });
    speedRoll.numericRoll(Math.round(progress * 24), (n) => `VELOCITY: MACH ${(1.2 + n / 20).toFixed(2)} [SUPERSONIC]`);
    ctx.renderText('metro_speed', c2d, t, 104, H - 215);

    if (!towerNode.isOccluded) {
      ctx.text('metro_tlabel', 'CENTRAL TOWER APEX · 820M', {
        fontSize: 12, fontWeight: 600, color: ctx.rgba('signal', 0.9), letterSpacing: 1, role: 'callout',
      }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9));
      const tp = towerNode.position;
      ctx.renderText('metro_tlabel', c2d, t, tp[0] + 18, tp[1] - 40);
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

    // Altitude ascent zoom & optical breathing
    if (progress > 0.65) {
      const climPulse = (progress - 0.65) / 0.35;
      return {
        bloom: 0.55 + climPulse * 0.45,
        ca: 1.2 + climPulse * 3.5,
      };
    }
  },
});
