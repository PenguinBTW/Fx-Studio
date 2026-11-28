# Changelog

All notable changes to **f(x) Studio** (Agentic Motion Design Toolset) are documented in this file and in dedicated release reports.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v0.8.0-r2] - 2026-11-28

### Documentation
- Main README: the documentation index links the v0.8.0 release record and architecture doc, and gains Authoring (Blender and glTF assets, camera, typography, music sync), Projects and Telemetry rows.
- Docs hub links the v0.8.0 architecture doc and the November codebase review.
- Engine overview gains a v0.8.0 subsystems section (audio engine, transition registry, Blender asset layer, delivery) and documents the bundled fonts; kinetic typography notes where the fonts live.

---

## [[v0.8.0]](docs/changelog/v0.8.0-release-record.md) - 2026-11-28

### Added
- **Unified Audiovisual Production Engine**:
  - **Modular Audio Subsystem (`app/src/engine/audio/`)**:
    - `manifest.ts`: Declarative `defineMix()` TypeScript DSL with schema validation and complete type definitions (`MixBus`, `StemsConfig`, `StemEditOptions`, `Excision`, `SoundtrackConfig`, `SpatialSourceConfig`, `BusConfig`, `MixConfig`).
    - `stem_nle.ts`: Offline Float32 PCM multi-stem timeline assembly with master transient lock (`PRE_ATTACK_KICK_OFFSET_MS = -2.38` ms applied collectively across all stems to eliminate phase smearing), asymmetric 3ms cosine crossfades, exponential harmonic tail spillover ($\exp(-t/\tau)$), and vocal breath gating ($\ge 120$ ms).
    - `smoother.ts`: Recursive 1-pole lowpass IIR parameter smoother bridging 60 Hz visual frame rate to 48 kHz audio rate for de-zippered stereo panning and filter sweeps.
    - `telemetry.ts`: Scene-side zero-DSP telemetry emitter (`AudioTelemetryEmitter`), screen NDC projection arithmetic (`projectWorldToScreenPan`), and NDJSON streaming (`events.jsonl`).
    - `spatializer.ts`: Pure TypeScript/Bun 3D spatializer with equal-power vector panning $[-0.65, +0.65]$, clamped distance attenuation, Cytomic SVF zero-delay feedback air absorption rolloff ($20\text{ kHz} \to 2.5\text{ kHz}$), and occlusion shelf notch filtering.
    - `dsp.ts`: High-performance cinematic DSP suite:
      - `applyVocalSanctuary`: Dynamic parametric Cytomic SVF notch at $2.2\text{ kHz}$ ($Q = 1.2$, $-3.5\text{ dB}$) modulated by speech envelope.
      - `applySplitBandDuck`: 2-pole Linkwitz-Riley crossover at $250\text{ Hz}$ decoupling sub-bass punch while ducking mid/high frequencies around dialogue and SFX.
      - `applyLookaheadLimiter`: $1.5\text{ ms}$ lookahead mastering limiter strictly enforcing $\le -1.5\text{ dBTP}$ ceiling.
      - `applyPreDropVacuum`: $40\text{--}120\text{ ms}$ digital silence air gap preceding major visual downbeats with $2\text{ ms}$ cosine anti-click fade.
  - **Two-Tier Transition Cascade & Registry (`app/src/engine/transitions/registry.ts`)**:
    - Project-local bespoke transitions in `scenes/<project>/transitions/` take priority (Tier 1) over global engine transitions (Tier 2).
    - Dual-environment compatible: Vite compile-time `import.meta.glob` for browser runtime + headless CLI injection (`setTransitionRegistry`).
  - **Unified Offline Acoustic Analysis CLI (`scripts/analyze_song.py --audit`)**:
    - Bar-by-bar chroma cosine similarity, bass fundamental root matching, vocal silence gap detection, kick pre-attack zero crossing offset, and candidate cut reliability scoring.
  - **Autonomous Spacecraft Docking Benchmark (`app/src/scenes/spacecraft_docking/`)**:
    - 45-second cinematic sequence of an orbital cargo transport docking with an asteroid station, featuring multi-stem music excision, 3D object-bound thruster audio, bespoke `hangar_airlock` transition, split-band ducking, vocal sanctuary, and broadcast EBU R128 mastering (-14.40 LUFS, -1.70 dBTP).
- **Documentation & Agent Skills Overhaul**:
  - Comprehensive documentation updates: `docs/architecture/v0.8.0-unified-audiovisual-production.md`, `docs/audio/mixdown.md`, `docs/cli/render-cli-reference.md`.
  - Upgraded agent skills for v0.8.0: `design-around-audio`, `fx-engine`, `fx-scenes`, `sound-design-and-foley`, `video-assembly-and-finishing`.
