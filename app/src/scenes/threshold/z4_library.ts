// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Z4 paper library: deterministic grey-box beat blockout with real scale/camera path; local rig is W2 scaffolding pending W1's shared kit.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { resolveAsset } from '../../engine/assets';
import { thresholdPost } from './sensor_post';
import { addFlashlight, applyFpCamera, basic, box, clamp, cyl, disposeTree, hash, mat, plane, smooth, sph, updateFlashlight, type CamKey } from './z1_scene_util';

function paperFiberTexture() {
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = hash(x * 0.173 + y * 3.71) * 30 + Math.sin(y * 0.55 + hash(x) * 2) * 7 + Math.sin((x + y) * 0.07) * 6;
    const stain = Math.max(0, Math.sin(x * 0.021 + y * 0.013) - 0.72) * 42;
    const v = 214 + n - stain - (hash(x * 4.1 + y * 0.37) > 0.975 ? 34 : 0);
    const id = (y * size + x) * 4;
    img.data[id] = img.data[id + 1] = img.data[id + 2] = Math.max(105, Math.min(255, v)); img.data[id + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 180; i++) {
    const y = hash(i * 2.17) * size, x = hash(i * 5.91) * size, len = 8 + hash(i) * 34;
    g.strokeStyle = `rgba(72,54,34,${0.035 + hash(i + 4) * 0.07})`; g.lineWidth = 0.45 + hash(i + 2) * 0.65;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + (hash(i + 7) - 0.5) * 3); g.stroke();
  }
  for (let i = 0; i < 55; i++) {
    g.fillStyle = `rgba(92,70,42,${0.05 + hash(i) * 0.08})`;
    g.fillRect(hash(i * 3.3) * size, hash(i * 6.2) * size, 1 + hash(i) * 2.5, 1 + hash(i + 1) * 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2.5, 2.5);
  return tex;
}

const KEYS: CamKey[] = [
  { t: 80, pos: [0, 1.1, -1.5], look: [0, 0.85, 2], fov: 78, gait: 'creep' },
  { t: 81.5, pos: [0, 1.05, 0], look: [0, 0.8, 3], fov: 78, gait: 'creep' },
  { t: 84.5, pos: [0, 1.65, 1.8], look: [0, 1.35, 8], fov: 76, gait: 'walk' },
  { t: 87.8, pos: [0, 1.65, 4.0], look: [0, 0.95, 6.0], fov: 74, gait: 'walk' },
  { t: 90.5, pos: [0, 1.65, 5.0], look: [2.4, 2.8, 10], fov: 74, gait: 'still' },
  { t: 91.7, pos: [0.04, 1.24, 5.38], look: [0.03, 0.91, 6.02], fov: 58, gait: 'still' },
  { t: 92.7, pos: [0.08, 1.3, 5.42], look: [0.25, 1.0, 6.2], fov: 62, gait: 'still' },
  { t: 94.8, pos: [0, 1.65, 5.2], look: [0.95, 2.55, 1.3], fov: 64, gait: 'still' },
  { t: 97.0, pos: [0, 1.65, 4.5], look: [0, 2.8, 9.0], fov: 78, gait: 'run' },
  { t: 99.0, pos: [0, 1.65, 3.6], look: [0, 2.2, 9.5], fov: 82, gait: 'run' },
  { t: 101.5, pos: [0, 1.55, 7.0], look: [0, 1.0, 25], fov: 84, gait: 'run' },
  { t: 104.0, pos: [0, 1.25, 20.5], look: [0, 0.65, 26], fov: 88, gait: 'run', roll: 0.22 },
  { t: 105.0, pos: [0, 0.8, 24.5], look: [0, 0.5, 27], fov: 90, gait: 'run', roll: 0.35 },
];

