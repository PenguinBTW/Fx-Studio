// The traveller: Blender-built rigged swallow (assets/swallow), forward +z, up +y, wings along x.
// Pose is a closed-form blend of its Flap / Glide / Tuck clips.
import * as THREE from 'three';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';
import { resolveAsset, loadMaterialLibrary, applyMaterialSlots } from '../../engine/assets';

const FLAP_HZ = 3.6, FLAP_CLIP_S = 0.5;

export class Swallow {
  group = new THREE.Group();
  private inst: GLTFInstance | null = null;

  constructor(private scale = 1.8) {}

  async load(project: string) {
    const a = resolveAsset('swallow', project);
    const inst = await GLTFManager.instantiate(a.url, { ...a.manifest.load });
    inst.clipDefaults = { ...a.manifest.clips };
    if (a.manifest.materials) applyMaterialSlots(inst, a.manifest.materials, await loadMaterialLibrary(a.project));
    inst.root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && 'emissive' in m && !m.customProgramCacheKey().includes('plumage')) { m.emissive.copy(m.color).multiplyScalar(0.22); }
    });
    inst.root.scale.setScalar(this.scale);
    this.group.add(inst.root);
    this.inst = inst;
  }

  /** amp: 0 glide .. 1 full flap; fold: 0 open .. 1 wings tucked for a dive */
  pose(t: number, amp: number, fold: number) {
    if (!this.inst) return;
    const open = 1 - fold;
    this.inst.setClips(t, {
      Flap: { weight: open * amp, time: t * FLAP_HZ * FLAP_CLIP_S },
      Glide: open * (1 - amp),
      Tuck: fold,
    });
  }

  dispose() { this.inst?.dispose(); }
}
