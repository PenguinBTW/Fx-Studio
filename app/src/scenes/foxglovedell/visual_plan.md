# foxglovedell — visual plan

A shaded woodland dell at noon: dark canopy presses in on all sides while one
sunlit grass clearing glows at center, ringed by foxglove spikes. A mossy log
edges the lower-left, fern undergrowth fills the lower-right, and a single sun
shaft falls through a canopy gap onto one spike, lighting its bells from
inside. A lone wren patrols the log, sings once, and yields to the bees.

## Palette & light

- Deep shade base: near-black greens `#05110a`→`#0a1a0e`, heavy canopy
  vignette on every edge.
- One sunlit pool: warm grass `#3a5c1a`→`#5a7a24` ellipse at the clearing.
- The shaft: a narrow warm beam `#f2d873` from an upper-left gap; pollen
  motes drift inside it; the lit spike's bells pick up a pink inner glow
  (translucency).
- Foxglove bells: pink-purple `#8c3370`→`#c76b9e` with dark interior speckle.

## Geometry (authored uv, single backdrop quad)

- Canopy: dark backdrop + leaf-mass fbm overhead + sky only through a hashed
  gap mask at `y>0.86`; edge vignette closes the dell.
- Clearing: soft ellipse centered `(0.50, 0.30)`; shade floor outside it.
- Spikes: 7 seeded bases `x∈[0.28,0.715]` ringing the clearing; stems lean
  with height (`lean·ss(base,top)`) and sway on per-spike phases; 7 bells per
  spike, tube + flared lip, shrinking toward the tip, one-sided like real
  foxglove.
- Log: horizontal mossy band `x<0.26, y≈0.30` with a worn top rim.
- Shaft: Gaussian band on perpendicular distance to a beam from `(0.44,0.98)`
  aimed at spike 3.

## Motion (all closed-form f(t))

| t (s) | beat |
|---|---|
| 0–2.5 | still clearing: dapple drift, shaft settling, spike sway |
| 2.5–11 | wren patrol `uWren`: log walk → hop to spike base → return, tail flicks |
| 9–12.6 | song beat `uSong`: head/beak tilt up, beak opens, throat puffs, bob stops, camera lean 0.9 |
| 12.5–19.5 | bee visit `uBee`/`uBeeProg`: two bees climb the lit spike; bee 0 tucks into the top bell (~17.5–18.5) and disappears inside |
| 18–20 | settle: bees gone, breeze + motes + dapple only |

Camera: very low, near-static — `x = -1 + 1.3·sin(0.06t)` drift along the log
line so the spike mask slowly re-frames, `z = 30 - 0.9·uSong` lean-in on the song.

## Craft notes

- Bells are two-part distance shapes (tube disc + flared lip disc) with a
  hashed speckle mask inside the mouth — reads as foxglove at 10-px scale.
- The wren is bounded segment/ellipse primitives; the song reuses the same
  beak slivers rotated apart by `uSong` so the pose morphs rather than swaps.
- Bee-into-bell is a positional lerp into the bell mouth + a scale-out — a
  crawl, not a teleport.
- Dapple is an fbm threshold masked by the clearing ellipse and advected at
  two drift rates, so the speckle slides like real leaf-shadow.
