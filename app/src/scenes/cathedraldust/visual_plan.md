# cathedraldust — visual plan

A ruined stone cathedral interior at the hour the sun rakes in through the
collapsed vault. One fullscreen GLSL pass holds the whole shot; a Layer2D
pass holds the anchored captions. CameraRig does a slow push toward the
rose window with a slight lateral drift so the sunbeams parallax.

## Composition (uv space, y up)

- **Floor band** `y < 0.30` — debris field: scattered rock blobs, two
  fallen column drums on their sides, gravel noise.
- **Far wall** `0.30 .. 1.0` — the wall the camera faces; rose-window
  remnant high at `(0.52, 0.79)` r≈0.10.
- **Columns** — 4 massive trunks in soft fog: near-left `x≈0.11` w≈0.085
  (darkest), mid-left `x≈0.29` w≈0.055, mid-right `x≈0.73` w≈0.055,
  near-right `x≈0.90` w≈0.095. Each has a small capital flare at top.
- **Broken vault** — overhead arch band `y > 0.86` sweeping left→right;
  the breach is a ragged fbm gap `x≈0.60..0.86` where the beams enter.
- **Sunbeams** — 3 volumetric shafts from the breach raking down-left to
  the floor; parallelograms with soft edges, brightness only inside the
  dust column. Sun arc `sstep(13,18,t)` slides floor intercepts right
  ~0.06 and fades beam 2 out / beam 3 in.
- **Rose window** — ring of 10 shard wedges (red/blue/gold alternating,
  ~3 dark missing), thin tracery spokes, partial oculus; faint colored
  spots thrown on the wall below + one on the floor, drifting with the
  arc.

## Light & palette

Dark blue-grey stone (`0.08–0.16`), warm beam gold `vec3(1.0,0.85,0.55)`,
rose glass `0.8,0.15,0.2 / 0.2,0.3,0.9 / 0.9,0.7,0.2`, low fog everywhere
denser at floor.

## Motion

- ~200 seeded motes, two parallax bands (near bigger/slower); each mote
  is a point that drifts down with sway; brightness ×3 when it sits
  inside a beam's plane; a few seeds twinkle via hash spikes.
- Pigeon: one transit t 9–13.4 — leave left rafters, swoop through beam
  1, one ellipse loop, land right rafter. Flap via sin envelope.
- Chain: thin line hanging from vault near `x≈0.66`, pendulum sway
  `0.05·sin(0.7t)` from t≈3.
- Stone puff: fragment drops from the vault at t≈14.0, puff blob expands
  at the floor `(0.58,0.31)` over ~1.5s.

## Beats

still beams (0–4) → motes drifting (always) → pigeon transit (9–13.4) →
sun-arc shift, beam 2 fades / beam 3 enters (13–18) → settle (18–20).

// Do not forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
