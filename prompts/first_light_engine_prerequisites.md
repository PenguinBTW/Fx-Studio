# FIRST LIGHT: Engine Prerequisites

**Do this before running `first_light_scene_prompt.md`.** This is the work order for the engine and tooling. It is a separate job from the scene prompt, and it can be split across several sessions or agents. The scene prompt assumes every module here already exists and passes its acceptance test.

Load `fx-engine`, `fx-engine-dev`, `fx-diagnostics` and `video-assembly-and-finishing` first. Follow the `fx-engine-dev` invariants: determinism, a pure function of time or seeded RNG, WebGL state isolation (`renderer.resetState()`), and linear alpha premultiplication. Document every module in `docs/` and add an entry to `docs/README.md`.

The status column comes from a repo audit (v0.6.1). "Verify" means the audit could not confirm the detail, so check it first.

**Scope rule.** Every item here earns its place on screen or in the ear. Each module is tagged:
- **General:** a reusable engine upgrade. Build it properly, documented, in `app/src/engine/`.
- **Bespoke:** only this film needs it. Build it in `app/src/scenes/first_light/` to the same quality bar. Bespoke is not a lesser standard.
- **Support:** tooling that keeps the build honest (seams, the Void Cut, renders). Keep it minimal.

If a sub-item wouldn't change what the viewer sees or hears, skip it.

---

## 0. Summary

| # | Module | Tag | Status today | Priority | Shows up in |
|---|---|---|---|---|---|
| P1a | Photon interface, `walkPath`, act bounds | Bespoke | MISSING | **Critical** | every seam, Core, Coda |
| P1b | Per-act cameras and trajectories | Bespoke | MISSING | Done during scene planning | every act |
| P2 | `spectrum.ts` colour science | General | MISSING | **Critical** | every colour of light |
| P3 | Audio: analysis, SFX synth, mixdown | General (Void Cut gate is bespoke) | PARTIAL | **Critical** | all sound, T4 |
| P4 | `raymarch.ts` + volumetrics | General | PARTIAL | High | Convection, Breach, Sky clouds, Droplet |
| P5 | Particles with trails | General | PARTIAL | High | Core, Magnetosphere, rain |
| P6 | Ribbons and aurora curtains | General | MISSING | High | Prominence, aurora, dendrites |
| P7 | Post-FX: per-frame grade, true black, tone map | General | PARTIAL | High | every frame, T4, Sky grade |
| P8 | Refraction and dispersion | General | MISSING | High | Droplet, T7, T8 |
| P9 | Transition seam check | Support | PARTIAL | High | every seam |
| P10 | Text: rolling counter, stroke reveal, in-world text | General | PARTIAL | Medium | text events 1–5 |
| P11 | Noise library | General | Verify | Medium | Convection, granulation, iris |
| P12 | Curve morph (general) + tree-to-walk mapper (bespoke) | Mixed | MISSING | Medium | Act 1→2 streamline, T9 |
| P13 | Seeded RNG check | Support | EXISTS, not enforced | Medium | scrub-safe transitions |
| P14 | Long-timeline render | Support | Verify | Medium | delivery |
| P15 | Diagnostics | Support | PARTIAL | Low | review |

Suggested order: see **Model routing** and the **Relationship to `engine_modernization_and_cleanup_plan.md`** section below. Some cleanup tasks (M1–M7) must land first. P3 (audio) is independent and can run in parallel from day one. P13 and P15 are small; fold them in where convenient.

### Before touching shared engine files
P3, P7 and P9 change files that existing projects use (`audio.ts`, `post.ts`, `export.ts`, `transition.ts`). First render a few reference frames from `music_video` and `story_room`. After each of these modules, re-render and compare them with the `compare` diagnostic. Existing projects must look identical with default settings.

### Performance needs numbers
For P4, P5 and P7, add a small headless timing script that prints milliseconds per frame at 1080p. "Runs at 30 fps" has to be measured, not assumed.

---

## Model routing (Sonnet orchestrator, Opus sub-agents)

The orchestrator runs on Sonnet. It does **not** use Opus on its own judgement. It follows these rules. To call Opus, use the subagent tool with `model: "bike4mind/claude-opus-5-5"`. Sonnet workers use `bike4mind/claude-sonnet-5-5`.

