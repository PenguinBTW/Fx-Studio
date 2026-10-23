// 09: SYNTHWAVE HIGHWAY — Retro-Future Cyber Highway & Fiber Solitons
// Deep cyber purple backdrop (#120324), hot neon magenta (#FF007F), electric cyan (#00F0FF),
// centered horizon wireframe sun with Venetian blind slats, cyberpunk skyscraper skyline,
// speeding cyber-runner vehicle silhouette with trailing light ribbons, and 800 Tb/s telemetry.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

const NUM_CABLES = 12;
const CANYON_LENGTH = 48.0;

export default defineScene({
  id: 'synthwave_highway',
  rigMode: 'perspective',
  particleCapacity: 2048,
  lineCapacity: 16384,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(24);
    // Centered, dynamic rushing perspective along the highway corridor
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 1.8, -16.0], target: [0.0, 1.2, 25.0], roll: 0.0, focalLength: 24 },
      { t: 0.35, pos: [1.2, 1.5, -4.0], target: [0.0, 1.4, 30.0], roll: 0.04, focalLength: 26 },
      { t: 0.7, pos: [-1.2, 1.4, 8.0], target: [0.0, 1.3, 35.0], roll: -0.04, focalLength: 28 },
      { t: 1.0, pos: [0.0, 2.0, 20.0], target: [0.0, 1.5, 42.0], roll: 0.0, focalLength: 30 },
    ]);

    // High-speed optical soliton photon packets along the highway
    ctx.particles.addEmitter('soliton_stream', {
      capacity: 550,
      origin: [0, 0.8, -10.0],
      direction: [0, 0, 1],
      speed: 2.8,
      spread: 1.2,
      lifetime: 4.5,
      gravity: [0, 0, 0.05],
      turbulence: 0.2,
      size: 0.016,
      color: [1.0, 0.0, 0.50, 0.75],
      glow: 1.8,
    });

    ctx.node('cyber_runner', { role: 'callout', size: [160, 36, 0] });
    ctx.node('horizon_sun', { role: 'callout', size: [160, 36, 0] });
    ctx.node('repeater_alpha', { role: 'callout', size: [160, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);
    ctx.lines.clear();

    // Synthwave Palette: Hot Magenta, Electric Cyan, Sunset Orange, Cyber Purple
    const colMagenta: [number, number, number] = [1.0, 0.0, 0.50];
    const colCyan: [number, number, number] = [0.0, 0.94, 1.0];
    const colOrange: [number, number, number] = [0.98, 0.52, 0.12];
    const colPurple: [number, number, number] = [0.38, 0.12, 0.58];
    const colRedLight: [number, number, number] = [1.0, 0.15, 0.15];

    // 1. Rushing Perspective Cyber Highway Ground Grid
    const gridHalfW = 14.0;
    const gridSpacing = 1.2;
    const gridSpeed = 22.0;
    const gridZOffset = (t * gridSpeed) % gridSpacing;
    const floorY = -1.4;

    // Longitudinal grid lines rushing towards horizon
    for (let x = -gridHalfW; x <= gridHalfW; x += gridSpacing) {
      const isCenter = Math.abs(x) < 0.1;
      const isLaneBorder = Math.abs(Math.abs(x) - 2.4) < 0.1;
      const alpha = Math.max(0, 0.70 - Math.abs(x) / 18.0);
      const col = isCenter ? colMagenta : isLaneBorder ? colCyan : colPurple;
      const w = (isCenter || isLaneBorder) ? 1.8 : 0.9;
      ctx.lines.seg(x, floorY, -20.0, x, floorY, 45.0, w, col[0], col[1], col[2], alpha);
    }
    // Lateral grid crossbars
    for (let z = -20.0; z <= 45.0; z += gridSpacing) {
      const zPos = z + gridZOffset;
      const alpha = Math.max(0, 0.55 - Math.abs(zPos - 10.0) / 32.0);
      ctx.lines.seg(-gridHalfW, floorY, zPos, gridHalfW, floorY, zPos, 0.9, colPurple[0], colPurple[1], colPurple[2], alpha);
    }

    // Glowing dashed center highway road dividers
    for (let d = -15.0; d <= 40.0; d += 3.6) {
      const dz = d + ((t * gridSpeed) % 3.6);
      ctx.lines.seg(0, floorY + 0.02, dz, 0, floorY + 0.02, dz + 1.8, 2.5, colMagenta[0], colMagenta[1], colMagenta[2], 0.95);
    }

    // 2. Centered Monumental Retro Wireframe Sun on the Horizon
    const sunZ = 46.0, sunY = 4.2, sunR = 6.2;
    const numSunRings = 28;
    for (let sr = 0; sr < numSunRings; sr++) {
      const sY = sunY - sunR + (sr / (numSunRings - 1)) * (sunR * 2.0);
      const dy = sY - sunY;
      if (Math.abs(dy) < sunR) {
        const halfSpan = Math.sqrt(sunR * sunR - dy * dy);
        // Venetian blind gap effect
        const blindGap = (dy < 0 && sr % 2 === 0);
        if (!blindGap) {
          const u = (sY - (sunY - sunR)) / (sunR * 2.0);
          const cr = colMagenta[0] * (1.0 - u) + colOrange[0] * u;
          const cg = colMagenta[1] * (1.0 - u) + colOrange[1] * u;
          const cb = colMagenta[2] * (1.0 - u) + colOrange[2] * u;
          ctx.lines.seg(-halfSpan, sY, sunZ, halfSpan, sY, sunZ, 2.4, cr, cg, cb, 0.95);
        }
      }
    }
    // Sun perimeter halo circle
    for (let st = 0; st < 64; st++) {
      const a1 = (st / 64) * TAU, a2 = ((st + 1) / 64) * TAU;
      ctx.lines.seg(
        Math.cos(a1) * sunR, sunY + Math.sin(a1) * sunR, sunZ,
        Math.cos(a2) * sunR, sunY + Math.sin(a2) * sunR, sunZ,
        2.6, colOrange[0], colOrange[1], colOrange[2], 0.95
      );
    }

    // 3. Cyberpunk Skyscraper Skyline Silhouettes (Spanning Horizon beneath the Sun)
    const skyZ = 42.0;
    const numTowers = 16;
    for (let tw = 0; tw < numTowers; tw++) {
      const twX = -12.0 + (tw / (numTowers - 1)) * 24.0;
      // Skip center slot so sun center is clear
      if (Math.abs(twX) < 2.0) continue;
      const twW = 0.9;
      const twH = 1.2 + Math.abs(Math.sin(tw * 2.3)) * 3.4;
      const topY = floorY + twH;

      // Tower box wireframe
      ctx.lines.seg(twX - twW, floorY, skyZ, twX - twW, topY, skyZ, 1.4, colPurple[0], colPurple[1], colPurple[2], 0.75);
      ctx.lines.seg(twX + twW, floorY, skyZ, twX + twW, topY, skyZ, 1.4, colPurple[0], colPurple[1], colPurple[2], 0.75);
      ctx.lines.seg(twX - twW, topY, skyZ, twX + twW, topY, skyZ, 1.4, colPurple[0], colPurple[1], colPurple[2], 0.75);

      // Antenna beacon
      if (twH > 2.5) {
        ctx.lines.seg(twX, topY, skyZ, twX, topY + 0.8, skyZ, 1.2, colCyan[0], colCyan[1], colCyan[2], 0.9);
      }
    }

    // 4. Low-Poly Neon Mountain Ridges Flanking Both Sides
    const mtnSteps = 18;
    for (let side of [-1, 1]) {
      const mtnBaseX = side * 14.0;
      for (let ms = 0; ms < mtnSteps; ms++) {
        const mz1 = -18.0 + ms * 3.5;
        const mz2 = mz1 + 3.5;
        const my1 = floorY + Math.sin(ms * 1.3) * 2.4 + 1.4;
        const my2 = floorY + Math.sin((ms + 1) * 1.3) * 2.4 + 1.4;
        const mx1 = mtnBaseX + Math.sin(ms * 0.9) * 2.5;
        const mx2 = mtnBaseX + Math.sin((ms + 1) * 0.9) * 2.5;

        // Mountain ridge line
        ctx.lines.seg(mx1, my1, mz1, mx2, my2, mz2, 1.8, colCyan[0], colCyan[1], colCyan[2], 0.85);
        // Slope lines down to floor
        ctx.lines.seg(mx1, my1, mz1, side * 18.0, floorY, mz1, 1.0, colPurple[0], colPurple[1], colPurple[2], 0.45);
      }
    }

    // 5. Speeding Cyber-Runner Vehicle Silhouette in Center Lane
    const carZ = ctx.threeCam.position.z + 6.5;
    const carX = Math.sin(t * 1.2) * 0.4;
    const carY = floorY + 0.18;
    const carW = 0.75, carL = 1.6, carH = 0.35;

    // Wedge chassis
    ctx.lines.seg(carX - carW * 0.5, carY, carZ - carL * 0.5, carX + carW * 0.5, carY, carZ - carL * 0.5, 2.2, colCyan[0], colCyan[1], colCyan[2], 0.95);
    ctx.lines.seg(carX + carW * 0.5, carY, carZ - carL * 0.5, carX + carW * 0.4, carY, carZ + carL * 0.5, 2.2, colCyan[0], colCyan[1], colCyan[2], 0.95);
    ctx.lines.seg(carX + carW * 0.4, carY, carZ + carL * 0.5, carX - carW * 0.4, carY, carZ + carL * 0.5, 2.2, colCyan[0], colCyan[1], colCyan[2], 0.95);
    ctx.lines.seg(carX - carW * 0.4, carY, carZ + carL * 0.5, carX - carW * 0.5, carY, carZ - carL * 0.5, 2.2, colCyan[0], colCyan[1], colCyan[2], 0.95);

    // Fastback roofline
    ctx.lines.seg(carX - carW * 0.3, carY + carH, carZ, carX + carW * 0.3, carY + carH, carZ, 1.8, colMagenta[0], colMagenta[1], colMagenta[2], 0.95);
    ctx.lines.seg(carX - carW * 0.5, carY, carZ - carL * 0.5, carX - carW * 0.3, carY + carH, carZ, 1.8, colMagenta[0], colMagenta[1], colMagenta[2], 0.95);
    ctx.lines.seg(carX + carW * 0.5, carY, carZ - carL * 0.5, carX + carW * 0.3, carY + carH, carZ, 1.8, colMagenta[0], colMagenta[1], colMagenta[2], 0.95);

    // Glowing Horizontal Red LED Taillight Bar
    ctx.lines.seg(carX - carW * 0.48, carY + 0.12, carZ - carL * 0.5, carX + carW * 0.48, carY + 0.12, carZ - carL * 0.5, 3.2, colRedLight[0], colRedLight[1], colRedLight[2], 1.0);

    // Trailing Red Taillight Ribbon Streaks
    for (const side of [-1, 1]) {
      const tx = carX + side * carW * 0.42;
      const ty = carY + 0.12;
      ctx.lines.seg(tx, ty, carZ - carL * 0.5, tx, ty, carZ - carL * 0.5 - 3.8, 2.4, colRedLight[0], colRedLight[1], colRedLight[2], 0.75);
    }

    // 6. 12 Overhead Fiber-Optic Cable Arches / Neon Gantries
    for (let c = 0; c < NUM_CABLES; c++) {
      const angle = (c / NUM_CABLES) * TAU;
      const archRadiusX = 4.8 + Math.cos(angle) * 1.5;
      const archRadiusY = 2.6 + Math.sin(angle) * 1.2;
      const numSegs = 32;

      let prevX = 0, prevY = 0, prevZ = 0;

      for (let s = 0; s < numSegs; s++) {
        const u = s / (numSegs - 1);
        const z = (u - 0.5) * CANYON_LENGTH;

        const undulatingWave = Math.sin(z * 0.22 + c * 0.5) * 0.6;
        const x = Math.cos(angle) * archRadiusX;
        const y = Math.sin(angle) * archRadiusY + undulatingWave + 0.8;

        if (s > 0) {
          const pulsePhase = (z - t * 16.0) % 8.0;
          const solitonGlow = Math.exp(-Math.pow(pulsePhase, 2) * 2.0);

          const isCore = c % 2 === 0;
          const col = isCore ? colMagenta : colCyan;
          const width = 1.2 + solitonGlow * 2.2;
          const alpha = 0.45 + solitonGlow * 0.55;

          ctx.lines.seg(prevX, prevY, prevZ, x, y, z, width, col[0], col[1], col[2], alpha);
        }

        prevX = x;
        prevY = y;
        prevZ = z;
      }
    }

    // Pin Callouts
    const carNode = ctx.node('cyber_runner');
    carNode.pinToWorldVertex([carX, carY + carH, carZ], ctx.threeCam, { screenOffset: [0, -35], minScale: 0.7, maxScale: 1.2 });
    const sunNode = ctx.node('horizon_sun');
    sunNode.pinToWorldVertex([0.0, sunY, sunZ], ctx.threeCam, { screenOffset: [0, -45], minScale: 0.7, maxScale: 1.2 });
    const repNode = ctx.node('repeater_alpha');
    repNode.pinToWorldVertex([-3.5, 2.5, 0.0], ctx.threeCam, { screenOffset: [-35, -20], minScale: 0.7, maxScale: 1.2 });

    // Overlay Ducking
    const textDuck = Math.min(
      Math.min(1, Math.max(0, f.p / 0.08)),
      Math.min(1, Math.max(0, (1.0 - f.p) / 0.08))
    );

    // 2D Vector UI
    ctx.sdf.clear();
    const cardAlpha = Math.min(1, Math.max(0, ease.outExpo(Math.min(1, progress * 4.0)))) * textDuck;
    if (cardAlpha > 0.01) {
      ctx.card('synth_card', {
        x: W - 530, y: 84, w: 450, h: 185,
        radius: [12, 12, 12, 12],
        fill: [0.10, 0.04, 0.18, 0.88 * cardAlpha],
        stroke: [colMagenta[0], colMagenta[1], colMagenta[2], 0.8 * cardAlpha],
        strokeWidth: 2.0,
        shadow: { blur: 24, color: [0, 0, 0, 0.65 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      // Data Soliton Throughput dial
      ctx.ring({ cx: W - 130, cy: 175, radius: 36, thickness: 4.5, trim: [0, 1], color: [0.3, 0.1, 0.4, 0.35 * cardAlpha] });
      ctx.ring({
        cx: W - 130, cy: 175, radius: 36, thickness: 4.5,
        trim: [0, 0.88],
        color: [colMagenta[0], colMagenta[1], colMagenta[2], 0.95 * cardAlpha],
        glow: 1.5,
      });
    }

    if (!carNode.isOccluded && textDuck > 0.1) {
      const p = carNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 35, size: 12, thickness: 1.5, color: [colCyan[0], colCyan[1], colCyan[2], 0.95 * textDuck] });
    }
    if (!sunNode.isOccluded && textDuck > 0.1) {
      const p = sunNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 45, size: 12, thickness: 1.5, color: [colOrange[0], colOrange[1], colOrange[2], 0.95 * textDuck] });
    }

    // 2D Typography
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      const title = ctx.text('synth_title', 'SYNTHWAVE DATA HIGHWAY', {
        fontSize: 48, fontWeight: 900, color: `rgba(255, 240, 250, ${0.98 * textDuck})`, letterSpacing: 8, role: 'headline',
      }).withKnockoutHalo(4, `rgba(18, 3, 36, ${0.95 * textDuck})`);
      const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
      ctx.renderText('synth_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

      ctx.text('synth_sub', 'TRANS-PACIFIC OPTICAL BACKBONE · 800 TB/S SOLITON TRANSMISSION · C-BAND DWDM', {
        fontSize: 14, fontWeight: 600, color: `rgba(255, 0, 127, ${0.92 * textDuck})`, letterSpacing: 3, role: 'callout',
      }).withKnockoutHalo(2, `rgba(18, 3, 36, ${0.9 * textDuck})`);
      const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
      ctx.renderText('synth_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

      // Data Throughput Readout
      const rateRoll = ctx.text('synth_rate', '800 TB/S', {
        fontSize: 32, fontWeight: 700, color: `rgba(255, 0, 127, ${0.95 * textDuck})`, role: 'hud',
      });
      rateRoll.numericRoll(800, (n) => `THROUGHPUT: ${n} TB/S`);
      ctx.renderText('synth_rate', c2d, t, W - 500, 140);

      const edfaText = ctx.text('synth_edfa', 'EDFA OPTICAL GAIN: +24.5 dB · BER: 10⁻¹² [ERROR FREE]', {
        fontSize: 12, fontWeight: 600, color: `rgba(240, 171, 252, ${0.85 * textDuck})`, role: 'hud',
      });
      ctx.renderText('synth_edfa', c2d, t, W - 500, 195);

      if (!carNode.isOccluded) {
        ctx.text('synth_car_lbl', 'CYBER-RUNNER VEHICLE [240 KM/H]', {
          fontSize: 12, fontWeight: 600, color: `rgba(0, 240, 255, ${0.95 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(18, 3, 36, ${0.9 * textDuck})`);
        const cp = carNode.position;
        ctx.renderText('synth_car_lbl', c2d, t, cp[0] + 16, cp[1] - 32);
      }

      if (!sunNode.isOccluded) {
        ctx.text('synth_sun_lbl', 'HORIZON NEON SUN · VENETIAN MASK', {
          fontSize: 12, fontWeight: 600, color: `rgba(249, 115, 22, ${0.95 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(18, 3, 36, ${0.9 * textDuck})`);
        const sp = sunNode.position;
        ctx.renderText('synth_sun_lbl', c2d, t, sp[0] + 16, sp[1] - 32);
      }
    }

    // Compositing with Deep Cyber Purple Backdrop (#120324)
    ctx.compositor.clear();
    ctx.compositor.createLayer('cyber_backdrop', {
      render: (target) => {
        renderer.setRenderTarget(target);
        if (typeof (renderer as any).setClearColor === 'function') {
          (renderer as any).setClearColor(0x120324, 1.0);
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

    return { bloom: 0.55, ca: 0.9 };
  },
});
