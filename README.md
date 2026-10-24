# f(x) Studio
**This project is licensed under the PolyForm Small Business License 1.0.0 [`LICENSE.md`](./LICENSE.MD). This grants non-commercial parties full use of the software and allows small businesses under the defined revenue and employee thresholds to use it under the same terms.**

**For commercial Licensing beyond these thresholds email *vio@penguinbtw.com***

> ### 📢 Latest Releases & Changelog
> * **[v0.6.1 Bug Fix Report](./docs/changelog/v0.6.1-bug-fix-report.md)**: Engine-wide stability and correctness patch. Resolves 24 critical bugs across core rendering loops (mixRT ping-pong feedback fix), WebGL state isolation (`renderer.resetState()`), linear alpha premultiplication, GLTF shared-cache protection, ODE spring math, and FFmpeg pipeline mapping.
> * **[v0.6.0 Release Record](./docs/changelog/v0.6.0-release-record.md)**: Major feature release adding procedural PBR shader materials (Ward brushed metal, wireframe glow, frosted glass), 3D extruded kinetic typography with chamfered bevels, optical Depth of Field (DoF), and volumetric god-rays.

---

A production-grade, agent-accessible boilerplate and diagnostic inspection toolkit for procedural 60 fps WebGL/Canvas2D motion design across **any domain**—commercial product reveals, UI/UX interaction showcases, kinetic typography sequences, procedural data visualizations, brand identity resolves, and audiovisual productions.

---

## 1. Documentation Index

The complete documentation suite for **f(x) Studio** is consolidated and categorized under [**`docs/`**](./docs/README.md):

| Category | Description | Key Documents |
| :--- | :--- | :--- |
| [**Architecture**](./docs/architecture/engine-overview.md) | High-level system architecture, GL compositor pipeline, 12 core modules, and standalone transition system. | • [Engine Overview](./docs/architecture/engine-overview.md)<br>• [Modules Reference](./docs/architecture/modules-reference.md)<br>• [GL Compositor Pipeline](./docs/architecture/gl-compositor-pipeline.md)<br>• [Transitions System](./docs/architecture/transitions-system.md) |
| [**Diagnostics**](./docs/diagnostics/overview.md) | The 4 operational visual instruments giving autonomous agents and art directors direct sight into motion, space, and transitions. | • [Diagnostics Overview](./docs/diagnostics/overview.md)<br>• [01: God-View Blueprint](./docs/diagnostics/01-godview-camera-blueprint.md)<br>• [02: Motion Onion](./docs/diagnostics/02-multi-exposure-motion-onion.md)<br>• [03: A/B Reference Anchor](./docs/diagnostics/03-visual-ab-reference-anchor.md)<br>• [04: Seam Stitch Inspector](./docs/diagnostics/04-transition-seam-stitch-inspector.md) |
| [**Telemetry**](./docs/telemetry/telemetry-engine.md) | 60fps automated motion profiling, Three-Tier Review Hierarchy, F01–F16 rules, and empirical calibration. | • [Telemetry Engine](./docs/telemetry/telemetry-engine.md)<br>• [Rules & Flags (F01–F16)](./docs/telemetry/rules-and-flags.md)<br>• [Calibration Guide](./docs/telemetry/calibration-guide.md)<br>• [Report Specification](./docs/telemetry/report-spec.md) |
| [**Authoring**](./docs/authoring/scene-authoring-guide.md) | Developer and agent guides for authoring procedural scenes, custom passes, kinetic typography, and cameras. | • [Scene Authoring Guide](./docs/authoring/scene-authoring-guide.md)<br>• [Custom Components & Invariants](./docs/authoring/custom-components.md)<br>• [Kinetic Typography & Lyrics](./docs/authoring/kinetic-typography.md)<br>• [Camera Choreography](./docs/authoring/camera-choreography.md)<br>• [Audio & Music Sync](./docs/authoring/audio-and-music-sync.md) |
| [**CLI & Export**](./docs/cli/render-cli-reference.md) | Headless rendering CLI reference, video export, GPU acceleration, and automated test runners. | • [Render CLI Reference](./docs/cli/render-cli-reference.md)<br>• [Video Export Pipeline](./docs/cli/video-export-pipeline.md)<br>• [Testing & Verification](./docs/cli/testing-and-verification.md) |
| [**Projects**](./docs/projects/project-system.md) | Multi-project workspace architecture, manifest specifications, and developer workflow. | • [Project System & Manifests](./docs/projects/project-system.md) |
| [**Roadmap**](./docs/roadmap/v0.5.0-roadmap-review.md) | Architectural audit record, v0.5.0 milestones, and proposed diagnostic instruments (05–09). | • [v0.5.0 Execution Record](./docs/roadmap/v0.5.0-roadmap-review.md)<br>• [Proposed Instruments (05–09)](./docs/roadmap/proposed-instruments/README.md) |
| [**Changelog**](./docs/changelog/v0.6.1-bug-fix-report.md) | Historical release notes, feature execution records, and stability bug fix audit reports. | • [v0.6.1 Bug Fix Report](./docs/changelog/v0.6.1-bug-fix-report.md)<br>• [v0.6.0 Release Record](./docs/changelog/v0.6.0-release-record.md) |

