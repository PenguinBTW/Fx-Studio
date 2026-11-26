// THRESHOLD Z0 cold open: frame-0 sprint through the vending cathedral and the Tenant arm reveal.
// This is W1's integration scene; W3's finished cathedral assets replace the blockout dressing later.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset } from '../../engine/assets';
import { evalFirstPerson, applyFirstPersonCamera, type FPKey, type FPPose } from './fp_cam';
import { FlashlightRig, beamStateAt } from './flashlight';
import { thresholdPost } from './sensor_post';
import { clamp, lerp, sm, hash } from './kit';
import { createDriftParticles, updateDriftParticles, disposeDecalParticleTree } from './decals_particles';

/** Z7's exact replay at 171.30-173.40 maps to cold-open local 1.20-3.30. */
export function coldOpenLocalFromZ7Replay(t: number): number {
  return t - 170.1;
}

function fpKeys(): FPKey[] {
  return [
    { t: 0, pos: [0, 1.65, 6], yaw: 0, pitch: -0.13, fov: 82, gait: 'run' },
    { t: 1.2, pos: [0.08, 1.65, -0.8], yaw: 0, pitch: -0.13, fov: 82, gait: 'run' },
    { t: 1.7, pos: [0.0, 1.65, -3.0], yaw: Math.PI * 0.84, pitch: -0.05, fov: 82, gait: 'run' },
    { t: 2.05, pos: [0.0, 1.42, -4.2], yaw: 0.08, pitch: -0.18, roll: 0.12, fov: 82, gait: 'run' },
    { t: 2.4, pos: [0.1, 0.62, -5.2], yaw: Math.PI * 0.82, pitch: -0.1, roll: 0.45, fov: 82, gait: 'still' },
    { t: 3.3, pos: [0.1, 0.34, -5.5], yaw: Math.PI * 0.86, pitch: 0.0, roll: 1.22, fov: 82, gait: 'still' },
    { t: 4.0, pos: [0.1, 0.34, -5.5], yaw: Math.PI * 0.86, pitch: 0.0, roll: 1.22, fov: 82, gait: 'holdBreath' },
  ];
}

export function coldOpenPose(t: number): FPPose {
  return evalFirstPerson(fpKeys(), clamp(t, 0, 4), t < 2.15 ? 'run' : t < 3.3 ? 'still' : 'holdBreath');
}

export const COLD_OPEN_REPLAY = { z7Start: 171.3, z7BeamDead: 173.4, z7End: 174.0, z0Start: 1.2, z0End: 3.3 } as const;

/** Pure reference pose for W3's exact Z7 replay; mirrors the hero arm placement used in Z0. */
export function coldOpenArmReference(t: number, pose: FPPose) {
  const local = clamp(t, 0, 4);
  const reach = sm(2.4, 3.25, local);
  const dist = lerp(5.8, 4.42, reach);
  const side = lerp(0.72, 0.38, reach);
  const position: [number, number, number] = [
    pose.pos[0] + pose.forward[0] * dist + pose.right[0] * side,
    pose.pos[1] + 0.02 + 0.62 * (1 - reach) + 0.34 * reach,
    pose.pos[2] + pose.forward[2] * dist + pose.right[2] * side,
  ];
  // The five-coil hand converges on a point 30 cm in front of the lens. Aiming the
  // actual root-to-target vector (rather than a horizontal approximation) keeps the
  // finger fan inside the beam instead of letting it fall out of the low fallen-camera frame.
  const target: [number, number, number] = [
    pose.pos[0] + pose.forward[0] * 0.3 + pose.right[0] * 0.035,
    pose.pos[1] + 0.055,
    pose.pos[2] + pose.forward[2] * 0.3 + pose.right[2] * 0.035,
  ];
  const toward: [number, number, number] = [target[0] - position[0], target[1] - position[1], target[2] - position[2]];
  const towardLen = Math.hypot(toward[0], toward[1], toward[2]) || 1;
  return {
    reach,
    visible: local > 1.15 && local < 3.32,
    position,
    towardCamera: [toward[0] / towardLen, toward[1] / towardLen, toward[2] / towardLen] as [number, number, number],
    rotateX: 0.018 * reach,
    rotateY: -0.035 * reach,
    rotateZ: 0.055 * reach,
    scale: lerp(1.05, 1.85, reach),
  };
}

function cylinderBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.82, d.length(), 10, 1), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

