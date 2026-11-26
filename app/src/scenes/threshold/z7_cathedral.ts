// THRESHOLD Z7 vending cathedral, 150-195 s.
// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { evalFirstPerson, applyFirstPersonCamera, type FPKey, type GaitName } from './fp_cam';
import { FlashlightRig, beamStateAt } from './flashlight';
import { thresholdPost } from './sensor_post';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import vendingMachinesUrl from './assets/z7_vending_machines/model.glb?url';
import tenantFullUrl from './assets/tenant_full/model.glb?url';
import lintUrl from './assets/lint/model.glb?url';
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
  { t: 173.4, p: [0.1001, 0.3399, -34.0001], yaw: 154.88, pitch: 0, roll: 69.89, fov: 82 },
  { t: 175.0, p: [0, 0.48, -34.6], yaw: 174, pitch: 2, roll: 58, fov: 86 },
  { t: 176.0, p: [0, 1.6, -35.8], yaw: 0, pitch: 0, roll: 0, fov: 86 },
  { t: 181.0, p: [0, 1.6, -63.0], yaw: -7, pitch: -16, roll: -2, fov: 88 },
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
  if ((t >= 168.2 && t < 172) || (t >= 176 && t < 186)) return 'run';
  if (t >= 158 && t < 163) return 'walk';
  if (t >= COLD_OPEN_REPLAY.z7BeamDead && t < 174.55) return 'holdBreath';
  return 'still';
}

const REPLAY_Z_OFFSET = -28.5;
// Literal 170.1 avoids floating-point drift in z7Start-z0Start; exact equality gates the join frame.
const REPLAY_T_OFFSET = 170.1;
function replayPoseAt(t: number) {
  const local = clamp(t - REPLAY_T_OFFSET, 0, 4);
  const p = coldOpenPose(local);
  return {
    ...p,
    pos: [p.pos[0], p.pos[1], p.pos[2] + REPLAY_Z_OFFSET] as [number, number, number],
    target: [p.target[0], p.target[1], p.target[2] + REPLAY_Z_OFFSET] as [number, number, number],
  };
}

const JOIN_POSE = coldOpenPose(COLD_OPEN_REPLAY.z0Start);
const JOIN_Z = JOIN_POSE.pos[2] + REPLAY_Z_OFFSET;
const SPRINT_T0 = 168.0;
const SPRINT_T1 = COLD_OPEN_REPLAY.z7Start;
let SPRINT_SPEED = 8;
const SPRINT_SAMPLES = 160;
const SPRINT_RAMP = 0.2;
const SPRINT_WEAVE = 0.22;
const sprintTable: { u: number; x: number; z: number; d: number }[] = [];
{
  let d = 0;
  let px = 0;
  let pz = -13;
  for (let i = 0; i <= SPRINT_SAMPLES; i++) {
    const u = i / SPRINT_SAMPLES;
    const x = SPRINT_WEAVE * Math.sin(Math.PI * 4 * u) * Math.sin(Math.PI * u) + JOIN_POSE.pos[0] * u;
    const z = lerp(-13, JOIN_Z, u);
    if (i) d += Math.hypot(x - px, z - pz);
    sprintTable.push({ u, x, z, d });
    px = x; pz = z;
  }
  SPRINT_SPEED = sprintTable[SPRINT_SAMPLES]!.d / (SPRINT_T1 - SPRINT_T0 - 0.5 * SPRINT_RAMP);
}
function sprintDistanceAt(t: number) {
  // Shaped arc-length ramp: fast through the body of the sprint, then continuous
  // into the finite-difference speed of the exact replay at local z0=1.2. The
  // replay itself is immutable, so the custom approach absorbs its run-up shape.
  const u = clamp((t - SPRINT_T0) / (SPRINT_T1 - SPRINT_T0));
  const shaped = u;
  return sprintTable[SPRINT_SAMPLES]!.d * shaped;
}
function sprintPoint(t: number) {
  const targetD = clamp(sprintDistanceAt(t), 0, sprintTable[SPRINT_SAMPLES]!.d);
  let hi = SPRINT_SAMPLES;
  while (hi > 0 && sprintTable[hi]!.d > targetD) hi--;
  const a = sprintTable[hi]!;
  const b = sprintTable[Math.min(SPRINT_SAMPLES, hi + 1)]!;
  const q = b.d > a.d ? (targetD - a.d) / (b.d - a.d) : 0;
  return { x: lerp(a.x, b.x, q), z: lerp(a.z, b.z, q) };
}
function poseFromYawPitch(base: ReturnType<typeof poseAt>, pos: [number, number, number], yaw: number, pitch: number, roll: number, fov: number): ReturnType<typeof poseAt> {
  const cp = Math.cos(pitch);
  const forward = [Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp] as [number, number, number];
  const right = [Math.cos(yaw), 0, Math.sin(yaw)] as [number, number, number];
  return { ...base, pos, forward, right, up: base.up, roll, fov, target: [pos[0] + forward[0], pos[1] + forward[1], pos[2] + forward[2]] as [number, number, number] };
}

export function z7PoseAt(t: number) {
  if (t >= COLD_OPEN_REPLAY.z7Start && t <= COLD_OPEN_REPLAY.z7BeamDead) return replayPoseAt(t);
  if (t >= SPRINT_T0 && t < SPRINT_T1) {
    const base = poseAt(t, z7Gait(t));
    const sp = sprintPoint(t);
    const u = clamp((t - SPRINT_T0) / (SPRINT_T1 - SPRINT_T0));
    const pos: [number, number, number] = [sp.x, lerp(1.6, JOIN_POSE.pos[1], u), sp.z];
    const lookback = smooth((t - 168.0) / 0.65) * (1 - smooth((t - 169.25) / 0.75));
    const secondGlance = smooth((t - 169.95) / 0.6) * (1 - smooth((t - 170.95) / 0.3));
    const yaw = Math.PI * lookback + Math.PI * secondGlance;
    const targetYaw = Math.atan2(JOIN_POSE.forward[0], -JOIN_POSE.forward[2]);
    const yawForward = targetYaw * smooth((u - 0.86) / 0.14);
    const pitch = lerp(0, Math.asin(JOIN_POSE.forward[1]), u);
    const fov = lerp(84 + 4 * smooth((t - 168.2) / 0.3), JOIN_POSE.fov, smooth((t - 170.55) / 0.45));
    const stumble = smooth((t - 171.12) / 0.035) * (1 - smooth((t - 171.255) / 0.04));
    const stumbleSeed = Math.sin((t - 170.38) * 31.0);
    pos[1] -= 0.13 * stumble * (0.72 + 0.28 * Math.sin((t - 170.38) * 17.0));
    const roll = lerp(0, JOIN_POSE.roll, u) + 2 * Math.PI / 180 * Math.sin(Math.PI * u)
      + stumble * (0.13 * stumbleSeed + 0.055 * Math.sin((t - 170.38) * 47.0));
    // The whip is motivated by the overhead lunge: the camera tilts up into the
    // passing mass, then whips after it as it lands behind. This keeps the exchange
    // visible instead of reading as an empty-aisle teleport frame.
    const overheadPitch = 0.78 * smooth((t - 167.55) / 0.28) * (1 - smooth((t - 168.02) / 0.24));
    const lookbackPitch = 0.12 * lookback;
    const stumbledPitch = pitch + overheadPitch + lookbackPitch - stumble * (0.19 + 0.035 * Math.sin((t - 170.38) * 23.0));
    return poseFromYawPitch(base, pos, yaw + yawForward, stumbledPitch, roll, fov);
  }
  if (t >= 149.5 && t < 163) {
    // T6 handoff: z6 pre-decays into the doorway, then z7 keeps a very small
    // forward push instead of stepping to a dead stop. The 60cm impulse is
    // compositionally imperceptible but makes the 50ms velocity samples continuous.
    const base = poseAt(t, z7Gait(t));
    const dt = Math.max(0, t - 149.5);
    const v0 = 1.15;
    const tau = 1.0;
    const push = -v0 * tau * (1 - Math.exp(-dt / tau));
    const pos: [number, number, number] = [base.pos[0], base.pos[1], base.pos[2] + push];
    return { ...base, pos, target: [pos[0] + base.forward[0], pos[1] + base.forward[1], pos[2] + base.forward[2]] as [number, number, number] };
  }
  return poseAt(t, z7Gait(t));
}

