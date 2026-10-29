---
name: fx-engine
description: Central router, architectural overview, and index for f(x) Studio. Use whenever f(x) Studio is mentioned, referenced, or used for procedural motion design, scene generation, 3D rendering, or video export to identify and route to specialized fx-* sub-skills.
---
# f(x) Studio: Engine Overview & Skill Router

The central architectural index and routing guide for **f(x) Studio**, a deterministic, procedural motion graphics and 3D animation engine built on Three.js, WebGL2, HTML5 Canvas2D, Bun, and Playwright.

## When to Use

- Whenever a prompt mentions, references, or involves **f(x) Studio**.
- Orienting an agent within the codebase layout (`app/src/`, `scripts/`, `project.json`).
- Routing to the correct specialized `fx-*` sub-skill based on the active task.
- Understanding core architectural invariants that apply across every file in the engine.

---

## 1. The `fx-*` Skill Ecosystem & Routing Table

f(x) Studio divides responsibilities into dedicated skills. **Do not load all skills simultaneously.** Inspect the user's intent and reference the specific skill required:

```
                                      [ fx-engine ]
                                 (Central Index & Router)
                                            │
        ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
        ▼                   ▼                               ▼                   ▼
  [ fx-scenes ]     [ fx-transitions ]              [ fx-engine-dev ]   [ fx-diagnostics ]
 Scene Authoring    Bespoke Cuts                    Core Plumbing       Visual Audits
 & 3D Staging       & Seam Morphs                   & GL Shaders        & Telemetry Rules
        │                                                   │
  ┌─────┴──────────────────┐                                │
  ▼                        ▼                                ▼
[ fx-3d-assets ]    [ fx-procedural-modeling ]     [ fx-telemetry-remediation ]
GLTF / GLB CAD      Code-Only Shaders              Directorial Self-Correction
Models & Skinned    & Line Geometries              & F01-F16 Fixes
  │
  ▼
[ fx-kinetic-typography ]
Staggers, Hershey Fonts
& Halo Badges
```

| Task / Intent | Required Skill | Description & Scope |
|---|---|---|
| **Authoring or editing scenes** in `app/src/scenes/` | **`fx-scenes`** | Raw `Scene` subclasses (common) or optional `defineScene()` DSL, 6-DOF camera choreography, 2D/3D layout nodes, kinetic typography halos, particle presets, and closed-form math $\text{Frame} = f(t)$. |
| **Connecting scenes or writing seams** in `app/src/transitions/` | **`fx-transitions`** | Scene-to-scene momentum continuity, carrier handoffs, `api.sampleScene(id, t)` speed ramps, and `overlayTextDuck` anti-collision text ducking. |
| **Modifying engine source code** in `app/src/engine/` | **`fx-engine-dev`** | WebGL state cache restoration (`resetState()`), HalfFloat HDR render target allocation, custom GLSL fullscreen passes, and static GPU buffer memory rules. |
| **Visual QA, debugging, telemetry, or export** | **`fx-diagnostics`** | Running the 4 visual instruments (`godview`, `onion`, `stitch`, `compare`), evaluating Tier A/B/C telemetry rules (`F01–F16`), waiver logging, and CLI rendering. |
| **Importing or animating 3D CAD/GLTF models** in `app/public/models/` | **`fx-3d-assets`** | Asynchronous GLTF/GLB caching, Draco decompression, skeletal normalization (`fitToBox`, `center`), screen-bounds projection, and `model.setTime(t)`. |
| **Code-only procedural shaders & wireframe geometry** | **`fx-procedural-modeling`** | Minimalist-3D wireframes (`LineBatch`), anisotropic normal noise (brushed metals), procedural displacement, raymarched SDFs, and recursive zoom fractals. |
| **Kinetic typography, word staggers & Hershey fonts** | **`fx-kinetic-typography`** | Stagger reveals, numeric rollers, variable font axes, Hershey vector single-stroke plotter fonts (`stroke.ts`), and knockout understroke halos (`text.ts`). |
| **Remediating telemetry flags & auto-healing** | **`fx-telemetry-remediation`** | Actionable remediation patterns for `F01–F16` flags, resolving CI export blockers, and registering machine-actionable repair directives via `heal.ts`. |
| **Timeline assembly, audio muxing & final export** | **`video-assembly-and-finishing`** | Multi-scene `project.json` assembly, FFmpeg audio multiplexing (VO + music + foley), master optical post-processing, and multi-format delivery (16:9 & 9:16). |

