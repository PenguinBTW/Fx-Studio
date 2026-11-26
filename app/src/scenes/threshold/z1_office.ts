// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Z1 office: grey-box/final-geometry hybrid blockout for beats 1.1-1.9. Local rig is W2 scaffolding pending W1's shared kit.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
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
  { t: 11.0, pos: [0, 1.45, -5.15], look: [0, 0.83, -6], fov: 68, gait: 'walk' },
  { t: 13.0, pos: [0, 1.45, -5.15], look: [0, 0.9, -6], fov: 68, gait: 'still' },
  { t: 15.5, pos: [0, 1.48, -5.15], look: [0, 1.9, -6], fov: 68, gait: 'still' },
  { t: 18.5, pos: [0, 1.5, -5.15], look: [0, 2.68, -6], fov: 66, gait: 'still' },
  { t: 19.3, pos: [0, 1.5, -5.15], look: [0, 2.68, -6], fov: 66, gait: 'still' },
  { t: 19.8, pos: [0, 1.58, -4.6], look: [0, 1.45, 1], fov: 84, gait: 'run' },
  { t: 21.6, pos: [0, 1.6, 1.2], look: [2.5, 1.5, 4.2], fov: 84, gait: 'run' },
  { t: 23.3, pos: [4.0, 1.6, 4.2], look: [4.0, 1.5, 9], fov: 84, gait: 'run' },
  { t: 25.5, pos: [4.0, 1.6, 9.0], look: [-2, 1.5, 15], fov: 85, gait: 'run' },
  { t: 27.5, pos: [-2.0, 1.6, 12.0], look: [-2, 1.25, 15], fov: 88, gait: 'run' },
  { t: 30.0, pos: [-2.0, 1.54, 14.72], look: [-2, 1.15, 16], fov: 88, gait: 'run', roll: 0.08 },
];

