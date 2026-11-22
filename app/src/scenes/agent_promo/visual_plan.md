# agent_promo — visual plan

## Thesis
A film that was written, built, watched, criticised and rewritten by an agent — and here is the proof. Every number the
film says about itself is read from `facts.json`, which is filled in from the real build (git, review rounds, captures).

## Narrator
The agent. It only speaks through type: IBM Plex Mono, lower case, short, dry, first person. It never explains itself
with diagrams; it shows the work. 11 lines in total (see storyboard). The user's prompt is the only other voice.

## Invariant — the orange block
One signal-orange (#FF5A1F) block cursor exists in every act and is the only colour shared across acts:

| act | the block becomes |
|---|---|
| A0 cold open | the terminal cursor in a void |
| A1 prompt | the punch head that perforates the paper tape |
| A2 plan | the "you are here" marker on the bar grid |
| A3 orchestrate | the lead light that splits into the swarm |
| A4 build | the weld spark / cutting head on the robot arm |
| A5 watch | the shutter / tally lamp on the print machine |
| A6 critique | the marker cap; the ink is red, approval is green |
| A7 rewrite | the rewind playhead |
| A8 self-awareness | the playhead tower on the physical timeline and the frame-counter digit |
| A9 rush | the cut bar between shots |
| A10 breather / lock-up | the cursor alone on paper, then the core of the vortex and the cursor in f(x) |

## Palettes (orange is the only cross-act colour)
| act | world | palette |
|---|---|---|
| A0/A1 | terminal void, paper tape | void #07070A, tape bone #EDE6D6, steel #2B2E33 |
| A2 | night desk, index cards | walnut #2A1D15, card cream #F1EAD9, graphite #3A3A3C, lamp warm #FFD7A0 |
| A3/A4 | hangar → circuit city | gunmetal #1A1F26, steel #5B6673, ice rim #9CC9E8, PCB green-black #0E1A14 |
| A5/A6 | review room, cork wall | cork #8A6A4A, print white #F4F1EA, red ink #D9262B, approve #2FBF71 |
| A7 | rewind | amber tape #C7862B over the A4 city |
| A8 | timeline made physical | ink navy #0B1020, lane bone #DCD6C8 |
| A10a | breather | page cream #EFE8DA, ink #1B1A18 |
| A10 | lock-up | void + every world's key colour orbiting |

## Metaphor mapping (abstract → physical)
- prompt → bytes punched in paper tape (the real ASCII of the prompt, 8 bits per row)
- plan → index cards on a desk that stand up into a 3D bar grid; heights are the real per-bar loudness from `audio.json`
- parallel tool calls → one light doubling into a swarm of drones (1→2→4→…)
- building scenes → drones and a robot arm assembling a circuit city; lyric verbs are parameters (WRITE welds, CUT
  slices, PASTE instances rows, SAVE clamps, LOAD lifts, CHECK freezes, REWRITE rebuilds)
- render/capture → the frame freezes and comes out of a printer as a physical print
- review → prints pinned to a cork wall; red marker lassos, green ticks, a strip-chart pen draws the motion telemetry
- iteration → the playhead rewinds, the draft print is swept away and the live improved world takes its place
- determinism → a physical timeline with a mechanical frame counter; the same frame rendered twice, difference = 0
- the brand → every world spirals into the f(x) STUDIO mark

## Anti-slop rules
No debug captions or HUD telemetry over the picture (telemetry only as physical objects). No network webs, glowing
brains, robot faces, Matrix rain, rainbow synthwave, pastel clay, or stock AI icons. No pure-white flash frames: flashes
are orange-tinted and capped. No static camera: the camera travels in every act and each act's exit vector is the next
act's entry vector. Missing fonts fail loudly (engine font loader), never fall back.

## Lighting
Hero objects get a warm key (#FFD7A0) and cool rim (#9CC9E8), PCF soft shadows on the hero sets, an environment map
for chrome/plastic reflections, controlled bloom (threshold ≥ 0.6 except on the orange block).
