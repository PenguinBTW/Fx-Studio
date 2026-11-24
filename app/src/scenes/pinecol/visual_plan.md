# pinecol — visual plan

A colonnade of tall pines in a forest clearing: angled light shafts through the
trunk gaps, a red squirrel working a cone, a woodpecker, a jay pass.

## Composition

- **Picture plane**: flat silhouette work at z=-2 over a full-bleed shader
  backdrop at z=-4 (sky glow, deep forest darkness, clearing floor texture).
- **Colonnade**: six tall trunks mid-frame — vertical ribbons with slight lean
  variety and darker bark edge ticks, spanning top to bottom of frame. The gaps
  between them read as pale light slots.
- **Clearing floor**: foreground band of grassy texture; scattered cones and a
  mushroom cluster at one trunk base; a single seedling catching the light.
- **Camera**: low, near-static; slight drift right and in so the trunk gaps
  parallax and the clearing deepens.

## Light

- **Shafts**: three additive wedges anchored in the trunk gaps, angled ~25°
  off vertical; azimuth drifts slowly with the light angle. Dust/pollen motes
  drift inside the shaft footprints.
- **Beat light**: the seedling sits in the widest shaft and lifts slightly as
  the shafts shift over it.

## Motion (all closed-form f(t))

- **Squirrel** (4–10.5 s): bounds in from the right on a hop curve, pauses at
  the light edge, darts to the cone, sits and works it — tail ribbon flicks
  (separate pivot), slight bob. Dashes up the nearest trunk and vanishes.
- **Woodpecker** (10–13.5 s): silhouette clinging to a trunk edge; drumming
  = rapid head rotation bursts; flies off right.
- **Jay** (14.5–16 s): one fast blue-dim silhouette crossing the colonnade.
- **Motes**: hash-seeded particles drifting inside each shaft, always on.

## Beats

still colonnade → squirrel visit → woodpecker beat → jay pass → settle
(22 s, five acts — see storyboard.md).

## Palette

deep forest green-black, bark umber, pale lime-white shafts, warm squirrel
umber-dark silhouette, jay cool slate.

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
