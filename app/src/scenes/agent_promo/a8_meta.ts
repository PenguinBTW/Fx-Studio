// a8_meta (bars 69-80): the film as an object. The whole 224 s timeline lies on a plinth (12 act blocks, 119 bar
// notches); the orange playhead walks it at film time while a split-flap counter shows the real frame number (60 fps).
// "frame N. again." the playhead seeks back four bars and the counter lands on the same frame; "same frame." with the
// hash from the real determinism check (facts.json). The camera pulls out over the whole film (exit: agp_pullout).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { F, font } from '../../engine/type';
import { clamp, ease, prog } from '../../engine/util';
import { C, bar, model, part, present, sceneTime, heroLights, enableShadows, shadows, camPath, applyCam, typeLine, barOf, ACT_BARS, FACTS, textureText, type CamKey } from './kit';

const FPS = 60, DUR = 224.436, LEN = 18, tx = (t: number) => -LEN / 2 + (t / DUR) * LEN;
const T_SEEK = bar(73), BACK = bar(73) - bar(69), T_SAME = bar(75), HOLD_END = bar(78.5);
const ACT_COL = [0x2a2a2e, 0xd8cdb4, 0xb89a6a, 0x34405a, 0x2f5a46, 0x6a6e78, 0x8a3a30, 0x4a6a8a, 0x8a7a5a, 0x5a4a6a, 0x3a3a3a, 0xd8d2c4];
const CAM: [number, CamKey][] = [
  [68.8, { pos: [0.6, 2.3, 2.6], tgt: [0, 2.1, -1], fov: 34 }],
  [72.5, { pos: [-1.5, 1.6, 3.4], tgt: [0, 1.6, -1], fov: 36 }],
  [74.5, { pos: [tx(bar(70)) + 1.2, 0.9, 1.6], tgt: [tx(bar(70)), 0.5, 0], fov: 34 }],
  [77, { pos: [2.5, 3.0, 6.5], tgt: [0, 1.0, -0.5], fov: 38 }],
  [80.9, { pos: [0, 11, 15], tgt: [0, 0, -1], fov: 40 }],
];

export default class A8Meta extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.05, 120);
  private layer = new Layer2D();
  private head!: THREE.Group; private digits: { cv: HTMLCanvasElement; tex: THREE.CanvasTexture }[] = [];
  private glow = new THREE.PointLight(0xff5a1f, 3, 3, 2);

  override async init() {
    enableShadows(this.ctx);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(LEN + 0.6, 0.3, 1.2), new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.4, metalness: 0.5 }));
    plinth.position.y = 0.15; plinth.castShadow = plinth.receiveShadow = true; this.scene.add(plinth);
    for (let a = 0; a < 12; a++) {
      const t0 = a === 0 ? 0 : bar(ACT_BARS[a]!), t1 = a === 11 ? DUR : bar(ACT_BARS[a + 1]!), w = tx(t1) - tx(t0) - 0.03;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.6), new THREE.MeshStandardMaterial({ color: ACT_COL[a]!, roughness: 0.5 }));
      m.position.set((tx(t0) + tx(t1)) / 2, 0.39, -0.15); m.castShadow = m.receiveShadow = true; this.scene.add(m);
    }
    const notch = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.03, 0.16), new THREE.MeshStandardMaterial({ color: 0xede6d6, roughness: 0.4 }), 119);
    const m4 = new THREE.Matrix4(); for (let k = 1; k <= 119; k++) notch.setMatrixAt(k - 1, m4.makeTranslation(tx(bar(k)), 0.315, 0.4));
    this.scene.add(notch);
    const sf = await model(this.ctx, 'split_flap'); shadows(sf.root);
    this.head = new THREE.Group();
    for (const n of ['playhead_mast', 'playhead_cap']) { const o = part(sf, n); o.removeFromParent(); o.position.x -= 30; this.head.add(o); }
    this.head.scale.setScalar(0.32); this.scene.add(this.head, this.glow);
    part(sf, 'flap').visible = false;
    sf.root.position.set(0, 2.1, -1.2); sf.root.scale.setScalar(0.55); this.scene.add(sf.root);
    for (let i = 0; i < 6; i++) {
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 192;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; this.digits.push({ cv, tex });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.26), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }));
      pl.position.set(-2.5 + i * 1.0, 0, 0.105); sf.root.add(pl);
    }
    const L = heroLights(this.scene, 0xffd7a0, 0x9cc9e8, 1.6, 1.8, 0.15); L.key.position.set(4, 8, 6); L.rim.position.set(-6, 3, -6);
    Object.assign(L.key.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 }); L.key.shadow.camera.updateProjectionMatrix();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.6, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);
    this.scene.background = new THREE.Color(0x07070a); this.scene.fog = new THREE.Fog(0x07070a, 12, 34);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t), b = barOf(T);
    const seek = prog(T, T_SEEK, T_SEEK + 0.35, ease.inOutCubic);
    const film = T < T_SEEK ? T : THREE.MathUtils.lerp(T, T_SEEK - BACK + Math.max(0, T - HOLD_END), seek);
    const frame = Math.round(film * FPS);
    this.head.position.set(tx(film), 0.3, 0.1); this.glow.position.set(tx(film), 1.2, 0.5);
    const s = String(frame).padStart(6, '0');
    for (let i = 0; i < 6; i++) {
      const { cv, tex } = this.digits[i]!, g = cv.getContext('2d')!;
      g.fillStyle = '#0c0c0e'; g.fillRect(0, 0, 128, 192);
      g.font = font(F.mono(600), 150); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = i >= 6 - String(frame).length ? '#EDE6D6' : '#3a3936'; textureText(() => g.fillText(s[i]!, 64, 102));
      g.fillStyle = '#000'; g.fillRect(0, 94, 128, 4);
      tex.needsUpdate = true;
    }
    applyCam(this.cam, camPath(CAM, b));
    const g = this.layer.ctx; this.layer.clear();
    const f0 = Math.round((T_SEEK - BACK) * FPS);
    typeLine(g, `frame ${f0}. again.`, 150, 900, T, T_SEEK - 0.9, { size: 42, cps: 22, color: C.bone, t1: T_SAME - 0.3 });
    typeLine(g, 'same frame.', 150, 900, T, T_SAME, { size: 42, cps: 22, color: C.signal, t1: bar(78.5) });
    if (FACTS.frameHash) typeLine(g, `sha256 ${String(FACTS.frameHash).slice(0, 12)}…  x2, identical`, 150, 966, T, T_SAME + 0.7, { size: 34, cps: 40, color: C.bone, cursor: false, t1: bar(78.5) });
    present(this.ctx, out, this.scene, this.cam, this.layer, undefined, 0x07070a, overlayTextDuck(f.tin, f.tout));
    return { exposure: 1.0, bloom: 0.7, bloomThreshold: 0.8, vignette: 0.5, grain: 0.04 };
  }
}
