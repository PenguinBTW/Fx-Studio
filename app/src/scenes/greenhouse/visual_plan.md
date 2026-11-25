# visual plan — `greenhouse`

## concept
A Victorian glasshouse interior at dusk. The low sun burns through the far
pane wall while the interior falls to blue shadow; one warm pendant lamp
holds a pool of amber against it. Benches, clay pots, ferns, a watering can
and tools give the room its working life; condensation and dust in the
god-rays carry the atmosphere.

## metaphor read
Dusk as thermal contrast: a dying 2500 K key outside the glass, a 3000 K
lamp inside. Warmth = survival inside the glass at the end of the day.

## staging
- Real 3D: Blender-built GLB (`assets/greenhouse`), 86 named parts —
  6 iron frame ribs, 55 panes (walls incl. eave row, roof, back wall), ridge + wall rails,
  2 plank benches, 8 pots, 10 ferns (8 potted + 2 hanging baskets),
  pendant lamp, watering can, tool props.
- Glass: near-clear MeshPhysicalMaterial — condensation bump map gives
  droplets/trails at grazing angles; clearcoat + high envMapIntensity give
  the fresnel glints against the dusk sky. depthWrite off, opacity 0.03.
- Sky: full shader backdrop — indigo→amber dusk gradient, broken treeline
  silhouette with sparse crowns, ground haze, first faint stars. Low
  additive sun disc hugging the treeline.
- Rays: three cone shafts aligned to the real sun direction, additive,
  with dust motes clustered inside them; slow low mist drifting at ankle
  height.
- Foliage: every fern is a cluster of individually modelled leaf strips
  (centre-folded lanceolate blades, tapered, droop-curled); closed-form
  sway f(t), hanging baskets pendulum wider than potted ones.
- Camera: 50 mm, low near-static orbit that widens and lifts over the
  clip — macro-ish start on the foreground pot to a wide reveal of the
  whole interior. Pull progression driven by smoothstep.

## light design
- Key: warm directional sun (2500 K) at a low oblique angle through the
  pane grid; casts the iron rib shadows + long pool on the bench/floor.
- Lamp: 5.5-intensity point light under a brass pendant + additive glow
  sprite, gentle two-frequency flicker.
- Rim: 8200 K cool rim from behind-left for edge separation on iron/leaves.
- Fill: faint blue fill + low ambient — the interior reads dark because
  dusk is dark; highlights live in the pools, not the shadows.

## grade
exposure 0.98 · bloom 0.30 @ 0.88 · halation 0.06 · ca 0.7 · grain 0.04
· vignette 0.42 · dof 0.40 (focusDist 0.16, focalRange 0.30, radius 3)

## beats
1. 0–4.6s — title over the near pot + pane wall; dusk establishing.
2. 4.6–11.6s — condensation / dust drift beats; camera begins its lift.
3. 11.6–17.8s — the wide: lamp pool + benches + props + hanging fern.
4. 17.8–20s — settle on the warm bench edge, sun low right.

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
