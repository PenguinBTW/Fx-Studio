# mirrormarsh — visual plan

A mirror-still marsh at dawn. The whole shot is one GLSL pass on a wide
backdrop plane (320×140 world units at z=-80); the camera sits ~150 units
back on a near-static rig with only a tiny vertical drift, so the
waterline stays centered and the mirror reads as glass.

## Composition (uv space)

- `HLINE = 0.50` — the waterline. Everything below is a flipped resample
  of the world function, tinted cool and darkened with depth.
- Sky: peach at the horizon → pale blue at zenith; a warm sun-halo smear
  at (0.56, 0.545) seen through ground fog.
- Deep mist bank: a hazy band riding the horizon, thicker at the frame
  edges, ragged fbm top.
- Reed banks: ~52 seeded stalks left (x<0.30) and right (x>0.72), each
  with seeded lean/height; eight stalks carry darker seed heads.
- Rowboat: tiny beached silhouette at (0.895, ~0.50).
- Heron: mid-frame at x≈0.47, standing at the waterline — body ellipse,
  S-neck, head/beak; legs reaching just below the line.

## The mirror

`world(uv)` renders the full above-horizon world. Below `HLINE` the same
function is sampled at `vec2(x + quiver, 2·HLINE − y)`. The quiver is
masked by the moving mist bands (`band1·band2`), so the reflection only
shimmers where the mist is actually drifting — the rest stays glass.
A cool blue-grey tint deepens with distance below the line.

## Beats (t in scene seconds)

| beat | t | what happens |
|------|---|--------------|
| still mirror | 0–3.5 | establishing caption, dead calm |
| first mist | 3.5–7.5 | drifting bands pick up; fish-rise ring far left at 4.5 |
| heron strike | 7.6–10.5 | neck pitches down at ~8.2, splash ring + beak drip ring; frog bubbles 10.2–11.4 |
| kingfisher | 12.3–14.5 | dart streak in → perch on reed tip → dive streak out |
| settle | 15.8–20 | second dragonfly crossing at 16.2, mirror returns to still |

## Life details

- Heron head-dip "peek" at ~4.6–6.1 (small lean, no strike).
- Strike ring expands ~0.115 uv/s; the drip is a slower, fainter ring.
- Frog: 7-seed bubble cluster popping at the waterline.
- Dragonflies: two low crossings with a 90 Hz wing-shimmer halo.

## Post

exposure 0.72, bloom 0.30@0.72, ca 0.08, grain 0.05, vignette 0.42.

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