**Rule-based escalation, always applies:**
1. Any task that fails its acceptance test **twice** goes to Opus, with the failing output attached.
2. Any worker that reports it is unsure of the maths or the cause of a visual bug goes to Opus.
3. Every demo-scene **visual review** goes to a fresh Opus sub-agent that sees only the rendered frames and this file's acceptance criteria, not the code or the worker's summary.

**Per-module routing:**

| # | Module | Build | Opus involvement | Why |
|---|---|---|---|---|
| P1a | Photon interface, `walkPath`, seam test | **Opus designs, Sonnet builds** | Opus writes the interface and the camera/trajectory structure; Sonnet implements it and the seam test | Every scene and transition depends on this contract. A bad shape here spreads everywhere. |
| P1b | Per-act cameras and trajectories | **Opus** | Written alongside `visual_plan.md` | Creative and spatial decisions, not engineering. |
| P2 | `spectrum.ts` | Sonnet | None | Known formulas with numeric tests. |
| P3a | Song analysis | Sonnet | None | Standard librosa work. |
| P3b | SFX synth | Sonnet | None | Standard DSP. Quality gets judged by ear later. |
| P3c/d | Event registry, mixdown, Void Cut gate | Sonnet | None | FFmpeg work with a measurable verifier. |
| P4 | Raymarch helpers and volumetrics | Sonnet builds | **Opus reviews** the demo frames and the marcher code | Banding, step budgets and jitter are easy to get subtly wrong. The convection plasma has to look extraordinary, not just correct. |
| P5 | Particles with analytic trails | Sonnet | Visual review only | Clear technique. Opus checks the Core density demo looks suffocating. |
| P6 | Ribbons and aurora curtains | Sonnet builds | **Opus reviews** the aurora demo | The geometry is easy. Making aurora look real (ray structure, folds, colour falloff) is the hard part. |
| P7 | Post-FX: grade, true black, tone map | Sonnet | Visual review only | Mostly plumbing, but it touches every existing project. The regression check covers safety. |
| P7 | Depth-based DoF with bokeh | **Opus** | Design and build | New subsystem: needs scene depth wired through the pipeline, a correct CoC and a good-looking kernel. The existing one is screen-space only. |
| P8 | Refraction and dispersion | **Opus** | Design and build, with a Sonnet worker for the angle-measurement script | The hardest maths in the project (Snell, Fresnel, TIR, multi-wavelength). It carries the hero act and T7/T8. |
| P9 | Seam check | Sonnet | None | Small tool. |
| P10 | Rolling counter, stroke reveal, in-world text | Sonnet | None | Contained features. In-world text depends on the P7 depth DoF. |
| P11 | Noise library | Sonnet | None | Standard algorithms. |
| P12 | General curve morph | Sonnet | None | Resampling and correspondence with a clear test. |
| P12 | Tree-to-walk mapper (bespoke) | **Opus** | Design; Sonnet may implement | Loosely specified. It decides whether T9 reads as recognition or as a mess. |
| P13 | Seeded RNG check | Sonnet (or Haiku) | None | A grep script. |
| P14 | Long-timeline smoke test, chunked render | Sonnet | Opus only if a leak isn't found after two attempts | Memory leaks in WebGL can be hard to trace. |
| P15 | Diagnostics | Sonnet | None | Small tools. |

**Opus sub-agent brief template:** point to files, don't summarise them. A summary carries the orchestrator's blind spots.

```
Task: <one sentence>
Read first: prompts/first_light_engine_prerequisites.md (section P<n>), <relevant engine files>, <demo frames or failing output paths>
Constraints: fx-engine-dev invariants; scenes are pure functions of t; don't change frozen contracts (photon.ts interface, spectrum.ts API) without saying so.
Return: what you changed (file paths), the acceptance result, rendered frame paths, and anything you're unsure about.
```

---

## Relationship to `engine_modernization_and_cleanup_plan.md`

That plan (M1–M7) is cleanup and refactoring, separate from this film. It overlaps with this work in several places, so do it in this order:

