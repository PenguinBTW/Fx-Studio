// a9_rush (bars 81-93): the print tunnel the rush cuts back to. Every still of this film, pinned to the walls of a
// square tunnel, rushing past on a closed-form accelerating track toward the orange block at the vanishing point.
// "every frame is a function of t." The last bar streaks everything into the block (exit: agp_collapse).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { release, C, bar, model, part, present, sceneTime, typeLine } from './kit';
import { makePrint, loadPrints } from './a5_print';

const N = 48, GAP = 1.4, L = N / 4 * GAP, T0 = bar(81);
/** Distance travelled: closed form of a speed ramping from 6 to ~30 units/s over the act. */
const dist = (T: number) => { const x = Math.max(0, T - T0); return 6 * x + 0.55 * x * x; };

export default class A9Rush extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(62, 16 / 9, 0.05, 80);
  private layer = new Layer2D();
  private prints: THREE.Group[] = []; private texs: THREE.Texture[] = []; private block!: THREE.Object3D;

  override async init() {
    this.texs = await loadPrints();
    for (let i = 0; i < N; i++) {
      const p = makePrint(this.texs[i % this.texs.length]!), side = i % 4;
      p.rotation.set(side === 2 ? -Math.PI / 2 : side === 3 ? Math.PI / 2 : 0, side === 0 ? Math.PI / 2 : side === 1 ? -Math.PI / 2 : 0, 0, 'YXZ');
      p.userData.side = side; this.prints.push(p); this.scene.add(p);
    }
    const mark = await model(this.ctx, 'fx_mark');
    this.block = part(mark, 'mark_cursor').clone(); this.block.position.set(0, 0, -40); this.block.scale.setScalar(1.2); this.scene.add(this.block);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.15));
    const pl = new THREE.PointLight(0xff7a3a, 25, 30, 1.6); pl.position.set(0, 0, -26); this.scene.add(pl);
    const kl = new THREE.PointLight(0xffe2c0, 3, 10, 1.5); kl.position.set(0, 0, -2); this.scene.add(kl);
    this.scene.background = new THREE.Color(0x060608); this.scene.fog = new THREE.Fog(0x060608, 8, 40);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t), d = dist(T);
    const squeeze = Math.max(0, (T - bar(92)) / (bar(93) - bar(92)));
    const R = 1.25 * (1 - 0.85 * squeeze * squeeze);
    this.prints.forEach((p, i) => {
      const side = p.userData.side as number, z0 = Math.floor(i / 4) * GAP + (side % 2) * GAP * 0.5;
      const z = -(((z0 - d) % L) + L) % L - 0.5;
      p.position.set(side === 0 ? -R : side === 1 ? R : 0, side === 2 ? -R * 0.75 : side === 3 ? R * 0.75 : 0, z);
    });
    this.block.rotation.y = T * 0.6;
    this.cam.position.set(0.05 * Math.sin(T * 1.3), 0.04 * Math.cos(T * 1.1), 0); this.cam.lookAt(0, 0, -40);
    this.cam.rotation.z = 0.06 * Math.sin(T * 0.7);
    const g = this.layer.ctx; this.layer.clear();
    typeLine(g, 'every frame is a function of t.', 960, 960, T, bar(91), { size: 40, cps: 26, align: 'center', color: C.bone });
    present(this.ctx, out, this.scene, this.cam, this.layer, undefined, 0x060608, overlayTextDuck(f.tin, f.tout));
    return { exposure: 1.0, bloom: 0.8, bloomThreshold: 0.8, vignette: 0.6, grain: 0.05 };
  }
  override dispose() { release(this.scene); for (const t of this.texs) t.dispose(); }
}
