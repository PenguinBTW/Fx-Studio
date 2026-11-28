---
name: video-assembly-and-finishing
description: Multi-scene timeline assembly in project.json, headless video rendering, multi-track audio multiplexing (narration, music, foley guide) via FFmpeg, master optical grading, and multi-format delivery in f(x) Studio.
---
# f(x) Studio: Video Assembly, Audio Multiplexing & Master Delivery

Production standards, timeline manifest engineering, FFmpeg audio multiplexing pipelines, master optical finishing passes, and multi-format export protocols for assembling individual scenes into broadcast-ready video masters in **f(x) Studio**.

## When to Use

- Assembling multiple scene files into a continuous narrative timeline via `project.json`.
- Running headless offline 60 fps video rendering via `scripts/render.ts video`.
- Multiplexing master video frames with voiceover tracks, music soundtracks, and foley sound effects using FFmpeg.
- Exporting YouTube Long-Form 4K masters (16:9 ProRes 422 HQ / H.264).
- Exporting vertical mobile masters (9:16 YouTube Shorts / TikTok).
- Generating transparent alpha WebM video clips for web UI embeds.

---

## 1. Upstream & Sibling Dependencies

- **`fx-scenes` & `fx-transitions`**: Author the individual visual scenes and transition seams that populate the timeline.
- **`fx-diagnostics` & `fx-telemetry-remediation`**: Verify that all scenes pass telemetry audits with zero blocking Tier A flags before final assembly.
- **`sound-design-and-foley`**: Provides the structural cue sheet (`sound_design_guide.md`) for SFX placement.
- **`design-around-narration`**: Provides line timestamps and breathing zones (`narration_guide.md`).
- **`fx-audio`**: Authors declarative mix manifests (`defineMix`), executes native multi-stem NLE mixdowns (`app/scripts/mixdown.ts`), and applies EBU R128 broadcast mastering.

---

## 2. Project Timeline Manifest Architecture (`project.json`) [RULE]

The master timeline is declaratively defined in `app/src/scenes/<project>/project.json`:

```json
{
  "name": "child_lock",
  "version": "1.0.0",
  "meta": {
    "title": "Your Body Has a Permanent Child Lock",
    "aspectRatio": "16:9",
    "fps": 60,
    "duration": 58.0
  },
  "audio": {
    "soundtrack": "audio/soundtrack.mp3",
    "voiceover": "audio/narration_final.wav",
    "bpm": 105.0
  },
  "scenes": [
    { "id": "beat0_switch", "file": "beat0_switch.ts", "start": 0.0, "end": 8.0 },
    { "id": "beat1_handle", "file": "beat1_handle.ts", "start": 7.5, "end": 20.0 },
    { "id": "beat2_diagram", "file": "beat2_diagram.ts", "start": 19.5, "end": 30.0 },
    { "id": "beat3_fractal", "file": "beat3_fractal.ts", "start": 29.5, "end": 58.0 }
  ],
  "transitions": [
    { "from": "beat0_switch", "to": "beat1_handle", "type": "push_through", "at": 7.75, "duration": 0.5 },
    { "from": "beat1_handle", "to": "beat2_diagram", "type": "dissolve_diagram", "at": 19.75, "duration": 0.5 },
    { "from": "beat2_diagram", "to": "beat3_fractal", "type": "scale_fold", "at": 29.75, "duration": 0.5 }
  ]
}
```

- **Temporal Seam Overlap:** Outgoing and incoming scenes must overlap during the entire transition window $[t_{\text{at}} - \text{dur}/2, t_{\text{at}} + \text{dur}/2]$.
- **Active Project Pointer:** Set the active project in `app/src/scenes/active.json`:
  ```json
  { "active": "child_lock" }
  ```

---

## 3. Headless Offline Video Rendering (`scripts/render.ts`)

Export video frames through GPU-accelerated headless Chromium via Playwright:

```bash
# Production Master Render (60 fps, 8 spp adaptive sub-frame motion blur, GPU acceleration)
bun scripts/render.ts video \
  --project child_lock \
  --from 0.0 \
  --to 58.0 \
  --fps 60 \
  --scale 2 \
  --samples 8 \
  --gpu \
  --out out/renders/child_lock_video.mp4
```

```bash
# Standalone Master Audio Render (resolves downbeats & mixdown without rendering video frames)
bun scripts/render.ts audio \
  --project child_lock \
  --mix mix.json \
  --from 0.0 \
  --to 58.0 \
  --out out/renders/child_lock_audio.wav \
  --mp3
```

