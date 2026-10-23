# 60fps Motion Telemetry Engine Architecture

The **f(x) Studio Motion Telemetry Engine** provides deterministic, model-inspectable visual telemetry and automated kinematic profiling across WebGL and Canvas2D motion design productions.

By instrumenting the rendering pipeline directly rather than treating the browser as a black box, the telemetry engine enables automated agents and human technical directors to profile motion craft at sub-pixel, per-frame fidelity.

---

## 1. Core Architecture & Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TELEMETRY DATAFLOW PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Headless Chrome Session (Playwright)                                      │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  f(x) Studio WebGL + Canvas2D Runtime                            │      │
│   │                                                                  │      │
│   │  [ Hook 1: Frame Step Hook ]  ──► Deterministic dt (1/60s step)  │      │
│   │  [ Hook 2: Camera Telemetry]  ──► Position, target, FOV, speed   │      │
│   │  [ Hook 3: Text Interceptor]  ──► 2D bounding boxes, font, alpha │      │
│   │  [ Hook 4: Audio / Event   ]  ──► Downbeats, kicks, lyric cues   │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                │                                            │
│                                ▼ Canvas Readback (1920x1080)                │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  4x4 Box Downscaling Pipeline (Fast CPU/SIMD)                    │      │
│   │  Downscales to 480x270 for real-time 60fps throughput            │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                │                                            │
│                                ▼                                            │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  Pixel Metrics & Kinematic Analyzer                              │      │
│   │  • Rec.709 Luma & Contrast       • Sobel Edge Density            │      │
│   │  • 2D FFT Phase Optical Flow     • CIE Lab ΔE76 Palette Distance │      │
│   │  • Motion Energy E & Ep95        • Edge Shimmer Index            │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                │                                            │
│                                ▼                                            │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │  Rule Evaluator (F01–F16) & Artifact Synthesizer                 │      │
│   │  • findings.json                 • frames.csv & text.csv         │      │
│   │  • report.md                     • timeline.png & slitscan.png   │      │
│   └──────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The Four In-Engine Telemetry Hooks

The telemetry harness injects four discrete measurement probes directly into the client page context:

1. **Frame Step & Time Lock Hook (`window.__telemetry.step(t)`)**:
   Forces the internal animation clock to evaluate strictly at timestamp $t$ with sub-millisecond precision, bypassing standard `requestAnimationFrame` timing jitter.
2. **Camera State Probe (`window.__telemetry.camera`)**:
   Captures the current 3D camera vector $\mathbf{p}(t) = (x, y, z)$, gaze target vector $\mathbf{g}(t) = (x_t, y_t, z_t)$, field of view $\theta_{\text{fov}}$, and linear velocity $\mathbf{v}(t) = \frac{d\mathbf{p}}{dt}$.
3. **Canvas2D Text Interception Probe**:
   Monitors Canvas2D `fillText` and `strokeText` calls to intercept rendered typographic elements, bounding boxes $[x_{\min}, y_{\min}, x_{\max}, y_{\max}]$, font metrics, and opacity.
4. **Audio & Transient Event Bus (`window.__telemetry.events`)**:
   Streams synchronized musical stems, downbeats, kick drum onsets, and lyric alignment boundaries from `lyrics.json` or audio transient analysis.

---

## 3. Real-Time 4x4 Box Downscaling Pipeline

Analyzing 1080p ($1920 \times 1080$) raw pixel buffers at 60 fps requires processing $124.4\,\text{million}$ bytes per second, which would bottleneck test execution.

To achieve sub-6-second profiling turnaround, the engine applies an optimized **4x4 box downsampling pass** that reduces frames to **$480 \times 270$** ($0.518\,\text{MB}$ per frame). Box averaging acts as an ideal antialiasing low-pass filter:
$$P_{480 \times 270}(x, y) = \frac{1}{16} \sum_{u=0}^{3} \sum_{v=0}^{3} P_{1920 \times 1080}(4x + u, 4y + v)$$

This preserves overall luma, motion energy, and color gamut distribution with $< 0.1\%$ divergence while enabling $> 120\,\text{fps}$ CPU analysis throughput in Bun.

---

## 4. Mathematical Formulation of Pixel Metrics

