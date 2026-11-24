# Visual Architecture Plan

**Chapter / Segment:** tidepools — a rocky tidepool at golden hour, shot straight down then tilting up to the surf.
**Core Abstract Concept:** A sheltered micro-world holding stillness against the rhythm of the sea — calm surface, interrupted, then glass again.
**Primary Physical Domain:** Living littoral microcosm — water optics (reflection, ripple rings, caustics), rock biology (barnacles, algae, starfish, anemones, hermit crab), and surf energy arriving over the rim.

---

## 1. The Conceptual Mapping Table

| Script Abstract Concept | Real-World Physical Metaphor | Tangible Form & Materials | Dynamic Visual State Change |
|---|---|---|---|
| *Stillness* | Undisturbed pool mirror | Water surface reflecting the golden sky gradient | Mirror-flat reflection; the only motion is drifting cloud shadows across the sheen. |
| *First disturbance* | Falling droplets / surf wavelets | Expanding concentric ripple rings + travelling wavelet stripes | Rings dilate from seeded points; faint stripes cross from the rim. |
| *The ocean arrives* | Slosh over the rim | A bright surge band sweeping the pool + foam streaks | Whole-pool wash, foam trails, re-ripples everywhere. |
| *Sheltered life* | Starfish, anemones, hermit crab | Rust-orange pentagonal stars; bundled swaying tentacle cones; a dark shell silhouette | Starfish breathe micro-scale; anemones sway harder with wavelet energy; the crab pause→darts→pauses along the rock. |
| *Recovery* | Re-settling glass | Decaying ripple energy + sustained warm glow | Ripple amplitude decays to zero; the mirror returns, warmer. |

## 2. Anti-Cliché Audit

- **Forbidden Cliché:** Postcard beach wide shot with sunset. **Replacement:** top-down macro composition inside one pool — the world is the rock ring.
- **Forbidden Cliché:** Cartoon starfish waving. **Replacement:** silhouette-true 5-arm stars with only a breathing scale wobble.
- **Forbidden Cliché:** Generic water "shader blue". **Replacement:** sky-reflection gradient + caustic webbing + gold rim light.

## 3. Spatial Hierarchy & Eye-Tracking Map

- **Primary Hero (60%):** the pool mirror — center frame, brightest value (sky reflection), sharpest caustic detail.
- **Secondary (30%):** the rock ring — dark wet frame holding the water; starfish + anemone clusters sit on it.
- **Ambient (10%):** surf + sky sliver revealed during the tilt beat; glitter specks on the water.

## 4. Camera Choreography

Top-down opening (pool fills frame) → during the slosh the camera "tilts to the surf": the pool's uv space compresses downward while a surf+sky band sweeps in from the top of frame — implemented in the shader (`uTilt` warps the evaluation space) plus a small real camera pitch-up for parallax honesty — then settles back to top-down as the water re-glasses.

## 5. Palette

- Water: sky-reflection gradient — horizon peach `#e8a25f` → clear teal `#2a6a78`.
- Rock: wet umber `#2b2118` with specular waterline sheen; algae `#3a4a28`; barnacles pale `#cfc8b8`.
- Life: starfish rust `#b8562a`, anemone tips `#8a4a68`, crab near-black.
- Surf/foam: `#f2ead9`; caustics pale gold `#ffe8b0`.
