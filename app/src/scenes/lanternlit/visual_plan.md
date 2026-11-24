# Visual Architecture Plan

**Chapter / Segment:** lanternlit — a night river-lantern release (Loy Krathong mood)
**Core Abstract Concept:** wishes released — small lights become a constellation
**Primary Physical Domain:** paper sky lanterns over water: warm candle glow, bobbing ascent, water reflections

---

## 1. The Conceptual Mapping Table

| Script Abstract Concept | Real-World Physical Metaphor | Tangible Form & Materials | Dynamic Visual State Change |
|---|---|---|---|
| *Dusk valley* | Rose-to-indigo gradient + fbm ridge | single backdrop quad, procedural sky + silhouette | static backdrop; stars twinkle throughout |
| *Bridge + platforms* | Arched footbridge, tiered shore staging | procedural silhouette shapes in the same quad shader | fixed silhouettes; lanterns pass over them |
| *The release* | Paper lanterns catching flame | seeded point sprites — candle core + paper-shell gradient | staggered `t0` lift-offs; bob + shared downwind drift; shrink/fade as they thin into stars |
| *Reflections* | Wobbling light columns on water | same seed as the lantern — mirrored position, stretched smear fragment | wobble-synced to each lantern's bob; stretch compresses with altitude |
| *Krathongs* | Flower offerings on the near bank | small warm drifting points with bob | slow downstream drift, independent seeds |
| *Finale lantern* | One lantern crossing close | oversized glow disc + growing bloom halo | enters ~t17 low and close, flares, exits ~t25 |
| *Camera* | Slow pan following the cluster | CameraRig linear-ish pan + gentle rise, 58 mm | drift right with the shared wind, rise toward the thinned sky |

---

## 2. Anti-Cliché Audit (Forbidden Tropes & Replacements)
- **Forbidden Cliché:** identical round lanterns on rails.
- **Grounding Replacement:** per-seed sway amplitude/frequency/phase + size variance; dense near-bank spread, sparse deep — the cluster reads as a crowd, not a formation.
- **Forbidden Cliché:** mirrored copy-paste reflections.
- **Grounding Replacement:** reflections are compressed (0.42×), horizontally streaked, downward-fading and wobble with the SAME phase as their lantern's bob — they read as light on moving water.
- **Forbidden Cliché:** lanterns that climb forever.
- **Grounding Replacement:** brightness fades on a lift-time envelope — they thin into stars (the brief's own beat), while krathongs carry the near-frame light.

## 3. Spatial Hierarchy & Eye-Tracking Map
- **Primary Hero (60%):** the lantern cluster mid-ascent, densest near the bridge.
- **Secondary (30%):** reflection columns + krathongs on the water; the finale close-pass.
- **Ambient floor (10%):** stars, ridge, dusk gradient.

## Beats
- **Beat 1 — THE RELEASE (t 0–8):** dusk valley, bridge silhouette; first lanterns catch and rise from the banks.
- **Beat 2 — OVER THE BRIDGE (t 8–16):** the dense cluster crosses over the bridge, reflections wobbling underneath.
- **Beat 3 — INTO STARS (t 16–24):** lanterns thin and merge with the star field; one large lantern crosses close with a bloom flare.

All motion closed-form f(t); seeds via `mulberry32(66021)`; per-ctx WeakMap state; rig waypoints keyed per entry.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
