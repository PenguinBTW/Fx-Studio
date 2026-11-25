# fernhollow — visual plan

## Concept
A forest-floor hollow at golden hour, seen at snail scale: a macro world of fern fronds
arching overhead, drifting spores catching volumetric canopy light, deep physical
depth-of-field isolating a snail traversing a mossy log in the foreground.

## What it demonstrates that the catalog does not
- Interior/macro staging: every catalog scene is an open landscape; this is a
  ground-level interior world with layered overhead canopy.
- Physical thin-lens depth of field as the primary compositional force.
- AnalyticalParticles as *bokeh-resolved* motes — near-field spores blow out into
  discs of confusion, far-field ones stay sharp.
- Blender-pipeline assets: fern fronds (procedural frond builder) and a rigged,
  animated snail (glide cycle) authored in Blender, never hand-keyed in code.

## Style guidance applied (from user steering history)
- brookside lesson: the subject must belong in its environment — snail/ferns/spores
  are all plausible co-inhabitants of one damp hollow.
- forge lesson: no sci-fi UI clutter, no synthetic chrome — pure naturalistic materials,
  moss/soil/bark palette, restrained warm key.
- Terrest lesson: keep the camera motivated and slow; no unmotivated spins.

## Palette / light
- Key: low warm sun shafts through canopy (amber #f5c873), cool shade fill (#3a4a3f).
- Dominant greens: deep moss #2e4a2c, mid fern #4a6b3a, lit frond tips #8fae5a.
- Bokeh discs warm against cool shadow ground.

## Movement
- Camera: one slow, continuous creeping dolly at snail height along the log,
  rack focus from snail → mid-frond → spore field and back. Closed-form rig path.
- Snail: Blender clip "glide" — deterministic looped pedal wave.
- Spores: analytical drift + curl, zero accumulators.
- Ferns: gentle analytic sway, phase-offset per frond.
