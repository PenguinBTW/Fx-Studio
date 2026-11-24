# cindercourt — visual plan

A medieval castle courtyard at dusk: flagstones, three walls of rough stone, a
wooden gallery of black arches, a stone well at centre. One wall torch kindles
early and becomes the scene's light engine; a lone sentry carries a second
point of warmth along the parapet. Small night-life beats (raven, cat,
pigeons) punctuate the settle.

## Concept mapping

| spec element | shader realisation |
| --- | --- |
| flagstone courtyard | `floorAt` — running-bond joints, rows widening toward camera, worn arcs |
| stone walls ×3 | `backWallAt` + `sideWallsAt` — `stone()` block noise, sloped tops, depth darkening at edges |
| wooden gallery, dark arches | arch-band mask on the back wall: `fract` cells + parabolic tops over a beam line |
| central well + rope | `wellAt` — drum box, rim course, dark mouth ellipse, posts, gable silhouette, crossbar + hanging rope |
| guttering wall torch | `TORCH` const — bracket, two-band `vn2` flicker flame, cast wash on wall + pool on flagstones |
| parapet banners | `bannerAt` ×4 — hang-parameterised strips, gust-driven sway, one ragged-tail rip |
| sentry | `sentryX` (walk–pause–walk) + `figureAt` silhouette + warm torch dot |
| raven on crossbar | perch silhouette + short inbound flight arc |
| gallery cat | thin body/head/tail silhouette crossing under the beam |
| pigeons settling | two arc-landings onto the merlon tops on the settle beat |
| blue window glow | breathing `boxm` + halo upper-left of the back wall |
| doorway exit glow | `doorOpen`-gated warm box at the parapet's right end |
| sky sliver | narrow `skyAt` band — slate top, amber seam on the crowns, sparse stars |

## Anti-cliché audit

- No fireflies/magic particles: every light source is diegetic — wall torch,
  sentry torch, window, doorway.
- No glowing rune/geometric decoration; banners are worn cloth, not sigils.
- No symmetrical postcard framing: well sits dead centre but the torch pool,
  doorway and window all live off-axis so the frame weight drifts right.
- No generic "epic" teal-orange grade: the palette is smoke-blue + ember
  against near-black stone, keyed by a single warm source.
- No overscored motion: the biggest kinetic event is a small man walking.
- Mist/fog is confined to floor falloff, not a blanket bloom haze.

## Eye-tracking map

| beat | intended fixation |
| --- | --- |
| 0–2s | centre: well silhouette against the arch band |
| 2–5s | right-of-centre: the kindled torch pool grows |
| 5–9s | top edge: sentry + torch dot enters left, tracks right |
| 9.8–12.6s | centre: raven drops to the crossbar (camera pushes 2u) |
| 13.6–16s | gallery line right: cat cross, then pigeon landings |
| 16–18s | doorway glow right — sentry gone, courtyard settles |

## Palette

- sky sliver: `(0.016–0.048, 0.018–0.042, 0.036–0.065)` + amber seam `(0.22,0.09,0.03)`
- stone: `0.03–0.06` greys, mortar at 55%
- torch/window/door: warm `(0.85–1.0, 0.42–0.72, 0.15–0.30)` vs cool window `(0.10,0.16,0.28)`
- banners: muted `0.05–0.19` reds/blues at dusk

## Beats

still courtyard → torch kindles (2.2s) → sentry walk with mid-wall pause
(5–13.4s) → raven visit (9.8–12.6s) → cat + pigeons settle (13.6–16.5s) → calm.

Camera: near-static low shot; `lift` drift raises eye ~2.6u toward the parapet
through the walk, eases back on settle; a 2u push lands the raven beat.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
