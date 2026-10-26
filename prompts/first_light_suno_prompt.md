# FIRST LIGHT: Suno prompt (three-stage workflow)

Make the track **before** running the scene prompt. The film is fitted to the real song, so the song comes first.

A single pass won't give you this much contrast or a clean hard stop. Suno smooths transitions, leaves reverb tails and leaks drums into quiet sections. So build the song in three stages with **Extend**, and do the hard stop yourself in an editor.

**Rules for every stage**
- Keep `90 bpm, 4/4` in the style field on every stage to limit tempo drift.
- No artist names. Suno usually strips or blocks them, so use descriptions.
- Keep the style field short and concrete so the structure tags carry more weight.

---

## Target structure (what the film expects)

| Section | Bars | Nominal time | Stage |
|---|---|---|---|
| Intro drone | 0–6 | 0:00–0:16 | 1 |
| Verse (claustrophobic) | 6–22 | 0:16–0:59 | 1 |
| Build | 22–32 | 0:59–1:25 | 1 |
| Climax 1, then **hard stop** | 32–38 | 1:25–1:41 | 1 |
| Piano break | 38–54 | 1:41–2:24 | 2 |
| Interlude | 54–64 | 2:24–2:51 | 2 |
| Build 2 | 64–72 | 2:51–3:12 | 2 |
| **Main climax** | 72–80 | 3:12–3:33 | 3 |
| Breakdown (piano and heartbeat) | 80–90 | 3:33–4:00 | 3 |
| Outro chord | 90–96 | 4:00–4:16 | 3 |

Suno won't hit these times exactly, and that's fine: the scene snaps to the real downbeats. What matters is the order of sections, the contrast between them, and a clean stop.

---

## Exclude Styles (all stages)

```
vocals, singing, speech, rap, guitar solo, EDM, drop, dubstep, trap, lo-fi, upbeat pop, muddy low end, harsh highs
```

---

## Stage 1: Descent and climax (0:00 to about 1:41)

**Style**
```
cinematic orchestral electronic hybrid, 90 bpm, 4/4, D minor, dark sub drone, low staccato strings, irregular industrial percussion, rising analog synth arpeggio, taiko, massive brass, deep sub bass, extreme dynamic contrast, wide stereo
```

**Lyrics / structure**
```
[Instrumental]

[Intro]
dark sub drone, one solitary high sine tone, near silence

[Verse]
pulsing low staccato cellos, tight irregular industrial clicks, claustrophobic tension

[Build]
rising synth arpeggio, half-time drums, Shepard tone riser, taiko and brass climbing

[Climax]
sustained full power, full orchestra and brass, pounding taiko, relentless

[End]
```

**Pick a take where:**
- the climax lasts at least about 16 seconds at full power, not one hit;
- the energy is still at its peak when it ends (no slow wind-down).

**Then cut it.** In Suno's trim tool or an editor (Audacity, Reaper), cut on the strongest downbeat at the end of the climax. Remove the tail completely and add a 5 ms fade-out so the cut doesn't click. Don't try to prompt Suno into true silence; it won't do it reliably, and the film's mixdown enforces exact silence over the Void Cut anyway.

---

## Stage 2: Piano break, interlude and second build (about 1:41 to 3:12)

**Extend from the trimmed clip**, not the original take. If Suno hears the reverb tail, it tends to carry the climax on.

**Style**
```
intimate solo felt piano, glassy ambient pad, minimalist modern classical, 90 bpm, 4/4, D minor, very sparse, vast stillness, then slow build with wordless choir and legato strings
```

**Lyrics / structure**
```
[Instrumental]

[Piano Solo]
very sparse felt piano, single lonely notes, soft glassy pad, lots of space, no drums

[Interlude]
slow low pulse returns, distant wordless choir pad swells gently

[Build]
soaring legato strings enter, cinematic drums return, organ swell, rising intensity
```

**Pick a take where:**
- the piano break is genuinely sparse: no drums, no busy pads. Regenerate if it fills up;
- the break lasts long enough (about 40 seconds). If it's short, the film's Crossing act can be shortened to match, but don't let it drop below about 25 seconds.

---

## Stage 3: Main climax and resolution (about 3:12 to end)

**Extend from the end of the second build.**

**Style**
```
full symphonic orchestra, pipe organ, euphoric wordless choir, cinematic percussion, shimmering synths, 90 bpm, 4/4, D major resolution, then sudden intimate soft piano
```

**Lyrics / structure**
```
[Instrumental]

[Climax]
D major resolution, roaring pipe organ, full orchestra fortissimo, soaring wordless choir, shimmering synths, euphoric peak

[Breakdown]
sudden drop to intimate soft piano, slow heartbeat-like sub pulse

[Outro]
one sustained warm D major chord, natural slow decay

[End]
```

**Pick a take where:**
- the main climax is clearly bigger than climax 1;
- the drop to the breakdown is sudden, not a slow fade;
- the outro is one held chord, not a new melody.

---

## Assembly

1. Use **Get Whole Song** to join the stages into one track.
2. Check the total length is roughly 3:45 to 4:30.
3. Listen to the hard stop once more in the joined track. If a tail has crept back in, cut it again with a 5 ms fade.
4. Export WAV, and save it as `app/public/audio/first_light.mp3` (or keep the WAV and point the project at it).
5. The scene build runs the song analysis with `--verify` and compares it to the table above. If the tempo drifts between stages, a `tempo_overrides.json` corrects it.

## Fallback if Extend keeps failing

Generate the piano break and second build (Stage 2) as **a separate track**, using the same key, tempo and style. Join Stage 1 and Stage 2 in an editor, then extend Stage 3 from there. You lose some musical continuity at the join, but the Void Cut happens at exactly that point, so the silence hides it.
