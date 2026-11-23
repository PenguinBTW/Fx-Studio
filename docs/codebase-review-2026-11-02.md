# f(x) Studio Codebase Review — 2026-11-02

## Scope

This is a static code review, not runtime validation. I read the implementation in the main engine paths (`engine.ts`, `scene.ts`, `dsl.ts`, `projects.ts`, `timeline.ts`, `transition.ts`, `transitions/registry.ts`, `export.ts`, `graph.ts`, `gl.ts`, `post.ts`, `post_optics.ts`, `dof.ts`, `scenegraph.ts`, `transform.ts`, `viewport.ts`, `rig.ts`, `camera3d.ts`, `driver.ts`, `bridge.ts`, `events.ts`, `lyrics.ts`, `motion.ts`, `util.ts`, `tokens.ts`, `palette.ts`, `scale.ts`, `fxstats.ts`), plus render, mixdown, diagnostic, determinism, release and chunk scripts. I also reviewed the audio, geometry, particles, typography, optical and GLSL implementation modules and read architecture, project, CLI, authoring, telemetry and audio documentation against their corresponding APIs. Individual showcase scenes were not audited in detail as requested; `city_room_portal/city_room_scene.ts` was only used to orient on the scene API. No build, tests, render, or audio verification was run, so behavioral findings are source-level conclusions and visual/audio claims remain unverified. The worktree already contained uncommitted scene, asset, active-project, and script changes. Those were treated as user work and left untouched. This report is the only file written for this review.

## Overall assessment

There is substantial engineering here. The engine has real functional boundaries (scenes, transitions, audio, GL/post, and export tooling), meaningful ownership/disposal APIs, strict TypeScript settings, and bespoke diagnostics that address problems ordinary unit tests cannot see. The declarative scene context also gives authors useful reusable primitives without forcing every scene into the same abstraction.

The biggest risk is that the confidence signals are stronger than the underlying guarantees in a few important places. The audio code makes mastering claims that its implementation and test do not substantiate; the layer compositor can leave global renderer state corrupted when a user callback throws; several validators are either bypassed by production JSON paths or fail to check important cases; and the documentation often states stronger invariants than the runtime implements. Those are more consequential than the breadth of the feature set.

## Findings

### High: Split-band ducking reverses the high-pass polarity, including when ducking is inactive

