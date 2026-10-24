# f(x) Studio Documentation Hub (v0.6.1)

Welcome to the central documentation hub for **f(x) Studio** (also referred to as the **Agentic Motion Design Toolset**).

This library provides comprehensive architectural specifications, developer authoring guides, visual diagnostic manuals, CLI references, and showcase breakdowns for procedural 60 fps WebGL/Canvas2D motion design.

---

## 1. Documentation Architecture & Sitemap

```
docs/
├── changelog/                        # Release records & stability bug fix reports
│   ├── v0.6.1-bug-fix-report.md      # v0.6.1 stability & engine audit report (24 fixes)
│   └── v0.6.0-release-record.md      # v0.6.0 execution record (Materials, 3D Text, Optics)
│
├── architecture/                     # Core engine runtime & low-level GL pipeline
│   ├── engine-overview.md            # High-level architecture, dataflow & execution lifecycle
│   ├── modules-reference.md          # Complete API reference & buffer layouts for universal engine modules (v0.6.1)
│   ├── gl-compositor-pipeline.md     # HalfFloat HDR targets, resetState(), FSPass, post-processing
│   └── transitions-system.md         # Bespoke transition architecture, sampleScene, overlayTextDuck
│
├── diagnostics/                      # Visual diagnostic instruments (Sight Over Numbers)
│   ├── overview.md                   # Visual diagnostics philosophy, benchmarks & decision trees
│   ├── 01-godview-camera-blueprint.md# Top-down & elevation blueprints, flight ribbons, viewing cones
│   ├── 02-multi-exposure-motion-onion.md # Chromatic temporal ghost trails (cyan -> natural -> amber)
│   ├── 03-visual-ab-reference-anchor.md  # 45° diagonal split wipes & side-by-side benchmark anchors
│   └── 04-transition-seam-stitch-inspector.md # Green/magenta false-color overlay & 10-frame filmstrip
│
├── telemetry/                        # Automated 60fps kinematics & quality gates
│   ├── telemetry-engine.md           # 60fps architecture, 4 hooks, 4x4 downscaling, FFT optical flow
│   ├── rules-and-flags.md            # Comprehensive F01–F16 specification & Three-Tier Hierarchy
│   ├── calibration-guide.md          # Empirical calibration, baseline distributions, false-positive fixes
│   └── report-spec.md                # Output artifact formats (report.md, findings.json, CSVs, plots)
│
├── authoring/                        # Developer & agent authoring guides
│   ├── scene-authoring-guide.md      # Declarative DSL (defineScene) vs Raw Scene subclassing
│   ├── gltf-assets.md                # GLTF/GLB loading, instancing & deterministic animation (setTime)
│   ├── custom-components.md          # Authoring custom passes, runtime invariants, telemetry gates
│   ├── kinetic-typography.md         # KineticText, LyricRig, knockout halos, Hershey vector fonts
│   ├── camera-choreography.md        # Catmull-Rom splines, Bishop frames, trauma shake, lens physics
│   └── audio-and-music-sync.md       # Audio analysis (Librosa/SciPy), AudioData, f.a, and speech sync
│
├── cli/                              # Offline rendering, testing & command-line tooling
│   ├── render-cli-reference.md       # Master CLI reference for bun scripts/render.ts (all modes)
│   ├── video-export-pipeline.md      # Headless export, WebSocket frame streaming, GPU acceleration
│   └── testing-and-verification.md   # Automated milestone regression suites & CI testing protocol
│
├── projects/                         # Project manifests & workspace architecture
│   └── project-system.md             # Multi-project workspace, active.json, project.json manifests
│
└── roadmap/                          # Engine evolution & proposed instrumentation
    ├── v0.5.0-roadmap-review.md      # Architecture review & 4-milestone execution record
    └── proposed-instruments/         # Proposed instrument specifications (Roadmap 05–09)
        ├── README.md                 # Index of proposed instruments and evaluation methodology
        ├── 05-parametric-speed-graph.md
        ├── 06-gaze-saliency-heatmap.md
        ├── 07-dynamic-contrast-legibility.md
        ├── 08-choreography-gantt-stagger.md
        └── 09-multi-aspect-framing.md
```