---

## 2. Core Philosophy: Instrumentation Over Grading

Earlier automated motion design tools relied on arbitrary scalar thresholds (`jerk > 120 m/s³ = FAIL`, `R < 3.5 = HOLLOW`, `similarity > 0.88 = LAZY`). This penalized intentional artistic accents, created blind spots, and incentivized agents to game arbitrary numbers.

This toolset operates on **Visual Instrumentation & Empirical Calibration**:
1. **Perceptual Sight Over Numbers**: Rather than parsing tables of scalars, agents and art directors inspect **visual diagnostic images**—3D architectural blueprints, chromatic multi-exposure motion trails, side-by-side design benchmark anchors, and head-to-tail transition seam overlays.
2. **Empirical Benchmarks Over Arbitrary Rules**: Non-objective metrics are calibrated against empirical reference distributions (`min`, $p_{10}$, $p_{50}$, $p_{90}$, `max`) extracted from approved production plates (`calibration/example.json`).
3. **Three-Tier Review Architecture**:
   - **Tier A (Objective)**: True physical or rendering bugs (text collisions, viewport safe-margin clipping, unintended blackouts, frame render time spikes). Only Tier A may be `blocking` in CI gates.
   - **Tier B (Benchmark)**: Empirical comparison against reference project distributions. Strictly `advisory` with one-line waiver logging.
   - **Tier C (Perceptual Proxies)**: Uncalibrated exploratory heuristics. Strictly `info` ("do not optimize to").

---

## 3. The 4 Operational Visual Diagnostic Instruments

All visual tools are implemented modularly in `app/scripts/visual/`, keeping `render.ts` lightweight and unbloated. Each tool can be executed via its dedicated forwarder in `scripts/` or as a subcommand of `render.ts`. Comprehensive operational guides for each tool are located in [`docs/diagnostics/`](./docs/diagnostics/overview.md). Future proposed instruments (05–09) are cataloged in [`docs/roadmap/proposed-instruments/`](./docs/roadmap/proposed-instruments/README.md).

| Instrument | CLI Command | Visual Artifacts | Operational Guide & Insights Across Motion Design |
| :--- | :--- | :--- | :--- |
| **Multi-Exposure Motion Onion** | `bun scripts/onion.ts`<br>`bun scripts/render.ts onion` | `onion_motion.png`<br>`onion_summary.json` | [**02-multi-exposure-motion-onion.md**](./docs/diagnostics/02-multi-exposure-motion-onion.md)<br>**Temporal motion arcs & easing on a single still**: Collapses an animation window ($0.5\text{–}1.5\text{s}$) into a chromatic ghost trail (cyan $\to$ natural $\to$ amber), instantly exposing camera micro-tremors, physical spring oscillation damping, vector morph glitches, and kinetic typography deceleration without video playback. |
| **3D God-View Camera Blueprint** | `bun scripts/godview.ts`<br>`bun scripts/render.ts godview` | `cam_godview.png`<br>`godview_summary.json` | [**01-godview-camera-blueprint.md**](./docs/diagnostics/01-godview-camera-blueprint.md)<br>**3D spatial blindness & frustum clearances**: Renders orthographic top-down ($XZ$) and side elevation ($YZ$) blueprints showing scene geometry bounds, hero product anchors, camera flight ribbons, and field-of-view viewing cones. Prevents near-plane clipping and spatial collisions. |
| **Visual A/B Reference Anchor** | `bun scripts/compare.ts`<br>`bun scripts/render.ts compare` | `ab_side_by_side.png`<br>`ab_split_wipe.png`<br>`compare_summary.json` | [**03-visual-ab-reference-anchor.md**](./docs/diagnostics/03-visual-ab-reference-anchor.md)<br>**Aesthetic ground-truth benchmarking**: Automated side-by-side and $45^\circ$ diagonal split-wipe contact sheets directly comparing typographic scale, stroke weights, negative space ratio, and color gamut against Figma keyframes, brand guidelines, or benchmark plates. |
| **Transition Seam Stitch Inspector** | `bun scripts/stitch.ts`<br>`bun scripts/render.ts stitch` | `onion_seam.png`<br>`strip_seam.png`<br>`stitch_summary.json` | [**04-transition-seam-stitch-inspector.md**](./docs/diagnostics/04-transition-seam-stitch-inspector.md)<br>**Scene handoff & UI state cut inspector**: Overlays outgoing frame $N-1$ (green) and incoming frame $N$ (magenta) across cut boundaries ($\pm 250\,\text{ms}$) to verify carrier geometry alignment (UI cards, logos, focal anchors), velocity continuity, and horizon stability. |

