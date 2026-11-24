# dawnrookery — visual plan

A heron rookery waking in a flooded marsh at first light. 24s, 16:9, five acts.

## World

- Backdrop plane (z=-3.5): apricot→early-blue sky gradient; mirror water below the waterline (y=-0.85) — darker reflected gradient + seeded trunk smear + shimmer; drifting mist veils hugging the waterline; sun disc + halo rising into the last act; matching sun streak on the water.
- Trees: 7 drowned skeletons in two depth bands (far z=-3.25 lighter, near z=-2.65 near-black), upward limbs and twig tips; 6 stick nests at branch junctions (twig-bundle segment clusters). A mirrored copy of the geometry rides below the waterline with a wobble uniform — the reflection quiver.
- Herons: line-drawn silhouettes sharing one glyph — S-curve neck, beak, trailing legs, two wing fans pivoting about the shoulder. The vertex shader folds wings for perched pose, flaps them in flight (uFlight), sways the neck on perched head-tilts (uIdle), and shows the carried fish only during the hero's rise (uCarry). Each heron has a mirrored copy (uMirror) for its water reflection.
- Rings: expanding ellipse ripples under each landing, the hero splash, and two far-off fish-rises.
- Points: mist-bank sprites parting around the trunks, warm motes, hero droplets, two chick heads, a cyan kingfisher streak with trail, and a distant murmuration blob far right.

## Beats

| t | beat |
|---|------|
| 0–5 | still mist — motes, drifting banks, first fish-rise ring |
| 5–10 | three herons glide in on staggered arcs, flare, fold onto nests; landing ripples |
| 10–15 | hero rises from the water carrying a fish (droplets fall), lands; murmuration gathers far right |
| 15–20 | chicks pop on the hero's nest; kingfisher streaks across at 16.5; head-tilts everywhere |
| 20–24 | sun clears the rim — backdrop warms, water streak, warm rim on silhouettes |

## Camera

Slow drift along the waterline left→right past the trees; last waypoint settles and tilts up toward the sun. Global-progress path (t/24) — act-local progress would snap at every act cut.

## Seeds

`buildTrees(4177)` trunk/limb/nest layout, point cloud `mulberry32(9031)`; heron phase from `spec.seed`. All motion is closed-form f(t).

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
