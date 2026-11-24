# stileedge — visual plan

A field-edge stile on a footpath at a windy dusk. A crow rocks on the top rail,
holding position against the wind; bramble canes reach over the step; a wind-bent
hawthorn leans behind the wall. Everything but the crow is in motion — the gag is
the bird refusing to leave.

## Composition (authored uv [0,1], remapped into the camera band)

- Sky y 0.62–1.0: deep dusk gradient — ink up top, a last amber-violet strip
  low over the field edge.
- Far pasture y 0.55–0.62: dark rough grass, wind-combed left→right.
- Stone wall y 0.42–0.55, full width: rough coursed stones (noise-block shading),
  a shadowed base seam.
- Stile at x 0.44–0.56: two upright posts (y 0.42–0.70), two worn step planks
  (y 0.52, 0.58), top rail y 0.66–0.685. Dark weathered wood.
- Crow silhouette on the rail top, x≈0.50, y≈0.71: body + head/beak + tail.
- Brambles: cane arcs from lower right (x 0.60–0.82, base y≈0.42) reaching left
  over the step to x≈0.50; all canes lean with the wind.
- Hawthorn behind the wall at x≈0.62: bent trunk, canopy pressed downwind.
- Footpath: ruts from the stile base splaying to the bottom corners; wet rut
  ribbons catch the last light; leaf debris slides along them.

## Motion

- Wind: steady lean (+gust envelope). Grass, canes, canopy all lean +x; one gust
  peak at ~14s shakes everything harder.
- Crow: rocks on the rail (small x wobble + tail counter-tip), one wing flare for
  balance (~9s), occasional flap adjustments. Never leaves the stile.
- Rabbit: lopes along the wall once (10–13.5s), hop-bob silhouette.
- Bat: flickers past twice — ~6s and ~17.5s, erratic upper-frame passes.
- Bramble cane: one detaches at the gust peak and blows across the frame.
- Path: wet ruts hold a pale ribbon; leaf debris slides in gust pulses.

## Beats

0–4 wind steady · 4–8 crow adjusts · 9 wing flare · 10–13.5 rabbit pass ·
14 gust peak (cane detaches) · 15–20 settle.

## Style

Silhouette-driven 2.5D shader quad (same convention as dawnditch/fenrunner):
single fullscreen PlaneGeometry, closed-form f(t) everywhere, hash-seeded
detail, no simulation. Near-static low camera with a slight drift along the wall.
