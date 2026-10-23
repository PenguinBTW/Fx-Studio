# Telemetry Diagnostic Rules & Flag Specification (F01–F16)

This specification defines the 16 automated diagnostic rules evaluated by `scripts/render.ts motion`.

To prevent Goodhart's Law optimization traps and avoid subjective grading loops, flags are categorized into a **Three-Tier Review Hierarchy**.

---

## 1. The Three-Tier Review Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       THREE-TIER REVIEW HIERARCHY                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   TIER A: OBJECTIVE RULES (Zero Tolerance / Hard Failure)                   │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │ • Mathematical, geometric, or crash defects.                     │      │
│   │ • ONLY Tier A rules may trigger blocking status.                 │      │
│   │ • Rules: F04 (Collision), F05 (Clipping), F10 (Cut in Word),    │      │
│   │          F13 (Frame Budget - Advisory), F16 (Unintended Blank).  │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                │                                            │
│                                ▼                                            │
│   TIER B: CALIBRATED BENCHMARKS (Advisory Quality Checks)                   │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │ • Empirical comparison against approved benchmark plates.        │      │
│   │ • Advisory only — Never blocks builds or merges.                 │      │
│   │ • Waivable with a single-line reason in findings.json.           │      │
│   │ • Rules: F01, F02, F03, F09, F11, F12, F14, F15.                 │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                │                                            │
│                                ▼                                            │
│   TIER C: PERCEPTUAL PROXIES (Informational Signals)                        │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │ • Rough heuristics for visual pacing, corner clutter, or holds.   │      │
│   │ • Purely informational — NEVER optimize code to satisfy Tier C!  │      │
│   │ • Rules: F06 (Corner Clutter), F07 (Digit Hold), F08 (Dead Time).│      │
│   └──────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Universal vs. Lyric/Music-Only Rules

> [!IMPORTANT]
> **Domain Applicability**:
> - **Universal Motion Design Rules (`F04–F08`, `F11–F16`)**: Active across all projects (product reveals, UI interaction showcases, 3D animations, title sequences).
> - **Lyric & Music-Sync Rules (`F01–F03`, `F09`, `F10`)**: **Purpose-built exclusively for synchronized lyric animations and musical kicks.** If a project does not feature on-screen vocal lyrics or kick drum stems, these flags are **not applicable and must be ignored**.

---

## 3. Comprehensive Rule Catalog (F01–F16)

### Rule F01: Lyric Word Visibility (`lyric_visibility`)
- **Tier**: Tier B (Benchmark) | **Source**: Calibrated | **Class**: `advisory`
- **Domain**: **Lyric-Only** *(Ignore if no lyrics)*
- **Condition**: Lyric word visible for $< 90\%$ of its sung duration in `lyrics.json`.
- **Known Limit**: Canvas2D text probe only; typography drawn via raw WebGL vertex buffers or MSDF shaders is invisible to the probe.

### Rule F02: Sung Word Visual Dominance (`sung_word_height`)
- **Tier**: Tier B (Benchmark) | **Source**: Calibrated | **Class**: `advisory`
- **Domain**: **Lyric-Only** *(Ignore if no lyrics)*
- **Condition**: Current active sung word peaks below $5\%$ of viewport height ($< 54\,\text{px}$ at 1080p).
- **Known Limit**: Measured at 2D screen coordinates; extreme 3D perspective foreshortening may legitimately scale text down.

### Rule F03: Word Entrance Anticipation (`word_anticipation`)
- **Tier**: Tier B (Benchmark) | **Source**: Calibrated | **Class**: `advisory`
- **Domain**: **Lyric-Only** *(Ignore if no lyrics)*
- **Condition**: Word appears $> 0.40\,\text{s}$ before its vocal start timestamp.
- **Known Limit**: Persistent background typography displays or lyric stanzas may legitimately reveal words earlier.

### Rule F04: Text Layout Collision (`text_collision`)
- **Tier**: **Tier A (Objective)** | **Source**: Objective | **Class**: **`blocking`**
- **Domain**: **Universal**
- **Condition**: Two text bounding boxes ($\alpha > 0.15$ each) overlap by $> 2\%$ of the smaller box's area.
- **Calibrated Exclusions**:
  1. **3D Depth Parallax**: Pairs with $\ge 2.5\times$ font height disparity or micro-geometry ($h < 0.4\%$, or $< 4.3\,\text{px}$) are excluded as background 3D depth parallax.
  2. **Multi-Pass Probing**: Identical text strings overlapping $> 10\%$ with centers $< 40\,\text{px}$ apart are treated as a dual-probe duplicate or drop shadow pass, not a collision.

### Rule F05: Viewport Edge Safe Boundary Clipping (`text_clipping`)
- **Tier**: **Tier A (Objective)** | **Source**: Objective | **Class**: **`blocking`**
- **Domain**: **Universal**
- **Condition**: Text bounding box extends outside viewport boundaries by $> 5\%$ of its area during its **active display window**.
- **Calibrated Exclusions**:
  1. Elements in active transit ($v \ge 50\,\text{px/s}$) during entrance or exit animations are excluded. Frustum flight naturally carries graphics offscreen.

