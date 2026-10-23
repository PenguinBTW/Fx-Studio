// COSMIC WEB — Large-scale cosmological structure of the universe:
// Delaunay filament network connecting 36 galactic cluster nodes, dark matter halo
// particles, gravitational potential well rings, cinematic anamorphic camera flight,
// and 3D-anchored redshift telemetry tags.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

// 36 Deterministic galaxy cluster nodes in 3D space
interface ClusterNode {
  pos: [number, number, number];
  mass: number;
  name?: string;
}

const CLUSTERS: ClusterNode[] = [];
for (let i = 0; i < 36; i++) {
  const seed = Math.sin(i * 12.9898 + 45.123) * 43758.5453;
  const rnd1 = seed - Math.floor(seed);
  const seed2 = Math.sin(i * 78.233 + 12.456) * 43758.5453;
  const rnd2 = seed2 - Math.floor(seed2);
  const seed3 = Math.sin(i * 93.123 + 67.891) * 43758.5453;
  const rnd3 = seed3 - Math.floor(seed3);

  const x = (rnd1 - 0.5) * 16.0;
  const y = (rnd2 - 0.5) * 8.0;
  const z = (rnd3 - 0.5) * 20.0;
  const mass = 1.0 + rnd1 * 2.5;

  CLUSTERS.push({
    pos: [x, y, z],
    mass,
    name: i === 0 ? 'SHAPLEY ATTRACTOR' : i === 7 ? 'VIRGO SUPERCLUSTER' : i === 18 ? 'COMA CLUSTER' : undefined,
  });
}

