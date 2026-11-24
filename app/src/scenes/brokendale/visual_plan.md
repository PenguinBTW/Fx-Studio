# brokendale — visual plan

A derelict stone bothy in a high dale at dusk. One fullscreen GLSL pass.

## Composition
- Hill edge `hillAt(x) = 0.66 − 0.22x`: slope falls left→right into a dark
  valley band (uv.y < 0.47). Dusk sky above, deep blue → slate at horizon.
- The ruin at mid-frame: standing gable x 0.58–0.68 (ragged top ~0.86),
  chimney stump on its west corner, collapsed end-wall stub x 0.50–0.585,
  8 seeded spilled blocks downhill. One window hole = pure darkness.
- Dry stone wall line crosses the slope (0.04,0.645)→(0.52,0.545).
- 14 seeded heather clumps on the slope; two mist ribbons on the valley
  floor drifting left; one faint star fades in after t=12.

## Light
- Last light = warm thin rim (`1 − sstep(0, 0.007, gt − uv.y)`) hugging the
  gable top edge and chimney — the only warm note against the dusk palette.
- Sky gets a faint warm haze low-left (sun already down).

## Life
- 3 sheep silhouettes: sheep A head-lift 3.5–4.7s, sheep C walks the slope
  6–10s past the ruin. "baa" caption mark at 3.6–4.4s.
- Hare: 3-hop bound through heather 8.5–10.1s (|sin| arc).
- Curlew: valley-band crossing 10.5–12.9s, slow flap + decurved bill.
- Raven: one circle around the chimney stump 12.5–15.1s.
- Mist ribbons, heather gust stir at t=7.

## Beats
still ruin (0–2) → sheep graze + head lift (2–5.5) → gust/hare (7–10)
→ curlew + raven (10.5–15.1) → settle (15.5+).

## Camera
CameraRig: low near-static, drifts up-slope toward the gable over 2–14s,
small push as the raven circles. Captions anchored via Layer2D, bounds
published to `__motion.textProbes` under `P.probe`.

All closed-form f(t), hash seeds only, no simulation state.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
