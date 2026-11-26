// THRESHOLD Z6 grey-box blockout. Felt puppet theatre, 130-150 s.
// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { evalFirstPerson, applyFirstPersonCamera, type FPKey, type GaitName } from './fp_cam';
import { FlashlightRig, beamStateAt } from './flashlight';
import { thresholdPost } from './sensor_post';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => { const u = clamp(x); return u * u * (3 - 2 * u); };
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const stepped = (t: number, fps: number) => Math.floor(t * fps) / fps;

type PoseKey = { t: number; p: [number, number, number]; yaw: number; pitch: number; fov: number };
const KEYS: PoseKey[] = [
  { t: 129.5, p: [0, 1.2, 4.2], yaw: 0, pitch: 1, fov: 68 },
  { t: 133.0, p: [0, 1.2, 4.2], yaw: 2, pitch: 1, fov: 68 },
  { t: 136.0, p: [0, 1.2, 4.2], yaw: -10, pitch: 0, fov: 60 },
  { t: 139.0, p: [0, 1.2, 4.2], yaw: 6, pitch: 0, fov: 60 },
  { t: 141.5, p: [0, 1.2, 4.2], yaw: 5, pitch: -2, fov: 60 },
  { t: 142.6, p: [0, 1.2, 4.2], yaw: 34, pitch: -10, fov: 62 },
  { t: 143.5, p: [0, 1.2, 4.2], yaw: 32, pitch: -10, fov: 64 },
  { t: 145.0, p: [0.55, 1.65, 2.5], yaw: 10, pitch: -4, fov: 70 },
  { t: 147.0, p: [0.9, 1.65, -2.2], yaw: -3, pitch: -2, fov: 72 },
  { t: 148.5, p: [1.4, 1.65, -6.2], yaw: -25, pitch: 0, fov: 76 },
  { t: 150.5, p: [2.1, 1.62, -8.4], yaw: -16, pitch: 0, fov: 76 },
];

const FP_KEYS: FPKey[] = KEYS.map((k) => ({
  t: k.t,
  pos: k.p,
  yaw: k.yaw * Math.PI / 180,
  pitch: k.pitch * Math.PI / 180,
  roll: ((k as { roll?: number }).roll ?? 0) * Math.PI / 180,
  fov: k.fov,
}));

function poseAt(t: number, gait?: GaitName) {
  return evalFirstPerson(FP_KEYS, clamp(t, FP_KEYS[0]!.t, FP_KEYS[FP_KEYS.length - 1]!.t), gait);
}

function z6Gait(t: number): GaitName {
  return t >= 143.5 && t < 149.5 ? 'walk' : 'still';
}

