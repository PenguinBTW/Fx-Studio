# hedgelight — visual plan

**Logline**: low sun stripes a field-edge hawthorn hedge; a wren darts perch to
perch along it while a snail eases its antennae out on a backlit leaf edge.

## Composition (authored uv, 16:9 SDF quad)
- Sky upper 40%: warm amber→rose gradient, sun disc behind the hedge right-of-
  center with a soft halo; thin field haze band above the hedge line.
- Hedge mass x 0–1, top line y ~0.60±noise down to the dirt track at y ~0.30–0.42:
  near-black mass with rim-lit leaf edges on the sun side; a few hashed "gap"
  columns let light shafts through onto the grass.
- Field grass y 0.15–0.42 in front: blades catch light along their top edges;
  lightest where a shaft lands.
- Dirt track at the hedge base.

## Light logic
- Sun sits low at far right (uv ~0.93, 0.62): rim glow = hedge edge proximity ×
  sunward facing × warm ramp; shafts = narrow angled bands through the gap
  columns; the wren brightens when crossing a shaft; snail-shell dew glint
  pulses once during the snail beat.
- Everything animated is silhouette-dark; the light does the work.

## Beats
still hedge → wren dart (L→M, tail flicks, hides) → snail detail (antennae,
leaf bend, dew glint) → skylark spiral rise → wren re-emerges higher and darts
off → settle (butterfly cross, brief robin).

## Determinism
All motion closed-form f(t): hash seeds for blade/gap variation, smoothstep
envelopes per beat, no simulation state.