export default class ThresholdZ4Library extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(76, 16 / 9, 0.04, 80);
  private flash!: ReturnType<typeof addFlashlight>;
  private leftStacks: THREE.Object3D[] = [];
  private rightStacks: THREE.Object3D[] = [];
  private ledgerPages: THREE.Mesh[] = [];
  private archivist!: THREE.Group;
  private archivistArms: THREE.Mesh[] = [];
  private faceMouth!: THREE.Mesh;
  private tenantShadow!: THREE.Mesh;
  private phone!: THREE.Group;
  private motes: THREE.Mesh[] = [];
  private gapGlow!: THREE.MeshStandardMaterial;
  private lamps: THREE.PointLight[] = [];
  private archivistLight!: THREE.PointLight;
  private moths: THREE.Group[] = [];
  private mothWings: THREE.Mesh[] = [];
  private ledgerLines: THREE.Mesh[] = [];

  private archivistAsset!: GLTFInstance;
  private libraryKit!: GLTFInstance;
  private paperProps!: GLTFInstance;

  override async init() {
    const resolved = resolveAsset('threshold/z4_archivist');
    this.archivistAsset = await GLTFManager.instantiate(resolved.url, { ...resolved.manifest.load, castShadow: true, receiveShadow: true });
    const kitResolved = resolveAsset('threshold/z4_library_kit');
    const propResolved = resolveAsset('threshold/z4_paper_prop_pack');
    this.libraryKit = await GLTFManager.instantiate(kitResolved.url, { ...kitResolved.manifest.load, castShadow: true, receiveShadow: true });
    this.paperProps = await GLTFManager.instantiate(propResolved.url, { ...propResolved.manifest.load, castShadow: true, receiveShadow: true });
    this.archivistAsset.root.position.set(1.15, 0.02, 2.35);
    this.archivistAsset.root.visible = false;
    this.s.add(this.archivistAsset.root);
    const archivistPaperTex = paperFiberTexture();
    const archivistMatCache = new Map<THREE.Material, THREE.Material>();
    this.archivistAsset.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const remapPaper = (m: THREE.Material) => {
        const hit = archivistMatCache.get(m); if (hit) return hit;
        const mm = m.clone() as THREE.MeshStandardMaterial;
        if (/paper|ivory|torn/.test(mm.name)) {
          mm.map = archivistPaperTex; mm.roughnessMap = archivistPaperTex; mm.bumpMap = archivistPaperTex; mm.bumpScale = 0.012;
          mm.roughness = Math.max(mm.roughness, 0.86);
          if (/greyed/.test(mm.name)) mm.color.multiplyScalar(0.82);
          if (/fresh_torn/.test(mm.name)) mm.color.multiplyScalar(1.05);
        }
        if (/book_spine_leather/.test(mm.name)) { mm.color.setHex(0x2b160b); mm.roughness = 0.78; }
        mm.needsUpdate = true; archivistMatCache.set(m, mm); return mm;
      };
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const mapped = mats.map(remapPaper);
      mesh.material = Array.isArray(mesh.material) ? mapped : mapped[0]!;
    });
    this.s.background = new THREE.Color(0x090806);
    this.s.fog = new THREE.FogExp2(0x241e14, 0.038);
    this.flash = addFlashlight(this.s);
    this.s.add(new THREE.AmbientLight(0x8b7a59, 0.48));
    const paper = mat(0xd8cdb1, 0.82); paper.name = 'library_ivory_paper';
    const paper2 = mat(0xb8ac8d, 0.9); paper2.name = 'library_compressed_paper_edge';
    const edge = mat(0x8c7c5d, 0.88); edge.name = 'library_dark_page_edge';
    const wood = mat(0x44301f, 0.7);
    const brass = mat(0x9c7a35, 0.3, 0.35, 0x392100, 0.15);
    const ink = mat(0x11100d, 0.9);

    box(this.s, 'z4_floor_pages', [8, 0.1, 35], [0, -0.05, 12], paper2);
    // low paper crawlspace ceiling at entry
    for (let i = 0; i < 9; i++) box(this.s, `z4_crawl_roof_${i}`, [3.8, 0.06, 0.42], [0, 1.28 + hash(i) * 0.04, -2.2 + i * 0.42], i % 2 ? paper : paper2, [0.03 * (hash(i) - 0.5), 0, 0.02 * (hash(i + 3) - 0.5)]);
    // canyon stacks: alternating shelves/ledger slabs, labels, bookmarks, loose pages
    for (const side of [-1, 1]) {
      for (let bay = 0; bay < 22; bay++) {
        const z = 0.5 + bay * 1.1;
        const g = new THREE.Group(); g.position.set(side * (2.45 + hash(bay) * 0.14), 0, z); g.name = `z4_stack_${side}_${bay}`; g.userData.fx_entity = g.name; this.s.add(g);
        const h = 5.8 + hash(bay * 2 + side) * 2.2;
        box(g, `z4_stack_body_${side}_${bay}`, [0.75, h, 0.9], [0, h / 2, 0], bay % 2 ? paper : paper2);
        for (let shelf = 0; shelf < 7; shelf++) {
          const y = 0.65 + shelf * 0.78;
          box(g, `z4_shelf_line_${side}_${bay}_${shelf}`, [0.78, 0.035, 0.94], [0, y, 0], edge);
          for (let b = 0; b < 4; b++) if (hash(bay * 31 + shelf * 7 + b) > 0.22) box(g, `z4_bookblock_${side}_${bay}_${shelf}_${b}`, [0.08 + hash(b) * 0.05, 0.46, 0.68], [-0.26 + b * 0.16, y + 0.26, 0.02], b % 2 ? paper : edge);
        }
        if (bay % 3 === 0) box(g, `z4_index_label_${side}_${bay}`, [0.03, 0.2, 0.38], [-side * 0.4, 2.2, 0], mat(0xe6d9a7, 0.7));
        if (bay % 5 === 0) box(g, `z4_bookmark_${side}_${bay}`, [0.025, 0.55, 0.09], [-side * 0.43, 3.1, 0.15], mat(0xa22d28, 0.7));
        (side < 0 ? this.leftStacks : this.rightStacks).push(g);
      }
    }
    // denser irregular canyon fill: protruding colored spines, slipped pages, labels and high rim separation.
    const spineCols = [mat(0x6d2e24, 0.82), mat(0x2d445e, 0.82), mat(0x6e6034, 0.86), mat(0x3c5736, 0.86)];
    for (const side of [-1, 1]) for (let i = 0; i < 70; i++) {
      const z = 0.4 + hash(i * 3.7 + side) * 24, y = 0.75 + hash(i * 5.1) * 5.1, x = side * (2.03 + hash(i) * 0.15);
      if (i % 4 === 0) box(this.s, `z4_protruding_spine_${side}_${i}`, [0.08 + hash(i) * 0.06, 0.34 + hash(i + 1) * 0.22, 0.08], [x, y, z], spineCols[i % 4]!, [0, (hash(i + 2) - 0.5) * 0.16, (hash(i + 3) - 0.5) * 0.12]);
      else plane(this.s, `z4_protruding_page_${side}_${i}`, 0.12 + hash(i) * 0.12, 0.2 + hash(i + 1) * 0.16, [x, y, z], i % 2 ? paper : paper2, [0, side < 0 ? Math.PI / 2 : -Math.PI / 2, (hash(i + 3) - 0.5) * 0.35]);
    }
    for (let i = 0; i < 34; i++) {
      plane(this.s, `z4_floor_litter_contact_${i}`, 0.16 + hash(i) * 0.2, 0.24 + hash(i + 2) * 0.18, [(hash(i * 2.3) - 0.5) * 3.2, 0.011, 8 + hash(i * 4.1) * 18], i % 2 ? paper : paper2, [-Math.PI / 2, 0, hash(i + 6) * 6]);
      plane(this.s, `z4_floor_contact_shadow_${i}`, 0.18 + hash(i) * 0.2, 0.25 + hash(i + 2) * 0.18, [(hash(i * 2.3) - 0.5) * 3.2, 0.006, 8 + hash(i * 4.1) * 18], basic(0x090604, 0.22), [-Math.PI / 2, 0, hash(i + 6) * 6]);
    }
    for (const side of [-1, 1]) {
      const rim = new THREE.PointLight(0xffd7a0, 0.75, 9, 2); rim.position.set(side * 1.8, 6.2, 15); this.s.add(rim);
    }

    // scattered paper drifts and loose sheets
    for (let i = 0; i < 55; i++) {
      const p = plane(this.s, `z4_loose_page_${i}`, 0.22 + hash(i) * 0.12, 0.3 + hash(i + 1) * 0.1, [(hash(i) - 0.5) * 4.2, 0.004 + hash(i + 2) * 0.012, -1 + hash(i + 3) * 25], i % 2 ? paper : paper2, [-Math.PI / 2 + (hash(i + 4) - 0.5) * 0.08, 0, hash(i + 5) * 6]);
      p.receiveShadow = true;
    }
    // librarian desk, self-writing ledger, lamps, bookmark flags
    box(this.s, 'z4_librarian_desk', [2.0, 0.12, 0.9], [0, 0.78, 6], wood);
    box(this.s, 'z4_desk_left', [0.14, 0.78, 0.75], [-0.85, 0.39, 6], wood);
    box(this.s, 'z4_desk_right', [0.14, 0.78, 0.75], [0.85, 0.39, 6], wood);
    box(this.s, 'z4_ledger_base', [0.72, 0.05, 0.5], [0, 0.88, 6], mat(0x4b2e1f, 0.65));
    for (let i = 0; i < 5; i++) {
      const p = plane(this.s, `z4_ledger_page_${i}`, 0.32, 0.45, [-0.16 + i * 0.08, 0.915 + i * 0.004, 6], paper, [-Math.PI / 2, 0, (i - 2) * 0.035]);
      this.ledgerPages.push(p);
    }
    this.archivistLight = new THREE.PointLight(0xffd7a0, 0, 6.5, 1.7);
    this.archivistLight.position.set(0, 2.8, 5.0);
    this.s.add(this.archivistLight);
    for (const x of [-0.7, 0.7]) {
      cyl(this.s, `z4_lamp_stem_${x}`, 0.025, 0.55, [x, 1.12, 5.75], brass);
      sph(this.s, `z4_lamp_shade_${x}`, 0.16, [x, 1.42, 5.75], mat(0x245c37, 0.35, 0.1, 0x1d5c31, 0.7), 18).scale.y = 0.55;
      const l = new THREE.PointLight(0xffd68a, 1.4, 5, 1.8); l.position.set(x, 1.35, 5.75); this.s.add(l); this.lamps.push(l);
    }
    // Diegetic ledger ink: each line exists only in the paper and appears at its storyboard cue.
    const inkLines = [
      ['step. step. step.', 84.0],
      ['it stopped.', 86.4],
      ['it is reading this.', 88.0],
      ['it is behind you.', 91.7],
    ] as const;
    inkLines.forEach(([txt], li) => {
      const c = document.createElement('canvas'); c.width = 768; c.height = 104;
      const g = c.getContext('2d')!; g.clearRect(0, 0, c.width, c.height);
      // transparent ink layer: no tape or label strip, only pigment absorbed by the page
      // Handwritten ink rather than placeholder rule marks: per-letter pressure, baseline wander,
      // and slight rotation remain deterministic while staying legible in the close scare frame.
      let x = 22;
      for (let ci = 0; ci < txt.length; ci++) {
        const ch = txt[ci]!;
        const seed = li * 131 + ci * 17;
        const size = 82 + (hash(seed) - 0.5) * 10;
        g.save();
        g.translate(x, 57 + (hash(seed + 1) - 0.5) * 7);
        g.rotate((hash(seed + 2) - 0.5) * 0.12);
        g.font = `italic ${size.toFixed(1)}px Georgia, serif`;
        g.textBaseline = 'middle';
        g.shadowColor = 'rgba(30,20,10,0.32)'; g.shadowBlur = 2.2;
        g.fillStyle = 'rgba(32,22,14,0.30)'; g.fillText(ch, 0.7, 0.6);
        g.shadowBlur = 0; g.fillStyle = ci % 5 === 0 ? '#120f0b' : '#1b1712';
        g.fillText(ch, 0, 0);
        const cw = g.measureText(ch).width;
        g.restore();
        x += Math.max(18, cw * 0.64) + (ch === ' ' ? 9 : 1.2);
      }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.repeat.set(-1, -1); tex.offset.set(1, 1);
      const mm = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 });
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.052), mm);
      line.position.set(0.18, 0.949 + li * 0.002, 5.86 + li * 0.072); line.rotation.x = -Math.PI / 2; line.userData.basePos = line.position.clone();
      line.rotation.z = (li - 1.5) * 0.012;
      line.name = line.userData.fx_entity = `z4_ledger_ink_line_${li}`; line.visible = false; this.s.add(line); this.ledgerLines.push(line);
    });

    // Folded paper moths around the lamp light; the first brown one is Lint's brief felt wrongness.
    for (let i = 0; i < 9; i++) {
      const moth = new THREE.Group();
      const brown = i === 0;
      const mm = brown ? mat(0x6b4a2e, 0.96) : mat(0xe9dfc5, 0.86);
      const wl = plane(moth, `z4_moth_wing_l_${i}`, 0.09, 0.055, [-0.035, 0, 0], mm, [0, 0, -0.3]);
      const wr = plane(moth, `z4_moth_wing_r_${i}`, 0.09, 0.055, [0.035, 0, 0], mm, [0, 0, 0.3]);
      box(moth, `z4_moth_body_${i}`, [0.018, 0.015, 0.065], [0, 0, 0], brown ? mat(0x3a2517, 0.95) : mat(0x8a7a5e, 0.9));
      moth.position.set((i % 2 ? 0.7 : -0.7) + (hash(i) - 0.5) * 0.25, 1.35 + hash(i + 2) * 0.35, 5.75 + (hash(i + 4) - 0.5) * 0.5);
      moth.userData.basePos = moth.position.clone(); moth.name = moth.userData.fx_entity = brown ? 'z4_lint_felt_moth' : `z4_paper_moth_${i}`;
      this.s.add(moth); this.moths.push(moth); this.mothWings.push(wl, wr);
    }

    // pre-reveal darkness anchor at 93.5: a dim fallen lantern and close paper silhouette keep the frame spatially readable.
    const lanternMat = mat(0xffc27a, 0.38, 0, 0xff9d45, 0.85);
    cyl(this.s, 'z4_fallen_lantern_body', 0.055, 0.12, [-0.62, 0.10, 6.95], lanternMat, [Math.PI / 2, 0, 0.3], 16);
    box(this.s, 'z4_fallen_lantern_handle', [0.10, 0.012, 0.018], [-0.62, 0.18, 6.95], brass, [0, 0, 0.3]);
    plane(this.s, 'z4_nearby_page_silhouette', 0.24, 0.34, [-0.42, 0.035, 6.65], paper2, [-Math.PI / 2, 0, -0.35]);
    const fallenLight = new THREE.PointLight(0xffa45e, 0.55, 3.2, 2); fallenLight.position.set(-0.62, 0.28, 6.95); this.s.add(fallenLight);

    // folded phone on lectern
    box(this.s, 'z4_lectern', [0.55, 1.0, 0.45], [0.8, 0.5, 7.0], wood, [0, -0.25, 0]);
    this.phone = new THREE.Group(); this.phone.position.set(0.8, 1.08, 7.0); this.phone.rotation.y = -0.25; this.s.add(this.phone);
    box(this.phone, 'z4_phone_fold_l', [0.2, 0.025, 0.32], [-0.08, 0, 0], paper, [0, 0, -0.35]);
    box(this.phone, 'z4_phone_fold_r', [0.2, 0.025, 0.32], [0.08, 0, 0], paper, [0, 0, 0.35]);
    for (let i = 0; i < 9; i++) box(this.phone, `z4_phone_key_${i}`, [0.025, 0.01, 0.02], [-0.08 + (i % 3) * 0.04, 0.025, -0.07 + Math.floor(i / 3) * 0.05], ink);
    // distant card catalog/chairs/ladder/book cart
    box(this.s, 'z4_card_catalog', [1.7, 1.3, 0.5], [-1.4, 0.65, 13.5], wood);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 4; y++) box(this.s, `z4_catalog_drawer_${x}_${y}`, [0.26, 0.22, 0.035], [-2.0 + x * 0.3, 0.35 + y * 0.25, 13.24], paper2);
    box(this.s, 'z4_book_cart', [0.65, 0.8, 0.5], [1.7, 0.4, 11.5], brass, [0, 0.2, 0]);
    cyl(this.s, 'z4_ladder_side_l', 0.025, 4.5, [-2.0, 2.2, 16.5], wood, [0.25, 0, 0], 10);
    cyl(this.s, 'z4_ladder_side_r', 0.025, 4.5, [-1.5, 2.2, 16.5], wood, [0.25, 0, 0], 10);
    for (let i = 0; i < 9; i++) cyl(this.s, `z4_ladder_rung_${i}`, 0.018, 0.52, [-1.75, 0.5 + i * 0.42, 16.45 - i * 0.05], wood, [0, 0, Math.PI / 2], 8);
    // Tenant shadow on right paper wall
    this.tenantShadow = plane(this.s, 'z4_tenant_shadow', 0.8, 3.8, [2.03, 2.25, 10], basic(0x090604, 0.5), [0, -Math.PI / 2, 0]);
    this.tenantShadow.visible = false;
    // exit gap and distant neon preview
    this.gapGlow = mat(0xfef6dc, 0.2, 0, 0xfff1ac, 4) as THREE.MeshStandardMaterial;
    box(this.s, 'z4_exit_gap_glow', [1.0, 2.0, 0.04], [0, 1.0, 25.5], this.gapGlow);
    box(this.s, 'z4_neon_preview', [0.08, 0.7, 0.035], [0.15, 1.7, 25.45], mat(0xff356e, 0.2, 0, 0xff2d74, 4));

    // Modular Blender library architecture and paper props replace the primitive repeating/desk dressing.
    this.s.traverse((o) => {
      if (/^z4_(stack_body|shelf_line|bookblock|index_label|bookmark|librarian_desk|desk_left|desk_right|ledger_base|ledger_page|lamp_stem|lamp_shade|card_catalog|catalog_drawer|ladder_side|ladder_rung)/.test(o.name)) o.visible = false;
    });
    this.phone.visible = false;
    for (const side of [-1, 1]) {
      for (let bay = 0; bay < 22; bay++) {
        const z = 0.5 + bay * 1.1;
        const bayAsset = this.cloneProp(this.libraryKit, 'paper_stack_bay_root', [side * (2.45 + hash(bay) * 0.14), 0, z], side < 0 ? 0 : Math.PI, 1, `z4_stack_bay_asset_${side}_${bay}`);
        if (bayAsset) (side < 0 ? this.leftStacks : this.rightStacks).push(bayAsset);
      }
    }
    this.cloneProp(this.libraryKit, 'reading_desk_root', [0, 0, 6], 0, 1, 'z4_reading_desk_asset');
    this.cloneProp(this.paperProps, 'open_ledger_root', [0, 0.845, 6], 0, 1, 'z4_open_ledger_asset');
    const ledgerSpine = this.s.getObjectByName('ledger_spine') as THREE.Mesh | undefined;
    if (ledgerSpine) {
      ledgerSpine.scale.x *= 0.46;
      const lm = (ledgerSpine.material as THREE.MeshStandardMaterial).clone();
      ledgerSpine.material = lm;
      lm.color.lerp(new THREE.Color(0xd8cdb5), 0.55); lm.roughness = 0.9;
    }
    this.cloneProp(this.paperProps, 'fountain_pen_root', [0.34, 0.91, 5.78], -0.35, 1, 'z4_fountain_pen_asset');
    this.cloneProp(this.paperProps, 'ink_bottle_root', [-0.38, 0.82, 5.78], 0, 1, 'z4_ink_bottle_asset');
    this.cloneProp(this.paperProps, 'reading_glasses_root', [0.46, 0.91, 6.18], 0.35, 1, 'z4_glasses_asset');
    // close-range mechanical cues on desk props: pen nib/cap bands, inkwell rim, glasses hinges.
    cyl(this.s, 'z4_pen_gold_cap_band', 0.026, 0.018, [0.30, 0.927, 5.76], brass, [Math.PI / 2, 0, -0.35], 20);
    cyl(this.s, 'z4_pen_nib', 0.018, 0.065, [0.43, 0.925, 5.70], mat(0xc6a14a, 0.28, 0.75), [Math.PI / 2, 0, -0.35], 4);
    const inkRim = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 8, 24), brass); inkRim.position.set(0.58, 0.955, 5.83); inkRim.rotation.x = Math.PI / 2; inkRim.name = inkRim.userData.fx_entity = 'z4_inkwell_brass_rim'; this.s.add(inkRim);
    for (const x of [0.36, 0.56]) box(this.s, `z4_glasses_hinge_${x}`, [0.018, 0.028, 0.018], [x, 0.945, 6.17], brass);
    this.cloneProp(this.paperProps, 'scissors_root', [-0.52, 0.9, 6.12], -0.8, 1, 'z4_scissors_asset');
    for (const x of [-0.7, 0.7]) this.cloneProp(this.paperProps, 'bankers_lamp_root', [x, 0.79, 5.75], 0, 1, `z4_bankers_lamp_asset_${x}`);
    this.cloneProp(this.paperProps, 'folded_paper_phone_root', [0.8, 1.08, 7.0], -0.25, 1, 'z4_folded_phone_asset');
    this.cloneProp(this.paperProps, 'card_catalog_drawer_root', [-1.4, 0, 13.5], 0, 2.1, 'z4_card_catalog_asset');
    this.cloneProp(this.paperProps, 'paper_globe_root', [1.6, 0, 12.2], -0.3, 1, 'z4_globe_asset');
    this.cloneProp(this.paperProps, 'tied_scroll_root', [1.55, 0.82, 6.2], 0.7, 1, 'z4_scroll_asset');
    this.cloneProp(this.paperProps, 'library_chair_root', [-0.75, 0, 6.8], 0.2, 1, 'z4_chair_asset_l');
    this.cloneProp(this.paperProps, 'library_chair_root', [1.25, 0, 8.9], -0.55, 1, 'z4_chair_asset_r');
    for (let i = 0; i < 8; i++) this.cloneProp(this.paperProps, 'paper_vine_root', [(i % 2 ? -2.05 : 2.05), 1.2 + hash(i) * 2.8, 2.2 + i * 2.4], i % 2 ? Math.PI / 2 : -Math.PI / 2, 1, `z4_vine_asset_${i}`);
    this.cloneProp(this.libraryKit, 'library_ladder_root', [-1.75, 0, 16.5], 0.08, 1, 'z4_ladder_asset');
    for (let i = 0; i < 4; i++) this.cloneProp(this.libraryKit, 'hanging_lantern_root', [(i % 2 ? 1.4 : -1.4), 2.9, 4 + i * 5.2], 0, 1, `z4_lantern_asset_${i}`);
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffcf88, 0.85, 7.5, 1.6);
      l.position.set(i % 2 ? 1.4 : -1.4, 3.25, 4 + i * 5.2);
      this.s.add(l);
    }
    this.cloneProp(this.libraryKit, 'spiral_paper_stair_root', [1.65, 0, 19.5], -0.3, 1, 'z4_spiral_stair_asset');
    for (let i = 0; i < 5; i++) this.cloneProp(this.libraryKit, 'hinged_stack_wall_root', [i % 2 ? -2.1 : 2.1, 0, 9 + i * 2.5], i % 2 ? 0.15 : -0.15, 1, `z4_hinged_wall_asset_${i}`);
    for (let i = 0; i < 7; i++) this.cloneProp(this.paperProps, 'letters_string_root', [(i % 2 ? -1.9 : 1.9), 2.4 + hash(i) * 0.8, 3 + i * 2.8], i % 2 ? Math.PI / 2 : -Math.PI / 2, 1, `z4_letters_asset_${i}`);
    for (let i = 0; i < 5; i++) this.cloneProp(this.paperProps, 'paper_clock_root', [(i % 2 ? -2.0 : 2.0), 2.0 + hash(i) * 1.2, 5 + i * 3.7], i % 2 ? Math.PI / 2 : -Math.PI / 2, 0.8, `z4_paper_clock_asset_${i}`);

    // dust/lint motes hanging in flashlight shafts
    for (let i = 0; i < 80; i++) {
      const m = sph(this.s, `z4_mote_${i}`, 0.006 + hash(i) * 0.008, [(hash(i) - 0.5) * 4, 0.4 + hash(i + 1) * 4.5, hash(i + 2) * 22], basic(0xfff2c7, 0.45), 6);
      m.userData.basePos = m.position.clone(); this.motes.push(m);
    }

    // All library-kit and paper-prop clones share the same close-range fibre/roughness treatment,
    // so paper reads fibrous and compressed rather than smooth plastic or fondant.
    const libraryPaperSeen = new Set<THREE.Material>();
    this.s.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const mm = m as THREE.MeshStandardMaterial;
        if (libraryPaperSeen.has(mm) || !/paper|page|ivory|compressed|card|scroll|letter|ledger/i.test(mm.name)) return;
        libraryPaperSeen.add(mm);
        mm.map = archivistPaperTex; mm.roughnessMap = archivistPaperTex; mm.bumpMap = archivistPaperTex; mm.bumpScale = 0.016;
        mm.roughness = Math.max(mm.roughness, 0.84); mm.color.multiplyScalar(0.93); mm.needsUpdate = true;
      });
    });

    // Archivist: folded-paper silhouette high in canyon, fanned torso pages, accordion arms
    this.archivist = new THREE.Group(); this.archivist.position.set(1.15, 2.0, 1.35); this.archivist.visible = false; this.s.add(this.archivist);
    for (let i = 0; i < 12; i++) {
      const pg = box(this.archivist, `z4_archivist_torso_page_${i}`, [0.52, 1.55, 0.025], [(i - 5.5) * 0.012, 0.8 + i * 0.015, -0.018 * i], i % 2 ? paper : paper2, [0, (i - 5.5) * 0.12, (i - 5.5) * 0.018]);
      pg.scale.x = 1 - Math.abs(i - 5.5) * 0.035;
    }
    plane(this.archivist, 'z4_archivist_blank_face', 0.62, 0.82, [0, 1.78, 0.02], mat(0xd8caa2, 0.68, 0, 0x2a1d10, 0.08), [0, 0, 0]);
    box(this.archivist, 'z4_archivist_face_edge_l', [0.035, 0.88, 0.025], [-0.34, 1.78, -0.025], mat(0x352719, 0.82));
    box(this.archivist, 'z4_archivist_face_edge_r', [0.035, 0.88, 0.025], [0.34, 1.78, -0.025], mat(0x352719, 0.82));
    box(this.archivist, 'z4_archivist_brow_fold', [0.68, 0.04, 0.03], [0, 2.18, -0.02], mat(0x352719, 0.82));
    this.faceMouth = box(this.archivist, 'z4_archivist_mouth_crease', [0.42, 0.022, 0.025], [0, 1.62, 0.065], ink);
    // long vertical anatomy: spine/book roll, hanging waist and folded paper legs, so the proxy reads as a tall librarian rather than a sign
    cyl(this.archivist, 'z4_archivist_spine_roll', 0.075, 1.65, [0, 0.72, -0.08], mat(0x3b2c1e, 0.72), [0, 0, 0], 18);
    box(this.archivist, 'z4_archivist_waist_roll', [0.62, 0.2, 0.22], [0, 0.02, 0], paper2, [0, 0, 0.05]);
    for (const side of [-1, 1]) {
      for (let l = 0; l < 4; l++) {
        box(this.archivist, `z4_archivist_leg_strip_${side}_${l}`, [0.07, 1.05 - l * 0.08, 0.035], [side * (0.13 + l * 0.055), -0.58 - l * 0.04, -0.03 + l * 0.035], l % 2 ? paper : paper2, [0.05 * side, 0, side * (0.08 + l * 0.04)]);
      }
    }
    for (const side of [-1, 1]) {
      for (let j = 0; j < 5; j++) {
        const zig = (j % 2 ? -1 : 1);
        const a = box(this.archivist, `z4_archivist_arm_${side}_${j}`, [0.68, 0.045, 0.09], [side * (0.52 + j * 0.42), 1.18 - j * 0.06, -0.02 + zig * 0.05], j % 2 ? paper : paper2, [zig * 0.18, side * zig * 0.28, side * (0.34 - j * 0.05)]);
        this.archivistArms.push(a);
      }
      // forward party-blower reach toward the viewer/camera (+Z in local asset space)
      for (let j = 0; j < 6; j++) {
        const zig = (j % 2 ? -1 : 1);
        const r = box(this.archivist, `z4_archivist_reach_${side}_${j}`, [0.08, 0.04, 0.62], [side * (0.42 + zig * 0.08), 1.05 - j * 0.025, 0.34 + j * 0.42], j % 2 ? paper2 : paper, [0, zig * 0.16, 0]);
        this.archivistArms.push(r);
      }
      for (let fi = 0; fi < 5; fi++) box(this.archivist, `z4_archivist_finger_${side}_${fi}`, [0.035, 0.025, 0.38], [side * (0.48 - fi * 0.04), 0.88 - fi * 0.025, 2.85 + fi * 0.03], paper, [0.25, side * 0.15, 0]);
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
    this.s.add(c);
    return c;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    applyFpCamera(this.cam, KEYS, t, out.width / out.height);
    const archivistBeam = 1 - 0.68 * smooth(94.0, 94.8, t) * (1 - smooth(99.0, 100.0, t));
    updateFlashlight(this.flash.light, this.flash.target, this.cam, t, 0.45 * archivistBeam, t > 98 ? 0.22 : 0.04);
    // motes hang and drift deterministically
    this.motes.forEach((m, i) => {
      const bp = m.userData.basePos as THREE.Vector3;
      m.position.y = bp.y + Math.sin(t * 0.35 + i) * 0.055;
      m.position.x = bp.x + Math.cos(t * 0.27 + i * 2) * 0.04;
    });
    this.ledgerLines.forEach((l, i) => {
      l.visible = t > ([84.0, 86.4, 88.0, 91.65][i] ?? 99);
      const u = smooth(86 + i * 0.6, 86.8 + i * 0.6, t);
      const bp = l.userData.basePos as THREE.Vector3;
      l.position.set(bp.x - u * 0.012, bp.y + u * 0.018, bp.z);
      l.rotation.x = -Math.PI / 2 + u * 0.16;
      l.rotation.z = (i - 1.5) * 0.012 + u * 0.18;
    });
    this.moths.forEach((m, i) => {
      const bp = m.userData.basePos as THREE.Vector3;
      const active = i === 0 ? (t > 80.4 && t < 82.2) : t < 94;
      m.visible = active;
      m.position.set(bp.x + Math.sin(t * 1.1 + i) * 0.12, bp.y + Math.sin(t * 1.7 + i * 2) * 0.07, bp.z + Math.cos(t * 0.9 + i) * 0.1);
      m.rotation.y = t * 0.35 + i;
      const wl = this.mothWings[i * 2], wr = this.mothWings[i * 2 + 1];
      const flap = Math.sin(t * 10 + i) * 0.55;
      if (wl) wl.rotation.z = -0.3 - flap;
      if (wr) wr.rotation.z = 0.3 + flap;
    });
    // ledger writes itself: pages lift one by one, ink lines emerge as thin dark strips
    this.ledgerPages.forEach((p, i) => {
      const u = smooth(86 + i * 0.6, 86.8 + i * 0.6, t);
      p.rotation.x = -Math.PI / 2 + u * 0.16;
      p.rotation.z = (i - 2) * 0.035 + u * 0.18;
    });
    // lamps buzz and one gutters
    this.lamps.forEach((l, i) => { l.intensity = 1.4 * (hash(Math.floor(t * 10) + i * 20) < (i ? 0.16 : 0.04) ? 0.25 : 1); });
    // tenant shadow slides across right wall
    this.tenantShadow.visible = t > 89.7 && t < 91.6;
    if (this.tenantShadow.visible) this.tenantShadow.position.z = 8.8 + (t - 89.7) * 1.4;
    // folded phone rings/pages flutter
    const ring = t > 91.8 && t < 93.2 ? Math.sin(t * 48) * 0.01 : 0;
    this.phone.position.y = 1.08 + Math.abs(ring);
    this.phone.rotation.z = ring * 1.8;
    // archivist reveal, page fan and arms extension
    this.archivist.visible = false;
    const reveal = smooth(94.2, 95.4, t);
    this.archivistLight.intensity = 2.1 * reveal * (1 - smooth(98.0, 99.0, t));
    this.archivistAsset.root.visible = t > 94.2;
    this.archivistAsset.root.scale.setScalar(0.64 + reveal * 0.52);
    // Repeated topple/unfold locomotion: the body pitches forward, collapses onto a new base,
    // then rights itself in stepped 1.2 s cycles while pursuing down the canyon.
    const chase = smooth(95.45, 96.05, t);
    const cycleLen = 1.2;
    const lu = Math.max(0, (t - 95.5) / cycleLen);
    const cycle = Math.floor(lu);
    const phase = lu - cycle;
    const stepInCycle = smooth(0.42, 0.82, phase);
    const travelSteps = Math.min(7, cycle + stepInCycle);
    const topple = (smooth(0.02, 0.30, phase) * (1 - smooth(0.38, 0.76, phase))) * chase;
    this.archivistAsset.root.position.x = 1.15 - chase * 0.55;
    this.archivistAsset.root.position.z = 2.35 + travelSteps * 3.9 * chase;
    this.archivistAsset.root.position.y = 0.02 + (1 - reveal) * 0.45 + topple * 0.10;
    this.archivistAsset.root.rotation.x = topple * 0.42;
    // As it passes the viewer it twists its whole upper body back toward the camera.
    // Keeping the face visible through the pass-over preserves creature readability instead
    // of letting the closest frame collapse into anonymous paper planes.
    const passTurn = smooth(96.05, 96.75, t);
    this.archivistAsset.root.rotation.y = -0.08 + reveal * 0.08 + passTurn * Math.PI;
    const mouth = this.archivistAsset.part('mouth_crease_main');
    if (mouth) mouth.scale.x = 0.25 + smooth(95.0, 96.0, t) * 1.4;
    for (const [pid, sign] of [['arm_l_root', -1], ['arm_r_root', 1]] as const) {
      const arm = this.archivistAsset.part(pid);
      if (arm) {
        arm.scale.x = 0.72 + reveal * 0.34;
        arm.rotation.z = sign * (0.06 + Math.sin(t * 0.9) * 0.018) * reveal;
        arm.rotation.y = sign * Math.sin(t * 0.55 + sign) * 0.035 * reveal;
      }
      // Segment-by-segment accordion extension keeps the paper hinges visible instead of
      // reading as a uniformly scaled rubber tube. Base transforms are captured once and
      // all per-frame transforms remain absolute functions of t.
      for (let ai = 1; ai <= 12; ai++) {
        const panel = this.archivistAsset.part(`arm_${pid.includes('_l_') ? 'l' : 'r'}_accordion_panel_${String(ai).padStart(2, '0')}`);
        if (!panel) continue;
        if (!panel.userData.basePos) {
          panel.userData.basePos = panel.position.clone();
          panel.userData.baseScale = panel.scale.clone();
          panel.userData.baseRotZ = panel.rotation.z;
        }
        const bp = panel.userData.basePos as THREE.Vector3;
        const bs = panel.userData.baseScale as THREE.Vector3;
        const unfold = reveal * (0.62 + 0.38 * smooth(95.2, 96.2, t));
        const ripple = Math.sin(t * 4.6 - ai * 0.72 + sign) * 0.055 * unfold;
        const stage = 0.88 + unfold * 0.22 + ai * 0.006 * unfold;
        panel.position.x = bp.x * stage;
        panel.position.y = bp.y + Math.sin(ai * 0.82 + sign) * 0.026 * unfold - ai * 0.0045 * unfold;
        panel.position.z = (panel.userData.basePos as THREE.Vector3).z + Math.cos(ai * 0.63 - sign) * 0.018 * unfold;
        panel.scale.x = bs.x * (0.88 + unfold * 0.20 + ripple);
        panel.scale.y = bs.y * (1.0 + unfold * 0.10);
        panel.rotation.z = (panel.userData.baseRotZ as number) + sign * ripple * 0.55;
      }
    }
    for (let pi = 1; pi <= 12; pi++) {
      const pg = this.archivistAsset.part(`torso_pages_${String(pi).padStart(2, '0')}`) ?? this.archivistAsset.part(`torso_page_${String(pi).padStart(2, '0')}`);
      if (pg) {
        if (!pg.userData.baseRotY) pg.userData.baseRotY = pg.rotation.y;
        pg.rotation.y = (pg.userData.baseRotY as number) + Math.sin(t * 0.55 + pi) * 0.035 * reveal;
      }
    }
    this.faceMouth.scale.x = 0.2 + smooth(95.0, 96.0, t) * 1.2;
    this.archivistArms.forEach((a, i) => { const ext = 0.5 + reveal * (0.9 + (i % 5) * 0.08); if (a.name.includes('_reach_')) a.scale.z = ext; else a.scale.x = ext; });
    // canyon closes like a book after 99
    const close = smooth(97.0, 103.7, t);
    const closeCurve = close;
    this.leftStacks.forEach((g) => {
      if (g.userData.baseX === undefined) { g.userData.baseX = g.position.x; g.userData.baseRotY = g.rotation.y; }
      g.position.x = (g.userData.baseX as number) + closeCurve * 1.45;
      g.rotation.y = (g.userData.baseRotY as number) + closeCurve * 0.18;
    });
    this.rightStacks.forEach((g) => {
      if (g.userData.baseX === undefined) { g.userData.baseX = g.position.x; g.userData.baseRotY = g.rotation.y; }
      g.position.x = (g.userData.baseX as number) - closeCurve * 1.45;
      g.rotation.y = (g.userData.baseRotY as number) - closeCurve * 0.18;
    });
    this.gapGlow.emissiveIntensity = 4 + smooth(99, 104, t) * 7;

    const endBlack = smooth(104.55, 105.0, t);
    const gl = this.ctx.renderer;
    gl.setRenderTarget(out); gl.setClearColor(0x090806, 1); gl.clear(true, true, true); gl.render(this.s, this.cam); gl.resetState();
    return {
      ...thresholdPost(t, { darkness: 0.66, exposure: 1.0, stress: t > 94 ? 0.42 : 0.08, fade: endBlack }),
      flash: 1 - smooth(80, 81.0, t),
      shake: t > 99 ? [1.1 * Math.sin(t * 33), 0.8 * Math.cos(t * 29)] : [0, 0],
    };
  }
  override dispose() { disposeTree(this.s); }
}
