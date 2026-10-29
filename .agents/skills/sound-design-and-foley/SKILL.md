---
name: sound-design-and-foley
description: Technical workflows, frequency management, tactile micro-sync, and spatial audio standards for integrating sound effects (SFX), foley, risers, and impact hits alongside voiceover and music.
---
# Sound Design & Foley Integration

Standards, spectral budgeting principles, tactile micro-sync workflows, and spatial audio rules for scoring sound effects (SFX), mechanical foley, transitions, and environmental room tone in Viopls video essays.

## When to Use

- Selecting, placing, and mixing tactile sound effects (clicks, whooshes, mechanical latches, sub-drops).
- Syncing micro-transients and foley impacts to exact visual frames.
- Carving frequency space (EQ pocketing) to keep sound design from masking narration or music.
- Designing risers, build-ups, and audio transition sweeteners across scene cuts.
- Implementing spatial panning matching 2D/3D screen-space velocity vectors.
- Generating the downstream sound design cue sheet: **`sound_design_guide.md`**.

---

## 1. Upstream & Sibling Dependencies

- **`design-around-audio`:** Governs the soundtrack, stems, beat grids, and musical downbeats. SFX must complement, not clash with, musical stems.
- **`design-around-narration`:** Establishes the vocal track. Sound design must never compromise voiceover intelligibility.
- **`video-design` / `fx-transitions`:** Defines visual momentum, match cuts, and kinetic typography reveals that require tactile audio reinforcement.

---

## 2. Core Philosophy: Sound as Tactile Weight

Visual motion without sound feels weightless, detached, and synthetic. Sound effects are the **physical glue** that convinces the human brain that virtual pixels have mass, friction, and inertia:

- **Tactile Synchronization:** A visual impact without an instantaneous acoustic transient feels delayed and sloppy.
- **Motivated Foley:** Every mechanical rotation, glass fracture, or typographic snap must have a physical sound origin.
- **Restraint Over Noise:** SFX must punctuate key narrative turns, not clutter every idle frame. Silence and dynamic contrast create impact.

---

## 3. The 4 Functional SFX Categories [RULE]

Categorize and balance sound assets into four distinct layers:

```
[SOUND DESIGN LAYER STACK]

1. TACTILE FOLEY (Micro)  ===> 2. KINETIC WHOOSHES (Meso) ===> 3. STRUCTURAL IMPACTS (Macro) ===> 4. AMBIENCE (Bed)
   - Clicks, snaps, latches     - Air displacement, whips     - Sub-drops, heavy thuds       - Room tone, hums, air
   - Snaps to exact frame 0     - Bridges scene cuts          - Punctuate major reveals      - Continuous glue
```

### 3.1 Tactile Foley (Micro Layer)
- **Sound Types:** Relay clicks, shutter snaps, metallic mortise locks, keypress clacks, spark pops.
- **Visual Mapping:** Snapped to exact Frame 0 of typographic reveals, gauge needle locks, UI card popups, or component docking.
- **Characteristics:** Razor-sharp attack ($<5\text{ ms}$), short decay ($30\text{–}100\text{ ms}$), high-frequency crispness ($2\text{–}8\text{ kHz}$).

### 3.2 Kinetic Whooshes & Air Sweeps (Meso Layer)
- **Sound Types:** Low pneumatic air rushes, textured fabric whooshes, Doppler passes, high-speed tape whips.
- **Visual Mapping:** Accompanies camera pans, rapid dolly moves, orbital sweeps, and scene transition seams.
- **Characteristics:** Smooth envelope ramp matching camera velocity curves; peak intensity aligns with cut frame.

### 3.3 Structural Impacts & Sub-Drops (Macro Layer)
- **Sound Types:** Low-end cinematic booms, seismic bass drops, muted anvil strikes, electromagnetic pulses.
- **Visual Mapping:** Reserved strictly for major narrative chapter titles, thesis reveals, or transition downbeats.
- **Characteristics:** Deep low-end energy ($30\text{–}80\text{ Hz}$), long resonant tail ($1.0\text{–}3.0\text{s}$), high dynamic headroom.

### 3.4 Textural Ambience & Tone (Bed Layer)
- **Sound Types:** Low server room drone, deep-sea hydrostatic hum, HVAC tone, gentle tape hiss, wind across glass.
- **Visual Mapping:** Runs continuously underneath dialogue to prevent dead digital silence during narrative pauses.
- **Characteristics:** Flat dynamic profile, low volume ($-24\text{ dB}$ to $-30\text{ dB}$ relative to dialogue), unobtrusive spectrum.

---

## 4. Spectral Budgeting & Frequency Pocketing [RULE]

Sound effects must never compete with human speech or musical fundamentals. Carve dedicated frequency pockets using precise equalization:

