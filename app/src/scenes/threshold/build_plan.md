# THRESHOLD build plan

This plan operationalizes `storyboard.md` and `looks.md`; it does not replace them. The world bible is the creative source of truth. All work is on the shared branch `devin/1795651109-threshold`, one PR into `nightly`, no video renders on VMs.

## 1. Ownership contract

| Owner | Owned work |
|---|---|
| W1 lead / integrator | `project.json`, `build_plan.md`, `z0_coldopen` integration scene, shared first-person rig, gait presets, flashlight rig/beam/battery/flicker/haze, sensor post layer, exposure adaptation, shared premise/typography utility, shared materials/decals/particles, `assets/_bl.py`, beige phone core and variants, Tenant shared asset plan/core LODs, Lint shared asset, engine transitions T0-T7 plus T8 in-world doorway integration support, audio cue/mix architecture, integration, final seam evidence. |
| W2 zones A | Scene files and zone dressing for Z1-Z4: `z1_office`, `z2_playroom`, `z3_pool`, `z4_library`; zone environment/prop kits; Ceiling Breather, Pit Swimmer, Mirrorling, Archivist; their zone-specific asset folders and turntables. |
| W3 zones B | Scene files and zone dressing for Z5-Z8+ending: `z5_motel`, `z6_theatre`, `z7_cathedral`, `z8_home`, `endscreen`; zone environment/prop kits; CCTV/motel systems, theatre puppets, vending machine systems, cathedral assembly/rift/fall, home loop; zone-specific asset folders and turntables. W3 owns the Z7 cathedral assets reused by `z0_coldopen`; W1 owns the cold-open scene integration itself. |

Shared assets may be placed and animated by W2/W3, but their source files are W1-owned. Zone files remain W2/W3-owned. Any cross-ownership change goes through the orchestrator as an exact diff.

## 2. Build order and gates

1. **Foundation now:** world bible, build plan, `project.json`, shared kit skeleton, `_bl.py`, and transition framework. W1 may create/wire `project.json` entry ids and shared integration scaffolding, but must not create or edit `z1`-`z8` or `endscreen` scene files; zone owners commit even placeholder versions of those files. The sole exception is W1-owned `z0_coldopen`.
2. **Asset wave A blockout proxies:** beige phone core proxy, Tenant arm-only blockout, Lint blockout, shared dust/footprint/decal kits, flashlight/sensor kit. These land before G1 because Z0 and Z2-Z4 glimpse blockouts depend on them.
3. **G1 blockout:** every storyboard beat rendered as labelled grey-box stills/sheets with real timing, scale, gait, beam state and transition windows. Include all five `z0_coldopen` beats and the exact 171.30-173.40 replay comparison strip. User sign-off happens once here.
4. **G2 vertical slice:** shared kit plus Z1 finished to final quality first. No other zone passes blockout until G2 sets the bar.
5. **Asset wave A final quality:** beige phone core, Tenant arm-only LOD, Lint, shared dust/footprint/decal kits, flashlight/sensor kit.
6. **Asset wave B (zone creatures):** Ceiling Breather, Pit Swimmer, Mirrorling, Archivist in parallel with zone kits.
7. **Asset wave C (late zones):** Tenant upper/full LODs, theatre puppet kit, vending-machine family, home kit.
8. **G3 full grey-box timeline:** all zones in `project.json`, real overlaps, camera and timing.
9. **G4 asset quality:** all GLBs pass manifests, triangle budgets, named parts, scale and turntable review.
10. **G5 integration:** lighting, dressing, creature animation, transitions, room tones, footsteps and cue mix.
11. **G6-G8 review loop:** stills, sheets, seams, audio only; no VM video renders.

## 3. Shared kit build list (W1)

