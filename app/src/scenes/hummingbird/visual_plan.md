# hummingbird — visual plan

Macro garden shot at dawn: a hummingbird feeding on trumpet flowers.

## Composition
- Camera at macro distance (~4–5 world units), 90 mm lens, tracking the
  hover sites with eased leads — the camera arrives at each bloom just
  before the bird does (rack-feel between blooms).
- Vine: a drooping Catmull-Rom spline upper-left → mid-right, bearing
  8 seeded trumpet blooms (lathe geometry, coral gradient texture) and
  ~12 leaf cards. One perch twig lower-left.
- Backdrop: deep-green bokeh wall (14 seeded soft discs over a dark
  foliage gradient) with dawn shafts slanting in from upper-right and
  drifting dust motes — all one GLSL plane.
- Cobwebs: a few additive hairlines strung off the vine catching light.

## Timeline (24 s)
- 0–3.5  still vine — dawn shafts strengthen, dew glints, bee orbits
- 3.5–4.3  bird darts in from the right edge to bloom A (bee flees)
- 4.3–16.2  feeding chain: dart → hover → sip pulses at four blooms;
  arriving at bloom C jostles it — dew drops fall
- 16.2–20.6  perch beat on the twig — preen flicks
- 20.6–21.4  exit dart off the left edge; vine holds to 24

## Motion language
Everything is closed-form f(t). The bird's piecewise schedule drives one
`birdAt(t)` returning position + pose (pitch, yaw, wing-open, tail-fan,
throat pulse). Hover = anchor + small Lissajous jitter + repeated sip
dips toward the corolla. Wing blur is an authored fan envelope
(additive arc sectors with shimmer) — real hover wings beat ~50 Hz,
unresolvable at 60 fps, so the blur IS the honest image. Bloom jostle,
dew drops, bee flee, and preen pulses are seeded envelopes on the same
clock. No simulation state anywhere.

## Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
