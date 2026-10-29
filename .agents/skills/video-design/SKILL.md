---
name: video-design
description: Standards for video production, 3D/2D animation, motion design, and visual effects for Viopls video essays. Use when editing, storyboarding, or designing scene visuals and post-production assets.
---
# Video Design

Production standards, spatial design rules, and visual guidelines for 3D/2.5D animation, motion graphics, cinematography, and post-production across Viopls video essays.

## When to Use

- Storyboarding, planning, visual scripting, or editing scenes for Viopls video essays.
- Directing camera movement, shot perspective, scene transitions, and pacing.
- Implementing typography, 3D/2.5D assets, and spatial visual effects.
- Formatting scenes for aspect ratio constraints (16:9 Long-Form vs. 9:16 Shorts Safe Zones).
- Auditing visual assets against Viopls production rules.

---

## 1. Governance: Rules vs. Guidance

Every standard in this document and related modules strictly adheres to this classification:

- **[RULE] Mandatory:** Non-negotiable technical or artistic constraints. Follow exactly unless a user prompt explicitly overrides them.
- **[GUIDANCE] Advisory:** Recommended techniques, aesthetic best practices, and workflow advice to inform creative execution.

---

## 2. Core Visual & Spatial Standards

### 2.1 Zero HUD & Interface Clutter [RULE]
- Never display debug overlays, render statistics, camera labels, frame counters, grid markers, or unintentional HUD elements.
- Scenes must remain clean, cinematic, and immersion-focused.
- Diegetic UI (in-universe fictional interfaces, computer screens, holographic displays) is permitted only when explicitly mandated by the script.

### 2.2 Diegetic & World-Integrated Typography [RULE]
- Never paste flat, detached 2D overlay text across a scene.
- All typography must be physically embedded in the scene's spatial world:
  - **In 3D Environments:** Text must be 3D geometry interacting directly with scene lighting, casting/receiving shadows, respecting ambient occlusion, and adhering to focal depth-of-field.
  - **In 2.5D Environments:** Text must exist on a distinct spatial card with parallax, motion blur, depth-of-field defocus, and environmental occlusions.

```
[PROHIBITED: Detached 2D Layering]
+------------------------------------------+
|   [[ STATIC 2D TEXT STUCK TO LENS ]]     |
|   Background 3D/2.5D Scene Movement      |
+------------------------------------------+

[MANDATORY: Integrated World-Space Typography]
+------------------------------------------+
|         _  _ ___ ___                     |
|       / / / / _ \ _ \   <-- Interacts    |
|      / /_/ / // /   /       with lights, |
|     +-----/____/_/\_\       shadows &    |
|    / Scene Geometry         depth blur   |
+------------------------------------------+
```

### 2.3 Dimensionality: Stylized 2.5D Minimum [RULE]
- Pure, flat 2D animation is strictly prohibited unless explicitly requested in the prompt.
- The minimum visual fidelity standard is **Stylized 2.5D**:
  - Distinct separation into foreground, midground, and background planes.
  - Multi-plane depth parallax responding to camera movement.
  - Volumetric lighting, depth haze, and depth-of-field blur.
  - Projected 2D textures onto 3D card geometry or fully modeled 3D assets.

---

## 3. Cinematography, Perspective & Transitions

### 3.1 Continuous Camera Momentum [RULE]
- Static, locked-off camera shots are strictly forbidden in animation sequences.
- The camera must continuously move and adapt to spoken words and audio energy:
  - **Acceleration:** Accelerate speed/dolly moves during narrative build-ups, key reveals, or high-energy delivery.
  - **Deceleration:** Transition into slow, atmospheric cinematic drifts during reflective narration or musical pauses.
  - **Easing:** Always use smooth ease-in / ease-out curve interpolation; never use abrupt, linear starts or dead stops.

### 3.2 Dynamic Perspective & Angle Variation [RULE]
- Never reuse the same camera angle, focal length, or framing across consecutive shots.
- Keep the audience visually engaged through deliberate contrast:
  - Alternate between wide establishing shots, low-angle hero perspectives, Dutch angles, top-down overviews, and macro close-ups.
  - Vary camera elevation and field-of-view (FOV) across shot changes.

### 3.3 Seamless Motion & Vector Transitions [RULE]
- Abrupt, jarring cuts that disrupt visual momentum are prohibited.
- Every scene cut must feel distinct yet seamlessly blended:
  - **Match Moving / Vector Continuity:** Match the exit velocity vector of Scene A with the entry velocity vector of Scene B.
  - **Occlusion / Foreground Wipes:** Use foreground objects passing close to the lens to reveal the next environment.
  - **Whip Pans & Zooms:** Hide cut points inside controlled motion blur transitions.

