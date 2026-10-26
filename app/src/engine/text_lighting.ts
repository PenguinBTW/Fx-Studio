// In-World Text Scene Lighting, Depth Buffer Participation & Occlusion Engine (P10b).
// Provides physical scene lighting (MeshStandardMaterial / MeshPhysicalMaterial / custom PBR shaders),
// depth buffer participation (depthWrite: true, depthTest: true) for physical Depth-of-Field (P7b),
// volumetric/particle occlusion masks and depth-sorting, and per-glyph world-space bounding boxes
// and finite, repulsive deflection vectors.

import * as THREE from 'three';
import { W, H, makeRT } from './gl';
import { calcCoC, linearizeDepth } from './dof';
import { ExtrudedText, type ExtrudedGlyph, type ExtrudedTextOpts } from './text3d';
import { getGlyph } from './vectorglyphs';
import { ViewportSpace } from './viewport';
import { deflectPoint, type GlyphObstacle } from './textfx';
import type { V3 } from './util';

/* ───────────────────────────── Interfaces ───────────────────────────── */

export interface InWorldLightingOpts {
  color?: THREE.ColorRepresentation;
  roughness?: number;
  metalness?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  envMapIntensity?: number;
  /** Whether to use MeshPhysicalMaterial instead of MeshStandardMaterial (default false). */
  physical?: boolean;
  /** Explicit custom material to apply (overrides procedural PBR creation). */
  material?: THREE.Material | THREE.Material[];
  /** Force depthWrite: true so text participates in scene depth buffer (default true). */
  depthWrite?: boolean;
  /** Force depthTest: true so text respects depth testing (default true). */
  depthTest?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Custom shader uniforms if using custom PBR / ShaderMaterial. */
  customUniforms?: Record<string, THREE.IUniform>;
}

export type InWorldTextOpts = ExtrudedTextOpts & InWorldLightingOpts;


export interface InWorldText2DOpts {
  size?: number; // Character height in world units (default 1.0)
  letterSpacing?: number; // Extra space between glyphs (default 0.18)
  fixedAdvance?: boolean;
  lighting?: InWorldLightingOpts;
  material?: THREE.Material;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export interface GlyphWorldBounds {
  index: number;
  char: string;
  word: number;
  /** Centroid of the glyph bounding box in world space [x, y, z] */
  center: [number, number, number];
  centerVec: THREE.Vector3;
  /** World-space bounding box */
  box: THREE.Box3;
  min: [number, number, number];
  max: [number, number, number];
  size: THREE.Vector3;
  /** Bounding sphere radius */
  radius: number;
  /** Screen-space projection [x, y, viewDepth] in logical pixels, or null if off-camera */
  screen: [number, number, number] | null;
  /** Spherical obstacle representation for deflectPoint */
  obstacle: GlyphObstacle;
  /** Three.js Mesh for this individual glyph */
  mesh: THREE.Mesh;
}

export interface ExtrudedTextLayout {
  text: string;
  group: THREE.Group;
  glyphs: GlyphWorldBounds[];
  boundingBox: THREE.Box3;
  center: THREE.Vector3;
  size: THREE.Vector3;
  /** World-space depth plane through text center with normal facing camera */
  depthPlane: THREE.Plane;
  /** World Z coordinate of front-most surface */
  frontZ: number;
  /** Array of spherical obstacles for collision / deflection */
  obstacles: GlyphObstacle[];
  getGlyph: (index: number) => GlyphWorldBounds | undefined;
  getGlyphsByChar: (char: string) => GlyphWorldBounds[];
}

export interface TextOcclusionMaskOpts {
  width?: number;
  height?: number;
  near?: number;
  far?: number;
  renderTarget?: THREE.WebGLRenderTarget;
}

export interface ParticleOcclusionPartition {
  foregroundIndices: number[];
  backgroundIndices: number[];
  foregroundPositions: [number, number, number][];
  backgroundPositions: [number, number, number][];
  textDepth: number;
}

/* ───────────────────────────── Core Implementation ───────────────────────────── */

/**
 * Ensures that all meshes in the target hierarchy participate in the scene depth buffer.
 */
export function ensureDepthParticipation(target: THREE.Object3D): void {
  target.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          if (m) {
            m.depthWrite = true;
            m.depthTest = true;
          }
        });
      } else if (mesh.material) {
        mesh.material.depthWrite = true;
        mesh.material.depthTest = true;
      }
    }
  });
}

/**
 * Applies physical scene lighting shaders (MeshStandardMaterial / MeshPhysicalMaterial / custom shader)
 * to ExtrudedText or 2D text meshes, guaranteeing depth buffer participation and shadow properties.
 */
