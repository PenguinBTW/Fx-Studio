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
import { buildOfficeLoopSet, type OfficeLoopSet } from './office_loop_set';
import { hermite1D, type ScalarKey } from './motion';

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
  { t: 212.0, p: [0.58, 1.65, -5.75], yaw: 74, pitch: -12, fov: 66 },
  { t: 214.0, p: [0.68, 1.65, -5.9], yaw: 54, pitch: -14, fov: 60 },
  { t: 216.0, p: [0.56, 1.65, -5.65], yaw: 76, pitch: -14, fov: 66 },
  { t: 218.0, p: [0.56, 1.65, -5.65], yaw: 75, pitch: -7, fov: 72 },
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

const APPROACH_KEYS = KEYS.slice(0, 16);
const APPROACH_X: ScalarKey[] = APPROACH_KEYS.map((k) => [k.t, k.p[0]]);
const APPROACH_Z: ScalarKey[] = APPROACH_KEYS.map((k) => [k.t, k.p[2]]);
export function z8PoseAt(t: number, gait?: GaitName) {
  const pose = poseAt(t, gait);
  if (t < APPROACH_KEYS[0]!.t || t > APPROACH_KEYS[APPROACH_KEYS.length - 1]!.t) return pose;
  const pos: [number, number, number] = [hermite1D(t, APPROACH_X), pose.pos[1], hermite1D(t, APPROACH_Z)];
  return {
    ...pose,
    pos,
    target: [pos[0] + pose.forward[0], pos[1] + pose.forward[1], pos[2] + pose.forward[2]] as [number, number, number],
  };
}

