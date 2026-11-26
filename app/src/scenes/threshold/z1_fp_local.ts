// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// W2-local deterministic first-person scaffolding, isolated so W1's shared rig can replace it without rewriting zone content.
import * as THREE from 'three';

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
  const k = evalCam(keys, t);
  const pos = vec(k.pos);
  const look = vec(k.look);
  const forward = look.clone().sub(pos).normalize();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const gait = k.gait;
  const rate = gait === 'run' ? 3.0 : gait === 'walk' ? 1.9 : gait === 'creep' ? 1.2 : 0;
  const bobAmp = gait === 'run' ? 0.045 : gait === 'walk' ? 0.022 : gait === 'creep' ? 0.008 : 0;
  const swayAmp = gait === 'run' ? 0.025 : gait === 'walk' ? 0.014 : gait === 'creep' ? 0.010 : 0;
  let roll = k.roll;
  if (rate > 0) {
    const ph = t * Math.PI * 2 * rate;
    pos.y += Math.sin(ph) * bobAmp;
    pos.addScaledVector(right, Math.sin(ph * 0.5) * swayAmp);
    roll += Math.sin(ph * 0.5) * (gait === 'run' ? 0.035 : 0.010);
  } else if (gait === 'still') {
    pos.y += Math.sin(t * Math.PI * 0.5) * 0.006;
    pos.addScaledVector(right, Math.sin(t * 0.31 + 1.7) * 0.003);
    roll += Math.sin(t * 0.23) * 0.002;
  } else if (gait === 'hold') {
    pos.x += (hash(Math.floor(t * 90)) - 0.5) * 0.0008;
    pos.y += (hash(Math.floor(t * 90) + 5) - 0.5) * 0.0008;
  }
  cam.position.copy(pos);
  cam.fov = k.fov;
  cam.aspect = aspect;
  cam.updateProjectionMatrix();
  cam.up.set(0, 1, 0);
  cam.lookAt(look);
  cam.rotateZ(roll);
  return k;
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
  const light = new THREE.SpotLight(0xffddb0, 0, 35, THREE.MathUtils.degToRad(22), 0.55, 1.2);
  const target = new THREE.Object3D();
  scene.add(light, target);
  light.target = target;
  return { light, target };
}
export function updateFlashlight(light: THREE.SpotLight, target: THREE.Object3D, cam: THREE.PerspectiveCamera, t: number, battery: number, flicker: number) {
  const dir = cam.getWorldDirection(new THREE.Vector3());
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  light.position.copy(cam.position).addScaledVector(right, 0.25).addScaledVector(new THREE.Vector3(0, 1, 0), -0.2).addScaledVector(dir, 0.1);
  target.position.copy(cam.position).addScaledVector(dir, 8).addScaledVector(new THREE.Vector3(0, 1, 0), -0.25);
  let f = 1;
  if (flicker > 0) {
    const cell = Math.floor(t * 18);
    const active = hash(cell) < flicker;
    f = active ? 0.15 + 0.5 * hash(cell + 9) : 1;
  }
  light.intensity = 70 * battery * f;
}

export function drawTextOverlay(layer: { clear(): void; ctx: CanvasRenderingContext2D; upload(): THREE.Texture }, draw: (c: CanvasRenderingContext2D) => void) {
  layer.clear();
  draw(layer.ctx);
  return layer.upload();
}
