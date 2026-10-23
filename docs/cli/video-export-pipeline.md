# Headless Video Export Pipeline & Hardware Acceleration

This document details the headless video rendering architecture in **f(x) Studio**, covering deterministic frame stepping, GPU hardware encoding, alpha channel export, and sub-frame adaptive supersampling.

---

## 1. High-Throughput Export Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VIDEO EXPORT DATAFLOW PIPELINE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Headless Chrome (Playwright)                                              │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  f(x) Studio WebGL + Canvas2D Compositor (?export=1)             │      │
│   │  • Deterministic frame-time locking: t = frame / fps             │      │
│   │  • Temporal sub-frame loop: k = 0 ... samples-1                  │      │
│   │  • HalfFloat Linear HDR Render Target                            │      │
│   │  • Post-processing optical pass                                  │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                │                                            │
│                                ▼ Raw RGBA Pixel Stream (WebSocket / Pipe)   │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  Bun Process Harness (scripts/render.ts)                         │      │
│   │  • Zero-copy memory buffer recycling                             │      │
│   │  • Async frame synchronization                                   │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                │                                            │
│                                ▼ Stdin Pipe (Rawvideo RGBA64 / RGBA)        │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  FFmpeg Child Process (Spawned via Bun.spawn)                    │      │
│   │  • AMD AMF Hardware Encoder (h264_amf / hevc_amf)                │      │
│   │  • NVIDIA NVENC / Apple VideoToolbox / CPU libx264               │      │
│   │  • Transparent Alpha (ProRes 4444 / WebM VP9)                    │      │
│   │  • AAC / MP3 Audio Muxing                                        │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                │                                            │
│                                ▼                                            │
│                       Final .mp4 / .mov                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Hardware-Accelerated Video Encoding (`--gpu`)

To offload CPU rendering pressure during heavy supersampling runs, the export harness supports GPU-accelerated video encoders:

### A. AMD AMF (`--gpu` / `--gpu-encoder h264_amf`)
Optimized for AMD Radeon graphics cards:
```bash
bun scripts/render.ts video --gpu --gpu-encoder h264_amf --crf 16 --out out/render.mp4
```
- Hardware codec: `h264_amf` (or `hevc_amf` for 10-bit HDR / smaller file sizes).
- Encoding speed: Up to $140\,\text{fps}$ at 1080p, freeing the CPU for Three.js scene evaluation.

### B. NVIDIA NVENC (`--gpu-encoder h264_nvenc`)
Optimized for NVIDIA GeForce / RTX hardware:
```bash
bun scripts/render.ts video --gpu --gpu-encoder h264_nvenc --crf 16 --out out/render.mp4
```

### C. CPU Fallback (`libx264`)
When `--gpu` is omitted, the pipeline falls back to software `libx264` with fine-tuned psychovisual tuning:
```bash
-c:v libx264 -preset slow -crf 16 -x264-params aq-mode=3:bframes=3:ref=4
```

---

## 3. Transparent Video Formats (Alpha Channel Support)

For compositing into downstream video editors (Adobe Premiere, After Effects, DaVinci Resolve) or web overlays, pass `--alpha`:

### A. Apple ProRes 4444 (`.mov`)
Broadcast-standard lossless alpha:
```bash
bun scripts/render.ts video --alpha --out out/transparent_overlay.mov
```
- Encoder: `prores_ks`
- Pixel format: `yuva444p10le`
- Profile: `4` (ProRes 4444)

### B. WebM VP9 Alpha (`.webm`)
Web-ready transparent video for Chrome, Edge, and Safari:
```bash
bun scripts/render.ts video --alpha --out out/transparent_web.webm
```
- Encoder: `libvpx-vp9`
- Pixel format: `yuva420p`

---

## 4. Sub-Frame Adaptive Supersampling (`--samples`)

f(x) Studio features an integrated temporal and spatial supersampling engine:

### Fixed Multi-Sampling (`--samples N`)
Averages $N$ sub-frames across the physical shutter angle:
```bash
bun scripts/render.ts video --samples 8 --shutter 0.5
```
- Eliminates geometric aliasing and produces physical motion blur.
- Shutter interval: $\Delta t = \frac{\text{shutter}}{\text{fps}}$.

### Adaptive Supersampling (`--samples auto`)
Dynamically adjusts sample counts per frame based on local screen-space velocity:
```bash
bun scripts/render.ts video --samples auto --min-samples 4 --max-samples 324 --tol 3
```
- Static or slow frames evaluate at $4$ spp.
- Violent camera whips, particle shatters, or high-speed crashes scale up to $324$ spp automatically.
- Prevents wasting render cycles on calm dialogue scenes while guaranteeing zero stepping on fast action.

---

## 5. Audio Muxing Pipeline

Unless `--noaudio` is passed, the video export pipeline automatically muxes audio tracks:
1. Locates the audio file specified in `project.json` or timeline config (e.g. `public/audio/soundtrack.mp3`).
2. Slices audio strictly from `--from` to `--to`.
3. Encodes with high-bitrate AAC ($320\,\text{kbps}$) or copies stream directly (`-c:a copy`), ensuring audio and video sync stays accurate to $< 1\,\text{ms}$.
