# Visual Architecture Plan

**Chapter / Segment:** `glaciercalve` — a tidewater glacier front calving into arctic waters at dusk (20s, three acts).
**Core Abstract Concept:** structural failure releasing stored potential into kinetic energy — a slow mass suddenly becoming mobile.
**Primary Physical Domain:** arctic seascape — ice, slate water, low dusk light, foam, mist.

---

## 1. The Conceptual Mapping Table

| Script Abstract Concept | Real-World Physical Metaphor | Tangible Form & Materials | Dynamic Visual State Change |
|---|---|---|---|
| The standing glacier | Serried ice wall | fbm-carved serac columns, glacier-blue albedo, crevasse veins | Static silhouette in act 1; veins glow where the crack will run. |
| Building stress | Crack propagation | Luminous blue fracture line spidering down-and-across the front | Grows 7–9.5s: branching segments light up in sequence, glow intensifies. |
| The calve | Block slump with torque | A bounded slab of the wall drops, rotating ~10–14° as it leaves | 9.5–12s closed-form drop+roll envelope; the slab tip hits water first. |
| Displaced water | Splash crown + swells | Expanding white foam torus and concentric swell rings | Impact ~11.3s: crown rises + collapses inside 2s; rings keep expanding, decaying. |
| Released material | Icebergs | White-blue angular berg shards | ~12 shards pop at impact, bob on decaying sine, drift outward away from the wall. |
| Startled wildlife | Seabirds | Dark fleeing specks with wing flap | One scatter burst from the splash site at ~11.6s; they exit frame by ~16s. |
| Residual energy | Glitter mist | Fine suspended spray over the impact zone | Sparkle speckles shimmer above the swell, fading through 15–19s. |

---

## 2. Anti-Cliché Audit (Forbidden Tropes & Replacements)

- **Forbidden Cliché:** Simulated fluid/FEM splash.
  **Grounding Replacement:** Closed-form expanding crown — a white foam band whose radius/height follow `splash(t)` envelopes; rings are radial distance bands minus `v·(t−t_impact)`.
- **Forbidden Cliché:** Generic floating iceberg props sliding on rails.
  **Grounding Replacement:** Each berg's pose is `f(seed, t)`: decaying sine bob, hash-seeded drift vector outward from the impact point, slow hash-seeded yaw.
- **Forbidden Cliché:** Bird "flock V formation" clip-art.
  **Grounding Replacement:** One-shot radial scatter — each bird exits on a hash-seeded bearing with `flap(t)` y-oscillation and exits once, never looping.

---

## 3. Spatial Hierarchy & Eye-Tracking Map

- **Primary Hero (60%):** the ice wall across midframe (uv y≈0.45–0.72) — highest luminance; the crack + slab region sits near uv x≈0.55 where the camera drifts.
- **Secondary Support (30%):** the slate sea lower third; swell rings + splash crown centered below the slab.
- **Ambient Floor (10%):** dusk sky with a pale sun wafer low-left; faint aurora-band gradient; vignette + grain.

## 4. Camera Choreography

Slow lateral pan + push (closed-form, `CameraRig`-style): hold wide 0–6s, pan right toward the growing crack 6–9.5s, micro-push + downward tilt into the drop 9.5–12.5s, then drift back to a slightly wider aftermath hold. Breath drift (±0.5 world units) keeps the frame alive throughout.
