// s5_chrome (bars 39-48, 75.61 - 95.05 s): the Blender-built chrome f(x) sculpture. Its reflections come from a live
// cube capture of light strips that sweep a quarter turn on every downbeat; glyphs slam in, fan apart, re-lock.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { F } from '../../engine/type';
import { clamp, ease, prog, springStep } from '../../engine/util';
import { C, BAR, B0, BEAT, bar, sceneTime, model, present, slam, typeLine, applyCam, mixKey, type CamKey } from './kit';

const T0 = bar(39);
const ORDER = ['f', 'lp', 'x', 'rp', 'studio'];

export default class S5Chrome extends Scene {
  private scene = new THREE.Scene();
  private envScene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.02, 200);
  private layer = new Layer2D();
  private cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  private cubeCam = new THREE.CubeCamera(0.1, 100, this.cubeRT);
  private strips: THREE.Mesh[] = [];
  private parts: { o: THREE.Object3D; rest: THREE.Vector3; rot: THREE.Euler; name: string }[] = [];
  private center = new THREE.Vector3();

  override async init() {
    const inst = await model(this.ctx, 'fx_logo');
    const logo = inst.root;
    this.scene.add(logo);
    const box = new THREE.Box3().setFromObject(logo);
    box.getCenter(this.center);
    logo.position.sub(this.center);
    const chrome = new THREE.MeshPhysicalMaterial({ color: 0xf2efe8, metalness: 1, roughness: 0.07, envMap: this.cubeRT.texture, envMapIntensity: 1.35, clearcoat: 0.6, clearcoatRoughness: 0.08 });
    const bone = new THREE.MeshStandardMaterial({ color: new THREE.Color(C.bone), metalness: 0.2, roughness: 0.45, envMap: this.cubeRT.texture, envMapIntensity: 0.6 });
    logo.traverse((o) => {
      const part = o.userData?.fx_part as string | undefined;
      if (part && ORDER.includes(part)) this.parts.push({ o, rest: o.position.clone(), rot: o.rotation.clone(), name: part });
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        let p: THREE.Object3D | null = m;
        let pn = '';
        while (p && !pn) { pn = (p.userData?.fx_part as string) ?? ''; p = p.parent; }
        m.material = pn === 'studio' ? bone : chrome;
      }
    });
    this.parts.sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));

    const mk = (w: number, h: number, col: THREE.ColorRepresentation, k: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
      this.envScene.add(m);
      this.strips.push(m);
    };
    mk(2.4, 30, 0xffffff, 8); mk(1.0, 30, C.signal, 7); mk(3.2, 30, 0xffffff, 4); mk(0.9, 30, C.ice, 6); mk(40, 1.2, 0xffffff, 3);
    // Dim soft panels so the chrome never reads as pure black between sweeps.
    for (let i = 0; i < 6; i++) { const pn = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 2 ? 0x2a2622 : 0x15171a), side: THREE.DoubleSide })); const a = (i / 6) * Math.PI * 2; pn.position.set(Math.sin(a) * 14, -2, Math.cos(a) * 14); pn.lookAt(0, -2, 0); this.envScene.add(pn); }
    this.envScene.background = new THREE.Color(0x020203);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0x08080a, metalness: 0.9, roughness: 0.22, envMap: this.cubeRT.texture, envMapIntensity: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = box.min.y - this.center.y - 0.02;
    this.scene.add(floor);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t);
    const lt = T - T0;
    const bp = (T - B0) / BAR;
    const nb = Math.floor(bp), ph = bp - nb;
    const sweep = nb + ease.inOutCubic(clamp(ph * 2.2));

    // Light strips orbit the sculpture: a quarter turn per bar, landing on the downbeat.
    this.strips.forEach((s, i) => {
      if (i === 4) { s.position.set(0, 6 + 2 * Math.sin(T * 0.7), 0); s.rotation.set(Math.PI / 2, 0, sweep * 0.5); return; }
      const a = (sweep + i * 0.25 + i * 0.07) * Math.PI * 0.5;
      s.position.set(Math.sin(a) * 9, 0, Math.cos(a) * 9);
      s.lookAt(0, 0, 0);
    });
    this.cubeCam.position.set(0, 0, 0);
    this.cubeCam.update(this.ctx.renderer, this.envScene);
    this.ctx.renderer.resetState();

    // Glyph choreography: slam in one per beat, fan apart at bar 44, re-lock at bar 46.
    const fan = prog(T, bar(44), bar(45), ease.inOutCubic) * (1 - prog(T, bar(45.75), bar(46.25), ease.inOutCubic));
    this.parts.forEach((p, i) => {
      const tIn = T0 + i * BEAT * (i === 4 ? 1.5 : 1);
      const s = T < tIn ? 0 : springStep(T - tIn, 3.2, 0.42);
      const off = (1 - s);
      const side = i - 1.5;
      p.o.position.set(p.rest.x + side * 0.55 * fan, p.rest.y + off * 0.2 + (i % 2 ? 0.35 : -0.35) * fan, p.rest.z + off * 6 + Math.abs(side) * 0.4 * fan);
      p.o.rotation.set(p.rot.x + off * 0.9, p.rot.y + fan * (i % 2 ? -0.6 : 0.6) + off * 1.2, p.rot.z);
      p.o.visible = T >= tIn;
    });

    const mcu: CamKey = { pos: [0, 0.15, 4.0], tgt: [0, 0.05, 0], fov: 30 };
    const a1 = (T - bar(40)) * 0.28;
    const macro: CamKey = { pos: [0.4 + 1.5 * Math.sin(a1), 0.25, 1.35 + 0.3 * Math.cos(a1)], tgt: [0.2, 0.1, 0], fov: 24 };
    const a2 = (T - bar(42)) * 0.22 - 0.6;
    const orbit: CamKey = { pos: [4.0 * Math.sin(a2), 0.7 + 0.3 * Math.sin(T * 0.4), 4.0 * Math.cos(a2)], tgt: [0, -0.15, 0], fov: 32 };
    const wide: CamKey = { pos: [0.3 * Math.sin(T * 0.3), 0.45, 4.6 - (T - bar(46)) * 0.22], tgt: [0, -0.1, 0], fov: 30 };
    let k = mcu;
    k = mixKey(k, macro, smooth(T, bar(40), bar(40.6)));
    k = mixKey(k, orbit, smooth(T, bar(41.8), bar(42.6)));
    k = mixKey(k, wide, smooth(T, bar(45.6), bar(46.4)));
    applyCam(this.cam, k, f.a.kick * 0.5);

    const g = this.layer.ctx;
    this.layer.clear();
    const fam = F.archivo(125, 900);
    slam(g, 'BUILT IN BLENDER', 960, 900, T, { t0: bar(42), t1: bar(44) - 0.1, size: 96, family: fam, from: 1.3, shake: 4 });
    slam(g, 'EVERY PART A NODE', 960, 900, T, { t0: bar(44), t1: bar(46) - 0.1, size: 96, family: fam, from: 1.3, shake: 4 });
    slam(g, 'LIT LIVE', 960, 900, T, { t0: bar(46), t1: bar(49) - 0.15, size: 120, family: fam, from: 1.3, shake: 4, color: C.signal });
    typeLine(g, 'assets/fx_logo/build.py  →  model.glb  ·  7,152 tris', 192, 990, T, bar(40), { size: 20, color: C.ash, cps: 70, cursor: false });

    present(this.ctx, out, this.scene, this.cam, this.layer);
    const db = Math.exp(-ph * BAR * 7);
    return { exposure: 1.0 + 0.1 * db, bloom: 0.65 + 0.3 * db, bloomThreshold: 0.7, vignette: 0.55, ca: 0.4 + 0.8 * f.a.snare, grain: 0.05, shake: [0.05 * f.a.kick, -0.6 * (0.05 * f.a.kick)], flash: lt >= 0 && lt < 0.2 ? (1 - lt / 0.2) * 0.4 : 0 };
  }
}

function smooth(t: number, a: number, b: number) {
  return ease.inOutCubic(clamp((t - a) / (b - a)));
}
