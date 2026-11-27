// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Z2 ball-pit playroom: deterministic grey-box beat blockout with real scale/camera path; uses W1's stabilized first-person/flashlight/sensor kit through the owned look-target adapter.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { resolveAsset } from '../../engine/assets';
import { thresholdPost } from './sensor_post';
import { addFlashlight, applyFpCamera, basic, box, clamp, cyl, disposeTree, hash, mat, plane, smooth, sph, updateFlashlight, type CamKey } from './z1_scene_util';

const KEYS: CamKey[] = [
  { t: 30, pos: [0, 1.65, 7], look: [0, 0.7, 0], fov: 76, gait: 'still' },
  { t: 32.5, pos: [0, 1.65, 7], look: [0, 0.7, 0], fov: 76, gait: 'still' },
  { t: 36, pos: [1.4, 1.65, 5.8], look: [7.5, 1.1, 0.5], fov: 76, gait: 'walk' },
  { t: 38, pos: [1.6, 1.65, 5.2], look: [0, 5.8, -2], fov: 76, gait: 'walk' },
  { t: 40.5, pos: [1.0, 1.65, 4.55], look: [0, 0.65, 2.2], fov: 76, gait: 'walk' },
  { t: 44.5, pos: [1.0, 1.65, 4.55], look: [0, 0.75, 2.4], fov: 74, gait: 'hold' },
  { t: 47.5, pos: [1.0, 1.65, 4.55], look: [0.1, 0.85, 2.4], fov: 74, gait: 'hold' },
  { t: 49.5, pos: [1.0, 1.65, 4.55], look: [3.2, 0.72, 2.4], fov: 74, gait: 'hold' },
  { t: 52.0, pos: [-4.9, 0.82, 5.35], look: [-5, 0.78, 10.6], fov: 76, gait: 'creep' },
  { t: 53.5, pos: [-5, 0.78, 6.3], look: [-5, 0.75, 10.8], fov: 76, gait: 'creep' },
  { t: 55, pos: [-5, 0.74, 8.9], look: [-5, 0.78, 11.5], fov: 78, gait: 'creep' },
];

