# watertank — visual plan

## Concept
A lone rusted water tank on wooden stilts owns the rooftop. Noon in a desert
city: bleached sky, hazed sun, rooftops flattening into haze layers behind it.
Under the tank a pool of hard shade where pigeons roost. The frame breathes
once — a pigeon takes a slow circuit of the tank — then settles back to heat.

## Composition (authored uv)
- y < 0.11: parapet edge (foreground framing, near-black).
- y 0.11–0.24: tar roof, two vents, the tank's shadow pool, cast stilt shadows.
- x ~0.56: tank — 4 leaning stilts + cross braces (0.24→0.44), octagonal stave
  body (0.44→0.61) with seam lines, rust streaks, 3 glinting metal bands,
  conical cap to ~0.67. Rope swings from the rim at x≈0.635.
- y 0.49–0.64: three receding city rooftop layers, hazier per layer.
- Sun disc (0.72, 0.80) in bleached sky; shimmer wobble across the haze band.
- Pigeon cluster in shade (x 0.49–0.63, y ~0.27); pigeon A orbits the tank;
  pigeon B crosses to the parapet and shuffles right. Sparrow cameo on the rim.
  Helicopter speck across y≈0.86; plastic bag tumbles the roof; wasp loops the
  parapet.

## Camera
Low, near-static. A slow 1.1-unit rise over 20 s lifts the tank's cap into the
sky band — the tank reads taller by the end. Kestrel-style authored-uv remap
into the vUv band; backdrop quad PW=300 PH=114 at PZ=-80.

## Light
Hard noon: shadow pool is the darkest shape in frame (0.75 alpha). Band glints
are keyed sparkle lines. Bloom 0.14 / threshold 0.74.

## Motion beats
0–5 s still tank, roosting pigeons, rope sway, shimmer.
5–9.5 s pigeon A orbits the tank (raised cosine gate); sparrow lands on rim
7.4–9.4 s; tank creaks at ~6.5 s.
9.5–14 s plastic bag tumbles across (bouncing arcs); pigeon B flies to the
parapet at 11 s and shuffles right from 14 s; helicopter crosses 12–18 s.
14–20 s settle — cluster re-settles, second creak ~15.7 s, wasp keeps circling.

## Seeds / determinism
All positions closed-form f(t); hash seeds h1/h2 for pigeon spots, rust streaks,
rooftop heights, band glints. No simulation state.