---

## 4. Universal Procedural Motion Engine (v0.6.1)

The core engine in [`app/src/engine/`](./app/src/engine/) is a decoupled, domain-agnostic motion graphics platform. Complete architectural specifications, API signatures, and authoring guides are detailed in [**`docs/architecture/engine-overview.md`**](./docs/architecture/engine-overview.md).

### The 12 Operational Engine Modules

```
app/src/engine/
├── dsl.ts          # Module 12: Declarative Scene Authoring DSL (defineScene, SceneContext)
├── rig.ts          # Module 1: Universal Dual-Mode 6-DOF Camera Rig (CameraRig)
├── transform.ts    # Module 2: Transform Hierarchy & Responsive Layout (TransformNode, LayoutNode)
├── text.ts         # Module 3: Universal Kinetic Typography Engine (KineticText)
├── sdf.ts          # Module 4: Analytic GPU Signed Distance Fields (SDFBatch)
├── motion.ts       # Module 5: Universal Motion Bus & Physical Solvers (MotionBus, motion)
├── particles.ts    # Module 6: Stateless Analytical GPU Particles (AnalyticalParticles)
├── graph.ts        # Module 7: Scoped Render Graph & Track Matte Compositor (CompositorGraph)
├── scenegraph.ts   # Module 8: Semantic Scene Graph & Entity Introspection (SceneGraph)
├── export.ts       # Module 9: Multi-Format Delivery & Headless Export (ExportPipeline)
├── tokens.ts       # Module 10: Pluggable Brand Design Token System (DesignTokens)
├── heal.ts         # Module 11: Directorial Self-Correction Contract (AgentHeal)
├── gltf.ts         # Module 13: Universal GLTF / GLB 3D Asset Engine (GLTFManager)
├── material.ts     # Module 14: Procedural PBR Shader Materials (ProceduralMaterial)
├── text3d.ts       # Module 15: 3D Extruded Kinetic Typography (ExtrudedText)
└── post.ts         # Module 16: Cinematic Optical Post-Processing Pipeline (Post)
```

### Core Engine Capabilities
* **Declarative Scene Authoring (`defineScene`)**: Factory pattern providing a boilerplate shield (`SceneContext`) for coding agents—automating primitive instantiation, zero-annotation telemetry synchronization to `window.__motion.textProbes`, strict `document.fonts.ready` gating, and WebGL batch flushing with `renderer.resetState()`.
* **Universal GLTF / GLB 3D Asset Pipeline (`GLTFManager`)**: Asynchronous asset preloading, global deduplication cache, Draco geometry decompression, skeleton-safe instancing (`SkeletonUtils.clone`), auto-normalization (`center`, `fitToBox`), and deterministic closed-form animation evaluation (`model.setTime(t)`).
* **Mathematical Determinism $\text{Frame} = f(t)$**: Closed-form temporal evaluation across all physics, particles, and camera paths. Guarantees bit-identical sampling under sub-frame adaptive motion blur (1 to 324 spp).
* **Dual-Mode 6-DOF Camera Rig (`CameraRig`)**: Centripetal Catmull-Rom arc-length spline flight, singular-safe orthonormal frames (Bishop frames), analytical closed-form trauma shake, and seamless switching between Cinematic Perspective (14mm–200mm) and Technical Isometric projections.
* **Analytic GPU Vector Plumbing (`SDFBatch`)**: Instanced quad rendering for rounded rectangles with clamped per-corner radii, analytic soft drop shadows, rings with anti-aliased trim paths, and HUD reticles directly on the GPU (bypassing 4K Canvas2D PCIe bottlenecks).
* **Scoped Compositor Graph (`CompositorGraph`)**: Multi-layer compositing engine with dual-texture alpha/luma track mattes and blend modes (`normal`, `add`, `screen`, `multiply`).
* **Multi-Format Delivery Pipeline (`ExportPipeline`)**: Automated export presets for transparent Alpha WebM (VP9 + alpha), Apple ProRes 4444 (10-bit + alpha), ProRes 422 HQ, H.264 MP4, and lossless PNG sequences.
* **Autonomous Self-Healing (`AgentHeal`)**: Translates diagnostic signals from the visual instruments directly into machine-actionable repair directives emitted into `findings.json`.
* **Procedural PBR Materials (`ProceduralMaterial`)**: Code-only mathematical shader materials without texture maps—anisotropic Ward brushed titanium with micro-grooves, single-pass barycentric wireframe glow via `fwidth()`, frosted optical conduit glass with internal luminescence, dark polymer absorption, and closed-form traveling emissive pulse tracks.
* **3D Extruded Kinetic Typography (`ExtrudedText`)**: Clean geometric vector letterforms extruded with chamfered bevels, dynamic lighting, drop shadows, and automatic 2D screen bounding box projection synced to `window.__motion.textProbes`.
* **Cinematic Optical Post-Processing (`Post`)**: Optical Depth of Field (Bokeh Disc kernel), Volumetric Atmospheric Light Scatter (God Rays), and 4 specialized color grading profiles (`industrial`, `warm_editorial`, `monochrome_blueprint`, `infrared`).
* **Camera Trajectory Ribbon (`CameraRig.createDebugRibbon`)**: 3D spline flight ribbon visualizing camera trajectory for god-view diagnostics.

