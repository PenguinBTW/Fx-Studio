# Implementation Plan: P1a Photon State Contract

> **Context**: Derived from Claude Opus 5.5 architectural survey (`ses_e8a33a03fffebdNT82dFdDTsOU`, 444k tokens).  
> **Target File**: `app/src/scenes/first_light/photon.ts`  
> **Key Dependents**: All 6 scene acts of "First Light", transition shaders (T1–T9), and seam checker (`scripts/check_seams.ts`).

---

## 1. Architectural Motivation & Constraints

1. **Stateless Transitions Requirement**:
   - In `app/src/engine/engine.ts` (around line 426), the engine strictly forbids stateful scene participants during transitions (`api.sampleScene(id, t)` must be idempotent and callable out-of-order).
   - The engine's `Frame` context exposes audio telemetry and timing, but **zero scene state** or object positions.
   - For the photon to have continuous screen position across every transition seam without visual jumps or teleportation, the photon's 3D and 2D trajectory must be a **pure closed-form function of global timeline time** ($f(t)$).
2. **Camera Invariance**:
   - Scenes cannot use arbitrary, uncoordinated Three.js cameras. Each act's camera parameters (FOV, world position, target lookAt) must be published by the photon module or strictly derived from it so that `worldToScreen(pos, cam)` yields an identical screen coordinate at both $t_{\text{seam}}^-$ and $t_{\text{seam}}^+$.

---

## 2. API Contract Specification

```typescript
import * as THREE from 'three';
import { type V3, mulberry32 } from '../../engine/util';

export interface PhotonState {
  /** 3D world-space position */
  worldPos: V3;
  /** Normalized tangent direction of motion */
  dir: V3;
  /** Projected 1080p screen-space pixel coordinates [0..1920, 0..1080] */
  screenPos: [number, number];
  /** Current act index (0..5 for the 6 primary acts, up to 9 for transitions/codas) */
  act: number;
  /** Atmospheric optical depth [0..1] driving the sky color grade and scatter */
  depth: number;
  /** Core luminance / energy multiplier [0..1+] */
  intensity: number;
  /** Dominant emission wavelength in nanometers (e.g. 550nm green, 650nm red) */
  wavelength: number;
}

export interface ActCameraSpec {
  pos: V3;
  target: V3;
  fov: number; // vertical FOV in degrees (default 45)
  near: number;
  far: number;
}
```

---

## 3. Core Module Components

### A. Precomputed Random Walk (`walkPath`)
* In the Solar Core (Act 1), the photon undergoes Brownian-like random walk scattering.
* **Deterministic generation**:
  ```typescript
  export function generateCoreWalk(seed = 1337, steps = 1000): V3[] {
    const rng = mulberry32(seed);
    const path: V3[] = [[0, 0, 0]];
    let cur: V3 = [0, 0, 0];
    for (let i = 0; i < steps; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(2 * rng() - 1);
      const stepLen = 0.05 + rng() * 0.1;
      cur = [
        cur[0] + stepLen * Math.sin(phi) * Math.cos(theta),
        cur[1] + stepLen * Math.sin(phi) * Math.sin(theta),
        cur[2] + stepLen * Math.cos(phi)
      ];
      path.push(cur);
    }
    return path;
  }
  ```
* Module-level singleton: precomputed once at module evaluation time so calls at any $t$ are $O(\log N)$ or $O(1)$ interpolations with zero GC pressure.
* Standalone export: `export const CORE_WALK = generateCoreWalk();` so Act 6 (Retina Coda) can reuse the identical path in reverse.

### B. Downbeat-Synchronized Act Bounds (`ACT_BOUNDS`)
* Bound timings re-anchored to audio analysis downbeats:
  ```typescript
  export const ACT_BOUNDS = [
    { act: 0, name: 'core',         start: 0.0,   end: 22.0  },
    { act: 1, name: 'radiative',    start: 22.0,  end: 64.0  },
    { act: 2, name: 'convection',   start: 64.0,  end: 110.0 },
    { act: 3, name: 'vacuum',       start: 110.0, end: 154.0 },
    { act: 4, name: 'droplet',      start: 154.0, end: 198.0 },
    { act: 5, name: 'retina',       start: 198.0, end: 256.0 },
  ] as const;
  ```

### C. Analytical Position & Screen Projection
* `photonState(t: number): PhotonState`:
  1. Determine current act from `t`.
  2. Compute segment interpolation parameter $s \in [0, 1]$.
  3. Evaluate spline/walk curve to obtain `worldPos` and finite-difference unit tangent `dir`.
  4. Fetch camera spec for active act `cam = getActCamera(act, t)`.
  5. Project to NDC and map to $1920 \times 1080$ viewport:
     $$\text{screenX} = (x_{\text{ndc}} \cdot 0.5 + 0.5) \times 1920$$
     $$\text{screenY} = (1.0 - (y_{\text{ndc}} \cdot 0.5 + 0.5)) \times 1080$$

---

## 4. Verification & Seam Test Harness

* **Test Script**: `app/scripts/test_photon_contract.ts`
  1. **Determinism**: Verify that calling `photonState(t)` in shuffled order yields byte-identical values to sequential order.
  2. **Continuity**: Verify $| \text{screenPos}(t + \epsilon) - \text{screenPos}(t) | < \delta$ across act transition boundaries ($t = 22.0, 64.0, 110.0, 154.0, 198.0$).
  3. **Performance**: Verify 100,000 evaluations of `photonState(t)` execute in $< 50\,\text{ms}$ on CPU.
