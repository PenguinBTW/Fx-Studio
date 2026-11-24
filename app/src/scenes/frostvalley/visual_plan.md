# frostvalley — visual plan

**Logline.** A high alpine valley at first light. Frost glitter sweeps the meadow as a
red fox crosses single-file — pause, listen, one pounce — while mist drifts along a
silver stream and a finch flock erupts far right.

## Composition (authored uv space)

| Band | uv.y | Content |
|------|------|---------|
| Sky | 0.55–1.0 | Pale lavender→peach gradient, low sun glow at left, one lenticular cloud (0.62, 0.80), raven orbit at (0.50, 0.82). |
| Mountain walls | crest(x): ~0.95 at edges → ~0.60 at the throat | Steep dark-rock walls converging at the valley throat (walls fill ground→crest; distant headwall rises only from the meadow top, hazed toward sky); snow caps above a jittered snowline take pink alpenglow via `uDawn`. Thin far-ridge band ~0.52. |
| Meadow | 0.10–0.50 | Frost-dusted grass (fine blade noise), glitter cells twinkling inside the sweeping sun band `uBand`. |
| Stream | x≈0.48+0.07·sin(9.5y+1.3) | Thin silver meander, shimmer noise, warm tint inside the sun band. Mist bands hug the stream + a pooled band at y≈0.38, fbm-driven drift, splitting in a corridor around the fox. |
| Fox | y≈0.30 | ~10% frame width rust silhouette + pale underfur; trot gait, ears perk on listen, head-down + tail-tip-up on pounce. |
| Bush | (0.88, 0.32) | Dark seeded blob; finch origin. |

## Light & palette

Pre-dawn cool (slate violet) warming left→right as `uDawn` rises over the first 4 s:
snow caps flip from cold blue-grey to pink; meadow sun band carries the glitter.
Fox is the single warm-dark accent.

## Camera

Near-static low shot (y=4.5, z=30). x drifts ±0.8 tracking the fox's authored-x;
a 1.4-unit push on the pounce window. LookAt mirrors the drift loosely.

## Determinism

All animation is closed-form f(t): smoothstep envelopes (listen, pounce, finches,
raven, dawn, sun band), hash-seeded glitter/finch particles, fbm mist. No sim state.
