# brookside — storyboard

20s, 60fps, 16:9. One locked low shot drifting downstream toward the bridge —
the camera is the brook's point of view, ~1.6m over the water, fov 44.

## Camera (camAt)
- `pos = (-1.4 + sin(t*0.13)*0.35, 1.55 + t*0.025 + sin(t*0.4)*0.03, -14.5 + t*0.28)`
- `aim ≈ (0.3 ± drift, 2.6→3.6 clamped, 0.5)` — always on the arch mouth
- A slow lateral sway + 6m push-in over the shot; the bridge fills the frame
  as the water surface streaks slide past the lens.

## Acts (project.json captions)
| act | t | caption | beat |
|-----|---|---------|------|
| 01 | 0–4.5 | THE BROOK REMEMBERS RAIN | establish: water streaks, bed stones, drifting leaves |
| 02 | 4.5–9.5 | LIGHT THROUGH THE CANOPY | god-ray shafts strongest; motes visible in the beams |
| 03 | 9.5–14.5 | WHAT THE CURRENT CARRIES | leaves spin/wobble through frame; arch mouth dominates |
| 04 | 14.5–20 | STONE AND STILL WATER | settle: foam rings on hero stones, warm light under arch |

## Lighting beats
- t≈0–5: cool ambient 0.6 + warm sun 3400K·3.2 from canopy gaps; shafts at
  half intensity.
- t≈5–10: shaft sway envelopes peak — dust motes brighten inside the cones;
  warm under-arch point light reads through the tunnel mouth.
- t≈10–17: compositional peak — camera closest, bridge fills upper frame.
- t≈17–20: hold; leaf drift continues; mist ribbons thin downstream.

## Water
- Streak normals drive specular streaks aligned to flow; fresnel-dark peaty
  base; foam rings + downstream wakes at the four hero stones; lace at the
  banks; alpha thins over shallow/bed areas so stones show through.
- Leaves ride a closed-form current `z = 14 - u*34`, wobble ±, spin per-leaf
  phase; paired shadow discs sell the shallow depth.

## Probes
- `bridge arch` — 340×160 box at (0, 4.2, 0): keeps the arch mouth framed.
- `foam line` — 110×70 at the near hero stone: guards the foam/wake read.

## Rejects (self-review rounds)
- Canopy pumpkin-blobs → three autumn materials per cluster, far wall raised.
- Milky water → fres 0.75→0.42→0.30, darker deep/sky palette.
- Spandrel backing walls → removed (read as flat lintel over the opening).
- Abutments burying the arch → moved outboard of the spring line.
- Pale gap killing the arch silhouette → dark underpass plane + warm
  intrados point light; moss clamped to the ring mid-span.
