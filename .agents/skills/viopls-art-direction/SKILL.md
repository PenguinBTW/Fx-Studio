---
name: viopls-art-direction
description: Aesthetic boundaries, anti-slop rules, cohesive visual staging standards, and typography guidelines for Viopls video essays. Focuses on what NOT to do to prevent generic corporate tropes and visual incoherence.
---
# Viopls Art Direction: Cohesion & Anti-Slop Standards

Aesthetic governance, coherence rules, anti-cliché blacklists, and typographic guidelines for Viopls video essays. Style varies project-to-project, but every scene must feel intentionally authored, physically grounded, and strictly free of generic visual slop.

## When to Use

- Establishing the visual direction and scene dressing for a new video or chapter.
- Auditing scenes for visual cohesion, material believability, and colour readability.
- Screening visual designs against corporate motion graphics clichés and AI aesthetic slop.
- Integrating clear, bold typography as an organic, physical component of the scene.

---

## 1. Core Philosophy: Cohesion Over Rigidity

Viopls does not enforce a rigid brand color palette or a single fixed visual genre. A video can be industrial sci-fi, warm editorial, technical blueprint, or brutalist architecture.

Instead, the core requirement is **Intra-Video Cohesion**:
- Once a visual language, materials, and lighting logic are established for a video, **everything inside that video must belong to the same universe**.
- No *accidental* style fractures (e.g., one prop in flat vector next to photo-real brushed metal because it was quicker).
- Deliberate style mixing is fine when it is the concept (e.g. a world built from many animation mediums). Keep shared anchors so it still reads as one film: one key-light direction, consistent scale, a hero whose look never changes, and motivated transitions between styles.
- Every asset must look like it was created by the same art director using the same camera and physical lighting stage.

---

## 2. The Anti-Slop Blacklist [RULE]

Downstream agents frequently default to generic, overused stock motion tropes. The following aesthetic patterns are **strictly prohibited across all Viopls productions**:

### 2.1 The "Corporate Tech Slop" Blacklist
- **No Default Corporate Memphis:** No generic pastel blobs, sausage-arm mascots or marshmallow UI used as filler. Authored stylization (stop-motion clay, rubber-hose, felt) is fine when it is a deliberate look with real texture and lighting.
- **No Floating Generic Network Webs:** Never render random glowing spheres connected by thin glowing bezier lines floating in a void to represent "data," "AI," or "the internet."
- **No Disembodied Floating Icons:** Never place floating 2D app icons (Twitter birds, generic gear wheels, padlock icons) spinning aimlessly in 3D space.
- **No Rainbow Synthwave Gradients:** Avoid unmotivated purple-to-cyan gradient ramps, rainbow glowing edges, or arbitrary chromatic flares slapped on objects without a physical light source.

### 2.2 The "Cheap Stock Video" Blacklist
- **No Meaningless Sci-Fi HUD Jargon:** Never plaster decorative hex codes, random percent tickers, fake targeting crosshairs, or rotating radial grids over footage unless the script literally calls for an in-universe fighter-jet visor.
- **No Unmotivated Holograms:** Avoid translucent, flickering blue holograms when a grounded physical screen, tactile display, or real mechanical readout would be more immersive.
- **No "Void of Nowhere":** Never leave subjects floating in an empty infinite grey or black void without ground contact, contact shadows, or ambient environmental depth.

---

## 3. The 3 Laws of Scene Cohesion [RULE]

To ensure a scene feels premium and unified rather than a collage of unrelated stock elements (imported or procedural):

### 3.1 Consistent Material Physics
- All surfaces in a scene must obey the same physical rendering rules.
- If one object has realistic rough metal with micro-scratches and environment reflections, surrounding props cannot look like untextured, unshaded default Three.js plastic.
- Maintain consistent tactile grit: apply subtle micro-texture, roughness falloff, and ambient occlusion so objects sit together naturally.

