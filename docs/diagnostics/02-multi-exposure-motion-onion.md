# Diagnostic Instrument 02: Multi-Exposure Motion Onion (`onion`)

**Status**: Implemented & Operational  
**Source Implementation**: [`app/scripts/visual/onion.ts`](../../app/scripts/visual/onion.ts)  
**CLI Command**: `bun scripts/render.ts onion` or `bun scripts/onion.ts`  
**Core Artifacts**: `onion_motion.png`, `onion_summary.json`  

---

## 1. Overview & Capability

The **Multi-Exposure Motion Onion** collapses an animation window ($0.5\text{–}1.5\,\text{s}$) into a **single composite diagnostic still**. It blends 8–16 consecutive frames using a **chromatic time-decay gradient**:

* **Past Frames ($t < t_{\text{mid}}$)**: Tinted in cool cyan/blue (`#00D2FF`) with ascending opacity ($15\% \to 60\%$).
* **Key Center Frame ($t = t_{\text{mid}}$)**: Rendered in **full natural contrast and color** ($100\%$ opacity).
* **Future Frames ($t > t_{\text{mid}}$)**: Tinted in warm amber/signal orange (`#FF7A00`) with descending opacity ($60\% \to 15\%$).

```
TEMPORAL ONION-SKIN SCHEMATIC (Single Composite Diagnostic Image)

[Past: t - 0.20s]     [t - 0.10s]     [Center: t = 0]      [t + 0.10s]     [Future: t + 0.20s]
   Faint Cyan          Cool Blue         Natural Color        Warm Amber       Saturated Orange
       ○                   ○                  ●                   ○                   ○
        \                   \                 │                  /                   /
    ┌──────────┐        ┌──────────┐    ┌──────────┐     ┌──────────┐        ┌──────────┐
    │ HERO OBJ │        │ HERO OBJ │    │ HERO OBJ │     │ HERO OBJ │        │ HERO OBJ │
    └──────────┘        └──────────┘    └──────────┘     └──────────┘        └──────────┘
       (15% α)             (45% α)         (100% α)         (45% α)             (15% α)

<--- Monotonic Spacing (Even progression = smooth C1 deceleration or fluid spring motion)    --->
<--- Clumped Ghost Echoes Followed by Wide Gaps = Spline Hitch / Tangent Discontinuity        --->
```

---

## 2. Visual Diagnostics & Motion Patterns

| Visual Pattern in `onion_motion.png` | Motion Diagnostic | Root Cause in Code | Corrective Action |
| :--- | :--- | :--- | :--- |
| **Evenly Spaced Monotonic Echoes** | Smooth continuous motion | Ideal cubic spline or constant velocity flight | Pass — intentional ease |
| **Gradually Compressing Echoes** | Clean deceleration | Proper easing curve (e.g. `1 - Math.pow(1 - p, 4)`) | Pass — intentional landing |
| **Clumped Echoes followed by Wide Gap** | Tangent discontinuity / hitch | Sudden velocity jump or piecewise keyframe snap | Blend keyframe tangents or use continuous Catmull-Rom |
| **Alternating Echo Overshoot (Ringing)** | Underdamped spring oscillation | Damping ratio $\zeta < 0.707$ ($c$ too low, $k$ too high) | Increase damping coefficient $c$ or reduce stiffness $k$ |
| **Fuzzy, Jagged Double-Edges** | High-frequency micro-tremor | Numerical noise, float rounding, or raw trig jitter | Filter time input or switch to analytical closed form |
| **Zero Cyan Echoes Before Center Frame** | Instantaneous pop / zero easing | Element appears at $t=t_{\text{mid}}$ with 0 lead-in | Add anticipation or entrance fade/ease ($0.1\text{–}0.3\,\text{s}$) |

---

## 3. CLI Options & Parameter Reference

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--t <seconds>` | float | `10.0` | Center timestamp for symmetric temporal inspection window. |
| `--window <seconds>`| float | `0.5` | Duration of time window to collapse into the composite still. |
| `--from <seconds>` | float | `t - window/2` | Explicit start timestamp (overrides `--window`). |
| `--to <seconds>` | float | `t + window/2` | Explicit end timestamp (overrides `--window`). |
| `--frames <n>` | integer | `10` | Number of exposure slices to composite (range: 4–20). |
| `--scene <id>` | string | `all` | Target scene or plate ID to inspect. |
| `--out <dir>` | directory path | `out/visual/onion` | Target output directory for PNG and JSON artifacts. |

---

## 4. Usage Examples

```bash
# Audit UI card spring-damper deceleration across a 0.5s window
bun scripts/onion.ts --scene modal_reveal --t 2.40 --frames 12 --out out/visual/modal_spring

# Trace a 1.0s hero 3D camera crane move in a commercial product reveal
bun scripts/render.ts onion --scene hero_product --from 14.00 --to 15.00 --frames 16 --out out/visual/product_crane

# Inspect kinetic title deceleration in a brand manifesto sequence
bun scripts/onion.ts --scene title_intro --t 0.85 --window 0.6 --frames 10 --out out/visual/title_ease
```

---

## 5. Machine-Readable Telemetry (`onion_summary.json`)

```json
{
  "scene": "modal_reveal",
  "center_t": 2.40,
  "window_s": 0.50,
  "frame_count": 12,
  "displacement_px": 342.1,
  "max_step_px": 54.2,
  "min_step_px": 2.1,
  "monotonic_spacing": true,
  "oscillation_detected": false,
  "frames": [
    { "index": 0, "t": 2.15, "tint": "#00d2ff", "opacity": 0.15 },
    { "index": 6, "t": 2.40, "tint": "natural", "opacity": 1.00 },
    { "index": 11, "t": 2.65, "tint": "#ff7a00", "opacity": 0.15 }
  ]
}
```
