// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Z4 paper library: deterministic grey-box beat blockout with real scale/camera path; local rig is W2 scaffolding pending W1's shared kit.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { addFlashlight, applyFpCamera, basic, box, clamp, cyl, disposeTree, hash, mat, plane, smooth, sph, updateFlashlight, type CamKey } from './z1_fp_local';

const KEYS: CamKey[] = [
  { t: 80, pos: [0, 1.1, -1.5], look: [0, 0.85, 2], fov: 78, gait: 'creep' },
  { t: 81.5, pos: [0, 1.05, 0], look: [0, 0.8, 3], fov: 78, gait: 'creep' },
  { t: 84.5, pos: [0, 1.65, 1.8], look: [0, 1.35, 8], fov: 76, gait: 'walk' },
  { t: 87.8, pos: [0, 1.65, 4.0], look: [0, 0.95, 6.0], fov: 74, gait: 'walk' },
  { t: 90.5, pos: [0, 1.65, 5.0], look: [2.4, 2.8, 10], fov: 74, gait: 'still' },
  { t: 92.7, pos: [0, 1.65, 5.2], look: [0.8, 1.0, 7.0], fov: 74, gait: 'still' },
  { t: 94.8, pos: [0, 1.65, 5.2], look: [0, 4.5, 9.0], fov: 76, gait: 'still' },
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

  override init() {
    this.s.background = new THREE.Color(0x090806);
    this.s.fog = new THREE.FogExp2(0x211c13, 0.055);
    this.flash = addFlashlight(this.s);
    this.s.add(new THREE.AmbientLight(0x6b5f47, 0.28));
    const paper = mat(0xd8cdb1, 0.82);
    const paper2 = mat(0xb8ac8d, 0.9);
    const edge = mat(0x8c7c5d, 0.88);
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
    // scattered paper drifts and loose sheets
    for (let i = 0; i < 55; i++) {
      const p = plane(this.s, `z4_loose_page_${i}`, 0.22 + hash(i) * 0.12, 0.3 + hash(i + 1) * 0.1, [(hash(i) - 0.5) * 4.2, 0.012 + hash(i + 2) * 0.05, -1 + hash(i + 3) * 25], i % 2 ? paper : paper2, [-Math.PI / 2 + (hash(i + 4) - 0.5) * 0.25, 0, hash(i + 5) * 6]);
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
    for (const x of [-0.7, 0.7]) {
      cyl(this.s, `z4_lamp_stem_${x}`, 0.025, 0.55, [x, 1.12, 5.75], brass);
      sph(this.s, `z4_lamp_shade_${x}`, 0.16, [x, 1.42, 5.75], mat(0x245c37, 0.35, 0.1, 0x1d5c31, 0.7), 18).scale.y = 0.55;
      const l = new THREE.PointLight(0xffd68a, 1.4, 5, 1.8); l.position.set(x, 1.35, 5.75); this.s.add(l); this.lamps.push(l);
    }
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

    // dust/lint motes hanging in flashlight shafts
    for (let i = 0; i < 80; i++) {
      const m = sph(this.s, `z4_mote_${i}`, 0.006 + hash(i) * 0.008, [(hash(i) - 0.5) * 4, 0.4 + hash(i + 1) * 4.5, hash(i + 2) * 22], basic(0xfff2c7, 0.45), 6);
      this.motes.push(m);
    }

    // Archivist: folded-paper silhouette high in canyon, fanned torso pages, accordion arms
    this.archivist = new THREE.Group(); this.archivist.position.set(0, 2.7, 9.0); this.archivist.visible = false; this.s.add(this.archivist);
    for (let i = 0; i < 12; i++) {
      const pg = box(this.archivist, `z4_archivist_torso_page_${i}`, [0.65, 1.55, 0.025], [0, 0.8 + i * 0.015, 0], paper, [0, (i - 5.5) * 0.06, (i - 5.5) * 0.025]);
      pg.scale.x = 1 - Math.abs(i - 5.5) * 0.035;
    }
    plane(this.archivist, 'z4_archivist_blank_face', 0.56, 0.75, [0, 1.75, 0.02], paper, [0, 0, 0]);
    this.faceMouth = box(this.archivist, 'z4_archivist_mouth_crease', [0.34, 0.018, 0.02], [0, 1.62, 0.06], ink);
    for (const side of [-1, 1]) {
      for (let j = 0; j < 5; j++) {
        const a = box(this.archivist, `z4_archivist_arm_${side}_${j}`, [0.48, 0.045, 0.09], [side * (0.45 + j * 0.34), 1.1 - j * 0.08, 0], paper2, [0, 0, side * (0.12 + j * 0.07)]);
        this.archivistArms.push(a);
      }
      for (let fi = 0; fi < 5; fi++) box(this.archivist, `z4_archivist_finger_${side}_${fi}`, [0.04, 0.025, 0.34], [side * 2.05, 0.74 - fi * 0.015, -0.12 + fi * 0.06], paper, [0, side * 0.15, 0]);
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    applyFpCamera(this.cam, KEYS, t, out.width / out.height);
    updateFlashlight(this.flash.light, this.flash.target, this.cam, t, t > 96 ? 0.5 : 0.7, t > 98 ? 0.22 : 0.04);
    // motes hang and drift deterministically
    this.motes.forEach((m, i) => { m.position.y += Math.sin(t * 0.35 + i) * 0.0008; m.position.x += Math.cos(t * 0.27 + i * 2) * 0.0005; });
    // ledger writes itself: pages lift one by one, ink lines emerge as thin dark strips
    this.ledgerPages.forEach((p, i) => {
      const u = smooth(86 + i * 0.6, 86.8 + i * 0.6, t);
      p.rotation.z = (i - 2) * 0.035 + u * 0.65;
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
    this.archivist.visible = t > 94.2;
    const reveal = smooth(94.2, 95.4, t);
    this.archivist.scale.setScalar(0.45 + reveal * 0.55);
    this.archivist.position.y = 2.2 + reveal * 0.55;
    this.faceMouth.scale.x = 0.2 + smooth(95.0, 96.0, t) * 1.2;
    this.archivistArms.forEach((a, i) => { a.scale.x = 0.5 + reveal * (0.9 + (i % 5) * 0.08); });
    // canyon closes like a book after 99
    const close = smooth(97.0, 103.7, t);
    const closeCurve = close;
    this.leftStacks.forEach((g) => { g.position.x = -2.45 + closeCurve * 1.45; g.rotation.y = closeCurve * 0.18; });
    this.rightStacks.forEach((g) => { g.position.x = 2.45 - closeCurve * 1.45; g.rotation.y = -closeCurve * 0.18; });
    this.gapGlow.emissiveIntensity = 4 + smooth(99, 104, t) * 7;

    const endBlack = smooth(104.55, 105.0, t);
    const gl = this.ctx.renderer;
    gl.setRenderTarget(out); gl.setClearColor(0x090806, 1); gl.clear(true, true, true); gl.render(this.s, this.cam); gl.resetState();
    return {
      flash: 1 - smooth(80, 81.0, t),
      fade: endBlack,
      exposure: 0.86,
      bloom: 0.18,
      bloomThreshold: 0.88,
      vignette: 0.28 + close * 0.12,
      grain: 0.04,
      ca: 0.1,
      shake: t > 99 ? [1.1 * Math.sin(t * 33), 0.8 * Math.cos(t * 29)] : [0, 0],
    };
  }
  override dispose() { disposeTree(this.s); }
}
