# Authoring Custom Engine Components & Render Passes

This guide provides normative specifications for authoring custom components, WebGL render passes, compute shaders, and compositing layers in **f(x) Studio**.

It details the **critical runtime invariants** that the engine assumes. Violating these invariants will compile cleanly in TypeScript but corrupt rendering, cause flickering, break transitions, or fail telemetry verification during offline export.

---

## 1. The Core Architectural Invariants

### 1.1 Output Target Ownership: HalfFloat Linear HDR, Fully Overwritten
Every `render(f, out)` call delivers a recycled `THREE.WebGLRenderTarget` backed by **HalfFloat linear HDR** textures (`RGBA16F`).

* **Overwriting Invariant**: You **must completely overwrite or clear `out`** on every invocation. The compositor recycles three alternating targets across frames (`rts[idx % 3]`) and across motion blur sub-frames. If your render pass fails to touch certain pixels or aborts mid-frame, uninitialized pixel data from previous scenes or sub-frames will bleed into your render.
* **Resolution Independence**: Allocate secondary targets using `makeRT(w, h)` in **logical units** (always logical $1920 \times 1080$). The helper automatically multiplies by `--scale`. Never assume `out` has a physical $1920 \times 1080$ backing buffer; at `--scale 2`, backing buffers are $3840 \times 2160$.

```typescript
import { makeRT } from '../../engine/gl';

// Correct: Logical 1920x1080 (scaled internally)
const customPassTarget = makeRT(1920, 1080);

// Data texture exception: pass pxScale: 1 for fixed-size lookup tables
const lutTarget = makeRT(256, 256, { pxScale: 1 });
```

### 1.2 WebGL State Preservation: `renderer.resetState()`
Three.js caches internal WebGL states (blending, depth test, active textures, VAO bindings, stencil state). Any raw shader call, custom vertex buffer bind, or Canvas2D rasterization that mutates the GL context must end with:

```typescript
this.ctx.renderer.resetState();
```

*Note: Forgetting `resetState()` does not corrupt your pass—it corrupts the pass that executes immediately after yours, resulting in classic misattributed rendering bugs. The declarative DSL (`defineScene`) invokes `resetState()` automatically.*

### 1.3 Transitions & The Mandatory Overlay Text Duck
When scenes overlap, the engine provides the outgoing frame as `f.under` and blend factors `f.tin` and `f.tout`.
* If `handlesTransition = false` (default): Ignore `f.under`. The compositor performs the transition.
* If `handlesTransition = true`: You own transition compositing. Sample `f.under` in your shader pass.

#### The Anti-Collision Contract: `overlayTextDuck(tin, tout)`
To eliminate typographic collisions across scene seams (`F04`), text elements must respect the mathematical ducking curve:
* **Outgoing text**: Driven to $0\%$ opacity by $35\%$ of the exit overlap window ($u = 0.35$).
* **Incoming text**: Kept at $0\%$ opacity until $55\%$ of the entrance overlap window ($u = 0.55$).

```
OVERLAY TEXT DUCK PROGRESSION
1.0 ──────┐                                       ┌─────── 1.0 (Incoming Text)
          │                                       │
          │ (Outgoing Text)                       │
0.0       └───────────┬───────────────────────────┴─────── 0.0
          0%         35%                         55%      100%
```

In declarative DSL scenes, `ctx.overlayDuck` is pre-calculated and applied automatically to `renderText` and `card`. If you emit raw Canvas2D text, multiply opacity:
```typescript
const duck = overlayTextDuck(f.tin, f.tout);
ctx.globalAlpha *= duck;
```

### 1.4 Motion Blur & Sub-Frame `SS_TAP` Optimization
When multi-sample motion blur is enabled (`--samples N`), your `render()` function executes $N$ times per frame at sub-frame shutter offsets around $t$.

Custom shaders that perform internal spatial supersampling should bind the shared `SS_TAP` uniform:
- When `ssTap >= 0`: Sample only the active sub-frame tap.
- When `ssTap === -1`: Sample all 4 taps.
This prevents paying a $4\times$ spatial shading cost on top of an $8\times$ temporal motion blur pass.

---

## 2. Telemetry Emission Architecture

f(x) Studio provides three automated paths to feed visual telemetry to `scripts/render.ts motion`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     THE THREE TELEMETRY PATHS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   PATH 1: AUTOMATIC CANVAS2D HOOK                                           │
│   • Intercepts fillText / strokeText calls automatically.                   │
│   • Captures font, logical bounding boxes, alpha, and style.                │
│   • Zero code required — active in all standard Canvas2D layers.            │
│                                                                             │
│   PATH 2: SCENEGRAPH TELEMETRY PROBES                                       │
│   • For 3D WebGL meshes, SDF vectors, and text planes.                      │
│   • Register entity with sceneGraph.addEntity({...}).                       │
│   • Project screen bounds with updateScreenProjections(cam, W, H).         │
│   • Flushed per frame via sceneGraph.syncTelemetry(t).                      │
│                                                                             │
│   PATH 3: KINETIC TEXT BRIDGE                                               │
│   • KineticText component checks window.__textHookActive.                   │
│   • Emits direct probe only when Path 1 hook is absent.                     │
│   • Guarantees zero duplicate probe entries.                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Manual Telemetry Gates
If you push custom telemetry probes manually (e.g. for custom WebGL text or debug overlays), you **must** replicate three safety gates:

```typescript
const bridge = (window as any).__motion;

// GATE 1: Probe Harness Active
if (!bridge?.probe || !bridge.textProbes) return;

// GATE 2: First Sub-Frame Only (Prevent motion blur duplicate entries)
if (bridge.recordText === false) return;

// GATE 3: Canvas2D Hook Exclusion (Prevent duplicate entry if already drawn to 2D)
if ((window as any).__textHookActive) return;

bridge.textProbes.push({
  frameIdx: bridge.currentFrameIdx,
  t: f.t,
  text: 'GPU HERO TITLE',
  fontFamily: 'Inter',
  fontPx: 64,
  fillStyle: '#EEE9DF',
  globalAlpha: 1.0,
  layerId: 'custom_gpu_pass',
  bbox: [400, 200, 1520, 264],
  w: 1120,
  h: 64,
  cx: 960,
  cy: 232,
  hPct: 5.92,
});
```

---

## 3. Memory Lifecycle & Disposal Invariants

During offline headless export, thousands of frames are rendered within a single Playwright page instance.

Any allocated resource not explicitly released in `dispose()` causes progressive GPU memory pressure, showing up as degrading frame turnaround times (`F13` frame budget violations) before triggering WebGL context loss:

| Resource Type | Allocation Method | Required Disposal Call |
| :--- | :--- | :--- |
| **Render Target** | `makeRT(w, h)` | `rt.dispose();` |
| **Geometry** | `new THREE.BufferGeometry()` | `geometry.dispose();` |
| **Material** | `new THREE.ShaderMaterial()` | `material.dispose();` |
| **Texture** | `new THREE.Texture()` | `texture.dispose();` |
| **Canvas2D Layer** | `new Layer2D(w, h)` | `layer.dispose();` |
| **DSL Context** | Managed via `defineScene` | Handled automatically by `SceneContext.dispose()` |
