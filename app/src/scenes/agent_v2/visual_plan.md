# agent_promo v2 - "everything you see is me"

User direction (2026-11-22): drop the city and the one-colour (orange) look; every act gets its own art
direction and palette; ambitious, fourth-wall-breaking, "incredibly visually impressive"; more scenes in that
insane style; tight music sync; one stretch where the lyrics happen literally in the real world.
Approved seed: world build -> crumble -> dragon -> paper -> spiderverse -> style roulette -> fire -> editor reveal.

Narrator: the agent, first person, lowercase, terse. Text is sparse; the images do the talking.
Constant: none visually except the subject continuity (world -> dust -> dragon) and the cursor, which changes
style with each act like everything else.

## Acts (bars from storyboard.md music map; bar(k) = 1.848 + (k-1)*1.86957)
| act | bars | time | world | palette / look | line |
|---|---|---|---|---|---|
| B0 open | 0-2 | 0-5.6 | black; a white cursor types | pure B/W | everything you're about to see is me. |
| B1 world | 3-8 | 5.6-16.8 | planet time-lapse: terrain rises, oceans flood, forests grow, clouds roll; riff hits = growth pulses | golden hour, teal/amber | i can build a world. |
| B2 crumble + freeze | 9-14 | 16.8-28.0 | the world fractures; on bar 13 time stops: bullet-time orbit through frozen shards | ash grey, ember red | ...watch it fall. / i can stop time. |
| B3 dragon | 15-19 | 28.0-37.4 | drums enter: frozen debris spirals and fuses into a serpentine dragon that coils round the lens | obsidian, iridescent thin-film scales | or make a dragon. |
| B4 real world (lyric-literal) | 20-30 | 37.4-57.9 | macro tabletop, natural daylight, 35mm look: one object per beat acts out each verb literally (write it: pen writes; cut it: scissors; paste it; save it: floppy; load it; check it; quick rewrite it ...) | photoreal warm daylight, film grain | (no lyric text on screen; the action is the sync) |
| B5 paper | 31-36 | 57.9-69.2 | dip + 4x "Technologic": each one folds the dragon one stage further into origami | cream paper, sumi ink | turn it into paper. |
| B6 spiderverse + roulette | 37-52 | 69.2-99.1 | DROP: comic mode (halftone, CMYK offset, ink lines, animation on twos, panel cuts); then the dragon changes style every beat, then every half beat: pixel, ASCII, blueprint, stained glass, clay, woodblock, neon vector, oil paint, x-ray, thermal... | new palette per beat | spiderverse? watch. |
| B7 fire | 53-62 | 99.1-117.8 | the dragon breathes fire; the fire burns through the frame like film | fire, black | make it breathe fire. |
| B8 editor | 63-68 | 117.8-129.0 | behind the burn: the Fx-Studio editor making this film; red notes; rewind, change a value, replay - better fire | editor greys + red notes | didn't like the fire. rewrote it. |
| B9 player hijack | 69-76 | 129.0-143.9 | the video player UI appears; lyric verbs operate the film itself: pause it, scroll it, click it, zoom it, drag it | YouTube-ish dark UI, white | (verbs) |
| B10 powers of ten | 77-80 | 143.9-151.4 | dip: one continuous zoom out from a pixel to a galaxy | deep space, cool | i can make it bigger. |
| B11 rush | 81-92 | 151.4-173.8 | every world and style colliding; cuts accelerate 1 bar -> 1/8 bar | everything | - |
| B12 quiet | 93-100 | 173.8-188.8 | paper ash falling in silence-ish breakdown | monochrome, Cormorant italic | i made all of it. |
| B13 mark | 101-119 | 188.8-224.4 | the logo is redrawn in the film's styles, settles clean | clean | enjoy. |

## Engine plan
- `style.ts`: StylePass (one shader, many modes): halftone/CMYK offset, toon ink outline (depth+normal edges),
  pixel/dither, ASCII, Kuwahara paint, blueprint, thermal, x-ray, stained glass (voronoi + lead lines).
- Dragon: Blender head/horns/claws/fins (`assets/dragon`), body = spline tube (Bishop RMF) with scale shader,
  deterministic path f(t); origami = faceted flat-shaded variant + fold states.
- Planet: displaced icosphere (noise terrain) + ocean sphere + cloud shell + instanced trees; crumble = voronoi
  shards (Blender-prefractured) with closed-form ballistic motion; freeze = time scale -> 0.
- Fire: LargeParticles blackbody + volumetric; film burn = noise-threshold transition.
- Real world: Blender macro prop kit, daylight HDR-ish env, DoF.
