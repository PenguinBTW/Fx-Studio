# visual_plan — millridget

## Concept

A lone smock windmill on a low grassy ridge at dusk. The day's last light rakes
the ridge; the mill's four lattice sails turn slowly above a field of wind-stirred
grass; a murmuration of starlings crosses the sky once, high overhead. The mill's
single window glows warm — someone is home as the light fails.

## Medium decision — why 3D

This subject is inseparable from parallax: a tapering octagonal mill body, sails
rotating on a slanted axis, grass in true perspective, a flock sweeping across
depth. A 2D read would flatten the ridge, the sails, and the sky into bands —
exactly the failure mode the new standard rejects. The smock-mill silhouette is
built to be seen against a low sun with a shadow; 3D is the honest medium.

## Conceptual Mapping Table

| Beat | Mechanism | Reads as |
|------|-----------|----------|
| Ridge | closed-form heightfield `ridgeH(x,z)` — smooth low dome | a real landmass, not a horizon line |
| Mill | Blender GLB: octagonal smock body, cap, 4 lattice sails, tail pole, door, emissive window | man-made mass against sky |
| Grass | 3500 instanced cones, hash-swayed in vertex time | a living field |
| Starlings | 160 instanced bird quads on a murmuration ribbon — centroid arcs -x→+x over 7s | a travelling flock |
| Dusk | BackSide sky dome: vertical gradient + warm band toward sun + hash stars | late hour |
| Light | 2600K directional sun (raking), 7500K hemisphere, emissive window + warm PointLight | golden-hour physics |
| Sail turn | `rotation.z = t*0.42 + gust pulse`, single closed-form | a working mill, not a prop |

## Anti-cliché audit

- No flat-gradient background card: the sky is a real sky dome with sun-side warmth.
- No silhouette bands: grass is instanced geometry with per-instance height; terrain
  is a displaced plane with vertex-color variation.
- The flock is not a V-formation stamp: it is a curled ribbon whose density and
  centroid move with time — a murmuration, not an arrow.
- The mill is not a sprite: it is a GLB with 6.5k tris, named parts (`sails`,
  `body`, `cap`), and its sails actually rotate about their hub axis.

## Focal hierarchy

1. The mill (always mid-frame, orbit drift holds it).
2. The murmuration (second focal layer — only during t∈[6, 12.5]).
3. The ridge + field (context, carries the raking light).

## Determinism

Everything is f(t): grass sway, sail angle, gust envelope, flock path, star hash.
No simulation state. All layout seeds come from the shared `hash` helpers.

## Beats

still mill → flock pass → gust on sails → light settling → quiet dusk.
Text probes record flock count, sail angle, gust weight for diagnostics.

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
