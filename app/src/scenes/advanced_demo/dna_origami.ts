// DNA ORIGAMI — Molecular Nanotechnology & Biophysics:
// Double-helix parametric coordinates unwinding and folding into a self-assembled
// nanorobotic cage, base-pair hydrogen bond rungs (A-T, G-C), Brownian motion solvent
// particles, and Gibbs free energy (ΔG) thermodynamic telemetry.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

// 64 discrete base-pair steps along the macromolecule
const NUM_BASES = 64;

interface BasePair {
  idx: number;
  type: 'A-T' | 'G-C';
  targetCagePos1: [number, number, number];
  targetCagePos2: [number, number, number];
}

const BASES: BasePair[] = [];
for (let i = 0; i < NUM_BASES; i++) {
  const isGC = (i * 7 + 3) % 5 > 2;
  
  // Fold into a rectangular nanorobotic cage / box frame
  const side = i % 16;
  const ring = Math.floor(i / 16);
  const ringY = (ring - 1.5) * 1.4;
  const angle = (side / 16) * TAU;
  const radius = 2.4;
  const cx = Math.cos(angle) * radius;
  const cz = Math.sin(angle) * radius;

  BASES.push({
    idx: i,
    type: isGC ? 'G-C' : 'A-T',
    targetCagePos1: [cx * 0.9, ringY, cz * 0.9],
    targetCagePos2: [cx * 1.1, ringY + 0.2, cz * 1.1],
  });
}

