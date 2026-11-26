# THRESHOLD -- Storyboard and shot plan (long form, then Short)

This is the plan. Workers build THIS, beat by beat. You may improve a detail (a better prop, a better sound, a tighter timing) but you may not change the structure, the order of zones, a creature's rule, or a zone's response without the orchestrator's approval. Read `looks.md` alongside this: it says how every place and creature looks and how to build it. Both files go into `app/src/scenes/threshold/` as the project's world bible.

## A. How to read this document

- **Timecodes** are seconds on the project timeline (`project.json`), shown as `s` and as m:ss.
- **Beat** = a camera action inside a zone. First person is mostly one continuous take per zone, so beats are not cuts; a hard cut is marked `CUT`.
- **Camera notation:** `EYE` = 1.65 m eye height standing. `CROUCH` = 1.05 m. `FOV n` = vertical field of view in degrees for 16:9 (the Short uses its own values, section I). `walk` / `run` / `still` / `creep` = the gait presets of the shared first-person rig (see `looks.md` section 2). `look L 40 / 2.5s` = turn head 40 deg left over 2.5 s with overshoot and settle. `whip` = a turn in 0.2-0.3 s with motion blur.
- **Beam** = the flashlight. `beam ON / OFF / flicker / dim` are its states. `flicker` always means "something is near" (the viewer learns this in Z1 and it stays true all film).
- **NEW** = the new information in that beat (rule R3: a beat of more than 6 s with no NEW line is a defect).
- **SFX** names are for the cue sheet in section G.

## B. The premise in one line

You are lost in an endless interior where every room is a different world built to look like somewhere comforting, and something in each one is wrong.

On-screen line (Short frame 0, long-form title card at 0:04): **"every room down here is a different world"** -- lower-case, the house typeface chosen in `looks.md` section 1.6, inside the safe zone.

## C. The threads that run through the whole film (open loops, R6)

