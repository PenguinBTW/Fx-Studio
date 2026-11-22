// a4_build (bars 20-30): the build, on the lyric. "Write it" a tower welds up; "cut it" an orange blade slices it;
// "paste it" four copies drop in beside it; "save it" their roofs light; "load it" the circuit city rises outward;
// "check it" an orange scan ring sweeps the board; "quick rewrite it" the first tower rewinds and is rebuilt taller.
// Then the camera flies the avenue past welding arms and the A3 drones, and rises (exit: freeze for agp_shutter).
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { clamp, ease, prog } from '../../engine/util';
import { release, C, BEAT, bar, beatAt, model, part, present, sceneTime, heroLights, enableShadows, shadows, Instanced, camPath, applyCam, train, barOf, h1, spin, studioEnv, type CamKey } from './kit';

const SP = 1.3, GX = 6, GZ = 30, lotZ = (gz: number) => 6 - gz * SP;
const W = (k: number) => beatAt(20, k);
const HERO = { gx: 1, gz: 4 }, CUT_H = 1.8, HERO_H = 3.1;
const PASTE = [2, 3, 4, 5];
const ARM_Z = [6, 10, 14, 18, 22, 26];
interface Lot { x: number; z: number; type: number; h: number; t0: number; role: 'hero' | 'paste' | 'city'; k: number }
const CAM: [number, CamKey][] = [
  [19.6, { pos: [7, 15, 15], tgt: [1.3, 0, 0], fov: 40 }],
  [20.1, { pos: [4.6, 3.6, 5.6], tgt: [1.6, 1.5, 0.6], fov: 36 }],
  [21.4, { pos: [5.0, 3.0, 6.0], tgt: [2.6, 1.4, 0.6], fov: 38 }],
  [23.2, { pos: [7.5, 6.5, 8.5], tgt: [0.5, 0.5, -6], fov: 40 }],
  [24.6, { pos: [0, 1.4, 3.5], tgt: [0, 1.2, -6], fov: 46 }],
  [29.2, { pos: [0, 1.7, -24], tgt: [0, 1.4, -34], fov: 46 }],
  [30.8, { pos: [0, 7.5, -27], tgt: [0, 0.8, -36], fov: 40 }],
];