---

## 5. Quick Start for Autonomous AI Agents & Developers

### 1. Inspect Motion Smoothness, Springs & Easing
```bash
# Collapses a 0.5s window into a chromatic ghost trail
bun scripts/onion.ts --scene modal_reveal --t 2.40 --frames 12 --out out/visual/modal_spring
```

### 2. Inspect 3D Camera Flight & Spatial Clearances
```bash
# Renders orthographic top-down and side elevation blueprints
bun scripts/godview.ts --scene product_turntable --from 4.0 --to 12.0 --samples 32 --out out/visual/product_orbit
```

### 3. Compare Against Design Tokens or Figma Reference
```bash
# Generates side-by-side and 45° diagonal split-wipe contact sheets
bun scripts/compare.ts --scene dashboard_hud --t 5.20 --ref figma_keyframe --ref-t 5.20 --out out/visual/hud_vs_figma
```

### 4. Inspect a Scene Handoff Transition or UI State Change
```bash
# Generates green/magenta onion overlay and 10-frame seam filmstrip
bun scripts/stitch.ts --from-scene macro_shot --to-scene wide_reveal --t 6.40 --out out/visual/seam_audit
```

### 5. Full Scene Telemetry & Verification Audit
```bash
# Evaluates F01-F16 rules and outputs report.md, findings.json, and CSVs
bun scripts/render.ts motion --from 4.0 --to 12.0 --only hero_reveal --out out/motion/audit
```

---

## 6. Project Directory Tree

```
Agentic motion design toolset/
├── scripts/                          # Root CLI wrappers
│   ├── render.ts                     # Master render entrypoint
│   ├── onion.ts                      # Multi-exposure motion onion forwarder
│   ├── godview.ts                    # 3D God-view camera blueprint forwarder
│   ├── compare.ts                    # Visual A/B reference anchor forwarder
│   └── stitch.ts                     # Transition seam cut inspector forwarder
│
├── app/                              # Core procedural motion engine
│   ├── src/                          # Three.js / WebGL / Canvas2D codebase
│   │   ├── engine/                   # 12 core engine modules (rig, sdf, text, dsl, graph, etc.)
│   │   ├── scenes/                   # Modular scene project directories & active.json pointer
│   │   ├── transitions/              # 16 Standalone GPU transition classes
│   │   ├── main.ts                   # Export harness & text probe interceptor
│   │   └── timeline.ts               # Universal project timeline driver
│   │
│   └── scripts/                      # Engine scripts & test suites
│       ├── render.ts                 # Dynamic import CLI dispatcher
│       ├── visual/                   # 4 operational visual diagnostic instruments
│       └── motion/                   # Calibrated telemetry engine (F01–F16)
│
├── docs/                             # Complete categorized documentation hub
│   ├── changelog/                    # Release records & stability bug fix reports (v0.6.0, v0.6.1)
│   ├── architecture/                 # Engine architecture & GL compositor pipeline
│   ├── diagnostics/                  # 4 Operational visual diagnostic instruments
│   ├── telemetry/                    # 60fps telemetry engine & F01–F16 rules
│   ├── authoring/                    # Developer & scene authoring guides
│   ├── cli/                          # CLI reference & video export pipeline
│   ├── projects/                     # Multi-project manifests & workspace architecture
│   ├── roadmap/                      # v0.5.0 execution review & proposed instruments (05–09)
│   └── README.md                     # Master documentation hub & sitemap
│
└── calibration/                      # Ground-truth empirical datasets
    ├── example.json                  # Reference distributions (min, p10, p50, p90, max)
    └── director-notes.md             # Directorial artistic feedback & intent log
```
