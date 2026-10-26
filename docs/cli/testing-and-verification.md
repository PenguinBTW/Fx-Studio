# Automated Engine Verification & Test Suites

This document provides complete instructions for running the automated verification suites and continuous integration regression checks in **f(x) Studio**.

---

## 1. Test Suite Architecture

f(x) Studio includes four specialized verification test suites located in `app/scripts/`:

```
app/scripts/
├── test_milestones.ts           # Master regression harness running all milestone tests
├── test_milestone1.ts          # Milestone 1: Multi-project manifests, active.json, & loading
├── test_milestone2.ts          # Milestone 2: Standalone transitions & overlayTextDuck contract
├── test_milestone3.ts          # Milestone 3: 4 visual diagnostic instruments (godview, onion, etc.)
├── test_milestone4.ts          # Milestone 4: Telemetry engine, F01–F16 rules & zero-tolerance
├── test_bugfixes.ts            # Regression tests for fixed WebGL state & clipping bugs
└── test_project_transitions.ts # Automated sweep of all project transition windows
```

---

## 2. Running Verification Test Suites

All tests run headless via **Bun**:

```bash
# From within the app/ directory:
cd app

# Run all milestone tests in sequence
bun scripts/test_milestones.ts

# Run individual milestone verification suites
bun scripts/test_milestone1.ts
bun scripts/test_milestone2.ts
bun scripts/test_milestone3.ts
bun scripts/test_milestone4.ts

# Run transition sweep and bugfix regression suites
bun scripts/test_project_transitions.ts
bun scripts/test_bugfixes.ts
```

---

## 3. What Each Test Suite Validates

### 3.1 Milestone 1: Project System & Manifest Integrity (`test_milestone1.ts`)
Validates the multi-project workspace architecture:
- Verifies that `app/src/scenes/active.json` resolves correctly.
- Confirms that `loadManifest()` loads project entries and standalone transitions.
- Asserts that missing or broken scene files do not crash the engine during initialization.
- Validates the project selection cascade (`?project=` URL >> `active.json` >> default).

### 3.2 Milestone 2: Transition Contracts & Text Ducking (`test_milestone2.ts`)
Validates the transitions system and anti-collision contracts:
- Verifies that all transition classes in `app/src/transitions/` compile cleanly and can be instantiated.
- **The `overlayTextDuck` Mathematical Sweep**: Evaluates `overlayTextDuck(tin, tout)` across a 100-step sweep of progress $u \in [0.0, 1.0]$, asserting:
  1. Outgoing opacity is strictly $0.0$ when $u \ge 0.35$.
  2. Incoming opacity is strictly $0.0$ when $u \le 0.55$.
  3. Outgoing and incoming text are **never simultaneously legible** ($\alpha > 0.15$ on both sides).
- Validates that transition windows (`at`, `dur`) lie strictly within the overlapping bounds of participant scenes.

### 3.3 Milestone 3: Visual Diagnostic Instruments (`test_milestone3.ts`)
Validates the headless execution of the four operational diagnostic instruments:
- Launches headless Chrome via Playwright.
- Executes `runGodView()`: Asserts generation of `cam_godview.png` and `godview_summary.json`.
- Executes `runOnion()`: Asserts generation of `onion_motion.png` and `onion_summary.json`.
- Executes `runCompare()`: Verifies ephemeral Vite server spawning and split-wipe generation.
- Executes `runStitch()`: Asserts generation of `onion_seam.png` and `strip_seam.png`.

### 3.4 Milestone 4: Telemetry Sanity & Zero-Tolerance Baseline (`test_milestone4.ts`)
Validates the 60fps motion telemetry engine and rule evaluator:
- Evaluates rules **F01 through F16** against reference frame timeseries.
- **The Zero-Tolerance Baseline Invariant**: Asserts that running telemetry across director-approved reference benchmark plates produces **strictly 0 blocking flags**.
- Validates stable content-addressed ID generation (`rule-t0-t1-counter`).
- Validates reviewer waiver ingestion (`findings.json`).

### 3.5 Automated Transition Seam Checker (P9: `check_seams.ts`)
Validates seam continuity across all film act transitions (`bun run test:seams`):
- Evaluates `photonState(t)` at $t - 1/60$, $t$, and $t + 1/60$ for all boundary seams in `ACT_BOUNDS`.
- Asserts screen position continuity: verify boundary screen position delta $< 1.0$ px jump limit (actual $< 0.0003$ px).
- Verifies direction vector continuity (unit tangent normalization and boundary angle continuity $\ge 0.99$ dot product).
- Validates that transitions can safely call `api.sampleScene(id, t)` across a 5.0-second window without state corruption or frame-time blowup ($< 0.1$ ms avg, flat performance).
- Enforces strict rejection of stateful participants in transition windows.
- Supports CLI flags: `--act [n]`, `--verbose`, `--json`.

---

## 4. Continuous Integration (CI) Review Gate Protocol

For automated GitHub Actions or pre-commit hooks, execute this sequential verification gate:

```bash
#!/usr/bin/env bash
set -e

echo "=== 1. TypeScript Build Integrity ==="
cd app && bun run build

echo "=== 2. Core Milestones Regression Suites ==="
bun scripts/test_milestones.ts

echo "=== 3. Project Transitions Integrity ==="
bun scripts/test_project_transitions.ts

echo "=== 4. Telemetry Sanity Check ==="
bun scripts/render.ts motion --from 0.0 --to 5.0 --only act1_vault_blueprint --out ../out/ci_audit

echo "=== All Verification Gates Passed (0 Defects) ==="
```
