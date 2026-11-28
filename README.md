# f(x) Studio (Nightly Development)

**A deterministic motion-design engine built for AI agents.** You describe a film; an agent writes it as code (scenes,
cameras, 3D assets, sound), reviews its own renders, and exports it at up to 4K. Every frame is a pure function of time, so
what you review is exactly what ships.

| | | |
|---|---|---|
| [![lull: the soft play](https://raw.githubusercontent.com/PenguinBTW/fxstudio-demos/main/scenes/lull/samples/01_playroom.jpg)](https://github.com/PenguinBTW/fxstudio-demos/tree/main/scenes/lull) | [![lull: the library](https://raw.githubusercontent.com/PenguinBTW/fxstudio-demos/main/scenes/lull/samples/02_library.jpg)](https://github.com/PenguinBTW/fxstudio-demos/tree/main/scenes/lull) | [![lull: the pool](https://raw.githubusercontent.com/PenguinBTW/fxstudio-demos/main/scenes/lull/samples/03_pool.jpg)](https://github.com/PenguinBTW/fxstudio-demos/tree/main/scenes/lull) |

<sub>*lull*: a 3:11 first-person horror film written, modelled, animated and sound-designed end to end by an AI agent in f(x) Studio. Scene code in [**fxstudio-demos**](https://github.com/PenguinBTW/fxstudio-demos).</sub>

> [!IMPORTANT]
> **Active Development Branch: `nightly`**  
> This branch contains cutting-edge engine features, complete diagnostic test suites, procedural scene benchmarks, and the production workspace for ***First Light***. For the stable release, visit the [`main`](https://github.com/PenguinBTW/Agentic-motion-design-toolset/tree/main) branch.

**PolyForm Small Business License 1.0.0 ([`LICENSE.md`](./LICENSE.MD))** • Commercial licensing: *vio@penguinbtw.com*

---

## 1. Developer & Subagent Test Suites

All engine features, mathematical solvers, shaders, and audio pipelines are guarded by automated test suites. Always verify your changes before committing:

### Automated Test Matrix
```bash
# Full milestone regression suite
bun test

# Domain-specific verification suites (all exit code 0 on passing)
bun run test:spectrum        # CIE 1931 polynomial model & Planckian blackbody locus
bun run test:refract         # Cauchy dispersion, dielectric Fresnel & Descartes caustics
bun run test:dof             # Physical thin-lens CoC & bilateral depth gather
bun run test:post            # Tone mapping (ACES/AgX), diffraction spikes & true black
bun run test:noise           # Divergence-free curl noise (Tr(J) == 0) & Voronoi
bun run test:rig             # Constant dolly-zoom projection & screen autofocus
bun run test:ribbons         # Bishop RMF twist-free frames & quantum aurora lines
bun run test:curvemorph      # Polyline correspondence & rotation/reversal recovery
bun run test:treewalk        # Laminar streamline untangling (>90% curvature reduction)
bun run test:text            # Kinetic odometer continuous carry & stroke reveals
bun run test:text-lighting   # In-world 3D PBR text lighting & particle deflection
bun run test:glyphs          # 80-character stroked Hershey glyph coverage
bun run test:seams           # Act boundary continuity & screen jump < 0.0003 px
bun scripts/test_mixdown.ts  # EBU R128 mastering & sample-exact digital silence
```

### Static Analysis & Determinism Guard
```bash
# TypeScript strict type checking across engine and scripts
bun run typecheck

# Determinism static scan (checks for Math.random or Date.now violations)
bun run check:determinism
```

---

## 2. Release Promotion Workflow

When a milestone is complete and all test suites pass, promote `nightly` to `main` with a single command:

```bash
bun run release:promote
```

### What `release:promote` does:
1. Runs the full verification gate (`check:determinism`, `typecheck`, `test:seams`, `test_mixdown.ts`).
2. Syncs core engine code, production scenes, and documentation to `main`.
3. Strips developer test scripts (`app/scripts/test_*.ts`), benchmark timers, and internal prompts from `main`.
4. Deploys the consumer-facing `README.main.md` as the root `README.md` on `main`.
5. Commits and tags the release, returning cleanly to `nightly`.

---

## 3. Showcase & Productions

| Project | What it is |
|---|---|
| [**lull**](https://github.com/PenguinBTW/fxstudio-demos/tree/main/scenes/lull) | 3:11 first-person horror film: one continuous take through comfortable places that turn wrong, Blender-built creatures, fully code-generated sound |
| [**fx_promo**](./app/src/scenes/fx_promo) | 3:34 f(x) Studio promo film: in-world type, dolly-zooms, a raymarched glass cathedral, an infinite-zoom climax |
| [**dimension_flight**](./app/src/scenes/dimension_flight) / [**bird_odyssey**](./app/src/scenes/bird_odyssey) | A swallow's flight through five dimensions with Blender-built worlds, GPU embers and per-world grading |
| [**agent_promo**](./app/src/scenes/agent_promo) / [**agent_v2**](./app/src/scenes/agent_v2) | Agent promo film: logo, fire, dragon, forge and an origami desk sequence |
| [**spill**](./app/src/scenes/spill), [**freefall**](./app/src/scenes/freefall), [**agent_teaser**](./app/src/scenes/agent_teaser) | Native 9:16 vertical shorts |
| [**threshold**](./app/src/scenes/threshold) | First-person horror film |
| [**spacecraft_docking**](./app/src/scenes/spacecraft_docking) | Audio benchmark: multi-stem excision and 3D object-bound thruster audio |

Production notes from agent-made films (what worked, where the engine slowed the agent down) live in
[`docs/feedback/`](./docs/feedback/), starting with [the lull post-mortem](./docs/feedback/lull-agent-workflow-feedback.md).

---

## 4. Documentation Index

The complete documentation suite is under [**`docs/`**](./docs/README.md):
- [**Core Engine Modules Reference**](./docs/architecture/modules-reference.md) (25 universal modules)
- [**Physical Optics**](./docs/engine/spectrum.md) & [**Dispersion**](./docs/engine/refract.md)
- [**Bishop Ribbons**](./docs/engine/ribbon.md) & [**Streamlines**](./docs/engine/treewalk.md)
- [**In-World Typography**](./docs/engine/text-lighting.md)
- [**Multi-Track Mixdown**](./docs/audio/mixdown.md)
- [**Human Review GUI (fx-feedback-gui)**](./docs/feedback/review-gui.md): the recommended companion tool for reviewing renders and leaving notes for agents
- [**Autonomous Review & Feedback**](./docs/feedback/claude_fx_studio_review.md)
- [**v0.8.0 Release Record**](./docs/changelog/v0.8.0-release-record.md)
- [**v0.7.0 Release Record**](./docs/changelog/v0.7.0-release-record.md)
