// a11_mark (bars 101-119): lock-up. The f(x) STUDIO letters (extruded Archivo, Blender) fly in out of the vortex and
// lock on the downbeat; the orange block lands after them as the cursor and blinks on the beat. "made by an agent.
// finished by you." then the URL. Fade to the void on the last bar.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { clamp, ease, prog } from '../../engine/util';
import { C, BEAT, bar, model, part, present, sceneTime, heroLights, shadows, applyCam, typeLine, type CamKey } from './kit';

const T_LOCK = bar(102), END = 224.436;

export default class A11Mark extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 80);
  private layer = new Layer2D();
  private fx!: THREE.Object3D; private st!: THREE.Object3D; private cur!: THREE.Object3D; private glow = new THREE.PointLight(0xff5a1f, 0, 4, 2);
  private base = new Map<THREE.Object3D, THREE.Vector3>();

  override async init() {
    const m = await model(this.ctx, 'fx_mark'); shadows(m.root);
    this.fx = part(m, 'mark_fx'); this.st = part(m, 'mark_studio'); this.cur = part(m, 'mark_cursor');
    for (const o of [this.fx, this.st, this.cur]) this.base.set(o, o.position.clone());
    m.root.position.set(-0.3, 0.5, 0); this.scene.add(m.root, this.glow);
    const L = heroLights(this.scene, 0xffd7a0, 0x9cc9e8, 2.2, 2.6, 0.1); L.key.position.set(3, 4, 6); L.rim.position.set(-4, 3, -5);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.25, metalness: 0.7 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.25; floor.receiveShadow = true; this.scene.add(floor);
    this.scene.background = new THREE.Color(0x07070a);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t);
    const fly = (o: THREE.Object3D, t0: number, dz: number, spin: number) => {
      const u = ease.outCubic(prog(T, t0, T_LOCK)), b0 = this.base.get(o)!;
      o.position.set(b0.x, b0.y, b0.z - dz * (1 - u)); o.rotation.set(spin * (1 - u), 0, 0); o.visible = T >= t0;
    };
    fly(this.fx, bar(101), 14, -1.2); fly(this.st, bar(101) + 2 * BEAT, 10, 0.8);
    const cu = prog(T, T_LOCK, T_LOCK + 0.25, ease.outBack), b0 = this.base.get(this.cur)!;
    this.cur.position.set(b0.x, b0.y + 2 * (1 - cu), b0.z); this.cur.visible = T >= T_LOCK - 0.05;
    const blink = T < T_LOCK + 0.3 || Math.floor((T - T_LOCK) / BEAT) % 2 === 0 ? 1 : 0.1;
    this.cur.traverse((o) => { const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; if (mm?.emissive) mm.emissiveIntensity = 6 * blink; });
    this.glow.position.set(b0.x - 0.3, b0.y + 0.5, 1.0); this.glow.intensity = 3 * blink * cu;
    const push = prog(T, T_LOCK, END, ease.linear);
    const k: CamKey = { pos: [0.2 + 0.3 * Math.sin(T * 0.15), 0.35, 9.5 - 1.2 * push], tgt: [0.2, 0.05, 0], fov: 30 };
    applyCam(this.cam, k, Math.exp(-Math.max(0, T - T_LOCK) * 7) * (T >= T_LOCK ? 1 : 0));
    const g = this.layer.ctx; this.layer.clear();
    typeLine(g, 'made by an agent.', 960, 820, T, bar(105), { size: 40, cps: 18, align: 'center', color: C.bone, cursor: false });
    typeLine(g, 'finished by you.', 960, 876, T, bar(106.5), { size: 40, cps: 18, align: 'center', color: C.signal, cursor: false });
    typeLine(g, 'github.com/PenguinBTW/Fx-Studio', 960, 980, T, bar(110), { size: 28, cps: 30, align: 'center', color: C.ash, cursor: false });
    const fade = 1 - prog(T, bar(118.6), END - 0.6, ease.inOutCubic);
    present(this.ctx, out, this.scene, this.cam, this.layer, undefined, 0x07070a, overlayTextDuck(f.tin, f.tout));
    return { exposure: 1.0 * clamp(fade), bloom: 0.8, bloomThreshold: 0.75, vignette: 0.55, grain: 0.04 };
  }
}