### Rule F06: Corner Margin Clutter (`corner_persistence`)
- **Tier**: Tier C (Proxy) | **Source**: Guess | **Class**: `info`
- **Domain**: **Universal**
- **Condition**: Text persisting inside outer corner regions (outer $12\% \times 14\%$) for $> 3.0\,\text{s}$.
- **Known Limit**: Timecodes, HUD indicators, and persistent status telemetry intentionally live in corners.

### Rule F07: Static Digit Hold (`static_digit_persistence`)
- **Tier**: Tier C (Proxy) | **Source**: Guess | **Class**: `info`
- **Domain**: **Universal**
- **Condition**: Unchanging numeric string persisting in an active slot for $> 3.0\,\text{s}$.
- **Known Limit**: Fixed constant values, project timestamps, or static version labels intentionally persist.

### Rule F08: Motion Momentum Stall (`dead_motion`)
- **Tier**: Tier C (Proxy) | **Source**: Guess | **Class**: `info`
- **Domain**: **Universal**
- **Condition**: Full-frame motion energy $E < 0.001$ persisting for $> 0.5\,\text{s}$.
- **Known Limit**: Intentional dramatic pauses, musical holds, and static title cards register as dead motion.

### Rule F09: Kick Drum Kinetic Response (`kick_response_ratio`)
- **Tier**: Tier B (Benchmark) | **Source**: Calibrated | **Class**: `advisory`
- **Domain**: **Music-Only** *(Ignore if no kick stem)*
- **Condition**: Motion energy ratio $E_{\text{peak}} / E_{\text{base}} < 1.15\times$ on high-amplitude kick drum transients.
- **Known Limit**: Pixel difference metric; subtle color shifts or camera zooms may not yield large pixel deltas.

### Rule F10: Hard Cut Inside Sung Vocal Word (`cut_inside_sung_word`)
- **Tier**: **Tier A (Objective)** | **Source**: Objective | **Class**: **`blocking`**
- **Domain**: **Lyric-Only** *(Ignore if no lyrics)*
- **Condition**: Hard camera cut or scene transition boundary lands inside an active sung vocal word window.
- **Known Limit**: Relies on aligned timestamps in `lyrics.json`.

### Rule F11: Highlight Bloom Bloat (`bone_bloom_bright_nonsignal`)
- **Tier**: Tier B (Benchmark) | **Source**: Calibrated | **Class**: `advisory`
- **Domain**: **Universal**
- **Condition**: $> 0.5\%$ of frame pixels are bright ($Y > 0.85$) and non-signal hue outside transition flash frames.
- **Known Limit**: High-key scenes or intentional whiteout flashes exceed this threshold legitimately.

### Rule F12: Off-Palette Gamut Wash (`off_palette_wash`)
- **Tier**: Tier B (Benchmark) | **Source**: Calibrated | **Class**: `advisory`
- **Domain**: **Universal**
- **Condition**: $> 3.0\%$ of frame pixels exhibit perceptual distance $\Delta E_{76} > 12$ from all palette swatches.
- **Known Limit**: Antialiasing fringes or continuous photographic textures can register as off-palette.

### Rule F13: Frame Render Time Budget (`frame_time_budget`)
- **Tier**: Tier A (Objective) | **Source**: Objective | **Class**: `advisory`
- **Domain**: **Universal**
- **Condition**: Headless frame render turnaround exceeds $25\,\text{ms}$ ($< 40\,\text{fps}$ equivalent).
- **Known Limit**: Includes Playwright canvas readback overhead and CPU scheduling on the host machine.

### Rule F14: Adaptive Sampler Stress (`sampler_max_spp`)
- **Tier**: Tier B (Benchmark) | **Source**: Calibrated | **Class**: `advisory`
- **Domain**: **Universal**
- **Condition**: Sub-frame adaptive supersampling maxes out at 324 samples per frame.

### Rule F15: Edge Shimmer & Sampler Chatter (`edge_shimmer_flicker`)
- **Tier**: Tier B (Benchmark) | **Source**: Calibrated | **Class**: `advisory`
- **Domain**: **Universal**
- **Condition**: Edge shimmer index exceeds calibrated benchmark threshold ($> 0.35$).
- **Known Limit**: Intentional musical strobes or glitch shaders register as shimmer.

### Rule F16: Unintended Screen Blackout/Whiteout (`unintended_blank_screen`)
- **Tier**: **Tier A (Objective)** | **Source**: Objective | **Class**: **`blocking`**
- **Domain**: **Universal**
- **Condition**: Near-black or near-white screen run $> 0.3\,\text{s}$ outside permitted `--allow-blank` intervals.

---

## 4. Stable IDs & Reviewer Waiver System

Each flag is assigned a **content-addressed stable ID** based on its rule and quantized time window:
$$\text{ID} = \text{Rule} - \text{round}(t_0 \times 100) - \text{round}(t_1 \times 100) - \text{index}$$
*Example: `F04-800-845-001` (Text collision from 8.00s to 8.45s).*

To waive an advisory flag or intentional artistic deviation, reviewers add an entry to the `waivers` dictionary in `findings.json`:
```json
{
  "waivers": {
    "F11-1400-1420-001": "Intentional supernova transition flash into Act 2",
    "F08-2200-2260-001": "Dramatic silent hold before beat drop"
  }
}
```
Waived flags are preserved in telemetry records with `waived: true` but are omitted from blocking summaries.
