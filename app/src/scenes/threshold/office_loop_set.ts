// Shared Z8/END office-loop production set: compact reconstruction of Z1 beat 1.1.
// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
import * as THREE from 'three';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import beigePhoneUrl from './assets/beige_phone/model.glb?url';
import officeKitUrl from './assets/z1_office_kit/model.glb?url';
import propPackUrl from './assets/z1_prop_pack/model.glb?url';

const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export type OfficeLoopSet = {
  root: THREE.Group;
  phoneInst: GLTFInstance;
  officeKit: GLTFInstance;
  propPack: GLTFInstance;
  receiver?: THREE.Object3D;
  receiverHome?: THREE.Vector3;
  tubeMats: THREE.MeshStandardMaterial[];
  tubeLights: THREE.PointLight[];
  ambientLight: THREE.AmbientLight;
};

function surfaceTexture(color: string, dark: string, seed: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const v = hash(seed + i * 0.37);
    g.fillStyle = v > 0.52 ? dark : color;
    g.globalAlpha = 0.05 + hash(seed + i) * 0.09;
    g.fillRect(Math.floor(hash(seed + i * 2) * 128), Math.floor(hash(seed + i * 3) * 128), 1 + Math.floor(hash(i) * 3), 1);
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

export async function buildOfficeLoopSet(): Promise<OfficeLoopSet> {
  const [officeKit, propPack, phoneInst] = await Promise.all([
    GLTFManager.instantiate(officeKitUrl, { castShadow: true, receiveShadow: true }),
    GLTFManager.instantiate(propPackUrl, { castShadow: true, receiveShadow: true }),
    GLTFManager.instantiate(beigePhoneUrl, { castShadow: true, receiveShadow: true }),
  ]);
  const root = new THREE.Group();
  root.name = 'office_loop_production_set';
  const disposables: { dispose(): void }[] = [];
  const mat = (color: number, roughness = 0.75, metalness = 0, emissive = 0, emissiveIntensity = 0, tex?: THREE.Texture) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity, ...(tex ? { map: tex } : {}) });
    disposables.push(m);
    return m;
  };
  const carpetTex = surfaceTexture('#6f6545', '#3d3424', 11);
  const fabricTex = surfaceTexture('#958251', '#5c5035', 19);
  const ceilingTex = surfaceTexture('#c9c2ad', '#8b806d', 29);
  disposables.push(carpetTex, fabricTex, ceilingTex);
  const carpet = mat(0x746947, 0.94, 0, 0, 0, carpetTex);
  const fabric = mat(0x9b8956, 0.9, 0, 0, 0, fabricTex);
  const fabricDark = mat(0x766a45, 0.93, 0, 0, 0, fabricTex);
  const ceiling = mat(0xc9c1aa, 0.86, 0, 0, 0, ceilingTex);
  const metal = mat(0x555851, 0.56, 0.28);
  const dark = mat(0x101010, 0.86);
  const paper = mat(0xb8ae92, 0.94);

  const box = (size: [number, number, number], pos: [number, number, number], material: THREE.Material, rot: [number, number, number] = [0, 0, 0], parent: THREE.Object3D = root) => {
    const geo = new THREE.BoxGeometry(...size);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    disposables.push(geo);
    return mesh;
  };
  const clone = (source: GLTFInstance, part: string, pos: [number, number, number], yaw = 0, scale = 1) => {
    const c = source.part(part)?.clone(true);
    if (!c) return undefined;
    c.position.set(...pos);
    c.rotation.set(0, yaw, 0);
    c.scale.setScalar(scale);
    root.add(c);
    return c;
  };

  // Z1 beat-1.1 architecture: broad occupied office, not a corridor.
  box([30, 0.08, 48], [0, -0.04, -3], carpet);
  box([30, 0.08, 48], [0, 2.76, -3], ceiling);
  box([30, 2.7, 0.16], [0, 1.35, -26], fabric);
  box([0.16, 2.7, 34], [-13, 1.35, 3], fabricDark);
  box([0.16, 2.7, 34], [13, 1.35, 3], fabricDark);

  // Opening cubicle partitions and foreground half-cropped workstations exactly where Z1 places them.
  for (const side of [-1, 1]) {
    for (let j = 0; j < 3; j++) clone(officeKit, 'cubicle_panel_180_root', [side * 2.2, 0, -1.35 - j * 1.78], Math.PI / 2, 1);
    for (let i = 0; i < 2; i++) {
      const px = side * 1.85, z = -2.15 - i * 0.35;
      clone(propPack, 'desk_root', [px, 0, z], -side * 0.16, 0.78);
      clone(propPack, 'crt_root', [px - side * 0.12, 0.77, z - 0.1], side * 0.28, 0.78);
      clone(propPack, 'keyboard_root', [px + side * 0.12, 0.77, z + 0.12], -side * 0.08, 0.78);
      clone(propPack, 'chair_upright_root', [px + side * 0.42, 0, z + 0.48], side * 0.8, 0.95);
    }
  }

  // Dense middle/background cubicle rows; enough repetition to read as the endless office through the doorway.
  for (let row = 0; row < 7; row++) {
    const z = -8.2 - row * 2.8;
    for (const side of [-1, 1]) {
      clone(officeKit, row % 3 === 2 ? 'cubicle_panel_120_root' : 'cubicle_panel_180_root', [side * (2.8 + (row % 2) * 1.15), 0, z], Math.PI / 2, 0.92);
      clone(officeKit, 'cubicle_panel_180_root', [side * 4.3, 0, z - 0.85], 0, 0.86);
      if (row < 5) {
        clone(propPack, 'desk_root', [side * (3.7 + (row % 2) * 0.8), 0, z + 0.28], -side * 0.12, 0.72);
        clone(propPack, 'crt_root', [side * (3.7 + (row % 2) * 0.8) - side * 0.1, 0.77, z + 0.12], side * 0.26, 0.68);
        if ((row + (side > 0 ? 1 : 0)) % 2 === 0) clone(propPack, 'chair_upright_root', [side * (4.15 + (row % 2) * 0.8), 0, z + 0.78], side * 0.6, 0.82);
      }
    }
  }

  // Hero desk, CRT, keyboard, chair and phone at exact Z1 coordinates.
  clone(propPack, 'desk_root', [0, 0, -6], 0, 1.08);
  clone(propPack, 'crt_root', [-0.52, 0.77, -6.17], 0.22, 1.0);
  clone(propPack, 'keyboard_root', [-0.34, 0.77, -5.74], -0.08, 1.0);
  clone(propPack, 'mug_root', [0.02, 0.77, -5.62], 0, 1.0);
  clone(propPack, 'chair_upright_root', [0.58, 0, -5.4], 2.7, 0.95);
  phoneInst.root.position.set(0.38, 0.785, -5.76);
  phoneInst.root.rotation.y = -0.48;
  phoneInst.root.scale.setScalar(1.2);
  phoneInst.root.traverse((o) => {
    if (/^(base_|bell_|cradle_|front_lip|hook_|key_|vent_|wear_nick_)/.test(o.name)) { o.scale.x = 1.55; o.scale.z = 1.22; }
    if (/^key_(mark_)?/.test(o.name)) { o.position.y -= 0.012; o.position.z -= 0.018; }
  });
  root.add(phoneInst.root);

  // Suspended ceiling tiles/grid and fluorescent troffers in the opening frame.
  for (let x = -4.8; x <= 4.8; x += 1.2) for (let z = -9.6; z <= 1.2; z += 1.2) {
    const part = hash(x * 3 + z * 7) > 0.82 ? 'ceiling_tile_stained_root' : 'ceiling_tile_plain_root';
    clone(officeKit, part, [x, 2.68, z], 0, 1);
  }
  const tubeMats: THREE.MeshStandardMaterial[] = [];
  const tubeLights: THREE.PointLight[] = [];
  const tubePositions: [number, number][] = [[-3, -7], [0, -4], [3, -1], [-3, 2], [3, -9.8], [0, -12.4]];
  tubePositions.forEach(([x, z], i) => {
    clone(officeKit, 'troffer_root', [x, 2.64, z], 0, 1);
    const tm = mat(0xdfe9d8, 0.24, 0, 0xe7ffe0, 2.35);
    tubeMats.push(tm);
    box([0.48, 0.025, 0.08], [x - 0.25, 2.59, z], tm);
    box([0.48, 0.025, 0.08], [x + 0.25, 2.59, z], tm);
    const p = new THREE.PointLight(0xdfffd2, 1.45, 6.2, 1.55);
    p.position.set(x, 2.32, z);
    root.add(p);
    tubeLights.push(p);
  });

  // Floor-level lived-in clutter and contact darkness in the opening lane.
  for (let i = 0; i < 28; i++) {
    const x = (hash(i * 4.1) - 0.5) * 5.4;
    const z = -0.7 - hash(i * 2.7) * 10.5;
    box([0.15 + hash(i) * 0.09, 0.008, 0.2 + hash(i + 1) * 0.08], [x, 0.012 + i * 0.00002, z], paper, [0, hash(i + 2) * Math.PI, 0]);
  }
  for (let i = 0; i < 9; i++) {
    const x = (hash(i * 7.2) - 0.5) * 5.8;
    const z = -1.3 - hash(i * 5.2) * 8.5;
    box([0.35 + hash(i) * 0.55, 0.006, 0.035], [x, 0.018, z], dark, [0, hash(i) * Math.PI, 0]);
  }
  const ambientLight = new THREE.AmbientLight(0x746f5d, 0.38);
  root.add(ambientLight);

  const receiver = phoneInst.part('receiver') ?? undefined;
  return { root, phoneInst, officeKit, propPack, receiver, receiverHome: receiver?.position.clone(), tubeMats, tubeLights, ambientLight };
}
