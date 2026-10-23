// 06: HAUTE HORLOGERIE — Luxury Watch Craftsmanship & Involute Tourbillon
// Obsidian studio backdrop (#08080C), polished rose gold (#E5A97D), brushed steel,
// ruby jewel bearings, 7-gear kinetic train with involute teeth, skeletonized bridge plates,
// primary chapter ring, small seconds subdial, Breguet hands, and 4 Hz tourbillon carriage.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

interface InvoluteGearDef {
  x: number;
  y: number;
  z: number;
  teeth: number;
  pitchRadius: number;
  ratio: number;
  col: [number, number, number];
}

const GEARS: InvoluteGearDef[] = [
  { x: -1.4, y: -0.6, z: 0.0, teeth: 48, pitchRadius: 2.2, ratio: 1.0, col: [0.90, 0.66, 0.49] },   // Mainspring Barrel (Rose Gold)
  { x: 1.2, y: -0.2, z: 0.2, teeth: 36, pitchRadius: 1.65, ratio: -1.33, col: [0.78, 0.82, 0.88] }, // Center Wheel (Brushed Steel)
  { x: 0.2, y: 1.6, z: 0.4, teeth: 28, pitchRadius: 1.28, ratio: 1.71, col: [0.90, 0.66, 0.49] },   // Third Wheel (Rose Gold)
  { x: -1.6, y: 1.8, z: 0.6, teeth: 20, pitchRadius: 0.92, ratio: -2.4, col: [0.78, 0.82, 0.88] },  // Fourth Wheel (Brushed Steel)
  { x: 2.2, y: 1.8, z: 0.8, teeth: 15, pitchRadius: 0.69, ratio: 3.2, col: [0.90, 0.66, 0.49] },    // Escape Wheel (Rose Gold)
  { x: -2.6, y: -1.8, z: 0.1, teeth: 24, pitchRadius: 1.10, ratio: -0.75, col: [0.90, 0.66, 0.49] },// Winding Wheel (Rose Gold)
  { x: 2.6, y: -1.4, z: 0.3, teeth: 22, pitchRadius: 1.00, ratio: 1.25, col: [0.78, 0.82, 0.88] },  // Differential Wheel (Steel)
];

