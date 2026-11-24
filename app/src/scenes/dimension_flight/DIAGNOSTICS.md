# Diagnostics Pass — `dimension_flight` (odyssey, 0–82 s)

Audit of the full timeline: stills at 1920×1080 plus motion telemetry (F01–F16) in
windows at 15 fps / 640×360 (SwiftShader CPU budget; chunked so each run completes).

## Coverage

| Window | Telemetry | Stills / evidence |
|---|---|---|
| 0–9 s (overworld valley → portal approach) | 0 blocking, 14 advisory | beats 1–2 clean |
| 9–17 s (portal dive) | 0 blocking, 6 advisory | beat 3 clean |
| 17–34 s (nether lava sea → basalt → End dive) | 1 blocking (F16), 11 advisory | see fix below |
| 34–51 s (End island, chorus, glowstone gate) | 1 blocking (F16), 10 advisory | see fix below |
| 51–68 s (aether → skyroot → Deep Dark arch) | 0 blocking, 11 advisory | beats 10–12 clean |
| 68–82 s (sift meadows → ravine → great tree) | 0 blocking, 8 advisory | beats 13–15 clean |

All 15 storyboard beats were also verified at 1080p — every world renders, no
`SCENE ERRORS`, no shader failures. Lyric rules (F01–F03, F09–F10) are inactive:
the project has no lyrics/audio data, so those advisories are expected silence.
No Canvas2D text is emitted, so F04/F05 have no collisions or clips to measure.

## Blocking findings (Tier A) and fix

**F16 — near-black run, 33.07–34.80 s (~1.7 s, two flags).** Beat 7 drops the bird
out of the End ring portal into open void before the main island and chorus groves
enter frame (~34.9 s). The span rendered content (bird + sparse starfield + dim
nebula) but mean luma sat at ≈0.011, below the 0.02 near-black floor for >0.3 s —
a genuine under-lit gap in an otherwise readable sequence.

**Fix:** `w_end.ts` `SKY` shader — modest luminance lift that keeps the "silent
violet void" mood: raised base glow (0.006→0.011), widened/brighter nebula bands,
and ~1.7× star density (`step(0.9982→0.9970)`). Re-rendered stills at 33.3/34.2 s
confirm the void still reads dark while the starfield and nebula now carry the
frame; telemetry on 32.5–35.5 s reports **0 blocking flags** after the change.

## Advisory findings (Tier B — waivable context)

- **F13 frame-time overrun** (every window): SwiftShader readback + headless
  scheduling artifact (ms p50 ≈ 3.3 s/frame under CPU rasterization). Not an
  in-engine regression; F13 is advisory and its limits note this explicitly.
- **F12 off-palette** (~95–100% in most windows): graded against the default
  ink/bone/signal swatches; this film deliberately uses per-world palettes
  (overworld dawn, nether crimson, End violet, aether pastel, sift salmon).
  Waived in [`findings.json`](findings.json); re-grade with `--palette` when
  canonical swatches are defined.
- **F15 edge shimmer** (scattered clusters, e.g. 17–33 s nether run, 51–68 s):
  thin distant geometry + 640×360 downsampling amplifies temporal chatter.
  Not waived — F15 is temporal and stills cannot verify it; 1080p flicker
  remains unverified on this headless CPU box (no motion render possible).
- **F11 bright non-signal** (45.3–48.4 s aether, 56.6–58.1 s, 77.7–81.1 s sift):
  intentional luminous worlds (glowstone gate, soul-tide finale) — waived in
  [`findings.json`](findings.json).

## Verdict

One genuine Tier A issue found and fixed (F16 void luminance). Everything else is
advisory with documented causes — no frame regressions, collisions, or palette
violations requiring code changes.
