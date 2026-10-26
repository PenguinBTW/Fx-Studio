# Long-timeline rendering (P14)

Verified on the 10-scene / 9-transition / 256 s synthetic project `app/src/scenes/_prereq_demos/smoke10/`.

## Declaring a long project

A project is a folder `app/src/scenes/<name>/` (or `_prereq_demos/<name>/`) with a `project.json`; select it with `--project <name>` (or `scenes/active.json`). Nothing is special about 10+ scenes: list every entry, then one `transitions[]` item per seam.

```json
{ "project": "smoke10",
  "entries": [ { "scene": "_prereq_demos/smoke10/smoke_scene", "id": "smoke0", "start": 0, "end": 27.5, "params": { "v": 0 } }, ... ],
  "transitions": [ { "id": "t1-chase", "transition": "chase", "from": "smoke0", "to": "smoke1", "at": 22.5, "dur": 5 }, ... ] }
```

Rules (from `engine/transition.ts` `validateTransition` and `engine.renderTransition`):
- A transition window `[at, at+dur]` must lie inside BOTH entries, so consecutive entries overlap by exactly `dur` (entry N ends at `at+dur`, entry N+1 starts at `at`).
- `transition` is a module name in `app/src/transitions/` (21 exist). Participants must be stateless (the engine throws otherwise).
- One scene module can serve many entries; per-entry `params` reach the scene as `ctx.sceneCtx.params`.
- The project duration is the last entry's `end` (256 s here = 15,360 frames at 60 fps). All entries are loaded once at boot and stay resident; nothing is created or freed during playback.

## CLI (all from `app/`, Bun + system Chrome, Vite is started automatically)

| Command | Purpose |
|---|---|
| `bun scripts/render.ts stills --project P --t 10,20 [--scale 2] [--out dir]` | stills |
| `bun scripts/render.ts perf --project P --from 8 --to 10 [--scale N]` | ms/frame incl. readback |
| `bun scripts/render.ts video --project P --from A --to B [--fps 60] [--crf 16] [--scale N] [--noaudio] [--mix mix.json] [--out file]` | video; frame range is `round(A*fps) .. round(B*fps)` exclusive, so adjacent ranges never share or drop a frame |
| `bun scripts/smoke_memory.ts [--project smoke10] [--step 2] [--burst 20] [--passes 2] [--run FROM,N]` | memory telemetry (below) |
| `bun scripts/render_chunks.ts --chunks chunks.json --project P --out film.mp4 [--mix mix.json]` | per-act render + join + master audio |

`--out` relative paths resolve against the repo root, not `app/`.

## Timings (this machine, 1080p, 1 sample/frame, includes pixel readback)

| Case | ms/frame |
|---|---|
| Scene only (smoke10, dsl particles/lines/sdf/text/mesh + bloom) | 9-14 |
| Same at `--scale 2` (3840x2160) | 26 (about 2.8x the 1080p cost; 9.1 vs 26.0 in the A/B run) |
| `video` mode end to end (render + WS + x264 slow, crf 16), 1080p | about 17 fps (about 60 ms/frame) in the 6 s chunks; 4K: 60 frames in 11.8 s |
| 600-frame contiguous run through the 5 s `topological_tear` seam (render + readback only) | 25.8 avg: about 16.7 outside the seam, 30-40 inside |

A full 15,360-frame 1080p render is therefore roughly 15-20 minutes with CPU x264 `slow`; at 4K plan on 4x that or use `--gpu`.

## `sampleScene` cost (5 s transitions)

Each `api.sampleScene` call re-renders a participant scene into a scratch target, so cost scales with the number of calls.

| Transition | sampleScene calls/frame | ms/frame in seam | outside | ratio |
|---|---|---|---|---|
| `chase` (5 s) | 1 (incoming side) | 14.0 | 13.4 | 1.05x |
| `dissolve` (2 s) | 0 | 13.9 | 13.4 | 1.04x |
| `shutter` (3 s) | 0 | 18.3 | 13.4 | 1.4x |
| `topological_tear` (5 s) | 5 (2 on A, 3 on B) | 32.3 | 13.4 | 2.4x |

Every seam renders both participants once anyway (about 2x scene cost with smoke scenes, which are cheap); the extra cost is about 3.5 ms per sample here. Real scenes costing 30+ ms would put a 5-sample transition near 6x. No transition at the smoke scale exceeds 3x, but budget `1 + calls` scene renders per frame during the seam. Keep sample counts at 1-3 for 5 s seams.

## Memory (`smoke_memory.ts`)

