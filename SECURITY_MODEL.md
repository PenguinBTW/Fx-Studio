# Fx-Studio security model

Repository: PenguinBTW/Fx-Studio. **(user)** There is no infrastructure repository. Facts marked **(user)** come from the owner. Everything else is inferred from the code.

## System overview
f(x) Studio is a locally run, agent-driven procedural motion-design toolkit (Bun + Vite + three.js). There is no hosted backend, no accounts and no database. Bun CLI scripts drive a headless Chromium (playwright-core) that loads the Vite app in `?export=1` mode and streams frames over WebSocket to FFmpeg.

**(user)** Who runs it: the owner and other people who clone the repository and run it locally on their own machines. The `vite build` output is not hosted publicly, so no public web deployment is in scope.

## Components
| Name | Code | Notes |
|---|---|---|
| Preview Player | `app/src/main.ts`, `app/src/timeline.ts`, `app/index.html` | Browser app; reads `?project=`, `?only=`, `?t=`, `?scale=` URL params |
| Engine | `app/src/engine/**` (incl. `gltf.ts`, `type.ts`, `audio.ts`, `lyrics.ts`, `export.ts`) | Renders scenes; parses GLTF/GLB, fonts (opentype.js), audio/lyrics JSON |
| Scenes & Projects | `app/src/scenes/**`, `app/src/transitions/**`, `project.json` manifests | First-party TS code, executed by design |
| Dev Server | `app/vite.config.ts` | Vite on port 5173; `server.fs.allow` = repo root (whole checkout servable) |
| Render CLI | `app/scripts/render.ts`, `render_chunks.ts`, `calibrate.ts`, `visual/compare.ts`, wrappers (`godview/onion/stitch/compare.ts`), root `scripts/` copies | Spawns Vite + Chromium; unauthenticated `Bun.serve` WebSocket servers on random ports (`port: 0`, default hostname) feeding FFmpeg stdin |
| Audio Pipeline | `app/scripts/mixdown.ts`, `app/scripts/sfx/synth.ts`, `scripts/*.py` | Reads mix manifests / cue files, spawns ffmpeg/ffprobe |
| Agent Skills | `.agents/skills/**` | Instructions for AI agents authoring scenes |

## Trust boundaries and entry points
- Developer CLI arguments: trusted (the operator can already run code).
- Vite dev server (localhost:5173 by default): reachable by any web page in the developer's browser (DNS rebinding / cross-origin) and by the LAN if started with `--host`.
- Render WebSocket servers: `Bun.serve` defaults to binding all interfaces, so they may be reachable from the local network while a render runs. They accept frames without auth and write them to FFmpeg / disk.
- Third-party content: **(user)** third-party assets and models are loaded and are untrusted: GLTF/GLB models, fonts, audio, and the data files that come with them. **(user)** Project files (`project.json`) and scene/transition code are not taken from untrusted parties; they are the owner's or trusted.
- Dependencies: vite, three, opentype.js, playwright-core, polygon-clipping.

## Assets
**(user)** All of these matter equally:
- The developer workstation (code execution, local file reads through the dev server).
- Unreleased source, projects, audio stems and lyrics (gitignored `app/src/data/lyrics.json`, fonts).
- Integrity of the rendered video and audio output.

## Attacker profiles
- **(user)** Hosts on the local network (shared Wi-Fi, LAN): untrusted and in scope, during dev and render.
- A malicious web page the developer visits while the dev server runs.
- **(user)** A supplier of a malicious third-party asset or model (GLTF/GLB, font, audio).
- **(user)** Other people who clone and run the repo are users of the tool, each on their own machine.
- Not applicable: authenticated users of a hosted service (**(user)** there is no public hosting).

## Existing controls
- All process spawns use argv arrays (no shell).
- Vite binds localhost unless `--host` is passed.
- Scene loading is limited to `import.meta.glob` of bundled modules; `?project=` selects among bundled manifests.

## Out of scope / accepted risk
- **(user)** Malicious `project.json` manifests or scene/transition code from untrusted parties: these are not loaded from untrusted sources.
- **(user)** Public web hosting of the built app: not deployed.

## Open questions
- Are mix manifests and SFX cue files ever taken from third parties alongside audio assets? (Treated as trusted project files for now.)
