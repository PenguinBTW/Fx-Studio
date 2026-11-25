# orrery — visual plan

## Concept
A mechanical orrery resting on a dark desk: concentric brass rings carrying
stone/metal planet spheres around a warm ember "sun". Craft metaphor — time
itself, rendered as turned brass and polished stone. Shot like a macro product
film, not a diagram.

## Medium decision
True 3D (mandated default). The concept is a physical object in a physical
space: PBR brass, veined marble, ember glow, real shadows, camera orbit. Any 2D
treatment would flatten the interlocking rings into a poster and is rejected.

## Composition
- Subject centred slightly low, filling mid-frame; desk plane anchors the
  bottom third; deep black backdrop.
- Sun sits on the upper third line (rule of thirds); planet_2 (largest) crosses
  the left/right thirds during the beat.
- Layered depth: foreground planet rim blur → mid rings/arms → sun → backdrop.

## Lighting
- Key: hard warm spot (~3100 K) high camera-right → long shadows, brass edge
  highlights.
- Sun: ember point light, breathing flicker, bloom bleed.
- Rim: cold ~7200 K directional from back-left → ring/gear edge separation.
- Fill: dim warm directional + faint ambient so shadows keep detail.
- Volumetric: soft additive shaft along the key axis + drifting dust motes.

## Materials
- Brass: brushed roughness breakup (procedural streak texture), clearcoat.
- Steel inlay rings + gear_1 for contrast.
- Planets: three procedural marble textures (moonstone grey, rust vein, sea
  marble) with polished clearcoat.
- Sun: emissive ember texture, molten turbulence + dark crust.

## Motion (all closed-form f(t))
- Arms and rings share a lane angle per planet — geared coupling reads
  mechanically true. ω = 0.34 / 0.21 / 0.125 rad/s with individual phases.
- Gear train counters at fixed ratios on the column.
- Planets self-spin while riding the arm tip.
- Ember light breathes; dust motes drift; shaft subtly pulses.

## Camera
Slow low orbit (yaw ~6°/s), pitch ~0.15–0.2 rad, radius 4.75 → 3.7 push-in over
the last 5 s. 58 mm lens, macro-product feel.

## Grade
Warm exposure, strong bloom thresholded on the ember, halation, shallow-radial
DoF focused near frame centre, vignette 0.46, fine grain.

## Captions
Three diegetic-free caption beats (bottom-centre, safe zone): title card, then
two poetic lines. All alpha-windowed, halo'd, telemetry-visible (textProbes).

## Beats
0–4 s establish + title → 5–11 s rings engaged, first caption → 11–15 s second
caption + push begins → 15–20 s push-in on sun, settle.

## Risks
- Lathe UVs needed for brushed-roughness map → generated in build.py.
- Tilted rings must wobble (baked tilt in mesh data, pivot on axis).
- Physical light intensities need still-iteration to land the dramatic key.

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
