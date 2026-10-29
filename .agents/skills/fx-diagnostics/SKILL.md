---
name: fx-diagnostics
description: Diagnostic standards, visual inspection tools (godview, onion, stitch, compare), motion telemetry rules (F01-F16), and headless CLI verification workflows in f(x) Studio. Use when auditing scenes, debugging visual bugs, or running CLI exports.
---
# f(x) Studio: Visual Diagnostics, Telemetry & Quality Assurance

Diagnostic standards, visual inspection tooling, Kinematic Telemetry Engine protocols, GPU-accelerated headless rendering workflows, and automated quality assurance rules (`F01–F16`) for auditing scenes and transitions in **f(x) Studio**.

## When to Use

- Visually inspecting camera paths, clearances, and frustums before final rendering.
- Debugging easing curves, spring damping oscillations, or visual stutter on static frames.
- Auditing scene-to-scene transition seams for horizon tilt jumps and carrier alignment.
- Running automated 60 fps kinematic telemetry to detect collisions, clipping, or performance spikes.
- Logging justified creative waivers in `findings.json`.
- Running headless CLI export and capture commands (`scripts/render.ts`) with GPU hardware acceleration.

---

## 1. Core Philosophy: "Sight Over Numbers"

Scalar metrics alone cannot evaluate motion graphics. A single number like $\text{jerk} > 120\,\text{m/s}^3$ penalizes intentional artistic snaps, while remaining blind to spatial collisions, near-plane clipping, or typographic unbalance.

f(x) Studio enforces **Visual Diagnostic Instrumentation and Empirical Calibration**:
- Autonomous agents and engineers inspect synthetic diagnostic images: 3D orthographic blueprints, chromatic motion trails, and seam overlays.
- Automated numerical audits are strictly classified into a **Three-Tier Review Hierarchy** so creative expression is never blocked by arbitrary scalar thresholds.

---

## 2. The Four Visual Diagnostic Instruments [RULE]

Before declaring any animation or scene change complete, run the corresponding diagnostic instrument based on the task:

| Instrument | CLI Command | Implementation | Visual Artifacts | Primary Diagnostic Purpose |
|---|---|---|---|---|
| **01. God-View Blueprint** | `bun scripts/godview.ts` | `scripts/visual/godview.ts` | `cam_godview.png`<br>`godview_summary.json` | Top-down ($XZ$) and elevation ($YZ$) orthographic blueprints with velocity-colored flight ribbons, camera viewing cones, and obstacle clearance boxes. Prevents camera clipping through geometry and spatial disorientation. |
| **02. Motion Onion** | `bun scripts/onion.ts` | `scripts/visual/onion.ts` | `onion_motion.png`<br>`onion_summary.json` | Multi-exposure temporal collapse (cyan $\to$ natural $\to$ amber) across an animation window ($0.5\text{–}1.5\text{s}$). Exposes deceleration curves, physical spring damping ($m,k,c$), and trajectory hitches on a single still image. |
| **03. A/B Reference Anchor** | `bun scripts/compare.ts` | `scripts/visual/compare.ts` | `ab_split_wipe.png`<br>`ab_side_by_side.png` | $45^\circ$ diagonal split wipe and side-by-side contact plates benchmarking active frames against Figma artboards, brand tokens, or approved plates. |
| **04. Seam Stitch Inspector** | `bun scripts/stitch.ts` | `scripts/visual/stitch.ts` | `onion_seam.png`<br>`strip_seam.png` | Green/magenta false-color overlay ($N-1$ vs. $N$) and 10-frame seam filmstrip across transition cuts ($\pm 250\text{ ms}$). Audits carrier token alignment, velocity continuity, and horizon tilt stability. Compares standalone scenes, so it gives false hard cuts on blended transitions: use timeline-frame sampling there. |

