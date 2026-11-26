# THRESHOLD -- Looks bible (how everything looks and how to build it)

Read with `storyboard.md`. Storyboard = what happens and when. This file = what it looks like, what it is made of, and how to build it in Blender and the engine. Numbers here are minimums. When in doubt, add detail, never remove it. Both files live in `app/src/scenes/threshold/`.

## 1. The global look (true in every zone)

### 1.1 One pair of eyes
The zones are wildly different styles, but the film must feel like ONE person seeing them. The "camera sensor" layer is shared and applied last, after each zone's own style:
- **Grain:** fine luminance grain, about 3-4% amplitude at 1080p, re-seeded every frame from the frame number (deterministic), slightly stronger in shadows. Never coloured noise.
- **Lens:** a gentle vignette (corners -25% exposure), chromatic aberration only in the outer 20% of the frame (max 1.5 px at 1080p), slight barrel distortion (k1 about 0.03).
- **Exposure adaptation:** going from dark to bright clips to white and recovers over about 1 s; bright to dark goes black and the shadows lift over about 1.5 s.
- **Motion blur:** on for walking and running (`--shutter 0.5` at render time), a little heavier on whips.
- **Bloom:** only from real light sources (tubes, neon, screens, the beam's hotspot, Lint's glow). Threshold high; nothing that isn't a light glows.

### 1.2 Contrast and darkness
- Every frame has a clear brightest point and a readable focal subject (value contrast first, then colour).
- Darkness is never an empty black: the beam always lands on something detailed, and the edge of the beam shows shapes falling off into the dark. Pure #000000 only for the 3 deliberate black beats (3.30 s, 104.9 s, 173.4 s).

### 1.3 Colour
There is no house palette. Each zone has its own palette (section 4), chosen so neighbouring zones contrast hard. Anti-slop: no unmotivated colour washes, no gradient skies, no teal-orange grade over everything. The camera-sensor layer does not tint.

### 1.4 Scale (first-person films die on wrong scale)
1 unit = 1 metre everywhere, in Blender and the engine. Eye 1.65 m. Doors 2.1 x 0.9 m. Office ceilings 2.7 m. Desk 0.75 m high. Chair seat 0.45 m. Light switch 1.2 m. Door handle 1.0 m. Steps 0.18 m rise. Check scale with a 1.8 m reference capsule in blockouts and delete it later.

### 1.5 Contact and life
- Everything touches something: contact shadows (ambient occlusion or a soft shadow decal) under every prop and creature foot.
- Every zone has at least 3 things moving that aren't the threat (dust in the beam, a flickering tube, water ripples, a paper moth, neon flicker, a swinging cord).
- Nothing is perfectly straight or clean: walls have slight waviness, floors have stains, objects are rotated a few degrees off grid.

### 1.6 Typography
Only one line of on-screen text exists (the premise line), plus diegetic text (pen writing in Z4, the motel door numbers, the vending labels, the EXIT sign). The premise line uses a plain monospaced typewriter-like face (for example IBM Plex Mono or Courier Prime, whichever is in `app/public/fonts/` or can be added under its open licence), lower-case, 44-52 px at 1080p, off-white #EDE8DC at 90% with a soft 2 px shadow, typed on at about 18 characters per second with a cursor block.

## 2. The first-person rig and the flashlight (W1 builds once in the shared kit)

### 2.1 Gaits (presets used by the storyboard)
| Preset | Eye height | Step rate | Vertical bob | Lateral sway | Roll | FOV add | Notes |
|---|---|---|---|---|---|---|---|
| `still` | 1.65 | -- | breath only: 6 mm at 0.25 Hz | 3 mm | 0.2 deg | 0 | Breath drift on a slow sine plus seeded noise |
| `creep` | 1.40 | 1.2/s | 8 mm | 10 mm | 0.6 deg | 0 | Slow, careful, knees bent |
| `walk` | 1.65 | 1.9/s | 22 mm | 14 mm | 0.8 deg | 0 | Heel strike dip on each step |
| `run` | 1.60 | 3.0/s | 45 mm | 25 mm | 2.5 deg | +10 | Forward lean 4 deg, motion blur |
| `holdBreath` | current | -- | 0 | 0 | 0 | 0 | Micro tremor only (0.5 mm high-frequency) |

