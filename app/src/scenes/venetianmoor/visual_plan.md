# venetianmoor — visual plan

A narrow Venice canal at blue hour, seen from a low vantage near the waterline:
weathered facades close the frame left and right, marble steps drop into the
canal at the near-left, a moored gondola swings gently mid-frame, and a
wrought-iron lamp on the right corner throws a long smear of gold onto the
water. The canal corridor recedes to a dark arch bridge.

## Palette & light

- Blue hour base: deep blue-teal water `#0d1826`→`#182633`, slate-dusk sky
  sliver, near-black silhouettes.
- One warm source: the corner lamp — gold `#ffb050` glow + a smeared column
  reflection band on the water, breathing with the flare beat.
- Counterpoint: a faint cool blue wash from an upper-left window; one hanging
  lantern ember under the arch.

## Geometry (authored uv, single backdrop quad)

- Corridor convergence: `wallL(y)=0.30+0.13·ss(0,0.62,y)` mirrored on the
  right — facades pinch inward with height so the canal recedes upward.
- Steps: five bands descending into water `x<0.335, y<0.30`.
- Bridge: deck line at `y≈0.64` with an arched opening beneath, centered at
  `x=0.545`; parapet posts along the deck.
- Gondola: crescent hull at `(0.475,0.335)` + upturned prow + mooring rope to
  a right-wall cleat + a faint reflection streak.
- Lamp: post + lantern head at `(0.685,0.545)`, glow disc `exp(-d²·900)`.

## Motion (all closed-form f(t))

| t (s) | beat |
|---|---|
| 0–3.5 | still water: base ripple wobble, slow debris |
| 3.5–7.5 | lamp flare pulse `uFlare` — glow + smear + camera push 1.6 |
| 7–12 | gondola swing energy `uSwing` swells; pigeon perched on the lamp (5–9.8) |
| 11.5–14.5 | gondolier silhouette crosses the bridge `uCross` |
| 15–16.2 | rat darts across the steps `uRat` (dart-pause profile) |
| 17.5–18.6 | cat tail-tip slips down the right alley edge `uCat` |
| 16–20 | settle: debris drift eases (`uDrift`), flare gone |

Camera: very low, near-static — `x = -1 + 1.4·sin(0.07t)` drift for facade
parallax, `z = 30 - 1.6·uFlare` rack-pinch on the flare.

## Craft notes

- Facade texture from `n2` coursing + `fbm` damp streaks; windows are a hashed
  recess grid with bar cross-lines, masked to `y>0.6` so they sit above the
  canal line.
- Smear is a Gaussian column whose center is displaced by two ripple sines —
  it sways as the surface moves rather than being static.
- Silhouette pieces (gondolier+oar, rat+tail nub, pigeon body+head, cat tail
  taper) are bounded segment/distance shapes — no loops, no sim.
