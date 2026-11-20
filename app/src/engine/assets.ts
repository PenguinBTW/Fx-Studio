/// <reference types="vite/client" />
// Project-scoped asset registry. Each project (a folder under scenes/) owns its assets:
//   scenes/<project>/assets/<assetId>/model.glb       exported from Blender (or built by build.py)
//   scenes/<project>/assets/<assetId>/manifest.json   optional: parts, material slots, clip defaults, budgets
//   scenes/<project>/materials/<name>.ts              material library (default export: Material or () => Material)
// Models are imported through Vite (?url), so builds get content-hashed URLs and stale caches cannot occur.
import * as THREE from 'three';
import type { AnimationPlayOptions, GLTFInstance, GLTFLoadOptions } from './gltf';

export interface AssetManifest {
  /** Logical asset id (defaults to the folder name). */
  id?: string;
  /** Free-form version tag; bump on re-export so reviewers can tell builds apart. */
  version?: string | number;
  /** Model file inside the asset folder (default `model.glb`). */
  model?: string;
  /** Authoring source kept next to the model (`source.blend`, `build.py`). Informational. */
  source?: string;
  /** Uniform scale applied to the root after loading. */
  scale?: number;
  /** Stable part ids → node names. Nodes with a `fx_part` custom property are discovered automatically. */
  parts?: Record<string, string>;
  /** Blender material name → material library key (`scenes/<project>/materials/<key>.ts`). */
  materials?: Record<string, string>;
  /** Per-clip defaults used by `setTime` / `setClips` (offset in clip seconds, loop, timeScale). */
  clips?: Record<string, AnimationPlayOptions>;
  /** Budgets checked by `bun run assets:check`. */
  budgets?: { tris?: number; textureMB?: number };
  /** Default load options (center, fit, shadows, envMapIntensity). */
  load?: Omit<GLTFLoadOptions, 'material' | 'dracoDecoderPath'>;
}

export interface ResolvedAsset {
  project: string;
  id: string;
  url: string;
  manifest: AssetManifest;
}

export type MaterialFactory = () => THREE.Material;

// Globs live inside functions so non-Vite runtimes (bun tests importing the engine) never evaluate them.
function globAssets() {
  return {
    manifestFiles: import.meta.glob<AssetManifest>('../scenes/*/assets/*/manifest.json', { eager: true, import: 'default' }),
    modelFiles: import.meta.glob<string>('../scenes/*/assets/*/*.{glb,gltf}', { eager: true, query: '?url', import: 'default' }),
  };
}
function globMaterials() {
  return import.meta.glob<{ default: THREE.Material | MaterialFactory }>('../scenes/*/materials/*.ts');
}

const ASSET_PATH = /^\.\.\/scenes\/([^/]+)\/assets\/([^/]+)\/([^/]+)$/;
const MATERIAL_PATH = /^\.\.\/scenes\/([^/]+)\/materials\/([^/]+)\.ts$/;

function buildIndex(): Map<string, ResolvedAsset> {
  const { manifestFiles, modelFiles } = globAssets();
  const index = new Map<string, ResolvedAsset>();
  const folders = new Set<string>();
  for (const p of [...Object.keys(manifestFiles), ...Object.keys(modelFiles)]) {
    const m = ASSET_PATH.exec(p);
    if (m) folders.add(`${m[1]}/${m[2]}`);
  }
  for (const key of folders) {
    const [project, folder] = key.split('/') as [string, string];
    const manifest = manifestFiles[`../scenes/${key}/manifest.json`] ?? {};
    const file = manifest.model ?? (modelFiles[`../scenes/${key}/model.glb`] ? 'model.glb' : undefined);
    const url = file ? modelFiles[`../scenes/${key}/${file}`] : undefined;
    if (!url) continue;
    const id = manifest.id ?? folder;
    index.set(`${project}/${id}`, { project, id, url, manifest });
  }
  return index;
}

let assetIndexCache: Map<string, ResolvedAsset> | null = null;
const assetIndex = () => (assetIndexCache ??= buildIndex());

/** All assets, optionally filtered to one project. */
export function listAssets(project?: string | null): ResolvedAsset[] {
  return [...assetIndex().values()].filter((a) => !project || a.project === project);
}

/** Resolve `'<id>'` (current project) or `'<project>/<id>'`. Throws with the available ids when missing. */
export function resolveAsset(ref: string, project?: string | null): ResolvedAsset {
  const key = ref.includes('/') ? ref : `${project ?? ''}/${ref}`;
  const hit = assetIndex().get(key);
  if (hit) return hit;
  const proj = key.split('/')[0] || '(none)';
  const avail = listAssets(proj).map((a) => a.id).join(', ') || 'none';
  throw new Error(`[assets] asset '${ref}' not found in project '${proj}'. Available: ${avail}. Expected scenes/${proj}/assets/<id>/model.glb`);
}

const libraries = new Map<string, Promise<Map<string, THREE.Material>>>();

/** Loads the project's material library once (`scenes/<project>/materials/*.ts`). */
export function loadMaterialLibrary(project: string): Promise<Map<string, THREE.Material>> {
  let lib = libraries.get(project);
  if (!lib) {
    lib = (async () => {
      const out = new Map<string, THREE.Material>();
      for (const [path, load] of Object.entries(globMaterials())) {
        const m = MATERIAL_PATH.exec(path);
        if (!m || m[1] !== project) continue;
        const mod = await load();
        out.set(m[2]!, typeof mod.default === 'function' ? mod.default() : mod.default);
      }
      return out;
    })();
    libraries.set(project, lib);
  }
  return lib;
}

/** Replace materials by Blender material name using the project library. Throws on unknown names or keys. */
export function applyMaterialSlots(inst: GLTFInstance, slots: Record<string, string>, lib: Map<string, THREE.Material>): void {
  for (const [slot, key] of Object.entries(slots)) {
    if (!inst.materials.has(slot)) {
      throw new Error(`[assets] material slot '${slot}' not in model. Slots: ${[...inst.materials.keys()].join(', ') || 'none'}`);
    }
    if (!lib.has(key)) {
      throw new Error(`[assets] material '${key}' missing from library. Add scenes/<project>/materials/${key}.ts`);
    }
  }
  inst.traverseMeshes((mesh) => {
    const swap = (mat: THREE.Material) => {
      const key = slots[mat.name];
      return key ? lib.get(key)! : mat;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
}
