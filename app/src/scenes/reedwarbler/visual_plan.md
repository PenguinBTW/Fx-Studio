# reedwarbler — visual plan

A reed-fringed drainage pond at warm noon. A sedge warbler works the reed
bed delivering food — darts, calls, dips to the nest — while a dragonfly
patrols the open water and a moorhen stalks the near bank.

## Composition (all flat silhouettes on the z=-2 plane)

- **Backdrop (BACK_FRAG)**: warm noon sky reflected as a pale blue-teal band
  across mid-frame water; reed-bed mass as a dark green band across the upper
  third; sun glitter speckled on the open water with a slow shimmer; near
  bank as a warm muddy strip at the bottom.
- **Reed bed (life-layer, ~60 stems)**: vertical stems from the bed line,
  darker tapered bases, thin feathery tops (3-wisp strokes). Sway via the
  shared LIFE_VERT wobble — a few near-camera stems get a wider `uWob`.
- **Willow snag**: one leaning bare branch over the right edge of the water.
- **Light**: one reed top catches a warm lift (env-pulsed uA); glitter cells
  twinkle on the water; midday = bright but still, no sun object in frame.

## Cast

- **Sedge warbler** (warm brown sliver): piecewise perch→dart→call→nest-dip
  loop between stems — visible hops along stem tops, one call beat (beak
  opens, throat puff read through a tiny shape change), a dip to the reed
  base (feeding), repeat once.
- **Dragonfly**: tiny silhouette on a slow oval patrol over open water.
- **Moorhen**: dark silhouette stalking the near bank once, head-bob gait.
- **Frog**: one ripple ring at the bank edge, brief.
- **Water boatman**: a tiny oar-stroke silhouette pulsing up to the surface.
- **Hoverfly**: hovers over the near bank — stationary jitter.
- **Floating leaf**: slow circle at the pond edge.
- **Fish-touch ripple**: one early ring set on the water.

## Motion language

Closed-form f(t) only. Warbler = piecewise sCurve segments on beat anchors;
perch stems selected from the seeded reed list. Drummer-style envelopes for
the call and nest-dip. Reeds sway by vertex wobble scaled per-stem. Rings
grow and fade as closed-form envelopes. No sim, no textures, hash seeds
(mulberry32) for stem placement, glitter seeds, and leaf orbit.

## Camera

CameraRig low near-static, slight drift across the pond so the reed row
parallaxes over the water. `textProbes` captions per act; `probe captions`
embedded in project.json entries.

## Beats

| act | window | caption |
| --- | --- | --- |
| i | 0–4.4s | NOON STILL — reeds, glitter, one fish-touch ring |
| ii | 4.4–9.6s | WARBLER — dart, call, first nest-dip |
| iii | 9.6–14.6s | DRAGONFLY — oval patrol, frog ripple, second dip |
| iv | 14.6–19.0s | MOORHEN — bank stalk, boatman pulse, hoverfly |
| v | 19.0–22s | SETTLE — warbler returns to a high stem, still |

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
