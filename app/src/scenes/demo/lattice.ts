// LATTICE — line-field showcase: nested parametric Lissajous shells drawn
// as thousands of GPU line segments, slow orbital camera, 3D-anchored
// callouts with reticles, SDF gauge rings.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { type Frame } from '../../engine/scene';
import { TAU, ease } from '../../engine/util';

export default defineScene({
  id: 'lattice',
  rigMode: 'perspective',
  particleCapacity: 512,
  lineCapacity: 6144,
  sdfCapacity: 1024,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(42);
    ctx.rig.setPath([
      { t: 0.0, pos: [-7.5, 2.4, -7.5], target: [0, 0.2, 0], roll: 0, focalLength: 42 },
      { t: 0.5, pos: [0, 1.1, -10.5], target: [0, 0.2, 0], roll: 0.04, focalLength: 46 },
      { t: 1.0, pos: [7.5, 2.4, -7.5], target: [0, 0.2, 0], roll: 0, focalLength: 42 },
    ]);
    ctx.particles.addEmitter('motes', {
      capacity: 320,
      origin: [0, 0.2, 0],
      direction: [0, 1, 0],
      speed: 0.5,
      spread: 1.4,
      lifetime: 4.0,
      turbulence: 0.5,
      size: 0.045,
      color: [ctx.lin.bone[0], ctx.lin.bone[1], ctx.lin.bone[2], 0.5],
      glow: 1.0,
    });
    ctx.node('apex_callout', { role: 'callout', size: [120, 32, 0] });
    ctx.node('node_callout', { role: 'callout', size: [120, 32, 0] });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer, W, H, lin } = ctx;
    const t = f.t;
    const progress = Math.min(1, Math.max(0, f.p));

    ctx.updateCamera(t, progress);

    // Nested Lissajous shells: 5 shells x 3 strands, drawn as segments.
    ctx.lines.clear();
    const shells = 5;
    const wobble = ctx.motion.lfo('noise', 0.35, t) * 0.35;
    for (let s = 0; s < shells; s++) {
      const R = 1.1 + s * 0.55;
      const w1 = 3 + (s % 3), w2 = 2 + (s % 2);
      const ph = t * (0.25 + s * 0.06) + wobble;
      const bright = s === 2;
      const col: [number, number, number, number] = bright
        ? [lin.signal[0], lin.signal[1], lin.signal[2], 0.8]
        : [lin.bone[0], lin.bone[1], lin.bone[2], 0.34];
      const segs = 72;
      let px = 0, py = 0, pz = 0;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * TAU + ph;
        const x = Math.sin(w1 * a) * R;
        const y = Math.sin(w2 * a + 1.3) * R * 0.7 + 0.2;
        const z = Math.cos((w1 - w2) * a) * R * 0.8;
        if (i > 0) ctx.lines.seg(px, py, pz, x, y, z, bright ? 1.6 : 1.0, col[0], col[1], col[2], col[3]);
        px = x; py = y; pz = z;
      }
    }

    // Pin callouts to two shell vertices (world-anchored, occlusion-aware).
    const apex: [number, number, number] = [0, 0.2 + (1.1 + 2 * 0.55) * 0.7, 0];
    const apexNode = ctx.node('apex_callout');
    apexNode.pinToWorldVertex(apex, ctx.threeCam, { screenOffset: [0, -40], minScale: 0.7, maxScale: 1.2 });
    const sideNode = ctx.node('node_callout');
    sideNode.pinToWorldVertex([3.2, 0.2, 0.6], ctx.threeCam, { screenOffset: [0, 30], minScale: 0.7, maxScale: 1.2 });

    // SDF: gauge ring driven by orbit progress + reticles on visible anchors.
    ctx.sdf.clear();
    const trim = ease.inOutCubic(progress);
    ctx.ring({ cx: W - 120, cy: 130, radius: 44, thickness: 5, trim: [0, 1], color: [lin.graphite[0], lin.graphite[1], lin.graphite[2], 0.35] });
    ctx.ring({ cx: W - 120, cy: 130, radius: 44, thickness: 5, trim: [0, Math.max(0.02, trim)], color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.95], glow: 1.3 });
    for (const n of [apexNode, sideNode]) {
      if (!n.isOccluded) {
        const p = n.position;
        ctx.reticle({ cx: p[0], cy: p[1] + 40, size: 13, thickness: 1.5, color: [lin.signal[0], lin.signal[1], lin.signal[2], 0.9] });
      }
    }

    // 2D typography with staggered entrance.
    ctx.layer2d.clear();
    const c2d = ctx.layer2d.ctx;
    const kt = ctx.text('lat_title', 'PARAMETRIC LATTICE', {
      fontSize: 40, fontWeight: 900, color: ctx.rgba('bone', 0.97), letterSpacing: 7, role: 'headline',
    }).withKnockoutHalo(3.5, ctx.rgba('ink', 0.95));
    const states = kt.stagger(t, { unit: 'char', start: f.start + 0.1, staggerDuration: 0.7, inDuration: 0.35, motion: 'slide-up' });
    ctx.renderText('lat_title', c2d, t, 80, 120, states);

    ctx.text('lat_sub', '5 SHELLS · 5 STRANDS · 360 SEGMENTS · 60 FPS', {
      fontSize: 15, fontWeight: 600, color: ctx.rgba('signal', 0.9), letterSpacing: 3, role: 'callout',
    }).withKnockoutHalo(2, ctx.rgba('ink', 0.9));
    const subEnter = ease.outExpo(Math.min(1, Math.max(0, (progress - 0.15) * 2)));
    ctx.renderText('lat_sub', c2d, t, 84, 178 - (1 - subEnter) * 24);

    if (!apexNode.isOccluded) {
      ctx.text('apex_label', 'SHELL APEX · Y-LOCKED', {
        fontSize: 12, fontWeight: 600, color: ctx.rgba('bone', 0.9), letterSpacing: 1, role: 'callout',
      }).withKnockoutHalo(1.5, ctx.rgba('ink', 0.9));
      const ap = apexNode.position;
      ctx.renderText('apex_label', c2d, t, ap[0] + 18, ap[1] - 52);
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
  },
});