### A. Rec.709 Luma & Global Contrast
Luma is computed per pixel using the ITU-R BT.709 standard:
$$Y = 0.2126 R + 0.7152 G + 0.0722 B$$
Global frame contrast is evaluated as the standard deviation of pixel luma across the frame:
$$\sigma_Y = \sqrt{\frac{1}{N} \sum_{i=1}^N (Y_i - \bar{Y})^2}$$

### B. Motion Energy $E$ and $E_{p95}$
Motion energy represents absolute frame-to-frame pixel differences across successive 60 fps frames:
$$E(t) = \frac{1}{N} \sum_{i=1}^N |Y_t(i) - Y_{t - \Delta t}(i)|$$
$E_{p95}$ measures the 95th percentile of local patch energy, highlighting localized explosive bursts (e.g. particle shatters or match-cut kicks) even when full-frame average energy is small.

### C. 2D FFT Phase-Correlation Optical Flow $(u, v)$
To calculate bulk directional velocity vectors without heavy iterative Horn-Schunck or Lucas-Kanade solvers, the engine computes 2D cross-power spectrums via Cooley-Tukey 2D FFTs:
$$R = \frac{\mathcal{F}\{Y_t\} \cdot \mathcal{F}^*\{Y_{t - \Delta t}\}}{|\mathcal{F}\{Y_t\} \cdot \mathcal{F}^*\{Y_{t - \Delta t}\}|}$$
The spatial inverse Fourier transform $r = \mathcal{F}^{-1}\{R\}$ yields a Dirac-like correlation peak whose coordinate offset $(\Delta x, \Delta y)$ indicates the dominant optical shift in pixels per frame.

### D. Sobel Edge Density
Spatial high-frequency complexity is tracked by convolving luma with $3 \times 3$ horizontal and vertical Sobel operators:
$$G_x = \begin{bmatrix} -1 & 0 & 1 \\ -2 & 0 & 2 \\ -1 & 0 & 1 \end{bmatrix} * Y, \quad G_y = \begin{bmatrix} -1 & -2 & -1 \\ 0 & 0 & 0 \\ 1 & 2 & 1 \end{bmatrix} * Y$$
$$G = \sqrt{G_x^2 + G_y^2}$$
Edge density represents the percentage of frame pixels where edge magnitude $G > \tau_{\text{edge}}$ ($0.15$ normalized threshold).

### E. CIE $L^*a^*b^*$ Color Distance & Gamut Conformity ($\Delta E_{76}$)
To enforce brand palette discipline, every pixel is transformed from linear sRGB to CIE $L^*a^*b^*$ color space. The minimum Euclidean perceptual distance to the approved project palette $\mathcal{P}$ is computed:
$$\Delta E_{76} = \min_{c \in \mathcal{P}} \sqrt{(L^* - L^*_c)^2 + (a^* - a^*_c)^2 + (b^* - b^*_c)^2}$$
Any frame where $> 3\%$ of pixels exhibit $\Delta E_{76} > 12$ is flagged as an off-palette wash (`F12`).

### F. Edge Shimmer & Sampler Chatter Index
High-frequency sub-pixel flicker (often caused by under-sampled wireframes or aliasing) is isolated by tracking the temporal second derivative of edge magnitudes:
$$\text{Shimmer}(t) = \frac{1}{N_{\text{edge}}} \sum_{i \in \text{Edges}} |G_t(i) - 2G_{t - \Delta t}(i) + G_{t - 2\Delta t}(i)|$$

---

## 5. CLI Execution & Parameter Reference

```bash
bun scripts/render.ts motion --url http://localhost:5173 --only <scene-id> \
  --from <start-s> --to <end-s> --out <target-dir> [options]
```

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--only <scene-id>` | string | Required | Specific scene ID or scene file to profile. |
| `--from <seconds>` | float | `0.0` | Start timestamp of telemetry window. |
| `--to <seconds>` | float | Scene end | End timestamp of telemetry window. |
| `--out <dir>` | path | Required | Output directory for telemetry reports and CSVs. |
| `--fps <n>` | integer | `60` | Telemetry capture frame rate. |
| `--bin <seconds>` | float | `0.25` | Binning window for timeseries aggregation. |
| `--palette <spec>` | string | Swiss 5-color | Comma-separated swatches (`ink=#0A0A0B,bone=#EEE9DF,...`). |
| `--allow-blank <range>` | string | None | Permitted blank screen ranges (e.g. `0.0-0.6,18.8-19.1`). |
| `--compare <path>` | file path | None | Compare against reference `summary.json` distribution. |
