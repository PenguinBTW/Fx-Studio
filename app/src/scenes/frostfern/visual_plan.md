# frostfern — visual plan

Macro ice fern crystals growing on a winter windowpane at blue hour — a cottage-window
mullion cross frames four lights of pane; deep dusk outside holds the warm glow of a far
house; a candle warms the lower rim from inside. Seeded dendritic fronds creep out of the
pane's cold corner toward frame center, a car's headlight sweep flares the crystals once,
condensation beads slide through the growth and a moth taps the far glass.

## Palette / light
- Outside: indigo→steel-blue vertical gradient; far house = 2 blurred warm window blobs; sparse drifting snow flecks.
- Inside: near-black; candle rim = warm amber vignette from below, breathing flicker.
- Crystals: pale ice-blue filigree with cyan glints; flare warm-white during the sweep.
- Beats: bare pane (0-4) → ferns sprout (4-14) → headlight sweep + flare (11.5-13) → full forest (14-20, droplet/glisten 16.5, moth tap ~17.5) → candle settle (20-24).

## Camera
- Near-static macro, ~72mm. A slow lateral drift tracks the lead frond's tip across the pane (≈1.2 world units over 24s). The mullion cross stays in frame throughout.

## Motion language
- Frost growth = per-segment appear-times (aT) along recursively seeded dendrites — tip advance + side-branching with angle jitter; sparkle glints ride the growth front.
- Candle rim flicker = layered smooth envelopes; headlight sweep = a moving uniform band that washes the pane and flares crystal alpha.
- Droplets slide on slow beaded paths near the warm rim; one crosses a grown crystal and leaves it glistening.

## Implementation notes
- One LineSegments filigree (aT appear times, aSeed, aGlisten tags), one additive Points cloud (kinds: glints, interior motes, droplets, moth), planes for backdrop/frame/candle — all closed-form f(t), hash seeds, zero sim state.
- Pane-macro distinct from `frostbloom`: the window frame cross is in frame, dusk (not dawn), cold-corner origin, candle + headlight events, droplets.

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
