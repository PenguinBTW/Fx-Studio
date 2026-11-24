# cavernecho — visual plan

A limestone cavern with a dripping pool and a beam of cave-mouth light.
24 s, 16:9, three acts. Everything is closed-form f(t) — hash seeds via
mulberry32, no sim state.

## Visual system

| Layer | Implementation |
|---|---|
| Cavern walls | backdrop frag: near-black limestone gradient, seeded stalactite columns hanging from the ceiling edge and stalagmites rising from the floor band, layered darker near the camera; wet-rock sheen as fbm specular streaks aligned with the shaft |
| Cave-mouth shaft | backdrop frag: diagonal beam from upper-right (soft-edged rotated band, warm pale glow, distance falloff), faint mouth bloom at its origin off-frame |
| Dust | points cloud kind 0 (~40): motes drifting down the shaft direction, additive, faint warm, hash-seeded phase |
| Droplets | points cloud kind 1 (~14): seeded stalactite tips, closed-form cycle gather → parabolic fall → plop → rest; bright bead grows at the tip then falls as a streak |
| Pool | separate band quad: dark still water, mirror-sheen of the shaft, 8-slot ring uniform array — each ring a world-projected foreshortened ellipse that cross-cuts (dims) older rings it overlaps |
| Bat | kind 2 (1): silhouette sprite crossing the shaft once at t≈11, wing-beat envelope (NormalBlending — additive can't silhouette) |
| Salamander | kind 3 (1): dark elongated shade scuttling the floor band during the quiet beat, NormalBlending |

## Beats

| t | Beat |
|---|---|
| 0–8 | hush + drips — shaft, sheen, sparse droplets |
| 8–16 | bat pass (t≈11) → multi-drop chorus (drip rate peaks) |
| 16–24 | deepest quiet — drops thin out, salamander shade (t≈20) |

## Focal points

1. The shaft — every light element is organized around it (dust, sheen,
   pool mirror column, the bat's crossing).
2. The pool edge — rings and mirror-sheen anchor the lower third.
3. The bat — a single silhouette at mid-scene is the narrative peak.

## Camera

CameraRig 50mm, slow creep toward the shaft (dolly in + slight pan
right), settling on the pool edge for the quiet beat.

## Verification

Stills at t=4, 11 (bat), 18 (chorus/quiet transition), 21 — embedded
in the PR.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
