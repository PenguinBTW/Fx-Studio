# Instrument 08: Choreography Gantt & Stagger Visualizer (`rhythm`)

**Status**: Proposed Architecture Specification (Roadmap)  
**Target Command**: `bun scripts/render.ts rhythm` or `bun scripts/rhythm.ts`  
**Planned Artifacts**: `choreography_gantt.png`, `rhythm_summary.json`  

---

## 1. Overview & Objective

The **Choreography Gantt & Stagger Visualizer** is a temporal orchestration diagnostic tool that maps the motion lifecycle of every active scene entity onto an ensemble multi-track Gantt chart.

It color-codes the three canonical phases of motion design—**Entrance Ease**, **Active Dwell Hold**, and **Exit Transition**—and overlays musical beat grids, allowing autonomous agents to diagnose timing collisions, irregular stagger cascades, and musical sync misalignment.

---

## 2. The Problem It Solves

When multiple graphic elements, 3D meshes, and text layers animate together:
1. **Simultaneous Onset Traffic Jams**: If 6 UI cards pop onto the screen at the exact same millisecond ($t = 2.000\,\text{s}$), the animation feels robotic, overwhelming, and uncrafted. Professional motion design staggers onsets (e.g. $40\text{–}60\,\text{ms}$ cascades).
2. **Irregular or Sloppy Staggers**: Mathematical bugs in loops often produce non-monotonic or erratic staggers (e.g. $20\,\text{ms} \to 120\,\text{ms} \to 10\,\text{ms}$).
3. **Musical Rhythm Decoupling**: Animations that start or land off-beat ($100\,\text{ms}$ away from downbeats) feel disconnected from the audio track.

---

## 3. Visual Specifications (`choreography_gantt.png`)

```
CHOREOGRAPHY GANTT SCHEMATIC (Multi-Track Rhythm Visualizer)

Beat Grid:        │ Bar 1.1         │ Bar 1.2         │ Bar 1.3         │ Bar 1.4
Time (s):        0.0s              0.46s             0.93s             1.39s
─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────
Track 1: Title   │ [► Ease In ]====│=================│===[ Exit ►]     │
Track 2: Card 1  │   [► Ease ]=====│=================│=================│===
Track 3: Card 2  │     [► Ease ]===│=================│=================│===
Track 4: Card 3  │       [► Ease ]=│=================│=================│===
Track 5: Particles │  [► Burst ]───│───[ Sustain ]───│─────────────────│
─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────
                 ▲                 ▲
                 Kick Drum 1       Snare Drum 1
```

### Visual Features:
- **Phase Color Coding**:
  - **Cyan (`#00D2FF`)**: Entrance Ease ($p: 0 \to 1$).
  - **Bone (`#EEE9DF`)**: Active Dwell / Reading Hold.
  - **Signal Orange (`#FF4D12`)**: Exit Transition ($p: 1 \to 0$).
- **Musical Transient Markers**: Vertical dotted lines indicating downbeats, kick transients, and snare snaps from audio analysis.
- **Stagger Regularity Bracket**: Highlighting the cascade slope across related entity tracks.

---

## 4. Technical CLI Interface

```bash
bun scripts/rhythm.ts --scene <scene-id> --from <start-s> --to <end-s> \
  [--bpm 129.20] [--out <out-dir>]
```

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--scene <id>` | string | Required | Target scene to inspect. |
| `--from <seconds>` | float | `0.0` | Start of inspection window. |
| `--to <seconds>` | float | Scene end | End of inspection window. |
| `--bpm <tempo>` | float | Auto-detected | Project tempo for beat grid overlay. |
| `--out <dir>` | path | `out/visual/rhythm`| Output directory. |

---

## 5. Machine-Readable Telemetry Schema (`rhythm_summary.json`)

```json
{
  "scene": "feature_cards_reveal",
  "track_count": 5,
  "simultaneous_onset_detected": false,
  "stagger_analysis": {
    "is_staggered": true,
    "mean_stagger_interval_ms": 48.2,
    "stagger_variance_ms": 2.1,
    "is_linear_cascade": true
  },
  "musical_quantization": {
    "aligned_to_beat_pct": 92.4,
    "mean_beat_offset_ms": 6.8
  },
  "short_dwell_warnings": []
}
```
