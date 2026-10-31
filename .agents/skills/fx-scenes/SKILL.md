---
name: fx-scenes
description: True 3D visual staging, physical optics (DoF, spectral lighting), CameraRig analytical choreography (dolly-zoom, orbits), kinetic polish, and deciding when to use Declarative DSL vs. going beyond DSL in f(x) Studio. Use when creating, modifying, or refactoring scenes in app/src/scenes/.
---
# f(x) Studio: True 3D Scene Authoring & Cinematic Craft

Standards, optical physics, camera choreography, motion polish, and architectural patterns for building visually stunning 3D scenes in **f(x) Studio**. Governs both the **Declarative Scene DSL** (`defineScene`) and **Advanced Multi-Pass Pipelines** (subclassing `Scene` directly).

## When to Use

- Creating, animating, or refactoring visual scenes in `app/src/scenes/<project>/`.
- Implementing high-fidelity 3D environments: physical PBR materials, in-world diegetic typography, and GLTF hero models.
- Choreographing 6-DOF cameras using analytical solvers (`solveDollyZoom`, `orbitPosition`, `focusDistance`, and Bishop splines).
- Applying physical thin-lens Circle-of-Confusion Depth of Field (`dof.ts`) and spectral blackbody lighting (`spectrum.ts`).
- Deciding between Declarative DSL (`defineScene`) and going beyond DSL (raw `Scene` subclass) for custom render passes.
- Layering cinematic motion (`Base` + `Hit` + `Tremor` + `Creep`) and keyframed spring overshoot.

---

## 1. Upstream & Sibling Skill Dependencies

Before authoring scenes, ensure alignment with connected production skills:
- **`video-design` (Universal Standards):** Zero HUD clutter, diegetic 3D text integration, continuous camera momentum, stylized 2.5D minimum, safe zone compliance.
- **`viopls-art-direction`:** Palette discipline (60/30/10 rule), anti-slop blacklist, unified materiality, and bold structural typography.
- **`design-around-audio` / `sound-design-and-foley`:** Downbeat anchoring, transient hit responses (`hit()`), and tactile micro-sync.
- **`fx-engine`:** Root architecture, coordinate conventions ($1920 \times 1080$), and engine invariants.
- **`fx-3d-assets`:** Ingesting, preloading (`models: { ... }`), and deterministically animating external GLTF/GLB models.
- **`fx-procedural-modeling`:** Authoring code-only shaders, procedural wireframes, ribbons, and mathematical textures.
- **`fx-kinetic-typography`:** Word staggers, numeric rollers, variable font axes, and in-world 3D extruded typography.
- **`fx-transitions`:** Seam continuity, camera momentum handoffs, and spatial transitions (`f.under`).
- **`fx-diagnostics`:** Running visual diagnostic instruments (`godview`, `onion`, `stitch`) to audit the finished scene.

---

## 2. Architecture Decision Framework: Declarative DSL vs. Going Beyond DSL [RULE]

f(x) Studio provides two scene authoring paths. Choose intentionally based on technical requirements:

```
                                [ SCENE ARCHITECTURE CHOICE ]
                                              │
              Does the scene require:
              • Multi-pass depth buffer sampling (physical Depth of Field via dof.ts)?
              • Custom fullscreen raw GLSL passes (raymarched SDFs, Cauchy dispersion)?
              • Scene-internal spatial transitions consuming f.under?
              • Ping-pong render targets or dynamic vertex buffer updates?
                                 │                           │
                                YES                          NO
                                 ▼                           ▼
                     [ GO BEYOND DSL ]               [ DECLARATIVE DSL ]
                 Subclass Scene Directly             Use defineScene()
                 • Manual render targets             • Automated lifecycle
                 • DepthTexture + DepthDoFPass       • Built-in rig & sceneGraph
                 • Explicit gl.resetState()          • Auto font gating & ducking
                 • Manual dispose() management       • Built-in flush() pipeline
```

