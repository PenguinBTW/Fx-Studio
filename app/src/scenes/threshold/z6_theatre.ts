// THRESHOLD Z6 grey-box blockout. Felt puppet theatre, 130-150 s.
// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { evalFirstPerson, applyFirstPersonCamera, type FPKey, type GaitName } from './fp_cam';
import { FlashlightRig, beamStateAt } from './flashlight';
import { thresholdPost } from './sensor_post';
import { hermite1D, type ScalarKey } from './motion';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import lintUrl from './assets/lint/model.glb?url';
import theatreKitUrl from './assets/z6_theatre_kit/model.glb?url';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => { const u = clamp(x); return u * u * (3 - 2 * u); };
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const stepped = (t: number, fps: number) => Math.floor(t * fps) / fps;

type PoseKey = { t: number; p: [number, number, number]; yaw: number; pitch: number; fov: number };
const KEYS: PoseKey[] = [
  { t: 129.5, p: [0, 1.2, 4.2], yaw: 0, pitch: 1, fov: 68 },
  { t: 133.0, p: [0, 1.2, 4.2], yaw: 2, pitch: 1, fov: 68 },
  { t: 136.0, p: [0, 1.2, 4.2], yaw: -10, pitch: 0, fov: 48 },
  { t: 139.0, p: [0, 1.2, 4.2], yaw: 6, pitch: 0, fov: 48 },
  { t: 141.5, p: [0, 1.2, 4.2], yaw: 5, pitch: -2, fov: 50 },
  { t: 142.6, p: [0, 1.2, 4.2], yaw: 34, pitch: -10, fov: 62 },
  { t: 143.5, p: [0, 1.2, 4.2], yaw: 32, pitch: -10, fov: 64 },
  { t: 145.0, p: [0.55, 1.65, 2.5], yaw: 10, pitch: -4, fov: 70 },
  { t: 147.0, p: [0.9, 1.65, -2.2], yaw: -3, pitch: -2, fov: 72 },
  { t: 148.5, p: [1.4, 1.65, -6.2], yaw: -25, pitch: 0, fov: 76 },
  { t: 149.5, p: [1.75, 1.63, -7.3], yaw: -21, pitch: 0, fov: 76 },
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

const EXIT_KEYS = KEYS.slice(6);
const EXIT_X: ScalarKey[] = EXIT_KEYS.map((k) => [k.t, k.p[0]]);
const EXIT_Z: ScalarKey[] = EXIT_KEYS.map((k) => [k.t, k.p[2]]);
export function z6PoseAt(t: number, gait?: GaitName) {
  const pose = evalFirstPerson(FP_KEYS, clamp(t, FP_KEYS[0]!.t, FP_KEYS[FP_KEYS.length - 1]!.t), gait);
  if (t < EXIT_KEYS[0]!.t || t > EXIT_KEYS[EXIT_KEYS.length - 1]!.t) return pose;
  const pos: [number, number, number] = [hermite1D(t, EXIT_X), pose.pos[1], hermite1D(t, EXIT_Z)];
  return { ...pose, pos, target: [pos[0] + pose.forward[0], pos[1] + pose.forward[1], pos[2] + pose.forward[2]] as [number, number, number] };
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
  private lintWings: THREE.Mesh[] = [];
  private lintInst?: GLTFInstance;
  private theatreKit?: GLTFInstance;
  private tableau = new THREE.Group();
  private houseTableau = new THREE.Group();
  private houseLight?: THREE.PointLight;
  private backstageLight?: THREE.PointLight;
  private backstageObjects: THREE.Object3D[] = [];
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

  override async init() {
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
      const foot = new THREE.PointLight(0xffa65a, 2.35, 7.5, 1.4);
      foot.position.set(x, 0.9, -4.8);
      this.s.add(foot);
    }

    // Audience seats use the stitched felt theatre-seat module, cloned per position.
    this.theatreKit = await GLTFManager.instantiate(theatreKitUrl, { castShadow: true, receiveShadow: true });
    const cloneKitPart = (part: string) => {
      const src = this.theatreKit?.parts.get(part);
      const c = src?.clone(true);
      if (c) c.position.set(0, 0, 0);
      return c;
    };
    const seatTemplate = cloneKitPart('seat_module');
    for (let row = 0; row < 6; row++) {
      const z = 1.2 + row * 0.72;
      for (let col = 0; col < 10; col++) {
        const x = -3.5 + col * 0.78;
        if (Math.abs(x) < 0.66 || !seatTemplate) continue;
        const seat = seatTemplate.clone(true);
        seat.position.set(x, 0, z);
        seat.rotation.y = Math.PI;
        seat.scale.setScalar(0.8);
        seat.rotation.z = (hash(row * 19 + col * 7) - 0.5) * 0.018;
        this.s.add(seat);
      }
    }

    // Center aisle edges keep the auditorium geography readable in the dark.
    for (const side of [-1, 1]) this.box(this.s, [0.055, 0.018, 5.2], [side * 0.78, 0.02, 3.05], seatEdge);

    // Auditorium sightline craft: low row lamps, side-wall sconces and balcony rails
    // give the wide frames a receding theatre volume instead of a dark empty floor.
    const rowLampMat = this.mat(0xffb36b, 0.55, 0, 0xff8f35, 1.7);
    for (let row = 0; row < 6; row++) {
      const z = 1.05 + row * 0.72;
      for (const side of [-1, 1]) {
        this.box(this.s, [0.09, 0.025, 0.18], [side * 0.83, 0.07, z], rowLampMat, [0, 0, side * 0.05]);
        if (row % 2 === 0) {
          const aisleLight = new THREE.PointLight(0xff9a4a, 1.05, 4.6, 1.5);
          aisleLight.position.set(side * 0.85, 0.32, z);
          this.s.add(aisleLight);
        }
      }
    }
    for (const side of [-1, 1]) {
      this.box(this.s, [0.08, 0.09, 10.8], [side * 4.58, 2.72, -0.8], gold);
      this.box(this.s, [0.12, 0.42, 10.8], [side * 4.66, 2.45, -0.8], woodDark);
      for (let i = 0; i < 5; i++) {
        const z = 3.7 - i * 2.15;
        this.cyl(this.s, 0.055, 0.075, 0.18, [side * 4.61, 2.02, z], gold, 10);
        this.sphere(this.s, 0.09, [side * 4.54, 2.17, z], rowLampMat, [1, 0.72, 1]);
      }
    }

    // Proscenium arch, stitched gold strips and tassel-like trim blocks.
    this.box(this.s, [0.55, 3.65, 0.5], [-4.0, 2.05, -4.35], wood);
    this.box(this.s, [0.55, 3.65, 0.5], [4.0, 2.05, -4.35], wood);
    this.box(this.s, [8.5, 0.55, 0.5], [0, 3.78, -4.35], wood);
    this.box(this.s, [7.5, 0.08, 0.08], [0, 3.43, -4.05], gold);
    for (let i = 0; i < 13; i++) this.cyl(this.s, 0.025, 0.04, 0.18, [-3.4 + i * 0.56, 3.24, -4.0], gold, 8);
    for (const side of [-1, 1]) {
      this.box(this.s, [0.09, 3.15, 0.09], [side * 3.68, 2.02, -4.02], gold);
      this.box(this.s, [0.18, 3.35, 0.12], [side * 3.9, 2.05, -3.98], feltDark);
      for (let j = 0; j < 5; j++) this.sphere(this.s, 0.055, [side * 3.58, 1.0 + j * 0.52, -3.92], rowLampMat, [1, 0.75, 1]);
    }
    for (let i = 0; i < 9; i++) this.sphere(this.s, 0.06, [-3.0 + i * 0.75, 3.48, -3.94], rowLampMat, [1, 0.72, 1]);

    // Red felt curtains; they open in stepped stop-motion.
    this.curtainL = this.box(this.s, [2.25, 3.0, 0.22], [-1.25, 2.0, -4.2], feltRed);
    this.curtainR = this.box(this.s, [2.25, 3.0, 0.22], [1.25, 2.0, -4.2], feltRed);
    for (let i = 0; i < 8; i++) {
      this.box(this.curtainL, [0.08, 2.9, 0.035], [-0.95 + i * 0.26, 0, 0.12], feltDark);
      this.box(this.curtainR, [0.08, 2.9, 0.035], [0.95 - i * 0.26, 0, 0.12], feltDark);
      const foldMat = i % 2 ? feltRed : this.mat(0x9a2028, 0.98, 0, 0x1d0305, 0.08);
      const zoff = 0.13 + (i % 2) * 0.075 + hash(i * 4.3) * 0.025;
      const lf = this.cyl(this.curtainL, 0.07 + hash(i) * 0.025, 0.09 + hash(i * 2) * 0.025, 2.92, [-0.98 + i * 0.26, 0, zoff], foldMat, 14);
      lf.scale.z = 0.48;
      lf.rotation.y = (hash(i * 7) - 0.5) * 0.12;
      const rf = this.cyl(this.curtainR, 0.07 + hash(i + 9) * 0.025, 0.09 + hash(i * 2 + 9) * 0.025, 2.92, [0.98 - i * 0.26, 0, zoff], foldMat, 14);
      rf.scale.z = 0.48;
      rf.rotation.y = (hash(i * 7 + 3) - 0.5) * 0.12;
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
    this.tableau.visible = false;
    this.s.add(this.tableau);

    // One centered recap scene at a time. The greybox mistake to avoid is four tiny zones
    // spread across the stage simultaneously; each 1.5s puppet scene gets the full proscenium.
    const makeRecap = () => {
      const g = new THREE.Group();
      g.scale.setScalar(1.75);
      g.position.set(0, -0.32, 4.7);
      g.visible = false;
      this.s.add(g);
      this.recapScenes.push(g);
      return g;
    };
    const officeRecap = makeRecap();
    const pitRecap = makeRecap();
    const poolRecap = makeRecap();
    const bookRecap = makeRecap();
    const recapParts: [THREE.Group, string][] = [
      [officeRecap, 'office_recap'],
      [pitRecap, 'ballpit_recap'],
      [poolRecap, 'pool_recap'],
      [bookRecap, 'book_recap'],
    ];
    for (const [parent, part] of recapParts) {
      const module = cloneKitPart(part);
      if (module) {
        module.position.z = -5.9;
        parent.add(module);
      }
      const protagonist = cloneKitPart('flashlight_puppet');
      if (protagonist) {
        protagonist.scale.setScalar(0.55);
        protagonist.position.set(part === 'office_recap' ? -0.28 : part === 'ballpit_recap' ? -0.42 : part === 'pool_recap' ? -0.36 : -0.28, 0, -5.38);
        parent.add(protagonist);
      }
    }

    const stageActionLight = new THREE.PointLight(0xffc37a, 3.6, 11, 1.45);
    stageActionLight.position.set(0, 3.2, -3.9);
    this.s.add(stageActionLight);
    this.houseLight = new THREE.PointLight(0xffb28a, 0, 7, 1.55);
    this.houseLight.position.set(0, 2.4, -4.8);
    this.s.add(this.houseLight);
    this.backstageLight = new THREE.PointLight(0xffa76b, 0, 5.5, 1.45);
    this.backstageLight.position.set(-0.65, 2.1, -8.15);
    this.s.add(this.backstageLight);

    // Stage steps make the follow route physically readable before any dressing/polish.
    for (let i = 0; i < 4; i++) this.box(this.s, [1.05, 0.11, 0.38], [0.9, 0.06 + i * 0.11, -3.7 - i * 0.34], wood);

    this.s.add(this.tableau);

    // Final puppet tableau: production felt house, faceless flashlight puppet and Tenant puppet.
    const houseModule = cloneKitPart('house_tableau');
    if (houseModule) {
      houseModule.position.z = -6.8;
      this.houseTableau.add(houseModule);
    }
    this.houseTableau.scale.setScalar(2.65);
    this.houseTableau.position.set(0, -0.6, 12.0);
    this.houseTableau.visible = false;
    this.s.add(this.houseTableau);

    // Production backstage kit: wire armature, hooks, ropes, sandbags, prompt/music boxes and ladder.
    const backstageModule = cloneKitPart('backstage_props');
    if (backstageModule) {
      backstageModule.position.set(-1.45, 0, -9.0);
      this.s.add(backstageModule);
      this.backstageObjects.push(backstageModule);
    }
    const hanging: [string, number, number][] = [
      ['flashlight_puppet', -1.85, 0.78],
      ['tenant_puppet', -1.05, 0.92],
      ['flashlight_puppet', -0.25, 0.78],
    ];
    hanging.forEach(([part, x, scale], i) => {
      const puppet = cloneKitPart(part);
      if (!puppet) return;
      puppet.scale.setScalar(scale);
      puppet.position.set(x, 1.18 - i * 0.04, -8.15);
      puppet.rotation.z = (i - 1) * 0.16;
      puppet.rotation.x = 0.08;
      this.s.add(puppet);
      this.backstageObjects.push(puppet);
    });
    // Readable backstage rigging at wide scale: ropes, sandbags and hook rails.
    const ropeMat = this.mat(0x9b7650, 0.88);
    for (let i = 0; i < 7; i++) {
      const x = -2.5 + i * 0.55;
      this.cyl(this.s, 0.008, 0.008, 2.6, [x, 2.0, -8.35 - (i % 2) * 0.28], ropeMat, 6);
      if (i % 2 === 0) this.box(this.s, [0.14, 0.32, 0.09], [x, 0.58, -8.35 - (i % 2) * 0.28], this.mat(0x5b3922, 0.94), [0.04, 0, 0.08]);
    }
    this.box(this.s, [3.8, 0.055, 0.07], [-0.8, 3.18, -8.38], wood);

    this.box(this.s, [0.2, 0.025, 0.12], [1.6, 0.9, 2.2], paper, [0, 0.3, 0]);

    // Backstage EXIT door and cold cathedral-blue slit beyond it.
    this.box(this.s, [1.0, 2.0, 0.12], [2.3, 1.0, -9.65], wood);
    this.exitGlow = this.mat(0xb9ecff, 0.3, 0, 0x8fdfff, 3.6);
    this.box(this.s, [0.7, 0.12, 0.03], [2.3, 1.72, -9.56], this.exitGlow);
    this.box(this.s, [0.06, 1.72, 0.035], [2.05, 1.0, -9.55], this.exitGlow);

    // Viewer seat armrest: the closeup needs a physical perch or Lint reads as a floating streak.
    this.box(this.s, [0.11, 0.2, 0.5], [0.62, 0.82, 3.66], woodDark);
    this.box(this.s, [0.13, 0.055, 0.52], [0.62, 0.95, 3.66], wood);
    this.box(this.s, [0.065, 0.018, 0.42], [0.62, 0.99, 3.66], seatFelt);
    for (const z of [3.48, 3.84]) this.cyl(this.s, 0.012, 0.012, 0.01, [0.62, 1.005, z], gold, 10);

    // Production Lint asset: real felt fibres, stitched wings, button eyes and emissive abdomen.
    this.lintInst = await GLTFManager.instantiate(lintUrl, { castShadow: true, receiveShadow: true });
    this.lintInst.root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!(m instanceof THREE.MeshStandardMaterial)) continue;
        m.roughness = Math.max(m.roughness, 0.88);
        m.metalness = 0;
        if (m.name.includes('LintFeltBrown')) { m.color.setHex(0x4a2818); m.emissive.setHex(0x090302); m.emissiveIntensity = 0.08; }
        if (m.name.includes('LintFeltEdge')) { m.color.setHex(0x7b4425); m.emissive.setHex(0x120603); m.emissiveIntensity = 0.1; }
        if (m.name.includes('ButtonEye')) { m.color.setHex(0x090403); m.roughness = 0.96; m.metalness = 0; m.emissive.setHex(0x000000); m.emissiveIntensity = 0; }
      }
    });
    this.lintInst.root.rotation.x = Math.PI / 2;
    this.lint.add(this.lintInst.root);
    // Close-up readability augment: camera-facing button eyes, long antennae, and broad
    // scalloped wings in the outer group's horizontal plane. These make the body plan read
    // as a moth at delivery scale rather than relying on tiny GLB details alone.
    const lintCanvas = document.createElement('canvas');
    lintCanvas.width = 64; lintCanvas.height = 64;
    const lg = lintCanvas.getContext('2d')!;
    lg.fillStyle = '#7c4a2b'; lg.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const v = hash(x * 0.73 + y * 3.91);
        lg.fillStyle = `rgba(${70 + v * 65},${34 + v * 32},${16 + v * 18},${0.18 + v * 0.18})`;
        lg.fillRect(x, y, 1, 1);
      }
    }
    lg.lineWidth = 1.8;
    for (let i = 0; i < 120; i++) {
      const x = hash(i * 2.3) * 64;
      const y = hash(i * 5.1) * 64;
      lg.strokeStyle = `rgba(28,12,6,${0.34 + hash(i) * 0.3})`;
      lg.beginPath(); lg.moveTo(x, y); lg.lineTo(x + 4 + hash(i * 7) * 8, y + (hash(i * 11) - 0.5) * 3); lg.stroke();
    }
    const lintTex = new THREE.CanvasTexture(lintCanvas);
    lintTex.colorSpace = THREE.SRGBColorSpace;
    lintTex.wrapS = lintTex.wrapT = THREE.RepeatWrapping;
    lintTex.repeat.set(6.5, 6.5);
    this.disposables.push(lintTex);
    // Put the same fibre/bump response onto the GLB felt itself; the procedural shell
    // alone was too small to carry the close-up material read.
    this.lintInst.root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!(m instanceof THREE.MeshStandardMaterial) || m.name.includes('ButtonEye')) continue;
        m.map = lintTex;
        m.bumpMap = lintTex;
        m.bumpScale = 0.006;
        m.roughness = 1;
        m.metalness = 0;
        m.needsUpdate = true;
      }
    });
    const lintWingMat = this.mat(0xa66a3d, 1.0, 0, 0x5a2a12, 0.48);
    lintWingMat.map = lintTex;
    lintWingMat.bumpMap = lintTex;
    lintWingMat.bumpScale = 0.003;
    const lintWingEdge = this.mat(0xc0834e, 0.98, 0, 0x653012, 0.42);
    lintWingEdge.map = lintTex;
    const lintButton = this.mat(0x070403, 0.96, 0, 0x020101, 0.03);
    const lintThread = this.mat(0x090504, 0.86);
    // A matte handmade shell overrides the asset's close-range plastic read while leaving
    // the original stitching, fuzz, eyes, legs and abdomen glow visible around it.
    const lintBodyMat = this.mat(0x7b4425, 1.0, 0, 0x2a1006, 0.22);
    lintBodyMat.map = lintTex;
    lintBodyMat.bumpMap = lintTex;
    lintBodyMat.bumpScale = 0.004;
    this.sphere(this.lint, 0.023, [0, 0.002, 0.006], lintBodyMat, [0.82, 0.58, 1.05]);
    this.sphere(this.lint, 0.017, [0, 0.003, 0.034], lintBodyMat, [0.9, 0.72, 0.75]);
    for (let segment = 0; segment < 3; segment++) {
      this.sphere(this.lint, 0.012 - segment * 0.0015, [0, -0.001, -0.018 - segment * 0.012], lintBodyMat, [0.86, 0.58, 0.82]);
    }
    for (const side of [-1, 1]) {
      const broadWing = this.sphere(this.lint, 0.028, [side * 0.034, -0.002, -0.006], lintWingMat, [1.28, 0.10, 1.42]);
      broadWing.userData.side = side;
      this.lintWings.push(broadWing);
      const rearLobe = this.sphere(this.lint, 0.021, [side * 0.029, -0.004, -0.026], lintWingEdge, [1.0, 0.08, 1.05]);
      rearLobe.userData.side = side;
      this.lintWings.push(rearLobe);
      for (let vein = 0; vein < 3; vein++) {
        const spread = (vein - 1) * 0.018;
        const pts = [
          new THREE.Vector3(side * 0.006, 0.001, 0.006),
          new THREE.Vector3(side * (0.026 + vein * 0.006), 0.004, -0.008 + spread),
          new THREE.Vector3(side * (0.052 + vein * 0.005), 0.002, -0.022 + spread * 0.7),
        ];
        const vgeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, 0.00045, 5, false);
        const vmesh = new THREE.Mesh(vgeo, lintThread);
        this.lint.add(vmesh);
        this.disposables.push(vgeo);
      }
      for (let scallop = 0; scallop < 4; scallop++) {
        this.sphere(this.lint, 0.009, [side * (0.018 + scallop * 0.014), -0.006, -0.029 - scallop * 0.002], lintWingEdge, [1.2, 0.16, 0.8]);
      }
      const stitchMat = this.mat(0xd49a62, 0.96, 0, 0x321406, 0.12);
      for (let stitch = 0; stitch < 6; stitch++) {
        const q = stitch / 5;
        const sx = side * (0.014 + q * 0.041);
        const sz = -0.001 - q * 0.025;
        const sgeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(sx - side * 0.004, 0.006, sz - 0.003),
          new THREE.Vector3(sx + side * 0.004, 0.006, sz + 0.003),
        ]), 2, 0.00045, 4, false);
        const smesh = new THREE.Mesh(sgeo, stitchMat);
        this.lint.add(smesh);
        this.disposables.push(sgeo);
      }
      for (let fuzz = 0; fuzz < 8; fuzz++) {
        const q = fuzz / 7;
        const fx = side * (0.018 + q * 0.041);
        const fz = -0.006 - q * 0.024;
        const fgeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(fx, -0.001, fz),
          new THREE.Vector3(fx + side * (0.004 + hash(fuzz * 3.7) * 0.004), -0.002, fz + (hash(fuzz * 5.1) - 0.5) * 0.005),
        ]), 2, 0.00028, 4, false);
        const fm = new THREE.Mesh(fgeo, lintWingEdge);
        this.lint.add(fm);
        this.disposables.push(fgeo);
      }
      // Dense short body hairs break the remaining smooth-sphere highlight at close range.
      for (let hair = 0; hair < 18; hair++) {
        const hq = hair / 17;
        const hx = side * (hash(hair * 3.1) * 0.015);
        const hz = 0.026 - hq * 0.047;
        const hy = 0.004 + hash(hair * 5.7) * 0.005;
        const hgeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(hx, hy, hz),
          new THREE.Vector3(hx + side * (0.007 + hash(hair) * 0.009), hy + 0.006 + hash(hair * 2) * 0.007, hz + (hash(hair * 4) - 0.5) * 0.006),
        ]), 2, 0.00105, 4, false);
        const hm = new THREE.Mesh(hgeo, lintWingEdge);
        this.lint.add(hm);
        this.disposables.push(hgeo);
      }
      this.sphere(this.lint, 0.0031, [side * 0.0062, 0.006, 0.052], lintButton, [1.2, 0.58, 0.22]);
      this.sphere(this.lint, 0.00075, [side * 0.0052, 0.0072, 0.0545], this.mat(0x1b100a, 0.95, 0, 0x050201, 0.02), [1, 0.7, 0.5]);
      // Irregular bristle halo around the handmade body: dense enough to break the
      // sphere silhouette at close range, but still coarse/stitched rather than fur.
      for (let bristle = 0; bristle < 34; bristle++) {
        const a = hash(bristle * 4.17 + side) * Math.PI * 2;
        const zq = hash(bristle * 7.31) * 2 - 1;
        const radial = Math.sqrt(Math.max(0.05, 1 - zq * zq));
        const dir = new THREE.Vector3(Math.cos(a) * radial, zq * 0.7, Math.sin(a) * radial).normalize();
        const start = dir.clone().multiplyScalar(0.018 + hash(bristle) * 0.004).add(new THREE.Vector3(0, 0.002, 0.008));
        const end = dir.clone().multiplyScalar(0.025 + hash(bristle * 2.3) * 0.009).add(new THREE.Vector3((hash(bristle * 3.1) - 0.5) * 0.004, 0.002 + (hash(bristle * 5.7) - 0.5) * 0.004, 0.008));
        const bgeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([start, end]), 2, 0.00032, 4, false);
        const bm = new THREE.Mesh(bgeo, lintWingEdge);
        this.lint.add(bm);
        this.disposables.push(bgeo);
      }
      const pts = [
        new THREE.Vector3(side * 0.005, 0.006, 0.028),
        new THREE.Vector3(side * 0.016, 0.026, 0.044),
        new THREE.Vector3(side * 0.029, 0.038, 0.052),
      ];
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.00062, 6, false);
      const antenna = new THREE.Mesh(geo, lintThread);
      antenna.castShadow = true;
      this.lint.add(antenna);
      this.disposables.push(geo);
      for (let barb = 0; barb < 5; barb++) {
        const q = barb / 4;
        const bx = side * (0.012 + q * 0.017), by = 0.018 + q * 0.018, bz = 0.037 + q * 0.014;
        const bgeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(bx, by, bz),
          new THREE.Vector3(bx + side * 0.006, by + 0.002, bz + 0.001),
        ]), 2, 0.00028, 4, false);
        const bm = new THREE.Mesh(bgeo, lintThread); this.lint.add(bm); this.disposables.push(bgeo);
      }
    }
    const lintLight = new THREE.PointLight(0xff8c2a, 0.38, 2.2, 1.6);
    lintLight.position.set(0, 0, -0.05);
    this.lint.add(lintLight);
    this.lint.visible = false;
    this.s.add(this.lint);

    // Warm theatrical spotlight plus low house fill.
    const projectorSpill = new THREE.PointLight(0x9fc8ff, 2.5, 14, 1.55);
    projectorSpill.position.set(0, 3.35, 5.2);
    this.s.add(projectorSpill);
    const spot = new THREE.SpotLight(0xffb15c, 4.2, 12, 0.55, 0.6, 1.2);
    spot.position.set(0, 4.0, 0.5);
    spot.target.position.set(0, 1.0, -6.5);
    this.s.add(spot, spot.target);
    const beamGeo = new THREE.ConeGeometry(1.45, 3.25, 32, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffa65a, transparent: true, opacity: 0.016, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beamCone = new THREE.Mesh(beamGeo, beamMat);
    beamCone.position.set(0, 2.35, -5.3);
    beamCone.rotation.x = -0.08;
    this.s.add(beamCone);
    this.disposables.push(beamGeo, beamMat);
    this.s.add(new THREE.AmbientLight(0x4a2b31, 1.0));

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
    const pose = z6PoseAt(t, z6Gait(t));
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
    if (this.houseLight) this.houseLight.intensity = this.houseTableau.visible ? 3.8 : 0;

    for (const obj of this.backstageObjects) obj.visible = t >= 143.5;
    if (this.backstageLight) this.backstageLight.intensity = t >= 143.5 ? 1.45 : 0;

    // Lint appears on the armrest, then leads backstage; stop-motion inside Z6.
    const lintOn = t >= 141.5;
    this.lint.visible = lintOn;
    if (lintOn) {
      const lp = this.lintPath(st);
      this.lint.position.copy(lp);
      this.lint.scale.setScalar(t < 143.5 ? 4.2 : 1.8);
      this.lint.position.y += 0.035 * Math.sin(st * 19);
      const landed = t < 143.5;
      const flap = landed ? 0.1 * Math.sin(st * Math.PI * 12) : Math.sign(Math.sin(st * Math.PI * 12)) * 0.42;
      const wl = this.lintInst?.parts.get('wing_l');
      const wr = this.lintInst?.parts.get('wing_r');
      if (wl) wl.rotation.z = (landed ? 0.34 : 0.28) + flap;
      if (wr) wr.rotation.z = -(landed ? 0.34 : 0.28) - flap;
      this.lintWings.forEach((wing) => {
        const side = wing.userData.side as number;
        const settle = landed ? smooth((t - 141.5) / 1.4) : 1;
        wing.rotation.z = side * (0.035 + 0.075 * settle + 0.018 * Math.sin(st * 2.4 + side));
      });
      this.lint.rotation.y = t < 143.5 ? -0.75 : -0.3 + 0.18 * Math.sin(st * 5);
    }

    // Shared beam adapter: 50% battery with the deliberate friendly-Lint flicker.
    const threat = t >= 139 && t < 143.6 ? 0.75 : 0.15;
    this.flash.update(pose, t, beamStateAt(t, threat), (time) => z6PoseAt(time, z6Gait(time)).forward);

    // EXIT slit swells near the threshold.
    this.exitGlow.emissiveIntensity = 2.4 + 2.2 * smooth((t - 147) / 3);

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(0x090507, 1);
    rr.clear(true, true, true);
    rr.render(this.s, this.cam);
    rr.resetState();

    return thresholdPost(t, { exposure: 1.78, darkness: 0.58, stress: threat * 0.25 });
  }

  override dispose() {
    this.flash.dispose();
    this.lintInst?.dispose();
    this.theatreKit?.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