### Visual Diagnostic Decision Tree
```
                                  [ AGENT MOTION TASK ]
                                             │
                  ┌──────────────────────────┼──────────────────────────┐
                  ▼                          ▼                          ▼
        [ 3D Spatial Layout ]      [ Easing & Physical Springs ] [ Scene Cuts & Handoffs ]
                  │                          │                          │
                  ▼                          ▼                          ▼
           bun scripts/godview.ts      bun scripts/onion.ts       bun scripts/stitch.ts
           • Check 3D clearances      • Check ghost spacing      • Check carrier alignment
           • Verify frustum cone      • Spot spline hitches      • Spot horizon tilt jumps
           • Audit flight ribbon      • Verify spring damping    • Catch blank frame drops
                  │                          │                          │
                  └──────────────────────────┼──────────────────────────┘
                                             │
                                             ▼
                                [ Aesthetic Benchmarking ]
                                             │
                                             ▼
                                   bun scripts/compare.ts
                                   • Compare typographic weight & scale
                                   • Check negative space ratio (60-75%)
                                   • Verify color gamut against tokens
                                             │
                                             ▼
                                [ Final Telemetry Audit ]
                                             │
                                             ▼
                                   bun scripts/render.ts motion
                                   • Verify 0 blocking Tier A flags
                                   • Confirm safe margins & text readability
```

---

## 3. The 60 fps Kinematic Telemetry Engine

The telemetry engine downsamples frames via a fast $4 \times 4$ box filter to **$480 \times 270$** ($0.518\,\text{MB/frame}$) to compute sub-pixel motion metrics at $>120\,\text{fps}$ throughput in Bun:

- **Rec.709 Luma & Contrast:** $Y = 0.2126 R + 0.7152 G + 0.0722 B$.
- **Motion Energy $E$ & Burst $E_{p95}$:** Frame-to-frame absolute luma difference, with 95th percentile local patch tracking.
- **2D FFT Optical Flow $(u, v)$:** Phase correlation via Cooley-Tukey FFT isolating bulk camera velocity.
- **CIE $L^*a^*b^*$ Gamut Conformity ($\Delta E_{76}$):** Color distance against approved project palette tokens.
- **Edge Shimmer Index:** Second-order temporal derivative of Sobel edge pixels detecting aliasing or sub-pixel chatter.

---

## 4. The Three-Tier Review Hierarchy & Rule Catalog (`F01–F16`) [RULE]

Telemetry flags are partitioned into three distinct tiers. **Only Tier A flags can block CI export:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        THREE-TIER REVIEW HIERARCHY                          │
├─────────────────────────────────────────────────────────────────────────────┤
│   TIER A: OBJECTIVE (Zero Tolerance / Hard Failure / Blocking in CI)        │
│   • F04: Text Layout Collision (Area overlap > 2%)                          │
│   • F05: Viewport Safe Boundary Clipping (Area outside safe box > 5%)       │
│   • F10: Cut Inside Sung Vocal Word (Boundary during active lyric word)     │
│   • F13: Frame Render Time Budget (> 25 ms / frame in preview)              │
│   • F16: Unintended Screen Blackout/Whiteout (Blank run > 0.3s)             │
├─────────────────────────────────────────────────────────────────────────────┤
│   TIER B: CALIBRATED BENCHMARKS (Empirical / Advisory / Waivable)           │
│   • F01: Lyric Word Visibility (< 90% duration)                             │
│   • F02: Sung Word Visual Dominance (Height < 5% viewport)                  │
│   • F03: Word Entrance Anticipation (Appears > 0.40s before audio)          │
│   • F09: Kick Drum Kinetic Response (Energy ratio < 1.15x)                  │
│   • F11: Highlight Bloom Bloat (> 0.5% pixels bright non-signal)            │
│   • F12: Off-Palette Gamut Wash (> 3% pixels Delta E > 12)                  │
│   • F14: Adaptive Sampler Stress (Hits 324 spp cap repeatedly)              │
│   • F15: Edge Shimmer & Sampler Chatter (Shimmer index > 0.35)              │
├─────────────────────────────────────────────────────────────────────────────┤
│   TIER C: PERCEPTUAL PROXIES (Informational / "Do Not Optimize Code To")    │
│   • F06: Corner Margin Clutter (Persistence in corner > 3.0s)               │
│   • F07: Static Digit Hold (Unchanging numerical digit > 3.0s)              │
│   • F08: Motion Momentum Stall (Motion energy E < 0.001 for > 0.5s)         │
└─────────────────────────────────────────────────────────────────────────────┘
```

*Note: Rules `F01–F03`, `F09`, and `F10` apply specifically to synchronized lyric and music pieces. In abstract motion design or narrative video essays, these are inactive.*

**Non-lyric projects:** the lyric/audio rules still run and can flood the report with advisories (hundreds of `F01` findings on a scene with no lyrics). Read blocking flags first (`0 blocking` is the pass condition) and ignore lyric-word advisories. A dedicated `--nonlyricvideo` style flag is planned; until it exists, filter the report manually.

---

## 5. Content-Addressed Flag IDs & Creative Waiver Logging

Every telemetry finding is assigned a deterministic content-addressed identifier:

$$\text{ID} = \text{Rule} - \text{round}(t_0 \times 100) - \text{round}(t_1 \times 100) - \text{index}$$

*Example: `F04-800-845-001` (Text collision from $8.00\text{s}$ to $8.45\text{s}$).*

### Logging Waivers for Intentional Artistic Choices [RULE]
Tier B flags caused by intentional artistic decisions (e.g., an intentional bright supernova flash, or a dramatic freeze-frame before a reveal) must be documented in `findings.json` rather than hacking code to artificially appease the metric:

```json
{
  "waivers": {
    "F11-1400-1420-001": "Intentional supernova transition flash into Act 2",
    "F08-2200-2260-001": "Dramatic silent hold before product reveal",
    "F12-0500-0540-001": "Monochromatic infrared sensor mode styling"
  }
}
```

---

## 6. Headless Render CLI & Hardware Acceleration (`scripts/render.ts`)

Run commands through Bun and Playwright to generate test assets or production exports:

```bash
# Capture individual still frames for inspection
bun scripts/render.ts stills --project <name> --t 1.5,8.0,14.2 --out out/stills/