| id / file | Contents | Dependencies | Est. triangles / cost | Verification artifact |
|---|---|---|---|---|
| `kit.ts` | Shared constants, deterministic noise/hash helpers, scale references, palette-independent helpers. | none | n/a | typecheck; unit determinism smoke |
| `fp_cam.ts` | First-person rig: `still`, `creep`, `walk`, `run`, `holdBreath`; step phase/events; breath drift; critically damped turns; whip and stumble curves. | `kit.ts` | n/a | gait comparison sheet at 1.5/4/8/12s; determinism double-render |
| `flashlight.ts` | Eye-offset spotlight, 22 deg cone, 7 deg hot core, 30 deg spill, cookie rings, lag spring, battery curve, flicker envelope, beam haze cone, relight colour. | `fp_cam.ts` | cone mesh <2k | flashlight turntable/blockout sheet in dark grey-room |
| `sensor_post.ts` / grade helpers | Shared grain seeded by frame, vignette, outer-frame chromatic aberration, barrel distortion, exposure adaptation, bloom-only-from-light rules. | engine post pipeline | fullscreen pass | same still rendered twice; bright/dark adaptation strip |
| `assets/_bl.py` | Blender helpers copied/extended from `spill`: reset, material, box, cyl, bevel, smooth, parent, empty, curve, skin/metaball helpers, export. | Blender 4.x | n/a | `blender -b -P` smoke asset build |
| `assets/beige_phone/` | 1980s desk phone core: base, receiver, cord, hooks, 12 buttons, bell; desk variant. Variants planned: toy, floating/sealed, folded paper, payphone shell, felt puppet, vending product, wall-mounted. | `_bl.py` | 8k-15k core; variants 4k-18k each | 6-view turntable at 0.6/1.5/3m plus silhouette sheet |
| `assets/tenant_shared/` | Shared Tenant plan and LOD geometry: `arm_only`, `upper_body`, `full`; named parts per looks.md; material collage slots. | `_bl.py`, zone material references | arm 25k-50k; upper 60k-110k; full 120k-200k | LOD turntables, silhouette sheet, parts/manifest check |
| `assets/lint/` | Felt moth: body, wings, antennae, button eyes, glow abdomen, six legs. | `_bl.py` | 10k-25k | macro turntable because Z7 lens close-up; silhouette sheet |
| shared premise/typography utility | Monospace lower-case typed premise line, cursor, timing, soft shadow and safe placement. Z1, Z8 and the later Short consume the same implementation. | `kit.ts`; engine text/canvas utilities | 2D cost only | typed-line stills at start/mid/hold/fade in Z1 placement and Short safe-zone placement |
| shared decals/particles | Dust motes, insulation fibres, wet footprint decals, contact-shadow decals, seeded placement helpers. | `kit.ts` | GPU/instanced, budgeted per zone | beam/dust close-up sheet |
| `app/src/transitions/threshold_*.ts` | T0-T7 framework and final engine transition implementations. T8 is not an engine transition: it is the in-world home-to-office doorway inside `z8_home`; W1 supplies continuity guidance and seam evidence while W3 owns the scene. | overlapping scenes in `project.json` for T0-T7 only | n/a | `--cuts` seam sheet plus explicit `--times` sheets at one frame before each window end and the first post-transition frame |
| audio/mix scripts | Zone room tones, surface footsteps locked to step phase, creature signatures, silence beats, transition crossfades, EBU R128 master target. No downloaded audio committed. | `fp_cam.ts` step events; zone telemetry | n/a | rendered WAV/MP3 artifact plus cue sheet; ffmpeg loudness readout |

## 4. Zone asset and prop responsibilities

### Z0 cold open — W1 integration scene

| asset id | Contents | Owner dependency | Est. triangles | Verification |
|---|---|---|---|---|
| `z0_coldopen` | Frame-0 sprint, whip look-back, stumble, floor-level Tenant arm reveal, dead-beam black. Reuses W3's Z7 cathedral environment and W1's shared first-person rig, beam and Tenant `arm_only` LOD. | W3 `z7_cathedral_kit` blockout; W1 rig/flashlight/Tenant arm | scene cost dominated by reused Z7 kit | five-beat grey-box sheet; exact Z0-vs-Z7 replay comparison strip at 171.30-173.40; dead-beam/black-frame stills |