export default class A4Build extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 140);
  private layer = new Layer2D();
  private lots: Lot[] = [];
  private towers: Instanced[] = []; private caps!: Instanced; private top!: Instanced; private tiles!: Instanced; private drones!: Instanced;
  private arms: { o: THREE.Object3D; j: THREE.Object3D[]; q: THREE.Quaternion[]; tip: THREE.MeshStandardMaterial; light: THREE.PointLight; lot: Lot; s: number }[] = [];
  private blade!: THREE.Mesh; private ring!: THREE.Mesh;
  private p = new THREE.Vector3(); private q = new THREE.Quaternion(); private s = new THREE.Vector3(); private e = new THREE.Euler();

  override async init() {
    enableShadows(this.ctx);
    const wave0 = W(4);
    for (let gz = 1; gz <= GZ; gz++) for (let gx = -GX; gx <= GX; gx++) {
      if (gx === 0) continue;
      const i = this.lots.length, x = gx * SP, z = lotZ(gz);
      const hero = gx === HERO.gx && gz === HERO.gz, paste = gz === HERO.gz && PASTE.includes(gx);
      const d = Math.hypot(gx - HERO.gx, (gz - HERO.gz) * 0.35);
      this.lots.push({ x, z, type: Math.floor(h1(i, 1) * 3), h: 0.8 + 3.4 * h1(i, 2) ** 1.6 + (Math.abs(gx) > 3 ? 0.8 * h1(i, 5) : 0),
        t0: hero ? W(0) : paste ? W(2) + (gx - 2) * 0.03 : wave0 + d * 0.16 + gz * 0.12, role: hero ? 'hero' : paste ? 'paste' : 'city', k: i });
    }
    const kit = await model(this.ctx, 'city_kit');
    kit.root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (!m) return;
      if (m.name === 'Concrete') { m.color.set(0x34363a); m.roughness = 0.75; }
      if (m.name === 'Glass') { m.color.set(0x0a0e12); m.envMapIntensity = 0.6; }
      if (m.name === 'Window') m.emissiveIntensity = 0.9;
      if (m.name === 'Copper') { m.roughness = 0.45; m.envMapIntensity = 0.35; m.color.set(0x8a5a32); }
      if (m.name === 'PCB') m.color.set(0x0c1d15);
    });
    const off: [string, number][] = [['tower_a', 0], ['tower_b', 2], ['tower_c', 4]];
    for (const [pre, ox] of off) {
      const I = new Instanced(kit, this.lots.length, undefined, (n) => n.startsWith(pre));
      for (const im of I.meshes) { im.geometry.translate(-ox, 0, 0); im.castShadow = im.receiveShadow = true; }
      this.towers.push(I); this.scene.add(I.group);
    }
    this.top = new Instanced(kit, 1, undefined, (n) => n.startsWith('tower_a'));
    for (const im of this.top.meshes) im.castShadow = true;
    this.caps = new Instanced(kit, this.lots.length, (_n, m) => { const c = (m as THREE.MeshStandardMaterial).clone(); c.emissiveIntensity = 0.3; return c; }, (n) => n === 'lit_a');
    for (const im of this.caps.meshes) im.geometry.translate(-6, -0.5, 0);
    this.tiles = new Instanced(kit, 120, undefined, (n) => n === 'pcb' || n.startsWith('trace'));
    for (const im of this.tiles.meshes) { im.geometry.translate(0, 0, 6); im.receiveShadow = true; }
    this.scene.add(this.top.group, this.caps.group, this.tiles.group);
    let t = 0;
    for (let ix = 0; ix < 10; ix++) for (let iz = 0; iz < 12; iz++) {
      this.p.set(-18 + ix * 4, 0, 6 - iz * 4); this.s.set(1, 1, 1); this.tiles.set(t++, this.p, this.q.identity(), this.s);
    }
    this.tiles.commit();
    const dm = await model(this.ctx, 'drone'); this.drones = new Instanced(dm, 18); this.scene.add(this.drones.group);
    const tA = bar(24.6), tB = bar(29.2);
    for (let k = 0; k < ARM_Z.length; k++) {
      const gz = ARM_Z[k]!, s = k % 2 ? -1 : 1;
      const lot = this.lots.find((l) => l.x === s * SP && l.z === lotZ(gz))!;
      lot.t0 = tA + ((gz - 3) / 24) * (tB - tA) - 0.9; lot.h = 2.6 + 0.6 * h1(k, 7);
      const m = await model(this.ctx, 'robot_arm'); shadows(m.root);
      m.root.position.set(s * 0.32, 0, lot.z); m.root.rotation.y = s > 0 ? 0 : Math.PI; m.root.scale.setScalar(0.55);
      const j = ['j1', 'j2', 'j3', 'j4'].map((n) => part(m, n));
      const tipO = part(m, 'torch_tip') as THREE.Mesh;
      const tip = (tipO.material as THREE.MeshStandardMaterial).clone(); tipO.material = tip;
      const light = new THREE.PointLight(0xff7a30, 0, 5, 2);
      this.scene.add(m.root, light);
      this.arms.push({ o: m.root, j, q: j.map((o) => o.quaternion.clone()), tip, light, lot, s });
    }
    const sig = new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff5a1f, emissiveIntensity: 8 });
    this.blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 2.2), sig); this.scene.add(this.blade);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 160).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.ring.position.set(HERO.gx * SP, 0.02, lotZ(HERO.gz)); this.scene.add(this.ring);
    const L = heroLights(this.scene, 0xffd2a0, 0x8fc6e8, 1.4, 1.3, 0.2);
    L.key.position.set(10, 16, 8); L.key.target.position.set(0, 0, -10);
    Object.assign(L.key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 70 }); L.key.shadow.camera.updateProjectionMatrix();
    L.rim.position.set(-8, 5, -30);
    this.scene.environment = studioEnv(this.ctx.renderer); this.scene.environmentIntensity = 0.35;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x040605, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.09; this.scene.add(ground);
    this.scene.background = new THREE.Color(0x07090a); this.scene.fog = new THREE.Fog(0x07090a, 14, 46);
  }

  private height(l: Lot, T: number): { h: number; type: number; y: number } {
    if (l.role === 'hero') {
      if (T < W(6)) return { h: (T < W(1) + 0.06 ? HERO_H : CUT_H) * ease.outBack(prog(T, l.t0, l.t0 + 0.32)), type: 0, y: 0 };
      const down = prog(T, W(6), W(6) + 0.24, ease.inCubic);
      if (down < 1) return { h: CUT_H * (1 - down), type: 0, y: 0 };
      return { h: 4.4 * ease.outBack(prog(T, W(6) + 0.26, W(7) + 0.3)), type: 2, y: 0 };
    }
    if (l.role === 'paste') { const d = prog(T, l.t0, l.t0 + 0.2, ease.inQuad); return { h: T >= l.t0 ? CUT_H : 0, type: 0, y: 6 * (1 - d) }; }
    const weld = this.arms.some((a) => a.lot === l);
    const g = weld ? prog(T, l.t0, l.t0 + 1.6, ease.outCubic) : ease.outBack(prog(T, l.t0, l.t0 + 0.45));
    return { h: l.h * g, type: l.type, y: 0 };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t), b = barOf(T);
    for (const l of this.lots) {
      const { h, type, y } = this.height(l, T);
      this.p.set(l.x, y, l.z); this.q.identity();
      for (let k = 0; k < 3; k++) { const vis = k === type && h > 0.004; this.s.set(vis ? 1 : 1e-4, vis ? h : 1e-4, vis ? 1 : 1e-4); this.towers[k]!.set(l.k, this.p, this.q, this.s); }
      const done = l.role === 'city' ? prog(T, l.t0 + 0.5 + 1.2 * h1(l.k, 9), l.t0 + 0.7 + 1.2 * h1(l.k, 9)) : prog(T, W(3), W(3) + 0.12);
      const on = h > 0.01 && !(l.role === 'hero' && T > W(6) && T < W(7) + 0.3) ? done : 0;
      this.p.set(l.x, y + h + 0.01, l.z); this.s.set(on, on, on); this.caps.set(l.k, this.p, this.q, this.s);
    }
    for (const t of this.towers) t.commit(); this.caps.commit();
    const u = prog(T, W(1) + 0.06, W(1) + 1.1), hx = HERO.gx * SP, hz = lotZ(HERO.gz);
    this.e.set(0, 0, 1.3 * u); this.q.setFromEuler(this.e);
    this.p.set(hx - 1.7 * u, CUT_H + 0.5 * u - 4.2 * u * u, hz); this.s.set(1, u > 0 && u < 1 ? HERO_H - CUT_H : 1e-4, 1);
    this.top.set(0, this.p, this.q, this.s); this.top.commit();
    const bu = prog(T, W(1) - 0.06, W(1) + 0.14);
    this.blade.visible = bu > 0 && bu < 1; this.blade.position.set(hx - 1.2 + 2.6 * bu, CUT_H, hz);
    const ru = prog(T, W(5), W(5) + 1.7, ease.outCubic);
    this.ring.visible = ru > 0 && ru < 1; this.ring.scale.setScalar(0.3 + 42 * ru); (this.ring.material as THREE.MeshBasicMaterial).opacity = 1 - ru;
    for (const a of this.arms) {
      const w = prog(T, a.lot.t0 - 0.3, a.lot.t0) * (1 - prog(T, a.lot.t0 + 1.6, a.lot.t0 + 1.9));
      const ph = T * 2.3 + a.lot.k;
      spin(a.j[0]!, a.q[0]!, 0.12 * Math.sin(ph * 0.7));
      spin(a.j[1]!, a.q[1]!, -0.25 + 0.3 * w * Math.sin(ph) + 0.1 * Math.sin(T * 0.6), new THREE.Vector3(0, 0, -1));
      spin(a.j[2]!, a.q[2]!, 0.35 * Math.sin(ph * 1.3 + 1) * (0.4 + 0.6 * w), new THREE.Vector3(0, 0, -1));
      spin(a.j[3]!, a.q[3]!, 0.4 * Math.sin(ph * 0.9), new THREE.Vector3(0, 0, -1));
      const flick = 0.55 + 0.45 * Math.abs(Math.sin(T * 47 + a.lot.k * 3.1)) * Math.abs(Math.sin(T * 31));
      a.tip.emissiveIntensity = 1.5 + 9 * w * flick;
      a.o.updateMatrixWorld(true); a.j[3]!.getWorldPosition(a.light.position); a.light.position.x += a.s * 0.4;
      a.light.intensity = 3.5 * w * flick;
    }
    for (let i = 0; i < 18; i++) {
      const z = 10 - (((T - bar(19.5)) * 5.5 + i * 2.6) % 48), x = (h1(i, 4) - 0.5) * 10;
      this.p.set(x, 4.2 + 0.8 * h1(i, 6) + 0.1 * Math.sin(T * 2 + i), z); this.e.set(-0.2, Math.PI, 0.05 * Math.sin(T + i)); this.q.setFromEuler(this.e);
      this.s.setScalar(1.3); this.drones.set(i, this.p, this.q, this.s);
    }
    this.drones.commit();
    applyCam(this.cam, camPath(CAM, b), Math.exp(-Math.max(0, T - W(0)) * 8) * (T >= W(0) ? 1 : 0));
    const g = this.layer.ctx; this.layer.clear();
    const words = ['WRITE', 'CUT', 'PASTE', 'SAVE', 'LOAD', 'CHECK', 'REWRITE'];
    train(g, words.map((text, k) => ({ text, t: W(k), color: k === 6 ? C.signal : C.bone })), T, 960, 860, { size: 170, tracking: 4, from: 1.5, out: 0.08 }, W(7) + 0.45);
    present(this.ctx, out, this.scene, this.cam, this.layer, undefined, 0x07090a, overlayTextDuck(f.tin, f.tout));
    return { exposure: 1.0, bloom: 0.7, bloomThreshold: 0.85, vignette: 0.5, grain: 0.04 };
  }

  override dispose() { release(this.scene); }
}
