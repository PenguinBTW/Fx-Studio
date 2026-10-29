---
name: viopls-art-direction
description: Aesthetic boundaries, anti-slop rules, cohesive visual staging standards, and typography guidelines for Viopls video essays. Focuses on what NOT to do to prevent generic corporate tropes and visual incoherence.
---
# Viopls Art Direction: Cohesion & Anti-Slop Standards

Aesthetic governance, coherence rules, anti-cliché blacklists, and typographic guidelines for Viopls video essays. Style varies project-to-project, but every scene must feel intentionally authored, physically grounded, and strictly free of generic visual slop.

## When to Use

- Establishing the visual direction and scene dressing for a new video or chapter.
- Auditing scenes for visual cohesion, material believability, and palette discipline.
- Screening visual designs against corporate motion graphics clichés and AI aesthetic slop.
- Integrating clear, bold typography as an organic, physical component of the scene.

---

## 1. Core Philosophy: Cohesion Over Rigidity

Viopls does not enforce a rigid brand color palette or a single fixed visual genre. A video can be industrial sci-fi, warm editorial, technical blueprint, or brutalist architecture.

Instead, the core requirement is **Intra-Video Cohesion**:
- Once a visual language, material palette, and lighting logic are established for a video, **everything inside that video must belong to the same universe**.
- No sudden style fractures (e.g., jumping from photo-real brushed metal to flat vector cartoons, or pairing pastel clay blobs with cinematic chiaroscuro).
- Every asset must look like it was created by the same art director using the same camera and physical lighting stage.

---

## 2. The Anti-Slop Blacklist [RULE]

Downstream agents frequently default to generic, overused stock motion tropes. The following aesthetic patterns are **strictly prohibited across all Viopls productions**:

### 2.1 The "Corporate Tech Slop" Blacklist
- **No Pastel Claymorphism / Corporate Memphis:** Never use rounded pastel blobs, sausage-arm cartoon characters, marshmallow-soft UI buttons, or generic rubbery clay textures.
- **No Floating Generic Network Webs:** Never render random glowing spheres connected by thin glowing bezier lines floating in a void to represent "data," "AI," or "the internet."
- **No Disembodied Floating Icons:** Never place floating 2D app icons (Twitter birds, generic gear wheels, padlock icons) spinning aimlessly in 3D space.
- **No Rainbow Synthwave Gradients:** Avoid unmotivated purple-to-cyan gradient ramps, rainbow glowing edges, or arbitrary chromatic flares slapped on objects without a physical light source.

### 2.2 The "Cheap Stock Video" Blacklist
- **No Meaningless Sci-Fi HUD Jargon:** Never plaster decorative hex codes, random percent tickers, fake targeting crosshairs, or rotating radial grids over footage unless the script literally calls for an in-universe fighter-jet visor.
- **No Unmotivated Holograms:** Avoid translucent, flickering blue holograms when a grounded physical screen, tactile display, or real mechanical readout would be more immersive.
- **No "Void of Nowhere":** Never leave subjects floating in an empty infinite grey or black void without ground contact, contact shadows, or ambient environmental depth.

---

## 3. The 3 Laws of Scene Cohesion [RULE]

To ensure a scene feels premium and unified rather than an assortment of downloaded 3D assets:

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

### 3.3 Palette Discipline per Video
- While the brand has no universal color scheme, each video must define a tight **3-to-4 color gamut**:
  - **1 Dominant Base Value (60%):** Ground plane, chassis, room structure, dark negative space.
  - **1 Secondary Structural Tone (30%):** Midground props, typography halos, secondary mechanical bodies.
  - **1 High-Contrast Intentional Accent (10%):** Focal highlights, active status indicators, key phrase emphasis.
- Do not introduce arbitrary new accent hues halfway through a scene unless signifying a structural narrative alert.

#### Standard Viopls Engine Token Palette (`tokens.ts`)
For procedural engineering scenes, technical essays, and title sequences, use the default calibrated token set:

| Token | Hex | Role | Strict Usage Rule |
|---|---|---|---|
| `--void` | `#050506` | Deep Space / Background | Universal scene canvas; never use pure ungrounded `#000000`. |
| `--bone` | `#E8E4DA` | Primary Structure | All primary lines, solid meshes, kinetic text hero anchors. |
| `--ash` | `#6B6A66` | Secondary Context | Wireframe room edges, dimension guides, inactive states, 60% opacity labels. |
| `--signal` | `#FF2A1F` | Intentional Gap / Alert | **Strictly reserved**: severed connections, broken links, or critical thesis reveals. Never used for decorative filler. |

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
- **Always Bold & Heavy:** Use heavy, structural, high-impact font weights (Bold, Black, Heavy, Extra-Bold). Thin, hairline, or wispy typography is strictly forbidden because it breaks down during motion blur and video compression.
- **Clean Structural Typestyles:** Prefer bold geometric grotesques, robust industrial neo-grotesques, or clean technical monospace typefaces. Avoid delicate high-contrast serifs, decorative scripts, or novelty fonts.
- **Uppercase Dominance for Anchors:** Core thesis words, metrics, and section titles should be rendered in clean, tracked uppercase for maximum visual weight.

### 4.2 Diegetic World Integration
Per `video-design`, text must feel physically bound to the scene:
- **Depth Interaction:** Place text on a distinct spatial plane in 3D/2.5D space. Allow foreground objects or smoke to partially pass in front of it.
- **Light & Shadow Response:** Text geometry should cast subtle contact shadows onto surfaces behind it and catch the scene's rim lighting.
- **Surface Mounting:** Where possible, embed text onto surfaces (etched into metal plates, illuminated on terminal glass, stamped onto concrete blocks).

---

## 5. Visual Art Direction Audit Checklist

Before approving any visual asset, storyboard, or rendered frame:

- [ ] **Zero Slop:** Free of pastel claymorphism, corporate cartoon characters, disembodied floating icons, and decorative fake HUD clutter.
- [ ] **Unified Materiality:** All assets in the scene share believable roughness, texture resolution, and physical presence.
- [ ] **Motivated Lighting:** Light sources are clear, intentional, and cast consistent directional shadows with depth.
- [ ] **Palette Restraint:** Scene adheres to a disciplined 3-tone color budget (Base 60%, Secondary 30%, Accent 10%).
- [ ] **Bold Typography:** Text uses bold, structural font weights that remain instantly legible at a glance.
- [ ] **Integrated Placement:** Typography feels physically planted inside the 3D/2.5D world rather than stuck to the lens.
- [ ] **Video-Wide Cohesion:** The scene visually and tonally belongs in the exact same world as the preceding and following scenes.