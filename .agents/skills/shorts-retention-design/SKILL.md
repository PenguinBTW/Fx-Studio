---
name: shorts-retention-design
description: Pacing standards, vertical 9:16 composition, platform UI safe zones, zero-second hook architecture, and retention mechanics for YouTube Shorts, TikTok, and Instagram Reels.
---
# Shorts Retention Design & Vertical Staging

Production standards, visual retention mechanics, vertical 9:16 composition rules, and rapid kinetic staging workflows for YouTube Shorts, TikTok, and Instagram Reels in Viopls video essays.

## When to Use

- Designing, blocking, or animating content specifically for vertical 9:16 mobile formats.
- Engineering the "Zero-Second Hook" (Frames 0–30) to minimize swipe-away drop-off.
- Calculating rapid-cadence cut budgets and micro-camera resets.
- Formatting 3D/2.5D staging to strictly avoid platform UI occlusion zones (captions, right-rail buttons, header bars).
- Authoring high-density kinetic typography with active word tracking.

---

## 1. Upstream & Sibling Dependencies

- **`video-design`:** Enforces baseline 9:16 safe-zone margins and zero HUD clutter.
- **`viopls-art-direction`:** Enforces bold structural typography, anti-slop standards, and cohesive materials.
- **`design-around-audio` / `sound-design-and-foley`:** Audio transients and tactile foley hits are hyper-accelerated in vertical formats.
- **`fx-scenes`:** Implementation target when authoring vertical scenes in f(x) Studio (`scale: 2`, vertical bounds $1080 \times 1920$).

---

## 2. The Vertical 9:16 Safe-Zone Grid [RULE]

Mobile video platforms render heavy UI elements directly over the viewport. Critical focal action, facial anchors, and 3D typography must exist strictly within the **Central 60% Content Core**:

```
[VERTICAL 9:16 PLATFORM OCCLUSION MAP (1080 x 1920)]
0px ───────────────────────────────────────────────────────── 0px
    │  TOP PLATFORM UI DANGER ZONE (Top 15% / ~288px)        │  <-- Search bar, Sound badge,
    │  [No text, logos, or primary focal elements]           │      Account pills
288px ─────────────────────────────────────────────────────── 288px
    │                                              │ ENGAGE  │
    │                                              │ DANGER  │
    │           SAFE CONTENT CORE                  │ ZONE    │
    │         (Central 60% / ~1152px)              │ (18% /  │  <-- Like, Comment,
    │                                              │ ~194px) │      Share, Remix,
    │   • Primary 3D subject action                │         │      Profile icon
    │   • Diegetic 3D keywords                     │ [KEEP   │
    │   • High-contrast focal anchors              │  CLEAR] │
    │                                              │         │
1440px ────────────────────────────────────────────────────── 1440px
    │  BOTTOM PLATFORM UI DANGER ZONE (Bottom 25% / ~480px)  │  <-- Channel handle,
    │  [No critical visuals or custom titles]                │      Auto-captions,
    │  Platform caption text renders here.                   │      Sound title, Scrubber
1920px ────────────────────────────────────────────────────── 1920px
```

### Safe-Zone Bounds
- **Top Clearance:** 288px margin from the top edge.
- **Bottom Clearance:** 480px margin from the bottom edge.
- **Right-Edge Margin:** 194px margin from the right edge.
- **Left-Edge Margin:** 60px margin from the left edge.
- **Rule:** Any title, diagram, or focal detail intersecting these margins is considered a critical defect (Rule `F05` equivalent).

---

## 3. The Retention Engine: Structural Pacing [RULE]

Vertical feeds operate under aggressive swipe mechanics. The viewer decides whether to stay or swipe within the first 400 milliseconds.

```
[RETENTION TIMELINE ARCHITECTURE]

0.0s                  1.2s                  3.5s                                End
 ┌─────────────────────┬─────────────────────┬────────────────────────────────────┐
 │  PHASE 1: THE HOOK  │ PHASE 2: COMPLICATION│     PHASE 3: ESCALATING PROOF      │
 │  Visual Impact +    │ Paradox revealed;   │ Rapid 1.5s–2.5s shot resets;       │
 │  Immediate Motion   │ Camera vector snaps │ Continuous kinetic acceleration    │
 └─────────────────────┴─────────────────────┴────────────────────────────────────┘
```

