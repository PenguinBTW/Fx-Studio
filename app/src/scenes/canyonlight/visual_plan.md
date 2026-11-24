# canyonlight — visual plan

## Concept
A slot canyon at midday. The world is a single towering sandstone wall with a
thin slit of blown-out sky above it and a narrow debris-strewn floor below.
The subject is the light itself: god-ray shafts slanting down through the
slit, migrating as the sun arcs, while sand trickles off the wall face.

## Metaphor → mechanism
| Image | Mechanism |
|---|---|
| Towering sandstone wall | strata-banded fbm wall filling mid-frame, warm rust/ochre palette, edge shadowing |
| High slit of sky | narrow bright band ~uv.y 0.86+ with dust-haze shimmer |
| God rays | 4 wedge shafts through the slit, each on its own angle sweep + staggered window envelope; per-shaft shimmer fbm |
| Dust motes | hashed cell dots drifting down, visible only inside shaft intensity |
| Sand trickles | 6 seeded rivulets: faint stream line + 4 grains each on fall+bounce closed-form paths |
| Piles | gaussian dunes at each rivulet's base growing over the scene |
| Raven | one silhouette crossing the slit t∈[10,12.6], two-segment flapping wings |
| Rockfall | uRock-gated 9-pebble cascade from a ledge + fbm dust puff at landing |
| Wind gust | uGust: haze sweep, shaft wobble, faster motes, rig tilts up |

## Focal hierarchy
1. God-ray shafts (brightest, central diagonal motion)
2. Sky slit (the eye's exit — brightest static region)
3. Raven crossing (one-shot event inside the slit)
4. Rivulets + rockfall (small-scale motion low on the wall)
5. Strata/floor texture (backdrop)

## Cliché audit
- Avoided: orange-purple gradient "desert sunset" — this is hard midday: pale sky, saturated rust wall, near-white shafts.
- Avoided: particle-system dust — motes are hashed cells gated by shaft intensity, closed-form.
- Avoided: symmetrical V-canyon — single wall face keeps the slit as the only sky.

## Beats (20s entry)
0–7.5 quiet shafts → 7.5–12 gust (haze, wobble, tilt up) → 10.8–14 rockfall beat → 13+ shafts re-emerge brighter.

## Grounding check
All motion `f(t)`; every random is `h1`/`h21`; no sim state, no per-frame allocation; additive light only.

"Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL"
