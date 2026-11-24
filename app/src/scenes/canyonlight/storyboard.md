# canyonlight — storyboard

| t | Beat | Frame | Camera vector | Focal point |
|---|------|-------|---------------|-------------|
| 0–7.5 | quiet shafts | strata wall center-frame, 4 shafts slanting through slit, motes drifting | slow drift in (z 24→16), slight yaw | shafts / slit |
| 7.5–12 | wind gust | haze sweeps corridor, shafts wobble, motes accelerate | tilt up toward slit (target.y +9) | slit + shafts |
| 10.8–14 | rockfall | pebble cascade from ledge x≈0.6, dust puff at base | hold, still tilting | pebbles → puff |
| 13–20 | re-emerge | shafts return brighter, piles grown, floor lit | settle (z≈16, target y≈8) | shafts + floor pools |

Overlaps: raven crosses slit once at t≈10–12.6, independent of the gust.

## Lens / rig
- PerspectiveCamera fov 38, `rig.focalLengthPx` from H.
- `rig.position`: `[0.4 sin(t·0.05), 2+1.5·push, 24−8·push]` — gentle push.
- `rig.target`: `[0, 6 + 9·gust + 2·push, −60]` — the tilt-up reads the gust's lift toward the light source.
- `rig.roll`: 0.003 sin — barely-there handheld.

## Captions
- "sun finds the canyon floor" (t 1–5)
- "wind remembers" (t 8.5–11.5)
- "sand keeps falling" (t 15.5–19)

## Verification stills
- t=2: shafts established, quiet.
- t=9.5: gust peak — wobble + tilt, haze visible.
- t=12.5: rockfall beat — pebbles + puff, raven mid-cross.
- t=17: re-emerge — brighter shafts, piles.

"Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL"
