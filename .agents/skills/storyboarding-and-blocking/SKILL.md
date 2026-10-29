---
name: storyboarding-and-blocking
description: Standards and spatial workflows for translating scripts and visual plans into structured shot sequences, establishing 3D screen geography, camera shot scales, and visual continuity across scenes.
---
# Storyboarding & Blocking

Production standards, spatial geography rules, and shot sequencing frameworks for breaking down narrative scripts and visual plans into structured shot sequences across 3D and 2.5D scenes in Viopls video essays.

## When to Use

- Translating a narrative segment from `visual_plan.md` into an actionable sequence of camera shots.
- Establishing camera shot-scale progression (wide establishing $\to$ medium context $\to$ macro inspection).
- Maintaining screen direction, spatial axis, and eye-tracking continuity across scene cuts.
- Budgeting scene duration and shot count to prevent visual fatigue.
- Generating the mandatory shot-by-shot deliverable: **`storyboard.md`**.

---

## 1. Upstream & Sibling Dependencies

- **`visual-metaphors-and-abstraction`:** Establishes the physical world, tangible props, and core metaphor before blocking begins.
- **`design-around-narration`:** Provides estimated line runtimes, elastic buffers, and rhetorical cue points.
- **`video-design`:** Enforces continuous camera momentum, minimum stylized 2.5D depth, zero HUD clutter, and safe zones.
- **`fx-scenes` / `fx-transitions`:** The implementation targets for the blocked scenes and transition seams.

---

## 2. Core Blocking Principles

### 2.1 The Shot-Scale Rhythm Hierarchy [RULE]
Never cut between shots of identical camera distance or focal length. Every sequence must follow a deliberate focal progression:

```
[THE SHOT-SCALE PROGRESSION]

1. Establishing Wide (EWS/WS) ===> 2. Medium Context (MS) ===> 3. Macro / Detail (CU/ECU)
   - 24mm–35mm lens                  - 50mm lens                  - 85mm–135mm lens
   - Defines spatial bounds          - Interlocking mechanics     - Tactile texture / sparks
   - High negative space             - Core subject action        - Zero background clutter
```

- **Establishing Wide (EWS / WS):** 24mm–35mm lens. Establishes the physical environment, boundary scale, and lighting mood. Viewer absorbs spatial layout.
- **Medium Context (MS):** 50mm lens. Frames the operational interaction between components or subjects.
- **Close-Up / Macro (CU / ECU):** 85mm–135mm lens. Focuses viewer attention on the exact mechanical turning point, needle deflection, or typographic thesis.

### 2.2 The 180° Axis of Action in 3D Space [RULE]
In a free 3D virtual viewport, crossing the axis of action disorients the viewer:
- Draw an imaginary vector line along the primary motion or gaze direction of the subject.
- Keep the camera on one side of this axis across consecutive cuts unless an explicit transitional camera orbit crosses the line on-camera.
- If Subject A travels left-to-right in Shot 1, it must travel left-to-right in Shot 2. Reversing screen travel across a cut is strictly prohibited without an intermediate neutral head-on shot.

```
[PROHIBITED: Axis Jump / Vector Inversion]
Shot 1: Subject moves ---> (Camera North)
Shot 2: Subject moves <--- (Camera South)  <-- Viewer perceives collision/reversal

[MANDATORY: Preserved Vector Axis]
Shot 1: Subject moves ---> (Camera North-West)
Shot 2: Subject moves ---> (Camera North-East, same side of vector axis)
```

### 2.3 Saccadic Gaze Anchoring (Eye-Tracking Continuity) [RULE]
Do not force the viewer's eyes to scan across the screen to locate the subject after a cut:
- Identify the **Focal Exit Point** $[X, Y]$ where the viewer's eye rests during the final 0.5s of Shot A.
- Place the **Focal Entry Point** of Shot B within a **$\le 15\%$ screen-distance radius** of the exit point.
- If the viewer looks at screen center ($960, 540$) at the end of Shot A, Shot B's critical element must land at screen center, not tucked into an extreme corner.

