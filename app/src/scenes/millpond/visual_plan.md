# millpond — visual plan

A derelict watermill on a quiet pond at dusk. One fullscreen GLSL pass.

## Composition
- Reflection line `WATER = 0.50`: dark pond below (faint sky band near the
  mirror line), dusk gradient sky + bank silhouette above.
- Stone mill mid-frame: walls x 0.42–0.64 up to 0.72, gabled roof
  `roofEdge(x) = 0.79 − |x−0.53|·1.8`. One warm window with slow flicker.
- Mossy undershot wheel at `(0.66, 0.545)`, r = 0.115 — its bottom paddles
  dip into the pond. Rim + 8 spokes rotate at ~3.5°/s with a creak wobble
  (`t·0.06 + 0.008·sin(t·1.3)`).
- Willow canopies + hanging fronds at both banks; spill overflow line at
  x>0.78 on the waterline; low mist drifting over the pond.

## Light
- Last light = warm thin rim under the gable edge and on the wheel's top
  arc — the only warm notes besides the window.
- Reflections: `millMask(2·WATER − y)` mirrored and damped with a sin quiver.

## Life
- Wheel drip bead every 2.2s → expanding ring on the pond (squared falloff).
- Fish rise near the wheel at 6.0s (+ring); bats: 3 seeded zigzag flits with
  fast figure-8 wing flick, 7.5–10.9s; heron on the spill edge, head turn at
  11.2s; kingfisher dart 13.0s (teal edge flash); water rat + vee wake
  14.5–17.1s.

## Beats
still mill (0–2) → wheel drips + fish (2–7) → bat pass (7.5–10.9) →
heron look (10.5–12.6) → kingfisher + rat (13–17) → settle (16.5+).

## Camera
CameraRig: low near-static, drifting across the pond toward the wheel,
small push at the kingfisher dart. Anchored captions via Layer2D; the canvas
textProbe hook records them automatically.

All closed-form f(t), hash seeds only, no simulation state.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
