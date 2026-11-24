# Storyboard — `forge` (20 s)

Beats ride one 20 s take; the camera opens tight on the anvil and pulls back
to a wide establishing frame.

| t (s) | Beat | Camera | Notes |
|-------|------|--------|-------|
| 0–3   | Macro: glowing workpiece on the anvil face, hammer-facet stump below | Close orbit, r≈1.3, pitch ~0.10 | "THE FORGE" title. Ember breath visible only as rim light. |
| 3–8   | Anvil + stump full, hot bar edges catching bloom | Orbit drifts right, radius growing | Sparks begin reading as rising points; caption "coals keep a slow orange breath". |
| 8–13  | Hearth enters frame left — coal bed, chunky brick lips, hood | r≈2.2, low arc | Ember light breathes: walls darken on the exhale. Steam over tub visible right. |
| 13–17 | Rack + tongs + apron on post read against the back wall | r≈2.8 | Window shaft + drifting smoke catches the left wall. |
| 17–20 | Establishing: whole forge interior, anvil lower-right third, hearth glowing upper-left | Widest pull, slight rise | "iron remembers the hammer". Settle on stillness. |

Closed-form only: one `camPose(t)` shared between playback orbit and the
registered 1 Hz spline path; sparks/steam/breath are deterministic seeds.

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
