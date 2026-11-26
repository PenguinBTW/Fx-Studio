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
    const v = 218 + n - stain - scuff;
    const id = (y * size + x) * 4;
    img.data[id] = img.data[id + 1] = img.data[id + 2] = Math.max(86, Math.min(255, v)); img.data[id + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2.5, 2.5);
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
    this.s.background = new THREE.Color(0xcfe8ff);
    this.s.fog = new THREE.Fog(0xcfe8ff, 18, 55);
    this.flash = addFlashlight(this.s);
    this.s.add(new THREE.HemisphereLight(0xffffff, 0x5c78a8, 1.4));
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5); this.sun.position.set(-4, 9, 2); this.s.add(this.sun);

    const foam = mat(0xf1efe8, 0.55);
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
    for (const m of [foam, red, yellow, blue, green, plasticDark, ...mats]) {
      const sm = m as THREE.MeshStandardMaterial;
      sm.map = grimeTex; sm.roughnessMap = grimeTex; sm.bumpMap = grimeTex; sm.bumpScale = 0.008;
      sm.color.multiplyScalar(0.78 + hash(sm.color.getHex() * 0.001) * 0.12); sm.roughness = Math.max(sm.roughness, 0.42); sm.needsUpdate = true;
    }

    box(this.s, 'z2_floor', [31, 0.1, 21], [0, -0.05, 0], foam);
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
    const stainMat = basic(0x4a3522, 0.24);
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

    // skylights
    for (let i = 0; i < 3; i++) {
      const m = mat(0xffffff, 0.2, 0, 0xffffff, 2.8) as THREE.MeshStandardMaterial;
      this.skylightMats.push(m);
      box(this.s, `z2_skylight_${i}`, [4.8, 0.05, 2.8], [-6 + i * 6, 5.95, -2], m);
    }

    // ball pit padded rim and dense instanced ball surface
    box(this.s, 'z2_pit_n', [12.6, 0.8, 0.35], [0, 0.4, -4.2], blue);
    box(this.s, 'z2_pit_s', [12.6, 0.8, 0.35], [0, 0.4, 4.2], red);
    box(this.s, 'z2_pit_w', [0.35, 0.8, 8.4], [-6.2, 0.4, 0], yellow);
    box(this.s, 'z2_pit_e', [0.35, 0.8, 8.4], [6.2, 0.4, 0], green);
    const geom = new THREE.SphereGeometry(0.075, 8, 5);
    const inst = new THREE.InstancedMesh(geom, new THREE.MeshStandardMaterial({ roughness: 0.26, metalness: 0 }), 4900);
    inst.castShadow = false; inst.receiveShadow = true;
    let bi = 0;
    for (let ix = 0; ix < 86 && bi < 4900; ix++) for (let iz = 0; iz < 57 && bi < 4900; iz++) {
      const x = -5.95 + ix * 0.14 + (hash(ix * 91 + iz * 17) - 0.5) * 0.035;
      const z = -3.95 + iz * 0.14 + (hash(ix * 19 + iz * 71) - 0.5) * 0.035;
      const dome = 0.03 * (1 - (x / 6) ** 2) + 0.025 * (1 - (z / 4) ** 2);
      const y = 0.55 + dome + (hash(ix * 7 + iz * 13) - 0.5) * 0.025;
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
      cyl(this.s, `z2_net_v_${i}`, 0.012, 1.3, [-4.4 + i * 0.28, 1.95, -3.55], plasticDark, [0, 0, 0], 8);
      cyl(this.s, `z2_net_h_${i}`, 0.012, 2.0, [-3.4, 1.45 + i * 0.16, -3.55], plasticDark, [0, 0, Math.PI / 2], 8);
    }
    // spiral slide as stacked torus arcs/ribbon-like tube segments
    for (let i = 0; i < 16; i++) {
      const a = i * 0.34, r = 1.0, y = 2.5 - i * 0.12;
      const seg = cyl(this.s, `z2_spiral_slide_${i}`, 0.16, 0.75, [-7.6 + Math.cos(a) * r, y, -4.8 + Math.sin(a) * r], yellow, [Math.PI / 2, 0, -a], 16);
      seg.scale.x = 0.55;
    }
    for (let i = 0; i < 7; i++) box(this.s, `z2_step_block_${i}`, [0.7, 0.25, 0.7], [3.1 + (i % 2) * 0.8, 0.13 + i * 0.11, 3.8 - i * 0.55], mats[i % mats.length]!);
    // tube tunnel ribs along z
    const shellMat = mat(0x255dcc, 0.32); shellMat.side = THREE.BackSide;
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 6.4, 32, 1, true), shellMat);
    shell.position.set(-5, 0.82, 8.35); shell.rotation.x = Math.PI / 2; shell.name = 'z2_tunnel_shell'; shell.userData.fx_entity = shell.name; this.s.add(shell);
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
    for (let i = 0; i < 20; i++) {
      const g = new THREE.Group(); g.position.set(8.0, 1.05 + (i % 3) * 0.62, -3.8 + Math.floor(i / 3) * 0.72);
      const body = sph(g, `z2_toy_body_${i}`, 0.13, [0, 0, 0], toyCols[i % 4]!, 12); body.scale.set(1, 1.25, 0.75);
      sph(g, `z2_toy_head_${i}`, 0.09, [0, 0.19, 0.02], toyCols[(i + 1) % 4]!, 12);
      if (i % 5 === 0) cyl(g, `z2_toy_neck_${i}`, 0.025, 0.3, [0, 0.26, 0], toyCols[i % 4]!, [0, 0, 0.3], 8);
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
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) for (let i = 0; i < 24; i++) {
      const panel = this.cloneProp(this.playroomKit, 'padded_wall_panel_root', [-14.0 + i * 1.22 + (row % 2) * 0.61, row * 1.1, side * 10.31], side < 0 ? 0 : Math.PI, 1, `z2_wall_panel_asset_${side}_${row}_${i}`);
      const tint = row === 3 && i % 3 === 0 ? 0xe7dfca : padColors[(i + row * 2 + (side > 0 ? 2 : 0)) % padColors.length]!;
      panel?.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const key = `${src.name}_${src.name === 'foam_vinyl_ivory' ? tint : 0}`;
        let mm = panelMaterialCache.get(key);
        if (!mm) {
          mm = src.clone();
          if (mm.name === 'foam_vinyl_ivory') mm.color.setHex(tint);
          panelMaterialCache.set(key, mm);
        }
        mesh.material = mm;
      });
    }
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) for (let i = 0; i < 17; i++) {
      const panel = this.cloneProp(this.playroomKit, 'padded_wall_panel_root', [side * 15.31, row * 1.1, -9.2 + i * 1.15 + (row % 2) * 0.55], side < 0 ? Math.PI / 2 : -Math.PI / 2, 1, `z2_side_panel_asset_${side}_${row}_${i}`);
      const tint = padColors[(i + row + (side > 0 ? 3 : 0)) % padColors.length]!;
      panel?.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const src = mesh.material as THREE.MeshStandardMaterial;
        const key = `${src.name}_${src.name === 'foam_vinyl_ivory' ? tint : 0}`;
        let mm = panelMaterialCache.get(key);
        if (!mm) {
          mm = src.clone();
          if (mm.name === 'foam_vinyl_ivory') mm.color.setHex(tint);
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
      if (rib) rib.rotation.x = Math.PI / 2;
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
    updateFlashlight(this.flash.light, this.flash.target, this.cam, t, closeBeam * 0.24, t > 40.5 && t < 49.5 ? 0.3 : 0.05);
    // clouded skylight dimming after 40s
    const dim = 1 - smooth(39.5, 41.5, t) * 0.5;
    this.sun.intensity = 2.5 * dim;
    this.skylightMats.forEach((m) => { m.emissiveIntensity = 2.8 * dim; });

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
    this.swimmerAsset.root.position.set(sx, sy, sz + 0.2);
    this.swimmerAsset.root.rotation.y = smooth(47.6, 48.4, t) * 0.7;
    for (const side of ['l', 'r'] as const) {
      const pupil = this.swimmerAsset.part(`eye_pupil_${side}`);
      if (pupil) {
        if (!pupil.userData.basePos) pupil.userData.basePos = pupil.position.clone();
        const bp = pupil.userData.basePos as THREE.Vector3;
        const scan = smooth(44.8, 45.6, t) * (1 - smooth(48.7, 49.2, t));
        pupil.position.x = bp.x + Math.sin(t * 0.82 + (side === 'l' ? 0 : 0.9)) * 0.014 * scan;
        pupil.position.y = bp.y + Math.cos(t * 0.67 + (side === 'l' ? 0.4 : 1.1)) * 0.009 * scan;
      }
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
      this.dummy.position.set(b.x + (dx / dist) * parting, b.y + bulge + trail, b.z + (dz / dist) * parting);
      this.dummy.rotation.set(hash(i) * 3, hash(i + 1) * 3, hash(i + 2) * 3);
      const deflate = hash(i * 9.13);
      this.dummy.scale.set(0.88 + hash(i * 4.7) * 0.28, deflate < 0.08 ? 0.46 + deflate * 2.5 : 0.88 + hash(i * 6.1) * 0.24, 0.88 + hash(i * 5.3) * 0.28);
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
      m.color.setHex(i / this.tunnelRibs.length < wet ? (i % 3 ? 0x9fd5c8 : 0x74c5d8) : (i % 3 ? 0xf6c83b : 0xe63b2e));
      m.roughness = 0.25 + wet * 0.2;
    });
    // tenant crosses far tunnel light only 52.2-52.7
    this.tenant.visible = t > 52.15 && t < 52.75;
    if (this.tenant.visible) this.tenant.position.x = -5 + (t - 52.15) * 1.8 - 0.5;

    const gl = this.ctx.renderer;
    gl.setRenderTarget(out); gl.setClearColor(0xcfe8ff, 1); gl.clear(true, true, true); gl.render(this.s, this.cam); gl.resetState();
    return {
      ...thresholdPost(t, { darkness: 0.12, exposure: 0.72, stress: t > 40.5 && t < 49.5 ? 0.22 : 0.02 }),
      flash: 1 - smooth(30, 31.0, t),
      shake: t > 40.5 && t < 44.5 ? [0.15 * (hash(Math.floor(t * 90)) - 0.5), 0.15 * (hash(Math.floor(t * 90) + 3) - 0.5)] : [0, 0],
    };
  }
  override dispose() { disposeTree(this.s); }
}
