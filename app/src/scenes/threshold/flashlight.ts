// THRESHOLD flashlight rig: eye-offset spotlights, deterministic battery/flicker and visible haze cone.
import * as THREE from 'three';
import type { FPPose, V3 } from './fp_cam';
import { laggedVec3 } from './fp_cam';
import { batteryAt, beamDeadAt, beamTintAt, clamp, flickerAt, hash, lerp } from './kit';

const DEG = Math.PI / 180;

function vrot(v: V3, axis: V3, a: number): V3 {
  const c = Math.cos(a), s = Math.sin(a);
  const k = axis;
  const dot = v[0] * k[0] + v[1] * k[1] + v[2] * k[2];
  const x: V3 = [
    k[1] * v[2] - k[2] * v[1],
    k[2] * v[0] - k[0] * v[2],
    k[0] * v[1] - k[1] * v[0],
  ];
  return [
    v[0] * c + x[0] * s + k[0] * dot * (1 - c),
    v[1] * c + x[1] * s + k[1] * dot * (1 - c),
    v[2] * c + x[2] * s + k[2] * dot * (1 - c),
  ];
}
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];

/** Approximate blackbody colour, sufficient for the specified 4300K/3200K/2700K beam drift. */
export function kelvinRGB(kelvin: number): [number, number, number] {
  const x = kelvin / 100;
  let r: number, g: number, b: number;
  if (x <= 66) r = 255;
  else r = 329.698727446 * Math.pow(x - 60, -0.1332047592);
  if (x <= 66) g = 99.4708025861 * Math.log(x) - 161.1195681661;
  else g = 288.1221695283 * Math.pow(x - 60, -0.0755148492);
  if (x >= 66) b = 255;
  else if (x <= 19) b = 0;
  else b = 138.5177312231 * Math.log(x - 10) - 305.0447927307;
  return [clamp(r / 255), clamp(g / 255), clamp(b / 255)];
}

let hazeAlphaTex: THREE.CanvasTexture | null = null;
function hazeAlphaTexture(): THREE.CanvasTexture {
  if (hazeAlphaTex) return hazeAlphaTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  // alphaMap samples the green channel, not canvas alpha, so bake the radial falloff into RGB.
  grad.addColorStop(0, 'rgb(96,96,96)');
  grad.addColorStop(0.45, 'rgb(42,42,42)');
  grad.addColorStop(1, 'rgb(0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  hazeAlphaTex = new THREE.CanvasTexture(c);
  return hazeAlphaTex;
}

export interface BeamState {
  battery: number;
  threat: number;
  flicker: number;
  intensity: number;
  tint: [number, number, number];
  dead: boolean;
}

export function beamStateAt(t: number, threat = 0): BeamState {
  const battery = batteryAt(t);
  const flicker = beamDeadAt(t) ? 0 : flickerAt(t, threat);
  const tint = beamTintAt(t);
  return {
    battery,
    threat,
    flicker,
    intensity: battery * flicker,
    tint,
    dead: beamDeadAt(t),
  };
}

export class FlashlightRig {
  readonly group = new THREE.Group();
  readonly core = new THREE.SpotLight(0xffffff, 0, 38, 7 * DEG, 0.25, 1.8);
  readonly cone = new THREE.SpotLight(0xffffff, 0, 30, 22 * DEG, 0.58, 1.65);
  readonly spill = new THREE.SpotLight(0xffffff, 0, 12, 30 * DEG, 0.92, 2.0);
  readonly haze: THREE.Group;
  private readonly hazeMats: THREE.MeshBasicMaterial[] = [];
  private readonly target = new THREE.Object3D();

  constructor() {
    for (const l of [this.core, this.cone, this.spill]) {
      l.castShadow = false;
      l.target = this.target;
      this.group.add(l);
    }
    this.group.add(this.target);
    // Atmospheric dust: sparse camera-facing motes inside the beam volume. No continuous cone
    // shell or cross-section sheets, because those read as polygons/rings in first person.
    this.haze = new THREE.Group();
    const hazeAlpha = hazeAlphaTexture();
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd8a8,
      transparent: true,
      opacity: 0,
      alphaMap: hazeAlpha,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.hazeMats.push(mat);
    const moteGeom = new THREE.CircleGeometry(1, 10);
    for (let i = 0; i < 34; i++) {
      const mote = new THREE.Mesh(moteGeom, mat);
      const z = 0.75 + hash(i * 3.1) * 5.7;
      const radius = Math.tan(22 * DEG) * z * Math.sqrt(hash(i * 5.7)) * 0.82;
      const a = hash(i * 9.3) * Math.PI * 2;
      mote.position.set(Math.cos(a) * radius, Math.sin(a) * radius, z);
      mote.scale.setScalar(0.018 + hash(i * 13.9) * 0.045);
      mote.rotateZ(hash(i * 4.4) * Math.PI);
      mote.userData.base = mote.position.clone();
      mote.userData.seed = i * 17.31;
      this.haze.add(mote);
    }
    this.group.add(this.haze);
  }

  /**
   * Update light transforms from a first-person pose. `dirAt` may wrap the pose evaluator
   * so the 80 ms lag remains a pure function of time even across scrubs/seeks.
   */
  update(pose: FPPose, t: number, state: BeamState, dirAt?: (time: number) => V3): void {
    const basePos = add(add(add(pose.pos, mul(pose.right, 0.25)), mul(pose.up, -0.2)), mul(pose.forward, 0.1));
    const direct = (time: number) => {
      if (dirAt) return dirAt(time);
      let d = pose.forward;
      d = vrot(d, pose.right, -2 * DEG);
      d = vrot(d, pose.up, -1 * DEG);
      return norm(d);
    };
    const lagged = norm(laggedVec3(direct, t, 0.08));
    const kelvin = t >= 174 && t < 192 ? 2700 : lerp(3200, 4300, state.battery);
    const c = kelvinRGB(kelvin);
    const tint = new THREE.Color(c[0], c[1], c[2]);
    const target = add(basePos, mul(lagged, 9));
    for (const l of [this.core, this.cone, this.spill]) {
      l.position.set(basePos[0], basePos[1], basePos[2]);
      l.color.copy(tint);
    }
    this.target.position.set(target[0], target[1], target[2]);
    const I = state.intensity;
    this.core.angle = lerp(4.5, 7, state.battery) * DEG;
    this.cone.angle = lerp(14, 22, state.battery) * DEG;
    this.spill.angle = 30 * DEG;
    this.core.intensity = 68 * I;
    this.cone.intensity = 28 * I;
    this.spill.intensity = 5 * I;
    this.haze.position.copy(this.core.position);
    this.haze.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(lagged[0], lagged[1], lagged[2]).normalize());
    for (const mat of this.hazeMats) {
      mat.color.copy(tint);
      mat.opacity = 0.075 * I;
    }
    for (const child of this.haze.children) {
      const base = child.userData.base as THREE.Vector3;
      const seed = child.userData.seed as number;
      child.position.set(
        base.x + Math.sin(t * 0.31 + seed) * 0.018,
        base.y + Math.cos(t * 0.27 + seed * 1.3) * 0.014,
        base.z + Math.sin(t * 0.19 + seed * 0.7) * 0.025,
      );
    }
    this.haze.visible = I > 0.003;
  }

  dispose(): void {
    for (const mat of this.hazeMats) mat.dispose();
  }
}
