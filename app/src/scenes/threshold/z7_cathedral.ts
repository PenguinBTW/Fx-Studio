// THRESHOLD Z7 grey-box blockout. Vending cathedral, 150-195 s.
// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { evalFirstPerson, applyFirstPersonCamera, type FPKey, type GaitName } from './fp_cam';
import { FlashlightRig, beamStateAt } from './flashlight';
import { thresholdPost } from './sensor_post';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import vendingMachinesUrl from './assets/z7_vending_machines/model.glb?url';
import { resolveAsset } from '../../engine/assets';
import { coldOpenPose, coldOpenArmReference, COLD_OPEN_REPLAY } from './z0_coldopen';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => { const u = clamp(x); return u * u * (3 - 2 * u); };
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

type PoseKey = { t: number; p: [number, number, number]; yaw: number; pitch: number; roll: number; fov: number };
const KEYS: PoseKey[] = [
  { t: 149.5, p: [0, 1.65, 1.5], yaw: 0, pitch: 0, roll: 0, fov: 80 },
  { t: 154.0, p: [0, 1.65, 1.5], yaw: 0, pitch: 31, roll: 0, fov: 80 },
  { t: 158.0, p: [0, 1.65, 1.5], yaw: 0, pitch: 6, roll: 0, fov: 78 },
  { t: 160.5, p: [-10.7, 1.65, -5.8], yaw: -72, pitch: 0, roll: 0, fov: 66 },
  { t: 163.0, p: [-10.9, 1.65, -9.2], yaw: -28, pitch: 0, roll: 0, fov: 68 },
  { t: 165.5, p: [-3.6, 1.65, -11.0], yaw: 18, pitch: 0, roll: 0, fov: 70 },
  { t: 168.0, p: [0, 1.6, -13.0], yaw: 0, pitch: 0, roll: 0, fov: 84 },
  { t: 170.0, p: [0, 1.6, -24.0], yaw: 0, pitch: 0, roll: 2, fov: 84 },
  { t: 172.0, p: [0, 1.15, -33.5], yaw: 163, pitch: -12, roll: 12, fov: 86 },
  { t: 173.4, p: [0, 0.35, -34.6], yaw: 184, pitch: -5, roll: 70, fov: 90 },
  { t: 175.0, p: [0, 0.48, -34.6], yaw: 174, pitch: 2, roll: 58, fov: 86 },
  { t: 176.0, p: [0, 1.6, -35.8], yaw: 0, pitch: 0, roll: 0, fov: 86 },
  { t: 181.0, p: [0, 1.6, -63.0], yaw: 0, pitch: 0, roll: -2, fov: 88 },
  { t: 186.0, p: [0, 1.35, -89.0], yaw: 0, pitch: -8, roll: 0, fov: 92 },
  { t: 189.0, p: [0, -11.5, -96.0], yaw: 0, pitch: 38, roll: 180, fov: 95 },
  { t: 192.0, p: [0, -27.5, -101.0], yaw: 0, pitch: -65, roll: 360, fov: 95 },
  { t: 193.5, p: [0, -29.1, -101.5], yaw: 0, pitch: 8, roll: 360, fov: 82 },
  { t: 195.6, p: [0, -28.35, -101.5], yaw: 0, pitch: 0, roll: 360, fov: 76 },
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

function z7Gait(t: number): GaitName {
  if ((t >= 168 && t < 172) || (t >= 176 && t < 186)) return 'run';
  if (t >= 158 && t < 163) return 'walk';
  if (t >= COLD_OPEN_REPLAY.z7BeamDead && t < 174.55) return 'holdBreath';
  return 'still';
}

const REPLAY_Z_OFFSET = -28.5;
const REPLAY_T_OFFSET = COLD_OPEN_REPLAY.z7Start - COLD_OPEN_REPLAY.z0Start;
function replayPoseAt(t: number) {
  const local = clamp(t - REPLAY_T_OFFSET, 0, 4);
  const p = coldOpenPose(local);
  return {
    ...p,
    pos: [p.pos[0], p.pos[1], p.pos[2] + REPLAY_Z_OFFSET] as [number, number, number],
    target: [p.target[0], p.target[1], p.target[2] + REPLAY_Z_OFFSET] as [number, number, number],
  };
}
function z7PoseAt(t: number) {
  return t >= REPLAY_T_OFFSET && t <= COLD_OPEN_REPLAY.z7BeamDead ? replayPoseAt(t) : poseAt(t, z7Gait(t));
}

export default class ThresholdZ7Cathedral extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(80, 16 / 9, 0.08, 280);
  private flash = new FlashlightRig();
  private machineBodies!: THREE.InstancedMesh;
  private machineFronts!: THREE.InstancedMesh;
  private machineFrames!: THREE.InstancedMesh;
  private machineData: { x: number; y: number; z: number; seed: number }[] = [];
  private heroMachinesL?: GLTFInstance;
  private heroMachinesR?: GLTFInstance;
  private tenantArmInst?: GLTFInstance;
  private replayArm = new THREE.Group();
  private replayHeroMachines = new THREE.Group();
  private replayMachines?: THREE.InstancedMesh;
  private replayPanels?: THREE.InstancedMesh;
  private replayMachineMat?: THREE.MeshStandardMaterial;
  private replayPanelMat?: THREE.MeshStandardMaterial;
  private tenant = new THREE.Group();
  private reachArm = new THREE.Group();
  private lint = new THREE.Group();
  private assembly: { mesh: THREE.Object3D; start: THREE.Vector3; end: THREE.Vector3; seed: number }[] = [];
  private rift!: THREE.Mesh;
  private riftEdges: THREE.Mesh[] = [];
  private shaftLights: THREE.MeshBasicMaterial[] = [];
  private disposables: { dispose(): void }[] = [];
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpS = new THREE.Vector3(1, 1, 1);
  private tmpP = new THREE.Vector3();

  private mat(color: number, roughness = 0.55, metalness = 0, emissive = 0, emissiveIntensity = 0) {
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

  private cyl(parent: THREE.Object3D, rTop: number, rBot: number, h: number, pos: [number, number, number], mat: THREE.Material, seg = 10) {
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

  private buildTenant() {
    const tile = this.mat(0xb9d9d7, 0.24);
    const grout = this.mat(0x1a2224, 0.65);
    const paper = this.mat(0xd8c69d, 0.82);
    const felt = this.mat(0x6b3f24, 0.94);
    const chrome = this.mat(0x9aa0a3, 0.2, 0.82);
    const red = this.mat(0xa82d27, 0.28);
    const yellow = this.mat(0xd0aa35, 0.3);
    const blue = this.mat(0x2e5fa8, 0.28);
    const glass = new THREE.MeshStandardMaterial({ color: 0x25333a, roughness: 0.18, metalness: 0.15, transparent: true, opacity: 0.64 });
    this.disposables.push(glass);

    this.box(this.tenant, [0.28, 0.34, 0.24], [0, 3.96, 0], tile);
    this.box(this.tenant, [0.3, 0.035, 0.25], [0, 3.96, 0.01], grout);
    for (let i = 0; i < 4; i++) this.cyl(this.tenant, 0.07, 0.085, 0.2, [0, 3.66 - i * 0.14, 0], felt, 8);
    this.box(this.tenant, [0.78, 1.05, 0.34], [0, 2.82, 0], glass);
    for (let i = 0; i < 6; i++) this.box(this.tenant, [0.66, 0.035, 0.37], [0, 2.42 + i * 0.16, 0.01], chrome);
    this.box(this.tenant, [0.58, 0.46, 0.34], [0, 2.02, 0], paper, [0, 0, 0.1]);

    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const ballMat = i % 3 === 0 ? red : i % 3 === 1 ? yellow : blue;
        this.sphere(this.tenant, 0.13 - i * 0.006, [side * (0.47 + i * 0.15), 3.18 - i * 0.13, 0], ballMat, [1, 0.9, 1]);
      }
      for (let i = 0; i < 4; i++) this.cyl(this.tenant, 0.025, 0.036, 0.5, [side * (1.18 + i * 0.05), 2.35 - i * 0.07, 0.02 * i], chrome, 8).rotation.z = side * (1.1 + i * 0.18);
      for (let i = 0; i < 5; i++) this.box(this.tenant, [0.035, 0.42, 0.07], [side * (0.9 + i * 0.04), 2.25 - i * 0.03, 0.1], paper, [0, 0, side * (-0.3 - i * 0.1)]);
      for (let i = 0; i < 5; i++) {
        this.box(this.tenant, [0.22, 0.28, 0.2], [side * 0.3, 1.7 - i * 0.29, 0], i % 2 ? tile : paper, [0, 0, side * 0.06 * i]);
      }
      this.box(this.tenant, [0.34, 0.16, 0.48], [side * 0.32, 0.12, 0.06], grout);
    }
    for (let i = 0; i < 7; i++) this.cyl(this.tenant, 0.035, 0.045, 0.36, [0, 2.3 - i * 0.22, -0.22], chrome, 8).rotation.x = 0.25;
    this.tenant.visible = false;
    this.s.add(this.tenant);
  }

  private buildReachArm() {
    const paper = this.mat(0xd8c69d, 0.82);
    const chrome = this.mat(0x9aa0a3, 0.2, 0.82);
    const red = this.mat(0xa82d27, 0.28);
    const tile = this.mat(0xb9d9d7, 0.26);
    // Overscaled grey-box reach: a patchwork upper arm extending toward the fallen camera.
    for (let i = 0; i < 7; i++) {
      const mat = [red, chrome, paper, tile][i % 4]!;
      this.box(this.reachArm, [0.34 - i * 0.018, 0.28 - i * 0.012, 0.68], [0, 2.95 - i * 0.11, -0.35 - i * 0.58], mat, [0.06 * i, 0.03 * (i % 2 ? 1 : -1), 0.04 * i]);
    }
    for (let f = 0; f < 5; f++) {
      const x = (f - 2) * 0.095;
      this.box(this.reachArm, [0.055, 0.055, 0.78], [x, 2.18 - Math.abs(f - 2) * 0.025, -4.35 - 0.08 * Math.abs(f - 2)], f % 2 ? chrome : paper, [0.12 * (f - 2), 0.05 * (f - 2), 0]);
      this.box(this.reachArm, [0.07, 0.04, 0.16], [x, 2.15 - Math.abs(f - 2) * 0.025, -4.78 - 0.08 * Math.abs(f - 2)], chrome, [0.3, 0, 0]);
    }
    const armLight = new THREE.PointLight(0xffc98a, 2.4, 7, 1.35);
    armLight.position.set(0, 2.55, -3.0);
    this.reachArm.add(armLight);
    this.reachArm.visible = false;
    this.s.add(this.reachArm);
  }

  override async init() {
    this.s.background = new THREE.Color(0x020407);
    this.s.fog = new THREE.FogExp2(0x020407, 0.012);

    const floorMat = this.mat(0x05070a, 0.18, 0.42);
    const darkMetal = this.mat(0x111820, 0.42, 0.55);
    const productRed = this.mat(0xa22a28, 0.35);
    const productTeal = this.mat(0x2aa9a4, 0.35);
    const paper = this.mat(0xd8c69d, 0.82);
    const chrome = this.mat(0x9aa0a3, 0.2, 0.82);

    // Polished black nave floor and central aisle slab.
    this.box(this.s, [31, 0.12, 210], [0, -0.06, -98], floorMat);
    this.box(this.s, [5.4, 0.025, 210], [0, 0.015, -98], this.mat(0x090c11, 0.12, 0.55));

    // Stacked vending-machine walls as instanced hard-surface bodies plus glowing glass fronts.
    const rows = 62;
    const levels = 18;
    const count = rows * levels * 2;
    const bodyGeo = new THREE.BoxGeometry(0.86, 2.2, 2.55);
    const frontGeo = new THREE.BoxGeometry(0.08, 1.65, 1.9);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x161b22, roughness: 0.38, metalness: 0.6 });
    const frontMat = new THREE.MeshStandardMaterial({ color: 0x93c9ff, roughness: 0.22, metalness: 0.05, emissive: 0x5aa8ff, emissiveIntensity: 0.25 });
    this.disposables.push(bodyGeo, frontGeo, bodyMat, frontMat);
    this.machineBodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
    this.machineFronts = new THREE.InstancedMesh(frontGeo, frontMat, count);
    this.machineBodies.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.machineFronts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    const frameGeo = new THREE.BoxGeometry(1, 1, 1);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x080d13, roughness: 0.42, metalness: 0.68 });
    this.disposables.push(frameGeo, frameMat);
    this.machineFrames = new THREE.InstancedMesh(frameGeo, frameMat, count * 7);
    let k = 0;
    let frameIndex = 0;
    const setFramePiece = (x: number, y: number, z: number, sx: number, sy: number, sz: number, hidden: boolean) => {
      this.tmpP.set(x, y, z);
      this.tmpS.set(hidden ? 0.0001 : sx, hidden ? 0.0001 : sy, hidden ? 0.0001 : sz);
      this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
      this.machineFrames.setMatrixAt(frameIndex++, this.tmpM);
    };
    for (const side of [-1, 1]) {
      for (let r = 0; r < rows; r++) {
        for (let lev = 0; lev < levels; lev++) {
          const z = -2.5 - r * 3.25 + (hash(r * 7 + lev) - 0.5) * 0.12;
          const y = 1.1 + lev * 2.45;
          const x = side * (14.4 + 0.25 * hash(lev * 13 + r));
          this.tmpP.set(x, y, z);
          this.tmpQ.identity();
          const heroCovered = side === -1 && r <= 2 && lev === 0;
          this.tmpS.set(heroCovered ? 0.0001 : 1 + 0.05 * hash(k), heroCovered ? 0.0001 : 1, heroCovered ? 0.0001 : 0.9 + 0.14 * hash(k * 2));
          this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
          this.machineBodies.setMatrixAt(k, this.tmpM);
          this.tmpP.set(x - side * 0.48, y + 0.05, z);
          this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
          this.machineFronts.setMatrixAt(k, this.tmpM);
          const fx = x - side * 0.54;
          const fy = y + 0.05;
          setFramePiece(fx, fy + 0.86, z, 0.08, 0.075, 2.05, heroCovered);
          setFramePiece(fx, fy - 0.86, z, 0.08, 0.075, 2.05, heroCovered);
          setFramePiece(fx, fy, z - 0.98, 0.08, 1.78, 0.07, heroCovered);
          setFramePiece(fx, fy, z + 0.98, 0.08, 1.78, 0.07, heroCovered);
          setFramePiece(fx - side * 0.012, fy - 0.28, z, 0.045, 0.035, 1.72, heroCovered);
          setFramePiece(fx - side * 0.012, fy + 0.25, z, 0.045, 0.035, 1.72, heroCovered);
          setFramePiece(fx - side * 0.012, fy + 0.68, z, 0.045, 0.03, 1.72, heroCovered);
          this.machineData.push({ x, y, z, seed: hash(k * 3.7) });
          k++;
        }
      }
    }
    this.machineBodies.instanceMatrix.needsUpdate = true;
    this.machineFronts.instanceMatrix.needsUpdate = true;
    this.machineFrames.instanceMatrix.needsUpdate = true;
    this.s.add(this.machineBodies, this.machineFronts, this.machineFrames);

    // Upside-down ceiling machine hints 60 m overhead.
    for (let z = -12; z > -190; z -= 9) {
      for (let x = -10; x <= 10; x += 5) {
        this.box(this.s, [2.2, 0.75, 1.4], [x, 57 + 1.5 * hash(z + x), z], darkMetal, [Math.PI, 0, 0]);
        const lm = new THREE.MeshBasicMaterial({ color: 0x315070 });
        this.disposables.push(lm);
        this.box(this.s, [1.4, 0.04, 0.9], [x, 56.4 + 1.5 * hash(z + x), z], lm);
      }
    }

    // Close-up product shelf items named in the storyboard: phone, ball, tile, page, puppet, flashlight price 0.
    const beige = this.mat(0xcdbd97, 0.5);
    this.box(this.s, [0.24, 0.16, 0.18], [-13.75, 1.25, -5.0], beige);
    this.sphere(this.s, 0.13, [-13.75, 1.3, -6.0], productRed);
    this.box(this.s, [0.22, 0.22, 0.04], [-13.75, 1.3, -7.0], this.mat(0xb9d9d7, 0.28));
    this.box(this.s, [0.25, 0.32, 0.025], [-13.75, 1.3, -8.0], paper, [0, 0, 0.15]);
    this.box(this.s, [0.18, 0.3, 0.12], [-13.75, 1.3, -9.0], this.mat(0x704222, 0.95));
    this.box(this.s, [0.09, 0.38, 0.09], [-13.75, 1.32, -10.0], chrome);
    this.box(this.s, [0.28, 0.08, 0.02], [-13.72, 1.7, -10.0], new THREE.MeshBasicMaterial({ color: 0xd8f2ff }));

    // Assembly debris pieces that converge into the Tenant silhouette.
    const pieceMats = [productRed, productTeal, paper, chrome, beige];
    for (let i = 0; i < 28; i++) {
      const m = pieceMats[i % pieceMats.length]!;
      const piece = i % 3 === 0
        ? this.sphere(this.s, 0.09 + 0.04 * hash(i), [0, -20, 0], m)
        : this.box(this.s, [0.16 + 0.1 * hash(i), 0.12 + 0.12 * hash(i * 2), 0.1 + 0.1 * hash(i * 3)], [0, -20, 0], m);
      const side = i % 2 ? -1 : 1;
      const start = new THREE.Vector3(side * (11 + hash(i) * 2), 0.7 + hash(i * 2) * 1.6, -8 - hash(i * 3) * 16);
      const end = new THREE.Vector3((hash(i * 4) - 0.5) * 0.9, 0.5 + hash(i * 5) * 3.0, -18 + (hash(i * 6) - 0.5) * 0.5);
      this.assembly.push({ mesh: piece, start, end, seed: hash(i * 9) });
      piece.visible = false;
    }
    this.buildTenant();
    this.buildReachArm();

    // Central floor rift, initially hairline and invisible, then widening.
    const riftMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.disposables.push(riftMat);
    this.rift = this.box(this.s, [1, 0.025, 92], [0, 0.04, -92], riftMat);
    this.rift.visible = false;
    const edgeMat = this.mat(0x25313b, 0.28, 0.55, 0x365d78, 0.4);
    for (const side of [-1, 1]) {
      const e = this.box(this.s, [0.18, 0.12, 92], [side * 0.55, 0.06, -92], edgeMat, [0, 0, side * 0.06]);
      e.visible = false;
      this.riftEdges.push(e);
    }

    // Vertical fall shaft below the rift: repeating machine-light streaks and warm home glow below.
    for (let i = 0; i < 52; i++) {
      const lm = new THREE.MeshBasicMaterial({ color: i % 2 ? 0x6fbaff : 0xbfe8ff, transparent: true, opacity: 0.45 });
      this.disposables.push(lm);
      this.shaftLights.push(lm);
      const side = i % 2 ? -1 : 1;
      this.box(this.s, [0.06, 1.4 + hash(i) * 2.5, 0.18], [side * (4 + hash(i * 2) * 6), -2 - i * 0.62, -98 - hash(i * 3) * 9], lm);
    }
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? -1 : 1;
      const y = -4.0 - i * 1.45;
      const z = -96.5 - (i % 5) * 2.2;
      const x = side * (3.7 + hash(i * 4) * 2.3);
      this.box(this.s, [1.15, 1.8, 0.82], [x, y, z], darkMetal, [0.08 * hash(i), 0.15 * side, 0.05 * side]);
      const fm = new THREE.MeshBasicMaterial({ color: i % 3 ? 0x5aa8ff : 0xbfe8ff });
      this.disposables.push(fm);
      this.box(this.s, [0.9, 1.15, 0.045], [x - side * 0.43, y + 0.05, z], fm, [0.08 * hash(i), 0.15 * side, 0.05 * side]);
    }

    const warmGlow = this.mat(0xffbd65, 0.6, 0, 0xff9b38, 2.8);
    this.box(this.s, [7.5, 0.08, 7.5], [0, -30.05, -101.5], warmGlow);
    this.box(this.s, [5.5, 0.025, 5.5], [0, -29.98, -101.5], this.mat(0x8a5b35, 0.7));

    // Cathedral dressing: coin piles, toppled machine, cables/chains, receipt strips, altar-like change machine.
    for (let i = 0; i < 9; i++) {
      this.cyl(this.s, 0.28 + 0.1 * hash(i), 0.34 + 0.1 * hash(i), 0.05 + 0.08 * hash(i * 2), [(hash(i * 3) - 0.5) * 6, 0.04, -12 - i * 9], chrome, 16);
    }
    this.box(this.s, [1.3, 2.2, 0.8], [5.4, 0.55, -48], darkMetal, [0.25, 0.2, 1.25]);
    for (let i = 0; i < 12; i++) this.cyl(this.s, 0.015, 0.02, 5 + hash(i) * 4, [-9 + hash(i * 2) * 18, 28, -30 - i * 11], darkMetal, 6);
    for (let i = 0; i < 10; i++) this.box(this.s, [0.08, 0.01, 0.55], [(hash(i * 5) - 0.5) * 4, 0.04, -15 - i * 6], paper, [0, hash(i) * 3, 0]);
    this.box(this.s, [1.7, 2.3, 1.0], [0, 1.15, -170], chrome);
    this.box(this.s, [1.1, 0.18, 0.04], [0, 1.65, -169.45], new THREE.MeshBasicMaterial({ color: 0x9fdcff }));

    // Full-detail hero vending-machine family near the first wall walk. The instanced
    // walls carry the 200m cathedral scale; these GLB machines supply close-range door
    // edges, product slots, coils, keypads, flaps and damage/wear readable in the beam.
    const [heroL, heroR] = await Promise.all([
      GLTFManager.instantiate(vendingMachinesUrl, { castShadow: true, receiveShadow: true }),
      GLTFManager.instantiate(vendingMachinesUrl, { castShadow: true, receiveShadow: true }),
    ]);
    this.heroMachinesL = heroL;
    this.heroMachinesR = heroR;
    for (const inst of [heroL, heroR]) {
      const modules = inst.parts.get('variant_modules');
      if (modules) modules.visible = false;
      this.s.add(inst.root);
    }
    heroL.root.position.set(-14.2, 0, -5.5);
    heroL.root.rotation.y = Math.PI / 2;
    heroR.root.position.set(14.2, 0, -12.5);
    heroR.root.rotation.y = -Math.PI / 2;
    const heroLightL = new THREE.PointLight(0x72c9ff, 0.75, 5.5, 1.6);
    heroLightL.position.set(-13.2, 1.7, -5.7);
    const heroLightR = new THREE.PointLight(0x72c9ff, 0.45, 5.5, 1.6);
    heroLightR.position.set(13.2, 1.7, -12.7);
    this.s.add(heroLightL, heroLightR);

    // Canonical cold-open recurrence passage: close inner machine rows reproduce the
    // exact Z0 aisle/machine scale inside the larger cathedral during 171.30-173.40.
    this.replayMachineMat = new THREE.MeshStandardMaterial({ color: 0x101722, roughness: 0.42, metalness: 0.58, emissive: 0x102438, emissiveIntensity: 0.95 });
    this.replayPanelMat = new THREE.MeshStandardMaterial({ color: 0x102334, roughness: 0.25, metalness: 0.2, emissive: 0x4bb7d7, emissiveIntensity: 1.8 });
    this.disposables.push(this.replayMachineMat, this.replayPanelMat);
    const replayBodyGeo = new THREE.BoxGeometry(0.85, 2.2, 0.62);
    const replayPanelGeo = new THREE.BoxGeometry(0.026, 1.16, 0.4);
    this.disposables.push(replayBodyGeo, replayPanelGeo);
    const replayRows = 18;
    this.replayMachines = new THREE.InstancedMesh(replayBodyGeo, this.replayMachineMat, replayRows * 2);
    this.replayPanels = new THREE.InstancedMesh(replayPanelGeo, this.replayPanelMat, replayRows * 2);
    let ri = 0;
    for (const side of [-1, 1]) for (let row = 0; row < 18; row++) {
      const z = -24.5 - row * 3.2;
      const h = 2.2 + 0.25 * hash(row * 2.13 + side);
      const x = side * (2.25 + 0.08 * hash(row * 4.7));
      this.tmpQ.identity();
      this.tmpP.set(x, h / 2, z);
      this.tmpS.set(row < 10 ? 0.0001 : 1, row < 10 ? 0.0001 : h / 2.2, row < 10 ? 0.0001 : 1);
      this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
      this.replayMachines.setMatrixAt(ri, this.tmpM);
      this.tmpP.set(x - side * 0.44, 1.18 * (h / 2.2), z - 0.02);
      this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
      this.replayPanels.setMatrixAt(ri, this.tmpM);
      ri++;
    }
    this.replayMachines.instanceMatrix.needsUpdate = true;
    this.replayPanels.instanceMatrix.needsUpdate = true;
    this.s.add(this.replayMachines, this.replayPanels);

    // Same Tenant arm GLB and placement reference as Z0; no reinterpreted proxy arm.
    this.tenantArmInst = await GLTFManager.instantiate(resolveAsset('tenant_arm', 'threshold').url, { castShadow: true, receiveShadow: true });
    this.replayArm.add(this.tenantArmInst.root);
    const machineGlint = new THREE.PointLight(0x7fc9ff, 1.8, 3.0, 1.6);
    machineGlint.position.set(-0.18, 0.18, -0.95);
    this.replayArm.add(machineGlint);
    const fingerGlint = new THREE.PointLight(0xffc28a, 3.4, 3.4, 1.8);
    fingerGlint.position.set(0.06, 0.08, -1.92);
    this.replayArm.add(fingerGlint);
    const rimGlint = new THREE.PointLight(0x9fdcff, 2.2, 3.0, 1.9);
    rimGlint.position.set(-0.36, 0.32, -1.25);
    this.replayArm.add(rimGlint);
    this.tenantArmInst.root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.name === 'shoulder_collage') obj.scale.multiplyScalar(0.72);
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!(m instanceof THREE.MeshStandardMaterial)) continue;
        if (m.name === 'TenantChrome') { m.emissive.setHex(0x182230); m.emissiveIntensity = 0.28; m.roughness = 0.2; }
        if (m.name === 'TenantPoolTile') { m.emissive.setHex(0x07191e); m.emissiveIntensity = 0.12; }
      }
    });
    this.replayArm.visible = false;
    this.s.add(this.replayArm);

    // Near rows use the same detailed vending-machine clones as Z0, in the same relative positions.
    const replayKinds = ['snacks_machine_root', 'drinks_machine_root', 'glass_front_machine_root', 'retro_machine_root'];
    for (const side of [-1, 1]) for (let row = 0; row < 10; row++) {
      const source = heroL.root.getObjectByName(replayKinds[(row + (side > 0 ? 1 : 0)) % replayKinds.length]!);
      if (!source) continue;
      const clone = source.clone(true);
      clone.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.material = Array.isArray(obj.material) ? obj.material.map((m) => m.clone()) : obj.material.clone();
      });
      clone.position.set(0, 0, 0);
      const wrap = new THREE.Group();
      wrap.add(clone);
      wrap.position.set(side * (2.25 + 0.08 * hash(row * 4.7)), 0, -24.5 - row * 3.2);
      wrap.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      wrap.scale.setScalar(1.04);
      this.replayHeroMachines.add(wrap);
    }
    this.s.add(this.replayHeroMachines);
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) {
      const lamp = new THREE.PointLight(row % 3 === 0 ? 0xffc58c : 0x7fc9ff, 0.72, 2.6, 1.7);
      lamp.position.set(side * 1.48, 1.28, -24.53 - row * 3.2);
      this.s.add(lamp);
    }

    // Cable trays and floor runs reproduce the cold-open mechanical scale cues.
    const replayConduitMat = new THREE.MeshStandardMaterial({ color: 0x0b1118, roughness: 0.48, metalness: 0.72, emissive: 0x071018, emissiveIntensity: 0.18 });
    this.disposables.push(replayConduitMat);
    for (const x of [-1.72, 1.72, -0.72, 0.72]) {
      const wide = x < -1 || x > 1;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(wide ? 0.08 : 0.045, wide ? 0.08 : 0.035, 170), replayConduitMat);
      rail.position.set(x, wide ? 3.55 : 0.035, -90.5);
      this.s.add(rail);
    }
    for (let k = 0; k < 12; k++) {
      for (const side of [-1, 1]) {
        const drop = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.05, 0.055), replayConduitMat);
        drop.position.set(side * 1.72, 3.05, -25.5 - k * 8);
        this.s.add(drop);
      }
      if (k % 3 === 0) {
        const floorCross = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.025, 0.06), replayConduitMat);
        floorCross.position.set(0, 0.025, -27.3 - k * 8);
        this.s.add(floorCross);
      }
    }

    // High cold strips match the overhead rhythm of the cold-open aisle.
    const replayStripMat = new THREE.MeshBasicMaterial({ color: 0x88d7ff, transparent: true, opacity: 0.55 });
    this.disposables.push(replayStripMat);
    for (let k = 0; k < 9; k++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.035, 0.06), replayStripMat);
      strip.position.set(0, 4.1, -26.5 - k * 8);
      this.s.add(strip);
    }

    // Lint with warm relight glow.
    const lintBody = this.mat(0x704222, 0.98);
    const lintWing = this.mat(0x9a6035, 0.98);
    const glow = this.mat(0xff8c2a, 0.5, 0, 0xff7418, 2.8);
    this.cyl(this.lint, 0.032, 0.045, 0.14, [0, 0, 0], lintBody, 10).rotation.x = Math.PI / 2;
    this.box(this.lint, [0.17, 0.02, 0.09], [-0.085, 0, 0.005], lintWing, [0, 0, 0.35]);
    this.box(this.lint, [0.17, 0.02, 0.09], [0.085, 0, 0.005], lintWing, [0, 0, -0.35]);
    this.cyl(this.lint, 0.03, 0.035, 0.05, [0, -0.005, -0.07], glow, 10).rotation.x = Math.PI / 2;
    this.lint.visible = false;
    this.s.add(this.lint);

    this.s.add(this.flash.group);

    this.s.add(new THREE.AmbientLight(0x152033, 0.18));
  }

  private updateMachineWave(t: number, camZ: number) {
    const frontColor = new THREE.Color();
    const bodyColor = new THREE.Color();
    for (let i = 0; i < this.machineData.length; i++) {
      const d = this.machineData[i]!;
      const activation = 154 + 3 * clamp((-d.z - 2) / 198);
      let on = smooth((t - activation) / 0.22);
      // During the chase, machines behind the runner thunk off in a wave moving toward camera.
      if (t >= 168 && t < 176) {
        const chaseOff = 168 + clamp((-camZ + d.z) / 34) * 4;
        if (d.z > camZ - 2) on *= 1 - smooth((t - chaseOff) / 0.28);
      }
      if (t >= 170.1 && t <= 173.4) on *= 0.06;
      const flick = 0.88 + 0.12 * hash(Math.floor(t * 8) + i);
      frontColor.setRGB(0.08 + on * 0.55 * flick, 0.12 + on * 0.75 * flick, 0.18 + on * 1.0 * flick);
      bodyColor.setRGB(0.05 + on * 0.08, 0.065 + on * 0.1, 0.085 + on * 0.14);
      this.machineFronts.setColorAt(i, frontColor);
      this.machineBodies.setColorAt(i, bodyColor);
    }
    this.machineFronts.instanceColor!.needsUpdate = true;
    this.machineBodies.instanceColor!.needsUpdate = true;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const pose = z7PoseAt(t);
    applyFirstPersonCamera(this.cam, pose, out.width / out.height);
    const dir = new THREE.Vector3(...pose.forward);

    // Machine wave and chase darkness are pure timeline functions.
    this.updateMachineWave(t, this.cam.position.z);
    const heroOn = smooth((t - 154.0) / 0.35) * (t >= 168 && t < 176 ? 1 - smooth((-this.cam.position.z - 3) / 8) : 1);
    for (const inst of [this.heroMachinesL, this.heroMachinesR]) {
      const cold = inst?.materials.get('ColdMachineLight') as THREE.MeshStandardMaterial | undefined;
      const warm = inst?.materials.get('WarmProductLabel') as THREE.MeshStandardMaterial | undefined;
      if (cold) cold.emissiveIntensity = 5.5 * heroOn;
      if (warm) warm.emissiveIntensity = 0.45 * heroOn;
    }

    // Assembly cascade: debris rolls inward and stacks into the full Tenant.
    const asm = smooth((t - 163) / 5);
    const showPieces = t >= 163 && t < 167.5;
    for (const a of this.assembly) {
      a.mesh.visible = showPieces;
      if (!showPieces) continue;
      const u = clamp(asm * 1.25 - a.seed * 0.25);
      const arc = Math.sin(Math.PI * u) * (1.5 + a.seed);
      a.mesh.position.copy(a.start).lerp(a.end, u);
      a.mesh.position.y += arc;
      a.mesh.rotation.set(t * (1 + a.seed), t * 1.7, t * 0.8);
    }

    const exactReplay = t >= COLD_OPEN_REPLAY.z7Start && t <= COLD_OPEN_REPLAY.z7BeamDead;
    this.machineBodies.visible = !exactReplay;
    this.machineFronts.visible = !exactReplay;
    this.machineFrames.visible = !exactReplay;
    if (this.heroMachinesL) this.heroMachinesL.root.visible = !exactReplay;
    if (this.heroMachinesR) this.heroMachinesR.root.visible = !exactReplay;

    // Tenant stop-start motion and pursuit position.
    const tenantVisible = t >= 167.2 && t < 186 && !exactReplay;
    this.tenant.visible = tenantVisible;
    if (tenantVisible) {
      let z = -18;
      if (t >= 168) z = this.cam.position.z + 4.8 + 0.4 * Math.sin(Math.floor(t * 3.3) * 2.1);
      const burst = hash(Math.floor(t * 3.3)) > 0.45 ? 1 : 0;
      this.tenant.position.set(0.15 * Math.sin(t * 1.7), 0, z);
      this.tenant.rotation.z = 0.12 * burst + 0.05 * Math.sin(t * 2.2);
      this.tenant.rotation.y = t >= 168 ? Math.PI : 0;
      const reach = smooth((t - 172.4) / 0.8) * (1 - smooth((t - 174.0) / 0.5));
      this.tenant.scale.set(1 + reach * 0.12, 1, 1 + reach * 0.35);
    }

    this.reachArm.visible = false;
    if (this.tenantArmInst) {
      const local = clamp(t - REPLAY_T_OFFSET, 0, 4);
      const ref = coldOpenArmReference(local, pose);
      const root = this.replayArm;
      root.position.set(...ref.position);
      root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(...ref.towardCamera));
      root.rotateX(ref.rotateX);
      root.rotateY(ref.rotateY);
      root.rotateZ(ref.rotateZ);
      root.scale.setScalar(ref.scale);
      root.visible = ref.visible && t >= COLD_OPEN_REPLAY.z7Start && t <= COLD_OPEN_REPLAY.z7BeamDead;
    }

    // Lint lands on the dead flashlight and relights it warm.
    const lintOn = t >= 174.0 && t < 176.2;
    this.lint.visible = lintOn;
    if (lintOn) {
      const lp = this.cam.position.clone().add(dir.clone().multiplyScalar(0.7)).add(new THREE.Vector3(0.08, -0.12, 0));
      this.lint.position.copy(lp);
      this.lint.scale.setScalar(1.55);
      const flap = Math.sign(Math.sin(t * Math.PI * 12)) * 0.42;
      this.lint.children[1]!.rotation.z = 0.35 + flap;
      this.lint.children[2]!.rotation.z = -0.35 - flap;
    }

    // Rift opens ahead after the relit run, with edge slabs tipping outward.
    const riftOpen = smooth((t - 176) / 7.5);
    this.rift.visible = riftOpen > 0;
    this.rift.scale.x = Math.max(0.02, riftOpen * 7.5);
    this.riftEdges.forEach((e, i) => {
      e.visible = riftOpen > 0;
      e.position.x = (i === 0 ? -1 : 1) * (0.4 + riftOpen * 3.7);
      e.rotation.z = (i === 0 ? 1 : -1) * riftOpen * 0.24;
    });

    // Falling streaks slide upward past the camera as a pure function of time.
    this.shaftLights.forEach((m, i) => {
      const fall = t >= 186 && t < 192 ? (t - 186) * 4 : 0;
      m.opacity = 0.25 + 0.35 * hash(i + Math.floor((t + fall) * 5));
    });

    const replayLocal = t - REPLAY_T_OFFSET;
    const replayWave = replayLocal < 1.2 ? 0 : clamp((replayLocal - 1.2) / 0.7);
    const replayOff = replayLocal >= 3.3 ? 0 : 1;
    if (this.replayMachineMat) this.replayMachineMat.emissiveIntensity = lerp(0.95, 0.14, replayWave) * replayOff;
    if (this.replayPanelMat) this.replayPanelMat.emissiveIntensity = lerp(1.8, 0.22, replayWave) * replayOff;

    // Shared beam adapter: global 25% battery, exact dead beat, then warm Lint relight.
    const dead = t >= COLD_OPEN_REPLAY.z7BeamDead && t < 174.55;
    const threat = t >= 167 ? 0.9 : 0.35;
    const beamTime = exactReplay ? clamp(t - REPLAY_T_OFFSET, 0, 4) : t;
    const baseBeam = beamStateAt(beamTime, exactReplay ? 1 : threat);
    const beam = { ...baseBeam, intensity: dead ? 0 : baseBeam.intensity, dead: dead || baseBeam.dead };
    this.flash.update(pose, beamTime, beam, (time) => {
      if (!exactReplay) return z7PoseAt(time).forward;
      const fwd = coldOpenPose(clamp(time, 0, 4)).forward;
      const down = lerp(0.18, 0, smooth((time - 1.8) / 0.55));
      const len = Math.hypot(fwd[0], fwd[1] - down, fwd[2]) || 1;
      return [fwd[0] / len, (fwd[1] - down) / len, fwd[2] / len] as [number, number, number];
    });

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(dead ? 0x000000 : 0x020407, 1);
    rr.clear(true, true, true);
    rr.render(this.s, this.cam);
    rr.resetState();

    return thresholdPost(t, { exposure: dead ? 0.2 : 0.92, darkness: 0.86, stress: threat * 0.65, fade: dead ? 0.55 : 0 });
  }

  override dispose() {
    this.flash.dispose();
    this.heroMachinesL?.dispose();
    this.heroMachinesR?.dispose();
    this.tenantArmInst?.dispose();
    this.replayMachines?.dispose();
    this.replayPanels?.dispose();
    for (const d of this.disposables) d.dispose();
    this.machineBodies?.dispose();
    this.machineFronts?.dispose();
    this.machineFrames?.dispose();
  }
}
