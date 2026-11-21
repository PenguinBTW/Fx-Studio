# Human Review: fx-feedback-gui

[**fx-feedback-gui**](https://github.com/PenguinBTW/fx-feedback-gui) is the recommended review tool for f(x) Studio. It is a separate repo that sits next to this one. A human watches the real export path frame by frame, judges the stills agents rendered, and leaves precise notes. Agents read and resolve those notes through plain files and a small CLI, so it works with any agent harness (Devin, Claude Code, Codex, an orchestrator with sub-agents).

```
fx-feedback-gui (localhost:5180/__fxfb/)
  ├── iframe → Fx preview  /?export=1&project=<project>   (window.__motion.still(t))
  └── writes into this repo:
        .fx/notes/<id>.json, .fx/notes/<id>/m1.png, .fx/notes/NOTES.md
        .fx/captures/<project>/<run>/*.png, .fx/captures/verdicts.json
```

## Setup

Clone it next to this repo (`../fx-feedback-gui`). It needs Bun 1.1+ and `bun install` in `app/`.

```bash
cd Fx-Studio/app && bun run dev                    # Fx preview on :5173
cd fx-feedback-gui && bun install && bun run dev   # open http://localhost:5180/__fxfb/?project=<project>
```

`FX_REPO` defaults to `../Fx-Studio`; on PowerShell use `$env:FX_REPO='../Fx-Studio'; bun run dev`. The notes API exists only in the GUI's dev server and has no auth, so keep it on localhost.

## What the reviewer gets

- **Player:** the deterministic export render (not a separate renderer). It has J/K/L shuttle, frame stepping, an A/B loop, and a timeline strip showing scenes, notes and capture ticks.
- **Notes:** a timeline range (Shift+drag or N) with text, plus any number of markers:
  - a **box** or **lasso**, stored in normalised frame coordinates;
  - a **3D point** that resolves the object under the click and follows it as the camera or object moves.

  Every marker saves a crop with the selection drawn on it.
- **Agent captures:** every still an agent filed for the current project. Click one, then mark it **✓ Good** (G) or **✗ Needs work** (R). Needs work asks why, and that text becomes an open note at the capture's time.
- **Status flow:** open → fixed (agent) → accepted or reopened (human).

## Rules for agents

1. **File every render you look at** under `.fx/captures/<project>/<run>/`, where `<project>` is the folder under `app/src/scenes/` and `<run>` is any name:
   ```bash
   cd app && bun scripts/render.ts stills --project <project> --t 12.5,24.96 --out .fx/captures/<project>/check-1
   ```
   `stills` writes `f_<t>.png`. A time in the file name (`f_<t>.png`, `t<t>.png`) places the capture on the timeline. Images in `out/` or `app/out/` show as *Unfiled*, with no project and no timeline tick. Re-rendering to the same path clears the old verdict.
2. **Read and resolve notes** from the repo root:
   ```bash
   bun ../fx-feedback-gui/bin/fx-notes.ts list --status open
   bun ../fx-feedback-gui/bin/fx-notes.ts show <id> [--json]   # range, markers (frame, box/lasso, world point, entity), crops, re-render command
   bun ../fx-feedback-gui/bin/fx-notes.ts fix <id> -m "what changed"
   bun ../fx-feedback-gui/bin/fx-notes.ts reply <id> -m "question"
   bun ../fx-feedback-gui/bin/fx-notes.ts captures              # Good / Needs work verdicts
   ```
   `.fx/notes/NOTES.md` has the same content as Markdown. It also lists the approved captures: keep those looking the way they do.
3. **Prove a fix:** re-render the note's frames with its re-render command, which writes to `.fx/captures/<project>/<note id>/`. Then `fix` the note; the reply records the commit it was made at. The human accepts or reopens it.
4. **Name what can be picked.** 3D markers name the hit object by these, in order:
   - `userData.fx_entity`;
   - the Blender `fx_part` property (`<assetId>.<part>`);
   - the object name.

   When a scene builds its own meshes, for example an `InstancedMesh` from an asset part or procedural props, set `mesh.name` and `userData.fx_entity`. Otherwise reviewers only see `Mesh(…)`. See `instanced(…, name)` in `scenes/dimension_flight/common.ts`.

## Notes and git

`.fx/` is not ignored by default, so review history can travel with the project. To keep notes but not renders, add `.fx/captures/` to `.gitignore`. To keep it all local, ignore `.fx/`.

## Limits

- Picking works on what three.js knows on the CPU. Shader-displaced vertices, GPU particles and post-effect warps can pick a stale spot.
- Heavy scenes render at a few seconds per frame, so playback becomes frame stepping.
- The GUI reads the preview bridge `window.__motion` (`BRIDGE_VERSION`). Bridge changes can break it, so treat that interface as public.
