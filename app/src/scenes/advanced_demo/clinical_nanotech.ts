// 07: CLINICAL NANOTECH — High-Key Biotech Laboratory / Molecular Synthesis
// Sterile clinical off-white backdrop (#EDF2F7), medical slate (#2D3748), surgical teal (#0D9488),
// coral (#F43F5E), 64-base DNA origami, targeted icosahedral nanocarrier capsid with docking arms,
// lipid bilayer membrane, microfluidic laminar flow chamber, and cryo-EM nanoscale telemetry.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

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
  id: 'clinical_nanotech',
  rigMode: 'perspective',
  particleCapacity: 2048,
  lineCapacity: 16384,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(28);
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 2.4, -9.0], target: [0, 0.2, 0.0], roll: -0.05, focalLength: 28 },
      { t: 0.35, pos: [6.8, 1.4, -4.5], target: [0, 0.2, 0.0], roll: 0.06, focalLength: 32 },
      { t: 0.7, pos: [3.2, -2.5, 7.2], target: [0, 0.1, 0.0], roll: -0.04, focalLength: 38 },
      { t: 1.0, pos: [-6.5, 1.8, 6.0], target: [0, 0.1, 0.0], roll: 0.03, focalLength: 42 },
    ]);

    // Ultra-clean sterile solvent buffer motes
    ctx.particles.addEmitter('clinical_solvent', {
      capacity: 120,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 0.6,
      spread: Math.PI * 0.85,
      lifetime: 5.5,
      gravity: [0, 0.005, 0],
      turbulence: 0.2,
      size: 0.010,
      color: [0.05, 0.71, 0.68, 0.18],
      glow: 0.4,
    });

    ctx.node('aptamer_latch', { role: 'callout', size: [160, 36, 0] });
    ctx.node('nanocarrier_capsid', { role: 'callout', size: [160, 36, 0] });
    ctx.node('holliday_core', { role: 'callout', size: [160, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);
    ctx.lines.clear();

    // Clinical Palette on Sterile Off-White: Medical Slate, Surgical Teal, Coral Red
    const colSlate: [number, number, number] = [0.18, 0.24, 0.32];
    const colTeal: [number, number, number] = [0.05, 0.71, 0.68];
    const colCoral: [number, number, number] = [0.96, 0.25, 0.37];
    const colLightGrid: [number, number, number] = [0.75, 0.82, 0.88];
    const colLipid: [number, number, number] = [0.45, 0.60, 0.72];

    // 1. Sterile Laboratory Calibration Grid Floor
    const gridHalf = 10.0;
    const gridStep = 1.0;
    const floorY = -2.8;
    for (let x = -gridHalf; x <= gridHalf; x += gridStep) {
      const alpha = Math.max(0, 0.35 - Math.abs(x) / 14.0);
      ctx.lines.seg(x, floorY, -gridHalf, x, floorY, gridHalf, 0.8, colLightGrid[0], colLightGrid[1], colLightGrid[2], alpha);
    }
    for (let z = -gridHalf; z <= gridHalf; z += gridStep) {
      const alpha = Math.max(0, 0.35 - Math.abs(z) / 14.0);
      ctx.lines.seg(-gridHalf, floorY, z, gridHalf, floorY, z, 0.8, colLightGrid[0], colLightGrid[1], colLightGrid[2], alpha);
    }

    // 2. Cellular Lipid Bilayer Membrane Surface
    const lipidY = floorY + 0.35;
    for (let lx = -6.0; lx <= 6.0; lx += 0.8) {
      for (let lz = -4.0; lz <= 4.0; lz += 0.8) {
        ctx.lines.seg(lx - 0.06, lipidY, lz, lx + 0.06, lipidY, lz, 2.0, colLipid[0], colLipid[1], colLipid[2], 0.65);
        ctx.lines.seg(lx - 0.03, lipidY, lz, lx - 0.03, lipidY - 0.22, lz, 1.2, colSlate[0], colSlate[1], colSlate[2], 0.45);
        ctx.lines.seg(lx + 0.03, lipidY, lz, lx + 0.03, lipidY - 0.22, lz, 1.2, colSlate[0], colSlate[1], colSlate[2], 0.45);
      }
    }

    // 3. DNA Origami Folding Dynamics (Helix -> Box Cage)
    const foldRaw = Math.min(1, Math.max(0, (progress - 0.15) / 0.7));
    const foldAmount = ease.inOutCubic(foldRaw);
    const helixRadius = 1.6;
    const helixPitch = 0.14;
    const totalAngle = NUM_BASES * 0.36;

    const strand1: [number, number, number][] = [];
    const strand2: [number, number, number][] = [];

    for (let i = 0; i < NUM_BASES; i++) {
      const b = BASES[i]!;
      const theta = (i / NUM_BASES) * totalAngle + t * 0.4;
      const unrolledY = (i - NUM_BASES * 0.5) * helixPitch;

      const jx = Math.sin(t * 10.0 + i * 2.1) * 0.02 * (1.0 - foldAmount * 0.6);
      const jy = Math.cos(t * 12.0 + i * 3.7) * 0.02 * (1.0 - foldAmount * 0.6);
      const jz = Math.sin(t * 9.0 + i * 1.9) * 0.02 * (1.0 - foldAmount * 0.6);

      const hx1 = Math.cos(theta) * helixRadius + jx;
      const hy1 = unrolledY + jy;
      const hz1 = Math.sin(theta) * helixRadius + jz;

      const hx2 = Math.cos(theta + 2.4) * helixRadius + jx;
      const hy2 = unrolledY + jy;
      const hz2 = Math.sin(theta + 2.4) * helixRadius + jz;

      const p1x = hx1 * (1.0 - foldAmount) + b.targetCagePos1[0] * foldAmount;
      const p1y = hy1 * (1.0 - foldAmount) + b.targetCagePos1[1] * foldAmount;
      const p1z = hz1 * (1.0 - foldAmount) + b.targetCagePos1[2] * foldAmount;

      const p2x = hx2 * (1.0 - foldAmount) + b.targetCagePos2[0] * foldAmount;
      const p2y = hy2 * (1.0 - foldAmount) + b.targetCagePos2[1] * foldAmount;
      const p2z = hz2 * (1.0 - foldAmount) + b.targetCagePos2[2] * foldAmount;

      strand1.push([p1x, p1y, p1z]);
      strand2.push([p2x, p2y, p2z]);

      const isGC = b.type === 'G-C';
      const rungCol = isGC ? colTeal : colCoral;
      const rungWidth = isGC ? 2.8 : 2.2;

      ctx.lines.seg(p1x, p1y, p1z, p2x, p2y, p2z, rungWidth, rungCol[0], rungCol[1], rungCol[2], 0.95);

      const midRx = (p1x + p2x) * 0.5;
      const midRy = (p1y + p2y) * 0.5;
      const midRz = (p1z + p2z) * 0.5;
      ctx.lines.seg(midRx - 0.04, midRy, midRz, midRx + 0.04, midRy, midRz, 2.4, rungCol[0], rungCol[1], rungCol[2], 0.95);
    }

    // Connect Continuous Backbones in Deep Medical Slate & Teal (Thickened 4.2px)
    for (let i = 0; i < NUM_BASES - 1; i++) {
      const p1a = strand1[i]!;
      const p1b = strand1[i + 1]!;
      const p2a = strand2[i]!;
      const p2b = strand2[i + 1]!;

      ctx.lines.seg(p1a[0], p1a[1], p1a[2], p1b[0], p1b[1], p1b[2], 4.2, colSlate[0], colSlate[1], colSlate[2], 0.98);
      ctx.lines.seg(p2a[0], p2a[1], p2a[2], p2b[0], p2b[1], p2b[2], 4.2, colTeal[0], colTeal[1], colTeal[2], 0.98);
    }

    // 4. Targeted Nanorobot Delivery Vehicle (Positioned directly above DNA helix at capY = 1.4)
    const capX = 0.0, capY = 1.4, capZ = 0.0;
    const capR = 0.85;
    const capRot = t * 0.5;

    const numCapSteps = 12;
    for (let cs = 0; cs < numCapSteps; cs++) {
      const ca1 = (cs / numCapSteps) * TAU + capRot;
      const ca2 = ((cs + 1) / numCapSteps) * TAU + capRot;
      ctx.lines.seg(capX + Math.cos(ca1) * capR, capY, capZ + Math.sin(ca1) * capR, capX + Math.cos(ca2) * capR, capY, capZ + Math.sin(ca2) * capR, 2.4, colTeal[0], colTeal[1], colTeal[2], 0.98);
      ctx.lines.seg(capX + Math.cos(ca1) * capR, capY, capZ + Math.sin(ca1) * capR, capX, capY + capR * 0.7, capZ, 2.0, colSlate[0], colSlate[1], colSlate[2], 0.95);
      ctx.lines.seg(capX + Math.cos(ca1) * capR, capY, capZ + Math.sin(ca1) * capR, capX, capY - capR * 0.7, capZ, 2.0, colSlate[0], colSlate[1], colSlate[2], 0.95);
    }

    // 4 Articulated Molecular Docking Arms reaching toward DNA
    for (let arm = 0; arm < 4; arm++) {
      const aAng = (arm / 4) * TAU + capRot;
      const armRootX = capX + Math.cos(aAng) * (capR * 0.8);
      const armRootY = capY - capR * 0.5;
      const armRootZ = capZ + Math.sin(aAng) * (capR * 0.8);

      const armTipX = armRootX + Math.cos(aAng) * 0.35;
      const armTipY = armRootY - 0.75;
      const armTipZ = armRootZ + Math.sin(aAng) * 0.35;

      ctx.lines.seg(armRootX, armRootY, armRootZ, armTipX, armTipY, armTipZ, 2.2, colCoral[0], colCoral[1], colCoral[2], 0.98);
      ctx.lines.seg(armTipX - 0.08, armTipY - 0.1, armTipZ, armTipX + 0.08, armTipY - 0.1, armTipZ, 2.0, colCoral[0], colCoral[1], colCoral[2], 0.98);
    }

    // 5. Microfluidic Flow Chamber & Streamlines
    const chamberW = 5.2, chamberH = 5.6, chamberD = 2.8;
    const chw = chamberW * 0.5, chh = chamberH * 0.5, chd = chamberD * 0.5;

    ctx.lines.seg(-chw, -chh, -chd, chw, -chh, -chd, 1.8, colSlate[0], colSlate[1], colSlate[2], 0.65);
    ctx.lines.seg(chw, -chh, -chd, chw, chh, -chd, 1.8, colSlate[0], colSlate[1], colSlate[2], 0.65);
    ctx.lines.seg(chw, chh, -chd, -chw, chh, -chd, 1.8, colSlate[0], colSlate[1], colSlate[2], 0.65);
    ctx.lines.seg(-chw, chh, -chd, -chw, -chh, -chd, 1.8, colSlate[0], colSlate[1], colSlate[2], 0.65);

    ctx.lines.seg(-chw, -chh, chd, chw, -chh, chd, 1.8, colSlate[0], colSlate[1], colSlate[2], 0.65);
    ctx.lines.seg(chw, -chh, chd, chw, chh, chd, 1.8, colSlate[0], colSlate[1], colSlate[2], 0.65);
    ctx.lines.seg(chw, chh, chd, -chw, chh, chd, 1.8, colSlate[0], colSlate[1], colSlate[2], 0.65);
    ctx.lines.seg(-chw, chh, chd, -chw, -chh, chd, 1.8, colSlate[0], colSlate[1], colSlate[2], 0.65);

    for (let fl = 0; fl < 8; fl++) {
      const flX = -chw + 0.6 + fl * 0.58;
      const flZ = 0.0;
      const pulseY = ((t * 2.2 + fl * 0.7) % chamberH) - chh;
      ctx.lines.seg(flX, -chh, flZ, flX, chh, flZ, 1.0, colTeal[0], colTeal[1], colTeal[2], 0.35);
      ctx.lines.seg(flX, pulseY - 0.3, flZ, flX, pulseY + 0.3, flZ, 2.5, colTeal[0], colTeal[1], colTeal[2], 0.85);
    }

    // Pin Callouts
    const midPos = strand1[Math.floor(NUM_BASES / 2)]!;
    const endPos = strand2[NUM_BASES - 1]!;

    const latchNode = ctx.node('aptamer_latch');
    latchNode.pinToWorldVertex(midPos, ctx.threeCam, { screenOffset: [0, -35], minScale: 0.7, maxScale: 1.2 });
    const capsidNode = ctx.node('nanocarrier_capsid');
    capsidNode.pinToWorldVertex([capX, capY, capZ], ctx.threeCam, { screenOffset: [35, -30], minScale: 0.7, maxScale: 1.2 });
    const hollidayNode = ctx.node('holliday_core');
    hollidayNode.pinToWorldVertex(endPos, ctx.threeCam, { screenOffset: [-35, 20], minScale: 0.7, maxScale: 1.2 });

    // Overlay Ducking
    const textDuck = Math.min(
      Math.min(1, Math.max(0, f.p / 0.08)),
      Math.min(1, Math.max(0, (1.0 - f.p) / 0.08))
    );

    // 2D Vector UI on Clean White Card
    ctx.sdf.clear();
    const cardAlpha = Math.min(1, Math.max(0, ease.outExpo(Math.min(1, progress * 4.0)))) * textDuck;
    if (cardAlpha > 0.01) {
      ctx.card('clinical_card', {
        x: W - 530, y: 84, w: 450, h: 185,
        radius: [10, 10, 10, 10],
        fill: [0.98, 0.99, 1.0, 0.95 * cardAlpha],
        stroke: [colTeal[0], colTeal[1], colTeal[2], 0.85 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 20, color: [0.2, 0.25, 0.35, 0.15 * cardAlpha], offset: [0, 6] },
        role: 'hud', opacity: cardAlpha,
      });

      ctx.ring({ cx: W - 130, cy: 175, radius: 36, thickness: 4.5, trim: [0, 1], color: [colLightGrid[0], colLightGrid[1], colLightGrid[2], 0.5 * cardAlpha] });
      const hybRate = 0.2 + foldAmount * 0.8;
      ctx.ring({
        cx: W - 130, cy: 175, radius: 36, thickness: 4.5,
        trim: [0, hybRate],
        color: [colTeal[0], colTeal[1], colTeal[2], 0.95 * cardAlpha],
      });
    }

    if (!latchNode.isOccluded && textDuck > 0.1) {
      const p = latchNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 45, size: 12, thickness: 1.5, color: [colTeal[0], colTeal[1], colTeal[2], 0.95 * textDuck] });
    }
    if (!capsidNode.isOccluded && textDuck > 0.1) {
      const p = capsidNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 35, size: 12, thickness: 1.5, color: [colCoral[0], colCoral[1], colCoral[2], 0.95 * textDuck] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      const title = ctx.text('clin_title', 'CLINICAL NANOTECHNOLOGY', {
        fontSize: 50, fontWeight: 900, color: `rgba(30, 41, 59, ${0.98 * textDuck})`, letterSpacing: 8, role: 'headline',
      });
      const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
      ctx.renderText('clin_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

      ctx.text('clin_sub', 'MACROMOLECULAR DRUG DELIVERY · 64 NUCLEOTIDE RIGID CAGE · BUFFER pH 7.42', {
        fontSize: 14, fontWeight: 700, color: `rgba(13, 148, 136, ${0.95 * textDuck})`, letterSpacing: 3, role: 'callout',
      });
      const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
      ctx.renderText('clin_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

      const deltaGVal = (-12.4 - foldAmount * 35.8).toFixed(1);
      const gRoll = ctx.text('clin_dg', `ΔG = ${deltaGVal} KCAL/MOL`, {
        fontSize: 30, fontWeight: 800, color: `rgba(13, 148, 136, ${0.98 * textDuck})`, role: 'hud',
      });
      gRoll.numericRoll(Math.round(Math.abs(parseFloat(deltaGVal)) * 10), (n) => `FREE ENERGY: -${(n / 10).toFixed(1)} KCAL/MOL`);
      ctx.renderText('clin_dg', c2d, t, W - 500, 140);

      const foldPct = Math.round(foldAmount * 100);
      const foldText = ctx.text('clin_pct', `COMPACTNESS: ${foldPct}% · HYBRIDIZED: ${Math.round(NUM_BASES * (0.2 + foldAmount * 0.8))}/64`, {
        fontSize: 12, fontWeight: 700, color: `rgba(30, 41, 59, ${0.85 * textDuck})`, role: 'hud',
      });
      ctx.renderText('clin_pct', c2d, t, W - 500, 195);

      if (!latchNode.isOccluded) {
        ctx.text('clin_latch_lbl', 'APTAMER DRUG RELEASE LATCH', {
          fontSize: 12, fontWeight: 700, color: `rgba(13, 148, 136, ${0.95 * textDuck})`, letterSpacing: 1, role: 'callout',
        });
        const lp = latchNode.position;
        ctx.renderText('clin_latch_lbl', c2d, t, lp[0] + 16, lp[1] - 32);
      }

      if (!capsidNode.isOccluded) {
        ctx.text('clin_cap_lbl', 'ICOSAHEDRAL NANOCARRIER CAPSID [4 DOCKING ARMS]', {
          fontSize: 12, fontWeight: 700, color: `rgba(244, 63, 94, ${0.95 * textDuck})`, letterSpacing: 1, role: 'callout',
        });
        const cp = capsidNode.position;
        ctx.renderText('clin_cap_lbl', c2d, t, cp[0] + 16, cp[1] - 32);
      }
    }

    // Compositing with Sterile Clinical Off-White Backdrop (#EDF2F7)
    ctx.compositor.clear();
    ctx.compositor.createLayer('clinical_backdrop', {
      render: (target) => {
        renderer.setRenderTarget(target);
        if (typeof (renderer as any).setClearColor === 'function') {
          (renderer as any).setClearColor(0xEDF2F7, 1.0);
        }
        renderer.clear(true, true, true);
      },
      blend: 'normal',
      opacity: 1.0,
    });
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

    return { bloom: 0.15, ca: 0.0 };
  },
});
