// THRESHOLD flashlight rig: eye-offset spotlights, deterministic battery/flicker and visible haze cone.
import * as THREE from 'three';
import type { FPPose, V3 } from './fp_cam';
import { laggedVec3 } from './fp_cam';
import { batteryAt, beamDeadAt, beamTintAt, clamp, flickerAt, lerp, sm } from './kit';

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

let cookieTex: THREE.CanvasTexture | null = null;
function flashlightCookieTexture(): THREE.CanvasTexture {
  if (cookieTex) return cookieTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const dx = (x - 64) / 64, dy = (y - 64) / 64;
    const r = Math.hypot(dx, dy);
    const rings = 0.9 + 0.1 * Math.sin(r * 54);
    const darkCentre = lerp(0.62, 1, sm(0.04, 0.18, r));
    const edge = 1 - sm(0.86, 1, r);
    const v = Math.round(255 * clamp(rings * darkCentre * edge));
    const o = (y * 128 + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
    img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  cookieTex = new THREE.CanvasTexture(c);
  cookieTex.colorSpace = THREE.SRGBColorSpace;
  return cookieTex;
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
  readonly core = new THREE.SpotLight(0xffffff, 0, 38, 7 * DEG, 0.25, 1.55);
  readonly cone = new THREE.SpotLight(0xffffff, 0, 30, 22 * DEG, 0.58, 1.35);
  readonly spill = new THREE.SpotLight(0xffffff, 0, 12, 30 * DEG, 0.92, 1.8);
  readonly haze: THREE.Mesh;
  private readonly hazeMat: THREE.MeshBasicMaterial;
  private readonly target = new THREE.Object3D();

  constructor() {
    for (const l of [this.core, this.cone, this.spill]) {
      l.castShadow = false;
      l.target = this.target;
      this.group.add(l);
    }
    this.group.add(this.target);
    const cookie = flashlightCookieTexture();
    this.core.map = cookie;
    this.cone.map = cookie;
    const len = 7;
    const geom = new THREE.ConeGeometry(Math.tan(11 * DEG) * len, len, 32, 1, true);
    geom.translate(0, -len / 2, 0);
    this.hazeMat = new THREE.MeshBasicMaterial({
      color: 0xffd8a8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.haze = new THREE.Mesh(geom, this.hazeMat);
    this.haze.renderOrder = 10;
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
    this.core.intensity = 520 * I;
    this.cone.intensity = 210 * I;
    this.spill.intensity = 38 * I;
    this.haze.position.copy(this.core.position);
    this.haze.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(lagged[0], lagged[1], lagged[2]).normalize());
    this.hazeMat.color.copy(tint);
    this.hazeMat.opacity = 0.028 * I;
    this.haze.visible = I > 0.003;
  }

  dispose(): void {
    this.haze.geometry.dispose();
    this.hazeMat.dispose();
  }
}