### 2.1 The Declarative DSL (`defineScene`) Sweet Spot
Use `defineScene` for standard 3D staging, procedural materials, GLTF models, kinetic text, extruded 3D text, analytical particles, and SDF cards:
- **What it automates:** Gating on `document.fonts.ready`, `SceneGraph` telemetry registration, screen-bounds projection for collision rules (`F04`, `F05`), transition overlay ducking (`overlayDuck`), and automatic buffer flushing.
- **Usage Pattern:**
  ```typescript
  import { defineScene, type SceneContext, ProceduralMaterial } from '../../engine/dsl';
  import type { Frame } from '../../engine/scene';

  export default defineScene({
    id: 'hero_reveal',
    setup: async (ctx: SceneContext) => {
      // Setup camera waypoints along Catmull-Rom spline
      ctx.rig.setPath([
        { t: 0, pos: [0, 2, 8], target: [0, 0, 0] },
        { t: 1, pos: [0, 0.5, 3.5], target: [0, 0, 0] },
      ]);
    },
    render: (ctx: SceneContext, f: Frame, out) => {
      // Update camera along Catmull-Rom spline
      ctx.updateCamera(f.t, f.u);

      // Procedural animations (stateless f(t))
      // ...

      // Flush 3D scene, lines, SDFs, and 2D overlays into out target
      ctx.flush(out, true);
    },
  });
  ```

### 2.2 When to Go Beyond DSL (Raw `Scene` Subclass)
Subclass `Scene` directly when you require:
1. **Physical Depth-of-Field (`dof.ts`):** Requires rendering the 3D scene into a render target with a `THREE.DepthTexture`, then running `DepthDoFPass` before compositing 2D overlays.
2. **Fullscreen Raw GLSL Raymarching:** Custom fragment shaders evaluating volumetric Signed Distance Fields or fractal scale folds.
3. **Scene-Internal Spatial Transitions (`handlesTransition = true`):** Consuming `f.under` as an active 3D world texture on a portal, mirror, or aperture mesh.
4. **Dynamic Buffer Geometry Generators:** Dynamically updating vertex buffers per frame (e.g., dynamic `RibbonGeometry` sweeps).

### 2.3 Strict Invariants When Going Beyond DSL [MANDATORY]
If you subclass `Scene` directly, you take full ownership of the pipeline. You must strictly uphold these five invariants:
1. **Closed-Form Determinism:** Every property must evaluate as $\text{State} = f(t)$. No mutable `+= vel * dt` accumulators.
2. **Target Ownership & Clearing:** Explicitly clear or completely overwrite `out` via `renderer.setRenderTarget(out); renderer.clear(true, true, true);`.
3. **WebGL State Cache Restoration:** Always invoke `renderer.resetState()` immediately after raw WebGL passes, custom shaders, or `LineBatch` flushes.
4. **Explicit GPU Disposal:** In `dispose()`, traverse and dispose all geometries, materials, textures, and custom `WebGLRenderTarget` instances.
5. **Telemetry Synchronization:** If authoring custom hero nodes or text, publish screen-space bounding boxes to `window.__motion.textProbes` so diagnostics do not flag phantom omissions.

---

## 3. True Visually Beautiful 3D: Cinematic Optics & Camera Rig [RULE]

