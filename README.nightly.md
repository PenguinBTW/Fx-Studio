# f(x) Studio (Nightly Development)

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

## 3. Active Production: *First Light*

- **Project Root**: `app/src/scenes/first_light/`
- **Photon State Contract**: [`app/src/scenes/first_light/photon.ts`](./app/src/scenes/first_light/photon.ts) (precomputed 1001-step Brownian core walk, camera binding, and screen projection).
- **Seam Checker**: [`app/scripts/check_seams.ts`](./app/scripts/check_seams.ts) (automates $C^0$ and $C^1$ continuity checks across acts 0 through 5).

---

## 4. Documentation Index

The complete documentation suite is under [**`docs/`**](./docs/README.md):
- [**Core Engine Modules Reference**](./docs/architecture/modules-reference.md) (25 universal modules)
- [**Physical Optics**](./docs/engine/spectrum.md) & [**Dispersion**](./docs/engine/refract.md)
- [**Bishop Ribbons**](./docs/engine/ribbon.md) & [**Streamlines**](./docs/engine/treewalk.md)
- [**In-World Typography**](./docs/engine/text-lighting.md)
- [**Multi-Track Mixdown**](./docs/audio/mixdown.md)
- [**Autonomous Review & Feedback**](./docs/feedback/claude_fx_studio_review.md)
- [**v0.7.0 Release Record**](./docs/changelog/v0.7.0-release-record.md)
