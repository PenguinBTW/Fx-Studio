// HOROLOGY CHRONOMETER — Master Haute Horlogerie: involute gear train
// with exact gear meshing ratios, spring-driven hairspring balance wheel,
// rotating tourbillon cage, escapement micro-sparks, and 28,800 VPH beat telemetry.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

// Helper to generate involute gear teeth geometry in LineBatch
function drawInvoluteGear(
  ctx: SceneContext,
  cx: number, cy: number, cz: number,
  teeth: number, pitchRadius: number,
  rotation: number, col: [number, number, number], alpha: number,
) {
  const toothAngle = TAU / teeth;
  const dedendum = pitchRadius * 0.88;
  const addendum = pitchRadius * 1.12;

  let prevX = 0, prevY = 0;
  for (let t = 0; t < teeth; t++) {
    const a0 = t * toothAngle + rotation;
    const a1 = a0 + toothAngle * 0.25;
    const a2 = a0 + toothAngle * 0.50;
    const a3 = a0 + toothAngle * 0.75;
    const a4 = (t + 1) * toothAngle + rotation;

    // Root -> Dedendum -> Tip -> Dedendum -> Root
    const p0x = cx + Math.cos(a0) * dedendum, p0y = cy + Math.sin(a0) * dedendum;
    const p1x = cx + Math.cos(a1) * addendum, p1y = cy + Math.sin(a1) * addendum;
    const p2x = cx + Math.cos(a2) * addendum, p2y = cy + Math.sin(a2) * addendum;
    const p3x = cx + Math.cos(a3) * dedendum, p3y = cy + Math.sin(a3) * dedendum;
    const p4x = cx + Math.cos(a4) * dedendum, p4y = cy + Math.sin(a4) * dedendum;

    ctx.lines.seg(p0x, p0y, cz, p1x, p1y, cz, 1.4, col[0], col[1], col[2], alpha);
    ctx.lines.seg(p1x, p1y, cz, p2x, p2y, cz, 1.6, col[0], col[1], col[2], alpha);
    ctx.lines.seg(p2x, p2y, cz, p3x, p3y, cz, 1.4, col[0], col[1], col[2], alpha);
    ctx.lines.seg(p3x, p3y, cz, p4x, p4y, cz, 1.2, col[0], col[1], col[2], alpha);
  }

  // Inner gear hub circle & spokes
  const hubRadius = pitchRadius * 0.35;
  const spokes = 5;
  for (let s = 0; s < spokes; s++) {
    const sa = (s / spokes) * TAU + rotation;
    ctx.lines.seg(
      cx + Math.cos(sa) * hubRadius, cy + Math.sin(sa) * hubRadius, cz,
      cx + Math.cos(sa) * dedendum, cy + Math.sin(sa) * dedendum, cz,
      1.2, col[0], col[1], col[2], alpha * 0.7,
    );
  }
}

