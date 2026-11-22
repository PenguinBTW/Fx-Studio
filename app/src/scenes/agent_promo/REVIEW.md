# agent_promo — review log

The film claims it was written, built, watched, criticised and rewritten by an agent. This file is the receipt.
Every number on screen comes from `facts.json`; every fact below has a source (a capture directory under
`.fx/captures/agent_promo/`, a command, or a reviewer report).

## Round 0 — self-review of v1 (the notes A6 draws on the wall)

Source: `r1`/`r2` captures (stills from the first authored pass). The eight prints on the wall in A5/A6 are those
real v1 frames, downsized into `prints/v1_*.jpg`. The seven lassos in A6 are these notes, verbatim:

| # | still | note on the wall | what was wrong | fix | verified |
|---|---|---|---|---|---|
| 1 | v1_02 (A1 12.5 s) | blown out. no holes? | spot intensity 60, and the hole pass erased with an alpha-less fill so no holes punched | spot 7, raised bloom threshold, `fillStyle = '#000'` before `destination-out` | r3 12.5 s |
| 2 | v1_06 (A4 38.9 s) | white-out | concrete albedo 0.55 + key 2.2 + full env: towers clip to white | concrete 0x34363a, key 1.4, env 0.35 | r3 38.9 s |
| 3 | v1_04 (A2 27.5 s) | lamp hotspot | lamp spot too hot on the cards | lamp spot lowered | r1→r4 |
| 4 | v1_01 (A0 5.0 s) | glow detached | bloom halo floated off the cursor | open � carried to round 1 | � |
| 5 | v1_05 (A3 34 s) | drones too small | drones unreadable in the wide | drone scale ×1.5 | r2 |
| 6 | v1_07 (A4 44 s) | +2 stops | same exposure fault as #2 on the wide | same fix as #2 | r3 44 s |
| 7 | v1_08 (A4 50 s) | flat | no shadows / no fog depth in the avenue | PCF soft shadows + fog | r3 50 s |

Round 0 totals: 7 notes, 4 fixed (1, 2, 6, 7), 3 carried.

Still that passed: v1_03 (A2 20 s, the card grid) — green tick on "check it".

A7 rebuilds the A4 city with the v1 look and rewrites it to the v2 parameters on screen; the closing split compares the
real v1 still (`prints/v1_07`) with the live v2 render from the same camera.

## Later rounds (independent reviewer)

Appended below per round: score (art direction / engine use), notes received, notes fixed, waived notes with reasons.
