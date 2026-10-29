---
name: fx-engine-dev
description: Technical standards, internal invariants, and engineering workflows for modifying, extending, and debugging core engine subsystems, shaders, GPU batches, and render pipelines in f(x) Studio (app/src/engine/).
---
# f(x) Studio: Engine Modification & Core Development

Internal architectural standards, GPU memory invariants, WebGL state hygiene, and low-level development workflows for maintaining and extending the core **f(x) Studio** engine (`app/src/engine/`).

## When to Use

- Modifying, refactoring, or optimizing core files in `app/src/engine/`.
- Authoring custom WebGL2 fragment passes, fullscreen shaders (`FSPass`), or compute routines.
- Extending GPU instanced batchers (`SDFBatch`, `LineBatch`, `AnalyticalParticles`).
- Modifying the HalfFloat HDR optical post-processing pipeline (`post.ts`).
- Extending the camera rig math, Bishop frames, or physical ODE spring solvers.
- Debugging WebGL state leakage, GPU memory allocation, or PCIe bandwidth bottlenecks.

---

## 1. Engine Subsystems Map (`app/src/engine/`)

```
app/src/engine/
├── engine.ts       # Central execution loop, driver orchestration, ternary supersampler
├── dsl.ts          # Declarative scene wrapper (defineScene, SceneContext)
├── rig.ts          # 6-DOF Camera Rig (Centripetal splines, Bishop frames, trauma shake)
├── transform.ts    # TransformNode hierarchy & responsive LayoutNode pinning
├── text.ts         # Kinetic typography engine with knockout understroke halos
├── stroke.ts       # Single-stroke Hershey vector plotter fonts
├── sdf.ts          # Instanced GPU Signed Distance Fields (cards, rings, shadows)
├── motion.ts       # Closed-form 2nd-order ODE spring solvers & cubic beziers
├── particles.ts    # Stateless analytical GPU particles (StaticDrawUsage)
├── graph.ts        # Scoped render graph & track mattes (alpha, luma, blend modes)
├── lines.ts        # High-throughput GPU capsule line batcher
├── post.ts         # Alpha-preserving HalfFloat HDR post (bloom, halation, CA, grain)
├── gl.ts           # FSPass quad runner & Layer2D Canvas2D texture bridge
├── gltf.ts         # Universal GLTF / GLB 3D asset manager & Draco cache
├── viewport.ts     # 3D world space (X, Y, Z) <-> 2D NDC/pixel coordinate bridges
├── scenegraph.ts   # Spatial indexing & 3D OBB -> 2D screen AABB projection
├── tokens.ts       # Central design tokens, color models (LIN/sRGB), Delta E_76
├── export.ts       # Playwright headless pipeline & WebSocket FFmpeg streaming
├── driver.ts       # Timeline drivers (ClockDriver, deterministic fixed dt)
├── audio.ts        # AudioData interface & 100 FPS envelope binary search queries
└── heal.ts         # Self-correction machine-actionable repair directives
```

---

## 2. Non-Negotiable Core Engine Invariants [RULE]

Violating any of these rules introduces sub-frame jitter, memory leaks, or silent rendering corruption across scenes:

### 2.1 The WebGL State Cache Restoration Invariant
Three.js maintains an internal state cache (blend equations, depth write, active textures, VAO bindings). Any custom WebGL pass, batch renderer, or `FSPass` **must immediately restore Three.js internal state upon completion**:

```typescript
// MANDATORY after any custom GL draw call or batch flush:
renderer.resetState();
```
*Failure to call `renderer.resetState()` will not crash the engine immediately; instead, it silently corrupts the depth testing, texture bindings, or alpha blending of subsequent scenes.*

### 2.2 Closed-Form Temporal Evaluation: $\text{Frame} = f(t)$
- All state throughout the engine must be evaluated as a stateless, closed-form function of time $t$.
- **Zero Simulation Accumulators:** Never introduce frame-by-frame accumulators (`state += delta * dt`).
- **Why:** During offline export, the engine performs adaptive ternary supersampling (up to 324 spp within $[t - \frac{\text{shutter}}{2}, t + \frac{\text{shutter}}{2}]$) and supports arbitrary scrubbing. State accumulation breaks random-access seeking and causes particle and spring simulations to diverge.

### 2.3 HalfFloat HDR Linear Target Allocation
- All internal render targets must use HalfFloat linear color buffers:
  ```typescript
  new THREE.WebGLRenderTarget(w * SCALE, h * SCALE, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
  });
  ```
- Target dimensions operate in logical units ($1920 \times 1080$) multiplied by `SCALE` (e.g., `scale: 2` yields native $3840 \times 2160$ 4K).

### 2.4 PCIe Bandwidth Saturation Elimination
- When rendering up to 324 sub-samples per frame at 4K, streaming vertex buffers across the PCIe bus produces severe frame rate degradation.
- **Static GPU Buffers:** Particle systems (`AnalyticalParticles`) must allocate static attribute buffers (`THREE.StaticDrawUsage`) once during `init()`. Particle motion is computed analytically on the GPU using closed-form shaders.
- **Fragment SDFs:** 2D shapes, cards, and UI reticles must execute in fragment shaders (`SDFBatch`), never rendered to CPU Canvas2D surfaces and uploaded per sub-frame.

---

## 3. Subsystem Implementation Standards

