# Visual Architecture Plan

**Chapter / Segment:** bioluminescence — a midnight bay where breaking waves ignite
**Core Abstract Concept:** disturbance → emitted light (dinoflagellate flash)
**Primary Physical Domain:** coastal night ocean — wave sets, break lines, luminous turbulence

---

## 1. The Conceptual Mapping Table

| Script Abstract Concept | Real-World Physical Metaphor | Tangible Form & Materials | Dynamic Visual State Change |
|---|---|---|---|
| *Rolling swell* | Incoming wave sets | horizontal crest fronts on a perspective sea plane | phase fronts travel shoreward on a fixed period |
| *The water breaks, it glows* | Dinoflagellate bloom flash | cyan fbm clusters along the crest line | intensity = crest position × break envelope, then diffuses |
| *Disturbed structures* | Rock / pier-piling ring glow | dark pillars + additive ring quads at water level | rings pulse with each passing set |
| *The wake* | A dinghy's luminous trail | dark hull silhouette + additive wake ribbon | hull drifts across the bay; trailing glow fades with age |
| *Sparkle bursts* | Localized dense plankton flash | hash-seeded bright points near break line | rare gaussian bursts on seeded times |
| *Night sky* | Star field + Milky Way | points + faint diagonal fbm band | gentle twinkle, static band |

---

## 2. Anti-Cliché Audit (Forbidden Tropes & Replacements)
- **Forbidden Cliché:** uniform neon-blue sea / Tron glow lines.
- **Grounding Replacement:** glow is event-driven — it exists only inside break envelopes and behind the hull, then decays; most of the water stays near-black.
- **Forbidden Cliché:** particle soup of blue dots.
- **Grounding Replacement:** glow lives on geometry (crest fronts, rings, wake ribbon); points are reserved for rare sparkle bursts.

---

## 3. Spatial Hierarchy & Eye-Tracking Map
- **Primary Hero (Focal Anchor, 60% Visual Weight):** the break line — glowing crest clusters mid-frame.
- **Secondary Support (Context, 30% Visual Weight):** the dinghy + wake crossing the lower third in act 3.
- **Ambient Floor (10% Visual Weight):** star field + Milky Way band, rock-ring pulses.

## Beats
- **Beat 1 — THE TIDE COMES IN (t 0–8)**: first set rolls shoreward, small break flash ~t4–6; rocks answer.
- **Beat 2 — WHERE THE WATER BREAKS, IT GLOWS (t 8–16)**: bigger set, two overlapping break envelopes, sparkle bursts seed.
- **Beat 3 — THE WAKE (t 16–24)**: dinghy crosses left→right dragging a luminous ribbon; sets keep breaking behind it.

All motion closed-form `f(t)`; sparkle/burst seeds via `mulberry32`; per-ctx WeakMap state; rig waypoints keyed per entry.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