export function applyInWorldLighting(target: THREE.Object3D, opts: InWorldLightingOpts = {}): void {
  const depthWrite = opts.depthWrite ?? true;
  const depthTest = opts.depthTest ?? true;
  const castShadow = opts.castShadow ?? true;
  const receiveShadow = opts.receiveShadow ?? true;

  target.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;

      if (opts.material) {
        mesh.material = opts.material;
      } else if (!mesh.material || !(mesh.material instanceof THREE.MeshStandardMaterial)) {
        mesh.material = opts.physical || opts.clearcoat !== undefined
          ? new THREE.MeshPhysicalMaterial({
              color: opts.color ?? 0xe8e4da,
              roughness: opts.roughness ?? 0.3,
              metalness: opts.metalness ?? 0.2,
              emissive: opts.emissive ?? 0x000000,
              emissiveIntensity: opts.emissiveIntensity ?? 1.0,
              clearcoat: opts.clearcoat ?? 0.0,
              clearcoatRoughness: opts.clearcoatRoughness ?? 0.1,
              envMapIntensity: opts.envMapIntensity ?? 1.0,
              depthWrite,
              depthTest,
            })
          : new THREE.MeshStandardMaterial({
              color: opts.color ?? 0xe8e4da,
              roughness: opts.roughness ?? 0.3,
              metalness: opts.metalness ?? 0.2,
              emissive: opts.emissive ?? 0x000000,
              emissiveIntensity: opts.emissiveIntensity ?? 1.0,
              envMapIntensity: opts.envMapIntensity ?? 1.0,
              depthWrite,
              depthTest,
            });
      } else {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (opts.color !== undefined) mat.color.set(opts.color as any);
        if (opts.roughness !== undefined) mat.roughness = opts.roughness;
        if (opts.metalness !== undefined) mat.metalness = opts.metalness;
        if (opts.emissive !== undefined) mat.emissive.set(opts.emissive as any);
        if (opts.emissiveIntensity !== undefined) mat.emissiveIntensity = opts.emissiveIntensity;
        if (opts.envMapIntensity !== undefined) mat.envMapIntensity = opts.envMapIntensity;
        mat.depthWrite = depthWrite;
        mat.depthTest = depthTest;
        mat.needsUpdate = true;
      }

      if (opts.customUniforms && (mesh.material as THREE.ShaderMaterial).uniforms) {
        const sm = mesh.material as THREE.ShaderMaterial;
        for (const [k, v] of Object.entries(opts.customUniforms)) {
          sm.uniforms[k] = v;
        }
        sm.needsUpdate = true;
      }
    }
  });

  ensureDepthParticipation(target);
}

/**
 * Creates an in-world 3D extruded text mesh group with scene lighting and full depth buffer participation.
 */
export function createInWorldText(text: string, opts: InWorldTextOpts = {}): THREE.Group {
  const group = ExtrudedText.create(text, opts);
  applyInWorldLighting(group, opts);
  return group;
}

/**
 * Creates an in-world 2D planar vector text mesh group with scene lighting and full depth buffer participation.
 */
export function createInWorldText2D(text: string, opts: InWorldText2DOpts = {}): THREE.Group {
  const size = opts.size ?? 1.0;
  const letterSpacing = opts.letterSpacing ?? 0.18;
  const fixedAdvance = opts.fixedAdvance ?? false;

  const defaultMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8e4da,
    roughness: 0.3,
    metalness: 0.2,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  const material = opts.material ?? defaultMaterial;

  const group = new THREE.Group();
  let currentX = 0;
  let wordIdx = 0;
  let prevSpace = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === ' ' || char === '\t') {
      currentX += size * 0.5;
      if (!prevSpace) wordIdx++;
      prevSpace = true;
      continue;
    }
    if (char === '\n' || char === '\r') {
      continue;
    }

    prevSpace = false;
    const info = getGlyph(char);
    const adv = info && !fixedAdvance ? info.advance : 0.85;
    if (info) {
      const geom = new THREE.ShapeGeometry(info.shapes);
      geom.scale(size, size, 1.0);

      const mesh = new THREE.Mesh(geom, material);
      mesh.position.set(fixedAdvance ? currentX : currentX + size * (adv - (info.x1 - info.x0)) / 2 - size * info.x0, 0, 0);
      mesh.castShadow = opts.castShadow ?? true;
      mesh.receiveShadow = opts.receiveShadow ?? true;
      mesh.userData.glyph = { index: i, char, word: wordIdx, advance: size * adv };
      group.add(mesh);
    }

    currentX += size * (adv + letterSpacing);
  }

  const totalWidth = currentX - size * letterSpacing;
  for (const child of group.children) {
    child.position.x -= totalWidth / 2;
    child.userData.glyph.base = [child.position.x, child.position.y, child.position.z];
  }

  applyInWorldLighting(group, opts.lighting);
  return group;
}