### Z1 office — W2

| asset id | Contents | Owner dependency | Est. triangles | Verification |
|---|---|---|---|---|
| `z1_office_kit` | partitions, corridor modules, door frames, skirting, pillars, suspended ceiling grid, troffers, missing/sagging/stained tile variants. | shared scale kit | 80k-150k modular | blockout sheet, scale capsule still, close detail strip |
| `z1_ceiling_breather` | eyes/lids/pupils, 8 articulated fingers, 12 tile-skin pieces, breathing animation hooks. Eye spacing is 70cm. | `_bl.py`; shared beam | 40k-90k | creature turntable, silhouette, named-part manifest, beam-reaction still |
| `z1_prop_pack` | desk, 3 chair variants, CRT, filing cabinet, printouts, water cooler, dead ficus, corkboard, stopped clock, boxes, mug, extinguisher, EXIT door/sign, wet-floor sign, vent/ribbon, power strip/cables. | beige phone shared asset | 60k-120k total | prop lineup sheet plus dressed-zone strips |

### Z2 playroom — W2

| asset id | Contents | Owner dependency | Est. triangles | Verification |
|---|---|---|---|---|
| `z2_playroom_kit` | padded walls, climbing frame, netting, two slides, tube tunnel, stepping blocks, skylights. | shared scale kit | 100k-180k modular | blockout sheet, scale capsule still |
| `z2_ballpit_system` | 6k-10k deterministic instanced balls, domed surface, swimmer bulge displacement field. | engine instancing | instanced; base sphere low-poly, total GPU budget controlled | bulge sequence sheet, determinism check |
| `z2_pit_swimmer` | fused-ball skull, slide mouth, cartoon ball eyes, vinyl cheeks, ridge balls, stopper teeth. | `_bl.py` | 60k-120k | creature turntable, mouth-open sheet, silhouette |
| `z2_toy_prop_pack` | rocking horse, robot, stitched teddy, jack-in-box, toy piano, stacking rings, red toy phone adaptation, blocks, car, xylophone, ball cart, shoe cubbies, birthday banner, music box/ballerina, balloons. | shared beige phone core for toy variant | 70k-140k total | prop lineup sheet, facing-toy stepped-motion strip |

### Z3 pool halls — W2

| asset id | Contents | Owner dependency | Est. triangles | Verification |
|---|---|---|---|---|
| `z3_pool_kit` | tiled halls, arches, pillars, steps, deep pool, lane rope anchor, ladder, tiled ceiling/skylight forms. | shared scale kit | 100k-180k modular | blockout sheet, reflection/caustic still |
| `z3_water_system` | reflective/refractive plane, depth tint, ripple normals, caustic projection, 0.4s-lagged reflection contract. | engine shaders; fp rig historical transform as pure f(t) | plane + shader cost | reflection-lag comparison sheet, caustics close-up |
| `z3_mirrorling` | thin chrome body/head/arms/hands/fingers, mirrored reflection, ripple ring. | `_bl.py`; water system | 30k-60k | chrome turntable, silhouette, mirror-motion strip |
| `z3_prop_pack` | lane ropes, lifeguard chair, ladder, kickboards, noodle, duck, drain, benches, towel, NO DIVING tile sign, handless clock, floating phone variant, shower head, rescue ring, flip-flops. | shared beige phone floating variant | 40k-90k total | prop lineup sheet, water-contact still |

### Z4 paper library — W2

