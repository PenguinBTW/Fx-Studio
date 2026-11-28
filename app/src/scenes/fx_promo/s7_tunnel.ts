// s7_tunnel (bars 51-66, 98.94 - 130.05 s): the drop. POV through an endless corridor of Blender tunnel modules.
// Camera z = -V·t (closed form), a 1/8 roll per bar (the octagon is 8-fold symmetric), strip waves on every beat.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { Layer2D } from '../../engine/gl';
import { F } from '../../engine/type';
import { createInWorldText } from '../../engine/text_lighting';
import { clamp, ease, prog } from '../../engine/util';
import { C, BAR, BEAT, B0, bar, sceneTime, model, studioEnv, present, slam, typeLine, applyCam, Instanced } from './kit';

const T0 = bar(51);
const V = 30;
const SP = 2;
const NM = 90;
const COPY: [string, string][] = [['NO KEYFRAMES', 'f(t)'], ['JUST MATH', 'sin cos ease'], ['EVERY FRAME', 'seek anywhere'], ['RANDOM ACCESS', 't = any']];
const PAL = [C.signal, C.ice, C.bone, C.signal];

export default class S7Tunnel extends Scene {
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 400);
  private layer = new Layer2D();
  private mods!: Instanced;
  // A second, lower corridor in the distance, only seen from the exterior tracking shot.
  private mods2!: Instanced;
  private sign = new THREE.Group();
  private v = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3(1, 1, 1);
  private c = new THREE.Color();
  private e = new THREE.Euler();
  private head = new THREE.PointLight(0xffffff, 30, 30, 1.5);

  override async init() {
    const inst = await model(this.ctx, 'tunnel_module');
    this.mods = new Instanced(inst, NM, (name, m) => (name.toLowerCase().includes('strip') ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : m));
    for (let i = 0; i < NM; i++) this.mods.color(i, this.c.set(0xffffff));
    this.mods2 = new Instanced(inst, NM, (name, m) => (name.toLowerCase().includes('strip') ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : m));
    this.scene.add(this.mods2.group);
    const sm = new THREE.MeshStandardMaterial({ color: new THREE.Color(C.signal), emissive: new THREE.Color(C.signal), emissiveIntensity: 1.6, metalness: 0.3, roughness: 0.4 });
    const st = createInWorldText('SEEK ANYWHERE', { size: 1.5, depth: 0.25, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, letterSpacing: 0.08, material: sm });
    st.position.sub(new THREE.Box3().setFromObject(st).getCenter(new THREE.Vector3()));
    this.sign.add(st);
    this.scene.add(this.sign);
    this.scene.add(this.mods.group, this.head, new THREE.AmbientLight(0xffffff, 0.05));
    this.scene.environment = studioEnv(this.ctx.renderer);
    this.scene.environmentIntensity = 0.3;
    this.scene.fog = new THREE.FogExp2(0x050506, 0.012);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const T = sceneTime(this.ctx, f.t);
    const lt = Math.max(0, T - T0);
    const camZ = -V * lt;
    const bp = (T - B0) / BAR, nb = Math.floor(bp), ph = bp - nb;
    const roll = (nb + ease.inOutCubic(clamp(ph * 3))) * (Math.PI / 4);
    const beatPh = ((((T - B0) / BEAT) % 1) + 1) % 1;
    const phrase = clamp(Math.floor(lt / (4 * BAR)), 0, 3);
    const col = new THREE.Color(PAL[phrase]!);
    const twist = prog(T, bar(59), bar(61), ease.inOutCubic) * (1 - prog(T, bar(64), bar(66), ease.inOutCubic));
    const k = f.a.kick;

    // Modules on a fixed world grid; the visible window slides with the camera.
    const j0 = Math.floor(-camZ / SP) - 2;
    const extW = lt >= 10 * BAR && lt < 12 * BAR;
    this.mods2.group.visible = extW;
    for (let i = 0; i < NM; i++) {
      const j = j0 + i;
      const z = -j * SP;
      const d = (camZ - z);
      this.e.set(0, 0, twist * j * 0.06 + Math.sin(j * 0.15) * 0.04 * twist);
      this.q.setFromEuler(this.e);
      const breathe = 1 + 0.05 * k * Math.exp(-Math.max(0, d) * 0.03);
      this.v.set(Math.sin(j * 0.05) * 0.4 * twist, Math.cos(j * 0.04) * 0.3 * twist, z);
      this.s.set(breathe, breathe, 1);
      this.mods.set(i, this.v, this.q, this.s);
      // A light wave launches from the lens on every beat and runs down the corridor.
      const front = beatPh * BEAT * 140;
      const wave = Math.exp(-Math.pow((d - front) / 9, 2));
      const gate = j % 16 === 0 ? 1.6 : 0;
      const b = 0.15 + 2.6 * wave * (0.6 + k) + gate * (0.5 + f.a.snare);
      this.c.copy(col).multiplyScalar(b);
      if (gate > 0) this.c.lerp(new THREE.Color(1.5, 1.5, 1.5), 0.5);
      this.mods.color(i, this.c, 'strip');
      if (extW) { this.v.set(19, -5.5, z - 30); this.mods2.set(i, this.v, this.q, this.s); this.mods2.color(i, this.c, 'strip'); }
    }
    this.mods.commit();
    if (extW) this.mods2.commit();

    const sway = 0.25 * Math.sin(lt * 0.7);
    // Shot grammar: a new angle every 2 bars (centre / low rail / reverse / high rail), cut on the downbeat.
    const shot = Math.floor(lt / (2 * BAR)) % 4;
    const off = [[0, 0], [0.75, -0.6], [0, 0], [-0.7, 0.65]][shot]!;
    const look = shot === 2 ? 30 : -30;
    const sub = Math.floor(lt / BAR) % 2, rollK = sub ? (shot % 2 ? -0.32 : 0.32) : 0;
    // Mid-drop breather: two bars outside the corridor, tracking alongside it as it streams through the void.
    const ext = lt >= 10 * BAR && lt < 12 * BAR;
    if (ext) {
      const e = (lt - 10 * BAR) / (2 * BAR);
      applyCam(this.cam, { pos: [7.5 - 2.5 * e, 2.6 + 1.2 * e, camZ + 4 - 6 * e], tgt: [0, 0, camZ - 16], fov: 58, roll: -0.12 }, k * 0.8);
    } else
    applyCam(this.cam, { pos: [sway + off[0]!, 0.15 * Math.sin(lt * 0.9) + off[1]!, camZ], tgt: [sway * 0.3 + off[0]! * 0.2, off[1]! * 0.2, camZ + look], fov: 74 + 10 * prog(T, bar(65), bar(67), ease.inCubic), roll: roll + rollK }, k * 1.6);
    this.head.position.set(0, 0, camZ - 6);
    this.head.color.copy(col);
    this.head.intensity = 25 + 80 * f.a.snare;

    const g = this.layer.ctx;
    this.layer.clear();
    const fam = F.archivo(125, 900);
    COPY.forEach(([w, sub], i) => {
      const t0 = bar(51 + i * 4), tm = bar(53 + i * 4) - 0.06, t1 = bar(55 + i * 4) - 0.1;
      slam(g, w, 960, 520, T, { t0, t1: tm, size: i === 3 ? 126 : 170, family: fam, from: 2.1, shake: 10, color: shot === 2 ? '#FFFFFF' : i === 3 ? C.signal : C.bone });
      typeLine(g, sub, 960, 650, T, t0 + 2 * BEAT, { size: 34, align: 'center', t1: tm, cps: 40 });
      slam(g, sub, 960, 540, T, { t0: tm + 0.06, t1, size: 130, family: fam, from: 1.6, shake: 6, color: shot === 2 ? '#FFFFFF' : i === 3 ? C.bone : C.signal });
    });

    // Exterior shot: the copy lives in-world, mounted on the outside of the lattice, instead of flat on screen.
    this.sign.visible = ext;
    if (ext) { this.sign.position.set(5.2, 4.4, camZ - 24); this.sign.lookAt(this.cam.position); }
    present(this.ctx, out, this.scene, this.cam, this.layer, undefined, 0x050506, ext ? 0 : 1);
    const drop = T >= T0 ? 0.22 * Math.max(0, 1 - (T - T0) / 0.35) : 0;
    return { exposure: 1.05, bloom: 0.85 + 0.4 * k, bloomThreshold: 0.72, vignette: 0.55, ca: 0.8 + 2.2 * k, grain: 0.05, flash: drop, invert: shot === 2 && T > T0 + 2 * BAR ? 1 : 0, zoom: 1 + 0.04 * k + 0.12 * drop, shake: [0.25 * k, -0.6 * (0.25 * k)] };
  }

  override dispose(): void {
    for (const g of [this.mods.group, this.mods2.group]) g.traverse((m) => { const im = m as THREE.InstancedMesh; if (im.isInstancedMesh) { im.dispose(); if (im.material instanceof THREE.MeshBasicMaterial) im.material.dispose(); } });
    this.sign.traverse((m) => { const mm = m as THREE.Mesh; if (mm.isMesh) { mm.geometry.dispose(); (mm.material as THREE.Material).dispose(); } });
  }
}