1. **The beige phone.** A 1980s beige office desk phone appears in every zone, rebuilt in that zone's material (real plastic in the office, a toy phone in the playroom, floating on the pool, folded paper in the library, the motel room phone, a felt puppet phone, sold in a vending machine, on the wall at home). It rings in every zone. Each time it is answered (the receiver lifts by itself: no hands are ever shown) you hear the room tone of the PREVIOUS zone. Payoff at home (Z8): the receiver lifts and you hear the office buzz from Z1, then the door opens onto the office. Loop.
2. **The flicker rule.** Beam flicker = something near. Taught in Z1 (flicker, then the eyes). Used honestly every time after. Broken once on purpose in Z6 (it flickers, and the thing is friendly).
3. **The battery.** The beam starts at full and dims in steps after each chase: 100% in Z1; 85% after the Z1 run and through Z2; 70% by the Z3 retreat and at Z4 entry; 50% at the end of the Z4 chase and through Z5/Z6; 25% in Z7/Z8; dead at 173.4 s; relit warm by Lint (Z6's helper) at 174 s.
4. **The Tenant.** The main antagonist, a tall patchwork thing made of pieces of every zone. It is only glimpsed, each time a little more: Z2 a shape at the far end of the play tunnel (0.5 s); Z3 a pale shape deep under the water; Z4 a long shadow sliding across paper stacks; Z5 it is on the TV behind you, then in front of you; Z7 full reveal and chase. The cold open (0:00) is a flash-forward of its arm reaching into the beam at 172 s.
5. **Lint the felt moth.** A small felt moth that first appears as a speck in the beam in Z4 (a felt moth among paper moths: out of place, sharp viewers notice), then in Z5 batting at the neon, then it is the helper in Z6, and it relights the flashlight in Z7. Tiny, warm, the only friend.

## D. Master timeline (long form, 1920x1080, 60 fps, 235 s)

| Zone | id | Start-end (s) | m:ss | Look (see looks.md) | Response | Creature / threat |
|---|---|---|---|---|---|---|
| Z0 | coldopen | 0.0-4.0 | 0:00-0:04 | Vending Cathedral (flash-forward) | run | Tenant's arm |
| Z1 | office | 4.0-30.0 | 0:04-0:30 | Grimy fluorescent office | investigate, then run | Ceiling Breather |
| Z2 | playroom | 30.0-55.0 | 0:30-0:55 | Cel-shaded toy plastic, sunlit | FREEZE (hunts movement) | Pit Swimmer |
| Z3 | pool | 55.0-80.0 | 0:55-1:20 | Liminal pool halls, caustics | walk backwards, keep eye contact | Mirrorling |
| Z4 | library | 80.0-105.0 | 1:20-1:45 | Paper cut-out library | RUN (the stacks close) | The Archivist |
| Z5 | motel | 105.0-130.0 | 1:45-2:10 | Neon/sodium rain motel, CRT | slow turn-around, then HIDE, beam OFF | The Tenant (partial) |
| Z6 | theatre | 130.0-150.0 | 2:10-2:30 | Felt stop-motion puppet theatre | FOLLOW (helped) | Lint (friendly) |
| Z7 | cathedral | 150.0-195.0 | 2:30-3:15 | Monumental chrome vending cathedral | long chase, then fall | The Tenant (full) |
| Z8 | home | 195.0-225.0 | 3:15-3:45 | Warm realistic home, golden hour | approach the phone | the house itself |
| END | endscreen | 225.0-235.0 | 3:45-3:55 | Office loop frame, darkened | -- | end-screen slots |

Adjacent entries overlap by the transition length in section F. Zone lengths obey R5 (20-45 s, and the 45 s cathedral changes rules twice).

## E. Zone storyboards

### Z0 -- Cold open (0.0-4.0 s) -- flash-forward of Z7 at 172 s

Purpose: frame 0 hook (R2). Already running, already something behind. Re-uses the Z7 cathedral set and the Tenant.

| Beat | Time | Camera | In frame | Action | Beam | Audio | NEW |
|---|---|---|---|---|---|---|---|
| 0.1 | 0.00-1.20 | EYE, `run`, FOV 82, forward down the cathedral aisle, roll +-3 deg per step | Two walls of glowing vending machines racing past, polished black floor with long reflections, the aisle vanishing to a point | Mid-sprint. Frame 0 is mid-step, motion blur on, a machine's light streaking on the left | ON, 25%, swinging with the run | Hard breathing, fast footsteps on polished stone, a low organ-like hum chord | The place, the danger, a person running |
| 0.2 | 1.20-1.70 | `whip` R 150 (look back over shoulder) | The aisle behind: machines switching OFF in a wave toward camera, and inside the darkness a tall shape | The look-back | flicker | Machines thunking off one by one, getting closer | Something is chasing |
| 0.3 | 1.70-2.40 | `whip` back forward, then stumble: camera dips 30 cm, roll 12 deg | Floor rushes up, the beam skids across it | Trip | flicker hard | Scuff, a gasp | -- |
| 0.4 | 2.40-3.30 | Camera on the floor, rolled 70 deg, looking back along the floor | A long arm (tile, chrome, paper and felt pieces, five too-long fingers made of vending spiral coils) reaches into the beam, fingers spreading 30 cm from the lens | The arm reaches | flicker then DEAD | A wet plastic creak, a coin-drop rattle inside the arm | The creature |
| 0.5 | 3.30-4.00 | Black | Nothing | -- | OFF | 0.25 s total silence (pre-drop vacuum), then the fluorescent buzz of Z1 fades in | -- |

CUT to Z1 on the buzz. No title card over the cold open.

### Z1 -- Office "Level 0" (4.0-30.0 s) -- investigate, then run

Purpose: the only familiar place; establish first person, the beam, the phone thread and the flicker rule. It must be SHORT and something must happen by 10 s (lesson: the office ran too long last time).

| Beat | Time | Camera | In frame | Action | Beam | Audio | NEW |
|---|---|---|---|---|---|---|---|
| 1.1 | 4.00-6.50 | EYE, `still` with breath drift, FOV 74 | Endless office: damp mustard carpet, beige partition walls, fluorescent panels with two tubes failing, ficus in a pot, a desk with the beige phone 6 m ahead | Exposure settles from black (1 s). Title line "every room down here is a different world" types on lower-left third, holds 2 s, fades | ON 100% but washed out by tubes | Fluorescent buzz (60 Hz + harmonics), a tube ticking, HVAC hiss | The premise, stated |
| 1.2 | 6.50-8.00 | `look L 25 / 1.2s` then back | A corridor of cubicles; a monitor glowing with a screensaver of the same corridor | -- | ON | -- | The place watches |
| 1.3 | 8.00-11.00 | `walk` toward the desk, 4 m | Desk with coffee mug (mould film), sticky notes, the beige phone | The phone RINGS at 8.30 | ON | Phone ring (old bell ringer, two bursts) | The phone thread starts |
| 1.4 | 11.00-13.00 | Lean in, CROUCH-ish (1.45 m), FOV 68 | The phone fills a third of the frame | The receiver lifts 4 cm off the cradle by itself and hangs there | ON | Ring cuts off. Through the receiver: silence, then your own breathing, 0.4 s delayed | You can't explain it |
| 1.5 | 13.00-15.50 | `still`, then a small `look U 10` | Ceiling tile directly above the desk: dust falls in the beam | Dust sifts. A tile shifts 2 cm | flicker (first time) | Breathing that isn't yours, above, slow and wet | Something near; teach the flicker |
| 1.6 | 15.50-18.50 | `look U 65 / 2.5s` (slow dread turn) | The tile is gone. Black gap. Two eyes catch the beam (retroreflective, green-white), 70 cm apart: too far apart | Eyes blink once (one lid slower) | flicker | Breathing stops. 0.1 s silence | The Ceiling Breather |
| 1.7 | 18.50-19.30 | Hold | Long grey fingers (cable bundles with drop-ceiling-grid knuckles) curl over the tile edge | The fingers grip and the grid bends | flicker | Metal grid creak, ceiling tile cracking | It's coming down |
| 1.8 | 19.30-27.50 | `whip` down/back, then `run` FOV 84 through cubicles, two turns (R then L), 12 m | Cubicles, office chairs spinning as you clip them, a printer, paper falling; ceiling tiles popping out behind you in a chain as something moves above | The run | ON, swinging | Running on carpet, tiles slamming down behind, the breather's rasp moving above | The chase; the ceiling is its road |
| 1.9 | 27.50-30.00 | Run toward a green-lit fire door; FOV 88 | Fire door with push bar, a strip of hard daylight under it, and a child's music-box jingle from behind it | Camera impacts the door; door bursts open; frame blows out to white | ON 85% (battery step) | Door bar clank, the jingle in full, the office buzz cut dead | -- |

Transition T1 (29.6-30.4): exposure blowout from fire-door daylight (section F).

### Z2 -- Ball-pit playroom (30.0-55.0 s) -- FREEZE: it hunts movement

Purpose: first big contrast (from grimy office to saturated cartoon sunlight). The lure is relief. First response variant: stillness. First Tenant glimpse.

| Beat | Time | Camera | In frame | Action | Beam | Audio | NEW |
|---|---|---|---|---|---|---|---|
| 2.1 | 30.00-32.50 | EYE, `still`, FOV 76; exposure settles from white over 1 s | A huge indoor playground under a skylight: ball pit 12 m across (red, yellow, blue, green balls), a spiral tube slide, foam steps, a climbing net, plastic animals on shelves, painted clouds on the walls | Relief. Breath slows | ON but invisible in sunlight | Music-box jingle (8-note loop), distant child laughter (one voice, looped), birds through the skylight | A totally different world |
| 2.2 | 32.50-36.00 | `walk` slowly along the pit edge, `look R 30` | Shelves of plastic animals (giraffe, duck, elephant, frog, lion, ~20) | As you pass, every animal is facing you. Look away and back: they have turned again (the last 3 turn on screen, 6 fps stepped) | ON | Small plastic clicks as they turn | Undertone 1 |
| 2.3 | 36.00-38.00 | `look U 20` | The skylight: sun shining, but no shadows anywhere under the slide or the net | -- | ON | The jingle has one note missing (note 6 is silent) | Undertone 2 |
| 2.4 | 38.00-40.50 | `walk` 2 steps, then `still` | The ball surface ahead: a bulge, like a fin under water, sliding through the balls toward you | Balls roll off the bulge | ON | Balls rattling | The Pit Swimmer |
| 2.5 | 40.50-44.50 | FREEZE: breath drift stops, the shared rig `holdBreath` (micro-shake only) | The bulge stops 2 m away the moment you stop. Holds. Moves 50 cm when the camera drifts 1 cm. Stops | You learn the rule: it hunts movement | flicker | Breath sound stops. Your heartbeat (low thump at 72 bpm, rising to 95). Silence otherwise; jingle stops | Its rule, taught in 4 s |
| 2.6 | 44.50-47.50 | Locked still | The Swimmer surfaces 1.5 m away: a head made of ~60 fused balls, a mouth that opens like a split ball, inside it the spiral of a tube slide going down into darkness | It listens, mouth open | flicker | A hollow plastic breath through the tube | The face |
| 2.7 | 47.50-49.50 | Still; eyes only: the camera pans 8 deg R very slowly | A toy phone (red and yellow plastic, beige receiver) on a foam step, RINGING | The Swimmer's head snaps toward it and dives | flicker | Toy-phone ring (electronic warble version of the beige phone) | The phone thread |
| 2.8 | 49.50-53.50 | `creep` (slow, low bob) to a play tunnel 3 m left, CROUCH, into the tube | Inside the tube: blue plastic ribbed walls. At the far end, for 0.5 s at 52.4 s, a tall shape crossing the light | Tenant glimpse 1 | ON | Your clothes rubbing on plastic, balls rattling behind as the Swimmer hunts the phone | The Tenant exists |
| 2.9 | 53.50-55.00 | `creep` forward, the tube gets wet; the blue plastic turns into blue tiles | The tube's end opening onto white tiled light | -- | ON 85% | Echo grows, water drips | -- |

Transition T2 (54.6-55.4): material morph inside the tube (plastic ribs -> grout lines) (section F).

### Z3 -- Pool halls (55.0-80.0 s) -- walk backwards, never break eye contact

Purpose: calm beauty, the "reflection" undertone, the second response variant (slow, controlled retreat). Second Tenant glimpse.

| Beat | Time | Camera | In frame | Action | Beam | Audio | NEW |
|---|---|---|---|---|---|---|---|
| 3.1 | 55.00-58.50 | EYE, `walk` slowly, FOV 74 | White-tiled halls flooded knee-deep with glassy blue water, rounded tiled arches, a skylight-less soft light from nowhere, caustics rippling on every wall and ceiling | Walking in water | ON, reflecting on the water | Water swish per step, a deep reverberant hum, distant drips with 4 s reverb tails | A new world: calm |
| 3.2 | 58.50-61.00 | `look D 35 / 1.5s` | The water surface: your reflection -- a dark silhouette holding a flashlight (the only time a "you" appears, and only as a reflection) | The reflection's beam moves a beat (0.4 s) after yours | ON | -- | Undertone: it lags |
| 3.3 | 61.00-64.00 | `still`, small look L then R | The reflection keeps moving its head after you stopped. Then it stops and looks up at you | -- | flicker | The hum drops a semitone | The Mirrorling |
| 3.4 | 64.00-66.00 | Hold eye contact; a slow 1-step back | The reflection steps FORWARD (towards the surface) as you step back | Rule: when you look away it advances; when you watch it, it only mirrors | flicker | One water step that isn't yours | Its rule |
| 3.5 | 66.00-70.00 | Walk backwards (`walk` reversed, slower, more sway), eyes down on the water | Tiles behind you are unseen; deep under the water, a pale tall shape stands still on the pool floor for 1 s at 68.2 s (Tenant glimpse 2) | Controlled retreat | ON 70% | Your breathing, trying to stay slow | Tenant glimpse 2 |
| 3.6 | 70.00-72.00 | A sound on the right: `look R 50`, unwillingly | A beige phone floating on a foam float, ringing | You looked away | flicker | Phone ring, wet and muffled | The phone thread |
| 3.7 | 72.00-74.50 | `whip` back to the water | The Mirrorling is standing ON the water surface 3 m away: your silhouette, tall, skin of white tiles with black grout lines, the flashlight in its hand is a lit tile | It takes a step on the surface (ripples) | flicker hard | Wet tile scrape, the hum stops | It got out |
| 3.8 | 74.50-78.50 | Walk backwards faster, then the heel hits a step edge: fall backwards, FOV 90, camera tips 100 deg | The tiled arch, then the ceiling, then a splash fills the frame | Fall back into deep water | ON | Splash, then muffled underwater roar | -- |
| 3.9 | 78.50-80.00 | Underwater, sinking, looking up | The bright surface receding; ink-black clouds blooming in the water around you | Ink spreads | ON (blue-green) | Underwater pressure, a low drone | -- |

Transition T3 (79.4-80.6): ink in water becomes ink on paper (section F).

### Z4 -- Paper library (80.0-105.0 s) -- RUN: the stacks close like a book

Purpose: first full chase that is a different mode from Z1 (the space itself attacks). Diegetic text. Lint's first appearance.

| Beat | Time | Camera | In frame | Action | Beam | Audio | NEW |
|---|---|---|---|---|---|---|---|
| 4.1 | 80.00-83.00 | EYE, rising from CROUCH (you climb out of a "page" on the floor), `still`, FOV 72 | A library where everything is paper and card: stacks of paper 8 m high like canyon walls, cut-out lamp shades with warm bulbs, paper vines on the stacks, a reading desk with a green card lamp | Breath recovers. Paper moths (folded white) drift in lamp light; one of them is FELT (brown, fuzzy): Lint, 0.8 s | ON 70% | Quiet room tone, a clock ticking, paper rustling like leaves, a cough far away (the only "person") | A new world: cozy |
| 4.2 | 83.00-86.00 | `walk` to the desk, 3 m | On the desk: an open ledger. A fountain pen writes by itself in neat ink: "step." with each of your steps | The pen writes "step. step. step." in sync with footfalls | ON | Pen nib scratch on each step | Undertone: it records you |
| 4.3 | 86.00-89.00 | `still`, lean over the ledger, FOV 64 | The pen writes: "it stopped." Then: "it is reading this." | Text on paper only (no overlay text) | ON | Scratching; the clock stops | The rule: the page tells the creature where you are |
| 4.4 | 89.00-91.50 | `look R 40 / 2s` | Between two stacks: a long shadow slides across the paper walls (Tenant glimpse 3, shadow only). Then a folded-paper phone on a shelf rings | -- | flicker | A paper-phone ring (dry rattle, like a ring through a cardboard tube) | Tenant 3 + the phone |
| 4.5 | 91.50-94.00 | Back to the ledger | The pen writes: "it is behind you." | -- | flicker | -- | -- |
| 4.6 | 94.00-95.50 | `whip` R 160 | The Archivist unfolding from a stack 4 m away: a tall figure of folded sheets, arms of accordion-folded paper, a blank page face that creases into a mouth | It reaches; paper arms extend 3 m like party blowers | flicker hard | A huge sheet tearing and folding sound, a page-riffle roar | The Archivist |
| 4.7 | 95.50-102.50 | `run` FOV 86 down the canyon between stacks; two turns | The stacks fold inward behind you like the pages of a book closing, slam after slam; pages fly; ahead the canyon narrows to a gap of light | The chase | ON, swinging | Running on paper (soft crunch), book-slam booms every 1.2 s getting closer, the pen still scratching "run run run" somewhere | The space attacks |
| 4.8 | 102.50-105.00 | Dive through the gap between two closing pages, FOV 92 | The two pages close on the lens; the last strip of light is red neon | Slam to black | ON 50% | One final book slam (heavy, with a 0.08 s pre-silence), then rain | -- |

Transition T4 (104.7-105.3): page slam to black, neon flickers on (section F).

### Z5 -- Motel corridor at night (105.0-130.0 s) -- slow turn-around, then HIDE, beam OFF

Purpose: relief (rain, a vacancy sign), then the most patient scare of the film: the CCTV TVs. The Tenant is shown in part. The battery is already at 50% entering the motel.

| Beat | Time | Camera | In frame | Action | Beam | Audio | NEW |
|---|---|---|---|---|---|---|---|
| 5.1 | 105.00-108.50 | EYE, `walk` slowly, FOV 72 | A long motel corridor: patterned wet carpet, numbered doors, rain-streaked window at the end lit magenta and teal by a VACANCY neon sign outside, sodium wall sconces, an ice machine humming | Relief after the slam | ON 50% | Rain on glass, neon buzz, ice machine hum, a TV murmur behind doors | A new world: night |
| 5.2 | 108.50-111.50 | `look R 30`, keep walking | Door 214 ajar, a CRT TV inside showing static, then a picture: this corridor from a high CCTV angle, with a small figure holding a flashlight (you) | -- | ON | TV murmur becomes the corridor's own rain sound | Undertone: TVs show you |
| 5.3 | 111.50-114.50 | `walk`, look L | Door 215 ajar: a TV showing the corridor from a different angle. Door 216: another. Lint bats at a sconce for 0.6 s | You are on every screen | ON | -- | -- |
| 5.4 | 114.50-117.00 | `still` at door 217, FOV 62 (staring) | The TV in 217: the corridor, you in it, and something TALL standing right behind you on screen | -- | flicker | All TV sound cuts out. Rain only | It's behind you |
| 5.5 | 117.00-120.00 | The slow turn: `look R 180 / 3.0s`, the slowest move in the film | The corridor behind: empty. Wet footprints on the carpet leading to where you stand | -- | flicker | Your breath held; a single drip | Footprints |
| 5.6 | 120.00-121.50 | Turn back forward `look L 180 / 0.6s` | The Tenant in the corridor 2.5 m ahead, upper body in the beam: patchwork of ball-pit balls, pool tiles and folded paper, head too small, a vending spiral coil for a hand | It tilts its head | flicker hard | A plastic ball cracking, wet tile grind | Tenant (partial) |
| 5.7 | 121.50-124.00 | Dive sideways through door 217, slam it, back against it, CROUCH, FOV 70 | Motel room: bed, lamp, the TV | -- | ON | Door slam, your breath | -- |
| 5.8 | 124.00-128.00 | Beam OFF. Black frame with only the TV glow (it is off now) -- then the TV turns on by itself, showing the corridor: the Tenant standing outside 217 | Hiding | OFF | Rain; slow footsteps outside; the door handle turns, stops; the TV picture shows the Tenant turn its head to the CCTV camera | Hiding, beam-off beat |
| 5.9 | 128.00-130.00 | Camera rises to look at the TV, FOV 66 | The TV picture fills with static; the static grains swell and turn into soft fibres | -- | OFF | Static hiss fading into felt-muffled quiet | -- |

Transition T5 (129.4-130.6): TV static becomes felt fibres (section F).

### Z6 -- Felt puppet theatre (130.0-150.0 s) -- FOLLOW: something helps (pattern break)

Purpose: the breather that is not a pause: a recap of the film so far, played by puppets, plus the reveal that something is on your side. Stop-motion at 12 fps changes the film's rhythm. The flicker rule is broken on purpose (it flickers and the thing is friendly).

| Beat | Time | Camera | In frame | Action | Beam | Audio | NEW |
|---|---|---|---|---|---|---|---|
| 6.1 | 130.00-133.00 | EYE, seated height 1.2 m (you are sitting in a theatre seat), FOV 68 | A tiny felt theatre: red felt curtains, a wooden proscenium with stitched gold trim, rows of empty felt seats, one warm spotlight on your seat | The curtains open (12 fps stepped) | ON 50% | Felt-muffled quiet, a music box (the playroom jingle, slowed, with the missing note back) | A new world: felt |
| 6.2 | 133.00-139.00 | `still`, small look L/R, FOV 60 | The puppet show: a felt office with a tiny flashlight puppet; then a felt ball pit; then a felt pool; then a felt book slamming. Each scene changes by a painted backdrop rolling down | Recap, 1.5 s per scene | ON | Little stage sounds, a puppet "squeak" per scene | Recap: someone has been watching you |
| 6.3 | 139.00-141.50 | `still` | The last scene: a felt house with a door. A felt Tenant puppet chasing the flashlight puppet toward it. The flashlight puppet has no face | -- | flicker | The music box stops on the missing note | Foreshadows home (Z8) |
| 6.4 | 141.50-143.50 | `look D 15` | Lint lands on your seat's armrest: a felt moth the size of a hand, button eyes, stitched wings, glowing faintly warm at the abdomen | It looks at you, tilts its head | flicker (but it's friendly) | A soft felt flutter, a tiny chirp | Lint, up close |
| 6.5 | 143.50-147.00 | Stand to EYE, `walk` following Lint along the aisle, then up the stage steps | Lint flutters ahead, its glow lighting the felt; the stage set from the back: stitched seams, wire armatures, the puppets hanging limp on hooks | Follow | ON | Footsteps on felt (very soft thuds) | Being helped |
| 6.6 | 147.00-150.00 | Through the backstage, a felt door with a stitched EXIT sign, FOV 76 | Lint flies through a gap in the door; behind it a cold blue-white light and an organ chord | You push through | ON 50% | The organ chord swelling; felt quiet cut off | -- |

