// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// W2 zone geometry helpers plus a thin look-target adapter into W1's stabilized first-person/flashlight rigs.
import * as THREE from 'three';
import { evalFirstPerson, applyFirstPersonCamera as applySharedFirstPersonCamera, type FPKey, type FPPose } from './fp_cam';
import { FlashlightRig, beamStateAt } from './flashlight';

export type V3 = [number, number, number];
export type Gait = 'still' | 'walk' | 'run' | 'creep' | 'hold';
export interface CamKey { t: number; pos: V3; look: V3; fov: number; gait?: Gait; roll?: number }

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const smooth = (a: number, b: number, x: number) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
export const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const vec = (v: V3) => new THREE.Vector3(v[0], v[1], v[2]);
const mix3 = (a: V3, b: V3, u: number): V3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

export function evalCam(keys: CamKey[], t: number) {
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1]!.t) i++;
  const a = keys[i]!, b = keys[Math.min(i + 1, keys.length - 1)]!;
  const span = Math.max(1e-5, b.t - a.t);
  const u = clamp((t - a.t) / span);
  const e = u * u * (3 - 2 * u);
  const gait = (u < 0.5 ? a.gait : b.gait) ?? a.gait ?? 'still';
  return {
    pos: mix3(a.pos, b.pos, e),
    look: mix3(a.look, b.look, e),
    fov: lerp(a.fov, b.fov, e),
    roll: lerp(a.roll ?? 0, b.roll ?? 0, e),
    gait,
  };
}

export function applyFpCamera(cam: THREE.PerspectiveCamera, keys: CamKey[], t: number, aspect: number) {
  // Adapter into W1's shared rig. Zone choreography still uses explicit look targets,
  // converted here to yaw/pitch keys so gait, breath, sway and noise stay centralized.
  const fpKeys: FPKey[] = keys.map((k) => {
    const dx = k.look[0] - k.pos[0], dy = k.look[1] - k.pos[1], dz = k.look[2] - k.pos[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    return {
      t: k.t,
      pos: k.pos,
      yaw: Math.atan2(dx / len, -dz / len),
      pitch: Math.asin(dy / len),
      roll: k.roll ?? 0,
      fov: k.fov,
      gait: k.gait === 'hold' ? 'holdBreath' : k.gait ?? 'still',
    };
  });
  const pose = evalFirstPerson(fpKeys, t);
  applySharedFirstPersonCamera(cam, pose, aspect);
  cam.userData.fpPose = pose;
  return evalCam(keys, t);
}

export function mat(color: string | number, roughness = 0.65, metalness = 0, emissive?: string | number, ei = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive: emissive ?? 0x000000, emissiveIntensity: ei });
}
export function basic(color: string | number, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
}
export function named<T extends THREE.Object3D>(o: T, name: string): T { o.name = name; o.userData.fx_entity = name; return o; }
export function box(parent: THREE.Object3D, name: string, size: V3, pos: V3, material: THREE.Material, rot: V3 = [0, 0, 0]) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), material); m.position.set(...pos); m.rotation.set(...rot); m.castShadow = m.receiveShadow = true; parent.add(named(m, name)); return m;
}
export function cyl(parent: THREE.Object3D, name: string, r: number, h: number, pos: V3, material: THREE.Material, rot: V3 = [0, 0, 0], seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), material); m.position.set(...pos); m.rotation.set(...rot); m.castShadow = m.receiveShadow = true; parent.add(named(m, name)); return m;
}
export function sph(parent: THREE.Object3D, name: string, r: number, pos: V3, material: THREE.Material, seg = 16) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg >> 1)), material); m.position.set(...pos); m.castShadow = m.receiveShadow = true; parent.add(named(m, name)); return m;
}
export function plane(parent: THREE.Object3D, name: string, w: number, h: number, pos: V3, material: THREE.Material, rot: V3 = [0, 0, 0]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material); m.position.set(...pos); m.rotation.set(...rot); m.receiveShadow = true; parent.add(named(m, name)); return m;
}
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); const mm = m.material; (Array.isArray(mm) ? mm : [mm]).forEach((x) => x.dispose()); } });
}

export function addFlashlight(scene: THREE.Scene) {
  const rig = new FlashlightRig();
  scene.add(rig.group);
  return { rig, light: rig, target: rig.group };
}

export function updateFlashlight(light: FlashlightRig, _target: THREE.Object3D, cam: THREE.PerspectiveCamera, t: number, beamScale: number, threat: number) {
  // Use the exact closed-form pose evaluated by applyFpCamera, including gait/breath/noise.
  const pose = cam.userData.fpPose as FPPose;
  const state = beamStateAt(t, clamp(threat * 3, 0, 1));
  state.intensity *= beamScale;
  light.update(pose, t, state);
}

export function drawTextOverlay(layer: { clear(): void; ctx: CanvasRenderingContext2D; upload(): THREE.Texture }, draw: (c: CanvasRenderingContext2D) => void) {
  layer.clear();
  draw(layer.ctx);
  return layer.upload();
}
