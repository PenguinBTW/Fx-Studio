# solarflare — visual plan

Concept: the sun's limb filling the lower frame; magnetic field made visible.

- **Staging**: a huge sphere sunk below the camera gives the limb curvature; corona lives on an additive billboard behind it; prominence loops are TubeGeometry arcs anchored at the limb. Sparse stars sit far behind.
- **Beat 1 — THE QUIET LIMB (t 0–8)**: camera drift only; granulation churns, corona crown flickers, no loops above the limb. Focal emphasis: surface texture.
- **Beat 2 — A PROMINENCE SWELLS (t 8–16)**: `uSwell` ramps heat/corona; loops rise on per-loop rise-hold envelopes. Focal emphasis: the tallest arc (spec 2).
- **Beat 3 — ERUPTION RELEASE (t 16–24)**: gaussian `uErupt` flash at t≈17; the two `erupt` loops stretch skyward (capped to keep apexes in the 42mm frame) then all loops collapse. Focal emphasis: the flash + releasing arcs.
- All motion closed-form `f(t)`; per-ctx state keyed by WeakMap (multi-act instances are independent).
