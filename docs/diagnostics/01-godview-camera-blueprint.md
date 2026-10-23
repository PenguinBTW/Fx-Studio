# Diagnostic Instrument 01: 3D God-View Camera Blueprint (`godview`)

**Status**: Implemented & Operational  
**Source Implementation**: [`app/scripts/visual/godview.ts`](../../app/scripts/visual/godview.ts)  
**CLI Command**: `bun scripts/render.ts godview` or `bun scripts/godview.ts`  
**Core Artifacts**: `cam_godview.png`, `godview_summary.json`  

---

## 1. Overview & Capability

The **3D God-View Camera Blueprint** renders an **external architectural schematic** of the 3D scene and its camera flight path across any procedural motion graphics production—commercial product turntable reveals, 3D UI exploded views, architectural walkthroughs, and animated kinetic typography stages.

Instead of evaluating camera flight solely through the front lens (which blinds creators and agents to spatial clearance issues or near-plane clipping), this instrument steps outside the camera frustum and renders dual-panel orthographic blueprints with a continuous **velocity-colored flight ribbon** and camera viewing cones.

```
┌────────────────────────────────────────────────────────────────────────┐
│               DUAL-PANEL ORTHOGRAPHIC BLUEPRINT LAYOUT                 │
├──────────────────────────────────┬─────────────────────────────────────┤
│ PANEL 1: TOP-DOWN VIEW (XZ)      │ PANEL 2: SIDE ELEVATION VIEW (YZ)   │
│ • Horizontal flight path         │ • Altitude & vertical arcs          │
│ • Frustum viewing cones & gaze   │ • Pitch angle & elevation dips      │
│ • Hero subject & stage bounds    │ • Floor / ceiling near clearances   │
│ • Velocity color gradient ribbon │ • Velocity color gradient ribbon    │
└──────────────────────────────────┴─────────────────────────────────────┘
```

---

## 2. Visual Artifacts Produced

### A. Dual-Panel Architectural Blueprint (`cam_godview.png`)
Renders a $1920 \times 1080$ diagnostic contact sheet with two side-by-side orthographic projections:
1. **Left Panel: Top-Down Plan View ($XZ$ Plane)**:
   - Evaluates camera transit across horizontal space.
   - Plots the bounding footprints of registered hero objects, UI planes, and stage boundaries.
   - Renders camera frustum pyramids at regular sample intervals with a center line of sight (gaze vector) pointing toward the focal point.
2. **Right Panel: Elevation Side View ($YZ$ Plane)**:
   - Evaluates camera altitude, elevation curves, and vertical swoop trajectories.
   - Reveals whether the camera dips dangerously close to the floor plane or geometry base.
3. **Continuous Velocity Gradient Ribbon**:
   - The flight trajectory is rendered as a continuous ribbon whose color dynamically maps to physical camera speed:
     * **Deep Indigo / Blue (`#1E293B` to `#3B82F6`)**: Stationary dwell to slow transit ($0\text{–}4\,\text{m/s}$).
     * **Bone / Muted Gray (`#CBD5E1`)**: Controlled cruise ($4\text{–}15\,\text{m/s}$).
     * **Signal Orange (`#F97316`)**: High-speed acceleration or cinematic push-in ($15\text{–}30\,\text{m/s}$).
     * **Saturated Vermilion (`#EF4444`)**: Peak terminal velocity ($> 30\,\text{m/s}$).

### B. Kinematic Summary Telemetry (`godview_summary.json`)
Accompanying the image is machine-readable telemetry recording exact spatial kinematics:
```json
{
  "scene": "product_reveal",
  "from": 4.0,
  "to": 12.0,
  "duration": 8.0,
  "sample_count": 32,
  "max_speed_mps": 24.6,
  "avg_speed_mps": 11.2,
  "min_near_distance_m": 0.32,
  "samples": [
    {
      "t": 4.0,
      "pos": [0.0, 1.2, 5.0],
      "target": [0.0, 1.0, 0.0],
      "speed_mps": 0.0,
      "fov": 45.0,
      "near_clearance_m": 1.45
    }
  ]
}
```

---

## 3. CLI Options & Parameter Reference

| Flag | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--from <seconds>` | float | `0.0` (or scene start) | Starting timeline timestamp to trace. |
| `--to <seconds>` | float | Scene end | Ending timeline timestamp to trace. |
| `--samples <n>` | integer | `24` | Number of discrete camera frustums and samples along the spline. |
| `--scene <id>` | string | `all` | Specific scene ID to isolate. |
| `--out <dir>` | directory path | `out/visual/godview` | Output directory for PNG and JSON artifacts. |
| `--url <address>` | URL string | `http://localhost:5173` | Headless browser target address. |

---

## 4. Usage Examples

```bash
# Audit a 3D product turntable camera orbit (4.0s to 12.0s)
bun scripts/godview.ts --scene product_turntable --from 4.0 --to 12.0 --samples 32 --out out/visual/product_orbit

# Trace camera flight across an entire architectural sequence
bun scripts/render.ts godview --scene building_walk --from 0.0 --to 20.0 --samples 40 --out out/visual/arch_flythrough

# Check stage clearances in an exploded 3D UI scene
bun scripts/godview.ts --scene ui_explode --from 2.5 --to 8.0 --samples 20 --out out/visual/ui_clearances
```

---

## 5. Diagnostic Decision Tree for Autonomous Agents

```
                        [ Inspect cam_godview.png ]
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
[ Ribbon Abrupt Angle ]     [ Frustum Near Mesh ]      [ Color Discontinuity ]
Tangent Discontinuity       Near-Clip / Penetration    Speed Hitch / Zero-Ease
         │                           │                           │
         ▼                           ▼                           ▼
- Switch camera spline to   - Push object outward or   - Smooth easing curve
  centripetal Catmull-Rom     adjust camera offset       (e.g., cubic-bezier or
- Match incoming/outgoing   - Lower FOV / increase       quartic ease-out)
  spline velocity vectors     camera distance          - Remove sudden keyframe
```
