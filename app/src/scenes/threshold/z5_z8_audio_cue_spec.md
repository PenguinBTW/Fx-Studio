# THRESHOLD Z5-Z8 audio cue requirements for W1 mix integration

Owned visual scenes are frozen; this file is the exact timing/character interface W1 needs for shared `sound/mix.ts` and stem generation. Times are project seconds. All cues should be deterministic synthesized stems, ducked under the same master bus architecture already used for Z1.

## Z5 motel corridor (105.0-130.0)

| cue id | time/duration | character | intensity/notes |
|---|---:|---|---|
| `z5_rain_window_bed` | 105.0-130.0 continuous | rain on the end-window glass, irregular fine patter | -18 to -14 dB bed; end-of-corridor localization, slight neon buzz masking |
| `z5_neon_vacancy_buzz` | 105.0-130.0 continuous | magenta/teal neon transformer buzz, unstable mains harmonics | far-end localization; subtle 50/60 Hz tremor, never musical |
| `z5_ice_machine_hum` | 105.0-128.0 continuous | compressor hum with occasional relay tick | left-wall localization near -30 m; low-mid only, 0.35 intensity |
| `z5_corridor_carpet_steps` | 105.0-128.0 gait-following | wet shoes on dense patterned motel carpet | close perspective; soft heel compression plus faint water squeeze, intensity follows walk speed |
| `z5_distant_tv_murmur` | 105.0-114.4 sparse | muffled television voices behind multiple doors | non-verbal, band-limited; right/left door localization alternating, -20 dB |
| `z5_door_214_tv_static` | 108.5-111.5 | CRT static resolving into rain/corridor room tone | right-door localization; dry close static layer as camera passes |
| `z5_cctv_corridor_feeds` | 111.5-114.5 | same rain/footstep sound slightly delayed through cheap CRT speakers | small-speaker bandpass 180 Hz-4 kHz; image-fed, low intensity |
| `z5_lint_sconce_flutter` | 112.1-112.8 | soft felt wing batting at warm metal/glass sconce | left-wall close localization; materially felt, not paper; tiny warm chirp under wing impacts |
| `z5_all_tv_cutout` | 114.5 | every CRT audio feed cuts dead simultaneously | negative cue; leave rain/breath only, duck corridor bed 6 dB for 1.5 s |
| `z5_breath_hold_slow_turn` | 114.5-120.0 | held breath, cloth micro-movement, one drip in corridor | close, dry; no music; micro-shake rustles only during 117.0-120.0 turn |
| `z5_wet_footprint_drips` | 117.0-120.0 sparse | cold water droplets soaking into carpet behind viewer | rear/center localization; 3-5 isolated drips, long but small motel tail |
| `z5_tenant_reveal_materials` | 120.45-121.65 | plastic ball crack, wet tile grind, folded paper snap, metal coil tick | centered ahead 2.5 m; layered materially with the Tenant collage, intensity 0.9 but short |
| `z5_tenant_head_tilt_creak` | 121.0-121.5 | slow composite neck creak: ceramic, rubber, damp cardboard | close-mid perspective; no voice, no animal roar |
| `z5_door_217_slam` | 121.8-122.4 | wooden motel door slam, latch impact, viewer back against panel | close right-side then interior perspective; low-mid thud plus brass rattle |
| `z5_hiding_blackout_breath` | 124.0-128.0 | suppressed breath in dark room, rain outside, slow footsteps in corridor | beam-off negative space; footsteps outside door at 125.2 and 126.6, intensity 0.55 |
| `z5_handle_turn_stop` | 126.8-127.3 | brass handle rotates partway, sticks, releases | very close/door-center localization; dry metallic stress, then silence |
| `z5_tv_self_static_bloom` | 128.0-130.0 | CRT switches itself on; static grains broaden into soft fibrous hiss | interior TV localization; static slowly low-passes into felt-muffled transition noise |

## Z6 felt puppet theatre (130.0-150.0)