| asset id | Contents | Owner dependency | Est. triangles | Verification |
|---|---|---|---|---|
| `z4_library_kit` | paper canyon stacks, aisles, reading desk, spiral paper stairs, hanging lanterns, hinged stack-wall sections. | shared scale kit | 100k-180k modular | blockout sheet, scale capsule still |
| `z4_archivist` | fanned torso pages, waist roll, legs, accordion arms, paper-strip hands/fingers, face page/morphs, spine. | `_bl.py` | 50k-100k | creature turntable, unfolding sequence sheet, silhouette |
| `z4_paper_prop_pack` | ledger, fountain pen, lamps, ink bottles, 20-40 paper moths, letters/string, folded paper phone variant, drawers, globe, vines, glasses, scissors, paper clock, chairs, lanterns, scroll. | shared beige phone paper variant; Lint shared asset | 60k-120k total | prop lineup sheet, ledger-writing macro still |
| `z4_ledger_writing` | diegetic cursive stroke-path writing system animated by arc length. | engine stroke/text utilities | n/a | writing sequence sheet at exact beats |

### Z5 motel — W3

| asset id | Contents | Owner dependency | Est. triangles | Verification |
|---|---|---|---|---|
| `z5_motel_kit` | 40m corridor, numbered doors, end window/rain, ice machine alcove, room 217, sconces, wallpaper/carpet systems. | shared scale kit | 100k-180k modular | blockout sheet, wet-material close-up |
| `z5_cctv_system` | CRT curved glass, scanlines/barrel/vignette/timestamp, low-res CCTV render-target path. | engine render targets | screen geometry 5k-15k per CRT | CCTV comparison sheet, timestamp/safe-frame still |
| `z5_prop_pack` | ice machine/bucket, tray, DND sign, housekeeping cart, fire hose cabinet, small vending machine, payphone variant, umbrella, raincoat, keys/fobs, broken sconce, CRTs, map, wet footprints. | shared decals; shared phone/payphone variant | 50k-110k total | prop lineup sheet, wet-footprint strip |
| Tenant partial integration | upper-body reveal in corridor and TV. | W1 `tenant_shared` upper LOD | use shared budget | beam-reveal still, TV-vs-corridor continuity sheet |

### Z6 theatre — W3

| asset id | Contents | Owner dependency | Est. triangles | Verification |
|---|---|---|---|---|
| `z6_theatre_kit` | 12x8 seats, proscenium, stage, painted roll-down backdrops, backstage hooks/armatures, curtains. | shared scale kit | 80k-150k modular | blockout sheet, felt-material close-up |
| `z6_puppet_pack` | felt office/desk/flashlight puppet, ball pit, pool, book, house, Tenant puppet, felt phone variant, EXIT sign, programme, music box, trapdoor, ladder, ropes/sandbags. | shared Lint asset; shared felt phone variant | 70k-140k total | puppet lineup sheet, 12fps stepped-motion strip |
| Lint integration | Lint close-up, flutter, glow, follow path. | W1 `lint` asset | use shared budget | macro sheet, glow-in-dark still |

### Z7 vending cathedral — W3

| asset id | Contents | Owner dependency | Est. triangles | Verification |
|---|---|---|---|---|
| `z7_cathedral_kit` | 200m nave, black polished floor, central rift, upper inverted machine floor, machine-wall structural layout. | shared scale kit | 120k-220k modular plus instancing | god-scale blockout sheet, scale capsule still |
| `z7_vending_machines` | 4 base models x 6+ variants: snacks, drinks, tall glass-front, compact retro; coils, products, glass, slots, keypads, flaps, logo panels. | engine instancing; product references | full-detail 20k-45k each near camera; instanced far LOD | machine family turntable, variant sheet, wall-ripple sequence |
| `z7_prop_pack` | coin piles, dropped items, receipts, toppled machine, cables, puddle, THANK YOU stencil, change-machine altar, flashlight machine, coin returns, capsules, chains, dust columns, broken keypad, pew. | shared dust/decals | 60k-120k total | prop lineup sheet, floor-reflection still |
| Tenant full integration | item cascade, assembly, 4.2m reveal, gallop/chase, arm replay at 171.30-173.40. | W1 `tenant_shared` full LOD | use shared budget | assembly sequence sheet, exact cold-open replay comparison strip |
| rift/fall system | floor crack, toppling machines, falling streaks, inverted machine parallax. | transition framework | scene/system cost | fall contact sheet and seam strips |

