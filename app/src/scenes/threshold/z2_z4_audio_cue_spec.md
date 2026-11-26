# THRESHOLD Z2-Z4 audio cue requirements for W1 mix integration

Owned visual scenes are frozen; this file is the exact timing/character interface W1 needs for shared `sound/mix.ts` and stem generation. Times are project seconds. All cues should be deterministic synthesized stems, ducked under the same master bus architecture already used for Z1.

## Z2 ball-pit playroom (30.0-55.0)

| cue id | time/duration | character | intensity/notes |
|---|---:|---|---|
| `z2_music_box_jingle_bed` | 30.0-40.5, looping under bed | 8-note music-box loop, bright but slightly too slow | -14 to -11 dB under room tone; note 6 must drop out from 36.0 onward |
| `z2_child_laughter_birds` | 30.2-38.0 sparse | one distant child laugh, skylight birds | very low, non-localized; relief layer only |
| `z2_animal_turn_clicks` | 33.2, 34.1, 35.0 | small hard plastic clicks, stepped at 6 fps feel | 3 close clicks as final shelf animals turn; dry, no reverb tail |
| `z2_ball_rattle_approach` | 38.0-40.5 | thousands of plastic balls micro-rattling, moving toward camera | fade 0.35->0.9; should track the visible bulge approach |
| `z2_breath_stop_silence` | 40.5-41.0 | abrupt removal of breath/jingle, near-vacuum | duck jingle/room tone 8-10 dB; heartbeat enters after 41.0 |
| `z2_heartbeat_freeze` | 40.8-47.5 | low thump, 72 bpm rising to 95 bpm | -8 dB initial, +4 dB swell by 47.5; no melodic content |
| `z2_swimmer_plastic_breath` | 44.6-47.5 | hollow wet breath through a ribbed plastic tube | close perspective; 0.6-1.0 s inhale/exhale cycles, slight vinyl creak |
| `z2_swimmer_surface_balls` | 44.5-45.2 | balls cascade off surfacing head | short bright rattle burst, peak at first mouth visibility |
| `z2_toy_phone_ring` | 47.5-49.5 | electronic warble version of beige-phone ring, toylike/red-yellow plastic | right-side localization feel; repeating 0.7 s ring cadence |
| `z2_swimmer_dive_rattle` | 48.4-49.3 | fast ball displacement/dive toward phone | loud short rattle sweep, ends in hollow plastic gulp |
| `z2_tunnel_clothes_plastic` | 49.5-55.0 | clothes rubbing inside ribbed tunnel, close crawls | low-mid friction, synchronized to crawl gait, no footsteps |
| `z2_tenant_tunnel_cross` | 52.2-52.7 | brief air-pressure subtraction + distant plastic scrape | subtle; should read as a presence crossing light, not a jump scare |
| `z2_tunnel_wetness` | 53.4-55.0 | plastic friction gains watery squeaks/drips | bridge into existing `t2_plastic_to_water` transition cue |

## Z3 pool halls (55.0-80.0)

| cue id | time/duration | character | intensity/notes |
|---|---:|---|---|
| `z3_water_steps` | 55.0-78.2, gait-following | knee-deep water swish per step, long tiled-hall tail | close transient + 2.5-4 s reverb; slows during controlled retreat |
| `z3_deep_hum_drips` | 55.0-79.4 continuous | deep reverberant hum, distant drips | room-tone layer; hum drops a semitone at 62.8 |
| `z3_reflection_lag_air` | 58.5-61.0 | almost subliminal delayed air movement/water lap | 0.4 s lag feel; supports reflection mismatch, low level |
| `z3_hum_semitone_drop` | 62.7-63.2 | hum glides down one semitone and holds | audible but musicality avoided; no horror sting |
| `z3_not_your_water_step` | 64.8 | one water step that is not the viewer's | isolated, slightly ahead/right, long reverb |
| `z3_tenant_underwater_swell` | 68.0-68.5 | very low submerged pressure swell | mostly sub/low-mid, no voice; 1 s maximum |
| `z3_wet_phone_ring` | 70.0-72.0 | beige phone ring muffled through water/plastic foam | right-side localization, repeating, distorted/wet |
| `z3_mirrorling_surface_emerge` | 72.0-72.5 | wet tile scrape plus water sheet shedding | hum cuts out at 72.1; scrape should be sharply audible |
| `z3_mirrorling_steps` | 72.5-74.5 | tile-on-water steps, each landing late then holding | discrete stepped cadence matching visual advance; splash ring under each step |
| `z3_backward_water_steps` | 74.5-78.2 | faster retreating water steps, controlled panic | increase tempo and intensity without running splash chaos |
| `z3_heel_step_fall` | 78.0-78.5 | heel strikes submerged step, body tips | short ceramic knock then cloth/water rise |
| `z3_splash_underwater` | 78.4-80.0 | splash fills frame then muffled underwater roar | fast high-frequency splash cut into low-pass pressure/ink bloom |

