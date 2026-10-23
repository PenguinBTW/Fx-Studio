# Diagnostic Instrument 03: Visual A/B Reference Anchor (`compare`)

**Status**: Implemented & Operational  
**Source Implementation**: [`app/scripts/visual/compare.ts`](../../app/scripts/visual/compare.ts)  
**CLI Command**: `bun scripts/render.ts compare` or `bun scripts/compare.ts`  
**Core Artifacts**: `ab_split_wipe.png`, `ab_side_by_side.png`, `ab_comparison.json`  

---

## 1. Overview & Capability

The **Visual A/B Reference Anchor** benchmarks an active procedural scene directly against an authoritative reference plate—such as an exported Figma mockup, client brand guideline benchmark, or master reference sequence—at identical 1080p resolution.

If the reference server is not running, `compare.ts` automatically spawns a private ephemeral Vite instance on port `5189`, captures the exact reference plate at `--ref-t`, and synthesizes two composite diagnostic artifacts:
1. **Side-by-Side Plate (`ab_side_by_side.png`)**: Two 16:9 panels placed side-by-side with cyan (`[ACTIVE SCENE]`) and signal orange (`[REFERENCE BENCHMARK]`) borders and parameter annotations.
2. **50/50 Diagonal Split Wipe (`ab_split_wipe.png`)**: A $45^\circ$ diagonal hairline cut across the frame. Top-left displays the active scene; bottom-right displays the reference benchmark.

```
DIAGONAL 50/50 SPLIT WIPE SCHEMATIC (ab_split_wipe.png)
┌─────────────────────────────────────────────────────────────┐
│ ▲ ACTIVE SCENE (Top-Left)               \                   │
│   Title Height: 68px                     \                  │
│   Stroke Weight: 2.5px                    \                 │
│   Negative Space: 42%                      \  45° Hairline  │
│                                             \   Split Cut   │
│                                              \              │
│                                               \             │
│                 ▼ REFERENCE BENCHMARK          \            │
│                   Title Height: 36px            \           │
│                   Stroke Weight: 1.0px           \          │
│                   Negative Space: 72%             \         │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Universal Design Applications

1. **Brand Identity & Design Token Calibration**:
   - Validates that rendered typography cap heights, letter spacing, and line weights strictly match design token specifications.
   - Highlights accidental font scaling, blown-out glows, or bloated stroke thicknesses.
2. **Figma Artboard Parity Audits**:
   - Benchmarks active procedural WebGL scenes against exported high-fidelity Figma keyframe artboards.
   - Instantly exposes composition drifting, improper vertical alignment, or incorrect color grading.
3. **Commercial Aesthetic Restraint Verification**:
   - Ensures procedural motion retains premium negative space (e.g. $60\%\text{–}75\%$ breathing room) rather than over-filling the viewport with cluttered decorative lines.
4. **Color Palette & Exposure Alignment**:
   - The diagonal split wipe directly juxtaposes background tones and lighting across the $45^\circ$ boundary. Any disparity in black point, white point, or saturation stands out clearly.

---

## 3. CLI Options & Parameter Reference

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--scene <id>` | string | Active project scene | Name of scene in the active project. |
| `--t <seconds>` | float | `10.0` | Timestamp in current scene. |
| `--ref <id>` | string | `benchmark` | Reference scene plate or benchmark asset name. |
| `--ref-t <seconds>` | float | Matching `--t` | Matching timestamp in reference benchmark. |
| `--port <n>` | integer | `5189` | Port for ephemeral reference server instance. |
| `--out <dir>` | directory path | `out/visual/compare` | Output directory for contact plates. |

---

## 4. Usage Examples

```bash
# Compare active UI showcase frame against design benchmark
bun scripts/compare.ts --scene dashboard_hud --t 5.20 --ref figma_keyframe --ref-t 5.20 --out out/visual/hud_vs_figma

# Benchmark active 3D commercial typography against master design tokens
bun scripts/render.ts compare --scene brand_reveal --t 3.50 --ref style_guide --ref-t 1.00 --out out/visual/brand_alignment

# Compare lighting and negative space against approved reference scene
bun scripts/compare.ts --scene feature_callout --t 12.0 --ref master_template --ref-t 12.0
```

---

## 5. Quantitative Telemetry Schema (`ab_comparison.json`)

```json
{
  "active_scene": "brand_reveal",
  "active_t": 3.50,
  "reference_scene": "style_guide",
  "reference_t": 1.00,
  "delta_e_76_mean": 4.12,
  "luma_disparity_pct": 3.4,
  "edge_density_active": 0.048,
  "edge_density_ref": 0.042,
  "negative_space_pct_active": 68.4,
  "negative_space_pct_ref": 71.2,
  "artifacts": {
    "split_wipe": "ab_split_wipe.png",
    "side_by_side": "ab_side_by_side.png"
  }
}
```