| Task | What it is | When | Model | Interaction with this file |
|---|---|---|---|---|
| M7 | Isolate `heal.ts` dead code | Any time | Sonnet (or Haiku) | No overlap with this file. |
| M1 | Fix 19 typecheck errors in `scripts/inspect_frame.ts` | **First** | Sonnet (or Haiku) | Every new module here needs a passing typecheck to be trusted. |
| M2 | Move `V3`/`RGB`/math from `camera3d.ts` to `util.ts` | **Before P5, P6 and P10** | Sonnet | Touches `particles.ts`, `rig.ts` and `text.ts`, which P5/P10 also change. Doing it after would mean merge conflicts. |
| M5 | Lazy getters in `dsl.ts` | **Before adding new modules to the DSL** | Sonnet, careful | New modules (ribbons, raymarch, refraction) will likely register in the DSL. Run the 33 demo scenes afterwards. |
| M3 | Correct the `focusDist` docstring | With P7 | Sonnet | P7's new depth DoF supersedes this. Document both modes together instead of fixing the comment twice. |
| M4 | Dolly-zoom solver, autofocus projection, polar orbit in `rig.ts` | **Before P1b** | Sonnet | Directly useful: the Core pull-back (dolly plus FOV), focusing on the photon, and the Earth-reveal orbit. Autofocus should drive the new depth DoF, not the radial one. |
| M6 | `text3d.ts` stroke path cleanup | Before P10 | Sonnet | Same files as P10. |

None of M1–M7 needs Opus. They're well specified and low risk.

**Revised overall order:** M1, M2, M5, then P1a (Opus design), P2, P11, M4, P7 + M3, P4, P6, M6, P5, P8 (Opus), P9, P10, P12, P14. P3 runs in parallel throughout.

---

## P1. Photon state contract: critical, build first

**Why:** transitions can only call `api.sampleScene(id, t)`. The engine throws on stateful participants (`engine.ts` around line 426), and `Frame` exposes no scene state or object positions. "The photon's screen position is continuous across every seam" can only be built and tested if the position is a pure function of time that every scene and every transition can import.

**Build:** `app/src/scenes/first_light/photon.ts` exports:

```ts
photonState(t: number): {
  worldPos: [number, number, number];   // world space
  dir: [number, number, number];        // unit tangent
  screenPos: [number, number];          // 1080p pixel coords, from the act's camera
  act: number;                          // 0..9
  depth: number;                        // atmospheric optical depth 0..1 (drives the Magnetosphere→Sky grade)
  intensity: number;
}
```

- It is analytic and seeded. For the Core random walk, precompute the full path once from `mulberry32(SEED)` at module load (a pure function of the seed, not of the clock), then look up by `t`.
- Camera matrices per act come from the same module. Scenes may not own a private camera that disagrees with it.
- It also exports `photonScreenPosAt(t)` and `ACT_BOUNDS` (the act boundaries, re-anchored to analysed downbeats; see P3).
- Expose `walkPath(seed)` as a standalone export. The Coda has to reuse the exact Act 1 path data.

**Split into two stages:**
- **P1a (now, before any scene):** the `photonState` interface, `walkPath(seed)`, `ACT_BOUNDS`, placeholder straight-line trajectories and simple cameras for each act, and the seam test below. This is enough for transitions and scenes to be built against.
- **P1b (during scene planning):** the real per-act cameras and photon trajectories. These are creative decisions, so they get written together with `visual_plan.md` by whoever owns the plan, not invented here.

**Acceptance:** a test script samples `photonState` at 10,000 times, including both sides of every act boundary, and asserts that `screenPos` jumps by no more than 8 px at 1080p per frame at every seam. Re-run it after P1b.

---

## P2. `spectrum.ts` colour science: critical

**Missing today:** blackbody or Kelvin, wavelength to RGB, and any CIE or Oklab maths. Existing helpers are only `hexToLinear` (`engine/util.ts`), `LIN` (`engine/palette.ts`) and the GLSL `toSRGB`, `toLinear`, `luma` and `heat` in `glsl/common.ts`. The thin-film maths in `photonic_cavity.ts` is local to that scene.

**Build `app/src/engine/spectrum.ts` and `app/src/engine/glsl/spectrum.ts` (a GLSL mirror):**
- `wavelengthToLinearSRGB(nm)`: CIE 1931 colour-matching functions using the Wyman, Sloan and Shirley multi-lobe fit, and gamut-mapped by desaturating toward the white point and not by clipping.
- `blackbodyToLinearSRGB(kelvin)`: Planckian locus, valid from 1000 K to 40000 K.
- `spectrumRamp(t)`: 380 to 700 nm with an optional dispersion width.
- GLSL equivalents, cheap enough to call per pixel.
- `oklab` helpers for the perceptual gradients between acts.
- Constants: `OXYGEN_GREEN = 557.7`, `OXYGEN_RED = 630.0`, `SODIUM_D = 589.0`, and others.

