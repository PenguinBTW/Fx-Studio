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
import { ViewportSpace } from './viewport';

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
  /** Clip-time offset in seconds added after scaling (e.g. Blender frame_start / fps). */
  offset?: number;
}

/** Project world-space box corners to screen [xMin, yMin, xMax, yMax]; [0,0,0,0] when empty or fully off-screen. */
export function screenBoundsOfBox(
  box: THREE.Box3,
  camera: THREE.Camera,
  viewportWidth = 1920,
  viewportHeight = 1080,
): [number, number, number, number] {
  if (box.isEmpty()) return [0, 0, 0, 0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let anyVisible = false;
  for (let i = 0; i < 8; i++) {
    const x = i & 1 ? box.max.x : box.min.x;
    const y = i & 2 ? box.max.y : box.min.y;
    const z = i & 4 ? box.max.z : box.min.z;
    const proj = ViewportSpace.worldToScreen([x, y, z], camera, viewportWidth, viewportHeight);
    if (!proj) continue;
    anyVisible = true;
    minX = Math.min(minX, proj[0]); maxX = Math.max(maxX, proj[0]);
    minY = Math.min(minY, proj[1]); maxY = Math.max(maxY, proj[1]);
  }
  if (!anyVisible) return [0, 0, 0, 0];
  return [
    Math.max(0, Math.floor(minX)),
    Math.max(0, Math.floor(minY)),
    Math.min(viewportWidth, Math.ceil(maxX)),
    Math.min(viewportHeight, Math.ceil(maxY)),
  ];
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
  /** Stable part handles: nodes with a `fx_part` (or `fx.part`) custom property, plus `definePart()` / manifest parts. */
  readonly parts = new Map<string, THREE.Object3D>();
  /** Cameras and lights exported from the DCC (glTF cameras, KHR_lights_punctual). */
  readonly cameras: THREE.Camera[] = [];
  readonly lights: THREE.Light[] = [];
  /** Morph target (shape key) names available on this model. */
  readonly morphTargets = new Set<string>();
  /** Per-clip defaults (offset, loop, timeScale), e.g. from an asset manifest. Explicit options win. */
  clipDefaults: Record<string, AnimationPlayOptions> = {};
  private warnedMorphs = new Set<string>();
  /** Materials created for this instance (e.g. by material-library factories); disposed with it. */
  readonly ownedMaterials: THREE.Material[] = [];

  constructor(gltf: GLTF, clonedRoot: THREE.Group, opts?: GLTFLoadOptions) {
    this.gltf = gltf;
    this.root = clonedRoot;
    this.animations = gltf.animations ?? [];

    // 0. Material-sharing isolation: SkeletonUtils.clone shares material references
    // across instances and with the cached master, so per-instance overrides
    // (envMapIntensity) would otherwise mutate every other instance of the same asset.
    // Clone the materials up front when an override is requested — memoized by source
    // material so meshes that share one still share the clone within this instance.
    if (opts?.envMapIntensity !== undefined) {
      const cloned = new Map<THREE.Material, THREE.Material>();
      this.root.traverse((node) => {
        if (!(node as THREE.Mesh).isMesh) return;
        const mesh = node as THREE.Mesh;
        const swapOne = (m: THREE.Material): THREE.Material => {
          let c = cloned.get(m);
          if (!c) {
            c = m.clone();
            c.name = m.name;
            cloned.set(m, c);
            this.ownedMaterials.push(c);
          }
          return c;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swapOne) : swapOne(mesh.material);
      });
    }

    // 1. Catalog all child meshes, geometries, and materials
    this.root.traverse((node) => {
      const ud = node.userData as Record<string, any> | undefined;
      const partId = ud?.fx_part ?? ud?.['fx.part'] ?? ud?.fx?.part;
      if (typeof partId === 'string' && partId) this.parts.set(partId, node);
      if ((node as THREE.Camera).isCamera) this.cameras.push(node as THREE.Camera);
      if ((node as THREE.Light).isLight) {
        const light = node as THREE.Light & { target?: THREE.Object3D };
        // SkeletonUtils.clone leaves directional/spot targets unparented; re-link so the light keeps its exported aim.
        if (light.target && !light.target.parent) {
          light.target.position.set(0, 0, -1);
          light.add(light.target);
        }
        this.lights.push(light);
      }
      if ((node as THREE.Mesh).isMesh) {
        for (const name of Object.keys((node as THREE.Mesh).morphTargetDictionary ?? {})) this.morphTargets.add(name);
      }
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
    opts = clipName ? { ...this.clipDefaults[clipName], ...opts } : opts;

    if (clipName) {
      const targetAction = this.actions.get(clipName);
      if (!targetAction) console.warn(`[gltf] Animation clip '${clipName}' not found. Clips: ${this.clipNames.join(', ') || 'none'}`);
      if (targetAction) {
        // Single-clip mode: stop anything left running (e.g. by setClips) and play at full weight.
        for (const a of this.actions.values()) if (a !== targetAction && a.isScheduled()) a.stop();
        if (!targetAction.isRunning()) targetAction.reset().play();
        targetAction.setEffectiveWeight(1);
        targetAction.loop = opts?.loop === false ? THREE.LoopOnce : THREE.LoopRepeat;
        targetAction.clampWhenFinished = opts?.loop === false;
      }
    }

    const scale = opts?.timeScale ?? 1.0;
    // A setTime timeScale replaces (not compounds with) any play()-level action.timeScale.
    const target = clipName ? this.actions.get(clipName) : undefined;
    const override = opts?.timeScale !== undefined && target ? target : undefined;
    const prevScale = override?.timeScale ?? 1;
    if (override) override.timeScale = 1;
    this.mixer.setTime(Math.max(0, timeInSeconds * scale + (opts?.offset ?? 0)));
    if (override) override.timeScale = prevScale;
    return this;
  }

  /** Clip names in export order (Blender actions / NLA tracks). */
  get clipNames(): string[] {
    return this.animations.map((c) => c.name);
  }

  /**
   * Closed-form weighted blend of several clips at time t, e.g. `setClips(f.lt, { Walk: 1, Wave: 0.4 })`.
   * Clips not listed (or weight <= 0) are stopped. Per-clip defaults supply offset/loop/timeScale.
   */
  setClips(timeInSeconds: number, weights: Record<string, number | { weight: number; time?: number }>, opts?: AnimationPlayOptions): this {
    if (!this.mixer) return this;
    for (const name of Object.keys(weights)) {
      if (!this.actions.has(name)) console.warn(`[gltf] Animation clip '${name}' not found. Clips: ${this.clipNames.join(', ') || 'none'}`);
    }
    for (const [name, action] of this.actions) {
      const v = weights[name] ?? 0;
      const spec = typeof v === 'number' ? { weight: v } : v;
      // Unlisted clips drop to weight 0 but stay active, so the bound rest pose is not re-captured mid-shot.
      if (spec.weight <= 0) { if (action.isScheduled()) action.setEffectiveWeight(0); continue; }
      const o = { ...this.clipDefaults[name], ...opts };
      const dur = action.getClip().duration;
      const raw = Math.max(0, (spec.time ?? timeInSeconds) * (o.timeScale ?? 1) + (o.offset ?? 0));
      action.reset();
      action.loop = o.loop === false ? THREE.LoopOnce : THREE.LoopRepeat;
      action.clampWhenFinished = o.loop === false;
      action.play();
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(spec.weight);
      action.time = dur > 0 ? (o.loop === false ? Math.min(raw, dur) : raw % dur) : 0;
    }
    this.mixer.update(0);
    return this;
  }

  /**
   * Set a morph target (Blender shape key) weight on every mesh that has it.
   * Call after setTime/setClips: clip evaluation overwrites animated morph weights.
   */
  setMorph(name: string, weight: number, partId?: string): this {
    let found = false;
    const scope = partId ? this.meshesUnder(this.part(partId)) : this.meshes;
    for (const mesh of scope) {
      const idx = mesh.morphTargetDictionary?.[name];
      if (idx !== undefined && mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences[idx] = weight;
        found = true;
      }
    }
    if (!found && !this.warnedMorphs.has(name)) {
      this.warnedMorphs.add(name);
      console.warn(`[gltf] morph target '${name}' not found. Available: ${[...this.morphTargets].join(', ') || 'none'}`);
    }
    return this;
  }

  setMorphs(weights: Record<string, number>): this {
    for (const [name, w] of Object.entries(weights)) this.setMorph(name, w);
    return this;
  }

  /** Clip duration in seconds (0 when missing). */
  clipDuration(name: string): number {
    return this.actions.get(name)?.getClip().duration ?? 0;
  }

  private meshesUnder(obj: THREE.Object3D): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh); });
    return out;
  }

  /**
   * Node by name; throws so renamed Blender objects fail loudly. Accepts the Blender name
   * (`Rotor.001`) as well as three's sanitized name (`Rotor001`, duplicates get `_1`).
   */
  node(name: string): THREE.Object3D {
    // Original Blender name first, so `Rotor.001` never resolves to an unrelated node literally named `Rotor001`.
    let n: THREE.Object3D | undefined;
    this.root.traverse((o) => { if (!n && o.userData?.name === name) n = o; });
    n ??= this.root.getObjectByName(name) ?? this.root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
    if (!n) throw new Error(`[gltf] node '${name}' not found in model`);
    return n;
  }

  /** Stable part handle (see `parts`). Throws with the available ids when missing. */
  part(id: string): THREE.Object3D {
    const p = this.parts.get(id);
    if (!p) {
      throw new Error(`[gltf] part '${id}' not found. Parts: ${[...this.parts.keys()].join(', ') || 'none'} (set a 'fx_part' custom property in Blender, or map it in manifest.parts)`);
    }
    return p;
  }

  /** Register a part id for a named node. */
  definePart(id: string, nodeName: string): this {
    this.parts.set(id, this.node(nodeName));
    return this;
  }

  /** Screen bounds of one part (world box of its subtree). */
  getPartScreenBounds(id: string, camera: THREE.Camera, viewportWidth = 1920, viewportHeight = 1080): [number, number, number, number] {
    const obj = this.part(id);
    obj.updateWorldMatrix(true, true);
    return screenBoundsOfBox(new THREE.Box3().setFromObject(obj), camera, viewportWidth, viewportHeight);
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
    if (box.isEmpty()) return this;
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
    if (box.isEmpty()) return this;
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
    return screenBoundsOfBox(this.getBounds(), camera, viewportWidth, viewportHeight);
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
    this.root.clear();
    for (const m of this.ownedMaterials) m.dispose();
    this.ownedMaterials.length = 0;
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
          this.cache.delete(url);
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

  /** Drop one URL from the cache (instances already created keep working). */
  static release(url: string): void {
    this.cache.delete(url);
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