| cue id | time/duration | character | intensity/notes |
|---|---:|---|---|
| `z6_felt_room_tone` | 130.0-150.0 continuous | felt-absorbed quiet, almost no high-frequency air | -24 dB bed; dry and close, intentionally lacking normal room reflections |
| `z6_music_box_slowed` | 130.0-139.0 looping | playroom music-box theme slowed, missing note restored | small wooden stage localization; -14 dB, warm but slightly warped |
| `z6_curtain_open_fabric` | 130.2-132.8 | heavy felt curtains opening in stepped 12 fps increments | center-stage localization; fabric friction segmented into discrete stop-motion pulses |
| `z6_seat_settle_creak` | 130.0-130.8 | viewer settling into upholstered theatre seat | close/below perspective; soft felt compression and wood creak |
| `z6_backdrop_roll_changes` | 134.0, 135.5, 137.0, 138.5 | painted canvas/felt backdrops rolling down | stage-center; wooden roller knock plus heavy cloth unroll, one per recap change |
| `z6_puppet_squeaks_recap` | 133.2-139.0 sparse | tiny felt/wood puppet squeaks and foot taps | close-stage localization; exactly small-scale, never cartoon comedy |
| `z6_office_recap_props` | 133.0-135.0 | miniature desk tap, paper scratch, tiny fluorescent buzz imitation | low intensity; material-filtered through felt/wood, -18 dB |
| `z6_ballpit_recap_balls` | 135.0-136.8 | a few felt/plastic balls rolling in miniature pit | dry, close, very small transients; no full Z2 rattle scale |
| `z6_pool_recap_water_hint` | 136.5-138.0 | tiny watery tick reflected in tile-like felt surfaces | almost subliminal; material transformation of Z3 water, -20 dB |
| `z6_book_slam_miniature` | 138.0-139.0 | small but heavy felt book slap | center stage; compact low-mid thump, no giant-library scale |
| `z6_music_box_missing_note_stop` | 139.0-141.5 | music box stumbles on absent note and stops | negative cue; leave only fabric room tone and puppet chase taps |
| `z6_tenant_puppet_chase` | 139.0-141.5 | rapid tiny felt footsteps, long-arm fabric swipes | stage localization; hand-made friction, not creature roar |
| `z6_lint_armrest_landing` | 141.5-142.0 | soft felt flutter, button-eye tick, tiny warm chirp | extreme close/right-armrest localization; friendly material contrast to prior creatures |
| `z6_lint_head_tilt_chirp` | 142.3-143.3 | small felt squeak/chirp, wing micro-flutters | close; warm, non-threatening, intensity 0.35 |
| `z6_follow_felt_steps` | 143.5-147.0 gait-following | viewer footsteps on carpeted aisle then wooden stage steps | soft thuds transitioning to hollow wood at stage edge; gait synchronized |
| `z6_backstage_armature_ticks` | 145.0-149.0 sparse | wire armature clicks, hook creaks, rope fibers, sandbag canvas | backstage left/right localization; quiet hand-built mechanical detail |
| `z6_exit_door_push` | 147.2-150.0 | felt door edge compresses, stitched EXIT fabric rubs, wooden frame yields | forward localization; fabric-damped push rather than hard door slam |
| `z6_cathedral_organ_precue` | 148.5-150.5 | cold blue-white organ chord swelling through door gap | forward/reverbant; hand off to T6 scale-jump transition, low-end opens at 149.8 |

## Z7 vending cathedral (150.0-195.0)

