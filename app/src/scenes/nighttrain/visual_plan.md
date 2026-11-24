# nighttrain — visual plan

A steam train crossing a moonlit stone viaduct at night.

## World & staging

- **Frame geography:** the viaduct deck sits at ~50% frame height.
  Above: deep navy sky with hash-gridded stars, a halo'd moon high right,
  slow moonlit cloud wisps, and layered valley silhouettes. Below: stone
  arches over a dark valley floor threaded by a river catching a silver
  moon lane.
- **Viaduct:** a solid deck band plus a row of arched openings (hashed
  cell pattern, rectangular shafts with semicircle crowns); a cold rim
  light runs along the deck top and arch lips. Openings show the valley
  and river behind, darkened by bridge shadow.
- **Train:** enters left on a closed-form crossing — loco silhouette
  (boiler, cab, stack, subtle bob), three carriages with a row of warm
  flickering windows, and a red tail lamp on the last car.
- **Headlight:** a warm cone projected ahead of the engine, its slope
  easing with track curvature; lights the deck edge and throws a warm
  streak on the river beneath.
- **Smoke:** ~12 seeded puffs — each blob expands, rises, and drifts back
  over the train, warm-lit from below near the stack.
- **Trackside:** a block-post signal lamp switches green → red as the
  engine front passes; a watchman's hut glows one warm window; a small
  flock startles up from under an arch once mid-crossing.
- **Camera:** CameraRig, slow pan that partially tracks the train's world
  x through the crossing, gentle push, tiny roll.

## Palette

- Sky: deep navy (0.03,0.05,0.12) lightening toward the horizon.
- Moon: cool silver (0.80,0.84,0.92) with a broad halo; moonlit clouds
  silver-edged.
- Stone: cold blue-grey (0.10,0.12,0.16), rim light (0.42,0.48,0.60).
- Train: near-black silhouette (0.05,0.05,0.07); headlight + windows
  warm amber (1.0,0.72,0.30); smoke warm-lit at the base.
- River: dark slate with a silver moon lane + warm train streaks.

## Beats (t, seconds)

| t | beat |
|---|------|
| 0–2.5 | awake fade: empty viaduct, moon + river lane |
| 4–6 | headlight glow appears at the left edge before the engine shows |
| 6–15 | crossing: smoke, flicker windows, signal green→red, birds |
| 15–17.5 | tail lamp receding right, glow dying |
| 17–20 | empty again; smoke drifting off, valley settles |

## Determinism

All motion closed-form `f(t)`; seeds via `h1`/`h21` hashes; smoke puffs
derive position from emission time (absolute t — no integral uniform
needed because no advection rate is envelope-gated); no sim state.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
