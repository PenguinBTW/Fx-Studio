// Universal GLTF / GLB 3D Asset Loading, Instancing & Deterministic Animation Engine (GLTFManager)
// Provides:
// 1. Asynchronous preloading and global deduplicated asset caching
// 2. Pure closed-form deterministic animation evaluation: model.setTime(t)
// 3. Robust instancing via SkeletonUtils.clone (clones skinned meshes & bones cleanly)
// 4. Automatic bounding box centering, scaling (fitToBox), and screen-space bounds projection
// 5. Clean GPU buffer and texture disposal
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

export interface GLTFLoadOptions {
  /** Optional custom path to Draco decoder libraries */
  dracoDecoderPath?: string;
  /** Automatically center model geometry at (0, 0, 0) upon instancing */
  center?: boolean;
  /** Automatically fit model bounding box to maximum dimension */
  fit?: number;
  /** Enable castShadow on all child meshes */
  castShadow?: boolean;
  /** Enable receiveShadow on all child meshes */
  receiveShadow?: boolean;
  /** Override environment map intensity across all PBR materials */
  envMapIntensity?: number;
  /** Optional custom material or material mapper */
  material?: THREE.Material | ((mesh: THREE.Mesh, original: THREE.Material) => THREE.Material);
}

export interface AnimationPlayOptions {
  /** Playback speed multiplier (default: 1.0) */
  timeScale?: number;
  /** Loop mode (default: true). If false, clamps at final frame */
  loop?: boolean;
}

/**
 * An instantiated, independent 3D GLTF model instance placed within a scene.
 */
export class GLTFInstance {
  readonly root: THREE.Group;
  readonly gltf: GLTF;
  readonly animations: THREE.AnimationClip[];
  readonly mixer: THREE.AnimationMixer | null = null;
  readonly actions = new Map<string, THREE.AnimationAction>();
  readonly materials = new Map<string, THREE.Material>();
  readonly meshes: THREE.Mesh[] = [];
  readonly geometries: THREE.BufferGeometry[] = [];

