# Visual Architecture Plan

**Chapter / Segment:** lightningstorm — a night supercell over a dark plain
**Core Abstract Concept:** stored charge releasing in branching discharges
**Primary Physical Domain:** convective meteorology — wall cloud, rain shaft, cloud-to-ground channel

---

## 1. The Conceptual Mapping Table

| Script Abstract Concept | Real-World Physical Metaphor | Tangible Form & Materials | Dynamic Visual State Change |
|---|---|---|---|
| *The cell gathers* | Rolling wall cloud | Three stacked fbm billboards, dark slate interior | fbm drifts on slow scroll; ambient interior flicker ramps on `gather` |
| *Rain shaft* | Falling precipitation curtain | Vertical streaked fbm planes in mid-ground | streaks scroll downward on `uT`, opacity ramps with swell |
| *The discharge* | Cloud-to-ground lightning | Recursive jagged `LineSegments`, additive bloom-ish color | `strikeEnv` gates: sharp attack → 1.5s decay → re-strike flicker; flash lights cloud + plain |
| *Distant world* | Town lights on horizon | 70 warm flicker points at y≈−3.8 | per-point closed-form twinkle, constant |
| *Ground* | Dark plain | thin near-black quad | lifts faintly on `uFlash` |

---

## 2. Anti-Cliché Audit (Forbidden Tropes & Replacements)
- **Forbidden Cliché:** cartoon zigzag bolt sprite / flat white flash frame.
- **Grounding Replacement:** hash-seeded recursive channel with sub-forks at reduced energy; afterglow models the strike's real ~1.5s decay, and the flash is visible *through* the cloud interior instead of a full-screen strobe.
- **Forbidden Cliché:** uniform blue "night" wash.
- **Grounding Replacement:** near-black grade; luminance comes only from the strike and the amber town lights.

---

## 3. Spatial Hierarchy & Eye-Tracking Map
- **Primary Hero (Focal Anchor, 60% Visual Weight):** the strike channel center-frame when lit; the wall-cloud belly otherwise.
- **Secondary Support (Context, 30% Visual Weight):** rain-shaft curtains mid-ground giving the strikes something to punch through.
- **Ambient Floor (10% Visual Weight):** town-light points + thin plain on the horizon; upper cloud layers for depth.

## Beats
- **Beat 1 — THE CELL GATHERS (t 0–8)**: clouds roil on slow fbm drift, ambient interior flicker builds, rain shafts thicken.
- **Beat 2 — THE FIRST STRIKE (t 8–16)**: two strikes (t≈11.7, 14.3) — sharp attack + ~1.5s decay + re-strike flicker; flash lights cloud interiors and the plain.
- **Beat 3 — THE BARRAGE (t 16–24)**: four strikes (t≈17.5–22.3), stronger re-strike term, near-continuous afterglow.

All motion closed-form `f(t)`; bolt geometry hash-seeded at setup (mulberry32), envelopes analytic; per-ctx WeakMap state; rig waypoints keyed per entry.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
