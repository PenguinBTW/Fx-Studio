# Engine roadmap: animator workflow and Blender interop

Status: proposal (post v0.7.0 nightly audit). Nothing here is implemented unless marked **shipped**.

## 0. Principle: own time, delegate geometry

f(x) Studio's strength is **deterministic time**: `f(t)` evaluation, audio/lyric/beat sync, seam-safe transitions, HDR compositing and headless export. Its weakness is authoring *things* (meshes, rigs, materials, hand-keyed motion) in code.

The split we want:

| Owned by f(x) Studio | Delegated to DCC tools (Blender, Resolve, DAW) |
|---|---|
| Timeline, events, beat/lyric sync | Modeling, UVs, sculpting, retopo |
| Deterministic playback of baked animation | Rigging, skinning, character keyframing |
| Procedural/analytic FX (particles, SDF, lines, type) | Cloth/fluid/rigid sims (bake to GLB; VAT for topology-changing sims) |
| Camera *choreography* tied to music | Camera *blocking* (optional, round-trips via GLTF) |
| HDR compositing, post, transitions | Final grade (export linear EXR), final mix/master |
| Render passes + export | Editorial (Resolve/Premiere) |

Rule of thumb: if an artist would reach for a mouse and a viewport, it belongs in Blender; if it must hit a beat at frame-exact time, it belongs in the engine.

## 1. Blender → engine pipeline

### 1.1 Today
- `GLTFManager.instantiate(url)` + `SkeletonUtils.clone`, closed-form `setTime(t, clip)`, `center()/fitToBox()`, `getScreenBounds()`.
- **Shipped:** Draco decoders are copied to `public/draco/` on install/dev/build. Clip switching no longer blends with the auto-played first clip. One-shot clips survive backward scrubbing (`reset().play()`).
- Gaps: GLTF cameras, lights/world, colour-management parity, morph-target drivers, hot reload, markers, KTX2/Meshopt, per-project asset folders.

### 1.2 Target workflow
```
Blender scene ──(Fx export add-on)──► scenes/<project>/assets/<shot>.glb
                                   └► scenes/<project>/assets/<shot>.fx.json   (sidecar: fps, frame start, colour, markers, world, lens extras)
Vite plugin   ──► custom HMR event → engine re-instantiates the model, keeps current t
project.json  ──► entry { scene, assets: ['<shot>.glb'], camera: 'gltf:<shot>/Camera' }
song + beats  ──(add-on import)──► Blender timeline markers   (round trip: block the camera to the beat in Blender)
```
Choose **one** per-project location now (`scenes/<project>/assets/`, served through a Vite alias) instead of splitting data between `public/data/<project>/` and `src/scenes/<project>/`.

### 1.3 Milestones

**B0: Preflight + sidecar (do first; cheap, unlocks everything else)**
- `bun run fx preflight <project>` runs `gltf-validator` and checks clip names, fps, frame start, camera aspect, unsupported extensions, texture VRAM, missing files and missing `userData.fx`. Clear errors instead of silent dummies.
- Sidecar `<shot>.fx.json`, versioned (`"fx": 1`): Blender fps, `frame_start`, view transform/look/exposure, world/HDRI path, markers, lens extras (shift, f-stop, focus distance).
- Frame timing rules: Blender scenes start at frame 1 by default (≈16.7 ms offset at 60 fps); the exporter bakes keys at Blender's fps, so a 24 fps file played at 60 fps gets kinks. Document "Blender scene fps = project fps, sample every frame", and apply `frame_start` as a clip offset.

