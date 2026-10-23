# Headless Render CLI Reference (`bun scripts/render.ts`)

The master offline rendering utility in **f(x) Studio** is invoked via `bun scripts/render.ts` (or the direct wrapper scripts in the root `scripts/` directory).

It controls a headless Playwright Chrome session in deterministic export mode (`?export=1`), driving frame evaluation, image analysis, visual diagnostics, and video encoding.

---

## 1. Prerequisites & Environment Setup

Before executing headless rendering or automated telemetry audits, verify the following dependencies:

1. **Playwright Chromium Browser**:
   The headless capture harness requires Chromium binaries downloaded by Playwright:
   ```bash
   cd app && bun x playwright install chromium
   ```
2. **FFmpeg in System PATH**:
   Video export (`scripts/render.ts video`) streams raw pixel buffers directly to `ffmpeg` via `Bun.spawn`. FFmpeg must be executable from your terminal:
   ```bash
   ffmpeg -version
   ```
   *For `--gpu` hardware offload, ensure your FFmpeg build includes `h264_amf` (AMD) or `h264_nvenc` (NVIDIA).*
3. **Python Audio Dependencies (Optional)**:
   Extracting beat grids and transient features via `scripts/analyze_song.py` requires:
   ```bash
   pip install numpy scipy librosa
   ```

---

## 2. Quick Command Summary

```bash
# Capture still frames at specific timestamps
bun scripts/render.ts stills --t 1.5,12.0,33.55 --out out/stills/

# Generate a multi-frame contact sheet
bun scripts/render.ts sheet --from 0 --to 30 --n 24 --cols 6 --out out/sheet.png

# Export high-fidelity video with audio & AMD AMF hardware encoding
bun scripts/render.ts video --from 0 --to 125 --fps 60 --gpu --samples 8 --out out/final.mp4

# Benchmark render turnaround and GPU memory
bun scripts/render.ts perf --from 10 --to 20 --samples 1

# Run 60fps motion telemetry and kinematic verification
bun scripts/render.ts motion --from 0 --to 30 --out out/telemetry/

# Generate visual diagnostic instruments
bun scripts/render.ts godview --scene demo --from 0 --to 20
bun scripts/render.ts onion --scene demo --t 12.0 --frames 12
bun scripts/render.ts stitch --from-scene act1 --to-scene act2 --t 18.81
bun scripts/render.ts compare --active-scene act2 --ref-scene benchmark
```

---

## 3. Global Flags (Supported Across All Modes)

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--project <name>` | string | Active pointer (`active.json`) | Target project directory in `app/src/scenes/` (e.g. `--project brand_campaign` or `--project product_reveal`). Overrides `active.json` without modifying disk. |
| `--scale <n>` | integer ($1 \dots 4$) | `1` | Render scale multiplier. `--scale 1` = $1920 \times 1080$; `--scale 2` = $3840 \times 2160$ (4K UHD). |
| `--samples <n\|auto>` | integer / `auto` | Mode dependent | Number of sub-frames averaged per output frame over the shutter window. Defaults to `1` for `motion`, `1` or `8` for `video`. `--samples auto` enables adaptive supersampling ($4 \dots 324$ spp). |
| `--shutter <ratio>` | float ($0.0 \dots 1.0$) | Mode dependent | Shutter angle fraction of frame duration. Defaults to `0` (sharp) for `motion`; `0.5` ($180^\circ$ cinema shutter) for `video` and `stills`. |
| `--only <ids>` | string | None | Comma-separated scene IDs to isolate. All other entries are skipped. |
| `--headed` | flag | `false` | Runs Chromium with a visible graphical window instead of headless mode (invaluable for interactive visual debugging). |
| `--audio <path>` | file path | Auto-detected | Explicit custom audio file path (overrides project manifest audio). |
| `--noaudio` | flag | `false` | Disables audio track multiplexing during video export. |
| `--lyrics <path>` | file path | Auto-detected | Explicit lyrics JSON path for typography alignment analysis. |
| `--palette <spec>` | string | Engine tokens | Overrides expected project palette tokens for chromatic compliance checks (e.g. `ink=#0A0A0B,bone=#EEE9DF,signal=#FF4D12`). |
| `--calibration <path>`| file path | Auto-detected | Benchmark calibration JSON file path for empirical kinematic threshold gating. |
| `--url <address>` | string | `http://localhost:5173` | Address of Vite server. If unreachable, the CLI automatically launches an ephemeral background instance. |

