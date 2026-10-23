# Kinetic Typography & Lyric Synchronization

This guide covers the typographic systems in **f(x) Studio**, detailing how to build expressive, legible, and mathematically synchronized typography.

---

## 1. The Kinetic Typography Architecture

f(x) Studio provides three primary mechanisms for rendering text:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TYPOGRAPHIC RENDERING MODES                            │
├──────────────────────────────────┬──────────────────────────────────────────┤
│ 1. Canvas2D KineticText / Rig    │ • High-density layout, sub-pixel kerning │
│    (`app/src/engine/text.ts`)    │ • Automatic telemetry interception (P1)  │
│                                  │ • High-contrast knockout understroke     │
├──────────────────────────────────┼──────────────────────────────────────────┤
│ 2. Single-Stroke Hershey Vectors │ • Laser drafting & CAD blueprint plotter │
│    (`app/src/engine/stroke.ts`)  │ • Infinite resolution without bitmap blur│
│                                  │ • Direct LineBatch GPU integration       │
├──────────────────────────────────┼──────────────────────────────────────────┤
│ 3. 3D World Spatial Typography   │ • 3D perspective orientation             │
│    (`TransformNode` + Billboard) │ • SceneGraph automatic screen projection │
│                                  │ • Depth occlusions & motion blur         │
└──────────────────────────────────┴──────────────────────────────────────────┘
```

---

## 2. The Knockout Understroke Halo

When rendering typography over dynamic 3D visuals, high-contrast backgrounds, or particle clouds, standard drop shadows frequently fail to maintain legibility.

f(x) Studio enforces a **knockout understroke halo** pattern:

```
┌────────────────────────────────────────────────────────────────┐
│             KNOCKOUT UNDERSTROKE HALO SCHEMATIC                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   Layer 1 (Backdrop):   3D dynamic scene geometry              │
│                                ▲                               │
│                                │                               │
│   Layer 2 (Halo Under): Thick stroke in background color       │
│                         (e.g., rgba(10, 10, 11, 0.95), 8px)    │
│                         Clears a legible silhouette buffer.    │
│                                ▲                               │
│                                │                               │
│   Layer 3 (Foreground): Crisp typographic glyph in signal      │
│                         or bone (e.g., #EEE9DF, fill)          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Implementing Knockout Halos
```typescript
import { KineticText } from '../../engine/text';

// 1. Instantiate KineticText with content and style
const title = new KineticText('KINETIC MOTION ENGINE', {
  fontFamily: 'Inter, sans-serif',
  fontSize: 48,
  fontWeight: 700,
  color: '#EEE9DF',
});

// 2. Set knockout understroke halo (stroke width in px, halo color)
title.setHalo(8.0, 'rgba(3, 7, 18, 0.95)');

// 3. Render onto Canvas2D context
title.render(ctx, f.t, 960, 540);
```

---

## 3. Synchronized Lyric Engine (`LyricRig`)

For musical productions, the `LyricRig` orchestrates word-level synchronization using timestamp metadata from `lyrics.json`.

### Features of `LyricRig`
1. **Dynamic Word Highlighting**: Active sung words dynamically transition from muted bone (`#94A3B8`) to saturated signal orange (`#FF4D12`) or white (`#FFFFFF`).
2. **Staggered Vertical Offsets**: During fast vocal sections (lines $< 1.5\,\text{s}$ duration), `LyricRig` alternates between even and odd $Y$-coordinates ($y = y_0 \pm 48\,\text{px}$) to prevent overlapping lines (`F04` collisions).
3. **Smooth Lead-In Anticipation**: Words fade in $0.2\text{–}0.35\,\text{s}$ prior to their vocal onset, satisfying rule `F03`.

### Self-Contained Lyric Synchronization Pattern
```typescript
// Inside scene render(f, out):
const line = ctx.lyrics.getLineAt(f.t);
if (line) {
  // Stagger alternating lines to prevent F04 collision during rapid phrasing
  const isOdd = Math.floor(line.start) % 2 === 1;
  const yOffset = isOdd ? -32 : 32;

  ctx.renderText(line.text, {
    x: 960,
    y: 880 + yOffset,
    align: 'center',
    fontSize: 44,
    color: '#FFFFFF',
    halo: true, // Knockout halo prevents contrast washouts
    alpha: overlayTextDuck(f.tin, f.tout),
  });
}
```

---

## 4. Single-Stroke Hershey Vector Typography (`stroke.ts`)

For technical drafting, brutalist CAD blueprints, oscilloscope readouts, or holographic HUD interfaces, bitmap fonts look blurry under close inspection.

The **Hershey Vector Engine** renders characters as collections of pure geometric lines:
- **Zero Raster Blur**: Crisp at $10\times$ macro zoom.
- **Direct GPU Batching**: Rendered through `LineBatch`, avoiding CPU Canvas2D rasterization.
- **Stroke Animations**: Supports procedural stroke write-on effects via progress parameter $p \in [0, 1]$.

```typescript
import { HersheyFont } from '../../engine/stroke';

// Draw technical registration label
HersheyFont.drawText(lineBatch, 'SYS.CLK // 129.20 BPM', {
  x: 48,
  y: 64,
  size: 14,
  color: [0.93, 0.91, 0.87, 0.75], // Bone
  writeOnProgress: Math.min(1.0, f.lt / 1.2),
});
```

---

## 5. Typographic Design Rules & Telemetry Gates

To pass automated telemetry verification (`bun scripts/render.ts motion`), kinetic typography must adhere to these quantitative rules:

| Rule ID | Metric | Threshold | Design Guideline |
| :--- | :--- | :--- | :--- |
| **`F02`** | Sung Word Cap Height | $\ge 5\%$ of viewport height | Main titles must be at least $54\,\text{px}$ high at 1080p. |
| **`F04`** | Text Collision | Overlap $< 2\%$ | Never stack two active lines on identical $Y$-coordinates. |
| **`F05`** | Viewport Clipping | $< 5\%$ outside frame | Keep titles within title-safe margins ($64\,\text{px}$ horizontal, $48\,\text{px}$ vertical). |
| **`F06`** | Corner Persistence | $< 3.0\,\text{s}$ unchanged | Animate or refresh corner HUD indicators. |
| **`F10`** | Hard Cut in Word | Strictly $0$ cuts inside words | Align scene transition cuts to vocal pauses between lyric lines. |
