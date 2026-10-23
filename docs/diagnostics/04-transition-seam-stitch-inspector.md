# Diagnostic Instrument 04: Transition Seam Stitch Inspector (`stitch`)

**Status**: Implemented & Operational  
**Source Implementation**: [`app/scripts/visual/stitch.ts`](../../app/scripts/visual/stitch.ts)  
**CLI Command**: `bun scripts/render.ts stitch` or `bun scripts/stitch.ts`  
**Core Artifacts**: `onion_seam.png`, `strip_seam.png`, `stitch_summary.json`  

---

## 1. Overview & Capability

The **Transition Seam Stitch Inspector** audits the boundary where one scene cuts, wipes, or morphs into the next ($\pm 250\,\text{ms}$). In procedural motion design, scene cuts frequently suffer from subtle alignment jumps, scale mismatches, horizon tilt discontinuities, or 1-frame blackout glitches.

This tool produces two complementary diagnostic images:
1. **Split-Wipe Onion Overlay (`onion_seam.png`)**: Composites exit frame $N-1$ in translucent green (`#00FF66`, $\alpha = 0.5$) directly over entry frame $N$ in translucent magenta (`#FF00AA`, $\alpha = 0.5$).
   * Wherever carrier geometry lines up across the cut, green + magenta light combine into **neutral white/gray**.
   * Any spatial jump, scale mismatch, or horizon tilt immediately creates **bright green or magenta fringing**.
2. **10-Frame Seam Filmstrip (`strip_seam.png`)**: A horizontal contact strip displaying the 5 frames preceding the cut ($N-5 \to N-1$) and the 5 frames following the cut ($N \to N+4$), divided by a bright red vertical cut marker.

```
SEAM ONION OVERLAY CONCEPT (FRAME N-1 vs FRAME N)
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│         /─────────────────────────────\                     │
│        │   [ NEUTRAL WHITE CORE ]      │                    │
│        │   Carrier aligns perfectly    │                    │
│        │                               │                    │
│        \───[ Green Fringe: 6px jump ]──/                    │
│                                                             │
│  [Green = Outgoing Scene | Magenta = Incoming Scene]        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Universal Design Applications

1. **Commercial Match-Cuts & Graphic Transitions**:
   - Auditing match-cuts where a geometric shape, product silhouette, or hero title carries over from Scene A into Scene B.
   - Instantly exposes whether the focal carrier shifted by $10\,\text{px}$ or scaled improperly across the boundary.
2. **UI State Handoffs & Modal Push/Pop**:
   - Inspecting seamless transitions where a UI card expands into a full-screen view.
   - Highlights anchor misalignment, sudden scale pops, or dropped frames during the handoff.
3. **Camera Trajectory Vector Continuity**:
   - The 10-frame filmstrip reveals whether camera velocity carries smoothly through the transition or freezes dead on frame $N-1$ before jumping on frame $N$.
4. **Blackout / Whiteout Dropout Detection**:
   - Catches unintentional 1-frame blank blackouts or canvas buffer clearing glitches occurring immediately prior to scene initialization.

---

## 3. Visual Diagnostics Matrix

| Visual Pattern in `onion_seam.png` | Diagnostic Finding | Root Cause | Corrective Action |
| :--- | :--- | :--- | :--- |
| **Crisp Neutral White/Gray Core** | Perfect match-cut | Carrier geometry matches position & scale | Pass — intended match cut |
| **Uniform Green/Magenta Directional Offset** | Carrier position shift | Anchor coordinate disparity $(x_A \ne x_B)$ | Match exit position of Scene A to entry position of Scene B |
| **Concentric Halo (Green inner, Magenta outer)** | Scale / FOV mismatch | Camera distance or FOV disparity | Equalize camera FOV or adjust object scale across seam |
| **Rotational Shear / Fringing** | Horizon tilt discontinuity | Camera roll or target tilt mismatch | Match camera roll angle or normalize up-vector $(0, 1, 0)$ |
| **Solid Black or White Frame in Filmstrip** | Buffer dropout / flash glitch | Uninitialized WebGL target or clearing artifact | Ensure warm render target pass before first frame draw |

---

## 4. CLI Options & Parameter Reference

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--t <seconds>` | float | auto | Cut timestamp in timeline seconds (auto-detected if omitted). |
| `--from-scene <id>`| string | auto | Outgoing scene ID. |
| `--to-scene <id>` | string | auto | Incoming scene ID. |
| `--window <seconds>`| float | `0.25` | Inspection window radius in seconds ($\pm 15$ frames at 60 fps). |
| `--out <dir>` | directory path | `out/visual/stitch` | Output directory for onion overlay and filmstrip. |

---

## 5. Usage Examples

```bash
# Audit the match-cut between product macro shot and wide showcase at t = 6.40s
bun scripts/stitch.ts --from-scene macro_shot --to-scene wide_reveal --t 6.40 --out out/visual/macro_to_wide

# Audit a UI card-to-fullscreen modal expansion seam
bun scripts/render.ts stitch --from-scene feed_card --to-scene modal_detail --t 3.25

# Inspect transition seam between two commercial chapters
bun scripts/stitch.ts --from-scene chapter_1 --to-scene chapter_2 --t 15.00
```

---

## 6. Seam Telemetry Schema (`stitch_summary.json`)

```json
{
  "cut_timestamp": 6.40,
  "from_scene": "macro_shot",
  "to_scene": "wide_reveal",
  "carrier_drift_px": { "x": 1.4, "y": 0.8 },
  "scale_disparity_pct": 1.2,
  "rotation_drift_deg": 0.15,
  "velocity_continuity": 0.96,
  "blank_frame_detected": false,
  "artifacts": {
    "onion_overlay": "onion_seam.png",
    "filmstrip": "strip_seam.png"
  }
}
```
