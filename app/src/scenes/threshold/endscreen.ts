// THRESHOLD END grey-box blockout. Darkened office loop frame, 225-235 s.
// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import beigePhoneUrl from './assets/beige_phone/model.glb?url';
import officeKitUrl from './assets/z1_office_kit/model.glb?url';
import propPackUrl from './assets/z1_prop_pack/model.glb?url';

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export default class ThresholdEndscreen extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 60);
  private tubeMats: THREE.MeshStandardMaterial[] = [];
  private receiver?: THREE.Object3D;
  private receiverHome?: THREE.Vector3;
  private phoneInst?: GLTFInstance;
  private officeKit?: GLTFInstance;
  private propPack?: GLTFInstance;
  private disposables: { dispose(): void }[] = [];

  private mat(color: number, roughness = 0.75, metalness = 0, emissive = 0, emissiveIntensity = 0) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
    this.disposables.push(m);
    return m;
  }

  private box(size: [number, number, number], pos: [number, number, number], mat: THREE.Material, rot: [number, number, number] = [0, 0, 0]) {
    const g = new THREE.BoxGeometry(...size);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.receiveShadow = true;
    this.s.add(mesh);
    this.disposables.push(g);
    return mesh;
  }

  override async init() {
    this.s.background = new THREE.Color(0x030404);
    this.s.fog = new THREE.FogExp2(0x030404, 0.055);
    const mustard = this.mat(0x3f3824, 0.86);
    const wall = this.mat(0x5d5132, 0.84);
    const ceiling = this.mat(0x5b584d, 0.8);
    const trim = this.mat(0x1e1a13, 0.7);
    const beige = this.mat(0x8f8265, 0.52);

    this.officeKit = await GLTFManager.instantiate(officeKitUrl, { castShadow: true, receiveShadow: true });
    this.propPack = await GLTFManager.instantiate(propPackUrl, { castShadow: true, receiveShadow: true });
    this.phoneInst = await GLTFManager.instantiate(beigePhoneUrl, { castShadow: true, receiveShadow: true });
    const clonePart = (source: GLTFInstance, part: string, pos: [number, number, number], yaw = 0, scale = 1) => {
      const c = source.part(part)?.clone(true);
      if (!c) return undefined;
      c.position.set(...pos);
      c.rotation.set(0, yaw, 0);
      c.scale.setScalar(scale);
      this.s.add(c);
      return c;
    };

    // Darkened office loop composition: corridor/desk/phone read left-of-centre; centre and right stay open for end UI.
    this.box([4.2, 0.08, 22], [0, -0.04, -8], mustard);
    this.box([0.12, 2.7, 22], [-2.1, 1.35, -8], wall);
    this.box([0.12, 2.7, 22], [2.1, 1.35, -8], wall);
    this.box([4.2, 0.1, 22], [0, 2.7, -8], ceiling);
    this.box([0.08, 0.16, 22], [-2.02, 0.08, -8], trim);
    this.box([0.08, 0.16, 22], [2.02, 0.08, -8], trim);
    for (let i = 0; i < 8; i++) {
      const tm = this.mat(0xa8c7a1, 0.4, 0, 0xc9ffd2, 0.42);
      this.tubeMats.push(tm);
      this.box([1.0, 0.035, 0.44], [-1.2 + (i % 2) * 2.4, 2.64, 1.5 - i * 2.4], tm);
    }
    // Modular office architecture and desk pods reuse the accepted Z1 production assets.
    for (let j = 0; j < 4; j++) clonePart(this.officeKit, 'cubicle_panel_180_root', [-1.82, 0, -2.2 - j * 2.1], Math.PI / 2, 0.92);
    clonePart(this.propPack, 'desk_root', [-0.82, 0, -6.35], 0, 1.08);
    clonePart(this.propPack, 'crt_root', [-1.32, 0.77, -6.52], 0.22, 1.0);
    clonePart(this.propPack, 'keyboard_root', [-1.13, 0.77, -6.08], -0.08, 1.0);
    clonePart(this.propPack, 'chair_upright_root', [-0.12, 0, -5.78], 2.72, 0.95);
    clonePart(this.propPack, 'mug_root', [-0.38, 0.77, -5.96], 0, 1.0);
    clonePart(this.propPack, 'filing_cabinet_root', [-1.68, 0, -8.0], 0.08, 0.9);
    clonePart(this.propPack, 'ficus_root', [1.48, 0, -8.8], -0.2, 0.85);
    this.phoneInst.root.position.set(-0.42, 0.785, -6.08);
    this.phoneInst.root.rotation.y = -0.48;
    this.phoneInst.root.scale.setScalar(1.2);
    this.phoneInst.root.traverse((o) => {
      if (/^(base_|bell_|cradle_|front_lip|hook_|key_|vent_|wear_nick_)/.test(o.name)) { o.scale.x = 1.55; o.scale.z = 1.22; }
      if (/^key_(mark_)?/.test(o.name)) { o.position.y -= 0.012; o.position.z -= 0.018; }
    });
    this.s.add(this.phoneInst.root);
    this.receiver = this.phoneInst.part('receiver') ?? undefined;
    if (this.receiver) this.receiverHome = this.receiver.position.clone();
    for (let i = 0; i < 7; i++) this.box([0.28, 0.015, 0.2], [-0.9 + hash(i) * 1.2, 0.78 + 0.01 * i, -6.4 - hash(i * 2) * 1.2], this.mat(0x9b937b, 0.86), [0, hash(i * 3) * 2, 0]);

    const fluorescent = new THREE.PointLight(0xc9ffd2, 1.75, 12, 1.5);
    fluorescent.position.set(-0.8, 2.35, -5.5);
    this.s.add(fluorescent, new THREE.AmbientLight(0x1e241d, 1.55));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    this.cam.position.set(0.25, 1.55, -2.3);
    this.cam.fov = 70;
    this.cam.aspect = out.width / out.height;
    this.cam.updateProjectionMatrix();
    this.cam.lookAt(0.65, 0.96, -6.2);

    // Receiver keeps rattling more softly on each ring; no text or end-screen UI is rendered here.
    const ringIndex = Math.floor((t - 225) / 4.0);
    const ringPhase = (t - 225) % 4.0;
    const ring = ringPhase < 1.1 ? Math.max(0, Math.sin(ringPhase * Math.PI * 8)) / (1 + ringIndex * 0.75) : 0;
    if (this.receiver && this.receiverHome) {
      this.receiver.position.copy(this.receiverHome).add(new THREE.Vector3(0, ring * 0.012, ring * 0.006));
      this.receiver.rotation.z = ring * 0.045;
    }
    const fade = Math.min(1, Math.max(0, (t - 225) / 10));
    this.tubeMats.forEach((m, i) => { m.emissiveIntensity = (0.82 + 0.18 * hash(Math.floor(t * 4) + i * 7)) * (1 - fade * 0.48); });

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(0x030404, 1);
    rr.clear(true, true, true);
    rr.render(this.s, this.cam);
    rr.resetState();
    return { exposure: 0.88 - fade * 0.32, bloom: 0.12, bloomThreshold: 1.1, vignette: 0.46, grain: 0.055, ca: 0.1 };
  }

  override dispose() {
    this.phoneInst?.dispose();
    this.officeKit?.dispose();
    this.propPack?.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