### Upstream Foundation Skills
f(x) Studio projects adhere to global Viopls production rules:
- **`video-design`**: Universal standards (Zero HUD, diegetic 3D text, continuous camera momentum, minimum stylized 2.5D, safe zones).
- **`design-around-audio`**: Stem deconstruction, beat-grid alignment, transient hits ($V_{\text{hit}}$), and frequency mapping.
- **`design-around-narration`**: Script staging, elastic visual buffers, and `narration_guide.md` generation.
- **`viopls-art-direction`**: Aesthetic cohesion, anti-slop blacklist, 60/30/10 palette rule, and core engine tokens (`--void`, `--bone`, `--ash`, `--signal`).
- **`visual-metaphors-and-abstraction`**: Mandatory pre-production conceptual planning gate (`visual_plan.md`).
- **`storyboarding-and-blocking`**: Shot-scale hierarchy, 180° spatial axis, and saccadic gaze anchoring (`storyboard.md`).
- **`sound-design-and-foley`**: Tactile sound effects, spectral budgeting (Vocal Sanctuary Rule), and `sound_design_guide.md`.
- **`shorts-retention-design`**: 9:16 vertical composition, mobile safe-zone clearances, zero-second hooks, and retention pacing.

---

## 2. Core Subsystems & Workspace Layout

f(x) Studio projects are isolated inside `app/src/scenes/<project_name>/`:

```
app/
├── src/
│   ├── engine/             # Core Engine Plumbing (Managed via fx-engine-dev)
│   │   ├── dsl.ts          # Declarative scene authoring DSL (defineScene)
│   │   ├── rig.ts          # 6-DOF Camera Rig (Centripetal splines, Bishop frames)
│   │   ├── transform.ts    # TransformNode & responsive LayoutNode
│   │   ├── text.ts         # Kinetic typography engine with knockout halos
│   │   ├── sdf.ts          # Instanced GPU Signed Distance Fields (cards, rings)
│   │   ├── motion.ts       # Closed-form spring ODE solver & easing curves
│   │   ├── particles.ts    # Stateless GPU analytical particles
│   │   ├── graph.ts        # Scoped render graph & track mattes (alpha/luma)
│   │   ├── lines.ts        # GPU capsule line batcher
│   │   ├── post.ts         # HalfFloat HDR optical post (bloom, halation, CA)
│   │   └── gl.ts           # FSPass fullscreen quads & Layer2D canvas
│   │   ├── gltf.ts         # Module 13: Universal GLTF / GLB 3D Asset Engine
│   │   ├── stroke.ts       # Hershey vector single-stroke plotter fonts
│   │   ├── tokens.ts       # Central design tokens & color models
│   │   └── heal.ts         # Directorial self-correction repair directives
│   ├── scenes/             # Project Scenes (Managed via fx-scenes)
│   │   ├── active.json     # Active project pointer
│   │   └── <project_name>/
│   │       ├── project.json  # Timeline manifest (scenes, cuts, audio, BPM)
│   │       └── *.ts          # Scene definitions
│   └── transitions/        # Seam Logic (Managed via fx-transitions)
│       └── *.ts            # Bespoke transition classes
├── public/                 # Static Assets (audio, models, extracted data)
└── scripts/                # CLI & Diagnostic Tools (Managed via fx-diagnostics)
    ├── render.ts           # Offline export CLI (stills, sheets, video, telemetry)
    └── visual/             # Visual instruments (godview, onion, stitch, compare)
```

---

## 3. Universal Engine Invariants [RULE]

Regardless of which sub-skill is active, all work in f(x) Studio must strictly uphold these six core invariants:

### 3.1 Closed-Form Temporal Determinism: $\text{Frame} = f(t)$
- Visual state at time $t$ must be a pure, stateless mathematical function of song or timeline time:
  $$\text{State} = f(t)$$
