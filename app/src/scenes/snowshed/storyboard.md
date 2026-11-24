# snowshed — storyboard (18 s)

| Beat | t | Lens | Camera | Focal point | What happens |
|---|---|---|---|---|---|
| Still snow | 0–3.4 | 40mm | Near-static, tiny lateral drift along the shed diagonal | Shed diagonal + mountain crest | Establishing: shed rises to the right under a snow-lit crest; flakes drift |
| Glow approaches | 4–7.6 | 40mm | Drift continues, slight rise | Far-end lamp bloom through timber gaps | Approach bloom grows inside the shed; hanging lamp flickers; hare darts the slope at 6.5 |
| Pass-through | 8–11.5 | 40mm | Small push as the sweep travels | Light sweep moving far→near behind the timbers | The unseen train passes; warm wash inside the open side |
| Tail fade | 11.5–15 | 40mm | Drift settles | Red tail lamp at the near end | Tail lamp appears and dims; raven lands on a post at 13; smoke puffs over the roof vent |
| Snow settle | 15–18 | 40mm | Static | Whole frame | Snow resumes its quiet fall; accumulation line slightly thicker |

## Beat constants (shader)

`GUST=3.0  APPROACH=4.0  PASS=8.0  TAIL=11.5  HARE=6.5  RAVEN=13.0  SETTLE=15.0`
`FARX=0.86  SHED_Y0=0.44  SHED_Y1=0.66  SHED_H=0.16  ROOF_H=0.05`

## Captions (probe anchors, uv)

| Window | Text | Anchor |
|---|---|---|
| 0.8–3.4 | snow over the pass | (0.5, 0.24) |
| 4.6–7.4 | a lamp inside the timber | (0.5, 0.22) |
| 8.4–11.0 | the train that never shows | (0.5, 0.24) |
| 11.8–14.2 | red at the near end | (0.5, 0.26) |
| 15.2–17.4 | snow keeps falling | (0.5, 0.24) |

## Probe contract

`probe(f)` returns `{approach, sweep, settle}` — 1 inside each window
(4–8, 8–11.5, 15–17.8), matching the beats above for headless tooling.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