Transition T6 (149.5-150.5): felt door opens; scale jump into the cathedral (section F).

### Z7 -- Vending cathedral (150.0-195.0 s) -- awe, full reveal, long chase, fall

Purpose: the climax. The largest space, the best creature reveal (after the midpoint), the cold-open payoff, and a new mode (falling) to avoid "more of the same" at the end (the post-dragon-fire lesson). Changes rules twice in 45 s (awe -> chase -> fall).

| Beat | Time | Camera | In frame | Action | Beam | Audio | NEW |
|---|---|---|---|---|---|---|---|
| 7.1 | 150.00-154.00 | EYE, `still`, then `look U 50 / 3s`, FOV 80 | A cathedral nave 200 m long, walls made of vending machines stacked 30 high like organ pipes, all dark; a polished black stone floor; the ceiling far above is ANOTHER floor with machines hanging upside down from it | Awe | ON 25% (tiny in this space) | Huge reverb room tone, a far-off coin drop echoing for 6 s | Scale |
| 7.2 | 154.00-158.00 | `still`, eyes forward | The machines wake in a ripple from the far end toward you: row by row, lights on, a wave of blue-white light running 200 m in 3 s | -- | ON | Each row's relay clunk + compressor hum adding up to an organ chord | The cathedral lives |
| 7.3 | 158.00-163.00 | `walk` along the first wall, look L at the machines, FOV 66 | Up close: machines selling things from every zone: a beige phone (row A3), a red ball (A4), a pool tile (A5), a paper page (B1), a felt puppet (B2), a flashlight identical to yours (B3, price "0") | -- | ON | Machine hum, one machine's phone item RINGING through the glass | Everything ends up here |
| 7.4 | 163.00-168.00 | `still`, `look R 40` | All machines in the aisle dispense at once: items drop and roll out across the floor toward the centre and assemble: balls, tiles, paper, felt and coils pile into the Tenant, standing up to 4.2 m tall | The full reveal | flicker hard | A cascade of drops, rattles, then a sound of everything snapping together | Tenant: full |
| 7.5 | 168.00-171.30 | `run` FOV 84 down the aisle; this is the cold-open path | Exactly the cold open: walls racing, machines switching off behind you | Chase | ON 25%, swinging | Footsteps, machines thunking off, the Tenant's rattling run | -- |
| 7.6 | 171.30-174.00 | Same as cold-open beats 0.2-0.4 (look back, stumble, floor, arm in beam). Reuse the SAME timing and camera so the viewer recognises it. The exact 2.1 s replay occupies 171.30-173.40, then the frame stays black for the remaining 0.6 s | The arm reaching | Payoff of the open loop | flicker -> DEAD at 173.4 | Same as cold open | We've caught up |
| 7.7 | 174.00-176.00 | Black, then a warm point of light: Lint lands on the dead flashlight | Lint's abdomen glows bright orange-warm; the beam comes back ON | The arm recoils from Lint's light | ON (relit, warm-tinted, 40%) | A felt flutter, a warm hum, the Tenant's screech | The helper pays off |
| 7.8 | 176.00-186.00 | `run` again; the floor ahead cracks open: a long rift; the machines on the walls tip toward you | Machines toppling; the rift widening | Run into the rift | ON | Machines crashing, glass shattering, a rising roar | -- |
| 7.9 | 186.00-192.00 | Fall into the rift: FOV 95, slow tumble (roll 360 over 6 s), looking up then down | The cathedral receding above; upside-down machines streaming past, their lights blurring into streaks; then soft warm light below | Falling | ON | Wind roar, then a calm descending tone | A new mode: the fall |
| 7.10 | 192.00-195.00 | Slowing, settling onto carpet: camera lands at floor height and rises to EYE | Warm afternoon light, a hallway carpet | Landing soft | ON 25% | Wind gone; a clock tick; birds outside | -- |

