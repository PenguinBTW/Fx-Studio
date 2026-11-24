# orchidsteam — visual plan

**Logline**: a steaming orchid terrarium in a dark conservatory at night — macro glass-and-leaf shot, warm grow-light vs cold moonlight.

## Spatial map (authored uv 0-1, remapped into the visible band x∈[0.27,0.73], y∈[0.16,0.84] at the frag call site)

- Conservatory glass roof: top third (uv.y > 0.62) — mullion grid, faint moon disc upper-left, leaf shadows drifting slowly across the panes.
- Terrarium pane: the whole frame is "inside the tank". Pane edges catch warm shelf light at x≈0.04 and x≈0.96 (thin vertical glints). Condensation droplets live ON this front pane (instanced layer).
- Mossy substrate: bottom band uv.y < 0.10, dark green noise.
- Orchid: stem arcs rise from substrate at x≈0.30/0.52/0.68, curving right; 4-5 blossoms (5-petal rosettes, white/pink) on the arcs; broad leaf at bottom-right that flexes when a drip lands.
- Grow lightbar: horizontal warm strip at uv.y≈0.31 spanning x 0.10-0.90 — breathes slowly.
- Mister nozzle: small brass stub at (0.10, 0.52), shimmer + fog burst origin.
- Frog: silhouette sitting on the broad leaf (~uv 0.72, 0.22), breathing; one hop at t≈14.
- Snail trail: glistening curve on the glass at x≈0.60-0.78, y≈0.40 — nearly static, specular shimmer.

## Palette

- Night conservatory: deep blue-black (0.05-0.12) with cold moon tint.
- Warm grow light: amber (1.0, 0.72, 0.38).
- Steam: desaturated cyan-grey.
- Orchid: white/pink petals with warm rim when the bar breathes up.

## Envelopes f(t) — all closed form

- `mistP(t)`: mister pulse ss(8.2,9.0)·(1-ss(10.5,11.8))
- `fogT(t)`: 0.22 + 0.55·ss(9.0,12.0)·(1-ss(15.5,18.5)) — density climbs after the pulse, recedes for the settle
- `lightT(t)`: 0.55 + 0.45·sin(t·0.5) — lightbar breath
- `moonT(t)`: ss(0,6)·(1-ss(9,13)) — moon reads pre-fog, dimmed by steam
- `hopT(t)`: frog hop ss(14.0,14.25)·(1-ss(14.55,14.9)) — 0.5s arc
- `dripT1/dripT2`: leaf-flex kicks at 12.8 / 15.4 (decaying sin)
- `snailT(t)`: ss(0,20) — trail creeps a few uv-hundredths over the take

## Camera

Slow push z 30→23 through the fog (ss(8,15)), tiny settle drift; lookAt slides from the leaf (low) to the top blossom (higher) — a soft rack feel without DoF.