### 3.2 Motivated Single-World Lighting
- Every light in the scene must have a plausible in-world origin:
  - An overhead industrial fluorescent fixture.
  - An illuminated display panel or glowing vacuum tube.
  - A harsh theatrical spotlight or natural window sunbeam.
- **Prohibited:** Illuminating objects with uniform, flat ambient light that kills shadows, or having shadows on two adjacent objects cast in conflicting directions.

### 3.3 Colour
- No fixed palette or colour split is required; choose colours for the world being built.
- Anti-slop only: no unmotivated colour washes or gradient ramps (see 2.1), and the focal subject must read instantly against its background (value contrast first, then hue).

---|---|---|---|
| `--void` | `#050506` | Deep Space / Background | Universal scene canvas; never use pure ungrounded `#000000`. |
| `--bone` | `#E8E4DA` | Primary Structure | All primary lines, solid meshes, kinetic text hero anchors. |
| `--ash` | `#6B6A66` | Secondary Context | Wireframe room edges, dimension guides, inactive states, 60% opacity labels. |
| `--signal` | `#FF2A1F` | Intentional Gap / Alert | Reserved for alerts, breaks and key reveals rather than decoration. |

---

## 4. Typography Standards: Bold, Clear & Diegetically Integrated [RULE]

Text in Viopls videos is not an after-thought subtitle layer; it is an architectural element of the frame.

```
[AVOID: Timid, Thin, Detached Text]
+------------------------------------------+
|       thin, wispy text floating          |
|       (gets lost against 3D details)     |
+------------------------------------------+

[MANDATORY: Bold, Physical, Integrated Type]
+------------------------------------------+
|     ■■■■■  ■■■■■  ■■■■■                  |
|     ■■  ■■ ■■  ■■ ■■  ■■  <-- Bold, heavy|
|     ■■■■■  ■■  ■■ ■■  ■■      weight;    |
|     ■■     ■■  ■■ ■■  ■■      cast shadow|
|    +--------------------+     into scene |
|   / Floor / Mesh Surface                 |
+------------------------------------------+
```

### 4.1 Font Weight & Legibility
- **Default to Bold & Heavy:** Heavy weights survive motion blur, compression and phone screens. Light weights or serifs are fine at large sizes with strong contrast and little motion (e.g. a quiet title card).
- **Typeface Fits the World:** Grotesques and monospace suit technical pieces; comic, hand-lettered or display faces suit stylized ones. Avoid novelty fonts that fit neither.
- **Uppercase Dominance for Anchors:** Core thesis words, metrics, and section titles should be rendered in clean, tracked uppercase for maximum visual weight.

### 4.2 Diegetic World Integration
Per `video-design`, text must feel physically bound to the scene:
- **Depth Interaction:** Place text on a distinct spatial plane in 3D/2.5D space. Allow foreground objects or smoke to partially pass in front of it.
- **Light & Shadow Response:** Text geometry should cast subtle contact shadows onto surfaces behind it and catch the scene's rim lighting.
- **Surface Mounting:** Where possible, embed text onto surfaces (etched into metal plates, illuminated on terminal glass, stamped onto concrete blocks).

---

## 5. Visual Art Direction Audit Checklist

Before approving any visual asset, storyboard, or rendered frame:

- [ ] **Zero Slop:** Free of generic Memphis filler (authored stylization is fine), corporate mascots, disembodied floating icons, and decorative fake HUD clutter.
- [ ] **Unified Materiality:** All assets in the scene share believable roughness, texture resolution, and physical presence.
- [ ] **Motivated Lighting:** Light sources are clear, intentional, and cast consistent directional shadows with depth.
- [ ] **Colour Readability:** The focal subject reads instantly; no unmotivated colour washes or ramps.
- [ ] **Legible Typography:** Text stays instantly legible at a glance on a phone.
- [ ] **Integrated Placement:** Typography feels physically planted inside the 3D/2.5D world rather than stuck to the lens.
- [ ] **Video-Wide Cohesion:** The scene belongs to the same film as its neighbours (shared world logic, or deliberate style shifts with shared anchors).