**Acceptance:** a unit test checks that 650 nm is red-dominant, 550 nm is green-dominant and 450 nm is blue-dominant, that 5778 K is near-white, that 3000 K is amber, and that the TS and GLSL versions agree within 1/255. Render a labelled swatch chart as a visual check.

---

## P3. Audio pipeline: critical, can run independently

**State today:** the export muxes exactly one track (`export.ts:195`, AAC 320k, `-shortest`) with no `amix`, `adelay`, `loudnorm` or `-af`. `project.json` declares no audio, and `--audio` and `--noaudio` are CLI flags. `scripts/analyze_song.py` takes `--audio --out --duration --start --offset` (defaults 77 / 17 / 2 are for the old song), uses librosa only, emits `kick`, `snare` and `hat` onsets, and leaves the vocal onsets empty.

### P3a. Analysis
- Make `analyze_song.py` safe for arbitrary tracks. Defaults must not silently assume the "No Takebacks" offsets; fail loudly if no args are given.
- Output **downbeats you can trust**. For a track with a hard stop and long near-silent sections, `librosa.beat.beat_track` can drift. Add a tempo-map pass (a piecewise tempo with a user-supplied correction file `tempo_overrides.json`) and a `--verify` mode that prints the downbeat times so a human can check them.
- Add **section detection** (energy envelope plus novelty) and output `sections: [{start, end, kind}]`, and a `silences: [[start, end]]` list for stretches under −60 dB. The Void Cut needs this.
- Add a `piano` or `melodic` onset class (a harmonic-percussive split is enough; demucs is optional). Neuron firing and the piano text reveals use it.
- Output `rms` and `centroid` envelopes at 60 Hz for continuous reactivity.
- Update `AudioData` in `engine/audio.ts` to read the new fields. Do not break the existing projects (`music_video`, `story_room`).

### P3b. SFX synthesiser `scripts/sfx/synth.ts` (or `.py`)
Deterministic, seeded, renders to 48 kHz / 24-bit stereo WAV. Required primitives:
- Oscillators (sine, saw, square, tri) with phase accumulators, FM and ring mod.
- Filtered noise (white, pink, brown) with time-varying cutoff.
- A granular engine (grain size, density, pitch distribution, pan per grain).
- A Shepard or Risset tone generator.
- Procedural impulse response generation and convolution reverb (reverse-reverb helper too).
- Envelope and automation curves taken from an event-timeline JSON.
- A stereo panner that takes a pan automation lane.

Input: `sfx_cues.json`, a list of `{ id, eventId, recipe, params, seed }`. Output: one stem per cue, plus a per-cue manifest. **No sample files anywhere.**

### P3c. Cue binding
- `engine/events.ts` (new): a registry that maps visual event IDs (for example `T4.voidCut`, `act8.moleculeClick`) to times, resolved from the project timeline and the analysed downbeats. Scenes register the events they emit.
- The synth and the mixer read the resolved times from `events.json` written during render. Cues follow the picture if the timing changes.

### P3d. Multi-track mixdown
Extend the export (`export.ts`) with `--mix mix.json`. The mix manifest declares buses and the gain, pan and automation of every stem:
- Music bus, SFX bus, sub-hit bus.
- **Sidechain ducking** of the music under named hero cues (3 to 6 dB, with attack and release).
- **Hard-mute regions**: the Void Cut must be sample-exact digital zero on every bus for an exact interval. Implement it as a gate with zero-length ramps, not a fade, and have a verifier script read the WAV samples.
- Master chain: `loudnorm` two-pass to −14 LUFS and true peak ≤ −1.0 dBTP.
- Optional second output: the `foley_guide` stem only.
- Do not add a hard `-shortest` that truncates the mix. Pad or trim to the video duration explicitly.

**Acceptance:** `scripts/verify_audio.py` reports integrated LUFS, true peak, the min absolute sample value inside the Void Cut interval (must be exactly 0), and per-cue time error against `events.json` (must be within ±1 frame, 16.7 ms at 60 fps).

---

## P4. `raymarch.ts` shared helpers: high

