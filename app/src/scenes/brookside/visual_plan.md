# brookside — visual plan

## Concept
An autumn woodland brook sliding under a mossy stone footbridge, late
afternoon. The bridge is the anchor — an uneven hand-laid arch, green with
moss and ferns — and the water is the actor: shallow enough that the bed
stones read through the surface, carrying maple leaves downstream while
dappled god-rays tilt through the canopy. Amber/rust/deep-green palette;
the warm/cool split is leaf-light vs water-shade.

## Medium: real 3D (defended)
Water readability is a lighting problem — specular streaks, fresnel sky,
bed stones dimming with depth — and the bridge needs real stone silhouette
and moss on real normals. A flat version would collapse to bands. Rejected.

## Assets (Blender → GLB, `assets/brook/`)
- `bridge` — single arch footbridge: voussoir ring, uneven spandrel blocks,
  parapet caps, moss vertex-colour patches, fern tufts rooted in the joints.
- `banks` — sloped earth banks either side of the channel, exposed roots
  and embedded stones, leaf-litter colouring.
- `bed` — shallow channel bed: gravel floor + flattened bed stones that
  read through the water surface (placed where the water shader draws foam).
- `trees` — trunks leaning over the brook + clustered canopy masses with
  baked amber/rust/green vertex-colour breakup (autumn, not blob-green).
- `stones` — loose boulders at the banks and in the shallows.

## Water (the raised spec from the lighthouse review)
- Surface plane, custom shader: scrolling streak normals → sun specular
  dancing on the flow; fresnel to a pale sky tint; alpha fades over bed
  stones so they show through near the banks.
- Foam: rings/edge lines traced around each bed-stone position (uniform
  array) + a thin lace line where water meets the banks.
- Leaves: instanced quads on the surface, closed-form drift downstream
  with spin and slight bob; shadows faked as dark discs on the bed below.

## Light / atmosphere
- Warm low sun from upstream-left: canopy rims amber, water glints.
- Dappled shafts: 4 narrow cones through canopy gaps, each landing in a
  small pool of light on water/bank; motes inside.
- Mist: 2 thin ribbons hugging the water downstream + one bank hollow.
- Sky: warm dusk gradient behind the canopy silhouettes.

## Staging
- Camera low over the brook, near-static with a slow drift along the
  channel; gaze slightly under the arch so the keystone + far glow hold
  the frame's depth cue.
- Beats (20 s): still brook → shafts dapple in → leaf run → mist lift →
  settle. Optional kingfisher dart once across the channel.

## Determinism
All f(t): shaft sway, mote drift, leaf drift/spin, mist slide, camera.
No sim state.

## Rejects to watch
- Water must read as flow — streak speculars + foam + bed show-through,
  not a flat slab (the verdict that sank the first harbor pass).
- Bridge must read as laid stone — voussoir joints + moss patches, not a
  smooth torus.
- Canopy needs two depth layers or the scene goes flat.
