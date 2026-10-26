# Text P10a: odometer, stroke reveal, letter hooks

Code: `app/src/engine/textfx.ts` (pure functions, no DOM), plus additive methods on `KineticText` (`text.ts`) and `ExtrudedText` (`text3d.ts`).
Test: `cd app; bun run test:text`. Demo: project `text` (`app/src/scenes/_prereq_demos/text/`). Stills: `out/prereq/text_*.png`.
In-world lighting, DoF and occlusion of text are P10b and are not here.

## Odometer

`odometer(value, opts) -> { value, text, cells[], width }`: a pure function of the value. Drive it with an eased value, e.g. `from + (to - from) * ease.inOutQuart(u)`.

- Each digit holds still until all lower digits are 9, then rolls over the last 1.0 of the scaled value (eased by `rollEase`, default `inOutCubic`). The units digit glides across every step. 999 -> 1000 rolls every digit together, and the new thousands place fades in (0 -> 1).
- Negative values roll by magnitude with a `sign` cell. `decimals` adds a decimal point and fractional digits.
- Layout is tabular: every digit cell is `cellWidth` em (default 0.62). `minDigits` (+ `leadingZeros`) fixes the width. Without it the width grows as places carry in.
- A `digit` cell exposes `from`, `to`, `frac` (eased 0..1) and `pos = from + frac`. Draw `from` at `y - frac*h` and `to` at `y + (1 - frac)*h`, clipped to the cell, for a custom renderer. `odometerRects(state, x, y, fontPx, align)` gives pixel rects.
- `opts`: `decimals`, `separator`, `decimalPoint`, `minDigits`, `leadingZeros`, `cellWidth`, `sepWidth`, `rollEase`, `prefix`, `suffix`.
- `KineticText.odometer(value, opts)` stores the state and sets the text to its current reading, so bounds and telemetry stay valid. `KineticText.renderOdometer(ctx, x, y)` draws the strips with the block's font, colour, align and halo. `numericRoll` is unchanged.
- `drawOdometer(ctx, state, x, y, {fontPx, font, color, align, haloColor})` is the standalone drawer.

## Stroke-plotted reveal

`strokePlot(strokeText, t, opts) -> { perStroke: Float32Array, overall, pen, glow, writing }`

- Time mode: `{start, duration, ease, stagger}`. `stagger` undefined writes strokes in sequence at constant pen speed. 0..1 gives each stroke an equal time slot, from 0 (all together) to 1 (strictly one after another). `strokeProgress(st, overall, stagger)` is the underlying function.
- Note mode: `{noteTimes, unit: 'letter' | 'stroke', noteDur, ease, glowDecay}`. Note i writes letter i (or stroke i), starting at `noteTimes[i]`. By default it takes 90% of the gap to the next note, clamped to 0.08..0.5 s. Letters with no strokes (spaces) are skipped when mapping notes to letters.
- `pen` is `{x, y, angle, stroke, char}` in stroke-text px, or null before any ink. `glow` is 1 at each note onset (or while writing in time mode) and decays exponentially (`glowDecay`, default 0.45 s). All of it is a pure function of t.
- Drawing: `drawStrokePlot(ctx, st, perStroke)` (translate to the text origin first) and `drawPenGlow(ctx, pen, glow, {color, radius})`. The existing `drawStrokeText` and `writtenLength` are unchanged.

## Letter-level hooks

- `KineticText.glyphs(ctx, x, y) -> Glyph2D[]`: pixel box and centre of every character in 1080p space. It is measured with the real font and tracking, and handles align and multi-line text. Pass the same x/y you render with. It does not include per-unit stagger offsets (`offsetY`, `scale`).
- `ExtrudedText.glyphs(group, cam?, W, H) -> ExtrudedGlyph[]`: per glyph, the world ink-box `center`, `min`, `max`, a bounding-sphere `radius`, the `word` index and `screen: [x, y, viewDepth]` at 1080p. Call after the group's transform and the camera are final.
- `deflectPoint(p, obstacles, strength)`: an optional helper. It uses the smooth radial map `r' = cbrt(r^3 + R^3)` around each sphere `{c, r}` built from glyph centres and radii. The map is continuous and monotonic, so streamlines have no flips.

## Tracking and word-by-word reveal on extruded type

- Tracking: `ExtrudedTextOpts.letterSpacing` is extra spacing in em of `size` (default 0.18). +0.1em on top of the base pitch is `letterSpacing = 0.18 + 0.1`. The test confirms the pitch changes by exactly `Î”`. Because glyphs are positioned per mesh, kerning is absent.
- `ExtrudedText.reveal(group, t, {unit: 'word' | 'char', start, interval | stagger, inDuration, motion: 'fade' | 'slide-up' | 'scale-pop' | 'cut', ease})`. It is a pure function of t. For `fade`/`slide-up` it clones each glyph's material once (so a shared material is not faded for the others).
- Fix made: glyph meshes now carry `userData.glyph` (`index`, `char`, `word`, `base`). The geometry and layout are unchanged, so existing scenes render identically.

## Limits and known gaps

- The odometer digit font must have tabular-ish digits. Cells are centred, so proportional digits look fine, just not aligned to the font's own metrics.
- Odometer values beyond about 1e15 lose integer precision (double arithmetic).
- `KineticText.glyphs` uses `measureText`, so fonts must be loaded. The telemetry bounds (`getScreenBounds`) still use their own 0.55 em approximation.
- `ExtrudedText.glyphs` bounds come from the mesh bounding box, so they include bevel and extrusion depth.
- **The extruded glyph set in `vectorglyphs.ts` is tiny** (I 1 L T H E F C U O 0 A P - _ :). Every other character, including most letters of `IT DOES NOT BEND` and `YOU WERE ITS DESTINATION.`, renders as a hollow box. Tracking and reveal work, but the film's extruded text needs the glyph set extended (or a real font outline source) before use.
- Extruded advance is fixed at 0.85 em per glyph plus `letterSpacing`, with no kerning and no per-glyph widths, so narrow letters (I) look loosely spaced.

## Glyph coverage and advance widths

- `ExtrudedText` now covers A-Z, 0-9 and `. , ! ? ' \" : ; - _ / % + = ( ) & # \$ @ * < > [ ] { } | ~ ^ \` ° – — ` plus curly quotes; lowercase maps to uppercase. The original 16 hand-authored glyphs (`I 1 L T H E F C U O 0 A P - _ :`) are unchanged and hash-locked (`test:glyphs`); they stay squarer than the rest.
- All other glyphs derive from Hershey Sans 1-stroke (`src/engine/hersheyglyphs.ts`, generated by `scripts/gen_hershey_glyphs.ts`): each polyline segment becomes a capsule, all capsules of a glyph are merged with `polygon-clipping` (new dependency) into one planar outline with true holes, so there are no coplanar overlapping faces.
- Advance is per glyph (ink width + 0.075 em each side; I = 0.45, O = 0.95, W = 1.11 em), plus `letterSpacing` as before, so +0.1 em tracking still adds exactly 0.1 em per gap. `fixedAdvance: true` restores the old 0.85 em pitch. Space is still 0.5 em.
- Unknown characters draw a thin hollow box and log one `console.warn` per character.
- Demo: project `glyphs` (`bun scripts/render.ts stills --project glyphs --t 1`); `bun scripts/raster_glyphs.ts <out.pgm>` is a GPU-free flat raster of the same rows.