| cue id | time/duration | character | intensity/notes |
|---|---:|---|---|
| `z7_cathedral_room_tone` | 150.0-176.0 continuous | huge stone/machine nave reverb, deep air pressure | very wide non-localized bed; 5-8 s tails, -18 dB until machines wake |
| `z7_far_coin_drop` | 151.0-157.0 sparse | single coin drops far away and echoes for ~6 s | far-end localization; first at 151.4, sparse repeats, intensity 0.35 |
| `z7_machine_wake_relay_wave` | 154.0-157.0 | row-by-row relay clunks sweeping 200 m toward camera | far-to-near localization; deterministic wave, each row adds compressor hum layer |
| `z7_compressor_organ_hum` | 154.0-168.0 continuous | hundreds of compressor hums stacking into an organ-like chord | cold blue-white character; swell to -8 dB by 158, sustain under walk |
| `z7_close_machine_hum` | 158.0-163.0 | individual vending-machine fan/compressor detail | left-wall close localization; subtle product-glass buzz, intensity 0.45 |
| `z7_glass_phone_ring` | 160.0-163.0 | beige-phone ring muffled behind vending glass | left-wall row A localization; recognizably original ring but glassy/boxy |
| `z7_product_drop_cascade` | 163.0-165.2 | phones, balls, tiles, pages, felt puppets, coils dropping/rolling across stone | wide left/right wall localization then converging center; dense cascade peak 164.2 |
| `z7_tenant_assembly_snap` | 163.0-166.4 | composite objects snapping/stacking into a 4.2 m body | center-aisle localization; plastic cracks, tile knocks, paper creases, spring-coil extension, rising intensity |
| `z7_tenant_full_breath` | 166.5-176.0 intermittent | huge hollow vending-coil inhalation through plastic/tile/paper body | centered then pursuing; no vocal cords, mostly pressure/material resonance |
| `z7_chase_steps_stone` | 168.0-176.0 gait-following | hard running footsteps on polished black stone | close perspective, long nave slap echo; tempo follows run gait |
| `z7_machine_thunk_off_wave` | 168.0-176.0 | machines switching off behind runner in heavy relays | rear localization moving toward camera; each thunk subtracts compressor organ bed |
| `z7_tenant_rattling_run` | 168.0-176.0 | plastic balls, wet tile, paper, felt, spring metal running impacts | rear/center pursuit localization; uneven heavy cadence, intensity 0.9 |
| `z7_coldopen_replay_arm` | 171.3-173.4 | exact cold-open arm/beam/death audio relationship | must align to reused recurrence; beam dies electrically at 173.4, then 0.6 s near-black negative space |
| `z7_dead_flashlight_click` | 173.35-174.1 | final battery/flashlight switch click fading into darkness | close perspective; no musical sting |
| `z7_lint_relight_flutter` | 174.0-175.0 | soft felt flutter lands on dead torch; warm filament-like hum blooms | close/front localization; warm material and frequency contrast to blue machines |
| `z7_tenant_screech_recoil` | 174.7-176.0 | composite screech made of coin-metal scrape, tile shriek, tearing paper | rear/center; sharp but materially grounded, intensity 1.0 then retreat |
| `z7_rift_crack_floor` | 176.0-180.0 | stone floor cracks open ahead in long rift | forward low-frequency fracture plus gravel/debris, wide stereo |
| `z7_machine_topple_crash` | 176.0-186.0 intermittent | vending machines tip, glass shatters, metal shells crash into nave | left/right wall localization moving inward; huge reverb tails, intensity 1.0 |
| `z7_rising_chase_roar` | 180.0-186.0 | combined machine/glass/stone roar rising as rift widens | non-musical noise swell; duck footsteps only slightly so scale remains overwhelming |
| `z7_rift_entry_wind` | 186.0-192.0 | abrupt wind roar as fall begins, then smoother high-speed air | close/full-spectrum at 186.0, gradually narrowing into calm descending tone by 191 |
| `z7_falling_machine_streaks` | 186.0-192.0 sparse | upside-down machine relays and glass fragments passing upward | verticalized stereo motion feel; short whooshes, no debris impact on viewer |
| `z7_descending_tone` | 188.0-194.4 | calm descending tonal pressure, warm air replacing cold wind | low intensity; should feel like temperature changing, not a musical score cue |
| `z7_landing_carpet` | 192.0-193.2 | soft carpet impact, cloth compression, camera rises | close/below; warm dry transient contrasting cathedral reverb |
| `z7_home_clock_birds_precue` | 192.5-195.0 | first faint wall-clock tick and outside birds | forward/domestic localization; transition into T7/home bed |

## Z8 home (195.0-225.0)

