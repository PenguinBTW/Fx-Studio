# tidalruin — storyboard

Single 18s shot, wide low composition on the flat (near-static CameraRig —
slight drift along the channel direction, small lift on the settle). ~40°
lens throughout.

| beat | t | shot | lens | camera | focal point |
| --- | --- | --- | --- | --- | --- |
| dry ruin | 0–4.0 | wide, flat + fort skyline | ~40° | static, low | arch silhouette mid-frame |
| waterline arrives | 4.0–8.0 | wide | ~40° | drift along channels | glowing front + foam right; sanderlings ahead |
| channels fill | 8.0–13.0 | wide | ~40° | drift holds | glassy channel seams; heron walk→freeze→stab; crow hop at 10.1s |
| covering shallow | 13.0–15.0 | wide | ~40° | slight push | sand glosses over, ruin bases darken wet |
| settle mirror | 15.0–18.0 | wide | ~40° | small lift, ease back | ruin + shimmer reflection joined at the base |

## Notes

- `wlX(t)` is the scene clock — one closed-form sweep drives the waterline
  front, channel fill (`chOn`), sand gloss (`cov`), and the reflection gate;
  every scheduled life beat reads its cue off the same front position.
- The reflection reuses `ruinMask` mirrored about `RUIN_BASE` and is drawn
  *after* the covering water so it rides the sheet; a `sin(uv.y*220)` wobble
  gives the shimmer without simulation.
- The front's wobble (`0.045·sin(uv.y*9) + 0.02·sin(uv.y*23)`) makes the
  waterline arrive unevenly — channels breach first at their seam crossings.
- `dart` for sanderlings re-seeds on `floor(t*1.4)` so the cluster skips
  ahead in jerks exactly like the real birds.
- Captions sit on `Layer2D`, anchored to world points via camera projection
  (subtitle convention — not in-world signage).
- All motion closed-form `f(t)`; `h1/h2` hash seeds only; no simulation.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
