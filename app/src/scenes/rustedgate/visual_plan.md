# rustedgate — visual plan

An iron field gate half-open on a farm track at golden hour; a robin holds
the latch while a tractor crosses the far field. One fullscreen GLSL pass.

## Composition
- Five-bar iron gate mid-frame, hinge post at `HX = 0.345`, hanging ajar
  ~6°→26° (closed-form `gateAng(t)`): breeze pushes it to a tuft catch at
  ~16°, holds 4→7 s, then swings wider 7→9 s, relaxes slightly at the settle.
- Track ruts converge through the gate gap (two dark lines, wet sheen);
  field + horizon band y≈0.60–0.64 with golden haze; hawthorn silhouette
  on the hinge side; faint hedgerow.
- Light is low from the left: warm sky gradient + off-frame sun glow, long
  gate shadows sheared across the ruts (same gate mask sampled in sheared
  ground space so the shadow moves with the swing), warm rim on bar edges,
  backlit dust motes drifting in the gap, a hinge glint that twinkles twice.

## Life
- Robin on the latch end of the top bar: tail-bob perch, two hops along the
  bar, flies off ~9.5 s, returns ~12.5 s.
- Distant tractor crosses the horizon strip 3→17 s very slowly — cab, hood,
  big rear wheel; dust puff trailing; one glint as it turns ~11.2 s.
- Pheasant burst near frame left ~10 s (fast diagonal rise); two crows drop
  onto the gate top 13→14.6 s; a small dog runs down the track ~15 s.

## Beats
still gate (0–2.5) → breeze swing → robin visit (5–) → pheasant burst (10) →
crows (13) → dog (15) → settle (16.5+).

## Camera
CameraRig low near-static; a slight drift through the gate gap keyed to the
same `gateAng` so the push tracks the swing. Anchored captions via Layer2D;
the canvas textProbe hook records them.

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
