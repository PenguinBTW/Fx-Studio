// QUANTUM LATTICE — Superconducting quantum processor: coplanar waveguide resonators,
// microwave pulse packets, transmon qubit couplers, dual-mode camera flight,
// cryogenic dilution temperature gauges (15 mK), and Bloch sphere telemetry.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

export default defineScene({
  id: 'quantum_lattice',
  rigMode: 'perspective',
  particleCapacity: 3072,
  lineCapacity: 8192,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(36);
    ctx.rig.setPath([
      { t: 0.0, pos: [-6.5, 4.8, -8.5], target: [0, 0, 0], roll: -0.05, focalLength: 36 },
      { t: 0.4, pos: [0.0, 3.2, -9.5], target: [0, 0, 0], roll: 0.06, focalLength: 42 },
      { t: 0.75, pos: [5.8, 2.2, -6.8], target: [0, 0.2, 0], roll: -0.04, focalLength: 48 },
      { t: 1.0, pos: [0.0, 1.6, -5.2], target: [0, 0.2, 0], roll: 0.0, focalLength: 54 },
    ]);

    // Coherent microwave drive pulses propagating through waveguides
    ctx.particles.addEmitter('microwave_photons', {
      capacity: 1200,
      origin: [-4.0, 0.0, 0.0],
      direction: [1, 0, 0],
      speed: 4.8,
      spread: 0.08,
      lifetime: 1.8,
      gravity: [0, 0, 0],
      turbulence: 0.1,
      size: 0.065,
      color: [ctx.lin.signal[0], ctx.lin.signal[1], ctx.lin.signal[2], 0.95],
      glow: 2.5,
    });

    // Quantum phase fluctuations / motes
    ctx.particles.addEmitter('quantum_vacuum', {
      capacity: 800,
      origin: [0, 0.5, 0],
      direction: [0, 1, 0],
      speed: 0.45,
      spread: 1.6,
      lifetime: 3.8,
      turbulence: 0.45,
      size: 0.04,
      color: [ctx.lin.bone[0], ctx.lin.bone[1], ctx.lin.bone[2], 0.5],
      glow: 1.2,
    });

    ctx.node('qubit_q0', { role: 'callout', size: [140, 34, 0] });
    ctx.node('resonator_r0', { role: 'callout', size: [140, 34, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);

    ctx.lines.clear();

    // 1. Coplanar Waveguide Resonators (meandering transmission lines on ground plane)
    const meanders = 6;
    for (let m = 0; m < meanders; m++) {
      const mz = -3.0 + m * 1.2;
      const wavePhase = t * 6.0 + m * 0.8;
      const pts = 80;
      let px = 0, py = 0, pz = 0;
      for (let i = 0; i <= pts; i++) {
        const u = i / pts;
        const x = -4.5 + u * 9.0;
        // Meandering snake curve + microwave standing wave
        const meanderY = Math.sin(u * TAU * 3.5) * 0.35;
        const waveStanding = Math.sin(u * Math.PI * 4.0) * Math.sin(wavePhase) * 0.15;
        const y = meanderY + waveStanding;
        const z = mz;

        if (i > 0) {
          const isExcited = Math.abs(waveStanding) > 0.08;
          const col = isExcited ? lin.signal : lin.bone;
          const alpha = isExcited ? 0.9 : 0.4;
          ctx.lines.seg(px, py, pz, x, y, z, isExcited ? 2.0 : 1.2, col[0], col[1], col[2], alpha);
        }
        px = x; py = y; pz = z;
      }
    }

    // 2. Transmon Qubit Capacitor Pads (4x2 lattice of cross-shaped pads)
    for (let gx = -2; gx <= 2; gx++) {
      for (let gz = -1; gz <= 1; gz++) {
        const qx = gx * 1.8;
        const qz = gz * 2.2;
        const padSize = 0.35;

        // Cross pad in line segments
        ctx.lines.seg(qx - padSize, 0, qz, qx + padSize, 0, qz, 2.0, lin.signal[0], lin.signal[1], lin.signal[2], 0.85);
        ctx.lines.seg(qx, 0, qz - padSize, qx, 0, qz + padSize, 2.0, lin.signal[0], lin.signal[1], lin.signal[2], 0.85);

        // Ground shield box around qubit
        const boxSize = 0.6;
        ctx.lines.seg(qx - boxSize, 0, qz - boxSize, qx + boxSize, 0, qz - boxSize, 1.0, lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.4);
        ctx.lines.seg(qx + boxSize, 0, qz - boxSize, qx + boxSize, 0, qz + boxSize, 1.0, lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.4);
        ctx.lines.seg(qx + boxSize, 0, qz + boxSize, qx - boxSize, 0, qz + boxSize, 1.0, lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.4);
        ctx.lines.seg(qx - boxSize, 0, qz + boxSize, qx - boxSize, 0, qz - boxSize, 1.0, lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.4);
      }
    }

    // 3. 3D Bloch Sphere Wireframe at Center
    const blochR = 0.95;
    const blochX = 0.0, blochY = 1.2, blochZ = 0.0;
    const rings = 3;
    for (let br = 0; br < rings; br++) {
      const segs = 60;
      let px = 0, py = 0, pz = 0;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * TAU;
        let x = 0, y = 0, z = 0;
        if (br === 0) { x = Math.cos(a) * blochR; z = Math.sin(a) * blochR; } // Equator
        else if (br === 1) { x = Math.cos(a) * blochR; y = Math.sin(a) * blochR; } // X-Y meridian
        else { z = Math.cos(a) * blochR; y = Math.sin(a) * blochR; } // Z-Y meridian
        x += blochX; y += blochY; z += blochZ;
        if (i > 0) ctx.lines.seg(px, py, pz, x, y, z, 1.2, lin.bone[0], lin.bone[1], lin.bone[2], 0.45);
        px = x; py = y; pz = z;
      }
    }

    // Precessing State Vector needle inside Bloch Sphere
    const spinTheta = Math.sin(t * 1.5) * 0.8 + 0.8;
    const spinPhi = t * 2.8;
    const needleX = blochX + blochR * Math.sin(spinTheta) * Math.cos(spinPhi);
    const needleY = blochY + blochR * Math.cos(spinTheta);
    const needleZ = blochZ + blochR * Math.sin(spinTheta) * Math.sin(spinPhi);
    ctx.lines.seg(blochX, blochY, blochZ, needleX, needleY, needleZ, 2.4, lin.signal[0], lin.signal[1], lin.signal[2], 1.0);

    // Pin 3D Callouts
    const q0Node = ctx.node('qubit_q0');
    q0Node.pinToWorldVertex([-1.8, 0, 0], ctx.threeCam, { screenOffset: [-50, -45], minScale: 0.7, maxScale: 1.2 });

    const r0Node = ctx.node('resonator_r0');
    r0Node.pinToWorldVertex([0, blochY + blochR, 0], ctx.threeCam, { screenOffset: [0, -50], minScale: 0.7, maxScale: 1.2 });

    // SDF HUD
    ctx.sdf.clear();
    const cardSpring = ctx.motion.spring(0.12, t, { freq: 3.0, damping: 0.7, v0: 2.0 });
    const cardAlpha = Math.min(1, Math.max(0, cardSpring));
    if (cardAlpha > 0.01) {
      ctx.card('quant_card', {
        x: W - 540, y: 84, w: 460, h: 170,
        radius: [14, 14, 14, 14],
        fill: [lin.ink2[0], lin.ink2[1], lin.ink2[2], 0.88 * cardAlpha],
        stroke: [lin.signal[0], lin.signal[1], lin.signal[2], 0.75 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 26, color: [0, 0, 0, 0.55 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      // Gauge dial for Cryogenic temperature (15 mK)
      ctx.ring({ cx: W - 140, cy: 168, radius: 36, thickness: 4, trim: [0, 1], color: [lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.35 * cardAlpha] });
      ctx.ring({ cx: W - 140, cy: 168, radius: 36, thickness: 4, trim: [0, Math.max(0.04, progress)], color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * cardAlpha], glow: 1.3 });
    }

    if (!q0Node.isOccluded) {
      const p = q0Node.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 45, size: 12, thickness: 1.5, color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95] });
    }
    if (!r0Node.isOccluded) {
      const p = r0Node.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 50, size: 14, thickness: 1.5, color: [lin.bone[0], lin.bone[1], lin.bone[2], 0.85] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    const title = ctx.text('quant_title', 'QUANTUM LATTICE', {
      fontSize: 52, fontWeight: 900, color: ctx.rgba('bone', 0.98), letterSpacing: 8, role: 'headline',
    }).withKnockoutHalo(4, ctx.rgba('ink', 0.95));
    const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
    ctx.renderText('quant_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

    ctx.text('quant_sub', 'SUPERCONDUCTING TRANSMON PROCESSOR · CAVITY QED · COPLANAR RESONATORS', {
      fontSize: 14, fontWeight: 600, color: ctx.rgba('signal', 0.92), letterSpacing: 3, role: 'callout',
    }).withKnockoutHalo(2, ctx.rgba('ink', 0.9));
    const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
    ctx.renderText('quant_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

    // Live Telemetry
    const tempRoll = ctx.text('quant_temp', '15.2 MK', {
      fontSize: 32, fontWeight: 700, color: ctx.rgba('signal', 0.95), role: 'hud',
    });
    tempRoll.numericRoll(15, (n) => `TEMP: ${n} MK (BASE STAGE)`);
    ctx.renderText('quant_temp', c2d, t, W - 510, 140);

    const fidelityText = ctx.text('quant_fid', 'T₁ = 124 µS · 2Q GATE FIDELITY: 99.94%', {
      fontSize: 13, fontWeight: 600, color: ctx.rgba('bone', 0.85), role: 'hud',
    });
    ctx.renderText('quant_fid', c2d, t, W - 510, 190);

    if (!q0Node.isOccluded) {
      ctx.text('quant_q0label', 'TRANSMON QUBIT Q₀', {
        fontSize: 12, fontWeight: 600, color: ctx.rgba('signal', 0.9), letterSpacing: 1, role: 'callout',
      }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9));
      const qp = q0Node.position;
      ctx.renderText('quant_q0label', c2d, t, qp[0] + 16, qp[1] - 30);
    }

    if (!r0Node.isOccluded) {
      ctx.text('quant_r0label', 'BLOCH STATE VECTOR |Ψ⟩', {
        fontSize: 12, fontWeight: 600, color: ctx.rgba('bone', 0.85), letterSpacing: 1, role: 'callout',
      }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9));
      const rp = r0Node.position;
      ctx.renderText('quant_r0label', c2d, t, rp[0] + 16, rp[1] - 35);
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
