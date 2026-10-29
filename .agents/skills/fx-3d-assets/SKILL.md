---
name: fx-3d-assets
description: Ingestion standards, runtime caching, skeletal normalization, and deterministic animation workflows for importing and rendering external GLTF/GLB 3D models in f(x) Studio.
---
# f(x) Studio: 3D Asset Pipeline (GLTF / GLB)

Technical standards, memory invariants, normalization pipelines, and deterministic animation rules for importing, caching, and rendering external 3D models (`.glb` / `.gltf`) in **f(x) Studio**.

## When to Use

- Importing external 3D assets into `app/public/models/`.
- Preloading and instantiating models in scenes via `defineScene({ models: { ... } })` or `GLTFManager`.
- Evaluating skeletal animations, node rigs, and skinned meshes deterministically.
- Normalizing imported CAD geometry origins (`center()`) and scale (`fitToBox()`).
- Projecting 3D model bounding boxes to 2D screen coordinates (`getScreenBounds()`) to prevent text collisions (Rule `F04`).

---

## 1. The Four Asset Invariants [RULE]

Violating any of these invariants introduces headless export blank frames, animation jitter, or air-gapped CI failures:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           THE 4 GLTF ENGINE INVARIANTS                           │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 1. Zero Render-Time Preloading: Models must be fully ready before setup().       │
│ 2. Closed-Form Temporal Evaluation: Animations must evaluate as model.setTime(t).│
│ 3. Skeleton-Safe Instancing: All clones use SkeletonUtils.clone().               │
│ 4. Air-Gapped Local Draco: WASM decoders are bundled locally in /draco/.         │
└──────────────────────────────────────────────────────────────────────────────────┘
```

1. **Zero Render-Time Preloading:** Never initiate an asynchronous asset fetch inside `render()`. Assets must be preloaded in `models: { ... }` or during `init()`.
2. **Closed-Form Temporal Evaluation:** Never use `mixer.update(dt)`. Always evaluate animations via `model.setTime(t, clipName)`.
3. **Skeleton-Safe Instancing:** Always use `SkeletonUtils.clone()` via `asset.instantiate()` so bone matrices and skinned mesh bindings are cloned independently.
4. **Air-Gapped Local Draco:** Always resolve Draco decoders from local `/draco/` WebAssembly files to support offline rendering.

---

## 2. Asset Storage & Naming Conventions

- **Storage Location:** All binary models reside in **`app/public/models/`** (e.g., `app/public/models/jet_turbine.glb`).
- **Format Standard:** Strictly use binary `.glb`. Never use multi-file `.gltf` + `.bin` + `.png` folders, which trigger asynchronous HTTP waterfalls.
- **Vite Pathing:** In code, reference models via root-relative URLs: `'/models/jet_turbine.glb'`.

---

## 3. Scene Authoring Workflows

### 3.1 Declarative DSL Workflow (`defineScene`) - Optional (raw `Scene` subclasses are equally valid) [RULE]
Define assets in the `models` dictionary. The engine guarantees that all models are fetched, Draco-decompressed, and pre-instantiated before `setup()` runs:

```typescript
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { cubicEaseInOut } from '../../engine/motion';
import type { Frame } from '../../engine/scene';

export default defineScene({
  id: 'cad_hardware_showcase',

  // 1. Declarative Preloading & Normalization
  models: {
    heroModel: {
      url: '/models/chassis.glb',
      center: true,          // Recenter geometry mass to (0, 0, 0)
      fit: 4.5,              // Scale largest bounding dimension to 4.5 world units
      castShadow: true,
      receiveShadow: true,
      envMapIntensity: 1.5,
    },
  },

  setup(ctx: SceneContext) {
    // 2. Retrieve pre-instantiated model and add to 3D container
    const hero = ctx.getModel('heroModel')!;
    ctx.scene3D.add(hero.root);

    // 3. Setup Studio Three-Point Lighting
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(6, 8, 6);
    const rim = new THREE.DirectionalLight(0x38bdf8, 4.0);
    rim.position.set(-6, 3, -6);
    ctx.scene3D.add(key, rim, new THREE.AmbientLight(0xffffff, 0.25));

    ctx.rig.setLensMm(50);
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const hero = ctx.getModel('heroModel')!;

    // 4. Closed-Form Deterministic Animation (Time in seconds)
    hero.setTime(f.lt, 'ExplodedAssembly');

    // 5. Procedural Turntable Sweep
    const ease = cubicEaseInOut(Math.min(1.0, f.lt / 3.5));
    hero.root.rotation.y = f.lt * 0.35;

    ctx.rig.position = [Math.sin(ease * 0.7) * 8.0, 2.5, Math.cos(ease * 0.7) * 8.0];
    ctx.rig.target = [0, 0, 0];
    ctx.updateCamera(f.t, f.p);

    // 6. Prevent Text Collisions via Screen-Space Bounding Box
    const [minX, minY, maxX, maxY] = hero.getScreenBounds(ctx.threeCam, ctx.W, ctx.H);
    ctx.renderText('TITANIUM ALLOY CHASSIS', ctx.layer2d.ctx, f.t, 960, Math.max(80, minY - 40));

    // 7. Flush 3D scene, SDF badges, and typography to target
    ctx.flush(out, true);

    return { bloom: 0.15, vignette: 0.25 };
  },
});
```

### 3.2 Low-Level Raw `Scene` Workflow (`GLTFManager`)
When building custom multi-pass WebGL renderers:

```typescript
import * as THREE from 'three';
import { Scene, type SceneCtx, type Frame } from '../../engine/scene';
import { GLTFManager, type GLTFInstance } from '../../engine/gltf';

