// THRESHOLD END grey-box blockout. Darkened office loop frame, 225-235 s.
// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export default class ThresholdEndscreen extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 60);
  private tubeMats: THREE.MeshStandardMaterial[] = [];
  private receiver!: THREE.Mesh;
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

  override init() {
    this.s.background = new THREE.Color(0x030404);
    this.s.fog = new THREE.FogExp2(0x030404, 0.055);
    const mustard = this.mat(0x3f3824, 0.86);
    const wall = this.mat(0x5d5132, 0.84);
    const ceiling = this.mat(0x5b584d, 0.8);
    const trim = this.mat(0x1e1a13, 0.7);
    const beige = this.mat(0x8f8265, 0.52);

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
    for (let i = 0; i < 7; i++) {
      this.box([1.25, 1.45, 0.08], [-1.55, 0.73, -1.5 - i * 2.2], wall, [0, 0.12 * (i % 2 ? 1 : -1), 0]);
      this.box([1.0, 0.08, 0.55], [-1.45, 0.78, -1.5 - i * 2.2], this.mat(0x3c3831, 0.55));
    }
    this.box([1.45, 0.75, 0.72], [-0.72, 0.38, -7.0], this.mat(0x454037, 0.56));
    this.box([0.38, 0.2, 0.28], [-0.78, 0.86, -7.0], beige);
    this.receiver = this.box([0.14, 0.1, 0.42], [-0.78, 1.0, -7.0], beige, [0, 0, 0.05]);
    this.box([0.3, 0.42, 0.18], [0.05, 0.98, -7.2], this.mat(0x171a1c, 0.45));
    this.box([0.22, 0.13, 0.3], [-1.2, 0.85, -6.6], this.mat(0x6d5a43, 0.7));
    for (let i = 0; i < 7; i++) this.box([0.28, 0.015, 0.2], [-0.9 + hash(i) * 1.2, 0.78 + 0.01 * i, -6.4 - hash(i * 2) * 1.2], this.mat(0x9b937b, 0.86), [0, hash(i * 3) * 2, 0]);

    const fluorescent = new THREE.PointLight(0xc9ffd2, 0.55, 9, 1.8);
    fluorescent.position.set(-0.8, 2.35, -5.5);
    this.s.add(fluorescent, new THREE.AmbientLight(0x1e241d, 0.8));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    this.cam.position.set(0.15, 1.65, 1.6);
    this.cam.fov = 72;
    this.cam.aspect = out.width / out.height;
    this.cam.updateProjectionMatrix();
    this.cam.lookAt(-0.35, 1.25, -7.0);

    // Receiver keeps rattling more softly on each ring; no text or end-screen UI is rendered here.
    const ringPhase = (t - 225) % 4.0;
    const ring = ringPhase < 1.1 ? Math.max(0, Math.sin(ringPhase * Math.PI * 8)) : 0;
    this.receiver.position.y = 1.0 + ring * 0.012;
    this.receiver.rotation.z = 0.05 + ring * 0.04;
    this.tubeMats.forEach((m, i) => { m.emissiveIntensity = 0.55 + 0.16 * hash(Math.floor(t * 4) + i * 7); });

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(0x030404, 1);
    rr.clear(true, true, true);
    rr.render(this.s, this.cam);
    rr.resetState();
    return { exposure: 0.66, bloom: 0.1, bloomThreshold: 1.1, vignette: 0.4, grain: 0.04, ca: 0.08 };
  }

  override dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