**B1: GLTF camera import**
- `instance.cameras` lists camera nodes. glTF stores `yfov` + `aspectRatio`, so `focalPx = (H/2) / tan(yfov/2)`; no sensor-size extra needed. Warn when the Blender render aspect isn't 16:9 (Auto sensor fit flips axis for portrait).
- Two modes: `rig.followGltfCamera(inst, name, { mode: 'matrix' })` drives the Three camera directly from the node's world matrix (lossless), with engine trauma/shake layered on top; `'rig'` decomposes into position/target/roll for further choreography.
- Animated focal length/focus: Blender can export them via `KHR_animation_pointer`, but three's `GLTFLoader` support is uncertain. Bake those curves into the sidecar instead.
- Acceptance: a Blender camera with 3 keys reproduces framing within 1 px at 1080p (needs B0's fps/frame-start parity).

**B2: Lights, environment, colour**
- `KHR_lights_punctual` parses in three. With the exporter's lighting mode set to "Standard", values already land in three's units; document that rather than writing a W→cd helper.
- Not exported: area lights (map via `userData.fx` → `RectAreaLight`) and the Blender world/HDRI (path in the sidecar).
- `defineScene({ environment: 'studio.hdr' | 'room' })` using PMREM (`RoomEnvironment` as a zero-asset default). Without an env map, Principled BSDF exports look flat and dark.
- **Colour management parity (the other half of "my model looks wrong").** Blender defaults to Filmic (3.x) or AgX (4.x). Offer `post.toneMap: 'agx'` (three ships `AgXToneMapping`), read view transform/exposure from the sidecar, and use Standard for UI/graphics shots.
- Procedural materials: `lightDir` uniform with world-space normals (**shipped**). Next: an `onBeforeCompile` variant on `MeshPhysicalMaterial` so procedural looks respond to scene lights and env.

**B3: Markers, anchors, beat round-trip**
- Timeline markers are not in glTF, so they travel through the sidecar and merge into manifest `events` (respecting downbeat snapping in `events.ts`).
- Named empties with custom properties (exporter: Include › Custom Properties) arrive in `userData`. Define a versioned `userData.fx` schema (`{ anchor: 'Lyric_01' }`). `ctx.anchor('Lyric_01')` gives the world and screen position per frame, so type and callouts attach to geometry blocked in Blender.
- Round trip: the add-on imports the song, beat grid and `events.json` as Blender markers. Blocking a camera to the beat is the key music-video workflow and is currently one-way.

**B4: Hot reload**
- A change in `public/` makes Vite reload the whole page and lose `t`. Add a Vite plugin that watches `assets/**/*.glb` and sends a custom HMR event. The engine then calls `GLTFManager.invalidate(url)` and re-instantiates with a cache-busting query, keeping `t`. As a fallback, persist `t` in the URL on full reloads.
- With an "export on save" toggle in the add-on, a Blender save updates the preview in under 1 s.

**B5: Animation control**
- Pick one exporter animation mode (Actions or NLA Tracks) and document it. Clip names come from actions/tracks, and "Always sample / start at 0" options shift clip offsets, so take per-clip offsets from the sidecar.
- `setTime(t, { clips: { Run: 1, Wave: 0.4 } })` for weighted blends, staying closed-form (`mixer.setTime`).
- Shape keys arrive as morph targets with names (`extras.targetNames`). Drivers are not exported (bake them), and applying modifiers can drop shape keys. `instance.morph('Mouth_O', audio.env('vocals', t))` must run **after** `mixer.setTime` (which overwrites weights), with defined add/override rules. Pull audio→morph forward: it's the clearest thing the engine can do that Blender can't easily.

**B6: Asset pipeline**
- Blender exports Draco and WebP only, not KTX2 or Meshopt. Make `gltf-transform optimize` a CLI/add-on step, not a doc tip: Meshopt for skinned/morphing meshes, Draco for static ones, KTX2 for textures (copy the basis transcoder like Draco). Quantisation changes pixels, so re-baseline goldens when enabling it.
- Geometry Nodes instances export as `EXT_mesh_gpu_instancing` (Blender 3.6+), which three loads: cheap scattering.
- Procedural node textures (noise and similar) don't export; document a "bake textures" step. Transmission, clearcoat, sheen and emissive-strength extensions come through.
- Simulations whose topology changes can't live in a GLB: add a vertex-animation-texture (VAT) loader or keep sims out of scope.
- `GLTFManager.clearCache()` on project switch / engine dispose to free shared GPU buffers.

**B7: Fx Blender add-on**
- One-click export: GLB + sidecar + optional `gltf-transform` pass, then patches `project.json`.
- Import song/beats/events as markers (B3).
- "Preview in Fx" button opening `http://localhost:5173/?project=<p>&t=<frame/fps>`.

**Out of scope:** Alembic/USD/FBX loaders (bake to GLB in Blender), in-engine rigging/IK authoring, physics sims.

## 2. Animator-facing engine features

### 2.1 Timing and keyframes
- **Camera path timing (shipped, opt-in):** `rig.pathTiming = 'keyed'` makes waypoint `i` arrive at its `t`, at constant speed within each segment. `'uniform'` (constant arc-length speed) stays the default so existing scenes keep their framing. Path focal fallback no longer depends on the previous frame, and mixed mm/px waypoints blend in mm.
- Next: velocity-continuous keyed timing (a monotone cubic mapping time→arc length through the waypoint times), per-segment easing, focal blended in log space (zooms feel even), smoothed roll.
- **Data-driven keys**: `keys()` exists in `util.ts`, but only in code. Add `scenes/<project>/<scene>.keys.json` (channel → `[t, v, ease]`), loaded at init, with HMR. Tweaking timing no longer means editing TypeScript.
- **Live params panel**: scene `params` (already in manifests) exposed as sliders in the preview; "Save" writes back to `project.json`. Determinism holds because params are static per render.

### 2.2 Preview player
- A real timeline strip: entries, transitions, events, sections, beat grid, waveform. Drag to retime, which writes `project.json`.
- Loop A/B, J/K/L shuttle, frame step, a frame counter in project fps, and title/action-safe overlays.
- Onion skin and god-view toggles in-player (they exist as CLI commands).
- GPU memory HUD: render-target count, MB, draw calls. HDR at 4K makes VRAM the real limit.

### 2.3 Composition
- **Overlays during standalone transitions (reported, not fixed).** `composite()` returns the transition output and drops other active entries. A naive fix doesn't work: the engine has no "draw over with alpha" path, crossfade-by-overlap would replace the transition, and background entries would land on top. Fix it together with an explicit `layer: 'over' | 'under' | 'base'` on manifest entries plus a premultiplied-alpha over pass.
- `CompositorGraph` exposed in manifests: blend mode, opacity curve and matte per entry, without code.
- Render errors (scene, probe or transition) are caught and drawn as dark-red frames; headless export should count them and fail instead of shipping red frames.

### 2.4 Output
- Render passes: beauty, depth, alpha, object/entity ID (from `SceneGraph`) and motion vectors.
- Grading: target scene-linear EXR, not a log/ACEScct encoder. The pipeline is already linear HDR, and Resolve's ACES input transform takes linear EXR. Keep the in-engine grade for previews.
- Per-project audio and lyrics (**shipped**): `data/<project>/audio.json` first, then the shared file, with the chosen file logged. Next: move the song file under the project, and use the dummy clock when a project declares its own song but its data is missing.

## 3. Simplification backlog
- One CLI entry point: `bun run fx <cmd>`. Delete the 10 forwarding shims in `scripts/` and `app/scripts/`.
- Retire `camera3d.ts` (legacy CPU projection) once remaining callers move to `rig.ts` + `ViewportSpace`.
- Move music-video-specific code (`PDoom`, `__pdoom` alias, lyric readout in `engine.ts`/`hud.ts`) into a project plugin and overlay.
- Keep `heal.ts` and the motion/telemetry analysers as dev tooling outside the runtime bundle.
- Skills: extract one `fx-invariants` skill (determinism, `setTime`, stateless transitions, no render-time fetch) and link to it from the others; cut the repeated "never…" lists; add a Blender how-to skill once B1–B4 land.
- One test runner (`bun run test --filter rig`) instead of 15+ `test:*` scripts; CI on PRs running typecheck, build, determinism and tests on a fresh clone (no gitignored data).

## 4. Suggested order
1. Overlay/layer semantics (2.3), treated as a bug.
2. B0 preflight + sidecar (fps, frame start, colour, aspect).
3. B2 environment lighting + AgX tone mapping.
4. B1 camera import (matrix mode first).
5. B4 hot reload + one per-project asset folder.
6. B5 morphs/audio, then B3 markers and the beat round-trip.
7. Timeline strip and live params, then the B7 add-on, then render passes and EXR output.
8. Simplification backlog (section 3) in parallel throughout.
