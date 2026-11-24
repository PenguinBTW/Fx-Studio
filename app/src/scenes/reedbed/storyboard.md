# reedbed — storyboard

Duration 18s, 16:9. Single continuous low shot across the water.

## Beats
| t | beat | camera |
|---|---|---|
| 0.8-3.0 | still marsh — mirror water, jetty left, heron right | near-static, low |
| 4.5-6.5 | dragonflies begin skimming, first ripple rings | slow drift left |
| 8.8-11.0 | mist sheets pour between reed stands | drift continues |
| 10.5-14.5 | heron wing-flare → lift off up-right, exit | slight push toward heron |
| 15.0-17.6 | settle — warm rim brightens, ripples fade | hold |

## CameraRig
`anchor = [-2, 1.7, 6]`; `yaw ≈ π - 0.10 - t*0.008`; `rad ≈ 24-2*ss(0,12,t)`;
`pos[1]` clamped ≥ water + 1.2; `target` tracks toward the heron during the
flare then returns.

## Lighting beats
- 0-14: cold blue-grey dominated; warm rim band only at horizon.
- 14.5-18: `settle` — sun intensity +20%, warm band broadens, fog thins
  slightly (not dusk — this is dawn warming).

## Captions (world-anchored, Layer2D)
- 0.8 'first light on still water' — over the open water
- 4.5 'the marsh holds its breath' — near the heron
- 8.8 'mist pours slow between the reeds' — over the jetty mist
- 11.2 'grey on grey until the flare' — at the heron
- 15.0 'dawn finds the reedbed' — wide over the water

## Assets (assets/reeds/model.glb)
reeds, reedTall (clump archetypes cloned ×40/×14), jetty, punt, heron
(wingL/wingR for the flare), lily (cloned ×26), snag.

## Probes
`probe()` returns {skim, flare, settle} for headless verification.

## Stills
t = 2, 9, 12.5, 16.5 in `stills/`.
