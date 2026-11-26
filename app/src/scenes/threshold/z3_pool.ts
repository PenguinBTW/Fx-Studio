// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Z3 tiled pool halls: deterministic grey-box beat blockout with real scale/camera path; uses W1's stabilized first-person/flashlight/sensor kit through the owned look-target adapter.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { resolveAsset } from '../../engine/assets';
import { thresholdPost } from './sensor_post';
import { addFlashlight, applyFpCamera, basic, box, clamp, cyl, disposeTree, evalCam, hash, mat, plane, smooth, sph, updateFlashlight, type CamKey } from './z1_scene_util';

function glazeBreakupTexture() {
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(166,184,180)'; g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const mineral = (hash(x * 0.19 + y * 1.7) - 0.5) * 34 + Math.sin(x * 0.09 + y * 0.04) * 14;
    const stain = hash(Math.floor(x / 37) * 2.1 + Math.floor(y / 31) * 5.7) > 0.72 ? -34 : 0;
    const id = (y * size + x) * 4;
    const v = Math.max(78, Math.min(225, 174 + mineral + stain));
    img.data[id] = v * 0.92; img.data[id + 1] = v; img.data[id + 2] = v * 0.97; img.data[id + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // thick tile registration lines and glaze crazing are intentionally high contrast:
  // they must survive delivery-distance rendering, not only close crops.
  g.strokeStyle = 'rgba(8,25,27,0.72)'; g.lineWidth = 4;
  for (let q = 0; q <= size; q += 42) {
    g.beginPath(); g.moveTo(q + Math.sin(q) * 1.5, 0); g.lineTo(q + Math.cos(q) * 1.5, size); g.stroke();
    g.beginPath(); g.moveTo(0, q + Math.cos(q) * 1.5); g.lineTo(size, q + Math.sin(q) * 1.5); g.stroke();
  }
  // Dense large-cell crazing: radial cracks connect into polygons large enough to survive a 3m read.
  for (let i = 0; i < 34; i++) {
    const cx = hash(i * 3.1) * size, cy = hash(i * 5.7) * size;
    const arms = 4 + Math.floor(hash(i * 8.3) * 4);
    for (let a = 0; a < arms; a++) {
      const ang = (a / arms) * Math.PI * 2 + hash(i * 13 + a) * 0.65;
      let x = cx, y = cy;
      g.strokeStyle = `rgba(5,18,20,${0.48 + hash(i + a) * 0.34})`; g.lineWidth = 1.4 + hash(i + a * 2.1) * 1.8;
      g.beginPath(); g.moveTo(x, y);
      const segs = 2 + Math.floor(hash(i + a * 4.7) * 3);
      for (let k = 0; k < segs; k++) {
        const step = 10 + hash(i * 19 + a * 7 + k) * 22;
        x += Math.cos(ang + (hash(i + k) - 0.5) * 0.8) * step;
        y += Math.sin(ang + (hash(i + k + 2) - 0.5) * 0.8) * step;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  }
  for (let i = 0; i < 28; i++) {
    let x = hash(i * 7.1) * size, y = hash(i * 9.7) * size;
    g.strokeStyle = `rgba(8,22,24,${0.38 + hash(i) * 0.34})`; g.lineWidth = 1.0 + hash(i + 4) * 1.4;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (hash(i * 11 + k) - 0.5) * 44; y += (hash(i * 17 + k) - 0.5) * 44;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 22; i++) {
    g.fillStyle = `rgba(24,45,42,${0.08 + hash(i) * 0.12})`;
    g.beginPath(); g.ellipse(hash(i * 2.3) * size, hash(i * 4.9) * size, 6 + hash(i) * 20, 3 + hash(i + 3) * 12, hash(i + 8) * Math.PI, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(0.82, 0.82);
  return tex;
}

const KEYS: CamKey[] = [
  { t: 55, pos: [0, 1.65, 6.4], look: [0, 1.2, -2], fov: 74, gait: 'walk' },
  { t: 56.5, pos: [0, 1.65, 5.1], look: [0, 0.5, 1], fov: 74, gait: 'walk' },
  { t: 59.8, pos: [0, 1.65, 3.0], look: [0, 0.42, 0.8], fov: 74, gait: 'walk' },
  { t: 62.5, pos: [0, 1.65, 1.2], look: [0, 0.45, -2.4], fov: 74, gait: 'still' },
  { t: 65, pos: [0, 1.65, 0.55], look: [0, 0.55, -2.8], fov: 74, gait: 'creep' },
  { t: 68.2, pos: [0, 1.65, 1.25], look: [0, 0.2, -2.0], fov: 74, gait: 'walk' },
  { t: 71, pos: [0, 1.65, 1.8], look: [3, 0.5, -1.6], fov: 74, gait: 'still' },
  { t: 72.4, pos: [0, 1.65, 1.8], look: [0, 1.05, -2.8], fov: 76, gait: 'still' },
  { t: 74.5, pos: [0, 1.65, 2.2], look: [0, 1.3, -2.8], fov: 78, gait: 'walk' },
  { t: 76.5, pos: [0, 1.65, 3.5], look: [0, 1.35, -2.8], fov: 80, gait: 'run' },
  { t: 78.8, pos: [0, 1.5, 4.9], look: [0, 2.5, -1.5], fov: 88, gait: 'run', roll: -0.3 },
  { t: 80, pos: [0, -0.35, 5.8], look: [0, -0.8, 1.5], fov: 90, gait: 'hold', roll: -0.65 },
];

export default class ThresholdZ3Pool extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(76, 16 / 9, 0.04, 90);
  private flash!: ReturnType<typeof addFlashlight>;
  private water!: THREE.Mesh;
  private waterBase!: Float32Array;
  private waterMat!: THREE.MeshStandardMaterial;
  private waterGlintMat!: THREE.MeshBasicMaterial;
  private mirrorling!: THREE.Group;
  private reflection!: THREE.Group;
  private arms: THREE.Mesh[] = [];
  private phone!: THREE.Group;
  private tenant!: THREE.Mesh;
  private surfaceLeaves: THREE.Mesh[] = [];
  private underwaterBits: THREE.Mesh[] = [];
  private cameraWakeRings: THREE.Mesh[] = [];
  private contactRipples: { mesh: THREE.Mesh; x: number; z: number; phase: number }[] = [];
  private creatureRipples: THREE.Mesh[] = [];
  private creatureDrips: THREE.Mesh[] = [];
  private strips: THREE.Mesh[] = [];
  private stepGlow!: THREE.MeshStandardMaterial;

  private mirrorlingAsset!: GLTFInstance;
  private mirrorlingReflection!: GLTFInstance;
  private poolKit!: GLTFInstance;
  private propPack!: GLTFInstance;
  private envReady = false;
  private chromeEnv: THREE.Texture | null = null;
  private playerReflection!: THREE.Mesh;
  private playerReflectionMat!: THREE.MeshBasicMaterial;
  private beamReflection!: THREE.Mesh;
  private beamReflectionMat!: THREE.MeshBasicMaterial;
  private mirrorlingWake!: THREE.Mesh;
  private mirrorlingWakeMat!: THREE.MeshBasicMaterial;

  override async init() {
    const resolved = resolveAsset('threshold/z3_mirrorling');
    this.mirrorlingAsset = await GLTFManager.instantiate(resolved.url, { ...resolved.manifest.load, castShadow: true, receiveShadow: true });
    const kitResolved = resolveAsset('threshold/z3_pool_kit');
    const packResolved = resolveAsset('threshold/z3_prop_pack');
    this.poolKit = await GLTFManager.instantiate(kitResolved.url, { ...kitResolved.manifest.load, castShadow: true, receiveShadow: true });
    this.propPack = await GLTFManager.instantiate(packResolved.url, { ...packResolved.manifest.load, castShadow: true, receiveShadow: true });
    this.mirrorlingReflection = await GLTFManager.instantiate(resolved.url, { ...resolved.manifest.load, castShadow: false, receiveShadow: false });
    // Convert the surface figure from mirror-chrome/hologram back to wet white ceramic tile:
    // glossy enough to catch strips, matte enough that black grout registrations remain legible.
    const mirrorlingGlazeTex = glazeBreakupTexture();
    const mirrorlingMatCache = new Map<THREE.Material, THREE.Material>();
    this.mirrorlingAsset.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const remap = (m: THREE.Material) => {
        const hit = mirrorlingMatCache.get(m);
        if (hit) return hit;
        const mm = new THREE.MeshPhysicalMaterial({ color: (m as THREE.MeshStandardMaterial).color.clone(), roughness: 0.24, metalness: 0.0, clearcoat: 0.72, clearcoatRoughness: 0.12 });
        mm.map = mirrorlingGlazeTex; mm.roughnessMap = mirrorlingGlazeTex; mm.bumpMap = mirrorlingGlazeTex; mm.bumpScale = 0.009;
        mm.color.multiplyScalar(0.64);
        mm.name = m.name;
        if (/aqua_chrome_tile/.test(mm.name)) { mm.color.setHex(0xd8eeee); mm.roughness = 0.15; }
        if (/pale_tile_highlight/.test(mm.name)) { mm.color.setHex(0xf0f5e9); mm.roughness = 0.12; }
        if (/black_grout_lines/.test(mm.name)) { mm.color.setHex(0x020708); mm.roughness = 0.78; }
        mm.needsUpdate = true;
        mirrorlingMatCache.set(m, mm);
        return mm;
      };
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const mapped = mats.map(remap);
      mesh.material = Array.isArray(mesh.material) ? mapped : mapped[0]!;
      if (/water_ripple_ring|torso_tile_band|head_grout_|(?:arm|leg)_.*_grout_|shoulder_socket|elbow_|wrist_|knee_|hip_socket|body_tile_chip|^(?:arm|leg)_[lr]_(?:upper|lower)$|^finger_[lr]_|^shoulder_bar$|^head_hairline_grout_/.test(mesh.name)) mesh.visible = false;
    });
    this.mirrorlingAsset.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => { const mm = m as THREE.MeshStandardMaterial; if (/chrome|tile_highlight/.test(mm.name)) mm.envMapIntensity = 0.9; });
    });
    // Tilt/turn the whole head assembly around the neck as one organism. The GLB nodes have
    // simple local translations, so rotating both position and orientation preserves the cracks,
    // mirror face, cranium and chin as a single intentional head gesture.
    const headPivot = new THREE.Vector3(0, 2.02, 0);
    const headTurn = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.11, 0.14, 0.20));
    this.mirrorlingAsset.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !/^(head_teardrop_cranium|head_pointed_chin|blank_mirror_face|head_hairline_grout_)/.test(mesh.name)) return;
      mesh.position.sub(headPivot).applyQuaternion(headTurn).add(headPivot);
      mesh.quaternion.premultiply(headTurn);
      if (mesh.name === 'head_teardrop_cranium') mesh.scale.set(mesh.scale.x * 1.10, mesh.scale.y * 0.96, mesh.scale.z * 1.02);
      if (mesh.name === 'head_pointed_chin') mesh.scale.set(mesh.scale.x * 0.88, mesh.scale.y * 1.04, mesh.scale.z);
    });
    // Ceramic limb volume overlay: the GLB supplies the teardrop head, torso, joints and fingers;
    // these continuous tiled sleeves guarantee the limbs read as the same ceramic being at film distance.
    const lc = document.createElement('canvas'); lc.width = lc.height = 256;
    const lg = lc.getContext('2d')!;
    lg.fillStyle = 'rgb(232,238,224)'; lg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 48; i++) {
      lg.fillStyle = `rgba(175,190,176,${0.08 + hash(i) * 0.14})`;
      lg.fillRect(hash(i * 2.1) * 246, hash(i * 4.7) * 246, 4 + hash(i) * 18, 3 + hash(i + 2) * 14);
    }
    lg.strokeStyle = 'rgba(8,25,28,0.84)'; lg.lineWidth = 5;
    for (let x = 0; x <= 256; x += 64) { lg.beginPath(); lg.moveTo(x + Math.sin(x) * 2, 0); lg.lineTo(x + Math.cos(x) * 2, 256); lg.stroke(); }
    for (let y = 0; y <= 256; y += 64) { lg.beginPath(); lg.moveTo(0, y + Math.sin(y) * 2); lg.lineTo(256, y + Math.cos(y) * 2); lg.stroke(); }
    lg.strokeStyle = 'rgba(2,8,10,0.68)'; lg.lineWidth = 2.2;
    for (let i = 0; i < 20; i++) {
      const x = hash(i * 7) * 256, y = hash(i * 11) * 256;
      lg.beginPath(); lg.moveTo(x, y); lg.lineTo(x + (hash(i) - 0.5) * 80, y + (hash(i + 1) - 0.5) * 80); lg.stroke();
    }
    const limbGridTex = new THREE.CanvasTexture(lc); limbGridTex.colorSpace = THREE.SRGBColorSpace; limbGridTex.wrapS = limbGridTex.wrapT = THREE.RepeatWrapping;
    const limbTile = new THREE.MeshPhysicalMaterial({ color: 0xf0f6ec, roughness: 0.25, metalness: 0.0, clearcoat: 0.78, clearcoatRoughness: 0.10, envMapIntensity: 1.15, emissive: 0x102526, emissiveIntensity: 0.12 });
    limbTile.map = limbGridTex; limbTile.roughnessMap = mirrorlingGlazeTex; limbTile.bumpMap = limbGridTex; limbTile.bumpScale = 0.009;
    const limbGrout = new THREE.MeshStandardMaterial({ color: 0x102a2d, roughness: 0.82, metalness: 0.0 });
    const addLimbCylinder = (name: string, a: [number, number, number], b: [number, number, number], r1: number, r2: number, material: THREE.Material) => {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const d = vb.clone().sub(va);
      const len = d.length();
      const lm = (material as THREE.MeshPhysicalMaterial).clone();
      if (lm.map) { lm.map = lm.map.clone(); lm.map.repeat.set(2, Math.max(2, len / 0.17)); }
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, 28, 1), lm);
      mesh.name = mesh.userData.fx_entity = name;
      mesh.position.copy(va).add(vb).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.mirrorlingAsset.root.add(mesh);
      return mesh;
    };
    const addSurfaceGrout = (name: string, a: [number, number, number], b: [number, number, number], u: number, width: number, zoff = 0.066, angleOffset = 0) => {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const c = va.clone().lerp(vb, u);
      const angle = Math.atan2(vb.y - va.y, vb.x - va.x) + Math.PI / 2 + angleOffset;
      return box(this.mirrorlingAsset.root, name, [width, 0.011, 0.010], [c.x, c.y, c.z + zoff], limbGrout, [0, 0, angle]);
    };
    for (const side of [-1, 1] as const) {
      const left = side < 0;
      // Emergent creature stance, not a display pose: left arm drags low while the right arm
      // reaches up/forward toward the viewer; the right leg steps ahead through the water.
      const shoulder: [number, number, number] = left ? [-0.31, 1.93, 0] : [0.29, 1.96, 0];
      const elbow: [number, number, number] = left ? [-0.67, 1.25, 0.06] : [0.72, 2.18, 0.32];
      const wrist: [number, number, number] = left ? [-0.50, 0.52, 0.10] : [0.92, 2.02, 0.95];
      const hip: [number, number, number] = [side * 0.12, 1.35, 0];
      const knee: [number, number, number] = left ? [-0.22, 0.70, -0.08] : [0.25, 0.88, 0.10];
      const tip: [number, number, number] = left ? [-0.33, 0.03, -0.25] : [0.16, 0.03, 0.34];
      addLimbCylinder(`z3_mirrorling_ceramic_upper_arm_${side}`, shoulder, elbow, left ? 0.064 : 0.084, left ? 0.046 : 0.058, limbTile);
      addLimbCylinder(`z3_mirrorling_ceramic_lower_arm_${side}`, elbow, wrist, left ? 0.043 : 0.055, left ? 0.026 : 0.032, limbTile);
      addLimbCylinder(`z3_mirrorling_ceramic_upper_leg_${side}`, hip, knee, left ? 0.084 : 0.066, left ? 0.058 : 0.047, limbTile);
      addLimbCylinder(`z3_mirrorling_ceramic_lower_leg_${side}`, knee, tip, left ? 0.060 : 0.044, left ? 0.022 : 0.016, limbTile);
      // grout now reads as shallow tile seams on the front glazed surface, never as hoops or cage rings.
      for (const u of [0.34, 0.68]) {
        addSurfaceGrout(`z3_mirrorling_upper_arm_surface_grout_${side}_${u}`, shoulder, elbow, u, 0.105);
        addSurfaceGrout(`z3_mirrorling_lower_arm_surface_grout_${side}_${u}`, elbow, wrist, u, 0.078);
        addSurfaceGrout(`z3_mirrorling_upper_leg_surface_grout_${side}_${u}`, hip, knee, u, 0.125);
        addSurfaceGrout(`z3_mirrorling_lower_leg_surface_grout_${side}_${u}`, knee, tip, u, 0.082);
      }
      // Diagonal glaze fractures on the limb sleeves themselves; these are deliberately oversized
      // so the ceramic is cracked at the 3m delivery read, not only in native close crops.
      const limbRuns: Array<[string, [number, number, number], [number, number, number], number]> = [
        ['upper_arm', shoulder, elbow, 0.066], ['lower_arm', elbow, wrist, 0.054],
        ['upper_leg', hip, knee, 0.072], ['lower_leg', knee, tip, 0.052],
      ];
      limbRuns.forEach(([label, a, b, zoff], ri) => {
        for (const u of [0.22, 0.52, 0.82]) {
          const seed = ri * 17 + u * 31 + side * 5;
          addSurfaceGrout(`z3_mirrorling_${label}_glaze_crack_${side}_${u}`, a, b, u, 0.045 + hash(seed) * 0.055, zoff, (hash(seed + 2) - 0.5) * 1.1);
        }
      });
      // asymmetric ceramic joint masses interrupt the ballet-slender rod silhouette while
      // remaining physically attached at elbow/knee/wrist intersections.
      const jointMasses: Array<[number, number, number, number]> = left ? [
        [-0.67, 1.25, 0.06, 0.074], [-0.22, 0.70, -0.08, 0.088], [-0.50, 0.52, 0.10, 0.048],
      ] : [
        [0.72, 2.18, 0.32, 0.082], [0.25, 0.88, 0.10, 0.070], [0.92, 2.02, 0.95, 0.050],
      ];
      jointMasses.forEach(([x, y, z, r], mi) => {
        const nodule = sph(this.mirrorlingAsset.root, `z3_mirrorling_asymmetric_joint_mass_${side}_${mi}`, r, [x, y, z], limbTile, 14);
        nodule.scale.set(1.25 - mi * 0.12, 0.78 + hash(mi + side) * 0.35, 0.82 + hash(mi * 3 + side) * 0.28);
      });
      // Replacement finger fans follow the rebuilt asymmetric wrists. They are tapered ceramic
      // slivers rather than the GLB's symmetric shop-mannequin fingers.
      for (let fi = 0; fi < 4; fi++) {
        const lateral = (fi - 1.5) * 0.028;
        const base: [number, number, number] = [wrist[0] + lateral * (left ? 1 : -1), wrist[1] - 0.012, wrist[2] + 0.018];
        const mid: [number, number, number] = [base[0] + lateral * 0.35, base[1] - 0.105 - fi * 0.008, base[2] + (left ? 0.035 : 0.125)];
        const ftip: [number, number, number] = [mid[0] + lateral * 0.18, mid[1] - 0.105, mid[2] + (left ? 0.025 : 0.085)];
        addLimbCylinder(`z3_mirrorling_finger_upper_${side}_${fi}`, base, mid, 0.012, 0.008, limbTile);
        addLimbCylinder(`z3_mirrorling_finger_lower_${side}_${fi}`, mid, ftip, 0.008, 0.0045, limbTile);
      }
    }
    // sloped clavicle bridge replacing the perfectly horizontal mannequin shoulder bar
    addLimbCylinder('z3_mirrorling_sloped_clavicle_bridge', [-0.31, 1.93, 0], [0.29, 1.96, 0], 0.075, 0.075, limbTile);
    // Front-surface torso/head registration seams and a few chipped tile edges. These sit proud by only
    // millimetres, giving scale and ceramic construction without the crash-test-dummy hoop segmentation.
    for (const [i, y] of [1.2, 1.38, 1.56, 1.74, 1.92].entries()) {
      box(this.mirrorlingAsset.root, `z3_mirrorling_torso_surface_grout_${i}`, [0.29 - i * 0.018, 0.0038, 0.007], [0, y, 0.126], limbGrout, [0, 0, (i - 2) * 0.025]);
    }
    box(this.mirrorlingAsset.root, 'z3_mirrorling_spine_surface_grout', [0.0045, 0.66, 0.007], [0.012, 1.57, 0.128], limbGrout, [0, 0, -0.025]);
    box(this.mirrorlingAsset.root, 'z3_mirrorling_head_vertical_grout', [0.0035, 0.24, 0.006], [0.018, 2.3, 0.148], limbGrout, [0, 0, -0.04]);
    box(this.mirrorlingAsset.root, 'z3_mirrorling_head_hairline_crack', [0.003, 0.11, 0.006], [-0.045, 2.24, 0.149], limbGrout, [0, 0, 0.42]);
    // eyeless but intentional face grammar: two asymmetric eye-like fracture slashes and a
    // jagged vertical mouth crack, transformed with the head tilt so the arrangement reads at 3m.
    const addFaceCrack = (name: string, pos: [number, number, number], size: [number, number, number], rz: number) => {
      const c = box(this.mirrorlingAsset.root, name, size, pos, limbGrout, [0, 0, rz]);
      c.position.sub(headPivot).applyQuaternion(headTurn).add(headPivot);
      c.quaternion.premultiply(headTurn);
    };
    addFaceCrack('z3_mirrorling_face_eye_crack_l', [-0.052, 2.345, 0.162], [0.082, 0.018, 0.012], 0.34);
    addFaceCrack('z3_mirrorling_face_eye_crack_r', [0.045, 2.305, 0.162], [0.058, 0.016, 0.012], -0.22);
    addFaceCrack('z3_mirrorling_face_mouth_crack_a', [-0.012, 2.235, 0.163], [0.018, 0.082, 0.012], -0.18);
    addFaceCrack('z3_mirrorling_face_mouth_crack_b', [0.010, 2.175, 0.163], [0.017, 0.070, 0.012], 0.24);
    addFaceCrack('z3_mirrorling_face_mouth_crack_c', [-0.006, 2.125, 0.163], [0.016, 0.060, 0.012], -0.30);
    for (let i = 0; i < 20; i++) {
      const side = i % 2 ? 1 : -1;
      box(this.mirrorlingAsset.root, `z3_mirrorling_edge_chip_${i}`, [0.026 + hash(i) * 0.032, 0.012, 0.018], [side * (0.13 + hash(i + 2) * 0.18), 0.72 + hash(i + 3) * 1.62, 0.138], i % 3 ? limbTile : limbGrout, [0, 0, hash(i + 4) * 0.8]);
    }
    // large silhouette bites and loose ceramic fragments: the body is damaged and incomplete,
    // not a pristine symmetrical display figure.
    const bitePts: Array<[number, number, number, number]> = [
      [-0.22, 1.86, 0.14, 0.11], [0.19, 1.62, 0.145, 0.085], [-0.16, 1.31, 0.14, 0.095],
      [0.14, 1.05, 0.14, 0.075], [-0.10, 2.42, 0.15, 0.07], [0.09, 2.25, 0.15, 0.06],
      [-0.61, 1.21, 0.09, 0.075], [0.77, 2.11, 0.19, 0.065],
    ];
    bitePts.forEach(([x, y, z, sz], i) => {
      box(this.mirrorlingAsset.root, `z3_mirrorling_missing_tile_bite_${i}`, [sz, 0.018 + hash(i) * 0.025, 0.022], [x, y, z], limbGrout, [0, 0, hash(i + 9) * 1.4]);
      if (i < 5) box(this.mirrorlingAsset.root, `z3_mirrorling_loose_tile_fragment_${i}`, [sz * 0.42, 0.012, 0.018], [x + 0.06 + hash(i) * 0.06, y - 0.06, z + 0.025], limbTile, [0, 0, hash(i + 12) * 1.8]);
    });
    // Crooked ceramic mass over the torso: thicker uneven volumes replace the elegant narrow
    // capsule silhouette without becoming flat pasted plates.
    const torsoCore = this.mirrorlingAsset.part('torso_core');
    if (torsoCore) { torsoCore.scale.x *= 1.20; torsoCore.scale.z *= 1.10; torsoCore.scale.y *= 0.96; }
    const torsoMasses: Array<[string, number, number, number, number, [number, number, number]]> = [
      ['chest', 0.060, 1.70, 0.030, 0.158, [1.04, 1.15, 0.50]],
      ['abdomen', -0.055, 1.43, 0.040, 0.138, [0.88, 1.12, 0.48]],
      ['pelvis', 0.035, 1.17, 0.020, 0.122, [1.05, 0.88, 0.46]],
    ];
    torsoMasses.forEach(([label, x, y, z, r, sc]) => {
      const mass = sph(this.mirrorlingAsset.root, `z3_mirrorling_crooked_torso_mass_${label}`, r, [x, y, z], limbTile, 20);
      mass.scale.set(...sc);
    });
    this.mirrorlingAsset.root.visible = false;
    this.mirrorlingReflection.root.visible = false;
    this.mirrorlingReflection.root.scale.y = -1;
    this.mirrorlingReflection.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        // Small rigid fingers/rods are exactly what water refraction destroys first; left intact
        // they read as white paper cut-outs pasted onto the surface at the look-down beat.
        if (/^finger_[lr]_|^shoulder_bar$|^head_hairline_grout_/.test(m.name)) { m.visible = false; return; }
        const dimRod = /^(?:arm|leg)_[lr]_(?:upper|lower)$/.test(m.name);
        const mm = (m.material as THREE.MeshStandardMaterial).clone();
        mm.transparent = true; mm.opacity = dimRod ? 0.24 : 0.52; mm.emissive = new THREE.Color(0x1d7280); mm.emissiveIntensity = dimRod ? 0.08 : 0.20; mm.depthWrite = false;
        if (dimRod) mm.color.lerp(new THREE.Color(0x07343c), 0.62);
        m.material = mm;
      }
    });
    this.s.add(this.mirrorlingAsset.root, this.mirrorlingReflection.root);
    const glazeKey = new THREE.PointLight(0xdfffff, 0.38, 3.8, 2); glazeKey.position.set(0.55, 2.15, 0.85); this.mirrorlingAsset.root.add(glazeKey);
    const glazeRim = new THREE.PointLight(0x7fd7e8, 0.16, 3.2, 2); glazeRim.position.set(-0.65, 1.35, -0.65); this.mirrorlingAsset.root.add(glazeRim);
    this.s.background = new THREE.Color(0x08262d);
    this.s.fog = new THREE.FogExp2(0x0b4652, 0.055);
    this.flash = addFlashlight(this.s);
    this.s.add(new THREE.HemisphereLight(0x9ff7ff, 0x09272f, 0.75));
    const tileA = mat(0xbfe7e7, 0.22);
    const tileB = mat(0x78cbd2, 0.18);
    const grout = mat(0x5b8587, 0.78);
    const metal = mat(0x617678, 0.28, 0.55);
    const chrome = mat(0xd8f4f2, 0.22, 0.28, 0x102c30, 0.12);
    const dark = mat(0x071014, 0.9);
    const leaf = mat(0x5a6f27, 0.85);

    // hall volume, stepped entry shelf and tiled grid strips
    box(this.s, 'z3_floor_deep', [8, 0.12, 31], [0, -0.18, -7], grout);
    box(this.s, 'z3_step_shelf', [8, 0.55, 2.4], [0, 0.22, 6.4], tileA);
    box(this.s, 'z3_step_face', [8, 0.55, 0.1], [0, 0.22, 5.2], tileB);
    box(this.s, 'z3_wall_l', [0.18, 5.5, 31], [-4.1, 2.4, -7], tileA);
    box(this.s, 'z3_wall_r', [0.18, 5.5, 31], [4.1, 2.4, -7], tileA);
    box(this.s, 'z3_wall_end', [8.2, 5.5, 0.18], [0, 2.4, -22.6], tileB);
    box(this.s, 'z3_ceiling', [8.2, 0.16, 31], [0, 4.7, -7], grout);
    for (let x = -4; x <= 4; x += 0.5) box(this.s, `z3_tile_v_${x}`, [0.007, 0.007, 30], [x, 0.015, -7], grout);
    for (let z = -22; z <= 8; z += 0.5) {
      box(this.s, `z3_tile_h_l_${z}`, [0.012, 0.012, 0.45], [-4.0, 2.1, z], grout);
      box(this.s, `z3_tile_h_r_${z}`, [0.012, 0.012, 0.45], [4.0, 2.1, z], grout);
    }
    // dense ceramic tile structure: horizontal/vertical grout on both walls, blue mosaic waterline bands,
    // and a continuous pool-edge gutter so the volume reads as a natatorium rather than a parking garage.
    for (const side of [-1, 1]) {
      const x = side * 3.995;
      for (let y = 0.65; y <= 4.15; y += 0.5) box(this.s, `z3_wall_grout_h_${side}_${y.toFixed(1)}`, [0.008, 0.008, 29.5], [x, y, -7], grout);
      for (let z = -21.5; z <= 7; z += 0.75) box(this.s, `z3_wall_grout_v_${side}_${z.toFixed(2)}`, [0.008, 3.55, 0.008], [x, 2.35, z], grout);
      for (let seg = 0; seg < 48; seg++) {
        const z = -21.1 + seg * 0.62;
        const shade = [0x17475f, 0x1a526b, 0x143f53][seg % 3]!;
        box(this.s, `z3_mosaic_waterline_${side}_${seg}`, [0.022, 0.18, 0.56], [side * 3.985, 1.06 + (hash(seg * 2.7 + side) - 0.5) * 0.012, z], mat(shade, 0.58));
      }
      box(this.s, `z3_pool_edge_gutter_${side}`, [0.24, 0.075, 27.5], [side * 3.78, 0.49, -6.3], mat(0xe7f2ed, 0.34));
      box(this.s, `z3_gutter_shadow_${side}`, [0.08, 0.045, 27.5], [side * 3.64, 0.475, -6.3], mat(0x061c22, 0.7));
    }
    // age variation over the modular tile system: mineral tide marks, damp drips, missing/chipped tiles.
    const mineral = basic(0x6f5c39, 0.24), damp = basic(0x071c22, 0.13), chipMat = mat(0x20363a, 0.82);
    for (const side of [-1, 1]) {
      const x = side * 3.972;
      box(this.s, `z3_mineral_tide_${side}`, [0.012, 0.055, 28.5], [x, 0.72, -7], mat(0x6f5c39, 0.9));
      for (let i = 0; i < 10; i++) {
        const z = -20.5 + hash(i * 4.3 + side) * 26.5, y = 0.9 + hash(i * 7.1) * 2.9;
        if (i % 3 === 0) plane(this.s, `z3_wall_damp_drip_${side}_${i}`, 0.055 + hash(i) * 0.07, 0.35 + hash(i + 2) * 0.95, [x - side * 0.006, y, z], damp, [0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0]);
        else box(this.s, `z3_chipped_tile_${side}_${i}`, [0.018, 0.11 + hash(i) * 0.13, 0.16 + hash(i + 1) * 0.18], [x - side * 0.012, y, z], chipMat);
      }
    }

    // simplified block numerals/depth ticks on the end wall, legible as pool depth signage even in grey-box.
    for (let i = 0; i < 4; i++) {
      box(this.s, `z3_depth_marker_digit_${i}`, [0.12, 0.34 - (i % 2) * 0.1, 0.018], [-1.1 + i * 0.28, 2.05, -22.49], mat(0x0b3750, 0.4));
    }
    box(this.s, 'z3_depth_marker_m', [0.34, 0.22, 0.018], [0.35, 2.04, -22.49], mat(0x0b3750, 0.4));

    // columns and repeating arch openings
    for (let z = 2; z >= -20; z -= 4) {
      box(this.s, `z3_column_l_${z}`, [0.46, 3.8, 0.46], [-3.72, 1.9, z], tileB);
      box(this.s, `z3_column_r_${z}`, [0.46, 3.8, 0.46], [3.72, 1.9, z], tileB);
      box(this.s, `z3_arch_lintel_${z}`, [7.4, 0.28, 0.35], [0, 3.5, z], tileA);
      for (const side of [-1, 1]) for (let band = 0; band < 5; band++) {
        box(this.s, `z3_column_tile_band_${z}_${side}_${band}`, [0.5, 0.018, 0.5], [side * 3.72, 0.8 + band * 0.58, z], grout);
      }
      box(this.s, `z3_column_mosaic_l_${z}`, [0.51, 0.16, 0.51], [-3.72, 1.16, z], mat(0x126eab, 0.3));
      box(this.s, `z3_column_mosaic_r_${z}`, [0.51, 0.16, 0.51], [3.72, 1.16, z], mat(0x126eab, 0.3));
    }
    // water plane and lane-rope/pipe details
    this.waterMat = mat(0x55b6c0, 0.055, 0.18, 0x0a5964, 0.24) as THREE.MeshStandardMaterial;
    this.waterMat.transparent = true; this.waterMat.opacity = 0.78; this.waterMat.depthWrite = false; this.waterMat.side = THREE.DoubleSide;
    const wc = document.createElement('canvas'); wc.width = wc.height = 256;
    const wg = wc.getContext('2d')!;
    wg.fillStyle = 'rgb(104,188,196)'; wg.fillRect(0, 0, 256, 256);
    // broad non-repeating depth falloff plus dense crossing wave structure; the surface must
    // read as a shallow volume at grazing angles, not as glossy floor paint.
    const deep = wg.createLinearGradient(0, 0, 0, 256); deep.addColorStop(0, 'rgba(5,54,72,0.48)'); deep.addColorStop(0.42, 'rgba(24,126,140,0.16)'); deep.addColorStop(1, 'rgba(3,38,55,0.55)'); wg.fillStyle = deep; wg.fillRect(0, 0, 256, 256);
    for (let y = 3; y < 256; y += 5) {
      const alpha = 0.30 + hash(y * 1.71) * 0.32;
      wg.strokeStyle = `rgba(225,255,248,${alpha})`; wg.lineWidth = 0.9 + hash(y * 2.3) * 1.65;
      wg.beginPath();
      for (let x = 0; x <= 256; x += 5) {
        const yy = y + Math.sin(x * 0.065 + y * 0.31) * 2.3 + Math.sin(x * 0.19 + y) * 0.9;
        if (x === 0) wg.moveTo(x, yy); else wg.lineTo(x, yy);
      }
      wg.stroke();
    }
    for (let x = 4; x < 256; x += 17) {
      wg.strokeStyle = `rgba(8,65,78,${0.08 + hash(x) * 0.11})`; wg.lineWidth = 2.2;
      wg.beginPath(); wg.moveTo(x + Math.sin(x) * 2, 0); wg.lineTo(x + Math.cos(x) * 3, 256); wg.stroke();
    }
    const waterTex = new THREE.CanvasTexture(wc); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(1, 1);
    this.waterMat.map = waterTex;
    // segmented closed-form water surface: genuine shallow wave displacement catches light at
    // grazing angles, rather than a single perfectly planar glossy sheet.
    const waterGeo = new THREE.PlaneGeometry(8, 27, 24, 72);
    this.water = new THREE.Mesh(waterGeo, this.waterMat);
    this.water.name = 'z3_water_surface'; this.water.userData.fx_entity = 'z3_water_surface';
    this.water.position.set(0, 0.45, -6); this.water.rotation.set(-Math.PI / 2, 0, 0);
    this.water.receiveShadow = true; this.s.add(this.water);
    this.waterBase = (waterGeo.attributes.position.array as Float32Array).slice();
    // physical meniscus/edge thickness at the walls and step face: these small bright/dark lines
    // are what separate a knee-deep water surface from a polished floor at first-person distance.
    const meniscus = mat(0x476f6a, 0.30, 0, 0x123c3c, 0.07);
    for (const side of [-1, 1]) {
      // Segmented contact lines sit directly on the vertical tile, with small deterministic
      // height variation: this is the visible interruption real water makes on a wall.
      for (let seg = 0; seg < 46; seg++) {
        const z = -20.2 + seg * 0.62, yy = 0.458 + (hash(seg * 3.1 + side) - 0.5) * 0.018;
        box(this.s, `z3_wall_true_waterline_${side}_${seg}`, [0.026, 0.018, 0.56], [side * 3.968, yy, z], meniscus);
        box(this.s, `z3_wall_wet_immersion_band_${side}_${seg}`, [0.018, 0.18, 0.56], [side * 3.972, yy - 0.105, z], basic(0x031f27, 0.28));
      }
      box(this.s, `z3_water_wall_contact_shadow_${side}`, [0.028, 0.055, 27], [side * 3.88, 0.425, -6], basic(0x03262d, 0.26));
    }
    // Square pillar waterline collars and damp interruption bands at every column.
    for (let z = 2; z >= -20; z -= 4) for (const side of [-1, 1]) {
      const cx = side * 3.72;
      box(this.s, `z3_pillar_waterline_front_${side}_${z}`, [0.56, 0.022, 0.026], [cx, 0.46, z - 0.255], meniscus);
      box(this.s, `z3_pillar_waterline_back_${side}_${z}`, [0.56, 0.022, 0.026], [cx, 0.46, z + 0.255], meniscus);
      box(this.s, `z3_pillar_waterline_side_a_${side}_${z}`, [0.026, 0.022, 0.56], [cx - 0.255, 0.46, z], meniscus);
      box(this.s, `z3_pillar_waterline_side_b_${side}_${z}`, [0.026, 0.022, 0.56], [cx + 0.255, 0.46, z], meniscus);
      box(this.s, `z3_pillar_wet_band_front_${side}_${z}`, [0.54, 0.17, 0.018], [cx, 0.35, z - 0.252], basic(0x03242c, 0.30));
      box(this.s, `z3_pillar_wet_band_side_${side}_${z}`, [0.018, 0.17, 0.54], [cx - side * 0.252, 0.35, z], basic(0x03242c, 0.30));
    }
    // Bench/contact-object water interruptions: bright meniscus ticks around legs and the chair legs.
    for (const [bi, x, z] of [[0, -3.98, -1.92], [1, -3.98, -1.08], [2, -3.35, -1.92], [3, -3.35, -1.08], [4, 3.18, 3.48], [5, 3.72, 3.48]] as const) {
      box(this.s, `z3_object_waterline_tick_${bi}`, [0.18, 0.018, 0.045], [x, 0.463, z], meniscus, [0, hash(bi) * 0.8, 0]);
      box(this.s, `z3_object_wet_tick_${bi}`, [0.15, 0.095, 0.032], [x, 0.405, z], basic(0x021d24, 0.32), [0, hash(bi) * 0.8, 0]);
    }
    box(this.s, 'z3_water_front_depth_edge', [7.6, 0.045, 0.025], [0, 0.43, 4.96], basic(0x063844, 0.32));
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? -1 : 1;
      plane(this.s, `z3_water_edge_foam_break_${i}`, 0.08 + hash(i) * 0.18, 0.012 + hash(i + 2) * 0.025, [side * (3.58 + hash(i) * 0.12), 0.466, -18 + hash(i * 4.2) * 23], basic(0xd9fff6, 0.22 + hash(i + 5) * 0.16), [-Math.PI / 2, 0, hash(i + 7) * Math.PI]);
    }
    // Interaction geometry: expanding closed-form wake rings from the wading viewer, plus
    // persistent contact ripples around bench/chair legs and small floating debris. These are
    // horizontal water-surface disturbances rather than decorative wall trim.
    const rippleCanvas = document.createElement('canvas'); rippleCanvas.width = rippleCanvas.height = 128;
    const rg = rippleCanvas.getContext('2d')!; rg.clearRect(0, 0, 128, 128);
    for (let ring = 0; ring < 3; ring++) {
      rg.strokeStyle = `rgba(255,255,255,${0.62 - ring * 0.14})`; rg.lineWidth = 2.6 - ring * 0.45;
      for (const arc of [[0.05, 1.55], [1.85, 3.35], [3.75, 5.75]] as const) {
        rg.beginPath();
        for (let k = 0; k <= 18; k++) {
          const a = arc[0] + (arc[1] - arc[0]) * (k / 18);
          const rr = 28 + ring * 13 + Math.sin(a * 3.1 + ring) * 2.2 + Math.sin(a * 7.3 + ring * 2) * 1.1;
          const x = 64 + Math.cos(a) * rr, y = 64 + Math.sin(a) * rr * 0.72;
          if (k === 0) rg.moveTo(x, y); else rg.lineTo(x, y);
        }
        rg.stroke();
      }
    }
    const rippleTex = new THREE.CanvasTexture(rippleCanvas); rippleTex.colorSpace = THREE.SRGBColorSpace;
    const rippleGeo = new THREE.PlaneGeometry(2, 2);
    const makeRipple = (name: string, opacity: number) => {
      const rm = new THREE.MeshBasicMaterial({ map: rippleTex, color: 0xbdfcf2, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
      const r = new THREE.Mesh(rippleGeo, rm);
      r.name = r.userData.fx_entity = name; r.rotation.x = -Math.PI / 2; r.renderOrder = 5; this.s.add(r);
      return r;
    };
    for (let i = 0; i < 14; i++) this.cameraWakeRings.push(makeRipple(`z3_viewer_bow_wake_ring_${i}`, 0));
    const contactPts: Array<[number, number]> = [
      [-3.98, -1.92], [-3.98, -1.08], [-3.35, -1.92], [-3.35, -1.08], [3.18, 3.48], [3.72, 3.48],
      [-3.0, -4.5], [-2.45, -5.6], [-1.9, -6.7], [-1.35, -7.8], [3.3, -8.0], [3.3, -9.8], [2.4, -5.2], [3.5, -6.5],
    ];
    contactPts.forEach(([x, z], i) => {
      for (let k = 0; k < 2; k++) this.contactRipples.push({ mesh: makeRipple(`z3_contact_ripple_${i}_${k}`, 0), x, z, phase: hash(i * 7 + k * 3) });
    });
    for (let i = 0; i < 10; i++) this.creatureRipples.push(makeRipple(`z3_mirrorling_step_ripple_${i}`, 0));
    for (let i = 0; i < 8; i++) {
      const dm = new THREE.MeshBasicMaterial({ color: 0xa9fff2, transparent: true, opacity: 0, depthWrite: false });
      const d = box(this.s, `z3_mirrorling_water_drip_${i}`, [0.012, 0.32, 0.012], [0, 0.3, 0], dm);
      d.renderOrder = 6; this.creatureDrips.push(d);
    }

    const gc = document.createElement('canvas'); gc.width = gc.height = 256;
    const gg = gc.getContext('2d')!;
    gg.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 26; i++) {
      const x = 20 + hash(i * 3 + 1) * 216, y = 18 + hash(i * 5 + 2) * 220;
      const rx = 12 + hash(i + 4) * 32, ry = 2.5 + hash(i + 8) * 7;
      const grad = gg.createRadialGradient(0, 0, 0, 0, 0, rx);
      grad.addColorStop(0, `rgba(210,255,248,${0.12 + hash(i) * 0.16})`);
      grad.addColorStop(0.55, 'rgba(130,230,225,0.055)');
      grad.addColorStop(1, 'rgba(130,230,225,0)');
      gg.fillStyle = grad;
      gg.save(); gg.translate(x, y); gg.scale(1, ry / rx); gg.beginPath(); gg.arc(0, 0, rx, 0, Math.PI * 2); gg.fill(); gg.restore();
    }
    // dense directional capillary wavelets: these catch strips as broken moving threads rather
    // than broad polished-floor sheen.
    for (let y = 2; y < 256; y += 7) {
      if (hash(y * 2.9) < 0.24) continue;
      gg.strokeStyle = `rgba(225,255,250,${0.07 + hash(y * 4.7) * 0.12})`; gg.lineWidth = 0.7 + hash(y) * 0.9;
      gg.beginPath();
      for (let x = 0; x <= 256; x += 7) {
        const yy = y + Math.sin(x * 0.08 + y * 0.37) * 2.2 + Math.sin(x * 0.23 + y) * 0.9;
        const active = hash(y * 0.71 + Math.floor(x / 42) * 3.3) > 0.34;
        if (x === 0 || !active) gg.moveTo(x, yy); else gg.lineTo(x, yy);
      }
      gg.stroke();
    }
    for (let i = 0; i < 34; i++) {
      const x = hash(i * 3.1) * 256, y = hash(i * 5.7) * 256;
      gg.strokeStyle = `rgba(175,245,238,${0.08 + hash(i) * 0.13})`; gg.lineWidth = 0.8;
      gg.beginPath(); gg.moveTo(x, y); gg.lineTo(x + 18 + hash(i + 1) * 32, y + (hash(i + 2) - 0.5) * 12); gg.stroke();
    }
    const glintTex = new THREE.CanvasTexture(gc); glintTex.wrapS = glintTex.wrapT = THREE.RepeatWrapping; glintTex.repeat.set(2.2, 7.5);
    this.waterGlintMat = new THREE.MeshBasicMaterial({ map: glintTex, transparent: true, opacity: 0.48, depthWrite: false });
    plane(this.s, 'z3_water_specular_patches', 8, 27, [0, 0.456, -6], this.waterGlintMat, [-Math.PI / 2, 0, 0]);
    // Player-proxy reflection for the look-down beat: a full-length body reflection, pre-distorted
    // in horizontal water slices, with the flashlight and its warm scatter physically connected at the hand.
    const baseRefl = document.createElement('canvas'); baseRefl.width = 256; baseRefl.height = 512;
    const br = baseRefl.getContext('2d')!; br.clearRect(0, 0, 256, 512);
    br.fillStyle = 'rgba(0,5,8,0.94)';
    br.beginPath(); br.ellipse(128, 44, 23, 29, 0, 0, Math.PI * 2); br.fill();
    br.fillRect(120, 68, 16, 17);
    br.beginPath();
    br.moveTo(94, 88); br.lineTo(162, 88); br.lineTo(153, 207); br.lineTo(103, 207); br.closePath(); br.fill();
    // hanging left arm and right arm bent forward around the flashlight
    br.beginPath(); br.ellipse(91, 145, 12, 65, -0.13, 0, Math.PI * 2); br.fill();
    br.save(); br.translate(158, 121); br.rotate(-0.58); br.fillRect(0, -8, 63, 17); br.fillRect(53, -11, 25, 22); br.restore();
    // separate legs and feet, visible below the torso rather than a single cut-out column
    br.beginPath(); br.moveTo(108, 203); br.lineTo(126, 203); br.lineTo(121, 356); br.lineTo(99, 356); br.closePath(); br.fill();
    br.beginPath(); br.moveTo(132, 203); br.lineTo(151, 203); br.lineTo(160, 356); br.lineTo(137, 356); br.closePath(); br.fill();
    br.beginPath(); br.ellipse(109, 365, 17, 8, -0.08, 0, Math.PI * 2); br.fill();
    br.beginPath(); br.ellipse(151, 365, 17, 8, 0.08, 0, Math.PI * 2); br.fill();
    // black flashlight body in the reflected hand and a connected narrow warm emission streak
    br.save(); br.translate(201, 92); br.rotate(-0.48);
    br.fillStyle = 'rgba(0,3,5,0.96)'; br.fillRect(0, -7, 38, 14); br.fillRect(31, -9, 13, 18);
    const handBeam = br.createLinearGradient(39, 0, 116, -34);
    handBeam.addColorStop(0, 'rgba(255,236,184,0.62)'); handBeam.addColorStop(0.45, 'rgba(210,248,232,0.20)'); handBeam.addColorStop(1, 'rgba(210,248,232,0)');
    br.fillStyle = handBeam; br.beginPath(); br.moveTo(39, -7); br.lineTo(122, -34); br.lineTo(122, 20); br.lineTo(39, 7); br.closePath(); br.fill();
    br.restore();
    const pc = document.createElement('canvas'); pc.width = 256; pc.height = 512;
    const pg = pc.getContext('2d')!; pg.clearRect(0, 0, 256, 512);
    for (let y = 0; y < 512; y += 3) {
      const wobble = Math.sin(y * 0.055) * 7.5 + Math.sin(y * 0.151 + 1.2) * 3.8 + Math.sin(y * 0.31) * 1.4;
      pg.drawImage(baseRefl, 0, y, 256, 3, wobble, y, 256, 3);
    }
    pg.strokeStyle = 'rgba(135,230,224,0.11)'; pg.lineWidth = 1;
    for (let y = 14; y < 500; y += 19) {
      pg.beginPath();
      for (let x = 35; x <= 220; x += 8) {
        const yy = y + Math.sin(x * 0.06 + y * 0.17) * 2.5;
        if (x === 35) pg.moveTo(x, yy); else pg.lineTo(x, yy);
      }
      pg.stroke();
    }
    const playerTex = new THREE.CanvasTexture(pc); playerTex.colorSpace = THREE.SRGBColorSpace;
    this.playerReflectionMat = new THREE.MeshBasicMaterial({ map: playerTex, transparent: true, opacity: 0, depthWrite: false });
    this.playerReflection = plane(this.s, 'z3_player_proxy_reflection', 1.86, 4.75, [0, 0.448, 1.5], this.playerReflectionMat, [-Math.PI / 2, 0, 0]);
    this.playerReflection.renderOrder = 4; this.playerReflection.visible = false;
    this.playerReflection.userData.baseRefl = baseRefl;
    this.playerReflection.userData.reflectCtx = pg;
    this.playerReflection.userData.reflectTex = playerTex;
    const bc = document.createElement('canvas'); bc.width = 256; bc.height = 256;
    const bg = bc.getContext('2d')!; bg.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 10; i++) {
      const x = 45 + hash(i * 2.7) * 165, y = 55 + hash(i * 4.1) * 145;
      const rx = 12 + hash(i) * 30, ry = 3 + hash(i + 2) * 9;
      const bgrad = bg.createRadialGradient(0, 0, 0, 0, 0, rx);
      bgrad.addColorStop(0, `rgba(255,238,190,${0.18 + hash(i + 4) * 0.2})`);
      bgrad.addColorStop(0.55, 'rgba(175,245,230,0.08)'); bgrad.addColorStop(1, 'rgba(175,245,230,0)');
      bg.fillStyle = bgrad; bg.save(); bg.translate(x, y); bg.rotate((hash(i + 5) - 0.5) * 0.8); bg.scale(1, ry / rx); bg.beginPath(); bg.arc(0, 0, rx, 0, Math.PI * 2); bg.fill(); bg.restore();
    }
    const beamTex = new THREE.CanvasTexture(bc); beamTex.colorSpace = THREE.SRGBColorSpace;
    this.beamReflectionMat = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0, depthWrite: false });
    this.beamReflection = plane(this.s, 'z3_lagging_beam_reflection', 1.45, 2.1, [0, 0.452, 1.0], this.beamReflectionMat, [-Math.PI / 2, 0, 0]);
    this.beamReflection.renderOrder = 5; this.beamReflection.visible = false;
    // Mirrorling contact disturbance: broken water displacement/caustic smears, no graphic neon rings.
    const wc2 = document.createElement('canvas'); wc2.width = wc2.height = 256;
    const w2g = wc2.getContext('2d')!; w2g.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 24; i++) {
      const ang = hash(i * 1.7) * Math.PI * 2;
      const rr = 24 + hash(i + 3) * 82;
      const x = 128 + Math.cos(ang) * rr, y = 128 + Math.sin(ang) * rr * 0.62;
      const len = 14 + hash(i + 5) * 42;
      w2g.strokeStyle = `rgba(170,245,235,${0.08 + hash(i) * 0.12})`;
      w2g.lineWidth = 1 + hash(i + 7) * 2.5;
      w2g.beginPath();
      for (let k = 0; k <= 5; k++) {
        const xx = x + Math.cos(ang + Math.PI / 2) * (k - 2.5) * len * 0.18;
        const yy = y + Math.sin(ang + Math.PI / 2) * (k - 2.5) * len * 0.11 + Math.sin(k * 1.7 + i) * 3;
        if (k === 0) w2g.moveTo(xx, yy); else w2g.lineTo(xx, yy);
      }
      w2g.stroke();
    }
    const wakeTex = new THREE.CanvasTexture(wc2); wakeTex.colorSpace = THREE.SRGBColorSpace;
    this.mirrorlingWakeMat = new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, opacity: 0, depthWrite: false });
    this.mirrorlingWake = plane(this.s, 'z3_mirrorling_water_displacement', 1.25, 0.82, [0, 0.461, -3.4], this.mirrorlingWakeMat, [-Math.PI / 2, 0, 0]);
    this.mirrorlingWake.renderOrder = 3; this.mirrorlingWake.visible = false;
    // knee-deep pool cues: submerged entry steps, floor lane markings, depth tiles, caustic strips and floating equipment
    for (let st = 0; st < 3; st++) {
      box(this.s, `z3_submerged_step_${st}`, [7.6, 0.16, 0.55], [0, 0.28 - st * 0.18, 4.75 - st * 0.55], st % 2 ? tileA : tileB);
      box(this.s, `z3_step_noseline_${st}`, [7.6, 0.025, 0.035], [0, 0.37 - st * 0.18, 4.49 - st * 0.55], mat(0x103c45, 0.5));
    }
    for (const x of [-1.6, 0, 1.6]) box(this.s, `z3_floor_lane_${x}`, [0.09, 0.012, 25], [x, -0.105, -6.5], mat(0x24576a, 0.52));
    for (let i = 0; i < 22; i++) {
      const side = i % 2 ? -1 : 1;
      const z = 4 - i * 1.15;
      const cm = mat(0x9ffff2, 0.18, 0, 0x6ffff0, 0.55);
      const c = box(this.s, `z3_caustic_wall_${i}`, [0.018, 0.018, 0.45 + hash(i) * 0.5], [side * 4.0, 1.0 + hash(i + 3) * 2.6, z], cm, [0, 0, (hash(i + 5) - 0.5) * 0.7]);
      c.scale.z = 1;
    }
    box(this.s, 'z3_no_diving_sign', [1.1, 0.42, 0.025], [2.8, 1.45, 5.08], mat(0xe8e1cf, 0.5));
    box(this.s, 'z3_no_diving_red_bar', [0.78, 0.09, 0.03], [2.8, 1.45, 5.05], mat(0xd3352c, 0.4), [0, 0, -0.35]);
    box(this.s, 'z3_bench', [2.0, 0.12, 0.42], [-3.65, 0.65, -1.5], metal);
    box(this.s, 'z3_lifeguard_chair_seat', [0.62, 0.1, 0.55], [3.45, 1.75, 3.6], mat(0xf0ead6, 0.5));
    for (const dx of [-0.22, 0.22]) cyl(this.s, `z3_lifeguard_leg_${dx}`, 0.025, 1.8, [3.45 + dx, 0.9, 3.6], metal, [0.12, 0, 0], 8);
    for (let i = 0; i < 4; i++) box(this.s, `z3_kickboard_${i}`, [0.34, 0.045, 0.48], [-3.0 + i * 0.55, 0.49, -4.5 - i * 1.1], i % 2 ? mat(0xff6138, 0.35) : mat(0x2e7fe6, 0.35), [0, hash(i) * 0.7, 0]);
    sph(this.s, 'z3_rubber_duck', 0.11, [-2.5, 0.54, -7.5], mat(0xffd13b, 0.35), 16).scale.set(1.15, 0.8, 0.85);
    for (let z = -20; z <= 6; z += 4) {
      const light = new THREE.PointLight(0x8cecff, 1.3, 8, 1.8); light.position.set((z / 4) % 2 ? -2.8 : 2.8, 3.9, z); this.s.add(light);
      const strip = box(this.s, `z3_light_strip_${z}`, [1.2, 0.05, 0.08], [(z / 4) % 2 ? -2.8 : 2.8, 4.55, z], mat(0xd7ffff, 0.2, 0, 0xbfffff, 2.0));
      this.strips.push(strip);
    }
    for (let i = 0; i < 7; i++) cyl(this.s, `z3_pipe_${i}`, 0.035, 28, [i % 2 ? -3.9 : 3.9, 3.6 + (i % 3) * 0.16, -7], metal, [Math.PI / 2, 0, 0], 12);
    cyl(this.s, 'z3_ladder_rail_l', 0.025, 1.8, [-2.8, 1.0, 5.35], metal, [0.2, 0, 0], 10);
    cyl(this.s, 'z3_ladder_rail_r', 0.025, 1.8, [-2.3, 1.0, 5.35], metal, [0.2, 0, 0], 10);
    for (let i = 0; i < 4; i++) cyl(this.s, `z3_ladder_rung_${i}`, 0.018, 0.5, [-2.55, 0.45 + i * 0.28, 5.35], metal, [0, 0, Math.PI / 2], 10);
    // floating props
    this.stepGlow = mat(0xd7ffff, 0.3, 0, 0x8fffff, 1.7) as THREE.MeshStandardMaterial;
    box(this.s, 'z3_step_edge_light', [7.4, 0.035, 0.04], [0, 0.51, 5.15], this.stepGlow);
    cyl(this.s, 'z3_life_ring', 0.32, 0.06, [3.5, 0.52, -6.5], mat(0xffffff, 0.5), [Math.PI / 2, 0, 0], 32);
    box(this.s, 'z3_life_ring_band', [0.16, 0.07, 0.08], [3.5, 0.55, -6.18], mat(0xe34b38, 0.45));
    for (let i = 0; i < 10; i++) {
      const l = plane(this.s, `z3_leaf_${i}`, 0.12, 0.05, [-3.3 + hash(i) * 6.6, 0.47, -18 + hash(i + 2) * 22], leaf, [-Math.PI / 2, 0, hash(i) * 6]);
      l.userData.basePos = l.position.clone(); this.surfaceLeaves.push(l);
    }
    // underwater leaves/spores
    for (let i = 0; i < 28; i++) {
      const b = sph(this.s, `z3_under_bit_${i}`, 0.018 + hash(i) * 0.02, [-3.5 + hash(i) * 7, -0.1 - hash(i + 1) * 1.2, -14 + hash(i + 2) * 16], basic(0x9de6d5, 0.5), 8);
      b.userData.basePos = b.position.clone(); this.underwaterBits.push(b);
    }
    // pump/filter/graffiti/lane rope/rust details
    box(this.s, 'z3_pump_unit', [0.65, 0.8, 0.45], [-3.4, 0.4, -19.8], metal);
    cyl(this.s, 'z3_filter_intake', 0.18, 0.08, [3.95, 0.6, -3.5], dark, [0, 0, Math.PI / 2], 24);
    box(this.s, 'z3_graffiti_proxy', [1.3, 0.35, 0.015], [-4.0, 1.55, -9.5], mat(0xed4178, 0.5), [0, 0, -0.08]);
    for (let i = 0; i < 8; i++) sph(this.s, `z3_lane_float_${i}`, 0.08, [3.3, 0.5, -8 - i * 0.45], i % 2 ? mat(0xffffff, 0.4) : mat(0xff5738, 0.4), 10);
    for (let i = 0; i < 10; i++) box(this.s, `z3_rust_drip_${i}`, [0.025, 0.3 + hash(i) * 0.7, 0.012], [-3.99, 1.7 + hash(i) * 1.3, -18 + i * 1.7], mat(0x8d3e19, 0.9));

    // Modular Blender pool architecture/props replace the simplest primitive dressing while preserving layout.
    this.s.traverse((o) => { if (/^z3_(no_diving_sign|no_diving_red_bar|bench|lifeguard_|kickboard_|rubber_duck|ladder_|life_ring)/.test(o.name)) o.visible = false; });
    for (const side of [-1, 1]) for (let i = 0; i < 8; i++) this.cloneProp(this.poolKit, 'tiled_wall_panel_root', [side * 3.98, 0.42, 4 - i * 3.4], side < 0 ? Math.PI / 2 : -Math.PI / 2, 1, `z3_wall_panel_asset_${side}_${i}`);
    for (let z = 2; z >= -20; z -= 4) for (const side of [-1, 1]) this.cloneProp(this.poolKit, 'tiled_pillar_root', [side * 3.72, 0, z], 0, 1, `z3_pillar_asset_${side}_${z}`);
    for (let z = 2; z >= -20; z -= 8) this.cloneProp(this.poolKit, 'pool_arch_module_root', [0, 1.05, z], 0, 1, `z3_arch_asset_${z}`);
    this.cloneProp(this.poolKit, 'pool_ladder_root', [-2.55, 0.1, 5.25], 0, 1, 'z3_ladder_asset');
    this.cloneProp(this.poolKit, 'pool_steps_root', [0, 0.05, 4.5], 0, 1, 'z3_steps_asset');
    this.cloneProp(this.propPack, 'lifeguard_chair_root', [3.35, 0, 3.5], -0.4, 1, 'z3_lifeguard_asset');
    this.cloneProp(this.propPack, 'pool_bench_root', [-3.55, 0, -1.5], Math.PI / 2, 1, 'z3_bench_asset');
    this.cloneProp(this.propPack, 'no_diving_sign_root', [2.8, 1.22, 5.04], 0, 1, 'z3_no_diving_asset');
    for (let i = 0; i < 4; i++) this.cloneProp(this.propPack, 'kickboard_root', [-3.0 + i * 0.55, 0.49, -4.5 - i * 1.1], hash(i) * 0.7, 1, `z3_kickboard_asset_${i}`);
    this.cloneProp(this.propPack, 'rubber_duck_root', [-2.5, 0.47, -7.5], 0.25, 1, 'z3_duck_asset');
    this.cloneProp(this.propPack, 'rescue_ring_root', [3.5, 0.5, -6.5], 0, 1, 'z3_rescue_ring_asset');
    this.cloneProp(this.propPack, 'pool_noodle_root', [2.4, 0.48, -5.2], 0.5, 1, 'z3_noodle_asset');
    this.cloneProp(this.propPack, 'pool_drain_root', [2.8, -0.1, -12], 0, 1, 'z3_drain_asset');
    this.cloneProp(this.propPack, 'folded_towel_root', [-3.55, 0.48, -1.45], 0.2, 1, 'z3_towel_asset');
    this.cloneProp(this.propPack, 'handless_clock_root', [0, 3.45, -21.9], 0, 1, 'z3_clock_asset');
    this.cloneProp(this.propPack, 'flipflops_root', [2.2, 0.02, 4.3], -0.35, 1, 'z3_flipflops_asset');
    for (let i = 0; i < 3; i++) this.cloneProp(this.propPack, 'shower_head_root', [-3.92, 2.1, -13.5 - i * 1.4], Math.PI / 2, 1, `z3_shower_asset_${i}`);

    // phone floating with eye sticker/antenna
    this.phone = new THREE.Group(); this.phone.position.set(3, 0.5, -2);
    box(this.phone, 'z3_phone_body', [0.22, 0.07, 0.38], [0, 0, 0], mat(0x2a2a32, 0.42));
    box(this.phone, 'z3_phone_screen', [0.16, 0.012, 0.24], [0, 0.04, 0], mat(0x1f3a42, 0.2, 0, 0x6de8ff, 0.7));
    cyl(this.phone, 'z3_phone_antenna', 0.008, 0.22, [0.08, 0.12, -0.16], metal, [0.25, 0, 0], 8);
    sph(this.phone, 'z3_phone_eye_sticker', 0.035, [-0.05, 0.045, 0.12], basic(0xffffff), 10);
    this.phone.name = 'z3_floating_phone'; this.phone.userData.fx_entity = 'z3_floating_phone'; this.s.add(this.phone);

    // Mirrorling: elongated chrome body, upside-down teardrop head, long segmented arms
    this.mirrorling = new THREE.Group(); this.mirrorling.position.set(0, 0.45, -8); this.mirrorling.visible = false; this.s.add(this.mirrorling);
    const torso = sph(this.mirrorling, 'z3_mirrorling_torso', 0.34, [0, 1.25, 0], chrome, 24); torso.scale.set(0.55, 2.4, 0.35);
    const head = sph(this.mirrorling, 'z3_mirrorling_teardrop_head', 0.23, [0, 2.45, 0], chrome, 24); head.scale.set(0.72, 1.35, 0.55);
    for (const side of [-1, 1]) {
      const upper = cyl(this.mirrorling, `z3_mirrorling_arm_upper_${side}`, 0.035, 1.1, [side * 0.31, 1.65, 0], chrome, [0, 0, side * 0.28], 12);
      const lower = cyl(this.mirrorling, `z3_mirrorling_arm_lower_${side}`, 0.025, 1.15, [side * 0.48, 0.86, 0], chrome, [0, 0, side * 0.08], 12);
      this.arms.push(upper, lower);
      cyl(this.mirrorling, `z3_mirrorling_leg_${side}`, 0.045, 1.05, [side * 0.12, 0.05, 0], chrome, [0, 0, side * 0.025], 12);
      // black grout bands across the white-tile silhouette
      box(this.mirrorling, `z3_mirrorling_arm_grout_${side}`, [0.018, 0.52, 0.018], [side * 0.43, 1.2, 0.02], mat(0x071014, 0.8), [0, 0, side * 0.18]);
    }
    for (let band = 0; band < 5; band++) box(this.mirrorling, `z3_mirrorling_torso_grout_${band}`, [0.42, 0.018, 0.02], [0, 0.72 + band * 0.28, 0.13], mat(0x071014, 0.8));
    // reflection copy, not exact hierarchy but readable mirrored double
    this.reflection = this.mirrorling.clone(true); this.reflection.scale.y = -1; this.reflection.position.y = 0.45; this.reflection.visible = false; this.s.add(this.reflection);
    this.reflection.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const mm = (m.material as THREE.MeshStandardMaterial).clone(); mm.emissive = new THREE.Color(0x2e8791); mm.emissiveIntensity = 0.10; mm.transparent = true; mm.opacity = 0.55; m.material = mm; } });

    // huge Tenant silhouette far underwater
    this.tenant = box(this.s, 'z3_tenant_underwater', [1.2, 4.8, 0.5], [0, -1.8, -10], basic(0x02080a, 0.65));
    this.tenant.visible = false;
  }

  private cloneProp(source: GLTFInstance, part: string, pos: [number, number, number], rotY = 0, scale = 1, name = part) {
    const src = source.part(part);
    if (!src) return null;
    const c = skeletonClone(src);
    c.name = c.userData.fx_entity = name;
    c.position.set(...pos);
    c.rotation.set(0, rotY, 0);
    c.scale.setScalar(scale);
    this.s.add(c);
    return c;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    if (!this.envReady) {
      const pmrem = new THREE.PMREMGenerator(this.ctx.renderer);
      this.chromeEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      const applyChromeEnv = (root: THREE.Object3D) => root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          const mm = m as THREE.MeshStandardMaterial;
          if (/chrome|tile_highlight/.test(mm.name)) { mm.envMap = this.chromeEnv; mm.envMapIntensity = 0.9; mm.needsUpdate = true; }
        });
      });
      applyChromeEnv(this.mirrorlingAsset.root);
      applyChromeEnv(this.mirrorlingReflection.root);
      this.envReady = true;
    }
    const t = f.t;
    applyFpCamera(this.cam, KEYS, t, out.width / out.height);
    updateFlashlight(this.flash.light, this.flash.target, this.cam, t, 0.38, t > 73 ? 0.16 : 0.04);
    // deterministic surface shimmer and drifting floaters
    this.water.position.y = 0.45 + Math.sin(t * 1.8) * 0.002;
    const wp = this.water.geometry.attributes.position;
    const arr = wp.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = this.waterBase[i]!, y = this.waterBase[i + 1]!;
      arr[i + 2] = Math.sin(x * 2.35 + t * 1.12) * 0.009 + Math.sin(y * 1.48 - t * 0.82) * 0.011 + Math.sin((x * 1.7 + y * 2.9) + t * 1.85) * 0.005;
    }
    wp.needsUpdate = true; this.water.geometry.computeVertexNormals();
    if (this.waterMat.map) { this.waterMat.map.offset.set((t * 0.012) % 1, (t * 0.018) % 1); }
    if (this.waterGlintMat.map) { this.waterGlintMat.map.offset.set((t * 0.006) % 1, (t * 0.010) % 1); this.waterGlintMat.opacity = (0.25 + Math.sin(t * 0.9) * 0.05) * (1 - smooth(79.15, 80, t)); }
    this.waterMat.emissiveIntensity = 0.18 + Math.sin(t * 2.4) * 0.025;
    this.surfaceLeaves.forEach((l, i) => {
      const bp = l.userData.basePos as THREE.Vector3;
      l.position.x = bp.x + Math.sin(t * 0.25 + i) * 0.11;
      l.rotation.z = hash(i) * 6 + Math.sin(t * 0.35 + i) * 0.1;
    });
    this.underwaterBits.forEach((b, i) => {
      const bp = b.userData.basePos as THREE.Vector3;
      b.position.y = bp.y + Math.sin(t * 0.7 + i) * 0.045;
      b.position.x = bp.x + Math.cos(t * 0.4 + i) * 0.035;
    });

    // Wading interaction: rings are emitted from the camera ground position using the same
    // deterministic camera path, so a moving viewer leaves an expanding trailing wake. Rings
    // emitted while the viewer is still have near-zero strength instead of pulsing forever.
    const wakeFade = smooth(55.65, 56.05, t) * (1 - smooth(79.0, 80.0, t));
    this.cameraWakeRings.forEach((r, i) => {
      const cycle = 1.8;
      const age = (t + i * cycle / this.cameraWakeRings.length) % cycle;
      const emitT = t - age;
      const ep = evalCam(KEYS, emitT);
      const epa = evalCam(KEYS, emitT - 0.05), epb = evalCam(KEYS, emitT + 0.05);
      const speed = Math.hypot(epb.pos[0] - epa.pos[0], epb.pos[2] - epa.pos[2]) / 0.1;
      const strength = clamp(speed / 1.4, 0, 1);
      const u = age / cycle;
      const radius = 0.12 + u * 1.15;
      const vx = (epb.pos[0] - epa.pos[0]) / 0.1, vz = (epb.pos[2] - epa.pos[2]) / 0.1;
      const vl = Math.hypot(vx, vz) || 1;
      // the visible mass of a wading wake is shoved ahead of the legs, not centered under the eye
      const bowShift = 0.48 + u * 0.18;
      r.position.set(ep.pos[0] + (vx / vl) * bowShift, this.water.position.y + 0.043, ep.pos[2] + (vz / vl) * bowShift);
      r.scale.setScalar(radius);
      const rm = r.material as THREE.MeshBasicMaterial;
      rm.opacity = 0.68 * (1 - u) * strength * wakeFade;
      r.visible = rm.opacity > 0.006;
    });
    this.contactRipples.forEach((cr) => {
      const u = (t * 0.34 + cr.phase) % 1;
      cr.mesh.position.set(cr.x, this.water.position.y + 0.045, cr.z);
      cr.mesh.scale.setScalar(0.075 + u * 0.43);
      const rm = cr.mesh.material as THREE.MeshBasicMaterial;
      rm.opacity = 0.42 * (1 - u) * wakeFade;
      cr.mesh.visible = rm.opacity > 0.006;
    });

    // strip hum/flicker
    this.strips.forEach((s, i) => { const m = s.material as THREE.MeshStandardMaterial; m.emissiveIntensity = hash(Math.floor(t * 12) + i * 11) < (i === 2 ? 0.22 : 0.04) ? 0.2 : 2.0; });

    // Beat 3.2: planar water reflection of the player-proxy. The dark body is locked to the
    // current camera position, while the warm beam patch is intentionally lagged by 0.42 s.
    const reflPlayer = smooth(58.35, 58.75, t) * (1 - smooth(63.2, 63.9, t));
    this.playerReflection.visible = reflPlayer > 0.015;
    this.beamReflection.visible = reflPlayer > 0.015;
    this.playerReflectionMat.opacity = 0.66 * reflPlayer;
    this.beamReflectionMat.opacity = 0.50 * reflPlayer;
    if (reflPlayer > 0) {
      // Live closed-form wave slicing: the reflected silhouette continually shears apart in
      // horizontal fragments, so it cannot read as a mirror-polished floor during the look-down.
      const base = this.playerReflection.userData.baseRefl as HTMLCanvasElement;
      const pgx = this.playerReflection.userData.reflectCtx as CanvasRenderingContext2D;
      const tex = this.playerReflection.userData.reflectTex as THREE.CanvasTexture;
      pgx.clearRect(0, 0, 256, 512);
      for (let y = 0; y < 512; y += 3) {
        const depthAmp = 4.5 + (y / 512) * 10.5;
        const wobble = Math.sin(y * 0.043 + t * 2.65) * depthAmp + Math.sin(y * 0.127 - t * 4.1) * 3.4 + Math.sin(y * 0.29 + t * 7.3) * 1.15;
        pgx.drawImage(base, 0, y, 256, 3, wobble, y, 256, 3);
      }
      pgx.strokeStyle = 'rgba(145,238,230,0.16)'; pgx.lineWidth = 1;
      for (let y = 10; y < 506; y += 13) {
        pgx.beginPath();
        for (let x = 24; x <= 232; x += 8) {
          const yy = y + Math.sin(x * 0.065 + y * 0.17 + t * 2.4) * 2.7;
          if (x === 24) pgx.moveTo(x, yy); else pgx.lineTo(x, yy);
        }
        pgx.stroke();
      }
      tex.needsUpdate = true;
      const fwdX = this.cam.position.x, fwdZ = this.cam.position.z - 1.08;
      this.playerReflection.position.set(fwdX, 0.448, fwdZ);
      const wrongU = smooth(61.0, 62.2, t) * (1 - smooth(63.0, 63.8, t));
      this.playerReflection.rotation.z = Math.sin(t * 0.7) * 0.055 + Math.sin(t * 1.9) * 0.018 + wrongU * Math.sin((t - 61) * 4.2) * 0.13;
      this.playerReflection.position.x = fwdX + wrongU * Math.sin((t - 61) * 3.1) * 0.11;
      const lag = evalCam(KEYS, t - 0.42);
      const dx = lag.look[0] - lag.pos[0], dy = lag.look[1] - lag.pos[1], dz = lag.look[2] - lag.pos[2];
      const len = Math.hypot(dx, dy, dz) || 1;
      const ny = dy / len;
      const hit = Math.abs(ny) > 1e-4 ? (0.452 - lag.pos[1]) / ny : 2.0;
      const bx = lag.pos[0] + (dx / len) * hit;
      const bz = lag.pos[2] + (dz / len) * hit;
      const handLagX = fwdX + 0.28 + (lag.pos[0] - this.cam.position.x) * 0.35;
      const handLagZ = fwdZ - 0.18 + (lag.pos[2] - this.cam.position.z) * 0.18;
      this.beamReflection.position.set((bx * 0.25) + handLagX * 0.75, 0.452, (bz * 0.25) + handLagZ * 0.75);
      this.beamReflection.rotation.z = -Math.atan2(dx / len, dz / len) + Math.sin(t * 1.3) * 0.04;
    }

    // Mirrorling rule approximation: reflection first, surface reveal only after look-away
    const reflVisible = t > 59.5 && t < 72.1;
    this.reflection.visible = reflVisible;
    // Surface advance happens as discrete wet-tile steps rather than continuous drifting:
    // each step lands late in a 0.9 s cycle, then holds while eye contact continues.
    const stepU = clamp((t - 72.0) / 0.9, 0, 3.0);
    const stepIndex = Math.floor(stepU);
    const stepK = smooth(0.56, 0.86, stepU - stepIndex);
    const advance = Math.min(3, stepIndex + stepK) * 0.78;
    const mz = -3.4 + advance;
    this.reflection.visible = false;
    this.mirrorling.visible = false;
    // GLB reflection appears first with a positional/turning mismatch; surface figure only after the look-away.
    const mismatch = smooth(62.5, 70.5, t);
    this.mirrorlingReflection.root.visible = reflVisible;
    this.mirrorlingReflection.root.position.set(Math.sin(t * 0.7) * 0.05 + mismatch * 0.18, 0.45, mz - 0.35 - mismatch * 0.28);
    this.mirrorlingReflection.root.rotation.y = Math.sin(t * 0.33) * 0.08 + mismatch * 0.28;
    const gaitPhase = stepU - stepIndex;
    const stepPulse = smooth(0.54, 0.7, gaitPhase) * (1 - smooth(0.78, 0.95, gaitPhase));
    this.mirrorlingAsset.root.visible = t > 72.0;
    this.mirrorlingAsset.root.scale.set(1.08, 1.17, 1.08);
    this.mirrorlingAsset.root.position.set((stepIndex % 2 ? -0.025 : 0.025) * stepPulse, 0.45, mz);
    this.mirrorlingAsset.root.rotation.y = 0.38 + smooth(72.2, 74.8, t) * 0.28 + (stepIndex % 2 ? -0.045 : 0.045) * stepPulse;
    this.mirrorlingAsset.root.rotation.x = 0.20 + Math.sin(t * 0.53) * 0.022;
    this.mirrorlingAsset.root.rotation.z = -0.19 + (stepIndex % 2 ? 0.032 : -0.032) * stepPulse;
    // Ground the stepped pose against the wave surface: solve the small vertical offset so the
    // lowest foot exactly meets water instead of hovering as a display figure.
    this.mirrorlingAsset.root.updateMatrixWorld(true);
    const preFeet = [new THREE.Vector3(-0.33, 0.03, -0.25), new THREE.Vector3(0.16, 0.03, 0.34)].map((v) => this.mirrorlingAsset.root.localToWorld(v));
    const lowestFoot = Math.min(preFeet[0]!.y, preFeet[1]!.y);
    this.mirrorlingAsset.root.position.y -= (lowestFoot - (this.water.position.y - 0.115));
    this.mirrorlingWake.visible = t > 72.0;
    this.mirrorlingWake.position.set(this.mirrorlingAsset.root.position.x, 0.496, mz + 0.03);
    this.mirrorlingWake.rotation.z = Math.sin(t * 0.8) * 0.08;
    this.mirrorlingWakeMat.opacity = (t > 72.0 ? 0.34 + stepPulse * 0.22 : 0);
    // water-contact response at both stepping feet plus gravity drips from the reaching hand.
    this.mirrorlingAsset.root.updateMatrixWorld(true);
    const footLocals = [new THREE.Vector3(-0.33, 0.03, -0.25), new THREE.Vector3(0.16, 0.03, 0.34)];
    const footWorld = footLocals.map((v) => this.mirrorlingAsset.root.localToWorld(v.clone()));
    this.creatureRipples.forEach((r, i) => {
      const foot = footWorld[i < 5 ? 0 : 1]!;
      const u = (t * 0.48 + i * 0.19) % 1;
      r.position.set(foot.x, this.water.position.y + 0.046, foot.z);
      r.scale.setScalar(0.10 + u * 0.78);
      const rm = r.material as THREE.MeshBasicMaterial;
      rm.opacity = (t > 72 ? 0.78 : 0) * (1 - u) * (0.74 + stepPulse * 0.26);
      r.visible = rm.opacity > 0.006;
    });
    const handWorld = this.mirrorlingAsset.root.localToWorld(new THREE.Vector3(0.92, 2.02, 0.95));
    this.creatureDrips.forEach((d, i) => {
      const u = (t * 0.72 + i * 0.137) % 1;
      const spread = (i % 4 - 1.5) * 0.026;
      d.position.set(handWorld.x + spread, handWorld.y - 0.12 - u * 0.92, handWorld.z + (hash(i) - 0.5) * 0.045);
      d.scale.y = 0.28 + u * 1.2;
      const dm = d.material as THREE.MeshBasicMaterial;
      dm.opacity = (t > 72 ? 0.20 : 0) * (1 - u);
      d.visible = dm.opacity > 0.006;
    });
    for (const side of [-1, 1] as const) {
      const arm = this.mirrorlingAsset.part(side < 0 ? 'arm_l_upper' : 'arm_r_upper');
      if (arm) arm.rotation.z = 0;
      const lead = (stepIndex % 2 === 0 ? 1 : -1) === side;
      const upperLeg = this.mirrorlingAsset.part(side < 0 ? 'leg_l_upper' : 'leg_r_upper');
      const lowerLeg = this.mirrorlingAsset.part(side < 0 ? 'leg_l_lower' : 'leg_r_lower');
      if (upperLeg) upperLeg.rotation.x = 0;
      if (lowerLeg) lowerLeg.rotation.x = 0;
    }
    // phone eye opens, drifts, rotates to face viewer
    const eye = smooth(70.4, 71.0, t);
    this.phone.position.y = 0.5 + Math.sin(t * 1.7) * 0.018 + eye * 0.04;
    this.phone.rotation.y = Math.atan2(this.cam.position.x - this.phone.position.x, this.cam.position.z - this.phone.position.z);
    this.phone.rotation.z = Math.sin(t * 0.9) * 0.05;

    this.tenant.visible = t > 67.7 && t < 69.4;
    if (this.tenant.visible) this.tenant.position.x = (t - 68.2) * 0.7;
    this.stepGlow.emissiveIntensity = t > 76 ? 2.7 : 1.5;

    const underwater = smooth(79.15, 80, t);
    this.s.fog = new THREE.FogExp2(underwater > 0.4 ? 0x061c22 : 0x0b4652, 0.055 + underwater * 0.22);
    this.waterMat.opacity = 0.78 - underwater * 0.18;

    const gl = this.ctx.renderer;
    gl.setRenderTarget(out); gl.setClearColor(underwater > 0.4 ? 0x03151a : 0x08262d, 1); gl.clear(true, true, true); gl.render(this.s, this.cam); gl.resetState();
    return {
      ...thresholdPost(t, { darkness: 0.32 + underwater * 0.28, exposure: 1.02 - underwater * 0.28, stress: 0.08 + underwater * 0.45 }),
      flash: 0,
      shake: t > 77 ? [0.8 * Math.sin(t * 29), 0.7 * Math.cos(t * 31)] : [0, 0],
    };
  }
  override dispose() { disposeTree(this.s); }
}
