# agent_promo — storyboard

Song: Daft Punk — "Technologic" (Human After All, official audio, 4:44), cut to **224.44 s** by removing exactly 32 bars
(song 173.852 → 233.686 s, splice on a downbeat with a 12 ms equal-gain crossfade placed at the quietest point within
±60 ms). Grid: **128.37 bpm**, BAR = 1.86957 s, bar 1 = 1.848 s (`audio.json` downbeats, verified). `bar(k) = 1.848 + (k-1)·BAR`.
Analysis: `python scripts/analyze_song.py --audio <cut.wav> --out app/public/data/agent_promo/audio.json`.

## Music map (timeline bars)
| bars | time (s) | music |
|---|---|---|
| 1–14 | 1.85–28.0 | riff + the verb list, no drums |
| 15–16 | 28.0–31.8 | drums enter |
| 17–30 | 31.8–57.9 | groove (verb list ×2; "write it, cut it, paste it…" on bar 20) |
| 31–32 | 57.9–61.7 | dip |
| 33–36 | 61.7–69.2 | breakdown: "Technologic" ×4 (61.05, 63.05, 64.98, 66.82) |
| 37 | 69.15 | **drop** |
| 37–76 | 69.2–143.9 | full groove, sparser vocal bars 63–67 |
| 77–80 | 143.9–151.4 | dip |
| 81–92 | 151.4–173.8 | vocal peak → full |
| 93–100 | 173.8–188.8 | breakdown: "Technologic" ×8 (post-splice) |
| 101–114 | 188.8–215.0 | outro groove, no vocal |
| 115–119 | 215.0–224.4 | tail, "Technologic" ×4, end |

## Acts
| act | entry | bars | time | world / action | agent line | exit → entry vector |
|---|---|---|---|---|---|---|
| A0 cold open | a0_cursor | 0–2 | 0–5.6 | void; the orange cursor; the user's prompt is typed | `ok.` | push-in into the cursor (+z) |
| A1 prompt | a1_tape | 3–8 | 5.6–16.8 | Blender tape punch; the prompt's real ASCII bytes are punched row by row; camera rides the tape | `one sentence. N bytes.` | tape rises out of frame (+y) |
| A2 plan | a2_plan | 9–14 | 16.8–28.0 | night desk; storyboard index cards deal on beats; cards stand up into the 119-bar grid (heights = real loudness) | `119 bars. i planned every one.` | crane down the grid toward the bright crest (+x) |
| A3 orchestrate | a3_swarm | 15–19 | 28.0–37.4 | drums: the lead light doubles on beats 1→64 drones in a dark hangar | `i don't work alone.` | swarm dives forward (+z) |
| A4 build | a4_build | 20–30 | 37.4–57.9 | robot arm + drones assemble a circuit city; WRITE/CUT/PASTE/SAVE/LOAD/CHECK/REWRITE drive it | lyric verbs | crane up/back |
| A5 watch | a5_print | 31–36 | 57.9–69.2 | CHECK: frame freezes (shutter); the frame is printed; each "Technologic" pins another print | `then i watch it.` | truck right along the wall |
| A6 critique | a6_critique | 37–52 | 69.2–99.1 | drop: cork wall of real stills from this build; red marker lassos, notes, REJECT/OK stamps; strip-chart pen draws telemetry | `i don't like it.` + note counts | rewind (−x) |
| A7 rewrite | a7_rewrite | 53–68 | 99.1–129.0 | playhead rewinds; the v1 print is swept away by the live v2 world | `so i rewrite it.` | pull back (−z) |
| A8 self-aware | a8_meta | 69–80 | 129.0–151.4 | the film is a physical timeline; split-flap frame counter; same frame twice, Δ = 0 | `frame N. again.` `same frame.` | dive into the playhead |
| A9 rush | a9_rush | 81–92 | 151.4–173.8 | every world at once, cuts accelerate 1 bar → ⅛ bar, orange cut bars | — | collapse to the cursor |
| A10a breather | a10_quiet | 93–100 | 173.8–188.8 | cream paper, one cursor; Cormorant italic | `it is never finished.` `only rendered.` | page folds into vortex |
| A10 lock-up | a11_mark | 101–119 | 188.8–224.4 | worlds orbit a vortex; drones assemble the f(x) STUDIO mark; tail chants pulse it | `made by an agent. finished by you.` | end |

## Transitions (all `agp_*`, beat-anchored, carried by the orange block, ≤ 4 sampled scenes per frame)
| id | seam | at (s) | dur | idea |
|---|---|---|---|---|
| agp_cursor_dive | a0→a1 | 5.33 | 0.5 | camera enters the cursor; inside it is the tape |
| agp_tape_lift | a1→a2 | 16.6 | 0.4 | the tape strip sweeps up across frame, its orange edge wipes to the desk |
| agp_flare | a2→a3 | 27.82 | 0.4 | the grid's marker flares and becomes the lead drone light |
| agp_slice | a3→a4 | 37.17 | 0.35 | the orange CUT line slices the frame diagonally on the downbeat |
| agp_shutter | a4→a5 | 57.7 | 0.5 | CHECK: a4 freezes (sampled at a fixed t), orange iris blades close/open into the printer |
| agp_drop | a5→a6 | 68.95 | 0.4 | push into a print, impact on the drop |
| agp_rewind | a6→a7 | 98.8 | 0.6 | from-scene sampled at decreasing t with tape-warble bands; the playhead line sweeps |
| agp_pullout | a7→a8 | 128.75 | 0.5 | frame shrinks into a clip on the timeline |
| agp_rush | a8→a9 | 151.2 | 22.6 | the rush itself: samples earlier scenes at chosen times, cut cadence accelerating with orange cut bars |
| agp_collapse | a9→a10 | 173.6 | 0.5 | everything collapses into the cursor point, page opens |
| agp_vortex | a10→a11 | 188.55 | 0.6 | the page twists into the vortex |

## Version log
- v1 — first full pass (see REVIEW.md for rounds and what changed).
