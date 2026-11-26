// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Z3 tiled pool halls: deterministic grey-box beat blockout with real scale/camera path; local rig is W2 scaffolding pending W1's shared kit.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { addFlashlight, applyFpCamera, basic, box, clamp, cyl, disposeTree, hash, mat, plane, smooth, sph, updateFlashlight, type CamKey } from './z1_fp_local';

const KEYS: CamKey[] = [
  { t: 55, pos: [0, 1.65, 6.4], look: [0, 1.25, -4], fov: 76, gait: 'still' },
  { t: 56.5, pos: [0, 1.65, 5.1], look: [0, 0.55, 1], fov: 76, gait: 'walk' },
  { t: 59.8, pos: [0, 1.65, 2.2], look: [0, 0.48, -2], fov: 76, gait: 'walk' },
  { t: 62.5, pos: [0, 1.65, 0.2], look: [0, 1.05, -8], fov: 76, gait: 'walk' },
  { t: 65, pos: [0, 1.65, -2], look: [0, 1.0, -9], fov: 76, gait: 'walk' },
  { t: 68.2, pos: [0, 1.65, -3.2], look: [0, 0.25, -5.5], fov: 76, gait: 'walk' },
  { t: 71, pos: [0, 1.65, -3.6], look: [3, 0.5, -2], fov: 76, gait: 'still' },
  { t: 73.5, pos: [0, 1.65, -3.6], look: [0, 1.05, -11], fov: 76, gait: 'still' },
  { t: 75.5, pos: [0, 1.65, -3.4], look: [0, 1.15, -4.6], fov: 76, gait: 'still' },
  { t: 77.5, pos: [0, 1.65, -0.5], look: [0, 1.15, -4.6], fov: 78, gait: 'run' },
  { t: 79.2, pos: [0, 1.35, 4.6], look: [0, 1.05, -4.5], fov: 84, gait: 'run', roll: -0.18 },
  { t: 80, pos: [0, -0.35, 5.8], look: [0, -0.8, 1.5], fov: 90, gait: 'hold', roll: -0.65 },
];

