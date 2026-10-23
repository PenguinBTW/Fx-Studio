// 03: ABYSSAL BIOLUMINESCENCE — Organic Deep-Sea Micro-World
// Deep midnight oceanic navy (#020617), electric cyan (#00F5D4), violet (#9D4EDD),
// undulating 48-rib jellyfish bell dome, 4 spiral oral arms, 24 harmonic trailing tentacles
// with traveling bioluminescent action potentials, and bathypelagic research submarine telemetry.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

const NUM_RIBS = 48;
const NUM_TENTACLES = 24;
const TENTACLE_SEGMENTS = 32;

export default defineScene({
  id: 'abyssal_bioluminescence',
  rigMode: 'perspective',
  particleCapacity: 2048,
  lineCapacity: 16384,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(28);
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, -1.2, -10.5], target: [0, 0.5, 0.0], roll: -0.05, focalLength: 28 },
      { t: 0.35, pos: [4.8, 1.2, -5.5], target: [0.2, 0.2, 0.0], roll: 0.06, focalLength: 32 },
      { t: 0.7, pos: [-3.5, -2.8, 5.2], target: [0, 0.0, 0.0], roll: -0.04, focalLength: 38 },
      { t: 1.0, pos: [0.0, 0.8, 8.5], target: [0, 0.2, 0.0], roll: 0.02, focalLength: 42 },
    ]);

    // Dispersed ambient marine snow motes (low count, wide spread, faint glow)
    ctx.particles.addEmitter('phytoplankton', {
      capacity: 65,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 1.2,
      spread: Math.PI * 0.9,
      lifetime: 5.5,
      gravity: [0, 0.005, 0],
      turbulence: 0.3,
      size: 0.012,
      color: [0.0, 0.96, 0.83, 0.20],
      glow: 0.5,
    });

    ctx.node('bell_apex', { role: 'callout', size: [160, 36, 0] });
    ctx.node('tentacle_rhizome', { role: 'callout', size: [160, 36, 0] });
    ctx.node('oral_arms', { role: 'callout', size: [160, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);
    ctx.lines.clear();

    // Ocean Palette: Electric Cyan, Bioluminescent Violet, Lime Spore, Navy
    const colCyan: [number, number, number] = [0.0, 0.96, 0.83];
    const colViolet: [number, number, number] = [0.62, 0.28, 0.98];
    const colLime: [number, number, number] = [0.64, 0.90, 0.21];
    const colDeepNavy: [number, number, number] = [0.12, 0.25, 0.45];

    // Rhythmic jellyfish swimming pulse (contraction & gliding expansion)
    const swimCycle = t * 1.8;
    const pulseRaw = Math.sin(swimCycle);
    const pulsePower = Math.pow(Math.max(0, pulseRaw), 3.0);
    const bellRadius = 2.4 * (1.0 + pulsePower * 0.35);
    const bellHeight = 2.2 * (1.0 - pulsePower * 0.25);
    const bellCenterY = 0.8 + Math.sin(swimCycle * 0.5) * 0.4;

    // 1. Ambient Volumetric Water Caustics / Depth Rays
    for (let ray = 0; ray < 8; ray++) {
      const rayAngle = (ray / 8) * TAU + t * 0.05;
      const rayX1 = Math.cos(rayAngle) * 5.0;
      const rayZ1 = Math.sin(rayAngle) * 5.0;
      const rayX2 = Math.cos(rayAngle + 0.3) * 7.5;
      const rayZ2 = Math.sin(rayAngle + 0.3) * 7.5;
      ctx.lines.seg(rayX1, 6.0, rayZ1, rayX2, -6.0, rayZ2, 0.8, colDeepNavy[0], colDeepNavy[1], colDeepNavy[2], 0.25);
    }

    // 2. Undulating Bell Dome (48 Meridian Ribs with Travelling Action Potential)
    for (let r = 0; r < NUM_RIBS; r++) {
      const angle = (r / NUM_RIBS) * TAU;
      const ribSteps = 24;
      let prevX = 0, prevY = 0, prevZ = 0;

      for (let st = 0; st <= ribSteps; st++) {
        const u = st / ribSteps;
        const localR = Math.sin(u * Math.PI * 0.5) * bellRadius;
        const localY = bellCenterY + (1.0 - u * u) * bellHeight;
        const edgeWiggle = (u > 0.75) ? Math.sin(swimCycle * 2.0 + r * 0.5) * 0.14 : 0.0;

        const x = Math.cos(angle) * (localR + edgeWiggle);
        const y = localY;
        const z = Math.sin(angle) * (localR + edgeWiggle);

        if (st > 0) {
          const isMajor = r % 4 === 0;
          const col = isMajor ? colCyan : colViolet;
          const width = isMajor ? 2.2 : 1.2;
          const travelingGlow = Math.exp(-Math.pow(((u - (t * 0.8) % 1.0) * 8.0), 2)) * 0.45;
          const alpha = 0.45 + (1.0 - u) * 0.45 + travelingGlow;

          ctx.lines.seg(prevX, prevY, prevZ, x, y, z, width, col[0], col[1], col[2], Math.min(1, alpha));
        }

        prevX = x;
        prevY = y;
        prevZ = z;
      }
    }

    // 3. Concentric Margin Rings at Bell Rim with 16 Sensory Rhopalia Nodes
    const numRings = 5;
    for (let rg = 0; rg < numRings; rg++) {
      const ringY = bellCenterY + rg * 0.12;
      const ringR = bellRadius * (1.0 - rg * 0.06);
      const steps = 48;
      for (let s = 0; s < steps; s++) {
        const a1 = (s / steps) * TAU;
        const a2 = ((s + 1) / steps) * TAU;
        const x1 = Math.cos(a1) * ringR, z1 = Math.sin(a1) * ringR;
        const x2 = Math.cos(a2) * ringR, z2 = Math.sin(a2) * ringR;
        ctx.lines.seg(x1, ringY, z1, x2, ringY, z2, 2.0, colCyan[0], colCyan[1], colCyan[2], 0.9);
      }
    }

    // 16 Sensory Rhopalia
    for (let rh = 0; rh < 16; rh++) {
      const rAng = (rh / 16) * TAU;
      const rx = Math.cos(rAng) * bellRadius;
      const ry = bellCenterY;
      const rz = Math.sin(rAng) * bellRadius;
      const rSz = 0.08;
      ctx.lines.seg(rx - rSz, ry, rz, rx + rSz, ry, rz, 2.4, colLime[0], colLime[1], colLime[2], 0.95);
      ctx.lines.seg(rx, ry - rSz, rz, rx, ry + rSz, rz, 2.4, colLime[0], colLime[1], colLime[2], 0.95);
    }

    // 4. Luminous Inner Oral Arms (4 Spiral Rhizostome Arms)
    for (let arm = 0; arm < 4; arm++) {
      const armBaseAngle = (arm / 4) * TAU;
      let prevAx = 0, prevAy = bellCenterY + 0.4, prevAz = 0;
      const armSteps = 24;
      for (let s = 1; s <= armSteps; s++) {
        const u = s / armSteps;
        const armY = bellCenterY + 0.4 - u * 3.8;
        const armSpiral = armBaseAngle + u * 4.5 + t * 0.8;
        const armR = 0.35 + Math.sin(u * Math.PI) * 0.6;
        const ax = Math.cos(armSpiral) * armR;
        const az = Math.sin(armSpiral) * armR;

        ctx.lines.seg(prevAx, prevAy, prevAz, ax, armY, az, 2.4, colCyan[0], colCyan[1], colCyan[2], 0.95);
        if (s % 3 === 0) {
          const fx = ax + Math.sin(armSpiral * 2) * 0.25;
          const fz = az + Math.cos(armSpiral * 2) * 0.25;
          ctx.lines.seg(ax, armY, az, fx, armY - 0.15, fz, 1.6, colViolet[0], colViolet[1], colViolet[2], 0.8);
        }

        prevAx = ax;
        prevAy = armY;
        prevAz = az;
      }
    }

    // 5. 24 Trailing Bioluminescent Tentacles (Cascading Harmonic Waves)
    for (let tc = 0; tc < NUM_TENTACLES; tc++) {
      const baseAngle = (tc / NUM_TENTACLES) * TAU;
      const rootR = bellRadius * 0.88;
      const rootX = Math.cos(baseAngle) * rootR;
      const rootZ = Math.sin(baseAngle) * rootR;
      const rootY = bellCenterY;

      let prevX = rootX, prevY = rootY, prevZ = rootZ;

      for (let seg = 1; seg <= TENTACLE_SEGMENTS; seg++) {
        const u = seg / TENTACLE_SEGMENTS;
        const lengthY = -u * 6.2;
        const wavePhase = u * 7.0 - swimCycle * 2.4 + tc * 0.6;
        const waveAmp = 0.42 * u;
        const tx = rootX + Math.sin(wavePhase) * waveAmp;
        const ty = rootY + lengthY;
        const tz = rootZ + Math.cos(wavePhase) * waveAmp;

        const isLead = tc % 3 === 0;
        const col = isLead ? colCyan : colViolet;
        const w = isLead ? 2.0 : 1.2;

        const actionWave = Math.exp(-Math.pow(((u * 4.0 - (t * 2.0 + tc * 0.3) % 4.0)), 2)) * 0.65;
        const alpha = Math.min(1, (1.0 - u * 0.6) * 0.85 + actionWave);

        ctx.lines.seg(prevX, prevY, prevZ, tx, ty, tz, w + (actionWave > 0.2 ? 1.0 : 0), col[0], col[1], col[2], alpha);

        prevX = tx;
        prevY = ty;
        prevZ = tz;
      }
    }

    // Pin Callouts
    const apexNode = ctx.node('bell_apex');
    apexNode.pinToWorldVertex([0, bellCenterY + bellHeight, 0], ctx.threeCam, { screenOffset: [0, -40], minScale: 0.7, maxScale: 1.2 });
    const tentNode = ctx.node('tentacle_rhizome');
    tentNode.pinToWorldVertex([bellRadius * 0.85, bellCenterY - 1.5, 0], ctx.threeCam, { screenOffset: [40, 20], minScale: 0.7, maxScale: 1.2 });
    const oralNode = ctx.node('oral_arms');
    oralNode.pinToWorldVertex([0, bellCenterY - 1.8, 0], ctx.threeCam, { screenOffset: [-40, 30], minScale: 0.7, maxScale: 1.2 });

    // Overlay Ducking
    const textDuck = Math.min(
      Math.min(1, Math.max(0, f.p / 0.08)),
      Math.min(1, Math.max(0, (1.0 - f.p) / 0.08))
    );

    // 2D Vector UI
    ctx.sdf.clear();
    const cardAlpha = Math.min(1, Math.max(0, ease.outExpo(Math.min(1, progress * 4.0)))) * textDuck;
    if (cardAlpha > 0.01) {
      ctx.card('abyss_hud_card', {
        x: W - 530, y: 84, w: 450, h: 185,
        radius: [12, 12, 12, 12],
        fill: [0.02, 0.06, 0.14, 0.88 * cardAlpha],
        stroke: [colCyan[0], colCyan[1], colCyan[2], 0.8 * cardAlpha],
        strokeWidth: 1.8,
        shadow: { blur: 24, color: [0, 0, 0, 0.65 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      ctx.ring({ cx: W - 130, cy: 175, radius: 36, thickness: 4.0, trim: [0, 1], color: [0.1, 0.3, 0.45, 0.35 * cardAlpha] });
      ctx.ring({
        cx: W - 130, cy: 175, radius: 36, thickness: 4.0,
        trim: [0, Math.min(1, 0.75 + Math.sin(t * 1.5) * 0.08)],
        color: [colCyan[0], colCyan[1], colCyan[2], 0.95 * cardAlpha],
        glow: 1.5,
      });
    }

    if (!apexNode.isOccluded && textDuck > 0.1) {
      const p = apexNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 45, size: 12, thickness: 1.5, color: [colCyan[0], colCyan[1], colCyan[2], 0.95 * textDuck] });
    }
    if (!tentNode.isOccluded && textDuck > 0.1) {
      const p = tentNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 35, size: 12, thickness: 1.5, color: [colViolet[0], colViolet[1], colViolet[2], 0.95 * textDuck] });
    }
    if (!oralNode.isOccluded && textDuck > 0.1) {
      const p = oralNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 30, size: 10, thickness: 1.5, color: [colLime[0], colLime[1], colLime[2], 0.95 * textDuck] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      const title = ctx.text('abyss_title', 'ABYSSAL BIOLUMINESCENCE', {
        fontSize: 48, fontWeight: 900, color: `rgba(240, 245, 255, ${0.98 * textDuck})`, letterSpacing: 8, role: 'headline',
      }).withKnockoutHalo(4, `rgba(2, 6, 23, ${0.95 * textDuck})`);
      const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
      ctx.renderText('abyss_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

      ctx.text('abyss_sub', 'BATHYPELAGIC SIPHONOPHORE · LUCIFERIN-LUCIFERASE REACTION · 48 MERIDIAN RIBS', {
        fontSize: 14, fontWeight: 600, color: `rgba(0, 245, 212, ${0.92 * textDuck})`, letterSpacing: 3, role: 'callout',
      }).withKnockoutHalo(2, `rgba(2, 6, 23, ${0.9 * textDuck})`);
      const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
      ctx.renderText('abyss_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

      const depthRoll = ctx.text('abyss_depth', '3840 M', {
        fontSize: 32, fontWeight: 700, color: `rgba(0, 245, 212, ${0.95 * textDuck})`, role: 'hud',
      });
      depthRoll.numericRoll(3840, (n) => `DEPTH: ${n} M [HADAL ZONE]`);
      ctx.renderText('abyss_depth', c2d, t, W - 500, 140);

      const presText = ctx.text('abyss_pres', 'PRESSURE: 388.4 ATM · 1.8°C · 34.8 PSU SALINITY', {
        fontSize: 12, fontWeight: 600, color: `rgba(226, 232, 240, ${0.85 * textDuck})`, role: 'hud',
      });
      ctx.renderText('abyss_pres', c2d, t, W - 500, 195);

      if (!apexNode.isOccluded) {
        ctx.text('abyss_apex_lbl', 'BELL APEX · PNEUMATOPHORE FLOAT', {
          fontSize: 12, fontWeight: 600, color: `rgba(0, 245, 212, ${0.9 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(2, 6, 23, ${0.9 * textDuck})`);
        const ap = apexNode.position;
        ctx.renderText('abyss_apex_lbl', c2d, t, ap[0] + 16, ap[1] - 32);
      }

      if (!tentNode.isOccluded) {
        ctx.text('abyss_tent_lbl', '24 TENTACLE NECTOPHORES · TRAVELING WAVE', {
          fontSize: 12, fontWeight: 600, color: `rgba(157, 78, 221, ${0.9 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(2, 6, 23, ${0.9 * textDuck})`);
        const tp = tentNode.position;
        ctx.renderText('abyss_tent_lbl', c2d, t, tp[0] + 16, tp[1] - 32);
      }

      if (!oralNode.isOccluded) {
        ctx.text('abyss_oral_lbl', '4 SPIRAL RHIZOSTOME ORAL ARMS', {
          fontSize: 12, fontWeight: 600, color: `rgba(163, 230, 53, ${0.9 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(2, 6, 23, ${0.9 * textDuck})`);
        const op = oralNode.position;
        ctx.renderText('abyss_oral_lbl', c2d, t, op[0] + 16, op[1] + 28);
      }
    }

    // Compositing with Deep Midnight Oceanic Navy Backdrop (#020617)
    ctx.compositor.clear();
    ctx.compositor.createLayer('ocean_backdrop', {
      render: (target) => {
        renderer.setRenderTarget(target);
        if (typeof (renderer as any).setClearColor === 'function') {
          (renderer as any).setClearColor(0x020617, 1.0);
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

    const pulseGlow = Math.sin(t * 1.8) * 0.15;
    return { bloom: 0.50 + pulseGlow, ca: 0.7 };
  },
});
