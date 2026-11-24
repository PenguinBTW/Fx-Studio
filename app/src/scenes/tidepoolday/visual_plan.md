# tidepoolday — visual plan

A single tidepool teeming with life at midday: hard sunlight on wet basalt,
a macro world in a hand-span of water. 24s, near-static camera.

## Frame

- Upper third: rough basalt rim (jagged dark silhouettes) against a pale,
  hazed midday sky. Wet sheen lines the rock/pool edge.
- Middle: the pool — an off-round basin of still teal water filling the
  lower two-thirds, ringed by barnacle specks and a few anemone crowns.
- Camera: very low macro, near-static; a tiny drift tracking the sun, with a
  slight attention rack between the crab on the rim and the pool interior.

## Palette

hard noon white (#f4f6ee) haze, wet basalt (#1d2226), pool teal
(#0e4a4a→#2b8a7a), sun glitter (#fff8d8), crab rust (#7a3a22), anemone
crowns (#c9586b / #7a9b4a), goby slate (#3a4648), snail amber (#8a6a3a).

## Beats

| t     | beat | content |
|-------|------|---------|
| 0–4   | still glitter | sun sparkle over the pool, fronds drifting, rim rocks |
| 4–9   | crab patrol | shore crab walks the rim, pauses, waves a claw, slips in |
| 9–12  | goby dart | one tiny goby streaks under the rock edge |
| 12–17 | barnacle bloom | feeding filaments fan out on the rocks |
| 17–24 | snail settle | snail circles the rim trailing slime glint; heron shadow crosses once |

## Elements

- **Water**: near-still surface; glitter grid shimmer tracks the sun; two
  ring ripples (crab slip-in ~8.7s, weed droplet ~14s) + one ambient loop.
- **Rocks**: 7 seeded jagged basalt polygons crowning the rim + wet sheen
  edge in the back shader.
- **Life meshes** (dark silhouettes on JS-computed f(t) paths): crab (body
  + leg ribbons, claw raised on a beat), goby dart, snail + slime glint
  ribbon, limpet micro-creep, heron shadow ellipse crossing once.
- **Anemones**: 4 radial-fan crowns waving on a sway envelope.
- **Barnacle tufts**: 3 filament fans at the rock edge, scale-up 13–15s.
- **Kelp fronds**: 2 thin ribbons bobbing on the surface, slow drift.
- **Points**: glitter sparkles (hash-seeded, uPx-scaled).

## Motion rules

All closed-form f(t); hash seeds via mulberry32; no sim. Base drift on the
water shimmer and fronds, hit transients on the crab slip-in and goby dart,
frame tremor on the glitter, hold creep on the snail.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
