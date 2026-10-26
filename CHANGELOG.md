# Changelog

All notable changes to **f(x) Studio** (Agentic Motion Design Toolset) are documented in this file and in dedicated release reports.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [[v0.7.0]](docs/changelog/v0.7.0-release-record.md) - 2026-10-26

### Added
- **Physical Colour Science & Optics**:
  - Wyman-Sloan CIE 1931 polynomial model and Planckian blackbody locus (`spectrum.ts`, `glsl/spectrum.ts`).
  - Cauchy dispersion ($n(\lambda) = A + B/\lambda^2$), dielectric Fresnel reflection/transmission, and Descartes spherical droplet caustics recovering primary ($42.37^\circ$) and secondary ($50.41^\circ$) rainbow angles (`refract.ts`, `glsl/refract.ts`).
  - Physical thin-lens Circle-of-Confusion (CoC) and depth-aware bilateral blur gather (`dof.ts`, `glsl/dof.ts`).
- **High-Capacity Particles & Volumetrics**:
  - 500,000-particle stateless GPU instanced engine with analytical trail history $t - k\Delta t$ (`particles_large.ts`).
  - Bishop Rotation-Minimizing Frame (RMF) double-reflection parallel transport and atmospheric quantum aurora curtains (`ribbon.ts`, `aurora.ts`).
  - Multi-tier composable volumetric raymarching framework with empty-space skipping and depth-aware upsampling (`raymarch.ts`).
- **Procedural Geometry & Streamline Untangling**:
  - Streamline untangling (`treewalk.ts`) converting chaotic Brownian walks into smooth laminar streamlines with $>60\%$ path length reduction and $>90\%$ curvature reduction.
  - Hierarchical branching tree extraction from 3D random walks (`mapWalkToTree`).
  - Continuous vertex correspondence curve morphing (`curvemorph.ts`).
- **Kinetic Typography & In-World Lighting**:
  - Continuous rolling mechanical odometer with multi-digit carries and fixed tabular widths (`textfx.ts`).
  - 80-character stroked Hershey glyph library decoupled from rendering passes (`vectorglyphs.ts`).
  - In-world 3D extruded text scene lighting with depth buffer participation (`depthWrite: true`, `depthTest: true`) and volume-preserving particle deflection ($r' = (r^3 + R^3)^{1/3}$) (`text_lighting.ts`).
- **Broadcast Multi-Track Audio Mixdown**:
  - Automated mixdown pipeline complying with EBU R128 (-14.80 LUFS integrated, -1.50 dBTP true peak) with dual-pass certified digital silence gating (`mixdown.ts`, `verify_audio.py`).
  - Deterministic 48 kHz / 24-bit procedural SFX synthesizer (`synth.ts`).
  - Automated transition seam checker asserting screen jumps $< 0.0003\,\text{px}$ across act boundaries (`check_seams.ts`).
- **Automated Verification**:
  - 17 test suites covering all prerequisites (P1–P14) and modernization milestones (M1–M7).

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
