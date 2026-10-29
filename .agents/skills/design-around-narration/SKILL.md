---
name: design-around-narration
description: Standards and staging workflows for designing scenes around pre-production scripts prior to voiceover recording, focusing on elastic visual pacing, concept anchoring, and generating downstream narration cue guides.
---
# Design Around Narration

Production standards, visual staging workflows, and pacing principles for animating 3D/2.5D scenes around written scripts *before* narration is recorded. Ensures scenes organically flex to accommodate natural vocal delivery and outputs a clear cue guide for voice actors and post-production assembly.

## When to Use

- Storyboarding, animating, or staging scenes where the script is written but voiceover audio has not yet been recorded.
- Structuring scene lengths and camera trajectories around natural rhetorical beats rather than rigid stopwatch calculations.
- Designing elastic visual staging (camera orbits, environmental travel, ambient holds) that looks intentional whether vocal delivery is brisk or deliberate.
- Aligning key diegetic typography, 3D assets, and focal shifts to core narrative ideas.
- Generating the downstream **Narration Timestamp & Cue Guide** document (`narration_guide.md`).

---

## 1. Core Philosophy: The Elastic Stage

Narration is human, conversational, and emotionally driven. Voice actors naturally vary their tempo, stretch words for emphasis, and take unscripted pauses for dramatic effect.

Visuals must function as an **elastic stage**, not a rigid metronome:
- **Never design visuals so tightly that the voice actor is trapped.** If a visual cue requires a line to be blurted out in 1.8 seconds flat, the delivery will sound rushed and unnatural.
- **Visuals must be able to "breathe" without feeling frozen.** Background parallax, slow camera drift, volumetric light shifts, and secondary motion ensure a frame stays alive even during an extended pause.

---

## 2. Flexible Temporal Estimation [GUIDANCE]

Rather than applying rigid words-per-minute (WPM) formulas or hardcoded punctuation math, gauge pacing based on **rhetorical intent and thought units**:

### 2.1 Pacing by Narrative Intent
Read the script section aloud at a natural conversational tempo to gauge its approximate duration range:
- **Fast / High Energy (Hooks & Montages):** Quick setups, punchy ideas, and rapid visual cuts. Keep scene lengths compact and visual transitions agile.
- **Conversational (Core Explanation):** Balanced, unhurried communication. Give each clause room to be absorbed by the viewer.
- **Deliberate / Dramatic (Climaxes & Key Revelations):** Heavy emphasis, complex ideas, or dramatic pauses. Visuals need generous time buffers to let the gravity of the words sink in.

### 2.2 The "Accordion" Visual Technique [RULE]
Every scene generated before voiceover must be structured with flexible expansion zones:
- **Continuous Camera Vectors:** Design camera paths (e.g., slow dolly pushes, sweeping crane moves, orbital drift) that look natural across a wide duration range. A 5-second camera sweep can easily stretch or compress in post without looking broken.
- **Ambient Secondary Motion:** Keep the environment moving independently of character/object actions (e.g., floating dust motes, passing clouds, pulsing light, subtle idle mechanics). This allows the visual to linger on screen as long as needed without appearing paused.
- **Headroom & Tail Buffers:** 
  - Allow brief visual establishment before the opening word begins.
  - Allow the visual motion to glide smoothly past the final spoken word of the segment rather than cutting immediately on the last syllable.

---

## 3. Concept Anchoring & Visual Staging

### 3.1 Anchor to Ideas, Not Milliseconds [RULE]
- Do not attempt to sync visual animations to exact predicted word timestamps.
- Sync visual events to **conceptual milestones**:
  - **The Setup:** The camera establishes the space or subject while the narrator introduces the premise.
  - **The Reveal / Shift:** When the script introduces a turning point, key insight, or contrast, trigger the major visual shift (angle cut, lighting change, camera acceleration).
  - **The Payoff:** The visual environment reflects the conclusion or consequence while the speaker delivers the takeaway.

### 3.2 Integrated 3D Typography Staging [RULE]
Per `video-design` standards, on-screen text must exist diegetically within the 3D/2.5D world:
- Reserve integrated typography for **high-impact keywords, data points, or central theses**—never transcribe entire sentences verbatim.
- Introduce the visual formation of the text (e.g., extrusion, emergence, light sweep) slightly ahead of or alongside the estimated arrival of the spoken concept. 
- Ensure the text remains clearly legible and spatially grounded in the scene long enough for the viewer to read it comfortably, even if the spoken line is delivered quickly.

---

## 4. Downstream Deliverable: Narration Timing & Cue Guide [RULE]

Whenever a scene or visual sequence is generated ahead of voiceover recording, you must produce a structured companion document: **`narration_guide.md`**.

This document communicates the visual director's intent to the voice talent, audio engineer, and video editor, outlining where visual shifts occur and where delivery can breathe.

### 4.1 Guide Structure

Every `narration_guide.md` must follow this clear, production-friendly schema:

```markdown
# Narration Timing & Cue Guide

**Project:** [Video Title / Segment Name]  
**Overall Tone:** [e.g., Casual & analytical / Dramatic essay / Energetic hook]  
**Target Duration Window:** [e.g., ~15–20s total]  

---

## Scene Staging & Cue Breakdown

### Scene 1: The Initial Paradox (~00:00 – 00:07)
- **Script Line:** 
  > *"When the first transatlantic cable was laid in 1858, people thought global communication was finally solved."*
- **Visual Action:**
  - Starts on a stormy deep-sea wide shot.
  - Slow camera descent down toward the seabed.
- **Pacing & Delivery Notes:** 
  - Open calmly. Let the first word land after the camera begins descending (~0.5s in).
  - Emphasize **"finally solved"** with slight irony.

---

### Scene 2: The Failure & Contrast (~00:07 – 00:14)
- **Script Line:** 
  > *"It lasted three weeks. A few faint signals, and then... complete silence."*
- **Visual Action:**
  - Cut to a high-contrast close-up of a severed cable spark.
  - 3D text **"3 WEEKS"** forms embedded in the ocean silt.
  - Camera slows into an atmospheric, dark drift as sparks die down.
- **Pacing & Delivery Notes:**
  - Sharp, punchy delivery on *"It lasted three weeks."*
  - **Major Pause:** Leave a noticeable silence (1–2 seconds) around *"complete silence"*—the visuals have ample dark, ambient drift to let that stillness breathe.

---

## Editor & Voiceover Assembly Notes

- **Sync Priority:** The reveal of the severed cable is the primary visual anchor; ensure the delivery of *"three weeks"* coincides roughly with that cut.
- **Elastic Zones:** The trailing drift in Scene 2 is intentionally long. Do not rush the silence; the atmospheric background is designed to hold the weight of the pause before the next scene begins.
```

---

## 5. Pre-Production Script-to-Scene Checklist

Before rendering or finalizing visual layouts based on an unrecorded script:

- [ ] **Natural Read-Through:** Has the scene length been estimated by speaking the lines naturally rather than through rigid formulas?
- [ ] **Accordion Movement:** Does the camera use continuous, fluid vectors that look natural even if stretched or compressed in editing?
- [ ] **Ambient Liveliness:** Does the scene contain subtle secondary motion so pauses never feel like a frozen frame?
- [ ] **Concept Over Timestamp:** Are visual events anchored to narrative turning points rather than hyper-specific millisecond estimates?
- [ ] **Selective Typography:** Is 3D/2.5D text reserved for key concepts and given sufficient screen time to be read effortlessly?
- [ ] **Cue Guide Produced:** Has `narration_guide.md` been generated with script segments, visual action descriptions, and flexible delivery notes?