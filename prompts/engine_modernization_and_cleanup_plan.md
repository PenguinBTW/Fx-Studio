# ENGINE MODERNIZATION & CLEANUP PLAN
### Architectural Hygiene, Type Integrity & Core Rig Solvers

> **Companion document to `first_light_engine_prerequisites.md`.**  
> While `first_light_engine_prerequisites.md` specifies the **new feature modules** (P1 `photonState`, P2 `spectrum.ts`, P4 `raymarch.ts`, P5 `particles`, P6 `ribbon`, P8 `refraction`, etc.), this document covers the **core engine refactor, dead-code retirement, and typecheck hygiene** required to keep the studio stable, type-safe, and free of architectural confusion.

---

## 0. Executive Summary & Audit Consensus

Following a deep code audit across `app/src/engine/` (validated by independent review), the engine's core render contracts are rock-solid (8/10), but suffers from legacy demo baggage, misleading comments, and a broken typecheck in the new CLI tooling.

### Priority Action Matrix

| Task | Target File(s) | Action | Risk / Scope | Status |
| :--- | :--- | :--- | :---: | :---: |
| **M1** | `scripts/inspect_frame.ts` | Fix 19 strict TypeScript errors under `tsconfig.scripts.json` | **Zero risk** / Blocks CI | Ready |
| **M2** | `engine/camera3d.ts` &rarr; `util.ts` | Move `V3`, `RGB`, and vector math to `util.ts`; uncouple 6 engine files; archive dead CPU projector | **Low risk** / High clarity | Ready |
| **M3** | `engine/post.ts` | Fix `focusDist` shader documentation (radial screen-space ring, not depth DoF) | **Zero risk** / High clarity | Ready |
| **M4** | `engine/rig.ts` | Implement analytical Dolly-Zoom solver, screen-space autofocus projection, and polar orbit controls | **Low risk** / High utility | Ready |
| **M5** | `engine/dsl.ts` | Convert eager 12-subsystem container to lazy property getters | **Low risk** / Protects 33 scenes | Ready |
| **M6** | `engine/text3d.ts` | Preserve code-only stroke path for font-less briefs, route font geometry to `text.ts` | **Low risk** / Cleanup | Ready |
| **M7** | Repo Hygiene | Audit `heal.ts` (370 lines) dead code; verify `.gitignore` covers `keys.txt` | **Low risk** / Security | Ready |

---

## M1. CLI Typecheck Restoration (`scripts/inspect_frame.ts`)

### The Problem
Running `bun run typecheck` (`tsc --noEmit && tsc --noEmit -p tsconfig.scripts.json`) currently fails with **19 errors** exclusively in `app/scripts/inspect_frame.ts`:
- Implicit `any` parameters (`text`, `query`, `region`, `comparePath`, `potentialPaths`, etc.).
- Content blocks typed as `{ type: string; text: string }` rejecting `{ type: 'image_url', ... }`.
- `catch (err)` typed as `unknown` in strict mode.

### Implementation Plan
1. Declare explicit TypeScript interfaces for all CLI options:
   ```ts
   interface VisionDirective {
     query: string;
     region: [number, number, number, number] | null;
     comparePath: string | null;
   }
   type MessageContentBlock = 
     | { type: 'text'; text: string }
     | { type: 'image_url'; image_url: { url: string } };
   ```
2. Type all error handlers with `err instanceof Error ? err.message : String(err)`.
3. Verify `bun run typecheck` passes with **exit code 0**.

---

## M2. `camera3d.ts` Retirement & Math Extraction

