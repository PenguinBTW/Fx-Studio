// SINGULARITY — Relativistic accretion disk, Kerr metric ergosphere,
// relativistic polar particle jets, hyperbolic spacetime curvature grid,
// swooping orbital dive camera, and 3D-anchored astrophysics callouts.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

export default defineScene({
  id: 'singularity',
  rigMode: 'perspective',
  particleCapacity: 3072,
  lineCapacity: 8192,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(32);
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 5.8, -13.5], target: [0, 0.2, 0], roll: -0.08, focalLength: 32 },
      { t: 0.38, pos: [8.8, 2.4, -9.2], target: [0, 0.3, 0], roll: 0.12, focalLength: 38 },
      { t: 0.72, pos: [2.8, -1.4, -6.8], target: [0, 0.4, 0], roll: -0.06, focalLength: 44 },
      { t: 1.0, pos: [0.0, 1.2, -4.6], target: [0, 0.5, 0], roll: 0.0, focalLength: 50 },
    ]);

    // Relativistic polar particle jets blasting outwards in +Y and -Y
    ctx.particles.addEmitter('jet_north', {
      capacity: 720,
      origin: [0, 0.4, 0],
      direction: [0, 1, 0],
      speed: 6.2,
      spread: 0.16,
      lifetime: 1.8,
      turbulence: 0.28,
      size: 0.085,
      color: [ctx.lin.signal[0], ctx.lin.signal[1], ctx.lin.signal[2], 0.95],
      glow: 2.6,
    });

    ctx.particles.addEmitter('jet_south', {
      capacity: 720,
      origin: [0, -0.4, 0],
      direction: [0, -1, 0],
      speed: 6.2,
      spread: 0.16,
      lifetime: 1.8,
      turbulence: 0.28,
      size: 0.085,
      color: [ctx.lin.signal[0], ctx.lin.signal[1], ctx.lin.signal[2], 0.95],
      glow: 2.6,
    });

    // Swirling high-velocity accretion disk plasma
    ctx.particles.addEmitter('accretion_disk', {
      capacity: 960,
      origin: [0, 0.0, 0],
      direction: [1, 0, 0],
      speed: 2.2,
      spread: 1.35,
      lifetime: 3.2,
      turbulence: 0.65,
      size: 0.14,
      color: [ctx.lin.ember[0], ctx.lin.ember[1], ctx.lin.ember[2], 0.75],
      glow: 2.0,
    });

    // Ambient interstellar quantum dust
    ctx.particles.addEmitter('quantum_dust', {
      capacity: 480,
      origin: [0, 0.0, 0],
      direction: [0, 1, 0],
      speed: 0.4,
      spread: 1.8,
      lifetime: 4.5,
      turbulence: 0.4,
      size: 0.045,
      color: [ctx.lin.bone[0], ctx.lin.bone[1], ctx.lin.bone[2], 0.45],
      glow: 1.0,
    });

    ctx.rig.addTrauma(0.55, 0.3, 1.8);
    ctx.node('horizon_callout', { role: 'callout', size: [140, 36, 0] });
    ctx.node('ergo_callout', { role: 'callout', size: [140, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);

    ctx.lines.clear();

    // 1. Spacetime curvature funnel grid: r in [0.8 .. 6.5], dipping towards center
    const radialRays = 32;
    for (let r = 0; r < radialRays; r++) {
      const theta = (r / radialRays) * TAU;
      const cosT = Math.cos(theta), sinT = Math.sin(theta);
      const steps = 24;
      let prevX = 0, prevY = 0, prevZ = 0;
      for (let s = 0; s <= steps; s++) {
        const rad = 0.9 + (s / steps) * 6.2;
        // Hyperbolic gravitational potential well depth
        const potY = -1.6 / Math.pow(rad, 0.85);
        const x = cosT * rad, z = sinT * rad, y = potY;
        if (s > 0) {
          const depthAlpha = Math.min(0.5, 0.15 + (rad / 7.0) * 0.35);
          ctx.lines.seg(prevX, prevY, prevZ, x, y, z, 1.0, lin.graphite[0], lin.graphite[1], lin.graphite[2], depthAlpha);
        }
        prevX = x; prevY = y; prevZ = z;
      }
    }

    // 2. Accretion Disk Orbit Tracks with relativistic Doppler beaming:
    // Matter moving towards the camera (+X on approach) is boosted in brightness and blueshifted to signal.
    const diskRings = 9;
    const diskSpin = t * 1.6;
    for (let d = 0; d < diskRings; d++) {
      const radius = 1.3 + d * 0.55;
      const omega = diskSpin * Math.pow(1.3 / radius, 1.5); // Keplerian differential rotation
      const segs = 80;
      let px = 0, py = 0, pz = 0;
      for (let i = 0; i <= segs; i++) {
        const phi = (i / segs) * TAU + omega;
        const x = Math.cos(phi) * radius;
        const z = Math.sin(phi) * radius;
        const y = Math.sin(phi * 2.0 + t) * 0.06; // vertical warp
        if (i > 0) {
          // Doppler beaming approximation: cos(phi) > 0 is approaching, beamed brighter
          const doppler = Math.max(0, Math.cos(phi));
          const bright = d === 2 || d === 5;
          const r = bright ? lin.signal[0] : (doppler > 0.4 ? lin.signal[0] : lin.ember[0]);
          const g = bright ? lin.signal[1] : (doppler > 0.4 ? lin.signal[1] : lin.ember[1]);
          const b = bright ? lin.signal[2] : (doppler > 0.4 ? lin.signal[2] : lin.ember[2]);
          const alpha = 0.25 + doppler * 0.65;
          ctx.lines.seg(px, py, pz, x, y, z, bright ? 2.0 : 1.2, r, g, b, alpha);
        }
        px = x; py = y; pz = z;
      }
    }

    // 3. Ergosphere & Event Horizon wireframe spheres
    const ergoLat = 10, ergoLon = 20;
    const ergoR = 1.1;
    for (let lat = 0; lat <= ergoLat; lat++) {
      const v = (lat / ergoLat) * Math.PI - Math.PI / 2;
      const cosV = Math.cos(v), sinV = Math.sin(v);
      const ringR = ergoR * cosV;
      const ringY = ergoR * sinV * 0.75; // oblate Kerr shape
      let px = 0, py = 0, pz = 0;
      for (let lon = 0; lon <= ergoLon; lon++) {
        const u = (lon / ergoLon) * TAU + t * 0.4;
        const x = Math.cos(u) * ringR;
        const z = Math.sin(u) * ringR;
        const y = ringY;
        if (lon > 0) {
          ctx.lines.seg(px, py, pz, x, y, z, 1.0, lin.bone[0], lin.bone[1], lin.bone[2], 0.3);
        }
        px = x; py = y; pz = z;
      }
    }

    // Pin callouts in 3D
    const horizonNode = ctx.node('horizon_callout');
    horizonNode.pinToWorldVertex([0, 0.4, 0], ctx.threeCam, { screenOffset: [0, -60], minScale: 0.75, maxScale: 1.2 });

    const ergoNode = ctx.node('ergo_callout');
    ergoNode.pinToWorldVertex([2.8, 0.2, 0.0], ctx.threeCam, { screenOffset: [60, -35], minScale: 0.75, maxScale: 1.2 });

    // SDF HUD & Telemetry
    ctx.sdf.clear();
    const cardSpring = ctx.motion.spring(0.12, t, { freq: 2.8, damping: 0.7, v0: 2.2 });
    const cardAlpha = Math.min(1, Math.max(0, cardSpring));
    if (cardAlpha > 0.01) {
      ctx.card('sing_card', {
        x: 80, y: H - 320, w: 520, h: 160,
        radius: [14, 14, 14, 14],
        fill: [lin.ink2[0], lin.ink2[1], lin.ink2[2], 0.88 * cardAlpha],
        stroke: [lin.signal[0], lin.signal[1], lin.signal[2], 0.75 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 28, color: [0, 0, 0, 0.55 * cardAlpha], offset: [0, 10] },
        role: 'hud', opacity: cardAlpha,
      });

      // Gauge dial for relativistic orbital velocity
      const dialTrim = ease.inOutCubic(progress);
      ctx.ring({ cx: 520, cy: H - 240, radius: 40, thickness: 4.5, trim: [0, 1], color: [lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.35 * cardAlpha] });
      ctx.ring({ cx: 520, cy: H - 240, radius: 40, thickness: 4.5, trim: [0, Math.max(0.04, dialTrim)], color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95 * cardAlpha], glow: 1.4 });
    }

    if (!horizonNode.isOccluded) {
      const p = horizonNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 60, size: 14, thickness: 1.5, color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95] });
    }
    if (!ergoNode.isOccluded) {
      const p = ergoNode.position;
      ctx.reticle({ cx: p[0] - 60, cy: p[1] + 35, size: 12, thickness: 1.5, color: [lin.bone[0], lin.bone[1], lin.bone[2], 0.85] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    const title = ctx.text('sing_title', 'QUANTUM SINGULARITY', {
      fontSize: 54, fontWeight: 900, color: ctx.rgba('bone', 0.98), letterSpacing: 8, role: 'headline',
    }).withKnockoutHalo(4, ctx.rgba('ink', 0.95));
    const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
    ctx.renderText('sing_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

    ctx.text('sing_sub', 'RELATIVISTIC ACCRETION DISK · KERR METRIC GEODESICS · POLAR JETS', {
      fontSize: 14, fontWeight: 600, color: ctx.rgba('signal', 0.92), letterSpacing: 3, role: 'callout',
    }).withKnockoutHalo(2, ctx.rgba('ink', 0.9));
    const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.12) * 2.5)));
    ctx.renderText('sing_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

    // Numeric telemetry
    const velocityRoll = ctx.text('sing_vel', '000000', {
      fontSize: 32, fontWeight: 700, color: ctx.rgba('signal', 0.95), role: 'hud',
    });
    const curVel = Math.round(210000 + progress * 88412);
    velocityRoll.numericRoll(curVel, (n) => `${n.toLocaleString()} KM/S`);
    ctx.renderText('sing_vel', c2d, t, 104, H - 265);

    const spinRoll = ctx.text('sing_spin', '0.000', {
      fontSize: 16, fontWeight: 600, color: ctx.rgba('bone', 0.85), role: 'hud',
    });
    spinRoll.numericRoll(Math.round(progress * 998), (n) => `SPIN a* = ${(n / 1000).toFixed(3)} (EXTREME KERR)`);
    ctx.renderText('sing_spin', c2d, t, 104, H - 215);

    if (!horizonNode.isOccluded) {
      ctx.text('sing_hlabel', 'EVENT HORIZON · r_s = 2GM/c²', {
        fontSize: 12, fontWeight: 600, color: ctx.rgba('signal', 0.9), letterSpacing: 1, role: 'callout',
      }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9));
      const hp = horizonNode.position;
      ctx.renderText('sing_hlabel', c2d, t, hp[0] + 18, hp[1] - 40);
    }

    if (!ergoNode.isOccluded) {
      ctx.text('sing_elabel', 'ERGOSPHERE BOUNDARY', {
        fontSize: 12, fontWeight: 600, color: ctx.rgba('bone', 0.85), letterSpacing: 1, role: 'callout',
      }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9));
      const ep = ergoNode.position;
      ctx.renderText('sing_elabel', c2d, t, ep[0] + 18, ep[1] - 20);
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

    // Opening energetic flare at t0
    const flare = Math.exp(-Math.abs(t - 0.35) * 5.0) * 0.45;
    if (flare > 0.003) {
      return {
        flash: flare * 0.6,
        bloom: 0.55 + flare * 0.65,
        ca: 1.2 + flare * 5.0,
      };
    }
  },
});