Transition T7 (194.4-195.6): falling light streaks become late-afternoon sunbeams (section F).

### Z8 -- Home (195.0-225.0 s) -- approach the phone; the loop

Purpose: the final lure (the place builds YOUR home), one wrong detail at a time, then the loop back to Z1. Calm, slow, dreadful. No creature: the house is the threat.

| Beat | Time | Camera | In frame | Action | Beam | Audio | NEW |
|---|---|---|---|---|---|---|---|
| 8.1 | 195.00-199.00 | EYE, `still`, FOV 72 | A warm, lived-in family hallway at golden hour: wood floor with a runner rug, coats on hooks, shoes by the door, family photos on the wall, a houseplant, sunbeams with dust through a side window, a kitchen glimpsed at the end | Relief, the deepest one | ON 25% (barely visible in daylight) | A clock, birds, a distant lawnmower, a kettle starting to boil far away | Home |
| 8.2 | 199.00-203.00 | `walk` slowly down the hallway, `look L 30` at the photos | The photo frames: each shows an empty room from a zone (the office, the ball pit, the pool, the library, the motel corridor, the theatre, the cathedral). No people in any photo | -- | ON | The kettle getting louder | Undertone 1 |
| 8.3 | 203.00-206.00 | `look R 40` | A floor lamp is on in the living room; it casts no shadow (like the playroom sun). The window behind it shows, outside, endless mustard office carpet under fluorescent light instead of a garden | -- | ON | The lawnmower sound loops (same 2 s) | Undertone 2: it's not outside |
| 8.4 | 206.00-210.00 | `walk` on, FOV 68 | The beige phone, wall-mounted in the hallway by the front door, RINGING | -- | flicker (gentle) | The original beige phone ring from Z1, exactly | The phone, final |
| 8.5 | 210.00-214.00 | Approach to 0.6 m, FOV 60 | The receiver lifts off the hook by itself, hangs on its curly cord, swinging | -- | flicker | Through the receiver: the Z1 fluorescent buzz and a tube ticking | The thread pays off |
| 8.6 | 214.00-218.00 | `look R 70 / 2s` to the front door | The front door, beside the phone. The door handle turns by itself | -- | flicker | The kettle whistles and cuts off; silence | -- |
| 8.7 | 218.00-222.00 | `still`, FOV 74 | The door swings open: on the other side is the Z1 office, framed EXACTLY like beat 1.1 (same camera position relative to the doorway, same tubes, same desk, the phone on the desk ringing) | -- | ON | Fluorescent buzz swells; the Z1 desk phone starts to ring | The loop |
| 8.8 | 222.00-225.00 | `walk` through the doorway into the office | The office; behind you (unseen) the home is gone | You walk in | ON 25% | Ring, buzz; your footsteps change from wood to damp carpet | -- |

