// 04: SPATIAL GLASS OS — VisionOS Volumetric Computing & Multi-Depth Workspace
// Translucent slate glass (#0F172A), vibrant emerald (#10B981), lavender (#A78BFA),
// 3 floating multi-depth 3D windows with physical frosted glass backdrops,
// 4-layer neural topology inspector, 24-band spatial audio DAW, 6-icon launcher dock,
// and volumetric hand cursor laser interaction ray.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

export default defineScene({
  id: 'spatial_glass_os',
  rigMode: 'perspective',
  particleCapacity: 2048,
  lineCapacity: 16384,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(28);
    ctx.rig.setPath([
      { t: 0.0, pos: [-0.6, 1.2, -7.5], target: [0, 0.1, 0.0], roll: -0.03, focalLength: 28 },
      { t: 0.4, pos: [1.6, 0.9, -6.8], target: [0.2, 0.0, 0.2], roll: 0.03, focalLength: 30 },
      { t: 0.75, pos: [-1.4, 0.7, -6.5], target: [-0.2, 0.0, 0.2], roll: -0.03, focalLength: 32 },
      { t: 1.0, pos: [0.0, 1.0, -5.8], target: [0, 0.1, 0.0], roll: 0.0, focalLength: 34 },
    ]);

    // Ambient floating holographic UI micro-motes
    ctx.particles.addEmitter('glass_motes', {
      capacity: 350,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 0.08,
      spread: 4.5,
      lifetime: 5.5,
      gravity: [0, 0.005, 0],
      turbulence: 0.2,
      size: 0.012,
      color: [0.65, 0.75, 0.95, 0.25],
      glow: 0.6,
    });

    // Pointer laser tip interaction sparkles
    ctx.particles.addEmitter('cursor_sparkles', {
      capacity: 250,
      origin: [-0.6, 0.2, 0.0],
      direction: [0, 1, 0],
      speed: 0.2,
      spread: 0.8,
      lifetime: 2.2,
      turbulence: 0.3,
      size: 0.02,
      color: [0.06, 0.72, 0.50, 0.8],
      glow: 1.5,
    });

    ctx.node('win_main_node', { role: 'callout', size: [180, 36, 0] });
    ctx.node('win_audio_node', { role: 'callout', size: [180, 36, 0] });
    ctx.node('win_dock_node', { role: 'callout', size: [180, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);
    ctx.lines.clear();

    // VisionOS Palette: Slate Glass, Emerald, Lavender, Sky Blue, Platinum White
    const colEmerald: [number, number, number] = [0.06, 0.72, 0.50];
    const colLavender: [number, number, number] = [0.65, 0.55, 0.98];
    const colSkyBlue: [number, number, number] = [0.22, 0.74, 0.97];
    const colAmber: [number, number, number] = [0.96, 0.72, 0.20];
    const colGlassBorder: [number, number, number] = [0.82, 0.88, 0.98];
    const colSubtle: [number, number, number] = [0.35, 0.45, 0.60];

    // 1. Primary Volumetric Window: Neural Topology Inspector (Center Left, Emerald)
    const mCx = -0.6, mCy = 0.2, mCz = 0.0, mW = 3.8, mH = 2.6;
    const mHalfW = mW * 0.5, mHalfH = mH * 0.5;

    // Window outer frame (double bevel)
    ctx.lines.seg(mCx - mHalfW, mCy - mHalfH, mCz, mCx + mHalfW, mCy - mHalfH, mCz, 2.4, colGlassBorder[0], colGlassBorder[1], colGlassBorder[2], 0.95);
    ctx.lines.seg(mCx + mHalfW, mCy - mHalfH, mCz, mCx + mHalfW, mCy + mHalfH, mCz, 2.4, colGlassBorder[0], colGlassBorder[1], colGlassBorder[2], 0.95);
    ctx.lines.seg(mCx + mHalfW, mCy + mHalfH, mCz, mCx - mHalfW, mCy + mHalfH, mCz, 2.4, colGlassBorder[0], colGlassBorder[1], colGlassBorder[2], 0.95);
    ctx.lines.seg(mCx - mHalfW, mCy + mHalfH, mCz, mCx - mHalfW, mCy - mHalfH, mCz, 2.4, colGlassBorder[0], colGlassBorder[1], colGlassBorder[2], 0.95);

    // Inner subtle glow border
    const mPad = 0.06;
    ctx.lines.seg(mCx - mHalfW + mPad, mCy - mHalfH + mPad, mCz, mCx + mHalfW - mPad, mCy - mHalfH + mPad, mCz, 1.0, colEmerald[0], colEmerald[1], colEmerald[2], 0.45);
    ctx.lines.seg(mCx + mHalfW - mPad, mCy - mHalfH + mPad, mCz, mCx + mHalfW - mPad, mCy + mHalfH - mPad, mCz, 1.0, colEmerald[0], colEmerald[1], colEmerald[2], 0.45);
    ctx.lines.seg(mCx + mHalfW - mPad, mCy + mHalfH - mPad, mCz, mCx - mHalfW + mPad, mCy + mHalfH - mPad, mCz, 1.0, colEmerald[0], colEmerald[1], colEmerald[2], 0.45);
    ctx.lines.seg(mCx - mHalfW + mPad, mCy + mHalfH - mPad, mCz, mCx - mHalfW + mPad, mCy - mHalfH + mPad, mCz, 1.0, colEmerald[0], colEmerald[1], colEmerald[2], 0.45);

    // Window titlebar divider
    const mBarY = mCy + mHalfH - 0.38;
    ctx.lines.seg(mCx - mHalfW, mBarY, mCz, mCx + mHalfW, mBarY, mCz, 1.5, colEmerald[0], colEmerald[1], colEmerald[2], 0.85);

    // Window titlebar traffic lights
    for (let c = 0; c < 3; c++) {
      const capX = mCx - mHalfW + 0.28 + c * 0.24;
      const capY = mCy + mHalfH - 0.20;
      const cr = 0.06;
      for (let st = 0; st < 8; st++) {
        const a1 = (st / 8) * TAU, a2 = ((st + 1) / 8) * TAU;
        ctx.lines.seg(capX + Math.cos(a1) * cr, capY + Math.sin(a1) * cr, mCz, capX + Math.cos(a2) * cr, capY + Math.sin(a2) * cr, mCz, 1.4, colEmerald[0], colEmerald[1], colEmerald[2], 0.9);
      }
    }

    // Sidebar separator
    const sideX = mCx - mHalfW + 0.95;
    ctx.lines.seg(sideX, mCy - mHalfH, mCz, sideX, mBarY, mCz, 1.2, colSubtle[0], colSubtle[1], colSubtle[2], 0.55);

    for (let nav = 0; nav < 4; nav++) {
      const navY = mBarY - 0.28 - nav * 0.38;
      const isSel = nav === 1;
      const nCol = isSel ? colEmerald : colSubtle;
      ctx.lines.seg(mCx - mHalfW + 0.18, navY, mCz, sideX - 0.18, navY, mCz, isSel ? 2.2 : 1.0, nCol[0], nCol[1], nCol[2], isSel ? 0.95 : 0.45);
    }

    // Neural Network Architecture Nodes (4 layers)
    const layerCols = [sideX + 0.35, sideX + 1.05, sideX + 1.75, sideX + 2.45];
    const layerNodes = [
      [mCy + 0.45, mCy + 0.15, mCy - 0.15, mCy - 0.45],
      [mCy + 0.60, mCy + 0.30, mCy, mCy - 0.30, mCy - 0.60],
      [mCy + 0.60, mCy + 0.30, mCy, mCy - 0.30, mCy - 0.60],
      [mCy + 0.35, mCy, mCy - 0.35],
    ];

    for (let l = 0; l < layerCols.length - 1; l++) {
      const xA = layerCols[l]!;
      const xB = layerCols[l + 1]!;
      const nodesA = layerNodes[l]!;
      const nodesB = layerNodes[l + 1]!;

      for (let i = 0; i < nodesA.length; i++) {
        const yA = nodesA[i]!;
        for (let j = 0; j < nodesB.length; j++) {
          const yB = nodesB[j]!;
          const pulse = Math.sin(t * 5.0 - l * 1.5 + i * 0.4 + j * 0.7);
          const isFired = pulse > 0.8;
          const synAlpha = isFired ? 0.85 : 0.25;
          const synWidth = isFired ? 1.6 : 0.7;
          const sCol = isFired ? colEmerald : colSubtle;

          ctx.lines.seg(xA, yA, mCz, xB, yB, mCz, synWidth, sCol[0], sCol[1], sCol[2], synAlpha);
        }
      }
    }

    for (let l = 0; l < layerCols.length; l++) {
      const xN = layerCols[l]!;
      const nodes = layerNodes[l]!;
      for (let i = 0; i < nodes.length; i++) {
        const yN = nodes[i]!;
        const nr = 0.055;
        for (let st = 0; st < 6; st++) {
          const a1 = (st / 6) * TAU, a2 = ((st + 1) / 6) * TAU;
          ctx.lines.seg(xN + Math.cos(a1) * nr, yN + Math.sin(a1) * nr, mCz, xN + Math.cos(a2) * nr, yN + Math.sin(a2) * nr, mCz, 1.8, colEmerald[0], colEmerald[1], colEmerald[2], 0.95);
        }
      }
    }

    // 2. Secondary Floating Window: Spatial Audio DAW
    const sCx = 2.4, sCy = 0.5, sCz = 0.8, sW = 2.6, sH = 2.2;
    const sHalfW = sW * 0.5, sHalfH = sH * 0.5;

    ctx.lines.seg(sCx - sHalfW, sCy - sHalfH, sCz, sCx + sHalfW, sCy - sHalfH, sCz, 2.0, colGlassBorder[0], colGlassBorder[1], colGlassBorder[2], 0.85);
    ctx.lines.seg(sCx + sHalfW, sCy - sHalfH, sCz, sCx + sHalfW, sCy + sHalfH, sCz, 2.0, colGlassBorder[0], colGlassBorder[1], colGlassBorder[2], 0.85);
    ctx.lines.seg(sCx + sHalfW, sCy + sHalfH, sCz, sCx - sHalfW, sCy + sHalfH, sCz, 2.0, colGlassBorder[0], colGlassBorder[1], colGlassBorder[2], 0.85);
    ctx.lines.seg(sCx - sHalfW, sCy + sHalfH, sCz, sCx - sHalfW, sCy - sHalfH, sCz, 2.0, colGlassBorder[0], colGlassBorder[1], colGlassBorder[2], 0.85);

    // Audio frequency equalizer spectrum (24 bars)
    const waveY = sCy - 0.25;
    const numBars = 24;
    const barWidth = 1.9 / numBars;
    for (let b = 0; b < numBars; b++) {
      const bx = sCx - sHalfW + 0.35 + b * barWidth;
      const freqEnergy = Math.abs(Math.sin(t * 4.5 + b * 0.45)) * 0.55 + 0.1;
      ctx.lines.seg(bx, waveY - freqEnergy * 0.5, sCz, bx, waveY + freqEnergy * 0.5, sCz, 2.2, colLavender[0], colLavender[1], colLavender[2], 0.9);
      ctx.lines.seg(bx - 0.02, waveY + freqEnergy * 0.5 + 0.04, sCz, bx + 0.02, waveY + freqEnergy * 0.5 + 0.04, sCz, 1.8, colSkyBlue[0], colSkyBlue[1], colSkyBlue[2], 0.95);
    }

    // Volume dial
    const dialCx = sCx, dialCy = sCy + 0.5;
    const dialR = 0.32;
    for (let st = 0; st < 24; st++) {
      const a1 = (st / 24) * TAU, a2 = ((st + 1) / 24) * TAU;
      ctx.lines.seg(dialCx + Math.cos(a1) * dialR, dialCy + Math.sin(a1) * dialR, sCz, dialCx + Math.cos(a2) * dialR, dialCy + Math.sin(a2) * dialR, sCz, 1.4, colLavender[0], colLavender[1], colLavender[2], 0.85);
    }
    const vAngle = t * 1.5;
    ctx.lines.seg(dialCx, dialCy, sCz, dialCx + Math.cos(vAngle) * (dialR * 0.85), dialCy + Math.sin(vAngle) * (dialR * 0.85), sCz, 2.2, colEmerald[0], colEmerald[1], colEmerald[2], 0.95);

    // 3. Floating Spatial Launcher Dock (Bottom)
    const dY = -1.6, dZ = 0.2;
    const dockW = 4.6, dockH = 0.55;
    const dhw = dockW * 0.5;

    ctx.lines.seg(-dhw, dY, dZ, dhw, dY, dZ, 1.8, colGlassBorder[0], colGlassBorder[1], colGlassBorder[2], 0.8);
    ctx.lines.seg(dhw, dY, dZ, dhw, dY - dockH, dZ, 1.8, colGlassBorder[0], colGlassBorder[1], colGlassBorder[2], 0.8);
    ctx.lines.seg(dhw, dY - dockH, dZ, -dhw, dY - dockH, dZ, 1.8, colGlassBorder[0], colGlassBorder[1], colGlassBorder[2], 0.8);
    ctx.lines.seg(-dhw, dY - dockH, dZ, -dhw, dY, dZ, 1.8, colGlassBorder[0], colGlassBorder[1], colGlassBorder[2], 0.8);

    // 6 Distinct App Icons in Dock
    const appColors = [colEmerald, colLavender, colSkyBlue, colAmber, [0.95, 0.35, 0.55] as [number, number, number], colGlassBorder];
    for (let icon = 0; icon < 6; icon++) {
      const icX = -1.6 + icon * 0.64;
      const icY = dY - dockH * 0.5;
      const icR = 0.15;
      const isAct = icon === 0;
      const col = appColors[icon]!;

      for (let st = 0; st < 16; st++) {
        const a1 = (st / 16) * TAU, a2 = ((st + 1) / 16) * TAU;
        ctx.lines.seg(icX + Math.cos(a1) * icR, icY + Math.sin(a1) * icR, dZ, icX + Math.cos(a2) * icR, icY + Math.sin(a2) * icR, dZ, isAct ? 2.4 : 1.4, col[0], col[1], col[2], isAct ? 0.98 : 0.7);
      }
      if (isAct) {
        ctx.lines.seg(icX - 0.04, dY - dockH + 0.05, dZ, icX + 0.04, dY - dockH + 0.05, dZ, 2.5, colEmerald[0], colEmerald[1], colEmerald[2], 0.95);
      }
    }

    // 4. Volumetric Hand Cursor Laser Interaction Ray
    const rayTargetX = mCx + Math.sin(t * 1.8) * 0.8;
    const rayTargetY = 0.2 + Math.cos(t * 1.5) * 0.45;
    const rayTargetZ = mCz;
    const rayStartX = 0.6, rayStartY = -1.2, rayStartZ = -3.5;

    ctx.lines.seg(rayStartX, rayStartY, rayStartZ, rayTargetX, rayTargetY, rayTargetZ, 2.4, colEmerald[0], colEmerald[1], colEmerald[2], 0.85);

    const rsz = 0.16;
    ctx.lines.seg(rayTargetX - rsz, rayTargetY, rayTargetZ, rayTargetX + rsz, rayTargetY, rayTargetZ, 2.4, colEmerald[0], colEmerald[1], colEmerald[2], 0.98);
    ctx.lines.seg(rayTargetX, rayTargetY - rsz, rayTargetZ, rayTargetX, rayTargetY + rsz, rayTargetZ, 2.4, colEmerald[0], colEmerald[1], colEmerald[2], 0.98);
    for (let st = 0; st < 16; st++) {
      const a1 = (st / 16) * TAU + t * 2.0;
      const a2 = ((st + 1) / 16) * TAU + t * 2.0;
      ctx.lines.seg(rayTargetX + Math.cos(a1) * rsz, rayTargetY + Math.sin(a1) * rsz, rayTargetZ, rayTargetX + Math.cos(a2) * rsz, rayTargetY + Math.sin(a2) * rsz, rayTargetZ, 1.4, colEmerald[0], colEmerald[1], colEmerald[2], 0.85);
    }

    // Pin Callouts & Glass Panel Screen Projections
    const mainNode = ctx.node('win_main_node');
    mainNode.pinToWorldVertex([mCx, mCy, mCz], ctx.threeCam, { screenOffset: [0, 0], minScale: 0.7, maxScale: 1.2 });
    const audioNode = ctx.node('win_audio_node');
    audioNode.pinToWorldVertex([sCx, sCy, sCz], ctx.threeCam, { screenOffset: [0, 0], minScale: 0.7, maxScale: 1.2 });
    const dockNode = ctx.node('win_dock_node');
    dockNode.pinToWorldVertex([0.0, dY - dockH * 0.5, dZ], ctx.threeCam, { screenOffset: [0, 0], minScale: 0.7, maxScale: 1.2 });

    // Overlay Ducking
    const textDuck = Math.min(
      Math.min(1, Math.max(0, f.p / 0.08)),
      Math.min(1, Math.max(0, (1.0 - f.p) / 0.08))
    );

    // 2D Vector UI & Frosted Glass Window Panes
    ctx.sdf.clear();
    const cardAlpha = Math.min(1, Math.max(0, ease.outExpo(Math.min(1, progress * 4.0)))) * textDuck;

    if (cardAlpha > 0.01) {
      // Physical Frosted Glass Pane behind Main Neural Window
      if (!mainNode.isOccluded) {
        const mp = mainNode.position;
        const ms = mainNode.scale[0];
        const gw = mW * 155 * ms;
        const gh = mH * 155 * ms;
        ctx.card('glass_main_pane', {
          x: mp[0] - gw * 0.5, y: mp[1] - gh * 0.5, w: gw, h: gh,
          radius: [14, 14, 14, 14],
          fill: [0.06, 0.10, 0.18, 0.65 * cardAlpha],
          stroke: [colGlassBorder[0], colGlassBorder[1], colGlassBorder[2], 0.5 * cardAlpha],
          strokeWidth: 1.5,
          shadow: { blur: 24, color: [0, 0, 0, 0.55 * cardAlpha], offset: [0, 8] },
          role: 'hud', opacity: cardAlpha,
        });
      }

      // Physical Frosted Glass Pane behind Secondary Audio Window
      if (!audioNode.isOccluded) {
        const ap = audioNode.position;
        const as = audioNode.scale[0];
        const gw = sW * 140 * as;
        const gh = sH * 140 * as;
        ctx.card('glass_audio_pane', {
          x: ap[0] - gw * 0.5, y: ap[1] - gh * 0.5, w: gw, h: gh,
          radius: [14, 14, 14, 14],
          fill: [0.08, 0.06, 0.18, 0.60 * cardAlpha],
          stroke: [colLavender[0], colLavender[1], colLavender[2], 0.45 * cardAlpha],
          strokeWidth: 1.5,
          shadow: { blur: 20, color: [0, 0, 0, 0.45 * cardAlpha], offset: [0, 6] },
          role: 'hud', opacity: cardAlpha,
        });
      }

      // Physical Frosted Glass Dock Pill
      if (!dockNode.isOccluded) {
        const dp = dockNode.position;
        const ds = dockNode.scale[0];
        const dw = dockW * 140 * ds;
        const dh = dockH * 170 * ds;
        ctx.card('glass_dock_pane', {
          x: dp[0] - dw * 0.5, y: dp[1] - dh * 0.5, w: dw, h: dh,
          radius: [24, 24, 24, 24],
          fill: [0.05, 0.08, 0.15, 0.75 * cardAlpha],
          stroke: [colSkyBlue[0], colSkyBlue[1], colSkyBlue[2], 0.65 * cardAlpha],
          strokeWidth: 1.5,
          shadow: { blur: 24, color: [0, 0, 0, 0.55 * cardAlpha], offset: [0, 8] },
          role: 'hud', opacity: cardAlpha,
        });
      }

      // Modern slate frosted glass card (Top Right)
      ctx.card('glass_hud_card', {
        x: W - 530, y: 84, w: 450, h: 185,
        radius: [14, 14, 14, 14],
        fill: [0.06, 0.09, 0.16, 0.88 * cardAlpha],
        stroke: [colEmerald[0], colEmerald[1], colEmerald[2], 0.8 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 24, color: [0, 0, 0, 0.6 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      // Spatial OS Eye-Tracking Gaze Dial
      ctx.ring({ cx: W - 130, cy: 175, radius: 36, thickness: 4.5, trim: [0, 1], color: [0.25, 0.35, 0.45, 0.35 * cardAlpha] });
      ctx.ring({
        cx: W - 130, cy: 175, radius: 36, thickness: 4.5,
        trim: [0, Math.min(1, 0.3 + Math.sin(t * 3.0) * 0.4)],
        color: [colEmerald[0], colEmerald[1], colEmerald[2], 0.95 * cardAlpha],
        glow: 1.4,
      });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      const title = ctx.text('glass_title', 'SPATIAL WORKSPACE OS', {
        fontSize: 48, fontWeight: 900, color: `rgba(240, 245, 255, ${0.98 * textDuck})`, letterSpacing: 8, role: 'headline',
      }).withKnockoutHalo(4, `rgba(15, 23, 42, ${0.95 * textDuck})`);
      const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
      ctx.renderText('glass_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

      ctx.text('glass_sub', 'VOLUMETRIC GLASSMORPHIC UI · 120 HZ PROMOTION · 8.2 MS MOTION TO PHOTON LATENCY', {
        fontSize: 14, fontWeight: 600, color: `rgba(16, 185, 129, ${0.92 * textDuck})`, letterSpacing: 3, role: 'callout',
      }).withKnockoutHalo(2, `rgba(15, 23, 42, ${0.9 * textDuck})`);
      const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
      ctx.renderText('glass_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

      const refRoll = ctx.text('glass_refresh', '120 FPS', {
        fontSize: 32, fontWeight: 700, color: `rgba(16, 185, 129, ${0.95 * textDuck})`, role: 'hud',
      });
      refRoll.numericRoll(120, (n) => `REFRESH: ${n} FPS (PROMOTION)`);
      ctx.renderText('glass_refresh', c2d, t, W - 500, 140);

      const latText = ctx.text('glass_lat', 'MOTION-TO-PHOTON: 8.2 MS · EYE TRACK: GAZE ACTIVE', {
        fontSize: 12, fontWeight: 600, color: `rgba(226, 232, 240, ${0.85 * textDuck})`, role: 'hud',
      });
      ctx.renderText('glass_lat', c2d, t, W - 500, 195);
    }

    // Compositing with Dark Slate Glass Backdrop (#0A0F1D)
    ctx.compositor.clear();
    ctx.compositor.createLayer('slate_backdrop', {
      render: (target) => {
        renderer.setRenderTarget(target);
        if (typeof (renderer as any).setClearColor === 'function') {
          (renderer as any).setClearColor(0x0A0F1D, 1.0);
        }
        renderer.clear(true, true, true);
      },
      blend: 'normal',
      opacity: 1.0,
    });
    ctx.compositor.createLayer('glass_surfaces', {
      render: (target) => {
        ctx.sdf.flush(renderer, target);
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
        const layerTex = ctx.layer2d.upload();
        ctx.sceneCtx.comp.draw(renderer, layerTex, target, { mode: 'normal', opacity: 1.0 });
      },
      blend: 'normal',
      opacity: 1.0,
    });
    ctx.compositor.evaluate(renderer, out);

    ctx.sceneGraph.syncTelemetry(t);
    renderer.resetState();

    return { bloom: 0.35, ca: 0.4 };
  },
});
