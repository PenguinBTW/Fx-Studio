# Storyboard — lanternlit

Format: 16:9 · 60 fps · 24 s · one river valley, three acts, captions via project.json probes.

| # | Window | Shot | Camera | Key action | Text probe |
|---|--------|------|--------|-----------|------------|
| 1 | 0.0–8.0 | Wide dusk valley: ridge, arched bridge, tiered platforms, river | 58 mm, slow pan begins | first lanterns catch at the banks and rise on bobbing paths; reflections ignite | FIG.01 THE RELEASE |
| 2 | 8.0–16.0 | Dense cluster mid-sky | pan follows the drift right, gentle rise | lanterns cross over the bridge silhouette; smeared columns wobble below; krathongs drift the near bank | FIG.02 OVER THE BRIDGE |
| 3 | 16.0–24.0 | Sky thinning into stars | pan settles, slight push | distant lanterns fade into the star field; one large lantern crosses close with a bloom flare ~t20–23 | FIG.03 INTO STARS |

## Focal points
- Shot 1: enter on the left bank where the first lantern catches; exit tracking the cluster up-right.
- Shot 2: enter on the cluster as it clears the bridge arch; exit high-right as the sky thins.
- Shot 3: enter on the close lantern lower-left; exit on its bloom flare as the last distant lanterns become stars.

## Motion notes
- Everything is closed-form f(t): each vertex evaluates its own position from seed attributes; no sim state.
- Lantern bob is per-seed sinusoid + shared downwind drift; reflections reuse the same seed so the column wobbles in sync.
- Reflections are compressed and downward-fading — light on water, never a mirror.
- The finale lantern is a separate kind (4) with its own cap and halo envelope so it reads as a close pass, not a scaled-up clone.

## Verification stills
- t≈4.0 — first lift-offs, banks + bridge silhouettes, early reflections.
- t≈11.0 — dense cluster over the bridge, columns below.
- t≈19.5 — thinning sky + close lantern entering.
- t≈22.5 — bloom flare at peak.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