---

## 3. Shot Budgeting & Pacing Rules

### 3.1 Shot Duration Limits [RULE]
- **Minimum Shot Duration:** 1.5 seconds. Any cut faster than 1.5s destroys spatial comprehension in a video essay, unless executing a deliberate montage sequence.
- **Maximum Static Shot Duration:** 6.0 seconds. If a shot remains in the same framing for $>6.0\text{s}$, it must either execute an internal camera pivot/dolly or cut to an alternate perspective.
- **Continuous Momentum:** Per `video-design`, static hold-frames are forbidden; the camera must drift, dolly, or orbit smoothly throughout the entire duration.

---

## 4. Mandatory Deliverable: `storyboard.md` [RULE]

Before writing scene code, convert the visual plan into a structured markdown storyboard:

```markdown
# Sequence Storyboard: [Chapter / Segment Title]

**Target Duration:** [e.g., 18.0s total across 3 shots]  
**Core Metaphor System:** [e.g., Pneumatic sorting tube system]  
**Primary Motion Axis:** [e.g., Left-to-right flow along X-axis]  

---

## Shot Sequence Breakdown

### Shot 1: The Pressurized Intake
- **Duration / Window:** 00:00.00 – 00:05.50 (~5.5s)
- **Shot Scale & Lens:** Establishing Wide (WS) | 28mm | Low elevation
- **Camera Vector:** Slow forward dolly ($+Z$) descending toward main valve
- **Framing & Action:** Central pneumatic chamber fills with pressurized coolant; pressure gauge climbs
- **Focal Exit Point:** Screen Center ($960, 520$) on glowing intake valve
- **Script Cue:** *"When thousands of requests hit the system simultaneously..."*

---

### Shot 2: The Fracture Point
- **Duration / Window:** 00:05.50 – 00:10.50 (~5.0s)
- **Shot Scale & Lens:** Close-Up Macro (CU) | 85mm | Shallow DOF
- **Camera Vector:** Fast rightward tracking pan matching high-velocity fluid flow
- **Framing & Action:** Intake valve seals slam shut; micro-fractures propagate along glass wall
- **Focal Entry Point:** Screen Center ($950, 510$) — perfectly anchors from Shot 1 exit
- **Focal Exit Point:** Upper-Right ($1200, 420$) on expanding crack tip
- **Script Cue:** *"...the pipeline doesn't just slow down. It begins to crack."*

---

### Shot 3: The Systemic Reroute
- **Duration / Window:** 00:10.50 – 00:16.00 (~5.5s)
- **Shot Scale & Lens:** Medium Context (MS) | 50mm | Isometric-leaning angle
- **Camera Vector:** Upward crane pedestal lift while rolling forward
- **Framing & Action:** Bypass diverter drops into place; secondary copper conduits light up
- **Focal Entry Point:** Upper-Right ($1180, 440$) — matches Shot 2 crack tip
- **Focal Exit Point:** Center-Left ($700, 540$)
- **Script Cue:** *"The solution wasn't adding more pressure. It was rerouting the flow."*

---

## Seam & Continuity Notes
- **Transition 1 $\to$ 2:** Whip-pan match cut along $+X$ vector into macro valve detail.
- **Transition 2 $\to$ 3:** High-exposure spark flash on crack expansion acts as light-wipe into the bypass chamber.
```

---

## 5. Pre-Production Storyboard Checklist

Before approving a storyboard sequence for scene authoring:

- [ ] **Shot Scale Variety:** Consecutive shots alternate between wide, medium, and close-up focal lengths.
- [ ] **Vector Consistency:** Movement direction along the 180° axis is preserved across cuts (no directional flips).
- [ ] **Gaze Anchoring:** The entry point of each cut falls within 15% screen distance of the prior shot's exit point.
- [ ] **Duration Budget:** Every shot is between 1.5s and 6.0s with continuous camera momentum.
- [ ] **Deliverable Exported:** `storyboard.md` is populated with lens specs, camera vectors, focal points, and script cues.