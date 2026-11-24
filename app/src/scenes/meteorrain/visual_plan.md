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

## Camera & beats
CameraRig holds a slow push and tilts skyward through the fireball event.
Beats: quiet sky → first meteors → fireball → lingering glow fade.
Captions ride Layer2D; textProbes sample sky brightness at the beats.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
