# fx_promo storyboard v2 — bar-accurate (bar k starts at 1.736 + (k−1)·1.94409 s)

Music map (measured from audio.json stems): b1–10 intro (vocal/sample only, no drums) · b11–18 drums+bass enter ·
b19–26 full groove · b27–48 verse: vocal hook alternates every 2 bars (odd pairs louder) · b49–50 drums drop (breath) ·
b51–82 the drop, full energy, vocal peak b79–82 · b83–86 breather (vocal/highs dip) · b87–100 full again, dips at b93 ·
b101–114 final run · b115 tail.

| # | Act | Bars | Time (s) | World / palette | Camera vector (exit) | Key beats |
|---|---|---|---|---|---|---|
| A0 | Cold open | 0–1 | 0.00–3.68 | void + Thread | static → push in | Thread pen-draws a single tick on the first vocal |
| A1 | Plot | 2–10 | 3.68–21.18 | bone paper / graphite | top-down → tilt to +z low angle (exit +x) | pen plots y=sin(x−t); curve lifts into a 3D ribbon sheaf; "every frame / is a function / of time." → `Frame = f(t)` |
| A2 | Signal field | 11–18 | 21.18–36.73 | indigo / ice wire, Thread crest | travel +x, low | drums enter = terrain wakes; ripples on kicks; CODE IT · PLOT IT · SYNC IT · SHIP IT on vocal hits |
| A3 | Type canyon | 19–26 | 36.73–52.28 | concrete noon, hard sun shadows | fly −z through Blender words; exit: tilt down to ground | KINETIC · TYPE · IN · 3D as monolithic Blender letters casting shadows; whip pans on snares |
| A4a | City: rise | 27–34 | 52.28–67.83 | dawn sky blue→peach, off-white towers | aerial descending orbit | city assembles floor-by-floor on every beat from the Blender kit; cranes swing on the hook; "BUILT ON THE BEAT" |
| A4b | City: night | 35–40 | 67.83–79.50 | navy / sodium / cyan | street-level fly-through | sunset in 2 bars; windows become the equaliser (each facade one band: low/bass/mid/high/vocal); "LIT BY THE MIX" |
| A4c | City: abandoned | 41–44 | 79.50–87.27 | fog teal-grey / moss | slow dolly, high | lights die floor by floor on off-beats, fog rolls in, moss creeps up facades; mono counter `year 2026 → 2126`; one blinking orange beacon |
| A4d | City: collapse | 45–48 | 87.27–95.05 | ochre dust / silhouettes | pull back wide, then tilt to horizon | towers crack and topple in a closed-form cascade on kicks; dust; the beacon falls last; "EVERYTHING IS f(t)" |
| A5 | Vacuum | 49–50 | 95.05–98.94 | black / white line / orange counter | locked | dust is pulled into one line; 3 · 2 · 1 counter on beats; silence on the last beat |
| A6 | Tunnel drop | 51–66 | 98.94–130.05 | cobalt chrome / magenta / Thread rail | −z at 30 u/s, octagon roll on bars | DROP: hard snap into the Blender tunnel; light rings chase kicks; NO KEYFRAMES · JUST MATH · EVERY FRAME · RANDOM ACCESS; every 4 bars tunnel modules morph material (chrome → glass → wire) |
| A7 | Paper stays paper | 67–82 | 130.05–161.16 | papercraft f(x) is constant; world cycles every 2 bars | slow orbit around the paper logo | paper diorama → blueprint → neon night → ink wash → pixel/ASCII → liquid chrome; b79–82 vocal peak: half-bar stutter through all worlds; world folds back into paper. SAME SCENE · ANY STYLE · ONE ENGINE |
| A8 | Plotter (inverted) | 83–86 | 161.16–168.93 | carbon paper / bone ink / Thread | top-down | breather: "deterministic. seekable. yours." in Cormorant; the pen scrubs back ◀◀ and rewrites the same line exactly |
| A9a | Rewind | 87–92 | 168.93–180.60 | city palettes in reverse order | reverse of A4 cameras | the collapsed city **rewinds**: dust → towers rise → lights relight → dawn. "ANY FRAME" · "ANY TIME" |
| A9b | Rush | 93–100 | 180.60–196.15 | each world's own palette | inherited | b93 one held breath shot (paper logo); then cuts accelerate 2 bars → 1 bar → ½ bar through every world on beats; type: HARDER · BETTER · FASTER · STRONGER on the vocoder hits |
| A10 | Finale | 101–115 | 196.15–224.69 | void / bone / chrome / Thread | spiral in → locked lock-up | every world's Thread spirals into a vortex; b105 collapse → chrome f(x) logo locks (Blender), paper "STUDIO" plate beneath; "motion design as code" · github.com/PenguinBTW/Fx-Studio · nightly; fade on the tail |