export default defineScene({
  id: 'cosmic_web',
  rigMode: 'perspective',
  particleCapacity: 3072,
  lineCapacity: 8192,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(24);
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 3.8, -16.5], target: [0, 0.2, -2.0], roll: -0.06, focalLength: 24 },
      { t: 0.35, pos: [4.2, 1.8, -9.0], target: [1.2, 0.4, 2.0], roll: 0.08, focalLength: 30 },
      { t: 0.7, pos: [-3.5, -1.2, -1.5], target: [0, 0.2, 5.0], roll: -0.04, focalLength: 36 },
      { t: 1.0, pos: [0.0, 1.4, 6.5], target: [0, 0.5, 12.0], roll: 0.0, focalLength: 42 },
    ]);

    // Cold dark matter particulate halos
    ctx.particles.addEmitter('dark_matter_motes', {
      capacity: 1200,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 0.35,
      spread: 1.9,
      lifetime: 5.5,
      gravity: [0, -0.05, 0],
      turbulence: 0.35,
      size: 0.05,
      color: [ctx.lin.bone[0], ctx.lin.bone[1], ctx.lin.bone[2], 0.5],
      glow: 1.1,
    });

    // Galactic core luminous embers
    ctx.particles.addEmitter('galactic_cores', {
      capacity: 600,
      origin: [0, 0, 0],
      direction: [1, 0, 0],
      speed: 0.65,
      spread: 1.5,
      lifetime: 4.2,
      turbulence: 0.45,
      size: 0.08,
      color: [ctx.lin.signal[0], ctx.lin.signal[1], ctx.lin.signal[2], 0.85],
      glow: 2.2,
    });

    ctx.node('shapley_callout', { role: 'callout', size: [150, 36, 0] });
    ctx.node('virgo_callout', { role: 'callout', size: [150, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);

    ctx.lines.clear();

    // 1. Cosmic Filaments: connect clusters that are within proximity (< 5.2m)
    for (let i = 0; i < CLUSTERS.length; i++) {
      const c1 = CLUSTERS[i]!;
      for (let j = i + 1; j < CLUSTERS.length; j++) {
        const c2 = CLUSTERS[j]!;
        const dx = c2.pos[0] - c1.pos[0];
        const dy = c2.pos[1] - c1.pos[1];
        const dz = c2.pos[2] - c1.pos[2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < 5.2) {
          const proximityAlpha = Math.max(0.1, (1.0 - dist / 5.2) * 0.75);
          // Pulsing energy density along filament
          const pulse = Math.sin(t * 1.8 + i + j) * 0.2 + 0.8;
          const isMajor = c1.name || c2.name;
          const col = isMajor ? lin.signal : lin.graphite;
          ctx.lines.seg(
            c1.pos[0], c1.pos[1], c1.pos[2],
            c2.pos[0], c2.pos[1], c2.pos[2],
            isMajor ? 1.8 : 0.8,
            col[0], col[1], col[2],
            proximityAlpha * pulse,
          );
        }
      }
    }

    // 2. Gravitational Potential Well Contours around named clusters
    const majorClusters = [CLUSTERS[0]!, CLUSTERS[7]!];
    for (let m = 0; m < majorClusters.length; m++) {
      const mc = majorClusters[m]!;
      const rings = 4;
      for (let r = 1; r <= rings; r++) {
        const rad = 0.5 + r * 0.45;
        const segs = 48;
        let px = 0, py = 0, pz = 0;
        for (let s = 0; s <= segs; s++) {
          const a = (s / segs) * TAU + t * 0.3 * (m === 0 ? 1 : -1);
          const x = mc.pos[0] + Math.cos(a) * rad;
          const z = mc.pos[2] + Math.sin(a) * rad;
          const y = mc.pos[1] + Math.sin(a * 2.0) * 0.08;
          if (s > 0) {
            ctx.lines.seg(px, py, pz, x, y, z, 1.0, lin.bone[0], lin.bone[1], lin.bone[2], 0.25 / r);
          }
          px = x; py = y; pz = z;
        }
      }
    }

    // Pin 3D Callouts
    const shapleyNode = ctx.node('shapley_callout');
    shapleyNode.pinToWorldVertex(CLUSTERS[0]!.pos, ctx.threeCam, { screenOffset: [0, -50], minScale: 0.7, maxScale: 1.2 });

    const virgoNode = ctx.node('virgo_callout');
    virgoNode.pinToWorldVertex(CLUSTERS[7]!.pos, ctx.threeCam, { screenOffset: [50, 35], minScale: 0.7, maxScale: 1.2 });

    // SDF HUD & Telemetry
    ctx.sdf.clear();
    const cardSpring = ctx.motion.spring(0.12, t, { freq: 2.8, damping: 0.7, v0: 2.0 });
    const cardAlpha = Math.min(1, Math.max(0, cardSpring));
    if (cardAlpha > 0.01) {
      ctx.card('cosmic_card', {
        x: 84, y: H - 320, w: 520, h: 160,
        radius: [14, 14, 14, 14],
        fill: [lin.ink2[0], lin.ink2[1], lin.ink2[2], 0.88 * cardAlpha],
        stroke: [lin.signal[0], lin.signal[1], lin.signal[2], 0.75 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 26, color: [0, 0, 0, 0.5 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      // Redshift gauge ring (z = 6.4 down to 0.0)
      const zTrim = 1.0 - progress;
      ctx.ring({ cx: 520, cy: H - 240, radius: 38, thickness: 4.5, trim: [0, 1], color: [lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.35 * cardAlpha] });
      ctx.ring({ cx: 520, cy: H - 240, radius: 38, thickness: 4.5, trim: [0, Math.max(0.04, zTrim)], color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * cardAlpha], glow: 1.4 });
    }

    if (!shapleyNode.isOccluded) {
      const p = shapleyNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 50, size: 14, thickness: 1.5, color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95] });
    }
    if (!virgoNode.isOccluded) {
      const p = virgoNode.position;
      ctx.reticle({ cx: p[0] - 50, cy: p[1] - 35, size: 12, thickness: 1.5, color: [lin.bone[0], lin.bone[1], lin.bone[2], 0.85] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    const title = ctx.text('cosmic_title', 'THE COSMIC WEB', {
      fontSize: 54, fontWeight: 900, color: ctx.rgba('bone', 0.98), letterSpacing: 8, role: 'headline',
    }).withKnockoutHalo(4, ctx.rgba('ink', 0.95));
    const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
    ctx.renderText('cosmic_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

    ctx.text('cosmic_sub', 'LARGE-SCALE STRUCTURE · DELAUNAY FILAMENT TENSOR · COLD DARK MATTER', {
      fontSize: 14, fontWeight: 600, color: ctx.rgba('signal', 0.92), letterSpacing: 3, role: 'callout',
    }).withKnockoutHalo(2, ctx.rgba('ink', 0.9));
    const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
    ctx.renderText('cosmic_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

    // Live Redshift Telemetry
    const zRoll = ctx.text('cosmic_z', 'z = 0.00', {
      fontSize: 34, fontWeight: 700, color: ctx.rgba('signal', 0.95), role: 'hud',
    });
    const curZ = (6.4 * (1.0 - progress)).toFixed(2);
    zRoll.numericRoll(Math.round((6.4 * (1.0 - progress)) * 100), (n) => `REDSHIFT z = ${(n / 100).toFixed(2)}`);
    ctx.renderText('cosmic_z', c2d, t, 104, H - 265);

    const hubbleText = ctx.text('cosmic_h0', 'H₀ = 67.4 KM/S/MPC · Ω_M = 0.315', {
      fontSize: 14, fontWeight: 600, color: ctx.rgba('bone', 0.85), role: 'hud',
    });
    ctx.renderText('cosmic_h0', c2d, t, 104, H - 215);

    if (!shapleyNode.isOccluded) {
      ctx.text('cosmic_slabel', 'SHAPLEY ATTRACTOR · M ≈ 10¹⁶ M_☉', {
        fontSize: 12, fontWeight: 600, color: ctx.rgba('signal', 0.9), letterSpacing: 1, role: 'callout',
      }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9));
      const sp = shapleyNode.position;
      ctx.renderText('cosmic_slabel', c2d, t, sp[0] + 18, sp[1] - 40);
    }

    if (!virgoNode.isOccluded) {
      ctx.text('cosmic_vlabel', 'VIRGO SUPERCLUSTER CORE', {
        fontSize: 12, fontWeight: 600, color: ctx.rgba('bone', 0.85), letterSpacing: 1, role: 'callout',
      }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9));
      const vp = virgoNode.position;
      ctx.renderText('cosmic_vlabel', c2d, t, vp[0] + 18, vp[1] + 25);
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

    // Opening optical bloom
    if (progress < 0.15) {
      const openFlare = Math.sin((progress / 0.15) * Math.PI) * 0.45;
      return { bloom: 0.55 + openFlare * 0.5, flash: openFlare * 0.25 };
    }
  },
});