---

## 4. Subcommand Specifications

### 3.1 `stills` (High-Resolution Frame Capture)
Captures uncompressed PNG stills at specific timestamps or across a time range.

```bash
bun scripts/render.ts stills --t 1.5,23.0,40.2 [--out <dir>]
bun scripts/render.ts stills --from 10.0 --to 20.0 --step 0.5 [--out <dir>]
```

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--t <times>` | comma-separated floats | None | Specific timeline timestamps in seconds. |
| `--from <seconds>` | float | `0.0` | Start of range. |
| `--to <seconds>` | float | Scene end | End of range. |
| `--step <seconds>` | float | `1.0` | Sampling interval in seconds. |
| `--out <dir>` | path | `../out/stills` | Destination folder for saved PNGs. |

---

### 3.2 `sheet` (Multi-Frame Contact Sheet)
Assembles a tiled contact sheet grid across a temporal window, essential for visual overview audits.

```bash
bun scripts/render.ts sheet --from 0 --to 120 --n 24 --cols 6 --out out/overview_24.png
```

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--from <seconds>` | float | `0.0` | Start of time window. |
| `--to <seconds>` | float | Scene end | End of time window. |
| `--n <count>` | integer | `12` | Total number of frames to capture. |
| `--cols <count>` | integer | `4` | Number of columns in the composite grid. |
| `--cuts` | flag | `false` | When passed, samples frames exactly at detected scene cuts. |
| `--out <path>` | file path | `../out/sheet.png` | Destination image file. |

---

### 3.3 `video` (Offline Video Encoding)
Drives deterministic headless frame evaluation and pipes raw pixel buffers to FFmpeg via `Bun.spawn`.

```bash
bun scripts/render.ts video --from 0 --to 125 --fps 60 --crf 16 --gpu --out out/render.mp4
```

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--from <seconds>` | float | `0.0` | Start of video timeline. |
| `--to <seconds>` | float | Duration | End of video timeline. |
| `--fps <n>` | integer | `60` | Frame rate. |
| `--crf <n>` | integer | `16` | Constant Rate Factor (lower = higher quality; $14\text{–}18$ recommended). |
| `--gpu` | flag | `false` | Enables GPU hardware encoding (AMD AMF, NVENC). |
| `--gpu-encoder <enc>`| string | `h264_amf` | Specific GPU encoder (`h264_amf`, `hevc_amf`, `h264_nvenc`). |
| `--alpha` | flag | `false` | Exports transparent video (ProRes 4444 or WebM VP9). |
| `--noaudio` | flag | `false` | Suppresses audio track muxing. |
| `--out <path>` | file path | `../out/motion.mp4` | Destination video file. |

---

### 3.4 `perf` (Turnaround & Memory Profiling)
Measures per-frame render turnaround time, GPU synchronization latency, and memory stability.

```bash
bun scripts/render.ts perf --from 0 --to 10 --samples 1
```

*Outputs average ms per frame, 95th percentile turnaround, and memory deltas.*

---

### 3.5 `motion` (Visual Telemetry & Kinematics)
Runs the full 60fps telemetry suite, evaluating rules F01–F16 and generating `report.md`, `findings.json`, and timeseries plots.

```bash
bun scripts/render.ts motion --from 0 --to 30 --out out/motion_audit/
```

*See [Motion Telemetry Report Specification](../telemetry/report-spec.md) for full parameter and output details.*

---

### 3.6 Diagnostic Visual Instruments (`godview`, `onion`, `stitch`, `compare`)
- `godview`: Orthographic 3D camera flight blueprint.
- `onion`: Multi-exposure chromatic motion trail composite.
- `stitch`: Transition boundary false-color overlay & filmstrip.
- `compare`: 50/50 diagonal split-wipe benchmark anchor.

*See [Visual Diagnostics Overview](../diagnostics/overview.md) for full instrument specifications.*