# Generate a 24-frame contact sheet grid across a scene or timeline
bun scripts/render.ts sheet --project <name> --from 0 --to 30 --n 24 --cols 6 --out out/sheet.png

# Run 60 fps kinematic telemetry pass
bun scripts/render.ts motion --project <name> --from 0 --to 30 --out out/telemetry/

# Full offline video export (GPU-accelerated, 8 sub-frame motion blur)
bun scripts/render.ts video --project <name> --from 0 --to 30 --fps 60 --gpu --samples 8 --out out/final.mp4
```

### 6.1 Hardware Acceleration (Windows Vulkan Mandate)
- On Windows systems, headless Chromium launched via Playwright can fall back to ANGLE SwiftShader software rendering (~5 fps and prone to WebGL context loss).
- Always ensure headless Chrome launches with `--use-angle=vulkan` to tap native GPU hardware (e.g., AMD Radeon, NVIDIA RTX) for real-time 60 fps rendering throughput.
- Verify active GPU acceleration with:
  ```bash
  bun scripts/render.ts gpu --url <port>
  ```
  Confirm output displays hardware ANGLE (Vulkan), **not** SwiftShader.

### 6.2 Port Isolation & Server Hygiene
- When running automated renders or test sheets, always bind to an explicit isolated port (`--url http://localhost:53xx`).
- Avoid defaulting to port `:5173` without checking; if another development project is running on `:5173`, Playwright will silently render the wrong project's canvas.

---

## 7. Quality Assurance Verification Checklist

Before approving any scene, transition, or video export:

- [ ] **Zero Tier A Failures:** Verify `bun scripts/render.ts motion` reports 0 unaddressed Tier A flags (`F04`, `F05`, `F10`, `F13`, `F16`).
- [ ] **Waiver Documentation:** Any remaining Tier B flags are documented with one-line justifications in `findings.json`.
- [ ] **Spatial Clearance:** Evaluated `cam_godview.png` to confirm camera path does not intersect or clip 3D objects.
- [ ] **Kinetic Easing:** Evaluated `onion_motion.png` to confirm smooth ghost spacing without erratic acceleration hitches.
- [ ] **Seam Continuity:** Evaluated `onion_seam.png` and `strip_seam.png` across transition cuts to confirm zero horizon tilt pop.
- [ ] **Contact Sheet Review:** Inspected multi-frame sheet (`sheet.png`) for visual rhythm and narrative balance.