### 3.1 Closed-Form Spring Physics (`motion.ts`)
Springs must evaluate analytically using the exact second-order ODE solution for under-damped ($\zeta < 1$), critically-damped ($\zeta = 1$), and over-damped ($\zeta > 1$) systems with initial velocity $v_0$:

```typescript
// Analytical Under-Damped Mass-Spring-Damper Solution:
export function springUnderDamped(
  t: number,
  mass: number,
  stiffness: number,
  damping: number,
  v0 = 0
): number {
  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
  const decay = Math.exp(-zeta * omega0 * t);
  const c1 = 1.0;
  const c2 = (zeta * omega0 - v0) / omegaD;
  return 1.0 - decay * (c1 * Math.cos(omegaD * t) + c2 * Math.sin(omegaD * t));
}
```

### 3.2 6-DOF Camera Rig & Bishop Frames (`rig.ts`)
- **Gimbal Flip Elimination:** When evaluating camera LookAt vectors, test for alignment with the vertical reference axis: $\vert{}F_w \cdot Y\vert{} > 0.99$. If parallel, smoothly interpolate to Bishop orthonormal reference frames to avoid rotation inversions when looking straight down.
- **Centripetal Splines:** Arc-length parameterize Catmull-Rom splines using lookup tables (LUTs) to maintain constant physical velocity across waypoint knots.
- **Analytical Trauma Shake:** Screen trauma must use exponential energy decay:
  $$T(t) = \sum_i I_i \cdot e^{-(t - t_{0,i}) \cdot \text{decay}}, \quad \Delta \theta = T(t)^2 \cdot \text{SimplexNoise}(t \cdot \omega)$$

### 3.3 GPU Signed Distance Fields (`sdf.ts`)
- Evaluate cards, borders, and drop shadows in fragment shaders using signed distance fields:
  ```glsl
  // Analytic Box SDF with Per-Corner Radii Control
  float sdRoundedBox(vec2 p, vec2 b, vec4 r) {
    r.xy = (p.x > 0.0) ? r.xy : r.zw;
    float rad = (p.y > 0.0) ? r.x : r.y;
    vec2 q = abs(p) - b + rad;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - rad;
  }
  ```
- Use screen-space derivatives `fwidth(d)` for sub-pixel anti-aliasing.

### 3.4 Optical Post Pipeline & Alpha Preservation (`post.ts`)
The post-processing pipeline must preserve alpha channel transparency for video overlays:
- **Dual-Threshold Bloom:** Soft-knee luminance isolation prevents blooming low-energy signals.
- **Spectral Halation:** Warm orange-red edge bleed along high-contrast boundaries.
- **Radial CA:** Offsets R and B channels proportional to squared radius $(r / r_{\max})^2$.
- **Procedural Film Grain:** Temporal high-frequency noise generated directly via fragment hashes, avoiding static texture tiling.

---

## 4. Adaptive Ternary Supersampling Engine Loop (`engine.ts`)

During offline video export, the engine avoids brute-force supersampling through adaptive error convergence:

```
[TERNARY SUPERSAMPLING LOOP (1 to 324 spp)]

  Step 1: 4 Initial Samples (Base Pass)
          │
          ├───► Compute Error against Tolerance Block (2x2 pixel blocks)
          │
  Error < Tol? ─── YES ───► Terminate Early (Static / Low-Motion Scene: 4-12 spp)
          │
          NO
          │
  Step 2: 12 Samples (Ternary Subdivision)
          │
  Error < Tol? ─── YES ───► Terminate Early
          │
          NO
          │
  Step 3 / 4 / 5: Subdivide recursively (36 -> 108 -> 324 spp max)
          │
          └───► High-Velocity Whips / Particle Bursts resolve without strobing
```

- Offsets are calculated via `ternaryOffsets(steps)`:
  $$u_k = \frac{k + 0.5}{4} - 0.5 \quad (k \in \{0, 1, 2, 3\})$$
- Accumulate sub-samples into HalfFloat buffers and downscale difference passes to evaluate remaining error before scheduling additional passes.

---

## 5. Adding New Modules to the Engine

When authoring a new core module in `app/src/engine/`:

1. **Create the Module File:** Place in `app/src/engine/<name>.ts`.
2. **Export through DSL:** If the feature should be accessible to scene authors, bind it to `SceneContext` in `dsl.ts`.
3. **Automate WebGL Cleanup:** If the module performs custom GL draws, wrap its execution in `dsl.ts` or `Scene.render()` so `renderer.resetState()` is guaranteed.
4. **Instrument Telemetry:** If the module exposes screen-space geometry or typography, register bounding boxes into `window.__motion` for automated QA auditing.

---

## 6. Engine Development Verification Checklist

Before committing any core engine modification, verify:

- [ ] **State Restoration:** All new WebGL calls, custom shaders, or batch flushes invoke `renderer.resetState()`.
- [ ] **Zero Memory Leakage:** No textures, render targets, or geometries are re-allocated inside the per-frame `render()` loop.
- [ ] **Temporal Determinism:** Subsystem contains zero mutable state accumulators (`+=`); evaluates cleanly forwards, backwards, and under sub-frame jitter.
- [ ] **Static Buffer Invariant:** Particle and line geometries use static GPU attributes (`StaticDrawUsage`) without PCIe churn.
- [ ] **Alpha Preservation:** Render passes and post-processing preserve background alpha transparency when required.
- [ ] **TypeScript Build:** Engine compiles with zero type errors: `bun run build`.