---

## 2. Master Document Index

### A. Engine Architecture
* [**Engine Overview & Core Invariants**](architecture/engine-overview.md): System architecture, Mermaid dataflow diagram, core invariants ($f(t)$, WebGL state cache, HalfFloat HDR linear targets, zero-allocation render loop), and execution lifecycle stages.
* [**Modules Reference & API Signatures**](architecture/modules-reference.md): Full TypeScript signatures, buffer layouts, and usage examples for all universal engine modules (v0.6.0) (`rig.ts`, `transform.ts`, `text.ts`, `sdf.ts`, `motion.ts`, `particles.ts`, `graph.ts`, `scenegraph.ts`, `export.ts`, `tokens.ts`, `heal.ts`, `dsl.ts`, and `lines.ts`).
* [**GL Compositor & Post-Processing Pipeline**](architecture/gl-compositor-pipeline.md): HalfFloat HDR linear render targets (`makeRT`), WebGL state cache preservation (`renderer.resetState()`), full-screen passes (`FSPass`), and optical post-processing (`post.ts`: bloom, halation, chromatic aberration, grain, trauma shake).
* [**Bespoke Transitions Engine & Continuity Architecture**](architecture/transitions-system.md): Philosophy of bespoke motivated transitions over canned wipes, the three paradigms (standalone blocks, scene-internal handoffs, utility fallbacks), object-level choreography via `sampleScene`, the `overlayTextDuck(tin, tout)` broadcast contract, authoring tutorial, and seam stitch auditing.

### B. Visual Diagnostics (Sight Over Numbers)
* [**Visual Diagnostics Suite Overview**](diagnostics/overview.md): Philosophy of sight over numbers, four operational instruments, modular architecture, execution turnaround benchmarks, and agent repair decision trees.
* [**01. 3D God-View Camera Blueprint**](diagnostics/01-godview-camera-blueprint.md): External top-down ($XZ$) and elevation ($YZ$) orthographic blueprints with velocity-colored camera flight ribbons and viewing cones.
* [**02. Multi-Exposure Motion Onion**](diagnostics/02-multi-exposure-motion-onion.md): Single composite still blending consecutive frames with a chromatic time-decay gradient (cyan $\to$ natural $\to$ amber) to diagnose easing, springs, and micro-tremors.
* [**03. Visual A/B Reference Anchor**](diagnostics/03-visual-ab-reference-anchor.md): Automated side-by-side and $45^\circ$ diagonal split-wipe contact plates benchmarking active scenes against Figma artboards and design tokens.
* [**04. Transition Seam Stitch Inspector**](diagnostics/04-transition-seam-stitch-inspector.md): Split-wipe onion overlay (green outgoing, magenta incoming) and 10-frame filmstrip across transition cut boundaries ($\pm 250\text{ms}$).

### C. Motion Telemetry & Automated Verification
* [**60fps Motion Telemetry Engine**](telemetry/telemetry-engine.md): 60fps sampling architecture, 4 engine hooks, 4x4 box downscaling pipeline, Rec.709 luma, 2D FFT Cooley-Tukey optical flow, Sobel edge density, and CIE Lab $\Delta E_{76}$.
* [**Telemetry Rules & Flags Specification (F01–F16)**](telemetry/rules-and-flags.md): Complete specification of Rules F01–F16, the Three-Tier Review Hierarchy (Tier A Objective, Tier B Benchmark, Tier C Proxies), Universal vs Lyric-Only rules, stable content-addressed IDs, and waiver logs.
* [**Telemetry Calibration & Sanity Checking Guide**](telemetry/calibration-guide.md): Empirical calibration methodology, reference distributions (`calibration/example.json`), and historical resolution of false-positives (3D depth parallax and exit transit clipping).
* [**Motion Telemetry Report Specification**](telemetry/report-spec.md): Complete catalog and format specification for telemetry artifacts (`report.md`, `findings.json`, `summary.json`, `frames.csv`, `text.csv`, `timeline.png`, `slitscan.png`, filmstrips, temporal RGB composites).

