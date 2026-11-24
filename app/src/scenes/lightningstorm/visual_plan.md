# Visual Plan — lightningstorm

- **Concept**: night supercell over a dark plain — rolling wall-cloud mass with internal flicker, rain-shaft curtains, closed-form branching lightning strikes, town lights on a thin horizon.
- **Staging**: three stacked fbm cloud billboards (upper frame), vertical rain curtains mid-ground, additive lightning line channels from cloud base to ground, warm town-light points on the horizon, near-black plain below.
- **Beat 1 — THE CELL GATHERS (t 0–8)**: clouds roil on slow fbm drift, ambient interior flicker builds (`gather` ramp), rain shafts thicken.
- **Beat 2 — THE FIRST STRIKE (t 8–16)**: two strikes (t≈10.6, 14.3) — sharp attack + ~1.5s decay + re-strike flicker; flash lights cloud interiors and the plain.
- **Beat 3 — THE BARRAGE (t 16–24)**: four strikes (t≈17.2–22.4), stronger re-strike term, near-continuous afterglow.
- All motion closed-form `f(t)`; bolt geometry hash-seeded at setup (mulberry32), envelopes analytic; per-ctx WeakMap state; rig waypoints keyed per entry.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