  constructor(gltf: GLTF, clonedRoot: THREE.Group, opts?: GLTFLoadOptions) {
    this.gltf = gltf;
    this.root = clonedRoot;
    this.animations = gltf.animations ?? [];

    // 1. Catalog all child meshes, geometries, and materials
    this.root.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        this.meshes.push(mesh);

        if (opts?.castShadow !== undefined) mesh.castShadow = opts.castShadow;
        if (opts?.receiveShadow !== undefined) mesh.receiveShadow = opts.receiveShadow;

        if (mesh.geometry && !this.geometries.includes(mesh.geometry)) {
          this.geometries.push(mesh.geometry);
        }

        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat) => {
            if (opts?.envMapIntensity !== undefined && 'envMapIntensity' in mat) {
              (mat as any).envMapIntensity = opts.envMapIntensity;
            }
            if (mat.name && !this.materials.has(mat.name)) {
              this.materials.set(mat.name, mat);
            }
          });

          // Optional material mapper
          if (opts?.material) {
            if (typeof opts.material === 'function') {
              mesh.material = opts.material(mesh, Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material);
            } else {
              mesh.material = opts.material;
            }
          }
        }
      }
    });

    // 2. Setup AnimationMixer if clips exist
    if (this.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(this.root);
      for (const clip of this.animations) {
        const action = this.mixer.clipAction(clip);
        this.actions.set(clip.name, action);
      }
      // Activate the default animation action if present
      const firstAction = this.actions.values().next().value;
      if (firstAction) firstAction.play();
    }

    // 3. Post-instantiation normalization options
    if (opts?.center) this.center();
    if (opts?.fit !== undefined && opts.fit > 0) this.fitToBox(opts.fit);
  }

  /**
   * Deterministic animation evaluation. Evaluates all active animation clips
   * at exact song/timeline timestamp `timeInSeconds` in pure closed form.
   *
   * @param timeInSeconds Global timeline time (f.t) or local scene time (f.lt).
   * @param clipName Optional name of specific animation clip to activate.
   * @param opts Optional playback parameters (timeScale, loop).
   */
  setTime(timeInSeconds: number, clipName?: string, opts?: AnimationPlayOptions): this {
    if (!this.mixer) return this;

    if (clipName) {
      const targetAction = this.actions.get(clipName);
      if (targetAction && !targetAction.isRunning()) {
        targetAction.play();
        if (opts?.loop === false) {
          targetAction.clampWhenFinished = true;
          targetAction.loop = THREE.LoopOnce;
        }
      }
    }

    const scale = opts?.timeScale ?? 1.0;
    const t = Math.max(0, timeInSeconds * scale);
    this.mixer.setTime(t);
    return this;
  }

  /**
   * Activate an animation clip by name with looping controls.
   */
  play(clipName: string, opts?: AnimationPlayOptions): THREE.AnimationAction | null {
    const action = this.actions.get(clipName);
    if (!action) {
      console.warn(`[gltf] Animation clip '${clipName}' not found on model.`);
      return null;
    }
    action.play();
    if (opts?.loop === false) {
      action.clampWhenFinished = true;
      action.loop = THREE.LoopOnce;
    }
    if (opts?.timeScale !== undefined) {
      action.timeScale = opts.timeScale;
    }
    return action;
  }

  /**
   * Computes the world-space bounding box of the model.
   * If the model contains SkinnedMeshes with animated skeletons, setting
   * `includeBones = true` (default) expands the box to encompass active bone world positions.
   */
  getBounds(target = new THREE.Box3(), includeBones = true): THREE.Box3 {
    this.root.updateMatrixWorld(true);
    try {
      target.setFromObject(this.root);
    } catch {
      // Fallback if skinned mesh attributes are missing or partially initialized in synthetic tests
      target.makeEmpty();
      for (const mesh of this.meshes) {
        if (mesh.geometry) {
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          if (mesh.geometry.boundingBox) {
            const meshBox = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
            target.union(meshBox);
          }
        }
      }
    }

    if (includeBones) {
      const bonePos = new THREE.Vector3();
      for (const mesh of this.meshes) {
        const skinned = mesh as THREE.SkinnedMesh;
        if (skinned.isSkinnedMesh && skinned.skeleton && Array.isArray(skinned.skeleton.bones)) {
          for (const bone of skinned.skeleton.bones) {
            bone.getWorldPosition(bonePos);
            target.expandByPoint(bonePos);
          }
        }
      }
    }

    return target;
  }

  /**
   * Computes the bounding size (width, height, depth) in world units.
   */
  getSize(target = new THREE.Vector3(), includeBones = true): THREE.Vector3 {
    const box = this.getBounds(undefined, includeBones);
    return box.getSize(target);
  }

  /**
   * Recenters model child vertices so the visual center of mass sits at (0, 0, 0).
   */
  center(includeBones = false): this {
    const box = this.getBounds(undefined, includeBones);
    const center = box.getCenter(new THREE.Vector3());
    for (const child of this.root.children) {
      child.position.sub(center);
    }
    return this;
  }

  /**
   * Uniformly scales model so its longest bounding axis equals `maxDimension` world units.
   */
  fitToBox(maxDimension: number, includeBones = false): this {
    const box = this.getBounds(undefined, includeBones);
    const size = box.getSize(new THREE.Vector3());
    const maxAxis = Math.max(size.x, size.y, size.z);
    if (maxAxis > 0) {
      const factor = maxDimension / maxAxis;
      this.root.scale.multiplyScalar(factor);
    }
    return this;
  }

  /**
   * Transforms 3D bounding box corners into 2D screen coordinates [xMin, yMin, xMax, yMax].
   * Integrates seamlessly with SceneGraph and Telemetry collision checking.
   */
  getScreenBounds(
    camera: THREE.Camera,
    viewportWidth = 1920,
    viewportHeight = 1080
  ): [number, number, number, number] {
    const box = this.getBounds();
    if (box.isEmpty()) return [0, 0, 0, 0];

    const corners = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ];

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const pt of corners) {
      pt.project(camera);
      // NDC [-1..1] to pixel [0..W, 0..H] (origin top-left)
      const px = (pt.x * 0.5 + 0.5) * viewportWidth;
      const py = (-pt.y * 0.5 + 0.5) * viewportHeight;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }

    return [
      Math.max(0, Math.floor(minX)),
      Math.max(0, Math.floor(minY)),
      Math.min(viewportWidth, Math.ceil(maxX)),
      Math.min(viewportHeight, Math.ceil(maxY)),
    ];
  }

  /**
   * Traverse all child meshes.
   */
  traverseMeshes(callback: (mesh: THREE.Mesh) => void): this {
    for (const mesh of this.meshes) {
      callback(mesh);
    }
    return this;
  }

  /**
   * Override materials across all child meshes.
   */
  setMaterial(material: THREE.Material): this {
    for (const mesh of this.meshes) {
      mesh.material = material;
    }
    return this;
  }

  /**
   * Release all cloned geometries, materials, textures, and animation mixer bindings.
   */
  dispose(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.root);
    }
    for (const mesh of this.meshes) {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          // Dispose textures attached to material
          for (const key of Object.keys(mat)) {
            const val = (mat as any)[key];
            if (val && typeof val === 'object' && 'isTexture' in val) {
              val.dispose();
            }
          }
          mat.dispose();
        }
      }
    }
    this.root.clear();
    this.meshes.length = 0;
    this.geometries.length = 0;
    this.materials.clear();
    this.actions.clear();
  }
}

