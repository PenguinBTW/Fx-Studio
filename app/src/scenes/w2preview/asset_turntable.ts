// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// W2 asset review turntable harness for neutral close/mid/far flashlight and silhouette evidence.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { FlashlightRig, beamStateAt } from '../threshold/flashlight';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { FPPose } from '../threshold/fp_cam';

const TARGET_H: Record<string, number> = {
  z1_ceiling_breather: 1.1,
  z2_pit_swimmer: 1.25,
  z3_mirrorling: 2.6,
  z4_archivist: 3.4,
};

export default class W2AssetTurntable extends Scene {
  private s = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(42, 16 / 9, 0.03, 80);
  private asset!: GLTFInstance;
  private display!: THREE.Object3D;
  private flash = new FlashlightRig();
  private assetId = 'z1_ceiling_breather';
  private targetH = 1.2;
  private maxDim = 2;
  private centreY = 1;
  private silhouette = false;
  private envReady = false;
  private closeCenter = new THREE.Vector3();
  private closeDist = 2;

  override async init() {
    this.assetId = String(this.ctx.params.asset ?? 'z1_ceiling_breather');
    this.targetH = TARGET_H[this.assetId] ?? 2;
    const a = resolveAsset(`threshold/${this.assetId}`);
    this.asset = await GLTFManager.instantiate(a.url, { ...a.manifest.load, castShadow: true, receiveShadow: true });
    const partId = this.ctx.params.part ? String(this.ctx.params.part) : '';
    this.display = partId ? (skeletonClone(this.asset.part(partId) ?? this.asset.root)) : this.asset.root;
    if (partId) this.display.position.set(0, 0, 0);
    const box = new THREE.Box3().setFromObject(this.display);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const scale = partId ? 1 : this.targetH / Math.max(0.001, size.y);
    (this.display as THREE.Group).scale.setScalar(scale);
    this.display.position.set(-centre.x * scale, -box.min.y * scale + 0.02, -centre.z * scale);
    this.s.add(this.display);
    this.display.updateMatrixWorld(true);
    const placed = new THREE.Box3().setFromObject(this.display);
    const placedCentre = placed.getCenter(new THREE.Vector3());
    const placedSize = placed.getSize(new THREE.Vector3());
    this.maxDim = Math.max(placedSize.x, placedSize.y, placedSize.z);
    this.centreY = placedCentre.y;
    this.closeCenter.set(0, this.centreY, 0);
    this.closeDist = Math.max(1.6, this.maxDim * 0.52);
    const closePartName = this.assetId === 'z2_pit_swimmer' ? 'mouth_cavity'
      : this.assetId === 'z3_mirrorling' ? 'head_teardrop_cranium'
      : this.assetId === 'z4_archivist' ? 'blank_face_page'
      : 'eye_l';
    const closePart = this.asset.part(closePartName);
    if (closePart) {
      const cb = new THREE.Box3().setFromObject(closePart);
      if (!cb.isEmpty()) {
        this.closeCenter.copy(cb.getCenter(new THREE.Vector3()));
        const cs = cb.getSize(new THREE.Vector3());
        this.closeDist = Math.max(this.closeDist, Math.max(cs.x, cs.y, cs.z) * 3.2);
      }
    }
    if (this.assetId === 'z2_pit_swimmer') { this.closeDist = 2.12; this.closeCenter.y += 0.08; }
    if (this.assetId === 'z3_mirrorling') { this.closeDist = 2.0; this.closeCenter.y -= 0.42; }
    if (this.assetId === 'z4_archivist') { this.closeDist = 2.75; this.closeCenter.y -= 0.48; }
    if (this.assetId === 'z1_ceiling_breather') { this.closeDist = 2.35; this.closeCenter.y -= 0.22; }

    const floorMat = new THREE.MeshStandardMaterial({ color: 0x171817, roughness: 0.78, metalness: 0.02 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = floor.userData.fx_entity = 'turntable.floor'; this.s.add(floor);
    const grid = new THREE.GridHelper(12, 24, 0x353b38, 0x242927);
    grid.name = grid.userData.fx_entity = 'turntable.grid';
    grid.position.y = 0.004; this.s.add(grid);

    // 1.8m scale capsule at the side, half-lit enough to remain a human reference.
    const capMat = new THREE.MeshStandardMaterial({ color: 0x7d7667, roughness: 0.55 });
    const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 1.42, 8, 16), capMat);
    cap.visible = false; cap.name = cap.userData.fx_entity = 'turntable.scale_capsule_1_8m';

    this.s.add(new THREE.AmbientLight(0x50605c, 0.58));
    const rim = new THREE.DirectionalLight(0x9fc8ff, 1.4); rim.position.set(-3, 5, -4); rim.intensity = 2.2; this.s.add(rim);
    const fill = new THREE.DirectionalLight(0xffe0b8, 0.85); fill.position.set(4, 3, 5); this.s.add(fill);
    this.s.add(this.flash.group);
    this.silhouette = this.ctx.params.silhouette === true || this.ctx.params.silhouette === 'true';
    if (this.silhouette) {
      const black = new THREE.MeshBasicMaterial({ color: 0x050505 });
      this.display.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) { m.material = black; m.castShadow = m.receiveShadow = false; }
      });
      this.s.traverse((o) => { if (o.name.startsWith('turntable.')) o.visible = false; });
      this.flash.group.visible = false;
    }
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    if (!this.envReady && !this.silhouette) {
      const pmrem = new THREE.PMREMGenerator(this.ctx.renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
      this.display.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          const mm = m as THREE.MeshStandardMaterial;
          if (mm.metalness > 0.25) { mm.envMap = env; mm.envMapIntensity = 0.58; mm.needsUpdate = true; }
        });
      });
      this.envReady = true;
    }
    const local = Math.max(0, f.lt);
    const slot = Math.min(17, Math.floor(local));
    const angleIndex = slot % 6;
    const distIndex = Math.floor(slot / 6);
    const angle = angleIndex * Math.PI / 3;
    const close = distIndex === 0;
    const dist = close ? this.closeDist : this.maxDim * [1.78, 2.45][distIndex - 1];
    const focus = close ? this.closeCenter : new THREE.Vector3(0, this.centreY, 0);
    const h = focus.y + (close ? this.closeDist * 0.08 : Math.max(0.05, this.maxDim * 0.08));
    const bob = Math.sin(local * Math.PI * 2) * 0.01;
    this.cam.position.set(focus.x + Math.sin(angle) * dist, h + bob, focus.z + Math.cos(angle) * dist);
    this.cam.lookAt(focus);
    this.cam.updateMatrixWorld();

    const fwd = this.cam.getWorldDirection(new THREE.Vector3()).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, this.cam.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const pose: FPPose = {
      pos: [this.cam.position.x, this.cam.position.y, this.cam.position.z],
      target: [this.cam.position.x + fwd.x, this.cam.position.y + fwd.y, this.cam.position.z + fwd.z],
      forward: [fwd.x, fwd.y, fwd.z], right: [right.x, right.y, right.z], up: [up.x, up.y, up.z],
      roll: 0, fov: this.cam.fov, gait: 'still', stepPhase: 0, stepImpulse: 0, breath: 0,
    };
    const state = beamStateAt(f.t, 0); state.intensity *= 0.095;
    this.flash.update(pose, f.t, state);
    this.flash.haze.visible = false; // turntable evidence needs material/silhouette, not a camera-filling additive cone
    this.s.background = new THREE.Color(this.silhouette ? 0xd9d9d9 : 0x030404);

    const r = this.ctx.renderer;
    r.setRenderTarget(out); r.clear(true, true, true); r.render(this.s, this.cam); r.resetState();
    return { bloom: 0.035, vignette: 0.12, grain: 0.015 };
  }

  override dispose() { this.asset?.dispose(); }
}
