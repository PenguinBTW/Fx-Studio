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

## Conceptual mapping

| idea | visual mechanic |
|------|-----------------|
| low raking sun | rim ramp on hedge top edge + warm halo, no visible sun disc detail |
| light through gaps | hashed gap columns × angled `shaftAt` bands re-lighting grass/track/wren |
| wren as "working the hedge" | perch→tail-flick→dart→hide loop inside the hedge silhouette |
| snail = stillness at close range | tiny geometry, slow antennae envelope, single dew glint |
| field life | one-shot silhouettes (lark, robin, butterfly) on staggered envelopes |

## Anti-cliché audit
- No god-rays volumetric cones: shafts are thin flat bands tied to real gap
  positions, not a global sunburst.
- No golden-hour lens flare/bokeh overlays; light is geometry-driven only.
- No zoom/pan theatrics: near-static camera, all interest in silhouettes.
- Wren/silhouettes stay abstract cut-outs — no feather detail, no eyes.

## Eye-tracking map
1. entry: hedge rim line (brightest contrast, center-right)
2. shaft columns → grass pool where they land
3. wren perch (first moving silhouette, mid-frame)
4. snail leaf edge (frame right, during the quiet beat)
5. skylark diagonal exit → settle back on the hedge line

## Determinism
All motion closed-form f(t): hash seeds for blade/gap variation, smoothstep
envelopes per beat, no simulation state.
