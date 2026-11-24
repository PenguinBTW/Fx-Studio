# petalfall — visual plan

A stone garden at spring dusk: cherry-blossom petals drift, gust, and settle while a stone lantern burns low right-of-frame.

## Palette

- Sky: plum → dusk → indigo gradient; a slow warm→cool arc (ember glow low in frame early, cooling to dusk by t≈15)
- Accent: warm lantern orange (paper diamond + halo), cold blue moon-haze top-left
- Ground: muted mauve gravel with raked bands; ink-blue pond; near-black foliage banks; hazy lilac hills

## Composition (backdrop uv)

- y≈0.79: moon sliver inside blue haze (top-left)
- y≈0.38: lantern paper-diamond + glow, uv.x≈0.63 (right-of-frame)
- y≈0.30–0.36: distant hills in dusk haze + out-of-focus foliage bank
- y≤0.26: raked gravel — wavy parallel bands, concentric arcs ringing the lantern
- y≈0.11, x≈0.35: koi pond oval; two koi shadows cross it (t≈4–14, t≈12–22)
- y≈0.22: white wagtail silhouette, pause-hop-pause along the gravel edge once (t≈9–15.5)
- y≤0.24: drifting petal-layer fog, pink-tinged

## Motion (all closed-form f(t))

- ~150 hash-seeded petals: helical descent (sway + tumble squash/skew), gust envelope swells the drift t≈6–13
- A few petals (i%29) catch on the lantern cap, rock, then dislodge late in life; others (i%13, i%37) settle onto gravel/pond and lie flat
- 4 seed-puffs cross on the breeze (seeded starts, t≈3–16)
- CameraRig: slow drift toward the lantern + tilt up into the falling column through the crescendo, easing back for the settle

## Beats

1. t 0–5: still canopy — a few early petals, caption “the garden holds its breath”
2. t 6–13: gust front — petal rain crescendo, wagtail hops through, caption “a gust loosens the canopy”
3. t 14–20: quiet settling — petals rest on gravel/pond, koi pass, caption “petals settle where the koi pass”

<!-- Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL -->
