# Visual Plan — `curios`

## Concept
A cabinet-of-curiosities shelf read as a warm product still-life. Not a dark
mystery room — a lit museum shelf: every object should read with material
richness (oak grain, brass patina, glass glint, amethyst glow, paper stain).

## Composition
- Camera: CameraRig macro orbit, radius ~1.2–1.55 m, ~58 mm lens, slow drift
  across the shelf face + one late dolly beat. Shallow DoF racks between
  shelf depths through the take (focusDist oscillates 0.10–0.20).
- Shelf unit fills frame; three tiers each hold a distinct object cluster.
- Rule of thirds: geode lower-left, bottles mid, watch upper-right, lamp
  upper-left as the warm accent source.

## Assets (Blender → GLB, `assets/curios/build.py`)
~118 named parts: shelf unit (3 planks, posts, back boards, lips); amethyst
geode (dome + 14 crystal cones); 3 specimen bottles with corked necks and
pinned moths (body + two wings); brass pocket watch (case, face, glass, ring,
bow, 3 gears, ticking hand, 5 chain links); skeleton key; scroll + ribbon +
wax blob + stamp; magnifying loupe (ring + lens + handle); herb rail with 5
bundles (strings, ties, leaf clusters); oil lamp (base, neck, wick, flame,
loop); book stack, astrolabe rings, quill feather.

## Materials (procedural DataTextures + PBR)
Oak grain map + bump; brass patina roughness; aged paper stain; glass/lens as
transparent clearcoat layers (opacity ~0.2, high envMapIntensity); amethyst
emissive purple; wax deep red clearcoat.

## Lighting — visible richness, not mood-dark
- Warm 3000 K SpotLight key (22) from upper-right on the shelf.
- Cool fill (0.55,0.62,0.80 @ 1.1) + warm rim so silhouettes separate from
  the dark wall.
- Oil lamp PointLight flickering at the flame; warm god-ray cone slanting
  right-down across the shelf as an accent (alpha ~0.10).
- Environment intensity 0.4 keeps metal/glass sheen without washing shadows.

## Atmosphere
Dust motes (130 instanced points) drifting inside the lamp beam; flame +
lamp light share one breath envelope; watch gears counter-rotate, tick hand
steps ~3 Hz.

## Post
Exposure 1.05, bloom 0.30 @ 0.9, halation 0.08, ca 0.7, grain 0.05,
vignette 0.42, DoF 0.55 / focusDist 0.10–0.20 (rack) / range 0.20.

## Captions
"THE CABINET" · "objects keep their small fires" · "every shelf a short
history".

## Known limits
DoF is the engine's radial post blur, not true depth-based focus; glass is
opacity+envmap, not real refraction. Herb bundles are static (still life).

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
