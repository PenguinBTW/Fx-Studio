# mushring — storyboard

Forest-floor macro at dusk. One camera move for the whole scene: a low lateral
dolly, like a small animal skirting the fairy ring. The single warm shaft of
last light rakes across the ring from canopy-right; everything else is dark.

## Camera

- Lens: 38mm-equivalent, low over the litter (~0.6 units up — macro scale).
- Move: `pos.x` drifts −1.6 → +1.6 over 20s with a gentle push in `z`;
  `aim` pans left so the dew web and the mossy log re-enter late.
- Focus: `depthDof` racks between targets — ring edge → web hub → ring
  centre → log — so the still is always critically sharp on the story.

## Beats

| t | beat | frame |
|---|------|-------|
| 0–5 | THE RING AT DUSK — establishing: four agarics of different heights, wart flecks on the domes, skirt rings on the stems, dew web catching the shaft at frame-left | f_0001 |
| 5–11 | DEW ON SILK — focus pulls to the web: silk strands + instanced dew beads lit by the shaft, caps soft behind | f_0006 |
| 11–16 | LIGHTS ON THE FLOOR — fireflies drift through the beam; a close firefly blooms on the hero cap; bokeh field | f_0012 |
| 16–20 | A SMALL KINGDOM — aim pans left, trunks and seedlings in the mid-field, the ring recedes into dusk | f_0018 |

## Light logic

- One 2700K directional = last sun; dual-shell additive cone + dappled floor
  pool make the shaft volumetric; dust motes seeded inside it.
- Cool rim from behind the web for cap-edge separation; small warm point
  "kiss" localizes the shaft pool on the ring caps.
- Fireflies are additive point sprites on closed-form lissajous paths; a
  closed-form pulse gate keeps them unsynchronized.

## Kit (assets/floor, Blender→GLB, 38.8k tris)

`ground` (displaced slab + moss cushions) · `ring` (4 lathed agarics + gill
slats + wart flecks + skirt tori, 3 boletus, 7 seedlings) · `log` (mossy
fallen log + ridges + snail + trail) · `web` (6 radials + 4-turn capture
spiral + 34 dew beads) · `ferns` · `blades` · `trunks` (background bokeh) ·
`litter` (leaf cards, twigs, acorns — near-camera lane kept clean).

## Determinism

Closed-form f(t) everywhere: camera, shaft sway, motes, fireflies, focus
rack. `seed_of()` string hashing for all geometry seeds; `hash1(i)` for
particle seeds. No sim state.
