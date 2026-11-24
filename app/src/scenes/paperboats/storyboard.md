# paperboats — storyboard

| fig | t | shot | action |
|-----|---|------|--------|
| 01 | 0–8 | Low tracking, camera high-side right looking down-channel | Still wet street catching gold; curb drips bead→fall→plop→ring; first paper boat enters far at 3.5 s; sneaker crosses the near edge and splashes at 6.0 s (ring + droplets). |
| 02 | 8–16 | Camera settles onto the fleet, slow push | Boats bob on wavelets and tilt through eddy pockets; pigeon struts the curb; boat 3 snags on the leaf dam at 9 s — wiggle — dam gives at 13.6 s and the boat frees. |
| 03 | 16–24 | Tracking continues past the pinch | Cloud gap opens the sun lane: gold glint strip down the water; boat 5 heels on a gust and scoots ahead at 16 s; boats drift past camera; water settles as the lane fades 21–24 s. |

**Camera.** `CameraRig`, 48 mm lens; position tracks the lead boat's `boatZ` from high-side right (`x≈4.6, y≈1.85`), target rides just ahead of the lead boat on the channel centerline; a slow sinusoidal weave keeps it alive. The rig's waypoint spline is sampled from the same closed-form `leadZ(t)` used by the boats, so tracking never drifts.

**Continuity notes.** Rings, drips, boats, pigeon, sneaker, and splash all evaluate from `f.t`; scrubbing to any timestamp reproduces the same frame. Silhouettes (pigeon, sneaker) render on `NormalBlending` — additive light can't silhouette.