In `applySplitBandDuck`, the code computes `midHigh = 2*v1 + v2 - input` in both mono and stereo paths ([dsp.ts](../app/src/engine/audio/dsp.ts#L193)). For the state-variable filter used immediately above, that expression is the negative of the high-pass output (`input - 2*v1 - v2`). The function then adds that inverted high band to the low band. At zero duck (`duckLevel = 0`, so `midHighGain = 1`), the output therefore is not the original signal: frequencies well above the crossover are polarity-inverted while low frequencies are not. With active ducking, the high band remains inverted as it is attenuated, which can change phase and timbre and can cause cancellation when mixed with parallel audio.

The current DSP test measures RMS only at 80 Hz and 1 kHz ([test_dsp.ts](../app/scripts/test_dsp.ts#L61)); it can confirm attenuation magnitudes while missing the polarity error. The implementation comment says “inverted HP for zero-phase sum,” but no subsequent polarity correction restores the original signal in the unity-gain case.

**Recommendation:** Verify the crossover against a unity transfer test: with a zero duck envelope, output should match input in both amplitude and phase across a frequency sweep. Correct the high-pass sign or explicitly document and prove a different decomposition. Add phase/identity checks and a mixture/cancellation case, not only RMS thresholds.

### High: The “true-peak limiter” measures sample peaks, not inter-sample peaks

`applyLookaheadLimiter` is documented as estimating inter-sample peaks with a four-point Hermite method and guaranteeing a dBTP ceiling ([dsp.ts](../app/src/engine/audio/dsp.ts#L222)). The implementation creates `framePeaks` from the absolute values of the input samples only ([dsp.ts](../app/src/engine/audio/dsp.ts#L248)); it does no interpolation or oversampling before deriving gain. The final clamp also limits individual samples only. This can control sample peak, but does not guarantee true peak between samples. The mixdown applies this limiter after FFmpeg loudnorm and describes the result as strict true-peak compliance ([mixdown.ts](../app/scripts/mixdown.ts#L480), [mixdown.md](audio/mixdown.md#L211)).

The associated test uses a 500 Hz sine and checks only the largest sample value ([test_dsp.ts](../app/scripts/test_dsp.ts#L96)). It cannot establish an inter-sample ceiling. This creates a gap between the delivery guarantee in docs/reports and the signal processing actually performed.

**Recommendation:** Either implement a defined true-peak estimator/oversampled limiter and verify the rendered output with an independent true-peak meter, or rename the function and documentation as a sample-peak limiter and rely on a verified true-peak stage for delivery. Add adversarial phase/frequency test vectors where reconstructed peaks exceed sample peaks.

### Medium-high: Runtime mixdown JSON bypasses the MixConfig validator

`defineMix` calls `validateMix`, but the production mixdown loader reads `.json` with `JSON.parse` and assigns it directly to `manifest`; it never calls `validateMix` ([mixdown.ts](../app/scripts/mixdown.ts#L220)). Several validations then happen ad hoc much later, while other fields are consumed directly. `validateMix` itself omits checks for top-level `stems`, unique soundtrack/spatial IDs, several nested parameter ranges, and mutes; some nullable object cases (`master: null`, `buses: null`) pass the `typeof === 'object'` branch and can throw while being inspected ([manifest.ts](../app/src/engine/audio/manifest.ts#L110)).

This means the typed DSL and a JSON manifest do not share the same contract. Bad production manifests can fail with incidental `TypeError`s or produce invalid output rather than a complete actionable validation report.

**Recommendation:** Route every loaded manifest form (JSON, TS/JS module, and object input) through one runtime validator before allocating PCM buffers or decoding files. Make the schema cover every field consumed by `mixdown.ts`, reject null where objects are required, validate finite/ranged numeric values and unique IDs, and report all errors together.

### Medium: CompositorGraph does not restore renderer state on callback failure

`CompositorGraph.evaluate` saves the caller’s clear color/alpha, changes the clear color to transparent, binds each layer render target, and calls user-supplied `l.render(rt)` ([graph.ts](../app/src/engine/graph.ts#L127)). It restores the previous target after the callback and restores clear color/reset state only at the normal end of the method ([graph.ts](../app/src/engine/graph.ts#L205)). If a layer callback throws, both cleanup steps are skipped. The exception can then escape the graph evaluation while leaving a changed render target and transparent clear color for subsequent engine work. This is particularly relevant because layer callbacks are scene-authored code.

There are adjacent validation gaps: `createLayer` accepts duplicate names, and a missing matte source only warns before silently running the layer unmatted ([graph.ts](../app/src/engine/graph.ts#L100)). Both can produce output that differs from the author’s intended graph without failing the scene.

**Recommendation:** Put target, clear color/alpha, and renderer cache restoration in `try/finally`, including when a layer fails. Validate unique layer names and matte references before rendering; make missing mattes explicit errors or provide a documented intentional fallback.

### Medium: Stateful scene preroll errors escape the normal scene error boundary

The regular scene render is wrapped in a `try/catch` and replaced with a cleared diagnostic frame on failure ([engine.ts](../app/src/engine/engine.ts#L554)). The stateful-seek preroll loop calls `s.render(...)` before that boundary ([engine.ts](../app/src/engine/engine.ts#L541)). A stateful scene that throws while replaying history therefore aborts the whole `Engine.render` call; on export this can terminate a frame stream even though an equivalent failure during the target-frame render is contained. Preroll also draws into the same scene target repeatedly, so recovery needs to leave the target in a known state.

**Recommendation:** Give preroll the same scene-level error handling and cleanup policy as the regular render path. Include the failing scene and preroll timestamp in the error record, then decide consistently whether to clear that participant’s target and continue or fail the export with a contextual error.

### Medium: Project timeline invariants are not enforced, with visible consequences in compositing

`buildTimelineEntries` trusts each manifest entry and maps it directly to a runtime record ([projects.ts](../app/src/engine/projects.ts#L56)). Transition validation checks individual windows but does not check overlapping transition windows; `makeTransitions` only warns and still returns invalid transitions ([timeline.ts](../app/src/timeline.ts#L77)). `resolveTransitionAt` then picks one earliest active transition ([transition.ts](../app/src/engine/transition.ts#L89)). Separately, normal compositing cycles through three render targets with `rts[idx % this.rts.length]` ([engine.ts](../app/src/engine/engine.ts#L532)); if a manifest overlaps four or more entries, later renders overwrite textures still referenced as `under`/`outTex` by earlier entries.

**Recommendation:** Validate the timeline before loading any scene: finite ordered windows, unique entry IDs, explicit allowed-overlap rules, maximum simultaneous active entries compatible with target allocation, transition participants, and pairwise transition conflicts. Prefer rejecting unsupported overlap at boot over silently selecting one transition or rendering through a recycled target.

### Medium: Text probes do not always measure the text actually drawn

The global Canvas2D hook records text by calling `measureText(str)` and constructing a natural-size bounding box ([main.ts](../app/src/main.ts#L39)). The replacement `fillText`/`strokeText` wrappers pass `maxWidth` through to the original draw but do not pass it into `recordCall` ([main.ts](../app/src/main.ts#L102)). When Canvas2D compresses a string to `maxWidth`, telemetry still reports its uncompressed width. Probe records also store `globalAlpha`, but the clipping calculation in the text analyzer treats the entire measured box as visible geometry and does not account for Canvas clipping paths ([text-analyzer.ts](../app/scripts/motion/text-analyzer.ts)). These are known routes to false clipping/collision flags for scenes using those Canvas features.

**Recommendation:** Record effective text metrics after `maxWidth` scaling and document/handle unsupported clipping semantics. Add fixtures that draw the same text naturally, with `maxWidth`, under a transform, and through a clip; compare reported bounds with captured pixels before treating F04/F05 as blocking evidence.

### Medium: The determinism guard skips executable template expressions

`check_determinism.ts` describes itself as ignoring string/template literal text. Its `stripNonCode` scanner treats a backtick literal as opaque until the next backtick, including `${...}` expressions. A banned call inside an interpolation, such as `` `${Math.random()}` ``, is executable JavaScript but is blanked before the scan and will pass undetected ([check_determinism.ts](../app/scripts/check_determinism.ts#L20)). The scanner is also a hand-written lexer and does not track regex literals, so it can mistake text inside a regex for code. Since this check is part of the documented release gate, its parser edge cases affect the reliability of the determinism claim.

**Recommendation:** Use the TypeScript compiler API or a parser to walk call expressions and identify forbidden global APIs in executable code. If retaining a lightweight scan, add tests for template interpolation, escaped delimiters, regex literals, comments, and nested templates.

### Medium-high: Chunk names can escape the render work directory

`render_chunks.ts` accepts each chunk `name` from JSON without validation, then uses it directly in `path.join(work, `${c.name}.mp4`)` and `${c.name}.part.mp4` ([render_chunks.ts](../app/scripts/render_chunks.ts#L46)). On a failed or retried chunk it calls `rmSync(part, { force: true })` ([render_chunks.ts](../app/scripts/render_chunks.ts#L63)). A name containing path traversal (for example `../../some-file`) can make the script inspect, overwrite through FFmpeg, rename, or delete paths outside `--work`. The script also accepts an empty chunks array and later dereferences `spec.chunks[0]`, causing a late, unhelpful failure.

**Recommendation:** Require a nonempty chunk list and safe, unique basename-only names. Resolve every chunk path and assert it remains inside the resolved work directory before any filesystem operation.

### Low-medium: Timeline duration depends on manifest ordering

`Engine.duration` uses the `end` of the final array element rather than the maximum end across the timeline ([engine.ts](../app/src/engine/engine.ts#L288)). `buildTimelineEntries` preserves manifest order ([projects.ts](../app/src/engine/projects.ts#L60)), but neither sorts entries nor validates ordering. A valid manifest listed out of chronological order can therefore produce a duration shorter than one or more entries. The preview scrubber and export defaults use engine duration, so the tail of the project can become inaccessible or omitted unless the user supplies an explicit range.

**Recommendation:** Either sort a copied timeline by start time during construction and define stable tie ordering, or derive duration from the maximum end. Validate ordering if manifest order is intentionally meaningful.

### Medium: Event IDs from scene-local events can collide across entries

`resolveEvents` gathers scene-emitted event definitions from every registered entry, then applies one global `seen` set to their raw IDs ([events.ts](../app/src/engine/events.ts#L101)). The registration API is keyed by entry ID, but emitted `SceneEventDef.id` values are not namespaced with that entry. Reusing a natural local ID such as `impact` in two different scenes therefore throws a duplicate-ID error when resolving the project, even though the events are distinct and local to separate entries.

**Recommendation:** Define whether scene event IDs are project-global or entry-local. If local, qualify resolved IDs with the entry ID and preserve a convenient alias; if global, validate during registration with a message that identifies both emitting entries.

### Medium: Export option validation does not validate adaptive sampling objects

`ExportPipeline.validate` accepts any object as `samples` without validating `min`, `max`, or `tol` ([export.ts](../app/src/engine/export.ts#L147)). The renderer later derives powers and loop bounds from those fields. Invalid, non-finite, reversed, or unsupported limits can consequently reach the sampling loop and yield surprising quality/performance or NaN arithmetic rather than a clear CLI validation error.

**Recommendation:** Validate adaptive settings as a distinct schema: finite positive bounds, supported sample ladder, `min <= max`, tolerance in a meaningful positive range, and a maximum consistent with the actual engine cap. Share the validation between `ExportPipeline`, CLI parsing, and `Engine.render`.

### Low-medium: Export preset validation mixes validation with unrelated format restrictions

The validator rejects `gpu: true` for every alpha-capable preset, even when the user may be choosing an encoder/pixel format that supports the requested alpha path or when `transparent` is false ([export.ts](../app/src/engine/export.ts#L125)). Conversely, actual encoder selection is not checked against the chosen preset beyond this blanket alpha rule. This is an overly broad gate whose behavior can diverge from FFmpeg’s actual encoder/pixel-format support.

**Recommendation:** Validate the effective encoder and pixel format pair, and base alpha restrictions on the requested output and chosen encoder rather than only `preset.supportsAlpha`.

## Documentation and verification quality

The documentation is extensive and is a real asset, but several normative claims need reconciliation with implementation before users can rely on them:

- The engine overview says the engine is entirely closed-form and describes up to 324 samples ([engine-overview.md](architecture/engine-overview.md#L60)); runtime explicitly supports stateful scenes with reset/preroll and adaptive sampling rejects them ([scene.ts](../app/src/engine/scene.ts), [engine.ts](../app/src/engine/engine.ts#L343)). Fixed sampling and transitions have separate restrictions. These should be described as distinct scene modes, with guarantees by mode.
- The mixer docs claim an inter-sample true-peak guarantee that the implementation does not provide, and the DSP test name/description repeats that claim.
- `CompositorGraph` accepts `GraphLayerDef.post`, but warns that scoped post-processing is unimplemented and ignores it ([graph.ts](../app/src/engine/graph.ts#L100)). The docs should mark this as an API placeholder, not a working graph capability.
- Version/source maps conflict: package version is `0.7.0`, while audio/DSP source labels and the v0.8 architecture docs say `0.8.0`. The modules reference lists several modules absent under those names in the current engine tree and labels `events.ts` as an audio/mixdown module. The engine overview still says “12 modules.”
- Verification scripts are numerous, but `app/package.json`’s `test` command only runs `test_milestones.ts`; focused suites such as `test_dsp.ts` and the stem NLE suite are not part of that aggregate. The README’s phrase “full milestone regression” is reasonable, but “All engine features ... are guarded” is broader than this one aggregate implies. No tests were executed for this review.
- Sampling limits differ by entrypoint: render CLI help and docs say up to 324 samples, but `--max-samples` accepts 972 and `Engine.render` clamps adaptive sampling to 972. Either 324 is no longer the hard ceiling, or the CLI/docs/config limits have drifted.

**Recommendation:** Treat implementation-backed docs as API contracts. Reconcile determinism modes and audio claims first, then generate/check module paths and versions. Define quick, full, and integration verification targets, and make each target’s exact script list visible.

## Positive engineering patterns

- Core engine responsibilities are split into modules rather than concentrated in scene code.
- Strict TypeScript options are enabled in both app and script projects.
- Scene, transition, graph, and post systems expose lifecycle/disposal hooks; the engine also contains explicit failure handling in ordinary scene rendering.
- `CompositorGraph` renders layers into isolated targets before matte/blend passes, which is a useful and extensible shape for track-matte work.
- The diagnostics suite recognizes that motion quality needs visual inspection in addition to numerical metrics.
- `city_room_portal` demonstrates the system’s procedural 3D capacity and has an explicit resource setup/render lifecycle; this review did not assess its visual quality or performance.

## Recommended order

1. Fix and verify the split-band crossover’s unity/phase behavior.
2. Align limiter behavior, test coverage, and dBTP claims.
3. Validate all mixdown manifest inputs at the runtime boundary.
4. Constrain chunk paths to the work directory and reject malformed chunk lists.
5. Make compositor restoration exception-safe and graph definitions validated.
6. Harden stateful preroll and timeline overlap handling.
7. Calibrate the text-probe geometry against actual rendered pixels.
8. Bring the architecture docs and verification matrix back into alignment with shipped behavior.

## Grounding check

This report is based on source inspection and identifies concrete code paths, but no build, audio render, visual render, or automated test was run. The high-priority DSP findings should be confirmed with targeted signal tests and independent measurement before making delivery claims. Scene-specific findings outside the one orientation sample are intentionally out of scope.