### Z8 home + END — W3

| asset id | Contents | Owner dependency | Est. triangles | Verification |
|---|---|---|---|---|
| `z8_home_kit` | hallway, front door, side window, living-room opening, staircase, kitchen glimpse. | shared scale kit | 70k-130k modular | golden-hour blockout sheet, scale capsule still |
| `z8_prop_pack` | coats, shoes, umbrella stand, photo frames, plant, hall table/keys/post, mirror, clock, radiator, rug, switch, toy on stair, kettle, crossed-out calendar, wall phone variant. | shared beige phone wall variant | 50k-100k total | prop lineup sheet, wrong-detail stills |
| `z8_loop_doorway` | office view beyond front door matched to Z1 beat 1.1, wood-to-carpet step transition. | W2 Z1 office reference; T8 framework | depends on shared office geometry | doorway comparison sheet, loop-frame match still |
| `endscreen` | darkened/blurred office loop frame with clear end-screen regions. | Z1 frame/reference | low | end-screen safe-zone still |

## 5. Cross-zone dependency order

1. `kit.ts`, `fp_cam.ts`, `flashlight.ts`, sensor post and `_bl.py` land before zone blockouts.
2. `project.json` uses overlapping entries from the start; no scene is considered integrated if its transition window lacks overlap.
3. Z7 cathedral blockout is needed early even though W3 owns it, because Z0 cold open reuses that world.
4. Tenant `arm_only` is needed before Z0/Z2-Z4 glimpse blockouts; `upper_body` before Z5; `full` before Z7 assembly.
5. Beige phone core is needed before every zone's phone variant. Zone variants may be materially distinct but must preserve silhouette, receiver cradle, keypad/cord logic and ring/rattle animation hooks.
6. Lint is needed in at least simple form for Z4/Z5 foreshadowing before the final Z6 hero version.
7. Footstep events must come from `fp_cam.ts` phase, not hand-timed audio cues.
8. Audio architecture is built before final zone integration so room tones and transition crossfades can be reviewed with the first seam sheets.

## 6. Verification artifacts required for every milestone

- Labelled blockout/contact sheets: `.fx/captures/threshold/blockout/<zone_or_scope>.png`.
- Turntable sheets: `.fx/captures/threshold/turntables/<assetId>_turntable.png` with six angles, three distances, flashlight-rig lighting, plus a silhouette version.
- Zone strips: `.fx/captures/threshold/strips/z<N>_strip.png`.
- Seam sheets: `.fx/captures/threshold/seams/seams_cuts.png` and `.fx/captures/threshold/seams/transition_ends.png`; transition-end sheets sample one frame before each window end (where the engine transition is still active) plus the first post-transition frame, proving both the completed blend and full incoming coverage.
- Cold-open/replay comparison strip: `.fx/captures/threshold/strips/z0_z7_replay_171_30_173_40.png`, aligning the exact 171.30-173.40 Z7 replay frames to the corresponding cold-open frames.
- Determinism pairs: render the same stills twice in separate runs and compare bytes or perceptual hashes.
- Audio artifacts: generated mix WAV/MP3 outside git plus cue sheet/loudness output; never commit downloaded audio or copyrighted mixes.
- Required checks before milestone reports: `bun run typecheck`, `bun run assets:check threshold`, relevant seam/determinism checks, manual inspection of actual stills for `SCENE ERRORS` and shader errors.
- Absolutely no `render.ts video` runs on VMs.

## 7. Current spec decisions incorporated

- Section overlap reference is section F.
- Battery progression: 100% Z1; 85% after Z1/through Z2; 70% by Z3 retreat and Z4 entry; 50% after Z4 chase through Z5/Z6; 25% in Z7 chase; dead at 173.4s; Lint relights warm at 40% at 174s; 25% by Z8 landing.
- Exact cold-open replay occupies 171.30-173.40, then black until Lint at 174.00.
- Ceiling Breather eyes are 70cm apart and 12cm wide.
