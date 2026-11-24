# willowwhisper — visual plan

A single massive willow at a river bend at dusk. The willow canopy fills the
top third with a swaying strand curtain; the water below is near-black with
drifting current streaks and one fading gold lane of last light.

## Composition
- Picture plane at z = -2, camera low (~0.45) at z ≈ 4.4, 62 mm lens.
- Top third: dark canopy mass (shader) + ~150 strand ribbons hanging down,
  three sway phases via per-vertex aFlex/aPh attributes — one draw call.
- Left: heavy trunk boughs leaning right over the water; right: exposed roots
  at the bank where a moorhen pokes. Low diagonal branch over the water right
  of centre is the kingfisher perch.
- Water below y = 0: streaks drift L→R, canopy reflection smear, gold lane
  fading with the dusk (uT envelope).
- One stray strand reaches the water and drags, trailing a thin wake.

## Colour script
Near-monochrome dusk — deep teal/black greens, dim apricot remnant behind the
far hedge. The only saturated accents are the kingfisher (teal back, orange
chest) and its silver fish glint.

## Light beats
- t<~14: dusk remnant (uT-driven `dusk` envelope) lights canopy tips gold and
  feeds the water lane.
- ~12.5: kingfisher splash — white-green ring + additive droplet points.
- ~15.5–17.5: bat crosses as the light dies.
- 19+: near-dark settle, moorhen pecks at the roots.

## Motion (all closed-form f(t))
- Strands: vertex-shader sway, tip-weighted (aFlex), 3 phase groups + gust env.
- Ducks: linear drift with bob; V-wake ribbons gated by a per-duck uDx uniform
  so the wake only shows behind the head and dissipates astern.
- Kingfisher: piecewise {glide in → perch → parabolic dive → submerged beat →
  burst back to perch → swallow toss}. Wing fan scales 0.12↔flap.
- Leaves: 4 seeded detachments, sway-fall, land on water → ring 3.
- Fish: one arc far right at t=8.4 with a ring.
- Rings: 4 shader annuli (splash / strand drip — recurring / fish / leaf),
  ages clamped ≥0, width clamped ≥0.01, gated by step(0.001, age).

## Camera
Near-static low drift (x -0.15→0.15, z 4.7→4.4) so the strand curtain
parallaxes over the water. No rack.

## Captions
i STILL DUSK · ii DUCKS CROSS · iii KINGFISHER · iv BAT PASS · v SETTLE —
each ≤ its act's span.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