- **Project-Scoped Blender Asset Layer (#5, #12)**:
  - Per-project `scenes/<project>/assets/<id>/build.py` → `model.glb` pipeline (headless Blender), named animatable parts via the `fx_part` custom property (also on instanced parts), importer animation API, asset manifests and `bun scripts/assets_check.ts <project>`.
- **Delivery & Audio Configuration**:
  - `project.json` declares a project's soundtrack and mix; `render.ts` uses them by default (#17).
  - Native 9:16 vertical output (`--vertical` / `--shorts`, 1080×1920) for Shorts, Reels and TikTok (#25).
- **Bundled Runtime Fonts (#20)**: Archivo, Cormorant Garamond and IBM Plex Mono instances (with OFL licences) ship in `app/public/fonts/`, so fresh clones render the intended faces.
- **Example Projects & Films**:
  - `bird_odyssey` and `dimension_flight`: a swallow's flight through five dimensions with Blender-built worlds, GPU embers, depth of field and per-world look-dev (#6–#10).
  - `fx_promo`: a 3:34 f(x) Studio promo film (in-world type, dolly-zoom, GPU ash, raymarched KIFS Prism cathedral, infinite-zoom climax) (#14–#18).
  - `agent_promo` / `agent_v2`: agent promo film with logo, fire, dragon, forge and origami desk sequences and scene-aware transitions (#21–#24).
  - Vertical shorts: `agent_teaser` (#25), `freefall` (38 s looping orbit → quark → your screen, #26), `spill` (29 s mixed-style world, #28–#30).
  - `threshold`: a first-person horror film (#194).
- **Documentation & Skills**:
  - Security model for nightly (#3); `fx-feedback-gui` human-review workflow and the fx-notes loop in skills (#13).
  - Skills/docs audit: loosened over-restrictive style rules, documented headless Blender and render resolution presets, fixed dead links (#31).

### Fixed
- Engine audit of "possibly unintended" behaviour plus a Blender/engine roadmap (#2, #4).
- Renders now fail on scene errors instead of writing black frames; no orphaned Vite servers after a render; display-stage grade, DoF depth and island defaults corrected; transition docs (#11).
- Font loader no longer caches missing or rejected font files (#19).
- Bird odyssey god-ray ghosting (#7); SPILL seam leftovers, camera jump, shader undefined behaviour and hose determinism (#30).

---

## [[v0.7.0]](docs/changelog/v0.7.0-release-record.md) - 2026-10-26

### Added
- **Physical Colour Science & Optics**:
  - Wyman-Sloan CIE 1931 polynomial model and Planckian blackbody locus (`spectrum.ts`, `glsl/spectrum.ts`).
  - Cauchy dispersion ($n(\lambda) = A + B/\lambda^2$), dielectric Fresnel reflection/transmission, and Descartes spherical droplet caustics recovering primary ($42.37^\circ$) and secondary ($50.41^\circ$) rainbow angles (`refract.ts`, `glsl/refract.ts`).
  - Physical thin-lens Circle-of-Confusion (CoC) and depth-aware bilateral blur gather (`dof.ts`, `glsl/dof.ts`).
  - Multi-tier optical post-processing (`post_optics.ts`) with anamorphic diffraction spikes and chromatic dispersion.
- **High-Capacity Particles & Volumetrics**:
  - 500,000-particle stateless GPU instanced engine with analytical trail history $t - k\Delta t$ (`particles_large.ts`).
  - Bishop Rotation-Minimizing Frame (RMF) double-reflection parallel transport and atmospheric quantum aurora curtains (`ribbon.ts`, `aurora.ts`).
  - Multi-tier composable volumetric raymarching framework with empty-space skipping and depth-aware upsampling (`raymarch.ts`, `glsl/raymarch.ts`).
- **Procedural Geometry & Streamline Untangling**:
  - Streamline untangling (`treewalk.ts`) converting chaotic Brownian walks into smooth laminar streamlines with $>60\%$ path length reduction and $>90\%$ curvature reduction.
  - Hierarchical branching tree extraction from 3D random walks (`mapWalkToTree`).
  - Continuous vertex correspondence curve morphing (`curvemorph.ts`).
- **Kinetic Typography & In-World Lighting**:
  - Continuous rolling mechanical odometer with multi-digit carries and fixed tabular widths (`textfx.ts`).
  - 80-character stroked Hershey glyph library decoupled from rendering passes (`vectorglyphs.ts`, `hersheyglyphs.ts`).
  - In-world 3D extruded text scene lighting with depth buffer participation (`depthWrite: true`, `depthTest: true`) and volume-preserving particle deflection ($r' = (r^3 + R^3)^{1/3}$) (`text_lighting.ts`).
- **Camera Rig Solvers**:
  - Analytical Dolly-Zoom (Vertigo effect) solver with relative error $< 4.44 \times 10^{-16}$.
  - Projected screen-space autofocus radius calculator (`computeScreenFocusRadius`).
  - Spherical polar orbit controller (`CameraRig.orbit`).
- **Broadcast Multi-Track Audio Mixdown**:
  - Automated mixdown pipeline complying with EBU R128 (-14.80 LUFS integrated, -1.50 dBTP true peak) with dual-pass certified digital silence gating (`mixdown.ts`, `verify_audio.py`).
  - Deterministic 48 kHz / 24-bit procedural SFX synthesizer (`synth.ts`).
  - Decoupled timeline event registry and cue bus (`events.ts`).
- **Long-Timeline Rendering & Release Automation**:
  - Chunked long-timeline rendering pipeline (`scripts/render_chunks.ts`, `docs/cli/long-timeline.md`) for 10+ scene sequences.
  - Dual-README architecture (`README.main.md` for public showcase, `README.nightly.md` for engine dev).
  - Automated release promotion script (`scripts/promote.ts`).
  - Clock and scrub determinism verification scanners (`check_determinism.ts`, `check_scrub_determinism.ts`).
  - Memory leak smoke test across forward/reverse scrub loops (`smoke_memory.ts`).

### Refactored & Modernized
- **Zero-Allocation Lazy Subsystem Architecture (`dsl.ts`)**:
  - Converted `SceneDSL` from eager 12-subsystem initialization to lazy on-demand property getters (`lines`, `particles`, `largeParticles`, `sdf`, `materials`, `models`, `text3DNodes`, `textNodes`), protecting 33 importer scenes while reducing unused subsystem heap/GPU allocations to zero (Milestone M5).
- **Subsystem Modularization & File Splitting**:
  - **Shader Extraction (`app/src/engine/glsl/`)**: Extracted embedded GLSL template strings out of TypeScript engine files into dedicated typed shader modules (`aurora.ts`, `dof.ts`, `noise.ts`, `raymarch.ts`, `refract.ts`, `spectrum.ts`).
  - **Post-Processing Pipeline**: Split monolithic post pipeline into core compositor (`post.ts`) and lens optics pass (`post_optics.ts`).
  - **Typography Decoupling**: Split typography into OpenType paths (`text.ts`), 3D extrusion (`text3d.ts`), kinetic counters (`textfx.ts`), code-only stroke glyphs (`vectorglyphs.ts`), Hershey plotter geometry (`hersheyglyphs.ts`), and in-world PBR lighting (`text_lighting.ts`) (Milestone M6).
  - **Mathematical Noise**: Extracted curl noise, analytical Jacobian ($\text{Tr}(\mathbf{J}) \equiv 0$), 3D simplex, and Voronoi into a dedicated `noise.ts` module.
- **Legacy Rasterizer Retirement (`camera3d.ts` &rarr; `util.ts`)**:
  - Moved canonical vector math and types (`V3`, `RGB`, `v3Add`, `v3Sub`, `v3Scale`, `v3Lerp`, `v3Dist`) to `engine/util.ts`.
  - Decoupled 6 engine files (`particles.ts`, `rig.ts`, `scenegraph.ts`, `text.ts`, `transform.ts`, `viewport.ts`) from legacy CPU software rasterizer, deprecating old canvas projection code (Milestone M2).
- **Shader Semantics & Documentation Fix**:
  - Corrected `focusDist` documentation in `post.ts` to clarify 2D radial screen-space vignette radius semantics versus 3D scene depth DoF (Milestone M3).
- **CLI Strict TypeScript Restoration (`inspect_frame.ts`)**:
  - Resolved 19 strict compiler errors in `scripts/inspect_frame.ts`, adding explicit typed interfaces (`VisionDirective`, `MessageContentBlock`) and error type discriminators (Milestone M1).
- **Repository Cleanliness & Security**:
  - Audited legacy repair code (`heal.ts`), purged untracked output and data directories (`app/out/`, `app/public/data/`), and enforced strict `.gitignore` rules for `keys.txt` (Milestone M7).

---

## [[v0.6.1]](docs/changelog/v0.6.1-bug-fix-report.md) - 2026-10-24

### Fixed
- WebGL framebuffer feedback loop in multi-scene overlaps via 2-target ping-pong ring `mixRTs`.
- Auxiliary `sampleScene()` state mutation corrupting primary timeline playback.
- DSL 3D text multi-material opacity handling for `ExtrudedText` arrays.
- FFmpeg cover art stream hijacking via explicit `-map 0:v:0` and `-map 1:a:0?`.
- Timeline drivers zero-division and null-safety guards.
- Total of 24 critical engine stability and numerical bugs resolved.

---

## [[v0.6.0]](docs/changelog/v0.6.0-release-record.md) - 2026-10-24

### Added
- Procedural PBR Shader Materials (`material.ts`).
- 3D Extruded Kinetic Typography (`text3d.ts`).
- Optical Depth of Field & Volumetric Godrays (`post.ts`).
- Automated 60fps Motion Telemetry Engine (Rules F01–F16).
