# snowsquall — visual plan

A slate-dusk village rooftop line is swallowed by a fast snow squall
front, then re-emerges. One 20s closed-form shot, near-static camera.

## Beats

| t (s)   | beat            | image                                                              |
|---------|-----------------|--------------------------------------------------------------------|
| 0–4     | calm windows    | rooftop row readable, warm windows, cat slips a roofline, thin snow |
| 4–10    | the front       | whiteout wall crosses left→right over ~6s, houses dissolve in order |
| 9–12    | whiteout peak   | near-total white; only near-layer flakes + lamp glow survive        |
| 12–16   | thinning        | hooded figure crosses the lamplit gap; rooftops ghost back in       |
| 16–20   | settled snow    | row re-reads through steady snow; church window smoke signal        |

## Staging

- Backdrop = one GLSL3 quad: dusk sky gradient, procedural rooftop row
  (7 hashed houses + church spire + sagging power line), window rects
  with flicker, chimney smoke torn sideways, lamp pool, and the squall
  veil itself (fbm stripes advancing as a front with trailing haze that
  thins behind it).
- Foreground = instanced quads: ~900 flakes in 3 depth bands (far fine
  fast / mid / near big slow) with wind drift + gust surges, 60 rooftop
  snow-kick streaks gated to gust pulses, one hooded-figure quad, one
  cat quad.
- Squall model: front position fx(t) sweeps 0→1 over t≈4→10; veil
  intensity = entry edge smoothstep × fbm gust stripes, modulated by a
  global thinning envelope peaking ~10–12s then releasing.

## Palette

Cold slate blues + zinc whites, warm sodium windows, dusk peach rim low
on the horizon. Contrast vs emberdrift's warm fire palette.
