// 01: TITANIUM REVEAL — Commercial 3D Product Teaser / Precision Hardware
// Monolithic CNC-machined titanium compute core, dual knurled rotary crowns,
// 24 cooling louvers, 128-core neural silicon die with gold trace buses,
// active holographic laser inspection scanning plane, and CAD dimension telemetry.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

const NUM_FINS = 24;
const CROWN_TICKS = 72;
const CORE_COLS = 16;
const CORE_ROWS = 8;

export default defineScene({
  id: 'titanium_reveal',
  rigMode: 'perspective',
  particleCapacity: 2048,
  lineCapacity: 16384,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(35);
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 2.8, -9.5], target: [0, 0.1, 0.0], roll: -0.04, focalLength: 35 },
      { t: 0.35, pos: [5.2, 1.8, -4.5], target: [0.2, 0.0, 0.5], roll: 0.06, focalLength: 42 },
      { t: 0.7, pos: [-3.8, -1.5, 4.2], target: [0, 0.1, 0.0], roll: -0.05, focalLength: 48 },
      { t: 1.0, pos: [0.0, 1.2, 7.5], target: [0, 0.0, 0.0], roll: 0.0, focalLength: 50 },
    ]);

    // Dispersed ambient microscopic titanium dust (low count, high spread, faint opacity)
    ctx.particles.addEmitter('machining_dust', {
      capacity: 45,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 1.1,
      spread: Math.PI * 0.85,
      lifetime: 5.0,
      gravity: [0, 0.005, 0],
      turbulence: 0.25,
      size: 0.010,
      color: [0.85, 0.90, 0.98, 0.15],
      glow: 0.4,
    });

    ctx.node('chassis_apex', { role: 'callout', size: [160, 36, 0] });
    ctx.node('knurled_crown', { role: 'callout', size: [160, 36, 0] });
    ctx.node('die_core', { role: 'callout', size: [160, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);
    ctx.lines.clear();

    // Studio Palette: Platinum Silver, Cold Ice Blue, Brushed Gold, Graphite Slate
    const colPlatinum: [number, number, number] = [0.92, 0.94, 0.98];
    const colIceBlue: [number, number, number] = [0.22, 0.78, 0.98];
    const colGold: [number, number, number] = [0.96, 0.78, 0.24];
    const colDarkSlate: [number, number, number] = [0.22, 0.25, 0.32];
    const colBrightLaser: [number, number, number] = [0.0, 0.96, 0.85];

    // 1. Studio Precision Drafting Grid Floor
    const gridHalf = 12.0;
    const gridStep = 1.0;
    const floorY = -2.4;
    for (let x = -gridHalf; x <= gridHalf; x += gridStep) {
      const isMajor = Math.abs(x) % 5 === 0;
      const alpha = isMajor ? 0.35 : Math.max(0, 0.18 - Math.abs(x) / 18.0);
      const w = isMajor ? 1.2 : 0.7;
      ctx.lines.seg(x, floorY, -gridHalf, x, floorY, gridHalf, w, colDarkSlate[0], colDarkSlate[1], colDarkSlate[2], alpha);
    }
    for (let z = -gridHalf; z <= gridHalf; z += gridStep) {
      const isMajor = Math.abs(z) % 5 === 0;
      const alpha = isMajor ? 0.35 : Math.max(0, 0.18 - Math.abs(z) / 18.0);
      const w = isMajor ? 1.2 : 0.7;
      ctx.lines.seg(-gridHalf, floorY, z, gridHalf, floorY, z, w, colDarkSlate[0], colDarkSlate[1], colDarkSlate[2], alpha);
    }

    // 2. Central Monolithic Titanium Unibody Chassis
    const cw = 2.6, ch = 3.4, cd = 1.5;
    const hw = cw * 0.5, hh = ch * 0.5, hd = cd * 0.5;
    const bevel = 0.24;

    // Chassis Outer Structural Chamfered Frame
    for (const ySign of [-1, 1]) {
      const cy = ySign * hh;
      ctx.lines.seg(-hw + bevel, cy, -hd, hw - bevel, cy, -hd, 2.8, colPlatinum[0], colPlatinum[1], colPlatinum[2], 0.98);
      ctx.lines.seg(-hw + bevel, cy, hd, hw - bevel, cy, hd, 2.8, colPlatinum[0], colPlatinum[1], colPlatinum[2], 0.98);
      ctx.lines.seg(-hw, cy, -hd + bevel, -hw, cy, hd - bevel, 2.8, colPlatinum[0], colPlatinum[1], colPlatinum[2], 0.98);
      ctx.lines.seg(hw, cy, -hd + bevel, hw, cy, hd - bevel, 2.8, colPlatinum[0], colPlatinum[1], colPlatinum[2], 0.98);

      // 45-degree corner chamfer edges
      ctx.lines.seg(-hw + bevel, cy, -hd, -hw, cy, -hd + bevel, 2.4, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.95);
      ctx.lines.seg(hw - bevel, cy, -hd, hw, cy, -hd + bevel, 2.4, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.95);
      ctx.lines.seg(-hw + bevel, cy, hd, -hw, cy, hd - bevel, 2.4, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.95);
      ctx.lines.seg(hw - bevel, cy, hd, hw, cy, hd - bevel, 2.4, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.95);
    }

    // Vertical structural pillars
    const corners = [
      [-hw, -hd + bevel], [-hw + bevel, -hd],
      [hw - bevel, -hd], [hw, -hd + bevel],
      [-hw, hd - bevel], [-hw + bevel, hd],
      [hw - bevel, hd], [hw, hd - bevel],
    ];
    for (const [cx, cz] of corners) {
      ctx.lines.seg(cx, -hh, cz, cx, hh, cz, 2.5, colPlatinum[0], colPlatinum[1], colPlatinum[2], 0.98);
    }

    // Double-walled inner frame
    const inBevel = bevel * 0.7;
    const ihw = hw - 0.18, ihd = hd - 0.18;
    for (const ySign of [-1, 1]) {
      const cy = ySign * (hh - 0.15);
      ctx.lines.seg(-ihw + inBevel, cy, -ihd, ihw - inBevel, cy, -ihd, 1.4, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.7);
      ctx.lines.seg(-ihw + inBevel, cy, ihd, ihw - inBevel, cy, ihd, 1.4, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.7);
      ctx.lines.seg(-ihw, cy, -ihd + inBevel, -ihw, cy, ihd - inBevel, 1.4, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.7);
      ctx.lines.seg(ihw, cy, -ihd + inBevel, ihw, cy, ihd - inBevel, 1.4, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.7);
    }

    // 3. 24 Precision CNC Cooling Louvers / Heatsink Fin Array
    for (let fIdx = 0; fIdx < NUM_FINS; fIdx++) {
      const u = fIdx / (NUM_FINS - 1);
      const finY = -hh + 0.35 + u * (ch - 0.7);
      const finDeploy = ease.outCubic(Math.min(1, Math.max(0, (progress - 0.08) * 3.2)));
      const finW = hw + 0.32 * finDeploy;
      const finD = hd + 0.20 * finDeploy;

      const isKeyFin = fIdx % 4 === 0;
      const col = isKeyFin ? colIceBlue : colPlatinum;
      const finAlpha = isKeyFin ? 0.90 : 0.45;
      const finWidth = isKeyFin ? 1.8 : 1.1;

      ctx.lines.seg(-finW, finY, -finD, finW, finY, -finD, finWidth, col[0], col[1], col[2], finAlpha);
      ctx.lines.seg(finW, finY, -finD, finW, finY, finD, finWidth, col[0], col[1], col[2], finAlpha);
      ctx.lines.seg(finW, finY, finD, -finW, finY, finD, finWidth, col[0], col[1], col[2], finAlpha);
      ctx.lines.seg(-finW, finY, finD, -finW, finY, -finD, finWidth, col[0], col[1], col[2], finAlpha);

      if (isKeyFin) {
        ctx.lines.seg(-finW * 0.7, finY, 0, finW * 0.7, finY, 0, 1.0, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.55);
      }
    }

    // 4. Dual Knurled Rotary Crowns
    const crown1X = hw + 0.18;
    const crown1Y = 0.4;
    const crown1Z = 0.0;
    const crownRadius = 0.58;
    const crownDepth = 0.35;
    const crownSpin = t * 0.9;

    for (let c = 0; c < CROWN_TICKS; c++) {
      const a = (c / CROWN_TICKS) * TAU + crownSpin;
      const y1 = crown1Y + Math.cos(a) * crownRadius;
      const z1 = crown1Z + Math.sin(a) * crownRadius;
      const isMajor = c % 6 === 0;
      const col = isMajor ? colIceBlue : colPlatinum;
      const w = isMajor ? 1.8 : 0.9;
      const alpha = isMajor ? 0.95 : 0.55;
      ctx.lines.seg(crown1X, y1, z1, crown1X + crownDepth, y1, z1, w, col[0], col[1], col[2], alpha);
    }
    for (let r = 1; r <= 3; r++) {
      const ringR = (r / 3) * crownRadius;
      for (let st = 0; st < 32; st++) {
        const a1 = (st / 32) * TAU;
        const a2 = ((st + 1) / 32) * TAU;
        ctx.lines.seg(
          crown1X + crownDepth, crown1Y + Math.cos(a1) * ringR, crown1Z + Math.sin(a1) * ringR,
          crown1X + crownDepth, crown1Y + Math.cos(a2) * ringR, crown1Z + Math.sin(a2) * ringR,
          1.4, colGold[0], colGold[1], colGold[2], 0.8
        );
      }
    }

    // Crown 2: Top tuning knob
    const crown2X = 0.0, crown2Y = hh + 0.12, crown2Z = 0.0;
    const c2R = 0.42, c2H = 0.28;
    for (let c = 0; c < 36; c++) {
      const a = (c / 36) * TAU - t * 0.6;
      const x1 = crown2X + Math.cos(a) * c2R;
      const z1 = crown2Z + Math.sin(a) * c2R;
      ctx.lines.seg(x1, crown2Y, z1, x1, crown2Y + c2H, z1, 1.4, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.85);
    }
    for (let st = 0; st < 32; st++) {
      const a1 = (st / 32) * TAU, a2 = ((st + 1) / 32) * TAU;
      ctx.lines.seg(
        crown2X + Math.cos(a1) * c2R, crown2Y + c2H, crown2Z + Math.sin(a1) * c2R,
        crown2X + Math.cos(a2) * c2R, crown2Y + c2H, crown2Z + Math.sin(a2) * c2R,
        1.8, colGold[0], colGold[1], colGold[2], 0.95
      );
    }

    // 5. Internal Silicon Die & 128-Core Neural Matrix
    const dieY = 0.0;
    const dieW = 1.4, dieD = 1.4;
    const hdw = dieW * 0.5, hdd = dieD * 0.5;

    ctx.lines.seg(-hdw, dieY, -hdd, hdw, dieY, -hdd, 2.4, colGold[0], colGold[1], colGold[2], 0.98);
    ctx.lines.seg(hdw, dieY, -hdd, hdw, dieY, hdd, 2.4, colGold[0], colGold[1], colGold[2], 0.98);
    ctx.lines.seg(hdw, dieY, hdd, -hdw, dieY, hdd, 2.4, colGold[0], colGold[1], colGold[2], 0.98);
    ctx.lines.seg(-hdw, dieY, hdd, -hdw, dieY, -hdd, 2.4, colGold[0], colGold[1], colGold[2], 0.98);

    const coreStepX = dieW / CORE_COLS;
    const coreStepZ = dieD / CORE_ROWS;
    for (let r = 0; r < CORE_ROWS; r++) {
      for (let c = 0; c < CORE_COLS; c++) {
        const cx = -hdw + (c + 0.5) * coreStepX;
        const cz = -hdd + (r + 0.5) * coreStepZ;
        const pulse = Math.sin(t * 4.0 + c * 0.5 + r * 0.8);
        const isActive = pulse > 0.4;
        const col = isActive ? colIceBlue : colGold;
        const sz = 0.022;

        ctx.lines.seg(cx - sz, dieY + 0.01, cz - sz, cx + sz, dieY + 0.01, cz - sz, 1.2, col[0], col[1], col[2], isActive ? 0.95 : 0.45);
        ctx.lines.seg(cx + sz, dieY + 0.01, cz - sz, cx + sz, dieY + 0.01, cz + sz, 1.2, col[0], col[1], col[2], isActive ? 0.95 : 0.45);
        ctx.lines.seg(cx + sz, dieY + 0.01, cz + sz, cx - sz, dieY + 0.01, cz + sz, 1.2, col[0], col[1], col[2], isActive ? 0.95 : 0.45);
        ctx.lines.seg(cx - sz, dieY + 0.01, cz + sz, cx - sz, dieY + 0.01, cz - sz, 1.2, col[0], col[1], col[2], isActive ? 0.95 : 0.45);
      }
    }

    for (let b = 0; b < 16; b++) {
      const bx = -hdw + (b / 15) * dieW;
      ctx.lines.seg(bx, dieY, -hdd, bx, dieY + 0.32, -hdd - 0.35, 1.6, colGold[0], colGold[1], colGold[2], 0.95);
      ctx.lines.seg(bx, dieY, hdd, bx, dieY + 0.32, hdd + 0.35, 1.6, colGold[0], colGold[1], colGold[2], 0.95);
    }

    // 6. Active Holographic Laser Inspection Scanner Plane
    const scanPhase = (t * 0.7) % 1.0;
    const scanY = -hh + 0.3 + Math.sin(scanPhase * Math.PI) * (ch - 0.6);
    const scanExpand = 1.35;

    ctx.lines.seg(-hw * scanExpand, scanY, -hd * scanExpand, hw * scanExpand, scanY, -hd * scanExpand, 2.2, colBrightLaser[0], colBrightLaser[1], colBrightLaser[2], 0.9);
    ctx.lines.seg(hw * scanExpand, scanY, -hd * scanExpand, hw * scanExpand, scanY, hd * scanExpand, 2.2, colBrightLaser[0], colBrightLaser[1], colBrightLaser[2], 0.9);
    ctx.lines.seg(hw * scanExpand, scanY, hd * scanExpand, -hw * scanExpand, scanY, hd * scanExpand, 2.2, colBrightLaser[0], colBrightLaser[1], colBrightLaser[2], 0.9);
    ctx.lines.seg(-hw * scanExpand, scanY, hd * scanExpand, -hw * scanExpand, scanY, -hd * scanExpand, 2.2, colBrightLaser[0], colBrightLaser[1], colBrightLaser[2], 0.9);

    ctx.lines.seg(-0.35, scanY, 0, 0.35, scanY, 0, 1.8, colBrightLaser[0], colBrightLaser[1], colBrightLaser[2], 0.95);
    ctx.lines.seg(0, scanY, -0.35, 0, scanY, 0.35, 1.8, colBrightLaser[0], colBrightLaser[1], colBrightLaser[2], 0.95);

    // 7. Exploded Corner Torx Fasteners
    const screwCorners = [
      [-hw + bevel * 0.5, hh + 0.35, -hd + bevel * 0.5],
      [hw - bevel * 0.5, hh + 0.35, -hd + bevel * 0.5],
      [-hw + bevel * 0.5, hh + 0.35, hd - bevel * 0.5],
      [hw - bevel * 0.5, hh + 0.35, hd - bevel * 0.5],
    ];
    for (const [scx, scy, scz] of screwCorners) {
      for (let hx = 0; hx < 6; hx++) {
        const ha1 = (hx / 6) * TAU, ha2 = ((hx + 1) / 6) * TAU;
        const hr = 0.09;
        ctx.lines.seg(scx + Math.cos(ha1) * hr, scy, scz + Math.sin(ha1) * hr, scx + Math.cos(ha2) * hr, scy, scz + Math.sin(ha2) * hr, 2.0, colPlatinum[0], colPlatinum[1], colPlatinum[2], 0.98);
      }
      for (let th = 0; th < 5; th++) {
        const ty1 = scy - th * 0.08, ty2 = ty1 - 0.08;
        ctx.lines.seg(scx - 0.05, ty1, scz, scx + 0.05, ty2, scz, 1.2, colPlatinum[0], colPlatinum[1], colPlatinum[2], 0.8);
      }
    }

    // 8. 3D CAD Dimension Leaders
    const dimX = hw + 0.9;
    ctx.lines.seg(dimX, -hh, 0, dimX, hh, 0, 1.4, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.75);
    ctx.lines.seg(hw, -hh, 0, dimX + 0.15, -hh, 0, 1.0, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.5);
    ctx.lines.seg(hw, hh, 0, dimX + 0.15, hh, 0, 1.0, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.5);
    ctx.lines.seg(dimX - 0.06, -hh + 0.12, 0, dimX, -hh, 0, 1.4, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.9);
    ctx.lines.seg(dimX + 0.06, -hh + 0.12, 0, dimX, -hh, 0, 1.4, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.9);
    ctx.lines.seg(dimX - 0.06, hh - 0.12, 0, dimX, hh, 0, 1.4, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.9);
    ctx.lines.seg(dimX + 0.06, hh - 0.12, 0, dimX, hh, 0, 1.4, colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.9);

    // Pin Callouts
    const apexNode = ctx.node('chassis_apex');
    apexNode.pinToWorldVertex([0, hh, hd], ctx.threeCam, { screenOffset: [0, -40], minScale: 0.7, maxScale: 1.2 });
    const crownNode = ctx.node('knurled_crown');
    crownNode.pinToWorldVertex([crown1X + crownDepth, crown1Y, crown1Z], ctx.threeCam, { screenOffset: [40, -20], minScale: 0.7, maxScale: 1.2 });
    const dieNode = ctx.node('die_core');
    dieNode.pinToWorldVertex([0, dieY, 0], ctx.threeCam, { screenOffset: [-40, 30], minScale: 0.7, maxScale: 1.2 });

    // Overlay Ducking
    const textDuck = Math.min(
      Math.min(1, Math.max(0, f.p / 0.08)),
      Math.min(1, Math.max(0, (1.0 - f.p) / 0.08))
    );

    // 2D Vector UI
    ctx.sdf.clear();
    const cardAlpha = Math.min(1, Math.max(0, ease.outExpo(Math.min(1, progress * 4.0)))) * textDuck;
    if (cardAlpha > 0.01) {
      ctx.card('spec_card', {
        x: W - 530, y: 84, w: 450, h: 185,
        radius: [12, 12, 12, 12],
        fill: [0.08, 0.10, 0.14, 0.9 * cardAlpha],
        stroke: [colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.8 * cardAlpha],
        strokeWidth: 1.5,
        shadow: { blur: 24, color: [0, 0, 0, 0.6 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      ctx.ring({ cx: W - 130, cy: 175, radius: 36, thickness: 3.5, trim: [0, 1], color: [0.3, 0.35, 0.45, 0.35 * cardAlpha] });
      ctx.ring({
        cx: W - 130, cy: 175, radius: 36, thickness: 3.5,
        trim: [0, Math.min(1, 0.2 + progress * 0.8)],
        color: [colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.95 * cardAlpha],
        glow: 1.3,
      });
    }

    if (!apexNode.isOccluded && textDuck > 0.1) {
      const p = apexNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 45, size: 12, thickness: 1.5, color: [colIceBlue[0], colIceBlue[1], colIceBlue[2], 0.95 * textDuck] });
    }
    if (!crownNode.isOccluded && textDuck > 0.1) {
      const p = crownNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 35, size: 12, thickness: 1.5, color: [colGold[0], colGold[1], colGold[2], 0.95 * textDuck] });
    }
    if (!dieNode.isOccluded && textDuck > 0.1) {
      const p = dieNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] - 30, size: 10, thickness: 1.5, color: [colBrightLaser[0], colBrightLaser[1], colBrightLaser[2], 0.95 * textDuck] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      const title = ctx.text('titan_title', 'TITANIUM CORE X-1', {
        fontSize: 52, fontWeight: 900, color: `rgba(240, 245, 255, ${0.98 * textDuck})`, letterSpacing: 8, role: 'headline',
      }).withKnockoutHalo(4, `rgba(16, 18, 22, ${0.95 * textDuck})`);
      const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
      ctx.renderText('titan_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

      ctx.text('titan_sub', 'GRADE 5 Ti-6Al-4V UNIBODY · 128-CORE SILICON DIE · 24-FIN PASSIVE DISSIPATION', {
        fontSize: 14, fontWeight: 600, color: `rgba(56, 189, 248, ${0.92 * textDuck})`, letterSpacing: 3, role: 'callout',
      }).withKnockoutHalo(2, `rgba(16, 18, 22, ${0.9 * textDuck})`);
      const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
      ctx.renderText('titan_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

      const tolRoll = ctx.text('titan_tol', '0.005 MM', {
        fontSize: 32, fontWeight: 700, color: `rgba(56, 189, 248, ${0.95 * textDuck})`, role: 'hud',
      });
      tolRoll.numericRoll(5, (n) => `TOLERANCE: ±0.00${n} MM`);
      ctx.renderText('titan_tol', c2d, t, W - 500, 140);

      const finText = ctx.text('titan_fins', '24 LOUVERS · PASSIVE DISSIPATION: 125W · Ra 0.2µm', {
        fontSize: 12, fontWeight: 600, color: `rgba(224, 230, 240, ${0.85 * textDuck})`, role: 'hud',
      });
      ctx.renderText('titan_fins', c2d, t, W - 500, 195);

      if (!apexNode.isOccluded) {
        ctx.text('titan_apex_lbl', 'UNIBODY CHASSIS · 45° CNC CHAMFER', {
          fontSize: 12, fontWeight: 600, color: `rgba(56, 189, 248, ${0.9 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(16, 18, 22, ${0.9 * textDuck})`);
        const ap = apexNode.position;
        ctx.renderText('titan_apex_lbl', c2d, t, ap[0] + 16, ap[1] - 32);
      }

      if (!crownNode.isOccluded) {
        ctx.text('titan_crown_lbl', '72-STEP ROTARY KNURLED CROWN', {
          fontSize: 12, fontWeight: 600, color: `rgba(245, 158, 11, ${0.9 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(16, 18, 22, ${0.9 * textDuck})`);
        const cp = crownNode.position;
        ctx.renderText('titan_crown_lbl', c2d, t, cp[0] + 16, cp[1] - 32);
      }

      if (!dieNode.isOccluded) {
        ctx.text('titan_die_lbl', '128-CORE NEURAL ENGINE · GOLD WIRE BUS', {
          fontSize: 12, fontWeight: 600, color: `rgba(0, 245, 212, ${0.9 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(16, 18, 22, ${0.9 * textDuck})`);
        const dp = dieNode.position;
        ctx.renderText('titan_die_lbl', c2d, t, dp[0] + 16, dp[1] + 28);
      }
    }

    // Compositing with Dark Studio Background Layer
    ctx.compositor.clear();
    ctx.compositor.createLayer('studio_backdrop', {
      render: (target) => {
        renderer.setRenderTarget(target);
        if (typeof (renderer as any).setClearColor === 'function') {
          (renderer as any).setClearColor(0x101216, 1.0);
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

    const sweep = Math.sin(t * 1.5) * 0.12;
    return { bloom: 0.40 + sweep, ca: 0.6 };
  },
});
