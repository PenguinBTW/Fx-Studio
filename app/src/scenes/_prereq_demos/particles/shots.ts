// LargeParticles demo. Shots by scene time: A 0-5 Core density, B 5-10 magnetosphere spirals,
// C 10-15 rain streaks, D 15-20 star field. `?count=` (URL) overrides A's particle count.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../../engine/dsl';
import { type Frame } from '../../../engine/scene';
import { LargeParticles } from '../../../engine/particles_large';

interface Shot { p: LargeParticles; extra?: LargeParticles }
const shots: Shot[] = [];

const urlCount = () => {
  const n = Number(new URLSearchParams(location.search).get('count'));
  return n > 0 ? n : 0;
};
const ui = (k: string, d: number) => { const s = new URLSearchParams(location.search).get(k); return s === null ? d : Number(s); };
const urlTrail = () => {
  const s = new URLSearchParams(location.search).get('trail');
  return s === null ? -1 : Number(s);
};

export default defineScene({
  id: 'particles_shots',
  rigMode: 'perspective',
  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(28);
    const hold = (k: number, pos: [number, number, number], pos2: [number, number, number], tg: [number, number, number], mm: number) => [
      { t: k / 4 + 0.001, pos, target: tg, focalLength: mm },
      { t: (k + 1) / 4 - 0.001, pos: pos2, target: tg, focalLength: mm },
    ];
    ctx.rig.setPath([
      ...hold(0, [0, 0, 3.2], [0, 0, 2.4], [0, 0, 0], 28),
      ...hold(1, [9, 3, 16], [7, 2.5, 14], [0, 0, 0], 30),
      ...hold(2, [0, 0, 8], [0, 0, 8], [0, 0, 0], 35),
      ...hold(3, [0, 0, 0], [0, 0, 0], [0, 0, -1], 24),
    ]);

    const cap = Math.max(urlCount(), 500000);
    const core = new LargeParticles(cap, 11);
    const nA = urlCount() || 400000;
    const tr = urlTrail();
    core.configure({
      count: nA, mode: 'press', style: 'disc', size: [0.006, 0.02], life: [3.5, 7], temperature: [0, 1],
      color: { mode: 'blackbody', range: [2200, 7500] }, intensity: 0.025 * ui('i', 1), brightnessVariance: 0.6, minPx: 0.7,
      fade: [0.1, 0.15],
      press: { center: [0, 0, 0], shell: [0.15, 3.2], shellPow: 0.55, core: 0.018, falloff: 0.7, power: 1.5, coreDim: ui('cd', 0.12) },
      turbulence: { amp: 0.16, freq: 1.4, drift: 0.35 },
      trail: { segments: tr >= 0 ? tr : 8, dt: 0.05, taper: 0.1, power: 1.3, gain: 0.5 },
      dof: { cocScale: 0.8, focus: 3.0, range: 0.8 },
    });
    const coreDot = new LargeParticles(64, 5);
    coreDot.configure({
      count: 40, mode: 'star', size: [0.05, 0.11], temperature: [0.9, 1], color: { mode: 'blackbody', range: [6000, 12000] },
      intensity: 2.2, star: { center: [0, 0, 0], shell: [0, 0.012] }, minPx: 2,
    });
    shots.push({ p: core, extra: coreDot });

    const mag = new LargeParticles(200000, 23);
    mag.configure({
      count: 40000, mode: 'spiral', style: 'disc', size: [0.012, 0.03], life: [4, 8], temperature: [0, 1],
      color: { mode: 'wavelength', range: [395, 560] }, intensity: 0.3 * ui('i', 1), brightnessVariance: 0.5, minPx: 0.7,
      fade: [0.12, 0.2],
      spiral: { center: [0, 0, 0], L: [1.5, 4.5], thetaMin: 0.28, helixRadius: 0.08, turns: 7, lonRate: 0.05 },
      turbulence: { amp: 0.03, freq: 1.5, drift: 0.2 },
      trail: { segments: 10, dt: 0.06, taper: 0.1, power: 1.2, gain: 0.55 },
    });
    shots.push({ p: mag });

    const rain = new LargeParticles(120000, 31);
    rain.configure({
      count: 90000, mode: 'fall', style: 'streak', size: [0.006, 0.014], life: [1.2, 1.8], temperature: [0, 1],
      color: { mode: 'flat', rgb: [0.55, 0.7, 1.0] }, intensity: 0.7, brightnessVariance: 0.7, minPx: 0.8,
      fade: [0.02, 0.1], streak: 0.045,
      fall: { center: [0, 0, 0], box: [14, 9, 14], velocity: [-3.5, -22, 0], drag: 0.1 },
      turbulence: { amp: 0.15, freq: 0.4, drift: 0.6 },
      dof: { cocScale: 0.6, focus: 8, range: 3 },
    });
    shots.push({ p: rain });

    const stars = new LargeParticles(200000, 47);
    stars.configure({
      count: 200000, mode: 'star', style: 'points', size: [0.2, 0.5], temperature: [0, 1], color: { mode: 'blackbody', range: [3000, 14000] },
      intensity: 0.3 * ui('i', 1), brightnessVariance: 0.95, minPx: 0.6,
      star: { center: [0, 0, 0], shell: [60, 120], shellPow: 1, spin: 0.01, twinkle: 0.15, twinkleRate: 2.5 },
    });
    shots.push({ p: stars });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer } = ctx;
    ctx.updateCamera(f.t, Math.min(1, Math.max(0, f.p)));
    renderer.setRenderTarget(out);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    const k = Math.min(3, Math.floor(f.t / 5));
    const s = shots[k]!;
    s.p.render(renderer, ctx.threeCam, out, f.t);
    s.extra?.render(renderer, ctx.threeCam, out, f.t);
    renderer.resetState();
    return { bloom: k === 0 ? 0.45 : 0.3 };
  },
});