### 3.1 Phase 1: The Zero-Second Hook (Frames 0–30 / 0.0s–0.5s) [RULE]
- **Immediate State Transformation:** Frame 0 must open mid-motion (e.g., camera already in high-velocity forward dolly, light blooming, or an object in dynamic mechanical fracture).
- **Prohibited:** Fades from black, static establishing shots, title cards hanging in silence, or slow easing starts.
- **Vocal Alignment:** The opening spoken word must hit within **$\le 100\text{ ms}$** of Frame 0.

### 3.2 Phase 2: Rapid Re-framing & Micro-Resets [RULE]
- **The 2.5-Second Threshold:** The camera angle, subject perspective, or background depth must change or refresh every **1.5 to 2.5 seconds**.
- **Continuous Velocity Carry:** Every cut must preserve directional momentum (whip pans, zoom punch-ins, push-through wipes) to prevent visual stalls.
- **Scale Contrast:** Jump between extreme tight macro close-ups (e.g., 100mm lens on a burning chip trace) and punchy mid-shots.

### 3.3 Seamless Infinity Looping [GUIDANCE]
- Structure the final sentence of the script to syntactically and visually connect to the opening line.
- The exit camera vector of the final frame should match the entry vector of Frame 0, creating an addictive, seamless loop when the platform replays.

---

## 4. Vertical Cinematography & Spatial Depth

### 4.1 Vertical Compositional Stacking [RULE]
A 9:16 frame has high vertical headroom but narrow lateral width. Traditional horizontal wide framing fails here:
- **Vertical Tiering:** Stack elements vertically rather than side-by-side (e.g., Hero Subject placed at vertical center $Y = 960$, supporting context positioned slightly above, spatial anchor floor below).
- **Narrow Perspective Lenses:** Use slightly longer focal lengths ($50\text{mm}\dots 85\text{mm}$) to compress background planes and keep subjects filling the vertical frame without edge distortion.

### 4.2 Vertical Camera Kinematics
- Prioritize **Z-axis push-ins** (dolly moves directly toward or past the lens) and **Y-axis vertical pedestal climbs**.
- Broad horizontal X-axis pans leave lateral edges empty quickly. Keep motion vectors oriented along the vertical and depth axes.

---

## 5. Kinetic Typography for Shorts [RULE]

In vertical video, viewers read text faster than narration delivers it:

### 5.1 Word-by-Word / Short-Phrase Chunking
- **Never display full sentences at once.** Group text into **1 to 3 words maximum** per display interval.
- **Active Word Tracking:** Highlight, scale-pop, or illuminate the active word precisely as it is vocalized.

### 5.2 Central Grounding
- Anchor kinetic typography directly in the optical center or slightly above ($Y = 880\text{–}980$).
- Typography must utilize **Bold/Heavy** weights per `viopls-art-direction` with deep knockout understroke halos (`haloWidth: 8` for mobile) to guarantee readability on small smartphone screens against changing backgrounds.

---

## 6. Pre-Render Shorts Retention Checklist

Before exporting any 9:16 vertical render:

- [ ] **Frame 0 Impact:** Visuals begin in active motion on frame 0; no black frames or slow fade-ins.
- [ ] **Safe-Zone Clearance:** All text and critical focal subjects sit inside the Central 60% Core (clearing top 288px, bottom 480px, right 194px).
- [ ] **Shot Pacing:** Perspective or camera resets occur every 1.5s to 2.5s with continuous momentum.
- [ ] **Vertical Stacking:** Staging exploits the 9:16 vertical canvas through depth stacking rather than cramped lateral layouts.
- [ ] **Word Chunking:** On-screen text is limited to 1–3 bold words at a time with knockout halos.
- [ ] **Audio Snap:** Voiceover begins within 0.1s of video start; tactile foley reinforces every text reveal and cut.
- [ ] **Loop Continuity:** End frame momentum aligns smoothly with Frame 0 for infinite replay.