# Engine roadmap: animator workflow and Blender interop

Status: proposal (post v0.7.0 nightly audit). Nothing here is implemented unless marked **shipped**.

## 0. Principle: own time, delegate geometry

f(x) Studio's strength is **deterministic time**: `f(t)` evaluation, audio/lyric/beat sync, seam-safe transitions, HDR compositing and headless export. Its weakness is authoring *things* (meshes, rigs, materials, hand-keyed motion) in code.

The split we want:

| Owned by f(x) Studio | Delegated to DCC tools (Blender, Resolve, DAW) |
|---|---|
| Timeline, events, beat/lyric sync | Modeling, UVs, sculpting, retopo |
| Deterministic playback of baked animation | Rigging, skinning, character keyframing |
| Procedural/analytic FX (particles, SDF, lines, type) | Cloth/fluid/rigid sims (bake to GLB / point cache) |
| Camera *choreography* tied to music | Camera *blocking* (optional, round-trips via GLTF) |
| HDR compositing, post, transitions | Final grade (export log/ACES), final mix/master |
| Render passes + export | Editorial (Resolve/Premiere) |

Rule of thumb: if an artist would reach for a mouse and a viewport, it belongs in Blender; if it must hit a beat at frame-exact time, it belongs in the engine.

## 1. Blender → engine pipeline

### 1.1 Today
- `GLTFManager.instantiate(url)` + `SkeletonUtils.clone`, closed-form `setTime(t, clip)`, `center()/fitToBox()`, `getScreenBounds()`.
- Draco decoding (**shipped**: decoders now copied to `public/draco/` on `bun install`).
- Clip switching no longer blends with the auto-played first clip (**shipped**).
- Gaps: GLTF cameras, lights, environment, morph-target drivers, hot reload, markers, KTX2/Meshopt, per-project asset folders.

### 1.2 Target workflow
```
Blender scene ──(Fx export add-on)──► scenes/<project>/assets/<shot>.glb
                                   └► scenes/<project>/assets/<shot>.fx.json   (markers, camera, frame range, fps)
Vite watcher ──► engine hot-reloads model, keeps current t
project.json ──► entry { scene, assets: ['<shot>.glb'], camera: 'gltf:<shot>/Camera' }
```

### 1.3 Milestones

**B1: GLTF camera import (highest value)**
- `instance.cameras` lists `THREE.PerspectiveCamera` nodes; `rig.followGltfCamera(instance, name)` samples the node's world matrix at `setTime(t)` and drives `rig.position/target/roll`, and `focalLengthMm` from `fov` + sensor height (Blender default 24 mm vertical fit; export it as an extra).
- Lets you block a camera in Blender to the song's audio (Blender VSE + scrubbing), then layer engine trauma/shake on top.
- Acceptance: a Blender camera with 3 keys reproduces framing within 1 px at 1080p.