export default defineScene({
  id: 'dna_origami',
  rigMode: 'perspective',
  particleCapacity: 3072,
  lineCapacity: 8192,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(28);
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 3.5, -9.5], target: [0, 0.0, 0.0], roll: -0.05, focalLength: 28 },
      { t: 0.35, pos: [7.2, 1.2, -4.5], target: [0, 0.2, 0.0], roll: 0.06, focalLength: 32 },
      { t: 0.7, pos: [3.5, -3.2, 7.5], target: [0, 0.0, 0.0], roll: -0.04, focalLength: 38 },
      { t: 1.0, pos: [-6.8, 2.2, 6.2], target: [0, 0.0, 0.0], roll: 0.03, focalLength: 42 },
    ]);

    // Aqueous solvent buffer & counterion particles (Brownian motion motes)
    ctx.particles.addEmitter('solvent_buffer', {
      capacity: 1500,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 0.22,
      spread: 2.5,
      lifetime: 5.0,
      gravity: [0, 0.02, 0],
      turbulence: 0.5,
      size: 0.04,
      color: [ctx.lin.bone[0], ctx.lin.bone[1], ctx.lin.bone[2], 0.45],
      glow: 0.8,
    });

    // Fluorescent molecular probe markers (FAM / Cy5 markers)
    ctx.particles.addEmitter('fluorescent_tags', {
      capacity: 400,
      origin: [0, 0, 0],
      direction: [1, 0, 0],
      speed: 0.35,
      spread: 1.8,
      lifetime: 3.5,
      turbulence: 0.4,
      size: 0.09,
      color: [ctx.lin.signal[0], ctx.lin.signal[1], ctx.lin.signal[2], 0.9],
      glow: 2.2,
    });

    ctx.node('latch_site', { role: 'callout', size: [160, 36, 0] });
    ctx.node('aptamer_hinge', { role: 'callout', size: [160, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);
    ctx.lines.clear();

    // Folding progression parameter: helical (0.0) -> folded nanobox cage (1.0)
    const foldRaw = Math.min(1, Math.max(0, (progress - 0.15) / 0.7));
    const foldAmount = ease.inOutCubic(foldRaw);

    const helixRadius = 1.6;
    const helixPitch = 0.14;
    const totalAngle = NUM_BASES * 0.36;

    // Calculate dynamic 3D positions for backbone 1 and backbone 2
    const strand1: [number, number, number][] = [];
    const strand2: [number, number, number][] = [];

    for (let i = 0; i < NUM_BASES; i++) {
      const b = BASES[i]!;
      const theta = (i / NUM_BASES) * totalAngle + t * 0.4;
      const unrolledY = (i - NUM_BASES * 0.5) * helixPitch;

      // Thermal Brownian jitter
      const jx = Math.sin(t * 12.0 + i * 2.1) * 0.035 * (1.0 - foldAmount * 0.6);
      const jy = Math.cos(t * 14.0 + i * 3.7) * 0.035 * (1.0 - foldAmount * 0.6);
      const jz = Math.sin(t * 11.0 + i * 1.9) * 0.035 * (1.0 - foldAmount * 0.6);

      // Helix coordinates
      const hx1 = Math.cos(theta) * helixRadius + jx;
      const hy1 = unrolledY + jy;
      const hz1 = Math.sin(theta) * helixRadius + jz;

      // Complementary strand (phase offset ~ 2.4 rad for major/minor groove)
      const hx2 = Math.cos(theta + 2.4) * helixRadius + jx;
      const hy2 = unrolledY + jy;
      const hz2 = Math.sin(theta + 2.4) * helixRadius + jz;

      // Interpolate to folded origami cage target positions
      const p1x = hx1 * (1.0 - foldAmount) + b.targetCagePos1[0] * foldAmount;
      const p1y = hy1 * (1.0 - foldAmount) + b.targetCagePos1[1] * foldAmount;
      const p1z = hz1 * (1.0 - foldAmount) + b.targetCagePos1[2] * foldAmount;

      const p2x = hx2 * (1.0 - foldAmount) + b.targetCagePos2[0] * foldAmount;
      const p2y = hy2 * (1.0 - foldAmount) + b.targetCagePos2[1] * foldAmount;
      const p2z = hz2 * (1.0 - foldAmount) + b.targetCagePos2[2] * foldAmount;

      strand1.push([p1x, p1y, p1z]);
      strand2.push([p2x, p2y, p2z]);

      // Draw Hydrogen Bond Rung (A-T: 2 bonds, G-C: 3 bonds)
      const isGC = b.type === 'G-C';
      const rungCol = isGC ? lin.signal : lin.bone;
      const rungWidth = isGC ? 1.6 : 1.1;
      const rungAlpha = isGC ? 0.95 : 0.7;

      ctx.lines.seg(p1x, p1y, p1z, p2x, p2y, p2z, rungWidth, rungCol[0], rungCol[1], rungCol[2], rungAlpha);

      // Minor stabilizer cross-staple lines when folded
      if (foldAmount > 0.4 && i % 4 === 0 && i + 4 < NUM_BASES) {
        const nextB = BASES[i + 4]!;
        const stapleAlpha = (foldAmount - 0.4) / 0.6 * 0.55;
        ctx.lines.seg(
          p1x, p1y, p1z,
          nextB.targetCagePos2[0], nextB.targetCagePos2[1], nextB.targetCagePos2[2],
          0.9, lin.graphite[0], lin.graphite[1], lin.graphite[2], stapleAlpha
        );
      }
    }

    // Connect Continuous Sugar-Phosphate Backbones
    for (let i = 0; i < NUM_BASES - 1; i++) {
      const p1a = strand1[i]!;
      const p1b = strand1[i + 1]!;
      const p2a = strand2[i]!;
      const p2b = strand2[i + 1]!;

      // Strand 1 (5' -> 3')
      ctx.lines.seg(p1a[0], p1a[1], p1a[2], p1b[0], p1b[1], p1b[2], 2.2, lin.bone[0], lin.bone[1], lin.bone[2], 0.92);
      // Strand 2 (3' -> 5')
      ctx.lines.seg(p2a[0], p2a[1], p2a[2], p2b[0], p2b[1], p2b[2], 2.2, lin.signal[0], lin.signal[1], lin.signal[2], 0.95);
    }

    // Pin Callout Nodes to Molecular Landmarks
    const midIdx = Math.floor(NUM_BASES / 2);
    const midPos = strand1[midIdx]!;
    const endPos = strand2[NUM_BASES - 1]!;

    const latchNode = ctx.node('latch_site');
    latchNode.pinToWorldVertex([midPos[0], midPos[1], midPos[2]], ctx.threeCam, { screenOffset: [0, -40], minScale: 0.7, maxScale: 1.2 });
    const hingeNode = ctx.node('aptamer_hinge');
    hingeNode.pinToWorldVertex([endPos[0], endPos[1], endPos[2]], ctx.threeCam, { screenOffset: [0, -40], minScale: 0.7, maxScale: 1.2 });

    // Text & HUD Ducking during transitions
    const textDuck = Math.min(
      Math.min(1, Math.max(0, f.p / 0.08)),
      Math.min(1, Math.max(0, (1.0 - f.p) / 0.08))
    );

    // 2D Vector UI (SDF Cards & Gauges)
    ctx.sdf.clear();
    const cardAlpha = Math.min(1, Math.max(0, ease.outExpo(Math.min(1, progress * 4.0)))) * textDuck;
    if (cardAlpha > 0.01) {
      // Telemetry Card: Free Energy & Kinetic State
      ctx.card('dna_card', {
        x: W - 530, y: 84, w: 450, h: 180,
        radius: [14, 14, 14, 14],
        fill: [lin.ink2[0], lin.ink2[1], lin.ink2[2], 0.88 * cardAlpha],
        stroke: [lin.signal[0], lin.signal[1], lin.signal[2], 0.75 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 24, color: [0, 0, 0, 0.55 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      // Gibbs Free Energy ΔG dial
      ctx.ring({ cx: W - 140, cy: 172, radius: 38, thickness: 4.5, trim: [0, 1], color: [lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.35 * cardAlpha] });
      const deltaGProgress = Math.min(1, 0.15 + foldAmount * 0.85);
      ctx.ring({
        cx: W - 140, cy: 172, radius: 38, thickness: 4.5,
        trim: [0, deltaGProgress],
        color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * cardAlpha],
        glow: 1.4,
      });
    }

    if (!latchNode.isOccluded && textDuck > 0.1) {
      const p = latchNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 45, size: 12, thickness: 1.5, color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * textDuck] });
    }
    if (!hingeNode.isOccluded && textDuck > 0.1) {
      const p = hingeNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 50, size: 14, thickness: 1.5, color: [lin.bone[0], lin.bone[1], lin.bone[2], 0.85 * textDuck] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      const title = ctx.text('dna_title', 'DNA ORIGAMI NANOSTRUCTURE', {
        fontSize: 50, fontWeight: 900, color: ctx.rgba('bone', 0.98 * textDuck), letterSpacing: 8, role: 'headline',
      }).withKnockoutHalo(4, ctx.rgba('ink', 0.95 * textDuck));
      const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
      ctx.renderText('dna_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

      ctx.text('dna_sub', 'SELF-ASSEMBLY FOLDING DYNAMICS · SCAFFOLD-STAPLE ANNEALING · 64 BASE PAIRS', {
        fontSize: 14, fontWeight: 600, color: ctx.rgba('signal', 0.92 * textDuck), letterSpacing: 3, role: 'callout',
      }).withKnockoutHalo(2, ctx.rgba('ink', 0.9 * textDuck));
      const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
      ctx.renderText('dna_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

      // Telemetry metrics
      const deltaGVal = (-12.4 - foldAmount * 35.8).toFixed(1);
      const gRoll = ctx.text('dna_dg', `ΔG = ${deltaGVal} KCAL/MOL`, {
        fontSize: 30, fontWeight: 700, color: ctx.rgba('signal', 0.95 * textDuck), role: 'hud',
      });
      gRoll.numericRoll(Math.round(Math.abs(parseFloat(deltaGVal)) * 10), (n) => `ΔG = -${(n / 10).toFixed(1)} KCAL/MOL`);
      ctx.renderText('dna_dg', c2d, t, W - 500, 142);

      const foldPct = Math.round(foldAmount * 100);
      const foldText = ctx.text('dna_fold_pct', `FOLD COMPACTNESS: ${foldPct}% · HYBRIDIZED: ${Math.round(NUM_BASES * (0.2 + foldAmount * 0.8))}/64`, {
        fontSize: 13, fontWeight: 600, color: ctx.rgba('bone', 0.85 * textDuck), role: 'hud',
      });
      ctx.renderText('dna_fold_pct', c2d, t, W - 500, 195);

      if (!latchNode.isOccluded) {
        ctx.text('dna_latch_lbl', 'APTAMER LATCH · CA²⁺ ACTIVATED', {
          fontSize: 12, fontWeight: 600, color: ctx.rgba('signal', 0.9 * textDuck), letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9 * textDuck));
        const lp = latchNode.position;
        ctx.renderText('dna_latch_lbl', c2d, t, lp[0] + 16, lp[1] - 32);
      }

      if (!hingeNode.isOccluded) {
        ctx.text('dna_hinge_lbl', '3\'-TERMINAL HOLLIDAY JUNCTION', {
          fontSize: 12, fontWeight: 600, color: ctx.rgba('bone', 0.85 * textDuck), letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9 * textDuck));
        const hp = hingeNode.position;
        ctx.renderText('dna_hinge_lbl', c2d, t, hp[0] + 16, hp[1] - 32);
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

    if (foldAmount > 0.85) {
      const pulse = (foldAmount - 0.85) / 0.15;
      return { bloom: 0.55 + pulse * 0.35, ca: 1.0 + pulse * 2.0 };
    }
  },
});
