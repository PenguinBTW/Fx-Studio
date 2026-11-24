# Visual Architecture Plan

**Chapter / Segment:** frostbloom — ice feathers blooming across a windowpane at dawn
**Core Abstract Concept:** cold accretion → crystalline bloom → warmth arrives
**Primary Physical Domain:** condensation frost on glass — dendrite growth, refraction glints, dawn light

---

## 1. The Conceptual Mapping Table

| Script Abstract Concept | Real-World Physical Metaphor | Tangible Form & Materials | Dynamic Visual State Change |
|---|---|---|---|
| *Night city behind glass* | Defocused street/window lights | hash-seeded large soft discs behind the pane (bokeh) | cold indigo/cyan + sparse sodium amber; melts to pale morning at dawn |
| *First seeds* | Nucleation sites at the frame | tiny additive glints hugging the pane edges | twinkle from t≈2 before any growth |
| *The creep* | Dendrite frost feathers | seeded recursive skeleton (six-fold ±60° side-branches, depth ≤3) drawn as ice point-filaments | each vertex born at `aBirth` → arms grow inward on staggered envelopes; fresh tips glint |
| *Refraction sparkle* | Light catching crystal tips | young-age brightness boost (`exp(-age*2.2)`), per-vertex twinkle | glints ride the growth front as tips advance |
| *Dawn arrives* | Low sun rimming the glass | ambient gradient + peach rim from bottom-right; `aWarm` per-vertex rims arms nearest the light | deep indigo → frost blue → peach edge-light |
| *The breath* | Condensation fog on the pane | fbm-alpha veil quad | swells ~t19.5, recedes ~t21.5 revealing the fuller bloom underneath |

---

## 2. Anti-Cliché Audit (Forbidden Tropes & Replacements)
- **Forbidden Cliché:** L-system snowflake symmetry stamped on centre-frame.
- **Grounding Replacement:** growth is rooted at the frame edges where real frost nucleates; six-fold is a tendency (±60° ± jitter), not a stamp.
- **Forbidden Cliché:** uniform "ice white" crystals.
- **Grounding Replacement:** material response is directional — dawn rim lands harder on arms near the bottom-right sun corner via `aWarm`.
- **Forbidden Cliché:** instant full-screen frost.
- **Grounding Replacement:** growth is legible — arms race inward on staggered envelopes; the fog beat briefly hides then re-reveals the accumulated bloom.

## 3. Spatial Hierarchy & Eye-Tracking Map
- **Primary Hero (60%):** the advancing dendrite fronts — brightest where tips are young.
- **Secondary (30%):** the dawn rim climbing the lower-right; fog swell/recede at the end.
- **Ambient floor (10%):** bokeh backdrop, seed glints, glass sheen.

## Beats
- **Beat 1 — FIRST FROST (t 0–8):** near-black pane, cold bokeh, seed glints sparkle at edges; first mother arms creep from the corners ~t2.6.
- **Beat 2 — THE CREEP (t 8–16):** more arms strike inward, filigree densifies; ambient begins warming ~t13.
- **Beat 3 — DAWN (t 16–24):** peach rim climbs; bokeh melts to morning; breath-fog swells ~t19.5 then recedes ~t21.5 to reveal the fuller bloom.

All motion closed-form `f(t)`; seeds via `mulberry32`; per-ctx WeakMap state; rig waypoints keyed per entry.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
