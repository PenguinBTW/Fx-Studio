# Storyboard — frostbloom

Format: 16:9 · 60 fps · 24 s · one pane, three acts, captions via project.json probes.

| # | Window | Shot | Camera | Key action | Text probe |
|---|--------|------|--------|-----------|------------|
| 1 | 0.0–8.0 | MCU of dark windowpane, city bokeh floating behind glass | 52 mm, z 26→24.5, near-static | seed glints spark at frame edges; first dendrite arms bud at the corners ~t2.6 | FIG.01 FIRST FROST |
| 2 | 8.0–16.0 | Pane half-frosted, arms racing inward | slow macro push z 24.5→21, gentle drift toward the densest growth | filigree side-branches fill; tip glints ride the growth front; indigo begins lifting ~t13 | FIG.02 THE CREEP |
| 3 | 16.0–24.0 | Full bloom rimmed peach | z 21→19.5, settle on the brightest cluster | dawn rim climbs bottom-right; breath-fog swells ~t19.5 and recedes ~t21.5 revealing fuller bloom | FIG.03 DAWN |

## Focal points
- Shot 1: enter on the lower-left frame edge where the first seeds spark; exit drifting up-right along the budding arm.
- Shot 2: enter where shot 1 left the lead arm; track the growth front inward, exit near centre as the lattice meets.
- Shot 3: enter on the brightest bottom-right cluster catching rim light; exit settling on the densest bloom as the fog recedes.

## Motion notes
- Everything is closed-form f(t): vertex reveal is `aBirth`-gated in the vertex shader; no sim state.
- Six-fold tendency only — side-branches at ±60° with jitter so the ferns read grown, not stamped.
- The fog beat is a separate veil quad (uFog envelope); it must soften, never white out — peak alpha ≈ 0.85 × fbm wisps.
- Bokeh never sharpens — it melts (alpha × color) toward pale morning as `uDawn` rises.

## Verification stills
- t≈4.0 — seeds glinting, first corner arms budding, cold palette.
- t≈12.0 — mid-creep: visible growth fronts, filigree density.
- t≈18.5 — dawn rim + fuller lattice.
- t≈20.5 — fog at peak swell (crystals veiled).
- t≈23.0 — fog receded, full bloom in warm light.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
