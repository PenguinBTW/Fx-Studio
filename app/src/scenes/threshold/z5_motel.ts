// THRESHOLD Z5 motel corridor at night, 105-130 s.
// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { evalFirstPerson, applyFirstPersonCamera, type FPKey, type GaitName } from './fp_cam';
import { FlashlightRig, beamStateAt } from './flashlight';
import { thresholdPost } from './sensor_post';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import tenantFullUrl from './assets/tenant_full/model.glb?url';
import lintUrl from './assets/lint/model.glb?url';
import z5MotelKitUrl from './assets/z5_motel_kit/model.glb?url';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => { const u = clamp(x); return u * u * (3 - 2 * u); };
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

type PoseKey = { t: number; p: [number, number, number]; yaw: number; pitch: number; fov: number };
const KEYS: PoseKey[] = [
  { t: 104.7, p: [0, 1.65, 1.8], yaw: 0, pitch: 0, fov: 72 },
  { t: 108.5, p: [0, 1.65, -3.8], yaw: 0, pitch: 0, fov: 72 },
  { t: 110.0, p: [0, 1.65, -5.7], yaw: 33, pitch: -2, fov: 70 },
  { t: 111.5, p: [0, 1.65, -7.2], yaw: 18, pitch: 0, fov: 72 },
  { t: 113.0, p: [0, 1.65, -10.4], yaw: -34, pitch: 1, fov: 72 },
  { t: 114.5, p: [0.55, 1.65, -17.75], yaw: 86, pitch: -9, fov: 62 },
  { t: 117.0, p: [0.55, 1.65, -18.9], yaw: 86, pitch: -10, fov: 62 },
  { t: 120.0, p: [0.35, 1.65, -19.0], yaw: 180, pitch: -13, fov: 66 },
  { t: 120.2, p: [0.35, 1.65, -19.0], yaw: 120, pitch: -7, fov: 68 },
  { t: 120.4, p: [0.35, 1.65, -19.0], yaw: 60, pitch: -3, fov: 68 },
  { t: 120.6, p: [0.35, 1.65, -19.0], yaw: 4, pitch: 0, fov: 68 },
  { t: 121.5, p: [0.35, 1.65, -19.0], yaw: 0, pitch: 0, fov: 70 },
  { t: 122.4, p: [1.25, 1.25, -20.0], yaw: 130, pitch: -5, fov: 70 },
  { t: 124.0, p: [2.15, 1.05, -19.4], yaw: 176, pitch: 2, fov: 70 },
  { t: 128.0, p: [2.15, 1.28, -18.75], yaw: 176, pitch: 3, fov: 66 },
  { t: 130.6, p: [2.05, 1.35, -18.75], yaw: 172, pitch: 0, fov: 66 },
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

function z5Gait(t: number): GaitName {
  if (t >= 121.3 && t < 122.5) return 'run';
  if ((t >= 105 && t < 114.5) || (t >= 120.6 && t < 122.4)) return 'walk';
  if (t >= 122.4 && t < 130) return 'holdBreath';
  return 'still';
}

export default class ThresholdZ5Motel extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(72, 16 / 9, 0.05, 90);
  private flash = new FlashlightRig();
  private tenant = new THREE.Group();
  private tenantInst?: GLTFInstance;
  private lintInst?: GLTFInstance;
  private motelKit?: GLTFInstance;
  private lint = new THREE.Group();
  private tvScreens: THREE.MeshStandardMaterial[] = [];
  private neonMats: THREE.MeshStandardMaterial[] = [];
  private rainLines: THREE.Mesh[] = [];
  private footprintMats: THREE.MeshStandardMaterial[] = [];
  private disposables: { dispose(): void }[] = [];

  private mat(color: number, roughness = 0.7, metalness = 0, emissive = 0, emissiveIntensity = 0) {
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
    const g = new THREE.SphereGeometry(r, 16, 10);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(...pos);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    this.disposables.push(g);
    return mesh;
  }


  private motelPrintMaterial() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#9a805d';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(239,218,177,0.55)';
    g.fillRect(8, 8, 112, 112);
    g.strokeStyle = '#2b2118';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(10, 83); g.lineTo(38, 55); g.lineTo(62, 76); g.lineTo(91, 43); g.lineTo(119, 72);
    g.stroke();
    g.strokeStyle = 'rgba(42,31,22,0.72)';
    g.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const x = 18 + i * 15;
      g.beginPath(); g.moveTo(x, 104); g.lineTo(x + (i % 2 ? 5 : -4), 78 - (i % 3) * 6); g.stroke();
    }
    g.fillStyle = 'rgba(67,35,18,0.58)';
    g.beginPath(); g.ellipse(82, 94, 24, 12, -0.25, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(31,23,18,0.5)';
    for (let i = 0; i < 32; i++) g.fillRect(Math.floor(hash(i * 2) * 126), Math.floor(hash(i * 3) * 126), 2, 1);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.disposables.push(tex);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0, emissive: 0x241507, emissiveIntensity: 0.16, map: tex });
    this.disposables.push(mat);
    return mat;
  }

  private cctvMaterial(seed: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 112;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#07111a';
    g.fillRect(0, 0, 160, 112);
    const cx = 80 + (hash(seed) - 0.5) * 28;
    g.fillStyle = '#0e2632';
    g.beginPath();
    g.moveTo(14, 102); g.lineTo(cx - 10, 58); g.lineTo(cx + 10, 58); g.lineTo(146, 102); g.closePath(); g.fill();
    g.fillStyle = '#10202a';
    g.beginPath(); g.moveTo(0, 12); g.lineTo(cx - 10, 58); g.lineTo(14, 102); g.lineTo(0, 112); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(160, 12); g.lineTo(cx + 10, 58); g.lineTo(146, 102); g.lineTo(160, 112); g.closePath(); g.fill();
    for (let i = 0; i < 5; i++) {
      const z = i / 4;
      const w = 7 + 16 * z;
      const h = 11 + 24 * z;
      const y = 57 + 39 * z;
      const spread = 21 + 48 * z;
      g.fillStyle = i % 2 ? '#24130e' : '#321a12';
      g.fillRect(cx - spread - w / 2, y - h, w, h);
      g.fillRect(cx + spread - w / 2, y - h, w, h);
      g.fillStyle = '#c96a24';
      if (i % 2 === 0) g.fillRect(cx - spread - 1, y - h + 3, 2, 4);
    }
    if (seed === 99) {
      // Critical feed semantics: the viewer is the foreground silhouette and the Tenant
      // is the impossible tall thin figure behind them. This is structural storytelling,
      // not texture polish.
      g.fillStyle = '#d6f0e8';
      g.fillRect(cx - 18, 78, 36, 34);
      g.fillStyle = '#050607';
      g.fillRect(cx - 14, 68, 28, 16);
      g.fillStyle = '#020304';
      g.fillRect(cx + 27, 38, 11, 12);
      g.fillRect(cx + 30, 50, 6, 50);
      g.fillRect(cx + 19, 58, 5, 39);
      g.fillRect(cx + 39, 58, 5, 39);
      g.fillStyle = '#c7e4df';
      g.fillRect(cx + 28, 39, 9, 6);
    } else {
      g.fillStyle = '#d9f0ee';
      g.fillRect(cx - 1.5, 70, 3, 12);
      g.fillStyle = '#030608';
      g.fillRect(cx - 3.5, 61, 7, 10);
    }
    g.fillStyle = 'rgba(0,0,0,0.34)';
    for (let y = 0; y < 112; y += 4) g.fillRect(0, y, 160, 1);
    for (let i = 0; i < 90; i++) {
      const v = 70 + Math.floor(hash(seed * 9 + i) * 130);
      g.fillStyle = `rgba(${v},${v + 20},${v + 25},0.2)`;
      g.fillRect(Math.floor(hash(seed + i * 2) * 160), Math.floor(hash(seed + i * 3) * 112), 1, 1);
    }
    g.strokeStyle = '#9adbe4';
    g.lineWidth = 3;
    g.strokeRect(1, 1, 158, 110);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.disposables.push(tex);
    const mat = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: 0.25, metalness: 0.05, emissive: 0xffffff, emissiveIntensity: 1.0, map: tex, emissiveMap: tex });
    this.disposables.push(mat);
    return mat;
  }

  override async init() {
    this.s.background = new THREE.Color(0x050608);
    this.s.fog = new THREE.FogExp2(0x050608, 0.035);

    const carpet = this.mat(0x351820, 0.32);
    const carpetTeal = this.mat(0x153a38, 0.42);
    const wall = this.mat(0x695442, 0.76, 0, 0x080403, 0.12);
    const ceiling = this.mat(0x403b35, 0.82);
    const doorMat = this.mat(0x4b2418, 0.55);
    const trim = this.mat(0x302117, 0.62, 0, 0x180b05, 0.22);
    const brass = this.mat(0xa57328, 0.38, 0.65);
    const dark = this.mat(0x070808, 0.8);
    const orange = this.mat(0xff8a26, 0.35, 0, 0xff6a18, 1.8);
    const neonPink = this.mat(0xff2e8f, 0.3, 0, 0xff2e8f, 4.5);
    const neonTeal = this.mat(0x25e7dc, 0.3, 0, 0x25e7dc, 4.0);
    this.neonMats.push(neonPink, neonTeal);

    // Production motel kit: cloned module roots are wrapped so GLTF source transforms remain untouched.
    this.motelKit = await GLTFManager.instantiate(z5MotelKitUrl, { castShadow: true, receiveShadow: true });
    const cloneKitPart = (part: string) => {
      const src = this.motelKit?.parts.get(part);
      const c = src?.clone(true);
      if (c) c.position.set(0, 0, 0);
      return c;
    };
    const kitAt = (part: string, pos: [number, number, number], yaw = 0, scale = 1) => {
      const obj = cloneKitPart(part);
      if (!obj) return undefined;
      if (part === 'crt_tv') {
        // CCTV canvas planes are the emissive image; the asset contributes the curved bezel,
        // shell and controls rather than an opaque duplicate glass/scanline layer.
        obj.traverse((child) => {
          if (child.name.startsWith('crt_curved_glass') || child.name.startsWith('crt_scanline')) child.visible = false;
        });
      }
      const wrap = new THREE.Group();
      wrap.add(obj);
      wrap.position.set(...pos);
      wrap.rotation.y = yaw;
      wrap.scale.setScalar(scale);
      this.s.add(wrap);
      return wrap;
    };

    // Corridor shell: wet carpet, walls, low ceiling, skirting and end window.
    this.box(this.s, [3.2, 0.08, 43], [0, -0.04, -18.8], carpet);
    // Segmented side walls leave real door apertures; the CRTs and room 217 are visible
    // through architecture instead of floating behind a continuous flat wall.
    const addWallSeg = (side: number, zNear: number, zFar: number) => {
      const len = zNear - zFar;
      if (len > 0.02) this.box(this.s, [0.12, 2.7, len], [side * 1.66, 1.35, (zNear + zFar) / 2], wall);
    };
    for (const side of [-1, 1]) {
      let cursor = 2.7;
      for (let i = 0; i < 10; i++) {
        const zc = side === 1 && i === 4 ? -18 : -4 - i * 4;
        addWallSeg(side, cursor, zc + 0.58);
        cursor = zc - 0.58;
      }
      addWallSeg(side, cursor, -40.3);
    }
    this.box(this.s, [3.3, 0.1, 43], [0, 2.72, -18.8], ceiling);
    this.box(this.s, [0.08, 0.16, 43], [-1.58, 0.08, -18.8], trim);
    this.box(this.s, [0.08, 0.16, 43], [1.58, 0.08, -18.8], trim);
    this.box(this.s, [3.3, 2.7, 0.14], [0, 1.35, -40.2], wall);

    // Wet carpet pattern: alternating dim teal/burgundy woven diamonds.
    for (let zi = 0; zi < 34; zi++) {
      for (let xi = -1; xi <= 1; xi++) {
        const z = 0.5 - zi * 1.15;
        const m = (zi + xi) % 2 === 0 ? carpetTeal : carpet;
        this.box(this.s, [0.32, 0.012, 0.18], [xi * 0.75 + 0.1 * hash(zi + xi), 0.012, z], m, [0, 0.5 * (xi % 2), 0]);
      }
    }

    // Beam-catch wall detail in the exact 113-120 s look paths: wallpaper seams,
    // stained wainscot, faded framed prints and water marks break the corridor walls
    // without brightening the accepted negative space.
    const wallpaperStripe = this.mat(0x34302a, 0.9);
    const wallpaperStripeB = this.mat(0x40362b, 0.88);
    const stainMat = this.mat(0x1b1712, 0.96);
    const frameMat = this.mat(0x392718, 0.65);
    const printMat = this.motelPrintMaterial();
    for (const side of [-1, 1]) {
      const x = side * 1.515;
      for (let i = 0; i < 16; i++) {
        const z = -8.6 - i * 0.66;
        this.box(this.s, [0.018, 2.05, 0.035], [x, 1.28, z], i % 2 ? wallpaperStripe : wallpaperStripeB);
      }
      for (const [z, y, w, h] of [[-16.15, 1.42, 0.48, 0.58], [-17.68, 1.38, 0.72, 0.82], [-18.86, 1.47, 0.56, 0.68], [-19.76, 1.38, 0.58, 0.72], [-20.65, 1.38, 0.42, 0.52]] as const) {
        this.box(this.s, [0.035, h, w], [x - side * 0.018, y, z], frameMat);
        this.box(this.s, [0.04, h - 0.1, w - 0.1], [x - side * 0.038, y, z], printMat);
        this.box(this.s, [0.043, 0.08, 0.12], [x - side * 0.045, y - h * 0.12, z + w * 0.12], stainMat);
      }
      for (const [z, y] of [[-10.4, 1.42], [-12.78, 1.46], [-14.35, 1.46]] as const) {
        this.box(this.s, [0.035, 0.62, 0.5], [x - side * 0.018, y, z], frameMat);
        this.box(this.s, [0.04, 0.5, 0.38], [x - side * 0.038, y, z], printMat);
        this.box(this.s, [0.043, 0.11, 0.15], [x - side * 0.045, y - 0.12, z + 0.08], stainMat);
      }
      for (let i = 0; i < 7; i++) {
        const z = -15.2 - i * 0.9;
        this.box(this.s, [0.02, 0.28 + hash(i + side * 4) * 0.5, 0.09 + hash(i) * 0.16], [x - side * 0.025, 0.62 + hash(i * 3) * 0.75, z], stainMat, [0, 0, (hash(i) - 0.5) * 0.2]);
      }
    }

    // Doors every 4 m; right side even numbers, left odd. Room 217 is the open hero room.
    for (let i = 0; i < 10; i++) {
      const zBase = -4 - i * 4;
      for (const side of [-1, 1]) {
        const z = side === 1 && i === 4 ? -18 : zBase;
        const x = side * 1.58;
        this.box(this.s, [0.16, 2.1, 0.075], [x, 1.05, z - 0.49], trim);
        this.box(this.s, [0.16, 2.1, 0.075], [x, 1.05, z + 0.49], trim);
        this.box(this.s, [0.16, 0.14, 1.02], [x, 2.03, z], trim);
        const is217 = side === 1 && i === 4;
        const ajar = side === 1 && i >= 1 && i <= 4;
        if (!is217) {
          const door = this.box(this.s, [0.08, 1.95, 0.82], [x - side * 0.02, 1.02, z], doorMat, [0, ajar ? side * 0.42 : 0, 0]);
          door.position.x += ajar ? side * 0.22 : 0;
        }
        kitAt(is217 ? 'room217_hardware' : 'door_hardware', [x - side * 0.105, 0.55, z], side < 0 ? Math.PI / 2 : -Math.PI / 2, 0.92);
      }
    }

    // CRTs glow inside the ajar rooms; screen geometry stands in for low-res CCTV feeds.
    for (let i = 1; i <= 4; i++) {
      const z = -4 - i * 4 - 0.35;
      kitAt('crt_tv', [2.25, 0.30, z], -Math.PI / 2 - 0.18, 1.25);
      const smat = this.cctvMaterial(10 + i);
      this.tvScreens.push(smat);
      this.box(this.s, [0.45, 0.30, 0.025], [1.91, 0.90, z - 0.06], smat, [0, -Math.PI / 2 - 0.18, 0]);
    }

    // Room 217 interior blockout: bed, lamp, dresser, curtain and TV.
    this.box(this.s, [3.7, 0.08, 4.4], [3.35, -0.04, -18.2], this.mat(0x2a1518, 0.55));
    this.box(this.s, [3.7, 2.7, 0.1], [3.35, 1.35, -20.35], wall);
    this.box(this.s, [0.1, 2.7, 4.4], [5.15, 1.35, -18.2], wall);
    kitAt('room217_kit', [3.72, 0, -19.45], 0, 0.82);
    this.box(this.s, [1.22, 0.28, 0.64], [2.22, 0.14, -17.25], this.mat(0x28150e, 0.66), [0, -2.35, 0]);
    kitAt('crt_tv', [2.22, -0.16, -17.25], -2.35, 2.4);
    const heroTvMat = this.cctvMaterial(99);
    this.tvScreens.push(heroTvMat);
    this.box(this.s, [0.86, 0.56, 0.025], [1.75, 0.94, -17.72], heroTvMat, [0, -2.35, 0]);
    const heroTvGlow = new THREE.PointLight(0x7db4ff, 0.72, 3.4, 1.8);
    heroTvGlow.position.set(1.62, 1.0, -17.92);
    this.s.add(heroTvGlow);

    // Window and rain-streaked neon vacancy sign at the corridor end.
    this.box(this.s, [2.15, 1.5, 0.04], [0, 1.35, -40.1], this.mat(0x0a1018, 0.2, 0, 0x071a24, 0.25));
    this.box(this.s, [1.65, 0.18, 0.04], [0, 1.72, -39.95], neonPink);
    this.box(this.s, [1.25, 0.14, 0.04], [0, 1.38, -39.94], neonTeal);
    this.box(this.s, [0.16, 0.75, 0.04], [-0.65, 1.15, -39.93], neonPink, [0, 0, 0.18]);
    this.box(this.s, [0.16, 0.75, 0.04], [0.65, 1.15, -39.93], neonTeal, [0, 0, -0.18]);
    const rainMat = new THREE.MeshBasicMaterial({ color: 0x9bd8ff, transparent: true, opacity: 0.38 });
    this.disposables.push(rainMat);
    for (let i = 0; i < 34; i++) {
      const line = this.box(this.s, [0.012, 0.28 + 0.2 * hash(i), 0.012], [-0.95 + 1.9 * hash(i * 2), 0.75 + 1.3 * hash(i * 3), -39.88], rainMat);
      line.userData.seed = hash(i * 7);
      this.rainLines.push(line);
    }

    // Sodium sconces, one broken/dark near room 217.
    for (let i = 0; i < 6; i++) {
      const z = -3.5 - i * 6.5;
      const side = i % 2 ? -1 : 1;
      const on = i !== 4;
      kitAt(on ? 'sconce' : 'broken_sconce', [side * 1.48, 1.28, z], side < 0 ? Math.PI / 2 : -Math.PI / 2, 0.95);
      if (on) {
        const l = new THREE.PointLight(0xff8a2a, 1.35, 8.5, 1.7);
        l.position.set(side * 1.25, 1.75, z);
        this.s.add(l);
      }
    }

    // Detailed corridor dressing: ice machine, housekeeping cart, payphone, vending machine, tray, signage and wet rain gear.
    kitAt('ice_machine', [-1.17, 0, -30.0], Math.PI / 2, 0.92);
    kitAt('housekeeping_cart', [0.94, 0, -11.6], -Math.PI / 2 + 0.12, 0.9);
    kitAt('payphone', [-1.47, 0.02, -7.4], Math.PI / 2, 0.94);
    kitAt('vending_small', [1.31, 0, -27.5], -Math.PI / 2, 0.9);
    kitAt('service_tray', [-0.6, 0, -13.5], 0.2, 1);
    kitAt('signage', [-1.46, 0.75, -15.7], Math.PI / 2, 0.8);
    kitAt('raincoat_umbrella', [-1.43, 0, -19.3], Math.PI / 2, 0.95);

    // Wet footprint decals leading to where the viewer stands.
    const fpMat = this.mat(0x5f8d95, 0.08, 0.38, 0x183a42, 0.45);
    this.footprintMats.push(fpMat);
    for (let i = 0; i < 14; i++) {
      const x = 0.35 + (i % 2 ? 0.18 : -0.18);
      const z = -9.2 - i * 0.7;
      const yaw = 0.1 * (i % 2 ? 1 : -1);
      // Alternating wet foot shapes point back toward the viewer: long oval forefoot,
      // separate smaller oval heel, and three small toe ovals at the viewer-facing end.
      const sole = this.sphere(this.s, 0.125, [x, 0.018, z + 0.04], fpMat, [0.64, 0.045, 1.55]);
      sole.rotation.y = yaw;
      const heel = this.sphere(this.s, 0.092, [x, 0.019, z - 0.18], fpMat, [0.74, 0.045, 0.85]);
      heel.rotation.y = yaw;
      for (let toe = 0; toe < 3; toe++) {
        const toeMesh = this.sphere(this.s, 0.031, [x + (toe - 1) * 0.052, 0.02, z + 0.24], fpMat, [0.9, 0.04, 1.25]);
        toeMesh.rotation.y = yaw;
        toeMesh.castShadow = false;
      }
      sole.castShadow = false;
      heel.castShadow = false;
    }

    // Production Lint asset batting at the sconce.
    this.lintInst = await GLTFManager.instantiate(lintUrl, { castShadow: true, receiveShadow: true });
    this.lint.add(this.lintInst.root);
    this.lint.scale.setScalar(2.2);
    this.lint.position.set(-1.25, 1.9, -10.0);
    this.s.add(this.lint);

    // Tenant partial reveal uses the production collage asset, upper-body LOD only.
    // Scale and placement preserve the accepted continuous-silhouette read inside the 2.7 m motel ceiling.
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
    const lowerBody = this.tenantInst.parts.get('lower_body');
    if (lowerBody) lowerBody.visible = false;
    this.tenantInst.root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!(m instanceof THREE.MeshStandardMaterial)) continue;
        if (m.name === 'TenantPoolTile') { m.emissive.setHex(0x123f48); m.emissiveIntensity = 0.55; }
        if (m.name === 'TenantChrome') { m.emissive.setHex(0x24313c); m.emissiveIntensity = 0.5; }
        if (m.name === 'TenantRibcageGlass') { m.emissive.setHex(0x123844); m.emissiveIntensity = 0.62; }
      }
    });
    this.tenant.add(this.tenantInst.root);
    this.tenant.scale.setScalar(0.62);
    this.tenant.rotation.y = Math.PI;
    this.tenant.position.set(0.05, 0, -21.6);
    // Rim/fill lights live in scene space (not inside the translated Tenant group):
    // cool edge light separates the mirror/head and hanging arms, warm motel bounce
    // gives the foosball torso and ball-coil arms just enough shape at delivery exposure.
    const tenantRim = new THREE.PointLight(0x9adbe4, 4.4, 5.2, 1.45);
    tenantRim.position.set(-0.55, 2.18, -22.35);
    this.s.add(tenantRim);
    const tenantFill = new THREE.PointLight(0xff9a4c, 2.4, 3.8, 1.5);
    tenantFill.position.set(0.38, 1.25, -19.85);
    this.s.add(tenantFill);
    this.tenant.visible = false;
    this.s.add(this.tenant);

    this.s.add(this.flash.group);

    const ambient = new THREE.AmbientLight(0x273040, 0.58);
    this.s.add(ambient);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const pose = poseAt(t, z5Gait(t));
    applyFirstPersonCamera(this.cam, pose, out.width / out.height);
    const dir = new THREE.Vector3(...pose.forward);

    // Shared beam adapter: global battery/flicker plus the Z5 hiding blackout.
    const beamOn = t < 124.0 || t >= 130.0;
    const threat = t >= 114.2 && t < 124.0 ? 0.95 : 0.2;
    const baseBeam = beamStateAt(t, threat);
    const beam = { ...baseBeam, intensity: beamOn ? baseBeam.intensity : 0, dead: !beamOn || baseBeam.dead };
    this.flash.update(pose, t, beam, (time) => poseAt(time, z5Gait(time)).forward);

    // Tenant partial reveal and head-tilt tell.
    this.tenant.visible = t >= 120.45 && t < 121.65;
    if (this.tenant.visible) {
      const tell = smooth((t - 120.45) / 0.8);
      this.tenant.rotation.z = 0.035 * tell;
      const head = this.tenantInst?.parts.get('head');
      if (head) head.rotation.z = 0.26 * tell;
    }

    // Lint bats at the sconce for 0.6 s during beat 5.3.
    const lintOn = t >= 112.3 && t <= 113.2;
    this.lint.visible = lintOn;
    if (lintOn) {
      const flap = Math.sign(Math.sin(t * Math.PI * 12)) * 0.45;
      const wl = this.lintInst?.parts.get('wing_l');
      const wr = this.lintInst?.parts.get('wing_r');
      if (wl) wl.rotation.z = 0.35 + flap;
      if (wr) wr.rotation.z = -0.35 - flap;
      this.lint.position.y = 1.9 + 0.05 * Math.sin(t * 31);
    }

    // TVs and neon are alive; TV glow remains as the only hiding light after beam-off.
    this.tvScreens.forEach((m, i) => {
      const n = hash(Math.floor(t * (9 + i)) + i * 31);
      m.emissiveIntensity = (t >= 124 && i === this.tvScreens.length - 1 ? 1.65 : 0.9) + n * 0.38;
    });
    this.neonMats.forEach((m, i) => { m.emissiveIntensity = 3.1 + 1.6 * (hash(Math.floor(t * 7) + i * 17) > 0.72 ? 0.25 : 1); });

    // Rain streaks slide down the window as pure f(t).
    for (const line of this.rainLines) {
      const seed = line.userData.seed as number;
      line.position.y = 0.65 + ((seed + t * (0.25 + seed * 0.2)) % 1.45);
    }

    const rr = this.ctx.renderer;
    rr.setRenderTarget(out);
    rr.setClearColor(0x050608, 1);
    rr.clear(true, true, true);
    rr.render(this.s, this.cam);
    rr.resetState();

    return thresholdPost(t, { exposure: 1.14, darkness: 0.82, stress: threat * 0.55 });
  }

  override dispose() {
    this.flash.dispose();
    this.tenantInst?.dispose();
    this.lintInst?.dispose();
    this.motelKit?.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