One browser session, 488-sample sweep over 256 s (every 2 s plus 20-frame bursts at the start and middle of each of the 9 transitions), repeated twice; the second pass is fitted (first pass is warm-up, because scenes allocate lazy GL resources, e.g. programs/buffers, on their first render). `window.__fxStats()` (only with `?export=1`, `engine/fxstats.ts`) returns JS heap, three.js `info.memory`, program count and live WebGL framebuffer/texture/buffer/renderbuffer counts (counted by wrapping `create*/delete*` on `WebGL2RenderingContext`; `drawCalls` is the last frame's three.js call count).

Result (976 samples, last 488 fitted):

| Metric | after warm-up | end | slope / 100 samples |
|---|---|---|---|
| JS heap (after forced GC) | 46.5 MB | 46.8 MB | +0.06 MB |
| three geometries / textures / programs | 19 / 35 / 16 | 19 / 35 / 16 | 0 |
| GL framebuffers / textures / buffers / renderbuffers | 31 / 39 / 103 / 11 | same | 0 |

Contiguous run (`--run 72,600`: 600 frames at 60 fps from 72 s through the `topological_tear` seam, sequential dt as in video mode): heap 37.3 to 37.8 MB (flat after the first 60 frames), framebuffers 31, textures 34, programs 8 throughout; frame time 16.7 ms outside the seam, 30-40 ms inside.

Verdict: flat, no per-frame render target or texture creation, no leak found, no engine change needed. Note the one-off cost: the first pass allocates all scenes' resources (heap 37 to 47 MB, 31 framebuffers), then nothing grows.

Run: `bun scripts/smoke_memory.ts` (full) or `bun scripts/smoke_memory.ts --run 72,600`. Output JSON goes to `out/smoke_memory.json` (`_run.json` for `--run`).

## Chunked render (`render_chunks.ts`)

`chunks.json`: `{ "chunks": [ { "name": "act1", "from": 0, "to": 40 }, ... ] }`. Chunks must be contiguous (the script refuses gaps/overlaps because the audio is built once for the whole window).

1. Each chunk renders as `<work>/<name>.mp4` with `render.ts video --noaudio --from --to` (a fresh browser per chunk; written as `.part.mp4`, renamed on success, so a crash leaves finished chunks intact). A chunk is accepted only if ffprobe `-count_frames` equals `round(to*fps) - round(from*fps)` and the render logged no `SCENE ERRORS`; one retry by default (`--retries`).
2. Re-running skips chunks whose file exists with the right frame count (`--force` re-renders everything).
3. Chunks are joined with `ffmpeg -f concat -c copy`; the script checks per-chunk frames summed = joined frames = expected, and joined duration = sum of chunk durations (within 1 frame).
4. Master audio: `--mix mix.json [--events events.json]` calls `mixdown()` over the whole window (the same function `render.ts --mix` calls) and muxes with `-c:v copy` and AAC 320k, padded/trimmed to the video duration; `--audio file` muxes one sliced track; neither gives a silent master.

Frame accuracy test: 3 chunks of 2 s (`22-24`, `24-26`, `26-28`, crossing the first `chase` seam) joined = 360 frames, 6.0000 s; per-frame `framemd5` of the joined video against a single `render.ts video --from 22 --to 28` render: 360 frames, 0 differing frames. Master with `--mix`: 360 video frames, audio 6.0000 s.

Each chunk's first frame is rendered sequentially after a one-frame warm-up (`stream()` renders frame `n0-1` first), so chunk boundaries are identical to a continuous render for stateless scenes (stateful scenes would need pre-roll; none are used across seams).

## 4K (`--scale 2`)

Works end to end: `stills --scale 2` writes a true 3840x2160 PNG (ffprobe `3840,2160`), `perf --scale 2` runs at 26 ms/frame, and `video --scale 2` encodes a 3840x2160 mp4 (60 frames in 11.8 s). `--scale` accepts 1-4; the page size check in `render.ts` fails loudly on a mismatch. `--scale 4` (7680x4320) was not tried.

## Known caveat while this was measured

Other agents were editing `engine/post.ts` concurrently. Renders printed a `THREE.WebGLProgram` fragment-shader compile error from the post pass (`rayStep`, `volJitter`, `gradeSat`... undeclared) and, at one point, `createGlyphShape` import errors; the first render of that kind happened with `useProgram: program not valid`. Memory counts and timing were taken in a state where bloom/post ran, but the post-shader error means the post pass cost in those timings may be understated. Re-run `bun scripts/smoke_memory.ts` and the perf lines once post.ts settles.
