# coralreef — visual plan


Shallow reef glade in morning light, ~18 s, fully procedural, closed-form f(t).

## World
- Water column: pale aqua → deep teal gradient, bright surface shimmer band at the top of frame, distant reef silhouettes on the horizon (GLSL backdrop).
- Sand plain: real 3D floor plane lit by animated fbm caustic webs + soft ripples; the glade reads as a sunlit clearing between coral heads.
- Coral heads: instanced tapered-cylinder growth — staghorn branches (recursive hash-seeded splits) and table corals (stalk + flattened canopy disc). Warm rust/violet/ochre palette per instance.
- Life: 3 instanced-billboard fish schools on closed-form weave paths between heads; anemone of instanced tentacle cones with a low-frequency sway field; hashed rising bubble spirals.
- God-rays: additive soft planes leaning from the surface, fbm-shimmered edges.

## Light
- Sun key through water: pale morning gold (≈5500 K) directional + teal ambient; rays pitch with the camera tilt.
- Caustics brighten the sand where rays land; coral bases sit in soft occlusion shadows baked into the shader tint (darker near sand contact).

## Camera
- CameraRig drift: z +24 → +7 gliding through the glade, gentle pitch up at the anemone beat (macro-feel), micro-roll drift.
- FOV 38 → slight push feel via dolly, no cuts.

## Beats
1. t 0–6: awakening glow — water brightens, caustics flicker awake, first school far off.
2. t 6–12: school crossing — three ribbons weave between coral heads across the glade.
3. t 12–18: close anemone drift — camera settles near the anemone head, tentacle sway + bubble spirals, rays overhead.

## Captions (Layer2D, low third, ducked)
- "morning over the glade" (1–4.5)
- "the schools cross" (6.5–11)
- "the anemone breathes" (12.5–17.5)

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
