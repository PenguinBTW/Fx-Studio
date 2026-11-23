# FREEFALL sound design and score

**Atmosphere:** an original 38 s D-minor score at 120 bpm (19 bars of i–VI–III–VII) that rises and drops with the scale dive, with procedural SFX on every seam and caption. No samples or licensed music.
**Master:** `master/freefall_mix.mp3`, -14 LUFS integrated, -1.5 dBTP, exactly 38.000 s, loops with the picture.

## Rebuild

```bash
cd app
bun scripts/freefall_score.ts                                        # music stem -> src/scenes/freefall/stems/music.flac (gitignored)
bun scripts/sfx/synth.ts --cues src/scenes/freefall/sfx_cues.json --out src/scenes/freefall/sfx
bun scripts/render.ts audio --project freefall --mp3                 # mixdown -> master/freefall_mix.mp3
```

`render.ts video` uses `master/freefall_mix.mp3` (project.json `"audio"`). Without the master it falls back to the `"mix"` mixdown, which needs the gitignored music stem: run `bun scripts/freefall_score.ts` first.

## Score sections (`scripts/freefall_score.ts`)

| Time | Picture | Music |
|---|---|---|
| 0–4 | orbit, aurora | FM bells over the Dm pad, D1 drone (whole number of cycles in 38 s) |
| 4–9.4 | thunderhead, bolt | four-on-the-floor kick, root bass, dark pad |
| 9.4–10.7 | raindrop bullet time | drums and bass drop out, pad closes to 300 Hz |
| 11–18.1 | plankton, radiolarian | 16th saw plucks, off-beat hats, claps from 15 s |
| 18.1–20 | "closer." midpoint stop | everything cuts but a thin pad; reverse swell into the slam |
| 20–29 | salt, atom | full drive: 16th hats, off-beat octave bass, brighter plucks |
| 29–30.6 | quark | accelerating snare roll, filter at 4.2 kHz |
| 30.6–31 | RGB glitch | buffer stutter 1/16 → 1/32 → 1/64, bitcrushed |
| 31–33 | "that's your screen." | dead stop, then a quiet pad |
| 33–38 | pull-back to orbit | swell back into the opening bells |

All events are scheduled on [0, 38); tails past 38 s are wrapped into the start, so the stem is continuous across the loop.

## SFX cues (`sfx_cues.json`, levels in `mix.json`)

| Time (s) | Event | Recipe | Level |
|---|---|---|---|
| 4.0, 11.0, 15.0, 24.0, 28.0, 36.8 | dive seam mid-points | whoosh | -9 to -10 dB |
| 20.0 | pore seam slam | whoosh + reverseReverb (sub bus) | -7 / -5 dB |
| 4.72, 5.72, 7.47 | lightning flashes | thunder (new recipe) | -16 / -13 / -5 dB |
| 8.0, 10.7 | rain | rain | -20 / -22 dB |
| 9.5 | drop freezes | glassPing | -9 dB |
| 12.0 | plankton | pops | -18 dB |
| 20.6 | salt crystal | shimmer | -16 dB |
| 24.2 | electron cloud | granularCloud | -22 dB |
| 30.6 | quark (rise lands on the glitch) | riser | -12 dB |
| 30.2 | RGB glitch | granularCloud (ticks) | -13 dB |
| 31.0 | "that's your screen." | subHit (sub bus) + click | -2 / -8 dB |
| 31.2 | LCD hum | thrum (60 Hz) | -26 dB |
| 33.0 | pull-back | shepardRise | -15 dB |
| caption starts | typed captions, 34 chars/s | tick (one grain per character) | -17 dB |

The music ducks 4 dB under the bolt thunder and the pore slam. No SFX runs across the 38 s boundary; at the loop point the master steps by about 1.5x its largest local sample-to-sample change.
