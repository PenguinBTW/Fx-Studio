// s10_finale (bars 101-end, 196.15 - 224.69 s): every word of the film streams through a vortex of light that
// collapses into the Blender chrome f(x) logo; lock-up with the repo line, slow push, fade with the last note.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { LineBatch } from '../../engine/lines';
import { RibbonGeometry, RibbonMesh } from '../../engine/ribbon';
import { F } from '../../engine/type';
import { clamp, ease, prog, springStep, hash } from '../../engine/util';
import { C, BAR, B0, BEAT, bar, sceneTime, model, present, slam, typeLine, applyCam, lin, train, type Cue } from './kit';

const T0 = bar(101);
const NP = 1400;
const WORDS = ['CODE', 'PLOT', 'SYNC', 'SHIP', 'KINETIC', 'TYPE', 'IN', '3D', 'KICK', 'SNARE', 'HAT', 'BLENDER', 'LIVE', 'NO KEYFRAMES', 'JUST MATH', 'EVERY FRAME'];
const ORDER = ['f', 'lp', 'x', 'rp', 'studio'];

export default class S10Finale extends Scene {
  private scene = new THREE.Scene();
  private envScene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(34, 16 / 9, 0.02, 200);
  private layer = new Layer2D();
  // The Thread, as three twist-free Bishop-frame ribbons (engine ribbon.ts) spiralling into the logo.
  private ribbons: RibbonMesh[] = [];
  private ribMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.signal).convertSRGBToLinear().multiplyScalar(1.5), side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  private ribCore = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0dc).convertSRGBToLinear().multiplyScalar(1.6), side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  private lines = new LineBatch(NP + 8, { screen2D: false, worldWidth: true, blend: 'add', depthTest: true });
  private cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  private cubeCam = new THREE.CubeCamera(0.1, 100, this.cubeRT);
  private strips: THREE.Mesh[] = [];
  private parts: { o: THREE.Object3D; rest: THREE.Vector3; rot: THREE.Euler; name: string }[] = [];
  private cues: Cue[] = [];

  override async init() {
    const inst = await model(this.ctx, 'fx_logo');
    const logo = inst.root;
    this.scene.add(logo);
    const front = new THREE.DirectionalLight(0xfff4e8, 1.4);
    front.position.set(0.5, 1.2, 10);
    this.scene.add(front);
    const box = new THREE.Box3().setFromObject(logo);
    const ctr = box.getCenter(new THREE.Vector3());
    logo.position.sub(ctr);
    const chrome = new THREE.MeshPhysicalMaterial({ color: 0xcfcac1, metalness: 1, roughness: 0.12, envMap: this.cubeRT.texture, envMapIntensity: 0.85, clearcoat: 0.6, clearcoatRoughness: 0.08 });
    const bone = new THREE.MeshStandardMaterial({ color: new THREE.Color(C.bone), metalness: 0.2, roughness: 0.45, envMap: this.cubeRT.texture, envMapIntensity: 0.9 });
    logo.traverse((o) => {
      const part = o.userData?.fx_part as string | undefined;
      if (part && ORDER.includes(part)) this.parts.push({ o, rest: o.position.clone(), rot: o.rotation.clone(), name: part });
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        let p: THREE.Object3D | null = m, pn = '';
        while (p && !pn) { pn = (p.userData?.fx_part as string) ?? ''; p = p.parent; }
        m.material = pn === 'studio' ? bone : chrome;
      }
    });
    this.parts.sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
    const mk = (w: number, col: THREE.ColorRepresentation, k: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 30), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
      this.envScene.add(m); this.strips.push(m);
    };
    mk(2.4, 0xffffff, 8); mk(1.0, C.signal, 7); mk(3.2, 0xffffff, 4); mk(0.9, C.ice, 6);
    for (let i = 0; i < 6; i++) { const pn = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 2 ? 0x2a2622 : 0x15171a), side: THREE.DoubleSide })); const a = (i / 6) * Math.PI * 2; pn.position.set(Math.sin(a) * 14, -2, Math.cos(a) * 14); pn.lookAt(0, -2, 0); this.envScene.add(pn); }
    this.envScene.background = new THREE.Color(0x020203);
    WORDS.forEach((w, i) => this.cues.push({ text: w, t: T0 + i * BEAT, color: i % 4 === 3 ? C.signal : C.bone }));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t);
    const lt = T - T0;
    const bp = (T - B0) / BAR, nb = Math.floor(bp), ph = bp - nb;
    const sweep = nb + ease.inOutCubic(clamp(ph * 2.2));
    this.strips.forEach((s, i) => { const a = (sweep + i * 0.32) * Math.PI * 0.5; s.position.set(Math.sin(a) * 9, 0, Math.cos(a) * 9); s.lookAt(0, 0, 0); });
    this.cubeCam.update(this.ctx.renderer, this.envScene);
    this.ctx.renderer.resetState();

    // Vortex: closed-form spiral orbits whose radius collapses into the logo over bars 105-106.
    const collapse = prog(T, bar(105), bar(106.5), ease.inCubic);
    // Conical helices rising out of the floor into the logo: wide at the tail, converging to a point at the f(x).
    if (!this.ribbons.length) for (let j = 0; j < 3; j++) {
      const spine = (t: number, u: number): [number, number, number] => {
        const cl = prog(t, bar(105), bar(106.5), ease.inCubic);
        const s = 1 - u;
        const a = s * Math.PI * 8 - t * 2.2 + (j * Math.PI * 2) / 3;
        const r = (0.12 + 3.0 * s ** 1.1) * (1 - cl) + 0.03;
        return [Math.cos(a) * r, -5.5 * s * (1 - 0.85 * cl) + 0.25 * Math.sin(a * 0.5 + j), Math.sin(a) * r];
      };
      const W = [0.17, 0.1, 0.065][j]!;
      for (const [w, mat] of [[W, this.ribMat], [W * 0.28, this.ribCore]] as const) {
        const m = new RibbonMesh(new RibbonGeometry({ segments: 260, spine, width: (u: number) => w * Math.min(1, u * 6) * (0.45 + 0.55 * (1 - u)), twist: 0, time: T }), mat);
        m.frustumCulled = false;
        this.ribbons.push(m);
        this.scene.add(m);
      }
    }
    const L = this.lines;
    L.clear();
    const bone = lin(C.bone, 1.3), sig = lin(C.signal, 3), ice = lin(C.ice, 1.5);
    const vis = 1 - prog(T, bar(106.4), bar(107.2));
    this.ribMat.opacity = vis * (0.75 + 0.25 * f.a.kick);
    this.ribCore.opacity = vis;
    for (const m of this.ribbons) { m.visible = vis > 0; if (vis > 0) m.update(T); }
    if (vis > 0) for (let i = 0; i < NP; i++) {
      const h1 = hash(i, 11), h2 = hash(i, 12), h3 = hash(i, 13);
      const r = (0.8 + h1 * 6) * (1 - collapse) + 0.05;
      const w = (0.6 + 1.6 / (0.6 + r)) * (1 + collapse * 3);
      const a = h2 * Math.PI * 2 + T * w;
      const y = (h3 - 0.5) * 4 * (1 - collapse) + Math.sin(a * 0.5 + i) * 0.2;
      const x0 = Math.cos(a) * r, z0 = Math.sin(a) * r;
      const a2 = a - 0.08 - 0.05 * f.a.rms;
      const c = i % 7 === 0 ? sig : i % 11 === 0 ? ice : bone;
      L.seg(Math.cos(a2) * r, y, Math.sin(a2) * r, x0, y, z0, 0.012 + 0.01 * h1, c[0], c[1], c[2], (0.3 + 0.6 * h3) * vis);
    }

    this.parts.forEach((p, i) => {
      const tIn = bar(106) + i * BEAT * (i === 4 ? 0.9 : 0.75);
      const s = T < tIn ? 0 : springStep(T - tIn, 3.0, 0.45);
      const off = 1 - s;
      p.o.position.set(p.rest.x * (1 + off * 2), p.rest.y + off * 1.5, p.rest.z - off * 4);
      p.o.rotation.set(p.rot.x + off * 1.4, p.rot.y + off * 2.4, p.rot.z);
      p.o.visible = T >= tIn;
    });

    const orb = lt * 0.35;
    const lock = ease.inOutCubic(prog(T, bar(105.5), bar(107.5)));
    const rad = 9 - 4.5 * lock - 0.04 * Math.max(0, T - bar(107.5));
    const ang = orb * (1 - lock) + lock * (0.12 * Math.sin(T * 0.2));
    // End-card shot grammar: three angles cut on every second downbeat (bars 108-114), then the final slow push.
    const sk = T > bar(108) && T < bar(114) ? Math.floor((T - bar(108)) / (2 * BAR)) % 3 : -1;
    const so = sk < 0 ? [0, 0, 0] : [[0.38, -0.9, 0.35], [-0.32, 0.5, -0.25], [0.05, 1.4, 0.1]][sk]!;
    applyCam(this.cam, { pos: [Math.sin(ang + so[0]!) * (rad + so[1]!), 1.8 * (1 - lock) + 0.35 + so[2]!, Math.cos(ang + so[0]!) * (rad + so[1]!)], tgt: [0, -0.15 * lock + 0.0, 0], fov: 40 - 8 * lock, roll: 0.08 * (1 - lock) * Math.sin(lt) }, f.a.kick * (1 - lock * 0.7));

    const g = this.layer.ctx;
    this.layer.clear();
    train(g, this.cues, T, 960, 540, { size: 150, family: F.archivo(125, 900), from: 1.8, shake: 6, out: 0.05 }, bar(105) - 0.05);
    typeLine(g, 'motion design as code', 960, 840, T, bar(107), { size: 50, align: 'center', cps: 30 });
    typeLine(g, 'github.com/PenguinBTW/Fx-Studio', 960, 930, T, bar(107.5), { size: 62, align: 'center', family: F.mono(600), color: C.signal, cps: 30, cursor: false });

    present(this.ctx, out, this.scene, this.cam, this.layer, () => L.render(this.ctx.renderer, out, this.cam));
    const db = Math.exp(-ph * BAR * 7) * (1 - lock * 0.6);
    const end = prog(T, 213.3, 214.45, ease.inOutQuad);
    return { exposure: 1.0 + 0.1 * db, bloom: (0.7 + 0.3 * db) * (1 - 0.45 * lock), bloomThreshold: 0.65 + 0.3 * lock, vignette: 0.55, ca: 0.5 + 0.8 * f.a.snare, grain: 0.05, fade: end, flash: lt >= 0 && lt < 0.15 ? 0.5 * (1 - lt / 0.15) : 0 };
  }

  override dispose(): void {
    for (const m of this.ribbons) m.geometry.dispose();
    this.ribMat.dispose();
    this.ribCore.dispose();
    this.cubeRT.dispose();
  }
}