**State today:** `glsl/common.ts` has primitives only (`sdSphere`, `sdBox3`, `sdCapsule`, `sdTorus`, `smin`, `smax`, and the 2D versions). No shared march loop, normal, AO or shadow. `sdf.ts` is 2D UI only. Two scenes hand-write raymarchers: `insane_scenes_demo/photonic_cavity.ts` (96 steps) and `kerr_ergosphere.ts`.

**Build `app/src/engine/raymarch.ts` and `app/src/engine/glsl/raymarch.ts`:**
- A `march()` GLSL chunk with an injectable `map()`, a step budget uniform, a distance epsilon that grows with distance and a relaxation (over-relaxed sphere tracing) option.
- `calcNormal`, `ambientOcclusion`, `softShadow`.
- **Volumetric marcher:** front-to-back density integration with early exit, emissive plus absorption, a jittered start (use blue-noise or interleaved gradient noise seeded from the pixel, never the time) and a self-shadow step.
- Quality tiers: `quality: 0|1|2` mapped to step counts. Live preview 0 or 1, offline 2.
- Optionally render at half resolution and upsample with a depth-aware filter, using engine RTs.

**Acceptance:** a test scene renders a raymarched SDF sphere, a volumetric cloud and a convection-cell field at tier 0 within the preview target (about 30 fps at 1080p) and tier 2 offline, identically across two renders of the same frame.

---

## P5. Large GPU particle system with trails: high

**State today:** `particles.ts` exposes `AnalyticalParticles` (default `capacity = 4096`, emitters default to 256). It is stateless and analytic, evaluated in the vertex shader with a built-in `curlNoise(vec3,t)`. There is no GPGPU, no trails, no collisions, and billboard quads only.

**Build or extend:**
- Raise and test capacity to a few hundred thousand instances, enough that the Core feels suffocating. Find the count where adding more stops being visible and stop there; trails and depth of field sell density more than raw count.
- **Analytic trails:** because the motion is a closed-form function of time, a particle's previous positions are just the same function at `t - k*dt`. Add a trail mode that draws N segments per particle by re-evaluating the position function in the vertex shader (no state).
- Per-particle attributes: seed, size, lifetime, colour from `spectrum.ts`.
- A **curl-noise field with analytic derivative**, so particles can "press in" on a point (Core), "spiral along a field line" (Act 5) and "fall as streaks" (rain).
- Billboard options: soft discs, streaks aligned to the velocity (motion-blur look), and a sprite-less point mode for the star field.
- DoF-compatible (writes depth, or gets a CoC from its own depth).

**Acceptance:** 250k particles with the curl field render at 60 fps in preview at 1080p on mid-range hardware, scrub-deterministic.

---

## P6. Ribbon and strip geometry: high

**State today:** `lines.ts` `LineBatch` (about line 61) draws instanced capsule segments, and `polyline()` emits separate segments with no joins, strips or taper. Real ribbon geometry is missing.

**Build `app/src/engine/ribbon.ts`:**
- Camera-facing and normal-oriented ribbons along a parametric curve `(u, t) -> vec3`, evaluated in the vertex shader or on the CPU.
- Width taper, per-vertex colour and alpha, and a UV that runs along the length (for flowing emissive pulses).
- Curve sources: a polyline, a CatmullRom spline, or an analytic function (field lines, prominence loops, aurora curtains, dendrites).
- An **aurora curtain** mode: a vertical strip with a per-column height and ray-structure shading, with fold waves.
- Instancing for several thousand ribbons.

**Acceptance:** 5,000 prominence ribbons and 300 aurora curtain strips render in preview, with correct depth sorting or order-independent additive blending.

---

## P7. Post-FX upgrades: high

**State today:** `post.ts` has bloom (threshold, knee, radius), halation, `ca`, `grain`, `vignette`, `exposure`, an exponential shoulder tone map (k=0.72, not ACES), screen-space DoF (`dof`, `focusDist`, `focalRange`, `dofRadius`) and volumetric god-rays (10 steps). `makeRT` uses `HalfFloatType`. Grade is an enum (`none`, `industrial`, `warm_editorial`, `monochrome_blueprint`, `infrared`) plus `colorTint`. No LUT.