### D. Authoring & Scene Development
* [**Scene Authoring Guide: DSL & Raw Scenes**](authoring/scene-authoring-guide.md): Comprehensive guide to declarative DSL (`defineScene`, `SceneContext`) vs raw `Scene` subclassing, lifecycle (`init`, `render`, `dispose`), and closed-form determinism.
* [**GLTF & GLB 3D Asset Loading, Instancing & Deterministic Animation**](authoring/gltf-assets.md): Loading external 3D CAD models, preloading race condition elimination, `SkeletonUtils.clone` instancing, `fitToBox`/`center` normalization, 2D screen bounding box projection, and deterministic closed-form animation evaluation (`model.setTime(t)`).
* [**Authoring Custom Components & Render Passes**](authoring/custom-components.md): Normative guide to engine invariants (target ownership, WebGL state cache, transitions ducking, sub-frame motion blur, memory disposal) and telemetry emission gates.
* [**Kinetic Typography & Lyric Synchronization**](authoring/kinetic-typography.md): `KineticText`, `LyricRig`, high-contrast knockout understroke halos, single-stroke Hershey plotter fonts (`stroke.ts`), dynamic word reveals, and telemetry interception.
* [**Cinematic Camera Choreography & Splines**](authoring/camera-choreography.md): Centripetal Catmull-Rom splines, Bishop orthonormal frames, SQUAD orientation, lens breathing, and analytical closed-form trauma shake.
* [**Audio, Music & Speech Synchronization Pipeline**](authoring/audio-and-music-sync.md): Offline audio analysis (`scripts/analyze_song.py`), Librosa/SciPy frequency decomposition, `AudioData` query APIs, instant `f.a` transient pulses, lyrics karaoke synchronization, and timeline drivers.

### E. Command-Line Interface & Video Export
* [**Render CLI Reference (`bun scripts/render.ts`)**](cli/render-cli-reference.md): Complete reference for all subcommands (`stills`, `sheet`, `video`, `perf`, `motion`, `onion`, `godview`, `stitch`, `compare`), global parameters, and defaults.
* [**Headless Video Export Pipeline & Acceleration**](cli/video-export-pipeline.md): Playwright frame evaluation, streaming rawvideo pipe to `Bun.spawn` FFmpeg, GPU hardware encoding (AMD AMF, NVIDIA NVENC), transparent alpha formats (ProRes 4444, WebM VP9), and sub-frame adaptive supersampling.
* [**Automated Engine Verification & Test Suites**](cli/testing-and-verification.md): Milestone regression suites (`test_milestone1.ts` through `test_milestone4.ts`), transition sweeps, visual tool tests, and continuous integration testing protocols.

### F. Project Architecture & Manifests
* [**Multi-Project Workspace & Manifest Architecture**](projects/project-system.md): Multi-project directory structure, `active.json` pointer, `project.json` manifest specification, scene entries, transition declarations, hot module reloading (HMR) isolation, interactive preview player hotkeys, and step-by-step project creation tutorial.

### G. Changelog & Releases
* [**v0.6.1 Bug Fix & Engine Audit Report**](changelog/v0.6.1-bug-fix-report.md): Complete architectural audit and stability report detailing 24 bug fixes across core rendering loops, WebGL state cache isolation, alpha premultiplication, GLTF caching, ODE springs, and FFmpeg pipeline mapping.
* [**v0.6.0 Execution Record & Release Notes**](changelog/v0.6.0-release-record.md): Complete release notes for engine v0.6.0 (Procedural Materials, 3D Kinetic Typography, Optical DoF & Volumetrics).

### H. Roadmap & Future Diagnostics
* [**Engine Architecture Review & Execution Record (v0.5.0)**](roadmap/v0.5.0-roadmap-review.md): Complete architectural review and 4-milestone execution record for v0.5.0.
* [**Proposed Visual Diagnostic Instruments (Roadmap 05–09)**](roadmap/proposed-instruments/README.md): Design specifications and problem statements for proposed instruments 05–09 (Parametric Speed Graph, Gaze Saliency Heatmap, Dynamic Contrast & Legibility, Choreography Gantt & Stagger, and Multi-Aspect Responsive Framing).
