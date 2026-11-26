// THRESHOLD shared decals and lightweight environmental particles.
// All placement and drift is seeded/closed-form; zone callers may re-evaluate update functions every frame.
import * as THREE from 'three';
import { TAU, hash } from './kit';

export type V3 = [number, number, number];

export interface Bounds3 {
  min: V3;
  max: V3;
}

export function seededPoint(seed: number, i: number, bounds: Bounds3): V3 {
  return [
    bounds.min[0] + (bounds.max[0] - bounds.min[0]) * hash(seed + i * 3.17),
    bounds.min[1] + (bounds.max[1] - bounds.min[1]) * hash(seed + i * 5.31 + 11.7),
    bounds.min[2] + (bounds.max[2] - bounds.min[2]) * hash(seed + i * 7.91 + 31.3),
  ];
}

function radialAlphaTexture(size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgb(255,255,255)');
  grad.addColorStop(0.48, 'rgb(145,145,145)');
  grad.addColorStop(1, 'rgb(0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** Soft contact-shadow material for feet, furniture, machines and creature contact points. */
export function contactShadowMaterial(opacity = 0.32): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity,
    alphaMap: radialAlphaTexture(),
    depthWrite: false,
  });
}

/** Horizontal contact-shadow decal centered at origin; caller positions/rotates it just above the floor. */
export function contactShadowDecal(width: number, depth: number, opacity = 0.32, name = 'contact_shadow'): THREE.Mesh {
  const geom = new THREE.PlaneGeometry(width, depth);
  geom.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geom, contactShadowMaterial(opacity));
  mesh.name = name;
  mesh.renderOrder = 1;
  return mesh;
}

/** Wet footprint material. The same material can safely be shared by every print in a trail. */
export function wetFootprintMaterial(color = 0x557f86, opacity = 0.42): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.18,
    metalness: 0.04,
    transparent: true,
    opacity,
    depthWrite: false,
    emissive: 0x10262b,
    emissiveIntensity: 0.18,
  });
}

function footprintOval(material: THREE.Material, x: number, z: number, sx: number, sz: number, seed: number): THREE.Mesh {
  const geom = new THREE.CircleGeometry(1, 14);
  geom.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.set(x, 0.002, z);
  mesh.scale.set(sx, 1, sz);
  mesh.rotation.y = (hash(seed) - 0.5) * 0.08;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 2;
  return mesh;
}

/**
 * One wet foot print in local space. The toes point down local +Z, so a trail walking
 * toward -Z must rotate the parent by PI rather than reversing individual toes.
 */
export function createWetFootprint(side: -1 | 1, material: THREE.Material, scale = 1, seed = 0): THREE.Group {
  const foot = new THREE.Group();
  foot.name = side < 0 ? 'wet_footprint_left' : 'wet_footprint_right';
  foot.add(footprintOval(material, 0, -0.015 * scale, 0.072 * scale, 0.145 * scale, seed + 1));
  foot.add(footprintOval(material, 0, -0.155 * scale, 0.058 * scale, 0.075 * scale, seed + 2));
  for (let toe = 0; toe < 3; toe++) {
    foot.add(footprintOval(material, (toe - 1) * 0.036 * scale, 0.135 * scale + toe * 0.004 * scale, 0.018 * scale, 0.032 * scale, seed + 3 + toe));
  }
  foot.position.x = side * 0.14 * scale;
  foot.rotation.y = side * (0.05 + hash(seed + 8) * 0.06);
  return foot;
}

export interface FootprintTrailOptions {
  count: number;
  spacing?: number;
  scale?: number;
  seed?: number;
  material: THREE.Material;
}

/** Alternating footprint trail advancing along local +Z. Caller positions/yaws the group onto the floor path. */
export function createWetFootprintTrail(opts: FootprintTrailOptions): THREE.Group {
  const scale = opts.scale ?? 1;
  const spacing = opts.spacing ?? 0.68;
  const seed = opts.seed ?? 0;
  const trail = new THREE.Group();
  trail.name = 'wet_footprint_trail';
  for (let i = 0; i < opts.count; i++) {
    const foot = createWetFootprint(i % 2 === 0 ? -1 : 1, opts.material, scale, seed + i * 13.7);
    foot.position.z = i * spacing;
    foot.position.x += (hash(seed + i * 4.1) - 0.5) * 0.045;
    trail.add(foot);
  }
  return trail;
}