export default class Z0ColdOpen extends Scene {
  private scene3d = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(82, 16 / 9, 0.04, 240);
  private flash = new FlashlightRig();
  private arm!: THREE.Group;
  private tenantInst!: GLTFInstance;
  private vendingInst!: GLTFInstance;
  private heroMachines = new THREE.Group();
  private machines!: THREE.InstancedMesh;
  private machineData: { x: number; z: number; h: number; hue: number }[] = [];
  private machineMat!: THREE.MeshStandardMaterial;
  private panels!: THREE.InstancedMesh;
  private panelMat!: THREE.MeshStandardMaterial;
  private vents!: THREE.InstancedMesh;
  private ambientDust!: THREE.InstancedMesh;

  override async init() {
    this.scene3d.background = new THREE.Color(0.0004, 0.0005, 0.0008);
    this.scene3d.fog = new THREE.FogExp2(0x020308, 0.035);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x182b3e, roughness: 0.2, metalness: 0.5, emissive: 0x061622, emissiveIntensity: 0.72 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 190), floorMat);
    floor.position.set(0, -0.06, -70);
    floor.receiveShadow = true;
    this.scene3d.add(floor);

    this.vendingInst = await GLTFManager.instantiate(resolveAsset('z7_vending_machines', this.ctx.project ?? 'threshold').url, {});

    this.machineMat = new THREE.MeshStandardMaterial({ color: 0x101722, roughness: 0.42, metalness: 0.58, emissive: 0x102438, emissiveIntensity: 0.95 });
    const geom = new THREE.BoxGeometry(0.85, 2.2, 0.62);
    const count = 96;
    this.machines = new THREE.InstancedMesh(geom, this.machineMat, count);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let i = 0;
    for (const side of [-1, 1]) for (let row = 0; row < 48; row++) {
      const z = 4 - row * 3.2;
      const h = 2.2 + 0.25 * hash(row * 2.13 + side);
      const x = side * (2.25 + 0.08 * hash(row * 4.7));
      this.machineData.push({ x, z, h, hue: hash(row * 9.1 + side * 3) });
      m4.compose(new THREE.Vector3(x, h / 2, z), q, row < 10 ? new THREE.Vector3(0.001, 0.001, 0.001) : new THREE.Vector3(1, h / 2.2, 1));
      this.machines.setMatrixAt(i, m4);
      this.machines.setColorAt(i, new THREE.Color().setHSL(0.52 + 0.18 * hash(row + side * 11), 0.42, 0.19));
      i++;
    }
    this.machines.instanceMatrix.needsUpdate = true;
    this.scene3d.add(this.machines);

    // Inward-facing vending fascia panels: cool machine-light rectangles make the aisle
    // readable even when the flashlight is weak.
    this.panelMat = new THREE.MeshStandardMaterial({ color: 0x102334, roughness: 0.25, metalness: 0.2, emissive: 0x4bb7d7, emissiveIntensity: 1.8 });
    const panelGeom = new THREE.BoxGeometry(0.026, 1.16, 0.4);
    this.panels = new THREE.InstancedMesh(panelGeom, this.panelMat, count);
    i = 0;
    for (const side of [-1, 1]) for (let row = 0; row < 48; row++) {
      const z = 4 - row * 3.2;
      const h = 2.2 + 0.25 * hash(row * 2.13 + side);
      const x = side * (2.25 + 0.08 * hash(row * 4.7)) - side * 0.44;
      m4.compose(new THREE.Vector3(x, 1.18 * (h / 2.2), z - 0.02), q, row < 10 ? new THREE.Vector3(0.001, 0.001, 0.001) : new THREE.Vector3(1, h / 2.2, 1));
      this.panels.setMatrixAt(i, m4);
      this.panels.setColorAt(i, new THREE.Color().setHSL(row % 5 === 0 ? 0.08 : 0.53, 0.9, row % 5 === 0 ? 0.55 : 0.46));
      i++;
    }
    this.panels.instanceMatrix.needsUpdate = true;
    this.scene3d.add(this.panels);

    // Horizontal fascia vents break the vending machines out of primitive-box silhouette.
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x030609, roughness: 0.7, metalness: 0.35, emissive: 0x071923, emissiveIntensity: 0.32 });
    const ventGeom = new THREE.BoxGeometry(0.018, 0.035, 0.34);
    this.vents = new THREE.InstancedMesh(ventGeom, ventMat, count * 4);
    i = 0;
    for (const side of [-1, 1]) for (let row = 0; row < 48; row++) {
      const z = 4 - row * 3.2;
      const h = 2.2 + 0.25 * hash(row * 2.13 + side);
      const x = side * (2.25 + 0.08 * hash(row * 4.7)) - side * 0.455;
      for (let slot = 0; slot < 4; slot++) {
        m4.compose(new THREE.Vector3(x, (0.66 + slot * 0.18) * (h / 2.2), z - 0.02), q, row < 10 ? new THREE.Vector3(0.001, 0.001, 0.001) : new THREE.Vector3(1, 1, 1));
        this.vents.setMatrixAt(i++, m4);
      }
    }
    this.vents.instanceMatrix.needsUpdate = true;
    this.scene3d.add(this.vents);

    // Near-camera rows use W3's real vending-machine family; far rows stay instanced blockout.
    const kinds = ['snacks_machine_root', 'drinks_machine_root', 'glass_front_machine_root', 'retro_machine_root'];
    for (const side of [-1, 1]) for (let row = 0; row < 10; row++) {
      const source = this.vendingInst.root.getObjectByName(kinds[(row + (side > 0 ? 1 : 0)) % kinds.length]!);
      if (!source) continue;
      const clone = source.clone(true);
      clone.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.material = Array.isArray(obj.material) ? obj.material.map((m) => m.clone()) : obj.material.clone();
      });
      clone.position.set(0, 0, 0);
      const wrap = new THREE.Group();
      wrap.add(clone);
      const z = 4 - row * 3.2;
      const x = side * (2.25 + 0.08 * hash(row * 4.7));
      wrap.position.set(x, 0, z);
      wrap.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      wrap.scale.setScalar(1.04);
      this.heroMachines.add(wrap);
    }
    this.scene3d.add(this.heroMachines);
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) {
      const lamp = new THREE.PointLight(row % 3 === 0 ? 0xffc58c : 0x7fc9ff, 0.72, 2.6, 1.7);
      lamp.position.set(side * 1.48, 1.28, 4 - row * 3.2 - 0.03);
      this.scene3d.add(lamp);
    }

    // Cable trays, floor runs, and overhead conduits supply mechanical scale cues in the first frames.
    const conduitMat = new THREE.MeshStandardMaterial({ color: 0x0b1118, roughness: 0.48, metalness: 0.72, emissive: 0x071018, emissiveIntensity: 0.18 });
    for (const x of [-1.72, 1.72, -0.72, 0.72]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(x < -1 || x > 1 ? 0.08 : 0.045, x < -1 || x > 1 ? 0.08 : 0.035, 170), conduitMat);
      rail.position.set(x, x < -1 || x > 1 ? 3.55 : 0.035, -62);
      this.scene3d.add(rail);
    }
    for (let k = 0; k < 18; k++) {
      for (const side of [-1, 1]) {
        const drop = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.05, 0.055), conduitMat);
        drop.position.set(side * 1.72, 3.05, 3 - k * 8);
        this.scene3d.add(drop);
      }
      if (k % 3 === 0) {
        const floorCross = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.025, 0.06), conduitMat);
        floorCross.position.set(0, 0.025, 1.2 - k * 8);
        this.scene3d.add(floorCross);
      }
    }

    // High cold strips establish the cathedral scale and vanishing aisle silhouette.
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x88d7ff, transparent: true, opacity: 0.55 });
    for (let k = 0; k < 18; k++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.035, 0.06), stripMat);
      strip.position.set(0, 4.1, 2 - k * 8);
      this.scene3d.add(strip);
    }

    // Polished-black-floor reflection catches: broken cyan/amber streaks under the
    // vending rows and ceiling tubes. They are geometric floor-plane glints, not a screen overlay.
    const reflGeom = new THREE.PlaneGeometry(0.28, 2.65);
    for (const side of [-1, 1]) for (let row = 0; row < 18; row++) {
      const warm = row % 5 === 0;
      const reflMat = new THREE.MeshBasicMaterial({
        color: warm ? 0xffa864 : 0x58c7ff,
        transparent: true,
        opacity: warm ? 0.12 : 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const refl = new THREE.Mesh(reflGeom, reflMat);
      refl.rotation.x = -Math.PI / 2;
      refl.position.set(side * (1.54 + 0.05 * hash(row * 3.1)), 0.012, 3.15 - row * 3.2);
      refl.scale.x = 0.55 + hash(row * 7.4) * 0.75;
      this.scene3d.add(refl);
    }
    const centerReflMat = new THREE.MeshBasicMaterial({ color: 0x4b9dcc, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let k = 0; k < 16; k++) {
      const refl = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 3.8), centerReflMat);
      refl.rotation.x = -Math.PI / 2;
      refl.position.set((hash(k * 8.3) - 0.5) * 0.55, 0.014, 1.5 - k * 8);
      this.scene3d.add(refl);
    }

    // Sparse room-scale dust gives the cathedral air parallax without continuous beam sheets.
    this.ambientDust = createDriftParticles({
      kind: 'dust',
      count: 72,
      bounds: { min: [-1.85, 0.35, -44], max: [1.85, 3.6, 4.5] },
      seed: 4107,
      opacity: 0.16,
      size: 0.009,
    });
    this.scene3d.add(this.ambientDust);

    // Hero arm-only Tenant LOD: real shared GLB rather than primitive scaffolding.
    this.tenantInst = await GLTFManager.instantiate(resolveAsset('tenant_arm', this.ctx.project ?? 'threshold').url, {});
    this.arm = new THREE.Group();
    this.arm.add(this.tenantInst.root);
    const machineGlint = new THREE.PointLight(0x7fc9ff, 3.2, 4.2, 1.45);
    machineGlint.position.set(-0.18, 0.18, -0.95);
    this.arm.add(machineGlint);
    const fingerGlint = new THREE.PointLight(0xffc28a, 6.2, 4.6, 1.55);
    fingerGlint.position.set(0.06, 0.08, -1.92);
    this.arm.add(fingerGlint);
    const rimGlint = new THREE.PointLight(0x9fdcff, 4.0, 4.0, 1.65);
    rimGlint.position.set(-0.36, 0.32, -1.25);
    this.arm.add(rimGlint);
    this.tenantInst.root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      if (obj.name === 'shoulder_collage') obj.scale.multiplyScalar(0.72);
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!(m instanceof THREE.MeshStandardMaterial)) continue;
        if (m.name === 'TenantChrome') { m.emissive.setHex(0x243548); m.emissiveIntensity = 0.55; m.roughness = 0.16; }
        if (m.name === 'TenantPoolTile') { m.emissive.setHex(0x0b2830); m.emissiveIntensity = 0.38; }
        if (m.name === 'TenantPaper') { m.emissive.setHex(0x2a1607); m.emissiveIntensity = 0.28; }
        if (m.name === 'TenantFelt') { m.emissive.setHex(0x2a0503); m.emissiveIntensity = 0.32; }
      }
    });

    // Coil geometry now lives in the shared tenant_arm GLB so Z0 and the exact Z7 replay use the same fingers.
    this.arm.visible = false;
    this.scene3d.add(this.arm);
    this.scene3d.add(this.flash.group);
    const ambient = new THREE.HemisphereLight(0x456f91, 0x080606, 1.05);
    this.scene3d.add(ambient);
  }

  private poseArm(t: number, pose: FPPose) {
    const ref = coldOpenArmReference(t, pose);
    this.arm.position.set(...ref.position);
    this.arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), new THREE.Vector3(...ref.towardCamera));
    this.arm.rotateX(ref.rotateX);
    this.arm.rotateY(ref.rotateY);
    this.arm.rotateZ(ref.rotateZ);
    this.arm.scale.setScalar(ref.scale);
    this.arm.visible = ref.visible;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = clamp(f.t, 0, 4);
    const pose = coldOpenPose(t);
    applyFirstPersonCamera(this.cam, pose, out.width / out.height);
    this.poseArm(t, pose);
    const threat = t > 1.15 ? 1 : 0.3;
    updateDriftParticles(this.ambientDust, t);
    const state = beamStateAt(t, threat);
    this.flash.update(pose, t, state, (time) => {
      const fwd = coldOpenPose(clamp(time, 0, 4)).forward;
      const down = lerp(0.18, 0, sm(1.8, 2.35, time));
      const side = 0.16 * sm(2.0, 2.65, time);
      const x = fwd[0] + pose.right[0] * side;
      const z = fwd[2] + pose.right[2] * side;
      const len = Math.hypot(x, fwd[1] - down, z) || 1;
      return [x / len, (fwd[1] - down) / len, z / len];
    });
    // Machines switch off in a wave during the look-back: emissive intensity only in blockout;
    // W3's final cathedral animates per-machine relays and lamp glass.
    const wave = t < 1.2 ? 0 : clamp((t - 1.2) / 0.7);
    this.machineMat.emissiveIntensity = lerp(0.95, 0.14, wave) * (t >= 3.3 ? 0 : 1);
    this.panelMat.emissiveIntensity = lerp(1.8, 0.22, wave) * (t >= 3.3 ? 0 : 1);
    const r = this.ctx.renderer;
    r.setRenderTarget(out);
    r.setClearColor(0x000000, 1);
    r.clear();
    r.render(this.scene3d, this.cam);
    r.resetState();
    const fade = t >= 3.3 ? sm(3.3, 3.42, t) : 0;
    return thresholdPost(t, { darkness: 0.82, stress: t > 1.1 ? 0.8 : 0.35, fade });
  }

  override dispose() {
    this.tenantInst.dispose();
    this.vendingInst.dispose();
    this.flash.dispose();
    this.machines.dispose();
    this.panels.dispose();
    this.vents.dispose();
    disposeDecalParticleTree(this.ambientDust);
  }
}