### The Problem
[`engine/camera3d.ts`](file:///c:/Users/brosf/Documents/A%20vio%20projects/VioPls/Agentic%20motion%20design%20toolset/app/src/engine/camera3d.ts) (7.5 KB) is a legacy HTML5 2D Canvas CPU software rasterizer (`project(v, cam)` mapping to `ctx.lineTo`). Three.js handles 100% of real 3D cameras (`THREE.PerspectiveCamera`), matrices, and WebGL rendering.

However, **six engine files** (`particles.ts`, `rig.ts`, `scenegraph.ts`, `text.ts`, `transform.ts`, `viewport.ts`) still import from it purely for type definitions (`V3`, `RGB`, and `Cam`). An agent inspecting these files finds CPU rasterizer code sitting directly alongside Three.js code.

### Implementation Plan
1. Move canonical vector math and types to [`engine/util.ts`](file:///c:/Users/brosf/Documents/A%20vio%20projects/VioPls/Agentic%20motion%20design%20toolset/app/src/engine/util.ts):
   ```ts
   export type V3 = [number, number, number];
   export type RGB = [number, number, number];
   export function v3Add(a: V3, b: V3): V3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
   export function v3Sub(a: V3, b: V3): V3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
   export function v3Scale(v: V3, s: number): V3 { return [v[0] * s, v[1] * s, v[2] * s]; }
   export function v3Lerp(a: V3, b: V3, t: number): V3 { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
   export function v3Dist(a: V3, b: V3): number { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
   ```
2. Update imports across the 6 engine files to import `V3` from `./util` instead of `./camera3d`.
3. In `camera3d.ts`, mark all legacy CPU projection helpers (`proj`, `clipSeg`, `planeAffine`, `billboardAffine`, `Cam`) as `@deprecated`. Keep re-exports of `V3` for backward compatibility, then archive.

---

## M3. `post.ts` Shader Documentation & DoF Clarification

### The Problem
In [`engine/post.ts`](file:///c:/Users/brosf/Documents/A%20vio%20projects/VioPls/Agentic%20motion%20design%20toolset/app/src/engine/post.ts), line 42 documents `focusDist` as:
> `focusDist?: number; // Distance of sharp focal plane 0..1`

However, the actual fragment shader computes:
```glsl
float blur = abs(length(uv - vec2(0.5)) - uFocusDist);
```
This is a **radial screen-space tilt-shift ring** measured from the center of the viewport $(0.5, 0.5)$, **not a world-space Z-depth buffer**. 

### Implementation Plan
1. Correct the TypeScript docstring in `post.ts`:
   ```ts
   /** Radial screen-space focus radius (0..1) from viewport center. NOT world depth. */
   focusDist?: number;
   ```
2. Keep the existing shader for aesthetic vignette tilt-shift effects, but clarify the distinction so agents do not attempt to feed world-distance `v3Dist(camPos, targetPos)` into it.
3. Note for P7 (Prerequisites): If a true depth-buffer DoF pass is built for "First Light", it will be exposed as `depthFocusDist` backed by a `DepthTexture` render target.

---

## M4. `rig.ts` Analytical Solvers & Screen-Space Autofocus

### The Problem
[`engine/rig.ts`](file:///c:/Users/brosf/Documents/A%20vio projects/VioPls/Agentic%20motion%20design%20toolset/app/src/engine/rig.ts) provides waypoint Catmull-Rom splines, quaternion rotation, and trauma shake, but lacks three analytical solvers that scene authors repeatedly hand-code:
1. **Dolly-Zoom (Vertigo Effect):** Modulating camera distance and field of view simultaneously so that a hero object maintains an exact fixed pixel width on screen while the background perspective expands/contracts.
2. **Autofocus Projection:** Projecting a 3D world target onto screen space to dynamically drive `post.overrides.focusDist`.
3. **Polar Spherical Orbit:** Orbiting a target at distance $R$ with pitch $\theta$ and yaw $\phi$.

### Implementation Plan
Add analytical solvers directly to `CameraRig`:
```ts
export class CameraRig {
  // 1. Analytical Dolly-Zoom Solver
  // D(t) = targetWidth / (2 * tan(fov(t) / 2))
  dollyZoom(targetPos: V3, targetWidthWorld: number, fovDegrees: number): { position: V3; fov: number } {
    const fovRad = (fovDegrees * Math.PI) / 180;
    const distance = targetWidthWorld / (2 * Math.tan(fovRad / 2));
    // Positions camera along current look direction at the exact required distance
    const dir = this.getForwardVector();
    const position: V3 = [
      targetPos[0] - dir[0] * distance,
      targetPos[1] - dir[1] * distance,
      targetPos[2] - dir[2] * distance
    ];
    return { position, fov: fovDegrees };
  }

  // 2. Screen-Space Autofocus Calculator (Compatible with post.ts radial blur)
  computeScreenFocusRadius(targetWorldPos: V3, camera: THREE.PerspectiveCamera, aspect: number): number {
    const v = new THREE.Vector3(...targetWorldPos).project(camera);
    // v.x and v.y are in NDC [-1, 1]. Map to radial radius from center (0, 0)
    const ndcX = v.x * 0.5 * aspect;
    const ndcY = v.y * 0.5;
    return Math.hypot(ndcX, ndcY);
  }

  // 3. Spherical Polar Orbit Solver
  orbit(targetPos: V3, radius: number, pitchRad: number, yawRad: number): V3 {
    return [
      targetPos[0] + radius * Math.cos(pitchRad) * Math.sin(yawRad),
      targetPos[1] + radius * Math.sin(pitchRad),
      targetPos[2] + radius * Math.cos(pitchRad) * Math.cos(yawRad)
    ];
  }
}
```

---

## M5. `dsl.ts` Lazy Property Instantiation

### The Problem
[`engine/dsl.ts`](file:///c:/Users/brosf/Documents/A%20vio%20projects/VioPls/Agentic%20motion%20design%20toolset/app/src/engine/dsl.ts) (20.7 KB) eagerly instantiates 12+ subsystems on creation:
`lines`, `particles`, `sdf`, `text`, `materials`, `audio`, `post`, `heal`, `graph`, `gltf`, `hud`, `lyrics`.
While flagship scenes (`story_room`, `interlock`, `sonnet-test`) bypass it, **33 scene files across 13 demo folders** actively import `dsl.ts`. Splitting the public API would break 33 scenes.

### Implementation Plan
Convert `SceneDSL` internal properties to **lazy getters**:
```ts
export class SceneDSL {
  private _lines?: LineBatch;
  private _particles?: AnalyticalParticles;
  private _sdf?: SDFRenderer;
  // ...

  get lines(): LineBatch {
    return (this._lines ??= new LineBatch(this.scene));
  }

  get particles(): AnalyticalParticles {
    return (this._particles ??= new AnalyticalParticles(this.scene));
  }

  get sdf(): SDFRenderer {
    return (this._sdf ??= new SDFRenderer(this.scene));
  }
  // Zero breaking changes to the 33 importer files.
  // Unused systems consume 0 allocations and 0 WebGL resources.
}
```

---

## M6. `text3d.ts` & Code-Only Fallback Preservation

### The Problem
`text3d.ts` contains a 350-line ASCII letter switch table. While `engine/text.ts` handles full OpenType vector fonts, procedural films (like "First Light" and "The Interlock") often have strict art-direction constraints:
> *"You may not import models, textures, images, HDRIs, or fonts beyond the engine's own."*

### Implementation Plan
1. Retain the code-only stroke table as a standalone vector glyph fallback (`VectorGlyphs`) for font-less briefs and emergency HUD rendering.
2. Route standard 3D extruded typography through `engine/text.ts` using `opentype.js` path generation.
3. Decouple `text3d.ts` so it is only loaded on-demand by `dsl.ts` or explicitly imported.

---

## M7. Repository Cleanliness & Security Verification

1. **Dead Code Archival:**
   - [`engine/heal.ts`](file:///c:/Users/brosf/Documents/A%20vio%20projects/VioPls/Agentic%20motion%20design%20toolset/app/src/engine/heal.ts) (370 lines) is only referenced by `scripts/test_milestone4.ts`. Isolate or tag as internal legacy test utility.
2. **Key Security Enforcement:**
   - Verify that root `.gitignore` strictly includes:
     ```gitignore
     keys.txt
     */keys.txt
     testing/keys.txt
     proxy/keys.txt
     ```
   - Confirm no raw Bike4Mind API keys are committed to Git history.

---

## Execution Checklist

- [ ] **Step 1:** Fix the 19 TypeScript errors in `app/scripts/inspect_frame.ts` & verify `bun run typecheck` exits 0.
- [ ] **Step 2:** Extract `V3`, `RGB`, and math helpers to `app/src/engine/util.ts`, update 6 imports, deprecate `camera3d.ts`.
- [ ] **Step 3:** Correct the `focusDist` radial blur docstring in `app/src/engine/post.ts`.
- [ ] **Step 4:** Add `dollyZoom`, `computeScreenFocusRadius`, and `orbit` to `app/src/engine/rig.ts`.
- [ ] **Step 5:** Convert `SceneDSL` subsystems in `app/src/engine/dsl.ts` to lazy getters.
- [ ] **Step 6:** Verify all 33 demo scenes and the test suite compile cleanly under `bun test`.
