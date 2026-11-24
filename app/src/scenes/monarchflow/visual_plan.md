# monarchflow — visual plan

A dusk meadow with a monarch swarm streaming through it in five beats:
empty field → first strays → swarm ribbon → dispersal → hero landing.

## Composition
- **Backdrop** (GLSL3 quad, PW×PH world panel): orange→purple dusk gradient;
  low sun wafer; far ridge with a deer silhouette (calm beats); layered
  grass + milkweed silhouettes (near layer taller, seed heads as lobed tips);
  birds crossing high once during the swarm beat.
- **Swarm** (InstancedMesh, ~300): procedural monarch shader on a folded
  plane — body along local Y, wings = elliptical lobes ±X, black veins +
  white border dots, orange field. Per-instance braid lane (3 strands),
  wingbeat envelope, gust-density gating, perch-lift arcs; positions closed-
  form on a braided ribbon entering low-right, snaking left, dispersing
  upward/outward after t≈12.
- **Hero** (same shader, single mesh): slow wingbeat close to camera, flies
  to a foreground milkweed head (small instanced cluster), lands, bobs.
- **Seeds** (~40 additive motes): backlit drifting fluff.

## Envelopes (all ss() closed-form)
straysT 3–6 · swarmT 5–12 (density crest ~8.5) · disperseT 12–17 ·
heroT 13.5–17.5 · calmT 0–4.5 & 17–20 (deer) · gustT periodic swells 6–11

## Camera
Track the ribbon L→R during the swarm beat (lateral pan + slight parallax
ease), then drift/push to the hero's milkweed head for the landing; settle.
