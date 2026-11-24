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

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
