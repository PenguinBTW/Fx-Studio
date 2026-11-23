# FREEFALL - visual plan (9:16, 38 s, 120 bpm click grid: BAR = 2 s, BEAT = 0.5 s)

One unbroken dive DOWN through scale, monotonic in size, loops to frame 0. Palette rules ignored on purpose (user):
every scale gets its own full-colour world. Shared clock: `Z(t)` = log10(frame height in metres), used by every
scene and by the depth counter (top of the safe core, y ~ 330, "10^n m" rolling digits + label).

| t (s) | scene | Z | look | hook / beat |
|---|---|---|---|---|
| 0-4 | orbit | 7 -> 5 | night Earth, city lights, green/magenta aurora curtains streaming past the lens | frame 0 mid-fall; "no footage." / "just code." |
| 4-8 | storm | 5 -> 3 | volumetric violet thunderhead, lightning on beats, god rays | flash cuts |
| 8-11 | drop | 3 -> -2 | one raindrop, macro DoF, ocean refracted upside-down with Cauchy dispersion; bullet-time freeze ~9.5 s; crown splash | |
| 11-15 | plankton | -2 -> -3.5 | bioluminescent dinoflagellates, blue-cyan sparks bloom around the lens (GPU particles) | |
| 15-20 | diatom | -3.5 -> -4.5 | glass radiolarian/diatom shell (SDF), spectral caustics; MIDPOINT STOP 18-19.5: fall stops dead, shell turns to camera, then SLAM 2x | second hook |
| 20-24 | lattice | -5 -> -9 | salt crystal -> SDF atomic lattice corridors, blackbody glow | |
| 24-28 | atom | -9.5 -> -14 | electron orbital clouds, nucleus | fastest |
| 28-31 | quark | -14 -> -18 | colour-charged light knots, gluon strings; counter hits 10^-18, glitches | |
| 31-33 | twist | -> -4 | the quark resolves into RGB LCD subpixels: "that's your screen." | fourth wall |
| 33-38 | pullout | -4 -> 7 | subpixels pull out into the orbit image; last frame == frame 0 (transition samples orbit at t=0) | loop |

Seams: custom `ff_*` transitions that sample both scenes at the shared Z (scale-matched zoom handoffs, never fades).
Safe zone: text/subjects inside y 288..1440, x 60..886.
