# Visual Diagnostics Suite: Sight Over Numbers

**f(x) Studio** features an integrated suite of four high-leverage visual diagnostic instruments engineered to give autonomous AI agents and human art directors direct **spatial, temporal, and chromatic sight** into procedural 60 fps WebGL/Canvas2D motion design.

Whether generating commercial product reveals, kinetic typography manifestos, procedural data visualizations, or narrative music videos, visual instruments eliminate the guesswork of blind scalar profiling.

---

## 1. The Observability Principle

When synthesizing procedural 3D motion graphics, automated systems frequently rely on scalar metrics ($jerk$, optical flow, $\Delta E$, luma). While valuable for profiling, scalar numbers cannot answer essential questions of motion craft:
- *"Does this camera trajectory arc smoothly into the product hero shot, or does it hitch on an unblended spline tangent?"*
- *"Why did that 3D object suddenly disappear? Did it penetrate the camera near-clip plane, occlude behind a backplane, or get clipped by the viewport frustum?"*
- *"Is our stroke weight and bloom too aggressive compared to the design tokens and brand guidelines?"*
- *"Does the visual focal point stay anchored across this scene cut, or does the viewer's eye get violently thrown across the screen?"*

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THE OBSERVABILITY PRINCIPLE                           │
│                                                                             │
│   SCALAR METRICS ALONE                   VISUAL INSTRUMENTATION             │
│   ┌───────────────────────────┐          ┌───────────────────────────┐      │
│   │ jerk = 142.8 m/s³         │          │ [ 3D God-View Blueprint ] │      │
│   │ optical_flow = 18.2 px/s  │  ──────► │ [ Motion Onion Trail    ] │      │
│   │ edge_density = 0.041      │          │ [ Split-Wipe A/B Anchor ] │      │
│   │ delta_e = 8.4             │          │ [ Seam Stitch Overlay   ] │      │
│   └───────────────────────────┘          └───────────────────────────┘      │
│   Blind to spatial geometry,             Provides instantaneous spatial,    │
│   easing rhythm, & aesthetic             temporal, and physical context in  │
│   intent. Fails on intentional           a single, model-inspectable image. │
│   snaps and spring dynamics.                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The Four Operational Instruments

| Instrument | CLI Command | Implementation | Core Artifacts | Primary Diagnostic Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **01. God-View Blueprint** | `bun scripts/godview.ts` | [`app/scripts/visual/godview.ts`](../../app/scripts/visual/godview.ts) | `cam_godview.png`<br>`godview_summary.json` | Top-down ($XZ$) & elevation ($YZ$) orthographic blueprint with velocity-colored camera flight ribbons, viewing cones, and obstacle clearance analysis. |
| **02. Motion Onion** | `bun scripts/onion.ts` | [`app/scripts/visual/onion.ts`](../../app/scripts/visual/onion.ts) | `onion_motion.png`<br>`onion_summary.json` | Multi-exposure temporal collapse (cyan $\to$ natural $\to$ amber) revealing easing deceleration, spring damping ($m,k,c$), and micro-tremor hitches. |
| **03. A/B Reference Anchor** | `bun scripts/compare.ts` | [`app/scripts/visual/compare.ts`](../../app/scripts/visual/compare.ts) | `ab_split_wipe.png`<br>`ab_side_by_side.png` | $45^\circ$ diagonal split wipe and side-by-side contact plates benchmarking active frames against Figma artboards or master design tokens. |
| **04. Seam Stitch Inspector**| `bun scripts/stitch.ts` | [`app/scripts/visual/stitch.ts`](../../app/scripts/visual/stitch.ts) | `onion_seam.png`<br>`strip_seam.png` | Green/magenta false-color overlay ($N-1$ vs $N$) and 10-frame seam filmstrip auditing cut continuity, horizon tilts, and carrier jumps ($\pm 250\text{ms}$). |

---

## 3. Architecture & Modularity Matrix

All four instruments share a clean, zero-bloat architecture with dynamic imports:

