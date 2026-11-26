// THRESHOLD Z8 grey-box blockout. Home loop, 195-225 s.
// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { evalFirstPerson, applyFirstPersonCamera, type FPKey, type GaitName } from './fp_cam';
import { FlashlightRig, beamStateAt } from './flashlight';
import { thresholdPost } from './sensor_post';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import beigePhoneUrl from './assets/beige_phone/model.glb?url';
import z8HomeKitUrl from './assets/z8_home_kit/model.glb?url';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => { const u = clamp(x); return u * u * (3 - 2 * u); };
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

type PoseKey = { t: number; p: [number, number, number]; yaw: number; pitch: number; fov: number };
const KEYS: PoseKey[] = [
  { t: 194.4, p: [0, 1.65, 1.7], yaw: 0, pitch: 0, fov: 72 },
  { t: 199.0, p: [0, 1.65, 1.0], yaw: 0, pitch: 0, fov: 72 },
  { t: 201.0, p: [0, 1.65, -0.7], yaw: -30, pitch: 0, fov: 70 },
  { t: 203.0, p: [0, 1.65, -1.8], yaw: -22, pitch: 0, fov: 70 },
  { t: 204.5, p: [0, 1.65, -2.6], yaw: 40, pitch: 0, fov: 70 },
  { t: 206.0, p: [0, 1.65, -3.1], yaw: 20, pitch: 0, fov: 69 },
  { t: 208.0, p: [0.15, 1.65, -4.6], yaw: 26, pitch: 0, fov: 68 },
  { t: 210.0, p: [0.35, 1.65, -5.3], yaw: 38, pitch: 0, fov: 66 },
  { t: 212.0, p: [0.58, 1.65, -5.75], yaw: 74, pitch: -2, fov: 66 },
  { t: 214.0, p: [0.68, 1.65, -5.9], yaw: 54, pitch: -4, fov: 60 },
  { t: 216.0, p: [0.66, 1.65, -5.95], yaw: 74, pitch: -2, fov: 64 },
  { t: 218.0, p: [0.66, 1.65, -5.95], yaw: 68, pitch: 0, fov: 70 },
  { t: 220.0, p: [0.7, 1.65, -6.1], yaw: 76, pitch: 0, fov: 74 },
  { t: 222.0, p: [0.95, 1.65, -6.45], yaw: 88, pitch: 0, fov: 74 },
  { t: 223.5, p: [2.4, 1.65, -6.8], yaw: 90, pitch: 0, fov: 74 },
  { t: 225.6, p: [4.6, 1.65, -6.8], yaw: 90, pitch: 0, fov: 74 },
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

function z8Gait(t: number): GaitName {
  return (t >= 199 && t < 210) || t >= 222 ? 'walk' : 'still';
}

export default class ThresholdZ8Home extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(72, 16 / 9, 0.04, 80);
  private flash = new FlashlightRig();
  private doorGroup = new THREE.Group();
  private handle!: THREE.Mesh;
  private phoneInst?: GLTFInstance;
  private homeKit?: GLTFInstance;
  private receiver?: THREE.Object3D;
  private receiverHome = new THREE.Vector3();
  private lampGlow!: THREE.MeshStandardMaterial;
  private officeTubeMats: THREE.MeshStandardMaterial[] = [];
  private disposables: { dispose(): void }[] = [];

  private mat(color: number, roughness = 0.72, metalness = 0, emissive = 0, emissiveIntensity = 0) {
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
    this.s.background = new THREE.Color(0x17100b);
    this.s.fog = new THREE.FogExp2(0x17100b, 0.028);

    const wood = this.mat(0x7b4d2b, 0.55);
    const woodDark = this.mat(0x3f2415, 0.62);
    const cream = this.mat(0xd8c9aa, 0.78);
    const rug = this.mat(0x7b2d25, 0.86);
    const brass = this.mat(0xa5742d, 0.38, 0.6);
    const plant = this.mat(0x2e6b34, 0.8);
    const black = this.mat(0x080808, 0.6);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xffd68a, roughness: 0.18, metalness: 0, transparent: true, opacity: 0.36, emissive: 0xff9d42, emissiveIntensity: 0.25 });
    this.disposables.push(glassMat);

    this.homeKit = await GLTFManager.instantiate(z8HomeKitUrl, { castShadow: true, receiveShadow: true });
    const cloneHomePart = (part: string) => {
      const src = this.homeKit?.parts.get(part);
      const c = src?.clone(true);
      if (c) c.position.set(0, 0, 0);
      return c;
    };

    // Hallway shell, wood floor planks, runner rug and golden-hour window.
    this.box(this.s, [2.7, 0.08, 10.4], [0, -0.04, -3.1], wood);
    for (let i = 0; i < 15; i++) this.box(this.s, [2.65, 0.012, 0.018], [0, 0.012, 1.6 - i * 0.68], woodDark);
    this.box(this.s, [0.12, 2.75, 10.4], [-1.36, 1.37, -3.1], cream);
    const addRightWall = (zNear: number, zFar: number) => {
      const len = zNear - zFar;
      if (len > 0.02) this.box(this.s, [0.12, 2.75, len], [1.36, 1.37, (zNear + zFar) / 2], cream);
    };
    addRightWall(2.1, -3.15);
    addRightWall(-4.65, -6.28);
    addRightWall(-7.42, -8.3);
    this.box(this.s, [2.7, 0.1, 10.4], [0, 2.75, -3.1], cream);
    this.box(this.s, [2.7, 2.75, 0.12], [0, 1.37, 2.05], cream);
    this.box(this.s, [2.7, 2.75, 0.12], [0, 1.37, -8.25], cream);
    this.box(this.s, [0.86, 0.025, 6.2], [0, 0.035, -2.9], rug);
    for (let i = 0; i < 9; i++) this.box(this.s, [0.72, 0.012, 0.06], [0, 0.055, -0.2 - i * 0.62], this.mat(i % 2 ? 0x28434a : 0xa56b34, 0.9));

    // Side window: warm sun outside in the house, but a mustard office strip is visible in the wrong exterior.
    this.box(this.s, [0.04, 1.18, 1.35], [-1.31, 1.55, -4.3], glassMat);
    this.box(this.s, [0.05, 0.09, 1.5], [-1.29, 2.18, -4.3], woodDark);
    this.box(this.s, [0.05, 0.09, 1.5], [-1.29, 0.92, -4.3], woodDark);
    this.box(this.s, [0.05, 1.28, 0.08], [-1.29, 1.55, -4.3], woodDark);
    const officeGlow = this.mat(0xc9b26a, 0.55, 0, 0xc9ffb0, 0.5);
    this.box(this.s, [0.025, 0.24, 1.22], [-1.34, 1.02, -4.3], officeGlow);

    // Golden-hour sun reads as floor/wall light patches plus dust, not floating rectangles.
    const sunPatchMat = new THREE.MeshBasicMaterial({ color: 0xffb45e, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
    this.disposables.push(sunPatchMat);
    for (let i = 0; i < 4; i++) {
      this.box(this.s, [0.42 + i * 0.08, 0.006, 0.72], [-0.72 + i * 0.34, 0.055, -4.35 + i * 0.18], sunPatchMat, [0, -0.32, 0]);
    }
    const dustMat = new THREE.MeshBasicMaterial({ color: 0xffd89a, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending, depthWrite: false });
    this.disposables.push(dustMat);
    for (let i = 0; i < 26; i++) {
      this.sphere(this.s, 0.006 + 0.004 * hash(i * 3), [-1.0 + hash(i) * 1.2, 0.9 + hash(i * 2) * 1.15, -4.8 + hash(i * 5) * 1.15], dustMat);
    }

    // Production family-photo modules: each frame contains a miniature empty-zone tableau.
    const photoParts = ['photo_office', 'photo_ballpit', 'photo_pool', 'photo_library', 'photo_motel', 'photo_theatre', 'photo_cathedral'];
    photoParts.forEach((part, i) => {
      const frame = cloneHomePart(part);
      if (!frame) return;
      const z = 0.8 - i * 0.78;
      frame.position.set(-1.29, 1.55, z);
      frame.rotation.y = Math.PI / 2;
      frame.rotation.x = (hash(i * 17) - 0.5) * 0.035;
      this.s.add(frame);
    });

    // Production entryway clutter and hall table with keys/post.
    const entryway = cloneHomePart('entryway_props');
    if (entryway) {
      entryway.position.set(-1.25, 0, -6.62);
      entryway.rotation.y = Math.PI / 2;
      this.s.add(entryway);
    }
    const hallTable = cloneHomePart('hall_table');
    if (hallTable) {
      hallTable.position.set(1.05, 0, -3.1);
      hallTable.rotation.y = -Math.PI / 2;
      this.s.add(hallTable);
    }

    // Houseplant, wall clock, radiator, light switch, calendar crossed out.
    this.cyl(this.s, 0.18, 0.14, 0.32, [-1.0, 0.16, -2.25], this.mat(0x8b4d2c, 0.65), 12);
    for (let i = 0; i < 7; i++) this.box(this.s, [0.06, 0.5, 0.16], [-1.0 + (hash(i) - 0.5) * 0.22, 0.55 + hash(i * 2) * 0.25, -2.25 + (hash(i * 3) - 0.5) * 0.22], plant, [0.4 * hash(i), hash(i * 4), 0.5 * (hash(i * 5) - 0.5)]);
    this.cyl(this.s, 0.24, 0.24, 0.035, [1.29, 1.95, -2.1], cream, 24).rotation.z = Math.PI / 2;
    this.box(this.s, [0.03, 0.18, 0.025], [1.25, 1.95, -2.1], black, [0, 0, 0.6]);
    this.box(this.s, [0.03, 0.13, 0.02], [1.25, 1.95, -2.1], black, [0, 0, -0.9]);
    const radiator = cloneHomePart('radiator');
    if (radiator) {
      radiator.position.set(1.28, 0.05, -1.32);
      radiator.rotation.y = -Math.PI / 2;
      this.s.add(radiator);
    }
    this.box(this.s, [0.035, 0.15, 0.1], [1.28, 1.2, -5.15], this.mat(0xe8e0cd, 0.55));
    const mirrorCalendar = cloneHomePart('mirror_calendar');
    if (mirrorCalendar) {
      mirrorCalendar.position.set(-1.28, 1.0, -5.6);
      mirrorCalendar.rotation.y = Math.PI / 2;
      this.s.add(mirrorCalendar);
    }

    // Staircase glimpse with a small toy block left on a step.
    for (let i = 0; i < 7; i++) this.box(this.s, [0.9, 0.16, 0.34], [-0.7, 0.1 + i * 0.16, -0.4 + i * 0.3], woodDark);
    const stairToys = cloneHomePart('stair_toys');
    if (stairToys) {
      stairToys.position.set(-0.58, 0.54, 0.46);
      stairToys.rotation.y = 0.25;
      this.s.add(stairToys);
    }

    // Living-room opening and shadowless floor lamp.
    this.box(this.s, [0.12, 2.1, 1.5], [1.34, 1.05, -3.9], cream);
    this.cyl(this.s, 0.06, 0.08, 1.35, [2.0, 0.68, -4.35], brass, 12);
    this.cyl(this.s, 0.28, 0.18, 0.36, [2.0, 1.42, -4.35], this.mat(0xf0d2a0, 0.8, 0, 0xffbc65, 1.4), 18);
    this.lampGlow = this.mat(0xffbd65, 0.45, 0, 0xffa640, 2.4);
    this.sphere(this.s, 0.19, [2.0, 1.42, -4.35], this.lampGlow, [1, 0.65, 1]);
    const lampLight = new THREE.PointLight(0xffa957, 1.25, 6, 1.7);
    lampLight.intensity = 0.9;
    lampLight.position.set(2.0, 1.45, -4.35);
    this.s.add(lampLight);

    // Kitchen glimpse and kettle steam blocks at far end.
    this.box(this.s, [1.2, 0.8, 0.5], [-0.3, 0.4, -8.1], this.mat(0x7b7468, 0.55));
    const kettle = cloneHomePart('kitchen_kettle');
    if (kettle) {
      kettle.position.set(-0.32, 0.76, -8.0);
      kettle.rotation.y = -0.35;
      this.s.add(kettle);
    }

    // Right-wall front door beside the wall-mounted beige phone.
    const doorMat = this.mat(0x5a321f, 0.55);
    this.box(this.s, [0.1, 2.15, 0.08], [1.34, 1.07, -6.36], woodDark);
    this.box(this.s, [0.1, 2.15, 0.08], [1.34, 1.07, -7.34], woodDark);
    this.box(this.s, [0.1, 0.14, 1.05], [1.34, 2.08, -6.85], woodDark);
    this.doorGroup.position.set(1.34, 0, -7.32);
    const slab = this.box(this.doorGroup, [0.08, 2.0, 0.9], [0, 1.0, 0.43], doorMat);
    slab.castShadow = true;
    this.handle = this.cyl(this.doorGroup, 0.045, 0.045, 0.12, [-0.08, 1.0, 0.78], brass, 12);
    this.handle.rotation.z = Math.PI / 2;
    this.s.add(this.doorGroup);

    // Production beige phone as the wall-mounted final variant. The desk-phone axes are
    // remapped so the face/receiver point into the hallway and the keypad descends vertically.
    const phoneMount = cloneHomePart('wall_phone_mount');
    if (phoneMount) {
      phoneMount.position.set(1.27, 1.39, -5.85);
      phoneMount.rotation.y = -Math.PI / 2;
      this.s.add(phoneMount);
    }
    this.phoneInst = await GLTFManager.instantiate(beigePhoneUrl, { castShadow: true, receiveShadow: true });
    const phone = this.phoneInst.root;
    const basis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
    );
    phone.quaternion.setFromRotationMatrix(basis);
    phone.position.set(1.22, 1.34, -5.85);
    this.s.add(phone);
    this.receiver = this.phoneInst.parts.get('receiver');
    if (this.receiver) this.receiverHome.copy(this.receiver.position);

    // Office loop beyond the door: mustard carpet, beige partitions, fluorescent ceiling, desk phone ahead.
    const beige = this.mat(0xd0c19d, 0.45);
    const mustard = this.mat(0x8a7a55, 0.82);
    const officeWall = this.mat(0xaec2a4, 0.82);
    const ceiling = this.mat(0xe5ead8, 0.78);
    this.box(this.s, [8.8, 0.08, 3.2], [5.6, -0.04, -6.8], mustard);
    this.box(this.s, [8.8, 2.7, 0.1], [5.6, 1.35, -8.45], officeWall);
    this.box(this.s, [8.8, 2.7, 0.1], [5.6, 1.35, -5.15], officeWall);
    this.box(this.s, [8.8, 0.1, 3.2], [5.6, 2.7, -6.8], ceiling);
    for (let i = 0; i < 5; i++) {
      const tm = this.mat(0xd8ffd0, 0.35, 0, 0xc9ffd2, 2.2);
      this.officeTubeMats.push(tm);
      this.box(this.s, [0.8, 0.03, 0.36], [2.7 + i * 1.35, 2.64, -6.8], tm);
    }
    this.box(this.s, [1.3, 0.75, 0.65], [7.25, 0.38, -6.85], this.mat(0x5b5348, 0.5));
    this.box(this.s, [0.38, 0.2, 0.28], [7.18, 0.86, -6.8], beige);
    this.box(this.s, [0.14, 0.1, 0.42], [7.15, 1.0, -6.8], beige);
    for (let i = 0; i < 4; i++) this.box(this.s, [0.08, 1.45, 1.1], [3.1 + i * 1.2, 0.73, -5.45], officeWall, [0, 0.12 * (i % 2 ? 1 : -1), 0]);

    const officeFluor = new THREE.PointLight(0xc9ffd2, 3.4, 9.5, 1.35);
    officeFluor.position.set(3.8, 2.25, -6.8);
    this.s.add(officeFluor);

    this.s.add(this.flash.group);

    const sun = new THREE.DirectionalLight(0xffb36b, 2.2);
    sun.position.set(-3.5, 4.2, -2.0);
    this.s.add(sun, new THREE.AmbientLight(0x604632, 0.36));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const pose = poseAt(t, z8Gait(t));
    applyFirstPersonCamera(this.cam, pose, out.width / out.height);
    const dir = new THREE.Vector3(...pose.forward);

    // Phone rings 206-214; receiver lifts by itself and swings on its cord.
    const ring = t >= 206 && t < 210 ? (Math.sin(t * Math.PI * 20) > 0 ? 1 : 0.72) : 1;
    const lift = smooth((t - 210) / 1.2);
    const unhook = smooth((t - 210) / 0.7);
    const drop = smooth((t - 211.0) / 1.4);
    if (this.receiver) {
      this.receiver.position.copy(this.receiverHome).add(new THREE.Vector3(
        -lift * 0.018,
        unhook * 0.045,
        unhook * 0.075 - drop * 0.14,
      ));
      this.receiver.rotation.z = 0.04 + lift * (0.28 + 0.08 * Math.sin((t - 210) * 5));
      this.receiver.rotation.x = lift * 0.12 * Math.sin((t - 210) * 4);
      this.receiver.scale.setScalar(1);
    }

    // Door handle turns, then the front door opens onto the office loop.
    this.handle.rotation.y = smooth((t - 214) / 2.0) * 0.9;
    this.doorGroup.rotation.y = smooth((t - 217.5) / 2.0) * 1.65;

    // Warm lamp is deliberately shadowless; its glow is steady and wrong.
    this.lampGlow.emissiveIntensity = 2.2 + 0.15 * Math.sin(t * 2.1);
    this.officeTubeMats.forEach((m, i) => { m.emissiveIntensity = 1.65 + (i === 2 ? 0.5 * hash(Math.floor(t * 7) + i) : 0.12 * hash(Math.floor(t * 3) + i)); });

    // Shared beam adapter: weak 25% battery in daylight, with the low-battery stutter.
    const threat = t >= 206 && t < 218 ? 0.55 : 0.1;
    this.flash.update(pose, t, beamStateAt(t, threat), (time) => poseAt(time, z8Gait(time)).forward);

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(0x17100b, 1);
    rr.clear(true, true, true);
    rr.render(this.s, this.cam);
    rr.resetState();

    return thresholdPost(t, { exposure: 0.86, darkness: 0.38, stress: threat * 0.25 });
  }

  override dispose() {
    this.flash.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