### Critical CLI Flags:
- `--scale 2`: Renders at native **4K UHD ($3840 \times 2160$)** from canonical $1920 \times 1080$ coordinates.
- `--samples 8`: Evaluates 8 sub-frame samples per frame with adaptive ternary supersampling, producing true cinematic optical motion blur.
- `--gpu`: Enforces hardware GPU rendering (`--use-angle=vulkan` on Windows) to prevent CPU SwiftShader slowdowns.
- `--url http://localhost:53xx`: Binds to an isolated port to avoid conflicts with active interactive development servers.

---

## 4. Multi-Track Audio Multiplexing & Unified Pipeline [v0.8.0] [RULE]

In f(x) Studio v0.8.0, audio is mixed down in Pass 3 directly via pure Bun/TypeScript Float32 PCM (`mixdown.ts`), handling multi-stem NLE assembly, 3D object spatialization from `events.jsonl`, split-band ducking, vocal sanctuary notch filtering, and EBU R128 loudness normalization.

```
[UNIFIED AUDIOVISUAL PRODUCTION PIPELINE]

  Pass 1: Acoustic Analysis (scripts/analyze_song.py --audit) -> data/audio.json
  Pass 2: WebGL Scene Execution -> Rendered Video Frames + out/events.jsonl
  Pass 3: Pure Float32 PCM Mixdown (app/scripts/mixdown.ts) -> out/master.wav
          │
          └───► Final Lossless FFmpeg Multiplex
                    │
                    ▼
          Broadcast Master MP4 / ProRes (Stereo 48 kHz 24-bit AAC / LPCM)
```

### Step 1: Render Master Audio via mixdown
```bash
bun scripts/render.ts audio \
  --project child_lock \
  --mix scenes/child_lock/audio/mix.ts \
  --events out/events.jsonl \
  --from 0.0 --to 58.0 \
  --out out/master.wav --mp3
```

### Step 2: Lossless Multiplex
```bash
ffmpeg -y \
  -i out/renders/child_lock_video.mp4 \
  -i out/master.wav \
  -c:v copy \
  -c:a aac -b:a 320k -ar 48000 \
  out/delivery/child_lock_master.mp4
```

---

## 5. Master Delivery Formats & Presets

### Preset 1: YouTube Long-Form Master (16:9 4K Widescreen)
- **Container:** `.mp4` (H.264 High Profile / Level 5.2) or `.mov` (Apple ProRes 422 HQ).
- **Resolution:** $3840 \times 2160$ (4K UHD) or $1920 \times 1080$ (Full HD).
- **Framerate:** Strictly 60.0 fps constant frame rate (CFR).
- **Color Space:** Rec.709 with linear HalfFloat optical post (7-mip bloom, halation, grain).
- **Audio:** 48 kHz / 24-bit Stereo AAC @ 320 kbps (Integrated -16 LUFS).

### Preset 2: YouTube Shorts / TikTok Master (9:16 Vertical)
- **Container:** `.mp4` (H.264).
- **Resolution:** $1080 \times 1920$ (Portrait).
- **Safe Zone Rule:** Core visuals and typography restricted to central 60% vertical core (top 288px, bottom 480px, right 194px clear).
- **Duration:** Strictly $\le 60.0$ seconds.
- **Audio:** Integrated -14 LUFS (slightly louder for mobile playback).

### Preset 3: Transparent Web Overlay (WebM with Alpha)
When exporting animations for web application embeds:
```bash
bun scripts/render.ts video \
  --project ui_modal \
  --alpha \
  --format webm \
  --out out/delivery/ui_modal.webm
```
- Encodes via VP9 with transparent background (`alpha: true`), preserving drop shadows and emissive edge glows.

---

## 6. Pre-Flight Delivery Checklist

Before distributing or publishing any master video file:

- [ ] **Timeline Verified:** `project.json` contains contiguous, non-gapping scene intervals.
- [ ] **Telemetry Clean:** Verified 0 blocking Tier A flags via `bun scripts/render.ts motion`.
- [ ] **Audio Synchronized:** Voiceover, soundtrack, and SFX transients align to video frames with zero drift.
- [ ] **Dialogue Intelligibility:** Spoken voiceover is clearly audible (-16 LUFS) with background music ducked.
- [ ] **Safe Boundaries:** Titles and critical focal subjects sit safely inside target aspect ratio safe zones.
- [ ] **No Blackout Drops:** Seamless transition seams verified with zero 1-frame blackout glitches.
