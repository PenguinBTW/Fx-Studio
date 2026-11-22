// a10_quiet (bars 93-100): the breather. One lamp, one print (the still that passed review), and the orange block
// resting on it, breathing with the vocal. "it is never finished." in Cormorant italic. Camera sinks toward the block
// (exit: down into it, agp_vortex).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { F } from '../../engine/type';
import { ease, prog } from '../../engine/util';
import { release, C, bar, model, part, present, sceneTime, heroLights, enableShadows, shadows, camPath, applyCam, typeLine, barOf, type CamKey } from './kit';
import { makePrint, loadPrints } from './a5_print';

const CAM: [number, CamKey][] = [
  [92.8, { pos: [1.6, 1.5, 2.2], tgt: [0, 0.1, 0], fov: 34 }],
  [99, { pos: [0.7, 0.75, 1.1], tgt: [0.15, 0.1, 0], fov: 32 }],
  [101, { pos: [0.3, 0.42, 0.35], tgt: [0.3, 0.12, 0.05], fov: 34 }],
];

export default class A10Quiet extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.02, 60);
  private layer = new Layer2D();
  private block!: THREE.Object3D; private glow = new THREE.PointLight(0xff5a1f, 1, 2, 2); private texs: THREE.Texture[] = [];

  override async init() {
    enableShadows(this.ctx);
    this.texs = await loadPrints();
    const p = makePrint(this.texs[2]!); p.rotation.set(-Math.PI / 2, 0, 0.18); p.position.set(-0.1, 0.004, 0); this.scene.add(p);
    const lamp = await model(this.ctx, 'desk_lamp'); shadows(lamp.root); lamp.root.position.set(1.6, 0, -1.0); lamp.root.rotation.y = -0.7; this.scene.add(lamp.root);
    const spot = new THREE.SpotLight(0xffc48a, 9, 8, 0.6, 0.7, 1.6); spot.position.set(1.0, 1.9, -0.6); spot.target.position.set(0, 0, 0);
    spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -0.0002; this.scene.add(spot, spot.target);
    heroLights(this.scene, 0xffd7a0, 0x9cc9e8, 0.15, 0.6, 0.06).rim.position.set(-3, 2, -4);
    const mark = await model(this.ctx, 'fx_mark');
    this.block = part(mark, 'mark_cursor').clone(); this.block.position.set(0.3, 0, 0.05); this.block.scale.setScalar(0.13); shadows(this.block);
    this.scene.add(this.block, this.glow);
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x1d140e, roughness: 0.6 }));
    desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; this.scene.add(desk);
    this.scene.background = new THREE.Color(0x060506); this.scene.fog = new THREE.Fog(0x060506, 3, 9);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t), b = barOf(T);
    const breathe = 0.5 + 0.5 * Math.cos(((T - 174.58) / 1.905) * Math.PI * 2);
    this.block.position.y = 0.06 + 0.004 * breathe;
    this.block.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; if (m?.emissive) m.emissiveIntensity = 2 + 4 * breathe; });
    this.glow.position.set(0.3, 0.2, 0.15); this.glow.intensity = 0.4 + 0.8 * breathe;
    applyCam(this.cam, camPath(CAM, b));
    const g = this.layer.ctx; this.layer.clear();
    typeLine(g, 'it is never finished.', 960, 880, T, bar(94.5), { size: 64, cps: 12, align: 'center', family: F.serif(400, true), cursor: false, t1: bar(99.6) });
    present(this.ctx, out, this.scene, this.cam, this.layer, undefined, 0x060506, overlayTextDuck(f.tin, f.tout));
    return { exposure: 0.95, bloom: 0.6 + 0.4 * prog(T, bar(99.5), bar(100.9), ease.inCubic), bloomThreshold: 0.8, vignette: 0.6, grain: 0.05 };
  }
  override dispose() { release(this.scene); this.layer.texture.dispose(); for (const t of this.texs) t.dispose(); }
}