**B2: Lights and environment**
- `KHR_lights_punctual` already parses in three; add a unit-conversion helper (Blender W → three candela/lux; the glTF exporter's "Standard" vs "Unitless" mode matters).
- `defineScene({ environment: 'studio.hdr' | 'room' })` using PMREM (`RoomEnvironment` built-in as a zero-asset default). Without an env map, Blender Principled BSDF exports look flat and dark; this is the #1 "my model looks wrong" complaint.
- Procedural materials: `lightDir` uniform (**shipped**). Next step is an `onBeforeCompile` variant on `MeshPhysicalMaterial` so procedural looks respond to scene lights and env.

**B3: Markers → events and anchors**
- Blender timeline markers and named empties (`FX_anchor_*`) export into `<shot>.fx.json` / GLTF `extras`.
- Markers merge into the manifest's `events` (respecting downbeat snapping in `events.ts`).
- Empties become `ctx.anchor('Lyric_01')` → world and screen position per frame, so kinetic type and SDF callouts attach to geometry blocked in Blender.

**B4: Hot reload**
- Vite already watches `public/`; on a `.glb` change, `GLTFManager.invalidate(url)`, re-instantiate, keep `t`. Stateless scenes need no preroll; stateful ones reuse existing `reset()` + preroll.
- Save in Blender (with a "export on save" add-on toggle) → the preview updates in under 1 s.

**B5: Animation control**
- `setTime(t, { clips: { Run: 1, Wave: 0.4 } })` for weighted blends; per-clip offset/loop.
- Morph targets / shape keys: `instance.morph('Mouth_O', audio.env('vocals', t))`, which is where audio-reactive deformation becomes trivial.
- Bake-friendly: everything stays closed form (`mixer.setTime`), so determinism checks still pass.

**B6: Asset pipeline hygiene**
- Per-project `scenes/<project>/assets/` (models, HDRIs, fonts, audio) with `assets: []` declared in `project.json`; a preflight lists missing files with a clear error instead of silent dummies.
- Add `KTX2Loader` (basis transcoder copied like Draco) and `MeshoptDecoder`; recommend `gltf-transform optimize` in docs.
- `GLTFManager.clearCache()` on project switch / engine dispose to free shared GPU buffers.

**B7: Fx Blender add-on (stretch)**
- One-click export: GLB (Draco/Meshopt), camera, markers, frame range, fps → writes the files above and patches `project.json`.
- Optional "preview in Fx" button that opens `http://localhost:5173/?project=<p>&t=<current frame / fps>`.

**Out of scope:** Alembic/USD/FBX loaders (bake to GLB in Blender), in-engine rigging/IK authoring, physics sims.

## 2. Animator-facing engine features

### 2.1 Timing and keyframes
- **Camera path timing**: waypoints are now reached at their `t` (`rig.pathTiming = 'keyed'`, default, **shipped**); `'uniform'` keeps constant arc-length speed. Next: per-segment easing (`ease: 'inOutCubic'`) and velocity-continuous timing (monotone cubic over waypoint t).
- **Data-driven keys**: `keys()` exists in `util.ts`, but only in code. Add `scenes/<project>/<scene>.keys.json` (channel → `[t, v, ease]`), loaded at init, with HMR. Tweaking timing no longer means editing TypeScript.
- **Live params panel**: scene `params` (already in manifests) exposed as sliders in the preview; "Save" writes back to `project.json`. Determinism is preserved because params are static per render.

### 2.2 Preview player
- A real timeline strip: entries, transitions, events, sections, beat grid, waveform. Drag to retime, which writes `project.json`.
- Loop A/B, J/K/L shuttle, frame step, a frame counter in project fps, and title/action-safe overlays.
- Onion skin and god-view toggles in-player (they exist as CLI commands).
- GPU memory HUD: render-target count, MB, draw calls. HDR at 4K makes VRAM the real limit.

### 2.3 Composition
- Overlays now keep compositing during standalone transitions (**shipped**). Next: an explicit `layer: 'over' | 'under' | 'base'` on manifest entries, so an overlay doesn't depend on overlap-based crossfade maths.
- `CompositorGraph` exposed in manifests: blend mode, opacity curve and matte per entry, without code.

### 2.4 Output
- Render passes: beauty, depth, alpha, object/entity ID (from `SceneGraph`), and motion vectors, as EXR or 16-bit PNG.
- Log/ACEScct output option so grading happens in Resolve; keep the in-engine grade for previews.
- Per-project audio and lyrics: `data/<project>/audio.json` first, shared fallback (**shipped**). Next: move the song file itself under the project.

## 3. Simplification backlog
- One CLI entry point: `bun run fx <cmd>`. Delete the 10 forwarding shims in `scripts/` and `app/scripts/`.
- Retire `camera3d.ts` (legacy CPU projection) once remaining callers move to `rig.ts` + `ViewportSpace`.
- Move music-video-specific code (`PDoom`, `__pdoom` alias, lyric readout in `engine.ts`/`hud.ts`) into a project plugin and overlay.
- Keep `heal.ts` and the motion/telemetry analysers as dev tooling outside the runtime bundle.
- Skills: extract one `fx-invariants` skill (determinism, `setTime`, stateless transitions, no render-time fetch) and link to it from the others; cut the repeated "never…" lists; add a Blender how-to skill once B1–B4 land.
- One test runner (`bun run test --filter rig`) instead of 15+ `test:*` scripts; CI on PRs running typecheck, build, determinism and tests on a fresh clone (no gitignored data).

## 4. Suggested order
1. B2 environment default + B1 GLTF camera (biggest visible win for Blender users).
2. B4 hot reload + B6 per-project assets/preflight.
3. Timeline strip + live params (daily-use friction).
4. Render passes / log output.
5. B3 markers/anchors, B5 blends/morphs.
6. Blender add-on, then simplification backlog in parallel.
