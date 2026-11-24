# quayfeast — visual plan

## Concept
A night quay after most traders have gone. Three food stalls stand along the
stone edge under a sagging string of bare festoon bulbs. One stall is still
working: a vendor silhouette behind the middle awning, a cooking pot leaking a
steam column. A customer at the right stall pays and walks off. A cat winds
between the stall legs through the warm pools of light.

## Composition (authored uv)
- Harbor water: left band x<0.17, dark rolling swell + bulb glints at the edge.
- Quay: cobbled ground y<0.48, warm pools under each bulb cluster.
- Stalls: row at x≈0.30 / 0.55 / 0.78, awnings y≈0.66, trestle legs to y≈0.45.
- Festoon string: sagged catenary y≈0.78–0.84 between two poles, 9 bulbs.
- Barge silhouette: upper-left over the water, one amber porthole.
- Steam column: rises from middle stall (x≈0.55) curling right.

## Camera
Low, near-static; drifts +1.4 units along the stall row over 20 s so the bulbs
and stall faces parallax slowly. Same authored-uv remap into the vUv band.

## Light
The festoon bulbs are the only light: warm halos (1.0, 0.72, 0.34) + soft pools
on the cobbles directly beneath each sag point. One bulb flickers on a seeded
intermittent pattern. Bloom 0.16 / threshold 0.66. Everything else is near-
black silhouette.

## Motion beats
0–4 s quiet stalls: bulbs sway faintly, steam column rising, water rolling.
4–13 s cat pass: weaves left→right between the stall legs, pauses under the
middle stall 8–10 s, exits frame right.
6 s vendor straightens and gestures with one arm.
9.5–14 s customer pays at the right stall and walks off with the parcel.
11.5–12.2 s lid-lift: a bigger steam puff boils up off the column.
14–20 s settle: flickering bulb keeps stuttering, water glints.

## Seeds / determinism
Closed-form f(t) everywhere; h1/h2 seeds for cobble speckle, bulb positions,
steam noise, water glints. No simulation state.