/**
 * Extracts world-space layout, per-glyph bounding boxes, centroids, obstacles, and depth plane.
 */
export function getTextLayout(
  group: THREE.Group,
  camera?: THREE.Camera,
  viewportW = 1920,
  viewportH = 1080,
): ExtrudedTextLayout {
  group.updateMatrixWorld(true);
  const totalBox = new THREE.Box3();
  const glyphs: GlyphWorldBounds[] = [];
  const obstacles: GlyphObstacle[] = [];
  const box = new THREE.Box3();
  const c = new THREE.Vector3();
  const sz = new THREE.Vector3();

  for (const child of group.children) {
    const mesh = child as THREE.Mesh;
    const g = mesh.userData?.glyph as { index: number; char: string; word: number } | undefined;
    if (!g || !mesh.isMesh) continue;

    box.setFromObject(mesh);
    totalBox.union(box);
    box.getCenter(c);
    box.getSize(sz);

    const center: [number, number, number] = [c.x, c.y, c.z];
    const centerVec = c.clone();
    const radius = Math.hypot(sz.x, sz.y, sz.z) / 2;
    const obstacle: GlyphObstacle = { c: center, r: radius };
    obstacles.push(obstacle);

    let screen: [number, number, number] | null = null;
    if (camera) {
      screen = ViewportSpace.worldToScreen(center, camera, viewportW, viewportH);
    }

    glyphs.push({
      index: g.index,
      char: g.char,
      word: g.word,
      center,
      centerVec,
      box: box.clone(),
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
      size: sz.clone(),
      radius,
      screen,
      obstacle,
      mesh,
    });
  }

  glyphs.sort((a, b) => a.index - b.index);

  const groupCenter = new THREE.Vector3();
  const groupSize = new THREE.Vector3();
  if (!totalBox.isEmpty()) {
    totalBox.getCenter(groupCenter);
    totalBox.getSize(groupSize);
  }

  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion())).normalize();
  if (camera) {
    camera.updateMatrixWorld(true);
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    const toCam = camPos.clone().sub(groupCenter).normalize();
    if (normal.dot(toCam) < 0) {
      normal.negate();
    }
  }

  const depthPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, groupCenter);
  const textStr = glyphs.map((g) => g.char).join('');

  return {
    text: textStr,
    group,
    glyphs,
    boundingBox: totalBox,
    center: groupCenter,
    size: groupSize,
    depthPlane,
    frontZ: totalBox.max.z,
    obstacles,
    getGlyph: (idx: number) => glyphs.find((g) => g.index === idx),
    getGlyphsByChar: (char: string) => glyphs.filter((g) => g.char === char),
  };
}

/**
 * Computes Optical Circle of Confusion (CoC) in pixels for in-world text at its distance from camera.
 * Participates directly with DepthDoFPass (P7b).
 */
export function computeTextCoC(
  text: THREE.Object3D | ExtrudedTextLayout | THREE.Vector3 | [number, number, number],
  camera: THREE.Camera,
  focusDistance: number,
  aperture: number,
  maxRadius = 24.0,
): number {
  camera.updateMatrixWorld(true);
  let worldPos: THREE.Vector3;
  if (Array.isArray(text)) {
    worldPos = new THREE.Vector3(text[0], text[1], text[2]);
  } else if (text instanceof THREE.Vector3) {
    worldPos = text.clone();
  } else if ('center' in text && text.center instanceof THREE.Vector3) {
    worldPos = text.center.clone();
  } else if ((text as THREE.Object3D).isObject3D) {
    const obj = text as THREE.Object3D;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    worldPos = box.getCenter(new THREE.Vector3());
  } else {
    worldPos = new THREE.Vector3();
  }

  const eyePos = worldPos.clone().applyMatrix4(camera.matrixWorldInverse);
  const eyeDepth = -eyePos.z;

  return calcCoC(eyeDepth, focusDistance, aperture, maxRadius);
}

/**
 * Computes Optical Circle of Confusion (CoC) in pixels for an individual glyph.
 */
export function computeGlyphCoC(
  glyph: GlyphWorldBounds | ExtrudedGlyph,
  camera: THREE.Camera,
  focusDistance: number,
  aperture: number,
  maxRadius = 24.0,
): number {
  const center = 'centerVec' in glyph ? glyph.centerVec : glyph.center;
  return computeTextCoC(center, camera, focusDistance, aperture, maxRadius);
}

