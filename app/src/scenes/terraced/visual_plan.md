# terraced — visual plan

## Concept

A dry-stone terraced hillside at golden hour. The land is the subject: eight
stone courses stepping down a slope that generations of hands cut into flat
bands. A small stone barn anchors the middle distance; olive and cypress trees
read as dark verticals against the parched gold; one figure with a lantern
walks the path down. Beyond the last wall the valley dissolves into heat haze.

The emotional read is *earned stillness* — human labor made permanent in
stone, briefly lit warm before dusk takes it.

## Medium

True 3D. Terraces, walls, barn, path, stiles, trees and the figure are real
geometry (Blender→GLB + procedural terrain/scatter), lit by a 2800K raking key,
cool hemisphere fill and a violet valley rim, with FogExp2 aerial depth. A
2.5D treatment would flatten exactly what sells the scene: the raking shadows
inside each wall course and the parallax between levels.

## Conceptual Mapping Table

| Abstract idea        | Concrete visual                                   |
|----------------------|---------------------------------------------------|
| accumulated labor    | 8 segmented dry-stone walls, capstones, stiles    |
| time of day          | 2800K raking key, long shadows down-slope         |
| cultivated land      | flat bands green vs. parched gold slope           |
| solitude             | one small figure, one lantern, vast hillside      |
| distance / heat      | layered haze cards + two hazed ridge silhouettes  |
| life continuing      | swallows crossing, buzzard circling, wind sway    |

## Anti-cliché audit

- NOT a screensaver: the light rakes *across* the terraces so each wall throws
  its own shadow band; the composition is off-center, subject on a third.
- NOT a postcard: the figure is small, weathered, anonymous — a worker, not a faller into the land.
- No purple-sky gradient default: the sky burns amber only toward the sun,
  violet-blue up; haze is warm, not fog-white.
- No floating scatter: every tuft/stone is seated by the shared heightfield.

## Focal hierarchy

1. **Barn** (left third, mid-ground) — largest lit mass, warm window.
2. **Wall bands** — rhythmic horizontals leading the eye down-slope.
3. **Figure + lantern** — tiny warm point that gains strength as dusk settles.
4. **Valley haze** — atmospheric depth, never competing for contrast.

## Lighting design

- Key: 2800K directional from low-left (-x), elevation ~14° — the classic
  raking golden-hour angle across retaining walls.
- Fill: hemisphere, cool sky 7000K over warm earth ground bounce.
- Rim: violet 0x8a6f9a from deep in the valley, separating stone from haze.
- Practicals: barn window (emissive, always faintly warm) + lantern point
  light that swells through the dusk settle.

## Camera

Low near-static orbit drift (CameraRig): radius 30→25.5, yaw creeping, slight
elevation wobble; target holds just right of the barn so the barn sits on the
left third and the path reads diagonally into depth.

## Beats (closed-form f(t))

- t≈5.5 swallows cross the valley (60 instanced flapping birds).
- t≈9.8 a warm gust rolls through trees + grass (uGust swell).
- t≈14.2 dusk settles: sun cools 2800K→2100K, fog thickens, lantern blooms.

## Palette

Parched gold (grass/stone), silvered olive green, black-green cypress,
warm grey stone, violet haze, amber sun band, deep robe umber for the figure.