export interface DriftParticleOptions {
  kind: 'dust' | 'fibres';
  count: number;
  bounds: Bounds3;
  seed: number;
  color?: number;
  opacity?: number;
  size?: number;
}

interface DriftData {
  kind: 'dust' | 'fibres';
  base: Float32Array;
  phase: Float32Array;
  scale: Float32Array;
  count: number;
  drift: number;
}

const scratch = new THREE.Object3D();

/** Small budgeted environmental motes/fibres. Use tens-to-low-hundreds per zone, not a continuous haze shell. */
export function createDriftParticles(opts: DriftParticleOptions): THREE.InstancedMesh {
  const isFibre = opts.kind === 'fibres';
  const geom = isFibre ? new THREE.BoxGeometry(1, 1, 1) : new THREE.SphereGeometry(1, 6, 4);
  const mat = new THREE.MeshBasicMaterial({
    color: opts.color ?? (isFibre ? 0xd8c7a2 : 0xffe1b8),
    transparent: true,
    opacity: opts.opacity ?? (isFibre ? 0.22 : 0.3),
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.InstancedMesh(geom, mat, opts.count);
  mesh.name = `${opts.kind}_drift_particles`;
  const base = new Float32Array(opts.count * 3);
  const phase = new Float32Array(opts.count);
  const scale = new Float32Array(opts.count * 3);
  for (let i = 0; i < opts.count; i++) {
    const p = seededPoint(opts.seed, i, opts.bounds);
    base.set(p, i * 3);
    phase[i] = hash(opts.seed + i * 17.13) * TAU;
    const s = (opts.size ?? (isFibre ? 0.018 : 0.012)) * (0.65 + hash(opts.seed + i * 2.7) * 0.8);
    if (isFibre) scale.set([s * 0.16, s * (2.8 + hash(opts.seed + i) * 2.4), s * 0.16], i * 3);
    else scale.set([s, s, s], i * 3);
  }
  const data: DriftData = { kind: opts.kind, base, phase, scale, count: opts.count, drift: isFibre ? 0.035 : 0.055 };
  mesh.userData.driftParticles = data;
  updateDriftParticles(mesh, 0);
  return mesh;
}

/** Closed-form particle drift; safe to call on every scrub/render because position depends only on `t`. */
export function updateDriftParticles(mesh: THREE.InstancedMesh, t: number): void {
  const data = mesh.userData.driftParticles as DriftData | undefined;
  if (!data) return;
  for (let i = 0; i < data.count; i++) {
    const j = i * 3;
    const p = data.phase[i]!;
    const slow = t * (data.kind === 'fibres' ? 0.11 : 0.17);
    scratch.position.set(
      data.base[j]! + Math.sin(slow + p) * data.drift,
      data.base[j + 1]! + Math.sin(slow * 0.73 + p * 1.7) * data.drift * 0.55,
      data.base[j + 2]! + Math.cos(slow * 0.61 + p) * data.drift,
    );
    scratch.rotation.set(
      data.kind === 'fibres' ? p + t * 0.025 : 0,
      data.kind === 'fibres' ? p * 0.37 : 0,
      data.kind === 'fibres' ? p * 0.61 + t * 0.018 : 0,
    );
    scratch.scale.set(data.scale[j]!, data.scale[j + 1]!, data.scale[j + 2]!);
    scratch.updateMatrix();
    mesh.setMatrixAt(i, scratch.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/** Explicit cleanup helper for shared decal/particle subtrees, including alpha maps created here. */
export function disposeDecalParticleTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const basic = mat as THREE.MeshBasicMaterial;
      if (basic.alphaMap) basic.alphaMap.dispose();
      mat.dispose();
    }
  });
}
