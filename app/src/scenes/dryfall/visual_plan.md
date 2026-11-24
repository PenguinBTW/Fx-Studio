# dryfall — visual plan

A canyon wall at hard noon. A dry waterfall — just a dark mineral stain where
water used to run — drops the full height of the face. A fallen log spans the
gap at mid-height, and a hiker silhouette picks his way across it with one
stumble-and-recover. Ravens ride thermals off the rim.

## Composition

- **Sky** — pale bleached noon blue with a warm haze hugging the rim line.
- **Canyon wall** — layered sandstone strata (horizontal bands, hashed grit,
  seam shadows at band edges), warm crown light at the top.
- **The dry fall** — a vertical mineral stain (~0.5 world units wide) snaking
  slightly down the face, mottled dark, with a narrow wet-look sheen at its
  centre. The "waterfall" is memory, not water.
- **Ledge shelves** — two lit slabs at mid-height (left ends at x=-0.85,
  right begins x=1.05) with a hard shadow band directly under each lip.
- **The log** — weathered grey, sagging slightly between the shelves, broken
  splinter ends, bark striations, one stub branch.
- **Canyon floor** — pale gravel; a faint heat-shimmer band crawls just
  above it.
- **Rim** — the wall's top edge; ravens orbit above it, a pigeon bobs on it.

## Motion beats (19 s)

| t        | beat |
|----------|------|
| 0–3.5    | still ledge — ravens circling, pigeon bobbing, shimmer |
| 3.5–9.6  | hiker enters → careful steps → stumble at mid-log → far shelf, exits |
| 9.6–13   | raven 2 peels off its orbit, lands on the log end, lifts off |
| 13–16.4  | lizard dart · tumbleweed rolls bottom frame · dust devil wisp |
| 16.4–19  | settle — ravens still circling, pigeon, shimmer |

## Camera

55 mm, near-static, ~4.8–5.0 from the picture plane. A gentle push-in tracks
the crossing and relaxes back afterward. Targets hover on the log's midpoint.

## Honest constraints

- Flat silhouettes on the z=-2 plane; canyon is a fragment-shader backdrop.
- The hiker reads through pose, not detail: torso pitch on the stumble, a
  separate arm mesh that windmills, one stepping leg.
- All motion is closed-form f(t); seeds via mulberry32. No simulation.