### END -- End screen (225.0-235.0 s)

The office frame from beat 1.1, darkened 60% and slightly blurred, as the background for YouTube's end-screen elements (two video slots and a subscribe button; keep the centre third and the right half clear for them). The phone keeps ringing, quieter each ring. No text; the end-screen UI is added in YouTube Studio by the user.

## F. Transitions (W1 builds all of them; each is a different type)

| id | Window (s) | From -> to | Type | What happens |
|---|---|---|---|---|
| T0 | 3.80-4.20 | coldopen -> office | hard cut through black | Pure black with the pre-drop silence; the office fades up from black over 1 s (exposure adaptation, not a crossfade). |
| T1 | 29.60-30.40 | office -> playroom | exposure blowout | The fire door opens on daylight; the frame clips to white (tone-map exposure x16 over 0.25 s), then the playroom resolves out of white as the "eye adapts" over 1 s. The office must be fully gone by 30.40. |
| T2 | 54.60-55.40 | playroom -> pool | material morph in a tunnel | Camera crawls through the play tunnel. The tube's blue plastic ribs become tiled grout lines and the walls go wet (a shared tube mesh with a material blend driven by position along the tube), so the two zones share one object across the seam. |
| T3 | 79.40-80.60 | pool -> library | ink diffusion | Underwater, black ink clouds bloom (screen-space fluid-like noise advected outward) until the frame is ink; the ink then reads as ink lines on paper as the library page fades in under it. |
| T4 | 104.70-105.30 | library -> motel | page slam to black, neon on | Two paper pages close across the lens (real geometry, not a wipe), 0.08 s black with silence, then the motel corridor flickers on at the neon's flicker rate (3 flickers over 0.4 s). |
| T5 | 129.40-130.60 | motel -> theatre | TV static to felt | The CRT static grain enlarges and softens until each grain is a felt fibre; the fibres part like a curtain onto the theatre. The CRT curvature and scanlines fade out across the window. |
| T6 | 149.50-150.50 | theatre -> cathedral | door push, scale jump | Push through the felt door: a 0.3 s whip of the door edge across the lens, then the cathedral at its full scale with the camera slightly lower (awe). |
| T7 | 194.40-195.60 | cathedral -> home | light streaks to sunbeams | The falling machine-light streaks slow, lengthen and warm, and become the god-rays through the hallway window. |
| T8 | 218.00-222.00 | home -> office (in-world, no engine transition) | real doorway | The office is built behind the home's front door in the same scene (or rendered through the doorway with the office scene sampled in), matched to beat 1.1. |