/**
 * Exports an occlusion mask render target for volumetric fog and particle occlusion.
 * Renders text silhouette and depth into a dedicated WebGLRenderTarget.
 */
export function createTextOcclusionMask(
  renderer: THREE.WebGLRenderer,
  textObject: THREE.Object3D,
  camera: THREE.Camera,
  opts: TextOcclusionMaskOpts = {},
): THREE.WebGLRenderTarget {
  const width = opts.width ?? W;
  const height = opts.height ?? H;
  const rt = opts.renderTarget ?? makeRT(width, height, { depthTexture: true });

  const maskScene = new THREE.Scene();
  maskScene.background = new THREE.Color(0x000000);

  const maskMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
  });

  const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  textObject.traverse((ch) => {
    if ((ch as THREE.Mesh).isMesh) {
      const mesh = ch as THREE.Mesh;
      originalMaterials.set(mesh, mesh.material);
      mesh.material = maskMat;
    }
  });

  const originalParent = textObject.parent;
  maskScene.add(textObject);

  if (renderer && typeof renderer.render === 'function') {
    const prevRT = typeof renderer.getRenderTarget === 'function' ? renderer.getRenderTarget() : null;
    if (typeof renderer.setRenderTarget === 'function') renderer.setRenderTarget(rt);
    if (typeof renderer.clear === 'function') renderer.clear(true, true, true);
    renderer.render(maskScene, camera);
    if (typeof renderer.setRenderTarget === 'function') renderer.setRenderTarget(prevRT);
  }

  if (originalParent) originalParent.add(textObject);
  else maskScene.remove(textObject);

  for (const [mesh, mat] of originalMaterials) {
    mesh.material = mat;
  }
  maskMat.dispose();

  return rt;
}

/**
 * Partitions particles into foreground and background relative to the in-world text depth plane.
 * Allows LargeParticles and volumetric fog to pass both behind and in front of text meshes.
 */
export function partitionParticlesByTextDepth(
  positions: [number, number, number][] | THREE.Vector3[] | Float32Array,
  text: THREE.Object3D | ExtrudedTextLayout | THREE.Plane,
  camera: THREE.Camera,
): ParticleOcclusionPartition {
  camera.updateMatrixWorld(true);

  let textCenter: THREE.Vector3;

  if (text instanceof THREE.Plane) {
    textCenter = text.coplanarPoint(new THREE.Vector3());
  } else if ('depthPlane' in text && text.depthPlane instanceof THREE.Plane) {
    textCenter = text.center;
  } else if ((text as THREE.Object3D).isObject3D) {
    const layout = getTextLayout(text as THREE.Group, camera);
    textCenter = layout.center;
  } else {
    textCenter = new THREE.Vector3();
  }

  const eyeText = textCenter.clone().applyMatrix4(camera.matrixWorldInverse);
  const textEyeDepth = -eyeText.z;

  const foregroundIndices: number[] = [];
  const backgroundIndices: number[] = [];
  const foregroundPositions: [number, number, number][] = [];
  const backgroundPositions: [number, number, number][] = [];

  const tempV = new THREE.Vector3();

  if (positions instanceof Float32Array) {
    const count = Math.floor(positions.length / 3);
    for (let i = 0; i < count; i++) {
      const px = positions[i * 3]!;
      const py = positions[i * 3 + 1]!;
      const pz = positions[i * 3 + 2]!;
      tempV.set(px, py, pz).applyMatrix4(camera.matrixWorldInverse);
      const eyeZ = -tempV.z;
      const posTuple: [number, number, number] = [px, py, pz];

      if (eyeZ < textEyeDepth) {
        foregroundIndices.push(i);
        foregroundPositions.push(posTuple);
      } else {
        backgroundIndices.push(i);
        backgroundPositions.push(posTuple);
      }
    }
  } else {
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]!;
      let px: number, py: number, pz: number;
      if (Array.isArray(p)) {
        [px, py, pz] = p;
      } else {
        px = p.x; py = p.y; pz = p.z;
      }
      tempV.set(px, py, pz).applyMatrix4(camera.matrixWorldInverse);
      const eyeZ = -tempV.z;
      const posTuple: [number, number, number] = [px, py, pz];

      if (eyeZ < textEyeDepth) {
        foregroundIndices.push(i);
        foregroundPositions.push(posTuple);
      } else {
        backgroundIndices.push(i);
        backgroundPositions.push(posTuple);
      }
    }
  }

  return {
    foregroundIndices,
    backgroundIndices,
    foregroundPositions,
    backgroundPositions,
    textDepth: textEyeDepth,
  };
}

