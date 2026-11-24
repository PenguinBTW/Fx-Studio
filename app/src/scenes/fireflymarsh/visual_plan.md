# fireflymarsh — visual plan

Fireflies rising over a moonlit marsh at blue hour. 24 s, 16:9, three acts.
Everything is closed-form f(t) — hash seeds via mulberry32, no sim state.

## Visual system

| Layer | Implementation |
|---|---|
| Sky | backdrop frag: blue-hour gradient (deep indigo → amber afterglow strip at horizon), moon disc + glow, hash-starred field, fbm distant treeline silhouette |
| Reeds | backdrop frag: seeded cattail clumps (stalk SDF strokes + head capsules) between horizon and waterline, per-clump sway on wind envelopes |
| Water | separate band quad: mirrored sky gradient, moon glint column, ripple shimmer, one expanding frog-plop ring (t-gated) |
| Fireflies | points cloud kind 0 (~110): Lissajous drift paths, per-seed flash rhythm — slow brighten, sharp falloff, variable period |
| Hero fireflies | kind 2 (~6): larger sprites with bloom halo crossing close to camera |
| Reflections | kind 1 (~110): seed-synced vertical smears on the water band, wobble-attenuated by ripple noise, camera x-compensated |
| Owl | kind 3 (1): slow gull-v silhouette crossing once at the calm beat |

## Beats

| t | Beat |
|---|---|
| 0–5 | last light — afterglow, first scattered flashes |
| 5–14 | full chorus — most fireflies flashing |
| 14–17 | sudden still — chorus envelope dies, all dark |
| 17–24 | rekindle + owl crossing + frog plop ripple (t≈19) |

## Focal points

1. Waterline band center-frame — reflections + reeds anchor the establishing shot.
2. Hero firefly crossing — near-camera bloom at the rekindle.
3. The still beat — the one beat where the marsh goes dark.

## Camera

CameraRig 55mm, gentle lateral drift along the waterline with a slow
settle toward the hero crossing side in the final act.

## Verification

Stills at t=3, 10, 17.5 (the dark beat), 22 — embedded in the PR.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