- **Forbidden:** Never use mutable frame-by-frame accumulators (`position += velocity * dt`).
- **Why:** The engine scrubs bidirectionally and renders sub-frame motion blur up to 324 samples per frame. Mutable state breaks random-access scrubbing and causes simulation drift.

### 3.2 WebGL State Cache Restoration
- Three.js internally caches GPU state flags (blend modes, depth test, VAO bindings).
- Whenever a custom raw GL pass, `FSPass`, or batch renderer (`SDFBatch`, `LineBatch`) flushes, it must immediately call:
  ```typescript
  renderer.resetState();
  ```
- *Failure to call `resetState()` silently corrupts the subsequent scene's depth buffer, alpha blending, or textures.*

### 3.3 Target Ownership & Clearing
- All rendering executes in linear HalfFloat HDR render targets (`THREE.HalfFloatType`).
- Every `render(f, out)` method must fully overwrite or clear its target:
  ```typescript
  gl.setRenderTarget(out);
  gl.clear(true, true, true);
  ```

### 3.4 Elimination of PCIe Bandwidth Churn
- For high-sample offline export (up to 324 spp at 4K), streaming per-frame vertex buffers over PCIe destroys performance.
- Particle systems (`AnalyticalParticles`) must allocate static GPU attribute buffers once during initialization.
- 2D cards, reticles, and UI badges must be rendered via GPU fragment shaders (`SDFBatch`), never re-uploaded from CPU Canvas2D per sub-frame.

### 3.5 Strict Font Loading Gate
- To prevent Flash-Of-Unstyled-Text (FOUT) and zero-width typography bounds that trigger false layout collision errors in CI, the engine must await fonts before Frame 0:
  ```typescript
  await document.fonts.ready;
  ```

### 3.6 Resolution-Independent Canonical Layout
- All logical coordinate layouts are authored against a canonical frame:
  $$W = 1920, \quad H = 1080$$
- Scaling to 4K (`scale: 2`) or preview displays occurs automatically at the viewport/post level.

---

## 4. Developer CLI & Operational Workflows

### 4.1 Interactive Development Server
```bash
bun dev
```
- Launches the live WebGL preview player at `http://localhost:5173`.
- **Key Hotkeys:** `Space` (Play/Pause), `.` / `,` (Step $\pm 1$ frame), `ArrowRight` / `ArrowLeft` (Step $\pm 1.0\text{s}$), `[` / `]` (Previous/Next scene boundary), `l` (Loop scene), `h` (Toggle HUD).
- **URL Parameters:**
  - `?project=<name>`: Switch active project directory.
  - `?only=<scene_id>`: Isolate a single scene.
  - `?t=<seconds>`: Jump directly to a timeline offset.

### 4.2 Headless Rendering & Diagnostics
```bash
# Capture still frames at exact timestamps
bun scripts/render.ts stills --project <name> --t 1.5,8.0,14.2 --out out/stills/

# Assemble a multi-frame contact sheet grid
bun scripts/render.ts sheet --project <name> --from 0 --to 30 --n 24 --cols 6 --out out/sheet.png

# Headless offline video export (GPU-accelerated, 8 spp motion blur)
bun scripts/render.ts video --project <name> --from 0 --to 30 --fps 60 --gpu --samples 8 --out out/final.mp4

# Run 60 fps telemetry and rule verification (F01-F16)
bun scripts/render.ts motion --project <name> --from 0 --to 30 --out out/telemetry/
```

---

## 5. Agent Triage & Execution Decision Tree

When handling any user prompt involving f(x) Studio, follow this sequential triage process:

```
                               [ INCOMING PROMPT ]
                                        │
             Is the user asking to modify engine core internals?
                                ├── YES ──► Load: fx-engine-dev
                                └── NO
                                        │
             Is the user connecting scenes or adjusting a transition cut?
                                ├── YES ──► Load: fx-transitions
                                └── NO
                                        │
             Is the user running QA, debugging visual bugs, or exporting?
                                ├── YES ──► Load: fx-diagnostics
                                └── NO
                                        │
             Default Creative Task: Creating or modifying a scene
                                └─────────► Load: fx-scenes
```