- All motion is a pure function of time (seeded noise and sines), never `Math.random()` or state from the last frame.
- Turns use a critically damped spring with about 8% overshoot. `whip` = 0.2-0.3 s with 15% overshoot and a motion-blur boost.
- Stumble: a 0.25 s dip of 25-35 cm, roll 10-15 deg, and a 0.4 s recovery.
- Footstep events are emitted from the step phase so W1's audio places footstep sounds exactly on the visual heel strike.

### 2.2 The flashlight (the only "character" we see)
- **Position:** a spot light 25 cm right, 20 cm below and 10 cm forward of the eye, aimed 2 deg down and 1 deg left of the view direction, lagging the head by about 80 ms (spring) so it swings slightly behind turns.
- **Beam shape:** cone half-angle 22 deg with a hot inner core of 7 deg (about 3x brighter), penumbra soft, plus a faint outer spill ring at 30 deg (real flashlights have one). Add a subtle cookie texture (rings and a dark centre spot from the reflector) so the hotspot is not a perfect disc.
- **Colour:** about 4300 K (slightly warm), drifting warmer (3200 K) as the battery drains. After Lint relights it (174 s): 2700 K with a faint orange tint.
- **Haze:** a visible cone in the air in dusty or damp zones (Z1, Z3, Z4, Z7), as a raymarched volumetric or a cheap additive cone mesh with depth-fade so it doesn't clip into walls.
- **Battery:** intensity follows the storyboard steps (100/85/70/50/25%), each step drops over 0.5 s with a small stutter.
- **Flicker:** 2-5 drops to 10-30% per second, irregular (seeded), with the hum in the audio dropping at the same time.
- **Lens flare:** only when the beam hits a mirror or water and bounces straight back: a small, soft ghost, not a sci-fi streak.
- **Never shown:** the hand, arm, body, or flashlight body. Only the light.

## 3. How to build things in headless Blender (recipes for weaker models)

Every asset = `assets/<assetId>/build.py`, run with `blender -b -P <path>`, ending in `export(HERE)` to write `model.glb`. Use the `_bl.py` helpers (copied from `spill/assets/_bl.py`: `reset, mat, box, cyl, bevel, smooth, parent, empty`). Add helpers to `_bl.py` (W1) when a recipe below is used in more than one asset.

### 3.1 Organic forms (creatures, plants, soft things)
Never a scaled UV sphere. Use one of:
- **Skin modifier on an edge skeleton** (best for limbs, fingers, tails, cables): create a mesh of vertices and edges that form the skeleton, set the skin radius per vertex (`ob.data.skin_vertices[0].data[i].radius = (rx, ry)`), add `SKIN` then `SUBSURF` level 2, apply both. Gives a continuous, tapering body with clean topology.
- **Metaballs converted to mesh** (blobby bodies, fused ball shapes): add `bpy.data.metaballs`, place elements, then convert to mesh (`bpy.ops.object.convert(target='MESH')`), then `REMESH` (voxel 0.01-0.03 m) and `SMOOTH`.
- **Displaced subdivided mesh** (skin wrinkles, lumps, wear): subdivide to 30k+ faces, add a `DISPLACE` modifier with a procedural texture (`bpy.data.textures.new(type='CLOUDS'/'VORONOI')`, strength 0.005-0.03 m), apply.
- **Curves with bevel** (cords, cables, vines, wires): `bpy.data.curves.new(type='CURVE')`, set `bevel_depth`, `bevel_resolution 4`, add points with jitter, convert to mesh.

### 3.2 Hard-surface forms (furniture, machines, architecture)
- Start with `box`/`cyl`, then `bevel(ob, w, seg)` on every hard edge (width 1-3% of the object size, 2-3 segments).
- Use `ARRAY` modifiers for repeating parts (ceiling grid, tiles, vending machine rows, shelves) then apply; then randomise each copy slightly in code (rotation +-1-2 deg, scale +-3%).
- Use `BOOLEAN` (difference) for slots, vents, buttons and screens, then a bevel on the result.
- `SOLIDIFY` for thin shells (paper sheets 0.5 mm, tiles 8 mm, plastic 2-3 mm).

### 3.3 Wear, dirt and breakup
- Edge wear: a second material on bevel faces (select faces by normal deviation in bmesh) or a vertex colour mask; the engine material reads it.
- Stains and water damage on walls/ceilings: separate decal planes (alpha textures) floating 1 mm off the surface, or vertex colour darkening.
- At least 3 variants for every repeating piece (tile, panel, machine, seat) with differences (crack, stain, missing part, different wear).

