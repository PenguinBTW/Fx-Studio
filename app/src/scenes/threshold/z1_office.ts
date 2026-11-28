// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Z1 office: grey-box/final-geometry hybrid blockout for beats 1.1-1.9. Local rig is W2 scaffolding pending W1's shared kit.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { resolveAsset } from '../../engine/assets';
import { Layer2D } from '../../engine/gl';
import { thresholdPost } from './sensor_post';
import { addFlashlight, applyFpCamera, basic, box, clamp, cyl, disposeTree, hash, mat, plane, smooth, sph, updateFlashlight, type CamKey } from './z1_scene_util';
import { drawPremiseLine } from './premise';

const KEYS: CamKey[] = [
  { t: 4.0, pos: [0, 1.65, 0], look: [0, 1.35, -6], fov: 74, gait: 'still' },
  { t: 6.5, pos: [0, 1.65, 0], look: [0, 1.35, -6], fov: 74, gait: 'still' },
  { t: 7.2, pos: [0, 1.65, 0], look: [-2.4, 1.35, -4], fov: 74, gait: 'still' },
  { t: 8.0, pos: [0, 1.65, 0], look: [0, 1.25, -6], fov: 74, gait: 'still' },
  { t: 11.0, pos: [0.24, 1.1, -5.3], look: [0.34, 0.86, -5.76], fov: 58, gait: 'walk' },
  { t: 13.0, pos: [0.24, 1.1, -5.3], look: [0.34, 0.89, -5.76], fov: 58, gait: 'still' },
  { t: 15.5, pos: [0, 1.48, -5.15], look: [0, 1.9, -6], fov: 68, gait: 'still' },
  { t: 18.5, pos: [0, 1.5, -5.15], look: [0, 2.68, -6], fov: 66, gait: 'still' },
  { t: 19.3, pos: [0, 1.5, -5.15], look: [0, 2.68, -6], fov: 66, gait: 'still' },
  { t: 19.8, pos: [0, 1.58, -4.6], look: [0, 1.45, 1], fov: 84, gait: 'run' },
  { t: 21.6, pos: [0, 1.6, -1.0], look: [2.5, 1.5, 4.2], fov: 84, gait: 'run' },
  { t: 23.3, pos: [4.0, 1.6, 1.4], look: [4.0, 1.5, 9], fov: 84, gait: 'run' },
  { t: 25.5, pos: [4.0, 1.6, 4.2], look: [-2, 1.5, 15], fov: 85, gait: 'run' },
  { t: 27.5, pos: [-2.0, 1.6, 8.0], look: [-2, 1.25, 15], fov: 88, gait: 'run' },
  { t: 30.0, pos: [-2.0, 1.54, 14.72], look: [-2, 1.15, 16], fov: 88, gait: 'run', roll: 0.08 },
];

const CHASE_KEYS = KEYS.filter((k) => k.t >= 19.8 && k.t <= 30).map((k) => ({ t: k.t, pos: k.pos }));
function chaseSlope(i: number) {
  const a = CHASE_KEYS[Math.max(0, i - 1)]!, b = CHASE_KEYS[Math.min(CHASE_KEYS.length - 1, i + 1)]!;
  const dt = Math.max(1e-6, b.t - a.t);
  return [(b.pos[0] - a.pos[0]) / dt, (b.pos[1] - a.pos[1]) / dt, (b.pos[2] - a.pos[2]) / dt] as [number, number, number];
}
function chaseContinuousPos(t: number): [number, number, number] {
  if (t <= CHASE_KEYS[0]!.t) return [...CHASE_KEYS[0]!.pos] as [number, number, number];
  const last = CHASE_KEYS[CHASE_KEYS.length - 1]!;
  if (t >= last.t) return [...last.pos] as [number, number, number];
  let i = 0; while (i < CHASE_KEYS.length - 2 && t >= CHASE_KEYS[i + 1]!.t) i++;
  const a = CHASE_KEYS[i]!, b = CHASE_KEYS[i + 1]!;
  const dt = b.t - a.t, u = clamp((t - a.t) / dt);
  const m0 = chaseSlope(i), m1 = chaseSlope(i + 1);
  const h00 = 2 * u ** 3 - 3 * u ** 2 + 1, h10 = u ** 3 - 2 * u ** 2 + u, h01 = -2 * u ** 3 + 3 * u ** 2, h11 = u ** 3 - u ** 2;
  const base = [0, 1, 2].map((j) => h00 * a.pos[j]! + h10 * dt * m0[j]! + h01 * b.pos[j]! + h11 * dt * m1[j]!) as [number, number, number];
  if (t > 27.5 && t < 30) base[0] += Math.sin((t - 27.5) / 2.5 * Math.PI * 2) * 0.10;
  return base;
}
function chaseSmoothPos(t: number): [number, number, number] {
  if (t <= CHASE_KEYS[0]!.t) return [...CHASE_KEYS[0]!.pos] as [number, number, number];
  const last = CHASE_KEYS[CHASE_KEYS.length - 1]!;
  if (t >= last.t) return [...last.pos] as [number, number, number];
  let i = 0; while (i < CHASE_KEYS.length - 2 && t >= CHASE_KEYS[i + 1]!.t) i++;
  const a = CHASE_KEYS[i]!, b = CHASE_KEYS[i + 1]!;
  const u = clamp((t - a.t) / (b.t - a.t)), e = u * u * (3 - 2 * u);
  return [0, 1, 2].map((j) => a.pos[j]! + (b.pos[j]! - a.pos[j]!) * e) as [number, number, number];
}

type SurfaceKind = 'carpet' | 'fabric' | 'ceiling' | 'paper' | 'plastic' | 'metal' | 'laminate';
function surfaceNoise(x: number, y: number, seed: number) {
  const v = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return v - Math.floor(v);
}
function proceduralSurface(kind: SurfaceKind, repeat: number) {
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = surfaceNoise(x, y, kind.length * 17);
    const n2 = surfaceNoise(Math.floor(x / 4), Math.floor(y / 4), kind.length * 31);
    let v = 220;
    if (kind === 'carpet') {
      const fibre = (n - 0.5) * 42 + (n2 - 0.5) * 18 + Math.sin(x * 1.7 + n * 5) * 2.5 + Math.sin(y * 2.1 + n2 * 4) * 2.5;
      const damp = Math.max(0, Math.sin(x * 0.043 + Math.sin(y * 0.031)) + Math.sin(y * 0.037 + Math.sin(x * 0.021)) - 1.22) * 34;
      v = 202 + fibre - damp;
    } else if (kind === 'fabric') {
      v = 208 + (n - 0.5) * 66 + (n2 - 0.5) * 24 + Math.sin(x * 0.11 + n2 * 3) * Math.sin(y * 0.13 + n * 2) * 16 + Math.sin(x * 1.9) * 3 + Math.sin(y * 2.3) * 3;
    } else if (kind === 'ceiling') {
      const fissure = Math.abs(Math.sin(x * 0.08 + Math.sin(y * 0.06) * 2.4)) < 0.045 ? -34 : 0;
      const pit = n > 0.955 ? -55 : 0;
      v = 214 + n * 18 + n2 * 9 + fissure + pit;
    } else if (kind === 'paper') {
      const fibre = Math.sin(y * 1.9 + n * 3) * 8;
      v = 219 + fibre + n * 15 - (n > 0.965 ? 28 : 0);
    } else if (kind === 'plastic') {
      v = 216 + n * 13 + Math.sin((x + y) * 0.11) * 5;
    } else if (kind === 'metal') {
      const scratch = Math.abs(Math.sin(y * 1.35 + n * 0.4)) < 0.03 ? -38 : 0;
      v = 198 + n * 20 + scratch;
    } else {
      v = 207 + Math.sin(y * 0.65) * 8 + n2 * 16 + n * 8;
    }
    const id = (y * size + x) * 4;
    img.data[id] = img.data[id + 1] = img.data[id + 2] = Math.max(80, Math.min(255, v));
    img.data[id + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  return tex;
}
function exitSignTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 96);
  grad.addColorStop(0, '#6e100c'); grad.addColorStop(0.48, '#b8221a'); grad.addColorStop(1, '#4b0907');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 96);
  g.strokeStyle = 'rgba(255,105,78,.75)'; g.lineWidth = 5; g.strokeRect(5, 5, 246, 86);
  g.font = 'bold 58px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,235,210,.75)'; g.shadowBlur = 7;
  g.fillStyle = '#fff0df'; g.fillText('EXIT', 128, 51);
  g.shadowBlur = 0; g.fillStyle = 'rgba(70,0,0,.25)'; g.fillRect(0, 78, 256, 18);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function wetGoatEyeTexture() {
  const size = 128;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x / size - 0.5, dy = y / size - 0.5;
    const radial = Math.sqrt(dx * dx + dy * dy);
    const n = surfaceNoise(x, y, 241);
    const striae = Math.sin(Math.atan2(dy, dx) * 9 + radial * 28) * 10;
    const edge = Math.max(0, radial - 0.32) * 120;
    const v = 226 + (n - 0.5) * 24 + striae - edge;
    const id = (y * size + x) * 4;
    img.data[id] = Math.max(115, Math.min(255, v + 14));
    img.data[id + 1] = Math.max(92, Math.min(255, v));
    img.data[id + 2] = Math.max(42, Math.min(205, v - 64));
    img.data[id + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function organicSkinTexture(repeat: number) {
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = surfaceNoise(x, y, 113);
    const blotch = surfaceNoise(Math.floor(x / 13), Math.floor(y / 11), 151);
    const pore = surfaceNoise(Math.floor(x / 2), Math.floor(y / 2), 197);
    const crease = Math.abs(Math.sin(x * 0.055 + Math.sin(y * 0.035) * 2.1)) < 0.035 ? -24 : 0;
    const wetBand = Math.max(0, Math.sin(y * 0.021 + blotch * 4.5) - 0.58) * 24;
    const v = 198 + (n - 0.5) * 24 + (blotch - 0.5) * 46 + (pore > 0.91 ? -34 : 0) + crease + wetBand;
    const id = (y * size + x) * 4;
    img.data[id] = Math.max(82, Math.min(255, v + 8));
    img.data[id + 1] = Math.max(72, Math.min(255, v));
    img.data[id + 2] = Math.max(68, Math.min(255, v - 5));
    img.data[id + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // Sparse longer wet streaks; subtle enough not to become painted stripes.
  for (let i = 0; i < 52; i++) {
    const x = hash(i * 3.1) * size, y = hash(i * 7.7) * size, len = 10 + hash(i) * 30;
    g.strokeStyle = `rgba(255,226,210,${0.025 + hash(i + 2) * 0.055})`; g.lineWidth = 0.7 + hash(i + 4) * 1.2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (hash(i + 6) - 0.5) * 5, y + len); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat, repeat);
  return tex;
}

function officeScreenTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160;
  const g = c.getContext('2d')!;
  g.fillStyle = '#58d9d4'; g.fillRect(0, 0, 256, 160);
  g.strokeStyle = 'rgba(5,45,48,.55)'; g.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const inset = 14 + i * 9;
    g.strokeRect(inset, inset * 0.55, 256 - inset * 2, 160 - inset * 1.1);
  }
  g.fillStyle = 'rgba(0,30,34,.11)';
  for (let y = 0; y < 160; y += 4) g.fillRect(0, y, 256, 1);
  g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(34, 22, 74, 5);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.center.set(0.5, 0.5); tex.rotation = Math.PI / 2;
  return tex;
}
function surfaceMat(kind: SurfaceKind, color: string | number, roughness = 0.75, repeat = 2, metalness = 0) {
  const map = proceduralSurface(kind, repeat);
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, map, roughnessMap: map, bumpMap: map, bumpScale: kind === 'metal' ? 0.006 : 0.014 });
}