```
Agentic motion design toolset/
├── scripts/                          # Root CLI wrappers (~13 lines each)
│   ├── render.ts                     # Master CLI dispatcher
│   ├── onion.ts                      # Direct CLI -> app/scripts/render.ts onion
│   ├── godview.ts                    # Direct CLI -> app/scripts/render.ts godview
│   ├── compare.ts                    # Direct CLI -> app/scripts/render.ts compare
│   └── stitch.ts                     # Direct CLI -> app/scripts/render.ts stitch
│
└── app/scripts/
    ├── render.ts                     # Dynamic import dispatcher (zero boot bloat)
    └── visual/                       # Self-contained instrument logic
        ├── onion.ts                  # Multi-exposure chromatic blending
        ├── godview.ts                # Orthographic blueprint & frustum rendering
        ├── compare.ts                # Dual-session reference comparator
        └── stitch.ts                 # Seam onion overlay & filmstrip generator
```

### Dynamic Import Dispatcher (`app/scripts/render.ts`)
The main rendering harness only loads instrument modules when their subcommand is requested, ensuring headless server boot times stay under $300\text{ms}$:

```typescript
if (mode === 'onion') {
  const { runOnion } = await import('./visual/onion');
  await runOnion(page, process.argv.slice(3));
} else if (mode === 'stitch') {
  const { runStitch } = await import('./visual/stitch');
  await runStitch(page, process.argv.slice(3));
} else if (mode === 'compare') {
  const { runCompare } = await import('./visual/compare');
  await runCompare(page, process.argv.slice(3));
} else if (mode === 'godview') {
  const { runGodView } = await import('./visual/godview');
  await runGodView(page, process.argv.slice(3));
}
```

---

## 4. Execution Benchmarks & Turnaround Time

All instruments run headless via Bun and Playwright, using Canvas2D blending and WebGL readbacks without requiring native C++ compilation:

| Tool | Nominal Sample Count | Execution Time | Resolution | Memory Footprint |
| :--- | :--- | :--- | :--- | :--- |
| **`godview`** | 24–32 camera samples | $2.1\text{–}3.5\,\text{s}$ | $1920 \times 1080$ | $< 180\,\text{MB}$ |
| **`onion`** | 8–16 exposure slices | $2.4\text{–}4.2\,\text{s}$ | $1920 \times 1080$ | $< 210\,\text{MB}$ |
| **`compare`** | 2 full 1080p frames | $3.8\text{–}5.6\,\text{s}$ (spawns ephemeral Vite instance) | $1920 \times 1080$ | $< 320\,\text{MB}$ |
| **`stitch`** | 10 frames across boundary | $2.2\text{–}3.8\,\text{s}$ | $1920 \times 1080$ (Overlay) + $9600 \times 1080$ (Strip) | $< 240\,\text{MB}$ |

---

## 5. Autonomous Agent Workflow Decision Tree

When building, debugging, or auditing procedural scenes, autonomous agents should follow this diagnostic sequence:

```
                                  [ AGENT TASK ]
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
    [ 3D Scene / Spatial Layout ] [ Easing, Springs & Motion ] [ Scene Cuts & Handoffs ]
              │                          │                          │
              ▼                          ▼                          ▼
       bun scripts/godview.ts      bun scripts/onion.ts       bun scripts/stitch.ts
       • Inspect 3D clearances    • Check ghost spacing      • Check carrier alignment
       • Verify frustum cone      • Spot spline hitches      • Spot horizon tilt jumps
       • Audit flight ribbon      • Verify spring damping    • Catch blank frame drops
              │                          │                          │
              └──────────────────────────┼──────────────────────────┘
                                         │
                                         ▼
                            [ Aesthetic Calibration ]
                                         │
                                         ▼
                               bun scripts/compare.ts
                               • Compare typography height & weight
                               • Verify negative space (60-75%)
                               • Check line density against design tokens
                                         │
                                         ▼
                            [ Final Verification Audit ]
                                         │
                                         ▼
                               bun scripts/render.ts motion
                               • Verify 0 blocking flags in findings.json
                               • Verify dwell times, safe margins & palette
```

---

## 6. Directory Index

- [01. 3D God-View Camera Blueprint](01-godview-camera-blueprint.md)
- [02. Multi-Exposure Motion Onion](02-multi-exposure-motion-onion.md)
- [03. Visual A/B Reference Anchor](03-visual-ab-reference-anchor.md)
- [04. Transition Seam Stitch Inspector](04-transition-seam-stitch-inspector.md)
