# Visual Architecture Plan — harborlight

**Chapter / Segment:** 20s deep-dusk lighthouse hold
**Core Abstract Concept:** Vigilance — a fixed point of warmth in a dark seascape
**Primary Physical Domain:** Real-scale maritime optics (Fresnel-lamp beam over swell)

---

## 1. The Conceptual Mapping Table

| Script Abstract Concept | Real-World Physical Metaphor | Tangible Form & Materials | Dynamic Visual State Change |
|---|---|---|---|
| *Warning / vigilance* | Rotating Fresnel beam | Brass lamp inside a glazed lantern room; volumetric cone + real SpotLight | Beam yaws continuously; it sweeps across the water and past the lens |
| *Isolation* | Sea stack in open water | Displaced-stone rock, wet PBR, tower rising from it | Swell rolls past the rock; nothing else on the horizon |
| *The sea itself* | Swell field | Displaced 96×96 PBR water plane, closed-form sum-of-sines | Rolling waves; the beam lays a hot specular streak where it lands |
| *Weathered endurance* | Whitewash + slate bands | Lathe-built stone drum, coursing rings, iron gallery rail | None — mass and stillness are the point; the beam is all motion |
| *Life persists* | Wheeling gulls | Hinged-wing 3D gull meshes orbiting the lantern | Orbits, banking, wing-flap dihedral f(t); silhouettes against the lamp |

---

## 2. Anti-Cliché Audit (Forbidden Tropes & Replacements)

- **Forbidden Cliché:** Flat silhouette lighthouse on a gradient card (the 2D habit).
- **Grounding Replacement:** True 3D asset with parallax — gallery rail occludes the lantern, rock skirts dive under a displaced water surface.
- **Forbidden Cliché:** Painted beam streak as a 2D wedge sprite.
- **Grounding Replacement:** A real `SpotLight` + faint volumetric cone; the streak on water is actual specular response to displaced geometry.
- **Forbidden Cliché:** Perfectly calm "mirror sea."
- **Grounding Replacement:** Three crossing swells + a chop term — specular streak breaks up honestly as waves tilt.

---

## 3. Spatial Hierarchy & Eye-Tracking Map

- **Primary Hero (Focal Anchor, 60% Visual Weight):** The lantern room and its beam — highest luminance, frame upper-center on a low orbit.
- **Secondary Support (30%):** The tower + rock stack mass anchoring the composition; door and windows read on the close pass.
- **Ambient Floor (10%):** Water specular streak leading the eye from the beam to the camera; faint stars and gulls.