## Custom transitions (all new, `app/src/transitions/fxp_*.ts`, all carried by the Thread)
| Seam | At (s) | Dur | Name | Idea |
|---|---|---|---|---|
| A0→A1 | in-scene | — | — | the Thread tick becomes the pen's first stroke |
| A1→A2 | 21.18 | 1 bar | `fxp_ink_bleed` | paper soaks to indigo outward from the plotted curve; the curve stays as the terrain crest (line-match) |
| A2→A3 | 36.73 | ½ bar | `fxp_crest_shear` | A sliced into vertical letter-width bands that shear upward like terrain peaks becoming monoliths, revealing B underneath |
| A3→A4 | 52.28 | 1 bar | `fxp_block_drop` | A breaks into a city-block grid; tiles fall away on 8th notes (with shadow edge) revealing the dawn city plan from above |
| A4→A5 | 95.05 | ½ bar | `fxp_vacuum_pull` | A's pixels compress vertically into the horizon line with luminance smear; only the line remains |
| A5→A6 | 98.94 | ¼ bar | `fxp_octa_snap` | the line snaps into an expanding octagon (tunnel frame silhouette) on the drop, 1-frame white kiss |
| A6→A7 | 130.05 | 1 bar | `fxp_paper_tear` | the tunnel mouth whites out; a torn-paper edge (fibre noise, cast shadow) rips across revealing the paper diorama |
| A7 world swaps | every 2 bars | in-scene | — | world restyle front = expanding sphere from the paper logo; front edge is the Thread |
| A7→A8 | 161.16 | 1 bar | `fxp_page_fold` | the frame folds over like a page along a diagonal crease (3D quad, shaded), the back of the page is B |
| A8→A9 | 168.93 | ½ bar | `fxp_time_smear` | multi-tap `sampleScene` echo of A at earlier times (rewind trail) cross-cut into the collapsed city |
| A9 rush cuts | on beats | ⅛–¼ bar | `fxp_beat_slice` | 2–6 slices in the direction of camera motion, Thread on each slice edge (params: dir, n) |
| A9→A10 | 196.15 | 2 bars | `fxp_thread_vortex` | A twists into a swirl around centre; its brightest pixels become the vortex threads of B |

## Scenes to author / rework
- new `a4_city.ts` (+ Blender `city_kit` done: floors a/b/c, roof, crane, rubble) — params `{ rewind?: [t0, t1] }` for A9a.
- new `a7_paper.ts` + Blender `paper_fx` (folded papercraft f(x) with real thickness, fold creases, tabs).
- rework s1 (A0+A1 paper daylight look), s2 (indigo), s3 (concrete noon + shadows), s7 (cobalt chrome, material morphs),
  s9 (inverted carbon paper), s10 (multi-world vortex).
- remove s4_signal / s5_chrome / s8_wall from the timeline (column + card assets kept only if reused in the rush).

## SFX (subtle, −18 to −24 dB under music, band-limited away from vocal 1–4 kHz)
paper slide/rustle (A1, A7 fold), soft tape-stop (A8 scrub), low concrete rumble (A4d, low-passed 200 Hz), dust hiss,
air whoosh on each custom transition (pitched to key), tiny tick on type slams. Generated procedurally; mixed by the engine.

## v2.1 — reviewer adoption (art 7.0/10, engine 7.8/10)
Adopted:
1. **Shot density**: intra-scene camera presets cut/whip on bar starts; no framing held > ~6 s (A1, A6, A7, A10 especially).
2. **Lyrics as parameters (A9b)**: HARDER / BETTER / FASTER / STRONGER each visibly change a world via params (faster = 4x world t, harder = contrast/edge, stronger = scale/mass).
3. **A9a rewind**: city time runs backwards (`params.remap`) while the camera keeps flying forward on new angles.
4. **Bullet time** at the end of A4d: world t freezes mid-collapse while camera t keeps moving through suspended rubble/dust.
5. **A7**: neon world swapped for **risograph** (pink/teal duotone, halftone, misregistration) to avoid synthwave drift; add a close-up money shot of the restyle front sweeping past the untouched paper logo.
6. **Cold-open flash-forward**: bar 0 transition samples 4 future acts via `api.sampleScene()` for a few frames each (random access in the first second).
7. **Finale multiverse wall**: every world live at the same t in tiles (4→16→64) with one continuous Thread, then vortex, logo lock later.
8. **Kick sidechain**: exposure/bloom pump on kicks; flash decays instead of white flash frames; logo albedo < 1, high bloom threshold.
9. Diegetic seams where possible (type footprints → city foundations; pop-up diorama folds shut into the carbon sheet).
10. Real PCFSoft shadows in city/paper; multi-tap transitions capped at ≤ 4 samples.
