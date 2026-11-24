# fernwell — visual plan

## Concept
A garden corner at golden hour. Old stone walls close two sides; a stone
wishing well sits mid-frame — rough-cut drum, peaked timber roof on two posts,
crank, rope, a bucket hanging at mid-rope. Ivy climbs the left post and spills
over the wall top; ferns ring the base. A robin drops onto the bucket, looks,
hops to the crank, flicks its tail, leaves. A butterfly crosses later; one ivy
leaf falls.

## Composition (authored uv)
- Back wall band y>0.55, mossy stone with hairline cracks; ivy mass spilling
  over its top edge x≈0.55–0.95. Side wall hinted x<0.10.
- Well at x≈0.50: drum y 0.36–0.52 (mouth ellipse at 0.50), roof peak y≈0.72
  on posts at x 0.44/0.56, crank right post, rope to bucket y≈0.585.
- Flagstones y<0.50 with seams; long warm shadows raking right-down.
- Light: raking beam from a hedge gap upper-left — warm wedge brightening the
  roof edge, bucket rim, and flagstones; dust motes inside it.
- Ferns: seeded fronds at the drum base y≈0.37; one long frond arcs right.

## Camera
Low, near-static; slight drift toward the well (+0.8 units over 20 s) so the
posts and ivy parallax gently. Same authored-uv remap into the vUv band.

## Light
Golden beam is the only warm source: gauss wedge from (0.16,0.95) sweeping
right-down; everything else sits in cool shadow. Bloom 0.15 / threshold 0.68.

## Motion beats
0–4.5 s still well: bucket sway, ivy tendril tapping the roof edge, dust motes,
water glint inside the mouth at ~3 s.
4.5–11.5 s robin visit: lands on the bucket 4.5, head-dip ~6.2, hop to crank
~8.4, tail flick ~9.5, flies off 10.8–11.5. Bee works the wall ivy 6.5–10.5.
13–16.5 s butterfly crosses the flagstones low; leaf falls from the ivy 15–18;
wren dashes the wall top ~16.6; second water glint ~17.8.
17–20 s settle: sway continues, motes drift.

## Seeds / determinism
Closed-form f(t) everywhere; h1/h2 seeds for stone joints, cracks, ivy clumps,
fern fronds, motes. No simulation state.
