---
name: fx-kinetic-typography
description: Kinetic typography authoring standards, word-stagger reveals, numeric rolling counters, variable font weight/tracking animation, single-stroke Hershey vector plotter fonts, and knockout understroke halos in f(x) Studio.
---
# f(x) Studio: Universal Kinetic Typography & Vector Lettering

Technical standards, kinetic choreographies, vector plotter systems, and legibility protocols for authoring **on-screen typography, speech-timed kinetic manifestos, technical annotations, and numeric counters** in **f(x) Studio**.

## When to Use

- Authoring kinetic typography sequences, title cards, or word-by-word speech subtitle tracks.
- Animating words with physical mass (scale slams, weight/width pressure, tracking overshoots).
- Implementing technical annotations, engineering blueprints, or schematic labels via single-stroke vector plotter fonts ([`stroke.ts`](file:///c:/Users/brosf/Documents/A%20vio%20projects/VioPls/Agentic%20motion%20design%20toolset/app/src/engine/stroke.ts)).
- Creating smooth, deterministic numeric rolling counters and telemetry metric readouts.
- Enforcing contrast knockout understroke halos to prevent text collisions (Rule `F04`) and safe boundary violations (Rule `F05`).

---

## 1. Upstream & Sibling Dependencies

- **`video-design`**: Enforces zero detached 2D text, diegetic spatial integration, and safe-zone margins.
- **`viopls-art-direction`**: Mandates bold, structural grotesque/monospace typography and bans thin wispy fonts.
- **`design-around-narration`**: Synchronizes word arrivals to vocal delivery and rhetorical emphasis.
- **`shorts-retention-design`**: Enforces 1–3 word mobile chunking in vertical 9:16 formats.
- **`fx-diagnostics`**: Audits contrast legibility (`F04`), word entrance anticipation (`F03`), and font loading gates.

---

## 2. The Three Typography Modalities in `f(x) Studio`

Select the typography modality that matches the project's aesthetic intent:

```
                          [ TYPOGRAPHY MODALITIES ]
                                     │
      ┌──────────────────────────────┼──────────────────────────────┐
      ▼                              ▼                              ▼
[ MODALITY A: Canvas2D ]     [ MODALITY B: Hershey ]     [ MODALITY C: planeAffine ]
High-Impact Editorial        Vector Plotter Blueprint    3D Surface-Mounted
• Knockout understroke halos • GPU LineBatch hairlines   • Skewed onto 3D planes
• Scale slams & font weights • Zero font files needed    • Parallax & depth-of-field
• 1–3 word speech chunking   • Technical / Engineering   • Diegetic world integration
```

### Modality A: High-Impact Canvas2D with Knockout Halos
Used for bold manifesto titles, central narrative keywords, and speech captions rendered to `ctx.layer2d`:
- Built via standard HTML5 Canvas2D text rendering in [`text.ts`](file:///c:/Users/brosf/Documents/A%20vio%20projects/VioPls/Agentic%20motion%20design%20toolset/app/src/engine/text.ts).
- Automatically gates on `await document.fonts.ready` to eliminate Flash-Of-Unstyled-Text (FOUT).
- Automatically publishes bounding boxes to `window.__motion.textProbes` for telemetry validation.

### Modality B: Hershey Vector Plotter Typography (`stroke.ts`)
Used for CAD schematics, industrial blueprints, and engineering annotations:
- Renders text purely as 3D/2D line segments via `LineBatch`, requiring **zero external font files**.
- Based on the Hershey vector plotter dataset: clean, uniform, anti-aliased single-stroke geometry.
- Lines seamlessly receive HDR bloom and optical halation alongside structural wireframes.

### Modality C: 3D Surface-Mounted Typography (`planeAffine`)
Used for text that exists diegetically in the 3D scene (etched into metal plates, printed on walls):
- Computes affine 2D transform matrices from 3D camera pinhole geometry ([`util.ts`](file:///c:/Users/brosf/Documents/A%20vio%20projects/VioPls/Agentic%20motion%20design%20toolset/app/src/engine/util.ts)).
- Text scales and rotates in physical metres, perfectly tracking camera orbits without polygonal 3D meshes.

---

## 3. Kinetic Polish Mechanics for Words

### 3.1 Physical Mass: The Word Slam
**Prohibited:** Opacity-only fades (`opacity: 0 -> 1`), which look cheap and synthetic.  
**Mandatory:** Treat typography as a solid physical mass that slams into place with spring overshoot:

```typescript
import { springStep } from '../../engine/motion';

// Physical Slam Overshoot: Scale drops from 1.35x to 1.0x with damped spring settle
export function getWordSlamTransform(t: number, hitTime: number): { scale: number; yOffset: number } {
  const dt = t - hitTime;
  if (dt < 0) return { scale: 0, yOffset: -30 };

  // Damped spring: mass 1.0, stiffness 280, damping 18
  const settle = springStep(dt, 16.7, 0.75); 
  const scale = 1.35 - 0.35 * settle;
  const yOffset = -25 * (1.0 - settle);

  return { scale, yOffset };
}
```

### 3.2 Typographic Pressure (Weight & Tracking Modulation)
Simulate mechanical pressure or tension by modulating font weight and tracking on emphasis words:

```typescript
// Tighten tracking and increase weight under narrative tension
const tension = Math.min(1.0, f.lt / 3.0);
const fontWeight = Math.round(400 + 500 * tension); // 400 (Regular) -> 900 (Black)
const letterSpacing = -0.04 * tension;              // Negative tracking crunch

ctx2d.font = `${fontWeight} 72px "Inter", sans-serif`;
ctx2d.letterSpacing = `${letterSpacing}em`;
```

### 3.3 Word Staggers with Active Highlighting
For kinetic sentences, calculate sequential word progress with active word highlighting:

```typescript
const words = ['SYSTEM', 'EXCLUSION', 'IS', 'INTENTIONAL'];
const staggerInterval = 0.22; // Seconds per word

words.forEach((word, idx) => {
  const wordStart = idx * staggerInterval;
  const dt = f.lt - wordStart;
  if (dt < 0) return;

  const isActive = dt >= 0 && dt < staggerInterval;
  const color = isActive ? '#FF2A1F' : '#E8E4DA'; // --signal on active, --bone on rest
  const scale = isActive ? 1.08 : 1.0;

  // Render staggered word block
  renderWord(word, xPos[idx], yPos, scale, color);
});
```

---

## 4. Single-Stroke Hershey Vector Lettering (`stroke.ts`)

When authoring engineering drawings or HUD coordinates, use Hershey single-stroke fonts:

```typescript
import { HersheyFont } from '../../engine/stroke';
import { LineBatch } from '../../engine/lines';

export function renderSchematicLabels(lines: LineBatch, cam: any): void {
  const font = new HersheyFont();
  
  // Render technical coordinate stamp
  // renderText(text, x, y, scaleM, color, lines)
  font.render(
    'VALVE_PRESSURE: 420.8 kPa',
    lines,
    [2.4, 1.2, 0.0],  // 3D World Anchor
    0.045,            // Scale in metres
    [0.42, 0.41, 0.40, 0.9] // --ash
  );
}
```

- **LineBatch Integration:** Because Hershey glyphs are rendered into `LineBatch`, they draw in the exact same single draw call as structural wireframes, eliminating CPU-to-GPU texture uploads entirely.

---

## 5. Deterministic Numeric Rolling Counters

For numbers that climb, tally, or decrement (e.g., population counters, percentages, milliseconds), avoid naive text replaces that cause jitter. Use fixed-width rolling digit barrels:

```typescript
export function renderRollingCounter(
  ctx: CanvasRenderingContext2D,
  currentValue: number,
  x: number,
  y: number,
  digitHeight = 48
): void {
  const str = Math.floor(currentValue).toString().padStart(6, '0');
  const frac = currentValue % 1.0; // Fractional sub-step for the rolling units digit

  ctx.save();
  ctx.font = '700 48px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';

  for (let i = 0; i < str.length; i++) {
    const digitX = x + i * 32;
    const digit = parseInt(str[i], 10);
    const isUnits = i === str.length - 1;

    if (isUnits && frac > 0.7) {
      // Smooth vertical roll on the last 30% of each step
      const rollProgress = (frac - 0.7) / 0.3;
      const nextDigit = (digit + 1) % 10;

      ctx.fillText(digit.toString(), digitX, y - rollProgress * digitHeight);
      ctx.fillText(nextDigit.toString(), digitX, y + (1.0 - rollProgress) * digitHeight);
    } else {
      ctx.fillText(str[i], digitX, y);
    }
  }
  ctx.restore();
}
```

---

## 6. Contrast Knockout Understroke Halos [RULE]

To satisfy WCAG standards and prevent telemetry Rule `F04` (Text Collision / Unreadable Contrast):

```typescript
// Complete Knockout Halo Implementation in Canvas2D
export function drawContrastText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  textColor = '#E8E4DA',         // --bone
  haloColor = 'rgba(5, 5, 6, 0.95)', // --void with high opacity
  haloWidth = 6
): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  // 1. Draw heavy background knockout understroke
  ctx.strokeStyle = haloColor;
  ctx.lineWidth = haloWidth * 2;
  ctx.strokeText(text, x, y);

  // 2. Draw crisp foreground text
  ctx.fillStyle = textColor;
  ctx.fillText(text, x, y);

  ctx.restore();
}
```

- **Halo Width Standard:**
  - 16:9 Desktop / 4K: `haloWidth = 6`
  - 9:16 Mobile Shorts: `haloWidth = 8` (compensates for small smartphone screens)

---

## 7. Pre-Flight Kinetic Typography Checklist

Before finalizing any typography pass:

- [ ] **Font Loading Gate:** Initialization strictly awaits `document.fonts.ready`.
- [ ] **No Naked Fades:** Words enter via mass slams (scale/overshoot) or typographic pressure, not bare opacity fades.
- [ ] **Knockout Halos:** All text over 3D scenes or particles features dark knockout halos (`haloWidth >= 6`).
- [ ] **Monospace Digits:** Numeric counters use tabular/monospace formatting to eliminate horizontal digit jitter.
- [ ] **Safe Zone Adherence:** Titles respect 90% safe zones on 16:9 and Central 60% Core on 9:16 Shorts.
- [ ] **Telemetry Compliance:** Text does not intersect other text elements (`F04`) or clip viewport bounds (`F05`).