export default class ThresholdZ1Office extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(74, 16 / 9, 0.04, 80);
  private layer!: Layer2D;
  private flash!: ReturnType<typeof addFlashlight>;
  private receiver!: THREE.Mesh;
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

  override async init() {
    const resolved = resolveAsset('threshold/z1_ceiling_breather');
    this.breather = await GLTFManager.instantiate(resolved.url, { ...resolved.manifest.load, castShadow: true, receiveShadow: true });
    this.breather.root.position.set(0,2.72,-6.02); this.breather.root.visible = false; this.s.add(this.breather.root);
    this.layer = new Layer2D(this.ctx.W, this.ctx.H);
    this.s.background = new THREE.Color(0x050505);
    this.s.fog = new THREE.FogExp2(0x111008, 0.035);
    this.flash = addFlashlight(this.s);
    this.s.add(new THREE.AmbientLight(0x8b866f, 0.32));

    const carpet = mat(0x756947, 0.92);
    const wall = mat(0xa89354, 0.82);
    const wallDark = mat(0x796a3f, 0.88);
    const ceiling = mat(0xcfc8b1, 0.76);
    const metal = mat(0x595c5b, 0.42, 0.35);
    const plastic = mat(0xcdbd91, 0.48);
    const dark = mat(0x101010, 0.9);
    const paper = mat(0xd8d0b9, 0.88);
    const green = mat(0x204020, 0.5, 0, 0x25ff56, 0.8);
    const red = mat(0x5d1512, 0.45, 0, 0xff1f18, 1.8);
    const screen = mat(0x1c3032, 0.25, 0, 0x5de6e0, 0.65);
    this.doorGlow = mat(0xfff4c8, 0.3, 0, 0xfff2b0, 5) as THREE.MeshStandardMaterial;

    box(this.s, 'z1_floor', [30, 0.08, 48], [0, -0.04, -3], carpet);
    box(this.s, 'z1_ceiling_slab', [30, 0.08, 48], [0, 2.76, -3], ceiling);
    // perimeter walls and a deliberately non-grid maze of drywall partitions
    box(this.s, 'z1_wall_back', [30, 2.7, 0.16], [0, 1.35, -26], wall);
    box(this.s, 'z1_wall_left', [0.16, 2.7, 34], [-13, 1.35, 3], wallDark);
    box(this.s, 'z1_wall_right', [0.16, 2.7, 34], [13, 1.35, 3], wallDark);
    box(this.s, 'z1_wall_fire', [26, 2.7, 0.16], [0, 1.35, 16], wall);
    const partitions: [number, number, number, number, number][] = [
      [-2.2, -2.5, 0.12, 2.1, 4.5], [2.2, -2.2, 0.12, 2.1, 4.2], [-4.8, 0.5, 4.2, 2.1, 0.12], [4.7, 1.2, 4.8, 2.1, 0.12],
      [-6.4, -4.6, 0.12, 2.1, 5.4], [6.5, -4.7, 0.12, 2.1, 5.5], [-1.4, 4.2, 0.12, 2.1, 4.5], [6.3, 7.2, 0.12, 2.1, 5.2],
      [-6.1, 7.4, 0.12, 2.1, 5.6], [1.6, 11.4, 5.0, 2.1, 0.12], [-6.8, 12.2, 4.5, 2.1, 0.12], [8.8, 3.3, 0.12, 2.1, 8],
    ];
    partitions.forEach(([x, z, sx, sy, sz], i) => box(this.s, `z1_partition_${i}`, [sx, sy, sz], [x, sy / 2, z], i % 2 ? wall : wallDark));
    // Deep repeated maze beyond the first desk: foreground/midground/background cubicle rows make the office read as endless.
    for (let row = 0; row < 6; row++) {
      const z = -8.2 - row * 2.8;
      for (const side of [-1, 1]) {
        box(this.s, `z1_deep_partition_${row}_${side}`, [0.12, 2.05, 1.9], [side * (2.7 + (row % 2) * 1.2), 1.02, z], row % 2 ? wall : wallDark);
        box(this.s, `z1_deep_cross_${row}_${side}`, [2.5, 1.85, 0.11], [side * 4.3, 0.93, z - 0.85], row % 2 ? wallDark : wall);
        box(this.s, `z1_deep_desk_${row}_${side}`, [1.25, 0.07, 0.62], [side * (3.7 + (row % 2) * 0.8), 0.72, z + 0.35], mat(0x6f695c, 0.65));
        box(this.s, `z1_deep_monitor_${row}_${side}`, [0.36, 0.28, 0.28], [side * (3.7 + (row % 2) * 0.8), 1.0, z + 0.18], dark, [0, -side * 0.25, 0]);
        if ((row + (side > 0 ? 1 : 0)) % 2 === 0) plane(this.s, `z1_deep_screen_${row}_${side}`, 0.24, 0.16, [side * (3.7 + (row % 2) * 0.8), 1.01, z + 0.03], screen, [0, -side * 0.25, 0]);
      }
      if (row % 2 === 0) {
        box(this.s, `z1_deep_troffer_${row}`, [1.1, 0.05, 0.32], [row % 4 ? -2.2 : 2.1, 2.62, z], metal);
        box(this.s, `z1_deep_tube_${row}`, [0.85, 0.025, 0.08], [row % 4 ? -2.2 : 2.1, 2.58, z], this.tubeMats[0] ?? ceiling);
      }
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
      const p = new THREE.PointLight(0xdfffd2, 1.6, 7, 1.5); p.position.set(x, 2.35, z); this.s.add(p); this.tubeLights.push(p);
      li++;
    }

    // desk, phone and office dressing
    box(this.s, 'z1_desk_top', [2.0, 0.09, 0.9], [0, 0.74, -6], mat(0x6c675d, 0.55));
    box(this.s, 'z1_desk_leg_l', [0.08, 0.72, 0.8], [-0.86, 0.36, -6], metal);
    box(this.s, 'z1_desk_leg_r', [0.08, 0.72, 0.8], [0.86, 0.36, -6], metal);
    box(this.s, 'z1_phone_base', [0.42, 0.13, 0.28], [0.28, 0.84, -6.05], plastic, [0, -0.12, 0]);
    this.receiver = box(this.s, 'z1_phone_receiver', [0.46, 0.09, 0.11], [0.28, 0.96, -6.05], plastic, [0, -0.12, 0]);
    for (let i = 0; i < 12; i++) box(this.s, `z1_phone_button_${i}`, [0.045, 0.012, 0.035], [0.16 + (i % 3) * 0.055, 0.912, -5.94 + Math.floor(i / 3) * 0.045], dark);
    box(this.s, 'z1_crt_monitor', [0.56, 0.42, 0.46], [-0.52, 1.02, -6.18], dark, [0, 0.22, 0]);
    plane(this.s, 'z1_monitor_screen', 0.42, 0.28, [-0.52, 1.04, -5.94], screen, [0, 0.22, 0]);
    cyl(this.s, 'z1_coffee_mug', 0.055, 0.11, [-0.18, 0.84, -5.78], mat(0xaaa18a, 0.5));
    cyl(this.s, 'z1_mould_ring', 0.065, 0.004, [-0.18, 0.905, -5.78], mat(0x25301d, 0.95), [Math.PI / 2, 0, 0], 24);
    for (let i = 0; i < 8; i++) box(this.s, `z1_sticky_${i}`, [0.09, 0.006, 0.09], [-0.75 + hash(i) * 0.4, 0.795, -5.78 + hash(i + 4) * 0.25], mat(i % 2 ? 0xd8c84e : 0xd89348, 0.8), [0, hash(i + 8) * 0.8, 0]);

    // chairs/cubicle desks/printer/paper clutter along run path
    const chairMat = mat(0x343b42, 0.72);
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
    cyl(this.s, 'z1_ficus_pot', 0.18, 0.28, [-7.4, 0.14, -5.6], mat(0x684329, 0.7));
    for (let i = 0; i < 8; i++) cyl(this.s, `z1_dead_ficus_stem_${i}`, 0.012, 0.7 + hash(i) * 0.5, [-7.4 + (hash(i) - 0.5) * 0.22, 0.55, -5.6 + (hash(i + 3) - 0.5) * 0.22], mat(0x2f2719, 0.9), [0.3 * (hash(i) - 0.5), 0, 0.3 * (hash(i + 2) - 0.5)], 8);
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

    // fire door, push bar, sign and daylight slit
    box(this.s, 'z1_fire_door', [1.0, 2.1, 0.09], [-2, 1.05, 15.92], mat(0x4c5a4e, 0.55));
    box(this.s, 'z1_fire_pushbar', [0.72, 0.07, 0.08], [-2, 1.02, 15.84], metal);
    box(this.s, 'z1_exit_sign', [0.62, 0.22, 0.08], [-2, 2.32, 15.82], red);
    plane(this.s, 'z1_exit_text_proxy', 0.42, 0.12, [-2, 2.32, 15.77], basic(0xff4038), [0, 0, 0]);
    plane(this.s, 'z1_daylight_slit', 0.92, 0.045, [-2, 0.035, 15.76], basic(0xfff0ba), [-Math.PI / 2, 0, 0]);

    // true dark rectangular opening behind the creature details; the ordinary slab otherwise reads as solid ceiling
    box(this.s, 'z1_ceiling_gap_black', [1.35, 0.035, 0.92], [0, 2.655, -6.02], basic(0x010101));
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
      const m = box(this.s, `z1_chase_drop_tile_${i}`, [1.1, 0.03, 1.1], [i % 2 ? 2.8 : 0.2, 2.68, z], ceiling);
      this.fallingTiles.push({ m, z, t0: 20.1 + i * 1.05, y0: 2.68 });
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const gl = this.ctx.renderer;
    applyFpCamera(this.cam, KEYS, t, out.width / out.height);
    // flicker teaches the creature rule; hard irregular drops from 13s onward
    const flicker = t < 13 ? 0 : t < 15.5 ? 0.14 : t < 19.3 ? 0.32 : t < 27.5 ? 0.16 : 0.06;
    const eyeBeam = 1 - 0.58 * smooth(15.3, 15.8, t) * (1 - smooth(19.2, 19.8, t));
    updateFlashlight(this.flash.light, this.flash.target, this.cam, t, eyeBeam * 0.32, flicker);

    // fluorescent life: one ticking starter and one dying tube
    for (let i = 0; i < this.tubeLights.length; i++) {
      const cell = Math.floor(t * (i === 1 ? 9 : 4));
      const drop = i === 1 && hash(cell) < 0.38 ? 0.15 : i === 3 && hash(cell + 5) < 0.18 ? 0.35 : 1;
      this.tubeLights[i]!.intensity = 1.6 * drop;
    }
    this.tubeMats[0]!.emissiveIntensity = 2.4 + 0.4 * hash(Math.floor(t * 7));
    this.tubeMats[1]!.emissiveIntensity = hash(Math.floor(t * 11)) < 0.28 ? 0.35 : 2.3;

    // phone rings then receiver levitates
    const ring = t > 8.3 && t < 11 ? Math.sin(t * Math.PI * 40) * 0.006 : 0;
    const lift = smooth(11, 11.7, t) * 0.04;
    this.receiver.position.y = 0.96 + lift + ring;
    this.receiver.rotation.z = ring * 4;

    // ceiling tile, eyes, lids, fingers, breathing tile skin
    this.tileShift.position.y = 2.69 - smooth(13, 15.4, t) * 0.025;
    this.tileShift.rotation.x = smooth(14.2, 15.5, t) * 0.04;
    const eyesOn = smooth(15.45, 15.8, t);
    this.breather.root.visible = eyesOn > 0.02;
    this.breather.root.position.y = 2.72 + Math.sin(t * 1.1) * 0.012 * eyesOn;
    for (let bi = 1; bi <= 8; bi++) {
      const fp = this.breather.part(`finger_${bi}_root`);
      if (fp) {
        const emerge = smooth(15.8 + (bi % 4) * 0.32, 16.35 + (bi % 4) * 0.32, t);
        fp.visible = emerge > 0.03;
        const side = bi < 5 ? -1 : 1;
        fp.rotation.x = (Math.sin(t * 0.9 + bi) * 0.075 - 0.08 * emerge) * eyesOn;
        fp.rotation.z = side * (0.045 + (bi % 3) * 0.025 + Math.sin(t * 0.55 + bi * 1.7) * 0.018) * eyesOn;
        fp.rotation.y = Math.sin(t * 0.42 + bi) * 0.025 * eyesOn;
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
    this.slidingPrintout.position.x = 0.55 + smooth(4, 29, t) * 0.22;
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
      flash: smooth(29.35, 30.0, t) * 1.8,
      shake: t > 19.3 && t < 30 ? [1.2 * Math.sin(t * 37), 1.0 * Math.cos(t * 31)] : [0, 0],
    };
  }

  override dispose() { disposeTree(this.s); this.layer?.dispose(); }
}
