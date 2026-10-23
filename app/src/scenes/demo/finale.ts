// FINALE — everything at once: fountain emitters, orbit lines, SDF HUD,
// kinetic typo, aggressive camera sweep with trauma hits, closing flash.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

export default defineScene({
  id: 'finale',
  rigMode: 'perspective',
  particleCapacity: 2048,
  lineCapacity: 4096,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(32);
    ctx.rig.setPath([
      { t: 0.0, pos: [-4.5, 3.4, -9.5], target: [0, 0.6, 0], roll: -0.06, focalLength: 32 },
      { t: 0.4, pos: [0, 1.2, -5.2], target: [0, 0.8, 0], roll: 0, focalLength: 40 },
      { t: 0.75, pos: [3.2, 2.2, -7.0], target: [0, 0.8, 0], roll: 0.06, focalLength: 36 },
      { t: 1.0, pos: [0, 1.8, -4.2], target: [0, 0.9, 0], roll: 0, focalLength: 55 },
    ]);
    ctx.particles.addEmitter('fountain_a', {
      capacity: 700, origin: [-1.6, -1.6, 0], direction: [0.25, 1, 0],
      speed: 4.6, spread: 0.3, lifetime: 2.0, gravity: [0, -2.4, 0],
      turbulence: 0.3, size: 0.07,
      color: [ctx.lin.signal[0], ctx.lin.signal[1], ctx.lin.signal[2], 0.9], glow: 2.2,
    });
    ctx.particles.addEmitter('fountain_b', {
      capacity: 700, origin: [1.6, -1.6, 0], direction: [-0.25, 1, 0],
      speed: 4.6, spread: 0.3, lifetime: 2.0, gravity: [0, -2.4, 0],
      turbulence: 0.3, size: 0.07,
      color: [ctx.lin.ember[0], ctx.lin.ember[1], ctx.lin.ember[2], 0.9], glow: 2.2,
    });
    ctx.particles.addEmitter('halo_dust', {
      capacity: 420, origin: [0, 1.0, 0], direction: [0, 1, 0],
      speed: 0.7, spread: 1.5, lifetime: 3.4, turbulence: 0.6, size: 0.06,
      color: [ctx.lin.bone[0], ctx.lin.bone[1], ctx.lin.bone[2], 0.5], glow: 1.1,
    });
    ctx.rig.addTrauma(0.5, 0.2, 2.0);
    ctx.rig.addTrauma(0.4, 3.8, 2.2);
    ctx.node('core_callout', { role: 'callout', size: [120, 32, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);

    // Double-helix line streams.
    ctx.lines.clear();
    const segs = 90;
    const spin = t * 1.1;
    for (let strand = 0; strand < 2; strand++) {
      const off = strand * Math.PI;
      const col: [number, number, number, number] = strand === 0
        ? [lin.signal[0], lin.signal[1], lin.signal[2], 0.75]
        : [lin.bone[0], lin.bone[1], lin.bone[2], 0.5];
      let px = 0, py = 0, pz = 0;
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const a = u * TAU * 3 + spin + off;
        const y = -1.8 + u * 4.4;
        const x = Math.cos(a) * (1.5 - u * 0.7);
        const z = Math.sin(a) * (1.5 - u * 0.7);
        if (i > 0) ctx.lines.seg(px, py, pz, x, y, z, 1.5, col[0], col[1], col[2], col[3]);
        px = x; py = y; pz = z;
      }
    }

    const coreNode = ctx.node('core_callout');
    coreNode.pinToWorldVertex([0, 1.6, 0], ctx.threeCam, { screenOffset: [0, -36], minScale: 0.7, maxScale: 1.2 });

    // SDF finale card + progress arc.
    ctx.sdf.clear();
    const cardIn = ctx.motion.spring(0.1, t, { freq: 3.0, damping: 0.7, v0: 2.2 });
    const cardA = Math.min(1, Math.max(0, cardIn));
    if (cardA > 0.01) {
      ctx.card('fin_card', {
        x: W / 2 - 250, y: 96, w: 500, h: 120, radius: [14, 14, 14, 14],
        fill: [lin.ink2[0], lin.ink2[1], lin.ink2[2], 0.88 * cardA],
        stroke: [lin.acid[0], lin.acid[1], lin.acid[2], 0.7 * cardA],
        strokeWidth: 2.0,
        shadow: { blur: 26, color: [0, 0, 0, 0.5 * cardA], offset: [0, 8] },
        role: 'hud', opacity: cardA,
      });
      ctx.ring({ cx: W / 2 + 196, cy: 156, radius: 30, thickness: 4, trim: [0, 1], color: [lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.35 * cardA] });
      ctx.ring({ cx: W / 2 + 196, cy: 156, radius: 30, thickness: 4, trim: [0, Math.max(0.02, progress)], color: [lin.acid[0], lin.acid[1], lin.acid[2], cardA], glow: 1.2 });
    }
    if (!coreNode.isOccluded) {
      const p = coreNode.position;
      ctx.reticle({ cx: p[0], cy: p[1] + 36, size: 14, thickness: 1.5, color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.9] });
    }

    // Typography.
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;
    const title = ctx.text('fin_title', 'FULL SYSTEM BURN', {
      fontSize: 44, fontWeight: 900, color: ctx.rgba('bone', 0.97), letterSpacing: 6, role: 'headline',
    }).withKnockoutHalo(3.5, ctx.rgba('ink', 0.95));
    const st = title.stagger(t, { unit: 'word', start: f.start + 0.1, staggerDuration: 0.5, inDuration: 0.3, motion: 'slide-up' });
    ctx.renderText('fin_title', c2d, t, W / 2 - 250 + 36, 150, st);

    if (!coreNode.isOccluded) {
      ctx.text('fin_call', 'TWIN FOUNTAIN CORE', {
        fontSize: 12, fontWeight: 600, color: ctx.rgba('bone', 0.9), letterSpacing: 1, role: 'callout',
      }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9));
      const cp = coreNode.position;
      ctx.renderText('fin_call', c2d, t, cp[0] + 18, cp[1] + 28);
    }

    // Compositor.
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

    // Closing flash in the last half second.
    const tail = Math.max(0, t - (f.end - 0.5)) * 2;
    if (tail > 0.01) return { flash: Math.min(0.8, tail * 0.8), exposure: 1 + tail * 0.3 };
  },
});
