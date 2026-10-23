// 10: STELLAR REACTOR — Dyson Swarm Megastructure & Magnetohydrodynamics
// Blistering plasma orange (#FF4500), core yellow (#FFD700), 6 concentric orbital rings,
// 8 explosive magnetic prominence loops, collimated laser transmission beams, and 3.84 x 10^26 W telemetry.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

export default defineScene({
  id: 'stellar_reactor',
  rigMode: 'perspective',
  particleCapacity: 2048,
  lineCapacity: 16384,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(24);
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 3.8, -14.5], target: [0, 0.2, 0.0], roll: -0.06, focalLength: 24 },
      { t: 0.35, pos: [6.5, 1.8, -5.0], target: [0, 0.0, 1.0], roll: 0.08, focalLength: 28 },
      { t: 0.7, pos: [2.8, -3.2, 6.5], target: [0, 0.1, 0.0], roll: -0.05, focalLength: 32 },
      { t: 1.0, pos: [-6.2, 2.4, 8.5], target: [0, 0.0, 0.0], roll: 0.03, focalLength: 36 },
    ]);

    // Coronal mass ejection plasma particles
    ctx.particles.addEmitter('coronal_plasma', {
      capacity: 550,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 0.35,
      spread: 4.5,
      lifetime: 5.5,
      gravity: [0, -0.015, 0],
      turbulence: 0.35,
      size: 0.018,
      color: [0.98, 0.32, 0.05, 0.65],
      glow: 1.5,
    });

    ctx.node('dyson_ring_a', { role: 'callout', size: [160, 36, 0] });
    ctx.node('flux_prominence', { role: 'callout', size: [160, 36, 0] });
    ctx.node('laser_relay', { role: 'callout', size: [160, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);
    ctx.lines.clear();

    // Solar Palette: Plasma Orange, Solar Yellow, Pure White Flare, Deep Corona Space
    const colOrange: [number, number, number] = [0.98, 0.32, 0.05];
    const colYellow: [number, number, number] = [0.98, 0.84, 0.08];
    const colWhite: [number, number, number] = [1.0, 1.0, 1.0];
    const colCyanBeam: [number, number, number] = [0.0, 0.95, 1.0];

    // 1. Concentric Dyson Swarm Mega-Rings (6 orbital rings with Keplerian rotation)
    interface RingDef {
      radius: number;
      tiltX: number;
      tiltZ: number;
      speed: number;
      segments: number;
      isPrimary?: boolean;
    }

    const rings: RingDef[] = [
      { radius: 4.2, tiltX: 0.26, tiltZ: 0.12, speed: 0.45, segments: 64, isPrimary: true },
      { radius: 5.8, tiltX: -0.42, tiltZ: 0.35, speed: -0.32, segments: 72 },
      { radius: 7.4, tiltX: 0.65, tiltZ: -0.25, speed: 0.22, segments: 84 },
      { radius: 9.0, tiltX: -0.20, tiltZ: 0.55, speed: -0.16, segments: 96 },
      { radius: 10.8, tiltX: 0.45, tiltZ: 0.40, speed: 0.12, segments: 108 },
      { radius: 12.6, tiltX: -0.55, tiltZ: -0.30, speed: -0.09, segments: 120 },
    ];

    for (let r = 0; r < rings.length; r++) {
      const ring = rings[r]!;
      const spin = t * ring.speed;
      const cosTX = Math.cos(ring.tiltX), sinTX = Math.sin(ring.tiltX);
      const cosTZ = Math.cos(ring.tiltZ), sinTZ = Math.sin(ring.tiltZ);

      const col = ring.isPrimary ? colYellow : colOrange;
      const alpha = ring.isPrimary ? 0.95 : 0.65;
      const width = ring.isPrimary ? 2.2 : 1.3;

      for (let s = 0; s < ring.segments; s++) {
        const a1 = (s / ring.segments) * TAU + spin;
        const a2 = ((s + 1) / ring.segments) * TAU + spin;

        const x1p = Math.cos(a1) * ring.radius, z1p = Math.sin(a1) * ring.radius;
        const x2p = Math.cos(a2) * ring.radius, z2p = Math.sin(a2) * ring.radius;

        const x1 = x1p * cosTZ;
        const y1 = x1p * sinTZ * cosTX - z1p * sinTX;
        const z1 = z1p * cosTX + x1p * sinTZ * sinTX;

        const x2 = x2p * cosTZ;
        const y2 = x2p * sinTZ * cosTX - z2p * sinTX;
        const z2 = z2p * cosTX + x2p * sinTZ * sinTX;

        ctx.lines.seg(x1, y1, z1, x2, y2, z2, width, col[0], col[1], col[2], alpha);

        // Photovoltaic collector facets
        if (s % 4 === 0) {
          const sailH = 0.35;
          ctx.lines.seg(x1, y1, z1, x1, y1 + sailH, z1, 1.4, colWhite[0], colWhite[1], colWhite[2], 0.85);
          ctx.lines.seg(x1, y1 + sailH, z1, x2, y2 + sailH, z2, 1.0, colYellow[0], colYellow[1], colYellow[2], 0.65);
        }
      }
    }

    // 2. Central Stellar Core Wireframe Sphere
    const coreR = 1.5;
    // Core latitude rings
    for (let lat = -3; lat <= 3; lat++) {
      const latAngle = (lat / 4) * (Math.PI * 0.45);
      const latR = Math.cos(latAngle) * coreR;
      const latY = Math.sin(latAngle) * coreR;
      const numSteps = 32;
      for (let st = 0; st < numSteps; st++) {
        const a1 = (st / numSteps) * TAU + t * 0.4;
        const a2 = ((st + 1) / numSteps) * TAU + t * 0.4;
        ctx.lines.seg(
          Math.cos(a1) * latR, latY, Math.sin(a1) * latR,
          Math.cos(a2) * latR, latY, Math.sin(a2) * latR,
          2.0, colYellow[0], colYellow[1], colYellow[2], 0.9
        );
      }
    }
    // Core longitude meridians
    for (let lon = 0; lon < 6; lon++) {
      const lonAngle = (lon / 6) * Math.PI + t * 0.4;
      const numSteps = 32;
      for (let st = 0; st < numSteps; st++) {
        const a1 = (st / numSteps) * TAU;
        const a2 = ((st + 1) / numSteps) * TAU;
        const x1 = Math.cos(a1) * coreR * Math.cos(lonAngle);
        const y1 = Math.sin(a1) * coreR;
        const z1 = Math.cos(a1) * coreR * Math.sin(lonAngle);
        const x2 = Math.cos(a2) * coreR * Math.cos(lonAngle);
        const y2 = Math.sin(a2) * coreR;
        const z2 = Math.cos(a2) * coreR * Math.sin(lonAngle);
        ctx.lines.seg(x1, y1, z1, x2, y2, z2, 2.0, colYellow[0], colYellow[1], colYellow[2], 0.9);
      }
    }

    // 3. 8 Arched Magnetic Plasma Prominence Loops (B-field lines)
    const numArches = 8;
    for (let a = 0; a < numArches; a++) {
      const archAngle = (a / numArches) * TAU + t * 0.15;
      const archSpan = 2.6;
      const archHeight = 3.6 + Math.sin(t * 1.5 + a) * 0.7;
      const steps = 24;

      let prevX = 0, prevY = 0, prevZ = 0;

      for (let st = 0; st <= steps; st++) {
        const u = st / steps;
        const localAngle = (u - 0.5) * Math.PI;
        const h = Math.cos(localAngle) * archHeight;
        const r = 2.2 + Math.sin(localAngle) * archSpan;

        const x = Math.cos(archAngle) * r;
        const y = h;
        const z = Math.sin(archAngle) * r;

        if (st > 0) {
          const isApex = Math.abs(u - 0.5) < 0.2;
          const col = isApex ? colWhite : colOrange;
          const width = isApex ? 2.5 : 1.4;
          ctx.lines.seg(prevX, prevY, prevZ, x, y, z, width, col[0], col[1], col[2], 0.85);
        }

        prevX = x;
        prevY = y;
        prevZ = z;
      }
    }

    // 4. Collimated Laser Energy Transmission Beams (Firing outward to deep space)
    for (let lb = 0; lb < 4; lb++) {
      const lAngle = (lb / 4) * TAU + t * 0.3;
      const lx1 = Math.cos(lAngle) * 4.2;
      const ly1 = 0.5;
      const lz1 = Math.sin(lAngle) * 4.2;
      const lx2 = Math.cos(lAngle) * 16.0;
      const ly2 = 2.0;
      const lz2 = Math.sin(lAngle) * 16.0;

      ctx.lines.seg(lx1, ly1, lz1, lx2, ly2, lz2, 2.2, colCyanBeam[0], colCyanBeam[1], colCyanBeam[2], 0.85);
    }

    // Pin Callouts
    const ringNode = ctx.node('dyson_ring_a');
    ringNode.pinToWorldVertex([4.2, 0.8, 0], ctx.threeCam, { screenOffset: [0, -35], minScale: 0.7, maxScale: 1.2 });
    const fluxNode = ctx.node('flux_prominence');
    fluxNode.pinToWorldVertex([0, 3.8, 0], ctx.threeCam, { screenOffset: [35, -20], minScale: 0.7, maxScale: 1.2 });
    const laserNode = ctx.node('laser_relay');
    laserNode.pinToWorldVertex([8.0, 1.2, 0], ctx.threeCam, { screenOffset: [35, 20], minScale: 0.7, maxScale: 1.2 });

    // Overlay Ducking
    const textDuck = Math.min(
      Math.min(1, Math.max(0, f.p / 0.08)),
      Math.min(1, Math.max(0, (1.0 - f.p) / 0.08))
    );

    // 2D Vector UI
    ctx.sdf.clear();
    const cardAlpha = Math.min(1, Math.max(0, ease.outExpo(Math.min(1, progress * 4.0)))) * textDuck;
    if (cardAlpha > 0.01) {
      ctx.card('stellar_card', {
        x: W - 530, y: 84, w: 450, h: 185,
        radius: [12, 12, 12, 12],
        fill: [0.12, 0.06, 0.02, 0.88 * cardAlpha],
        stroke: [colOrange[0], colOrange[1], colOrange[2], 0.8 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 24, color: [0, 0, 0, 0.65 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      // Power harvest percentage dial
      ctx.ring({ cx: W - 130, cy: 175, radius: 36, thickness: 4.5, trim: [0, 1], color: [0.35, 0.15, 0.05, 0.35 * cardAlpha] });
      ctx.ring({
        cx: W - 130, cy: 175, radius: 36, thickness: 4.5,
        trim: [0, 0.94],
        color: [colYellow[0], colYellow[1], colYellow[2], 0.95 * cardAlpha],
        glow: 1.5,
      });
    }

    if (!ringNode.isOccluded && textDuck > 0.1) {
      const p = ringNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 45, size: 12, thickness: 1.5, color: [colYellow[0], colYellow[1], colYellow[2], 0.95 * textDuck] });
    }
    if (!fluxNode.isOccluded && textDuck > 0.1) {
      const p = fluxNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 35, size: 12, thickness: 1.5, color: [colOrange[0], colOrange[1], colOrange[2], 0.95 * textDuck] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      const title = ctx.text('stel_title', 'STELLAR DYSON SWARM', {
        fontSize: 48, fontWeight: 900, color: `rgba(255, 245, 230, ${0.98 * textDuck})`, letterSpacing: 8, role: 'headline',
      }).withKnockoutHalo(4, `rgba(10, 10, 14, ${0.95 * textDuck})`);
      const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
      ctx.renderText('stel_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

      ctx.text('stel_sub', 'KARDASHEV TYPE II CONVERTER · HELIOPAUSE FLUX CAPTURE · 6 CONCENTRIC ORBITAL RINGS', {
        fontSize: 14, fontWeight: 600, color: `rgba(251, 146, 60, ${0.92 * textDuck})`, letterSpacing: 3, role: 'callout',
      }).withKnockoutHalo(2, `rgba(10, 10, 14, ${0.9 * textDuck})`);
      const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
      ctx.renderText('stel_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

      // Power harvest readout
      const harvestRoll = ctx.text('stel_harv', '3.8 x 10²⁶ W', {
        fontSize: 32, fontWeight: 700, color: `rgba(251, 191, 36, ${0.95 * textDuck})`, role: 'hud',
      });
      harvestRoll.numericRoll(38, (n) => `HARVEST: ${(n / 10).toFixed(1)} × 10²⁶ W`);
      ctx.renderText('stel_harv', c2d, t, W - 500, 140);

      const ringText = ctx.text('stel_rings', 'SWARM COMPLETION: 42.7% · 5,778 K PHOTOSPHERE', {
        fontSize: 12, fontWeight: 600, color: `rgba(254, 215, 170, ${0.85 * textDuck})`, role: 'hud',
      });
      ctx.renderText('stel_rings', c2d, t, W - 500, 195);

      if (!ringNode.isOccluded) {
        ctx.text('stel_ring_lbl', 'PRIMARY ORBITAL COLLECTOR RING [4.2 AU]', {
          fontSize: 12, fontWeight: 600, color: `rgba(251, 191, 36, ${0.95 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(10, 10, 14, ${0.9 * textDuck})`);
        const rp = ringNode.position;
        ctx.renderText('stel_ring_lbl', c2d, t, rp[0] + 16, rp[1] - 32);
      }

      if (!fluxNode.isOccluded) {
        ctx.text('stel_flux_lbl', 'MAGNETIC PROMINENCE LOOP [4500 TESLA]', {
          fontSize: 12, fontWeight: 600, color: `rgba(249, 115, 22, ${0.95 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(10, 10, 14, ${0.9 * textDuck})`);
        const fp = fluxNode.position;
        ctx.renderText('stel_flux_lbl', c2d, t, fp[0] + 16, fp[1] - 32);
      }
    }

    // Compositing with Dark Corona Space Backdrop (#0A0A0E)
    ctx.compositor.clear();
    ctx.compositor.createLayer('space_backdrop', {
      render: (target) => {
        renderer.setRenderTarget(target);
        if (typeof (renderer as any).setClearColor === 'function') {
          (renderer as any).setClearColor(0x0A0A0E, 1.0);
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

    return { bloom: 0.65, ca: 0.8 };
  },
});