export default class ThresholdZ3Pool extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(76, 16 / 9, 0.04, 90);
  private flash!: ReturnType<typeof addFlashlight>;
  private water!: THREE.Mesh;
  private waterMat!: THREE.MeshStandardMaterial;
  private mirrorling!: THREE.Group;
  private reflection!: THREE.Group;
  private arms: THREE.Mesh[] = [];
  private phone!: THREE.Group;
  private tenant!: THREE.Mesh;
  private surfaceLeaves: THREE.Mesh[] = [];
  private underwaterBits: THREE.Mesh[] = [];
  private strips: THREE.Mesh[] = [];
  private stepGlow!: THREE.MeshStandardMaterial;

  override init() {
    this.s.background = new THREE.Color(0x08262d);
    this.s.fog = new THREE.FogExp2(0x0b4652, 0.055);
    this.flash = addFlashlight(this.s);
    this.s.add(new THREE.HemisphereLight(0x9ff7ff, 0x09272f, 0.75));
    const tileA = mat(0xbfe7e7, 0.22);
    const tileB = mat(0x78cbd2, 0.18);
    const grout = mat(0x356d72, 0.75);
    const metal = mat(0x617678, 0.28, 0.55);
    const chrome = mat(0xbcecf1, 0.04, 0.9);
    const dark = mat(0x071014, 0.9);
    const leaf = mat(0x5a6f27, 0.85);

    // hall volume, stepped entry shelf and tiled grid strips
    box(this.s, 'z3_floor_deep', [8, 0.12, 31], [0, -0.05, -7], grout);
    box(this.s, 'z3_step_shelf', [8, 0.55, 2.4], [0, 0.22, 6.4], tileA);
    box(this.s, 'z3_step_face', [8, 0.55, 0.1], [0, 0.22, 5.2], tileB);
    box(this.s, 'z3_wall_l', [0.18, 5.5, 31], [-4.1, 2.4, -7], tileA);
    box(this.s, 'z3_wall_r', [0.18, 5.5, 31], [4.1, 2.4, -7], tileA);
    box(this.s, 'z3_wall_end', [8.2, 5.5, 0.18], [0, 2.4, -22.6], tileB);
    box(this.s, 'z3_ceiling', [8.2, 0.16, 31], [0, 4.7, -7], grout);
    for (let x = -4; x <= 4; x += 0.5) box(this.s, `z3_tile_v_${x}`, [0.012, 0.012, 30], [x, 0.015, -7], grout);
    for (let z = -22; z <= 8; z += 0.5) {
      box(this.s, `z3_tile_h_l_${z}`, [0.012, 0.012, 0.45], [-4.0, 2.1, z], grout);
      box(this.s, `z3_tile_h_r_${z}`, [0.012, 0.012, 0.45], [4.0, 2.1, z], grout);
    }
    // columns and repeating arch openings
    for (let z = 2; z >= -20; z -= 4) {
      box(this.s, `z3_column_l_${z}`, [0.46, 3.8, 0.46], [-3.72, 1.9, z], tileB);
      box(this.s, `z3_column_r_${z}`, [0.46, 3.8, 0.46], [3.72, 1.9, z], tileB);
      box(this.s, `z3_arch_lintel_${z}`, [7.4, 0.28, 0.35], [0, 3.5, z], tileA);
    }
    // water plane and lane-rope/pipe details
    this.waterMat = mat(0x1a8c9d, 0.08, 0.05, 0x073f4a, 0.35) as THREE.MeshStandardMaterial;
    this.waterMat.transparent = true; this.waterMat.opacity = 0.58;
    this.water = plane(this.s, 'z3_water_surface', 8, 27, [0, 0.45, -6], this.waterMat, [-Math.PI / 2, 0, 0]);
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
      this.surfaceLeaves.push(l);
    }
    // underwater leaves/spores
    for (let i = 0; i < 28; i++) {
      const b = sph(this.s, `z3_under_bit_${i}`, 0.018 + hash(i) * 0.02, [-3.5 + hash(i) * 7, -0.1 - hash(i + 1) * 1.2, -14 + hash(i + 2) * 16], basic(0x9de6d5, 0.5), 8);
      this.underwaterBits.push(b);
    }
    // pump/filter/graffiti/lane rope/rust details
    box(this.s, 'z3_pump_unit', [0.65, 0.8, 0.45], [-3.4, 0.4, -19.8], metal);
    cyl(this.s, 'z3_filter_intake', 0.18, 0.08, [3.95, 0.6, -3.5], dark, [0, 0, Math.PI / 2], 24);
    box(this.s, 'z3_graffiti_proxy', [1.3, 0.35, 0.015], [-4.0, 1.55, -9.5], mat(0xed4178, 0.5), [0, 0, -0.08]);
    for (let i = 0; i < 8; i++) sph(this.s, `z3_lane_float_${i}`, 0.08, [3.3, 0.5, -8 - i * 0.45], i % 2 ? mat(0xffffff, 0.4) : mat(0xff5738, 0.4), 10);
    for (let i = 0; i < 10; i++) box(this.s, `z3_rust_drip_${i}`, [0.025, 0.3 + hash(i) * 0.7, 0.012], [-3.99, 1.7 + hash(i) * 1.3, -18 + i * 1.7], mat(0x8d3e19, 0.9));

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
      const upper = cyl(this.mirrorling, `z3_mirrorling_arm_upper_${side}`, 0.035, 1.25, [side * 0.35, 1.62, 0], chrome, [0, 0, side * 0.7], 12);
      const lower = cyl(this.mirrorling, `z3_mirrorling_arm_lower_${side}`, 0.025, 1.35, [side * 0.88, 0.95, 0], chrome, [0, 0, side * 0.3], 12);
      this.arms.push(upper, lower);
    }
    // reflection copy, not exact hierarchy but readable mirrored double
    this.reflection = this.mirrorling.clone(true); this.reflection.scale.y = -1; this.reflection.position.y = 0.45; this.reflection.visible = false; this.s.add(this.reflection);
    this.reflection.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const mm = (m.material as THREE.MeshStandardMaterial).clone(); mm.emissive = new THREE.Color(0x2e8791); mm.emissiveIntensity = 0.45; m.material = mm; } });

    // huge Tenant silhouette far underwater
    this.tenant = box(this.s, 'z3_tenant_underwater', [1.2, 4.8, 0.5], [0, -1.8, -10], basic(0x02080a, 0.65));
    this.tenant.visible = false;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    applyFpCamera(this.cam, KEYS, t, out.width / out.height);
    const battery = t > 70 ? 0.7 : 0.85;
    updateFlashlight(this.flash.light, this.flash.target, this.cam, t, battery, t > 73 ? 0.16 : 0.04);
    // deterministic surface shimmer and drifting floaters
    this.water.position.y = 0.45 + Math.sin(t * 1.8) * 0.008;
    this.waterMat.emissiveIntensity = 0.35 + Math.sin(t * 2.4) * 0.08;
    this.surfaceLeaves.forEach((l, i) => { l.position.x += Math.sin(t * 0.25 + i) * 0.0008; l.rotation.z = hash(i) * 6 + Math.sin(t * 0.35 + i) * 0.1; });
    this.underwaterBits.forEach((b, i) => { b.position.y += Math.sin(t * 0.7 + i) * 0.0007; b.position.x += Math.cos(t * 0.4 + i) * 0.0005; });

    // strip hum/flicker
    this.strips.forEach((s, i) => { const m = s.material as THREE.MeshStandardMaterial; m.emissiveIntensity = hash(Math.floor(t * 12) + i * 11) < (i === 2 ? 0.22 : 0.04) ? 0.2 : 2.0; });

    // Mirrorling rule approximation: reflection first, surface reveal only after look-away
    const reflVisible = t > 59.5 && t < 75.0;
    this.reflection.visible = reflVisible;
    const advance = smooth(73.0, 75.0, t) * 3.2;
    const mz = -8 + advance;
    this.reflection.position.set(Math.sin(t * 0.7) * 0.03, 1.18, mz - 0.35);
    this.mirrorling.visible = t > 74.2;
    this.mirrorling.position.set(0, 0.45, mz);
    // arms copy laggingly; chrome figure reads as human silhouette even in grey-box
    this.arms.forEach((a, i) => { a.rotation.z += Math.sin(t * 1.4 + i) * 0.002; });
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
    this.waterMat.opacity = 0.58 - underwater * 0.2;

    const gl = this.ctx.renderer;
    gl.setRenderTarget(out); gl.setClearColor(underwater > 0.4 ? 0x03151a : 0x08262d, 1); gl.clear(true, true, true); gl.render(this.s, this.cam); gl.resetState();
    return {
      flash: 1 - smooth(55, 56.1, t),
      exposure: 0.9 - underwater * 0.35,
      bloom: 0.18,
      bloomThreshold: 0.85,
      vignette: 0.22 + underwater * 0.2,
      grain: 0.03,
      ca: 0.12 + underwater * 0.35,
      shake: t > 77 ? [0.8 * Math.sin(t * 29), 0.7 * Math.cos(t * 31)] : [0, 0],
    };
  }
  override dispose() { disposeTree(this.s); }
}
