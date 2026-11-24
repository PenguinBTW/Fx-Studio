# dawnmist — visual plan

A misted mountain lake at first light, one lone rower crossing the calm.

## World & staging

- **Frame geography:** horizon sits at ~52% frame height. Above: layered
  hill ridges (3 receding silhouettes, fbm-edged, haze-faded with
  distance) into a grey-violet → pink-gold sky. Below: mirror-calm water
  reflecting the sky gradient, hills, and a widening sun-glint lane.
- **Mist:** two fbm bank strips hugging the surface at different heights,
  advected by an integrated drift uniform (monotone — no backward slide),
  plus a thin high veil over the ridges. Density burns off late-scene.
- **Water:** mirrored sky sampled at the reflected height, darkened toward
  the far shore, faint hill-reflection streaks, slow horizontal ripple
  bands, sun-glint lane (gold column widening toward camera, fbm shimmer).
- **Life:** rowing boat silhouette crossing right→left on a closed-form
  path; oar stroke cycle dips blades, each dip seeds a spreading ring and
  the hull trails a two-line wake. Five ducks in a shallow vee cross during
  the mist-part beat. Two fish-rise ring sets on calm beats. Reeds sway on
  the near edge.
- **Camera:** CameraRig, slow lateral drift partially tracking the boat's
  world position mid-scene plus a gentle push; target eases up with gold.

## Palette

- Pre-dawn: grey-violet sky (0.24,0.23,0.30) over slate water.
- Dawn: horizon pink-gold (0.98,0.62,0.32), sun disc (1.0,0.72,0.38),
  glint lane gold-orange, hills cool blue-grey fading to haze-mauve.
- Mist: neutral grey early, warm (0.95,0.78,0.60) as gold rises.

## Beats (t, seconds)

| t | beat |
|---|------|
| 0–2.5 | awake fade: grey mist, moon remnant |
| 3.2 | fish rise, first rings |
| 4–7 | uGold: sun clears ridge, glint lane develops |
| 6–15 | boat crossing: strokes, wake, dip rings |
| 14.5–18 | duck vee crossing during mist part |
| 15–19 | uBurn: mist burns off, far shore reveals |
| ~16.7 | second fish rise |

## Determinism

All motion closed-form `f(t)`; seeds via `h1`/`h21` hashes; `uDriftI` is a
monotone integral for mist advection; no sim state.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
