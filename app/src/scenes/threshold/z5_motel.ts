// THRESHOLD Z5 grey-box blockout. Motel corridor at night, 105-130 s.
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

  override init() {
    this.s.background = new THREE.Color(0x050608);
    this.s.fog = new THREE.FogExp2(0x050608, 0.035);

    const carpet = this.mat(0x351820, 0.32);
    const carpetTeal = this.mat(0x153a38, 0.42);
    const wall = this.mat(0x5c4a39, 0.78);
    const ceiling = this.mat(0x403b35, 0.82);
    const doorMat = this.mat(0x4b2418, 0.55);
    const trim = this.mat(0x241912, 0.65);
    const brass = this.mat(0xa57328, 0.38, 0.65);
    const dark = this.mat(0x070808, 0.8);
    const orange = this.mat(0xff8a26, 0.35, 0, 0xff6a18, 1.8);
    const neonPink = this.mat(0xff2e8f, 0.3, 0, 0xff2e8f, 4.5);
    const neonTeal = this.mat(0x25e7dc, 0.3, 0, 0x25e7dc, 4.0);
    this.neonMats.push(neonPink, neonTeal);

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
        this.box(this.s, [0.025, 0.12, 0.18], [x - side * 0.09, 1.62, z - 0.28], brass);
        this.box(this.s, [0.035, 0.05, 0.18], [x - side * 0.12, 1.0, z + 0.25], brass);
      }
    }

    // CRTs glow inside the ajar rooms; screen geometry stands in for low-res CCTV feeds.
    const crtBody = this.mat(0x151719, 0.45);
    for (let i = 1; i <= 4; i++) {
      const z = -4 - i * 4 - 0.35;
      this.box(this.s, [0.72, 0.52, 0.55], [2.25, 0.85, z], crtBody, [0, -0.35, 0]);
      const smat = this.cctvMaterial(10 + i);
      this.tvScreens.push(smat);
      this.box(this.s, [0.5, 0.34, 0.025], [1.98, 0.9, z + 0.02], smat, [0, -1.18, 0]);
    }

    // Room 217 interior blockout: bed, lamp, dresser, curtain and TV.
    this.box(this.s, [3.7, 0.08, 4.4], [3.35, -0.04, -18.2], this.mat(0x2a1518, 0.55));
    this.box(this.s, [3.7, 2.7, 0.1], [3.35, 1.35, -20.35], wall);
    this.box(this.s, [0.1, 2.7, 4.4], [5.15, 1.35, -18.2], wall);
    this.box(this.s, [1.8, 0.48, 0.95], [4.05, 0.24, -19.25], this.mat(0x6a4c3a, 0.75));
    this.box(this.s, [1.7, 0.16, 0.8], [4.05, 0.58, -19.25], this.mat(0xb7a893, 0.8));
    this.box(this.s, [0.75, 0.75, 0.55], [2.35, 0.38, -19.45], this.mat(0x3a2419, 0.6));
    this.cyl(this.s, 0.09, 0.12, 0.58, [2.35, 1.05, -19.45], brass, 10);
    this.cyl(this.s, 0.26, 0.18, 0.28, [2.35, 1.4, -19.45], orange, 16);
    this.box(this.s, [1.16, 0.82, 0.64], [2.25, 0.85, -17.2], crtBody, [0, 0.85, 0]);
    const heroTvMat = this.cctvMaterial(99);
    this.tvScreens.push(heroTvMat);
    this.box(this.s, [1.08, 0.7, 0.025], [1.93, 0.94, -17.55], heroTvMat, [0, Math.PI + 0.12, 0]);
    this.box(this.s, [0.08, 1.8, 1.1], [4.95, 1.1, -17.15], this.mat(0x381f2d, 0.9));

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
      this.box(this.s, [0.14, 0.32, 0.22], [side * 1.5, 1.85, z], brass);
      const on = i !== 4;
      this.box(this.s, [0.2, 0.18, 0.28], [side * 1.44, 1.82, z], on ? orange : dark);
      if (on) {
        const l = new THREE.PointLight(0xff8a2a, 0.9, 7, 1.8);
        l.position.set(side * 1.25, 1.75, z);
        this.s.add(l);
      }
    }

    // Motel dressing blockout: ice machine, housekeeping cart, payphone, small vending machine, tray, umbrella.
    this.box(this.s, [0.9, 1.45, 0.75], [-1.05, 0.72, -30], this.mat(0x5d666c, 0.4, 0.35));
    this.box(this.s, [0.65, 0.16, 0.08], [-1.05, 1.12, -29.6], this.mat(0x9fb5c2, 0.28, 0.5));
    this.box(this.s, [0.9, 0.7, 0.55], [1.0, 0.36, -11.6], this.mat(0x4c4a42, 0.7));
    this.box(this.s, [0.8, 0.08, 0.5], [1.0, 0.78, -11.6], this.mat(0xb8a37f, 0.65));
    this.box(this.s, [0.46, 1.3, 0.28], [-1.35, 0.75, -7.4], this.mat(0x1f2d36, 0.45, 0.2));
    this.box(this.s, [0.52, 1.35, 0.55], [1.25, 0.68, -27.5], this.mat(0x243b54, 0.42, 0.2));
    this.box(this.s, [0.4, 0.52, 0.04], [1.22, 0.95, -27.2], this.mat(0x7db4ff, 0.2, 0, 0x497aff, 0.9));
    this.box(this.s, [0.58, 0.035, 0.42], [-0.6, 0.05, -13.5], this.mat(0x806f54, 0.65));
    this.cyl(this.s, 0.025, 0.025, 0.9, [-1.42, 0.45, -19.3], this.mat(0x1c1c20, 0.7), 8).rotation.z = 0.25;

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

    // Lint blockout at the sconce: small brown felt body and two wings.
    const felt = this.mat(0x6b3f24, 0.95);
    const wing = this.mat(0x8a5631, 0.96);
    const glow = this.mat(0xff8c2a, 0.55, 0, 0xff7a18, 2.8);
    this.cyl(this.lint, 0.025, 0.035, 0.1, [0, 0, 0], felt, 10).rotation.x = Math.PI / 2;
    this.box(this.lint, [0.14, 0.018, 0.07], [-0.07, 0, 0], wing, [0, 0, 0.35]);
    this.box(this.lint, [0.14, 0.018, 0.07], [0.07, 0, 0], wing, [0, 0, -0.35]);
    this.cyl(this.lint, 0.025, 0.025, 0.035, [0, 0, 0.06], glow, 10).rotation.x = Math.PI / 2;
    this.lint.position.set(-1.25, 1.9, -10.0);
    this.s.add(this.lint);

    // Tenant upper-body blockout: small tile head, vending-glass ribcage, ball arm and coil hand.
    const tile = this.mat(0xb9d9d7, 0.26);
    const paper = this.mat(0xd8c69d, 0.82);
    const plasticRed = this.mat(0xa92624, 0.28);
    const chrome = this.mat(0x8c9296, 0.22, 0.8);
    const glass = new THREE.MeshStandardMaterial({ color: 0x25333a, roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.62, emissive: 0x102a30, emissiveIntensity: 0.28 });
    this.disposables.push(glass);
    // Lanky upper-body silhouette first: too-small tile head, thin neck, narrow vending ribcage,
    // long downward-hanging collage arms, and only a hint of legs disappearing into darkness.
    const silhouette = this.mat(0x11181b, 0.82, 0, 0x0b252c, 0.72);
    this.box(this.tenant, [0.34, 1.08, 0.12], [0, 1.42, -0.08], silhouette);
    this.box(this.tenant, [0.42, 1.5, 0.055], [0, 1.48, 0.18], silhouette);
    this.box(this.tenant, [0.13, 1.48, 0.11], [-0.52, 1.25, 0.15], silhouette, [0, 0, 0.04]);
    this.box(this.tenant, [0.09, 1.22, 0.09], [-0.48, 1.25, -0.04], silhouette, [0, 0, 0.08]);
    this.box(this.tenant, [0.09, 1.22, 0.09], [0.48, 1.25, -0.04], silhouette, [0, 0, -0.08]);
    this.box(this.tenant, [0.12, 0.92, 0.1], [-0.18, 0.46, -0.06], silhouette);
    this.box(this.tenant, [0.12, 0.92, 0.1], [0.18, 0.46, -0.06], silhouette);
    this.sphere(this.tenant, 0.18, [0, 2.48, 0.02], tile, [0.82, 1.08, 0.72]);
    this.box(this.tenant, [0.045, 0.16, 0.018], [0, 2.48, 0.145], this.mat(0x020303, 0.9));
    for (let i = 0; i < 5; i++) this.cyl(this.tenant, 0.052, 0.062, 0.16, [0, 2.2 - i * 0.12, 0], this.mat(0x5a342b, 0.9), 8);
    this.box(this.tenant, [0.58, 0.98, 0.3], [0, 1.43, 0], glass);
    for (let i = 0; i < 5; i++) this.box(this.tenant, [0.49, 0.032, 0.33], [0, 1.1 + i * 0.16, 0.01], chrome);
    this.box(this.tenant, [0.42, 0.28, 0.28], [0, 0.83, 0], paper, [0, 0, 0.12]);
    for (let i = 0; i < 6; i++) this.cyl(this.tenant, 0.075, 0.085, 0.22, [-0.46 - i * 0.012, 1.9 - i * 0.2, 0.01], i % 2 ? plasticRed : this.mat(0xd1a62c, 0.3), 10).rotation.z = 0.08;
    for (let i = 0; i < 5; i++) this.cyl(this.tenant, 0.023, 0.033, 0.44, [0.46 + i * 0.012, 1.85 - i * 0.22, 0.03 * i], chrome, 8).rotation.z = -0.06;
    for (let i = 0; i < 5; i++) this.box(this.tenant, [0.032, 0.4, 0.065], [0.51 + i * 0.035, 0.86 - i * 0.025, 0.08], paper, [0, 0, -0.12 - i * 0.08]);
    for (const side of [-1, 1]) {
      this.box(this.tenant, [0.13, 0.72, 0.16], [side * 0.18, 0.38, -0.02], side < 0 ? tile : paper, [0.04, 0, side * 0.04]);
    }
    this.tenant.position.set(0.05, 0, -21.6);
    const tenantRim = new THREE.PointLight(0x9adbe4, 1.35, 4.2, 1.7);
    tenantRim.position.set(-0.45, 2.25, -20.85);
    this.tenant.add(tenantRim);
    this.tenant.visible = false;
    this.s.add(this.tenant);

    this.s.add(this.flash.group);

    const ambient = new THREE.AmbientLight(0x273040, 0.42);
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
    if (this.tenant.visible) this.tenant.rotation.z = 0.12 * smooth((t - 120.45) / 0.8);

    // Lint bats at the sconce for 0.6 s during beat 5.3.
    const lintOn = t >= 112.3 && t <= 113.2;
    this.lint.visible = lintOn;
    if (lintOn) {
      const flap = Math.sign(Math.sin(t * Math.PI * 12)) * 0.45;
      this.lint.children[1]!.rotation.z = 0.35 + flap;
      this.lint.children[2]!.rotation.z = -0.35 - flap;
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
    for (const d of this.disposables) d.dispose();
  }
}
