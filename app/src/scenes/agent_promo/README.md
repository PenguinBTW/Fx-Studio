# agent_promo

A promo for f(x) Studio about how it is used: an agent writes, builds, watches, criticises and rewrites a film.
Song: Daft Punk, "Technologic", cut to 224.436 s on bar lines (128.37 BPM, 119 bars). See `storyboard.md` for the
bar map, `visual_plan.md` for the art direction, `REVIEW.md` for the review rounds and the sources for every on-screen claim.

## Soundtrack (not committed)

The song is copyrighted and is not in git. To render with sound, put the cut at `app/public/audio/agent_cut.mp3`
(the path `mix.json` expects) and its analysis at `app/public/data/agent_promo/audio.json`. The picture does not need
either: A2 and A6 read the song's loudness from the baked `rms.json`, and timing comes from `kit.ts` (`BAR`, `B0`).
`master/agent_promo_mix.mp3` is the finished mix (song + procedural SFX at -18 to -24 dB under the music). It contains the song, so it is gitignored: build it locally with the mixdown command below.

## Rebuild

```bash
cd app
bun scripts/sfx/synth.ts --cues src/scenes/agent_promo/sfx_cues.json --out src/scenes/agent_promo/sfx
bun scripts/mixdown.ts --mix src/scenes/agent_promo/mix.json --from 0 --to 224.436 --out ../out/agent_promo_mix.wav
bun scripts/render.ts stills --project agent_promo --t 44,104,142
```

Blender assets: `assets/<id>/build.py` (Blender 4.2, deterministic), checked by `bun run assets:check`.
The final video is rendered on a GPU machine with `bun scripts/render.ts video --project agent_promo --mix src/scenes/agent_promo/mix.json`.
