# Telemetry Calibration & Sanity Checking Guide

This guide establishes the methodology for calibrating diagnostic telemetry thresholds against production reference sequences, resolving false-positive detections, and verifying engine sanity.

---

## 1. The Sanity Check Policy

> [!IMPORTANT]
> **The Zero-Blocking Baseline Invariant**:
> A telemetry ruleset is only considered valid if **properly authored, director-approved reference benchmark plates produce exactly ZERO blocking flags**.
> 
> If an approved reference sequence fails a blocking rule, the rule is defective or miscalibrated—not the art.

### Historical Sanity Verification Baseline
During initial engine stabilization, the ruleset was validated against master benchmark sequences:

| Plate / Sequence | Time Window | Blocking Flags | Advisory Flags | Info Flags | Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Approved Reference Benchmark** | `22.51–24.33s` | **0** | 11 | 0 | **PASSED** (Clean baseline) |
| **Active Scene Test Plate** | `8.00–18.50s` | **0** | 22 | 0 | **PASSED** (Zero blocking defects) |

---

## 2. False-Positive Investigations & Mathematical Solutions

During initial engine calibration, two Tier A objective rules (`F05` Text Clipping and `F04` Text Collision) initially triggered false-positive blocking flags. Below is the diagnostic analysis and formal resolution for each.

### 2.1 Rule F05: Viewport & Safe Boundary Clipping
- **Initial Finding**: Triggered 561 false-positive blocking flags across `8.00–18.50s` on 3D corridor scenes.
- **Root Cause**:
  1. The text analyzer initially computed `max_clip_pct` across the element's entire temporal existence. Consequently, kinetic titles floating off the top edge of the screen during exit animations (`minY: -149px`) were flagged as layout bugs.
  2. 3D geometry labels exiting the camera frustum as the camera dollied forward through the 3D world were flagged as clipping.
- **Metric Limit**: Frustum transit is an essential property of 3D camera flight, not a 2D typography defect.
- **Resolution**:
  - Scoped clipping evaluations strictly to the active reading comprehension window (`tw.start` to `tw.end`).
  - Excluded dynamic 3D world elements ($v \ge 50\,\text{px/s}$) and offscreen transit animations from layout clipping.
  - Implemented in `app/scripts/motion/text-analyzer.ts`.

### 2.2 Rule F04: Text Collisions & 3D Depth Parallax
- **Initial Finding**: Triggered 105 false-positive blocking flags across `8.00–18.50s`.
- **Root Cause**:
  - Canvas2D text interception captures 2D bounding boxes $[x_{\min}, y_{\min}, x_{\max}, y_{\max}]$ in screen space without a 3D Z-buffer.
  - In 3D scenes, foreground 2D typography floats in front of distant 3D geometry labels. As the camera moved down the corridor, distant background labels passed behind the foreground headline.
  - Because the smaller box had a tiny area ($\sim 1.4\,\text{px}$ height), the 2D screen intersection registered as $40\%\text{--}100\%$ overlap.
- **Metric Limit**: 2D screen-space overlap between objects at radically different 3D depth planes is natural perspective parallax, not a layout collision.
- **Resolution**:
  - Excluded micro-geometry text ($h < 0.4\%$ frame height, or $< 4.3\,\text{px}$) from 2D collision detection.
  - Excluded pairs with extreme scale disparity ($\ge 2.5\times$ font height ratio).
  - Preserved strict blocking flags for genuine same-layer typographic collisions (two titles colliding, overlapping paragraph lines, or overlapping HUD badges).
  - Implemented in `app/scripts/motion/text-analyzer.ts`.

### 2.3 Rule F13: Frame Render Time (> 25 ms)
- **Initial Finding**: Triggered 19 advisory warnings on complex plates.
- **Root Cause**: Headless Chrome canvas readback overhead in Playwright (`page.screenshot` / `evaluate`) occasionally spikes per-frame turnaround time to $27\text{--}55\,\text{ms}$ on CPU readback.
- **Resolution**: Tagged strictly as **Advisory**. The review gate never blocks builds on harness readback overhead.

---

## 3. Reference Calibration Data Schema (`calibration/example.json`)

To prevent arbitrary thresholds, Tier B rules are calibrated against empirical distribution percentiles ($p_{10}, p_{50}, p_{90}, \max$) harvested from approved benchmark runs:

```json
{
  "project": "approved_benchmark",
  "fps": 60,
  "metrics": {
    "bone_bloom_bright_nonsignal": {
      "min": 0.00,
      "p10": 0.01,
      "p50": 0.42,
      "p90": 8.34,
      "max": 73.25,
      "n": 1800
    },
    "palette_off_share": {
      "min": 0.00,
      "p10": 2.91,
      "p50": 14.20,
      "p90": 41.53,
      "max": 50.02,
      "n": 1800
    },
    "edge_shimmer_flicker": {
      "min": 0.012,
      "p10": 0.101,
      "p50": 0.165,
      "p90": 0.230,
      "max": 0.352,
      "n": 1800
    }
  }
}
```

---

## 4. How to Calibrate a New Scene Genre

When creating a new visual aesthetic (e.g. high-key UI showcase, dense particle cloud, or dark neon noir), follow this protocol:

1. **Render Reference Sequence**:
   Author and art-direct a short ($5\text{–}10\,\text{s}$) representative benchmark plate until approved by the creative director.
2. **Harvest Baseline Metrics**:
   ```bash
   bun scripts/render.ts motion --only hero_plate --from 0.0 --to 8.0 --out out/calibration/baseline
   ```
3. **Generate Calibration JSON**:
   Copy `out/calibration/baseline/summary.json` to `app/scripts/motion/calibration/<genre>.json`.
4. **Run Sanity Check**:
   Re-run telemetry pointing `--compare app/scripts/motion/calibration/<genre>.json`.
   Verify that **0 blocking flags** and $< 5$ advisory warnings are produced.
