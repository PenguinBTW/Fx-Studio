# f(x) Studio — promo film, visual plan v2 ("Every world is a function of time")

Track: Daft Punk — Harder, Better, Faster, Stronger (224.69 s, 123.45 BPM, bar = 1.944 s, bar 1 = 1.736 s).
Format: 1920×1080, 60 fps, ~3 m 45 s. Flash advert: feel, not information.

## 1. Thesis
f(x) Studio renders *any* world from one function `Frame = f(t)`. The film proves it by **changing worlds**: each act is
a different style, material and palette (paper, wire, concrete, a city that lives and dies, cobalt chrome, a paper object
that refuses to change while the world restyles around it). Determinism is the punchline: the dead city **rewinds** and
rebuilds itself, because any frame can be evaluated at any t.

User direction (verbatim): "you can have lots of variation in colour schemes" · "a city building itself and slowly becoming
abandoned and falling down" · "a piece of text in a paper world style that stays paper style while the rest of the world
transforms in a completely different style" · "gotta have some ambition" · "make your own custom transitions".

This intentionally departs from viopls-art-direction's single-gamut "intra-video cohesion" rule (user instruction wins).
Cohesion is carried by invariants instead of one palette.

## 2. Invariants (what makes it one film)
1. **The Thread** — one signal-orange `#FF4D12` line that exists in every world (pen ink → terrain crest → canyon light
   stripe → crane cable / power line → vacuum line → tunnel centre rail → paper fold crease / wipe front → vortex core).
   Every custom transition is carried by the Thread. Orange is the only colour that appears in every act.
2. **Type system** — Archivo Black/ExtraBold slams (spring mass, knockout halo), IBM Plex Mono captions (lower third,
   typed), Cormorant italic only for the paper/plotter acts. Same safe zones and halo treatment throughout.
3. **Camera grammar** — always travelling; each act's dominant vector is inherited by the next act's entry vector.
4. **Grade** — filmic HDR, light grain, gentle vignette; each act's palette is 3–4 colours (60/30/10) inside its own world.
5. **Blender for all hero 3D** — pen, type, city kit, tunnel module, papercraft logo, chrome logo, all GLB assets.

## 3. Per-act palettes (each 60 / 30 / 10, Thread always the accent)
| Act | World | 60 base | 30 secondary | 10 accent |
|---|---|---|---|---|
| A0 cold open | void | `#050506` | — | Thread |
| A1 Plot | bone paper, graphite ink, daylight | paper `#E8E4DA` | graphite `#1B1B1D` | Thread |
| A2 Signal field | night wire terrain | indigo `#0B0E2A` | ice `#8FD8FF` | Thread crest |
| A3 Type canyon | brutalist concrete at noon, hard shadows | concrete `#8C8A85` | sun `#FFF6E8` / shadow `#1A1A1C` | Thread stripe |
| A4a City dawn | build-up | sky `#BFD4E6`→peach `#F2C6A0` | off-white towers `#ECE7DF` | crane lights |
| A4b City night | facades are the equaliser | navy `#0A1430` | sodium `#FFB547` | cyan signage `#46E0FF` |
| A4c Abandoned | decay | fog teal-grey `#5F6E6A` | moss `#6E7B3A` | one orange aircraft beacon |
| A4d Collapse | dust | ochre dust `#B9A07A` | silhouette `#2A2622` | Thread power line |
| A5 Vacuum | breath | black | white line | orange counter |
| A6 Tunnel drop | cobalt chrome | cobalt `#08103A` | chrome | magenta pulses `#FF2E88` + Thread rail |
| A7 Paper stays paper | paper object fixed; world cycles | (per world, below) | | paper object: kraft `#C9A57A` / cream `#F3EBDD` / orange tab |
| A8 Plotter | inverted paper | carbon paper `#121214` | bone ink | Thread ink |
| A9 Rewind & rush | inherits each world's palette | | | |
| A10 Finale | home | void | bone + chrome | Thread |

A7 world cycle (each 2 bars): paper diorama (kraft/cream/sky-paper) → blueprint (Prussian `#0E3B66` + white line) →
neon night (black + magenta + cyan) → ink wash (rice paper + sumi black + red seal) → pixel/ASCII (4-colour dither) →
liquid chrome (silver void) → half-bar stutter through all → the world folds back into paper.

## 4. Metaphor map
| Claim | Physical metaphor |
|---|---|
| every frame is a function of time | a pen plots y = sin(x − t) and the curve lifts off the page |
| audio-reactive | terrain ripples on kicks; city windows = equaliser bands |
| procedural / Blender assets | a city assembles floor-by-floor on the beat from a Blender kit |
| time is random-access | the city that collapsed **rewinds** and rebuilds |
| style is a parameter | the paper logo stays paper while the world's renderer swaps |
| no keyframes | the tunnel is one closed-form expression; camera z = −30·t |

## 5. Anti-slop guardrails
No HUD telemetry, no network webs, no floating holograms, no rainbow synthwave gradients (neon world is two colours on
black), no pastel clay. Every style world is lit by a physical light logic of its own.