Every transition: the incoming zone covers the whole frame by the last exported frame of the window, nothing snaps inside the window, no undefined shader maths (see `fx-transitions`).

## G. Audio cue sheet (W1)

Room tone per zone runs the whole zone and crossfades over the transition window. Footstep surface follows the zone. Levels: room tone -24 to -30 LUFS short-term, footsteps -20, creature sounds -16 to -12, the biggest sting -8 peak. Integrated master about -14 LUFS.

| Zone | Room tone | Footsteps | Signature sounds | Silence beats |
|---|---|---|---|---|
| Z0 | Cathedral hum chord | polished stone, fast | Machines switching off in a wave, coin rattle in the arm | 3.30-3.55 vacuum |
| Z1 | 60 Hz fluorescent buzz + harmonics, HVAC hiss, a ticking tube | damp carpet | Bell-ringer phone, wet breathing above, ceiling grid creak, tiles slamming | 15.5-15.6 breath stop |
| Z2 | Music-box jingle (8 notes, note 6 silent), birds, one child laugh loop | foam mats, ball rattles | Plastic clicks of turning toys, balls rattling around the bulge, hollow tube breath, toy-phone warble | 40.5-47.5: heartbeat only |
| Z3 | Deep reverberant hum, drips with 4 s tails | knee-deep water swish | Water steps that aren't yours, wet tile scrape, splash, underwater roar | 72.0: hum stops |
| Z4 | Clock tick, paper rustle, a far cough | paper crunch | Nib scratch per step, paper phone rattle, giant tear/fold, book slams every 1.2 s | 86-89: clock stops; 104.9 pre-slam |
| Z5 | Rain on glass, neon buzz, ice machine | wet carpet | TV murmur, the CCTV rain, cracking plastic ball, tile grind, door slam, handle turn | 114.5: TV cut, rain only |
| Z6 | Felt-muffled quiet, slowed jingle | felt thuds | Puppet squeaks, Lint flutter and chirp | 141.0: jingle stops on the missing note |
| Z7 | Huge reverb room, organ chord from relays + compressors | polished stone | Coin drop echo, relay ripple, dispense cascade, assembly snap, toppling machines, wind | 173.4-174.0 dead beam |
| Z8 | Clock, birds, lawnmower loop, kettle | wood floor, then carpet | Beige phone ring (Z1 recording), Z1 buzz through the receiver, kettle whistle | 216-218 after the kettle |

