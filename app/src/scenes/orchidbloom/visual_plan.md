# orchidbloom — visual plan

Macro time-lapse of a single orchid opening at dawn on a mossy rainforest stem.

## Composition (world units, camera z≈3.6, near-static push-in)
- Moss mound silhouette fills the bottom of frame (y < -0.75), wet sheen.
- One curved stem rises from the mound left-of-center, four buds spaced along it.
- Hero bud sits upper-center at (0.15, 0.55); backdrop is deep moss green with
  teal bokeh gaps and dawn shafts that drift as the canopy moves.

## Timeline (24 s)
| t (s) | Beat | Motion |
|-------|------|--------|
| 0–4   | buds closed | static tableau, shafts drifting, millipede crosses the mound |
| 4–9   | sepal split | three hero sepals peel back in staggered stages |
| 9–14  | petals open | five petals unfurl, lip flares, first bokeh shimmer |
| 14–19 | hover-flies | two flies circle, land on the lip; spider thread drops past |
| 19–24 | droplet + settle | dew drop slides off a petal tip, glint sweep, calm |

## Systems (all closed-form f(t), hash seeds, no sim)
- Backdrop ShaderMaterial: moss gradient + fbm bokeh + drifting shaft lanes +
  beat exposure ramp.
- Stem + buds: tapered triangle ribbons (rib()), vertex-colored, seeded curve.
- Bloom: per-petal ribbons with paired aClosed/aOpen vertex attributes; a
  uOpen uniform mixes folded → spread with per-petal stagger. Sepals are the
  same system with green palette and earlier offsets. One bloom stays half
  open (uOpen frozen), one starts late, one never opens.
- Points: bokeh motes, two hover-flies (body + halo, land on lip), millipede
  segment chain, dew droplet (grow → slide → fall along petal tip path),
  spider dot, sun glint on the lip.
- Spider thread: 1px line + thin ribbon, drops past once and vanishes.
- CameraRig: very slow push-in + tiny orbit drift, settles on the open face.

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
