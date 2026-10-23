# Instrument 05: Parametric Motion Curve & Speed Graph Inspector (`curves`)

**Status**: Proposed Architecture Specification (Roadmap)  
**Target Command**: `bun scripts/render.ts curves` or `bun scripts/curves.ts`  
**Planned Artifacts**: `curve_speedgraph.png`, `curves_summary.json`  

---

## 1. Overview & Objective

The **Parametric Motion Curve & Speed Graph Inspector** is an isolated mathematical diagnostic tool that plots the value curve and physical kinematic derivatives (speed $v(t) = |y'(t)|$ and acceleration $a(t) = y''(t)$) of any animated scene property—position, scale, rotation, opacity, camera FOV, spring values, or custom shader parameters.

It replicates the classic desktop NLE/DAW **Speed Graph Editor** (After Effects, Cavalry, Blender), providing autonomous coding agents and human art directors with a dedicated diagnostic instrument to inspect easing curvature, tangent health, and arrival velocity without spatial conflation.

---

## 2. The Problem It Solves

When an autonomous coding agent writes procedural animation code:
1. **$C^0$ Tangent Kinks & Velocity Spikes**: When chaining animation segments or blending curves, mathematical errors often introduce sharp velocity spikes where acceleration instantaneously spikes to infinity, creating an ugly jolt.
2. **Arrival Shock & Slamming Stops**: An animation may look smooth initially, but arrive at its rest value with a non-zero velocity ($v(t_{\text{end}}) > 0$), creating an abrupt visual stop rather than a fluid deceleration shoulder.
3. **Spring Tuning Ambiguity**: Tuning a second-order spring ($m, k, c$) in code without a speed graph often leads to underdamping (excessive ringing) or overdamping (sluggish crawl).
4. **Spatial Conflation in Motion Trails**: The Motion Onion reflects 2D spatial positions. When an element moves along an arc or rotates in 3D, spatial curvature is conflated with velocity easing. Furthermore, the Motion Onion is **completely blind to non-spatial properties** like opacity fades, scale bounces, or camera FOV zooms.

---

## 3. Visual Specifications (`curve_speedgraph.png`)

```
PARAMETRIC SPEED GRAPH SCHEMATIC (Dual-Panel Diagnostic Chart)

PANEL 1: VALUE CURVE y(t)
1.0 ┌───────────────────────────────────────────────/─────────┐  Ease-Out Rest
    │                                             /---         │  (v_end ≈ 0)
    │                                           /              │
    │                                         /                │
0.5 │                                       /                  │
    │                                    /                     │
    │                        /-----------                      │
0.0 └────────────────────────┴─────────────────────────────────┘
   t0 = 2.0s                                         t1 = 2.8s

PANEL 2: VELOCITY v(t) & ACCELERATION a(t)
Peak┌──────────────────────────────────────────────────────────┐
    │                       ▲ Peak Velocity: 4.82 units/s      │
    │                      / \                                 │
    │                     /   \                                │
    │                    /     \                               │
0.0 └───────────────────/───────\─────────────────────────────-┘
   [C2 Smooth Shoulder]           \                [v_end = 0.02]
                                   ▼ Deceleration   (Zero Impact)
```

### Visual Features
1. **Panel 1: Normalized Value Curve $y(t)$**:
   - Plots value trajectory over time with keyframe arrival targets, ease shoulders, and overshoot envelopes.
2. **Panel 2: Kinematic Speed $v(t)$ & Acceleration $a(t)$**:
   - Plots first derivative $dy/dt$ (solid cyan) and second derivative $d^2y/dt^2$ (dashed amber).
   - **Green Shading**: Smooth $C^1/C^2$ continuous acceleration/deceleration.
   - **Signal Orange Flags**: Tangent breaks or acceleration jolts ($|a(t)| > \text{threshold}$).
   - **Red Cross Markers ($\times$)**: Hard impact on arrival ($v(t_{\text{end}}) > 5\%$ of peak velocity).

---

## 4. Technical CLI Interface

```bash
bun scripts/curves.ts --scene <scene-id> --property <prop-path> \
  --from <start-s> --to <end-s> [--samples 200] [--out <out-dir>]
```

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--scene <id>` | string | Required | Target scene or plate ID to inspect. |
| `--property <path>`| string | `camera.position.z` | Property path or curve expression to sample. |
| `--from <seconds>` | float | `0.0` | Start of time window in seconds. |
| `--to <seconds>` | float | `4.0` | End of time window in seconds. |
| `--samples <n>` | integer | `200` | Sampling resolution across time window. |
| `--out <dir>` | path | `out/visual/curves`| Output directory for chart and telemetry JSON. |

---

## 5. Machine-Readable Telemetry Schema (`curves_summary.json`)

```json
{
  "scene": "modal_sheet",
  "property": "card.position.y",
  "from": 2.0,
  "to": 2.8,
  "peak_velocity": 4.82,
  "arrival_velocity": 0.02,
  "arrival_impact_ratio": 0.004,
  "has_arrival_shock": false,
  "tangent_discontinuities": [],
  "inflection_count": 1,
  "is_c2_continuous": true,
  "damping_ratio_zeta": 0.85
}
```
