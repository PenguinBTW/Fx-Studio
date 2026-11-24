# snowshed — visual plan

A wooden railway snow shed on a mountain pass at deep twilight. Snow falls
gently through the whole scene; a train is heard but never seen — only its
lamp blooms through the timber gaps of the shed's open side, sweeps the
gallery, and leaves a red tail lamp fading at the near end.

## Concept mapping

| Narrative idea | Visual device | Closed-form mechanism |
|---|---|---|
| Railway snow shed on a pass | Diagonal timber gallery (eave `0.44→0.66` uv) rising to the right, pitched roof with a snow accumulation line | `eaveAt(x)`, `roofAt(x)`, `postsAt` post/beam rhythm with distance-tightened pitch |
| The train that never shows | Warm bloom at the far end (4→8s), a light sweep travelling far→near behind the timbers (8→11.5s), red tail lamp fading at the near end (11.5→15s) | `trainAt(uv,t,posts)` — three gated sdist glows modulated by the post pattern and the interior mask |
| Persistent gentle snow | Two drift layers of ~26 seeded flakes each, columnar closed-form fall + lateral sway | `flakeAt(uv,t,layer,gust)` — fract-wrapped fall, h1 seeds |
| One gust crosses | Horizontal drift applied to all flakes for ~3s | `gust = sstep(GUST, GUST+1, t) * sstep(GUST+3, GUST+2, t)` added to flake x |
| Shed is inhabited | Hanging lamp flicker at the far end, icicle drip bead under a rafter, blue smoke puffs from a roof vent | sdist glows + `fract(t*0.25)` bead drop + 3 phased puff exps |
| Life on the pass | Hare darting the open slope (6.5→8.3s, bounding gait), raven landing on a mid-shed post (13s) | gated silhouettes from `sdist`/`mix` of closed-form paths |
| Deep blue twilight | Dark sky gradient, snow-lit mountain crest falling to the pass summit right | `skyAt`, `mtnAt` (vn2 ridge edge + crest highlight) |

## Anti-cliché audit

- No visible train geometry anywhere — light only, per brief (checked:
  `trainAt` only emits glow terms).
- Snow is not a white noise field: two sizes/speeds, sway, one gust event.
- The shed is not a flat billboard: post pitch tightens with distance and
  the eave rises 0.22 uv across the frame, selling the diagonal.
- The hanging lamp is a warm anchor, not a bright spotlight — flicker is
  ±10% at mixed frequencies.
- Captions anchored to the snowfield below the shed, not centre-frame.

## Eye-tracking map

1. t=0–3.4: sky → mountain crest → down to the shed diagonal; caption low.
2. t=4–8: eye pulled to the far-right lamp bloom inside the timbers.
3. t=8–11.5: gaze tracks the light sweep travelling the shed leftward.
4. t=11.5–15: red tail lamp at the near-left end; raven lands mid-shed.
5. t=15–18: release back to the whole frame; settle caption low.

## Stills

Beat-verification renders (see `stills/`):

- `t01.50.png` — still snow, shed diagonal, crest.
- `t06.50.png` — approach: far-end lamp blooms in the timbers; hare crossing.
- `t10.00.png` — pass-through light sweep mid-shed.
- `t13.00.png` — hanging lamp, raven perched, roof accumulation.
- `t16.50.png` — tail fade; snow settles.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