Never use or import the `@deprecated` `camera3d.ts`. True 3D in f(x) Studio utilizes `CameraRig` ([`app/src/engine/rig.ts`](file:///c:/Users/brosf/Documents/A%20vio%20projects/VioPls/Agentic%20motion%20design%20toolset/app/src/engine/rig.ts)) built on Three.js cameras, centripetal Catmull-Rom splines, and closed-form analytical solvers.

### 3.1 Analytical Dolly-Zoom (The Hitchcock Vertigo Effect)
To create dramatic spatial distortion while keeping the subject's screen scale perfectly constant down to sub-pixel tolerances ($< 4.44 \times 10^{-16}$ error):
```typescript
import { solveDollyZoom } from '../../engine/rig';

// Inside scene render():
const fovDeg = 28 + 42 * f.u; // Zoom lens from 28° telephoto to 70° wide
const targetPos: [number, number, number] = [0, 0, 0];
const forwardDir: [number, number, number] = [0, 0, 1]; // View vector
const subjectWidthWorld = 1.6; // Width of hero object in metres

// Analytical closed-form solver:
const { position, fov } = solveDollyZoom(targetPos, forwardDir, subjectWidthWorld, fovDeg);
camera.position.set(...position);
camera.fov = fov;
camera.updateProjectionMatrix();
```

### 3.2 Spherical Orbit Choreography (`orbitPosition`)
Avoid raw trigonometry with singularities. Use `orbitPosition` for smooth, cinematic sweeps around hero models:
```typescript
import { orbitPosition } from '../../engine/rig';

// Polar orbit: radius, pitch (elevation), yaw (azimuth)
const pitch = 0.2 + 0.1 * Math.sin(f.lt * 0.5);
const yaw = f.lt * 0.4;
const camPos = orbitPosition([0, 0.5, 0], 4.2, pitch, yaw);
camera.position.set(...camPos);
camera.lookAt(0, 0.5, 0);
```

### 3.3 Physical Thin-Lens Depth of Field (`dof.ts`)
Instead of cheap 2D Gaussian blurs, invoke the engine's physical thin-lens optical model. The Circle-of-Confusion ($C$) is evaluated directly from the camera focus distance and lens aperture:
$$C(z) = \text{clamp}\left(\left|1 - \frac{d_{\text{focus}}}{z}\right| \cdot \text{aperture}, \, 0, \, \text{maxRadius}\right)$$

```typescript
import { DepthDoFPass } from '../../engine/dof';
import { focusDistance } from '../../engine/rig';

// Inside custom Scene class:
private dofPass = new DepthDoFPass();

render(f: Frame, out: THREE.WebGLRenderTarget) {
  // 1. Calculate physical focus distance to hero subject along view axis
  const focusDist = focusDistance(
    [camera.position.x, camera.position.y, camera.position.z],
    [hero.position.x, hero.position.y, hero.position.z],
    rig.getForwardVector()
  );

  // 2. Render 3D scene to an internal HalfFloat RT with DepthTexture
  renderer.setRenderTarget(this.sceneRT);
  renderer.clear(true, true, true);
  renderer.render(this.scene, camera);

  // 3. Run optical bilateral gather pass (prevents background bleed)
  this.dofPass.render(
    renderer,
    this.sceneRT.texture,
    this.sceneRT.depthTexture!,
    {
      enabled: true,
      focusDistance: focusDist,
      aperture: 22.0,      // Cinematic bokeh diameter in pixels
      blades: 9,           // 9-blade cinema iris diaphragm
      anamorphicRatio: 1.0 // 1.0 = spherical, 2.0 = anamorphic oval
    },
    out
  );
  renderer.resetState();
}
```

### 3.4 Physically Accurate Spectral Lighting (`spectrum.ts`)
Never use arbitrary neon hex colors for key lighting. Drive light temperatures from Planckian blackbody radiators ($1000\text{K} - 12000\text{K}$) or CIE 1931 spectral emission lines:
```typescript
import { blackbodyToLinearSRGB, OXYGEN_GREEN, NITROGEN_N2_RED, wavelengthToLinearSRGB } from '../../engine/spectrum';

// 3200K Warm Tungsten Key Light
const [r, g, b] = blackbodyToLinearSRGB(3200);
keyLight.color.setRGB(r, g, b);

// 6500K Daylight Rim Light
const [dr, dg, db] = blackbodyToLinearSRGB(6500);
rimLight.color.setRGB(dr, dg, db);
```

---

## 4. High-End Motion Polish Mechanics [RULE]

Fluid, tactile, high-budget animation is achieved through structural choreography rather than arbitrary hand-tuned keyframes:

### 4.1 "One Clock, Many Hands" (The Synchronization Invariant)
- Derive every animated property in a shot from the same 1–2 master timing sources (a word trigger, transient hit, or progress curve).
- When two objects interact (e.g., text pushing other text, cards docking into a chassis), they must read the exact same clock through the same ease curve so visual relationships never drift apart.

### 4.2 Four-Layer Motion Architecture
No visible property should have only a single motion curve. Every active element must layer four movement bands:

```
[4-LAYER MOTION STACK]

1. BASE DRIFT      ===> 2. HIT TRANSIENT   ===> 3. FRAME TREMOR    ===> 4. HOLD CREEP
   - Slow life / breath   - Pulse on audio hits   - Deterministic jitter  - Constant advance
   - Keeps frame alive    - Snaps & settles       - Keyed to frameIdx(t)  - Prevents dead holds
```

1. **Base Drift / Breathing:** Continuous subtle travel or rotation (`f.lt * 0.05`), ensuring elements never freeze into static cards.
2. **Hit Transient:** Sharp exponential-decay pulse on narrative emphasis or audio kicks (`pulse(t, hitT, halfLife)`).
3. **Frame Tremor:** High-frequency vibration keyed deterministically to `hash(frameIdx(t))`, remaining constant across the shutter window.
4. **Hold Creep:** Elements on hold physically creep toward the lens ($1.0 + 0.035 \cdot (t - t_0)$) rather than standing dead still.

### 4.3 Staged Physics: Closed-Form Springs & Overshoot
Never run mutable physical simulation integrators (`pos += vel * dt`). Fake inertia, gravity, and elastic momentum using closed-form analytical damped springs:
```typescript
import { springStep } from '../../engine/util';

// Mass-spring-damper catching a stepped target:
// springStep(dt, frequency, damping)
const settle = springStep(f.lt - hitTime, 14.0, 0.72);
const currentScale = 1.35 - 0.35 * settle;
```

---

## 5. Diegetic 3D Typography & Volumetrics

### 5.1 In-World Extruded PBR Typography (`text_lighting.ts`)
Instead of floating 2D screen overlays, place typography directly into the 3D world space using `createInWorldText` or `ctx.text3D`:
- Uses `MeshPhysicalMaterial` or `MeshStandardMaterial`.
- **Participates in Depth:** Casts real shadows, writes to `depthTexture`, and undergoes thin-lens Circle-of-Confusion blur alongside background geometry.
- **Particle Collision:** Generates world-space bounding obstacles that actively deflect particle streams via `deflectPointFromGlyph`.

```typescript
import { createInWorldText, getTextLayout, computeTextCoC } from '../../engine/text_lighting';

const textGroup = createInWorldText('TITANIUM ARCHITECTURE', {
  size: 0.8,
  depth: 0.15,
  color: '#E8E4DA',
  roughness: 0.25,
  metalness: 0.85,
  depthWrite: true,
  castShadow: true,
});
scene.add(textGroup);
```

### 5.2 500,000 Instanced GPU Particles (`particles_large.ts`)
When scripts call for cosmic dust, atmospheric currents, or magnetic data flows, avoid slow CPU loops. Deploy `LargeParticles`:
- 100k to 500k instanced GPU particles driven by 3D curl noise (`curlNoise3J`).
- Pure closed-form evaluation $p(\text{seed}, t)$: scrubs bidirectionally with zero accumulator drift.
- Supports Planckian blackbody and spectral wavelength emission colors.

---

## 6. Pre-Flight Scene Authoring Checklist

Before marking a scene complete or submitting for review, verify:

- [ ] **Closed-Form Logic:** All animation curves evaluate directly from `f.lt` or `f.t` (no `+=` Euler state).
- [ ] **Camera System:** Uses `CameraRig` (`rig.ts`) with analytical solvers; zero imports from `@deprecated` `camera3d.ts`.
- [ ] **Architectural Choice:** Scene uses `defineScene` if standard, or correctly manages `Scene` lifecycle if using multi-pass depth DoF.
- [ ] **State Restoration:** All custom raw WebGL passes invoke `renderer.resetState()`.
- [ ] **Target Cleared:** Scene clears `out` buffer via `renderer.clear(true, true, true)`.
- [ ] **Layered Motion:** Active subjects feature Base Drift + Hit Transient + Frame Tremor + Hold Creep.
- [ ] **Typography Contrast:** 2D overlays feature dark knockout halos (`haloWidth: 6`), or text is diegetic in-world 3D.
- [ ] **Text Ducking:** 2D overlays multiply alpha by `ctx.overlayDuck` / `overlayTextDuck(f.tin, f.tout)`.
- [ ] **Resource Disposal:** Custom textures, geometries, materials, and render targets are fully freed in `dispose()`.
- [ ] **Safe Boundaries:** All critical visuals and text sit comfortably inside safe zones.
