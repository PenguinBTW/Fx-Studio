// a5_print (bars 31-36): "then i watch it." The build freezes and comes out of a photo printer as a real still of
// this film (the prints are the v1 review captures in ./prints). On every "Technologic" another still ejects and flies
// to a cork review wall. The camera pulls back from the slot until it squares up to the wall (exit: forward, agp_drop).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { ease, prog } from '../../engine/util';
import { C, BEAT, bar, model, part, present, sceneTime, heroLights, enableShadows, shadows, camPath, applyCam, typeLine, barOf, type CamKey } from './kit';

const PRINT_URLS = Object.entries(import.meta.glob<string>('./prints/v1_*.jpg', { eager: true, query: '?url', import: 'default' })).sort(([a], [b]) => a.localeCompare(b)).map(([, u]) => u);
export const WALL_Z = -3.5, PW = 1.6, PH = 0.9;
export const wallSlot = (i: number) => new THREE.Vector3(-2.7 + (i % 4) * 1.8, 2.85 - Math.floor(i / 4) * 1.25, WALL_Z + 0.075);
export const PRINT_T = [bar(31) + 0.15, 61.05, 63.05, 64.98, 66.82, 67.82, 67.82 + BEAT, 67.82 + 2 * BEAT];
const SCALE = 1.3, SLOT = new THREE.Vector3(0, 0.42 * SCALE + 0.01, 0.3 * SCALE);
const CAM: [number, CamKey][] = [
  [30.8, { pos: [0.15, 0.78, 1.25], tgt: [0, 0.5, 0.75], fov: 34 }],
  [32.6, { pos: [1.3, 1.4, 3.2], tgt: [0, 0.9, 0], fov: 36 }],
  [34.8, { pos: [-0.6, 2.2, 5.6], tgt: [0, 1.9, -3.5], fov: 38 }],
  [36.9, { pos: [0, 2.15, 3.4], tgt: [0, 2.15, -3.5], fov: 36 }],
];

/** A photo print: white paper with the still inset; origin at the print centre, face +z. */
export function makePrint(tex: THREE.Texture): THREE.Group {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.12, PH + 0.16, 0.006), new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.7 }));
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 }));
  photo.position.set(0, 0.03, 0.0035); photo.name = 'photo';
  paper.castShadow = paper.receiveShadow = true; photo.receiveShadow = true;
  g.add(paper, photo);
  return g;
}
export async function loadPrints(): Promise<THREE.Texture[]> {
  const L = new THREE.TextureLoader();
  return Promise.all(PRINT_URLS.map(async (u) => { const t = await L.loadAsync(u); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }));
}

export default class A5Print extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.05, 80);
  private layer = new Layer2D();
  private prints: THREE.Group[] = []; private pins: THREE.Object3D[] = []; private texs: THREE.Texture[] = [];
  private tally!: THREE.MeshStandardMaterial;
  private flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)); private up = new THREE.Quaternion();

  override async init() {
    enableShadows(this.ctx);
    const pr = await model(this.ctx, 'printer'); shadows(pr.root); pr.root.scale.setScalar(SCALE); this.scene.add(pr.root);
    const tm = part(pr, 'tally') as THREE.Mesh; this.tally = (tm.material as THREE.MeshStandardMaterial).clone(); tm.material = this.tally;
    const wall = await model(this.ctx, 'cork_wall'); shadows(wall.root); wall.root.position.z = WALL_Z; this.scene.add(wall.root);
    const head = part(wall, 'pin_head'), needle = part(wall, 'pin_needle');
    for (const o of [head, needle, part(wall, 'lamp_shade'), part(wall, 'lamp_arm')]) o.visible = false;
    this.texs = await loadPrints();
    for (let i = 0; i < PRINT_T.length; i++) {
      const p = makePrint(this.texs[i % this.texs.length]!); this.prints.push(p); this.scene.add(p);
      const pin = new THREE.Group(); const h = head.clone(), n = needle.clone(); h.visible = n.visible = true;
      h.position.set(0, 0, 0.06); n.position.set(0, 0, 0); pin.add(h, n); this.pins.push(pin); this.scene.add(pin);
    }
    const L = heroLights(this.scene, 0xe8eef8, 0x9cc9e8, 1.2, 1.0, 0.18); L.key.position.set(1.5, 6, 3); L.rim.position.set(-4, 3, -6);
    Object.assign(L.key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); L.key.shadow.camera.updateProjectionMatrix();
    const spot = new THREE.SpotLight(0xffc890, 14, 14, 0.7, 0.6, 1.5); spot.position.set(-1.5, 5.2, WALL_Z + 2.6); spot.target.position.set(0, 2.1, WALL_Z);
    spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); this.scene.add(spot, spot.target);
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.55, metalness: 0.2 }));
    desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; this.scene.add(desk);
    this.scene.background = new THREE.Color(0x08090c); this.scene.fog = new THREE.Fog(0x08090c, 9, 22);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t), b = barOf(T);
    let ejecting = 0;
    for (let i = 0; i < this.prints.length; i++) {
      const t0 = PRINT_T[i]!, slow = i === 0 ? 1.5 : 0.4, tf = t0 + slow + (i === 0 ? 0.6 : 0.15);
      const e = prog(T, t0, t0 + slow, ease.outCubic), fl = prog(T, tf, tf + 0.75, ease.inOutCubic);
      const p = this.prints[i]!, pin = this.pins[i]!;
      p.visible = T >= t0; pin.visible = fl >= 1;
      if (T >= t0 && T < t0 + slow) ejecting = 1;
      const a = SLOT.clone().add(new THREE.Vector3(0, 0, -PH * 0.5 + (PH + 0.2) * e));
      const w = wallSlot(i), mid = a.clone().lerp(w, 0.5).add(new THREE.Vector3(0, 1.4, 0.8));
      const k = fl, ik = 1 - k;
      p.position.set(ik * ik * a.x + 2 * ik * k * mid.x + k * k * w.x, ik * ik * a.y + 2 * ik * k * mid.y + k * k * w.y, ik * ik * a.z + 2 * ik * k * mid.z + k * k * w.z);
      this.up.setFromEuler(new THREE.Euler(0, 0, 0.04 * Math.sin(i * 2.3)));
      p.quaternion.copy(this.flat).slerp(this.up, k);
      p.rotateY(Math.sin(k * Math.PI) * 0.6 * (i % 2 ? 1 : -1));
      pin.position.set(w.x, w.y + PH * 0.42, WALL_Z + 0.08);
      pin.scale.setScalar(ease.outBack(prog(T, tf + 0.75, tf + 0.95)));
    }
    this.tally.emissiveIntensity = 1 + 7 * ejecting;
    applyCam(this.cam, camPath(CAM, b));
    const g = this.layer.ctx; this.layer.clear();
    typeLine(g, 'then i watch it.', 150, 900, T, bar(31.5), { size: 42, cps: 20, color: C.bone, t1: bar(36.5) });
    present(this.ctx, out, this.scene, this.cam, this.layer, undefined, 0x08090c, overlayTextDuck(f.tin, f.tout));
    return { exposure: 1.0, bloom: 0.5, bloomThreshold: 0.9, vignette: 0.5, grain: 0.04 };
  }
  override dispose() { for (const t of this.texs) t.dispose(); }
}
