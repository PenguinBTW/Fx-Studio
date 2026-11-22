// a7_rewrite (bars 53-68): "so i rewrite it." We are inside the blown-out v1 still from the wall: the A4 city rebuilt
// with the v1 look (bright concrete, hot windows, hard key, full env). An orange playhead sweeps back and the
// city un-builds behind it; on "quick rewrite it" it sweeps forward and rebuilds with the v2 parameters. It ends on a
// true before/after: the v1 print left of the playhead, the live v2 city right of it, from the same camera.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { F, font } from '../../engine/type';
import { clamp, ease, prog } from '../../engine/util';
import { release, C, BEAT, bar, model, part, present, sceneTime, heroLights, enableShadows, Instanced, camPath, applyCam, typeLine, barOf, h1, studioEnv, HALO, type CamKey } from './kit';

const V1_URL = Object.values(import.meta.glob<string>('./prints/v1_07_*.jpg', { eager: true, query: '?url', import: 'default' }))[0]!;
const SP = 1.3, GX = 6, GZ = 16, lotZ = (gz: number) => 6 - gz * SP;
const T_BACK = bar(56.5), T_RW = 105.39 + 6 * BEAT, SWEEP = 1.6, T_SPLIT = bar(64);
const V1_CAM: CamKey = { pos: [7.03, 6.18, 8.19], tgt: [0.47, 0.54, -6], fov: 40.1 };
const CAM: [number, CamKey][] = [
  [53, V1_CAM], [56, { pos: [7.6, 6.6, 8.9], tgt: [0.4, 0.5, -6], fov: 40 }],
  [59.5, { pos: [9, 7.5, 9], tgt: [0, 0.5, -4], fov: 40 }], [62.5, { pos: [-6, 4.5, 7], tgt: [1, 1, -3], fov: 40 }],
  [64, V1_CAM], [68, V1_CAM],
];
const px = (x: number) => -GX * SP + x * GX * 2 * SP;