**Needed:**
- **Per-frame grade API:** `post.grade = { lift, gamma, gain, saturation, tint }` driven by a function of time, so the Magnetosphere→Sky optical-depth grade can run. Keep the enum for old projects.
- **Black-point and clip control:** the Void Cut needs true 0.0 output. Check that grain, vignette and bloom floor can all go to exactly zero. Add a `post.blackPoint` and a `post.fade` (multiplicative, applied last) with no residual noise at 0.
- **Photon optics pass:** an airy-disk plus diffraction-spike kernel (a 4 or 6 spike aperture, wavelength-dependent radial scale) applied to HDR pixels above a threshold, not a flare texture.
- **God-ray quality:** raise the steps (a tier setting) for the prominence shot, and verify that it does not band.
- **Highlight handling:** confirm HDR above 1.0 survives to bloom, and add an optional ACES or AgX-like tone-map selector. Test that the Core "clipped violet-white" does not turn pink or cyan on hue shifts.
- **Real depth-of-field (new, not an upgrade):** the existing `dof` is a radial screen-space ring (`post.ts` line 189 computes the blur from distance to screen centre, not from scene depth; see M3 in `engine_modernization_and_cleanup_plan.md`). The Core macro, the in-world text and the Eye act all need focus driven by scene depth. Add a depth-based circle-of-confusion path (scene depth texture, focus distance in world units, aperture), with a bokeh-shaped kernel rather than a plain blur. Keep the old radial mode for existing projects. Test it with the full Core particle count.

**Acceptance:** a gradient test and a neutral ramp test pass (no tint at default), and `post.fade = 0` produces an exactly black frame in a headless render.

---

## P8. Refraction and dispersion material: high

**State today:** a v0.6 "frosted glass" material exists, but there is no sign of IOR-based refraction or dispersion.

**Build `app/src/engine/refraction.ts` plus a GLSL chunk:**
- An analytic sphere intersect with Snell refraction, Fresnel, **total internal reflection**, and up to 3 internal bounces. Raymarched for non-spherical shapes through P4.
- **Dispersion:** a Cauchy or Sellmeier approximation of n(λ) for water (1.331 at 700 nm to 1.344 at 400 nm). Trace N wavelength samples (6 to 16) and accumulate with `spectrum.ts` colour weights.
- A "ray fan" debug visual for the inside-the-drop shot: glowing rays with a per-wavelength path.
- An environment lookup hook so the drop can show an inverted world (the render target of the sky scene, via `api.sampleScene`).
- Optional caustic term on the inner wall (cheap analytic).

**Acceptance:** primary bow at about 42° for red and about 40° for violet, a secondary bow at about 51° with the reversed order, measured by script on a rendered droplet field.

---

## P9. Stateless transitions: high

**State today:** `Transition.render(f, out, a, b, api)` with `api.sampleScene(id, t)`. 21 modules exist. The engine throws if a stateful scene participates in a transition (`engine.ts:426`). `Frame` has no scene state.

**Do:**
- Confirm every `first_light` scene will be written as a pure function of `t` (see P1). Document this as the project's contract.
- Add `photonState` access to transitions through an import, not through `Frame`.
- Add a small **transition test harness**: `scripts/seam_check.ts` that renders the frames at `at - 1, at, at + 1` for each transition and prints the photon's screen position (from `photonState`) and the pixel centroid of the brightest blob, and asserts they agree within tolerance.
- Check that transitions can safely call `sampleScene` on both sides for long durations (up to 5 s) without a frame-time blowup. Measure it.

---

## P10. Text upgrades: medium

**State today:** `text3d.ts` (`ExtrudedText`, depth, bevel), `stroke.ts` (`STROKE_FONTS`, 8 faces, `strokeText`, `drawStrokeText`), `motion.stagger(...)`, and fonts Archivo, Cormorant Garamond and IBM Plex Mono. `TextBlock.numericRoll(value, format?)` only sets the displayed string and does not interpolate or animate digits.

**Build:**
- **Odometer counter:** a per-digit roller with an eased value, a thousands separator, and a fixed-width tabular layout, driven by a pure function of time.
- **Stroke-plotted reveal API:** `drawStrokeText` progress from 0 to 1 per stroke, with the pen tip glow position exposed (for sync with piano notes).
- **In-world text lighting:** a helper that lights `ExtrudedText` and 2D text with the scene's lights, depth-of-field participation (writes depth, takes a CoC) and an occlusion mask so that particles can pass in front.
- **Letter-level hooks:** a callback to get each glyph's world position, so the curving particle paths can deflect around "IT DOES NOT BEND".
- Check that a tracking value of +0.1em and word-by-word reveal behave on the extruded type.

