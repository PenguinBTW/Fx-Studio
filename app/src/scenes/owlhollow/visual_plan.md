# owlhollow — visual plan

A single barn owl glides through a moonlit hollow at night. One fullscreen
GLSL pass holds the whole shot — silhouette language, closed-form `f(t)`
everywhere, hash seeds only.

## Frame

- **Sky** (uv y 0.40–1.0): deep indigo gradient, sparse twinkling stars
  above y≈0.55, a large off-center moon (0.63, 0.75) with a soft layered
  halo and faint maria texture.
- **Barn** (left): solid dark silhouette — wall, gable roof peaking at
  x≈0.155, chimney to y≈0.60. A faint moon rim traces the roof edge.
- **Field** (y < 0.40): dark grass floor, a thin band of moonlit tips
  near the horizon, two fbm mist sheets drifting at different speeds.
- **Hedgerow**: ragged dark band just above the horizon line.

## Hero — the owl

Closed-form transit in four legs:

1. `t≈2.5–6.8` — glide in from the right, easing toward the bank point
   (0.55, 0.50). Slow wing beats.
2. `t≈6.8` — one banked turn over the mist. The silhouette tilts, the
   locked-glide wings hold, and the pale underside flashes warm as it
   catches the moon.
3. `t≈8.6` — dips to (0.20, 0.415), hidden behind the barn silhouette
   (barn is drawn after the owl, so occlusion is free).
4. `t≈10.0–12.5` — reappears climbing, faster beats, exits top-left.

Wings are distance-to-segment strokes with feather-finger tips; flap
amplitude collapses to a locked glide during the bank.

## Small life

- **Fence post** (x≈0.559): spider web of radial strands; when the
  `WEBGLINT` beat lands (t≈13.4) the strands shimmer and a sparkle pulses.
- **Swallow**: one fast streak right→left at t≈14.6.
- **Mouse**: a tail-tip wiggle at the grass line that vanishes (t≈16.2).
- **Fox bark**: implied by a caption — 'a fox barks far off'.

## Light

- Moon halo + disc are the key light; silhouettes carry a moon-side rim.
- Belly flash is a beat-gated plumage lift, not a second light source.
- PostOverrides: exposure 0.85, bloom 0.35, grain 0.07, vignette 0.50.

## Camera

`CameraRig` near-static: lateral position drifts with the owl's arc
(`owlX`), tiny push (`z 76→71`) during the web-glint beat, ~2% roll sway.

## Concept mapping

| Intangible | Physical stand-in |
|---|---|
| silence / stealth | locked-glide silhouette — flap amplitude collapses during the bank, no motion blur, captions carry the "no sound" idea |
| night | indigo gradient + single key light (moon); everything else is silhouette or rim |
| hunting intent | the transit path itself: wide circle, one bank, a dip that drops behind cover — the classic quartering pattern |
| the hollow sleeping | still mist, static barn, one fence post; life only appears as brief beats (swallow, mouse, distant fox) |

## Anti-cliché audit

- No moon-behind-clouds Gothic framing — the moon is a hard disc with a
  measured halo, not a fog blob.
- No lightning flash or thunderhead sky; the drama is one bird crossing
  a field.
- No horror beats (no glowing eyes, no shrieking sting); the owl is a
  neighbour, not a monster.
- Mist stays low and read as weather, not dry-ice fog swallowing the frame.
- Captions are plain narration, not displayed horror-movie title cards.

## Eye-tracking map

1. Entry: moon halo holds the top-right third; hedgerow + barn frame left.
2. t≈2.5–7: gaze follows the owl's silhouette right→center — the brightest
   moving shape against mid sky.
3. t≈7–9: the belly flash pulls the eye to mid-frame, then the dip drops
   it to the barn roofline.
4. t≈10–12.5: the climb reappears against open sky left of the barn —
   the eye tracks up the gap between barn and moon.
5. t≈13–15.5: attention settles to the fence post mid-frame where the
   web glint is the only new light source.
6. Tail: the eye rests on the mist line; small life beats (swallow,
   mouse) are peripheral.

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
