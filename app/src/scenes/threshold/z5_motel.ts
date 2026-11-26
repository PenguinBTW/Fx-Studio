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
import { hermite1D, type ScalarKey } from './motion';

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

const CORRIDOR_X: ScalarKey[] = KEYS.slice(0, 7).map((k) => [k.t, k.p[0]]);
const CORRIDOR_Z: ScalarKey[] = KEYS.slice(0, 7).map((k) => [k.t, k.p[2]]);
export function z5PoseAt(t: number, gait?: GaitName) {
  const pose = poseAt(t, gait);
  if (t < KEYS[0]!.t || t > KEYS[6]!.t) return pose;
  const pos: [number, number, number] = [hermite1D(t, CORRIDOR_X), pose.pos[1], hermite1D(t, CORRIDOR_Z)];
  return {
    ...pose,
    pos,
    target: [pos[0] + pose.forward[0], pos[1] + pose.forward[1], pos[2] + pose.forward[2]] as [number, number, number],
  };
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


  private motelPrintMaterial(seed = 0) {
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
    if (seed % 3 === 1) {
      g.fillStyle = '#b9a989'; g.fillRect(10, 10, 108, 108);
      g.fillStyle = 'rgba(44,60,62,0.62)'; g.fillRect(14, 60, 100, 42);
      g.fillStyle = 'rgba(137,78,43,0.72)'; g.beginPath(); g.arc(87, 39, 15, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(24,35,38,0.75)'; g.lineWidth = 3;
      for (let y = 68; y < 100; y += 9) { g.beginPath(); g.moveTo(15, y); g.lineTo(113, y + (y % 2 ? 2 : -2)); g.stroke(); }
    } else if (seed % 3 === 2) {
      g.fillStyle = '#ad956f'; g.fillRect(10, 10, 108, 108);
      g.fillStyle = 'rgba(70,34,25,0.72)'; g.beginPath(); g.moveTo(18, 98); g.lineTo(64, 22); g.lineTo(110, 98); g.closePath(); g.fill();
      g.fillStyle = 'rgba(217,190,132,0.55)'; g.fillRect(28, 76, 72, 12);
      g.strokeStyle = 'rgba(31,22,18,0.72)'; g.lineWidth = 3;
      g.strokeRect(24, 28, 80, 72);
    }
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

    const carpetCanvas = document.createElement('canvas');
    carpetCanvas.width = carpetCanvas.height = 256;
    const cg = carpetCanvas.getContext('2d')!;
    cg.fillStyle = '#351820'; cg.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) for (let x = 0; x < 256; x += 32) {
      cg.strokeStyle = (x + y) % 64 ? 'rgba(22,88,78,0.72)' : 'rgba(116,49,40,0.68)';
      cg.lineWidth = 5;
      cg.beginPath(); cg.moveTo(x + 16, y + 3); cg.lineTo(x + 29, y + 16); cg.lineTo(x + 16, y + 29); cg.lineTo(x + 3, y + 16); cg.closePath(); cg.stroke();
      cg.fillStyle = 'rgba(8,8,8,0.24)'; cg.fillRect(x + 14, y + 14, 4, 4);
    }
    for (let i = 0; i < 900; i++) { const x=Math.floor(hash(i*2.1)*256), y=Math.floor(hash(i*3.7)*256); cg.fillStyle=`rgba(210,160,110,${0.025+hash(i)*0.05})`; cg.fillRect(x,y,1,1); }
    const carpetTex = new THREE.CanvasTexture(carpetCanvas); carpetTex.colorSpace=THREE.SRGBColorSpace; carpetTex.wrapS=carpetTex.wrapT=THREE.RepeatWrapping; carpetTex.repeat.set(2.2,18); carpetTex.anisotropy=4;
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = wallCanvas.height = 256;
    const wg = wallCanvas.getContext('2d')!;
    wg.fillStyle = '#695442'; wg.fillRect(0,0,256,256);
    for (let x=0;x<256;x+=32) { wg.fillStyle='rgba(36,24,18,0.44)'; wg.fillRect(x,0,2,256); wg.fillStyle='rgba(205,160,105,0.30)'; wg.fillRect(x+7,0,1,256); }
    for (let x=16;x<256;x+=32) for(let y=14;y<256;y+=32){
      const ox=(hash(x*3+y)*8-4), oy=(hash(x+y*5)*8-4);
      wg.strokeStyle='rgba(24,11,7,0.84)'; wg.lineWidth=2;
      wg.beginPath(); wg.moveTo(x+ox,y-9+oy); wg.lineTo(x+7+ox,y+oy); wg.lineTo(x+ox,y+9+oy); wg.lineTo(x-7+ox,y+oy); wg.closePath(); wg.stroke();
      wg.fillStyle='rgba(220,170,105,0.22)'; wg.fillRect(x-1+ox,y-1+oy,3,3);
    }
    for(let i=0;i<4200;i++){const x=Math.floor(hash(i*4.1)*256),y=Math.floor(hash(i*5.3)*256);wg.fillStyle=hash(i)>.5?`rgba(30,18,12,${.28+hash(i*7)*.30})`:`rgba(230,190,140,${.22+hash(i*7)*.25})`;wg.fillRect(x,y,3+Math.floor(hash(i)*7),2+Math.floor(hash(i*3)*4));}
    for(let i=0;i<13;i++){const x=hash(i*11)*256,y=120+hash(i*13)*130,r=18+hash(i)*45,gr=wg.createRadialGradient(x,y,1,x,y,r);gr.addColorStop(0,`rgba(34,21,14,${.08+hash(i)*.08})`);gr.addColorStop(1,'rgba(34,21,14,0)');wg.fillStyle=gr;wg.beginPath();wg.arc(x,y,r,0,Math.PI*2);wg.fill();}
    const wallTex = new THREE.CanvasTexture(wallCanvas); wallTex.colorSpace=THREE.SRGBColorSpace; wallTex.wrapS=wallTex.wrapT=THREE.RepeatWrapping; wallTex.repeat.set(1.2,10); wallTex.anisotropy=4;
    const carpet = new THREE.MeshStandardMaterial({ map: carpetTex, bumpMap: carpetTex, bumpScale: 0.012, color: 0xffffff, roughness: 0.34, metalness: 0.02 });
    const carpetTeal = this.mat(0x102321, 0.58);
    const wall = new THREE.MeshStandardMaterial({ map: wallTex, bumpMap: wallTex, bumpScale: 0.018, color: 0xffffff, roughness: 0.82, metalness: 0, emissive: 0x080403, emissiveIntensity: 0.08 });
    this.disposables.push(carpetTex, wallTex, carpet, wall);
    const ceiling = new THREE.MeshStandardMaterial({ map: wallTex, bumpMap: wallTex, bumpScale: 0.014, color: 0x6f675d, roughness: 0.86, metalness: 0 });
    this.disposables.push(ceiling);
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
    // Corridor-scale architectural rhythm: stained chair rails and low ceiling beams
    // create real occluding edges across the otherwise dominant wall/ceiling planes.
    for (const side of [-1, 1]) {
      this.box(this.s, [0.035, 0.045, 43], [side * 1.55, 0.92, -18.8], trim);
      this.box(this.s, [0.025, 0.03, 43], [side * 1.57, 2.22, -18.8], trim);
    }
    for (let beam = 0; beam < 9; beam++) {
      const z = 0.8 - beam * 4.7;
      this.box(this.s, [3.28, 0.085, 0.11], [0, 2.62, z], trim);
    }
    // Acoustic ceiling tile grid and water staining: the large overhead plane carries
    // manufactured seams and damage rather than reading as a smooth orange void.
    for (let seam = 0; seam < 31; seam++) {
      const z = 1.6 - seam * 1.38;
      this.box(this.s, [3.22, 0.018, 0.026], [0, 2.665, z], trim);
    }
    for (const x of [-0.82, 0, 0.82]) this.box(this.s, [0.026, 0.018, 42.5], [x, 2.666, -18.8], trim);
    for (let stain = 0; stain < 15; stain++) {
      const x = (hash(stain * 4.7) - 0.5) * 2.35;
      const z = 0.8 - hash(stain * 6.1) * 35;
      this.box(this.s, [0.18 + hash(stain) * 0.44, 0.012, 0.12 + hash(stain * 2) * 0.5], [x, 2.655, z], trim, [0, hash(stain * 3) * 0.5, 0]);
    }

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
    const printMats = [0, 1, 2].map((seed) => this.motelPrintMaterial(seed));
    for (const side of [-1, 1]) {
      const x = side * 1.515;
      for (let i = 0; i < 16; i++) {
        const z = -8.6 - i * 0.66;
        this.box(this.s, [0.018, 2.05, 0.035], [x, 1.28, z], i % 2 ? wallpaperStripe : wallpaperStripeB);
      }
      for (const [pi, [z, y, w, h]] of ([[-16.15, 1.42, 0.48, 0.58], [-17.68, 1.38, 0.72, 0.82], [-18.86, 1.47, 0.56, 0.68], [-19.76, 1.38, 0.58, 0.72], [-20.65, 1.38, 0.42, 0.52]] as const).entries()) {
        this.box(this.s, [0.035, h, w], [x - side * 0.018, y, z], frameMat);
        this.box(this.s, [0.04, h - 0.1, w - 0.1], [x - side * 0.038, y, z], printMats[(pi + (side > 0 ? 1 : 0)) % 3]!);
        this.box(this.s, [0.043, 0.08, 0.12], [x - side * 0.045, y - h * 0.12, z + w * 0.12], stainMat);
      }
      for (const [pi, [z, y]] of ([[-10.4, 1.42], [-12.78, 1.46], [-14.35, 1.46]] as const).entries()) {
        this.box(this.s, [0.035, 0.62, 0.5], [x - side * 0.018, y, z], frameMat);
        this.box(this.s, [0.04, 0.5, 0.38], [x - side * 0.038, y, z], printMats[(pi + 2 + (side > 0 ? 1 : 0)) % 3]!);
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
    const heroTvGlow = new THREE.PointLight(0x7db4ff, 2.4, 6.5, 1.5);
    heroTvGlow.position.set(1.62, 1.0, -17.92);
    this.s.add(heroTvGlow);
    // Room 217 bed and lamp must survive the doorway view at 124-125: warm practical
    // spill plus readable bed mass/pillows rather than a TV floating in a black void.
    this.box(this.s, [1.05, 0.34, 1.75], [3.48, 0.22, -18.18], this.mat(0x3c1820, 0.78), [0, 0.04, 0]);
    this.box(this.s, [1.0, 0.12, 1.62], [3.48, 0.45, -18.18], this.mat(0x6f5d4b, 0.9), [0, 0.04, 0]);
    this.box(this.s, [0.72, 0.11, 0.32], [3.48, 0.56, -18.82], this.mat(0xb59d78, 0.92), [0, 0.04, 0]);
    this.box(this.s, [0.34, 0.46, 0.34], [4.52, 0.34, -19.25], this.mat(0x3b2115, 0.68));
    const shade = this.cyl(this.s, 0.18, 0.25, 0.28, [4.52, 0.88, -19.25], this.mat(0xc18a4e, 0.82, 0, 0xff8d32, 1.6), 18);
    shade.scale.z = 0.78;
    const lampSpill = new THREE.PointLight(0xffa04c, 3.8, 5.8, 1.45);
    lampSpill.position.set(4.35, 1.05, -19.1);
    this.s.add(lampSpill);

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

    const corridorFill = new THREE.PointLight(0xff7d32, 2.4, 15, 1.95);
    corridorFill.position.set(0, 2.05, -8.5);
    this.s.add(corridorFill);

    // Sodium sconces, one broken/dark near room 217.
    for (let i = 0; i < 6; i++) {
      const z = -3.5 - i * 6.5;
      const side = i % 2 ? -1 : 1;
      const on = i !== 4;
      kitAt(on ? 'sconce' : 'broken_sconce', [side * 1.48, 1.28, z], side < 0 ? Math.PI / 2 : -Math.PI / 2, 0.95);
      if (on) {
        const l = new THREE.PointLight(0xff8a2a, 4.2, 12, 1.45);
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
    const fpMat = new THREE.MeshPhysicalMaterial({ color: 0x15100c, roughness: 0.16, metalness: 0.03, clearcoat: 0.72, clearcoatRoughness: 0.18, emissive: 0x010304, emissiveIntensity: 0.04 });
    this.disposables.push(fpMat);
    this.footprintMats.push(fpMat);
    for (let i = 0; i < 14; i++) {
      const x = 0.23 + (i % 2 ? 0.17 : -0.17);
      const z = -9.2 - i * 0.62;
      const yaw = 0.18 * (i % 2 ? 1 : -1);
      // Alternating wet foot shapes point back toward the viewer: long oval forefoot,
      // separate smaller oval heel, and three small toe ovals at the viewer-facing end.
      const sole = this.sphere(this.s, 0.115, [x, 0.018, z + 0.03], fpMat, [0.74, 0.025, 1.34]);
      sole.rotation.y = yaw;
      const heel = this.sphere(this.s, 0.084, [x, 0.0185, z - 0.15], fpMat, [0.82, 0.025, 0.78]);
      heel.rotation.y = yaw;
      for (let toe = 0; toe < 3; toe++) {
        const toeMesh = this.sphere(this.s, 0.028, [x + (toe - 1) * 0.043, 0.019, z + 0.195], fpMat, [0.95, 0.028, 1.25]);
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

    // Tenant partial reveal uses the production collage asset at reduced scale.
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
      if (obj.name.includes('chest_fused_mass') || obj.name.includes('torso_continuous_hunched_mass')) obj.visible = false;
      obj.material = Array.isArray(obj.material) ? cloned : cloned[0]!;
    });
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
    this.tenant.scale.set(0.68, 0.54, 0.68);
    this.tenant.rotation.y = Math.PI - 0.55;
    this.tenant.rotation.x = -0.48;
    this.tenant.position.set(0.02, -0.05, -23.35);
    const chestGlow = new THREE.PointLight(0x5bb9d7, 2.2, 4.2, 1.55);
    chestGlow.position.set(0, 2.5, 0.45);
    this.tenant.add(chestGlow);
    // Rim/fill lights live in scene space (not inside the translated Tenant group):
    // cool edge light separates the mirror/head and hanging arms, warm motel bounce
    // gives the foosball torso and ball-coil arms just enough shape at delivery exposure.
    const tenantRim = new THREE.PointLight(0x9adbe4, 7.5, 6.5, 1.35);
    tenantRim.position.set(-0.55, 2.05, -25.05);
    this.s.add(tenantRim);
    const tenantFill = new THREE.PointLight(0xff9a4c, 3.4, 4.8, 1.35);
    tenantFill.position.set(0.38, 1.15, -22.4);
    this.s.add(tenantFill);
    this.tenant.visible = false;
    this.s.add(this.tenant);

    this.s.add(this.flash.group);

    const ambient = new THREE.AmbientLight(0x344159, 0.72);
    const neonSpill = new THREE.PointLight(0xff4da0, 4.2, 22, 1.55);
    neonSpill.position.set(0, 1.7, -36.5);
    const crtSpill = new THREE.PointLight(0x6fa8ff, 3.4, 12, 1.45);
    crtSpill.position.set(1.6, 1.0, -13.5);
    this.s.add(neonSpill, crtSpill);
    this.s.add(ambient);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const pose = z5PoseAt(t, z5Gait(t));
    applyFirstPersonCamera(this.cam, pose, out.width / out.height);
    const dir = new THREE.Vector3(...pose.forward);

    // Shared beam adapter: global battery/flicker plus the Z5 hiding blackout.
    const beamOn = t < 124.0 || t >= 130.0;
    const threat = t >= 114.2 && t < 124.0 ? 0.95 : 0.2;
    const baseBeam = beamStateAt(t, threat);
    const beam = { ...baseBeam, intensity: beamOn ? baseBeam.intensity : 0, dead: !beamOn || baseBeam.dead };
    this.flash.update(pose, t, beam, (time) => z5PoseAt(time, z5Gait(time)).forward);

    // Tenant partial reveal and head-tilt tell.
    this.tenant.visible = t >= 120.45 && t < 121.65;
    if (this.tenant.visible) {
      const tell = smooth((t - 120.45) / 0.8);
      this.tenant.rotation.z = 0.035 * tell;
      const head = this.tenantInst?.parts.get('head');
      if (head) head.rotation.z = 0.52 * tell;
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

    const exposure = t < 114 ? 2.85 : t < 120 ? 2.25 : t < 122 ? 1.95 : 2.25;
    return thresholdPost(t, { exposure, darkness: 0.5, stress: threat * 0.55 });
  }

  override dispose() {
    this.flash.dispose();
    this.tenantInst?.dispose();
    this.lintInst?.dispose();
    this.motelKit?.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