export default class ThresholdZ7Cathedral extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(80, 16 / 9, 0.08, 280);
  private flash = new FlashlightRig();
  private machineBodies!: THREE.InstancedMesh;
  private machineFronts!: THREE.InstancedMesh;
  private machineFrames!: THREE.InstancedMesh;
  private machineCarcasses?: THREE.InstancedMesh;
  private machineShelves?: THREE.InstancedMesh;
  private machineProducts?: THREE.InstancedMesh;
  private machineData: { x: number; y: number; z: number; side: number; row: number; lev: number; seed: number }[] = [];
  private heroMachinesL?: GLTFInstance;
  private heroMachinesR?: GLTFInstance;
  private tenantArmInst?: GLTFInstance;
  private tenantInst?: GLTFInstance;
  private lintInst?: GLTFInstance;
  private lintMats: THREE.MeshStandardMaterial[] = [];
  private replayArm = new THREE.Group();
  private replayHeroMachines = new THREE.Group();
  private replayMachines?: THREE.InstancedMesh;
  private replayPanels?: THREE.InstancedMesh;
  private replayMachineMat?: THREE.MeshStandardMaterial;
  private replayPanelMat?: THREE.MeshStandardMaterial;
  private replayVents?: THREE.InstancedMesh;
  private replayEnvironment = new THREE.Group();
  private replayFloorMat?: THREE.MeshStandardMaterial;
  private replayAmbient?: THREE.HemisphereLight;
  private replayReflectionMats: THREE.MeshBasicMaterial[] = [];
  private baseAmbient?: THREE.AmbientLight;
  private tenant = new THREE.Group();
  private tenantRevealKey?: THREE.PointLight;
  private tenantRevealFill?: THREE.PointLight;
  private tenantPursuitLight?: THREE.PointLight;
  private reachArm = new THREE.Group();
  private lint = new THREE.Group();
  private assembly: { mesh: THREE.Object3D; start: THREE.Vector3; end: THREE.Vector3; seed: number; chain: 'spine' | 'rib' | 'limb' | 'head' }[] = [];
  private assemblyShadowMat?: THREE.MeshBasicMaterial;
  private rift!: THREE.Mesh;
  private riftEdges: THREE.Mesh[] = [];
  private riftTeeth: { mesh: THREE.Mesh; side: number; seed: number; z: number }[] = [];
  private riftGlows: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; seed: number; z: number }[] = [];
  private shaftLights: THREE.MeshBasicMaterial[] = [];
  private fallDebris: { mesh: THREE.Mesh; seed: number; baseY: number }[] = [];
  private shaftMachines: { group: THREE.Group; seed: number; baseY: number; baseZ: number; baseX: number; speed: number; orient: number }[] = [];
  private shaftCamLight?: THREE.PointLight;
  private topplingMachines: { group: THREE.Group; seed: number; start: number; baseX: number; baseZ: number; baseYaw: number; toppleDir: number }[] = [];
  private riftDebris: { mesh: THREE.Object3D; seed: number; start: number; baseX: number; baseY: number; baseZ: number }[] = [];
  private z7DetailObjects: THREE.Object3D[] = [];
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


  private productMaterial(base: string, accent: string, seed: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const g = canvas.getContext('2d')!;
    g.fillStyle = base;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = accent;
    g.fillRect(0, 8 + Math.floor(hash(seed) * 12), 64, 12);
    g.fillStyle = 'rgba(255,244,210,0.88)';
    g.fillRect(7, 28, 50, 17);
    g.fillStyle = 'rgba(25,18,14,0.75)';
    for (let i = 0; i < 5; i++) g.fillRect(11 + i * 8, 32 + (i % 2) * 3, 5, 2);
    g.fillStyle = 'rgba(255,255,255,0.24)';
    for (let i = 0; i < 9; i++) g.fillRect(Math.floor(hash(seed + i * 2) * 62), Math.floor(hash(seed + i * 3) * 62), 2, 1);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.disposables.push(tex);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.48, metalness: 0.04, emissive: 0x1a1008, emissiveIntensity: 0.38, map: tex });
    this.disposables.push(mat);
    return mat;
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

  private async buildTenant() {
    // Full production Tenant: zone materials collage, stable pivots for stop-start head/arm motion.
    this.tenantInst = await GLTFManager.instantiate(tenantFullUrl, { castShadow: true, receiveShadow: true });
    const materialClones = new Map<THREE.Material, THREE.Material>();
    this.tenantInst.root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const cloned = mats.map((m) => {
        let c = materialClones.get(m);
        if (!c) {
          c = m.clone();
          c!.name = m.name;
          materialClones.set(m, c!);
          this.tenantInst!.ownedMaterials.push(c!);
        }
        return c!;
      });
      obj.material = Array.isArray(obj.material) ? cloned : cloned[0]!;
    });
    this.tenant.add(this.tenantInst.root);
    this.tenantInst.root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!(m instanceof THREE.MeshStandardMaterial)) continue;
        if (m.name === 'TenantPoolTile') { m.emissive.setHex(0x09262c); m.emissiveIntensity = 0.18; }
        if (m.name === 'TenantChrome') { m.emissive.setHex(0x263746); m.emissiveIntensity = 0.52; }
        if (m.name === 'TenantRibcageGlass') { m.emissive.setHex(0x164b59); m.emissiveIntensity = 0.16; }
      }
    });
    const chestGlow = new THREE.PointLight(0x5bb9d7, 3.2, 6.5, 1.55);
    chestGlow.position.set(0, 2.8, 0.65);
    const rim = new THREE.PointLight(0x83cfff, 4.0, 7.5, 1.5);
    rim.position.set(-0.8, 3.7, -1.0);
    const skullGlow = new THREE.PointLight(0xffd7a0, 3.0, 3.2, 1.35);
    skullGlow.position.set(0, 2.5, -1.25);
    this.tenant.add(chestGlow, rim, skullGlow);
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
    productRed.emissive.setHex(0x32100c); productRed.emissiveIntensity = 0.35;
    productTeal.emissive.setHex(0x0b3030); productTeal.emissiveIntensity = 0.35;
    paper.emissive.setHex(0x2c2112); paper.emissiveIntensity = 0.25;
    chrome.emissive.setHex(0x182a34); chrome.emissiveIntensity = 0.28;

    // Polished black nave floor and central aisle slab.
    const cathedralFloor = this.box(this.s, [31, 0.12, 210], [0, -0.06, -98], floorMat);
    this.z7DetailObjects.push(cathedralFloor);
    const aisleSlab = this.box(this.s, [5.4, 0.025, 210], [0, 0.015, -98], this.mat(0x090c11, 0.12, 0.55));
    this.z7DetailObjects.push(aisleSlab);

    // Long fluorescent reflections in the polished black stone: raster lights cannot
    // self-reflect, so thin additive streaks mirror the machine-wall rhythm down the aisle.
    const reflMat = new THREE.MeshBasicMaterial({ color: 0x2d7fc5, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false });
    const reflWarmMat = new THREE.MeshBasicMaterial({ color: 0xb67535, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false });
    this.disposables.push(reflMat, reflWarmMat);
    for (let i = 0; i < 54; i++) {
      const z = -4 - i * 3.25;
      if (z < -112) continue;
      for (const side of [-1, 1]) {
        const x = side * (1.85 + hash(i + side) * 0.55);
        const len = 1.8 + hash(i * 3.3) * 3.8;
        const strip = this.box(this.s, [0.045 + hash(i) * 0.12, 0.004, len], [x, 0.033 + i * 0.00002, z - len * 0.35], i % 5 === 0 ? reflWarmMat : reflMat);
        strip.castShadow = false;
        strip.receiveShadow = false;
        this.z7DetailObjects.push(strip);
      }
    }

    // Broad uneven machine-light sheen across the polished nave floor. Unlike the
    // discrete lane-like streaks, this low-frequency reflected wash is what lifts the
    // pursuit floor out of crushed black while remaining motivated by the lit cabinets.
    const sheenCanvas = document.createElement('canvas');
    sheenCanvas.width = 256; sheenCanvas.height = 1024;
    const sg = sheenCanvas.getContext('2d')!;
    sg.clearRect(0, 0, 256, 1024);
    for (let band = 0; band < 64; band++) {
      const x = 28 + hash(band * 2.9) * 200;
      const y = hash(band * 4.1) * 1024;
      const w = 18 + hash(band * 5.3) * 68;
      const len = 65 + hash(band * 7.7) * 190;
      const warm = band % 6 === 0;
      const grad = sg.createLinearGradient(x, y, x, y + len);
      grad.addColorStop(0, warm ? 'rgba(190,105,42,0)' : 'rgba(72,160,230,0)');
      grad.addColorStop(0.45, warm ? 'rgba(190,105,42,0.11)' : 'rgba(72,160,230,0.13)');
      grad.addColorStop(1, warm ? 'rgba(190,105,42,0)' : 'rgba(72,160,230,0)');
      sg.fillStyle = grad;
      sg.fillRect(x - w * 0.5, y, w, len);
    }
    const sheenTex = new THREE.CanvasTexture(sheenCanvas);
    sheenTex.colorSpace = THREE.SRGBColorSpace;
    sheenTex.wrapS = THREE.ClampToEdgeWrapping;
    sheenTex.wrapT = THREE.RepeatWrapping;
    const sheenMat = new THREE.MeshBasicMaterial({ map: sheenTex, transparent: true, opacity: 0.17, blending: THREE.AdditiveBlending, depthWrite: false });
    const sheenGeo = new THREE.PlaneGeometry(5.1, 150);
    const sheen = new THREE.Mesh(sheenGeo, sheenMat);
    sheen.rotation.x = -Math.PI / 2;
    sheen.position.set(0, 0.037, -82);
    sheen.castShadow = sheen.receiveShadow = false;
    this.s.add(sheen);
    this.z7DetailObjects.push(sheen);
    this.disposables.push(sheenTex, sheenMat, sheenGeo);

    // Stacked vending-machine walls as instanced hard-surface bodies plus glowing glass fronts.
    const rows = 62;
    const levels = 18;
    const count = rows * levels * 2;
    const bodyGeo = new THREE.BoxGeometry(0.14, 2.02, 2.34);
    const frontGeo = new THREE.BoxGeometry(0.035, 1.65, 1.9);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.46, metalness: 0.62, emissive: 0x04101a, emissiveIntensity: 0.34 });
    const frontCanvas = document.createElement('canvas');
    frontCanvas.width = 64; frontCanvas.height = 128;
    const fg = frontCanvas.getContext('2d')!;
    fg.fillStyle = '#9fd2e8'; fg.fillRect(0, 0, 64, 128);
    for (let scratch = 0; scratch < 18; scratch++) {
      const sx = Math.floor(hash(scratch * 3.1) * 58);
      const sy = Math.floor(hash(scratch * 5.7) * 112);
      fg.fillStyle = scratch % 3 ? 'rgba(255,255,255,0.13)' : 'rgba(15,34,45,0.18)';
      fg.fillRect(sx, sy, 1 + Math.floor(hash(scratch) * 3), 7 + Math.floor(hash(scratch * 7) * 28));
    }
    fg.fillStyle = 'rgba(255,255,255,0.22)'; fg.fillRect(4, 0, 5, 128);
    fg.fillStyle = 'rgba(8,22,31,0.24)'; fg.fillRect(54, 0, 4, 128);
    const frontTex = new THREE.CanvasTexture(frontCanvas);
    frontTex.colorSpace = THREE.SRGBColorSpace;
    const frontMat = new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, map: frontTex, roughness: 0.13, metalness: 0.03, transparent: true, opacity: 0.28, depthWrite: false, emissive: 0x1c5a78, emissiveIntensity: 0.78, side: THREE.DoubleSide });
    this.disposables.push(frontTex);
    this.disposables.push(bodyGeo, frontGeo, bodyMat, frontMat);
    this.machineBodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
    this.machineFronts = new THREE.InstancedMesh(frontGeo, frontMat, count);
    this.machineBodies.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.machineFronts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    const frameGeo = new THREE.BoxGeometry(1, 1, 1);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x080d13, roughness: 0.42, metalness: 0.68 });
    this.disposables.push(frameGeo, frameMat);
    this.machineFrames = new THREE.InstancedMesh(frameGeo, frameMat, count * 7);
    const carcassMat = new THREE.MeshStandardMaterial({ color: 0x18222b, roughness: 0.42, metalness: 0.66, emissive: 0x03080d, emissiveIntensity: 0.1 });
    this.disposables.push(carcassMat);
    this.machineCarcasses = new THREE.InstancedMesh(frameGeo, carcassMat, count * 5);
    let k = 0;
    let frameIndex = 0;
    let carcassIndex = 0;
    const wallX = (side: number, r: number, lev: number) => {
      const depthBand = r % 14 < 2 ? 0.9 : r % 14 < 6 ? 0.3 : r % 14 < 10 ? -0.15 : 0.45;
      return side * (14.05 + 0.28 * hash(lev * 13 + r) + 0.22 * Math.sin(r * 0.73 + lev * 0.19) - depthBand);
    };
    const structuralVoid = (_r: number, _lev: number) => false;
    const wallZ = (r: number, lev: number) => -2.5 - r * 3.25 + (hash(r * 7 + lev) - 0.5) * 0.08;
    const setFramePiece = (x: number, y: number, z: number, sx: number, sy: number, sz: number, hidden: boolean) => {
      this.tmpP.set(x, y, z);
      this.tmpS.set(hidden ? 0.0001 : sx, hidden ? 0.0001 : sy, hidden ? 0.0001 : sz);
      this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
      this.machineFrames.setMatrixAt(frameIndex++, this.tmpM);
    };
    const setCarcassPiece = (x: number, y: number, z: number, sx: number, sy: number, sz: number, hidden: boolean) => {
      this.tmpP.set(x, y, z);
      this.tmpS.set(hidden ? 0.0001 : sx, hidden ? 0.0001 : sy, hidden ? 0.0001 : sz);
      this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
      this.machineCarcasses!.setMatrixAt(carcassIndex++, this.tmpM);
    };
    for (const side of [-1, 1]) {
      for (let r = 0; r < rows; r++) {
        for (let lev = 0; lev < levels; lev++) {
          const z = wallZ(r, lev);
          const y = 1.1 + lev * 2.45;
          const x = wallX(side, r, lev);
          const heroCovered = side === -1 && r <= 2 && lev === 0;
          const missing = hash(k * 23.1 + 4.7) > 0.948;
          const damaged = hash(k * 17.9 + 1.3) > 0.86;
          const ajar = !heroCovered && !missing && lev < 4 && hash(k * 31.7 + 2.4) > 0.86;
          const hidden = heroCovered || missing || structuralVoid(r, lev);
          const depthScale = (1.22 + 0.04 * hash(k)) * (damaged ? 0.95 : 1);
          const heightScale = damaged ? 0.9 : 1;
          const widthScale = 1.18 + 0.05 * hash(k * 2);
          const depth = 0.9 * depthScale;
          const height = 2.08 * heightScale;
          const width = 2.42 * widthScale;
          const frontX = x - side * 0.48 * depthScale;
          const backX = x + side * 0.43 * depthScale;
          const midX = (frontX + backX) * 0.5;
          this.tmpQ.identity();
          this.tmpP.set(backX, y, z);
          this.tmpS.set(hidden ? 0.0001 : depthScale, hidden ? 0.0001 : heightScale, hidden ? 0.0001 : widthScale);
          this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
          this.machineBodies.setMatrixAt(k, this.tmpM);
          // Hollow manufactured shell: side walls, top/bottom caps and rear backing are
          // separate shaded volumes, so oblique wall reads as carcass depth not a card.
          setCarcassPiece(midX, y, z - width * 0.5, depth, height, 0.085, hidden);
          setCarcassPiece(midX, y, z + width * 0.5, depth, height, 0.085, hidden);
          setCarcassPiece(midX, y + height * 0.5, z, depth, 0.095, width, hidden);
          setCarcassPiece(midX, y - height * 0.5, z, depth, 0.095, width, hidden);
          setCarcassPiece(backX, y, z, 0.09, height, width, hidden);
          this.tmpP.set(x - side * (ajar ? 0.62 : 0.48), y + 0.05, z + (ajar ? side * 0.06 : 0));
          this.tmpQ.setFromEuler(new THREE.Euler(0, ajar ? side * 0.68 : 0, 0));
          this.tmpS.set(hidden ? 0.0001 : depthScale, hidden ? 0.0001 : heightScale, hidden ? 0.0001 : widthScale);
          this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
          this.machineFronts.setMatrixAt(k, this.tmpM);
          this.tmpQ.identity();
          const fx = x - side * 0.54;
          const fy = y + 0.05;
          setFramePiece(fx, fy + 0.86, z, 0.08, 0.075, 2.05, hidden);
          setFramePiece(fx, fy - 0.86, z, 0.08, 0.075, 2.05, hidden);
          setFramePiece(fx, fy, z - 0.98, 0.08, 1.78, 0.07, hidden);
          setFramePiece(fx, fy, z + 0.98, 0.08, 1.78, 0.07, hidden);
          setFramePiece(fx - side * 0.012, fy - 0.28, z, 0.045, 0.035, 1.72, hidden);
          setFramePiece(fx - side * 0.012, fy + 0.25, z, 0.045, 0.035, 1.72, hidden);
          setFramePiece(fx - side * 0.012, fy + 0.68, z, 0.045, 0.03, 1.72, hidden);
          this.machineData.push({ x, y, z, side, row: r, lev, seed: hash(k * 3.7) });
          k++;
        }
      }
    }
    this.machineBodies.instanceMatrix.needsUpdate = true;
    this.machineFronts.instanceMatrix.needsUpdate = true;
    this.machineFrames.instanceMatrix.needsUpdate = true;
    this.machineCarcasses.instanceMatrix.needsUpdate = true;
    this.s.add(this.machineBodies, this.machineFronts, this.machineFrames, this.machineCarcasses);

    // Visible product rows inside the lower machine glass: small labelled cartons/cans
    // break the blue-grid repetition while remaining cheap instanced geometry.
    const productGeo = new THREE.BoxGeometry(0.095, 0.105, 0.15);
    const productMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.44, metalness: 0.05, emissive: 0x24150a, emissiveIntensity: 0.34 });
    this.disposables.push(productGeo, productMat);
    const productRows = 3;
    const productCount = rows * 2 * productRows * 15;
    this.machineProducts = new THREE.InstancedMesh(productGeo, productMat, productCount);
    this.machineProducts.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(productCount * 3), 3);
    const shelfGeo = new THREE.BoxGeometry(1, 1, 1);
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x53616a, roughness: 0.28, metalness: 0.72, emissive: 0x081117, emissiveIntensity: 0.16 });
    this.disposables.push(shelfGeo, shelfMat);
    this.machineShelves = new THREE.InstancedMesh(shelfGeo, shelfMat, rows * 2 * productRows * 3);
    let shelfIndex = 0;
    let pi = 0;
    const productColor = new THREE.Color();
    for (const [sideIndex, side] of [-1, 1].entries()) {
      for (let r = 0; r < rows; r++) {
        for (let lev = 0; lev < productRows; lev++) {
          const machineIndex = sideIndex * rows * levels + r * levels + lev;
          const heroCovered = side === -1 && r <= 2 && lev === 0;
          const missing = hash(machineIndex * 23.1 + 4.7) > 0.948;
          const damaged = hash(machineIndex * 17.9 + 1.3) > 0.86;
          const z0 = wallZ(r, lev);
          const x0 = wallX(side, r, lev) - side * 0.455;
          const y0 = 1.1 + lev * 2.45;
          for (let shelf = 0; shelf < 3; shelf++) {
            this.tmpP.set(x0 + side * 0.19, y0 - 0.56 + shelf * 0.43, z0);
            this.tmpQ.identity();
            const shelfHidden = heroCovered || missing || structuralVoid(r, lev);
            this.tmpS.set(shelfHidden ? 0.0001 : 0.38, shelfHidden ? 0.0001 : 0.028, shelfHidden ? 0.0001 : 1.58);
            this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
            this.machineShelves!.setMatrixAt(shelfIndex++, this.tmpM);
          }
          for (let shelf = 0; shelf < 3; shelf++) for (let col = 0; col < 5; col++) {
            const empty = heroCovered || missing || damaged || structuralVoid(r, lev) || hash(machineIndex * 7.3 + shelf * 5 + col) > 0.9;
            this.tmpP.set(x0 + side * (0.15 + hash(machineIndex + shelf * 13 + col) * 0.16), y0 - 0.48 + shelf * 0.43, z0 - 0.62 + col * 0.31 + (hash(machineIndex + col) - 0.5) * 0.035);
            this.tmpQ.setFromEuler(new THREE.Euler(0, (hash(machineIndex + shelf + col * 3) - 0.5) * 0.18, 0));
            this.tmpS.setScalar(empty ? 0.0001 : 0.75 + hash(machineIndex + col * 11) * 0.55);
            this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
            this.machineProducts.setMatrixAt(pi, this.tmpM);
            const warm = hash(machineIndex * 3.1 + col * 17 + shelf);
            productColor.setHSL(warm > 0.72 ? 0.06 : warm > 0.42 ? 0.48 : 0.58, 0.52 + warm * 0.28, 0.32 + warm * 0.28);
            this.machineProducts.setColorAt(pi, productColor);
            pi++;
          }
        }
      }
    }
    this.machineShelves.instanceMatrix.needsUpdate = true;
    this.machineProducts.instanceMatrix.needsUpdate = true;
    if (this.machineProducts.instanceColor) this.machineProducts.instanceColor.needsUpdate = true;
    this.s.add(this.machineShelves, this.machineProducts);

    // Spilled cans/packets and dark sticky floor marks beneath a few opened or broken machines.
    const spillMats = [productRed, productTeal, paper, chrome];
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? -1 : 1;
      const row = 4 + i * 4;
      const z = -2.5 - row * 3.25 + (hash(i * 5) - 0.5) * 1.1;
      const x = side * (12.55 + hash(i * 3) * 1.15);
      const stain = this.box(this.s, [0.55 + hash(i) * 0.55, 0.006, 0.22 + hash(i * 2) * 0.34], [x, 0.038, z], darkMetal, [0, hash(i) * 2.8, 0]);
      stain.castShadow = false;
      this.z7DetailObjects.push(stain);
      for (let j = 0; j < 5; j++) {
        const mat = spillMats[(i + j) % spillMats.length]!;
        const item = j % 2 === 0
          ? this.cyl(this.s, 0.045, 0.045, 0.12, [x + (hash(i * 9 + j) - 0.5) * 0.9, 0.095, z + (hash(i * 13 + j) - 0.5) * 0.75], mat, 10)
          : this.box(this.s, [0.13, 0.035, 0.18], [x + (hash(i * 9 + j) - 0.5) * 0.9, 0.065, z + (hash(i * 13 + j) - 0.5) * 0.75], mat, [0.2, hash(j + i) * 3, 0.15]);
        this.z7DetailObjects.push(item);
      }
    }

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

    // Assembly debris pieces that converge into the Tenant silhouette: labelled cartons,
    // cans and crumpled packets with visible print/barcode surfaces, not bare primitives.
    const pieceMats = [
      this.productMaterial('#8e2f24', '#e0b13e', 3),
      this.productMaterial('#1c6d73', '#d8e7d2', 7),
      this.productMaterial('#b58a35', '#692919', 11),
      this.productMaterial('#5d3376', '#d57a2c', 17),
      this.productMaterial('#294f8d', '#c8d6dd', 23),
    ];
    for (let i = 0; i < 28; i++) {
      const m = pieceMats[i % pieceMats.length]!;
      const kind = i % 4;
      const piece = kind === 0
        ? this.cyl(this.s, 0.07 + 0.025 * hash(i), 0.07 + 0.025 * hash(i), 0.19 + 0.06 * hash(i * 2), [0, -20, 0], m, 14)
        : kind === 1
          ? this.box(this.s, [0.16 + 0.06 * hash(i), 0.22 + 0.08 * hash(i * 2), 0.11 + 0.04 * hash(i * 3)], [0, -20, 0], m)
          : kind === 2
            ? this.box(this.s, [0.22 + 0.08 * hash(i), 0.035 + 0.025 * hash(i * 2), 0.16 + 0.06 * hash(i * 3)], [0, -20, 0], m, [0.18, 0.1, 0.12])
            : this.sphere(this.s, 0.09 + 0.025 * hash(i), [0, -20, 0], m, [1, 0.72, 0.88]);
      const side = i % 2 ? -1 : 1;
      const start = new THREE.Vector3(side * (11 + hash(i) * 2), 0.7 + hash(i * 2) * 1.6, -8 - hash(i * 3) * 16);
      // Directional anatomy chains: spine pieces rise in order, rib pieces plate the torso,
      // limb pieces run down each side, and head/coin pieces finish the silhouette.
      let end: THREE.Vector3;
      if (i < 8) {
        end = new THREE.Vector3((hash(i * 4) - 0.5) * 0.10, 0.72 + i * 0.31, -16.62);
      } else if (i < 14) {
        const j = i - 8;
        end = new THREE.Vector3((j % 2 ? -1 : 1) * (0.12 + 0.08 * (j % 3)), 2.12 + j * 0.17, -16.58 + (j % 2) * 0.08);
      } else if (i < 24) {
        const j = i - 14;
        const side = j % 2 ? -1 : 1;
        const step = Math.floor(j / 2);
        end = new THREE.Vector3(side * (0.34 + step * 0.075), 2.72 - step * 0.32, -16.52 + step * 0.10);
      } else {
        const j = i - 24;
        end = new THREE.Vector3((hash(i * 4) - 0.5) * 0.26, 3.28 + j * 0.15, -16.60);
      }
      const chain = i < 8 ? 'spine' as const : i < 14 ? 'rib' as const : i < 24 ? 'limb' as const : 'head' as const;
      if (chain === 'limb') start.x = Math.sign(end.x || side) * Math.abs(start.x);
      if (chain === 'spine') start.x *= 0.35;
      // Chain-weighted seeds make anatomy sort in sequence: spine first, rib plates,
      // limbs down lateral lanes, then head/coin fragments finish the silhouette.
      const seed = chain === 'spine' ? 0.05 + i * 0.012 : chain === 'rib' ? 0.28 + (i - 8) * 0.018 : chain === 'limb' ? 0.48 + (i - 14) * 0.015 : 0.68 + (i - 24) * 0.02;
      this.assembly.push({ mesh: piece, start, end, seed, chain });
      piece.scale.multiplyScalar(3.0);
      piece.userData.baseAssemblyScale = 3.0;
      piece.visible = false;
    }
    this.assemblyShadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false });
    const assemblyShadow = new THREE.Mesh(new THREE.CircleGeometry(1, 40), this.assemblyShadowMat);
    assemblyShadow.rotation.x = -Math.PI / 2;
    assemblyShadow.position.set(0, 0.035, -16.58);
    assemblyShadow.scale.set(1.35, 2.15, 1);
    this.s.add(assemblyShadow);
    this.z7DetailObjects.push(assemblyShadow);
    this.disposables.push(this.assemblyShadowMat, assemblyShadow.geometry);

    const assemblyLight = new THREE.PointLight(0x8fd7ff, 8.5, 12.5, 1.25);
    assemblyLight.position.set(0, 2.2, -13.6);
    this.s.add(assemblyLight);
    this.z7DetailObjects.push(assemblyLight);
    const assemblyWarm = new THREE.PointLight(0xff9b45, 1.9, 5.5, 1.5);
    assemblyWarm.position.set(-1.1, 0.9, -15.4);
    this.s.add(assemblyWarm);
    this.z7DetailObjects.push(assemblyWarm);
    await this.buildTenant();
    this.tenantRevealKey = new THREE.PointLight(0xa9e6ff, 0, 8.5, 1.32);
    this.tenantRevealFill = new THREE.PointLight(0xffb36b, 0, 5.5, 1.45);
    this.tenantPursuitLight = new THREE.PointLight(0x9edcff, 0, 7.5, 1.45);
    this.s.add(this.tenantPursuitLight);
    this.s.add(this.tenantRevealKey, this.tenantRevealFill);
    this.z7DetailObjects.push(this.tenantPursuitLight, this.tenantRevealKey, this.tenantRevealFill);
    this.buildReachArm();

    // Central floor rift, initially hairline and invisible, then widening.
    const rc = document.createElement('canvas');
    rc.width = 192;
    rc.height = 1024;
    const rg = rc.getContext('2d')!;
    rg.fillStyle = 'rgb(6,17,27)';
    rg.fillRect(0, 0, rc.width, rc.height);
    for (let ry = 0; ry < 1024; ry += 2) {
      for (let rx = 0; rx < 192; rx += 2) {
        const rn = hash(rx * 0.37 + ry * 0.731);
        const center = 1 - Math.abs(rx / 191 - 0.5) * 1.45;
        const v = Math.max(0, center * (0.58 + rn * 0.28));
        rg.fillStyle = `rgb(${Math.round(4 + v * 16)},${Math.round(13 + v * 30)},${Math.round(22 + v * 42)})`;
        rg.fillRect(rx, ry, 2, 2);
      }
    }
    for (let stripe = 0; stripe < 34; stripe++) {
      const sy = hash(stripe * 3.7) * 1024;
      const sx = 44 + hash(stripe * 8.1) * 104;
      rg.fillStyle = stripe % 3 ? 'rgba(70,150,190,0.24)' : 'rgba(210,125,58,0.18)';
      rg.fillRect(sx, sy, 2 + hash(stripe) * 9, 1 + hash(stripe * 2) * 4);
    }
    const riftTex = new THREE.CanvasTexture(rc);
    riftTex.colorSpace = THREE.SRGBColorSpace;
    riftTex.wrapS = THREE.ClampToEdgeWrapping;
    riftTex.wrapT = THREE.RepeatWrapping;
    riftTex.repeat.set(1, 6);
    const riftMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: riftTex });
    this.disposables.push(riftMat, riftTex);
    this.rift = this.box(this.s, [1, 0.025, 92], [0, 0.04, -92], riftMat);
    this.rift.visible = false;
    // Deep machine-light reflections inside the opening floor: sparse moving bands make
    // the 182-184 collapse readable without turning the void into a solid lit floor.
    for (let gi = 0; gi < 14; gi++) {
      const gm = new THREE.MeshBasicMaterial({ color: gi % 3 ? 0x3f9fdb : 0xff9b45, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const gz = -50 - gi * 6.1;
      const band = this.box(this.s, [0.72 + hash(gi * 3) * 0.8, 0.006, 0.16 + hash(gi) * 0.12], [(hash(gi * 7) - 0.5) * 0.5, 0.058, gz], gm);
      band.castShadow = false;
      band.receiveShadow = false;
      band.visible = false;
      this.disposables.push(gm);
      this.riftGlows.push({ mesh: band, mat: gm, seed: hash(gi * 11.7), z: gz });
    }
    const edgeMat = this.mat(0x25231f, 0.86, 0.08, 0x030302, 0.035);
    for (const side of [-1, 1]) {
      for (let seg = 0; seg < 18; seg++) {
        const seed = hash(seg * 9.17 + side * 3.3);
        const len = 1.05 + seed * 1.05;
        const z = -49.2 - seg * 4.95 + (seed - 0.5) * 0.7;
        const e = this.box(this.s, [0.15 + seed * 0.13, 0.1 + hash(seg * 4) * 0.08, len], [side * 0.55, 0.06, z], edgeMat, [(seed - 0.5) * 0.08, (seed - 0.5) * 0.18, side * (0.04 + seed * 0.08)]);
        e.visible = false;
        e.userData.side = side;
        e.userData.seed = seed;
        this.riftEdges.push(e);
      }
    }
    // Broken concrete/metal lips make the widening crack read as torn floor rather
    // than two continuous neon lane markings.
    const slabShardGeo = new THREE.CylinderGeometry(1, 1, 0.13, 3, 1, false);
    this.disposables.push(slabShardGeo);
    for (const side of [-1, 1]) {
      for (let ti = 0; ti < 24; ti++) {
        const seed = hash(ti * 17.3 + side * 5.1);
        const z = -48 - ti * 3.8 - seed * 1.2;
        const tooth = this.box(this.s, [0.26 + seed * 0.34, 0.1 + hash(ti * 3) * 0.11, 0.42 + hash(ti * 7) * 0.72], [side * 0.55, 0.08, z], edgeMat, [(seed - 0.5) * 0.12, (seed - 0.5) * 0.58, side * (0.06 + seed * 0.14)]);
        tooth.visible = false;
        this.z7DetailObjects.push(tooth);
        this.riftTeeth.push({ mesh: tooth, side, seed, z });
        if (ti % 2 === 0) {
          const shard = new THREE.Mesh(slabShardGeo, edgeMat);
          shard.position.set(side * 0.56, 0.07, z - 0.55 - seed * 0.5);
          shard.scale.set(0.18 + seed * 0.24, 1, 0.42 + hash(ti * 4.7) * 0.55);
          shard.rotation.set((seed - 0.5) * 0.16, seed * Math.PI, side * (0.08 + seed * 0.08));
          shard.castShadow = true;
          shard.receiveShadow = true;
          shard.visible = false;
          this.s.add(shard);
          this.z7DetailObjects.push(shard);
          this.riftTeeth.push({ mesh: shard, side, seed: hash(seed * 31 + ti), z: shard.position.z });
        }
      }
    }

    // Vertical fall shaft below the rift: repeating machine-light streaks and warm home glow below.
    const shaftFadeCanvas = document.createElement('canvas');
    shaftFadeCanvas.width = 32; shaftFadeCanvas.height = 32;
    const sfg = shaftFadeCanvas.getContext('2d')!;
    const grad = sfg.createLinearGradient(0, 0, 32, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.28, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(0.72, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    sfg.fillStyle = grad; sfg.fillRect(0, 0, 32, 32);
    const shaftFadeTex = new THREE.CanvasTexture(shaftFadeCanvas);
    this.disposables.push(shaftFadeTex);
    for (let i = 0; i < 52; i++) {
      const lm = new THREE.MeshBasicMaterial({ color: i % 2 ? 0x6fbaff : 0xbfe8ff, transparent: true, opacity: 0.32, alphaMap: shaftFadeTex, depthWrite: false, blending: THREE.AdditiveBlending });
      this.disposables.push(lm);
      this.shaftLights.push(lm);
      const side = i % 2 ? -1 : 1;
      this.box(this.s, [0.032, 0.7 + hash(i) * 1.35, 0.12], [side * (4.6 + hash(i * 2) * 6.4), -2 - i * 0.62, -98 - hash(i * 3) * 9], lm);
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

    // Specific falling machines, not abstract debris: cabinet carcasses with glowing
    // marquees, edge rails, glass fronts and product rows. They are staged along the
    // camera's falling path so several pass close enough to identify in one frame.
    const cabinetCanvas = document.createElement('canvas');
    cabinetCanvas.width = cabinetCanvas.height = 256;
    const cabg = cabinetCanvas.getContext('2d')!;
    cabg.fillStyle = '#17222b'; cabg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2400; i++) {
      const x = hash(i * 1.91) * 256, y = hash(i * 3.17) * 256, v = hash(i * 5.23);
      cabg.fillStyle = v < 0.58 ? `rgba(3,7,10,${0.08 + v * 0.18})` : `rgba(104,128,136,${0.035 + v * 0.06})`;
      cabg.fillRect(x, y, 1 + hash(i * 7.1) * 5, 1 + hash(i * 9.7) * 2);
    }
    for (let scratch = 0; scratch < 95; scratch++) {
      const x = hash(scratch * 4.1) * 256, y = hash(scratch * 6.3) * 256;
      cabg.strokeStyle = scratch % 3 ? 'rgba(142,154,147,0.16)' : 'rgba(5,8,9,0.28)';
      cabg.lineWidth = 0.7 + hash(scratch) * 1.2;
      cabg.beginPath(); cabg.moveTo(x, y); cabg.lineTo(x + (hash(scratch * 2) - 0.5) * 72, y + (hash(scratch * 3) - 0.5) * 12); cabg.stroke();
    }
    for (let decal = 0; decal < 9; decal++) {
      const x = 18 + hash(decal * 5.7) * 190, y = 16 + hash(decal * 8.9) * 205;
      cabg.fillStyle = decal % 3 ? 'rgba(164,73,45,0.30)' : 'rgba(53,132,145,0.28)';
      cabg.fillRect(x, y, 18 + hash(decal) * 26, 5 + hash(decal * 2) * 9);
      cabg.fillStyle = 'rgba(5,8,9,0.24)'; cabg.fillRect(x + 2, y + 2, 10 + hash(decal * 3) * 14, 2);
    }
    const cabinetTex = new THREE.CanvasTexture(cabinetCanvas);
    cabinetTex.colorSpace = THREE.SRGBColorSpace;
    cabinetTex.wrapS = cabinetTex.wrapT = THREE.RepeatWrapping;
    cabinetTex.repeat.set(1.4, 2.2);
    this.disposables.push(cabinetTex);
    const shaftGlassMat = new THREE.MeshPhysicalMaterial({ color: 0x9fdcff, roughness: 0.12, metalness: 0.04, transparent: true, opacity: 0.24, depthWrite: false, emissive: 0x145073, emissiveIntensity: 0.62, side: THREE.DoubleSide });
    const shaftWarmMat = this.mat(0x9a5a2d, 0.58, 0.05, 0x3a1605, 0.26);
    const shaftEdgeMat = new THREE.MeshBasicMaterial({ color: 0xc8f2ff });
    const shaftDarkMat = this.mat(0x071018, 0.48, 0.62, 0x02070c, 0.18);
    const shaftSideMat = this.mat(0x111923, 0.5, 0.58, 0x010305, 0.08);
    shaftSideMat.map = cabinetTex;
    shaftSideMat.bumpMap = cabinetTex;
    shaftSideMat.bumpScale = 0.018;
    const shaftTopMat = this.mat(0x1a252e, 0.43, 0.62, 0x020507, 0.1);
    shaftTopMat.map = cabinetTex;
    shaftTopMat.bumpMap = cabinetTex;
    shaftTopMat.bumpScale = 0.012;
    const shaftInnerMat = this.mat(0x020509, 0.72, 0.2);
    const shaftWearMat = this.mat(0xb69b69, 0.86, 0.02, 0x160c04, 0.08);
    const shaftProductMats = [
      this.mat(0x9a3327, 0.38, 0.04, 0x52120c, 0.68),
      this.mat(0x287d82, 0.34, 0.05, 0x0d535a, 0.72),
      this.mat(0xc0a36a, 0.56, 0.02, 0x533810, 0.62),
      this.mat(0x7d98a2, 0.3, 0.28, 0x25414d, 0.58),
    ];
    this.disposables.push(shaftGlassMat, shaftEdgeMat);
    // Light the shaft volumetrically. Cabinet faces now shade by orientation instead
    // of reading as uniform emissive printed cards.
    for (let li = 0; li < 7; li++) {
      const shaftPoint = new THREE.PointLight(li % 2 ? 0x8fd7ff : 0xffb06a, li % 2 ? 24 : 12, 11.5, 1.15);
      shaftPoint.position.set((li % 2 ? -1 : 1) * (1.7 + hash(li * 3) * 1.2), -3.8 - li * 4.3, -95.5 - (li % 3) * 3.2);
      this.s.add(shaftPoint);
      this.z7DetailObjects.push(shaftPoint);
    }
    this.shaftCamLight = new THREE.PointLight(0x9fdcff, 34, 7.5, 1.18);
    this.shaftCamLight.visible = false;
    this.s.add(this.shaftCamLight);
    this.z7DetailObjects.push(this.shaftCamLight);
    for (let i = 0; i < 38; i++) {
      const seed = hash(i * 17.31 + 4.2);
      const side = i % 2 ? -1 : 1;
      const g = new THREE.Group();
      // Stage each cabinet along the camera's actual forward ray at a staggered target
      // time. This is image-first blocking: even while the camera rolls, successive machines
      // pass through the viewed volume instead of merely existing somewhere in the shaft.
      const targetT = 186.22 + i * 0.205;
      const pose = z7PoseAt(targetT);
      const lane = i % 3;
      const ahead = lane === 0 ? 2.05 + hash(i * 5.9) * 1.15 : lane === 1 ? 4.0 + hash(i * 5.9) * 2.2 : 6.6 + hash(i * 5.9) * 3.4;
      const speed = 0.62 + seed * 0.74;
      const targetY = pose.pos[1] + pose.forward[1] * ahead + (hash(i * 11.3) - 0.5) * (lane === 0 ? 0.75 : 1.35);
      const targetZ = pose.pos[2] + pose.forward[2] * ahead + (hash(i * 13.7) - 0.5) * 0.75;
      const baseY = targetY + (targetT - 186) * speed;
      const baseZ = targetZ;
      const baseX = side * (lane === 0 ? 0.95 + hash(i * 3.7) * 0.85 : lane === 1 ? 1.35 + hash(i * 3.7) * 1.55 : 2.0 + hash(i * 3.7) * 2.4);
      const orient = lane === 0 ? 0.05 + seed * 0.12 : lane === 1 ? 0.16 + seed * 0.28 : 0.3 + seed * 0.45;
      g.position.set(baseX, baseY, baseZ);
      g.rotation.set(seed * 2.4, side * orient, (seed - 0.5) * 1.5);
      g.scale.setScalar(lane === 0 ? 1.18 + seed * 0.18 : lane === 1 ? 0.92 + seed * 0.16 : 0.72 + seed * 0.14);
      // Hollow manufactured carcass: separate side/top/bottom panels and a central
      // backing plate give real thickness during tumbling instead of a solid black slab.
      this.box(g, [0.12, 2.16, 0.88], [-0.53, 0, 0], shaftSideMat);
      this.box(g, [0.12, 2.16, 0.88], [0.53, 0, 0], shaftSideMat);
      this.box(g, [1.18, 0.13, 0.88], [0, 1.075, 0], shaftTopMat);
      this.box(g, [1.18, 0.13, 0.88], [0, -1.075, 0], shaftTopMat);
      this.box(g, [1.02, 2.0, 0.07], [0, 0, 0], shaftInnerMat);
      // Front face in local +Z: bright rim first, then recessed glass and product rows.
      this.box(g, [0.9, 1.34, 0.045], [0, 0.08, 0.435], shaftGlassMat);
      this.box(g, [1.02, 0.16, 0.06], [0, 0.98, 0.455], i % 5 === 0 ? shaftWarmMat : shaftGlassMat);
      for (const x of [-0.52, 0.52]) this.box(g, [0.035, 2.08, 0.055], [x, 0, 0.45], shaftEdgeMat);
      for (const y of [-1.02, 1.08]) this.box(g, [1.05, 0.035, 0.055], [0, y, 0.45], shaftEdgeMat);
      // Luminous corner rails on both front and back make the cabinet body countable
      // even when rotation shows rear/side rather than the product face.
      for (const x of [-0.56, 0.56]) {
        for (const z of [-0.43, 0.43]) this.box(g, [0.018, 2.16, 0.018], [x, 0, z], shaftEdgeMat);
      }
      for (const z of [-0.43, 0.43]) {
        for (const y of [-1.08, 1.08]) this.box(g, [1.1, 0.018, 0.018], [0, y, z], shaftEdgeMat);
      }
      for (let shelf = 0; shelf < 4; shelf++) {
        this.box(g, [0.78, 0.025, 0.055], [0, -0.45 + shelf * 0.3, 0.29], chrome);
        for (let col = 0; col < 4; col++) {
          if (hash(i * 31 + shelf * 7 + col) < 0.18) continue;
          const pm = shaftProductMats[(i + shelf + col) % shaftProductMats.length]!;
          this.box(g, [0.13, 0.16, 0.06], [-0.29 + col * 0.19, -0.37 + shelf * 0.3, 0.34], pm);
        }
      }
      // Rear-facing simplified face: in the chaos of the fall the viewer often sees the
      // back first. Cabinets remain identifiable instead of becoming blank black slabs.
      this.box(g, [0.9, 1.34, 0.045], [0, 0.08, -0.435], shaftGlassMat);
      this.box(g, [1.02, 0.16, 0.06], [0, 0.98, -0.455], i % 5 === 0 ? shaftWarmMat : shaftGlassMat);
      for (let shelf = 0; shelf < 4; shelf++) {
        this.box(g, [0.78, 0.025, 0.055], [0, -0.45 + shelf * 0.3, -0.29], chrome);
        for (let col = 0; col < 4; col++) {
          if (hash(i * 41 + shelf * 7 + col) < 0.18) continue;
          const pm = shaftProductMats[(i + shelf + col + 1) % shaftProductMats.length]!;
          this.box(g, [0.13, 0.16, 0.06], [-0.29 + col * 0.19, -0.37 + shelf * 0.3, -0.34], pm);
        }
      }
      this.box(g, [0.32, 0.42, 0.065], [0.28, -0.82, 0.48], darkMetal);
      this.box(g, [0.18, 0.06, 0.07], [0.28, -0.63, 0.49], shaftWarmMat);
      // Wear and manufactured panel breaks: small tape/scuff pieces and side seams keep
      // near cabinets from reading as pristine printed packaging.
      for (let w = 0; w < 3; w++) {
        const wx = (hash(i * 19 + w) - 0.5) * 0.72;
        const wy = -0.72 + w * 0.58 + (hash(i * 23 + w) - 0.5) * 0.16;
        const wz = (w % 2 ? -1 : 1) * 0.472;
        this.box(g, [0.12 + hash(i * 29 + w) * 0.14, 0.018 + hash(i * 31 + w) * 0.028, 0.012], [wx, wy, wz], shaftWearMat, [0, 0, (hash(i * 37 + w) - 0.5) * 0.45]);
      }
      for (const x of [-0.596, 0.596]) {
        for (const yy of [-0.55, 0.42]) this.box(g, [0.012, 0.018, 0.58], [x, yy, 0], chrome);
        this.box(g, [0.014, 0.42, 0.018], [x, -0.1, 0.24], chrome);
        // Side-panel manufactured evidence: faded brand band, inspection decal,
        // dented patch and scratch strips on the outer carcass rather than blank slab metal.
        const sx = x + Math.sign(x) * 0.008;
        this.box(g, [0.010, 0.18, 0.46], [sx, 0.58, 0.02], shaftProductMats[(i + (x > 0 ? 1 : 2)) % shaftProductMats.length]!);
        this.box(g, [0.011, 0.075, 0.30], [sx, 0.22, -0.18], shaftWearMat, [0, 0, 0.04 * Math.sign(x)]);
        this.box(g, [0.011, 0.32, 0.22], [sx, -0.36, 0.18], shaftDarkMat, [0, 0, -0.03 * Math.sign(x)]);
        for (let scratch = 0; scratch < 3; scratch++) {
          this.box(g, [0.012, 0.012, 0.20 + hash(i * 17 + scratch) * 0.18], [sx + Math.sign(x) * 0.003, -0.78 + scratch * 0.34, -0.22 + hash(i * 19 + scratch) * 0.38], shaftWearMat, [0, 0, (hash(i * 23 + scratch) - 0.5) * 0.35]);
        }
      }
      // A few side rails keep the object readable as a manufactured cabinet even when
      // the tumble shows a side or three-quarter rather than the lit front.
      for (const x of [-0.56, 0.56]) this.box(g, [0.045, 1.88, 0.72], [x, 0, 0], shaftSideMat);
      g.visible = false;
      this.s.add(g);
      this.z7DetailObjects.push(g);
      this.shaftMachines.push({ group: g, seed, baseY, baseZ, baseX, speed, orient });
    }

    // Falling environmental consequence: product cans, cartons, glass shards and small
    // machine fragments tumble in the shaft with the viewer instead of the fall reading as empty void.
    const debrisMats = [productRed, productTeal, paper, chrome, this.mat(0x6db7d8, 0.22, 0.08, 0x1b4c68, 0.5)];
    for (let i = 0; i < 58; i++) {
      const seed = hash(i * 12.73);
      const mat = debrisMats[i % debrisMats.length]!;
      const x = (hash(i * 3.1) - 0.5) * 3.6;
      const y = -2.5 - hash(i * 5.7) * 26.0;
      const z = -95.5 - hash(i * 7.9) * 9.0;
      const mesh = i % 5 !== 4
        ? this.cyl(this.s, 0.052 + seed * 0.02, 0.082 + seed * 0.026, 0.32 + hash(i) * 0.1, [x, y, z], mat, 14)
        : this.box(this.s, [0.12 + seed * 0.15, 0.07 + hash(i) * 0.07, 0.15 + hash(i * 2) * 0.19], [x, y, z], mat, [hash(i) * 2, hash(i * 4) * 2, hash(i * 6) * 2]);
      if (i % 5 !== 4) {
        const bandGeo = new THREE.CylinderGeometry(0.084 + seed * 0.026, 0.084 + seed * 0.026, 0.045, 14);
        const bandMat = this.mat(i % 2 ? 0xd8c9a5 : 0x3fb7c9, 0.62, 0, i % 2 ? 0x2a1608 : 0x07303a, 0.28);
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.position.y = 0.02;
        mesh.add(band);
        const neckGeo = new THREE.CylinderGeometry(0.026 + seed * 0.009, 0.044 + seed * 0.012, 0.11, 12);
        const neck = new THREE.Mesh(neckGeo, mat);
        neck.position.y = 0.2 + hash(i) * 0.05;
        mesh.add(neck);
        this.disposables.push(bandGeo, neckGeo, bandMat);
      }
      mesh.visible = false;
      this.fallDebris.push({ mesh, seed, baseY: y });
    }

    const warmGlow = this.mat(0xffbd65, 0.6, 0, 0xff9b38, 0.55);
    this.box(this.s, [4.5, 0.08, 4.5], [0, -31.2, -101.5], warmGlow);
    this.box(this.s, [5.5, 0.025, 5.5], [0, -29.98, -101.5], this.mat(0x8a5b35, 0.7));
    for (let i = 0; i < 9; i++) this.box(this.s, [5.3, 0.012, 0.025], [0, -29.94, -103.8 + i * 0.58], this.mat(0x3a2115, 0.82));
    this.box(this.s, [1.05, 0.018, 4.3], [0, -29.91, -101.4], this.mat(0x6f2521, 0.9));
    for (let i = 0; i < 5; i++) this.box(this.s, [0.86, 0.012, 0.055], [0, -29.89, -103.0 + i * 0.78], this.mat(i % 2 ? 0x28434a : 0xa56b34, 0.9));

    // Rift-collapse machine sequence: hollow cabinets are staged as a traveling wave just
    // ahead of the camera, then slide inward and drop through the widening floor crack.
    const riftGlassMat = new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, roughness: 0.18, metalness: 0.03, transparent: true, opacity: 0.13, depthWrite: false, emissive: 0x12384e, emissiveIntensity: 0.26, side: THREE.DoubleSide });
    const riftCarcassMat = this.mat(0x111923, 0.5, 0.58, 0x061522, 0.28);
    riftCarcassMat.map = cabinetTex;
    riftCarcassMat.bumpMap = cabinetTex;
    riftCarcassMat.bumpScale = 0.018;
    const riftTopMat = this.mat(0x1b2731, 0.42, 0.64, 0x07131c, 0.22);
    riftTopMat.map = cabinetTex;
    riftTopMat.bumpMap = cabinetTex;
    riftTopMat.bumpScale = 0.012;
    const riftInnerMat = this.mat(0x020509, 0.76, 0.18);
    const riftWearMat = this.mat(0xb69b69, 0.84, 0.02, 0x160c04, 0.1);
    this.disposables.push(riftGlassMat);
    const riftProductMats = [productRed, productTeal, paper, chrome, warmGlow];
    const collapsePlan: [number, number][] = [];
    for (let pair = 0; pair < 12; pair++) {
      const z = -48 - pair * 4.35;
      const start = 176.35 + pair * 0.76;
      collapsePlan.push([z, start], [z - 0.95 - hash(pair * 3.1) * 0.45, start + 0.18 + hash(pair * 5.7) * 0.12]);
    }
    collapsePlan.forEach(([z, start], i) => {
      const side = i % 2 ? -1 : 1;
      const g = new THREE.Group();
      const baseX = side * (2.02 + hash(i * 4) * 0.38);
      const baseYaw = (side > 0 ? 0 : Math.PI) + side * 0.24;
      g.position.set(baseX, 0, z);
      g.rotation.y = baseYaw;
      g.scale.setScalar(1.1 + hash(i * 6.1) * 0.08);
      const widthScale = 0.92 + hash(i * 2.3) * 0.18;
      const heightScale = 0.94 + hash(i * 3.7) * 0.14;
      // Open carcass: side walls, caps, rear skin and dark cavity are separate shaded volumes.
      this.box(g, [0.78, 1.95 * heightScale, 0.075], [0, 0.98 * heightScale, -0.50 * widthScale], riftCarcassMat);
      this.box(g, [0.78, 1.95 * heightScale, 0.075], [0, 0.98 * heightScale, 0.50 * widthScale], riftCarcassMat);
      this.box(g, [0.78, 0.085, 1.02 * widthScale], [0, 1.91 * heightScale, 0], riftTopMat);
      this.box(g, [0.78, 0.085, 1.02 * widthScale], [0, 0.06, 0], riftTopMat);
      this.box(g, [0.07, 1.86 * heightScale, 0.96 * widthScale], [0.35, 0.98 * heightScale, 0], riftCarcassMat);
      this.box(g, [0.035, 1.52 * heightScale, 0.78 * widthScale], [-0.28, 1.05 * heightScale, 0], riftInnerMat);
      // Recessed shelves and physical product rows sit in the cavity behind the glass.
      for (let shelf = 0; shelf < 4; shelf++) {
        this.box(g, [0.44, 0.03, 0.75 * widthScale], [-0.12, 0.48 * heightScale + shelf * 0.37, 0], chrome);
        for (let col = 0; col < 5; col++) {
          if (hash(i * 31 + shelf * 7 + col) < 0.16) continue;
          const mat = riftProductMats[(i + shelf + col) % riftProductMats.length]!;
          this.box(g, [0.09, 0.14 + hash(i + col) * 0.05, 0.135], [-0.18 + hash(i + shelf * 13 + col) * 0.12, 0.55 * heightScale + shelf * 0.37, -0.34 + col * 0.15], mat, [0, hash(i + col) * 0.5, 0]);
        }
      }
      // Glass front, edge rails, marquee and worn kick plate catch orientation-dependent light.
      this.box(g, [0.025, 1.48 * heightScale, 0.78 * widthScale], [-0.43, 1.04 * heightScale, 0], riftGlassMat);
      const edgeGlow = new THREE.MeshBasicMaterial({ color: i % 3 ? 0x446d86 : 0x8a5a38, transparent: true, opacity: 0.24 });
      this.disposables.push(edgeGlow);
      this.box(g, [0.035, 1.62 * heightScale, 0.035], [-0.455, 1.04 * heightScale, -0.43 * widthScale], edgeGlow);
      this.box(g, [0.035, 1.62 * heightScale, 0.035], [-0.455, 1.04 * heightScale, 0.43 * widthScale], edgeGlow);
      this.box(g, [0.04, 0.16, 0.72 * widthScale], [-0.46, 1.76 * heightScale, 0], edgeGlow);
      // Full perimeter cage: even a rear/side-first tumble reads as a deep rectangular cabinet.
      for (const x of [-0.455, 0.37]) {
        for (const zz of [-0.51 * widthScale, 0.51 * widthScale]) this.box(g, [0.024, 1.9 * heightScale, 0.024], [x, 0.98 * heightScale, zz], edgeGlow);
      }
      for (const yy of [0.055, 1.91 * heightScale]) {
        for (const zz of [-0.51 * widthScale, 0.51 * widthScale]) this.box(g, [0.82, 0.024, 0.024], [-0.04, yy, zz], edgeGlow);
        for (const x of [-0.455, 0.37]) this.box(g, [0.024, 0.024, 1.02 * widthScale], [x, yy, 0], edgeGlow);
      }
      for (let wear = 0; wear < 4; wear++) {
        this.box(g, [0.022, 0.025 + hash(i + wear) * 0.04, 0.12 + hash(i * 2 + wear) * 0.18], [-0.472, 0.22 + wear * 0.36, (hash(i * 5 + wear) - 0.5) * 0.56], riftWearMat);
      }
      // Rear service-panel cues keep the machine identifiable when the tumble exposes its back.
      for (let vent = 0; vent < 5; vent++) {
        this.box(g, [0.018, 0.018, 0.48 * widthScale], [0.392, 0.62 + vent * 0.11, 0], chrome);
      }
      this.box(g, [0.02, 0.22, 0.34], [0.397, 1.42, -0.16], i % 3 ? productTeal : productRed);
      this.box(g, [0.021, 0.09, 0.28], [0.402, 1.16, 0.18], paper);
      this.box(g, [0.022, 0.32, 0.08], [0.405, 0.98, -0.32], riftWearMat);
      const cavityLight = new THREE.PointLight(i % 3 ? 0x8fd7ff : 0xffb06a, 4.2, 4.4, 1.25);
      cavityLight.position.set(-0.16, 1.15, 0);
      g.add(cavityLight);
      this.s.add(g);
      this.z7DetailObjects.push(g);
      this.topplingMachines.push({ group: g, seed: hash(i * 9.7), start, baseX, baseZ: z, baseYaw, toppleDir: -side });
      // Loose product debris is independent of the carcass so each collapse visibly sheds contents.
      for (let j = 0; j < 5; j++) {
        const mat = riftProductMats[(i + j) % riftProductMats.length]!;
        const dx = (hash(i * 19 + j) - 0.5) * 0.55;
        const dz = (hash(i * 23 + j) - 0.5) * 0.75;
        const debris = j % 2 === 0
          ? this.cyl(this.s, 0.04, 0.04, 0.12, [baseX + dx, 0.12, z + dz], mat, 10)
          : this.box(this.s, [0.11, 0.045, 0.15], [baseX + dx, 0.08, z + dz], mat, [hash(i + j), hash(j * 3) * 2, hash(i * 7 + j)]);
        debris.visible = false;
        this.z7DetailObjects.push(debris);
        this.riftDebris.push({ mesh: debris, seed: hash(i * 41 + j * 7), start: start + 0.18 + j * 0.035, baseX: baseX + dx, baseY: 0.08 + hash(j) * 0.12, baseZ: z + dz });
      }
    });

    // Cathedral dressing: coin piles, toppled machine, cables/chains, receipt strips, altar-like change machine.
    for (let i = 0; i < 9; i++) {
      this.cyl(this.s, 0.28 + 0.1 * hash(i), 0.34 + 0.1 * hash(i), 0.05 + 0.08 * hash(i * 2), [(hash(i * 3) - 0.5) * 6, 0.04, -12 - i * 9], chrome, 16);
    }
    this.box(this.s, [1.3, 2.2, 0.8], [3.15, 0.55, -48], darkMetal, [0.25, 0.2, 1.25]);
    for (let i = 0; i < 12; i++) this.cyl(this.s, 0.015, 0.02, 5 + hash(i) * 4, [-9 + hash(i * 2) * 18, 28, -30 - i * 11], darkMetal, 6);
    for (let i = 0; i < 10; i++) {
      const flatReceipt = this.box(this.s, [0.08, 0.01, 0.55], [(hash(i * 5) - 0.5) * 4, 0.04, -15 - i * 6], paper, [0, hash(i) * 3, 0]);
      this.z7DetailObjects.push(flatReceipt);
    }
    this.box(this.s, [1.7, 2.3, 1.0], [-1.25, 1.15, -64.9], chrome);
    this.box(this.s, [1.1, 0.18, 0.04], [-1.25, 1.65, -64.35], new THREE.MeshBasicMaterial({ color: 0x9fdcff }));

    // Floor-level cathedral detail: individual coins, curled receipts, a readable change altar,
    // and the toppled machine's spilled contents. Low enough not to alter the exact replay aisle.
    const coinGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.008, 12);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xb8a56a, roughness: 0.28, metalness: 0.86, emissive: 0x3a2508, emissiveIntensity: 1.1 });
    this.disposables.push(coinGeo, coinMat);
    const coinCount = 260;
    const coins = new THREE.InstancedMesh(coinGeo, coinMat, coinCount);
    coins.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(coinCount * 3), 3);
    const coinColor = new THREE.Color();
    for (let i = 0; i < coinCount; i++) {
      const pile = i % 9;
      const spill = i >= 190;
      const cx = spill ? 2.1 + hash(i * 2) * 2.1 : (hash(pile * 3) - 0.5) * 6;
      const cz = spill ? -45.5 - hash(i * 3) * 5.5 : -12 - pile * 9;
      const r = spill ? hash(i * 5) * 1.4 : hash(i * 5) * (0.24 + 0.1 * hash(pile));
      const a = hash(i * 7) * Math.PI * 2;
      this.tmpP.set(cx + Math.cos(a) * r, 0.075 + (spill ? 0 : hash(i * 11) * 0.07), cz + Math.sin(a) * r);
      this.tmpQ.setFromEuler(new THREE.Euler((hash(i * 13) - 0.5) * 0.18, hash(i * 17) * Math.PI, (hash(i * 19) - 0.5) * 0.18));
      this.tmpS.setScalar(0.75 + hash(i * 23) * 0.5);
      this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
      coins.setMatrixAt(i, this.tmpM);
      const warm = hash(i * 29);
      coinColor.setRGB(0.42 + warm * 0.35, 0.34 + warm * 0.24, 0.16 + warm * 0.12);
      coins.setColorAt(i, coinColor);
    }
    coins.instanceMatrix.needsUpdate = true;
    if (coins.instanceColor) coins.instanceColor.needsUpdate = true;
    this.s.add(coins);
    this.z7DetailObjects.push(coins);
    const receiptMat = this.mat(0xc9c0a4, 0.94, 0, 0x17130c, 0.08);
    for (let i = 0; i < 10; i++) {
      const bx = (hash(i * 5) - 0.5) * 4;
      const bz = -15 - i * 6;
      for (let j = 0; j < 4; j++) {
        const seg = this.box(this.s, [0.075, 0.008, 0.18], [bx + j * 0.025, 0.055 + Math.sin(j / 3 * Math.PI) * 0.035, bz + j * 0.12], receiptMat, [0.1 * Math.sin(j), hash(i) * 3, 0.18 * (j - 1.5)]);
        seg.castShadow = false;
        this.z7DetailObjects.push(seg);
      }
    }
    // Change-machine altar face: coin cup, slot, buttons, invoice light and offering bowl.
    this.box(this.s, [1.28, 0.08, 0.06], [-1.25, 1.88, -64.33], this.mat(0x17242e, 0.32, 0.55, 0x2f8fc8, 0.55));
    for (let i = 0; i < 4; i++) this.cyl(this.s, 0.04, 0.04, 0.025, [-1.61 + i * 0.24, 1.42, -64.32], chrome, 16).rotation.x = Math.PI / 2;
    this.box(this.s, [0.52, 0.18, 0.12], [-1.25, 0.88, -64.29], darkMetal);
    this.cyl(this.s, 0.34, 0.26, 0.12, [-1.25, 0.13, -63.8], chrome, 24);
    // Toppled machine face, cracked glass, flap and spill trail.
    this.box(this.s, [1.05, 1.35, 0.05], [2.62, 0.86, -47.65], this.mat(0x27455b, 0.18, 0.05, 0x315f83, 0.55), [0.25, 0.2, 1.25]);
    for (let i = 0; i < 5; i++) this.box(this.s, [0.03, 0.7 - i * 0.07, 0.025], [2.48 + i * 0.08, 0.9, -47.55 - i * 0.04], chrome, [0.25, 0.2, 1.25 + i * 0.1]);
    for (let i = 0; i < 8; i++) this.box(this.s, [0.12, 0.08, 0.08], [2.15 + hash(i) * 1.7, 0.08, -45.8 - hash(i * 2) * 4.2], i % 2 ? productRed : productTeal, [hash(i) * 2, hash(i * 3) * 2, 0]);
    const spillGlint = new THREE.PointLight(0x75c9ff, 0.85, 5.2, 1.7);
    spillGlint.position.set(2.55, 1.25, -47.2);
    spillGlint.intensity = 4.0;
    const altarGlint = new THREE.PointLight(0x8fdcff, 3.2, 9.0, 1.5);
    altarGlint.position.set(-1.25, 1.7, -63.6);
    this.s.add(spillGlint, altarGlint);

    // Full-detail hero vending-machine family near the first wall walk. The instanced
    // walls carry the 200m cathedral scale; these GLB machines supply close-range door
    // edges, product slots, coils, keypads, flaps and damage/wear readable in the beam.
    const [heroL, heroR, islandA, islandB, islandC, islandD] = await Promise.all([
      GLTFManager.instantiate(vendingMachinesUrl, { castShadow: true, receiveShadow: true }),
      GLTFManager.instantiate(vendingMachinesUrl, { castShadow: true, receiveShadow: true }),
      GLTFManager.instantiate(vendingMachinesUrl, { castShadow: true, receiveShadow: true }),
      GLTFManager.instantiate(vendingMachinesUrl, { castShadow: true, receiveShadow: true }),
      GLTFManager.instantiate(vendingMachinesUrl, { castShadow: true, receiveShadow: true }),
      GLTFManager.instantiate(vendingMachinesUrl, { castShadow: true, receiveShadow: true }),
    ]);
    this.heroMachinesL = heroL;
    this.heroMachinesR = heroR;
    for (const inst of [heroL, heroR, islandA, islandB, islandC, islandD]) {
      const modules = inst.parts.get('variant_modules');
      if (modules) modules.visible = inst !== heroL && inst !== heroR && (inst === islandA || inst === islandC);
      this.s.add(inst.root);
    }
    heroL.root.position.set(-14.2, 0, -5.5);
    heroL.root.rotation.y = Math.PI / 2;
    heroR.root.position.set(14.2, 0, -12.5);
    heroR.root.rotation.y = -Math.PI / 2;
    const islandSpecs: [typeof islandA, number, number, number][] = [
      [islandA, -6.6, -32.0, Math.PI / 2 + 0.12],
      [islandB, 6.9, -58.5, -Math.PI / 2 - 0.08],
      [islandC, -7.4, -96.0, Math.PI / 2 - 0.1],
      [islandD, 6.4, -137.0, -Math.PI / 2 + 0.12],
    ];
    islandSpecs.forEach(([inst, x, z, rot], i) => {
      inst.root.position.set(x, 0, z);
      inst.root.rotation.y = rot;
      inst.root.scale.setScalar(0.92 + 0.06 * hash(i * 3.1));
      this.z7DetailObjects.push(inst.root);
      const glow = new THREE.PointLight(i % 2 ? 0xffb66d : 0x72c9ff, 0.75, 6.5, 1.65);
      glow.position.set(x * 0.92, 1.55, z - 0.6);
      this.s.add(glow);
      this.z7DetailObjects.push(glow);
    });
    // Legible spill fans at the freestanding machine islands: crushed cans, torn packets
    // and coin-like metal pieces trail inward without entering the running lane.
    const islandSpills: [number, number][] = [[-1, -32.0], [1, -58.5], [-1, -96.0]];
    islandSpills.forEach(([side, zBase], cluster) => {
      for (let j = 0; j < 9; j++) {
        const inward = 4.75 + hash(cluster * 20 + j) * 1.1;
        const x = side * inward;
        const z = zBase + (hash(cluster * 31 + j * 3) - 0.5) * 2.4 + j * 0.08;
        const mat = spillMats[(cluster + j) % spillMats.length]!;
        let item: THREE.Mesh;
        if (j % 3 === 0) {
          item = this.cyl(this.s, 0.055, 0.055, 0.16, [x, 0.075, z], mat, 12);
          item.rotation.set(Math.PI / 2, hash(j) * 0.4, hash(cluster + j) * 3.0);
        } else {
          item = this.box(this.s, [0.18 + hash(j) * 0.08, 0.025, 0.24], [x, 0.052, z], mat, [0.12, hash(cluster + j) * 3.0, 0.08]);
        }
        item.castShadow = false;
        this.z7DetailObjects.push(item);
      }
    });
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
    const replayRows = 48;
    this.replayMachines = new THREE.InstancedMesh(replayBodyGeo, this.replayMachineMat, replayRows * 2);
    this.replayPanels = new THREE.InstancedMesh(replayPanelGeo, this.replayPanelMat, replayRows * 2);
    let ri = 0;
    for (const side of [-1, 1]) for (let row = 0; row < replayRows; row++) {
      const z = -24.5 - row * 3.2;
      const h = 2.2 + 0.25 * hash(row * 2.13 + side);
      const x = side * (2.25 + 0.08 * hash(row * 4.7));
      this.tmpQ.identity();
      this.tmpP.set(x, h / 2, z);
      this.tmpS.set(row < 10 ? 0.0001 : 1, row < 10 ? 0.0001 : h / 2.2, row < 10 ? 0.0001 : 1);
      this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
      this.replayMachines.setMatrixAt(ri, this.tmpM);
      this.replayMachines.setColorAt(ri, new THREE.Color().setHSL(0.52 + 0.18 * hash(row + side * 11), 0.42, 0.19));
      this.tmpP.set(x - side * 0.44, 1.18 * (h / 2.2), z - 0.02);
      this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
      this.replayPanels.setMatrixAt(ri, this.tmpM);
      this.replayPanels.setColorAt(ri, new THREE.Color().setHSL(row % 5 === 0 ? 0.08 : 0.53, 0.9, row % 5 === 0 ? 0.55 : 0.46));
      ri++;
    }
    this.replayMachines.instanceMatrix.needsUpdate = true;
    this.replayPanels.instanceMatrix.needsUpdate = true;
    if (this.replayMachines.instanceColor) this.replayMachines.instanceColor.needsUpdate = true;
    if (this.replayPanels.instanceColor) this.replayPanels.instanceColor.needsUpdate = true;
    this.replayEnvironment.add(this.replayMachines, this.replayPanels);

    // Same horizontal fascia vents as the current cold-open aisle.
    const replayVentMat = new THREE.MeshStandardMaterial({ color: 0x030609, roughness: 0.7, metalness: 0.35, emissive: 0x071923, emissiveIntensity: 0.32 });
    const replayVentGeom = new THREE.BoxGeometry(0.018, 0.035, 0.34);
    this.disposables.push(replayVentMat, replayVentGeom);
    this.replayVents = new THREE.InstancedMesh(replayVentGeom, replayVentMat, replayRows * 2 * 4);
    let vi = 0;
    for (const side of [-1, 1]) for (let row = 0; row < replayRows; row++) {
      const z = -24.5 - row * 3.2;
      const h = 2.2 + 0.25 * hash(row * 2.13 + side);
      const x = side * (2.25 + 0.08 * hash(row * 4.7)) - side * 0.455;
      for (let slot = 0; slot < 4; slot++) {
        this.tmpP.set(x, (0.66 + slot * 0.18) * (h / 2.2), z - 0.02);
        this.tmpS.set(row < 10 ? 0.0001 : 1, row < 10 ? 0.0001 : 1, row < 10 ? 0.0001 : 1);
        this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
        this.replayVents.setMatrixAt(vi++, this.tmpM);
      }
    }
    this.replayVents.instanceMatrix.needsUpdate = true;
    this.replayEnvironment.add(this.replayVents);

    // Replay-only floor/ambient/reflection environment copied from Z0's current hook treatment.
    // It is hidden outside 171.30-173.40 so the larger cathedral floor/detail pass is untouched.
    this.replayFloorMat = new THREE.MeshStandardMaterial({ color: 0x182b3e, roughness: 0.2, metalness: 0.5, emissive: 0x061622, emissiveIntensity: 0.72 });
    this.disposables.push(this.replayFloorMat);
    const replayFloorGeo = new THREE.BoxGeometry(9, 0.12, 190);
    this.disposables.push(replayFloorGeo);
    const replayFloor = new THREE.Mesh(replayFloorGeo, this.replayFloorMat);
    replayFloor.position.set(0, -0.06, -98.5);
    replayFloor.receiveShadow = true;
    this.replayEnvironment.add(replayFloor);
    const reflGeom = new THREE.PlaneGeometry(0.28, 2.65);
    this.disposables.push(reflGeom);
    for (const side of [-1, 1]) for (let row = 0; row < 18; row++) {
      const warm = row % 5 === 0;
      const reflMat = new THREE.MeshBasicMaterial({ color: warm ? 0xffa864 : 0x58c7ff, transparent: true, opacity: warm ? 0.12 : 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
      this.replayReflectionMats.push(reflMat);
      this.disposables.push(reflMat);
      const refl = new THREE.Mesh(reflGeom, reflMat);
      refl.rotation.x = -Math.PI / 2;
      refl.position.set(side * (1.54 + 0.05 * hash(row * 3.1)), 0.012, 3.15 - row * 3.2 + REPLAY_Z_OFFSET);
      refl.scale.x = 0.55 + hash(row * 7.4) * 0.75;
      this.replayEnvironment.add(refl);
    }
    const centerReflMat = new THREE.MeshBasicMaterial({ color: 0x4b9dcc, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false });
    this.replayReflectionMats.push(centerReflMat);
    this.disposables.push(centerReflMat);
    for (let k = 0; k < 16; k++) {
      const refl = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 3.8), centerReflMat);
      refl.rotation.x = -Math.PI / 2;
      refl.position.set((hash(k * 8.3) - 0.5) * 0.55, 0.014, 1.5 - k * 8 + REPLAY_Z_OFFSET);
      this.replayEnvironment.add(refl);
    }
    this.replayAmbient = new THREE.HemisphereLight(0x456f91, 0x080606, 1.05);
    this.replayEnvironment.add(this.replayAmbient);
    this.replayEnvironment.visible = false;
    this.s.add(this.replayEnvironment);

    // Same Tenant arm GLB and placement reference as Z0; no reinterpreted proxy arm.
    this.tenantArmInst = await GLTFManager.instantiate(resolveAsset('tenant_arm', 'threshold').url, { castShadow: true, receiveShadow: true });
    this.replayArm.add(this.tenantArmInst.root);
    const machineGlint = new THREE.PointLight(0x7fc9ff, 3.2, 4.2, 1.45);
    machineGlint.position.set(-0.18, 0.18, -0.95);
    this.replayArm.add(machineGlint);
    const fingerGlint = new THREE.PointLight(0xffc28a, 6.2, 4.6, 1.55);
    fingerGlint.position.set(0.06, 0.08, -1.92);
    this.replayArm.add(fingerGlint);
    const rimGlint = new THREE.PointLight(0x9fdcff, 4.0, 4.0, 1.65);
    rimGlint.position.set(-0.36, 0.32, -1.25);
    this.replayArm.add(rimGlint);
    this.tenantArmInst.root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.name === 'shoulder_collage') obj.scale.multiplyScalar(0.72);
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!(m instanceof THREE.MeshStandardMaterial)) continue;
        if (m.name === 'TenantChrome') { m.emissive.setHex(0x243548); m.emissiveIntensity = 0.55; m.roughness = 0.16; }
        if (m.name === 'TenantPoolTile') { m.emissive.setHex(0x0b2830); m.emissiveIntensity = 0.38; }
        if (m.name === 'TenantPaper') { m.emissive.setHex(0x2a1607); m.emissiveIntensity = 0.28; }
        if (m.name === 'TenantFelt') { m.emissive.setHex(0x2a0503); m.emissiveIntensity = 0.32; }
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
    for (let k = 0; k < 18; k++) {
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
    for (let k = 0; k < 18; k++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.035, 0.06), replayStripMat);
      strip.position.set(0, 4.1, -26.5 - k * 8);
      this.s.add(strip);
    }

    // Production Lint asset for the macro relight beat.
    this.lintInst = await GLTFManager.instantiate(lintUrl, { castShadow: true, receiveShadow: true });
    this.lintInst.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const smat = mat as THREE.MeshStandardMaterial;
        if (!smat.isMeshStandardMaterial) continue;
        smat.roughness = Math.max(smat.roughness, 0.92);
        smat.metalness = 0;
        if (smat.name.includes('AbdomenWarmGlow')) {
          smat.emissive = new THREE.Color(0x5a210b);
          smat.emissiveIntensity = 0.72;
          this.lintMats.push(smat);
        } else {
          smat.emissive = new THREE.Color(0x000000);
          smat.emissiveIntensity = 0;
        }
      }
    });
    this.lint.add(this.lintInst.root);
    this.lint.visible = false;
    const lintLight = new THREE.PointLight(0xffa65a, 2.8, 3.0, 1.35);
    lintLight.position.set(0.08, 0.18, 0.18);
    this.lint.add(lintLight);
    this.s.add(this.lint);

    this.s.add(this.flash.group);

    this.baseAmbient = new THREE.AmbientLight(0x152033, 0.24);
    for (let spill = 0; spill < 8; spill++) {
      const side = spill % 2 ? 1 : -1;
      const machineSpill = new THREE.PointLight(spill % 3 ? 0x6fc9ff : 0xffa15c, 7.2, 15.5, 1.28);
      machineSpill.position.set(side * 2.4, 1.9, -24 - spill * 8.5);
      this.s.add(machineSpill);
      this.z7DetailObjects.push(machineSpill);
    }
    this.s.add(this.baseAmbient);
    const wallKey = new THREE.DirectionalLight(0x9fdcff, 0.85);
    wallKey.position.set(-5, 9, 8);
    const wallFill = new THREE.DirectionalLight(0xffb06a, 0.28);
    wallFill.position.set(6, 4, -18);
    this.s.add(wallKey, wallFill);
    this.z7DetailObjects.push(wallKey, wallFill);
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
      if (t >= 168 && t < 176) {
        const innerPassageFade = 1 - smooth((-camZ - 20) / 8);
        on *= lerp(1, 0.08, innerPassageFade);
      }
      const flick = 0.88 + 0.12 * hash(Math.floor(t * 8) + i);
      const brightness = 0.42 + 0.78 * hash(i * 11.7 + 2.0);
      const band = 0.72 + 0.28 * Math.sin(d.row * 0.83 + d.side * 0.4) + 0.1 * Math.sin(d.lev * 0.57 + d.row * 0.21);
      const structuredDead = (d.row % 13 === 8 && d.lev < 7) || (d.row % 17 === 4 && d.lev % 5 === 2);
      const broken = hash(i * 19.3 + 8.0) > 0.84 || structuredDead ? 0.1 : 1;
      const hue = hash(i * 5.1) - 0.5;
      const colorBand = Math.floor((d.row + (d.side > 0 ? 2 : 0)) / 5) % 6;
      const warm = d.row > 12 && (colorBand === 1 || hash(i * 7.7) > 0.95);
      const pale = colorBand === 3;
      const level = on * flick * brightness * broken * band * (pale ? 0.62 : 0.74);
      if (warm) frontColor.setRGB(0.12 + level * 0.98, 0.07 + level * (0.46 + hue * 0.05), 0.035 + level * 0.14);
      else if (pale) frontColor.setRGB(0.05 + level * 0.42, 0.1 + level * 0.86, 0.13 + level * 0.82);
      else frontColor.setRGB(0.06 + level * (0.48 + hue * 0.08), 0.1 + level * (0.68 + hue * 0.04), 0.15 + level * (0.94 - hue * 0.08));
      bodyColor.setRGB(0.05 + level * 0.06, 0.065 + level * 0.08, 0.085 + level * 0.11);
      this.machineFronts.setColorAt(i, frontColor);
      this.machineBodies.setColorAt(i, bodyColor);
    }
    this.machineFronts.instanceColor!.needsUpdate = true;
    this.machineBodies.instanceColor!.needsUpdate = true;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const exactReplay = t >= COLD_OPEN_REPLAY.z7Start && t <= COLD_OPEN_REPLAY.z7BeamDead;
    const pose = z7PoseAt(t);
    this.cam.near = exactReplay ? 0.04 : 0.08;
    this.cam.far = exactReplay ? 240 : 280;
    applyFirstPersonCamera(this.cam, pose, out.width / out.height);
    const dir = new THREE.Vector3(...pose.forward);

    const replayWindow = t >= COLD_OPEN_REPLAY.z7Start && t <= COLD_OPEN_REPLAY.z7BeamDead;
    for (const obj of this.z7DetailObjects) obj.visible = !replayWindow;

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
    const asm = smooth((t - 163) / 2.4);
    const showPieces = t >= 163 && t < 166.4;
    for (const a of this.assembly) {
      if (!showPieces) { a.mesh.visible = false; continue; }
      const u = clamp(asm * 1.38 - a.seed * 0.32);
      a.mesh.visible = showPieces && u > 0.002;
      if (!a.mesh.visible) continue;
      const gather = smooth(u / 0.46);
      const rise = smooth((u - 0.34) / 0.66);
      const floorY = lerp(a.start.y, 0.24 + a.seed * 0.08, gather);
      const laneSide = Math.sign(a.end.x || a.start.x || 1);
      const lateralLane = a.chain === 'limb' ? laneSide * 0.72 : a.chain === 'rib' ? laneSide * 0.28 : 0;
      const laneU = Math.sin(Math.PI * clamp(u / 0.72));
      const depthLane = a.chain === 'spine' ? -0.42 : a.chain === 'head' ? 0.32 : 0;
      const lift = a.chain === 'head' ? 0.42 : a.chain === 'rib' ? 0.22 : a.chain === 'limb' ? 0.12 : 0.08;
      a.mesh.position.set(
        lerp(a.start.x, a.end.x, gather) + lateralLane * laneU,
        lerp(floorY, a.end.y, rise) + Math.sin(Math.PI * u) * lift,
        lerp(a.start.z, a.end.z, gather) + depthLane * laneU,
      );
      // As each fragment arrives it is swallowed into the fused body instead of
      // remaining a toy-sized carton glued across the silhouette.
      const absorb = smooth((u - 0.72) / 0.24);
      a.mesh.scale.setScalar((a.mesh.userData.baseAssemblyScale ?? 3) * (1 - absorb * 0.78));
      const stepSpin = Math.floor(u * 5) / 5;
      a.mesh.rotation.set(stepSpin * (1 + a.seed) * 3.2, stepSpin * 4.4, stepSpin * 2.1);
    }

    this.machineBodies.visible = !exactReplay;
    this.machineFronts.visible = !exactReplay;
    this.machineFrames.visible = !exactReplay;
    if (this.machineCarcasses) this.machineCarcasses.visible = !exactReplay;
    if (this.machineShelves) this.machineShelves.visible = !exactReplay;
    if (this.machineProducts) this.machineProducts.visible = !exactReplay;
    if (this.heroMachinesL) this.heroMachinesL.root.visible = !exactReplay;
    if (this.heroMachinesR) this.heroMachinesR.root.visible = !exactReplay;

    // Tenant stop-start motion and pursuit position.
    const tenantVisible = t >= 165.6 && t < 175.4 && !exactReplay;
    this.tenant.visible = tenantVisible;
    if (tenantVisible) {
      const chaseK = smooth((t - 168.05) / 0.45);
      let z = -16.6;
      let x = 0.15 * Math.sin(t * 1.7);
      const handoffCamZ = z7PoseAt(168.6).pos[2];
      const landingZ = handoffCamZ + 4.25;
      // Continuous overhead lunge in two motivated phases: first the predator closes
      // in front of the runner, then it crosses the lens during the whip and lands behind.
      // Position remains continuous at every sample; there is no relocation frame.
      const preU = smooth((t - 167.2) / 0.8);
      const postU = smooth((t - 168.0) / 0.6);
      if (t >= 167.2 && t < 168.0) {
        z = lerp(-16.6, -14.7, preU);
        x = lerp(0.15 * Math.sin(t * 1.7), 0.0, preU);
      }
      if (t >= 168.0 && t < 168.6) {
        z = lerp(-14.7, landingZ, postU);
        x = lerp(0.0, 1.72, postU);
      }
      if (t >= 168.6) {
        const gain = smooth((t - 168.6) / 2.2);
        const gap = lerp(4.25, 2.0, gain);
        z = this.cam.position.z + gap;
        x = lerp(1.72, -0.42 + 0.16 * Math.sin(t * 1.9), smooth((t - 168.6) / 0.9));
      }
      const overheadU = clamp((t - 167.55) / 1.05);
      const overheadLift = Math.sin(Math.PI * overheadU) * (t >= 167.55 && t < 168.6 ? 0.78 : 0);
      // Stop-start predator language: a 30 deg head-tilt tell, then one fast 0.3 s
      // burst into the next held pose. During pursuit the same pose steps become a
      // four-beat all-fours gallop rather than continuous toylike swaying.
      const cycle = 1.55;
      const step = Math.floor(t / cycle);
      const phase = t - step * cycle;
      const poseA = hash(step * 7.13) - 0.5;
      const poseB = hash((step + 1) * 7.13) - 0.5;
      const burstU = smooth((phase - 0.82) / 0.3);
      const heldPose = lerp(poseA, poseB, burstU);
      const tell = smooth((phase - 0.48) / 0.2) * (1 - smooth((phase - 0.82) / 0.18));
      const beatClock = t * 5.2;
      const beat = Math.floor(beatClock) % 4;
      const beatFrac = beatClock - Math.floor(beatClock);
      const beatShapes = [-0.7, 0.35, 0.8, -0.25];
      const beatNow = beatShapes[beat]!;
      const beatNext = beatShapes[(beat + 1) % 4]!;
      const gallopShape = lerp(beatNow, beatNext, smooth(beatFrac / 0.35));
      const gallop = t >= 168 ? gallopShape : 0;
      const exitU = smooth((t - 174.65) / 0.55);
      this.tenant.position.set(x + exitU * 4.2, overheadLift + (t >= 168 ? 0.035 * Math.abs(gallop) : 0) + exitU * 2.2, z);
      this.tenant.rotation.x = t >= 168 ? -0.42 + 0.025 * gallop : -0.28;
      this.tenant.rotation.z = 0.045 * heldPose + (t >= 168 ? 0.018 * gallop : 0);
      this.tenant.rotation.y = t >= 168 ? lerp(Math.PI - 0.55, 0, chaseK) : Math.PI - 0.55;
      const reach = smooth((t - 172.4) / 0.8) * (1 - smooth((t - 174.0) / 0.5));
      const revealScale = t < 168 ? 1.18 : lerp(1.18, 1.26, chaseK);
      this.tenant.scale.set(revealScale * (1 + reach * 0.12) * 1.08, revealScale * 0.78, revealScale * (1 + reach * 0.35) * 1.12);
      const head = this.tenantInst?.parts.get('head');
      const armL = this.tenantInst?.parts.get('arm_l');
      const armR = this.tenantInst?.parts.get('arm_r');
      if (head) head.rotation.z = 0.52 * tell + 0.08 * heldPose;
      if (armL) armL.rotation.x = -0.05 + 0.13 * heldPose + (t >= 168 ? 0.16 * gallop : 0);
      if (armR) armR.rotation.x = 0.04 - 0.11 * heldPose - (t >= 168 ? 0.13 * gallop : 0);
    }

    if (this.assemblyShadowMat) {
      this.assemblyShadowMat.opacity = 0.46 * smooth((t - 163.2) / 0.65) * (1 - smooth((t - 168.02) / 0.2));
    }
    if (this.tenantPursuitLight) {
      const pursuitLightOn = tenantVisible && t >= 168 && t < 171.05;
      this.tenantPursuitLight.visible = pursuitLightOn;
      this.tenantPursuitLight.intensity = pursuitLightOn ? 13.5 * smooth((t - 168.02) / 0.18) * (1 - smooth((t - 170.05) / 0.85)) : 0;
      if (pursuitLightOn) this.tenantPursuitLight.position.set(this.tenant.position.x + 0.35, 2.3, this.tenant.position.z - 1.35);
    }
    const revealLight = smooth((t - 165.45) / 0.25) * (1 - smooth((t - 168.02) / 0.22));
    if (this.tenantRevealKey) {
      this.tenantRevealKey.intensity = 17.5 * revealLight;
      this.tenantRevealKey.position.set(
        pose.pos[0] + pose.forward[0] * 1.25,
        pose.pos[1] - 0.08,
        pose.pos[2] + pose.forward[2] * 1.25,
      );
    }
    if (this.tenantRevealFill) {
      this.tenantRevealFill.intensity = 5.2 * revealLight;
      this.tenantRevealFill.position.set(-0.75, 1.1, -15.25);
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
    const lintOn = t >= 173.6 && t < 176.2;
    this.lint.visible = lintOn;
    if (lintOn) {
      const right = new THREE.Vector3(...pose.right);
      const up = new THREE.Vector3(...pose.up);
      const lp = this.cam.position.clone()
        .add(dir.clone().multiplyScalar(0.48))
        .add(right.multiplyScalar(0.055))
        .add(up.multiplyScalar(-0.075));
      this.lint.position.copy(lp);
      this.lint.scale.setScalar(t < 175 ? 3.65 : 2.8);
      const lintGlow = t < 175 ? 1.75 : 0.72;
      for (const mat of this.lintMats) mat.emissiveIntensity = lintGlow;
      if (t < 175.15) {
        this.lint.quaternion.copy(this.cam.quaternion);
        this.lint.rotateY(Math.PI);
      } else {
        this.lint.rotation.set(0, 0, 0);
      }
      const flap = Math.sign(Math.sin(t * Math.PI * 12)) * 0.42;
      const wl = this.lintInst?.parts.get('wing_l');
      const wr = this.lintInst?.parts.get('wing_r');
      if (wl) wl.rotation.z = 0.35 + flap;
      if (wr) wr.rotation.z = -0.35 - flap;
    }

    // Rift opens ahead after the relit run, with edge slabs tipping outward.
    const debrisFalling = t >= 186 && t < 193.8;
    for (const d of this.fallDebris) {
      d.mesh.visible = debrisFalling;
      if (!debrisFalling) continue;
      const fallT = t - 186;
      d.mesh.position.y = d.baseY - fallT * (0.35 + d.seed * 0.45);
      d.mesh.rotation.x += 0.0; // orientation is rewritten below as a pure function of t
      d.mesh.rotation.set((d.seed * 4 + t * (0.8 + d.seed)) % (Math.PI * 2), (d.seed * 7 + t * (0.45 + d.seed * 0.4)) % (Math.PI * 2), (d.seed * 3 + t * 0.7) % (Math.PI * 2));
    }
    const riftOpen = smooth((t - 176) / 6.2);
    this.rift.visible = riftOpen > 0;
    this.rift.scale.x = Math.max(0.02, riftOpen * 4.2);
    for (const glow of this.riftGlows) {
      const wave = 0.24 + 0.76 * Math.max(0, Math.sin((t - 176) * 3.1 - (Math.abs(glow.z) - 50) * 0.19 + glow.seed));
      glow.mesh.visible = riftOpen > 0.08;
      glow.mesh.scale.x = 0.45 + riftOpen * 1.8;
      glow.mesh.position.x = (glow.seed - 0.5) * riftOpen * 2.2;
      glow.mat.opacity = riftOpen * wave * (t < 185.5 ? 0.68 : 0.34);
    }
    this.riftEdges.forEach((e) => {
      const side = (e.userData.side as number) || 1;
      const seed = (e.userData.seed as number) || 0;
      e.visible = riftOpen > 0;
      e.position.x = side * (0.4 + riftOpen * 2.2 + (seed - 0.5) * 0.18 * riftOpen);
      e.position.y = 0.055 + seed * 0.035 + riftOpen * 0.018;
      e.rotation.z = -side * riftOpen * (0.16 + seed * 0.12);
    });
    for (const tooth of this.riftTeeth) {
      tooth.mesh.visible = riftOpen > 0.025;
      tooth.mesh.position.x = tooth.side * (0.38 + riftOpen * 2.2 + (tooth.seed - 0.5) * (0.34 + riftOpen * 0.4));
      tooth.mesh.position.y = 0.065 + tooth.seed * 0.05 + riftOpen * 0.025;
      tooth.mesh.rotation.y = (tooth.seed - 0.5) * (0.3 + riftOpen * 0.45);
      tooth.mesh.rotation.z = tooth.side * (0.05 + riftOpen * (0.18 + tooth.seed * 0.16));
    }

    for (const m of this.topplingMachines) {
      const side = Math.sign(m.baseX || 1);
      const topple = smooth((t - m.start) / 1.65);
      const swallow = smooth((t - m.start - 0.38) / 1.55);
      const dropT = Math.max(0, t - m.start - 1.38);
      m.group.rotation.z = m.toppleDir * topple * (1.02 + m.seed * 0.38) + swallow * m.toppleDir * 0.34;
      m.group.rotation.x = topple * (0.16 + m.seed * 0.22) + dropT * 0.09;
      m.group.rotation.y = m.baseYaw + (m.seed - 0.5) * 0.12 * topple;
      m.group.position.x = m.baseX * (1 - 0.82 * swallow);
      m.group.position.z = m.baseZ - swallow * (0.45 + m.seed * 0.35);
      m.group.position.y = -topple * topple * (0.12 + m.seed * 0.08) - dropT * dropT * (0.42 + m.seed * 0.28);
    }
    for (const d of this.riftDebris) {
      const active = t >= d.start && t < 193.8;
      d.mesh.visible = active;
      if (!active) continue;
      const u = smooth((t - d.start) / 1.05);
      const dropT = Math.max(0, t - d.start - 1.0);
      const bounce = Math.abs(Math.sin((t - d.start) * (8.5 + d.seed * 5) + d.seed * 4)) * Math.max(0, 1 - u) * 0.16;
      d.mesh.position.x = d.baseX * (1 - 0.72 * u) + (d.seed - 0.5) * 0.28 * u;
      d.mesh.position.z = d.baseZ - u * (0.3 + d.seed * 0.45);
      d.mesh.position.y = d.baseY + bounce - dropT * dropT * (1.25 + d.seed * 0.8);
      d.mesh.rotation.x = d.seed * 3 + (t - d.start) * (3.2 + d.seed * 4);
      d.mesh.rotation.z = d.seed * 2 + (t - d.start) * (2.6 + d.seed * 3);
    }

    // Cabinets tumble as closed-form functions of fall time. They fall slower than the
    // camera, so they sweep upward past the lens while retaining readable machine fronts.
    const shaftFallT = Math.max(0, t - 186);
    for (const m of this.shaftMachines) {
      const active = t >= 185.8 && t < 193.8;
      m.group.visible = active;
      if (!active) continue;
      m.group.position.set(
        m.baseX + Math.sin((t - 186) * (0.33 + m.seed * 0.25) + m.seed * 7) * 0.28,
        m.baseY - shaftFallT * m.speed,
        m.baseZ + Math.sin((t - 186) * 0.21 + m.seed * 5) * 0.18,
      );
      m.group.rotation.set(
        m.seed * 2.4 + shaftFallT * (0.42 + m.seed * 0.58),
        Math.sign(m.baseX || 1) * m.orient + shaftFallT * (0.08 + m.seed * 0.14),
        (m.seed - 0.5) * 1.5 + shaftFallT * (0.43 + m.seed * 0.38),
      );
    }

    if (this.shaftCamLight) {
      const shaftActive = t >= 181.0 && t < 193.8;
      this.shaftCamLight.visible = shaftActive;
      this.shaftCamLight.intensity = t < 185.8 ? 24 : 34;
      if (shaftActive) {
        this.shaftCamLight.position.copy(this.cam.position);
        this.shaftCamLight.position.x += pose.forward[0] * 1.8;
        this.shaftCamLight.position.y += pose.forward[1] * 1.8 - 0.25;
        this.shaftCamLight.position.z += pose.forward[2] * 1.8;
      }
    }

    // Falling streaks slide upward past the camera as a pure function of time.
    this.shaftLights.forEach((m, i) => {
      const fall = t >= 186 && t < 192 ? (t - 186) * 4 : 0;
      m.opacity = 0.035 + 0.085 * hash(i + Math.floor((t + fall) * 5));
    });

    const replayLocal = t - REPLAY_T_OFFSET;
    this.replayEnvironment.visible = t >= 168.0 && t <= 174.55;
    if (this.baseAmbient) this.baseAmbient.intensity = exactReplay ? 0 : 0.52;
    const replayHookDim = 1 - smooth((replayLocal - 1.15) / 0.7);
    if (this.replayFloorMat) this.replayFloorMat.emissiveIntensity = lerp(0.18, 0.72, replayHookDim);
    if (this.replayAmbient) this.replayAmbient.intensity = lerp(0.62, 1.05, replayHookDim);
    for (const m of this.replayReflectionMats) m.opacity = m === this.replayReflectionMats[this.replayReflectionMats.length - 1] ? 0.13 * replayHookDim : (m.color.getHex() === 0xffa864 ? 0.12 : 0.16) * replayHookDim;
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
      const side = 0.16 * smooth((time - 2.0) / 0.65);
      const x = fwd[0] + pose.right[0] * side;
      const z = fwd[2] + pose.right[2] * side;
      const len = Math.hypot(x, fwd[1] - down, z) || 1;
      return [x / len, (fwd[1] - down) / len, z / len] as [number, number, number];
    });

    if (this.s.fog instanceof THREE.FogExp2) this.s.fog.density = exactReplay ? 0.035 : 0.012;
    if (this.s.background instanceof THREE.Color) this.s.background.setHex(exactReplay ? 0x020308 : 0x020407);

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(dead ? 0x000000 : 0x020407, 1);
    rr.clear(true, true, true);
    rr.render(this.s, this.cam);
    rr.resetState();

    if (exactReplay) {
      const replayFade = beamTime >= 3.3 ? smooth((beamTime - 3.3) / 0.12) : 0;
      return thresholdPost(beamTime, { darkness: 0.82, stress: beamTime > 1.1 ? 0.8 : 0.35, fade: replayFade });
    }
    const exposure = dead ? 0.2 : (t < 158 ? 1.85 : t >= 181 && t < 185.2 ? 2.8 : 1.82);
    return thresholdPost(t, { exposure, darkness: 0.78, stress: threat * 0.65, fade: dead ? 0.55 : 0 });
  }

  override dispose() {
    this.flash.dispose();
    this.heroMachinesL?.dispose();
    this.heroMachinesR?.dispose();
    this.tenantArmInst?.dispose();
    this.tenantInst?.dispose();
    this.lintInst?.dispose();
    this.replayMachines?.dispose();
    this.replayPanels?.dispose();
    for (const d of this.disposables) d.dispose();
    this.machineBodies?.dispose();
    this.machineFronts?.dispose();
    this.machineFrames?.dispose();
  }
}