export default class ThresholdZ6Theatre extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(68, 16 / 9, 0.04, 70);
  private flash = new FlashlightRig();
  private curtainL!: THREE.Mesh;
  private curtainR!: THREE.Mesh;
  private lint = new THREE.Group();
  private tableau = new THREE.Group();
  private houseTableau = new THREE.Group();
  private recapScenes: THREE.Group[] = [];
  private backdropPanels: THREE.Mesh[] = [];
  private exitGlow!: THREE.MeshStandardMaterial;
  private disposables: { dispose(): void }[] = [];

  private mat(color: number, roughness = 0.8, metalness = 0, emissive = 0, emissiveIntensity = 0) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
    this.disposables.push(m);
    return m;
  }

  private box(parent: THREE.Object3D, size: [number, number, number], pos: [number, number, number], mat: THREE.Material, rot: [number, number, number] = [0, 0, 0]) {
    const g = new THREE.BoxGeometry(...size);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    this.disposables.push(g);
    return mesh;
  }

  private cyl(parent: THREE.Object3D, rTop: number, rBot: number, h: number, pos: [number, number, number], mat: THREE.Material, seg = 12) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    this.disposables.push(g);
    return mesh;
  }

  private sphere(parent: THREE.Object3D, r: number, pos: [number, number, number], mat: THREE.Material, scale: [number, number, number] = [1, 1, 1]) {
    const g = new THREE.SphereGeometry(r, 12, 8);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(...pos);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    this.disposables.push(g);
    return mesh;
  }

  override init() {
    this.s.background = new THREE.Color(0x090507);
    this.s.fog = new THREE.FogExp2(0x090507, 0.045);

    const feltRed = this.mat(0x7d151c, 0.96);
    const feltDark = this.mat(0x3a1114, 0.98);
    const gold = this.mat(0xb48232, 0.75);
    const wood = this.mat(0x3a2115, 0.62);
    const woodDark = this.mat(0x1e120c, 0.7);
    const seatFelt = this.mat(0x571a1f, 0.92);
    const seatEdge = this.mat(0x8e2d34, 0.86, 0, 0x4d0d12, 0.34);
    const warm = this.mat(0xffbd65, 0.5, 0, 0xff9d3c, 1.7);
    const stageFloor = this.mat(0x2a160f, 0.72);

    // Theatre shell: small warm volume, stage ahead at negative Z.
    this.box(this.s, [9.5, 0.08, 15], [0, -0.04, -1.5], woodDark);
    this.box(this.s, [0.12, 4.2, 15], [-4.75, 2.1, -1.5], feltDark);
    this.box(this.s, [0.12, 4.2, 15], [4.75, 2.1, -1.5], feltDark);
    this.box(this.s, [9.5, 0.12, 15], [0, 4.2, -1.5], woodDark);
    this.box(this.s, [9.5, 4.2, 0.12], [0, 2.1, 5.9], feltDark);
    this.box(this.s, [8.0, 0.42, 4.6], [0, 0.21, -6.7], stageFloor);
    this.box(this.s, [8.2, 0.16, 0.35], [0, 0.55, -4.45], wood);
    for (let i = 0; i < 5; i++) {
      const x = -2.6 + i * 1.3;
      this.box(this.s, [0.28, 0.08, 0.12], [x, 0.65, -4.55], warm, [0.25, 0, 0]);
      const foot = new THREE.PointLight(0xffa65a, 0.55, 4.5, 1.7);
      foot.position.set(x, 0.9, -4.8);
      this.s.add(foot);
    }

    // Audience seats, 12 rows hinted through 6 visible blockout rows.
    for (let row = 0; row < 6; row++) {
      const z = 1.2 + row * 0.72;
      for (let col = 0; col < 8; col++) {
        const x = -3.2 + col * 0.9;
        if (Math.abs(x) < 0.9) continue;
        this.box(this.s, [0.58, 0.16, 0.48], [x, 0.48, z], seatFelt);
        this.box(this.s, [0.58, 0.48, 0.13], [x, 0.72, z + 0.22], seatFelt, [-0.1, 0, 0]);
        this.box(this.s, [0.56, 0.035, 0.025], [x, 0.98, z + 0.15], seatEdge, [-0.1, 0, 0]);
        this.box(this.s, [0.08, 0.34, 0.42], [x - 0.33, 0.52, z], wood);
        this.box(this.s, [0.08, 0.34, 0.42], [x + 0.33, 0.52, z], wood);
      }
    }

    // Center aisle edges keep the auditorium geography readable in the dark.
    for (const side of [-1, 1]) this.box(this.s, [0.055, 0.018, 5.2], [side * 0.78, 0.02, 3.05], seatEdge);

    // Proscenium arch, stitched gold strips and tassel-like trim blocks.
    this.box(this.s, [0.55, 3.65, 0.5], [-4.0, 2.05, -4.35], wood);
    this.box(this.s, [0.55, 3.65, 0.5], [4.0, 2.05, -4.35], wood);
    this.box(this.s, [8.5, 0.55, 0.5], [0, 3.78, -4.35], wood);
    this.box(this.s, [7.5, 0.08, 0.08], [0, 3.43, -4.05], gold);
    for (let i = 0; i < 13; i++) this.cyl(this.s, 0.025, 0.04, 0.18, [-3.4 + i * 0.56, 3.24, -4.0], gold, 8);

    // Red felt curtains; they open in stepped stop-motion.
    this.curtainL = this.box(this.s, [2.25, 3.0, 0.22], [-1.25, 2.0, -4.2], feltRed);
    this.curtainR = this.box(this.s, [2.25, 3.0, 0.22], [1.25, 2.0, -4.2], feltRed);
    for (let i = 0; i < 8; i++) {
      this.box(this.curtainL, [0.08, 2.9, 0.035], [-0.95 + i * 0.26, 0, 0.12], feltDark);
      this.box(this.curtainR, [0.08, 2.9, 0.035], [0.95 - i * 0.26, 0, 0.12], feltDark);
    }

    // Rolling painted backdrop panels.
    const backdropColors = [0x74613f, 0x274e87, 0x68a5a9, 0x6f4d2d];
    for (let i = 0; i < 4; i++) {
      const p = this.box(this.s, [5.7, 2.35, 0.09], [0, 2.0, -8.75 - i * 0.05], this.mat(backdropColors[i]!, 0.9));
      this.backdropPanels.push(p);
    }

    // Puppet recap tableau: blocky felt stand-ins for office, ball pit, pool and book.
    const beige = this.mat(0xc9b98e, 0.9);
    const red = this.mat(0xa62b24, 0.9);
    const yellow = this.mat(0xcaa23a, 0.9);
    const blue = this.mat(0x2d62a6, 0.9);
    const aqua = this.mat(0x55a9aa, 0.9);
    const paper = this.mat(0xd9c69f, 0.93);
    this.box(this.tableau, [0.52, 0.28, 0.34], [-1.55, 0.74, -6.7], beige);
    this.box(this.tableau, [0.32, 0.28, 0.12], [-1.55, 1.0, -6.72], this.mat(0x16181a, 0.7));
    this.box(this.tableau, [0.92, 0.26, 0.5], [-0.35, 0.7, -6.7], blue);
    for (let i = 0; i < 7; i++) this.sphere(this.tableau, 0.07, [-0.7 + 0.12 * i, 0.88, -6.55], i % 2 ? red : yellow);
    this.box(this.tableau, [0.75, 0.08, 0.48], [0.72, 0.72, -6.7], aqua);
    this.box(this.tableau, [0.12, 0.45, 0.12], [0.42, 0.95, -6.7], aqua);
    this.box(this.tableau, [0.65, 0.5, 0.08], [1.55, 0.92, -6.7], paper, [0, 0.25, 0]);
    this.s.add(this.tableau);

    // One centered recap scene at a time. The greybox mistake to avoid is four tiny zones
    // spread across the stage simultaneously; each 1.5s puppet scene gets the full proscenium.
    const makeRecap = () => {
      const g = new THREE.Group();
      g.scale.setScalar(1.35);
      g.position.set(0, -0.15, 2.3);
      g.visible = false;
      this.s.add(g);
      this.recapScenes.push(g);
      return g;
    };
    const officeRecap = makeRecap();
    this.box(officeRecap, [1.45, 0.95, 0.08], [0, 1.25, -6.28], beige);
    this.box(officeRecap, [1.15, 0.24, 0.52], [0, 0.78, -5.82], this.mat(0x6b5138, 0.8));
    this.box(officeRecap, [0.24, 0.58, 0.16], [-0.28, 1.02, -5.55], paper);
    this.box(officeRecap, [0.28, 0.045, 0.045], [0.02, 1.05, -5.42], this.mat(0xfff0b0, 0.35, 0, 0xffe38a, 1.8));
    const pitRecap = makeRecap();
    this.box(pitRecap, [1.55, 0.36, 0.82], [0, 0.68, -5.9], blue);
    for (let i = 0; i < 11; i++) this.sphere(pitRecap, 0.11, [-0.62 + (i % 6) * 0.25, 0.91 + Math.floor(i / 6) * 0.12, -5.72 - (i % 2) * 0.25], i % 2 ? red : yellow);
    this.box(pitRecap, [0.42, 0.24, 0.08], [0.25, 1.12, -5.5], this.mat(0x151719, 0.8));
    const poolRecap = makeRecap();
    this.box(poolRecap, [1.6, 0.08, 0.9], [0, 0.72, -5.85], aqua);
    this.box(poolRecap, [1.6, 0.86, 0.08], [0, 1.16, -6.28], this.mat(0xb9d9d7, 0.8));
    this.box(poolRecap, [0.18, 0.58, 0.14], [0.42, 1.02, -5.52], this.mat(0x26343a, 0.9));
    this.box(poolRecap, [0.72, 0.055, 0.05], [0, 1.48, -6.2], aqua);
    const bookRecap = makeRecap();
    this.box(bookRecap, [0.95, 1.2, 0.08], [-0.36, 1.22, -5.9], paper, [0, -0.34, 0]);
    this.box(bookRecap, [0.95, 1.2, 0.08], [0.36, 1.22, -5.9], paper, [0, 0.34, 0]);
    this.box(bookRecap, [0.18, 0.55, 0.12], [0, 0.98, -5.45], this.mat(0x2a2025, 0.92));

    // Stage steps make the follow route physically readable before any dressing/polish.
    for (let i = 0; i < 4; i++) this.box(this.s, [1.05, 0.11, 0.38], [0.9, 0.06 + i * 0.11, -3.7 - i * 0.34], wood);

    this.s.add(this.tableau);

    // Final puppet tableau: felt house, faceless flashlight puppet and felt Tenant silhouette.
    this.box(this.houseTableau, [0.9, 0.72, 0.58], [0.45, 0.95, -6.82], this.mat(0x7b3b2c, 0.94));
    this.box(this.houseTableau, [1.05, 0.34, 0.68], [0.45, 1.43, -6.82], this.mat(0x3e1c19, 0.94), [0, 0, 0.12]);
    this.box(this.houseTableau, [0.28, 0.46, 0.04], [0.45, 0.72, -6.5], this.mat(0x1b1110, 0.9));
    this.box(this.houseTableau, [0.16, 0.42, 0.12], [-0.35, 0.86, -6.52], this.mat(0xd8c49a, 0.95));
    this.box(this.houseTableau, [0.12, 0.36, 0.08], [-0.08, 0.86, -6.54], this.mat(0xe5d8a6, 0.95));
    this.box(this.houseTableau, [0.16, 0.65, 0.12], [-0.8, 1.05, -6.56], this.mat(0x2b2024, 0.95));
    this.box(this.houseTableau, [0.42, 0.08, 0.1], [-0.8, 1.34, -6.56], this.mat(0x51323b, 0.95));
    this.houseTableau.scale.setScalar(2.1);
    this.houseTableau.position.set(0, -0.6, 8.32);
    this.houseTableau.visible = false;
    this.s.add(this.houseTableau);

    // Theatre props: ropes, sandbags, prompt box, ticket, music box, ladder and backstage hooks.
    this.box(this.s, [0.5, 0.22, 0.36], [-3.55, 0.72, -4.1], wood);
    this.box(this.s, [0.2, 0.025, 0.12], [1.6, 0.9, 2.2], paper, [0, 0.3, 0]);
    this.box(this.s, [0.35, 0.18, 0.28], [2.8, 0.68, -4.8], gold);
    this.cyl(this.s, 0.08, 0.08, 0.32, [2.8, 0.95, -4.8], gold, 12);
    for (let i = 0; i < 4; i++) {
      this.cyl(this.s, 0.018, 0.018, 2.7, [-4.2 + i * 0.3, 2.4, -7.8], wood, 6);
      this.box(this.s, [0.18, 0.34, 0.16], [-4.2 + i * 0.3, 0.62, -7.8], this.mat(0x76624d, 0.9));
    }
    for (let i = 0; i < 6; i++) this.box(this.s, [0.035, 1.7, 0.05], [3.6 + i * 0.16, 1.25, -8.9], wood, [0, 0, 0.4]);
    for (let i = 0; i < 7; i++) this.cyl(this.s, 0.025, 0.025, 0.28, [-2.8 + i * 0.8, 2.7, -9.3], gold, 8).rotation.x = Math.PI / 2;

    // Limp puppets on backstage hooks clarify that the camera has crossed behind the set.
    for (let i = 0; i < 3; i++) {
      const x = -1.8 + i * 0.7;
      this.cyl(this.s, 0.012, 0.012, 0.55, [x, 2.05, -8.75], gold, 6);
      this.box(this.s, [0.22, 0.42, 0.08], [x, 1.55, -8.75], i === 1 ? paper : this.mat(0x6d3f35, 0.95), [0, 0, (i - 1) * 0.12]);
      this.box(this.s, [0.08, 0.32, 0.06], [x - 0.16, 1.48, -8.75], feltRed, [0, 0, 0.35]);
      this.box(this.s, [0.08, 0.32, 0.06], [x + 0.16, 1.48, -8.75], feltRed, [0, 0, -0.35]);
    }

    // Backstage EXIT door and cold cathedral-blue slit beyond it.
    this.box(this.s, [1.0, 2.0, 0.12], [2.3, 1.0, -9.65], wood);
    this.exitGlow = this.mat(0xb9ecff, 0.3, 0, 0x8fdfff, 3.6);
    this.box(this.s, [0.7, 0.12, 0.03], [2.3, 1.72, -9.56], this.exitGlow);
    this.box(this.s, [0.06, 1.72, 0.035], [2.05, 1.0, -9.55], this.exitGlow);

    // Viewer seat armrest: the closeup needs a physical perch or Lint reads as a floating streak.
    this.box(this.s, [0.13, 0.2, 0.62], [0.62, 0.82, 3.66], wood);
    this.box(this.s, [0.18, 0.08, 0.66], [0.62, 0.96, 3.66], seatEdge);

    // Lint: felt body, stitched wing panels, buttons and warm abdomen glow.
    const lintBody = this.mat(0x7b4a28, 0.98, 0, 0x3a180a, 0.48);
    const lintWing = this.mat(0xaa6b3c, 0.98, 0, 0x5a250e, 0.78);
    const button = this.mat(0x050505, 0.28);
    const glow = this.mat(0xff8c2a, 0.55, 0, 0xff7418, 4.2);
    this.cyl(this.lint, 0.032, 0.045, 0.14, [0, 0, 0], lintBody, 10).rotation.x = Math.PI / 2;
    this.sphere(this.lint, 0.07, [-0.12, 0, 0.005], lintWing, [1.3, 0.13, 0.75]).rotation.z = 0.35;
    this.sphere(this.lint, 0.07, [0.12, 0, 0.005], lintWing, [1.3, 0.13, 0.75]).rotation.z = -0.35;
    this.sphere(this.lint, 0.015, [-0.018, 0.025, 0.065], button);
    this.sphere(this.lint, 0.015, [0.018, 0.025, 0.065], button);
    this.sphere(this.lint, 0.005, [-0.014, 0.032, 0.077], this.mat(0xffe0b0, 0.5, 0, 0xffc47a, 1.2));
    this.sphere(this.lint, 0.005, [0.014, 0.032, 0.077], this.mat(0xffe0b0, 0.5, 0, 0xffc47a, 1.2));
    this.cyl(this.lint, 0.0025, 0.0025, 0.07, [-0.018, 0.04, 0.095], lintBody, 5).rotation.z = 0.55;
    this.cyl(this.lint, 0.0025, 0.0025, 0.07, [0.018, 0.04, 0.095], lintBody, 5).rotation.z = -0.55;
    this.cyl(this.lint, 0.025, 0.03, 0.045, [0, -0.005, -0.07], glow, 10).rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) this.cyl(this.lint, 0.003, 0.003, 0.08, [(i - 2.5) * 0.012, -0.035, -0.01], lintBody, 5).rotation.z = (i - 2.5) * 0.25;
    const lintLight = new THREE.PointLight(0xff8c2a, 0.75, 2.2, 1.6);
    lintLight.intensity = 1.35;
    lintLight.position.set(0, 0, -0.05);
    this.lint.add(lintLight);
    this.lint.visible = false;
    this.s.add(this.lint);

    // Warm theatrical spotlight plus low house fill.
    const spot = new THREE.SpotLight(0xffb15c, 4.2, 12, 0.55, 0.6, 1.2);
    spot.position.set(0, 4.0, 0.5);
    spot.target.position.set(0, 1.0, -6.5);
    this.s.add(spot, spot.target);
    this.s.add(new THREE.AmbientLight(0x3a2028, 0.68));

    this.s.add(this.flash.group);
  }

  private lintPath(t: number): THREE.Vector3 {
    if (t < 143.5) return new THREE.Vector3(0.68, 1.04, 3.58);
    const pts = [
      new THREE.Vector3(0.68, 1.06, 3.58),
      new THREE.Vector3(0.85, 1.45, 1.4),
      new THREE.Vector3(0.85, 1.55, -2.3),
      new THREE.Vector3(1.55, 1.7, -6.0),
      new THREE.Vector3(2.15, 1.5, -8.9),
    ];
    const u = clamp((t - 143.5) / 5.6) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(u));
    return pts[i]!.clone().lerp(pts[i + 1]!, u - i);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const st = stepped(t, 12);
    const pose = poseAt(t, z6Gait(t));
    applyFirstPersonCamera(this.cam, pose, out.width / out.height);
    const dir = new THREE.Vector3(...pose.forward);

    // Stop-motion curtain opening, with 1-2 mm animator jitter.
    const open = smooth((st - 130.0) / 3.0);
    const jitter = (hash(Math.floor(st * 12)) - 0.5) * 0.004;
    this.curtainL.position.x = -1.25 - open * 2.1 + jitter;
    this.curtainR.position.x = 1.25 + open * 2.1 - jitter;

    // Rolling backdrops: each recap scene replaces the last, then the house tableau.
    const recap = clamp((t - 133) / 6);
    const panelIndex = Math.min(3, Math.floor(recap * 4));
    this.backdropPanels.forEach((p, i) => {
      p.visible = i === panelIndex && t < 141.5;
      p.position.y = 2.0 + (i === panelIndex ? 0.12 * Math.sin(st * 3) : 0);
    });
    this.tableau.visible = false;
    const recapIndex = Math.max(0, Math.min(3, Math.floor((t - 133) / 1.5)));
    this.recapScenes.forEach((g, i) => { g.visible = t >= 133 && t < 139 && i === recapIndex; });
    this.houseTableau.visible = t >= 139.0 && t < 141.5;

    // Lint appears on the armrest, then leads backstage; stop-motion inside Z6.
    const lintOn = t >= 141.5;
    this.lint.visible = lintOn;
    if (lintOn) {
      const lp = this.lintPath(st);
      this.lint.position.copy(lp);
      this.lint.scale.setScalar(t < 143.5 ? 1.1 : 0.9);
      this.lint.position.y += 0.035 * Math.sin(st * 19);
      const landed = t < 143.5;
      const flap = landed ? 0.1 * Math.sin(st * Math.PI * 12) : Math.sign(Math.sin(st * Math.PI * 12)) * 0.42;
      this.lint.children[1]!.rotation.z = (landed ? 0.08 : 0.28) + flap;
      this.lint.children[2]!.rotation.z = -(landed ? 0.08 : 0.28) - flap;
      this.lint.rotation.y = t < 143.5 ? 0.7 : -0.3 + 0.18 * Math.sin(st * 5);
    }

    // Shared beam adapter: 50% battery with the deliberate friendly-Lint flicker.
    const threat = t >= 139 && t < 143.6 ? 0.75 : 0.15;
    this.flash.update(pose, t, beamStateAt(t, threat), (time) => poseAt(time, z6Gait(time)).forward);

    // EXIT slit swells near the threshold.
    this.exitGlow.emissiveIntensity = 2.4 + 2.2 * smooth((t - 147) / 3);

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(0x090507, 1);
    rr.clear(true, true, true);
    rr.render(this.s, this.cam);
    rr.resetState();

    return thresholdPost(t, { exposure: 1.2, darkness: 0.68, stress: threat * 0.25 });
  }

  override dispose() {
    this.flash.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
