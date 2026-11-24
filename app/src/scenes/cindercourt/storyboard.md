# cindercourt — storyboard

Single 18s shot, one wide locked composition on the courtyard (slight
CameraRig lift + micro-drift only). ~40° lens throughout.

| beat | t | shot | lens | camera | focal point |
| --- | --- | --- | --- | --- | --- |
| establishing | 0–2.2 | wide, courtyard + wall | ~40° | static, low | well silhouette |
| torch kindles | 2.2–5.0 | wide | ~40° | static | wall torch pool growing on flagstones |
| sentry walk | 5.0–8.4 | wide | ~40° | slow lift toward parapet | sentry + torch dot left→mid |
| pause mid-wall | 8.4–10.8 | wide | ~40° | lift holds | sentry halted at mid-wall, banners stirring |
| raven | 9.8–12.6 | wide | ~40° | +2u push in | crossbar: raven landing + hop |
| sentry exit | 10.8–13.4 | wide | ~40° | lift eases | doorway glow opens far right |
| gallery cat | 13.6–16.0 | wide | ~40° | static | thin silhouette under the beam |
| settle | 14.4–18.0 | wide | ~40° | drift back to base | pigeons drop onto merlons; pool flickers |

## Notes

- The torch `KINDLE` beat is the light engine: `flick` gates the wall wash,
  the flagstone pool, and the right-wall reach — one `vn2` signal everywhere.
- `gust(t, ph)` is shared by all four banners with different phases; banner 3
  is the ripped one (narrowed tail + fbm ragged edge).
- `sentryX` is a remapped smoothstep: walks 0.20→0.49, holds 0.49 through the
  pause window, resumes to 0.78 where `doorOpen` gates the doorway glow.
- Captions sit on `Layer2D`, anchored to world points via camera projection
  (subtitle convention — not in-world signage).
- All motion closed-form `f(t)`; `h1/h2` hash seeds only; no simulation.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
