# Visual Plan — `forge`

## Concept
A blacksmith's forge interior at deep night. The hearth is the only heat: a coal
bed breathing 1800 K ember-orange against a room held in cool 9000 K moonlit
dim. It is a macro-product-shot on a craft object — the anvil — with the rest of
the room receding into textured darkness.

## Composition
- Camera: CameraRig, low near-static orbit (~1.2–3.0 m radius) around the anvil
  at mid-frame; opens close on the glowing workpiece, slowly pulls back through
  a 20 s take to reveal the forge hearth left, the quench tub right, and the
  tool rack on the back wall.
- Layers: foreground anvil + stump; mid hearth + coal glow + sparks; background
  rack, window shaft, apron on post. Rule of thirds — anvil occupies the lower
  right third, hearth glows upper-left.

## Assets (Blender → GLB, `assets/forge/build.py`)
25 named parts: floor, walls, window, hearth + chunky brick lips, hood + flue,
coal bed (30 dark icospheres + 9 emissive ember stones), stump (hammer-facet
noise), anvil (foot/waist/body/horn/heel/plate), workpiece (hot bar + tang),
hammer on the anvil, rack beam + 2 tongs + 3 hammers, quench tub + water disc,
leather apron on a post, stool, horseshoe pile. Materials: Stone/StoneD/Brick/
Wood/WoodD/Stump/Iron/IronD/Steel/Leather/Coal/CoalGlow/Hot/Water/Brass/Canvas —
all remapped to textured MeshPhysicalMaterials in-scene.

## Materials / textures (procedural DataTextures)
Stone noise for walls, pitted iron maps (roughness + bump) for anvil and tools,
woodgrain for beams/rack/stump, coal rubble map for the bed. Leather apron reads
dark and matte with belly-curved geometry, not a grey slab.

## Lighting
- Ember PointLight at the hearth, 1800 K via blackbodyToLinearSRGB, decay 2,
  intensity breathing multiplicatively (0.6–1.0 sin 0.9t + sputter 13.7t).
- Workpiece hot PointLight 0xff6a18 localized over the anvil face.
- Window DirectionalLight 9000 K (cool, dim) slanting in from the left wall;
  god-ray cone shader anchored apex-at-window, wide-end-into-room.
- Faint blue fill + near-black ambient keep the room in shadow; environment
  intensity 0.16 keeps metal sheen alive without flattening shadows.

## Atmosphere
- Instanced spark points (110) rise from the coal bed with flicker-falloff —
  closed-form `cyc = fract(seed*13.73 + uT*rate)`, alpha `(1-cyc)²` + flicker.
- Steam mist (45 pts) drifting over the quench tub; smoke wisps (55 pts)
  inside the window shaft.
- Emissive ember stones pulse with the same breath as the point light.
- Emissive-glow sprite on the hearth (self-billboarding THREE.Sprite).

## Post
Exposure 1.06, bloom 0.42 @ 0.83 radius 0.7 (tight — highlights don't smear),
halation 0.09, vignette 0.50, radial DoF 0.40/0.17/0.30.

## Captions / probes
"THE FORGE" (title), "coals keep a slow orange breath" (mid), "iron remembers
the hammer" (late). textProbes driven by renderText.

## Known limits
The hearth breath is a single flicker envelope — sparks, embers and light
share it, so individual ember stones don't pulse independently. Steam is a
soft point cloud, not volumetric scattering.

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
