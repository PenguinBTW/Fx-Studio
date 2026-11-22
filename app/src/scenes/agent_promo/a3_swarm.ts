// a3_swarm (bars 15-19): orchestration. The marker's light is a drone; on every half bar each drone splits in two
// (1 -> 64), children flying out of their parent into a breathing lattice. On bar 18.5 the swarm peels off and dives
// forward-down (exit vector) toward the circuit city of A4.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { overlayTextDuck } from '../../engine/transition';
import { clamp, ease, prog } from '../../engine/util';
import { C, bar, BAR, model, present, sceneTime, heroLights, Instanced, camPath, applyCam, typeLine, barOf, h1, type CamKey } from './kit';

const N = 64, GENS = 6, T_SPLIT = bar(15.5), HALF = BAR / 2;
const genOf = (i: number) => (i === 0 ? 0 : Math.floor(Math.log2(i)) + 1);
const splitAt = (g: number) => T_SPLIT + (g - 1) * HALF;
const CAM: [number, CamKey][] = [
  [14.8, { pos: [0, 0.15, 1.2], tgt: [0, 0, 0], fov: 34 }],
  [16, { pos: [0.6, 0.5, 3.2], tgt: [0, 0, 0], fov: 34 }],
  [17.5, { pos: [3.5, 1.6, 7.5], tgt: [0, 0, 0], fov: 36 }],
  [18.6, { pos: [1.5, 3.2, 9.0], tgt: [0, -0.5, 0], fov: 38 }],
  [20, { pos: [0, 1.0, 4.0], tgt: [0, -6, -6], fov: 42 }],
];

export default class A3Swarm extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.05, 120);
  private layer = new Layer2D();
  private drones!: Instanced;
  private lead = new THREE.PointLight(0xff5a1f, 4, 4, 2);
  private target: THREE.Vector3[] = []; private pos: THREE.Vector3[] = [];
  private q = new THREE.Quaternion(); private e = new THREE.Euler(); private s = new THREE.Vector3(1, 1, 1);

  override async init() {
    const m = await model(this.ctx, 'drone');
    this.drones = new Instanced(m, N);
    for (const im of this.drones.meshes) { im.castShadow = true; im.receiveShadow = true; }
    this.scene.add(this.drones.group, this.lead);
    const L = heroLights(this.scene, 0xffd7a0, 0x9cc9e8, 1.6, 2.6, 0.3); L.key.position.set(3, 6, 4); L.rim.position.set(-5, 2, -6);
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i + 0.5) / N * 2, r = Math.sqrt(1 - y * y), a = i * ga;
      this.target.push(new THREE.Vector3(Math.cos(a) * r * 1.35, y * 0.75, Math.sin(a) * r * 1.35));
      this.pos.push(new THREE.Vector3());
    }
    this.scene.background = new THREE.Color(0x06070c); this.scene.fog = new THREE.Fog(0x06070c, 6, 24);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t), b = barOf(T);
    const live = Math.min(N, 2 ** clamp(Math.floor((T - T_SPLIT) / HALF) + 1, 0, GENS));
    const R = 0.6 + 2.6 * prog(T, T_SPLIT, splitAt(GENS) + 0.6, ease.inOutQuad);
    const breathe = 1 + 0.04 * Math.sin(T * 2.1);
    for (let i = 0; i < N; i++) {
      const g = genOf(i);
      const home = this.target[i]!.clone().multiplyScalar(R * breathe * (i === 0 ? 0 : 1));
      home.y += 0.06 * Math.sin(T * 3 + i);
      if (g === 0) this.pos[i]!.copy(home);
      else {
        const par = this.pos[i >> 1]!, k = ease.outBack(prog(T, splitAt(g), splitAt(g) + 0.42));
        this.pos[i]!.copy(par).lerp(home, k);
      }
    }
    const dive0 = bar(18.5);
    for (let i = 0; i < N; i++) {
      const p = this.pos[i]!.clone();
      const d = prog(T, dive0 + h1(i, 3) * 0.6, dive0 + 1.3 + h1(i, 3) * 0.6, ease.inCubic);
      p.add(new THREE.Vector3(0, -9 * d, -7 * d));
      const tilt = 0.25 * Math.sin(T * 1.3 + i) + 0.9 * d;
      this.e.set(tilt * 0.4, T * 0.3 + i, -tilt * 0.3); this.q.setFromEuler(this.e);
      const born = i === 0 ? 1 : (T >= splitAt(genOf(i)) ? 1 : 0);
      this.s.setScalar(i < live || born ? 1.5 : 0);
      this.drones.set(i, p, this.q, this.s);
    }
    this.drones.commit();
    this.lead.position.copy(this.pos[0]!).y -= 0.15; this.lead.intensity = 4 - 2 * prog(T, T_SPLIT, splitAt(GENS));
    applyCam(this.cam, camPath(CAM, b));
    const g = this.layer.ctx; this.layer.clear();
    typeLine(g, "i don't work alone.", 960, 930, T, bar(16.25), { size: 42, cps: 22, align: 'center', color: C.bone, t1: bar(18.6) });
    present(this.ctx, out, this.scene, this.cam, this.layer, undefined, 0x06070c, overlayTextDuck(f.tin, f.tout));
    return { exposure: 1.1, bloom: 1.0, bloomThreshold: 0.7, vignette: 0.55, grain: 0.05 };
  }
}
