# f(x) Studio (v0.7.0 Stable)

**This project is licensed under the PolyForm Small Business License 1.0.0 ([`LICENSE.md`](./LICENSE.MD)). This grants non-commercial parties full use of the software and allows small businesses under the defined revenue and employee thresholds to use it under the same terms.**

**For commercial licensing beyond these thresholds, email *vio@penguinbtw.com***

> ### 🚀 Latest Release: v0.7.0
> * **[v0.7.0 Release Record](./docs/changelog/v0.7.0-release-record.md)**: Major engine overhaul delivering physical optics (Wyman-Sloan CIE 1931 spectrum, Cauchy dispersion, Descartes rainbow caustics), thin-lens Circle-of-Confusion DoF, 500k GPU instanced particles, Bishop RMF twist-free ribbons, divergence-free curl noise, streamline untangling, in-world 3D PBR typography with particle deflection, and an EBU R128 broadcast-compliant audio mastering pipeline (-14.8 LUFS / -1.5 dBTP).
> * **[Root Changelog](./CHANGELOG.md)**: Full version history across all releases.

---

A production-grade, agent-accessible toolkit for procedural 60 fps WebGL/Canvas2D motion design across **any domain**—scientific narrative films, commercial product reveals, UI/UX interaction showcases, kinetic typography sequences, procedural data visualizations, brand identity resolves, and audiovisual productions.

---

## 1. Core Architectural Pillars

1. **Mathematical Determinism ($f(t)$)**:
   Every frame is a pure, closed-form function of timeline timestamp $t$. Forward playback, reverse scrubbing, and sub-frame supersampling (1 to 324 spp) evaluate bit-identically with zero Euler drift.
2. **Physical Optics & Spectrum**:
   Built-in Wyman-Sloan CIE 1931 colour matching, Planckian blackbody locus, Cauchy dispersion $n(\lambda) = A + B/\lambda^2$, dielectric Fresnel equations, and Descartes spherical caustics.
3. **High-Capacity Procedural Volumetrics**:
   Up to 500,000 GPU-instanced particles with analytical trail history $t - k\Delta t$, twist-free Bishop rotation-minimizing frame ribbons, and real-time volumetric raymarching.
4. **Kinetic Typography & In-World Lighting**:
   Rolling mechanical odometer with continuous multi-digit carries, stroke-revealed single-stroke Hershey glyphs, and in-world 3D extruded text participating directly in scene depth buffers and physical DoF.
5. **Integrated Broadcast Audio Mixdown**:
   Automated multi-track mixdown pipeline mastering to EBU R128 standards with certified sample-exact digital zero intervals and transient-aware sidechain ducking.

---

## 2. Quickstart

### Prerequisites
- [Bun](https://bun.sh/) runtime installed.
- [FFmpeg](https://ffmpeg.org/) (for video export).

### Installation
```bash
# Clone the repository
git clone https://github.com/PenguinBTW/Agentic-motion-design-toolset.git
cd Agentic-motion-design-toolset/app

# Install dependencies
bun install
```

### Launch Interactive Preview Player
```bash
bun run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. Use the timeline scrubber or spacebar to play and inspect active scenes in real-time.

### Headless Video Export
```bash
# Export 1080p60 video with multi-track mixdown
bun scripts/render.ts video --from 0 --to 30 --fps 60 --mix path/to/mix.json --out ../out/render.mp4

# Hardware accelerated encoding (AMD AMF / NVIDIA NVENC)
bun scripts/render.ts video --gpu --gpu-encoder h264_amf --out ../out/render.mp4
```

---

## 3. Documentation Index

The complete documentation suite for **f(x) Studio** is organized under [**`docs/`**](./docs/README.md):

| Category | Description | Key Documents |
| :--- | :--- | :--- |
| [**Architecture**](./docs/architecture/engine-overview.md) | High-level system architecture, GL compositor pipeline, 25 core engine modules. | • [Engine Overview](./docs/architecture/engine-overview.md)<br>• [Modules Reference](./docs/architecture/modules-reference.md)<br>• [Compositor Pipeline](./docs/architecture/gl-compositor-pipeline.md)<br>• [Transitions System](./docs/architecture/transitions-system.md) |
| [**Physical Optics**](./docs/engine/spectrum.md) | Color science, dispersion, caustics, and optical Depth-of-Field. | • [Spectrum & Blackbody](./docs/engine/spectrum.md)<br>• [Refraction & Dispersion](./docs/engine/refract.md)<br>• [Post-FX & Optics](./docs/engine/post-fx.md) |
| [**Geometry & Particles**](./docs/engine/particles-large.md) | GPU particles, Bishop parallel transport, ribbons, and streamline untangling. | • [Large Particles](./docs/engine/particles-large.md)<br>• [Ribbons & Aurora Curtains](./docs/engine/ribbon.md)<br>• [Tree Walk & Streamlines](./docs/engine/treewalk.md)<br>• [Volumetric Raymarching](./docs/engine/raymarch.md) |
| [**Audio & SFX**](./docs/audio/mixdown.md) | Procedural audio synthesis, events registry, and automated mixdown. | • [Audio Mixdown](./docs/audio/mixdown.md)<br>• [Procedural SFX Synthesizer](./docs/audio/sfx-synth.md)<br>• [Event Registry](./docs/audio/events.md) |
| [**Diagnostics**](./docs/diagnostics/overview.md) | The 4 visual instruments giving art directors direct sight into motion and space. | • [Diagnostics Overview](./docs/diagnostics/overview.md)<br>• [01: God-View Blueprint](./docs/diagnostics/01-godview-camera-blueprint.md)<br>• [02: Motion Onion](./docs/diagnostics/02-multi-exposure-motion-onion.md)<br>• [03: A/B Reference Anchor](./docs/diagnostics/03-visual-ab-reference-anchor.md)<br>• [04: Seam Stitch Inspector](./docs/diagnostics/04-transition-seam-stitch-inspector.md) |
| [**CLI & Export**](./docs/cli/render-cli-reference.md) | Headless rendering CLI reference, video export, and chunked rendering. | • [Render CLI Reference](./docs/cli/render-cli-reference.md)<br>• [Video Export Pipeline](./docs/cli/video-export-pipeline.md)<br>• [Long-Timeline Rendering](./docs/cli/long-timeline.md) |
| [**Changelog**](./CHANGELOG.md) | Version history, release records, and architectural audit reports. | • [Root Changelog](./CHANGELOG.md)<br>• [v0.7.0 Release Record](./docs/changelog/v0.7.0-release-record.md)<br>• [v0.6.1 Bug Fix Report](./docs/changelog/v0.6.1-bug-fix-report.md) |