## Z4 paper library (80.0-105.0)

| cue id | time/duration | character | intensity/notes |
|---|---:|---|---|
| `z4_paper_room_microtones` | 80.0-94.0 continuous | quiet room tone, clock ticking, dry paper rustles like leaves | cozy but dead; very little low end |
| `z4_distant_cough` | 81.8 | one far human cough | single only, long paper-room tail; no voice line |
| `z4_moth_flutters` | 80.4-82.2 sparse | folded paper wing flutters, one slightly fuzzy/fabric | close stereo flutters; Lint should sound materially different |
| `z4_pen_step_scratches` | 83.0-86.0 | fountain-pen nib scratches `step.` per footfall | exactly synchronized to footstep gait, dry close perspective |
| `z4_pen_rule_lines` | 86.0-91.7 | continuous careful writing between phrases | quieter than step scratches; stops dead when clock stops |
| `z4_clock_stops` | 88.0-88.4 | ticking ceases with one final tooth-click | negative cue: silence should be noticeable |
| `z4_tenant_shadow_paper_sweep` | 89.7-91.6 | long soft paper sweep across canyon wall | no creature vocalization; direction left-to-right/right-wall feel |
| `z4_folded_phone_ring` | 91.8-93.2 | phone ring heard through a cardboard tube / dry paper rattle | right-side shelf localization; brittle folded-paper flutter on each ring |
| `z4_archivist_unfold_roar` | 94.2-95.5 | huge sheet tearing/folding, page-riffle roar | main creature cue; sharp paper attack, not animal roar |
| `z4_archivist_arm_blowers` | 95.0-96.2 | accordion paper arms extending like party blowers | rapid segmented zipper/crease pops, stereo wide |
| `z4_archivist_topple_steps` | 95.5-103.7, 1.2 s cycle | repeated topple/unfold locomotion: heavy paper slam, fibre creak, re-fold | each cycle lands late then holds; intensity approaches camera during chase |
| `z4_running_paper_steps` | 95.5-104.0 | soft crunching run on layered paper floor | gait-following, less sharp than office run |
| `z4_stack_slam_chain` | 97.0-103.7, every ~1.2 s | canyon stacks fold/slam like giant book pages | boom chain gets closer; low-mid slam plus paper snap, avoid wooden door sound |
| `z4_pages_fly_chase` | 97.0-104.0 intermittent | loose sheets whip past microphone | short stereo paper flaps synchronized to canyon closing |
| `z4_final_page_slam_precue` | 102.5-104.7 | closing gap paper pressure rises; final strip of light/red neon | pre-silence tension, then hand off to existing `t4_page_slam_neon` |

## Cross-zone parameters needed by W1

- Flashlight flicker should not have a musical cue; keep it electrical/subtle and below creature/event cues.
- All creature cues should be materially derived: plastic balls/tube for Pit Swimmer, wet tile/water for Mirrorling, paper fibre/crease/slam for Archivist.
- Phone ring motif should remain recognizably related across Z1-Z4 but transform by material: beige plastic/office, toy electronic, wet muffled, cardboard/paper.
- During hold-breath rules, prioritize negative space: duck beds rather than adding new tension music.
