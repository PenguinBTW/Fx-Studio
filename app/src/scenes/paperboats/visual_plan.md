# paperboats — visual plan

**Subject.** Paper boats drifting down a rain-washed gutter at golden hour, just after a storm has passed. Intimate, street-level, nostalgic.

**Palette.** Storm-clearing rose→indigo sky; wet pavement in near-black blue-greys; long raking gold light from the low sun on the right; pink-cloud reflections in puddles; warm cream paper boats; brown leaf dam; dark silhouettes for the pigeon and the sneaker.

**Composition (16:9, ground-level camera).**
- Frame bottom 2/3: the street — pavement slabs left and right, a raised pale-stone curb band along frame right, and the gutter channel running into depth slightly left of center.
- Frame top third: backdrop quad — clearing sky with drifting storm-remnant cloud banks, rooftop/tree silhouette at the horizon, sun burn low right.
- The gutter water is the hero: flow streaks advected downstream, seeded eddy swirls at stone gaps, oil-slick rainbow patches, and a sun-lane glint strip that ignites when the cloud gap opens (~15.5–21s).
- Five paper boats ride the channel on a closed-form flow field; the tracking camera rides low behind the lead boat.

**Beats (24 s).**
1. `0–4` Still water, curb drips feeding rings, gold light; first boat enters at 3.5 s.
2. `6.0–6.7` Kid's sneaker silhouette crosses the near frame edge and splashes a puddle — ripple ring + droplet burst.
3. `7–23` Pigeon struts along the curb top.
4. `9.0–13.6` Boat 3 snags on the leaf dam at the pinch — wiggle envelope — then frees as the dam gives.
5. `16.0–18.5` Boat 5's sail catches a gust — heel + scoot ahead.
6. `15.5–21` Sun-lane glint down the channel as the cloud gap opens.

**Method.** Closed-form f(t) throughout: boats ride `boatZ(t)` (wavelet surge + per-seed speed), boat 3 pauses its clock inside the snag window (`snagClock`), lateral offsets come from `eddyX(z, seed, t)` over five seeded gap pockets. No simulation state. Rings are a uniform array fed each frame from the same closed-form drip cycles evaluated in JS.

**Skill deps:** fx-scenes (CameraRig, defineScene, layered motion), fx-procedural-modeling (GLSL fbm/voronoi staging).
