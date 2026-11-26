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
  private waterMat!: THREE.MeshStandardMaterial;
  private waterGlintMat!: THREE.MeshBasicMaterial;
  private mirrorling!: THREE.Group;
  private reflection!: THREE.Group;
  private arms: THREE.Mesh[] = [];
  private phone!: THREE.Group;
  private tenant!: THREE.Mesh;
  private surfaceLeaves: THREE.Mesh[] = [];
  private underwaterBits: THREE.Mesh[] = [];
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
    const mirrorlingMatCache = new Map<THREE.Material, THREE.Material>();
    this.mirrorlingAsset.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const remap = (m: THREE.Material) => {
        const hit = mirrorlingMatCache.get(m);
        if (hit) return hit;
        const mm = m.clone() as THREE.MeshStandardMaterial;
        if (/aqua_chrome_tile/.test(mm.name)) { mm.color.setHex(0xd8eeee); mm.metalness = 0.1; mm.roughness = 0.3; mm.emissive.setHex(0x000000); mm.emissiveIntensity = 0; }
        if (/pale_tile_highlight/.test(mm.name)) { mm.color.setHex(0xf0f5e9); mm.metalness = 0.04; mm.roughness = 0.24; mm.emissive.setHex(0x000000); mm.emissiveIntensity = 0; }
        if (/black_grout_lines/.test(mm.name)) { mm.color.setHex(0x020708); mm.roughness = 0.78; }
        mm.needsUpdate = true;
        mirrorlingMatCache.set(m, mm);
        return mm;
      };
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const mapped = mats.map(remap);
      mesh.material = Array.isArray(mesh.material) ? mapped : mapped[0]!;
    });
    this.mirrorlingAsset.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => { const mm = m as THREE.MeshStandardMaterial; if (/chrome|tile_highlight/.test(mm.name)) mm.envMapIntensity = 0.48; });
    });
    this.mirrorlingAsset.root.visible = false;
    this.mirrorlingReflection.root.visible = false;
    this.mirrorlingReflection.root.scale.y = -1;
    this.mirrorlingReflection.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mm = (m.material as THREE.MeshStandardMaterial).clone();
        mm.transparent = true; mm.opacity = 0.68; mm.emissive = new THREE.Color(0x1d7280); mm.emissiveIntensity = 0.32; mm.depthWrite = false;
        m.material = mm;
      }
    });
    this.s.add(this.mirrorlingAsset.root, this.mirrorlingReflection.root);
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
      box(this.s, `z3_mosaic_waterline_${side}`, [0.022, 0.18, 29.5], [side * 3.985, 1.06, -7], mat(0x126eab, 0.28));
      box(this.s, `z3_pool_edge_gutter_${side}`, [0.24, 0.075, 27.5], [side * 3.78, 0.49, -6.3], mat(0xe7f2ed, 0.34));
      box(this.s, `z3_gutter_shadow_${side}`, [0.08, 0.045, 27.5], [side * 3.64, 0.475, -6.3], mat(0x061c22, 0.7));
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
    this.waterMat = mat(0x1b8fa0, 0.025, 0.28, 0x073f4a, 0.18) as THREE.MeshStandardMaterial;
    this.waterMat.transparent = true; this.waterMat.opacity = 0.34; this.waterMat.depthWrite = false;
    const wc = document.createElement('canvas'); wc.width = wc.height = 256;
    const wg = wc.getContext('2d')!;
    wg.fillStyle = 'rgba(20,120,135,0.24)'; wg.fillRect(0, 0, 256, 256);
    wg.strokeStyle = 'rgba(190,255,250,0.20)'; wg.lineWidth = 1;
    for (let y = 8; y < 256; y += 18) {
      wg.beginPath();
      for (let x = 0; x <= 256; x += 8) {
        const yy = y + Math.sin(x * 0.08 + y * 0.31) * 1.4 + Math.sin(x * 0.19 + y) * 0.55;
        if (x === 0) wg.moveTo(x, yy); else wg.lineTo(x, yy);
      }
      wg.stroke();
    }
    const waterTex = new THREE.CanvasTexture(wc); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(4, 14);
    this.waterMat.map = waterTex;
    this.water = plane(this.s, 'z3_water_surface', 8, 27, [0, 0.45, -6], this.waterMat, [-Math.PI / 2, 0, 0]);
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
    const glintTex = new THREE.CanvasTexture(gc); glintTex.wrapS = glintTex.wrapT = THREE.RepeatWrapping; glintTex.repeat.set(2.2, 7.5);
    this.waterGlintMat = new THREE.MeshBasicMaterial({ map: glintTex, transparent: true, opacity: 0.34, depthWrite: false });
    plane(this.s, 'z3_water_specular_patches', 8, 27, [0, 0.456, -6], this.waterGlintMat, [-Math.PI / 2, 0, 0]);
    // Player-proxy reflection for the look-down beat: a flattened dark body silhouette lies just under
    // the transparent surface, with a separate warm beam patch computed from the camera pose 0.42s ago.
    const pc = document.createElement('canvas'); pc.width = 256; pc.height = 256;
    const pg = pc.getContext('2d')!; pg.clearRect(0, 0, 256, 256);
    pg.fillStyle = 'rgba(0,5,7,0.9)';
    pg.beginPath(); pg.ellipse(128, 54, 28, 35, 0, 0, Math.PI * 2); pg.fill();
    pg.beginPath(); pg.ellipse(128, 145, 48, 88, 0, 0, Math.PI * 2); pg.fill();
    pg.beginPath(); pg.ellipse(77, 140, 15, 72, -0.18, 0, Math.PI * 2); pg.fill();
    pg.beginPath(); pg.ellipse(179, 140, 15, 72, 0.18, 0, Math.PI * 2); pg.fill();
    const playerTex = new THREE.CanvasTexture(pc); playerTex.colorSpace = THREE.SRGBColorSpace;
    this.playerReflectionMat = new THREE.MeshBasicMaterial({ map: playerTex, transparent: true, opacity: 0, depthWrite: false });
    this.playerReflection = plane(this.s, 'z3_player_proxy_reflection', 0.86, 1.78, [0, 0.448, 3.0], this.playerReflectionMat, [-Math.PI / 2, 0, 0]);
    this.playerReflection.renderOrder = 4; this.playerReflection.visible = false;
    const bc = document.createElement('canvas'); bc.width = 256; bc.height = 256;
    const bg = bc.getContext('2d')!; bg.clearRect(0, 0, 256, 256);
    const bgrad = bg.createRadialGradient(128, 128, 2, 128, 128, 118);
    bgrad.addColorStop(0, 'rgba(255,238,190,0.48)'); bgrad.addColorStop(0.42, 'rgba(180,245,230,0.18)'); bgrad.addColorStop(1, 'rgba(180,245,230,0)');
    bg.fillStyle = bgrad; bg.save(); bg.translate(128, 128); bg.scale(0.55, 1.0); bg.beginPath(); bg.arc(0, 0, 118, 0, Math.PI * 2); bg.fill(); bg.restore();
    const beamTex = new THREE.CanvasTexture(bc); beamTex.colorSpace = THREE.SRGBColorSpace;
    this.beamReflectionMat = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0, depthWrite: false });
    this.beamReflection = plane(this.s, 'z3_lagging_beam_reflection', 1.1, 2.35, [0, 0.452, 2.0], this.beamReflectionMat, [-Math.PI / 2, 0, 0]);
    this.beamReflection.renderOrder = 5; this.beamReflection.visible = false;
    // knee-deep pool cues: submerged entry steps, floor lane markings, depth tiles, caustic strips and floating equipment
    for (let st = 0; st < 3; st++) {
      box(this.s, `z3_submerged_step_${st}`, [7.6, 0.16, 0.55], [0, 0.28 - st * 0.18, 4.75 - st * 0.55], st % 2 ? tileA : tileB);
      box(this.s, `z3_step_noseline_${st}`, [7.6, 0.025, 0.035], [0, 0.37 - st * 0.18, 4.49 - st * 0.55], mat(0x103c45, 0.5));
    }
    for (const x of [-1.6, 0, 1.6]) box(this.s, `z3_floor_lane_${x}`, [0.09, 0.012, 25], [x, -0.105, -6.5], mat(0x083b55, 0.42));
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
    for (let i = 0; i < 18; i++) {
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
          if (/chrome|tile_highlight/.test(mm.name)) { mm.envMap = this.chromeEnv; mm.envMapIntensity = 0.48; mm.needsUpdate = true; }
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

    // strip hum/flicker
    this.strips.forEach((s, i) => { const m = s.material as THREE.MeshStandardMaterial; m.emissiveIntensity = hash(Math.floor(t * 12) + i * 11) < (i === 2 ? 0.22 : 0.04) ? 0.2 : 2.0; });

    // Beat 3.2: planar water reflection of the player-proxy. The dark body is locked to the
    // current camera position, while the warm beam patch is intentionally lagged by 0.42 s.
    const reflPlayer = smooth(58.35, 58.75, t) * (1 - smooth(61.0, 61.55, t));
    this.playerReflection.visible = reflPlayer > 0.015;
    this.beamReflection.visible = reflPlayer > 0.015;
    this.playerReflectionMat.opacity = 0.58 * reflPlayer;
    this.beamReflectionMat.opacity = 0.46 * reflPlayer;
    if (reflPlayer > 0) {
      const fwdX = this.cam.position.x, fwdZ = this.cam.position.z - 2.25;
      this.playerReflection.position.set(fwdX, 0.448, fwdZ);
      this.playerReflection.rotation.z = Math.sin(t * 0.7) * 0.035;
      const lag = evalCam(KEYS, t - 0.42);
      const dx = lag.look[0] - lag.pos[0], dy = lag.look[1] - lag.pos[1], dz = lag.look[2] - lag.pos[2];
      const len = Math.hypot(dx, dy, dz) || 1;
      const ny = dy / len;
      const hit = Math.abs(ny) > 1e-4 ? (0.452 - lag.pos[1]) / ny : 2.0;
      const bx = lag.pos[0] + (dx / len) * hit;
      const bz = lag.pos[2] + (dz / len) * hit;
      this.beamReflection.position.set(bx, 0.452, bz);
      this.beamReflection.rotation.z = -Math.atan2(dx / len, dz / len);
    }

    // Mirrorling rule approximation: reflection first, surface reveal only after look-away
    const reflVisible = t > 59.5 && t < 75.0;
    this.reflection.visible = reflVisible;
    // Surface advance happens as discrete wet-tile steps rather than continuous drifting:
    // each step lands late in a 0.9 s cycle, then holds while eye contact continues.
    const stepU = clamp((t - 72.0) / 0.9, 0, 3.0);
    const stepIndex = Math.floor(stepU);
    const stepK = smooth(0.56, 0.86, stepU - stepIndex);
    const advance = Math.min(3, stepIndex + stepK) * 0.68;
    const mz = -3.4 + advance;
    this.reflection.visible = false;
    this.mirrorling.visible = false;
    // GLB reflection appears first with a positional/turning mismatch; surface figure only after the look-away.
    const mismatch = smooth(62.5, 70.5, t);
    this.mirrorlingReflection.root.visible = reflVisible;
    this.mirrorlingReflection.root.position.set(Math.sin(t * 0.7) * 0.05 + mismatch * 0.18, 0.45, mz - 0.35 - mismatch * 0.28);
    this.mirrorlingReflection.root.rotation.y = Math.sin(t * 0.33) * 0.08 + mismatch * 0.28;
    this.mirrorlingAsset.root.visible = t > 72.0;
    this.mirrorlingAsset.root.position.set(0, 0.45, mz);
    this.mirrorlingAsset.root.rotation.y = smooth(72.2, 74.8, t) * 0.16;
    const gaitPhase = stepU - stepIndex;
    const stepPulse = smooth(0.54, 0.7, gaitPhase) * (1 - smooth(0.78, 0.95, gaitPhase));
    for (const side of [-1, 1] as const) {
      const arm = this.mirrorlingAsset.part(side < 0 ? 'arm_l_upper' : 'arm_r_upper');
      if (arm) arm.rotation.z = (side < 0 ? -1 : 1) * Math.sin(t * 1.15 + (side < 0 ? 0 : 0.7)) * 0.045;
      const lead = (stepIndex % 2 === 0 ? 1 : -1) === side;
      const upperLeg = this.mirrorlingAsset.part(side < 0 ? 'leg_l_upper' : 'leg_r_upper');
      const lowerLeg = this.mirrorlingAsset.part(side < 0 ? 'leg_l_lower' : 'leg_r_lower');
      if (upperLeg) upperLeg.rotation.x = (lead ? -1 : 0.45) * stepPulse * 0.24;
      if (lowerLeg) lowerLeg.rotation.x = (lead ? 0.75 : -0.3) * stepPulse * 0.18;
    }
    for (let ri = 1; ri <= 3; ri++) {
      const ring = this.mirrorlingAsset.part(`water_ripple_ring_${ri}`);
      if (!ring) continue;
      if (!ring.userData.baseScale) ring.userData.baseScale = ring.scale.clone();
      const bs = ring.userData.baseScale as THREE.Vector3;
      const ringPulse = 1 + stepPulse * (0.55 + ri * 0.18);
      ring.scale.set(bs.x * ringPulse, bs.y * ringPulse, bs.z * ringPulse);
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
    this.waterMat.opacity = 0.42 - underwater * 0.16;

    const gl = this.ctx.renderer;
    gl.setRenderTarget(out); gl.setClearColor(underwater > 0.4 ? 0x03151a : 0x08262d, 1); gl.clear(true, true, true); gl.render(this.s, this.cam); gl.resetState();
    return {
      ...thresholdPost(t, { darkness: 0.32 + underwater * 0.28, exposure: 1.02 - underwater * 0.28, stress: 0.08 + underwater * 0.45 }),
      flash: 1 - smooth(55, 56.1, t),
      shake: t > 77 ? [0.8 * Math.sin(t * 29), 0.7 * Math.cos(t * 31)] : [0, 0],
    };
  }
  override dispose() { disposeTree(this.s); }
}
