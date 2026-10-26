// P14 smoke scene: one tiny stateless scene module serving 10 timeline entries (params.v = 0..9).
// Each variant enables a different mix of the usual allocations (analytic particles, 3D lines, SDF quads,
// Canvas2D text, a three.js mesh) plus a bloom override, so loading/unloading exercises every GPU resource kind.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../../engine/dsl';
import { type Frame } from '../../../engine/scene';
import { clearRT } from '../../../engine/gl';
import { TAU } from '../../../engine/util';

const P = 1, L = 2, S = 4, T = 8, M = 16;
const FEATURES = [P, L, S, T, P | L, S | T, L | S | P, T | P | M, P | L | S | T | M, L | S | T | M];

interface State { v: number; feats: number; hue: number; mesh?: THREE.Mesh }
const states = new WeakMap<SceneContext, State>();

const hsl = (h: number, s: number, l: number): [number, number, number] => {
  const c = new THREE.Color().setHSL(h, s, l);
  return [c.r, c.g, c.b];
};

export default defineScene({
  id: 'smoke_scene',
  rigMode: 'perspective',
  particleCapacity: 512,
  lineCapacity: 512,
  sdfCapacity: 64,

  setup: (ctx: SceneContext) => {
    const v = Number(ctx.sceneCtx.params.v ?? 0) % 10;
    const st: State = { v, feats: FEATURES[v]!, hue: v / 10 };
    states.set(ctx, st);
    ctx.rig.setLensMm(35);
    ctx.rig.setPath([
      { t: 0, pos: [0, 0.5, 9], target: [0, 0, 0], roll: 0, focalLength: 35 },
      { t: 1, pos: [2, 1.5, 7], target: [0, 0, 0], roll: 0.03, focalLength: 40 },
    ]);
    if (st.feats & P) {
      ctx.particles.addEmitter(`p${v}`, {
        capacity: 256, origin: [0, -1, 0], direction: [0, 1, 0], speed: 2.2, spread: 0.9, lifetime: 3,
        gravity: [0, -0.4, 0], turbulence: 0.3, size: 0.06, color: [...hsl(st.hue, 0.8, 0.6), 0.9], glow: 1.5,
      });
    }
    if (st.feats & M) {
      ctx.scene3D.add(new THREE.AmbientLight(0xffffff, 0.5));
      const key = new THREE.DirectionalLight(0xffffff, 2);
      key.position.set(3, 4, 5);
      ctx.scene3D.add(key);
      st.mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.3, 96, 16), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(st.hue, 0.7, 0.5), roughness: 0.4, metalness: 0.3 }));
      ctx.scene3D.add(st.mesh);
    }
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const st = states.get(ctx)!;
    const { renderer } = ctx;
    const t = f.t;
    const bg = hsl(st.hue, 0.5, 0.02);
    ctx.updateCamera(t, f.p);
    clearRT(renderer, out, bg);
    if (st.mesh) st.mesh.rotation.set(t * 0.4, t * 0.6, 0);
    if (st.feats & P) ctx.particles.render(renderer, ctx.threeCam, out, t);
    if (st.feats & L) {
      ctx.lines.clear();
      const c = hsl(st.hue, 0.9, 0.6);
      for (let i = 0; i < 48; i++) {
        const a0 = (i / 48) * TAU + t * 0.3, a1 = ((i + 1) / 48) * TAU + t * 0.3;
        const r = 2.5 + 0.4 * Math.sin(t + i * 0.4);
        ctx.lines.seg(Math.cos(a0) * r, Math.sin(a0) * r, 0, Math.cos(a1) * r, Math.sin(a1) * r, 0, 2, c[0], c[1], c[2], 0.9);
      }
    }
    if (st.feats & S) {
      ctx.sdf.clear();
      const c = hsl(st.hue, 0.8, 0.55);
      ctx.sdf.rect(120, 120, 420, 150, { radius: 14, fill: [c[0] * 0.2, c[1] * 0.2, c[2] * 0.2, 0.9], stroke: [c[0], c[1], c[2], 1], strokeWidth: 2, glow: 1.2 });
      ctx.sdf.circle(1700, 180 + 40 * Math.sin(t), 60, [c[0], c[1], c[2], 1], 1.5);
    }
    if (st.feats & T) {
      ctx.layer2d.clear();
      const c2d = ctx.layer2d.ctx;
      ctx.text('title', `SMOKE ${String(st.v).padStart(2, '0')}`, { fontSize: 96, fontWeight: 700, color: '#EEE9DF', align: 'left', role: 'headline' });
      ctx.renderText('title', c2d, t, 140, 840);
      c2d.fillStyle = 'rgba(238,233,223,0.6)';
      c2d.font = '24px IBM Plex Mono, monospace';
      c2d.fillText(`t ${t.toFixed(2)}`, 140, 900);
    }
    ctx.flush(out);
    renderer.resetState();
    return { bloom: 0.35 + 0.15 * Math.sin(t * 0.7 + st.v) };
  },
});
