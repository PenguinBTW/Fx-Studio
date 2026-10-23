# Proposed Visual Diagnostic Instruments (Roadmap 05–09)

This directory contains architectural specifications and design proposals for **future diagnostic instruments (05–09)** in the **f(x) Studio** suite.

The initial four instruments (**01–04**) are **already fully implemented** in [`app/scripts/visual/`](../../../app/scripts/visual/) and documented in [`docs/diagnostics/`](../../diagnostics/overview.md).

---

## 1. Implemented Instruments vs. Proposed Roadmap

| Instrument | Status | Operational Guide | Primary Role |
| :--- | :---: | :--- | :--- |
| **01. 3D God-View Blueprint** | **Implemented** | [01-godview-camera-blueprint.md](../../diagnostics/01-godview-camera-blueprint.md) | External $XZ$/$YZ$ architectural blueprints with velocity flight ribbons & viewing cones. |
| **02. Multi-Exposure Motion Onion** | **Implemented** | [02-multi-exposure-motion-onion.md](../../diagnostics/02-multi-exposure-motion-onion.md) | Chromatic temporal motion trails (cyan $\to$ natural $\to$ amber) on a single still. |
| **03. Visual A/B Reference Anchor** | **Implemented** | [03-visual-ab-reference-anchor.md](../../diagnostics/03-visual-ab-reference-anchor.md) | Side-by-side & $45^\circ$ diagonal split-wipe benchmarking against Figma & design tokens. |
| **04. Transition Seam Stitch Inspector**| **Implemented** | [04-transition-seam-stitch-inspector.md](../../diagnostics/04-transition-seam-stitch-inspector.md) | Green/magenta false-color overlay & 10-frame filmstrip across cut boundaries ($\pm 250\text{ms}$). |
| **05. Parametric Speed Graph Inspector**| **Proposed** | [05-parametric-speed-graph.md](05-parametric-speed-graph.md) | Plots value curves $y(t)$, velocity $v(t)$, and acceleration $a(t)$ to flag tangent breaks & arrival impacts. |
| **06. Visual Gaze Saliency Heatmap** | **Proposed** | [06-gaze-saliency-heatmap.md](06-gaze-saliency-heatmap.md) | Spatio-temporal saliency (contrast, color, motion) rendering thermal gaze heatmaps and ranking Top-3 anchors. |
| **07. Dynamic Contrast & Legibility** | **Proposed** | [07-dynamic-contrast-legibility.md](07-dynamic-contrast-legibility.md) | Tracks local WCAG contrast behind typography glyphs over time, flagging background washouts ($< 4.5:1$). |
| **08. Choreography Gantt & Stagger** | **Proposed** | [08-choreography-gantt-stagger.md](08-choreography-gantt-stagger.md) | Multi-track motion Gantt chart displaying entrance ease, dwell, and exit phases for all scene entities. |
| **09. Multi-Aspect Responsive Framing**| **Proposed** | [09-multi-aspect-framing.md](09-multi-aspect-framing.md) | Synchronized $2 \times 2$ contact plate auditing 16:9, 9:16 (TikTok/Reels), and 1:1 (Square) simultaneously. |

---

## 2. Directory Index

- [05. Parametric Speed Graph Inspector](05-parametric-speed-graph.md)
- [06. Visual Gaze Saliency Heatmap](06-gaze-saliency-heatmap.md)
- [07. Dynamic Contrast & Legibility Inspector](07-dynamic-contrast-legibility.md)
- [08. Choreography Gantt & Stagger Visualizer](08-choreography-gantt-stagger.md)
- [09. Multi-Aspect Responsive Framing Inspector](09-multi-aspect-framing.md)
