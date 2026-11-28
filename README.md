# f(x) Studio

**A deterministic motion-design engine built for AI agents.** You describe a film; an agent writes it as code (scenes,
cameras, 3D assets, sound), reviews its own renders, and exports it at up to 4K. Every frame is a pure function of time, so
what you review is exactly what ships.

| | | |
|---|---|---|
| [![lull: the soft play](https://raw.githubusercontent.com/PenguinBTW/fxstudio-demos/main/scenes/lull/samples/01_playroom.jpg)](https://github.com/PenguinBTW/fxstudio-demos/tree/main/scenes/lull) | [![lull: the library](https://raw.githubusercontent.com/PenguinBTW/fxstudio-demos/main/scenes/lull/samples/02_library.jpg)](https://github.com/PenguinBTW/fxstudio-demos/tree/main/scenes/lull) | [![lull: the pool](https://raw.githubusercontent.com/PenguinBTW/fxstudio-demos/main/scenes/lull/samples/03_pool.jpg)](https://github.com/PenguinBTW/fxstudio-demos/tree/main/scenes/lull) |

<sub>*lull*: a 3:11 first-person horror film written, modelled, animated and sound-designed end to end by an AI agent in f(x) Studio. Scene code in [**fxstudio-demos**](https://github.com/PenguinBTW/fxstudio-demos).</sub>

> ### 🚀 Latest Release: v0.8.0 (r3)
> * **[v0.8.0 Release Record](./docs/changelog/v0.8.0-release-record.md)**: unified audiovisual production engine (modular audio, `defineMix`, 3D spatial audio, mastering), two-tier transition registry, project-scoped Blender asset layer, native 9:16 output, bundled fonts, and new example films.
> * **[Root Changelog](./CHANGELOG.md)**: full version history.

---

## 1. What It's Been Used To Make

| Project | What it is |
|---|---|
| [**lull**](https://github.com/PenguinBTW/fxstudio-demos/tree/main/scenes/lull) | 3:11 first-person horror film: one continuous take through comfortable places that turn wrong, Blender-built creatures, fully code-generated sound |
| [**fx_promo**](./app/src/scenes/fx_promo) | 3:34 f(x) Studio promo film: in-world type, dolly-zooms, a raymarched glass cathedral, an infinite-zoom climax |
| [**dimension_flight**](./app/src/scenes/dimension_flight) / [**bird_odyssey**](./app/src/scenes/bird_odyssey) | A swallow's flight through five dimensions with Blender-built worlds, GPU embers and per-world grading |
| [**agent_promo**](./app/src/scenes/agent_promo) / [**agent_v2**](./app/src/scenes/agent_v2) | Agent promo film: logo, fire, dragon, forge and an origami desk sequence |
| [**spill**](./app/src/scenes/spill), [**freefall**](./app/src/scenes/freefall), [**agent_teaser**](./app/src/scenes/agent_teaser) | Native 9:16 vertical shorts |
| [**threshold**](./app/src/scenes/threshold) | First-person horror film |
| [**spacecraft_docking**](./app/src/scenes/spacecraft_docking) | Audio benchmark: multi-stem excision and 3D object-bound thruster audio |

---

## 2. Why f(x) Studio

1. **Built for agents.** Project skills in `.agents/skills/` (a router plus specialised `fx-*` skills for scenes, 3D assets,
   transitions, audio and diagnostics) give an agent the engine's rules and workflows. Visual diagnostics (god-view camera
   blueprint, motion onion, A/B reference, seam inspector) and motion telemetry flags with repair directives let it check its
   own work instead of guessing.
2. **Deterministic by construction ($f(t)$).** Every frame is a closed-form function of time: scrubbing, supersampling and
   re-renders are bit-identical, and picture and sound can share one clock.
3. **Real 3D, no ceiling.** Full Three.js with custom shaders, physical optics (CIE spectrum, dispersion, caustics, thin-lens
   DoF), 500k GPU particles, twist-free ribbons, raymarching, and in-world 3D typography that takes the scene's light.
4. **Blender in the loop.** Each project builds its own assets headlessly (`assets/<id>/build.py` → `model.glb`), with named
   parts the code can animate.
5. **A full audio engine.** `defineMix()` manifests, multi-stem assembly, 3D object-bound spatial audio, and broadcast mastering
   to EBU R128 at ≤ −1.5 dBTP.
6. **Headless delivery.** One CLI renders stills, contact sheets and video: 720p to 4K, native 9:16, GPU encoding, the
   project's soundtrack muxed in.

---

## 3. Quickstart

### Prerequisites
- [Bun](https://bun.sh/), [FFmpeg](https://ffmpeg.org/) on your `PATH`, and Chromium for headless rendering (installed below).
- Optional: [Blender](https://www.blender.org/) 5.x to rebuild a project's 3D assets.

### Installation
```bash
git clone https://github.com/PenguinBTW/Fx-Studio.git
cd Fx-Studio/app
bun install
bun x playwright install chromium
```

### Preview a project live
```bash
bun run dev
```
Open <http://localhost:5173/?project=fx_promo> (any folder in `app/src/scenes/`), then scrub the timeline or press space.

### Render headlessly
```bash
# stills and a contact sheet
bun scripts/render.ts stills --project fx_promo --t 2,10,30 --out "/abs/path/stills"
bun scripts/render.ts sheet --project fx_promo --from 0 --to 30 --n 16 --cols 4 --out "/abs/path/sheet.png"

# 1080p60 video with the project's soundtrack; add --4k for 3840x2160 or --vertical for 9:16
bun scripts/render.ts video --project fx_promo --from 0 --to 30 --fps 60 --out "/abs/path/render.mp4"

# hardware encoding (AMD AMF / NVIDIA NVENC)
bun scripts/render.ts video --project fx_promo --gpu --gpu-encoder h264_amf --out "/abs/path/render.mp4"
```

---

## 4. Documentation Index

The complete documentation suite for **f(x) Studio** is organized under [**`docs/`**](./docs/README.md):

| Category | Description | Key Documents |
| :--- | :--- | :--- |
| [**Architecture**](./docs/architecture/engine-overview.md) | High-level system architecture, GL compositor pipeline, 25 core engine modules. | • [Engine Overview](./docs/architecture/engine-overview.md)<br>• [Modules Reference](./docs/architecture/modules-reference.md)<br>• [Compositor Pipeline](./docs/architecture/gl-compositor-pipeline.md)<br>• [Transitions System](./docs/architecture/transitions-system.md)<br>• [v0.8.0 Audiovisual Production](./docs/architecture/v0.8.0-unified-audiovisual-production.md) |
| [**Physical Optics**](./docs/engine/spectrum.md) | Color science, dispersion, caustics, and optical Depth-of-Field. | • [Spectrum & Blackbody](./docs/engine/spectrum.md)<br>• [Refraction & Dispersion](./docs/engine/refract.md)<br>• [Post-FX & Optics](./docs/engine/post-fx.md) |
| [**Geometry & Particles**](./docs/engine/particles-large.md) | GPU particles, Bishop parallel transport, ribbons, and streamline untangling. | • [Large Particles](./docs/engine/particles-large.md)<br>• [Ribbons & Aurora Curtains](./docs/engine/ribbon.md)<br>• [Tree Walk & Streamlines](./docs/engine/treewalk.md)<br>• [Volumetric Raymarching](./docs/engine/raymarch.md) |
| [**Audio & SFX**](./docs/audio/mixdown.md) | Procedural audio synthesis, events registry, and automated mixdown. | • [Audio Mixdown](./docs/audio/mixdown.md)<br>• [Procedural SFX Synthesizer](./docs/audio/sfx-synth.md)<br>• [Event Registry](./docs/audio/events.md) |
| [**Diagnostics**](./docs/diagnostics/overview.md) | The 4 visual instruments giving art directors direct sight into motion and space. | • [Diagnostics Overview](./docs/diagnostics/overview.md)<br>• [01: God-View Blueprint](./docs/diagnostics/01-godview-camera-blueprint.md)<br>• [02: Motion Onion](./docs/diagnostics/02-multi-exposure-motion-onion.md)<br>• [03: A/B Reference Anchor](./docs/diagnostics/03-visual-ab-reference-anchor.md)<br>• [04: Seam Stitch Inspector](./docs/diagnostics/04-transition-seam-stitch-inspector.md) |
| [**Authoring**](./docs/authoring/scene-authoring-guide.md) | Writing scenes, Blender-built and glTF assets, camera choreography, typography and music sync. | • [Scene Authoring Guide](./docs/authoring/scene-authoring-guide.md)<br>• [Blender Assets](./docs/authoring/blender-assets.md)<br>• [glTF Assets](./docs/authoring/gltf-assets.md)<br>• [Camera Choreography](./docs/authoring/camera-choreography.md)<br>• [Kinetic Typography](./docs/authoring/kinetic-typography.md)<br>• [Audio & Music Sync](./docs/authoring/audio-and-music-sync.md)<br>• [Custom Components](./docs/authoring/custom-components.md) |
| [**Projects**](./docs/projects/project-system.md) | Multi-project workspace, `project.json` manifests, soundtrack and mix declarations. | • [Project System](./docs/projects/project-system.md) |
| [**Telemetry**](./docs/telemetry/telemetry-engine.md) | Automated motion telemetry, flags and calibrated reports. | • [Telemetry Engine](./docs/telemetry/telemetry-engine.md)<br>• [Rules & Flags](./docs/telemetry/rules-and-flags.md)<br>• [Report Spec](./docs/telemetry/report-spec.md)<br>• [Calibration Guide](./docs/telemetry/calibration-guide.md) |
| [**CLI & Export**](./docs/cli/render-cli-reference.md) | Headless rendering CLI reference, video export, and chunked rendering. | • [Render CLI Reference](./docs/cli/render-cli-reference.md)<br>• [Video Export Pipeline](./docs/cli/video-export-pipeline.md)<br>• [Long-Timeline Rendering](./docs/cli/long-timeline.md)<br>• [Testing & Verification](./docs/cli/testing-and-verification.md) |
| [**Changelog**](./CHANGELOG.md) | Version history, release records, and architectural audit reports. | • [Root Changelog](./CHANGELOG.md)<br>• [v0.8.0 Release Record](./docs/changelog/v0.8.0-release-record.md)<br>• [v0.7.0 Release Record](./docs/changelog/v0.7.0-release-record.md)<br>• [v0.6.1 Bug Fix Report](./docs/changelog/v0.6.1-bug-fix-report.md) |

---

## License

**PolyForm Small Business License 1.0.0** ([`LICENSE.md`](./LICENSE.MD)). Non-commercial parties have full use of the
software, and small businesses under the defined revenue and employee thresholds may use it under the same terms. For
commercial licensing beyond these thresholds, email *vio@penguinbtw.com*.
