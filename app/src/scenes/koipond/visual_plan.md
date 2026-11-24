# visual_plan — koipond

Koi gliding under lily pads in a garden pond at dusk. One 20s beat-driven
shot: glassy still → koi surfacing → frog plop → dusk gold deepening.

## Shot & metaphor

- **Framing**: top-down-ish macro of a dark pond surface (2.5D backdrop quad,
  like tidepools) — the pond is the whole world; the frame border is the
  garden edge.
- **Palette**: deep teal water centre → warm reflected sky (peach/amber) at
  the edges; olive-dark pads; koi = orange/white/black bands; dusk beat
  pushes the whole frame toward gold.
- **Light**: dusk gold backlight — specular kiss on ring crests, caustic
  shimmer on the pond floor, dappled light through the pads.

## Layers

- **Backdrop quad (GLSL3)**: water gradient, pond-floor caustic webbing,
  seeded drop rings from the willow, surface-kiss rings, plop ring at the
  frog beat, willow silhouettes at the frame border, dappled light patches,
  submerged koi shadows (driven by uniforms from the CPU-side koi paths),
  dusk grade.
- **Foreground instanced quads**: 5 koi (vertex S-curve tail wave, fragment
  body + tail + seeded pattern bands), ~14 lily pads (bob on the ripple
  field; seeded subset carries lotus blossoms), ~10 petal fragments, 4
  dragonflies, one frog silhouette on its own pad.

## Motion beats

| t | beat |
|---|------|
| 0–5 | glassy still: mirror water, pads bob, koi shadows glide beneath |
| 5–10 | koi surface: bodies brighten, wander paths carry them through dappled light; occasional surface kiss = ring + glint |
| 10–13 | frog plop: pad dips under the frog, it launches off, ring lands |
| 14–16 | one koi leaps briefly during the dusk beat — parabola, splash ring |
| 14–20 | dusk gold deepening + camera pull-back: full-pond reveal |

## Camera

Slow lateral drift following koi[0]'s closed-form path mid-scene, then a
pull-back (z out + slight pitch) revealing the whole pond for the dusk
reveal. No rig — manual PerspectiveCamera like the other 2.5D scenes.

## Invariants

- All motion closed-form f(t) on hash seeds — no accumulators, no RNG.
- Custom hero nodes publish screen-space bounds to `__motion.textProbes`
  (hero koi = the surfacing fish / leaper).
- `renderer.resetState()` after the pass; all GPU resources disposed.
