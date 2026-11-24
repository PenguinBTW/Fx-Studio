# meteorrain — visual plan

A Perseid meteor shower over a mountain observatory at deep night.

## World
One backdrop plane carries the whole sky: a Milky Way band (dense fbm star
field with dark dust lanes), an airglow band hugging the horizon, and slow
cloud wisps crossing the ridge. Below the sky sits a hashed ridgeline
silhouette with a telescope observatory dome (a slow-rotating slit that
occasionally catches a star glint) and a radio mast whose red beacon blinks.

## Meteors
~40 hash-seeded streaks on closed-form trajectories: each has a seeded start
time, direction (roughly a shared radiant), speed, length, and a color seeded
from the Perseid palette (white / green-gold / orange). A meteor brightens,
streaks, and burns out in under a second; its ionized trail decays over a few
seconds afterward. One headline fireball mid-scene is a longer, brighter
streak that fragments into 3-4 secondary streaks with a color breakup.

## Atmosphere
A handful of lingering smoke trails drift sideways where earlier meteors
burned out — faint fbm streak bands fading on slow envelopes.

## Metaphor → mechanism mapping
| Story element | Implementation |
|---|---|
| Perseid radiant | shared `ang = -0.42 - 0.65*h` cone, all 40 meteors |
| ionized trail | per-point arrival time + `exp(-(t-arrive)/1.6)` decay |
| fireball fragmentation | 4 rotated secondary streaks from the break point |
| smoke memory | fbm-modulated columns drifting +x on 7–9s envelopes |
| observatory watching | dome slit sweeps on `sin(t*0.35)`, glint on `pow(...,12)` |

## Cliché audit
- No purple/green "aurora sky" — the palette stays desaturated blue-black.
- No lens flare or comet tails with motion-blur smear; streaks are thin cores with exponential falloff, plus a fading trail.
- The fireball fragments *down-range* (real bolides shear forward), not into a radial starburst.

## Focal hierarchy
1. Meteors / the fireball (brightest, highest-contrast elements)
2. Milky Way band + starfield (slow-moving backdrop interest)
3. Ridgeline detail: dome slit glint, red beacon (small focal accents)
4. Airglow, wisps, smoke (atmospheric bed, lowest contrast)

## Camera & beats
CameraRig holds a slow push (z 26→14) and tilts skyward through the
fireball event. Beats: quiet sky → first meteors → fireball → lingering
glow fade. Captions ride Layer2D; the engine's textProbes emit caption
bounds + style at each beat, and sky luminance is verified in the render
stills at t=2/7/11.4/17.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