---

## P11. Noise library: medium

**Verify first** what exists in `glsl/common.ts` and in the scenes. Make sure there is a single, shared, tested version of: 3D simplex or gradient noise, **curl noise with analytic derivative**, fbm, Voronoi (F1, F2, cell centre and ID, for the granulation), and a blue-noise or interleaved-gradient helper for raymarch jitter. A TS mirror is needed for any CPU-side path (the walk).

---

## P12. Morph with vertex correspondence: medium

**State today:** nothing. `gltf.ts` has no morph target support (no `morphTargetInfluences`, `morphAttributes` or `morphTargets`).

**Build `app/src/engine/curvemorph.ts`:**
- Resample two polylines or trees to the same vertex count and parameterisation, with an optimal correspondence (a greedy or DP match on arc length and curvature).
- `morph(a, b, s)` with an eased `s`, returning positions for a ribbon or line batch.
- **Bespoke, in `app/src/scenes/first_light/`:** a **tree-to-walk** mapper that takes the dendrite tree and the Act 1 random-walk path and assigns each branch to a segment of the walk (powers T9 and the Coda), plus a **path-to-streamline** helper for the Act 1→2 handoff.

**Acceptance:** morphing the walk to a smooth streamline has no vertex flipping, with the curve staying continuous at every `s`.

---

## P13. Seeded-RNG enforcement: medium, do early

**State today:** `mulberry32(seed)` in `engine/util.ts` is fine, but nothing bans `Math.random`. There are about 25 usages in `app/src/scenes/**` (for example `act4_cockpit_highway.ts`, `autonomic_lockout.ts`), and the `fx-engine-dev` skill document shows one in an example.

**Do:**
- Add a lint or a test script (`scripts/check_determinism.ts`) that fails on `Math.random`, `Date.now`, `performance.now` and `new Date` in `app/src/engine/**`, `app/src/transitions/**` and `app/src/scenes/first_light/**`.
- Do not fix the old scenes unless asked. Scope the check to the new project.
- A quick spot-check is enough: render a couple of frames twice, out of order, and confirm they match. This matters because transitions re-render scenes at arbitrary times.
- Fix the example in the `fx-engine-dev` skill document so agents do not copy it.

---

## P14. Render pipeline, long timeline and delivery: medium

**Verify** (the audit did not fully confirm): the headless CLI commands and flags, how long a render takes per frame at 1080p and at `--scale 4`, whether a 256 s project at 60 fps (15,360 frames) is safe on memory, and how a project with 10+ scenes and 9 transitions is declared.

**Do:**
- Run a **smoke test** early: a trivial 10-scene project with 6 transitions at 1080p, 256 s. Watch for memory growth and fix any leak (render targets or textures created per frame). Better to find this before nine real scenes exist.
- Make sure the film can be rendered per act and joined, so one crash doesn't cost the whole render. A simple `--from`/`--to` frame range plus an FFmpeg concat is enough.
- Make the master render call the P3d mixdown.
- 4K is optional. Only confirm `--scale` works if you plan to deliver 4K.

---

## P15. Diagnostic extensions: low

- Add an `onion` or `stitch` mode that overlays `photonState(t).screenPos` as a marker, so a reviewer can see continuity at a glance.
- A check that the Void Cut frames are exactly black (max luminance 0).
- Nothing else is needed. Visual quality is judged by looking at the frames, not by more scripts.

---

## Definition of done

The scene prompt can start when all of the following are true:

- [ ] P1a, P2 and P3 pass their acceptance tests.
- [ ] P4 to P8 each render a demo scene in `app/src/scenes/_prereq_demos/` that looks good, not just technically correct. Someone looking at the demo frames should want to use the module.
- [ ] `music_video` and `story_room` reference frames still match after the shared-file changes.
- [ ] The 10-scene smoke render finishes with flat memory.
- [ ] Each general module has a doc page in `docs/` listing its API, limits and known gaps. Bespoke modules get a short header comment instead.
- [ ] A one-page `docs/first_light_readiness.md` lists any prerequisite that was deliberately cut or reduced, and which act it affects, so the scene prompt can be adjusted.