/**
 * Parsed GLTF master asset cached in memory.
 */
export class GLTFAsset {
  constructor(public readonly url: string, public readonly gltf: GLTF) {}

  /**
   * Create an independent, clonable instance of this GLTF model for use in a scene.
   */
  instantiate(opts?: GLTFLoadOptions): GLTFInstance {
    // SkeletonUtils.clone clones meshes, bones, and skeletons properly without tearing bindings
    const clonedScene = skeletonClone(this.gltf.scene) as THREE.Group;
    return new GLTFInstance(this.gltf, clonedScene, opts);
  }
}

/**
 * Global GLTF Asset Manager & Preload Registry.
 */
export class GLTFManager {
  private static cache = new Map<string, Promise<GLTFAsset>>();
  private static loader: GLTFLoader | null = null;
  private static dracoLoader: DRACOLoader | null = null;
  /**
   * Default Draco decoder path.
   * Defaults to local bundled '/draco/' (served from app/public/draco/).
   * Can be overridden globally via setDracoDecoderPath() or per-model via GLTFLoadOptions.dracoDecoderPath.
   */
  private static dracoPath = '/draco/';

  /**
   * Configure global Draco decoder path.
   */
  static setDracoDecoderPath(path: string): void {
    this.dracoPath = path;
    if (this.dracoLoader) {
      this.dracoLoader.setDecoderPath(path);
    }
  }

  private static getLoader(customDracoPath?: string): GLTFLoader {
    const targetPath = customDracoPath ?? this.dracoPath;
    if (!this.loader) {
      this.loader = new GLTFLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath(targetPath);
      this.loader.setDRACOLoader(draco);
      this.dracoLoader = draco;
    } else if (customDracoPath && this.dracoLoader) {
      this.dracoLoader.setDecoderPath(customDracoPath);
    }
    return this.loader;
  }

  /**
   * Asynchronously load and cache a GLTF/GLB asset.
   * If already loaded, returns the cached promise immediately.
   */
  static load(url: string, opts?: GLTFLoadOptions): Promise<GLTFAsset> {
    const existing = this.cache.get(url);
    if (existing) return existing;

    const loader = this.getLoader(opts?.dracoDecoderPath);
    const promise = new Promise<GLTFAsset>((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          const asset = new GLTFAsset(url, gltf);
          resolve(asset);
        },
        undefined,
        (err) => {
          console.error(`[gltf] Failed to load model at '${url}':`, err);
          reject(err);
        }
      );
    });

    this.cache.set(url, promise);
    return promise;
  }

  /**
   * Load and directly instantiate a GLTF model.
   */
  static async instantiate(url: string, opts?: GLTFLoadOptions): Promise<GLTFInstance> {
    const asset = await this.load(url, opts);
    return asset.instantiate(opts);
  }

  /**
   * Clear all cached assets and release Draco loader workers.
   */
  static clearCache(): void {
    this.cache.clear();
    if (this.dracoLoader) {
      this.dracoLoader.dispose();
      this.dracoLoader = null;
    }
    this.loader = null;
  }
}

/** Convenience helper for quick loading */
export const loadGLTF = GLTFManager.instantiate.bind(GLTFManager);