```
Scene A (Rightward Camera Pan & Velocity)
  ===> [Foreground Edge / Whip Motion Blur] ===>
Scene B (Inherits Rightward Momentum into New Angle)
```

---

## 4. Aspect Ratios & UI Safe Zones [RULE]

Viopls videos are produced for two primary formats. Scene staging and typography must strictly respect their respective UI boundaries:

```
[16:9 Long-Form Standard]                 [9:16 Shorts / Vertical Standard]
+----------------------------------+     +-------------------------------+
|  Top Action Safe (5% margin)     |     | [Top UI / Search Safe Area]   | 15% Top Margin
|                                  |     |-------------------------------|
|        CENTRAL ACTION            |     |                               |
|        & 3D TYPOGRAPHY           |     |        SAFE CONTENT ZONE      |
|                                  |     |   (Key visuals, focal action, |
|  Bottom Safe (5% margin)         |     |    diegetic 3D typography)    |
+----------------------------------+     |                               |
                                         |-------------------------------|
                                         | [Title/Captions] | [Engage UI]| 20% Bottom & Right
                                         +-------------------------------+ Margin
```

### 4.1 Long-Form (16:9 Landscape)
- Keep all focal action, key objects, and 3D text within standard 90% title-safe / action-safe margins.
- Optimize composition for high-resolution widescreen cinematic depth.

### 4.2 Shorts & Vertical (9:16 Portrait)
- **Top Clearance (15%):** Avoid placing focal points or text in the top 15% (reserved for platform headers and search overlays).
- **Right Edge Margin (18%):** Keep text and critical details away from the right edge (reserved for like, comment, share, and audio icons).
- **Bottom Clearance (20%):** Keep the bottom 20% clear of core visual elements (reserved for channel handles, video titles, and default platform captions).
- **Center Concentration:** Anchor main subjects and diegetic typography inside the central 60% vertical safe box.

---

## 5. Audio & Narration Synchronization

### 5.1 Local Audio Analysis & Beat Alignment [RULE]
- When background music is provided, inspect and analyze the audio locally before cutting or blocking:
  - Detect downbeats, kick transients, drops, and rhythmic builds.
  - Snap scene transitions, kinetic camera pivots, and key visual accents to musical downbeats.
  - Cross-reference with the `design-around-audio` skill for dedicated audio mapping procedures.

### 5.2 Narration Pacing & Scene Breathing [RULE]
- When voiceover or script lines accompany a scene:
  - Visual pacing must adapt to voice cadence and delivery tempo.
  - When narration slows down or pauses, decelerate the camera and animation into an atmospheric drift, giving breathing room to the narrator and the score.
  - Never leave a frame lifeless during pauses—maintain subtle spatial drift and secondary motion.
  - Cross-reference with the `design-around-narration` skill for script-to-visual staging.

---

## 6. Software & Ecosystem Integration

### 6.1 f(x) Studio Ecosystem [RULE]
- When creating scenes inside or for f(x) Studio:
  - Review and adhere to all available skills prefixed with `fx-` (e.g., `fx-skill-name`).
  - Follow f(x) Studio requirements for node hierarchy, shading networks, and render output.

---

## 7. Planning [RULE]

### 7.1 planning rules
Before actually designing anything you must create a .md plan on the scene / scenes you are going to create, how you will transition between the next one, how it links into the script / music and allows everything to fit. And then analysis this plan to ensure it is would actually produce a result that would impress viewers and help the video feel truly engaging


## 8. Pre-Production Verification Checklist

Before finalizing any storyboard, visual layout, camera track, or prompt, confirm:

- [ ] **No UI/HUD Clutter:** Frame is clear of debug text, render stats, or accidental overlays.
- [ ] **World-Space Text:** All text is modeled/placed in 3D/2.5D with light, shadow, and depth integration.
- [ ] **Continuous Camera:** Camera is constantly in dynamic, eased motion matching narrative energy.
- [ ] **Perspective Variety:** Shot angles and focal lengths contrast distinctly with adjacent shots.
- [ ] **Motion Continuity:** Cut points preserve vector momentum, match motion, or use clean wipe occlusions.
- [ ] **Dimensionality:** Visuals satisfy stylized 2.5D minimum (multi-plane parallax, volumetric lighting).
- [ ] **Aspect Ratio Safe:** Staging conforms to 16:9 title margins or 9:16 Shorts UI occlusion zones.
- [ ] **Pacing Sync:** Beats snap to audio transients; quiet moments allow atmospheric camera breathing.
- [ ] **Skill Cross-References:** Consulted `design-around-audio`, `design-around-narration`, or `fx-*` as applicable.