/**
 * Computes a finite, strictly repulsive deflection vector pushing a particle away from a glyph centroid.
 * Uses the smooth radial mapping r' = (r^3 + R^3)^(1/3) with guaranteed finite bound at r = 0.
 */
export function computeGlyphDeflectionVector(
  p: V3 | THREE.Vector3,
  glyphOrObstacle: GlyphWorldBounds | GlyphObstacle | ExtrudedGlyph | THREE.Vector3 | [number, number, number],
  radius = 1.0,
  strength = 1.0,
): V3 {
  let px: number, py: number, pz: number;
  if (Array.isArray(p)) {
    [px, py, pz] = p;
  } else {
    px = p.x; py = p.y; pz = p.z;
  }

  let cx = 0, cy = 0, cz = 0, r = radius;
  if ('obstacle' in glyphOrObstacle) {
    const o = glyphOrObstacle.obstacle;
    [cx, cy, cz] = o.c;
    r = o.r;
  } else if ('c' in glyphOrObstacle && 'r' in glyphOrObstacle) {
    [cx, cy, cz] = glyphOrObstacle.c;
    r = glyphOrObstacle.r;
  } else if ('center' in glyphOrObstacle && 'radius' in glyphOrObstacle) {
    [cx, cy, cz] = glyphOrObstacle.center;
    r = glyphOrObstacle.radius;
  } else if (glyphOrObstacle instanceof THREE.Vector3) {
    cx = glyphOrObstacle.x; cy = glyphOrObstacle.y; cz = glyphOrObstacle.z;
    r = radius;
  } else if (Array.isArray(glyphOrObstacle)) {
    [cx, cy, cz] = glyphOrObstacle;
    r = radius;
  }

  const dx = px - cx;
  const dy = py - cy;
  const dz = pz - cz;
  const d = Math.hypot(dx, dy, dz);

  // Smooth radial mapping r' = (r^3 + R^3)^(1/3)
  const nd = Math.cbrt(d * d * d + r * r * r);
  const delta = (nd - d) * strength;

  if (d > 1e-7) {
    const factor = delta / d;
    return [dx * factor, dy * factor, dz * factor];
  } else {
    // Exactly at centroid: finite repulsive displacement along canonical +Y
    return [0, delta, 0];
  }
}

/**
 * Deflects a 3D point around a glyph obstacle.
 */
export function deflectPointFromGlyph(
  p: V3 | THREE.Vector3,
  glyph: GlyphWorldBounds | GlyphObstacle | ExtrudedGlyph | THREE.Vector3 | [number, number, number],
  radius = 1.0,
  strength = 1.0,
): V3 {
  const v = computeGlyphDeflectionVector(p, glyph, radius, strength);
  const px = Array.isArray(p) ? p[0] : p.x;
  const py = Array.isArray(p) ? p[1] : p.y;
  const pz = Array.isArray(p) ? p[2] : p.z;
  return [px + v[0], py + v[1], pz + v[2]];
}

/**
 * Deflects an entire particle position buffer (Float32Array) around all glyph obstacles.
 */
export function deflectParticles(
  positions: Float32Array,
  layoutOrObstacles: ExtrudedTextLayout | GlyphObstacle[],
  strength = 1.0,
): void {
  const obstacles = Array.isArray(layoutOrObstacles) ? layoutOrObstacles : layoutOrObstacles.obstacles;
  if (obstacles.length === 0) return;

  const count = Math.floor(positions.length / 3);
  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const p: V3 = [positions[idx]!, positions[idx + 1]!, positions[idx + 2]!];
    const def = deflectPoint(p, obstacles, strength);
    positions[idx] = def[0];
    positions[idx + 1] = def[1];
    positions[idx + 2] = def[2];
  }
}

/* ───────────────────────────── InWorldTextHelper Facade ───────────────────────────── */

export class InWorldTextHelper {
  static applyLighting = applyInWorldLighting;
  static ensureDepthParticipation = ensureDepthParticipation;
  static create3D = createInWorldText;
  static create2D = createInWorldText2D;
  static getLayout = getTextLayout;
  static computeCoC = computeTextCoC;
  static computeGlyphCoC = computeGlyphCoC;
  static createOcclusionMask = createTextOcclusionMask;
  static partitionParticles = partitionParticlesByTextDepth;
  static deflectionVector = computeGlyphDeflectionVector;
  static deflectPoint = deflectPointFromGlyph;
  static deflectParticles = deflectParticles;
  static linearizeDepth = linearizeDepth;
  static calcCoC = calcCoC;
}