```
[FREQUENCY SPECTRUM ALLOCATION]

  20 Hz       100 Hz            300 Hz               1 kHz             4 kHz        8 kHz      20 kHz
  ┌─────────────┬──────────────────┬───────────────────┬─────────────────┬────────────┬──────────┐
  │  SUB-BASS   │    BASS PUNCH    │   WARMTH / MUD    │  VOCAL CLARITY  │ TACTILE    │ AIR /    │
  │ (30-80 Hz)  │   (80-250 Hz)    │   (250-800 Hz)    │   (1.0-3.5 kHz) │ PRESENCE   │ GLINTS   │
  ├─────────────┼──────────────────┼───────────────────┼─────────────────┼────────────┼──────────┤
  │ Structural  │ Musical Kick /   │ Music Chords /    │ Narration &     │ Foley      │ Air Hiss │
  │ Sub-Drops   │ Basslines        │ Ambience Bed      │ Spoken Voice    │ Clicks     │ Cymbals  │
  └─────────────┴──────────────────┴───────────────────┴─────────────────┴────────────┴──────────┘
```

### 4.1 The Vocal Sanctuary Rule [RULE]
- The primary frequency band for human speech intelligibility is **$1.0\text{ kHz} \dots 3.5\text{ kHz}$**.
- **Mandatory EQ Cut:** Apply a dynamic notch or wide parametric bell cut ($-3\text{ dB}$ to $-6\text{ dB}$) in the $1\text{–}3.5\text{ kHz}$ band across all kinetic whooshes, synths, and heavy sound effects playing during spoken dialogue.
- Sound effects may only use the $1\text{–}3.5\text{ kHz}$ band during intentional vocal pauses or title cards.

### 4.2 Sub-Bass Decoupling
- Never stack a sound effect sub-drop on the exact same frame as a heavy 808 kick or bass drop from the musical soundtrack.
- If the music drops on Beat 1, let the musical stem supply the low-end energy. Do not double-trigger a sub-bass SFX, which causes phase cancellation and muddies the master limiter.

---

## 5. Spatial Panning & Vector Alignment [GUIDANCE]

Sound effects must respect screen-space camera motion and object travel:

### 5.1 Horizontal Vector Panning
- When a 3D object travels from screen-left to screen-right, pan the corresponding whoosh/foley across the stereo field from **$L40 \to R40$**.
- Avoid hard $100\%$ left/right pans on headphones; keep spatial panning within $70\%$ width to maintain natural listening comfort.

### 5.2 Distance & Low-Pass Filtering
- As an object retreats into the background ($+Z$ camera distance), roll off high frequencies with a gentle low-pass filter ($6\text{–}8\text{ kHz}$) and increase wet reverb mix ($15\text{–}25\%$).
- Close-up macro shots require dry, zero-reverb, unfiltered sound to emphasize proximity.

---

## 6. Downstream Deliverable: `sound_design_guide.md` [RULE]

When planning audio finishing ahead of final assembly, export a structured cue guide:

```markdown
# Sound Design & Foley Cue Guide

**Project:** [Video Title / Segment Name]  
**Primary Sonic Atmosphere:** [e.g., Heavy industrial pneumatic facility / Clean cybernetic laboratory]  
**Master Target Dialogue Level:** [-16 LUFS integrated / -1.0 dB true peak]  

---

## SFX Cue Breakdown Table

| Timestamp (EST) | Visual Trigger / Event | SFX Asset Description | Spectral Category | Pan / Spatial Position | Mix Level (Rel. to VO) |
|---|---|---|---|---|---|
| **00:00.60** | Vacuum tube ignites | High-voltage electric spark snap + faint glass ring | Micro Foley (4-8 kHz) | Center ($C$) | -8 dB |
| **00:02.35** | Camera whip-pan to low angle | Heavy pneumatic air whoosh (fast attack) | Meso Whoosh (200 Hz - 1 kHz) | Hard Sweep ($L30 \to R30$) | -6 dB (Ducks under VO) |
| **00:05.10** | Silicon wafer macro reveal | Sub-bass impact thud (60 Hz) + metallic latch | Macro Impact (<80 Hz + 3 kHz) | Center ($C$) | -4 dB (In vocal pause) |
| **00:00 - 00:08** | Entire scene duration | Low magnetic server room hum + distant air intake | Textural Ambience Bed | Wide Stereo ($100\%$ spread) | -26 dB |

---

## Mixing & Mastering Instructions

1. **Sidechain Ducking:** Sidechain the Ambience Bed to the voiceover track with a fast 5 ms attack and smooth 150 ms release, dipping background hum by -4 dB whenever speech is active.
2. **Transition Seam Sweetening:** At 00:02.35, align the peak of the pneumatic whoosh exactly on Frame 0 of the perspective cut to mask any residual audio seam glitch.
```

---

## 7. Pre-Production Sound Design Checklist

Before approving an edit or finalizing audio stems:

- [ ] **Frame-Accurate Alignment:** Tactile clicks and foley hits land precisely on Frame 0 of visual contacts or typography unmasking.
- [ ] **Vocal Protection:** Whooshes and loud impacts in the $1\text{–}3.5\text{ kHz}$ range are notched or placed in voice pauses.
- [ ] **No Sub Collision:** Sub-drops do not collide with heavy musical kick drums on the same downbeat.
- [ ] **Continuous Bed:** Ambient background tone is present under voiceover to prevent sterile digital silence.
- [ ] **Dynamic Contrast:** High-energy sequences are preceded by subtle audio thinning to make impacts hit harder.
- [ ] **Guide Exported:** `sound_design_guide.md` is populated with timestamps, spectral categories, and panning directions.