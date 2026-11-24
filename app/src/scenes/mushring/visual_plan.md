# mushring — visual plan

## Concept
Forest-floor macro at dusk: a fairy ring of mushrooms seen from a few
centimetres off the litter. One warm shaft of last light rakes through the
canopy and lands on the ring; dew beads on a spider's web strung between
two stems catch it; fireflies drift above the moss. The world is built at
small scale and framed with a macro lens — shallow real depth-of-field,
slow lateral dolly.

## Why 3D (and why it must be dense)
The whole idea is miniaturised texture: gill lines under caps, speckled
Amanita warts, dew spheres, slime sheen on the log, leaf-litter depth.
Faceted primitives would read as toys — every hero mesh gets subdivision,
bevels and vertex-colour breakup; nothing ships as a raw box or a
low-segment cone.

## Medium defence
Real 3D (orchestrator's default): macro depth + specular dew + DoF only
work in 3D. A stylised 2D take could not carry bead-glint, gill rims or
bokeh.

## Assets — Blender GLB kit `assets/floor`
- `ring` — the fairy ring: ~11 mushrooms on an arc, three species:
  - **fly agaric** (hero): lathed red cap with margin lip, white wart
    speckles (small icos scattered on the cap dome), separate gill disc
    (thin radial slats) under the cap, cream stem with a skirt ring.
  - **boletus**: thick dome cap, smooth tan, fat pored stem (pores hinted
    by a dark cap underside disc).
  - **oyster**: fan shells in a cluster off the log.
  - tiny seedling buttons (caps on pins) scattered near the ring.
- `web` — spider web between two stems: radial + spiral curve threads
  (thin tubes), ~40 instanced dew beads on the spiral; two hub-anchor
  threads to the stems.
- `log` — fallen log: displaced cylinder with moss patches (ico blobs),
  bark ridges (vcolor banding), a slime sheen strip (low-roughness
  material zone along the top).
- `ferns` — 5 frond clumps at camera height: tube midrib + leaflet
  rows (stretched icos), two depths (sharp near, soft far for DoF).
- `litter` — instanced leaf litter field: curled leaf cards (bent quads),
  tiny twigs, seed pods; a mossy ground slab the ring sits on.
- `blades` — grass blades at lens height, foreground bokeh fodder.

## Light + camera
- One warm shaft (dual-shell cone + floor pool + dust motes) raking from
  canopy-right at low angle — the ring sits in it.
- Ambient: deep dusk blue-green; rim from the shaft side; dew beads get a
  hot specular pop.
- Macro camera: fov ~35, near-parallel to the litter, slow lateral dolly
  + micro push; `depthFocusDist` tracks the nearest ring mushroom,
  `depthAperture` strong — blades/foreground smear to bokeh.
- Fireflies: ~14 instanced warm points on slow closed-form paths, a few
  crossing the shaft so they bloom.

## Beats
| t | beat |
|---|------|
| 0–4 | settle on the ring edge, dew web reads |
| 4–10 | dolly across the ring face; focus racks hero cap → web |
| 10–16 | fireflies drift up through the shaft; snail trail glints |
| 16–20 | settle wide; ring + log + web all legible |

## Determinism
All seeds via char-weighted sums; `hash1(i)` LCG for placements; closed-
form f(t) for fireflies/sway/dust. No sim state.

## Reject criteria
Any still where caps read as cones/umbrellas with no gill lip, dew as
dots, the log as a tube, or litter as a plane → iterate.
