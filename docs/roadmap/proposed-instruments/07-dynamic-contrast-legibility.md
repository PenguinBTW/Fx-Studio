# Instrument 07: Dynamic Contrast & Legibility Inspector (`legibility`)

**Status**: Proposed Architecture Specification (Roadmap)  
**Target Command**: `bun scripts/render.ts legibility` or `bun scripts/legibility.ts`  
**Planned Artifacts**: `legibility_washout.png`, `legibility_summary.json`  

---

## 1. Overview & Objective

The **Dynamic Contrast & Legibility Inspector** tracks real-time typographical legibility and background contrast across the temporal lifespan of text elements in procedural motion graphics.

While static design checks test contrast at a single point in time, 3D motion design is dynamic: camera travel, specular lighting passes, and moving background geometry can temporarily wash out text, plunging contrast below legibility thresholds. This instrument samples the background pixels directly beneath typographic bounding boxes over time to flag temporary contrast dropouts.

---

## 2. The Problem It Solves

1. **Transient Washouts During Camera Transit**: A white headline may have pristine contrast against a dark background at rest, but as a shiny 3D chassis sweeps behind it, a specular highlight can wash out 4 characters for $300\,\text{ms}$.
2. **Post-Processing Glow Bleed**: Heavy optical bloom or halation can bleed light over dark letterforms, muddying counter spaces and reducing legibility.
3. **Flawed Halo Weighting**: Underestimating the knockout understroke halo weight ($< 4\,\text{px}$) allows complex wireframe geometry to slice through letter stems.

---

## 3. Mathematical Formulation

The inspector computes relative luminance according to WCAG 2.1:
$$L = 0.2126 R_{\text{linear}} + 0.7152 G_{\text{linear}} + 0.0722 B_{\text{linear}}$$

The contrast ratio $C$ between text glyph color $L_{\text{text}}$ and the local background patch $L_{\text{bg}}$ is evaluated per pixel:
$$C = \frac{\max(L_{\text{text}}, L_{\text{bg}}) + 0.05}{\min(L_{\text{text}}, L_{\text{bg}}) + 0.05}$$

### Evaluation Thresholds:
- **WCAG AAA Compliance**: $C \ge 7.0 : 1$ (Optimal)
- **WCAG AA Compliance**: $C \ge 4.5 : 1$ (Pass)
- **Marginal Legibility**: $3.0 : 1 \le C < 4.5 : 1$ (Advisory Warning)
- **Severe Washout**: $C < 3.0 : 1$ (Defect Flag)

---

## 4. Visual Specifications (`legibility_washout.png`)

```
DYNAMIC CONTRAST WASHOUT SCHEMATIC (legibility_washout.png)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│         [  N  E  X  T  -  G  E  N     C  O  M  P  O  S  I  T  O  R  ]
│            │  │  │  │  │  │  │  │     │  │  │  │  │  │  │  │  │  │  │
│            ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼     ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼
│           12:1  11:1  9:1   8:1       2.1:1 (WASHOUT!)   10:1  12:1
│                                       ┌─────────────┐
│                                       │ █ CRACKED!  │
│                                       │ (Specular)  │
│                                       └─────────────┘
│                                                             │
│  [Crimson Box: Highlight reflections drop contrast to 2.1:1]│
└─────────────────────────────────────────────────────────────┘
```

- **Per-Glyph Bounding Annotation**: Every character is boxed in green ($C \ge 4.5:1$) or crimson ($C < 4.5:1$).
- **Contrast Timeseries Strip**: A timeline strip beneath the image tracking the minimum contrast curve over the element's duration.

---

## 5. Technical CLI Interface

```bash
bun scripts/legibility.ts --scene <scene-id> --from <start-s> --to <end-s> \
  [--min-contrast 4.5] [--out <out-dir>]
```

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--scene <id>` | string | Required | Target scene to inspect. |
| `--from <seconds>` | float | `0.0` | Start of inspection window. |
| `--to <seconds>` | float | Scene end | End of inspection window. |
| `--min-contrast <c>`| float | `4.5` | Minimum acceptable contrast ratio. |
| `--out <dir>` | path | `out/visual/legibility`| Output directory. |

---

## 6. Machine-Readable Telemetry Schema (`legibility_summary.json`)

```json
{
  "scene": "product_hero_reveal",
  "evaluated_runs": 3,
  "washout_detected": true,
  "worst_contrast_ratio": 2.14,
  "defects": [
    {
      "text": "NEXT-GEN COMPOSITOR",
      "t0": 4.20,
      "t1": 4.45,
      "duration_s": 0.25,
      "min_contrast": 2.14,
      "compromised_glyphs": ["C", "O", "M"],
      "root_cause": "specular_reflection_on_chassis",
      "remediation": "Increase knockout halo strokeWidth to 8.0px or adjust chassis highlight angle."
    }
  ]
}
```