### 3.4 Parts, rigs and motion
- Every moving part is a separate object with `ob['fx_part'] = '<name>'` so code can drive it: `jaw`, `eyelid_l`, `finger_1a`, `head`, `tail_3`.
- Put the object's origin at its pivot (the knuckle, the hinge, the neck) before export: `bpy.ops.object.origin_set(type='ORIGIN_CURSOR')` after placing the 3D cursor at the pivot.
- Prefer code-driven motion on named parts (deterministic, easy to tune to the storyboard). Use shape keys for squash, mouth shapes and breathing (`ob.shape_key_add`), driven in code with `setMorph`.
- Bones and baked actions only if needed for many-jointed motion (the Archivist's arms); bake at 60 fps, frame start 0.

### 3.5 Materials
- Principled BSDF only (exported as glTF PBR). Set base colour, roughness, metallic; transmission for glass/water; emission for lights (also set `emissive` in code because zero-strength emission is dropped).
- Large surfaces get variation: a vertex-colour or texture-based roughness and colour breakup (bake procedural textures to images with Cycles is NOT available headless on the VM reliably; instead generate the noise in the engine material or with vertex colours).
- Roughness >= 0.1 near strong lights (prevents black NaN blobs in bloom/DoF).

### 3.6 Previewing (Blender's renderer crashes headless on the VM)
Make a temporary engine scene `_turntable.ts` that loads one asset, lights it with the flashlight rig plus a dim fill, and renders 6 stills (front, 3/4 L, side, 3/4 back, top-ish, a close-up of the face/detail) at 3 distances. Send these sheets to the orchestrator. Delete the turntable scene before the PR or keep it under `_tools/`.

## 4. Zones and creatures

Each zone block lists: lure (why it feels safe), palette, geometry, materials, lighting, at least 15 props, ambient motion, and the creature. Each zone is a different rendering style; the style is in the materials and lighting, not a post filter.

### 4.0 Z0 cold open
Uses Z7 cathedral assets (section 4.7) seen in motion. Build nothing extra except the Tenant's arm (section 4.5, arm-only LOD).

### 4.1 Z1 -- The office (style: photoreal liminal, damp and tired)
- **Lure:** familiar, boring, safe. An office after hours.
- **Palette:** mustard-yellow wallpaper (#C9B26A, faded and stained), damp beige-brown carpet (#8A7A55), off-white ceiling tiles (#D8D2BE) with brown water rings, fluorescent light at 5000 K with a slight green cast. Low saturation. One accent: the beige phone and red EXIT signs.
- **Geometry:** a maze of drywall partitions 2.7 m high (not a grid: corridors 1.4-2.2 m wide, rooms 4-9 m, dead ends, a pillar every 6 m). Suspended ceiling: 0.6 m tiles in a T-bar grid; 1 in 4 grid cells holds a 2-tube fluorescent troffer with a prismatic diffuser. Skirting boards 10 cm. A door frame every 10-15 m, some doors missing.
- **Materials:** wallpaper with a faint vertical stripe pattern (procedural in the engine material), wallpaper seams every 0.53 m, peeling at 2-3 seams near the floor; carpet with a short-loop noise texture (fine high-frequency normal + low-frequency colour patches), darker damp patches near walls; ceiling tiles with fissured texture (small pits), 1 in 8 has a water stain, 1 in 30 is missing (black gap with pipes visible above), 1 in 15 sags 2-4 cm.
- **Lighting:** the troffers are the only light, emissive panels + rect area lights (or spot lights pointed down with wide cones). Two tubes flicker (one with a ticking start-up cycle, one with a dying strobe). Fall-off so far corridors go dim yellow-grey. The flashlight is weak here: the fluorescents dominate.
- **Props (15+):** steel desk with a laminate top and a dent; a rolling office chair turned away (3 variants: upright, tipped, missing a wheel); the beige phone (section 5); a CRT monitor (off, a grey reflection); a filing cabinet with one drawer open; scattered printouts; a water cooler with a half-empty bottle; a dead potted ficus; a cork board with faded notes; a wall clock stopped at 3:33; cardboard boxes; a coffee mug with a ring stain; a fire extinguisher; an EXIT sign over a fire door with a push bar; a wet floor sign knocked over; an air vent with a moving ribbon of dust; a power strip and cables under a desk.
- **Ambient motion (3+):** flickering tubes, dust in the beam, a printout slowly sliding off a desk edge from the HVAC draft, the vent ribbon.

#### The Ceiling Breather (Z1 creature)
- **Concept:** something that lives in the void above the ceiling tiles and has made the tiles part of its skin. You never see all of it.
- **Silhouette:** a flat, wide body (about 3 x 2 m) pressed against the underside of the roof deck above the tiles; you only see: (a) two eyes through a missing tile, (b) up to 6 long fingers that push down through gaps, (c) a whole row of tiles bulging and breathing.
- **Eyes:** two eyes 12 cm wide, 70 cm apart, wet, with a pale yellow sclera, horizontal goat-like pupils, a thin wet rim of grey eyelid that blinks slowly from the bottom up (named parts `eye_l`, `eye_r`, `lid_l`, `lid_r`, `pupil_l`, `pupil_r`). They catch the flashlight with a sharp specular highlight (roughness 0.05) and a faint retro-reflective glow (tapetum, yellow-green).
- **Fingers:** 8 finger objects (`finger_1..8`), each 0.9-1.4 m long, 3 joints (skin-modifier skeleton, radius tapering from 3.5 cm to 1 cm), grey-white skin with a faint purple vein texture, cracked yellow nails. The tips have small suction pads. Parts per finger `finger_n_a/b/c` so the joints bend.
- **Tile skin:** 12 special ceiling tiles (`tile_skin_1..12`) that are fused to the creature: their underside shows stitched-in skin around the edges and they rise and fall 1-3 cm on a breathing sine (0.25 Hz), each with a phase offset so the breathing travels as a wave.
- **Animation rules:** slow until the beam hits the eyes, then everything fast (fingers lash in 0.2 s). When chasing, tiles drop in a chain 1.5 m behind the viewer (gravity + a bounce + a puff of dust and insulation fibres).
- **Triangles:** 40k-90k for the full creature (it's mostly fingers and eyes, so put detail there).

### 4.2 Z2 -- The ball-pit playroom (style: saturated toy-commercial CG, perfect and too clean)
- **Lure:** the most colourful and cheerful place in the film. Sun, toys, a play zone.
- **Palette:** primary red #E63B2E, yellow #F6C83B, blue #2E6FE6, green #3BBF5A, on white foam walls; sunlight 5600 K bright and soft. Highest saturation in the film, so it slams against the office.
- **Geometry:** a huge indoor play zone (about 30 x 20 m, 6 m high): a ball pit 12 x 8 m and 1.2 m deep, padded foam walls, a two-level climbing frame with netting, two slides (one spiral), a tube tunnel (the exit, 0.8 m diameter, ribbed), stepping blocks, big skylights in the ceiling with fake sunlight.
- **Materials:** glossy plastic (roughness 0.25, clearcoat if the engine has it), soft vinyl foam with stitched seams and slight creases (displaced normals), netting as curves. Everything spotless: no dirt, no wear, which is itself wrong after the office. Exception: under the pit balls, a single brown water ring like the office ceiling (seen at 47.5 s when the Swimmer surfaces).
- **Lighting:** bright sun from the skylights (sharp light rays in the air), plus a big soft bounce fill. THE WRONG DETAIL: the toys and creatures cast no shadows (disable `castShadow` on all toys; the climbing frame and walls still cast). The flashlight is pointless here (barely visible) until 40 s when clouds pass the skylights and the room dims 50%.
- **Ball pit:** 6,000-10,000 balls as instanced spheres (7.5 cm), 5 colours, deterministic positions from a seeded pack; the surface slightly domed; balls displaced by a moving bulge field (the Swimmer); balls roll off the bulge's crest with simple per-ball offsets.
- **Props (15+):** a rocking horse, a toy robot, a teddy bear with a stitched mouth, a jack-in-the-box (closed), a toy piano, stacking rings, a toy telephone on wheels (red, with eyes, for beat 2.7), building blocks spelling nothing, a toy car, a xylophone, a ball cart, shoe cubbies with tiny shoes, a birthday banner, a music box (the source of the jingle, a ballerina turning), balloons tied to the netting. All toys are turned to face the viewer, and they rotate to keep facing them (clicking, 12 fps stepped).
- **Ambient motion:** the music box ballerina, balloons drifting on strings, sun dust in the light rays.

#### The Pit Swimmer (Z2 creature)
- **Concept:** an animal made of ball-pit balls that swims through the pit like a seal through water. It hunts movement (the rule).
- **Silhouette:** a long, eel-like body (6 m) mostly under the balls; above the surface only a moving bulge and a dorsal ridge of balls. When it surfaces: a broad head 1.2 m wide.
- **Head (named parts):** `skull` (a smooth shell made of fused, partly melted balls: metaballs of 40-60 balls converted to mesh with ball shapes still visible), `slide_mouth_upper`, `slide_mouth_lower` (the mouth is a yellow plastic slide that opens 70 deg, its inside ribbed like a tube slide and going down into the dark), `eye_l/eye_r` (two ball-pit balls with painted-on cartoon eyes, which rotate to look at you), `cheek_l/cheek_r` (soft vinyl foam panels with stitched seams), `ridge_1..10` (dorsal balls on stalks), `teeth_1..20` (small rubber stoppers inside the slide).
- **Material:** each part keeps the glossy toy plastic look; the wrongness comes from the shape.
- **Animation:** swimming = a sine wave passed down the body (bulge leads, ridge follows 0.3 s later); at 45 s it turns its painted eyes toward the camera (12 fps stepped like the toys); at 46.8 s the mouth opens with a sticky stretch (shape key). It goes silent when you freeze.
- **Triangles:** 60k-120k.

### 4.3 Z3 -- The pool halls (style: clean real-time architectural render, calm and too beautiful)
- **Lure:** the most beautiful, calm place. Tiles, still water, soft daylight.
- **Palette:** white tiles #F2F2EE with pale grey grout, aqua water #6FC7D0, soft daylight 6500 K from an unseen source, cool shadows. Almost monochrome against Z2's primaries.
- **Geometry:** a chain of tiled halls connected by arches (6 m high), knee-deep pools filling the floor (0.45 m), pillars every 4 m, steps down into deeper water, a lane rope, a ladder into a deep pool (3 m), a tiled ceiling with round skylights (diffuse glow, no direct sun). Halls repeat in subtly wrong ways (the same arch twice, a door 3 m up a wall).
- **Materials:** square 10 cm glossy ceramic tiles with real grout geometry on surfaces near the camera (normal map further away), grout darker in corners, a few cracked tiles. Water: a reflective, refractive plane with gentle normal-mapped ripples, depth-tinted (aqua to deep teal), and caustics projected on the tiles below (animated texture or projected light cookie).
- **Lighting:** soft skylight-like fill, caustic shimmer on walls, the flashlight beam visible underwater as a soft cone.
- **The reflection rule:** the water reflects the scene with a 0.4 s lag (render the reflection with the camera transform from 0.4 s earlier, which is a pure function of time). In the reflection, the ceiling has no skylights.
- **Props (15+):** lane ropes, a lifeguard chair, a pool ladder, floating kickboards, a pool noodle, a rubber duck, a drain grate, tiled benches, a towel on a hook, a sign "NO DIVING" with tile letters, a clock with no hands, a floating beige phone (the thread), a shower head dripping, a rescue ring on the wall, flip-flops by a bench.
- **Ambient motion:** ripples spreading from each footstep, drips with rings, a slowly drifting kickboard.

#### The Mirrorling (Z3 creature)
- **Concept:** a thin, tall figure made of reflections. It moves when you are not watching, and mirrors you when you are.
- **Silhouette:** 2.6 m tall, very thin, standing on the water surface; long arms to its knees; a head like an upside-down teardrop; no visible feet (it stands on its own reflection).
- **Named parts:** `body`, `head`, `arm_l_upper/lower`, `arm_r_upper/lower`, `hand_l`, `hand_r` (long thin fingers), `reflection` (a mirrored copy under the water that moves on the same 0.4 s lag), `ripple_ring`.
- **Material:** a mirror-like chrome surface (metallic 1.0, roughness 0.05) with a faint aqua tint that reflects the pool tiles, so it reads as part of the room until it moves. Its face: a smooth chrome surface showing a warped reflection of the flashlight (the viewer sees their own light in its face).
- **Animation:** when the beam centre is within 15 deg of it, it copies the camera's motion mirrored (a mirror image of the viewer). When not: it slides 1.5 m closer per 0.5 s with no ripples. When you look back after being away: it is closer, and a single ripple ring spreads from its feet.
- **Triangles:** 30k-60k.

### 4.4 Z4 -- The paper library (style: handmade paper craft, warm, tactile, cut-out)
- **Lure:** cosy, quiet, warm lamp light. A place to read.
- **Palette:** cream paper #F1E6CF, kraft card #C49A6C, ink black-blue #1D2433, warm lamp light 2700 K, deep shadows between stacks (brown-black). Accent: the green card lamp shade #3E7A4E.
- **Geometry:** canyon-like stacks 8 m tall made of piled paper and card (not bookcases), tight aisles 1.2-1.8 m, a reading desk area with 3 lamps, a spiral of paper stairs to nowhere, a ceiling of hanging paper lanterns.
- **Materials:** paper with visible fibres (fine noise in colour and roughness), deckled edges, folds as real creases in the geometry, card edges showing corrugation. Subsurface-like translucency on thin paper in front of lamps (emissive back-lighting faked with a light behind or an emission mask).
- **Props (15+):** the ledger, the fountain pen, a card desk lamp, ink bottles, paper moths (folded origami, 20-40 instances), stacks of letters with string, a paper phone (folded, rattles), card filing drawers, a paper globe, paper vines on stacks, a pair of reading glasses made of wire and paper, scissors, a paper clock (ticking), cut-out chairs, paper lanterns, a rolled scroll.
- **Diegetic text:** handwritten in the ledger in an ink cursive (draw it in the engine with stroked paths animated by arc length, so it writes itself; no fonts that look typed).
- **Ambient motion:** paper moths fluttering near lamps (wing flaps at 8 Hz), lantern sway, a page turning slowly in a draft.

#### The Archivist (Z4 creature)
- **Concept:** the library's keeper, a tall figure folded out of the stacks' own pages. It reads where you are from the ledger.
- **Silhouette:** 3.4 m tall when unfolded, stooped, very wide shoulders made of fanned pages, a narrow waist of rolled paper, legs of stacked card. Arms are accordion-folded paper tubes that extend from 1 m to 4 m like party blowers.
- **Named parts:** `torso_pages_1..12` (fanned sheets that ruffle), `waist_roll`, `leg_l`, `leg_r`, `arm_l_fold_1..8`, `arm_r_fold_1..8` (accordion segments, scaled in code to extend), `hand_l`, `hand_r` (five paper-strip fingers each, curled tips), `face_page` (a blank page that creases into a mouth with shape keys `mouth_open`, `crease`), `spine` (a book spine down its back with faded gold lettering).
- **Material:** the same paper as the zone, with ink stains spreading from the face down the chest, and handwriting all over the arms (a texture of ledger script).
- **Animation:** it unfolds from a stack in 1.2 s (pages rotate out from hinges like a pop-up book, stepped slightly for a craft feel); arms shoot out in 0.25 s; it moves by toppling forward and unfolding again (no walking). Pages flutter constantly at the edges.
- **Stack slam:** the stack walls behind you hinge inward and close like pages of a book (each wall section is a separate hinged object), with paper fragments bursting out.
- **Triangles:** 50k-100k.

### 4.5 Z5 -- The motel corridor (style: neon noir, wet, cinematic night)
- **Lure:** relief, rain, a quiet motel at night after the chaos of the library.
- **Palette:** wet dark patterned carpet (burgundy and teal paisley #4A1F2A/#1F4A4A), magenta #E4307A and teal #2FD0C8 neon from the VACANCY sign through the window, sodium sconces 2000 K orange, blue-white CRT glow. High contrast, wet reflections everywhere.
- **Geometry:** a 40 m corridor, doors every 4 m on both sides (numbered 210-230), a window at the end with rain, an ice machine alcove, room 217 (bed, nightstand, lamp, CRT TV on a dresser, curtain).
- **Materials:** wet carpet (darker with glossy specular patches), wood-veneer doors with brass numbers and scratched paint around the handles, textured wallpaper peeling at the ceiling; rain on the window as animated droplets with refraction streaks.
- **Lighting:** sconces between every two doors (one of them broken), the neon spilling coloured light along the floor, the TVs flicker blue in the ajar doors. The flashlight at 50% looks weaker here.
- **CCTV TVs:** CRTs with curved glass, scanlines, slight barrel, vignette, a timestamp; the image is the scene rendered from a high CCTV camera (a second render target), desaturated, low-res (320x240 upscaled) with VHS noise.
- **Props (15+):** ice machine, ice bucket, room service tray on the floor, DO NOT DISTURB sign, a housekeeping cart, a fire hose cabinet, a vending machine (small, foreshadows Z7), a payphone, an umbrella dripping, a wet raincoat on a hook, room keys with plastic fobs, a broken sconce, a CRT in each ajar room, a motel map on the wall, wet footprints (decals).
- **Ambient motion:** rain, neon flicker, the ice machine dripping, TV flicker.

#### The Tenant (the film's main antagonist; glimpsed in Z0, Z2, Z3, Z4, Z5; full in Z7)
- **Concept:** the thing that lives in this place, built out of what it has taken from each zone. Each glimpse adds a material the viewer recognises: ball-pit balls, pool tiles, folded paper, a vending coil. In Z7 it assembles from vending-machine items.
- **Silhouette:** 4.2 m tall at full size, long-limbed, hunched, with a head too small for the body (about 25 cm), arms longer than its legs (it runs on all fours in Z0 and Z7), a ribcage like a broken vending machine front.
- **Named parts (at least 20):** `head` (a smooth pool-tile ovoid with grout lines, one black slot for a face, no eyes), `neck_1..4` (stacked felt-covered segments), `ribcage` (a vending machine glass front, bent, with coils visible inside), `spine_1..8` (vending spiral coils), `pelvis` (folded card), `arm_l_upper/lower`, `arm_r_upper/lower` (fused ball-pit balls over a coil core), `hand_l` (a vending spiral coil curling like fingers), `hand_r` (paper-strip fingers like the Archivist's), `leg_l_upper/lower`, `leg_r_upper/lower` (stacked pool tiles and card), `foot_l`, `foot_r`, `coins` (instances that rattle inside).
- **Materials:** each part keeps its source material (glossy toy plastic, glazed tile, paper, felt, chrome coil, scratched glass), so it looks like a collage. The joints between materials are ugly: torn paper, cracked grout, melted plastic seams.
- **Animation:** moves in a stop-start way: holds still, then moves fast in a 0.3 s burst, then holds. The head tilts 30 deg before every burst (the tell). When running on all fours it uses a 4-beat gallop with the arms reaching far ahead.
- **LODs:** `arm_only` (Z0, Z2-4 glimpses), `upper_body` (Z5), `full` (Z7). Triangles: full 120k-200k.

### 4.6 Z6 -- The felt puppet theatre (style: stop-motion felt and wood, 12 fps stepped)
- **Lure:** warm, handmade, a children's show. Someone is on your side.
- **Palette:** deep red felt #9E1E24, mustard gold trim #C99A3A, dark walnut wood #4A2E1E, warm spotlight 3000 K; felt textures absorb light (soft, no sharp highlights).
- **Geometry:** a small theatre (12 rows of 8 seats), a proscenium arch, a stage 6 m wide, painted roll-down backdrops, backstage with wire armatures and hooks.
- **Materials:** felt with visible fibres (fuzzy fresnel rim: brighter at grazing angles, high roughness 0.9), hand stitching along every seam (small dashed geometry or texture), wood with grain. Everything a little lumpy and handmade.
- **Stop-motion:** the zone's animation (puppets, curtain, Lint) steps at 12 fps (hold each pose 5 frames at 60 fps); the camera keeps moving at 60 fps. Slight per-pose jitter (1-2 mm, seeded) like a real animator's hands.
- **Puppets:** felt versions of the office (a desk, a tiny flashlight puppet), the ball pit, the pool, a book, a house, and a felt Tenant puppet (same silhouette, made of felt patches).
- **Props (15+):** curtains with tassels, a prompt box, theatre seats with numbers, an old ticket on a seat, a usher's torch, painted backdrops (4), wire armatures, puppet hooks, a felt EXIT sign, ropes and sandbags, a spotlight, a felt programme, a music box, a stage trapdoor, a stagehand ladder.

#### Lint (the helper)
- **Concept:** a felt moth that does not belong anywhere, and the only friendly thing in the film.
- **Size and shape:** hand-sized (body 6 cm, wingspan 14 cm), round fuzzy body, two big felt wings with stitched patterns (a simple eye-spot on each), two button eyes (black, glossy, with a white highlight), two curly pipe-cleaner antennae.
- **Named parts:** `body`, `wing_l`, `wing_r`, `antenna_l`, `antenna_r`, `eye_l`, `eye_r`, `glow` (an emissive abdomen, warm orange 2700 K), `legs_1..6` (pipe cleaner).
- **Animation:** wings flap at 6 Hz in stop-motion steps (in Z6) and smooth (outside Z6); head tilt when looking at the camera; the glow pulses gently like breathing; in Z7 it lands on the lens and the glow becomes the new beam.
- **Triangles:** 10k-25k (it's seen huge on the lens in Z7, so the fibres and stitches need detail).

### 4.7 Z7 -- The vending cathedral (style: cold monumental, sci-fi brutalism lit by vending machines)
- **Lure:** awe. It's beautiful in a massive, sacred way.
- **Palette:** black polished stone floor (reflects everything), cool white-blue machine light 7000 K, each machine's own coloured product labels as small accents. Darkness above.
- **Geometry:** a nave 200 m long, 30 m wide, with walls of stacked vending machines 30 high (about 60 m) like organ pipes; the ceiling is a second floor 120 m up with machines hanging upside down. The floor has a long central rift (hidden until 176 s).
- **Machines:** 4 base machine models (snacks, drinks, a tall glass-front, a compact retro) with 6+ variants each (damage, coin slot, sticker, broken glass, missing panel). Each has: a glass front with reflection, spiral coils, product rows (item instances from the zones), a coin slot, a keypad, a dispense flap, a backlit logo panel. Use instancing (InstancedMesh) for the walls; only machines within 15 m of the camera use full-detail geometry.
- **Lighting:** machines are the lights (emissive fronts + sparse area lights). The wave of switching on at 154 s is a per-machine timer along the nave.
- **Props (15+):** coin piles on the floor, dropped items rolling, receipt strips, a toppled machine, cables hanging from the upper floor, a puddle reflecting the upside-down machines, a "THANK YOU" stencil on the floor, an altar-like change machine, a machine selling flashlights with price 0, coin returns spilling, plastic product capsules, hanging chains, light dust columns, a broken keypad, a pew made of a sideways machine.

### 4.8 Z8 -- Home (style: warm photoreal golden hour, a family house)
- **Lure:** the deepest comfort: a home.
- **Palette:** warm wood #9C6B42, cream walls #EEE3CC, golden sun 3200 K through the window, soft green plants; the outside view shows the office mustard carpet and green-white fluorescent light (the colour of Z1 leaking in).
- **Geometry:** a hallway 8 m long with a front door, a side window, an opening to the living room, a staircase going up, a glimpse of a kitchen.
- **Materials:** worn wood floor (scratches along the walking path), a woven runner rug, painted walls with faint marks, picture frames with glass reflections.
- **Lighting:** golden sun beams through the window with dust, warm bounce; the floor lamp without a shadow.
- **Props (15+):** coats on hooks, shoes by the door, umbrella stand, family photo frames (showing the empty zones), houseplant, a hall table with keys and post, a mirror (no flashlight reflection in it), a wall clock, a radiator, a rug, a light switch, a staircase with a toy on the step (from Z2), a kitchen kettle steaming, a calendar with every day crossed out, the wall-mounted beige phone.

## 5. Recurring props (built once by W1, used everywhere)

### 5.1 The beige phone
A 1980s desk phone: chunky beige ABS plastic (#D9CBAA, roughness 0.4, slightly yellowed), a curved receiver on a cradle, a 12-button keypad with worn numbers, a coiled cord (curve with a helical profile). Named parts: `base`, `receiver`, `cord`, `hook_l`, `hook_r`, `buttons_1..12`, `bell` (hidden, for a vibrate animation). Variants: desk (Z1), toy on wheels with eyes (Z2), floating (Z3, sealed with water drops), folded paper (Z4), payphone shell (Z5), felt puppet (Z6), in a vending slot (Z7), wall-mounted (Z8). The ring animation: the receiver rattles in its cradle (2 mm at 20 Hz) during each ring.

### 5.2 Footprint and wet decals, dust motes, insulation fibres
Shared particle and decal kits with seeded positions.

## 6. Checklist per asset (before sending to the orchestrator)
- [ ] Real-world scale against the 1.8 m capsule.
- [ ] No unmodified primitive visible; bevels on all hard edges.
- [ ] At least 8 named `fx_part` parts on each creature; pivots at joints.
- [ ] Asymmetry and wear: at least 3 imperfections per prop.
- [ ] Triangle count within the budget; `bun run assets:check threshold` passes.
- [ ] Turntable sheet at 3 distances under the flashlight rig.
- [ ] Reads in silhouette (fill black, check the outline is recognisable).
- [ ] The storyboard beats it appears in are listed in its `manifest.json` notes.