Music: there is no score under the scares. Music only exists in the world (the jingle, the organ chord). If a worker wants a track (for example under the end screen), see the music rule in the orchestrator prompt (5.7).

## H. Pacing check (every 10 s window has something new; R3)

| Window (s) | New in this window |
|---|---|
| 0-10 | Chase, the arm, the office, the premise line, the ringing phone |
| 10-20 | Receiver lifts by itself, the flicker rule, eyes in the ceiling, fingers, the run |
| 20-30 | Ceiling tiles falling in a chain, the fire door, daylight blowout |
| 30-40 | The playroom, the toys facing you, no shadows, the missing note, the bulge |
| 40-50 | Freeze rule, the Swimmer's face, the toy phone, it dives |
| 50-60 | Tenant glimpse 1, tube turns to tiles, the pool halls |
| 60-70 | The lagging reflection, the Mirrorling's rule, Tenant glimpse 2 |
| 70-80 | Floating phone, the Mirrorling on the surface, the fall, ink |
| 80-90 | The paper library, Lint, the pen writing "step", "it is reading this" |
| 90-100 | Shadow (Tenant 3), paper phone, "it is behind you", the Archivist, stacks closing |
| 100-110 | The gap, the slam, the motel, rain, the first CCTV TV |
| 110-120 | TVs everywhere, the Tenant on screen behind you, the slow turn, footprints |
| 120-130 | Tenant partial, the hide, beam off, the TV turning on by itself |
| 130-140 | The felt theatre, the puppet recap |
| 140-150 | The house puppet, Lint up close, following, backstage |
| 150-160 | The cathedral scale, the machine ripple, the items from every zone |
| 160-170 | The full Tenant assembly, the chase begins |
| 170-180 | The cold-open payoff, Lint relights the beam |
| 180-190 | The floor rift, toppling machines, the fall |
| 190-200 | Landing, home |
| 200-210 | Photos of empty zones, the shadowless lamp, office carpet outside, the beige phone |
| 210-220 | The receiver, Z1 buzz, the door handle |
| 220-225 | The office again (loop) |

