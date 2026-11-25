# terraced — storyboard

Single continuous shot, 18 s, low drift down-slope toward the barn.

| t (s) | Camera                                        | Action                                                        |
|-------|-----------------------------------------------|---------------------------------------------------------------|
| 0–5   | Wide, barn on left third, terraces stepping away | Establishing; figure starts the path; caption 1 + 2          |
| 5–8   | Gentle push begins                             | Swallow flock crosses the valley right→left; caption 3        |
| 8–12  | Drift continues, path reads into depth         | Warm gust rolls through foliage; valley haze drifts; cap 4    |
| 12–18 | Slight settle                                  | Gold cools; lantern + barn window become the warm anchors; cap 5 |

## Camera

- Rig: orbit drift `yaw = 0.18 + 0.012t`, `rad = 30 − 4.5·ss(0,10,t) + 1.5·settle`,
  elevation ≈ 0.16 rad with a slow ±0.02 wobble.
- Target: just right of the barn so it holds the left third; the path reads
  diagonally from lower-right into the middle distance.
- Focal length ≈ 42° vertical FOV equivalent.

## Lighting beats

- 0–14 s: full golden key, long shadows down-slope.
- ~10 s: gust swells foliage sway (uGust), not the light.
- 14–18 s: key cools 2800K→2100K and drops ~50%; FogExp2 thickens; the
  lantern flicker (11 Hz + 29 Hz shimmer) and the barn window take over.

## Captions (world-anchored, screen-space compositor)

1. "generations cut this hill into steps" — anchored over the barn.
2. "the stone holds the day's last warmth" — over the mid terraces.
3. "one figure keeps to the path" — over the path.
4. "the valley swims in heat" — over the haze layers.
5. "dusk finds the terraces" — back over the barn.

## Assets

- `assets/terraces/model.glb` (Blender build.py): walls×8 levels, barn,
  path+stiles, cypress, olive, figure — 17,738 tris.
- Procedural: terraced heightfield (shared contract), dry tufts, herb clumps,
  poppies, rubble stones, haze cards, ridge silhouettes, swifts, buzzard.
