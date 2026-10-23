# Instrument 09: Multi-Aspect Responsive Framing Inspector (`framing`)

**Status**: Proposed Architecture Specification (Roadmap)  
**Target Command**: `bun scripts/render.ts framing` or `bun scripts/framing.ts`  
**Planned Artifacts**: `framing_multiaspect.png`, `framing_summary.json`  

---

## 1. Overview & Objective

The **Multi-Aspect Responsive Framing Inspector** audits multi-platform visual framing and safe-zone compliance simultaneously across different aspect ratios.

Commercial motion design and marketing assets must deploy across multiple formats: **16:9 Landscape** (YouTube / Web / Broadcast), **9:16 Vertical** (TikTok / Instagram Reels / YouTube Shorts), and **1:1 Square / 4:5 Portrait** (Instagram Feeds / LinkedIn). This instrument renders a synchronized $2 \times 2$ diagnostic plate evaluating all target aspects at the exact same timeline instant, testing for cropped typography, dead center voids, and UI occlusion.

---

## 2. The Problem It Solves

1. **Severe Typography Truncation in 9:16**: A wide 16:9 headline spanning $1600\,\text{px}$ is sheared off on both sides when center-cropped to vertical 9:16.
2. **Platform UI Occlusion**: On TikTok and Reels, the right-hand action column (like, comment, bookmark, share buttons) and bottom caption margin occupy $25\%$ of the screen. Critical graphic callouts placed in these regions are obscured.
3. **Dead Space Voids in Landscape**: Graphics optimized solely for vertical screens leave enormous empty black voids on 16:9 monitors.

---

## 3. Visual Specifications (`framing_multiaspect.png`)

```
MULTI-ASPECT $2 \times 2$ COMPOSITE PLATE (framing_multiaspect.png)
┌───────────────────────────────┬───────────────────────────────┐
│ PANEL 1: 16:9 LANDSCAPE       │ PANEL 2: 9:16 VERTICAL (REELS)│
│ [ 1920 x 1080 Full Master ]   │ [ 1080 x 1920 Mobile Crop ]   │
│                               │   ┌─────────────┐             │
│   ┌───────────────────────┐   │   │ HERO CHASSIS│  [Like]     │
│   │   [HERO TITLE]        │   │   │ (Center-Fit)│  [Comment]  │
│   └───────────────────────┘   │   └─────────────┘  [Share]    │
│                               │   [CRIMSON: TEXT TRUNCATED]   │
├───────────────────────────────┼───────────────────────────────┤
│ PANEL 3: 1:1 SQUARE (FEED)    │ PANEL 4: 4:5 PORTRAIT (SOCIAL)│
│ [ 1080 x 1080 Square ]        │ [ 1080 x 1350 Portrait ]      │
│                               │                               │
│   Balanced Composition        │   Title & Action Safe         │
│   (Pass)                      │   (Pass)                      │
└───────────────────────────────┴───────────────────────────────┘
```

- **Semi-Transparent Platform Overlays**: Displays native TikTok and Instagram UI chrome (avatar, buttons, music ticker) over Panel 2 to audit occlusion.
- **Red Safe-Zone Violation Boxes**: Outlines any text element or hero focal point that violates platform safe margins.

---

## 4. Technical CLI Interface

```bash
bun scripts/framing.ts --scene <scene-id> --t <timestamp> \
  [--aspects 16:9,9:16,1:1,4:5] [--out <out-dir>]
```

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--scene <id>` | string | Required | Target scene to inspect. |
| `--t <seconds>` | float | `10.0` | Timestamp to evaluate. |
| `--aspects <list>` | comma-separated | `16:9,9:16,1:1,4:5`| Target aspect ratios to evaluate. |
| `--out <dir>` | path | `out/visual/framing`| Output directory. |

---

## 5. Machine-Readable Telemetry Schema (`framing_summary.json`)

```json
{
  "scene": "product_hero_reveal",
  "t": 10.50,
  "formats": {
    "16:9": { "status": "pass", "safe_zone_violations": [] },
    "9:16": {
      "status": "fail",
      "safe_zone_violations": [
        {
          "element": "HERO TITLE",
          "clipped_chars": "HERO T... [12 chars truncated]",
          "crop_loss_pct": 38.4,
          "occluded_by_platform_ui": false
        }
      ]
    },
    "1:1": { "status": "pass", "safe_zone_violations": [] }
  },
  "recommended_action": "Enable responsive layout pin or stack title vertically when aspect ratio is 9:16."
}
```