export default class CustomCadScene extends Scene {
  private chassis!: GLTFInstance;
  private scene3D = new THREE.Scene();
  private cam3D = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);

  override async init(): Promise<void> {
    // Asynchronously load and instantiate model before render loop starts
    this.chassis = await GLTFManager.instantiate('/models/chassis.glb', {
      center: true,
      fit: 5.0,
      castShadow: true,
    });

    this.scene3D.add(this.chassis.root);
    this.scene3D.add(new THREE.AmbientLight(0xffffff, 0.4));
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): void {
    const gl = this.ctx.renderer;

    // Closed-form temporal evaluation
    this.chassis.setTime(f.lt, 'CompressSuspension');

    gl.setRenderTarget(out);
    gl.clear(true, true, true);
    gl.render(this.scene3D, this.cam3D);
    gl.resetState(); // WebGL state cache restoration invariant
  }

  override dispose(): void {
    this.chassis.dispose();
  }
}
```

---

## 4. Deterministic Animation Evaluation: `setTime()` [RULE]

Never call `mixer.update(dt)`. Always call `model.setTime(timeInSeconds, clipName)`:

- **Bidirectional Seeking:** Scrubbing to $t = 12.5\text{s}$ or reversing backwards evaluates the exact bone transform at that instant.
- **Adaptive Motion Blur Sub-Sampling:** When supersampling 324 spp across a frame window, queries like $t \pm 0.002\text{s}$ sample cleanly without corrupting animation history.
- **Time Scaling:** Pass `{ timeScale: 0.5 }` to evaluate slow-motion sweeps cleanly:
  ```typescript
  hero.setTime(f.lt, 'Takeoff', { timeScale: 0.5, loop: THREE.LoopRepeat });
  ```

---

## 5. Geometry Normalization & Collision Telemetry

### 5.1 Centering & Scale Fitting
CAD models frequently export with off-center pivot origins or massive millimeter units.
- **`model.center(includeBones?)`**: Calculates the bounding center and shifts vertices so the mass center sits at $(0, 0, 0)$.
- **`model.fitToBox(targetDimension, includeBones?)`**: Scales the root group uniformly so its longest axis matches `targetDimension` in world units.
- **Animated Bone Support (`includeBones: true`):** Expands the bounding box to encapsulate moving bones, preventing limb clipping.

### 5.2 Screen-Space Bounding Box Projection (`getScreenBounds`)
To satisfy Rule `F04` (`text_collision`), project 3D models into 2D viewport coordinates before rendering titles:

```typescript
const [minX, minY, maxX, maxY] = model.getScreenBounds(ctx.threeCam, ctx.W, ctx.H);
// Safely position title above highest point of 3D mesh:
const textY = Math.max(80, minY - 30);
```

---

## 6. Pre-Flight 3D Asset Checklist

Before finalizing a scene containing external 3D models:

- [ ] **Binary Format:** Asset is stored as a single `.glb` file in `app/public/models/`.
- [ ] **Zero Render-Time Fetch:** Model is loaded via `models: { ... }` or inside `init()` (never in `render()`).
- [ ] **Closed-Form Timing:** Animations evaluate via `hero.setTime(f.lt, 'Clip')` (no `mixer.update()`).
- [ ] **Normalization Applied:** Model uses `center: true` and `fit: <dim>` to prevent origin/scale surprises.
- [ ] **Text Anti-Collision:** Screen bounds (`getScreenBounds()`) are checked to prevent text overlapping 3D meshes.
- [ ] **Resource Cleanup:** If using raw `Scene`, `instance.dispose()` is called in `dispose()`.