Longest stretch without a new rule, threat or place: about 6 s (beats 6.2 and 7.1-7.2), each of which carries new visual information (the recap scenes, the ripple). If a beat runs longer when built, cut it, don't fill it.

## I. The Short (only after the long form is signed off) -- 50 s, 1080x1920

Its own edit with re-staged shots, not a crop. Project `app/src/scenes/threshold_short/`, reusing long-form assets (`ctx.loadAsset('threshold/<assetId>')`) and the shared kit. Vertical FOV 85-95 (the frame is tall); keep the focal subject in the central 60% core and all text in the safe zone (top 288 px, bottom 480 px, right 194 px, left 60 px).

| Beat | Time (s) | What | Notes |
|---|---|---|---|
| S1 | 0.00-3.00 | Frame 0: the playroom in bright sunlight, the bulge ALREADY moving through the balls toward the lens, 1.5 m away and closing. On-screen line from frame 0: "every room down here is a different world" (top of the safe core) | Bright, saturated, a clear subject. The opposite of our last two Shorts' dark openings. |
| S2 | 3.00-7.00 | Freeze: breath stops, the bulge stops 60 cm away. It surfaces: the ball face, the slide-mouth, filling the centre of the frame | The rule in 2 s. Heartbeat audio. |
| S3 | 7.00-10.00 | The toy phone rings, the Swimmer dives at it, crawl into the tube; the Tenant crosses the tube's far end | Thread + glimpse |
| S4 | 10.00-17.00 | Pool: the lagging reflection, look away at the floating phone, look back, the Mirrorling stands on the water, fall backwards | Condensed Z3 (three beats only) |
| S5 | 17.00-27.00 | Motel: TVs show you; the one behind you; the slow turn (2 s here, not 3); the Tenant in front | The best "slow" beat; keep it, but shorter |
| S6 | 27.00-41.00 | Cathedral: the machine ripple (2 s), the assembly (3 s), the chase, the arm, the dead beam, Lint relights it | The one chase, and it is the climax |
| S7 | 41.00-47.00 | Fall, landing at home, the phone rings, the receiver lifts | Home is 6 s only |
| S8 | 47.00-50.00 | The front door opens: on the other side is the playroom of S1, with the bulge starting to move | The loop: the last frame cuts seamlessly to frame 0 |

Short pacing: something new every 2-4 s; no beat longer than 7 s. Sound: same cues, louder footsteps, the heartbeat in S2 audible on phone speakers (put energy around 120-200 Hz, not only sub-bass).

Orchestrator: at every gate, run the `grounding-yourself` skill and reread this whole storyboard before judging artifacts.