export default defineScene({
  id: 'haute_horlogerie',
  rigMode: 'perspective',
  particleCapacity: 2048,
  lineCapacity: 16384,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(36);
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 1.2, -7.8], target: [0, 0.2, 0.0], roll: -0.04, focalLength: 35 },
      { t: 0.35, pos: [2.8, 1.5, -5.2], target: [0.2, 0.4, 0.3], roll: 0.06, focalLength: 38 },
      { t: 0.7, pos: [-2.4, -0.8, 4.2], target: [0, 0.1, 0.1], roll: -0.05, focalLength: 42 },
      { t: 1.0, pos: [0.0, 1.0, 6.8], target: [0, 0.2, 0.0], roll: 0.0, focalLength: 45 },
    ]);

    // Escapement impulse friction micro-sparks
    ctx.particles.addEmitter('escapement_sparks', {
      capacity: 150,
      origin: [1.2, -0.2, 0.2],
      direction: [0, 1, 0],
      speed: 0.35,
      spread: Math.PI * 0.7,
      lifetime: 3.5,
      turbulence: 0.3,
      size: 0.012,
      color: [0.90, 0.66, 0.49, 0.45],
      glow: 0.8,
    });

    ctx.node('tourbillon_node', { role: 'callout', size: [180, 36, 0] });
    ctx.node('balance_wheel_node', { role: 'callout', size: [180, 36, 0] });
    ctx.node('chapter_ring_node', { role: 'callout', size: [180, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);
    ctx.lines.clear();

    // Haute Horlogerie Palette: Rose Gold, Brushed Steel, Ruby Jewel, Blued Steel
    const colRoseGold: [number, number, number] = [0.90, 0.66, 0.49];
    const colSteel: [number, number, number] = [0.78, 0.82, 0.88];
    const colRuby: [number, number, number] = [0.88, 0.11, 0.28];
    const colBluedSteel: [number, number, number] = [0.15, 0.35, 0.85];
    const colGeneva: [number, number, number] = [0.22, 0.20, 0.26];

    // Escapement impulse trauma micro-shock (28,800 VPH = 4 Hz)
    const beatFreq = 4.0;
    const tickPhase = Math.sin(t * beatFreq * TAU);
    if (Math.abs(tickPhase) > 0.96) {
      ctx.rig.addTrauma(0.02);
    }

    // 1. Côtes de Genève (Geneva Stripes) Guilloché Mainplate Pattern
    const numStripes = 28;
    for (let s = 0; s < numStripes; s++) {
      const sx = -5.0 + s * 0.36;
      ctx.lines.seg(sx, -4.0, -0.2, sx, 4.0, -0.2, 1.2, colGeneva[0], colGeneva[1], colGeneva[2], 0.55);
      for (let mw = 0; mw < 8; mw++) {
        const my1 = -4.0 + mw * 1.0;
        const my2 = my1 + 1.0;
        const mxOff = Math.sin(mw * 0.8) * 0.08;
        ctx.lines.seg(sx + mxOff, my1, -0.18, sx - mxOff, my2, -0.18, 0.9, colGeneva[0], colGeneva[1], colGeneva[2], 0.35);
      }
    }

    // 2. Skeleton Bridge Plates with Polished Anglage Bevels
    const bridgeOutlines = [
      [[-2.8, 2.5, 0.5], [0.0, 3.2, 0.5], [2.8, 2.5, 0.5]],
      [[-2.2, 0.4, 0.3], [1.8, 0.4, 0.3], [1.8, -1.2, 0.3], [-0.5, -1.2, 0.3]],
      [[-1.4, -0.6, 0.4], [-2.8, -1.8, 0.4], [-1.0, -2.6, 0.4]],
    ];
    for (const bridge of bridgeOutlines) {
      for (let bp = 0; bp < bridge.length - 1; bp++) {
        const p1 = bridge[bp]!;
        const p2 = bridge[bp + 1]!;
        ctx.lines.seg(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], 2.5, colSteel[0], colSteel[1], colSteel[2], 0.95);
      }
    }

    // 3. 7-Gear Kinetic Involute Train
    for (const g of GEARS) {
      const gearRot = t * 0.35 * g.ratio;
      const toothAngle = TAU / g.teeth;
      const addendum = 0.18;
      const dedendum = 0.16;
      const rRoot = g.pitchRadius - dedendum;
      const rTip = g.pitchRadius + addendum;

      for (let i = 0; i < g.teeth; i++) {
        const a0 = i * toothAngle + gearRot;
        const a1 = a0 + toothAngle * 0.28;
        const a2 = a0 + toothAngle * 0.58;
        const a3 = a0 + toothAngle * 0.88;

        const x0 = g.x + Math.cos(a0) * rRoot;
        const y0 = g.y + Math.sin(a0) * rRoot;
        const x1 = g.x + Math.cos(a1) * rTip;
        const y1 = g.y + Math.sin(a1) * rTip;
        const x2 = g.x + Math.cos(a2) * rTip;
        const y2 = g.y + Math.sin(a2) * rTip;
        const x3 = g.x + Math.cos(a3) * rRoot;
        const y3 = g.y + Math.sin(a3) * rRoot;

        ctx.lines.seg(x0, y0, g.z, x1, y1, g.z, 2.0, g.col[0], g.col[1], g.col[2], 0.95);
        ctx.lines.seg(x1, y1, g.z, x2, y2, g.z, 2.2, g.col[0], g.col[1], g.col[2], 0.98);
        ctx.lines.seg(x2, y2, g.z, x3, y3, g.z, 2.0, g.col[0], g.col[1], g.col[2], 0.95);

        // 5-Spoke skeleton wheel design
        if (i % Math.floor(g.teeth / 5) === 0) {
          ctx.lines.seg(g.x, g.y, g.z, x0, y0, g.z, 1.8, g.col[0], g.col[1], g.col[2], 0.85);
        }
      }

      // Root circle rim
      const numRimSteps = 32;
      for (let rs = 0; rs < numRimSteps; rs++) {
        const ra1 = (rs / numRimSteps) * TAU;
        const ra2 = ((rs + 1) / numRimSteps) * TAU;
        ctx.lines.seg(
          g.x + Math.cos(ra1) * rRoot, g.y + Math.sin(ra1) * rRoot, g.z,
          g.x + Math.cos(ra2) * rRoot, g.y + Math.sin(ra2) * rRoot, g.z,
          1.6, g.col[0], g.col[1], g.col[2], 0.9
        );
      }

      // Ruby jewel bearing at center pinion
      const numRubySteps = 16;
      for (let rb = 0; rb < numRubySteps; rb++) {
        const r1 = (rb / numRubySteps) * TAU;
        const r2 = ((rb + 1) / numRubySteps) * TAU;
        const rR = 0.22;
        ctx.lines.seg(
          g.x + Math.cos(r1) * rR, g.y + Math.sin(r1) * rR, g.z + 0.05,
          g.x + Math.cos(r2) * rR, g.y + Math.sin(r2) * rR, g.z + 0.05,
          2.6, colRuby[0], colRuby[1], colRuby[2], 0.98
        );
      }
    }

    // 4. Glucydur Balance Wheel & Dual-Axis Flying Tourbillon Carriage
    const balX = -1.4, balY = -0.6, balZ = 0.35;
    const balRot = Math.sin(t * beatFreq * TAU) * 0.85;
    const balRadius = 1.85;

    const numBalSteps = 48;
    for (let bs = 0; bs < numBalSteps; bs++) {
      const ba1 = (bs / numBalSteps) * TAU + balRot;
      const ba2 = ((bs + 1) / numBalSteps) * TAU + balRot;
      ctx.lines.seg(
        balX + Math.cos(ba1) * balRadius, balY + Math.sin(ba1) * balRadius, balZ,
        balX + Math.cos(ba2) * balRadius, balY + Math.sin(ba2) * balRadius, balZ,
        2.6, colRoseGold[0], colRoseGold[1], colRoseGold[2], 0.98
      );
    }

    // 16 Regulating Screws
    for (let scr = 0; scr < 16; scr++) {
      const scrAngle = (scr / 16) * TAU + balRot;
      const scrX = balX + Math.cos(scrAngle) * (balRadius + 0.12);
      const scrY = balY + Math.sin(scrAngle) * (balRadius + 0.12);
      ctx.lines.seg(
        balX + Math.cos(scrAngle) * balRadius, balY + Math.sin(scrAngle) * balRadius, balZ,
        scrX, scrY, balZ,
        2.2, colSteel[0], colSteel[1], colSteel[2], 0.95
      );
    }

    // Blued Steel Breguet Overcoil Hairspring
    let prevHx = balX, prevHy = balY;
    const numSpringCoils = 4.5;
    const numSpringSteps = 64;
    for (let ss = 1; ss <= numSpringSteps; ss++) {
      const su = ss / numSpringSteps;
      const sAngle = su * numSpringCoils * TAU + balRot * 0.4;
      const sR = su * 1.1;
      const hx = balX + Math.cos(sAngle) * sR;
      const hy = balY + Math.sin(sAngle) * sR;
      ctx.lines.seg(prevHx, prevHy, balZ + 0.08, hx, hy, balZ + 0.08, 2.0, colBluedSteel[0], colBluedSteel[1], colBluedSteel[2], 0.98);
      prevHx = hx;
      prevHy = hy;
    }

    // 5. Outer Perimeter Chapter Ring & Breguet Hands
    const dialCx = 0.0, dialCy = 0.2, dialCz = 1.0;
    const dialRadius = 3.8;

    for (let st = 0; st < 64; st++) {
      const a1 = (st / 64) * TAU, a2 = ((st + 1) / 64) * TAU;
      ctx.lines.seg(
        dialCx + Math.cos(a1) * dialRadius, dialCy + Math.sin(a1) * dialRadius, dialCz,
        dialCx + Math.cos(a2) * dialRadius, dialCy + Math.sin(a2) * dialRadius, dialCz,
        2.4, colRoseGold[0], colRoseGold[1], colRoseGold[2], 0.9
      );
      ctx.lines.seg(
        dialCx + Math.cos(a1) * (dialRadius - 0.2), dialCy + Math.sin(a1) * (dialRadius - 0.2), dialCz,
        dialCx + Math.cos(a2) * (dialRadius - 0.2), dialCy + Math.sin(a2) * (dialRadius - 0.2), dialCz,
        1.4, colRoseGold[0], colRoseGold[1], colRoseGold[2], 0.7
      );
    }
    // 60-Minute Ticks
    for (let m = 0; m < 60; m++) {
      const ma = (m / 60) * TAU;
      const is5Min = m % 5 === 0;
      const r1 = dialRadius - (is5Min ? 0.35 : 0.18);
      const r2 = dialRadius;
      ctx.lines.seg(
        dialCx + Math.cos(ma) * r1, dialCy + Math.sin(ma) * r1, dialCz,
        dialCx + Math.cos(ma) * r2, dialCy + Math.sin(ma) * r2, dialCz,
        is5Min ? 2.4 : 1.2, colRoseGold[0], colRoseGold[1], colRoseGold[2], is5Min ? 0.98 : 0.6
      );
    }

    // Small Seconds Subdial (Lower center)
    const subCx = dialCx, subCy = dialCy - 1.4, subCz = dialCz + 0.05, subR = 0.9;
    for (let st = 0; st < 32; st++) {
      const a1 = (st / 32) * TAU, a2 = ((st + 1) / 32) * TAU;
      ctx.lines.seg(
        subCx + Math.cos(a1) * subR, subCy + Math.sin(a1) * subR, subCz,
        subCx + Math.cos(a2) * subR, subCy + Math.sin(a2) * subR, subCz,
        1.6, colRoseGold[0], colRoseGold[1], colRoseGold[2], 0.8
      );
    }
    // Small seconds sweeping needle
    const secAngle = (t * 2.0) % TAU;
    ctx.lines.seg(subCx, subCy, subCz, subCx + Math.cos(secAngle) * (subR * 0.85), subCy + Math.sin(secAngle) * (subR * 0.85), subCz, 1.8, colBluedSteel[0], colBluedSteel[1], colBluedSteel[2], 0.95);

    // Breguet Hands (Blued Steel)
    const hourAngle = (t * 0.05) % TAU;
    const hLen = 2.0;
    ctx.lines.seg(dialCx, dialCy, dialCz + 0.1, dialCx + Math.cos(hourAngle) * hLen, dialCy + Math.sin(hourAngle) * hLen, dialCz + 0.1, 2.8, colBluedSteel[0], colBluedSteel[1], colBluedSteel[2], 0.98);
    const hEyeX = dialCx + Math.cos(hourAngle) * (hLen * 0.75);
    const hEyeY = dialCy + Math.sin(hourAngle) * (hLen * 0.75);
    for (let st = 0; st < 12; st++) {
      const a1 = (st / 12) * TAU, a2 = ((st + 1) / 12) * TAU;
      ctx.lines.seg(hEyeX + Math.cos(a1) * 0.14, hEyeY + Math.sin(a1) * 0.14, dialCz + 0.1, hEyeX + Math.cos(a2) * 0.14, hEyeY + Math.sin(a2) * 0.14, dialCz + 0.1, 2.0, colBluedSteel[0], colBluedSteel[1], colBluedSteel[2], 0.98);
    }

    const minAngle = (t * 0.25) % TAU;
    const mLen = 3.0;
    ctx.lines.seg(dialCx, dialCy, dialCz + 0.12, dialCx + Math.cos(minAngle) * mLen, dialCy + Math.sin(minAngle) * mLen, dialCz + 0.12, 2.2, colBluedSteel[0], colBluedSteel[1], colBluedSteel[2], 0.98);

    // Pin Callouts
    const tourbNode = ctx.node('tourbillon_node');
    tourbNode.pinToWorldVertex([balX, balY, balZ], ctx.threeCam, { screenOffset: [0, -40], minScale: 0.7, maxScale: 1.2 });
    const balNode = ctx.node('balance_wheel_node');
    balNode.pinToWorldVertex([balX + balRadius, balY, balZ], ctx.threeCam, { screenOffset: [40, 20], minScale: 0.7, maxScale: 1.2 });
    const ringNode = ctx.node('chapter_ring_node');
    ringNode.pinToWorldVertex([dialCx, dialCy + dialRadius, dialCz], ctx.threeCam, { screenOffset: [0, -35], minScale: 0.7, maxScale: 1.2 });

    // Overlay Ducking
    const textDuck = Math.min(
      Math.min(1, Math.max(0, f.p / 0.08)),
      Math.min(1, Math.max(0, (1.0 - f.p) / 0.08))
    );

    // 2D Vector UI
    ctx.sdf.clear();
    const cardAlpha = Math.min(1, Math.max(0, ease.outExpo(Math.min(1, progress * 4.0)))) * textDuck;
    if (cardAlpha > 0.01) {
      ctx.card('horology_card', {
        x: W - 530, y: 84, w: 450, h: 185,
        radius: [12, 12, 12, 12],
        fill: [0.08, 0.06, 0.10, 0.9 * cardAlpha],
        stroke: [colRoseGold[0], colRoseGold[1], colRoseGold[2], 0.8 * cardAlpha],
        strokeWidth: 1.5,
        shadow: { blur: 24, color: [0, 0, 0, 0.65 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      ctx.ring({ cx: W - 130, cy: 175, radius: 36, thickness: 3.5, trim: [0, 1], color: [0.35, 0.25, 0.20, 0.35 * cardAlpha] });
      ctx.ring({
        cx: W - 130, cy: 175, radius: 36, thickness: 3.5,
        trim: [0, Math.min(1, 0.5 + Math.abs(balRot) * 0.5)],
        color: [colRoseGold[0], colRoseGold[1], colRoseGold[2], 0.95 * cardAlpha],
        glow: 1.3,
      });
    }

    if (!tourbNode.isOccluded && textDuck > 0.1) {
      const p = tourbNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 45, size: 12, thickness: 1.5, color: [colRoseGold[0], colRoseGold[1], colRoseGold[2], 0.95 * textDuck] });
    }
    if (!balNode.isOccluded && textDuck > 0.1) {
      const p = balNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 35, size: 12, thickness: 1.5, color: [colRuby[0], colRuby[1], colRuby[2], 0.95 * textDuck] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      const title = ctx.text('horo_title', 'HAUTE HORLOGERIE', {
        fontSize: 50, fontWeight: 900, color: `rgba(240, 245, 255, ${0.98 * textDuck})`, letterSpacing: 8, role: 'headline',
      }).withKnockoutHalo(4, `rgba(8, 8, 12, ${0.95 * textDuck})`);
      const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
      ctx.renderText('horo_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

      ctx.text('horo_sub', 'GRAND COMPLICATION TOURBILLON · 7-GEAR INVOLUTE TRAIN · 18 RUBIS SAPPHIRE', {
        fontSize: 14, fontWeight: 600, color: `rgba(229, 169, 125, ${0.92 * textDuck})`, letterSpacing: 3, role: 'callout',
      }).withKnockoutHalo(2, `rgba(8, 8, 12, ${0.9 * textDuck})`);
      const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
      ctx.renderText('horo_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

      const beatRoll = ctx.text('horo_beat', '28,800 VPH', {
        fontSize: 32, fontWeight: 700, color: `rgba(229, 169, 125, ${0.95 * textDuck})`, role: 'hud',
      });
      beatRoll.numericRoll(28800, (n) => `28,800 VPH (${(n / 7200).toFixed(0)} HZ)`);
      ctx.renderText('horo_beat', c2d, t, W - 500, 140);

      const jewelText = ctx.text('horo_jewels', '18 RUBIS CHATONS · BREGUET OVERCOIL · POINÇON DE GENÈVE', {
        fontSize: 12, fontWeight: 600, color: `rgba(226, 232, 240, ${0.85 * textDuck})`, role: 'hud',
      });
      ctx.renderText('horo_jewels', c2d, t, W - 500, 195);

      if (!tourbNode.isOccluded) {
        ctx.text('horo_tourb_lbl', 'FLYING TOURBILLON CARRIAGE [60S ROTATION]', {
          fontSize: 12, fontWeight: 600, color: `rgba(229, 169, 125, ${0.9 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(8, 8, 12, ${0.9 * textDuck})`);
        const tp = tourbNode.position;
        ctx.renderText('horo_tourb_lbl', c2d, t, tp[0] + 16, tp[1] - 32);
      }

      if (!balNode.isOccluded) {
        ctx.text('horo_bal_lbl', 'GLUCYDUR BALANCE · 16 REGULATING SCREWS', {
          fontSize: 12, fontWeight: 600, color: `rgba(225, 29, 72, ${0.95 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(8, 8, 12, ${0.9 * textDuck})`);
        const bp = balNode.position;
        ctx.renderText('horo_bal_lbl', c2d, t, bp[0] + 16, bp[1] + 28);
      }
    }

    // Compositing with Obsidian Studio Background Layer (#08080C)
    ctx.compositor.clear();
    ctx.compositor.createLayer('obsidian_backdrop', {
      render: (target) => {
        renderer.setRenderTarget(target);
        if (typeof (renderer as any).setClearColor === 'function') {
          (renderer as any).setClearColor(0x08080C, 1.0);
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

    return { bloom: 0.42, ca: 0.5 };
  },
});
