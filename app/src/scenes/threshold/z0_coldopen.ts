// THRESHOLD Z0 cold open: frame-0 sprint through the vending cathedral and the Tenant arm reveal.
// This is W1's integration scene; W3's finished cathedral assets replace the blockout dressing later.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { evalFirstPerson, applyFirstPersonCamera, type FPKey, type FPPose } from './fp_cam';
import { FlashlightRig, beamStateAt } from './flashlight';
import { thresholdPost } from './sensor_post';
import { clamp, lerp, sm, hash } from './kit';

/** Z7's exact replay at 171.30-173.40 maps to cold-open local 1.20-3.30. */
export function coldOpenLocalFromZ7Replay(t: number): number {
  return t - 170.1;
}

function fpKeys(): FPKey[] {
  return [
    { t: 0, pos: [0, 1.65, 6], yaw: 0, pitch: -0.02, fov: 82, gait: 'run' },
    { t: 1.2, pos: [0.08, 1.65, -0.8], yaw: 0, pitch: -0.02, fov: 82, gait: 'run' },
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
  private arm = new THREE.Group();
  private machines!: THREE.InstancedMesh;
  private machineData: { x: number; z: number; h: number; hue: number }[] = [];
  private machineMat!: THREE.MeshStandardMaterial;

  override init() {
    this.scene3d.background = new THREE.Color(0.0004, 0.0005, 0.0008);
    this.scene3d.fog = new THREE.FogExp2(0x020308, 0.035);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 0.16, metalness: 0.55 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 190), floorMat);
    floor.position.set(0, -0.06, -70);
    floor.receiveShadow = true;
    this.scene3d.add(floor);

    this.machineMat = new THREE.MeshStandardMaterial({ color: 0x151b26, roughness: 0.34, metalness: 0.45, emissive: 0x24384e, emissiveIntensity: 1.2 });
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
      m4.compose(new THREE.Vector3(x, h / 2, z), q, new THREE.Vector3(1, h / 2.2, 1));
      this.machines.setMatrixAt(i, m4);
      this.machines.setColorAt(i, new THREE.Color().setHSL(0.52 + 0.18 * hash(row + side * 11), 0.55, 0.42));
      i++;
    }
    this.machines.instanceMatrix.needsUpdate = true;
    this.scene3d.add(this.machines);

    // Arm blockout: patchwork rods and five coil-like fingers, all named for later replacement.
    const chrome = new THREE.MeshStandardMaterial({ color: 0x5b6570, roughness: 0.22, metalness: 0.85 });
    const paper = new THREE.MeshStandardMaterial({ color: 0x9d8d6c, roughness: 0.82, metalness: 0.0 });
    const tile = new THREE.MeshStandardMaterial({ color: 0x263c46, roughness: 0.28, metalness: 0.2 });
    const mats = [chrome, paper, tile];
    let p = new THREE.Vector3(0, 1.2, 0);
    for (let s = 0; s < 4; s++) {
      const n = p.clone().add(new THREE.Vector3((hash(s * 4) - 0.5) * 0.18, -0.08, 1.1));
      const seg = cylinderBetween(p, n, 0.09 - s * 0.01, mats[s % mats.length]!);
      seg.name = `tenant_arm_seg_${s}`;
      this.arm.add(seg);
      p = n;
    }
    for (let f = 0; f < 5; f++) {
      const a = (f - 2) * 0.22;
      const tip = p.clone().add(new THREE.Vector3(Math.sin(a) * 0.55, -0.15 + Math.abs(f - 2) * 0.04, 0.95));
      const finger = cylinderBetween(p, tip, 0.025, chrome);
      finger.name = `tenant_finger_${f}`;
      this.arm.add(finger);
    }
    this.scene3d.add(this.arm);
    this.scene3d.add(this.flash.group);
    const ambient = new THREE.HemisphereLight(0x203040, 0x010102, 0.16);
    this.scene3d.add(ambient);
  }

  private poseArm(t: number, pose: FPPose) {
    const reach = sm(2.4, 3.25, t);
    const behindZ = pose.pos[2] + lerp(7.5, 0.32, reach);
    this.arm.position.set(pose.pos[0] + 0.2, 0.1 + 0.9 * (1 - reach), behindZ);
    this.arm.rotation.set(0.12 * reach, Math.PI + 0.12 * Math.sin(t * 5), -0.18 * reach);
    this.arm.scale.setScalar(lerp(0.55, 1.25, reach));
    this.arm.visible = t > 1.15 && t < 3.32;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = clamp(f.t, 0, 4);
    const pose = coldOpenPose(t);
    applyFirstPersonCamera(this.cam, pose, out.width / out.height);
    this.poseArm(t, pose);
    const threat = t > 1.15 ? 1 : 0.3;
    const state = beamStateAt(t, threat);
    this.flash.update(pose, t, state, (time) => coldOpenPose(clamp(time, 0, 4)).forward);
    // Machines switch off in a wave during the look-back: emissive intensity only in blockout;
    // W3's final cathedral animates per-machine relays and lamp glass.
    const wave = t < 1.2 ? 0 : clamp((t - 1.2) / 0.7);
    this.machineMat.emissiveIntensity = lerp(1.2, 0.16, wave) * (t >= 3.3 ? 0 : 1);
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
    this.flash.dispose();
    this.machines.dispose();
  }
}