export default class ThresholdZ1Office extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(74, 16 / 9, 0.04, 80);
  private layer!: Layer2D;
  private flash!: ReturnType<typeof addFlashlight>;
  private receiver!: THREE.Mesh;
  private receiverParts: THREE.Mesh[] = [];
  private tileShift!: THREE.Mesh;
  private eyes: THREE.Mesh[] = [];
  private lids: THREE.Mesh[] = [];
  private fingers: THREE.Mesh[] = [];
  private skinTiles: THREE.Mesh[] = [];
  private fallingTiles: { m: THREE.Mesh; z: number; t0: number; y0: number }[] = [];
  private tubeMats: THREE.MeshStandardMaterial[] = [];
  private tubeLights: THREE.PointLight[] = [];
  private slidingPrintout!: THREE.Mesh;
  private ventRibbon!: THREE.Mesh;
  private chair!: THREE.Mesh;
  private doorGlow!: THREE.MeshStandardMaterial;

  private breather!: GLTFInstance;
  private phoneAsset!: GLTFInstance;
  private officeKit!: GLTFInstance;
  private propPack!: GLTFInstance;
  private glbReceiver?: THREE.Object3D;
  private assetMats: Record<string, THREE.Material> = {};
  private breatherEyeMats: THREE.MeshStandardMaterial[] = [];

  override async init() {
    const resolved = resolveAsset('threshold/z1_ceiling_breather');
    this.breather = await GLTFManager.instantiate(resolved.url, { ...resolved.manifest.load, castShadow: true, receiveShadow: true });
    this.breather.root.position.set(0,2.72,-6.02); this.breather.root.visible = false; this.s.add(this.breather.root);
    // Corpse-pale organic material separation: the accepted silhouette remains unchanged, but skin,
    // veins, pads and nails must not collapse into uniform grey pipe plastic under the beam.
    const breatherMatCache = new Map<THREE.Material, THREE.Material>();
    const breatherSkinTex = organicSkinTexture(2.4);
    const breatherPadTex = proceduralSurface('plastic', 5);
    const breatherEyeTex = wetGoatEyeTexture();
    this.breather.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const remap = (m: THREE.Material) => {
        const hit = breatherMatCache.get(m);
        if (hit) return hit;
        const mm = m.clone() as THREE.MeshStandardMaterial;
        if (/wet_eye_yellow/.test(mm.name)) {
          mm.color.setHex(0xc9b84f); mm.emissive.setHex(0x5c4b12); mm.emissiveIntensity = 0.045; mm.roughness = 0.018; mm.metalness = 0.0; mm.map = breatherEyeTex;
          this.breatherEyeMats.push(mm);
        } else if (/purple_vein/.test(mm.name)) {
          mm.color.setHex(0x551047); mm.emissive.setHex(0x250029); mm.emissiveIntensity = 0.18; mm.roughness = 0.42;
        } else if (/tile_skin_warm_grey/.test(mm.name)) {
          mm.color.setHex(0xa8877c); mm.roughness = 0.43; mm.emissive.setHex(0x1a0905); mm.emissiveIntensity = 0.12; mm.map = breatherSkinTex; mm.roughnessMap = breatherSkinTex; mm.bumpMap = breatherSkinTex; mm.bumpScale = 0.022;
        } else if (/tile_skin_pressure_edges/.test(mm.name)) {
          mm.color.setHex(0xb59588); mm.roughness = 0.36; mm.emissive.setHex(0x1d0b06); mm.emissiveIntensity = 0.10; mm.map = breatherSkinTex; mm.roughnessMap = breatherSkinTex; mm.bumpMap = breatherSkinTex; mm.bumpScale = 0.018;
        } else if (/cracked_nail_yellow/.test(mm.name)) {
          mm.color.setHex(0xb98f32); mm.roughness = 0.42; mm.map = breatherPadTex; mm.bumpMap = breatherPadTex; mm.bumpScale = 0.007;
        } else if (/suction_pad_pale/.test(mm.name)) {
          mm.color.setHex(0x8e7262); mm.roughness = 0.46; mm.map = breatherPadTex; mm.roughnessMap = breatherPadTex; mm.bumpMap = breatherPadTex; mm.bumpScale = 0.01;
        }
        mm.needsUpdate = true;
        breatherMatCache.set(m, mm);
        return mm;
      };
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const mapped = mats.map(remap);
      mesh.material = Array.isArray(mesh.material) ? mapped : mapped[0]!;
      const fingerHit = /^finger_(\d+)_/.exec(mesh.name);
      if (fingerHit && !Array.isArray(mesh.material)) {
        const bi = Number(fingerHit[1]);
        const fm = (mesh.material as THREE.MeshStandardMaterial).clone();
        fm.roughness = 0.48 + hash(bi * 3.7) * 0.22;
        fm.color.offsetHSL((hash(bi * 5.1) - 0.5) * 0.025, (hash(bi * 2.3) - 0.5) * 0.08, (hash(bi * 7.9) - 0.5) * 0.09); fm.envMapIntensity = 0.45;
        fm.needsUpdate = true; mesh.material = fm;
      }
    });
    const phoneResolved = resolveAsset('threshold/beige_phone');
    this.phoneAsset = await GLTFManager.instantiate(phoneResolved.url, { ...phoneResolved.manifest.load, castShadow: true, receiveShadow: true });
    this.phoneAsset.root.position.set(0.38, 0.785, -5.76);
    this.phoneAsset.root.rotation.y = -0.48;
    this.phoneAsset.root.scale.setScalar(1.2);
    this.s.add(this.phoneAsset.root);
    this.glbReceiver = this.phoneAsset.part('receiver') ?? undefined;
    // Keep the authored Blender phone as one coherent assembly. Scaling individual child
    // meshes distorts the cradle/keypad alignment at close range; the root scale above is
    // already the intended world size.
    const kitResolved = resolveAsset('threshold/z1_office_kit');
    const packResolved = resolveAsset('threshold/z1_prop_pack');
    this.officeKit = await GLTFManager.instantiate(kitResolved.url, { ...kitResolved.manifest.load, castShadow: true, receiveShadow: true });
    this.propPack = await GLTFManager.instantiate(packResolved.url, { ...packResolved.manifest.load, castShadow: true, receiveShadow: true });
    this.layer = new Layer2D(this.ctx.W, this.ctx.H);
    this.s.background = new THREE.Color(0x050505);
    this.s.fog = new THREE.FogExp2(0x111008, 0.026);
    this.flash = addFlashlight(this.s);
    const breatherUnderfill = new THREE.PointLight(0xffc2a0, 0.85, 4.2, 2); breatherUnderfill.position.set(0, 1.65, -5.65); this.s.add(breatherUnderfill);
    this.s.add(new THREE.AmbientLight(0x9a9278, 0.43));

    const carpet = surfaceMat('carpet', 0x756947, 0.94, 18);
    const wall = surfaceMat('fabric', 0xa89354, 0.86, 8);
    const wallDark = surfaceMat('fabric', 0x796a3f, 0.9, 8);
    const ceiling = surfaceMat('ceiling', 0xcfc8b1, 0.82, 2.8);
    const metal = surfaceMat('metal', 0x595c5b, 0.5, 2.2, 0.35);
    const plastic = surfaceMat('plastic', 0xcdbd91, 0.56, 2.4);
    const dark = mat(0x101010, 0.9);
    const paper = surfaceMat('paper', 0xbdb49c, 0.94, 2.6);
    const green = mat(0x204020, 0.5, 0, 0x25ff56, 0.8);
    const red = mat(0x5d1512, 0.45, 0, 0xff1f18, 1.8);
    const screenTex = officeScreenTexture();
    const screen = new THREE.MeshStandardMaterial({ color: 0x1c3032, roughness: 0.24, map: screenTex, emissive: 0x5de6e0, emissiveMap: screenTex, emissiveIntensity: 1.05 });
    this.assetMats = {
      crt_phosphor: screen,
      worn_laminate: surfaceMat('laminate', 0x8b8066, 0.76, 2.5),
      scuffed_office_metal: surfaceMat('metal', 0x5b5d59, 0.54, 2.2, 0.35),
      worn_edge_dark: surfaceMat('plastic', 0x292a26, 0.74, 2),
      blackened_plastic: surfaceMat('plastic', 0x151615, 0.7, 2.2),
      chair_fabric_bluegrey: surfaceMat('fabric', 0x46515a, 0.9, 5),
      old_beige_plastic: surfaceMat('plastic', 0xc9bb96, 0.58, 2.3),
      aged_paper: surfaceMat('paper', 0xb8ae92, 0.94, 2.7),
      corkboard: surfaceMat('paper', 0x765333, 0.94, 4),
      cardboard: surfaceMat('paper', 0x7b5f42, 0.92, 2),
      cardboard_dark: surfaceMat('paper', 0x54412e, 0.94, 2),
      cubicle_fabric_mustard: surfaceMat('fabric', 0xa89255, 0.9, 6),
      cubicle_fabric_faded: surfaceMat('fabric', 0x83764e, 0.93, 6),
      cubicle_trim_metal: surfaceMat('metal', 0x555851, 0.56, 2.4, 0.28),
      pinboard_cork: surfaceMat('paper', 0x6d4d2e, 0.95, 4),
      ceiling_tile_fissured: surfaceMat('ceiling', 0xc9c1aa, 0.86, 2.6),
      tile_water_stain: surfaceMat('ceiling', 0x8e8269, 0.94, 2.4),
      ceiling_grid_oxidized: surfaceMat('metal', 0x53554e, 0.58, 2.2, 0.32),
      firedoor_paint: surfaceMat('metal', 0x5b5648, 0.72, 2.4, 0.12),
    };
    this.doorGlow = mat(0xfff4c8, 0.3, 0, 0xfff2b0, 5) as THREE.MeshStandardMaterial;

    box(this.s, 'z1_floor', [30, 0.08, 48], [0, -0.04, -3], carpet);
    // Damp carpet variation and fake contact shadows: the lights are too flat for real shadowing alone.
    for (let i = 0; i < 18; i++) {
      const stain = plane(this.s, `z1_carpet_damp_${i}`, 0.7 + hash(i) * 1.5, 0.35 + hash(i + 2) * 0.8, [(hash(i * 3) - 0.5) * 18, 0.006, -10 + hash(i * 5) * 24], basic(0x2b2418, 0.12 + hash(i) * 0.08), [-Math.PI / 2, 0, hash(i) * 3]);
      stain.renderOrder = 1;
    }
    box(this.s, 'z1_ceiling_slab', [30, 0.08, 48], [0, 2.76, -3], ceiling);
    // perimeter walls and a deliberately non-grid maze of drywall partitions
    box(this.s, 'z1_wall_back', [30, 2.7, 0.16], [0, 1.35, -26], wall);
    box(this.s, 'z1_wall_left', [0.16, 2.7, 34], [-13, 1.35, 3], wallDark);
    box(this.s, 'z1_wall_right', [0.16, 2.7, 34], [13, 1.35, 3], wallDark);
    box(this.s, 'z1_wall_fire', [26, 2.7, 0.16], [0, 1.35, 16], wall);
    const partitions: [number, number, number, number, number][] = [
      [-2.2, -2.5, 0.12, 1.45, 4.5], [2.2, -2.2, 0.12, 1.45, 4.2], [-4.8, 0.5, 4.2, 1.45, 0.12], [6.05, 1.2, 2.1, 1.45, 0.12], [2.72, 1.2, 0.84, 1.45, 0.12],
      [-6.4, -4.6, 0.12, 1.45, 5.4], [6.5, -4.7, 0.12, 1.45, 5.5], [-1.4, 4.2, 0.12, 1.45, 4.5], [6.3, 7.2, 0.12, 1.45, 5.2],
      [-6.1, 7.4, 0.12, 1.45, 5.6], [1.6, 11.4, 5.0, 1.45, 0.12], [-6.8, 12.2, 4.5, 1.45, 0.12], [8.8, 3.3, 0.12, 1.45, 8],
    ];
    partitions.forEach(([x, z, sx, sy, sz], i) => {
      const syv = sy + (hash(i * 3.1) - 0.5) * 0.07;
      box(this.s, `z1_partition_${i}`, [sx, syv, sz], [x, syv / 2, z], i % 2 ? wall : wallDark);
      // Metal/fabric edge caps, seams, pinboard patches and scuffed bases make the systems furniture legible.
      box(this.s, `z1_partition_topcap_${i}`, [Math.max(sx, 0.14), 0.045, Math.max(sz, 0.14)], [x, syv + 0.022, z], metal);
      box(this.s, `z1_partition_bottomrail_${i}`, [Math.max(sx, 0.13), 0.055, Math.max(sz, 0.13)], [x, 0.055, z], metal);
      box(this.s, `z1_partition_scuff_${i}`, [Math.max(sx, 0.14), 0.028, Math.max(sz, 0.14)], [x, 0.105, z], mat(0x2f2a22, 0.94));
      if (sx > sz) {
        box(this.s, `z1_partition_endcap_l_${i}`, [0.055, syv, 0.065], [x - sx / 2, syv / 2, z], metal);
        box(this.s, `z1_partition_endcap_r_${i}`, [0.055, syv, 0.065], [x + sx / 2, syv / 2, z], metal);
        box(this.s, `z1_partition_fabricseam_${i}`, [Math.max(0.2, sx - 0.18), 0.012, 0.15], [x, syv * 0.58, z], mat(0x554b35, 0.92));
        if (i % 2 === 0) box(this.s, `z1_partition_pinboard_${i}`, [0.68, 0.42, 0.16], [x + sx * 0.12, 0.94, z], mat(0x6f4c2b, 0.9));
      } else {
        box(this.s, `z1_partition_endcap_l_${i}`, [0.065, syv, 0.055], [x, syv / 2, z - sz / 2], metal);
        box(this.s, `z1_partition_endcap_r_${i}`, [0.065, syv, 0.055], [x, syv / 2, z + sz / 2], metal);
        box(this.s, `z1_partition_fabricseam_${i}`, [0.15, 0.012, Math.max(0.2, sz - 0.18)], [x, syv * 0.58, z], mat(0x554b35, 0.92));
        if (i % 2 === 0) box(this.s, `z1_partition_pinboard_${i}`, [0.16, 0.42, 0.68], [x, 0.94, z + sz * 0.08], mat(0x6f4c2b, 0.9));
      }
    });
    // Deep repeated maze beyond the first desk: foreground/midground/background cubicle rows make the office read as endless.
    const deepTubeGlow = mat(0xdfe9d8, 0.24, 0, 0xd9ffd0, 1.7);
    for (let row = 0; row < 6; row++) {
      const z = -8.2 - row * 2.8;
      for (const side of [-1, 1]) {
        box(this.s, `z1_deep_partition_${row}_${side}`, [0.12, 1.42, 1.9], [side * (2.7 + (row % 2) * 1.2), 0.71, z], row % 2 ? wall : wallDark);
        box(this.s, `z1_deep_cross_${row}_${side}`, [2.5, 1.35, 0.11], [side * 4.3, 0.675, z - 0.85], row % 2 ? wallDark : wall);
        box(this.s, `z1_deep_desk_${row}_${side}`, [1.25, 0.07, 0.62], [side * (3.7 + (row % 2) * 0.8), 0.72, z + 0.35], mat(0x6f695c, 0.65));
        box(this.s, `z1_deep_monitor_${row}_${side}`, [0.36, 0.28, 0.28], [side * (3.7 + (row % 2) * 0.8), 1.0, z + 0.18], dark, [0, -side * 0.25, 0]);
        if ((row + (side > 0 ? 1 : 0)) % 2 === 0) plane(this.s, `z1_deep_screen_${row}_${side}`, 0.24, 0.16, [side * (3.7 + (row % 2) * 0.8), 1.01, z + 0.03], screen, [0, -side * 0.25, 0]);
      }
      if (row % 2 === 0) {
        box(this.s, `z1_deep_troffer_${row}`, [1.1, 0.05, 0.32], [row % 4 ? -2.2 : 2.1, 2.62, z], metal);
        box(this.s, `z1_deep_tube_${row}`, [0.85, 0.025, 0.08], [row % 4 ? -2.2 : 2.1, 2.58, z], deepTubeGlow);
        const dp = new THREE.PointLight(0xdfffd2, 0.75, 4.5, 1.7); dp.position.set(row % 4 ? -2.2 : 2.1, 2.35, z); this.s.add(dp);
      }
    }

    // Dense workstation pods: repeated desks/chairs/monitors/props ground the maze as a working office rather than empty partitions.
    const cubicleFabric = [surfaceMat('fabric', 0xb09b6d, 0.94, 8.5), surfaceMat('fabric', 0x998b64, 0.95, 8.2), surfaceMat('fabric', 0x8b8270, 0.92, 7.8)];
    const deskTop = surfaceMat('laminate', 0x807866, 0.66, 2.4);
    const keyboardMat = mat(0x242422, 0.7);
    const podChairMat = mat(0x46525c, 0.72);
    let pod = 0;
    for (let zi = 0; zi < 11; zi++) {
      const z = -10.4 + zi * 2.35;
      for (const side of [-1, 1]) {
        // Keep the camera/run corridors open while filling both sides of the maze.
        if (z > 0.5 && z < 10.5 && side === 1) continue;
        if (z > 8.5 && side === -1 && zi % 2 === 1) continue;
        const lane = z < 0 ? (zi % 3 === 0 ? 5.2 : 3.65) : (zi % 3 === 0 ? 6.7 : 4.15);
        const x = side * lane;
        const face = -side;
        // cubicle shell: thicker fabric walls, top/bottom rails, pinboard patches
        box(this.s, `z1_pod_wall_back_${pod}`, [1.85, 1.42, 0.11], [x, 0.71, z - 0.72], cubicleFabric[pod % 3]!);
        box(this.s, `z1_pod_wall_side_${pod}`, [0.11, 1.42, 1.45], [x + side * 0.93, 0.71, z], cubicleFabric[(pod + 1) % 3]!);
        box(this.s, `z1_pod_toprail_${pod}`, [1.9, 0.045, 0.14], [x, 1.44, z - 0.72], metal);
        box(this.s, `z1_pod_pinboard_${pod}`, [0.72, 0.48, 0.018], [x - side * 0.28, 1.04, z - 0.655], mat(0x6f4c2b, 0.9));
        for (let pin = 0; pin < 3; pin++) plane(this.s, `z1_pod_note_${pod}_${pin}`, 0.11, 0.13, [x - side * (0.48 - pin * 0.18), 1.03 + (pin % 2) * 0.12, z - 0.642], pin % 2 ? paper : mat(0xd8c84e, 0.82), [0, 0, (hash(pod + pin) - 0.5) * 0.25]);
        // work surface, legs, monitor, keyboard, phone/clipboard/cup variations
        box(this.s, `z1_pod_desk_${pod}`, [1.55, 0.065, 0.68], [x, 0.72, z], deskTop);
        box(this.s, `z1_pod_deskleg_l_${pod}`, [0.055, 0.7, 0.58], [x - 0.65, 0.35, z], metal);
        box(this.s, `z1_pod_deskleg_r_${pod}`, [0.055, 0.7, 0.58], [x + 0.65, 0.35, z], metal);
        box(this.s, `z1_pod_monitor_${pod}`, [0.42, 0.32, 0.25], [x - side * 0.28, 0.96, z - 0.15], dark, [0, face * 0.28, 0]);
        plane(this.s, `z1_pod_screen_${pod}`, 0.31, 0.21, [x - side * 0.28, 0.97, z + 0.0], screen, [0, face * 0.28, 0]);
        box(this.s, `z1_pod_keyboard_${pod}`, [0.42, 0.025, 0.14], [x + side * 0.05, 0.765, z + 0.16], keyboardMat, [0, face * 0.1, 0]);
        if (pod % 3 !== 1) cyl(this.s, `z1_pod_cup_${pod}`, 0.035, 0.075, [x + side * 0.46, 0.79, z - 0.18], mat(pod % 2 ? 0xaaa18a : 0x7b3f32, 0.55), [0, 0, 0], 14);
        if (pod % 4 === 0) box(this.s, `z1_pod_clipboard_${pod}`, [0.24, 0.012, 0.33], [x + side * 0.38, 0.765, z + 0.1], paper, [0, hash(pod) * 0.8, 0]);
        if (pod % 5 === 0) box(this.s, `z1_pod_cableclump_${pod}`, [0.34, 0.035, 0.12], [x - side * 0.34, 0.035, z + 0.35], dark, [0, hash(pod) * 1.5, 0]);
        // grounded rolling chair with base/post and contact patch
        box(this.s, `z1_pod_chair_seat_${pod}`, [0.42, 0.11, 0.42], [x + face * 0.35, 0.43, z + 0.55], podChairMat, [0, hash(pod) * 1.6, 0]);
        box(this.s, `z1_pod_chair_back_${pod}`, [0.43, 0.52, 0.09], [x + face * 0.35, 0.78, z + 0.75], podChairMat, [0.08, hash(pod) * 1.6, 0]);
        cyl(this.s, `z1_pod_chair_post_${pod}`, 0.025, 0.34, [x + face * 0.35, 0.2, z + 0.55], metal, [0, 0, 0], 10);
        plane(this.s, `z1_pod_contact_${pod}`, 1.8, 1.35, [x, 0.007 + pod * 0.00002, z + 0.1], basic(0x050403, 0.2), [-Math.PI / 2, 0, hash(pod) * 0.5]);
        pod++;
      }
    }
    // Half-cropped foreground workstations establish the office as occupied space immediately around the opening camera.
    for (const [i, x] of [0, 1].entries()) {
      const side = i === 0 ? -1 : 1;
      const px = side * 1.85, z = -2.15 - i * 0.35;
      box(this.s, `z1_frontpod_desk_${i}`, [1.28, 0.07, 0.62], [px, 0.72, z], deskTop, [0, -side * 0.16, 0]);
      box(this.s, `z1_frontpod_monitor_${i}`, [0.36, 0.29, 0.23], [px - side * 0.12, 0.95, z - 0.1], dark, [0, side * 0.28, 0]);
      plane(this.s, `z1_frontpod_screen_${i}`, 0.27, 0.18, [px - side * 0.12, 0.96, z + 0.03], screen, [0, side * 0.28, 0]);
      box(this.s, `z1_frontpod_keyboard_${i}`, [0.36, 0.024, 0.13], [px + side * 0.12, 0.765, z + 0.12], keyboardMat, [0, -side * 0.08, 0]);
      box(this.s, `z1_frontpod_chair_seat_${i}`, [0.42, 0.1, 0.42], [px + side * 0.42, 0.43, z + 0.48], podChairMat, [0, side * 0.8, 0]);
      box(this.s, `z1_frontpod_chair_back_${i}`, [0.43, 0.48, 0.085], [px + side * 0.48, 0.76, z + 0.69], podChairMat, [0.08, side * 0.8, 0]);
      cyl(this.s, `z1_frontpod_chair_post_${i}`, 0.026, 0.34, [px + side * 0.42, 0.2, z + 0.48], metal, [0, 0, 0], 10);
      for (let leg = 0; leg < 4; leg++) box(this.s, `z1_frontpod_chair_leg_${i}_${leg}`, [0.25, 0.025, 0.035], [px + side * 0.42, 0.055, z + 0.48], metal, [0, leg * Math.PI / 2 + side * 0.3, 0]);
      box(this.s, `z1_frontpod_papers_${i}`, [0.28, 0.035, 0.32], [px + side * 0.35, 0.77, z - 0.12], paper, [0, hash(i) * 0.8, 0]);
      plane(this.s, `z1_frontpod_contact_${i}`, 1.5, 1.05, [px, 0.008 + i * 0.00003, z + 0.1], basic(0x050403, 0.22), [-Math.PI / 2, 0, side * 0.2]);
    }

    // Opening side-aisle clutter: papers, boxes, cables, a tucked chair and dead plant frame the walk lane without blocking the phone sightline.
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (0.92 + hash(i * 2.1) * 1.35);
      const z = -0.55 - i * 0.24 - hash(i * 3.3) * 0.18;
      plane(this.s, `z1_opening_printout_${i}`, 0.15 + hash(i) * 0.07, 0.2 + hash(i + 4) * 0.07, [x, 0.014 + i * 0.00003, z], paper, [-Math.PI / 2, 0, hash(i * 5.1) * Math.PI]);
    }
    box(this.s, 'z1_opening_cardboard_l', [0.52, 0.38, 0.46], [-2.75, 0.19, -0.85], mat(0x7d6040, 0.88), [0, 0.22, 0]);
    box(this.s, 'z1_opening_cardboard_r', [0.44, 0.28, 0.4], [2.85, 0.14, -3.15], mat(0x6e5337, 0.9), [0, -0.34, 0]);
    box(this.s, 'z1_opening_powerstrip', [0.34, 0.045, 0.09], [1.34, 0.035, -1.55], mat(0xd0c9b4, 0.62), [0, 0.32, 0]);
    cyl(this.s, 'z1_opening_powercable', 0.009, 0.9, [1.0, 0.022, -1.3], dark, [Math.PI / 2, 0.7, 0], 8);
    box(this.s, 'z1_opening_tucked_chair_seat', [0.42, 0.1, 0.42], [-1.35, 0.43, -3.25], podChairMat, [0, -0.7, 0]);
    box(this.s, 'z1_opening_tucked_chair_back', [0.43, 0.46, 0.085], [-1.48, 0.74, -3.43], podChairMat, [0.08, -0.7, 0]);
    cyl(this.s, 'z1_opening_tucked_chair_post', 0.026, 0.34, [-1.35, 0.2, -3.25], metal, [0, 0, 0], 10);
    cyl(this.s, 'z1_opening_deadplant_pot', 0.13, 0.24, [2.55, 0.12, -0.72], mat(0x6d4631, 0.86), [0, 0, 0], 16);
    for (let i = 0; i < 5; i++) cyl(this.s, `z1_opening_deadplant_stem_${i}`, 0.009, 0.48 + hash(i) * 0.2, [2.55 + (hash(i * 2) - 0.5) * 0.12, 0.42, -0.72 + (hash(i * 3) - 0.5) * 0.12], mat(0x4b3b21, 0.9), [(hash(i) - 0.5) * 0.5, 0, (hash(i + 2) - 0.5) * 0.5], 7);

    // Camera-facing pinboards on the two opening partitions break up the large fabric slabs at readable distance.
    for (const [side, rotY] of [[-1, Math.PI / 2], [1, -Math.PI / 2]] as const) {
      const x = side * 2.135;
      for (let b = 0; b < 2; b++) {
        const z = -1.55 - b * 1.15;
        plane(this.s, `z1_opening_pinboard_${side}_${b}`, 0.68, 0.42, [x, 1.0, z], mat(0x6f4c2b, 0.9), [0, rotY, 0]);
        for (let nnote = 0; nnote < 3; nnote++) {
          plane(this.s, `z1_opening_pin_note_${side}_${b}_${nnote}`, 0.09, 0.11, [x - side * 0.006, 0.93 + (nnote % 2) * 0.13, z - 0.19 + nnote * 0.17], nnote % 2 ? paper : mat(0xd8c84e, 0.82), [0, rotY, (hash(b * 7 + nnote) - 0.5) * 0.28]);
        }
      }
    }

    // Run-lane island workstations are deliberately close to the camera path so chase frames remain spatially dressed.
    const runPods: [number, number][] = [[-2.3, 1.7], [0.4, 3.6], [1.0, 5.8], [0.7, 8.0], [2.2, 10.4], [0.8, 12.4]];
    runPods.forEach(([x, z], i) => {
      box(this.s, `z1_runisland_desk_${i}`, [1.35, 0.07, 0.66], [x, 0.72, z], deskTop, [0, (i % 2 ? -0.18 : 0.18), 0]);
      box(this.s, `z1_runisland_monitor_${i}`, [0.38, 0.3, 0.24], [x - 0.18, 0.96, z - 0.12], dark, [0, 0.35 + i * 0.15, 0]);
      plane(this.s, `z1_runisland_screen_${i}`, 0.28, 0.19, [x - 0.18, 0.97, z + 0.02], screen, [0, Math.PI + 0.35 + i * 0.15, 0]);
      box(this.s, `z1_runisland_keyboard_${i}`, [0.38, 0.025, 0.13], [x + 0.12, 0.765, z + 0.14], keyboardMat, [0, 0.2, 0]);
      box(this.s, `z1_runisland_chair_${i}`, [0.44, 0.5, 0.44], [x + 0.48, 0.42, z + 0.48], podChairMat, [0, hash(i) * 2.5, i === 2 ? 0.55 : 0]);
      box(this.s, `z1_runisland_paperstack_${i}`, [0.24, 0.045, 0.3], [x + 0.38, 0.78, z - 0.12], paper, [0, hash(i) * 0.7, 0]);
      if (i % 2 === 0) cyl(this.s, `z1_runisland_cup_${i}`, 0.035, 0.075, [x - 0.43, 0.79, z + 0.12], mat(0xaaa18a, 0.55), [0, 0, 0], 14);
      plane(this.s, `z1_runisland_contact_${i}`, 1.65, 1.1, [x + 0.1, 0.008 + i * 0.00003, z + 0.18], basic(0x050403, 0.22), [-Math.PI / 2, 0, hash(i) * 0.4]);
    });

    // Ground-level paper/cable clutter in the run lanes, dense enough to orient fast chase frames.
    for (let i = 0; i < 44; i++) {
      const z = -2 + hash(i * 2.7) * 17;
      const x = (hash(i * 4.1) - 0.5) * 8 + (i % 5 === 0 ? 3.5 : 0);
      plane(this.s, `z1_floor_paper_${i}`, 0.15 + hash(i) * 0.07, 0.2 + hash(i + 1) * 0.07, [x, 0.012 + i * 0.00002, z], paper, [-Math.PI / 2, 0, hash(i + 2) * Math.PI]);
      if (i % 7 === 0) cyl(this.s, `z1_floor_cable_${i}`, 0.009, 0.75 + hash(i) * 0.8, [x + 0.25, 0.018, z - 0.1], dark, [Math.PI / 2, hash(i) * 2, 0], 8);
    }

    // suspended ceiling T-bar grid and individual tiles around the camera path
    const gridMat = mat(0x8c8879, 0.48, 0.2);
    for (let x = -9; x <= 9; x += 0.6) box(this.s, `z1_grid_x_${x.toFixed(1)}`, [0.018, 0.025, 25], [x, 2.705, 1.5], gridMat);
    for (let z = -11; z <= 15; z += 0.6) box(this.s, `z1_grid_z_${z.toFixed(1)}`, [19, 0.025, 0.018], [0, 2.706, z], gridMat);
    let ti = 0;
    for (let x = -7.2; x <= 7.2; x += 1.2) for (let z = -9; z <= 14; z += 1.2) {
      if (Math.abs(x) < 0.8 && z > -6.8 && z < -5.4) continue; // creature gap
      if (hash(ti * 3.1) < 0.055) { ti++; continue; } // missing tiles
      const sag = hash(ti * 5.7) < 0.08 ? 0.035 : 0;
      const tile = box(this.s, `z1_ceiling_tile_${ti}`, [1.12, 0.025, 1.12], [x, 2.69 - sag, z], ceiling);
      if (Math.abs(x) < 1 && z > -7 && z < -5) this.tileShift = tile;
      if (hash(ti * 8.3) < 0.13) {
        const stain = cyl(this.s, `z1_water_ring_${ti}`, 0.32, 0.006, [x + 0.1, 2.675 - sag, z - 0.06], mat(0x57442d, 0.95), [Math.PI / 2, 0, 0], 32);
        stain.scale.z = 0.45;
      }
      ti++;
    }
    // fluorescent troffers: every fourth cell near path, two failing
    const tubeMatA = mat(0xdfe9d8, 0.24, 0, 0xe7ffe0, 2.6) as THREE.MeshStandardMaterial;
    const tubeMatB = mat(0xdfe9d8, 0.24, 0, 0xe7ffe0, 2.6) as THREE.MeshStandardMaterial;
    this.tubeMats = [tubeMatA, tubeMatB];
    let li = 0;
    for (const [x, z] of [[-3, -7], [0, -4], [3, -1], [-3, 2], [3, 5], [0, 8], [-4, 12], [4, 12]] as const) {
      box(this.s, `z1_troffer_${li}`, [1.15, 0.06, 0.34], [x, 2.66, z], metal);
      box(this.s, `z1_tube_a_${li}`, [0.48, 0.025, 0.08], [x - 0.25, 2.61, z], tubeMatA);
      box(this.s, `z1_tube_b_${li}`, [0.48, 0.025, 0.08], [x + 0.25, 2.61, z], tubeMatB);
      const p = new THREE.PointLight(0xdfffd2, 1.9, 7, 1.5); p.position.set(x, 2.35, z); this.s.add(p); this.tubeLights.push(p);
      li++;
    }

    // desk, phone and office dressing
    box(this.s, 'z1_desk_top', [2.0, 0.09, 0.9], [0, 0.74, -6], mat(0x6c675d, 0.55));
    box(this.s, 'z1_desk_leg_l', [0.08, 0.72, 0.8], [-0.86, 0.36, -6], metal);
    box(this.s, 'z1_desk_leg_r', [0.08, 0.72, 0.8], [0.86, 0.36, -6], metal);
    box(this.s, 'z1_phone_base', [0.42, 0.13, 0.28], [0.28, 0.84, -6.05], plastic, [0, -0.12, 0]);
    this.receiver = box(this.s, 'z1_phone_receiver', [0.26, 0.055, 0.075], [0.28, 0.96, -6.05], plastic, [0, -0.12, 0]);
    for (let i = 0; i < 12; i++) box(this.s, `z1_phone_button_${i}`, [0.045, 0.012, 0.035], [0.16 + (i % 3) * 0.055, 0.912, -5.94 + Math.floor(i / 3) * 0.045], dark);
    box(this.s, 'z1_crt_monitor', [0.56, 0.42, 0.46], [-0.52, 1.02, -6.18], dark, [0, 0.22, 0]);
    plane(this.s, 'z1_monitor_screen', 0.42, 0.28, [-0.52, 1.04, -5.94], screen, [0, 0.22, 0]);
    cyl(this.s, 'z1_coffee_mug', 0.055, 0.11, [-0.18, 0.84, -5.78], mat(0xaaa18a, 0.5));
    cyl(this.s, 'z1_mould_ring', 0.065, 0.004, [-0.18, 0.905, -5.78], mat(0x25301d, 0.95), [Math.PI / 2, 0, 0], 24);
    for (let i = 0; i < 8; i++) box(this.s, `z1_sticky_${i}`, [0.09, 0.006, 0.09], [-0.75 + hash(i) * 0.4, 0.795, -5.78 + hash(i + 4) * 0.25], mat(i % 2 ? 0xd8c84e : 0xd89348, 0.8), [0, hash(i + 8) * 0.8, 0]);

    // Hero beige phone detail: shell seams, handset endcaps, speaker holes, keypad legends, cord and worn laminate edges.
    box(this.s, 'z1_phone_shell_seam_front', [0.39, 0.012, 0.012], [0.28, 0.888, -5.895], mat(0x7a684d, 0.7));
    box(this.s, 'z1_phone_shell_seam_side', [0.012, 0.012, 0.24], [0.075, 0.888, -6.05], mat(0x7a684d, 0.7));
    for (const side of [-1, 1]) {
      const cap = cyl(this.s, `z1_receiver_endcap_${side}`, 0.058, 0.105, [0.28 + side * 0.19, 0.965, -6.05], plastic, [0, 0, Math.PI / 2], 20);
      cap.userData.baseY = cap.position.y; this.receiverParts.push(cap);
      for (let h = 0; h < 5; h++) {
        const hole = cyl(this.s, `z1_receiver_hole_${side}_${h}`, 0.005, 0.006, [0.28 + side * (0.16 + (h % 2) * 0.025), 1.018, -6.085 + Math.floor(h / 2) * 0.028], dark, [Math.PI / 2, 0, 0], 8);
        hole.userData.baseY = hole.position.y; this.receiverParts.push(hole);
      }
    }
    for (let i = 0; i < 12; i++) {
      const bx = 0.16 + (i % 3) * 0.055, bz = -5.94 + Math.floor(i / 3) * 0.045;
      box(this.s, `z1_phone_button_legend_${i}`, [0.018, 0.004, 0.004], [bx, 0.921, bz], mat(0xd8cfb7, 0.75));
    }
    const cordPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const u = i / 64;
      const ax = 0.06 + u * 0.07 - Math.sin(u * Math.PI) * 0.095;
      const ay = 0.91 + u * 0.02 - Math.sin(u * Math.PI) * 0.13;
      const az = -6.16 + u * 0.18 + Math.sin(u * Math.PI) * 0.035;
      const phase = u * Math.PI * 28;
      cordPts.push(new THREE.Vector3(ax + Math.cos(phase) * 0.011, ay + Math.sin(phase) * 0.011, az + Math.cos(phase + Math.PI / 2) * 0.011));
    }
    const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cordPts), 42, 0.007, 8), dark);
    cord.name = cord.userData.fx_entity = 'z1_phone_coiled_cord'; cord.castShadow = cord.receiveShadow = true; this.s.add(cord);
    // The authored Blender beige phone is the visible hero prop; the engine primitives remain only as hidden fallback geometry.
    this.s.traverse((o) => { if (/^z1_(phone|receiver)_/.test(o.name) || o.name === 'z1_mould_ring' || o.name.startsWith('z1_monitor_control_')) o.visible = false; });

    // Blender-built kit/prop modules replace the most scrutinized primitive office objects.
    this.s.traverse((o) => {
      if (/^z1_(desk_top|desk_leg_|crt_monitor|monitor_screen|coffee_mug|frontpod_(desk|monitor|screen|keyboard|chair)|opening_tucked_chair|runisland_(desk|monitor|screen|keyboard|chair))/.test(o.name)) o.visible = false;
      if (o.name.startsWith('z1_partition_')) o.visible = false;
    });
    this.cloneProp(this.propPack, 'desk_root', [0, 0, -6], 0, 1.08, 'z1_hero_desk_asset');
    this.cloneProp(this.propPack, 'crt_root', [-0.52, 0.77, -6.17], 0.22, 1.0, 'z1_hero_crt_asset');
    this.cloneProp(this.propPack, 'keyboard_root', [-0.34, 0.77, -5.74], -0.08, 1.0, 'z1_hero_keyboard_asset');
    this.cloneProp(this.propPack, 'mug_root', [0.02, 0.77, -5.62], 0, 1.0, 'z1_hero_mug_asset');
    for (const [i, x] of [0, 1].entries()) {
      const side = i === 0 ? -1 : 1, px = side * 1.85, z = -2.15 - i * 0.35;
      this.cloneProp(this.propPack, 'desk_root', [px, 0, z], -side * 0.16, 0.78, `z1_frontdesk_asset_${i}`);
      this.cloneProp(this.propPack, 'crt_root', [px - side * 0.12, 0.77, z - 0.1], side * 0.28, 0.78, `z1_frontcrt_asset_${i}`);
      this.cloneProp(this.propPack, 'chair_upright_root', [px + side * 0.42, 0, z + 0.48], side * 0.8, 0.95, `z1_frontchair_asset_${i}`);
    }
    for (const side of [-1, 1]) for (let j = 0; j < 2; j++) {
      this.cloneProp(this.officeKit, 'cubicle_panel_180_root', [side * 2.2, 0, -3.15 + j * 1.78], Math.PI / 2, 1, `z1_opening_panel_asset_${side}_${j}`);
    }
    partitions.forEach(([x, z, sx, , sz], i) => {
      const horizontal = sx > sz;
      const len = horizontal ? sx : sz;
      const count = Math.max(1, Math.ceil(len / 1.78));
      for (let j = 0; j < count; j++) {
        const off = (j - (count - 1) / 2) * 1.78;
        const pos: [number, number, number] = horizontal ? [x + off, 0, z] : [x, 0, z + off];
        const part = (i + j) % 5 === 4 ? 'cubicle_panel_120_root' : 'cubicle_panel_180_root';
        this.cloneProp(this.officeKit, part, pos, horizontal ? 0 : Math.PI / 2, 1, `z1_partition_asset_${i}_${j}`);
      }
    });
    this.cloneProp(this.propPack, 'chair_missing_wheel_root', [-1.35, 0, -3.25], -0.7, 0.95, 'z1_opening_tucked_chair_asset');
    const assetRunPods: [number, number][] = [[-2.3, 1.7], [0.4, 3.6], [1.0, 5.8], [0.7, 8.0], [2.2, 10.4], [0.8, 12.4]];
    assetRunPods.forEach(([x, z], i) => {
      this.cloneProp(this.propPack, 'desk_root', [x, 0, z], (i % 2 ? -0.18 : 0.18), 0.82, `z1_rundesk_asset_${i}`);
      this.cloneProp(this.propPack, 'crt_root', [x - 0.18, 0.77, z - 0.12], 0.35 + i * 0.15, 0.78, `z1_runcrt_asset_${i}`);
      this.cloneProp(this.propPack, i === 2 ? 'chair_tipped_root' : 'chair_upright_root', [x + 0.48, 0, z + 0.48], hash(i) * 2.5, 0.9, `z1_runchair_asset_${i}`);
    });
    for (let i = 0; i < 7; i++) box(this.s, `z1_desk_scratch_${i}`, [0.055 + hash(i) * 0.13, 0.002, 0.0035], [-0.55 + hash(i * 2) * 1.1, 0.792, -5.82 + hash(i * 3) * 0.38], mat(0x62594a, 0.9), [0, hash(i) * 0.8, 0]);
    box(this.s, 'z1_desk_front_edge_worn', [2.02, 0.035, 0.025], [0, 0.735, -5.54], mat(0x3f392f, 0.82));
    const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.008, 8, 18, Math.PI * 1.45), mat(0xaaa18a, 0.55));
    mugHandle.position.set(-0.125, 0.855, -5.78); mugHandle.rotation.set(0, Math.PI / 2, 0.2); mugHandle.name = mugHandle.userData.fx_entity = 'z1_coffee_mug_handle'; mugHandle.castShadow = mugHandle.receiveShadow = true; this.s.add(mugHandle);
    for (let i = 0; i < 5; i++) box(this.s, `z1_monitor_control_${i}`, [0.025, 0.009, 0.008], [-0.66 + i * 0.045, 0.82, -5.93], mat(0x0c0c0c, 0.8));

    // chairs/cubicle desks/printer/paper clutter along run path
    const chairMat = mat(0x46525c, 0.72);
    for (let i = 0; i < 7; i++) {
      const x = [-3.5, 3.7, -5.3, 5.4, -2.4, 6.7, -6.2][i]!, z = [-1.5, -0.5, 2.7, 3.6, 6.2, 8.3, 10.5][i]!;
      box(this.s, `z1_cubicle_desk_${i}`, [1.35, 0.07, 0.7], [x, 0.72, z], mat(0x716b5e, 0.6));
      const c = box(this.s, `z1_chair_${i}`, [0.48, 0.52, 0.48], [x + 0.45, 0.42, z + 0.45], chairMat, [0, hash(i) * 2, i === 2 ? 0.7 : 0]);
      cyl(this.s, `z1_chair_post_${i}`, 0.035, 0.36, [x + 0.45, 0.18, z + 0.45], metal);
      if (i === 4) this.chair = c;
      for (let p = 0; p < 4; p++) plane(this.s, `z1_printout_${i}_${p}`, 0.22, 0.3, [x - 0.35 + p * 0.17, 0.765 + p * 0.001, z - 0.1 + hash(i + p) * 0.28], paper, [-Math.PI / 2, 0, hash(i * 7 + p) * 0.9]);
    }
    box(this.s, 'z1_printer', [0.58, 0.32, 0.48], [5.8, 0.82, 5.2], mat(0xb8b2a4, 0.5));
    box(this.s, 'z1_filing_cabinet', [0.55, 1.25, 0.62], [-4.8, 0.62, -2.8], metal);
    box(this.s, 'z1_open_drawer', [0.5, 0.16, 0.5], [-4.8, 0.92, -2.35], metal);
    cyl(this.s, 'z1_water_cooler_bottle', 0.18, 0.48, [6.8, 1.05, -2.5], mat(0x7ea7bb, 0.2, 0, 0x223a44, 0.1), [0, 0, 0], 28);
    cyl(this.s, 'z1_water_cooler_base', 0.2, 0.72, [6.8, 0.36, -2.5], mat(0xd0cec3, 0.55));
    cyl(this.s, 'z1_ficus_pot', 0.18, 0.28, [-2.7, 0.14, -4.2], mat(0x684329, 0.7));
    for (let i = 0; i < 8; i++) cyl(this.s, `z1_dead_ficus_stem_${i}`, 0.012, 0.7 + hash(i) * 0.5, [-2.7 + (hash(i) - 0.5) * 0.22, 0.55, -4.2 + (hash(i + 3) - 0.5) * 0.22], mat(0x2f2719, 0.9), [0.3 * (hash(i) - 0.5), 0, 0.3 * (hash(i + 2) - 0.5)], 8);
    box(this.s, 'z1_cork_board', [1.3, 0.8, 0.04], [-8.2, 1.6, -1], mat(0x73532c, 0.9));
    cyl(this.s, 'z1_wall_clock', 0.22, 0.035, [7.8, 1.8, -1.2], plastic, [Math.PI / 2, 0, 0], 32);
    box(this.s, 'z1_clock_hand', [0.018, 0.006, 0.16], [7.8, 1.8, -1.17], dark, [0, 0.55, 0]);
    for (let i = 0; i < 5; i++) box(this.s, `z1_cardboard_box_${i}`, [0.55, 0.42, 0.48], [-8.5 + hash(i) * 1.5, 0.21, 5.5 + i * 0.55], mat(0x8a6237, 0.85), [0, hash(i + 1) * 0.4, 0]);
    cyl(this.s, 'z1_fire_extinguisher', 0.09, 0.48, [7.9, 0.42, 10.8], mat(0x9b1712, 0.38, 0.15));
    box(this.s, 'z1_wet_floor_sign', [0.5, 0.62, 0.04], [2.2, 0.12, 8.7], mat(0xd9c530, 0.55), [1.25, 0.4, 0]);
    this.ventRibbon = box(this.s, 'z1_vent_dust_ribbon', [0.035, 0.5, 0.012], [-8.9, 2.05, 3.5], mat(0xbdb69d, 0.8));
    box(this.s, 'z1_power_strip', [0.42, 0.06, 0.1], [0.7, 0.04, -5.65], dark);
    for (let i = 0; i < 5; i++) cyl(this.s, `z1_cable_${i}`, 0.012, 0.9, [0.65 + i * 0.05, 0.04, -5.45 + hash(i) * 0.3], dark, [Math.PI / 2, hash(i) * 0.5, 0], 8);
    this.slidingPrintout = plane(this.s, 'z1_sliding_printout', 0.22, 0.3, [0.55, 0.79, -5.76], paper, [-Math.PI / 2, 0, 0.2]);

    for (let i = 0; i < 7; i++) {
      const x = [-3.5, 3.7, -5.3, 5.4, -2.4, 6.7, -6.2][i]!, z = [-1.5, -0.5, 2.7, 3.6, 6.2, 8.3, 10.5][i]!;
      plane(this.s, `z1_contact_shadow_${i}`, 1.7, 1.1, [x + 0.15, 0.008, z + 0.2], basic(0x050403, 0.24), [-Math.PI / 2, 0, hash(i) * 0.4]);
    }
    plane(this.s, 'z1_contact_shadow_desk', 2.25, 1.15, [0, 0.009, -6], basic(0x050403, 0.3), [-Math.PI / 2, 0, 0]);

    // chase-path cubicle evidence: occupied desks and grounded paperwork enter the beam instead of empty grey corridor
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1, z = 0.4 + i * 0.82, x = side * (2.15 + hash(i) * 1.1);
      box(this.s, `z1_chase_desk_edge_${i}`, [0.95, 0.055, 0.52], [x, 0.74, z], this.assetMats.laminate_surface ?? mat(0x6d5b45, 0.65));
      box(this.s, `z1_chase_contact_shadow_${i}`, [0.72, 0.006, 0.34], [x, 0.012, z + 0.18], basic(0x050403, 0.34));
      plane(this.s, `z1_chase_floor_paper_${i}`, 0.22 + hash(i) * 0.16, 0.3, [x + (hash(i + 4) - 0.5) * 0.7, 0.018, z + (hash(i + 5) - 0.5) * 0.5], mat(0xd6cfbd, 0.9), [-Math.PI / 2, 0, hash(i + 6) * 2]);
      if (i % 3 === 0) box(this.s, `z1_chase_keyboard_${i}`, [0.34, 0.025, 0.12], [x - side * 0.08, 0.785, z - 0.04], mat(0x1a1a18, 0.72));
    }

    // fire door, push bar, sign and daylight slit
    box(this.s, 'z1_fire_door', [1.0, 2.1, 0.09], [-2, 1.05, 15.92], this.assetMats.firedoor_paint ?? mat(0x4c5a4e, 0.55));
    box(this.s, 'z1_fire_door_frame_top', [1.18, 0.09, 0.14], [-2, 2.16, 15.9], mat(0x242821, 0.72));
    for (const x of [-2.56,-1.44]) box(this.s, `z1_fire_door_frame_side_${x}`, [0.08, 2.2, 0.14], [x, 1.08, 15.9], mat(0x242821, 0.72));
    // Panic hardware is cylindrical and mounted on standoffs rather than a painted stripe.
    box(this.s, 'z1_exit_push_plate', [0.28, 0.48, 0.018], [-2, 0.83, 15.86], mat(0x77776d, 0.42, 0.35));
    box(this.s, 'z1_exit_kick_plate', [0.84, 0.20, 0.018], [-2, 0.16, 15.858], mat(0x55564f, 0.48, 0.32));
    cyl(this.s, 'z1_fire_pushbar_round', 0.034, 0.72, [-2, 1.04, 15.805], mat(0xa9a89b, 0.26, 0.62), [0, 0, Math.PI / 2], 18);
    for (const x of [-2.31,-1.69]) {
      box(this.s, `z1_pushbar_mount_${x}`, [0.055, 0.12, 0.075], [x, 1.04, 15.845], mat(0x5f6058, 0.34, 0.5));
      cyl(this.s, `z1_pushbar_endcap_${x}`, 0.041, 0.035, [x, 1.04, 15.803], mat(0x8f8e82, 0.3, 0.58), [0, 0, Math.PI / 2], 16);
    }
    for (const y of [0.48,1.08,1.68]) box(this.s, `z1_exit_hinge_${y}`, [0.055,0.18,0.045], [-2.48,y,15.84], mat(0x4c4c45,0.38,0.5));
    for (let i=0;i<7;i++) box(this.s, `z1_exit_scratch_${i}`, [0.16+hash(i)*0.18,0.006,0.008], [-2.25+hash(i+2)*0.5,0.62+hash(i+3)*1.1,15.855], basic(0xd2cdbb,0.35), [0,0,(hash(i+4)-.5)*.5]);
    // Deep frame stop and threshold give the fire door an architectural reveal rather than a flat decal outline.
    for (const x of [-2.49,-1.51]) box(this.s, `z1_frame_inner_stop_${x}`, [0.035, 2.02, 0.055], [x, 1.08, 15.825], mat(0x151812, 0.78));
    box(this.s, 'z1_frame_inner_stop_top', [1.02, 0.035, 0.055], [-2, 2.08, 15.825], mat(0x151812, 0.78));
    box(this.s, 'z1_fire_threshold', [1.14, 0.035, 0.18], [-2, 0.018, 15.82], mat(0x4b4c43, 0.38, 0.45));
    const exitSpill = new THREE.PointLight(0xff8b68, 2.05, 5.6, 1.75); exitSpill.position.set(-2,2.18,15.35); this.s.add(exitSpill);
    // A single surviving cool troffer throws a hard corridor pool toward the red exit:
    // the chase reads as a deliberate warm/cool hero composition rather than uniform murk.
    const chasePoolLight = new THREE.PointLight(0xc9f3d6, 2.25, 6.2, 1.45); chasePoolLight.position.set(1.65,2.22,8.7); this.s.add(chasePoolLight);
    plane(this.s, 'z1_chase_cool_floor_pool', 2.1, 4.8, [1.15, 0.018, 9.4], basic(0x8fbf9f, 0.16), [-Math.PI / 2, 0, -0.18]);
    box(this.s, 'z1_exit_sign_case', [0.66, 0.25, 0.105], [-2, 2.32, 15.82], mat(0x270b08, 0.42, 0.18));
    const exitFace = new THREE.MeshBasicMaterial({ map: exitSignTexture() });
    plane(this.s, 'z1_exit_sign_face', 0.58, 0.19, [-2, 2.32, 15.762], exitFace, [0, Math.PI, 0]);
    plane(this.s, 'z1_daylight_slit', 0.92, 0.045, [-2, 0.035, 15.76], basic(0xfff0ba), [-Math.PI / 2, 0, 0]);

    // true dark rectangular opening behind the creature details; the ordinary slab otherwise reads as solid ceiling
    box(this.s, 'z1_ceiling_gap_black', [1.35, 0.035, 0.92], [0, 2.655, -6.02], basic(0x010101));
    // Broken tile/grid edges make the opening read as torn ceiling rather than a clean black rectangle.
    const brokenEdge = mat(0xb9b09b, 0.9);
    for (let i = 0; i < 12; i++) {
      const side = i % 4;
      const u = (i % 3 - 1) * 0.36 + (hash(i) - 0.5) * 0.12;
      const x = side < 2 ? u : (side === 2 ? -0.69 : 0.69);
      const z = -6.02 + (side < 2 ? (side === 0 ? -0.47 : 0.47) : u * 0.65);
      box(this.s, `z1_gap_broken_edge_${i}`, [side < 2 ? 0.28 + hash(i) * 0.16 : 0.045, 0.035, side < 2 ? 0.045 : 0.22 + hash(i) * 0.18], [x, 2.635 - hash(i + 2) * 0.025, z], brokenEdge, [0.04 * (hash(i) - 0.5), 0, 0.08 * (hash(i + 4) - 0.5)]);
    }
    for (let i = 0; i < 5; i++) box(this.s, `z1_gap_bent_grid_${i}`, [0.018, 0.022, 0.55 + hash(i) * 0.28], [-0.55 + i * 0.27, 2.625, -6.0 + (hash(i) - 0.5) * 0.18], gridMat, [0.08 + hash(i) * 0.12, 0, (hash(i + 5) - 0.5) * 0.18]);
    // creature read in the ceiling gap: eyes, lids, fingers, breathing fused tiles
    const eyeMat = mat(0xd9d07b, 0.22, 0, 0x718c35, 0.32);
    const pupilMat = basic(0x050505);
    for (const x of [-0.35, 0.35]) {
      const e = sph(this.s, x < 0 ? 'z1_eye_l' : 'z1_eye_r', 0.06, [x, 2.58, -6.03], eyeMat, 24);
      e.scale.set(1.15, 0.52, 0.58); this.eyes.push(e);
      const p = box(this.s, x < 0 ? 'z1_pupil_l' : 'z1_pupil_r', [0.055, 0.014, 0.012], [x, 2.57, -5.96], pupilMat);
      const lid = box(this.s, x < 0 ? 'z1_lid_l' : 'z1_lid_r', [0.13, 0.02, 0.07], [x, 2.62, -5.98], mat(0x5b5b53, 0.55));
      this.lids.push(lid); void p;
    }
    for (let i = 0; i < 6; i++) {
      const f = cyl(this.s, `z1_finger_${i}`, 0.026, 0.75 + hash(i) * 0.35, [-0.55 + i * 0.2, 2.43, -6.05 + (hash(i) - 0.5) * 0.18], mat(0x817d76, 0.62), [0.3 + hash(i) * 0.5, 0, (hash(i + 4) - 0.5) * 0.5], 12);
      this.fingers.push(f);
    }
    for (let i = 0; i < 12; i++) {
      const t = box(this.s, `z1_tile_skin_${i}`, [0.56, 0.025, 0.56], [-1.65 + (i % 6) * 0.6, 2.68, -6.6 + Math.floor(i / 6) * 0.6], ceiling);
      this.skinTiles.push(t);
    }
    for (let i = 0; i < 6; i++) {
      const z = 1.8 + i * 2.0;
      const m = box(this.s, `z1_chase_drop_tile_${i}`, [1.1, 0.065, 1.1], [i % 2 ? 2.8 : -0.85, 2.68, z], ceiling);
      // Dark fracture lines are parented to the falling panel so the piece reads as damaged ceiling tile, not a clean card.
      for (let c = 0; c < 3; c++) {
        const cx = (hash(i + c) - 0.5) * 0.48, cz = (hash(i * 3 + c) - 0.5) * 0.48, cw = 0.18 + hash(i * 5 + c) * 0.20, ca = hash(i * 9 + c) * Math.PI;
        plane(m, `z1_drop_tile_crack_top_${i}_${c}`, cw, 0.006, [cx, 0.034 + c * 0.0004, cz], basic(0x241f18, 0.38), [-Math.PI / 2, 0, ca]);
        plane(m, `z1_drop_tile_crack_bottom_${i}_${c}`, cw, 0.007, [cx, -0.034 - c * 0.0004, cz], basic(0x15120e, 0.46), [Math.PI / 2, 0, ca]);
      }
      for (let c = 0; c < 2; c++) box(m, `z1_drop_tile_edge_chip_${i}_${c}`, [0.16 + hash(i + c) * 0.16, 0.018, 0.055], [(c ? 0.48 : -0.48), 0.036, (hash(i * 7 + c) - 0.5) * 0.72], mat(0x8f8875, 0.9), [0, hash(i * 4 + c) * 0.6, 0]);
      // Exposed fibrous mineral core on all four sides keeps the fallen tiles legible
      // edge-on; the face stays pale ceiling material while the thickness reads brown/damaged.
      const core = mat(0xb09262, 0.94);
      const char = mat(0x2b241b, 0.98);
      box(m, `z1_drop_tile_core_n_${i}`, [1.10, 0.060, 0.034], [0, 0, -0.55], core);
      box(m, `z1_drop_tile_core_s_${i}`, [1.10, 0.060, 0.034], [0, 0, 0.55], core);
      box(m, `z1_drop_tile_core_e_${i}`, [0.034, 0.060, 1.10], [0.55, 0, 0], core);
      box(m, `z1_drop_tile_core_w_${i}`, [0.034, 0.060, 1.10], [-0.55, 0, 0], core);
      box(m, `z1_drop_tile_core_split_${i}`, [0.36 + hash(i * 8) * 0.22, 0.056, 0.012], [(hash(i * 11) - 0.5) * 0.42, 0, 0.565], char, [0, hash(i * 13) * 0.45, 0]);
      this.fallingTiles.push({ m, z, t0: 20.1 + i * 1.05, y0: 2.68 });
    }
  }

  private cloneProp(source: GLTFInstance, part: string, pos: [number, number, number], rotY = 0, scale = 1, name = part) {
    const src = source.part(part);
    if (!src) return null;
    const c = skeletonClone(src);
    c.name = c.userData.fx_entity = name;
    c.position.set(...pos);
    c.rotation.set(0, rotY, 0);
    c.scale.setScalar(scale);
    c.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const mapped = mats.map((m) => this.assetMats[m.name] ?? m);
      mesh.material = Array.isArray(mesh.material) ? mapped : mapped[0]!;
    });
    this.s.add(c);
    return c;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const gl = this.ctx.renderer;
    applyFpCamera(this.cam, KEYS, t, out.width / out.height);
    // Override only positional easing through the office chase: the shared rig intentionally
    // smoothsteps ordinary keys, but panic flight must not brake at editorial waypoints.
    if (t >= 19.8 && t <= 30) {
      const continuous = chaseContinuousPos(t), eased = chaseSmoothPos(t);
      const delta = new THREE.Vector3(continuous[0] - eased[0], continuous[1] - eased[1], continuous[2] - eased[2]);
      this.cam.position.add(delta);
      const pose = this.cam.userData.fpPose as { pos: [number, number, number] } | undefined;
      if (pose) { pose.pos[0] += delta.x; pose.pos[1] += delta.y; pose.pos[2] += delta.z; }
    }
    // flicker teaches the creature rule; hard irregular drops from 13s onward
    const flicker = t < 13 ? 0 : t < 15.5 ? 0.14 : t < 19.3 ? 0.32 : t < 27.5 ? 0.16 : 0.06;
    const eyeBeam = 1 - 0.58 * smooth(15.3, 15.8, t) * (1 - smooth(19.2, 19.8, t));
    updateFlashlight(this.flash.light, this.flash.target, this.cam, t, eyeBeam * 0.32, flicker);

    // fluorescent life: one ticking starter and one dying tube
    for (let i = 0; i < this.tubeLights.length; i++) {
      const cell = Math.floor(t * (i === 1 ? 9 : 4));
      const drop = i === 1 && hash(cell) < 0.38 ? 0.15 : i === 3 && hash(cell + 5) < 0.18 ? 0.35 : 1;
      this.tubeLights[i]!.intensity = 1.9 * drop;
    }
    this.tubeMats[0]!.emissiveIntensity = 2.4 + 0.4 * hash(Math.floor(t * 7));
    this.tubeMats[1]!.emissiveIntensity = hash(Math.floor(t * 11)) < 0.28 ? 0.35 : 2.3;

    // phone rings then receiver levitates
    const ring = t > 8.3 && t < 11 ? Math.sin(t * Math.PI * 40) * 0.006 : 0;
    const lift = smooth(11.02, 11.48, t) * 0.04;
    this.receiver.position.y = 0.96 + lift + ring;
    this.receiver.rotation.z = ring * 4;
    for (const rp of this.receiverParts) rp.position.y = (rp.userData.baseY as number) + lift + ring;
    if (this.glbReceiver) {
      if (!this.glbReceiver.userData.basePos) this.glbReceiver.userData.basePos = this.glbReceiver.position.clone();
      const bp = this.glbReceiver.userData.basePos as THREE.Vector3;
      this.glbReceiver.position.y = bp.y + (lift + ring) / 1.2;
      this.glbReceiver.rotation.z = ring * 4;
    }

    // ceiling tile, eyes, lids, fingers, breathing tile skin
    this.tileShift.position.y = 2.69 - smooth(13, 15.4, t) * 0.025;
    this.tileShift.rotation.x = smooth(14.2, 15.5, t) * 0.04;
    const eyesOn = smooth(15.45, 15.8, t);
    this.breatherEyeMats.forEach((m) => { m.emissiveIntensity = (0.55 + 1.9 * eyeBeam) * eyesOn; });
    this.breather.root.visible = eyesOn > 0.02;
    this.breather.root.position.y = 2.72 + Math.sin(t * 1.1) * 0.012 * eyesOn;
    for (let bi = 1; bi <= 8; bi++) {
      const fp = this.breather.part(`finger_${bi}_root`);
      if (fp) {
        const emerge = smooth(15.8 + (bi % 4) * 0.32, 16.35 + (bi % 4) * 0.32, t);
        fp.visible = emerge > 0.03;
        const side = bi < 5 ? -1 : 1;
        const lash = smooth(18.35, 19.1, t);
        if (!fp.userData.basePos) fp.userData.basePos = fp.position.clone();
        const bp = fp.userData.basePos as THREE.Vector3;
        const spread = (bi - 4.5) / 3.5;
        fp.position.x = bp.x + spread * 0.12 * emerge + Math.sin(t * 0.31 + bi) * 0.008 * eyesOn;
        fp.position.z = bp.z + ((bi % 2) - 0.5) * 0.11 * emerge;
        fp.rotation.x = (Math.sin(t * (0.72 + bi * 0.035) + bi) * 0.30 - 0.06 * emerge + lash * (0.24 + (bi % 3) * 0.07) + (bi % 2 ? 0.09 : -0.04) * emerge) * eyesOn;
        fp.rotation.z = side * (0.07 + (bi % 3) * 0.045 + Math.sin(t * (0.46 + bi * 0.025) + bi * 1.7) * 0.12) * eyesOn + spread * 0.045 * emerge;
        fp.rotation.y = Math.sin(t * 0.42 + bi) * 0.16 * eyesOn + spread * 0.025 * emerge + (bi % 2 ? -0.08 : 0.06) * emerge;
        for (let sj = 1; sj <= 4; sj++) {
          const seg = this.breather.part(`finger_${bi}_segment_${sj}`);
          if (!seg) continue;
          if (!seg.userData.baseRot) seg.userData.baseRot = seg.rotation.clone();
          const br = seg.userData.baseRot as THREE.Euler;
          const creep = Math.sin(t * (0.43 + bi * 0.018) + bi * 0.9 + sj * 1.35) * 0.105 * eyesOn * (sj / 4);
          const secondary = Math.sin(t * (0.21 + bi * 0.012) + bi * 1.4 - sj) * 0.052 * eyesOn;
          seg.rotation.set(br.x + creep, br.y + secondary * 0.45, br.z + secondary);
        }
      }
    }
    this.eyes.forEach((e) => { e.visible = eyesOn > 0.02 && !this.breather.root.visible; (e.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 * eyesOn; });
    const blink = t > 16.7 && t < 17.15 ? smooth(16.7, 16.9, t) * (1 - smooth(16.95, 17.15, t)) : 0;
    this.lids.forEach((l) => { l.visible = false; });
    for (const side of ['l', 'r'] as const) {
      for (const half of ['upper', 'lower'] as const) {
        const lid = this.breather.part(`lid_${side}_${half}`);
        if (lid) {
          if (!lid.userData.basePos) lid.userData.basePos = lid.position.clone();
          const bp = lid.userData.basePos as THREE.Vector3;
          lid.position.y = bp.y + blink * (half === 'upper' ? -0.026 : 0.02);
        }
      }
    }
    this.fingers.forEach((fi, i) => { fi.visible = false; fi.rotation.x = 0.4 + smooth(18.5, 19.3, t) * (0.5 + i * 0.03); fi.position.y = 2.43 - smooth(18.5, 19.3, t) * 0.12; });
    this.skinTiles.forEach((tile, i) => { tile.position.y = 2.68 + Math.sin(t * Math.PI * 0.5 + i * 0.65) * 0.012; });

    // chase: tiles detach behind the run, chairs clip-spin, paper and vent move in HVAC draft
    for (const d of this.fallingTiles) {
      const a = clamp((t - d.t0) / 0.55);
      d.m.position.y = d.y0 - 2.1 * a * a;
      d.m.rotation.x = a * (0.8 + hash(d.z) * 0.8);
      d.m.rotation.z = a * 0.5;
    }
    this.chair.rotation.y = 0.4 + smooth(22.8, 23.6, t) * 4.5;
    this.slidingPrintout.position.x = 0.55 + smooth(4, 29, t) * 0.10;
    this.slidingPrintout.rotation.z = 0.2 + Math.sin(t * 0.8) * 0.04;
    this.ventRibbon.rotation.z = Math.sin(t * 2.1) * 0.18;
    this.doorGlow.emissiveIntensity = 5 + smooth(27.5, 30, t) * 12;

    gl.setRenderTarget(out);
    gl.setClearColor(0x050505, 1);
    gl.clear(true, true, true);
    gl.render(this.s, this.cam);

    // premise typography: typed, held, then gone; it is the only non-diegetic line in the film
    this.layer.clear();
    const c = this.layer.ctx;
    drawPremiseLine(c, t, 4.05);
    this.ctx.comp.draw(gl, this.layer.upload(), out, { mode: 'normal' });
    gl.resetState();

    return {
      ...thresholdPost(t, { darkness: 0.58, stress: t > 19.3 && t < 30 ? 0.7 : 0.12, fade: 1 - smooth(4.0, 5.0, t) }),
      flash: 0,
      shake: t > 19.3 && t < 30 ? [1.2 * Math.sin(t * 37), 1.0 * Math.cos(t * 31)] : [0, 0],
    };
  }

  override dispose() { disposeTree(this.s); this.layer?.dispose(); }
}