| cue id | time/duration | character | intensity/notes |
|---|---:|---|---|
| `z8_home_clock_tick` | 195.0-225.0 continuous | warm wall-clock tick in family hallway | right-wall localization near hall clock; steady -18 dB, small domestic room tail |
| `z8_birds_lawnmower_loop` | 195.0-206.0 continuous | birds outside plus distant lawnmower | window-side localization; at 203.0 the mower becomes an exact 2 s loop, subtly wrong |
| `z8_kettle_boiling_rise` | 195.0-214.0 | kitchen kettle starts distant and slowly rises | far-end/kitchen localization; intensity 0.15->0.8 by 210, cut off at 214 |
| `z8_home_wood_steps` | 195.0-222.0 gait-following | slow shoes on worn wood floor and runner rug | close perspective; alternate wood/rug material depending on gait position, warm dry transients |
| `z8_dust_sun_air` | 195.0-206.0 continuous | very quiet warm room air, tiny dust/plant/coat fabric microtones | non-localized domestic bed, -24 dB; no horror drone |
| `z8_photo_frame_glass_tap` | 199.0-203.0 sparse | faint glass/frame tick as camera passes family photos | left-wall localization; 2-3 tiny ticks only, almost subliminal |
| `z8_wrong_window_fluorescent_leak` | 203.0-206.0 | fluorescent buzz bleeding through impossible office exterior | right/living-room window localization; recognizably Z1 tube buzz but distant and thin |
| `z8_lamp_shadowless_wrongness` | 203.0-206.0 | faint electrical filament hiss with no environmental response | right/lamp localization; low intensity, should feel wrong only in context |
| `z8_wall_phone_ring_exact` | 206.0-210.0 repeating | original beige phone ring from Z1, exact same bell character/cadence | right-wall/front-door localization; dry domestic close perspective, intensity 0.9 |
| `z8_receiver_lift_click` | 210.0-210.8 | receiver leaves cradle by itself: plastic lift, hook click, cord coil tension | extreme close/right-wall localization; no hand or creature sound |
| `z8_receiver_swing_cord` | 210.8-214.0 | curled cord creaks and handset taps/sways gently | close; small hollow beige-plastic resonance, motion synchronized |
| `z8_receiver_fluorescent_voice` | 210.0-214.0 | Z1 fluorescent buzz and ticking tube heard through receiver earpiece | very close localization as if inside receiver; bandpass 250 Hz-3.5 kHz, intensity 0.55 |
| `z8_kettle_whistle_cutoff` | 214.0-214.6 | kettle whistle peaks then cuts off dead | far kitchen localization; sudden silence leaves handle/room tone exposed |
| `z8_door_handle_turns` | 214.0-216.0 | brass/front-door handle rotates by itself, latch stress | right/front-door close localization; slow mechanical turn, no supernatural voice |
| `z8_door_open_office_reveal` | 217.5-220.0 | wooden front door swings open; domestic air is replaced by office fluorescent space | door-centered localization; hinge creak plus perspective/room-tone handoff |
| `z8_z1_fluorescent_swell` | 218.0-225.0 | fluorescent buzz swells as exact office loop is revealed | forward/office localization; identical material character to Z1, intensity rises 0.35->0.85 |
| `z8_desk_phone_ring_loop` | 218.0-225.0 repeating | beige desk phone ringing inside office | forward/desk localization; same exact ring motif, now returning to origin |
| `z8_carpet_transition_steps` | 222.0-225.0 gait-following | footsteps change from warm wood to damp office carpet over threshold | close perspective; material crossfade at doorway, no musical transition hit |

## END end screen (225.0-235.0)

| cue id | time/duration | character | intensity/notes |
|---|---:|---|---|
| `end_office_bed_darkened` | 225.0-235.0 continuous | Z1 fluorescent/office room bed, darkened and slightly distant | non-localized but office-forward; -20 dB, stable enough for end-screen UI |
| `end_phone_ring_fadeout` | 225.0-235.0 sparse repeating | beige phone rings, quieter each repetition | desk localization inside office image; each ring -2 dB relative to previous, final ring almost subliminal |
| `end_air_decay` | 225.0-235.0 continuous | room tone slowly loses high-frequency air | subtle negative cue; no closure music, no creature vocalization |

## Cross-zone parameters needed by W1

- Flashlight flicker should not have a musical cue; keep it electrical/subtle and below creature/event cues.
- All creature/helper cues should be materially derived: plastic balls/tile/paper/coil for the Tenant; felt/button/soft wing material for Lint; wood/felt/canvas mechanics for theatre puppets.
- Phone ring motif should remain recognizably identical in Z5-Z8 when the story requires the original thread, but transform by enclosure/material: payphone shell/motel wall, vending glass, wall-mounted domestic wood/plastic, then exact Z1 desk phone.
- Z6 must sound materially absorbent: reduce normal room reflections and high-frequency air so the cathedral scale jump at 150.0 feels physically larger.
- During hiding, freeze, hold-breath, and beam-death rules, prioritize negative space: duck beds rather than adding new tension music.
