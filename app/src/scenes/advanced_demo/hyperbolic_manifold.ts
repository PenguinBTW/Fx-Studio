// 08: HYPERBOLIC MANIFOLD — Higher-Math Non-Euclidean Geometry & String Theory
// Deep cosmic dark violet (#110726), iridescent fuchsia (#D946EF), electric cyan (#06B6D4),
// solar gold (#FBBF24), 6D Calabi-Yau 4D-hyper-rotated manifold projection,
// Poincaré hyperbolic disk tessellation, and Hodge diamond topological telemetry.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

const U_RES = 48;
const V_RES = 32;

export default defineScene({
  id: 'hyperbolic_manifold',
  rigMode: 'perspective',
  particleCapacity: 2048,
  lineCapacity: 16384,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(28);
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 3.8, -10.5], target: [0, 0.0, 0.0], roll: -0.05, focalLength: 28 },
      { t: 0.35, pos: [7.8, 1.5, -3.5], target: [0, 0.1, 0.0], roll: 0.07, focalLength: 32 },
      { t: 0.7, pos: [2.5, -4.0, 7.8], target: [0, 0.0, 0.0], roll: -0.06, focalLength: 36 },
      { t: 1.0, pos: [-7.2, 2.8, 6.5], target: [0, 0.0, 0.0], roll: 0.03, focalLength: 40 },
    ]);

    // Quantum foam Planck-scale fluctuations (widely dispersed iridescent motes)
    ctx.particles.addEmitter('quantum_foam', {
      capacity: 450,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 0.15,
      spread: 5.5,
      lifetime: 5.5,
      gravity: [0, 0.005, 0],
      turbulence: 0.3,
      size: 0.014,
      color: [0.85, 0.25, 0.95, 0.35],
      glow: 0.8,
    });

    ctx.node('euler_singularity', { role: 'callout', size: [160, 36, 0] });
    ctx.node('chern_node', { role: 'callout', size: [160, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);
    ctx.lines.clear();

    // Higher-Math Palette: Deep Violet, Iridescent Fuchsia, Electric Cyan, Solar Gold
    const colFuchsia: [number, number, number] = [0.85, 0.27, 0.94];
    const colCyan: [number, number, number] = [0.02, 0.71, 0.83];
    const colGold: [number, number, number] = [0.98, 0.75, 0.14];
    const colDeepPurple: [number, number, number] = [0.35, 0.18, 0.55];

    // 1. Poincaré Hyperbolic Disk Geodesic Rings (Outer Contextual Armature)
    for (let pDisc = 1; pDisc <= 3; pDisc++) {
      const pR = 3.6 + pDisc * 1.4;
      const numSteps = 48;
      for (let st = 0; st < numSteps; st++) {
        const a1 = (st / numSteps) * TAU;
        const a2 = ((st + 1) / numSteps) * TAU;
        ctx.lines.seg(
          Math.cos(a1) * pR, 0, Math.sin(a1) * pR,
          Math.cos(a2) * pR, 0, Math.sin(a2) * pR,
          1.2, colDeepPurple[0], colDeepPurple[1], colDeepPurple[2], 0.45
        );
      }
    }

    // 2. Calabi-Yau 6D -> 3D Projected Wireframe Mesh with 4D Hyper-Rotation
    const grid: [number, number, number][][] = [];
    const scale = 2.6;
    const phaseU = t * 0.35;
    const phaseV = t * 0.25;

    for (let u = 0; u < U_RES; u++) {
      const uAngle = (u / U_RES) * TAU + phaseU;
      grid[u] = [];

      for (let v = 0; v < V_RES; v++) {
        const vAngle = (v / V_RES) * TAU + phaseV;

        const x = Math.cos(uAngle) * (2.0 + Math.cos(vAngle) * 0.85) * scale * 0.5;
        const y = Math.sin(uAngle) * (2.0 + Math.cos(vAngle) * 0.85) * scale * 0.5;
        const z = (Math.sin(vAngle) * 1.3 + Math.cos(2.0 * uAngle) * 0.7) * scale * 0.5;

        grid[u]![v] = [x, y, z];
      }
    }

    // Render U-isolines (longitude geodesics) in Iridescent Fuchsia
    for (let u = 0; u < U_RES; u++) {
      const isMajorU = u % 4 === 0;
      const colU = isMajorU ? colGold : colFuchsia;
      const widthU = isMajorU ? 2.0 : 1.0;
      const alphaU = isMajorU ? 0.92 : 0.40;

      for (let v = 0; v < V_RES; v++) {
        const p1 = grid[u]![v]!;
        const p2 = grid[u]![(v + 1) % V_RES]!;
        ctx.lines.seg(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], widthU, colU[0], colU[1], colU[2], alphaU);
      }
    }

    // Render V-isolines (latitude geodesics) in Electric Cyan
    for (let v = 0; v < V_RES; v++) {
      const isMajorV = v % 3 === 0;
      const colV = isMajorV ? colCyan : colDeepPurple;
      const widthV = isMajorV ? 1.4 : 0.8;
      const alphaV = isMajorV ? 0.75 : 0.30;

      for (let u = 0; u < U_RES; u++) {
        const p1 = grid[u]![v]!;
        const p2 = grid[(u + 1) % U_RES]![v]!;
        ctx.lines.seg(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], widthV, colV[0], colV[1], colV[2], alphaV);
      }
    }

    // 3. Central Geodesic Saddle Ring in Solar Gold
    const saddlePoints = 36;
    for (let i = 0; i < saddlePoints; i++) {
      const a1 = (i / saddlePoints) * TAU;
      const a2 = ((i + 1) / saddlePoints) * TAU;

      const sr1 = 1.8 + Math.cos(4.0 * a1 + t * 0.8) * 0.45;
      const sr2 = 1.8 + Math.cos(4.0 * a2 + t * 0.8) * 0.45;

      const sx1 = Math.cos(a1) * sr1, sy1 = Math.sin(a1) * sr1, sz1 = Math.sin(2.0 * a1) * 0.8;
      const sx2 = Math.cos(a2) * sr2, sy2 = Math.sin(a2) * sr2, sz2 = Math.sin(2.0 * a2) * 0.8;

      ctx.lines.seg(sx1, sy1, sz1, sx2, sy2, sz2, 2.6, colGold[0], colGold[1], colGold[2], 0.98);
    }

    // Pin Callouts
    const singNode = ctx.node('euler_singularity');
    singNode.pinToWorldVertex([0, 0, 1.4], ctx.threeCam, { screenOffset: [0, -35], minScale: 0.7, maxScale: 1.2 });
    const chernNode = ctx.node('chern_node');
    chernNode.pinToWorldVertex([2.4, 1.6, -0.6], ctx.threeCam, { screenOffset: [35, -20], minScale: 0.7, maxScale: 1.2 });

    // Overlay Ducking
    const textDuck = Math.min(
      Math.min(1, Math.max(0, f.p / 0.08)),
      Math.min(1, Math.max(0, (1.0 - f.p) / 0.08))
    );

    // 2D Vector UI
    ctx.sdf.clear();
    const cardAlpha = Math.min(1, Math.max(0, ease.outExpo(Math.min(1, progress * 4.0)))) * textDuck;
    if (cardAlpha > 0.01) {
      ctx.card('manifold_card', {
        x: W - 530, y: 84, w: 450, h: 185,
        radius: [14, 14, 14, 14],
        fill: [0.12, 0.06, 0.22, 0.88 * cardAlpha],
        stroke: [colFuchsia[0], colFuchsia[1], colFuchsia[2], 0.8 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 24, color: [0, 0, 0, 0.65 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      // Moduli space curvature dial
      ctx.ring({ cx: W - 130, cy: 175, radius: 36, thickness: 4.5, trim: [0, 1], color: [0.35, 0.2, 0.5, 0.35 * cardAlpha] });
      ctx.ring({
        cx: W - 130, cy: 175, radius: 36, thickness: 4.5,
        trim: [0, 0.92],
        color: [colFuchsia[0], colFuchsia[1], colFuchsia[2], 0.95 * cardAlpha],
        glow: 1.4,
      });
    }

    if (!singNode.isOccluded && textDuck > 0.1) {
      const p = singNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 45, size: 12, thickness: 1.5, color: [colGold[0], colGold[1], colGold[2], 0.95 * textDuck] });
    }
    if (!chernNode.isOccluded && textDuck > 0.1) {
      const p = chernNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 35, size: 12, thickness: 1.5, color: [colCyan[0], colCyan[1], colCyan[2], 0.95 * textDuck] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      const title = ctx.text('man_title', 'HYPERBOLIC MANIFOLD', {
        fontSize: 48, fontWeight: 900, color: `rgba(245, 243, 255, ${0.98 * textDuck})`, letterSpacing: 8, role: 'headline',
      }).withKnockoutHalo(4, `rgba(17, 7, 38, ${0.95 * textDuck})`);
      const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
      ctx.renderText('man_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

      ctx.text('man_sub', '6D CALABI-YAU COMPACTIFICATION · RICCI-FLAT METRIC · c₁(M) = 0 · EULER CHAR χ = -200', {
        fontSize: 14, fontWeight: 600, color: `rgba(217, 70, 239, ${0.92 * textDuck})`, letterSpacing: 3, role: 'callout',
      }).withKnockoutHalo(2, `rgba(17, 7, 38, ${0.9 * textDuck})`);
      const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
      ctx.renderText('man_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

      // Hodge diamond numbers
      const hodgeRoll = ctx.text('man_hodge', 'χ = -200', {
        fontSize: 32, fontWeight: 700, color: `rgba(217, 70, 239, ${0.95 * textDuck})`, role: 'hud',
      });
      hodgeRoll.numericRoll(200, (n) => `EULER CHAR: -${n}`);
      ctx.renderText('man_hodge', c2d, t, W - 500, 140);

      const modText = ctx.text('man_mod', 'HODGE DIAMOND: h¹¹=1, h²¹=101 · MODULI DIM = 102', {
        fontSize: 12, fontWeight: 600, color: `rgba(240, 171, 252, ${0.85 * textDuck})`, role: 'hud',
      });
      ctx.renderText('man_mod', c2d, t, W - 500, 195);

      if (!singNode.isOccluded) {
        ctx.text('man_sing_lbl', 'CONIFOLD SINGULARITY [FLOP TRANSITION]', {
          fontSize: 12, fontWeight: 600, color: `rgba(251, 191, 36, ${0.95 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(17, 7, 38, ${0.9 * textDuck})`);
        const sp = singNode.position;
        ctx.renderText('man_sing_lbl', c2d, t, sp[0] + 16, sp[1] - 32);
      }

      if (!chernNode.isOccluded) {
        ctx.text('man_chern_lbl', 'FIRST CHERN CLASS c₁(M) = 0 [RICCI FLAT]', {
          fontSize: 12, fontWeight: 600, color: `rgba(6, 182, 212, ${0.9 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(17, 7, 38, ${0.9 * textDuck})`);
        const cp = chernNode.position;
        ctx.renderText('man_chern_lbl', c2d, t, cp[0] + 16, cp[1] + 28);
      }
    }

    // Compositing with Deep Cosmic Dark Violet Backdrop (#110726)
    ctx.compositor.clear();
    ctx.compositor.createLayer('cosmic_backdrop', {
      render: (target) => {
        renderer.setRenderTarget(target);
        if (typeof (renderer as any).setClearColor === 'function') {
          (renderer as any).setClearColor(0x110726, 1.0);
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

    return { bloom: 0.45, ca: 0.8 };
  },
});
