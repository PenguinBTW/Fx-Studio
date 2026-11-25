# reedbed — visual plan

## Concept
A marsh at first light: dense reed stands with seed heads swaying, low mist
sheets drifting over dark still water, a flat-bottomed punt moored to a worn
jetty, a grey heron that holds still then flares and lifts, lily pads,
dragonflies skimming. Cold blue-grey mist against the first warm rim of light
at the horizon.

## Medium
Real 3D (Blender→GLB parts + scene-side instancing). The water is the star:
a true mirror plane (Reflector) carrying the sky and reed silhouettes, broken
only by expanding ripple rings.

## Conceptual Mapping Table
| Abstract idea | Physical form |
|---|---|
| Stillness / held breath | mirror-flat water, motionless heron, parked punt |
| Cold first light | blue-grey fog + steel water vs a narrow warm band at the horizon |
| Life under the calm | dragonflies skimming, ripple rings, reed sway |
| The sudden beat | the heron's wing-flare + lift-off — the only fast motion |
| Time passing | mist sheets sliding, light slowly warming |

## Anti-cliché audit
- NOT a generic sunset marsh — the warm band is a thin horizon rim, the mass
  of the frame stays cold.
- NOT a busy wetland — heron is the single focal event; dragonflies stay small.
- Reeds are geometry (GLB clumps with cattails + plumes), not alpha-card lines.

## Focal hierarchy
1. The heron — dark shape against bright water, center-right third.
2. The jetty + punt — left third leading line into the frame.
3. The warm horizon band — backlights the reed fringe.
4. Foreground reed blades — soft dark frame edges for depth.

## Lighting
- Key: low warm 3000K sun just clearing the far bank (+z, slightly -x) —
  rim-lights reed heads, throws the heron's shadow on water.
- Fill: cold hemisphere (6500K sky over dark water ground) — keeps shadow
  sides blue.
- Rim: weak cool light behind camera to separate near reeds from fog.
- FogExp2 (blue-grey, denser than terraced) + 4-5 drifting mist sheets.

## Camera
CameraRig low at the water's edge on the near bank (~1.6m), slow drift
right-to-left holding jetty left-third and heron right-third; a faint push
toward the heron on the flare beat.

## Beats
0-3 still marsh · 4-9 dragonflies skim · 6-10 mist pours · 10.5-14.5 heron
flare + takeoff · 14.5-18 settle as the light warms.

## Palette
Steel blue-grey #3d4a54 (water/fog), cold dawn blue #1a2330 (zenith), warm
rim #d08448 (horizon band), reed green-grey, heron slate-grey.

---
*Don't forget to ground yourself — USE THE SKILL and REREAD IT ALL.*
