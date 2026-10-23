// TESSERACT — 4D hypercube rotation in XW and YZ planes with stereographic
// 3D projection, concentric nested 4D shells, pulsing neural synapse lattice,
// dual-mode camera flight, and 4D vertex coordinate tracking.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

// 16 vertices of a unit hypercube: (±1, ±1, ±1, ±1)
const TESSERACT_VERTS: [number, number, number, number][] = [];
for (let i = 0; i < 16; i++) {
  TESSERACT_VERTS.push([
    (i & 1 ? 1 : -1),
    (i & 2 ? 1 : -1),
    (i & 4 ? 1 : -1),
    (i & 8 ? 1 : -1),
  ]);
}

// 32 edges connecting vertices differing in exactly one coordinate (Hamming distance 1)
const TESSERACT_EDGES: [number, number][] = [];
for (let i = 0; i < 16; i++) {
  for (let bit = 0; bit < 4; bit++) {
    const j = i ^ (1 << bit);
    if (i < j) TESSERACT_EDGES.push([i, j]);
  }
}

export default defineScene({
  id: 'tesseract',
  rigMode: 'perspective',
  particleCapacity: 2048,
  lineCapacity: 8192,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(40);
    ctx.rig.setPath([
      { t: 0.0, pos: [-7.8, 4.2, -7.8], target: [0, 0.2, 0], roll: -0.05, focalLength: 40 },
      { t: 0.45, pos: [0.0, 1.6, -10.2], target: [0, 0.2, 0], roll: 0.08, focalLength: 46 },
      { t: 0.8, pos: [7.2, 3.4, -6.5], target: [0, 0.2, 0], roll: -0.04, focalLength: 42 },
      { t: 1.0, pos: [3.8, 1.2, -7.8], target: [0, 0.2, 0], roll: 0.02, focalLength: 38 },
    ]);

    // Flowing synaptic qubits / data sparks
    ctx.particles.addEmitter('qubit_stream', {
      capacity: 800,
      origin: [0, 0.2, 0],
      direction: [0, 1, 0],
      speed: 1.8,
      spread: 1.4,
      lifetime: 2.8,
      turbulence: 0.45,
      size: 0.055,
      color: [ctx.lin.signal[0], ctx.lin.signal[1], ctx.lin.signal[2], 0.9],
      glow: 2.2,
    });

    // Outer quantum halo dust
    ctx.particles.addEmitter('hyper_halo', {
      capacity: 500,
      origin: [0, 0.2, 0],
      direction: [0, 0, 1],
      speed: 0.6,
      spread: 1.8,
      lifetime: 3.6,
      turbulence: 0.5,
      size: 0.065,
      color: [ctx.lin.bone[0], ctx.lin.bone[1], ctx.lin.bone[2], 0.5],
      glow: 1.2,
    });

    ctx.node('v0_callout', { role: 'callout', size: [130, 32, 0] });
    ctx.node('v15_callout', { role: 'callout', size: [130, 32, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);

    ctx.lines.clear();

    // 4D Rotation angles: simultaneous rotations in XW and YZ planes
    const thetaXW = t * 0.72;
    const thetaYZ = t * 0.58;
    const thetaXZ = t * 0.35;

    const cosXW = Math.cos(thetaXW), sinXW = Math.sin(thetaXW);
    const cosYZ = Math.cos(thetaYZ), sinYZ = Math.sin(thetaYZ);
    const cosXZ = Math.cos(thetaXZ), sinXZ = Math.sin(thetaXZ);

    // Function to rotate a 4D point and project stereographically to 3D
    const project4D = (v: [number, number, number, number], scale4D = 1.0): [number, number, number] => {
      let x = v[0] * scale4D, y = v[1] * scale4D, z = v[2] * scale4D, w = v[3] * scale4D;

      // Rotate XW
      const x1 = x * cosXW - w * sinXW;
      const w1 = x * sinXW + w * cosXW;

      // Rotate YZ
      const y2 = y * cosYZ - z * sinYZ;
      const z2 = y * sinYZ + z * cosYZ;

      // Rotate XZ
      const x3 = x1 * cosXZ - z2 * sinXZ;
      const z3 = x1 * sinXZ + z2 * cosXZ;

      // 4D Perspective Projection into 3D: camera distance in 4th dimension d4 = 2.8
      const d4 = 2.8;
      const pFactor = 1.85 / (d4 - w1);
      return [x3 * pFactor, y2 * pFactor + 0.2, z3 * pFactor];
    };

    // Draw Outer 4D Tesseract (32 edges)
    const projected3D: [number, number, number][] = TESSERACT_VERTS.map((v) => project4D(v, 1.25));

    for (let e = 0; e < TESSERACT_EDGES.length; e++) {
      const [i, j] = TESSERACT_EDGES[e]!;
      const p1 = projected3D[i]!;
      const p2 = projected3D[j]!;
      // Inner vs outer 4D hypercube edges colored by depth in 4th dimension
      const wAvg = (TESSERACT_VERTS[i]![3] + TESSERACT_VERTS[j]![3]) * 0.5;
      const isInner = wAvg < 0;
      const r = isInner ? lin.signal[0] : lin.bone[0];
      const g = isInner ? lin.signal[1] : lin.bone[1];
      const b = isInner ? lin.signal[2] : lin.bone[2];
      const alpha = isInner ? 0.9 : 0.65;
      ctx.lines.seg(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], isInner ? 2.2 : 1.4, r, g, b, alpha);
    }

    // Draw Inner Core Tesseract (reverse phase, scale 0.55)
    const coreProjected: [number, number, number][] = TESSERACT_VERTS.map((v) => {
      // Reverse phase in 4D
      const revV: [number, number, number, number] = [v[0], -v[1], v[2], -v[3]];
      return project4D(revV, 0.65);
    });

    for (let e = 0; e < TESSERACT_EDGES.length; e++) {
      const [i, j] = TESSERACT_EDGES[e]!;
      const p1 = coreProjected[i]!;
      const p2 = coreProjected[j]!;
      ctx.lines.seg(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], 1.2, lin.ember[0], lin.ember[1], lin.ember[2], 0.7);
    }

    // Volumetric Synaptic Neural Matrix: 6 concentric orbital rings of axon lines
    const synapseRings = 4;
    for (let sr = 0; sr < synapseRings; sr++) {
      const ringRad = 2.8 + sr * 0.75;
      const nodeCount = 14 + sr * 4;
      const ringY = -1.2 + sr * 0.8;
      const pulseSpeed = t * 2.5 + sr * 1.2;
      for (let n = 0; n < nodeCount; n++) {
        const a1 = (n / nodeCount) * TAU + t * 0.15;
        const a2 = ((n + 1) / nodeCount) * TAU + t * 0.15;
        const x1 = Math.cos(a1) * ringRad, z1 = Math.sin(a1) * ringRad;
        const x2 = Math.cos(a2) * ringRad, z2 = Math.sin(a2) * ringRad;

        // Synaptic firing pulse wave
        const wave = Math.sin(n * 0.8 - pulseSpeed);
        const isFiring = wave > 0.65;
        const alpha = isFiring ? 0.85 : 0.2;
        const col = isFiring ? lin.signal : lin.graphite;
        ctx.lines.seg(x1, ringY, z1, x2, ringY, z2, isFiring ? 1.6 : 0.8, col[0], col[1], col[2], alpha);

        // Connect node inwards to nearest tesseract vertex
        if (n % 3 === 0) {
          const nearestV = projected3D[n % 16]!;
          ctx.lines.seg(x1, ringY, z1, nearestV[0], nearestV[1], nearestV[2], 0.8, lin.bone[0], lin.bone[1], lin.bone[2], 0.15);
        }
      }
    }

    // Pin 3D vertices for HUD tracking
    const v0Node = ctx.node('v0_callout');
    v0Node.pinToWorldVertex(projected3D[0]!, ctx.threeCam, { screenOffset: [-50, -40], minScale: 0.7, maxScale: 1.2 });

    const v15Node = ctx.node('v15_callout');
    v15Node.pinToWorldVertex(projected3D[15]!, ctx.threeCam, { screenOffset: [50, 40], minScale: 0.7, maxScale: 1.2 });

    // SDF HUD
    ctx.sdf.clear();
    const enterSpring = ctx.motion.spring(0.1, t, { freq: 3.0, damping: 0.7, v0: 2.0 });
    const cardAlpha = Math.min(1, Math.max(0, enterSpring));
    if (cardAlpha > 0.01) {
      ctx.card('tess_card', {
        x: W - 540, y: 80, w: 460, h: 160,
        radius: [14, 14, 14, 14],
        fill: [lin.ink2[0], lin.ink2[1], lin.ink2[2], 0.88 * cardAlpha],
        stroke: [lin.signal[0], lin.signal[1], lin.signal[2], 0.75 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 26, color: [0, 0, 0, 0.5 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      // Ring progress meter
      ctx.ring({ cx: W - 140, cy: 160, radius: 36, thickness: 4, trim: [0, 1], color: [lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.35 * cardAlpha] });
      ctx.ring({ cx: W - 140, cy: 160, radius: 36, thickness: 4, trim: [0, Math.max(0.04, progress)], color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * cardAlpha], glow: 1.3 });
    }

    if (!v0Node.isOccluded) {
      const p = v0Node.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 40, size: 12, thickness: 1.5, color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95] });
    }
    if (!v15Node.isOccluded) {
      const p = v15Node.position;
      ctx.reticle({ cx: p[0], cy: p[1] - 40, size: 12, thickness: 1.5, color: [lin.bone[0], lin.bone[1], lin.bone[2], 0.85] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    const title = ctx.text('tess_title', 'HYPERDIMENSIONAL TESSERACT', {
      fontSize: 48, fontWeight: 900, color: ctx.rgba('bone', 0.98), letterSpacing: 7, role: 'headline',
    }).withKnockoutHalo(4, ctx.rgba('ink', 0.95));
    const states = title.stagger(t, { unit: 'word', start: f.start + 0.15, staggerDuration: 0.6, inDuration: 0.35, motion: 'slide-up' });
    ctx.renderText('tess_title', c2d, t, 80, 120, states);

    ctx.text('tess_sub', '4D SO(4) DUAL-PLANE ROTATION · 16 VERTICES · 32 EDGES · SYNAPSE LATTICE', {
      fontSize: 14, fontWeight: 600, color: ctx.rgba('signal', 0.92), letterSpacing: 3, role: 'callout',
    }).withKnockoutHalo(2, ctx.rgba('ink', 0.9));
    const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
    ctx.renderText('tess_sub', c2d, t, 84, 175 - (1 - subEnter) * 20);

    // Live 4D rotation angles readout
    const rollAngle = ctx.text('tess_angles', '000°', {
      fontSize: 32, fontWeight: 700, color: ctx.rgba('signal', 0.95), role: 'hud',
    });
    const degXW = Math.round((thetaXW % TAU) * (180 / Math.PI));
    rollAngle.numericRoll(degXW, (n) => `θ_XW = ${n}° · θ_YZ = ${Math.round((thetaYZ % TAU) * (180 / Math.PI))}°`);
    ctx.renderText('tess_angles', c2d, t, W - 510, 135);

    const eigenText = ctx.text('tess_eigen', 'EIGENVALUES [λ₁..λ₄] REAL', {
      fontSize: 13, fontWeight: 600, color: ctx.rgba('bone', 0.8), role: 'hud',
    });
    ctx.renderText('tess_eigen', c2d, t, W - 510, 185);

    if (!v0Node.isOccluded) {
      ctx.text('tess_v0', 'V₀ [-1, -1, -1, -1]', {
        fontSize: 11, fontWeight: 600, color: ctx.rgba('signal', 0.9), letterSpacing: 1, role: 'callout',
      }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9));
      const p = v0Node.position;
      ctx.renderText('tess_v0', c2d, t, p[0] + 16, p[1] - 30);
    }

    if (!v15Node.isOccluded) {
      ctx.text('tess_v15', 'V₁₅ [+1, +1, +1, +1]', {
        fontSize: 11, fontWeight: 600, color: ctx.rgba('bone', 0.85), letterSpacing: 1, role: 'callout',
      }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9));
      const p = v15Node.position;
      ctx.renderText('tess_v15', c2d, t, p[0] + 16, p[1] + 30);
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
