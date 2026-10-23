// 05: RETRO PHOSPHOR CRT — Cyberpunk Terminal & Vector Radar
// Charcoal CRT tube glass (#060B06), glowing phosphor green (#22C55E), tactical amber (#F59E0B),
// 360-degree rotating vector radar sweep, coastal vector map, 10 tactical air targets with velocity leaders,
// sector threat telemetry, and CRT raster scanlines.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

const NUM_RINGS = 6;
const NUM_TARGETS = 10;

export default defineScene({
  id: 'retro_phosphor_crt',
  rigMode: 'perspective',
  particleCapacity: 2048,
  lineCapacity: 16384,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(35);
    ctx.rig.setPath([
      { t: 0.0, pos: [0.0, 0.0, -10.0], target: [0, 0, 0], roll: 0, focalLength: 35 },
      { t: 0.5, pos: [2.5, 1.2, -8.0], target: [0.2, 0.1, 0], roll: 0.04, focalLength: 40 },
      { t: 1.0, pos: [-2.0, -0.8, -6.5], target: [0, 0, 0], roll: -0.02, focalLength: 42 },
    ]);

    // Phosphor glow ionization sparks
    ctx.particles.addEmitter('crt_phosphors', {
      capacity: 400,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 0.10,
      spread: 3.5,
      lifetime: 5.0,
      turbulence: 0.2,
      size: 0.014,
      color: [0.13, 0.77, 0.37, 0.35],
      glow: 1.2,
    });

    ctx.node('radar_origin', { role: 'callout', size: [160, 36, 0] });
    ctx.node('target_alpha', { role: 'callout', size: [160, 36, 0] });
    ctx.node('target_hostile', { role: 'callout', size: [160, 36, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);
    ctx.lines.clear();

    // CRT Palette: Phosphor Green, Tactical Amber, Alert Crimson, Dark Raster
    const colGreen: [number, number, number] = [0.13, 0.77, 0.37];
    const colAmber: [number, number, number] = [0.96, 0.62, 0.04];
    const colCrimson: [number, number, number] = [0.94, 0.27, 0.27];
    const colDarkGrid: [number, number, number] = [0.08, 0.25, 0.14];
    const colCoast: [number, number, number] = [0.10, 0.45, 0.22];

    // 1. Tactical Vector Shoreline & Coastal Defense Map
    const coastPoints = [
      [-6.5, -4.2], [-5.2, -3.1], [-4.4, -1.8], [-3.8, -0.2],
      [-3.2, 1.2], [-2.8, 2.5], [-2.1, 3.8], [-1.2, 5.2],
      [-4.8, 1.5], [-5.8, 3.0], [-6.8, 4.5],
    ];
    for (let cp = 0; cp < coastPoints.length - 1; cp++) {
      const p1 = coastPoints[cp]!;
      const p2 = coastPoints[cp + 1]!;
      ctx.lines.seg(p1[0], p1[1], -0.1, p2[0], p2[1], -0.1, 1.2, colCoast[0], colCoast[1], colCoast[2], 0.65);
    }
    // Offshore radar island contours
    const islandCenters = [[2.8, 1.8], [3.5, -2.2]];
    for (const [ix, iy] of islandCenters) {
      for (let st = 0; st < 8; st++) {
        const a1 = (st / 8) * TAU, a2 = ((st + 1) / 8) * TAU;
        const ir = 0.55 + Math.sin(st * 1.5) * 0.15;
        ctx.lines.seg(ix + Math.cos(a1) * ir, iy + Math.sin(a1) * ir, -0.1, ix + Math.cos(a2) * ir, iy + Math.sin(a2) * ir, -0.1, 1.2, colCoast[0], colCoast[1], colCoast[2], 0.7);
      }
    }

    // 2. Concentric Tactical Range Rings (6 rings)
    for (let r = 1; r <= NUM_RINGS; r++) {
      const radius = r * 1.05;
      const steps = 64;
      const isMajor = r === NUM_RINGS || r === 3;
      const alpha = isMajor ? 0.85 : 0.45;
      const w = isMajor ? 1.8 : 0.9;

      for (let s = 0; s < steps; s++) {
        const a1 = (s / steps) * TAU;
        const a2 = ((s + 1) / steps) * TAU;
        ctx.lines.seg(
          Math.cos(a1) * radius, Math.sin(a1) * radius, 0,
          Math.cos(a2) * radius, Math.sin(a2) * radius, 0,
          w, colGreen[0], colGreen[1], colGreen[2], alpha
        );
      }
    }

    // 3. Azimuth Radial Spokes (every 30 degrees)
    for (let sp = 0; sp < 12; sp++) {
      const angle = (sp / 12) * TAU;
      const maxR = NUM_RINGS * 1.05;
      ctx.lines.seg(0, 0, 0, Math.cos(angle) * maxR, Math.sin(angle) * maxR, 0, 1.0, colDarkGrid[0], colDarkGrid[1], colDarkGrid[2], 0.65);
    }

    // 4. 360-Degree Rotating Vector Radar Sweep Beam
    const sweepAngle = (t * 2.2) % TAU;
    const sweepLen = NUM_RINGS * 1.08;
    ctx.lines.seg(0, 0, 0, Math.cos(sweepAngle) * sweepLen, Math.sin(sweepAngle) * sweepLen, 0, 2.8, colGreen[0], colGreen[1], colGreen[2], 0.98);

    // Phosphor persistence decay trail (10 trailing lines behind the sweep)
    for (let tr = 1; tr <= 10; tr++) {
      const trailAngle = sweepAngle - tr * 0.035;
      const trailAlpha = (1.0 - tr / 10) * 0.55;
      ctx.lines.seg(0, 0, 0, Math.cos(trailAngle) * sweepLen, Math.sin(trailAngle) * sweepLen, 0, 1.4, colGreen[0], colGreen[1], colGreen[2], trailAlpha);
    }

    // 5. 10 Detected Radar Target Tracks
    for (let tg = 0; tg < NUM_TARGETS; tg++) {
      const seedAngle = tg * 0.72 + 0.35;
      const seedR = 1.3 + (tg % 5) * 0.85;
      const tx = Math.cos(seedAngle) * seedR;
      const ty = Math.sin(seedAngle) * seedR;

      let dAngle = Math.abs((sweepAngle - seedAngle + Math.PI) % TAU - Math.PI);
      const isIlluminated = dAngle < 0.35;
      const blipAlpha = isIlluminated ? 0.95 : 0.35;
      const col = tg === 2 ? colCrimson : tg === 6 ? colAmber : colGreen;

      const bsz = 0.14;
      ctx.lines.seg(tx - bsz, ty, 0, tx + bsz, ty, 0, 2.2, col[0], col[1], col[2], blipAlpha);
      ctx.lines.seg(tx, ty - bsz, 0, tx, ty + bsz, 0, 2.2, col[0], col[1], col[2], blipAlpha);

      // Target velocity vector leader line
      const velAngle = seedAngle + Math.PI * 0.45 + Math.sin(tg) * 0.5;
      const velLen = 0.55;
      const vx = Math.cos(velAngle) * velLen;
      const vy = Math.sin(velAngle) * velLen;
      ctx.lines.seg(tx, ty, 0, tx + vx, ty + vy, 0, 1.6, col[0], col[1], col[2], blipAlpha * 0.9);

      // Historical breadcrumb dots
      for (let bc = 1; bc <= 3; bc++) {
        const bx = tx - vx * (bc * 0.35);
        const by = ty - vy * (bc * 0.35);
        const bAlpha = blipAlpha * (1.0 - bc * 0.28);
        ctx.lines.seg(bx - 0.03, by, 0, bx + 0.03, by, 0, 1.2, col[0], col[1], col[2], bAlpha);
      }
    }

    // 6. Outer Perimeter Compass Azimuth Degree Ticks (36 ticks at 10-degree intervals)
    const compassR = NUM_RINGS * 1.06;
    for (let deg = 0; deg < 36; deg++) {
      const dAng = (deg / 36) * TAU;
      const isCard = deg % 9 === 0;
      const tLen = isCard ? 0.35 : 0.18;
      const x1 = Math.cos(dAng) * compassR, y1 = Math.sin(dAng) * compassR;
      const x2 = Math.cos(dAng) * (compassR + tLen), y2 = Math.sin(dAng) * (compassR + tLen);
      ctx.lines.seg(x1, y1, 0, x2, y2, 0, isCard ? 2.2 : 1.0, colGreen[0], colGreen[1], colGreen[2], isCard ? 0.95 : 0.55);
    }

    // Pin Callouts
    const originNode = ctx.node('radar_origin');
    originNode.pinToWorldVertex([0, 0, 0], ctx.threeCam, { screenOffset: [0, -35], minScale: 0.7, maxScale: 1.2 });
    const targetNode = ctx.node('target_alpha');
    const target2X = Math.cos(2 * 0.72 + 0.35) * (1.3 + (2 % 5) * 0.85);
    const target2Y = Math.sin(2 * 0.72 + 0.35) * (1.3 + (2 % 5) * 0.85);
    targetNode.pinToWorldVertex([target2X, target2Y, 0], ctx.threeCam, { screenOffset: [35, -20], minScale: 0.7, maxScale: 1.2 });
    const hostileNode = ctx.node('target_hostile');
    const target6X = Math.cos(6 * 0.72 + 0.35) * (1.3 + (6 % 5) * 0.85);
    const target6Y = Math.sin(6 * 0.72 + 0.35) * (1.3 + (6 % 5) * 0.85);
    hostileNode.pinToWorldVertex([target6X, target6Y, 0], ctx.threeCam, { screenOffset: [-35, 25], minScale: 0.7, maxScale: 1.2 });

    // Overlay Ducking
    const textDuck = Math.min(
      Math.min(1, Math.max(0, f.p / 0.08)),
      Math.min(1, Math.max(0, (1.0 - f.p) / 0.08))
    );

    // 2D Vector UI
    ctx.sdf.clear();
    const cardAlpha = Math.min(1, Math.max(0, ease.outExpo(Math.min(1, progress * 4.0)))) * textDuck;
    if (cardAlpha > 0.01) {
      // Monospace tactical status card
      ctx.card('crt_hud_card', {
        x: W - 530, y: 84, w: 450, h: 185,
        radius: [4, 4, 4, 4], // Retro angular military corner
        fill: [0.04, 0.08, 0.05, 0.88 * cardAlpha],
        stroke: [colGreen[0], colGreen[1], colGreen[2], 0.8 * cardAlpha],
        strokeWidth: 1.8,
        shadow: { blur: 24, color: [0, 0, 0, 0.65 * cardAlpha], offset: [0, 8] },
        role: 'hud', opacity: cardAlpha,
      });

      // Azimuth Angle dial
      ctx.ring({ cx: W - 130, cy: 175, radius: 36, thickness: 4.5, trim: [0, 1], color: [0.1, 0.3, 0.15, 0.35 * cardAlpha] });
      ctx.ring({
        cx: W - 130, cy: 175, radius: 36, thickness: 4.5,
        trim: [0, (sweepAngle / TAU)],
        color: [colGreen[0], colGreen[1], colGreen[2], 0.95 * cardAlpha],
        glow: 1.5,
      });
    }

    if (!originNode.isOccluded && textDuck > 0.1) {
      const p = originNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 45, size: 12, thickness: 1.5, color: [colGreen[0], colGreen[1], colGreen[2], 0.95 * textDuck] });
    }
    if (!targetNode.isOccluded && textDuck > 0.1) {
      const p = targetNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 35, size: 12, thickness: 1.5, color: [colCrimson[0], colCrimson[1], colCrimson[2], 0.95 * textDuck] });
    }
    if (!hostileNode.isOccluded && textDuck > 0.1) {
      const p = hostileNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 30, size: 12, thickness: 1.5, color: [colAmber[0], colAmber[1], colAmber[2], 0.95 * textDuck] });
    }

    // 2D Typography & Tactical Telemetry
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;

    if (textDuck > 0.01) {
      // CRT Scanline Raster
      c2d.save();
      c2d.strokeStyle = 'rgba(34, 197, 94, 0.06)';
      c2d.lineWidth = 1.0;
      for (let sl = 0; sl < H; sl += 4) {
        c2d.beginPath();
        c2d.moveTo(0, sl);
        c2d.lineTo(W, sl);
        c2d.stroke();
      }
      c2d.restore();

      const title = ctx.text('crt_title', 'DEFCON-1 TACTICAL RADAR', {
        fontSize: 48, fontWeight: 900, color: `rgba(34, 197, 94, ${0.98 * textDuck})`, letterSpacing: 8, role: 'headline',
      }).withKnockoutHalo(4, `rgba(6, 11, 6, ${0.95 * textDuck})`);
      const titleEnter = ease.outExpo(Math.min(1, progress * 3.5));
      ctx.renderText('crt_title', c2d, t, 90, 130 - (1 - titleEnter) * 35);

      ctx.text('crt_sub', 'AN/FPS-117 3D RADAR · 360° AZIMUTH SWEEP · 10 AIR TRACKS · SECTOR 4 INTERCEPT', {
        fontSize: 14, fontWeight: 600, color: `rgba(245, 158, 11, ${0.92 * textDuck})`, letterSpacing: 3, role: 'callout',
      }).withKnockoutHalo(2, `rgba(6, 11, 6, ${0.9 * textDuck})`);
      const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.1) * 2.5)));
      ctx.renderText('crt_sub', c2d, t, 94, 185 - (1 - subEnter) * 20);

      // Radar Azimuth & Sweep status
      const curDeg = Math.round((sweepAngle / TAU) * 360);
      const azRoll = ctx.text('crt_az', `${curDeg}° TRUE`, {
        fontSize: 32, fontWeight: 700, color: `rgba(34, 197, 94, ${0.95 * textDuck})`, role: 'hud',
      });
      azRoll.numericRoll(curDeg, (n) => `AZIMUTH: ${String(n).padStart(3, '0')}° TRUE`);
      ctx.renderText('crt_az', c2d, t, W - 500, 140);

      const sweepText = ctx.text('crt_swp', 'RADAR PRF: 800 HZ · PULSE DOPPLER · IFF MODE 4', {
        fontSize: 12, fontWeight: 600, color: `rgba(187, 247, 208, ${0.85 * textDuck})`, role: 'hud',
      });
      ctx.renderText('crt_swp', c2d, t, W - 500, 195);

      // Left Column: Air Defense Sector Tracking Roster
      c2d.save();
      c2d.font = '700 12px monospace';
      c2d.fillStyle = `rgba(34, 197, 94, ${0.85 * textDuck})`;
      c2d.fillText('AIR DEFENSE TRACKING ROSTER (SECTOR 4):', 94, 250);
      const roster = [
        'TRK-01  AZ: 042°  RNG:  45 NM  ALT: FL310  SPD: 480 KTS [CIVILIAN]',
        'TRK-02  AZ: 114°  RNG:  68 NM  ALT: FL240  SPD: 520 KTS [INTERCEPT]',
        'TRK-06  AZ: 285°  RNG:  32 NM  ALT: FL410  SPD: 950 KTS [HOSTILE BOGEY]',
        'TRK-08  AZ: 330°  RNG: 110 NM  ALT: FL180  SPD: 340 KTS [SURVEILLANCE]',
      ];
      for (let r = 0; r < roster.length; r++) {
        const isHostile = r === 2;
        c2d.fillStyle = isHostile ? `rgba(239, 68, 68, ${0.95 * textDuck})` : `rgba(34, 197, 94, ${0.75 * textDuck})`;
        c2d.fillText(roster[r]!, 94, 275 + r * 22);
      }
      c2d.restore();

      if (!originNode.isOccluded) {
        ctx.text('crt_orig_lbl', 'RADAR STATION [AN/FPS-117]', {
          fontSize: 12, fontWeight: 600, color: `rgba(34, 197, 94, ${0.9 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(6, 11, 6, ${0.9 * textDuck})`);
        const op = originNode.position;
        ctx.renderText('crt_orig_lbl', c2d, t, op[0] + 16, op[1] - 32);
      }

      if (!targetNode.isOccluded) {
        ctx.text('crt_tgt_lbl', 'TRK-02 BOGEY [SPEED: 520 KTS · FL240]', {
          fontSize: 12, fontWeight: 600, color: `rgba(239, 68, 68, ${0.95 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(6, 11, 6, ${0.9 * textDuck})`);
        const tp = targetNode.position;
        ctx.renderText('crt_tgt_lbl', c2d, t, tp[0] + 16, tp[1] - 32);
      }

      if (!hostileNode.isOccluded) {
        ctx.text('crt_hst_lbl', 'TRK-06 HIGH-SPEED INTERCEPT [950 KTS]', {
          fontSize: 12, fontWeight: 600, color: `rgba(245, 158, 11, ${0.95 * textDuck})`, letterSpacing: 1, role: 'callout',
        }).withKnockoutHalo(1.5, `rgba(6, 11, 6, ${0.9 * textDuck})`);
        const hp = hostileNode.position;
        ctx.renderText('crt_hst_lbl', c2d, t, hp[0] + 16, hp[1] + 28);
      }
    }

    // Compositing with Charcoal CRT Tube Backdrop (#060B06)
    ctx.compositor.clear();
    ctx.compositor.createLayer('crt_backdrop', {
      render: (target) => {
        renderer.setRenderTarget(target);
        if (typeof (renderer as any).setClearColor === 'function') {
          (renderer as any).setClearColor(0x060B06, 1.0);
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
