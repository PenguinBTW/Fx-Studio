# autumnwind — visual plan

Momiji leaves spiraling through a temple garden at golden hour.

## Concept

A still temple garden breathes: golden-hour shafts through a layered maple
canopy, then a gust front sweeps the trees loose — leaves corkscrew down,
a brief leaf vortex spins over the raked gravel, and the garden settles
with leaves resting on the rake lines.

## Visual system

| Element | Approach |
|---|---|
| Golden-hour sky | Backdrop quad gradient (amber horizon → dusty violet) |
| Maple canopy hills | 3 fbm silhouette layers, autumn palette |
| God rays | Screen-space radial beams from upper-left sun, fbm streaks, swell during gust |
| Torii gate | Silhouette shapes right-of-frame (vermillion-dark) |
| Stone lantern | Small stacked silhouette + glowing window dots, left |
| Raked gravel | Ground quad: warped parallel rake lines + speckle + long shadows |
| Pond corner | Dark ellipse patch, ripple shimmer, one koi shadow crossing |
| ~200 leaves | One points cloud — closed-form helical descent + gust envelope |
| Leaf vortex | 24 leaves blended into a shrinking orbit at t≈12.5–16.5 |
| Settled leaves | Per-leaf touchdown time freezes x/z/rotation on the gravel |
| Birds | 4 gull-v points gliding across the calm beat |
| Koi shadow | Dark elongated blob in the pond patch, one crossing at t≈13–15 |

## Anti-cliché audit

- Not "particle rain": leaves corkscrew (helical), gust-modulated, and *land*.
- The vortex is localized and brief — a gust event, not a permanent feature.
- Koi/birds are single passing events, not ambient noise.
- No text in world; captions are probe captions via project.json.

## Beats (24 s, 3 × 8 s)

1. **windless gold** (0–8): canopy still, shafts visible, early leaves drifting.
2. **gust front** (8–16): gust envelope swells at t≈9–13; vortex t≈12.5–16.5; koi crossing t≈13–15.
3. **settling quiet** (16–24): gust dies, leaves land, birds cross t≈17–21, settled stills at end.

## Focal points

- Torii silhouette (right third) — establishing anchor.
- Vortex site over the gravel (center-right, low) — the gust's payoff.
- Leaf field volume — constant mid-layer motion.

## Verification

Stills at t=4 (still air + early leaves), t=11 (gust), t=14.5 (vortex + koi),
t=22 (settled + birds).