export default class ThresholdZ8Home extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(72, 16 / 9, 0.04, 80);
  private flash = new FlashlightRig();
  private doorGroup = new THREE.Group();
  private handle!: THREE.Mesh;
  private phoneInst?: GLTFInstance;
  private homeKit?: GLTFInstance;
  private officeLoop?: OfficeLoopSet;
  private receiver?: THREE.Object3D;
  private receiverHome = new THREE.Vector3();
  private payoffReceiver = new THREE.Group();
  private lampGlow!: THREE.MeshStandardMaterial;
  private lampLight?: THREE.PointLight;
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

    // Procedural aged wallpaper/plaster: fine grain, faint vertical print rhythm,
    // stains, chips and hairline cracks break the flat-vector beige read at close range.
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 512; wallCanvas.height = 512;
    const wg = wallCanvas.getContext('2d')!;
    wg.fillStyle = '#d8c9aa'; wg.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 64) {
      wg.fillStyle = 'rgba(72,42,22,0.58)'; wg.fillRect(x, 0, 3, 512);
      wg.fillStyle = 'rgba(255,232,178,0.48)'; wg.fillRect(x + 6, 0, 2, 512);
    }
    for (let i = 0; i < 5200; i++) {
      const x = Math.floor(hash(i * 2.17) * 512);
      const y = Math.floor(hash(i * 3.91) * 512);
      const v = hash(i * 5.33);
      wg.fillStyle = v > 0.55 ? `rgba(75,50,32,${0.22 + v * 0.28})` : `rgba(255,244,214,${0.18 + v * 0.23})`;
      wg.fillRect(x, y, 3 + Math.floor(hash(i * 7.1) * 7), 2 + Math.floor(hash(i * 9.7) * 4));
    }
    for (let i = 0; i < 20; i++) {
      const x = hash(i * 11.3) * 512;
      const y = 270 + hash(i * 13.7) * 230;
      const r = 10 + hash(i * 17.9) * 42;
      const grad = wg.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, `rgba(88,57,31,${0.13 + hash(i) * 0.14})`);
      grad.addColorStop(1, 'rgba(88,57,31,0)');
      wg.fillStyle = grad;
      wg.beginPath(); wg.arc(x, y, r, 0, Math.PI * 2); wg.fill();
    }
    for (let px = 20; px < 512; px += 42) {
      for (let py = 18; py < 512; py += 38) {
        const ox = (hash(px * 0.7 + py) - 0.5) * 10;
        const oy = (hash(px + py * 1.3) - 0.5) * 8;
        wg.strokeStyle = 'rgba(72,38,18,0.68)';
        wg.lineWidth = 2;
        wg.beginPath();
        wg.moveTo(px + ox, py - 9 + oy); wg.lineTo(px + 7 + ox, py + oy); wg.lineTo(px + ox, py + 9 + oy); wg.lineTo(px - 7 + ox, py + oy); wg.closePath();
        wg.stroke();
        wg.fillStyle = 'rgba(236,205,150,0.20)'; wg.fillRect(px - 1 + ox, py - 1 + oy, 3, 3);
      }
    }
    wg.strokeStyle = 'rgba(65,38,22,0.34)';
    wg.lineWidth = 1;
    for (let c = 0; c < 7; c++) {
      let x = 40 + hash(c * 19.1) * 430;
      let y = 20 + hash(c * 23.7) * 180;
      wg.beginPath(); wg.moveTo(x, y);
      for (let seg = 0; seg < 5; seg++) {
        x += (hash(c * 31 + seg) - 0.5) * 18;
        y += 10 + hash(c * 37 + seg) * 24;
        wg.lineTo(x, y);
      }
      wg.stroke();
    }
    const wallTex = new THREE.CanvasTexture(wallCanvas);
    wallTex.colorSpace = THREE.SRGBColorSpace;
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(1.35, 2.2);
    wallTex.anisotropy = 4;
    const cream = new THREE.MeshStandardMaterial({ map: wallTex, bumpMap: wallTex, bumpScale: 0.034, color: 0xffffff, roughness: 0.86, metalness: 0 });
    this.disposables.push(wallTex, cream);

    const wood = this.mat(0x7b4d2b, 0.55);
    const woodDark = this.mat(0x3f2415, 0.62);
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


    // Impossible right-wall window in the look-right beat: instead of outdoors it shows a
    // mustard office carpet strip, cubicle edge and fluorescent ceiling line compressed outside.
    const officeWindowGlass = this.mat(0x1a231d, 0.28, 0, 0x243822, 0.32);
    this.box(this.s, [0.035, 1.02, 1.18], [1.325, 1.55, -2.35], officeWindowGlass);
    for (const [y, z, sy, sz] of [[2.1, -2.35, 0.08, 1.34], [1.0, -2.35, 0.08, 1.34], [1.55, -2.98, 1.18, 0.08], [1.55, -1.72, 1.18, 0.08]] as const) {
      this.box(this.s, [0.045, sy, sz], [1.30, y, z], woodDark);
    }
    const wrongCarpet = this.mat(0x8a7a45, 0.9, 0, 0x6c5b25, 0.22);
    this.box(this.s, [0.025, 0.23, 1.04], [1.29, 1.12, -2.35], wrongCarpet);
    this.box(this.s, [0.026, 0.52, 0.28], [1.285, 1.48, -2.15], this.mat(0x817650, 0.9, 0, 0x51492f, 0.12));
    this.box(this.s, [0.026, 0.42, 0.24], [1.285, 1.45, -2.63], this.mat(0x746c49, 0.9, 0, 0x493f27, 0.1));
    this.box(this.s, [0.028, 0.055, 0.86], [1.275, 1.94, -2.35], this.mat(0xd8ffd0, 0.35, 0, 0xc9ffd2, 1.8));

    // A second impossible window hangs inside the living-room opening exactly where the
    // 204-206 look-right beam lands; its contents are unmistakably office carpet/cubicle/fluorescent strip.
    this.box(this.s, [0.035, 0.92, 1.08], [1.31, 1.48, -4.05], officeWindowGlass);
    this.box(this.s, [0.045, 0.08, 1.22], [1.29, 1.98, -4.05], woodDark);
    this.box(this.s, [0.045, 0.08, 1.22], [1.29, 0.98, -4.05], woodDark);
    this.box(this.s, [0.045, 1.08, 0.08], [1.29, 1.48, -4.62], woodDark);
    this.box(this.s, [0.045, 1.08, 0.08], [1.29, 1.48, -3.48], woodDark);
    this.box(this.s, [0.026, 0.22, 0.94], [1.275, 1.1, -4.05], wrongCarpet);
    this.box(this.s, [0.028, 0.48, 0.25], [1.27, 1.43, -3.86], this.mat(0x827650, 0.9, 0, 0x5b4e2f, 0.16));
    this.box(this.s, [0.028, 0.4, 0.22], [1.27, 1.4, -4.3], this.mat(0x716a49, 0.9, 0, 0x4a3f27, 0.14));
    this.box(this.s, [0.029, 0.05, 0.78], [1.265, 1.83, -4.05], this.mat(0xd8ffd0, 0.35, 0, 0xc9ffd2, 2.4));

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
    const photoTexture = (kind: string) => {
      const c = document.createElement('canvas');
      c.width = 128; c.height = 160;
      const g = c.getContext('2d')!;
      const schemes: Record<string, [string, string, string]> = {
        photo_office: ['#5c5b38', '#26351f', '#b8d8bd'],
        photo_ballpit: ['#d8c58f', '#6a1f2a', '#2b6c78'],
        photo_pool: ['#77aaa4', '#1f666b', '#d8e6d8'],
        photo_library: ['#b99c65', '#4a2c18', '#e5d0a0'],
        photo_motel: ['#4a1c22', '#111015', '#e04486'],
        photo_theatre: ['#5a1018', '#18080a', '#d89a55'],
        photo_cathedral: ['#07111e', '#123d68', '#89d7ff'],
      };
      const [bg, dark, accent] = schemes[kind] ?? schemes.photo_office!;
      g.fillStyle = bg; g.fillRect(0, 0, 128, 160);
      const grad = g.createLinearGradient(0, 0, 0, 160);
      grad.addColorStop(0, 'rgba(255,240,200,0.12)'); grad.addColorStop(1, 'rgba(0,0,0,0.42)');
      g.fillStyle = grad; g.fillRect(0, 0, 128, 160);
      g.fillStyle = dark;
      if (kind === 'photo_pool') {
        g.fillRect(0, 92, 128, 68);
        g.strokeStyle = accent; g.lineWidth = 2;
        for (let x = 8; x < 128; x += 18) { g.beginPath(); g.moveTo(x, 18); g.lineTo(x - 12, 152); g.stroke(); }
        g.strokeStyle = '#e8f2e8'; g.lineWidth = 5; g.beginPath(); g.moveTo(28, 108); g.quadraticCurveTo(64, 26, 100, 108); g.stroke();
      } else if (kind === 'photo_motel') {
        g.fillRect(45, 22, 38, 128);
        for (let i = 0; i < 5; i++) { g.fillRect(14, 28 + i * 24, 20, 14); g.fillRect(94, 28 + i * 24, 20, 14); }
        g.fillStyle = accent; g.fillRect(42, 18, 44, 5);
      } else if (kind === 'photo_theatre') {
        g.fillRect(0, 0, 30, 160); g.fillRect(98, 0, 30, 160);
        g.fillStyle = accent; g.fillRect(30, 106, 68, 8);
        g.fillStyle = '#f0c47a'; for (let i = 0; i < 5; i++) g.fillRect(38 + i * 11, 28, 4, 7);
      } else if (kind === 'photo_cathedral') {
        for (let x = 0; x < 6; x++) for (let y = 0; y < 8; y++) { g.fillStyle = (x + y) % 3 ? '#12385c' : accent; g.fillRect(12 + x * 18, 12 + y * 17, 10, 11); }
        g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 118, 128, 42);
      } else if (kind === 'photo_ballpit') {
        for (let i = 0; i < 32; i++) { g.fillStyle = ['#a72d35', '#d7a13c', '#2f7f88', '#344b9a'][i % 4]!; g.beginPath(); g.arc(12 + (i % 8) * 15, 104 + Math.floor(i / 8) * 13, 7, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = dark; g.fillRect(80, 28, 10, 78);
      } else if (kind === 'photo_library') {
        for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? dark : accent; g.fillRect(15 + i * 14, 34 - i * 2, 9, 96); }
        g.fillStyle = '#101010'; g.fillRect(53, 76, 22, 55);
      } else {
        g.fillStyle = dark; g.fillRect(0, 82, 128, 78);
        g.fillStyle = accent; for (let i = 0; i < 4; i++) g.fillRect(14 + i * 27, 20, 18, 5);
        g.fillStyle = '#111'; g.fillRect(18, 74, 92, 7);
      }
      // Tiny scale figure/animal silhouettes make the images read as photographs of places,
      // not abstract colored symbols; they remain impressionistic at frame size.
      g.fillStyle = 'rgba(12,8,6,0.78)';
      g.beginPath(); g.arc(64, 92, 5, 0, Math.PI * 2); g.fill();
      g.fillRect(60, 97, 8, 22);
      g.fillRect(56, 101, 4, 15); g.fillRect(68, 101, 4, 15);
      g.fillStyle = 'rgba(255,238,190,0.16)'; g.fillRect(0, 0, 128, 10);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      this.disposables.push(tex);
      return tex;
    };
    photoParts.forEach((part, i) => {
      const frame = cloneHomePart(part);
      if (!frame) return;
      const z = 0.8 - i * 0.78;
      frame.position.set(-1.29, 1.55, z);
      frame.rotation.y = Math.PI / 2;
      frame.rotation.x = (hash(i * 17) - 0.5) * 0.035;
      this.s.add(frame);
      const printMat = new THREE.MeshStandardMaterial({ map: photoTexture(part), roughness: 0.78, metalness: 0, color: 0xffffff });
      const printGeo = new THREE.PlaneGeometry(0.31, 0.42);
      const print = new THREE.Mesh(printGeo, printMat);
      print.position.set(-1.225, 1.55, z);
      print.rotation.y = Math.PI / 2;
      print.rotation.x = frame.rotation.x;
      this.s.add(print);
      this.disposables.push(printMat, printGeo);
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
    const switchPlate = this.box(this.s, [0.035, 0.15, 0.1], [1.28, 1.2, -5.15], this.mat(0xe8e0cd, 0.55));
    switchPlate.castShadow = true;
    const switchDetail = this.mat(0x6f604e, 0.55, 0.25);
    for (const sy of [1.15, 1.25]) {
      const screw = this.cyl(this.s, 0.006, 0.006, 0.004, [1.257, sy, -5.15], switchDetail, 12);
      screw.rotation.z = Math.PI / 2;
    }
    this.box(this.s, [0.009, 0.045, 0.022], [1.252, 1.2, -5.15], this.mat(0xf3ead7, 0.68));
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
    this.cyl(this.s, 0.06, 0.08, 1.35, [2.0, 0.68, -4.05], brass, 12);
    this.cyl(this.s, 0.38, 0.22, 0.46, [2.0, 1.42, -4.05], this.mat(0xf0d2a0, 0.8, 0, 0xffbc65, 2.2), 18);
    this.lampGlow = this.mat(0xffbd65, 0.45, 0, 0xffa640, 2.4);
    this.sphere(this.s, 0.25, [2.0, 1.42, -4.05], this.lampGlow, [1, 0.68, 1]);
    const lampPoolMat = new THREE.MeshBasicMaterial({ color: 0xff9f45, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    this.disposables.push(lampPoolMat);
    this.sphere(this.s, 0.62, [1.92, 0.045, -4.04], lampPoolMat, [1.45, 0.035, 0.9]);
    const lampLight = new THREE.PointLight(0xffa957, 1.25, 6, 1.7);
    this.lampLight = lampLight;
    lampLight.intensity = 1.75;
    lampLight.position.set(2.0, 1.45, -4.05);
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
    const doorCanvas = document.createElement('canvas');
    doorCanvas.width = 256; doorCanvas.height = 512;
    const dg = doorCanvas.getContext('2d')!;
    dg.fillStyle = '#5a321f'; dg.fillRect(0, 0, 256, 512);
    for (let x = 0; x < 256; x += 2) {
      const v = hash(x * 0.71);
      dg.fillStyle = `rgba(${42 + v * 38},${20 + v * 18},${10 + v * 10},${0.10 + v * 0.10})`;
      dg.fillRect(x, 0, 1, 512);
    }
    for (let y = 0; y < 512; y += 11) {
      const v = hash(y * 1.37);
      dg.fillStyle = `rgba(35,16,8,${0.025 + v * 0.035})`;
      dg.fillRect(0, y, 256, 1);
    }
    for (let i = 0; i < 55; i++) {
      const x = hash(i * 3.3) * 256;
      const y = hash(i * 5.9) * 512;
      dg.fillStyle = `rgba(20,10,5,${0.08 + hash(i) * 0.12})`;
      dg.fillRect(x, y, 1 + hash(i * 7) * 2, 18 + hash(i * 11) * 82);
    }
    for (let i = 0; i < 18; i++) {
      dg.fillStyle = `rgba(168,105,56,${0.08 + hash(i * 13) * 0.1})`;
      dg.fillRect(hash(i * 17) * 256, 430 + hash(i * 19) * 72, 8 + hash(i * 23) * 42, 1 + hash(i * 29) * 3);
    }
    const doorTex = new THREE.CanvasTexture(doorCanvas);
    doorTex.colorSpace = THREE.SRGBColorSpace;
    doorTex.wrapS = doorTex.wrapT = THREE.RepeatWrapping;
    doorTex.anisotropy = 4;
    const doorMat = new THREE.MeshStandardMaterial({ map: doorTex, color: 0xffffff, roughness: 0.66, metalness: 0.02 });
    this.disposables.push(doorTex, doorMat);
    this.box(this.s, [0.1, 2.15, 0.08], [1.34, 1.07, -6.36], woodDark);
    this.box(this.s, [0.1, 2.15, 0.08], [1.34, 1.07, -7.34], woodDark);
    this.box(this.s, [0.1, 0.14, 1.05], [1.34, 2.08, -6.85], woodDark);
    this.doorGroup.position.set(1.34, 0, -7.32);
    const slab = this.box(this.doorGroup, [0.08, 2.0, 0.9], [0, 1.0, 0.43], doorMat);
    slab.castShadow = true;
    // Raised panel beads, edge wear and hand-polished grime stop the slab reading as a vector rectangle.
    const doorTrimMat = this.mat(0x3c2114, 0.68, 0.02, 0x080302, 0.04);
    const doorWearMat = this.mat(0x9a6738, 0.82, 0.02, 0x1c0c04, 0.06);
    for (const yc of [0.58, 1.43]) {
      const ph = yc < 1 ? 0.58 : 0.82;
      this.box(this.doorGroup, [0.018, ph, 0.025], [-0.049, yc, 0.16], doorTrimMat);
      this.box(this.doorGroup, [0.018, ph, 0.025], [-0.049, yc, 0.70], doorTrimMat);
      this.box(this.doorGroup, [0.018, 0.025, 0.56], [-0.049, yc - ph * 0.5, 0.43], doorTrimMat);
      this.box(this.doorGroup, [0.018, 0.025, 0.56], [-0.049, yc + ph * 0.5, 0.43], doorTrimMat);
    }
    for (let chip = 0; chip < 9; chip++) {
      this.box(this.doorGroup, [0.012, 0.018 + hash(chip) * 0.035, 0.035 + hash(chip * 3) * 0.09], [-0.052, 0.08 + hash(chip * 5) * 0.38, 0.06 + hash(chip * 7) * 0.74], chip % 2 ? doorWearMat : doorTrimMat, [0, 0, (hash(chip * 11) - 0.5) * 0.3]);
    }
    this.box(this.doorGroup, [0.011, 0.19, 0.16], [-0.054, 1.0, 0.72], this.mat(0x2c170d, 0.94, 0, 0x050202, 0.02));
    this.handle = this.cyl(this.doorGroup, 0.045, 0.045, 0.12, [-0.08, 1.0, 0.78], brass, 12);
    this.handle.rotation.z = Math.PI / 2;
    this.s.add(this.doorGroup);

    // Close-range right-wall domestic detail: wainscot rail, wallpaper seams, scuffs and
    // a small enamel house-number plaque keep the phone/door payoff from landing on blank beige.
    const plaqueCanvas = document.createElement('canvas');
    plaqueCanvas.width = 128; plaqueCanvas.height = 64;
    const pg = plaqueCanvas.getContext('2d')!;
    pg.fillStyle = '#263b42'; pg.fillRect(0, 0, 128, 64);
    pg.strokeStyle = '#c49a54'; pg.lineWidth = 5; pg.strokeRect(5, 5, 118, 54);
    pg.fillStyle = '#eadfc6'; pg.font = 'bold 34px monospace'; pg.textAlign = 'center'; pg.textBaseline = 'middle'; pg.fillText('17', 64, 34);
    const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
    plaqueTex.colorSpace = THREE.SRGBColorSpace;
    const plaqueMat = new THREE.MeshStandardMaterial({ map: plaqueTex, roughness: 0.42, metalness: 0.08, emissive: 0x1a1208, emissiveIntensity: 0.18 });
    this.disposables.push(plaqueTex, plaqueMat);
    this.box(this.doorGroup, [0.018, 0.16, 0.32], [-0.055, 1.52, 0.43], plaqueMat);
    const wallTrim = this.mat(0x745039, 0.78);
    for (const [zNear, zFar] of [[2.1, -3.15], [-4.65, -6.28], [-7.42, -8.3]] as const) {
      const len = zNear - zFar;
      this.box(this.s, [0.010, 0.032, len], [1.292, 0.86, (zNear + zFar) / 2], wallTrim);
      this.box(this.s, [0.026, 0.15, len], [1.286, 0.105, (zNear + zFar) / 2], wallTrim);
    }
    const grimeCanvas = document.createElement('canvas');
    grimeCanvas.width = 256; grimeCanvas.height = 256;
    const gg = grimeCanvas.getContext('2d')!;
    gg.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 65; i++) {
      const x = 42 + hash(i * 2.7) * 172;
      const y = 35 + hash(i * 4.9) * 190;
      const rx = 8 + hash(i * 6.1) * 30;
      const ry = 4 + hash(i * 8.3) * 20;
      const grd = gg.createRadialGradient(x, y, 1, x, y, Math.max(rx, ry));
      grd.addColorStop(0, `rgba(69,43,24,${0.08 + hash(i * 9.9) * 0.13})`);
      grd.addColorStop(1, 'rgba(69,43,24,0)');
      gg.fillStyle = grd;
      gg.beginPath(); gg.ellipse(x, y, rx, ry, hash(i * 12.1) * Math.PI, 0, Math.PI * 2); gg.fill();
    }
    for (let i = 0; i < 18; i++) {
      gg.strokeStyle = `rgba(54,32,18,${0.09 + hash(i * 3) * 0.1})`;
      gg.lineWidth = 1 + hash(i * 5) * 2;
      gg.beginPath();
      const x = 35 + hash(i * 7) * 180;
      const y = 40 + hash(i * 11) * 170;
      gg.moveTo(x, y);
      gg.lineTo(x + (hash(i * 13) - 0.5) * 40, y + 20 + hash(i * 17) * 55);
      gg.stroke();
    }
    const grimeTex = new THREE.CanvasTexture(grimeCanvas);
    grimeTex.colorSpace = THREE.SRGBColorSpace;
    const grimeMat = new THREE.MeshBasicMaterial({ map: grimeTex, transparent: true, opacity: 0.55, depthWrite: false });
    this.disposables.push(grimeTex, grimeMat);
    const addWallGrime = (z: number, y: number, w: number, h: number) => {
      const geo = new THREE.PlaneGeometry(w, h);
      const mesh = new THREE.Mesh(geo, grimeMat);
      mesh.position.set(1.281, y, z);
      mesh.rotation.y = -Math.PI / 2;
      mesh.renderOrder = 2;
      this.s.add(mesh);
      this.disposables.push(geo);
    };
    addWallGrime(-6.02, 1.28, 0.78, 1.12);
    addWallGrime(-6.62, 0.64, 0.62, 0.72);
    addWallGrime(-5.28, 0.72, 0.58, 0.82);
    // Production beige phone as the wall-mounted final variant. The desk-phone axes are
    // remapped so the face/receiver point into the hallway and the keypad descends vertically.
    const phoneMount = cloneHomePart('wall_phone_mount');
    if (phoneMount) {
      const mountCanvas = document.createElement('canvas');
      mountCanvas.width = 128; mountCanvas.height = 256;
      const mg = mountCanvas.getContext('2d')!;
      mg.fillStyle = '#4b2112'; mg.fillRect(0, 0, 128, 256);
      for (let x = 0; x < 128; x += 2) {
        const v = hash(x * 1.19);
        mg.fillStyle = `rgba(${52 + v * 42},${22 + v * 18},${10 + v * 9},${0.18 + v * 0.12})`;
        mg.fillRect(x, 0, 1, 256);
      }
      for (let i = 0; i < 28; i++) {
        mg.fillStyle = `rgba(150,91,48,${0.08 + hash(i * 3) * 0.12})`;
        mg.fillRect(hash(i * 5) * 128, 205 + hash(i * 7) * 45, 3 + hash(i * 11) * 18, 1 + hash(i * 13) * 3);
      }
      const mountTex = new THREE.CanvasTexture(mountCanvas);
      mountTex.colorSpace = THREE.SRGBColorSpace;
      mountTex.wrapS = mountTex.wrapT = THREE.RepeatWrapping;
      this.disposables.push(mountTex);
      phoneMount.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh) || obj.name !== 'phone_mount_plate') return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        const cloned = mats.map((m) => {
          if (!(m instanceof THREE.MeshStandardMaterial)) return m;
          const mm = m.clone();
          mm.map = mountTex;
          mm.color.setHex(0xffffff);
          mm.roughness = 0.72;
          mm.bumpMap = mountTex;
          mm.bumpScale = 0.005;
          this.disposables.push(mm);
          return mm;
        });
        obj.material = Array.isArray(obj.material) ? cloned : cloned[0]!;
      });
      phoneMount.position.set(1.27, 1.39, -6.02);
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
    phone.position.set(1.22, 1.34, -6.02);
    // Fine molded-plastic grain and handling polish on the production phone materials.
    const phoneNoiseCanvas = document.createElement('canvas');
    phoneNoiseCanvas.width = 128; phoneNoiseCanvas.height = 128;
    const png = phoneNoiseCanvas.getContext('2d')!;
    png.fillStyle = '#808080'; png.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 950; i++) {
      const v = 104 + Math.floor(hash(i * 4.7) * 52);
      png.fillStyle = `rgb(${v},${v},${v})`;
      png.fillRect(Math.floor(hash(i * 2.1) * 128), Math.floor(hash(i * 3.9) * 128), 1, 1);
    }
    for (let i = 0; i < 20; i++) {
      png.strokeStyle = `rgba(170,170,170,${0.08 + hash(i) * 0.08})`;
      png.lineWidth = 1;
      png.beginPath();
      const x = hash(i * 5.3) * 128;
      const y = hash(i * 7.7) * 128;
      png.moveTo(x, y);
      png.lineTo(x + (hash(i * 11) - 0.5) * 28, y + (hash(i * 13) - 0.5) * 12);
      png.stroke();
    }
    const phoneNoiseTex = new THREE.CanvasTexture(phoneNoiseCanvas);
    phoneNoiseTex.wrapS = phoneNoiseTex.wrapT = THREE.RepeatWrapping;
    phoneNoiseTex.repeat.set(3, 3);
    this.disposables.push(phoneNoiseTex);
    phone.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const cloned = mats.map((m) => {
        if (!(m instanceof THREE.MeshStandardMaterial)) return m;
        const mm = m.clone();
        mm.bumpMap = phoneNoiseTex;
        mm.bumpScale = 0.006;
        mm.roughness = Math.max(mm.roughness, 0.58);
        return mm;
      });
      obj.material = Array.isArray(obj.material) ? cloned : cloned[0]!;
    });
    this.s.add(phone);
    this.receiver = this.phoneInst.parts.get('receiver');
    if (this.receiver) this.receiverHome.copy(this.receiver.position);
    // Wallplate screws, plaster shadows and handling wear around the phone mount.
    const screwMat = this.mat(0x5a422c, 0.34, 0.72, 0x120806, 0.08);
    for (const [sy, sz] of [[1.58, -6.16], [1.58, -5.88], [1.20, -6.16], [1.20, -5.88]] as const) {
      const screw = this.cyl(this.s, 0.013, 0.013, 0.006, [1.176, sy, sz], screwMat, 14);
      screw.rotation.z = Math.PI / 2;
    }


    // Explicit close-range payoff geometry at real handset scale: a 22cm curved
    // banana receiver with flared cups, speaker grilles, seam line and worn edges.
    const handsetMat = this.mat(0xc4b28d, 0.58, 0, 0x2a190b, 0.08);
    const handsetEdge = this.mat(0x4b341f, 0.74);
    const handsetDark = this.mat(0x17100b, 0.82);
    this.payoffReceiver.position.set(1.11, 1.38, -6.02);
    this.payoffReceiver.scale.setScalar(1);
    const gripPts = [
      new THREE.Vector3(0, 0.034, -0.085),
      new THREE.Vector3(0, 0.014, -0.045),
      new THREE.Vector3(0, 0.0, 0),
      new THREE.Vector3(0, 0.014, 0.045),
      new THREE.Vector3(0, 0.034, 0.085),
    ];
    const gripCurve = new THREE.CatmullRomCurve3(gripPts);
    const gripGeo = new THREE.TubeGeometry(gripCurve, 24, 0.018, 10);
    const grip = new THREE.Mesh(gripGeo, handsetMat);
    grip.castShadow = grip.receiveShadow = true;
    this.payoffReceiver.add(grip);
    this.disposables.push(gripGeo);
    const seamPts = gripPts.map((p) => new THREE.Vector3(p.x - 0.0185, p.y - 0.001, p.z));
    const seamGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPts), 20, 0.0024, 6);
    const seam = new THREE.Mesh(seamGeo, handsetEdge);
    this.payoffReceiver.add(seam);
    this.disposables.push(seamGeo);
    for (const side of [-1, 1]) {
      const cup = this.cyl(this.payoffReceiver, side < 0 ? 0.041 : 0.034, side < 0 ? 0.034 : 0.041, 0.05, [0, 0.035, side * 0.087], handsetMat, 20);
      cup.rotation.x = Math.PI / 2;
      const rim = this.cyl(this.payoffReceiver, 0.042, 0.042, 0.006, [0, 0.035, side * 0.113], handsetEdge, 20);
      rim.rotation.x = Math.PI / 2;
      const grille = this.cyl(this.payoffReceiver, 0.026, 0.026, 0.003, [-0.001, 0.035, side * 0.117], handsetDark, 20);
      grille.rotation.x = Math.PI / 2;
      for (let hole = 0; hole < 5; hole++) {
        const a = hole / 5 * Math.PI * 2;
        const dot = this.cyl(this.payoffReceiver, 0.0025, 0.0025, 0.004, [-0.003, 0.035 + Math.sin(a) * 0.012, side * 0.119 + Math.cos(a) * 0.004], handsetEdge, 8);
        dot.rotation.x = Math.PI / 2;
      }
    }
    const cordPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const u = i / 64;
      const phase = u * Math.PI * 22;
      cordPts.push(new THREE.Vector3(
        -0.012 + Math.cos(phase) * 0.014,
        0.026 - u * 0.48,
        -0.087 + Math.sin(phase) * 0.014 + u * 0.055,
      ));
    }
    const cordGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts), 64, 0.0045, 7);
    const cordMesh = new THREE.Mesh(cordGeo, handsetEdge);
    cordMesh.castShadow = cordMesh.receiveShadow = true;
    this.payoffReceiver.add(cordMesh);
    this.disposables.push(cordGeo);
    this.payoffReceiver.visible = false;
    this.s.add(this.payoffReceiver);
    const phoneRim = new THREE.PointLight(0xffc17a, 0.38, 1.6, 1.7);
    phoneRim.position.set(0.72, 1.42, -5.48);
    this.s.add(phoneRim);

    // Office loop beyond the door: the same production Z1 opening set, rotated so its
    // forward axis runs through the right-hand front door. Crossing the threshold therefore
    // reveals the exact cubicle landscape/hero desk composition rather than a corridor proxy.
    this.officeLoop = await buildOfficeLoopSet();
    this.officeLoop.root.position.set(1.38, 0, -6.8);
    this.officeLoop.root.rotation.y = -Math.PI / 2;
    this.s.add(this.officeLoop.root);
    this.officeTubeMats = this.officeLoop.tubeMats;

    this.s.add(this.flash.group);

    const sun = new THREE.DirectionalLight(0xff9f4a, 0.9);
    sun.position.set(-3.5, 4.2, -2.0);
    this.s.add(sun, new THREE.AmbientLight(0x40301f, 0.16));
    for (const z of [-2.2, -5.8]) {
      const graze = new THREE.PointLight(0xff9f4a, 0.38, 4.5, 1.65);
      graze.position.set(0.92, 1.55, z);
      this.s.add(graze);
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const pose = z8PoseAt(t, z8Gait(t));
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
      this.receiver.visible = t < 210;
    }

    this.payoffReceiver.visible = t >= 210 && t < 218;
    if (this.payoffReceiver.visible) {
      const swing = Math.sin((t - 210) * 4.4) * (0.18 + 0.1 * (1 - drop));
      this.payoffReceiver.position.y = 1.42 - drop * 0.04 + 0.010 * Math.sin((t - 210) * 8);
      this.payoffReceiver.position.z = -6.02 + drop * 0.04;
      this.payoffReceiver.rotation.x = 0.16 + drop * 0.42 + swing * 0.65;
      this.payoffReceiver.rotation.z = 0.08 * Math.sin((t - 210) * 3.1);
    }

    // Door handle turns, then the front door opens onto the office loop.
    this.handle.rotation.y = smooth((t - 214) / 2.0) * 0.9;
    this.doorGroup.rotation.y = smooth((t - 217.5) / 2.0) * 1.65;

    // Warm lamp is deliberately shadowless; its glow is steady and wrong.
    const lampLevel = lerp(1.25, 0.20, smooth((t - 209.5) / 1.2));
    if (this.lampLight) this.lampLight.intensity = lampLevel;
    this.lampGlow.emissiveIntensity = (2.2 + 0.15 * Math.sin(t * 2.1)) * (0.55 + 0.45 * lampLevel / 1.25);
    const tubeCap = t >= 218 ? 0.34 : 1;
    this.officeTubeMats.forEach((m, i) => { m.emissiveIntensity = tubeCap * (1.65 + (i === 2 ? 0.5 * hash(Math.floor(t * 7) + i) : 0.12 * hash(Math.floor(t * 3) + i))); });

    // Shared beam adapter: weak 25% battery in daylight, with the low-battery stutter.
    const threat = t >= 206 && t < 218 ? 0.55 : 0.1;
    const beam = beamStateAt(t, threat);
    // At the wall-phone payoff the beam is inches from the wall; soften only this close-range
    // adapter window so the handset/cord silhouette remains readable instead of washing to white.
    if (t >= 210 && t < 222.5) beam.intensity *= t >= 218 ? 0.012 : 0.028;
    this.flash.update(pose, t, beam, (time) => z8PoseAt(time, z8Gait(time)).forward);

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(0x17100b, 1);
    rr.clear(true, true, true);
    rr.render(this.s, this.cam);
    rr.resetState();

    return thresholdPost(t, { exposure: 0.72, darkness: 0.46, stress: threat * 0.25 });
  }

  override dispose() {
    this.officeLoop?.phoneInst.dispose();
    this.officeLoop?.officeKit.dispose();
    this.officeLoop?.propPack.dispose();
    this.flash.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