export default class A7Rewrite extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(37, 16 / 9, 0.05, 140);
  private layer = new Layer2D();
  private lots: { x: number; z: number; type: number; h: number; k: number }[] = [];
  private towers: Instanced[] = []; private caps!: Instanced; private tiles!: Instanced;
  private mats: Record<string, THREE.MeshStandardMaterial> = {};
  private fog = new THREE.Fog(0x07090a, 14, 46);
  private key!: THREE.DirectionalLight; private head!: THREE.Object3D; private img = new Image();
  private p = new THREE.Vector3(); private q = new THREE.Quaternion(); private s = new THREE.Vector3();

  override async init() {
    enableShadows(this.ctx);
    for (let gz = 1; gz <= GZ; gz++) for (let gx = -GX; gx <= GX; gx++) {
      if (gx === 0) continue;
      const i = (gz - 1) * (GX * 2) + (gx < 0 ? gx + GX : gx + GX - 1);
      this.lots.push({ x: gx * SP, z: lotZ(gz), type: Math.floor(h1(i, 1) * 3), h: gz === 4 && gx >= 1 && gx <= 5 ? 1.8 : 0.8 + 3.4 * h1(i, 2) ** 1.6 + (Math.abs(gx) > 3 ? 0.8 * h1(i, 5) : 0), k: this.lots.length });
    }
    const kit = await model(this.ctx, 'city_kit');
    kit.root.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m) this.mats[m.name] = m; });
    for (const [pre, ox] of [['tower_a', 0], ['tower_b', 2], ['tower_c', 4]] as const) {
      const I = new Instanced(kit, this.lots.length, undefined, (n) => n.startsWith(pre));
      for (const im of I.meshes) { im.geometry.translate(-ox, 0, 0); im.castShadow = im.receiveShadow = true; }
      this.towers.push(I); this.scene.add(I.group);
    }
    this.caps = new Instanced(kit, this.lots.length, (_n, m) => (m as THREE.MeshStandardMaterial).clone(), (n) => n === 'lit_a');
    for (const im of this.caps.meshes) im.geometry.translate(-6, -0.5, 0);
    this.tiles = new Instanced(kit, 80, undefined, (n) => n === 'pcb' || n.startsWith('trace'));
    for (const im of this.tiles.meshes) { im.geometry.translate(0, 0, 6); im.receiveShadow = true; }
    let t = 0; for (let ix = 0; ix < 10; ix++) for (let iz = 0; iz < 8; iz++) { this.p.set(-18 + ix * 4, 0, 6 - iz * 4); this.s.set(1, 1, 1); this.tiles.set(t++, this.p, this.q.identity(), this.s); }
    this.tiles.commit(); this.scene.add(this.caps.group, this.tiles.group);
    const sf = await model(this.ctx, 'split_flap'); this.head = new THREE.Group();
    for (const n of ['playhead_mast', 'playhead_cap']) { const o = part(sf, n).clone(); o.position.x -= 30; this.head.add(o); }
    this.head.scale.set(1, 1.6, 1); this.scene.add(this.head, new THREE.PointLight(0xff5a1f, 0, 1));
    const L = heroLights(this.scene, 0xffd2a0, 0x8fc6e8, 2.2, 1.3, 0.2); this.key = L.key;
    L.key.position.set(10, 16, 8); L.key.target.position.set(0, 0, -10);
    Object.assign(L.key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 70 }); L.key.shadow.camera.updateProjectionMatrix();
    L.rim.position.set(-8, 5, -30);
    this.scene.environment = studioEnv(this.ctx.renderer);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x040605, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.09; this.scene.add(ground);
    this.scene.background = new THREE.Color(0x07090a);
    this.img.src = V1_URL; await this.img.decode();
  }

  private version(v2: boolean) {
    const m = this.mats;
    if (v2) m.Concrete!.color.setRGB(0.0331, 0.0368, 0.0423); else m.Concrete!.color.setRGB(0.2, 0.205, 0.22); m.Concrete!.roughness = v2 ? 0.75 : 0.7;
    m.Window!.emissiveIntensity = v2 ? 0.45 : 1.1;
    for (const im of this.caps.meshes) (im.material as THREE.MeshStandardMaterial).emissiveIntensity = v2 ? 0.3 : 1.0;
    if (v2) m.Glass!.color.setRGB(0.003, 0.0044, 0.006); else m.Glass!.color.setRGB(0.05, 0.07, 0.09);
    this.key.intensity = v2 ? 1.4 : 1.6; this.scene.environmentIntensity = v2 ? 0.35 : 0.55;
    this.scene.fog = v2 ? this.fog : null;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t), b = barOf(T);
    const back = prog(T, T_BACK, T_BACK + SWEEP, ease.inOutCubic), fwd = prog(T, T_RW, T_RW + SWEEP, ease.inOutCubic);
    const v2 = T >= T_RW;
    this.version(v2);
    // Playhead x: sweeps right->left (rewind), then left->right (rewrite). Lots left of it in the rewind are erased.
    const headX = T < T_RW ? px(1 - back) + (back > 0 ? 0 : 99) : px(fwd) - (fwd >= 1 ? 99 : 0);
    for (const l of this.lots) {
      let g = 1;
      if (T >= T_BACK && T < T_RW) g = 1 - (l.x > headX ? ease.inCubic(clamp((l.x - headX) / 1.2)) : 0);
      if (T >= T_RW) g = fwd >= 1 ? 1 : ease.outBack(clamp((headX - l.x) / 1.6 + 0.2 * h1(l.k, 3) - 0.2));
      const h = l.h * clamp(g, 0, 1.2);
      this.p.set(l.x, 0, l.z);
      for (let k = 0; k < 3; k++) { const vis = k === l.type && h > 0.004; this.s.set(vis ? 1 : 1e-4, vis ? h : 1e-4, vis ? 1 : 1e-4); this.towers[k]!.set(l.k, this.p, this.q, this.s); }
      this.p.set(l.x, h + 0.01, l.z); const on = h > 0.05 ? 1 : 1e-4; this.s.set(on, on, on); this.caps.set(l.k, this.p, this.q, this.s);
    }
    for (const t of this.towers) t.commit(); this.caps.commit();
    const sweeping = (back > 0 && back < 1) || (fwd > 0 && fwd < 1);
    this.head.visible = sweeping; this.head.position.set(headX, 0, -2);
    applyCam(this.cam, camPath(CAM, b));
    const g = this.layer.ctx; this.layer.clear();
    const duck = overlayTextDuck(f.tin, f.tout);
    typeLine(g, 'so i rewrite it.', 150, 900, T, bar(53.6), { size: 42, cps: 20, color: C.bone, t1: bar(56.3), plate: true });
    const tag = (s: string, x: number, col: string) => { g.font = font(F.mono(500), 34); g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = HALO; g.strokeText(s, x, 90); g.fillStyle = col; g.fillText(s, x, 90); };
    if (T < T_BACK) tag('v1', 80, C.bone);
    if (T >= T_RW + SWEEP && T < T_SPLIT) tag('v2', 80, C.bone);
    const split = prog(T, T_SPLIT, T_SPLIT + 0.9, ease.inOutCubic);
    let extra: (() => void) | undefined;
    if (split > 0) {
      g.save(); g.beginPath(); g.rect(0, 0, 960 * split, 1080); g.clip(); g.drawImage(this.img, 0, 0, 1920, 1080); g.restore();
      g.fillStyle = C.signal; g.fillRect(960 * split - 4, 0, 8, 1080);
      tag('v1', 60, C.bone); if (split >= 1) tag('v2', 1860 - 50, C.bone);
      const l = prog(T, T_SPLIT + 0.9, T_SPLIT + 1.5, ease.outCubic);
      if (l > 0) { g.save(); g.strokeStyle = '#D9262B'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.ellipse(480, 500, 340, 300, -0.08, -2.2, -2.2 + l * 2.08 * Math.PI); g.stroke(); g.restore(); }
      typeLine(g, '+2 stops', 480, 880, T, T_SPLIT + 1.5, { size: 40, cps: 20, align: 'center', color: '#D9262B', cursor: false, plate: true });
      typeLine(g, 'same camera. same bars.', 960, 1000, T, T_SPLIT + 1.2, { size: 36, cps: 24, align: 'center', color: C.bone, cursor: false, plate: true });
    }
    present(this.ctx, out, this.scene, this.cam, this.layer, extra, 0x07090a, split > 0 ? Math.max(duck, 1) : duck);
    return { exposure: 1.0, bloom: 0.7, bloomThreshold: 0.85, vignette: 0.5, grain: 0.04 };
  }

  override dispose() { release(this.scene); this.layer.texture.dispose(); }
}
