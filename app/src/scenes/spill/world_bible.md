# SPILL — world bible

A vertical (1080x1920) looping Short, ~28 s, cut to the opening of Gorillaz "Feel Good Inc.".
A glowing terminal cursor breaks out of a phone and falls into SPILL: the world where everything
that ever fell out of a screen ends up. This document plans the *setting*, not only the shots:
the short is one fast path through a place that should feel like it keeps going off-frame.

## 1. Premise

- Above SPILL hangs a sky full of screens: phones, CRTs, arcade cabinets, cinema screens, Game Boys,
  tablets, a laptop with a cracked hinge. They hang on nothing, slowly turning, like lanterns.
- Every screen leaks. Whatever was shown on it eventually drips, falls or climbs out and lands here,
  still drawn in the style it was made in. A cartoon fox is still ink-and-paint. A game fish is still pixels.
- Nothing here was made in the same way as its neighbour. That is the whole point of the world, and the
  point of the short: *one agent made every one of these styles*.
- Tone: joyful, busy, slightly feral. The *Feel Good Inc.* video's floating windmill island is the spiritual
  ancestor (a tiny world adrift, carefree on top, odd underneath), but nothing is copied from it.

## 2. World rules (they make 40 styles read as one place)

1. **One sun.** Every style is lit by the same warm key from upper-left (about 10 o'clock) and a cool sky fill.
   Even flat styles (cel, ink, pixel) put their highlight and shadow on the same side. This is the single
   strongest glue between styles.
2. **Shared ground plane and scale.** Creatures stand on the ground, cast contact shadows, and are sized
   consistently against the cursor (cursor = 1 unit tall, about a hand-span; frog 1.5, deer 6, whale 400).
3. **Style bleed at borders.** Regions meet at seams where materials mix: pixel water turns into ink as it
   flows into the marsh; paper leaves fall into the clay valley and go soft and thumb-printed. Seams are
   a band 2–4 units wide with a dithered or brushed mask, never a straight line.
4. **Things keep their style when they travel.** A pixel fish that jumps into the ink marsh stays pixels for
   a beat, then the ink "catches" it from the tail forward. Contact = slow contagion, never an instant swap.
5. **Every style animates the way that medium really animates.** Clay jitters at 12 fps with thumbprint
   boil; cel is on twos with smear frames; pixel is on fours with sprite-sheet cycles; stop-motion felt has
   fabric creep between frames; ink has line boil. Mixing frame rates in one shot is a feature, not a bug.
6. **Fall-out debris.** Bits of screen UI-shaped detritus (cracked glass, pixel crumbs, film perforations,
   loose ink drops) are scattered everywhere, like leaves. Quiet proof of the premise in every frame.
7. **Palette discipline.** Each region owns 3–5 colours plus one accent. Saturation is high but values are
   controlled: no frame is all mid-tones. Black is used (ink, outlines, deep shadow). No "everything glows".
8. **No real IP.** Every creature is an original design that only *evokes* its medium.

## 3. Art-direction guardrails (anti "AI look")

- Each style must be executed with the real technique of its medium (outline weight, paper fibre, clay
  fingerprints, sprite palette limits, brush direction), not as a filter over a generic 3D render.
- Surfaces show their making: tool marks, glue, seams, registration error, dust on the clay, ink pooling.
- Imperfection is designed: off-model drawings on some frames, wobble on hand-drawn lines, stop-motion
  pops. Never uniform noise.
- Composition is staged like a hand-made film: clear foreground/midground/background, one readable
  silhouette per beat, the cursor always the brightest *orange* thing on screen.
- Bloom only on actual light sources (cursor core, lanterns, screens). Grade with real blacks.

## 4. The hero: the cursor

- **Form:** a terminal block cursor, 0.55 x 1.0 x 0.22 (tall, narrow, sharp 0.02 bevel), the exact orange of
  the caption glyph (`#FF8A1E`), frosted rough-transmission shell over a brighter phosphor core.
- **It is a light source:** it lights the ground and creatures around it (warm 2 m falloff). In flat styles
  it lights them too: cel shadows flip, ink washes warm, pixels get an orange palette swap near it.
- **Blink is its face:** an on/off blink at 1.06 Hz (the classic terminal rate) is its idle and its emotion.
  Fast double blink = surprise. Long off = fear. Steady on = determined. Underscore-flatten = squash.
- **Body language:** squash/stretch (volume-preserving), leans into runs, tips over like a domino to fall,
  "types" a trail of tiny glowing characters behind it when it runs fast (motion lines made of text).
- **Style catches it:** over the short it picks up a bit of every region it touches (ink tail, a pixel
  corner, a paper fold, a clay thumbprint). By the end it is a patchwork cursor: the visual summary of SPILL.

## 5. Geography

SPILL is a vertical world: the sky of screens on top, floating islands under it, the ground below, and a
deep part under the ground. The short travels top to bottom, then whips back to the top.

```
      ~~~~~~~~~~~~~~~~  THE SCREEN SKY (hanging phones, CRTs, arcade cabinets)  ~~~~~~~~~~~~~~~
                 [ our phone ]                         (lanterns of light, cables drifting)
      ..... PAINTED SKY: oil-paint clouds, sky whale, kite-birds .....
             (floating) WINDMILL ISLE              (floating) TEA-CUP ATOLL
      ------ PAPER CANOPY (pop-up forest canopy, cranes) -------------------- CHALK CLIFFS --
      | CLAY HOLLOW market |~ PIXEL FALLS ~| INK MARSH | FELT MEADOW | RUBBER-HOSE TOWN |
      |   stop-motion       | voxel water   | sumi-e    | knitted     | 1930s cartoon     |
      ------- STAINED-GLASS GARDEN ---- PS1 ARCADE RUINS ---- BLUEPRINT YARD -------------
      ................ THE UNDERDRAW (sketch layer: rough pencil, construction lines) ........
```

- Regions are adjacent so the camera can cross several borders in one move.
- The Underdraw (pencil construction lines under everything) is a hidden layer seen through cracks in the
  ground: the world's own "draft". Easter egg, and a possible future short.

## 6. Style library (rendering + animation technique per style)

Every creature/plant/object below references one of these style codes. Each code is a real engine
technique (shader + motion rule), not a colour filter. Frame rate = how often its pose updates
(`stepped(t, fps)`), independent of the 60 fps camera.

| Code | Style | Shading technique | Animation technique | Fps |
|---|---|---|---|---|
| CEL | 90s TV cel animation | 2-tone ramp, hard terminator, ink outline (inverted hull, width by distance), flat rim | Smear frames on fast moves, holds, squash | 12 (twos) |
| ANIME | Painted-background anime | Cel ramp + painted gradient shadow, specular "shine" decal on hair/eyes | Limited animation: holds + 3-frame accents, speed lines | 8 (threes) |
| HOSE | 1930s rubber-hose cartoon | Black/white/1 tint, pie-cut eyes, film grain, gate weave, vignette | Bouncy boneless loops, everything bobs on the beat | 12 |
| CLAY | Claymation | Subsurface + thumbprint normal map, soft key, dust | Replacement pops, surface "boil" per frame | 12 |
| FELT | Stop-motion felt/knit | Fibre shell layers (fur shells), fuzz rim, stitch normal map | Frame-to-frame fabric creep, slight position jitter | 12 |
| PAPER | Papercraft/origami | Flat facets + fold crease normals, fibre texture, back-light transmission through thin parts | Fold/unfold rigs, hinged flaps, flutter | 24 |
| CUTOUT | Paper cut-out (South-Park-like, original) | Flat colour, torn white paper edge, drop shadow onto the layer below | 2D puppet: rotate-from-pivot, pops between angles | 8 |
| INK | Sumi-e ink wash | Wet-edge darkening, granulation, paper bleed, dry-brush on edges | Line boil (2 drawings alternating), flowing brush trails | 12 |
| WATERC | Watercolour storybook | Pigment pooling at edges, paper grain, soft bleeding fills | Gentle 12 fps with paper-texture lock (texture doesn't swim) | 12 |
| OIL | Oil paint / impasto | Kuwahara-style stroke filter + directional brush-stroke normals | Painterly re-paint every 4 frames (strokes re-randomise) | 15 |
| PIXEL | 16-bit sprite | Low-res render target (x6), point sampled, 16-colour palette, dithered shadows | Sprite-sheet cycles, 4-frame walk, no in-betweens | 10 |
| VOXEL | Voxel game | Cubes with AO per voxel, flat-shaded faces | Rigid block parts, chunky hops | 15 |
| PS1 | Late-90s console 3D | Affine texture warp, vertex snapping, low-res textures, fog | Stiff keyframed loops, vertex jitter | 30 |
| VECTOR | Vector arcade | Green/white line-only wireframe, phosphor afterglow trail | Smooth, rotation-heavy | 60 |
| BLUEPR | Blueprint / technical drawing | White linework on blue, dimension lines, hatching for shadow | Constructs itself line-by-line, ruler-straight moves | 24 |
| ENGRAV | Victorian engraving | Cross-hatch density from light, ink-on-cream | Stiff, mechanical, cogs and levers | 12 |
| GLASS | Stained glass | Coloured transmission panes, black lead lines, light shafts | Rigid panes hinge like a puppet | 24 |
| PORCEL | Porcelain / ceramic | Glossy clearcoat, blue glaze patterning, crackle | Wobbly toy motion, clinks | 30 |
| CHROME | Y2K chrome | Mirror env + rainbow film, soft studio reflections | Floaty, rotating, bubbly | 60 |
| PIXAR | Glossy feature CG | PBR + SSS skin, rim light, big expressive eyes | Full 60 fps squash/stretch, overlap, follow-through | 60 |
| CRAYON | Kid's crayon drawing | Wax texture, white gaps, outline overshoot | Boil 3 drawings, wobbly path, wrong perspective | 8 |
| CHALK | Chalkboard | Chalk grain, smudge halo, erase streaks | Draws on, erases off | 12 |
| RISO | Risograph print | 2–3 spot colours, halftone, misregistration offset | Print "pulses" on beat, registration wobble | 12 |
| WOODB | Ukiyo-e woodblock | Flat keyblock lines, bokashi gradients, wood grain | Stylised waves, poses held | 8 |
| BRICK | Toy brick (generic, no studs logo) | Plastic gloss, mould seams, brick quantised | Click-snap stop-motion | 12 |
| SKETCH | Pencil construction (Underdraw) | Graphite lines, construction circles, eraser smudge | Lines search for the form, boil | 12 |

## 7. Regions

Each region: where it leaked from, its look, palette, light, sound texture, and its inhabitants
(full entries in the catalogues below).

### 7.1 The Screen Sky — `CHROME` / `PS1` / `VECTOR` mix
- **Leaked from:** the screens themselves. This is where everything starts.
- **Look:** a dusk-to-day gradient sky crowded with hanging screens at every depth: phones, a CRT with a
  rabbit-ear antenna, an arcade cabinet, a cinema screen showing static, a Game-Boy-ish handheld, a
  smartwatch. Each casts a coloured spill onto the clouds below it. Loose cables drift like jellyfish tails.
- **Palette:** dusk violet `#4B3A78`, peach haze `#F6B78C`, screen cyan `#7FE3E6` (only in screen light).
- **Inhabitants:** cable jellies, a vector-arcade comet-moth, pixel-dust flocks.

### 7.2 Painted Sky — `OIL` / `WATERC`
- **Leaked from:** gallery screensavers and painted film backgrounds.
- **Look:** clouds as thick swirling impasto (directional strokes, Van-Gogh-like *energy*, original shapes),
  wind drawn as visible brush ribbons.
- **Palette:** ultramarine, cadmium yellow, white impasto, a touch of viridian.
- **Inhabitants:** the Sky Whale (hero set piece), kite-birds, a watercolour balloon-fish shoal.

### 7.3 Windmill Isle (floating) — `CEL` + `WATERC` backgrounds
- **Leaked from:** an old cartoon's title card. A small floating island with a crooked windmill, a nod to
  the song's world. Grass on twos, windmill sails smear on each beat.
- **Inhabitants:** cel goats with a smear-frame hop, dandelion parachutes that carry tiny passengers.

### 7.4 Tea-cup Atoll (floating) — `PORCEL`
- **Leaked from:** a kitchen ad. Islands are giant chipped tea cups with blue-glaze patterns; tea waterfalls
  spill off their rims into the sky.
- **Inhabitants:** porcelain cranes, sugar-cube crabs.

### 7.5 Paper Canopy — `PAPER` / `CUTOUT`
- **Leaked from:** pop-up books and craft tutorials.
- **Look:** a forest canopy of folded paper trees; light comes through leaves as warm transmission;
  shadows are crisp and layered (paper casts sharp shadows). Pop-up hinges visible at the base of trees.
- **Palette:** kraft brown, leaf green paper, cream, one red-paper accent.
- **Inhabitants:** origami deer, paper-crane flocks, cut-out squirrels, a pop-up owl that unfolds.

### 7.6 Clay Hollow — `CLAY`
- **Leaked from:** kids' claymation shows. A valley market of stalls and mushroom houses.
- **Look:** chunky forms with fingerprints and tool marks, soft key, warm bounce, a bit of dust on
  everything; the camera here is stop-motion steady (no handheld).
- **Palette:** terracotta, mustard, sage, plum.
- **Inhabitants:** the snail bus, chunky frogs, a gossiping turnip vendor, clay moles that pop up.

### 7.7 Pixel Falls — `PIXEL` / `VOXEL`
- **Leaked from:** handheld and PC games. A terraced voxel cliff with a 16-bit waterfall (4-frame cycling
  tiles) pouring into a pool where pixels "melt" into the Ink Marsh below.
- **Palette:** a 16-colour game palette (deep navy, teal, white foam, grass green, coin gold).
- **Inhabitants:** pixel salmon jumping the falls, a voxel bear, coin-bugs, a slime blob.

### 7.8 Ink Marsh — `INK` / `WOODB`
- **Leaked from:** brush-painting tutorials and woodblock prints.
- **Look:** sumi-e reeds and lotus in pale wash on rice paper, granulating mist, a few woodblock-style
  waves where the marsh meets the falls. The only near-monochrome region (plus one vermilion seal accent).
- **Inhabitants:** the Ink Heron (second-hook set piece), ink koi, brush-stroke dragonflies, a frog-shaped
  ink blot that reforms after it jumps.

### 7.9 Felt Meadow — `FELT`
- **Leaked from:** stop-motion puppet shows.
- **Look:** yarn grass, pom-pom shrubs, buttons as stones, visible stitching on hills; fuzzy rim light.
- **Palette:** wool cream, moss green, coral, denim blue.
- **Inhabitants:** felt sheep (stampede set piece), a knitted fox, sock-worms, a button beetle.

### 7.10 Rubber-hose Town — `HOSE`
- **Leaked from:** 1930s cartoons. A tiny street where everything bounces in time with the music (buildings
  breathe, lampposts sway, a fire hydrant tap-dances). Black and white with grain, but lit by the same sun.
- **Inhabitants:** a pie-eyed cat, singing flowers, a bouncing jalopy.

### 7.11 Stained-glass Garden — `GLASS`
- **Leaked from:** church and app-icon light. Glass-pane flowers throw coloured light shafts on the path.
- **Inhabitants:** stained-glass butterflies (light-shaft wings), a lead-line peacock.

### 7.12 PS1 Arcade Ruins — `PS1` / `VECTOR`
- **Leaked from:** old consoles. Low-poly ruins with warping textures, fog, a vector-line moon.
- **Inhabitants:** a low-poly dinosaur with vertex jitter, vector wireframe birds.

### 7.13 Blueprint Yard — `BLUEPR` / `ENGRAV`
- **Leaked from:** CAD screens and old patents. Machines that construct themselves out of drawn lines.
- **Inhabitants:** an engraved clockwork beetle, a blueprint crane (the machine) that draws its own arm.

### 7.14 Chalk Cliffs — `CHALK` / `CRAYON`
- **Leaked from:** classroom screens and kids' drawing apps. Cliffs of chalkboard slate with doodled
  ladders; a crayon sun that is wrong-perspective on purpose.
- **Inhabitants:** crayon dog, chalk stick-figure climbers, a doodle rocket.

### 7.15 The Underdraw — `SKETCH`
- **Leaked from:** the drafts nobody saw. Seen only through cracks: rough pencil construction lines of the
  world above. Future-short hook.

## 8. Creature catalogue

Every creature gets its own style (some share). "Use" = H hero beat, F featured (on screen ≥ 0.5 s,
readable), B background life, X cut / future short. Size in cursor units (cursor = 1).

| # | Creature | Region | Style | Size | Behaviour / animation | Use |
|---|---|---|---|---|---|---|
| 1 | **Sky Whale** | Painted Sky | OIL | 400 | Glides through impasto clouds; strokes re-paint every 4 frames; barnacles are dabs of paint; spout of white impasto. Cursor ricochets off its back. | H |
| 2 | **Ink Heron** | Ink Marsh | INK | 40 | Neck drawn in one brush stroke; line boil; swallow = neck becomes a bulging wet stroke; spits the cursor out in ink style. | H |
| 3 | **Felt Sheep** (flock of 30) | Felt Meadow | FELT | 3 | Stampede at 12 fps with fabric creep; each sheep a different wool colour; button eyes. | H |
| 4 | **Pixel Salmon** | Pixel Falls | PIXEL | 2 | 4-frame jump cycle up the falls; cursor rides one; dissolves into ink at the marsh border (rule 4). | F |
| 5 | **Snail Bus** | Clay Hollow | CLAY | 12 | Clay shell with windows and passengers (tiny clay frogs); slow, honks with a squeak; leaves a glossy trail. | F |
| 6 | **Chunky Frog** | Clay Hollow | CLAY | 1.5 | Replacement-pop croak; knocked over by the cursor landing, rolls like a ball, gets back up. | F |
| 7 | **Origami Deer** | Paper Canopy | PAPER | 6 | Crisp folds, hinge-step walk at 24 fps; antlers are folded fans; startles and bounds away. | F |
| 8 | **Paper Cranes** (flock) | Paper Canopy | PAPER | 1 | Flap by folding; scatter in a burst when the cursor crashes through. | F |
| 9 | **Pop-up Owl** | Paper Canopy | PAPER | 3 | Unfolds from a flat card on a tree trunk, rotates head with a paper crinkle. | B |
| 10 | **Cut-out Squirrel** | Paper Canopy | CUTOUT | 1 | 8 fps 2D puppet, torn white edge, drop shadow on bark. | B |
| 11 | **Cel Goat** | Windmill Isle | CEL | 2 | Smear-frame hop on the beat, chews on twos. | B |
| 12 | **Ink Koi** | Ink Marsh | INK | 3 | Single-stroke bodies swim in loops, leave wet trails that bleed into the paper. | F |
| 13 | **Brush Dragonfly** | Ink Marsh | INK | 0.5 | Two dry-brush flicks for wings, darting holds. | B |
| 14 | **Ink-blot Frog** | Ink Marsh | INK | 1 | Splats into a blot when it lands, re-forms into a frog. | B |
| 15 | **Knitted Fox** | Felt Meadow | FELT | 4 | Yarn tail unravels a bit when it runs, then knits back; herds the sheep. | F |
| 16 | **Sock Worm** | Felt Meadow | FELT | 1 | Inchworm made from a striped sock. | B |
| 17 | **Button Beetle** | Felt Meadow | FELT | 0.5 | A big button shell, thread legs. | B |
| 18 | **Voxel Bear** | Pixel Falls | VOXEL | 8 | Chunky blocky swipe at the salmon, misses on the beat. | F |
| 19 | **Slime Blob** | Pixel Falls | PIXEL | 1 | 2-frame squish idle; bounces off the cursor. | B |
| 20 | **Coin Bugs** | Pixel Falls | PIXEL | 0.3 | Spinning 4-frame coins with legs, scatter with a "bling". | B |
| 21 | **Pie-eyed Cat** | Rubber-hose Town | HOSE | 2 | Boneless walk on the beat, tips its hat at the cursor. | F |
| 22 | **Singing Flowers** | Rubber-hose Town | HOSE | 1.5 | Faces in the petals, sway and mouth the music. | B |
| 23 | **Stained-glass Butterflies** | Stained-glass Garden | GLASS | 1 | Wing panes throw coloured light on everything below. | F |
| 24 | **Lead-line Peacock** | Stained-glass Garden | GLASS | 6 | Tail fans open as a rose window. | B |
| 25 | **Low-poly Dino** | PS1 Ruins | PS1 | 20 | Vertex-jitter idle, stiff roar, texture warp when it turns. | F |
| 26 | **Vector Birds** | PS1 Ruins | VECTOR | 1 | Wireframe flock with phosphor trails. | B |
| 27 | **Comet-Moth** | Screen Sky | VECTOR | 5 | Draws its own trail as a long glowing line in the sky. | B |
| 28 | **Cable Jellies** | Screen Sky | CHROME | 3 | Drifting tangles of phone cables with chrome bells. | F |
| 29 | **Kite-birds** | Painted Sky | WATERC | 2 | Watercolour kites that flap; tails are ribbons of wet paint. | B |
| 30 | **Balloon-fish shoal** | Painted Sky | WATERC | 1 | Inflate/deflate in time with the bass. | B |
| 31 | **Porcelain Cranes** | Tea-cup Atoll | PORCEL | 5 | Stiff, glossy, clink when they step. | B |
| 32 | **Sugar-cube Crabs** | Tea-cup Atoll | BRICK | 0.5 | Click-snap stop-motion, crumble at the edges. | B |
| 33 | **Clockwork Beetle** | Blueprint Yard | ENGRAV | 2 | Cross-hatched, visible gears turn as it walks. | B |
| 34 | **Blueprint Crane** (machine) | Blueprint Yard | BLUEPR | 30 | Draws its own arm line by line, then lifts. | F |
| 35 | **Crayon Dog** | Chalk Cliffs | CRAYON | 2 | Wrong-perspective legs, 3-drawing boil, wags a scribble tail. | F |
| 36 | **Chalk Climbers** | Chalk Cliffs | CHALK | 1 | Stick figures climbing doodled ladders, erase when they fall. | B |
| 37 | **Clay Moles** | Clay Hollow | CLAY | 1 | Pop up from the ground in a row, on the beat. | B |
| 38 | **Turnip Vendor** | Clay Hollow | CLAY | 2 | Gossiping market keeper; points at the cursor. | B |
| 39 | **Glossy Bunny** | Windmill Isle | PIXAR | 1.5 | Full 60 fps feature-CG squash and huge eyes, stares at the camera at the freeze. | F |
| 40 | **Riso Toucan** | Painted Sky edge | RISO | 2 | Two-colour misregistered print, beak halftone. | B |
| 41 | **Woodblock Wave-Carp** | Ink Marsh border | WOODB | 6 | Leaps a keyblock wave with bokashi spray. | B |
| 42 | **Anime Cat-spirit** | Paper Canopy edge | ANIME | 3 | Limited animation, held poses, sparkle shine on its eyes. | B |
| 43 | **Sketch Wolf** | Underdraw | SKETCH | 5 | Construction-line wolf glimpsed through a crack. | X |

## 9. Plant catalogue

| # | Plant | Region | Style | Behaviour |
|---|---|---|---|---|
| P1 | Folded-paper trees | Paper Canopy | PAPER | Leaves are folded diamonds; light transmits warm; branches hinge in wind |
| P2 | Pop-up flowers | Paper Canopy | PAPER | Spring up on pull-tabs when the cursor passes |
| P3 | Fat clay mushrooms (houses) | Clay Hollow | CLAY | Doors and windows, thumbprinted caps, chimney smoke as cotton |
| P4 | Coil-pot cacti | Clay Hollow | CLAY | Built from clay coils; flower pops on the downbeat |
| P5 | Blocky ferns | Pixel Falls | VOXEL | Sway as 2-frame sprites |
| P6 | 16-bit vines | Pixel Falls | PIXEL | Tile-animated curtain beside the falls |
| P7 | Sumi-e reeds | Ink Marsh | INK | Single strokes, bend with brush-trail wind |
| P8 | Ink lotus | Ink Marsh | INK + vermilion | Opens in 3 drawings; the only red in the marsh |
| P9 | Yarn grass | Felt Meadow | FELT | Strands flick on contact, then settle |
| P10 | Pom-pom shrubs | Felt Meadow | FELT | Bounce when sheep run through |
| P11 | Stained-glass tulips | Glass Garden | GLASS | Throw coloured light on the path |
| P12 | Singing daisies | Rubber-hose Town | HOSE | Faces, bob on the beat |
| P13 | Impasto sunflowers | Painted Sky islands | OIL | Thick petals, heads track the cursor |
| P14 | Watercolour willows | Windmill Isle | WATERC | Wet-edge leaves drip paint |
| P15 | Cel dandelions | Windmill Isle | CEL | Seeds parachute off carrying tiny passengers |
| P16 | Porcelain coral | Tea-cup Atoll | PORCEL | Blue-glaze branches, glossy |
| P17 | Low-poly palms | PS1 Ruins | PS1 | Texture warp, 4-vertex leaves |
| P18 | Blueprint ivy | Blueprint Yard | BLUEPR | Grows as dimension lines |
| P19 | Crayon trees | Chalk Cliffs | CRAYON | Lollipop trees, scribble fill |
| P20 | Riso palms | Painted Sky edge | RISO | Two-colour halftone fronds |
| P21 | Woodblock pines | Ink Marsh border | WOODB | Flat keyblock with bokashi |
| P22 | Brick bushes | Tea-cup Atoll | BRICK | Click together, wobble |
| P23 | Felt moss on buttons | Felt Meadow | FELT | Fuzzy rim light |
| P24 | Vector grass | PS1 Ruins | VECTOR | Green line grass, phosphor trails |
| P25 | Sketch weeds | Underdraw | SKETCH | Seen through cracks |

## 10. Objects, props and debris

| # | Object | Region | Style | Note |
|---|---|---|---|---|
| O1 | Our phone (hero) | Screen Sky | PIXAR (real-material) | Glass, aluminium, interior visible after the break |
| O2 | Hanging screens (x200) | Screen Sky | mixed | CRT, arcade, cinema, handheld, watch: each a different leak |
| O3 | Crooked windmill | Windmill Isle | CEL | Sails smear on each beat; song nod |
| O4 | Giant chipped tea cups | Tea-cup Atoll | PORCEL | Tea waterfalls off the rims |
| O5 | Market stalls | Clay Hollow | CLAY | Awnings, clay fruit, tiny price tags |
| O6 | Voxel bridge | Pixel Falls | VOXEL | Cracks block by block when the sheep hit it |
| O7 | Rice-paper scrolls | Ink Marsh | INK | Unroll as paths |
| O8 | Button stones | Felt Meadow | FELT | Stepping stones over a yarn stream |
| O9 | Bouncing jalopy | Rubber-hose Town | HOSE | Honks, breathes |
| O10 | Rose-window gate | Glass Garden | GLASS | Light shafts on the path |
| O11 | Arcade cabinet ruin | PS1 Ruins | PS1 | Screen still showing attract mode |
| O12 | Self-drawing machines | Blueprint Yard | BLUEPR | Gears drawn then turning |
| O13 | Doodle rocket | Chalk Cliffs | CRAYON | Launches with a scribble exhaust |
| O14 | Screen debris | everywhere | mixed | Pixel crumbs, film perforations, glass chips, loose ink drops, cursor-shaped ants' trails |
| O15 | Lantern cables | Screen Sky | CHROME | Hang from screens, drift like kelp |
| O16 | Painted islands | Painted Sky | OIL | The cursor's final perch |

## 11. The song: what we use and why

- Track: Gorillaz, "Feel Good Inc." (album version, 3:41, supplied by the creator). Copyrighted: kept out
  of git at `app/public/audio/feel_good_inc.wav` (gitignored); mixes are delivered as attachments only.
- Measured (`scripts/analyze_song.py`, onset/RMS peaks, Whisper word timing):
  **137.9 bpm, beat = 0.435 s, bar = 1.740 s; the bass/drum drop is the bar-1 downbeat at 6.43 s.**

| Song time | What's in the music | Use |
|---|---|---|
| 0.15–1.2 | Laugh starts: "ha" pulses at 0.34, 0.67, 0.94, 1.20 over the guitar riff | Ram 1 on 0.34, ram 2 on 0.94 |
| 1.45 | Strongest early pulse | **Ram 3 = break-out** |
| 1.73–5.3 | The laugh rolls on every ~0.27 s (1.73, 2.02, 2.29, 2.61, 2.88…), decaying | Each pulse is one comic impact frame while the glass bursts, fewer and weaker until rendering is normal |
| 5.3–6.4 | Riff swells into the drop | Freefall through the Screen Sky |
| **6.43** | **Bass and drums drop in** | Hits the Sky Whale |
| 6.43–31 | Instrumental groove, the iconic bassline, no vocals | The tour: one region per bar |
| **12.2–12.7** | **Bass rests for two beats** (only gap in the groove) | **Second hook:** the Ink Heron's gulp sits in the gap |
| 13.39 | Bar downbeat, full groove | The heron spits it out, now ink-styled |
| 25.6–27.3 | Groove thins (kick gaps at 26.0 and 27.0) | The scream from above |
| 27.32–29.06 | Last bar | Whip back to the sky, into the next phone |
| ~33.6 | Verse starts ("City's breaking down…") | Not used; we loop before vocals |

**Cut: song 0.00 → 29.06 s (bar 14 downbeat after the drop), 29.06 s long.** The loop goes from that
downbeat straight back to the opening laugh; the scream and the whip cover the seam, and frame 0 is the
cursor already charging the glass.

## 12. Final flow (shot list, timed to the song)

All times are song = video time. `|` marks a downbeat. Cursor = C.

| Time | Region / cast | Shot | Style moment |
|---|---|---|---|
| 0.00 | Phone interior | Macro: C already mid-charge in a lamp-lit chip canyon (cable vines, dust in light). Frame 0 = motion. | Real materials |
| 0.34 | — | **Ram 1** on the first "HA": comic impact frame (2 held frames: inverted ink, halftone, speed lines), crack star | COMIC hit |
| 0.94 | — | **Ram 2**: bigger crack, camera kick | COMIC hit |
| 1.45 | — | **Ram 3 = break-out**: glass bursts toward the lens | COMIC hit, smear frame on C |
| 1.73–3.0 | Our phone → Screen Sky | Each laugh pulse is one more impact frame as C and shards fly out (fewer, weaker), then real rendering: the phone seen from outside, hanging among hundreds of screens | Comic → real |
| 3.0–6.43 | Screen Sky, Painted Sky | Freefall past cable jellies, a CRT, the comet-moth trail; drop through impasto clouds, kite-birds peel away | CHROME, VECTOR, OIL, WATERC |
| \|6.43 | **Sky Whale** | **The drop**: C slams the whale's back on the downbeat, impasto splashes, ricochets | OIL |
| 6.43–8.17 | Painted Sky, Windmill Isle | Bounce past the floating windmill (sails smear on beats), cel goats hop | CEL |
| \|8.17 | Paper Canopy | Crashes through the folded canopy; paper cranes burst; the origami deer bolts | PAPER, CUTOUT |
| \|9.91 | Clay Hollow | Lands in the market: knocks over a chunky frog, the snail bus honks, moles pop up on the beats | CLAY |
| \|11.65 | Ink Marsh edge | C rolls into the marsh; the heron's head enters frame and strikes | INK |
| **12.2–12.7** | **Ink Heron** | **Second hook:** gulp in the bass gap. Hold on the bulging neck, near-silence | INK (line boil only) |
| \|13.39 | — | Spit out on the downbeat: C is now **ink-styled**, splats, re-forms | INK |
| 13.39–15.13 | Pixel Falls | Lands on a jumping pixel salmon and rides it up the falls; the voxel bear swipes and misses; coin bugs scatter. C's corner turns to pixels | PIXEL, VOXEL |
| \|15.13 | Falls → marsh border | Style bleed: the salmon dives and goes from pixels to ink, tail first | PIXEL → INK |
| \|16.87 | Felt Meadow | Felt-sheep stampede, the knitted fox herding; C surfs a sheep's back | FELT |
| \|18.61 | Rubber-hose Town | Everything bounces on the beat; the pie-eyed cat tips its hat; singing flowers | HOSE |
| \|20.35 | Glass Garden → PS1 Ruins | Stained-glass butterflies throw colour on C; the low-poly dino roars with vertex jitter | GLASS, PS1 |
| \|22.10 | Chalk Cliffs | C grabs the doodle rocket; scribble exhaust up the cliff past the crayon dog | CRAYON, CHALK |
| \|23.84 | Painted island | Hero vista: C lands on a floating island; SPILL laid out below as a patchwork of styles; C is now a patchwork cursor | All |
| \|25.58 | — | **The scream** from above. Every creature in frame looks up at once (whale, heron, sheep, dino, bunny) | All |
| \|27.32 | Screen Sky | Whip up past the whale to the screen sky, push into one phone among hundreds | Camera whip |
| 28.6–29.06 | Next phone | Through the glass: a new cursor, blinking, already charging. Cut = frame 0 | Real materials |

### Pacing check
- New region or set piece on every downbeat (1.74 s) from 6.43 to 25.58; 12 different styles of shading
  on screen in 29 s, plus background creatures in 10 more.
- Hooks: frame 0 motion → impacts on the laugh (0.34/0.94/1.45) → the drop (6.43) → the gulp (12.2)
  → style payoff (13.39) → the scream (25.58) → the loop.

## 13. Build plan

1. Hero assets in Blender: cursor, phone (exterior + interior corner), glass with fracture.
2. Style shader library (§6), each tested on one test creature in a style contact sheet.
3. Set-piece creatures first (whale, heron, sheep, salmon, snail bus, deer), then background life.
4. Region kits (ground, plants, props) built as modular GLBs with a shared scale and sun.
5. Camera path: one continuous fall/run; regions placed along it so borders are crossed on downbeats.
6. Impact-frame transition (re-renders both sides) for 0–3 s; whip transition for 27.29–29.04.
7. Audio: song cut + scream, glass, whale, honk, gulp, splat SFX on top; master −14 LUFS.
8. Verify with stills every 0.5 s, the style sheet, the loop seam, and an independent review.
