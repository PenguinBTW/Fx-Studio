# harborfog — visual plan

A small fishing harbor swallowed in rolling dusk fog. Dark mirror water carries
4–5 moored boat silhouettes; only their deck lamps, a blinking mooring buoy and a
far-left lighthouse beam break the murk.

## Composition (world space, y up; waterline y = -0.55)
- Sky: deep slate-blue dusk, warm lamp glows bleeding through fog.
- Water band: y < waterline — dark mirror with lamp smears + beam glints.
- Boats: 5 moored hulls, taper-ribbon silhouettes with masts; gentle roll on
  the swell (per-boat phase), lamp reflections smear on the water.
- Breakwater: low dark line across the back of the harbor.
- Fog: two semi-transparent drifting bands at different depths/speeds, plus a
  shader mist gradient — fog thickens during the opening beat.
- Lighthouse: far-left tower silhouette + rotating beam quad (angle f(t));
  beam brightens when crossing the fog band, leaves a water glint when low.

## Beats (24s, 5 acts — CameraRig near-static drift)
1. `fog thick` (0–4.8s): lamps off, boats half-swallowed by drifting fog.
2. `first lamps` (4.8–9.6s): deck lamps warm on one by one; buoy blink starts.
3. `beam sweeps` (9.6–14.4s): lighthouse beam crosses the harbor, fog ribbon
   flare, gull revealed on its post during the pass.
4. `cormorant` (14.4–19.2s): bird silhouette skims low over the water once;
   foghorn caption lands.
5. `swell settles` (19.2–24s): rocking damps out, fog keeps drifting, lamps
   hold — harbor asleep under the sweep.

## Tech
- All motion closed-form f(t), hash seeds, no sim.
- Boats/lamps/beam drawn as DoubleSide tapered-triangle Meshes + additive
  points; reflections clip at the waterline (dawnrookery lessons).
- Ripple rings keep top arc at/below the waterline; hero meshes
  frustumCulled=false; probe captions + textProbes; CameraRig with
  ctx.updateCamera(t, t/DUR).

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
