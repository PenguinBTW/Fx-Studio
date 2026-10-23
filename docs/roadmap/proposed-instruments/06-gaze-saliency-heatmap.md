# Instrument 06: Visual Gaze Saliency Heatmap (`saliency`)

**Status**: Proposed Architecture Specification (Roadmap)  
**Target Command**: `bun scripts/render.ts saliency` or `bun scripts/saliency.ts`  
**Planned Artifacts**: `saliency_heatmap.png`, `saliency_summary.json`  

---

## 1. Overview & Objective

The **Visual Gaze Saliency Heatmap** is an attention profiling diagnostic tool that computes human visual saliency across a scene frame or animation window.

By combining multi-scale spatial contrast, color opponency, and optical motion energy, this instrument generates a **thermal pseudo-color attention heatmap** overlaid directly on the rendered plate, ranking the Top-3 focal anchors and measuring what percentage of viewer attention is captured by the intended hero element.

---

## 2. The Problem It Solves

When authoring procedural 3D motion graphics:
1. **Perceptual Attention Hijacking**: An autonomous agent might add decorative background particles or pulsating wireframe grids. If those background elements move too fast or shine too brightly, they hijack viewer gaze away from the product hero shot or headline.
2. **Visual Clutter & Cognitive Overload**: Dense scenes with multiple simultaneous animations create focal confusion where the eye darting frantically without a clear anchor.
3. **Typography Lost in Noise**: Subtle titles placed against busy 3D geometry fail to attract focal dwell time.

---

## 3. Mathematical Foundations: Spatio-Temporal Saliency

The instrument implements a modernized neuromorphic saliency model (adapted from Itti-Koch) optimized for 60 fps motion graphics:

### 1. Spatial Feature Pyramids:
- **Luminance Contrast**: Multi-scale center-surround differences on Rec.709 luma.
- **Color Opponency**: Red-Green ($R - G$) and Blue-Yellow ($B - (R+G)/2$) chrominance contrast.
- **Orientation Energy**: Gabor filter responses at $0^\circ, 45^\circ, 90^\circ, 135^\circ$.

### 2. Temporal Motion Energy ($S_{\text{motion}}$):
- Frame-to-frame pixel velocity vectors $|(u, v)|$ weighted by flicker frequency.

### 3. Master Saliency Map:
$$\mathcal{S}(x, y) = w_L \mathcal{S}_{\text{luma}} + w_C \mathcal{S}_{\text{color}} + w_O \mathcal{S}_{\text{orient}} + w_M \mathcal{S}_{\text{motion}}$$

---

## 4. Visual Specifications (`saliency_heatmap.png`)

```
GAZE SALIENCY HEATMAP SCHEMATIC (Thermal Pseudo-Color Overlay)
┌─────────────────────────────────────────────────────────────┐
│  [Deep Blue: 0-15% Saliency]                                │
│                                                             │
│                   ┌───────────────────────┐                 │
│                   │   [HERO PRODUCT TITLE]│                 │
│                   │   ● Rank 1 (Crimson)  │                 │
│                   │     74.2% Gaze Share  │                 │
│                   └───────────────────────┘                 │
│                                                             │
│            ▲                                                │
│           ╱ ╲  Rank 2 (Yellow)                              │
│          ╱   ╲ 18.1% Gaze Share                             │
│         ─────── (Hero 3D Chassis)                           │
│                                                             │
│   [Deep Blue: Quiet Negative Space]                         │
└─────────────────────────────────────────────────────────────┘
```

- **Thermal Color Scale**:
  - **Deep Blue / Slate**: Zero to low visual attention ($0\%\text{–}15\%$) — ideal negative space.
  - **Cyan / Green**: Moderate secondary attention ($15\%\text{–}40\%$).
  - **Yellow / Orange**: High primary focus ($40\%\text{–}70\%$).
  - **Bright Crimson / Magenta**: Peak visual attractor ($> 70\%$).
- **Top-3 Anchor Overlays**: Bounding rings and crosshairs marking the primary gaze centers.

---

## 5. Technical CLI Interface

```bash
bun scripts/saliency.ts --scene <scene-id> --t <timestamp> \
  [--hero-box 400,200,1520,300] [--out <out-dir>]
```

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--scene <id>` | string | Required | Target scene to inspect. |
| `--t <seconds>` | float | `10.0` | Timestamp to evaluate. |
| `--hero-box <coords>`| string | None | Optional $[x_1, y_1, x_2, y_2]$ bounding box of intended hero element. |
| `--out <dir>` | path | `out/visual/saliency`| Output directory for heatmap and summary JSON. |

---

## 6. Machine-Readable Telemetry Schema (`saliency_summary.json`)

```json
{
  "scene": "product_hero_reveal",
  "t": 10.50,
  "hero_gaze_share_pct": 74.2,
  "attention_hijack_detected": false,
  "competing_noise_pct": 7.7,
  "anchors": [
    {
      "rank": 1,
      "center": [960, 250],
      "share_pct": 74.2,
      "role": "hero_title",
      "saliency_type": "luma_contrast_and_motion"
    },
    {
      "rank": 2,
      "center": [960, 680],
      "share_pct": 18.1,
      "role": "chassis_mesh",
      "saliency_type": "specular_highlight"
    }
  ]
}
```