export default defineScene({
  id: 'horology_chronometer',
  rigMode: 'perspective',
  particleCapacity: 2048,
  lineCapacity: 8192,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(45);
    ctx.rig.setPath([
      { t: 0.0, pos: [-4.2, 2.8, -7.5], target: [0, 0, 0], roll: -0.04, focalLength: 45 },
      { t: 0.35, pos: [0.0, 1.8, -6.8], target: [0.8, 0, 0], roll: 0.06, focalLength: 52 },
      { t: 0.7, pos: [3.8, 2.2, -5.5], target: [1.8, 0.4, 0], roll: -0.05, focalLength: 60 },
      { t: 1.0, pos: [1.2, 0.8, -4.2], target: [1.8, 0.4, 0], roll: 0.0, focalLength: 68 },
    ]);

    // Escapement friction sparks on pallet fork impulse
    ctx.particles.addEmitter('escapement_sparks', {
      capacity: 800,
      origin: [1.8, 0.4, 0],
      direction: [0, 1, 0],
      speed: 2.4,
      spread: 0.6,
      lifetime: 1.2,
      gravity: [0, -1.2, 0],
      turbulence: 0.25,
      size: 0.035,
      color: [ctx.lin.signal[0], ctx.lin.signal[1], ctx.lin.signal[2], 0.95],
      glow: 2.2,
    });

    // Ambient micro-machined metal dust
    ctx.particles.addEmitter('lube_motes', {
      capacity: 500,
      origin: [0, 0, 0],
      direction: [0, 0, 1],
      speed: 0.35,
      spread: 1.8,
      lifetime: 4.0,
      turbulence: 0.35,
      size: 0.03,
      color: [ctx.lin.bone[0], ctx.lin.bone[1], ctx.lin.bone[2], 0.45],
      glow: 1.0,
    });

    ctx.node('balance_callout', { role: 'callout', size: [140, 34, 0] });
    ctx.node('tourbillon_callout', { role: 'callout', size: [140, 34, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);

    ctx.lines.clear();

    // 1. Involute Gear Train: Main Wheel (N=60) -> Center Pinion/Wheel (N=20) -> Escape Wheel (N=15)
    // Wheel 1 (Center): cx = -1.5, cy = 0.0, teeth = 48, r = 2.0
    const w1Speed = t * 0.4;
    drawInvoluteGear(ctx, -1.5, 0.0, 0.0, 48, 1.8, w1Speed, lin.bone, 0.7);

    // Wheel 2 (Third Wheel): meshed with Wheel 1, ratio = 48 / 24 = 2.0
    const w2X = -1.5 + (1.8 + 0.9) * Math.cos(0.3);
    const w2Y = 0.0 + (1.8 + 0.9) * Math.sin(0.3);
    const w2Speed = -w1Speed * (48 / 24);
    drawInvoluteGear(ctx, w2X, w2Y, 0.1, 24, 0.9, w2Speed, lin.signal, 0.85);

    // Wheel 3 (Escape Wheel): cx = 1.8, cy = 0.4, teeth = 18, r = 0.65
    const escSpeed = -w2Speed * (24 / 16);
    drawInvoluteGear(ctx, 1.8, 0.4, 0.2, 16, 0.65, escSpeed, lin.ember, 0.9);

    // 2. Oscillating Balance Wheel & Hairspring Spiral (Closed-form physical spring)
    const balanceX = 2.6, balanceY = -0.8, balanceZ = 0.25;
    const balanceRadius = 1.1;
    // 4 Hz oscillation = 8 ticks/sec = 28,800 beats/hour
    const balanceOsc = Math.sin(t * TAU * 4.0) * 0.95; // 310 degree amplitude

    // Balance wheel rim & screws
    const rimSegs = 64;
    let px = 0, py = 0;
    for (let i = 0; i <= rimSegs; i++) {
      const a = (i / rimSegs) * TAU + balanceOsc;
      const x = balanceX + Math.cos(a) * balanceRadius;
      const y = balanceY + Math.sin(a) * balanceRadius;
      if (i > 0) ctx.lines.seg(px, py, balanceZ, x, y, balanceZ, 1.8, lin.signal[0], lin.signal[1], lin.signal[2], 0.9);
      px = x; py = y;
    }

    // Archimedean Hairspring Spiral
    const spiralTurns = 5.5;
    const spiralPts = 120;
    let spx = 0, spy = 0;
    for (let i = 0; i <= spiralPts; i++) {
      const u = i / spiralPts;
      const theta = u * TAU * spiralTurns + balanceOsc * (1 - u);
      const rad = 0.12 + u * (balanceRadius * 0.65);
      const x = balanceX + Math.cos(theta) * rad;
      const y = balanceY + Math.sin(theta) * rad;
      if (i > 0) ctx.lines.seg(spx, spy, balanceZ, x, y, balanceZ, 1.2, lin.bone[0], lin.bone[1], lin.bone[2], 0.7);
      spx = x; spy = y;
    }

    // 3. Tourbillon Cage Bevels (revolving outer cage)
    const tourbillonSpeed = t * (TAU / 60.0); // 1 rotation per minute
    const cageR = 1.35;
    for (let c = 0; c < 3; c++) {
      const ca = (c / 3) * TAU + tourbillonSpeed;
      ctx.lines.seg(
        balanceX, balanceY, balanceZ - 0.2,
        balanceX + Math.cos(ca) * cageR, balanceY + Math.sin(ca) * cageR, balanceZ + 0.3,
        2.0, lin.signal[0], lin.signal[1], lin.signal[2], 0.8,
      );
    }

    // Pin Callouts
    const balNode = ctx.node('balance_callout');
    balNode.pinToWorldVertex([balanceX, balanceY, balanceZ], ctx.threeCam, { screenOffset: [50, 45], minScale: 0.7, maxScale: 1.2 });

    const tourbNode = ctx.node('tourbillon_callout');
    tourbNode.pinToWorldVertex([1.8, 0.4, 0.2], ctx.threeCam, { screenOffset: [-50, -45], minScale: 0.7, maxScale: 1.2 });

    // SDF HUD
    ctx.sdf.clear();
    const cardSpring = ctx.motion.spring(0.12, t, { freq: 3.0, damping: 0.7, v0: 2.0 });
    const cardAlpha = Math.min(1, Math.max(0, cardSpring));
    if (cardAlpha > 0.01) {
      ctx.card('horo_card', {
        x: 84, y: H - 320, w: 500, h: 160,
        radius: [14, 14, 14, 14],
        fill: [lin.ink2[0], lin.ink2[1], lin.ink2[2], 0.88 * cardAlpha],
        stroke: [lin.signal[0], lin.signal[1], lin.signal[2], 0.75 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 26, color: [0, 0, 0, 0.55 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      // Amplitude Gauge dial (312 degrees)
      ctx.ring({ cx: 500, cy: H - 240, radius: 36, thickness: 4, trim: [0, 1], color: [lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.35 * cardAlpha] });
      ctx.ring({ cx: 500, cy: H - 240, radius: 36, thickness: 4, trim: [0, 0.86], color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * cardAlpha], glow: 1.3 });
    }

    if (!balNode.isOccluded) {
      const p = balNode.position;
      ctx.reticle({ cx: p[0] - 50, cy: p[1] - 45, size: 14, thickness: 1.5, color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95] });
    }
    if (!tourbNode.isOccluded) {
      const p = tourbNode.position;
      ctx.reticle({ cx: p[0] + 50, cy: p[1] + 45, size: 12, thickness: 1.5, color: [lin.bone[0], lin.bone[1], lin.bone[2], 0.85] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    const title = ctx.text('horo_title', 'HAUTE CHRONOMETER', {
      fontSize: 54, fontWeight: 900, color: ctx.rgba('bone', 0.98), letterSpacing: 8, role: 'headline',
    }).withKnockoutHalo(4, ctx.rgba('ink', 0.95));
    const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
    ctx.renderText('horo_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

    ctx.text('horo_sub', 'INVOLUTE GEAR TRAIN · TOURBILLON ESCAPEMENT · 4.0 HZ BALANCE WHEEL', {
      fontSize: 14, fontWeight: 600, color: ctx.rgba('signal', 0.92), letterSpacing: 3, role: 'callout',
    }).withKnockoutHalo(2, ctx.rgba('ink', 0.9));
    const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
    ctx.renderText('horo_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

    // Live Beat Rate Roll
    const beatRoll = ctx.text('horo_beat', '28,800 VPH', {
      fontSize: 34, fontWeight: 700, color: ctx.rgba('signal', 0.95), role: 'hud',
    });
    beatRoll.numericRoll(28800, (n) => `${n.toLocaleString()} VPH (4 HZ)`);
    ctx.renderText('horo_beat', c2d, t, 104, H - 265);

    const ampText = ctx.text('horo_amp', 'AMPLITUDE: 312° · BEAT ERROR: 0.1 MS', {
      fontSize: 14, fontWeight: 600, color: ctx.rgba('bone', 0.85), role: 'hud',
    });
    ctx.renderText('horo_amp', c2d, t, 104, H - 215);

    if (!balNode.isOccluded) {
      ctx.text('horo_blabel', 'BALANCE HAIRSPRING · SPIRAL KINEMATICS', {
        fontSize: 12, fontWeight: 600, color: ctx.rgba('signal', 0.9), letterSpacing: 1, role: 'callout',
      }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9));
      const bp = balNode.position;
      ctx.renderText('horo_blabel', c2d, t, bp[0] + 16, bp[1] + 25);
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