function playGrimeTexture() {
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = hash(x * 0.37 + y * 2.13) * 34 + hash(Math.floor(x / 9) * 4.1 + Math.floor(y / 9)) * 24;
    const stain = Math.max(0, Math.sin(x * 0.025 + y * 0.016) + Math.sin(y * 0.041) - 1.22) * 62;
    const scuff = hash(x * 5.7 + y * 0.71) > 0.978 ? 44 : 0;
    const v = 132 + n * 2.0 - stain * 1.8 - scuff;
    const id = (y * size + x) * 4;
    img.data[id] = img.data[id + 1] = img.data[id + 2] = Math.max(86, Math.min(255, v)); img.data[id + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(12.0, 12.0);
  return tex;
}

function lightPoolTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 8, 128, 128, 126);
  grad.addColorStop(0, 'rgba(255,255,255,.82)');
  grad.addColorStop(0.42, 'rgba(255,255,255,.34)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 42; i++) {
    g.fillStyle = `rgba(0,0,0,${0.035 + hash(i) * 0.09})`;
    g.beginPath(); g.ellipse(hash(i * 3.1) * 256, hash(i * 5.7) * 256, 8 + hash(i) * 24, 3 + hash(i + 2) * 10, hash(i * 7) * Math.PI, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export default class ThresholdZ2Playroom extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(76, 16 / 9, 0.04, 90);
  private flash!: ReturnType<typeof addFlashlight>;
  private balls!: THREE.InstancedMesh;
  private ballBase: { x: number; z: number; y: number; c: number }[] = [];
  private swimmer = new THREE.Group();
  private ridge: THREE.Mesh[] = [];
  private mouthUpper!: THREE.Mesh;
  private mouthLower!: THREE.Mesh;
  private eyeL!: THREE.Mesh;
  private eyeR!: THREE.Mesh;
  private toys: THREE.Object3D[] = [];
  private toyPhone!: THREE.Group;
  private tenant!: THREE.Mesh;
  private sun!: THREE.DirectionalLight;
  private skylightMats: THREE.MeshStandardMaterial[] = [];
  private tunnelRibs: THREE.Mesh[] = [];
  private swimmerLight!: THREE.PointLight;
  private dummy = new THREE.Object3D();

  private swimmerAsset!: GLTFInstance;
  private playroomKit!: GLTFInstance;
  private toyPack!: GLTFInstance;

  override async init() {
    const resolved = resolveAsset('threshold/z2_pit_swimmer');
    this.swimmerAsset = await GLTFManager.instantiate(resolved.url, { ...resolved.manifest.load, castShadow: true, receiveShadow: true });
    const kitResolved = resolveAsset('threshold/z2_playroom_kit');
    const toyResolved = resolveAsset('threshold/z2_toy_prop_pack');
    this.playroomKit = await GLTFManager.instantiate(kitResolved.url, { ...kitResolved.manifest.load, castShadow: true, receiveShadow: true });
    this.toyPack = await GLTFManager.instantiate(toyResolved.url, { ...toyResolved.manifest.load, castShadow: true, receiveShadow: true });
    const corpse = new THREE.Color(0xb8b2a2);
    const swimmerSeenMats = new Set<THREE.Material>();
    this.swimmerAsset.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mm = mesh.material as THREE.MeshStandardMaterial;
      if (swimmerSeenMats.has(mm)) return;
      swimmerSeenMats.add(mm);
      if (/painted_eye_white|painted_pupil_black/.test(mm.name)) {
        mm.roughness = 0.08; mm.envMapIntensity = 1.1;
      }
      if (/ball_.*vinyl|slide_yellow|vinyl_seam/.test(mm.name)) {
        mm.color.lerp(corpse, /slide_yellow/.test(mm.name) ? 0.18 : 0.30);
        mm.roughness = Math.min(mm.roughness, 0.2);
      }
    });
    this.swimmerAsset.root.position.set(0,0.58,2.35); this.swimmerAsset.root.visible = false; this.s.add(this.swimmerAsset.root);
    this.s.background = new THREE.Color(0x202a31);
    this.s.fog = new THREE.Fog(0x202a31, 13, 42);
    this.flash = addFlashlight(this.s);
    this.s.add(new THREE.HemisphereLight(0xd8e2e6, 0x1d2428, 0.38));
    this.sun = new THREE.DirectionalLight(0xfff0d2, 1.35); this.sun.position.set(-4, 9, 2); this.s.add(this.sun);
    this.swimmerLight = new THREE.PointLight(0xb8c0a0, 0, 4.2, 1.8); this.s.add(this.swimmerLight);

    const foam = mat(0xf1efe8, 0.55);
    const floorFoam = mat(0x554f46, 0.92);
    const red = mat(0xe63b2e, 0.28);
    const yellow = mat(0xf6c83b, 0.25);
    const blue = mat(0x2e6fe6, 0.25);
    const green = mat(0x3bbf5a, 0.3);
    const plasticDark = mat(0x204074, 0.3);
    const mats = [red, yellow, blue, green, mat(0xff7b2e, 0.28)];
    const swimmerPale = [mat(0xbdb4a4, 0.38), mat(0x99a7a4, 0.42), mat(0xc8bd8e, 0.36), mat(0xa88f8b, 0.44), mat(0x81939c, 0.4)];
    const mouthMat = mat(0xd9b83c, 0.62);
    const submergedRidgeMat = mat(0x3f4b4e, 0.30, 0, 0x101a1c, 0.10);
    const grimeTex = playGrimeTexture();
    const lightPoolTex = lightPoolTexture();
    for (const m of [foam, floorFoam, red, yellow, blue, green, plasticDark, ...mats]) {
      const sm = m as THREE.MeshStandardMaterial;
      sm.map = grimeTex; sm.roughnessMap = grimeTex; sm.bumpMap = grimeTex; sm.bumpScale = 0.008;
      sm.color.multiplyScalar((0.78 + hash(sm.color.getHex() * 0.001) * 0.12) * (m === foam ? 0.58 : 0.86)); sm.roughness = Math.max(sm.roughness, 0.42); sm.needsUpdate = true;
    }

    box(this.s, 'z2_floor', [31, 0.1, 21], [0, -0.05, 0], floorFoam);
    box(this.s, 'z2_wall_n', [31, 6, 0.16], [0, 3, -10.5], foam);
    box(this.s, 'z2_wall_s', [31, 6, 0.16], [0, 3, 10.5], foam);
    box(this.s, 'z2_wall_w', [0.16, 6, 21], [-15.5, 3, 0], foam);
    box(this.s, 'z2_wall_e', [0.16, 6, 21], [15.5, 3, 0], foam);
    // painted clouds on walls
    for (let i = 0; i < 11; i++) {
      const x = -13 + hash(i) * 26, z = i % 2 ? -10.39 : 10.39, y = 2.4 + hash(i + 5) * 2.3;
      const cloud = sph(this.s, `z2_cloud_${i}`, 0.42 + hash(i + 2) * 0.25, [x, y, z], basic(0xffffff, 0.88), 16);
      cloud.scale.set(1.8, 0.55, 0.12);
    }
    // abandoned soft-play wear: water stains, hand grime and peeling sticker rectangles on the wall skins
    const stainMat = basic(0x4a3522, 0.32);
    const stickerMats = [basic(0xf3e6a8, 0.78), basic(0xb7d7ef, 0.72), basic(0xe5b2c8, 0.68)];
    for (let i = 0; i < 34; i++) {
      const north = i % 2 === 0, z = north ? -10.405 : 10.405, x = -13.5 + hash(i * 3.1) * 27, y = 0.75 + hash(i * 7.3) * 4.7;
      if (i % 3 === 0) {
        const st = plane(this.s, `z2_wall_peeling_sticker_${i}`, 0.28 + hash(i) * 0.42, 0.14 + hash(i + 2) * 0.28, [x, y, z], stickerMats[i % 3]!, [0, north ? 0 : Math.PI, (hash(i + 5) - 0.5) * 0.35]);
        st.renderOrder = 2;
      } else {
        const st = plane(this.s, `z2_wall_stain_${i}`, 0.35 + hash(i) * 0.8, 0.2 + hash(i + 2) * 0.9, [x, y, z], stainMat, [0, north ? 0 : Math.PI, (hash(i + 5) - 0.5) * 0.7]);
        st.renderOrder = 1;
      }
    }

    // broad age damage crosses panel boundaries; several pads are missing or misaligned rather than merely dirty.
    for (let i = 0; i < 9; i++) {
      const north = i % 2 === 0, z = north ? -10.395 : 10.395;
      plane(this.s, `z2_large_boundary_stain_${i}`, 1.0 + hash(i) * 1.5, 0.5 + hash(i + 1) * 1.1, [-11 + hash(i * 2.7) * 22, 1.1 + hash(i * 4.1) * 3.4, z], basic(0x2d2118, 0.25), [0, north ? 0 : Math.PI, (hash(i + 6) - 0.5) * 0.35]);
      if (i < 5) box(this.s, `z2_missing_padding_backing_${i}`, [0.75, 0.48, 0.025], [-10 + i * 4.8, 2.0 + hash(i) * 2.2, z], mat(0x62594d, 0.88));
    }

    // Larger readable abandonment damage: torn vinyl pads hinge away from the wall, exposing dark compressed backing.
    for (let i = 0; i < 20; i++) {
      const north = i % 2 === 0, inward = north ? 1 : -1, zwall = north ? -10.23 : 10.23;
      const x = -12.5 + hash(i * 3.9) * 25, y = 0.9 + hash(i * 6.1) * 4.0;
      const flapMat = mats[i % mats.length]!;
      const flap = box(this.s, `z2_torn_vinyl_pad_flap_${i}`, [0.46 + hash(i) * 0.42, 0.52 + hash(i + 1) * 0.55, 0.038], [x, y, zwall + inward * (0.035 + hash(i + 2) * 0.055)], flapMat, [(north ? -1 : 1) * (0.22 + hash(i + 4) * 0.42), 0, (hash(i + 6) - 0.5) * 0.22]);
      flap.scale.z = 0.75 + hash(i + 8) * 0.6;
      box(this.s, `z2_torn_pad_dark_backing_${i}`, [0.52 + hash(i) * 0.42, 0.58 + hash(i + 1) * 0.55, 0.018], [x, y, zwall + inward * 0.006], mat(0x29231d, 0.92));
      if (i % 3 === 0) box(this.s, `z2_pad_exposed_foam_edge_${i}`, [0.08, 0.48 + hash(i + 1) * 0.42, 0.045], [x + 0.24, y - 0.03, zwall + inward * 0.055], mat(0xd7cdb8, 0.86), [0, 0, (hash(i + 5) - 0.5) * 0.3]);
    }
    // Floor and pit-edge disorder: cracked plastic shards, wrappers, scattered blocks and crushed debris.
    const debrisMats = [mat(0xd8d1bd, 0.82), mat(0x7d2e25, 0.72), mat(0x2c506e, 0.76), mat(0xb79b54, 0.78), mat(0x24201c, 0.9)];
    for (let i = 0; i < 52; i++) {
      const nearPit = i % 3 === 0;
      const x = nearPit ? (i % 2 ? -6.8 - hash(i) * 2.2 : 6.8 + hash(i) * 2.2) : -13 + hash(i * 2.7) * 26;
      const z = nearPit ? -3.5 + hash(i * 4.1) * 7 : -8.6 + hash(i * 5.3) * 17.2;
      const shard = box(this.s, `z2_floor debris_shard_${i}`.replace(' ', '_'), [0.05 + hash(i) * 0.18, 0.012 + hash(i + 1) * 0.035, 0.035 + hash(i + 2) * 0.16], [x, 0.018, z], debrisMats[i % debrisMats.length]!, [(hash(i + 3) - 0.5) * 0.22, hash(i + 4) * Math.PI, (hash(i + 5) - 0.5) * 0.28]);
      shard.receiveShadow = true;
    }
    // Matte dust drifts sitting on the ball surface break the uniform toy-plastic highlight at wide-read distance.
    for (let i = 0; i < 34; i++) {
      const x = -5.5 + hash(i * 3.3) * 11, z = -3.5 + hash(i * 5.7) * 7;
      const dust = sph(this.s, `z2_ball_surface_dust_clump_${i}`, 0.055 + hash(i) * 0.075, [x, 0.64 + hash(i + 2) * 0.045, z], mat(0x9a8d74, 0.96), 8);
      dust.scale.y = 0.18 + hash(i + 4) * 0.15;
    }
    // A few overturned blocks/stepping pieces make the play structure feel disturbed rather than merely dirty.
    for (let i = 0; i < 7; i++) {
      box(this.s, `z2_overturned_play_block_${i}`, [0.34 + hash(i) * 0.24, 0.22 + hash(i + 1) * 0.18, 0.32 + hash(i + 2) * 0.22], [2.6 + hash(i * 2.1) * 4.6, 0.12, 1.3 + hash(i * 3.8) * 3.6], mats[i % mats.length]!, [(hash(i + 5) - 0.5) * 0.7, hash(i + 6) * Math.PI, (hash(i + 7) - 0.5) * 0.7]);
    }

    // Physical ceiling plane, beams and stained tile seams replace the former empty grey sky-plane read.
    const ceilingMat = mat(0x4d504a, 0.92) as THREE.MeshStandardMaterial;
    ceilingMat.map = grimeTex; ceilingMat.roughnessMap = grimeTex; ceilingMat.bumpMap = grimeTex; ceilingMat.bumpScale = 0.012;
    box(this.s, 'z2_ceiling_slab', [31, 0.08, 21], [0, 6.03, 0], ceilingMat);
    for (let x = -14; x <= 14; x += 2.8) box(this.s, `z2_ceiling_beam_x_${x.toFixed(1)}`, [0.09, 0.12, 20.7], [x, 5.91, 0], mat(0x242827, 0.82));
    for (let z = -9; z <= 9; z += 3.0) box(this.s, `z2_ceiling_beam_z_${z.toFixed(1)}`, [30.7, 0.10, 0.08], [0, 5.90, z], mat(0x242827, 0.82));
    for (let i = 0; i < 22; i++) {
      const stain = basic(0x15120e, 0.20 + hash(i) * 0.16) as THREE.MeshBasicMaterial; stain.side = THREE.DoubleSide;
      plane(this.s, `z2_ceiling_water_stain_${i}`, 0.7 + hash(i) * 1.8, 0.35 + hash(i + 2) * 1.1, [-14 + hash(i * 3.1) * 28, 5.985, -9 + hash(i * 5.7) * 18], stain, [Math.PI / 2, 0, hash(i * 7) * Math.PI]);
    }
    // skylights: dead diffusers set into the physical ceiling rather than floating grey rectangles.
    for (let i = 0; i < 3; i++) {
      const m = mat(0x77848a, 0.62, 0, 0x8b979e, 0.16) as THREE.MeshStandardMaterial;
      this.skylightMats.push(m);
      box(this.s, `z2_skylight_${i}`, [4.8, 0.05, 2.8], [-6 + i * 6, 5.95, -2], m);
      const sx = -6 + i * 6;
      box(this.s, `z2_skylight_frame_n_${i}`, [5.05, 0.09, 0.10], [sx, 5.94, -3.46], mat(0x252a2a, 0.7));
      box(this.s, `z2_skylight_frame_s_${i}`, [5.05, 0.09, 0.10], [sx, 5.94, -0.54], mat(0x252a2a, 0.7));
      box(this.s, `z2_skylight_frame_w_${i}`, [0.10, 0.09, 3.02], [sx - 2.47, 5.94, -2], mat(0x252a2a, 0.7));
      box(this.s, `z2_skylight_frame_e_${i}`, [0.10, 0.09, 3.02], [sx + 2.47, 5.94, -2], mat(0x252a2a, 0.7));
    }
    for (let i = 0; i < 3; i++) {
      const sl = new THREE.PointLight(0xb8d7e5, 3.4, 12.5, 1.25);
      sl.position.set(-6 + i * 6, 5.25, -2); this.s.add(sl);
      // Warm dusk shafts/pools under the skylights: broad, soft, motivated light that
      // keeps the pit and floor planes legible without returning to uniform ambient.
      const warm = new THREE.PointLight(0xffc37a, 3.1, 11.5, 1.18);
      warm.position.set(-6 + i * 6 + (i - 1) * 0.35, 4.65, -1.75); this.s.add(warm);
      const shaftMat = new THREE.MeshBasicMaterial({ map: lightPoolTex, color: 0xffbd73, transparent: true, opacity: 0.20, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const shaft = plane(this.s, `z2_skylight_volume_pool_${i}`, 4.7, 3.4, [-6 + i * 6, 0.018 + i * 0.0005, -1.7], shaftMat, [-Math.PI / 2, 0, -0.18 + i * 0.16]);
      shaft.renderOrder = 3;
    }
    // Motivated abandoned-play-place practicals: colored spot pools, emergency strips and sagging string lights.
    const practicals: Array<[string, number, number, number, number, number]> = [
      ['amber_climber', -5.8, 4.65, -4.9, 0xff9b42, 6.2],
      ['cyan_ballpit', 4.6, 4.55, 1.7, 0x79c9ff, 5.4],
      ['magenta_shelf', 10.8, 3.6, -7.8, 0xff5d8d, 4.2],
      ['green_exit_side', -11.6, 3.3, 7.4, 0x8aff8c, 8.5],
    ];
    practicals.forEach(([label, x, y, z, color, intensity], i) => {
      box(this.s, `z2_practical_fixture_${label}`, [0.42, 0.11, 0.22], [x, y + 0.08, z], mat(0x1d2020, 0.62), [0, hash(i) * 0.8, 0]);
      box(this.s, `z2_practical_lens_${label}`, [0.31, 0.025, 0.14], [x, y, z], mat(color, 0.24, 0, color, 1.8), [0, hash(i) * 0.8, 0]);
      const pl = new THREE.PointLight(color, intensity, 13.5, 1.22); pl.position.set(x, y - 0.08, z); this.s.add(pl);
    });
    practicals.forEach(([label, x, y, z, color], i) => {
      const floorPool = new THREE.MeshBasicMaterial({ map: lightPoolTex, color, transparent: true, opacity: 0.24, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const fp = plane(this.s, `z2_practical_floor_pool_${label}`, 4.0 + i * 0.35, 3.1 + (i % 2) * 0.8, [x, 0.012 + i * 0.0004, z], floorPool, [-Math.PI / 2, 0, hash(i) * Math.PI]);
      fp.renderOrder = 2;
      const ceilPool = new THREE.MeshBasicMaterial({ map: lightPoolTex, color, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const cp = plane(this.s, `z2_practical_ceiling_pool_${label}`, 4.8, 3.7, [x, 5.972 - i * 0.0004, z], ceilPool, [Math.PI / 2, 0, hash(i + 2) * Math.PI]);
      cp.renderOrder = 2;
    });
    // Ceiling services and low string-light pools give the upward frames readable scale and local variation.
    box(this.s, 'z2_ceiling_duct_main', [24.0, 0.32, 0.48], [0, 5.64, 4.8], mat(0x565d5d, 0.48, 0.28));
    box(this.s, 'z2_ceiling_duct_shadowside', [24.0, 0.055, 0.50], [0, 5.47, 4.82], mat(0x252929, 0.72));
    for (let i = 0; i < 9; i++) cyl(this.s, `z2_ceiling_cable_conduit_${i}`, 0.018, 20.0, [-12 + i * 3.0, 5.73, -0.5], mat(0x1f2424, 0.58, 0.25), [Math.PI / 2, 0, 0], 8);
    for (let i = 0; i < 8; i++) {
      const warm = i % 2 === 0, z = warm ? -6.4 : 5.8;
      const pl = new THREE.PointLight(warm ? 0xff9d55 : 0x78c9ff, 1.45, 5.8, 1.2);
      pl.position.set(-10.5 + i * 3.0, 5.05, z); this.s.add(pl);
    }
    // South-wall emergency lights throw red-orange pools across the route into the tunnel.
    for (let ei = 0; ei < 3; ei++) {
      const ex = -5.5 + ei * 5.2;
      const em = new THREE.PointLight(ei === 1 ? 0xff9b55 : 0xff4a32, 6.2, 11.5, 1.12);
      em.position.set(ex, 2.35, 9.35); this.s.add(em);
    }
    // Low service lights around the crawl tunnel keep the 50-55 s approach readable
    // as a manufactured tunnel throat rather than a void.
    box(this.s, 'z2_tunnel_service_fixture', [0.34, 0.09, 0.16], [-4.35, 1.72, 5.48], mat(0x1d2020, 0.62));
    box(this.s, 'z2_tunnel_service_lens', [0.24, 0.025, 0.10], [-4.35, 1.66, 5.48], mat(0xffb26b, 0.24, 0, 0xff9d45, 1.7));
    const tunnelService = new THREE.PointLight(0xffad62, 2.0, 8.5, 1.15); tunnelService.position.set(-4.55, 1.55, 6.1); this.s.add(tunnelService);
    const tunnelThroat = new THREE.PointLight(0x78c9ff, 1.35, 8.0, 1.05); tunnelThroat.position.set(-5.0, 1.05, 8.4); this.s.add(tunnelThroat);
    for (const [side, z] of [[-1, -10.34], [1, 10.34]] as const) {
      for (let i = 0; i < 5; i++) {
        const x = -10 + i * 5.0;
        box(this.s, `z2_emergency_strip_${side}_${i}`, [1.2, 0.055, 0.025], [x, 2.35 + (i % 2) * 0.35, z], mat(0xff4a32, 0.28, 0, 0xff2b1d, 1.25));
      }
    }
    for (let row = 0; row < 2; row++) {
      const z = row ? 5.8 : -6.4;
      for (let i = 0; i < 22; i++) {
        const x = -12.6 + i * 1.2, sag = Math.sin((i / 21) * Math.PI) * (0.42 + row * 0.15);
        const warm = i % 3 !== 0;
        sph(this.s, `z2_string_bulb_${row}_${i}`, 0.035, [x, 5.12 - sag, z + Math.sin(i * 0.7) * 0.08], mat(warm ? 0xffc26b : 0x85d9ff, 0.25, 0, warm ? 0xff9d3f : 0x63caff, warm ? 1.25 : 1.05), 8);
      }
    }

    // ball pit padded rim and dense instanced ball surface
    box(this.s, 'z2_pit_n', [12.6, 0.8, 0.35], [0, 0.4, -4.2], blue);
    box(this.s, 'z2_pit_s', [12.6, 0.8, 0.35], [0, 0.4, 4.2], red);
    // Front-rim vinyl seams, impact scuffs and worn patches keep the large foreground
    // pad from reading as one featureless slab in the opening wide shot.
    for (let rs = 0; rs < 13; rs++) {
      const x = -5.9 + rs * 0.98 + (hash(rs * 2.1) - 0.5) * 0.08;
      plane(this.s, `z2_pit_front_vinyl_seam_${rs}`, 0.025, 0.70, [x, 0.40, 4.386], basic(0x2a1512, 0.50), [0, 0, (hash(rs) - 0.5) * 0.025]);
      if (rs % 2 === 0) plane(this.s, `z2_pit_front_scuff_${rs}`, 0.34 + hash(rs) * 0.52, 0.055 + hash(rs + 1) * 0.09, [x + 0.32, 0.27 + hash(rs + 2) * 0.34, 4.389], basic(0x1d1210, 0.30 + hash(rs + 3) * 0.25), [0, 0, (hash(rs + 4) - 0.5) * 0.35]);
    }
    box(this.s, 'z2_pit_w', [0.35, 0.8, 8.4], [-6.2, 0.4, 0], yellow);
    box(this.s, 'z2_pit_e', [0.35, 0.8, 8.4], [6.2, 0.4, 0], green);
    box(this.s, 'z2_ballpit_dark_substrate', [12.0, 0.035, 8.0], [0, 0.515, 0], mat(0x2d241e, 0.92));
    for (let fg = 0; fg < 18; fg++) {
      plane(this.s, `z2_floor_ground_in_grime_${fg}`, 1.0 + hash(fg) * 2.4, 0.7 + hash(fg + 3) * 1.8, [-13 + hash(fg * 2.1) * 26, 0.006, -8.5 + hash(fg * 4.7) * 17], basic(0x241b14, 0.22 + hash(fg + 5) * 0.15), [-Math.PI / 2, 0, hash(fg + 7) * Math.PI]);
    }
    // Foreground safety-mat seams and scuff lanes break the otherwise continuous
    // pale floor plane in the entry frames without changing the camera path.
    const seamMat = basic(0x241d17, 0.46);
    for (let zi = 0; zi < 6; zi++) plane(this.s, `z2_floor_mat_cross_seam_${zi}`, 29.0, 0.035 + (zi % 2) * 0.018, [0, 0.014 + zi * 0.0002, 3.9 + zi * 1.12], seamMat, [-Math.PI / 2, 0, (hash(zi) - 0.5) * 0.035]);
    for (let xi = 0; xi < 5; xi++) plane(this.s, `z2_floor_mat_long_seam_${xi}`, 0.035, 7.2, [-8.8 + xi * 4.4 + (hash(xi * 3) - 0.5) * 0.5, 0.015 + xi * 0.0002, 6.6], seamMat, [-Math.PI / 2, 0, (hash(xi * 5) - 0.5) * 0.06]);
    for (let sc = 0; sc < 20; sc++) plane(this.s, `z2_floor_entry_scuff_${sc}`, 0.28 + hash(sc) * 0.9, 0.035 + hash(sc + 1) * 0.08, [-10 + hash(sc * 2.3) * 20, 0.017 + sc * 0.0001, 4.2 + hash(sc * 4.1) * 5.3], basic(0x16110d, 0.28 + hash(sc + 2) * 0.22), [-Math.PI / 2, 0, hash(sc * 7) * Math.PI]);
    const geom = new THREE.SphereGeometry(0.075, 12, 8);
    const inst = new THREE.InstancedMesh(geom, new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0, map: grimeTex, roughnessMap: grimeTex }), 4900);
    inst.castShadow = false; inst.receiveShadow = true;
    let bi = 0;
    for (let ix = 0; ix < 86 && bi < 4900; ix++) for (let iz = 0; iz < 57 && bi < 4900; iz++) {
      const x = -5.95 + ix * 0.14 + (hash(ix * 91 + iz * 17) - 0.5) * 0.068;
      const z = -3.95 + iz * 0.14 + (hash(ix * 19 + iz * 71) - 0.5) * 0.068;
      const dome = 0.03 * (1 - (x / 6) ** 2) + 0.025 * (1 - (z / 4) ** 2);
      const y = 0.55 + dome + (hash(ix * 7 + iz * 13) - 0.5) * 0.045;
      const c = bi % mats.length;
      this.ballBase.push({ x, z, y, c });
      const ballColor = new THREE.Color((mats[c]!.color as THREE.Color).getHex());
      ballColor.multiplyScalar(0.66 + hash(bi * 1.37) * 0.38).lerp(new THREE.Color(0x8b8272), hash(bi * 2.71) * 0.30);
      inst.setColorAt(bi, ballColor);
      bi++;
    }
    inst.count = bi;
    this.balls = inst; this.s.add(inst);

    // climbing frame, net, slides, tunnel
    for (const x of [-6.8, -4.6]) for (const z of [-5.8, -3.6]) cyl(this.s, `z2_frame_post_${x}_${z}`, 0.06, 3.2, [x, 1.6, z], blue);
    box(this.s, 'z2_frame_deck_low', [2.8, 0.18, 2.5], [-5.7, 1.25, -4.7], yellow);
    box(this.s, 'z2_frame_deck_high', [2.4, 0.18, 2.1], [-5.8, 2.55, -4.8], red);
    for (let i = 0; i < 8; i++) {
      if (i === 2 || i === 3) {
        cyl(this.s, `z2_net_v_broken_stub_${i}`, 0.012, 0.42, [-4.4 + i * 0.28, 2.42 - i * 0.08, -3.55], plasticDark, [0.18 * (i - 2), 0, 0.12], 8);
      } else {
        cyl(this.s, `z2_net_v_${i}`, 0.012, 1.3, [-4.4 + i * 0.28, 1.95, -3.55], plasticDark, [0, 0, 0], 8);
      }
      if (i === 3 || i === 4) {
        cyl(this.s, `z2_net_h_sagging_${i}`, 0.012, 1.15, [-3.82, 1.45 + i * 0.16 - 0.16, -3.49], plasticDark, [0.34, 0, Math.PI / 2 + 0.22], 8);
      } else {
        cyl(this.s, `z2_net_h_${i}`, 0.012, 2.0, [-3.4, 1.45 + i * 0.16, -3.55], plasticDark, [0, 0, Math.PI / 2], 8);
      }
    }
    for (let d = 0; d < 5; d++) {
      cyl(this.s, `z2_net_dangling_thread_${d}`, 0.008, 0.45 + hash(d) * 0.35, [-4.15 + d * 0.18, 1.42 - hash(d + 2) * 0.18, -3.47], plasticDark, [0.25 + hash(d) * 0.4, 0, (hash(d + 4) - 0.5) * 0.5], 7);
    }
    // spiral slide as stacked torus arcs/ribbon-like tube segments
    for (let i = 0; i < 16; i++) {
      const a = i * 0.34, r = 1.0, y = 2.5 - i * 0.12;
      const seg = cyl(this.s, `z2_spiral_slide_${i}`, 0.16, 0.75, [-7.6 + Math.cos(a) * r, y, -4.8 + Math.sin(a) * r], yellow, [Math.PI / 2, 0, -a], 16);
      seg.scale.x = 0.55;
    }
    for (let i = 0; i < 7; i++) box(this.s, `z2_step_block_${i}`, [0.7, 0.25, 0.7], [3.1 + (i % 2) * 0.8, 0.13 + i * 0.11, 3.8 - i * 0.55], mats[i % mats.length]!);
    // tube tunnel ribs along z
    const shellMat = mat(0x18364a, 0.58); shellMat.side = THREE.BackSide;
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 6.4, 32, 1, true), shellMat);
    shell.position.set(-5, 0.82, 8.35); shell.rotation.x = Math.PI / 2; shell.name = 'z2_tunnel_shell'; shell.userData.fx_entity = shell.name; this.s.add(shell);
    // thick padded tunnel mouth, panel fasteners and grime; the opening is a manufactured tube, not a color portal
    const mouthPad = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.105, 12, 36), mat(0xc73932, 0.58));
    mouthPad.position.set(-5, 0.82, 5.55); mouthPad.name = 'z2_tunnel_mouth_padding'; mouthPad.userData.fx_entity = mouthPad.name; mouthPad.castShadow = mouthPad.receiveShadow = true; this.s.add(mouthPad);
    for (let bi = 0; bi < 12; bi++) {
      const a = bi * Math.PI * 2 / 12;
      sph(this.s, `z2_tunnel_mouth_bolt_${bi}`, 0.018, [-5 + Math.cos(a) * 0.52, 0.82 + Math.sin(a) * 0.52, 5.48], mat(0x302d2a, 0.35, 0.5), 8);
    }
    for (let gi = 0; gi < 9; gi++) plane(this.s, `z2_tunnel_grime_streak_${gi}`, 0.07 + hash(gi) * 0.08, 0.35 + hash(gi + 2) * 0.45, [-5 + (hash(gi) - 0.5) * 0.55, 0.86 + (hash(gi + 1) - 0.5) * 0.45, 5.47], basic(0x20150f, 0.28), [0, 0, (hash(gi + 3) - 0.5) * 0.3]);
    for (let i = 0; i < 16; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.405, 0.055, 10, 32), i % 3 ? yellow : red);
      rib.position.set(-5, 0.82, 5.6 + i * 0.38); rib.castShadow = rib.receiveShadow = true;
      rib.name = `z2_tunnel_rib_${i}`; rib.userData.fx_entity = rib.name; this.s.add(rib); this.tunnelRibs.push(rib);
      const groutRing = new THREE.Mesh(new THREE.TorusGeometry(0.398, 0.012, 6, 32), mat(0x071d3a, 0.78));
      groutRing.position.set(-5, 0.82, 5.6 + i * 0.38 + 0.11); groutRing.name = `z2_tunnel_grout_ring_${i}`; groutRing.userData.fx_entity = groutRing.name; this.s.add(groutRing);
    }
    // longitudinal seams inside the tube make the crawl readable as ribbed plastic before they become pool grout.
    for (let j = 0; j < 8; j++) {
      const a = j * Math.PI / 4;
      const seam = box(this.s, `z2_tunnel_longitudinal_seam_${j}`, [0.018, 0.018, 6.0], [-5 + Math.cos(a) * 0.39, 0.82 + Math.sin(a) * 0.39, 8.35], mat(0x071d3a, 0.78));
      seam.rotation.z = a;
    }

    // shelves with toys facing the viewer; simple grey-box toy archetypes but real placement
    for (let s = 0; s < 3; s++) box(this.s, `z2_shelf_${s}`, [0.35, 0.08, 6.5], [8.2, 0.9 + s * 0.65, -1], mat(0xffffff, 0.4));
    const toyCols = [red, yellow, blue, green];
    const seamDark = mat(0x221915, 0.82);
    const eyeBlack = basic(0x090606);
    const ringGeom = (major: number, minor: number) => new THREE.TorusGeometry(major, minor, 8, 24);
    for (let i = 0; i < 20; i++) {
      const g = new THREE.Group(); g.position.set(8.0, 1.05 + (i % 3) * 0.62, -3.8 + Math.floor(i / 3) * 0.72);
      const kind = i % 4;
      const main = toyCols[i % toyCols.length]!;
      const alt = toyCols[(i + 2) % toyCols.length]!;
      if (kind === 0) {
        // tin robot: boxy manufactured torso/head, limbs, antenna, wind-up key and face plate
        box(g, `z2_toy_robot_torso_${i}`, [0.18, 0.20, 0.11], [0, 0.02, 0], main);
        box(g, `z2_toy_robot_head_${i}`, [0.15, 0.12, 0.12], [0, 0.205, 0.005], alt);
        box(g, `z2_toy_robot_faceplate_${i}`, [0.105, 0.052, 0.008], [0, 0.205, -0.061], mat(0xd8d0b8, 0.5));
        sph(g, `z2_toy_robot_eye_l_${i}`, 0.012, [-0.028, 0.213, -0.067], eyeBlack, 8);
        sph(g, `z2_toy_robot_eye_r_${i}`, 0.012, [0.028, 0.213, -0.067], eyeBlack, 8);
        for (const side of [-1, 1]) {
          cyl(g, `z2_toy_robot_arm_${i}_${side}`, 0.018, 0.15, [side * 0.115, 0.045, 0], alt, [0, 0, side * 0.28], 8);
          box(g, `z2_toy_robot_foot_${i}_${side}`, [0.065, 0.032, 0.09], [side * 0.052, -0.105, -0.005], seamDark);
        }
        cyl(g, `z2_toy_robot_antenna_${i}`, 0.006, 0.09, [0, 0.305, 0], seamDark, [0, 0, 0], 6);
        sph(g, `z2_toy_robot_antenna_tip_${i}`, 0.014, [0, 0.352, 0], red, 8);
        const key = new THREE.Mesh(ringGeom(0.032, 0.006), seamDark); key.position.set(0.105, 0.04, 0.0); key.rotation.y = Math.PI / 2; key.name = `z2_toy_robot_windup_key_${i}`; key.userData.fx_entity = key.name; g.add(key);
      } else if (kind === 1) {
        // rubber duck: single squeezed body mold, tilted head, beak, tail and seam line
        const body = sph(g, `z2_toy_duck_body_${i}`, 0.12, [0, -0.005, 0], yellow, 16); body.scale.set(1.22, 0.78, 0.88);
        const head = sph(g, `z2_toy_duck_head_${i}`, 0.072, [0.035, 0.115, -0.055], yellow, 14); head.scale.set(0.94, 1.06, 0.92);
        box(g, `z2_toy_duck_beak_${i}`, [0.075, 0.026, 0.052], [0.035, 0.105, -0.125], mat(0xe87524, 0.46), [0.08, 0, 0]);
        box(g, `z2_toy_duck_tail_${i}`, [0.052, 0.055, 0.035], [-0.105, 0.025, 0.045], yellow, [0, 0, -0.35]);
        sph(g, `z2_toy_duck_eye_l_${i}`, 0.009, [0.006, 0.135, -0.116], eyeBlack, 8);
        sph(g, `z2_toy_duck_eye_r_${i}`, 0.009, [0.061, 0.135, -0.112], eyeBlack, 8);
        const seam = new THREE.Mesh(ringGeom(0.105, 0.004), seamDark); seam.position.set(0, -0.005, 0); seam.rotation.x = Math.PI / 2; seam.scale.y = 0.72; seam.name = `z2_toy_duck_mold_seam_${i}`; seam.userData.fx_entity = seam.name; g.add(seam);
      } else if (kind === 2) {
        // pull-along animal: molded torso, four legs, wheels, ears, muzzle and pull cord
        const torso = sph(g, `z2_toy_pullanimal_torso_${i}`, 0.105, [0, 0.015, 0], main, 14); torso.scale.set(1.35, 0.72, 0.72);
        box(g, `z2_toy_pullanimal_head_${i}`, [0.105, 0.09, 0.095], [0.13, 0.09, -0.005], alt, [0, 0, -0.08]);
        box(g, `z2_toy_pullanimal_muzzle_${i}`, [0.065, 0.045, 0.065], [0.19, 0.072, -0.01], mat(0xd8c9a6, 0.62));
        for (const side of [-1, 1]) {
          box(g, `z2_toy_pullanimal_ear_${i}_${side}`, [0.025, 0.065, 0.018], [0.105, 0.155, side * 0.04], main, [side * 0.22, 0, 0.12]);
          cyl(g, `z2_toy_pullanimal_leg_f_${i}_${side}`, 0.014, 0.105, [0.06, -0.08, side * 0.055], alt, [0, 0, 0], 8);
          cyl(g, `z2_toy_pullanimal_leg_b_${i}_${side}`, 0.014, 0.105, [-0.075, -0.08, side * 0.055], alt, [0, 0, 0], 8);
          const wheel = new THREE.Mesh(ringGeom(0.032, 0.009), seamDark); wheel.position.set(-0.01, -0.138, side * 0.067); wheel.rotation.x = Math.PI / 2; wheel.name = `z2_toy_pullanimal_wheel_${i}_${side}`; wheel.userData.fx_entity = wheel.name; g.add(wheel);
        }
        cyl(g, `z2_toy_pullanimal_cord_${i}`, 0.004, 0.22, [0.245, -0.015, 0], seamDark, [0, 0, Math.PI / 2.7], 6);
      } else {
        // ring stacker: intentional toy archetype with varied rings on a tapered post, not a figure
        box(g, `z2_toy_stacker_base_${i}`, [0.18, 0.035, 0.18], [0, -0.105, 0], alt);
        cyl(g, `z2_toy_stacker_post_${i}`, 0.018, 0.28, [0, 0.035, 0], seamDark, [0, 0, 0], 10);
        for (let r = 0; r < 3; r++) {
          const ring = new THREE.Mesh(ringGeom(0.065 - r * 0.012, 0.018), toyCols[(i + r) % toyCols.length]!);
          ring.position.set((r - 1) * 0.006, -0.065 + r * 0.061, 0); ring.rotation.x = Math.PI / 2; ring.rotation.z = (hash(i + r) - 0.5) * 0.16;
          ring.name = `z2_toy_stacker_ring_${i}_${r}`; ring.userData.fx_entity = ring.name; g.add(ring);
        }
        sph(g, `z2_toy_stacker_cap_${i}`, 0.036, [0, 0.19, 0], red, 12);
      }
      // molded-plastic parting lines and a few missing/scuffed patches read even when the toy silhouette is small.
      box(g, `z2_toy_mold_parting_line_${i}`, [0.006, 0.12, 0.006], [-0.075, 0.015, -0.055], seamDark, [0, 0, 0.12]);
      if (i % 3 === 0) box(g, `z2_toy_scuff_patch_${i}`, [0.045, 0.012, 0.006], [0.035, 0.02, -0.065], mat(0xddd2bd, 0.88), [0, 0, hash(i) * 0.5]);
      const scale = 0.82 + hash(i * 3.1) * 0.22;
      g.scale.setScalar(scale);
      g.rotation.z = (hash(i * 5.2) - 0.5) * 0.10;
      g.userData.fx_entity = `z2_toy_${i}`; g.name = `z2_toy_${i}`; this.s.add(g); this.toys.push(g);
    }
    // additional named playroom props
    for (let i = 0; i < 9; i++) box(this.s, `z2_block_${i}`, [0.28, 0.28, 0.28], [4.6 + hash(i) * 1.1, 0.14, -2.6 + hash(i + 2) * 1.1], mats[i % mats.length]!, [0, hash(i) * 1.5, 0]);
    box(this.s, 'z2_toy_piano', [0.75, 0.35, 0.32], [5.3, 0.18, -4.8], red);
    box(this.s, 'z2_jack_in_box', [0.38, 0.38, 0.38], [-3.8, 0.19, 3.6], blue);
    cyl(this.s, 'z2_xylophone', 0.08, 0.65, [2.2, 0.1, -4.7], yellow, [0, 0, Math.PI / 2], 12);
    box(this.s, 'z2_ball_cart', [0.8, 0.5, 0.55], [6.8, 0.25, 2.8], green);
    box(this.s, 'z2_birthday_banner', [4.8, 0.42, 0.025], [0, 4.1, -10.35], red);
    cyl(this.s, 'z2_music_box', 0.24, 0.18, [-7.8, 0.09, 1.8], mat(0xb66d34, 0.45), [0, 0, 0], 24);
    sph(this.s, 'z2_ballerina', 0.07, [-7.8, 0.32, 1.8], mat(0xffe5d0, 0.5), 12);
    for (let i = 0; i < 7; i++) {
      const b = sph(this.s, `z2_balloon_${i}`, 0.18, [-7 + i * 1.8, 3.8 + hash(i) * 0.8, -6.5 + hash(i + 3) * 2], mats[i % mats.length]!, 16);
      cyl(this.s, `z2_balloon_string_${i}`, 0.006, 1.4, [b.position.x, b.position.y - 0.8, b.position.z], mat(0xdddddd, 0.8), [0, 0, 0], 6);
    }
    // toy phone with eyes on foam step
    this.toyPhone = new THREE.Group(); this.toyPhone.position.set(3.2, 0.68, 2.4);
    box(this.toyPhone, 'z2_toy_phone_base', [0.38, 0.2, 0.28], [0, 0, 0], red);
    box(this.toyPhone, 'z2_toy_phone_receiver', [0.42, 0.09, 0.1], [0, 0.16, 0], mat(0xd9caaa, 0.4));
    sph(this.toyPhone, 'z2_toy_phone_eye_l', 0.035, [-0.08, 0.08, 0.15], basic(0xffffff), 10);
    sph(this.toyPhone, 'z2_toy_phone_eye_r', 0.035, [0.08, 0.08, 0.15], basic(0xffffff), 10);
    this.toyPhone.name = 'z2_toy_phone'; this.toyPhone.userData.fx_entity = 'z2_toy_phone'; this.s.add(this.toyPhone);

    // swimmer placeholder: fused ball head, yellow split-slide mouth, eyes, dorsal balls
    this.swimmer.position.set(0, 0.62, 2.4); this.swimmer.visible = false; this.s.add(this.swimmer);
    for (let i = 0; i < 44; i++) {
      const a = hash(i) * Math.PI * 2, r = 0.22 + hash(i + 1) * 0.38, y = (hash(i + 2) - 0.45) * 0.34;
      sph(this.swimmer, `z2_swimmer_skull_ball_${i}`, 0.11 + hash(i + 4) * 0.035, [Math.cos(a) * r, y, Math.sin(a) * r * 0.62], swimmerPale[i % swimmerPale.length]!, 10);
    }
    this.mouthUpper = box(this.swimmer, 'z2_slide_mouth_upper', [0.62, 0.16, 0.58], [0, 0.05, 0.42], mouthMat, [-0.2, 0, 0]);
    this.mouthLower = box(this.swimmer, 'z2_slide_mouth_lower', [0.62, 0.14, 0.58], [0, -0.13, 0.42], mouthMat, [0.2, 0, 0]);
    this.eyeL = sph(this.swimmer, 'z2_swimmer_eye_l', 0.095, [-0.24, 0.24, 0.3], basic(0xffffff), 16);
    this.eyeR = sph(this.swimmer, 'z2_swimmer_eye_r', 0.095, [0.24, 0.24, 0.3], basic(0xffffff), 16);
    sph(this.eyeL, 'z2_swimmer_pupil_l', 0.035, [0, 0, 0.085], basic(0x111111), 10);
    sph(this.eyeR, 'z2_swimmer_pupil_r', 0.035, [0, 0, 0.085], basic(0x111111), 10);
    for (let i = 0; i < 10; i++) {
      const r = sph(this.s, `z2_swimmer_ridge_${i}`, 0.165, [0, 0.55, -1 - i * 0.35], submergedRidgeMat, 12);
      r.scale.set(1.35, 0.72, 1.65);
      this.ridge.push(r);
    }

    // Modular Blender playroom kit: repeated padded panels, shelf/net/frame modules, straight slide, stepping blocks and tunnel ribs.
    this.s.traverse((o) => {
      if (/^z2_(tunnel_rib_|tunnel_grout_ring_|toy_piano|jack_in_box|xylophone|ball_cart|music_box|ballerina|block_|birthday_banner|balloon_)/.test(o.name)) o.visible = false;
    });
    this.toyPhone.visible = false;
    const padColors = [0xd96a55, 0xe7c85f, 0x78a8d8, 0x82bd7f, 0xe7dfca];
    const panelMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
    const distressPanel = (panel: THREE.Object3D | null | undefined, seed: number) => {
      if (!panel) return;
      // Sparse actual losses/misalignment break the toy-catalogue grid at delivery distance.
      if (hash(seed * 1.913) < 0.17) { panel.visible = false; return; }
      panel.position.x += (hash(seed + 1.1) - 0.5) * 0.19;
      panel.position.y += (hash(seed + 2.3) - 0.5) * 0.15;
      panel.position.z += (hash(seed + 3.7) - 0.5) * 0.09;
      panel.rotation.z += (hash(seed + 4.9) - 0.5) * 0.16;
      panel.scale.x *= 0.90 + hash(seed + 8.2) * 0.16; panel.scale.y *= 0.91 + hash(seed + 9.4) * 0.15;
    };
    const distressPadMaterial = (mm: THREE.MeshStandardMaterial, seed: number) => {
      mm.map = grimeTex; mm.roughnessMap = grimeTex; mm.bumpMap = grimeTex; mm.bumpScale = 0.012;
      const fade = 0.18 + hash(seed * 2.17) * 0.38;
      mm.color.lerp(new THREE.Color(0x8f8877), fade);
      mm.color.multiplyScalar(0.62 + hash(seed * 3.11) * 0.25);
      mm.roughness = Math.max(mm.roughness, 0.66); mm.needsUpdate = true;
    };
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) for (let i = 0; i < 24; i++) {
      const panel = this.cloneProp(this.playroomKit, 'padded_wall_panel_root', [-14.0 + i * 1.22 + (row % 2) * 0.61, row * 1.1, side * 10.31], side < 0 ? 0 : Math.PI, 1, `z2_wall_panel_asset_${side}_${row}_${i}`);
      const seed = 11 + row * 31 + i * 7 + (side > 0 ? 101 : 0);
      distressPanel(panel, seed);
      const tint = row === 3 && i % 3 === 0 ? 0xe7dfca : padColors[(i + row * 2 + (side > 0 ? 2 : 0)) % padColors.length]!;
      panel?.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const key = `${src.name}_${src.name === 'foam_vinyl_ivory' ? tint : 0}_${Math.floor(hash(seed) * 5)}`;
        let mm = panelMaterialCache.get(key);
        if (!mm) {
          mm = src.clone();
          if (mm.name === 'foam_vinyl_ivory') { mm.color.setHex(tint); distressPadMaterial(mm, seed); }
          panelMaterialCache.set(key, mm);
        }
        mesh.material = mm;
      });
    }
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) for (let i = 0; i < 17; i++) {
      const panel = this.cloneProp(this.playroomKit, 'padded_wall_panel_root', [side * 15.31, row * 1.1, -9.2 + i * 1.15 + (row % 2) * 0.55], side < 0 ? Math.PI / 2 : -Math.PI / 2, 1, `z2_side_panel_asset_${side}_${row}_${i}`);
      const seed = 211 + row * 29 + i * 5 + (side > 0 ? 77 : 0);
      distressPanel(panel, seed);
      const tint = padColors[(i + row + (side > 0 ? 3 : 0)) % padColors.length]!;
      panel?.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const key = `${src.name}_${src.name === 'foam_vinyl_ivory' ? tint : 0}_${Math.floor(hash(seed) * 5)}`;
        let mm = panelMaterialCache.get(key);
        if (!mm) {
          mm = src.clone();
          if (mm.name === 'foam_vinyl_ivory') { mm.color.setHex(tint); distressPadMaterial(mm, seed); }
          panelMaterialCache.set(key, mm);
        }
        mesh.material = mm;
      });
    }
    this.cloneProp(this.playroomKit, 'climbing_frame_module_root', [-5.7, 0, -4.7], 0, 1, 'z2_climbing_frame_asset');
    this.cloneProp(this.playroomKit, 'net_panel_root', [-4.2, 1.15, -3.52], 0, 1, 'z2_net_panel_asset');
    this.cloneProp(this.playroomKit, 'straight_slide_root', [-8.1, 0.02, -2.8], 0.55, 1, 'z2_straight_slide_asset');
    this.cloneProp(this.playroomKit, 'shelf_module_root', [8.05, 0.42, -1.0], Math.PI / 2, 1, 'z2_shelf_asset');
    for (let i = 0; i < 5; i++) this.cloneProp(this.playroomKit, 'stepping_block_root', [3.1 + (i % 2) * 0.8, i * 0.11, 3.8 - i * 0.55], hash(i) * 0.4, 1, `z2_step_asset_${i}`);
    for (let i = 0; i < 16; i++) {
      const rib = this.cloneProp(this.playroomKit, 'tunnel_rib_root', [-5, 0.82, 5.6 + i * 0.38], 0, 1, `z2_tunnel_rib_asset_${i}`);
      if (rib) {
        rib.rotation.x = Math.PI / 2;
        rib.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.material = (mesh.material as THREE.Material).clone();
          this.tunnelRibs.push(mesh);
        });
      }
    }

    // Named toy archetypes replace the simple primitive stand-ins while retaining their story placement.
    this.cloneProp(this.toyPack, 'toy_piano_root', [5.3, 0, -4.8], -0.2, 1, 'z2_toy_piano_asset');
    this.cloneProp(this.toyPack, 'jack_in_box_root', [-3.8, 0, 3.6], 0.4, 1, 'z2_jack_box_asset');
    this.cloneProp(this.toyPack, 'xylophone_root', [2.2, 0, -4.7], 0.35, 1, 'z2_xylophone_asset');
    this.cloneProp(this.toyPack, 'toy_phone_root', [3.2, 0.66, 2.4], -0.3, 1, 'z2_toy_phone_asset');
    this.cloneProp(this.toyPack, 'rocking_horse_root', [6.4, 0, -2.4], -0.65, 1, 'z2_rocking_horse_asset');
    this.cloneProp(this.toyPack, 'tin_robot_root', [7.75, 1.12, -2.8], -Math.PI / 2, 0.8, 'z2_robot_asset');
    this.cloneProp(this.toyPack, 'stitched_teddy_root', [7.75, 1.72, -0.7], -Math.PI / 2, 0.85, 'z2_teddy_asset');
    this.cloneProp(this.toyPack, 'stacking_rings_root', [4.7, 0, -2.7], 0, 1, 'z2_stacking_rings_asset');
    this.cloneProp(this.toyPack, 'toy_car_root', [5.15, 0, -2.1], 0.55, 1, 'z2_toy_car_asset');
    this.cloneProp(this.toyPack, 'music_box_root', [-7.8, 0, 1.8], 0.25, 1, 'z2_music_box_asset');
    this.cloneProp(this.toyPack, 'ball_cart_root', [6.8, 0, 2.8], -0.15, 1, 'z2_ball_cart_asset');
    this.cloneProp(this.toyPack, 'shoe_cubby_root', [-8.0, 0, -0.5], Math.PI / 2, 1, 'z2_shoe_cubby_asset');
    this.cloneProp(this.toyPack, 'birthday_banner_root', [0, 4.12, -10.24], 0, 1, 'z2_birthday_banner_asset');
    for (let i = 0; i < 4; i++) this.cloneProp(this.toyPack, 'alphabet_block_root', [1.1 + i * 0.38, 0, 4.1 - (i % 2) * 0.34], hash(i) * 1.2, 1, `z2_alphabet_block_asset_${i}`);
    for (let i = 0; i < 3; i++) this.cloneProp(this.toyPack, 'balloon_cluster_root', [-6.8 + i * 2.8, 3.2 + hash(i) * 0.5, -6.3 + hash(i + 2) * 1.8], hash(i) * 0.5, 1, `z2_balloon_cluster_asset_${i}`);

    // tall Tenant glimpse silhouette at tunnel end
    this.tenant = box(this.s, 'z2_tenant_glimpse', [0.65, 2.7, 0.35], [-5, 1.35, 10.45], basic(0x070707, 1));
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
    const t = f.t;
    applyFpCamera(this.cam, KEYS, t, out.width / out.height);
    const closeBeam = 1 - 0.68 * smooth(44.0, 45.0, t) * (1 - smooth(49.0, 50.0, t));
    updateFlashlight(this.flash.light, this.flash.target, this.cam, t, closeBeam * (0.24 + smooth(48.8, 50.0, t) * 0.9), t > 40.5 && t < 49.5 ? 0.3 : 0.05);
    // clouded skylight dimming after 40s
    const dim = 1 - smooth(39.5, 41.5, t) * 0.5;
    this.sun.intensity = 1.15 * dim;
    this.skylightMats.forEach((m) => { m.emissiveIntensity = 0.16 * dim; });

    // toys face the viewer, stepped at 6fps
    const qcamX = Math.round(this.cam.position.x * 8) / 8, qcamZ = Math.round(this.cam.position.z * 8) / 8;
    const stepT = Math.floor(t * 6) / 6;
    this.toys.forEach((g, i) => {
      const dx = qcamX - g.position.x, dz = qcamZ - g.position.z;
      g.rotation.y = Math.atan2(dx, dz) + (hash(Math.floor(stepT * 6) + i) - 0.5) * 0.04;
    });

    // swimmer path: approaches before freeze, obeys movement rule, dives toward phone
    let sx = 0, sz = -1.2;
    if (t < 40.5) sz = -1.2 + smooth(38, 40.5, t) * 3.3;
    else if (t < 47.5) sz = 2.1;
    else {
      const u = smooth(47.6, 49.3, t); sx = u * 2.7; sz = 2.1 + u * 0.2;
    }
    // final GLB head follows the same deterministic path; primitive proxy remains only as fallback reference.
    const swimmerVisible = t > 44.4 && t < 49.2;
    const sy = 0.58 + smooth(44.5, 45.4, t) * 0.42 - smooth(48.6, 49.2, t) * 0.7;
    this.swimmerAsset.root.visible = swimmerVisible;
    this.swimmerAsset.root.scale.setScalar(1.22);
    this.swimmerAsset.root.position.set(sx, sy, sz + 0.2);
    this.swimmerAsset.root.rotation.y = smooth(47.6, 48.4, t) * 0.7;

    // Closed-form breaststroke/pulling motion. The emergence root path and timing stay fixed;
    // only the continuous limb rig articulates around its Blender bind pivots.
    const swimPower = smooth(44.55, 45.15, t) * (1 - smooth(48.85, 49.18, t));
    // Integrate the stroke-speed ramp in closed form. Multiplying elapsed time by a
    // changing speed injects a spurious acceleration during the chase ramp.
    const strokeRampA = 47.55, strokeRampB = 48.35;
    const strokeU = clamp((t - strokeRampA) / (strokeRampB - strokeRampA));
    const strokeRampIntegral = t <= strokeRampA ? 0 : t >= strokeRampB
      ? 0.5 * (strokeRampB - strokeRampA)
      : (strokeRampB - strokeRampA) * (strokeU ** 3 - 0.5 * strokeU ** 4);
    const strokePhaseBase = 2.65 * t + 1.55 * strokeRampIntegral;
    const handWakeSources: { hand: THREE.Object3D; phase: number }[] = [];
    for (const sideNum of [-1, 1] as const) {
      const key = sideNum < 0 ? '-1' : '1';
      const shoulder = this.swimmerAsset.part(`arm_${key}_shoulder`);
      const elbow = this.swimmerAsset.part(`arm_${key}_elbow`);
      const wrist = this.swimmerAsset.part(`arm_${key}_wrist`);
      const phase = strokePhaseBase + (sideNum < 0 ? 0 : 1.38);
      const pull = Math.sin(phase);
      const lift = Math.cos(phase);
      for (const control of [shoulder, elbow, wrist]) {
        if (!control.userData.baseRot) control.userData.baseRot = control.rotation.clone();
      }
      const shBase = shoulder.userData.baseRot as THREE.Euler;
      const elBase = elbow.userData.baseRot as THREE.Euler;
      const wrBase = wrist.userData.baseRot as THREE.Euler;
      shoulder.rotation.set(
        shBase.x + (0.10 * lift + 0.06 * pull) * swimPower,
        shBase.y + sideNum * (0.30 * pull + 0.08) * swimPower,
        shBase.z + sideNum * (0.20 * lift - 0.10 * pull) * swimPower,
      );
      elbow.rotation.set(
        elBase.x + 0.08 * pull * swimPower,
        elBase.y + sideNum * 0.15 * Math.sin(phase + 0.7) * swimPower,
        elBase.z + sideNum * (0.24 + 0.25 * Math.sin(phase + 0.9)) * swimPower,
      );
      wrist.rotation.set(
        wrBase.x + 0.22 * Math.sin(phase + 1.15) * swimPower,
        wrBase.y + sideNum * 0.16 * Math.cos(phase + 0.4) * swimPower,
        wrBase.z + sideNum * 0.10 * Math.sin(phase + 0.2) * swimPower,
      );
      for (let fi = 1; fi <= 5; fi++) {
        const finger = this.swimmerAsset.part(`finger_${key}_${fi}_continuous`);
        if (!finger.userData.baseRot) finger.userData.baseRot = finger.rotation.clone();
        const fb = finger.userData.baseRot as THREE.Euler;
        const grasp = Math.sin(phase + 1.45 + fi * 0.18);
        finger.rotation.set(
          fb.x + (0.12 + fi * 0.012) * grasp * swimPower,
          fb.y + sideNum * 0.035 * Math.sin(phase + fi) * swimPower,
          fb.z + sideNum * 0.028 * grasp * swimPower,
        );
      }
      handWakeSources.push({ hand: this.swimmerAsset.part(`hand_${key}`), phase });
    }
    const lowerBody = this.swimmerAsset.part('submerged_lower_body');
    if (!lowerBody.userData.baseRot) lowerBody.userData.baseRot = lowerBody.rotation.clone();
    const lb = lowerBody.userData.baseRot as THREE.Euler;
    lowerBody.rotation.set(lb.x + Math.sin(t * 2.2) * 0.035 * swimPower, lb.y + Math.sin(t * 2.8 + 0.7) * 0.055 * swimPower, lb.z);

    // Ball interaction derives from the actual articulated hand transforms, including
    // the chase turn, rather than estimated unrotated offsets.
    this.swimmerAsset.root.updateMatrixWorld(true);
    const evaluatedHandWakes = handWakeSources.map(({ hand, phase }) => {
      const p = new THREE.Vector3();
      hand.getWorldPosition(p);
      return { x: p.x, z: p.z, phase };
    });

    this.swimmerLight.visible = swimmerVisible;
    this.swimmerLight.intensity = swimmerVisible ? 0.24 : 0;
    this.swimmerLight.position.set(sx + 0.85, sy + 0.38, sz + 0.55);
    const scan = smooth(44.8, 45.6, t) * (1 - smooth(48.7, 49.2, t));
    for (const side of ['l', 'r'] as const) {
      const pupil = this.swimmerAsset.part(`eye_pupil_${side}`);
      if (pupil) {
        if (!pupil.userData.basePos) pupil.userData.basePos = pupil.position.clone();
        const bp = pupil.userData.basePos as THREE.Vector3;
        pupil.position.x = bp.x + Math.sin(t * 0.82 + (side === 'l' ? 0 : 0.9)) * 0.014 * scan;
        pupil.position.y = bp.y + Math.cos(t * 0.67 + (side === 'l' ? 0.4 : 1.1)) * 0.009 * scan;
      }
    }
    const heroEyeCenter = this.swimmerAsset.part('face_eye_necrotic_center');
    if (heroEyeCenter) {
      if (!heroEyeCenter.userData.basePos) heroEyeCenter.userData.basePos = heroEyeCenter.position.clone();
      const bp = heroEyeCenter.userData.basePos as THREE.Vector3;
      heroEyeCenter.position.x = bp.x + Math.sin(t * 0.82 + 0.45) * 0.006 * scan;
      heroEyeCenter.position.y = bp.y + Math.cos(t * 0.67 + 0.85) * 0.004 * scan;
    }
    const upperJaw = this.swimmerAsset.part('slide_mouth_upper_root');
    const lowerJaw = this.swimmerAsset.part('slide_mouth_lower_root');
    const mouthAsset = smooth(46.8, 47.2, t) * (1 - smooth(48.4, 49, t));
    if (upperJaw) upperJaw.rotation.x = -0.65 * mouthAsset;
    if (lowerJaw) lowerJaw.rotation.x = 0.82 * mouthAsset;
    this.swimmer.visible = false;
    this.swimmer.position.set(sx, 0.62 + smooth(44.5, 45.4, t) * 0.42 - smooth(48.6, 49.2, t) * 0.7, sz + 0.2);
    this.swimmer.rotation.y = smooth(47.6, 48.4, t) * 0.7;
    const mouth = smooth(46.8, 47.2, t) * (1 - smooth(48.4, 49, t));
    this.mouthUpper.rotation.x = -0.2 - mouth * 0.65;
    this.mouthLower.rotation.x = 0.2 + mouth * 0.65;
    const eyeTurn = Math.floor(t * 12) / 12;
    this.eyeL.rotation.y = this.eyeR.rotation.y = smooth(45, 45.5, eyeTurn) * 0.35;

    // displace balls around moving bulge; deterministic per-frame closed form
    for (let i = 0; i < this.ballBase.length; i++) {
      const b = this.ballBase[i]!;
      const dx = b.x - sx, dz = b.z - sz;
      const d2 = dx * dx + dz * dz;
      const activeWake = t > 38 && t < 49.2 ? 1 : 0;
      const bulge = Math.exp(-d2 / 0.85) * 0.36 * activeWake;
      const trail = Math.exp(-((b.x - sx * 0.5) ** 2 + (b.z - sz + 0.8) ** 2) / 1.8) * 0.11;
      const dist = Math.sqrt(d2) + 0.001;
      const parting = Math.exp(-d2 / 1.35) * 0.16 * activeWake;
      let handWakeY = 0, handWakeX = 0, handWakeZ = 0;
      if (swimmerVisible) {
        for (const hw of evaluatedHandWakes) {
          const hdx = b.x - hw.x, hdz = b.z - hw.z;
          const hd2 = hdx * hdx + hdz * hdz;
          const wake = Math.exp(-hd2 / 0.16) * (0.45 + 0.55 * Math.max(0, Math.sin(hw.phase + 1.1)));
          const hd = Math.sqrt(hd2) + 0.001;
          handWakeY -= wake * 0.055;
          handWakeX += (hdx / hd) * wake * 0.030 * Math.sin(hw.phase);
          handWakeZ += (hdz / hd) * wake * 0.030 * Math.sin(hw.phase);
        }
      }
      this.dummy.position.set(b.x + (dx / dist) * parting + handWakeX, b.y + bulge + trail + handWakeY, b.z + (dz / dist) * parting + handWakeZ);
      this.dummy.rotation.set(hash(i) * 3, hash(i + 1) * 3, hash(i + 2) * 3);
      const deflate = hash(i * 9.13);
      const voidNoise = Math.sin(b.x * 1.37 + b.z * 0.71) + Math.sin(b.x * 0.53 - b.z * 1.91);
      const voidCompress = voidNoise < -1.18 ? 0.28 : 1;
      this.dummy.scale.set((0.88 + hash(i * 4.7) * 0.28) * voidCompress, (deflate < 0.08 ? 0.46 + deflate * 2.5 : 0.88 + hash(i * 6.1) * 0.24) * voidCompress, (0.88 + hash(i * 5.3) * 0.28) * voidCompress);
      this.dummy.updateMatrix();
      this.balls.setMatrixAt(i, this.dummy.matrix);
    }
    this.balls.instanceMatrix.needsUpdate = true;
    this.ridge.forEach((r, i) => {
      const w = Math.sin(t * 2.8 - i * 0.55) * 0.12;
      r.position.set(sx + w, 0.68 + Math.sin(t * 3.2 - i) * 0.045, sz - 0.5 - i * 0.34);
      r.visible = t > 38 && t < 49.2 && i < 9;
    });

    // toy phone ring vibrate and tunnel material wetting cue
    const ring = t > 47.5 && t < 49.5 ? Math.sin(t * 55) * 0.012 : 0;
    this.toyPhone.position.y = 0.68 + Math.abs(ring);
    this.toyPhone.rotation.z = ring * 2;
    const wet = smooth(53.4, 55, t);
    this.tunnelRibs.forEach((r, i) => {
      const m = r.material as THREE.MeshStandardMaterial;
      m.color.setHex(i / this.tunnelRibs.length < wet ? (i % 3 ? 0x426f68 : 0x315b70) : (i % 3 ? 0x6d5525 : 0x65251f));
      m.color.multiplyScalar(1 - i / this.tunnelRibs.length * 0.35);
      m.roughness = 0.25 + wet * 0.2;
    });
    // tenant crosses far tunnel light only 52.2-52.7
    this.tenant.visible = t > 52.15 && t < 52.75;
    if (this.tenant.visible) this.tenant.position.x = -5 + (t - 52.15) * 1.8 - 0.5;

    const gl = this.ctx.renderer;
    gl.setRenderTarget(out); gl.setClearColor(0x394448, 1); gl.clear(true, true, true); gl.render(this.s, this.cam); gl.resetState();
    return {
      ...thresholdPost(t, { darkness: 0.28, exposure: 0.78, stress: t > 40.5 && t < 49.5 ? 0.22 : 0.02 }),
      // T1 now owns the eye-adaptation bridge. Do not re-impose a zone-local whiteout
      // after the seam or the exposure decay reverses when transition post is unsuppressed.
      flash: 0,
      shake: t > 40.5 && t < 44.5 ? [0.15 * (hash(Math.floor(t * 90)) - 0.5), 0.15 * (hash(Math.floor(t * 90) + 3) - 0.5)] : [0, 0],
    };
  }
  override dispose() { disposeTree(this.s); }
}
