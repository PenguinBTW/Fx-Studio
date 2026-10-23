# Cinematic Camera Choreography & Spline Systems

This guide details the mathematical foundations and authoring techniques for camera movement, target tracking, lens physics, and trauma shake in **f(x) Studio**.

---

## 1. Centripetal Catmull-Rom Flight Splines

Standard linear keyframing produces harsh, discontinuous velocity changes ($C^0$ continuity) that trigger high jerk flags. Chordal or uniform Catmull-Rom splines can generate self-intersecting loops and cusps when keyframes are unevenly spaced.

f(x) Studio standardizes on **Centripetal Catmull-Rom Splines** ($\alpha = 0.5$):

$$t_{i+1} = t_i + \|\mathbf{P}_{i+1} - \mathbf{P}_i\|^{0.5}$$

### Mathematical Properties:
1. **No Cusps or Self-Intersections**: Guarantees that the camera curve never overshoots wildly into geometry.
2. **$C^1$ Velocity Continuity**: First derivatives match across control points, ensuring continuous velocity vectors across keyframes.
3. **Closed-Form Evaluation**: Position $\mathbf{P}(t)$ can be queried at any arbitrary float timestamp without iterative integration.

```typescript
import { CatmullRomCurve3, Vector3 } from 'three';

const flightPath = new CatmullRomCurve3(
  [
    new Vector3(0, 1.2, 8.0),   // Start: Establishing wide
    new Vector3(2.5, 0.8, 4.0), // Intermediate: Low 3/4 glide
    new Vector3(0.0, 0.4, 1.8), // Focal: Macro push-in
  ],
  false, // closed
  'centripetal', // curveType
  0.5 // tension
);

// Sample camera position deterministically at local scene time lt
const camPos = flightPath.getPointAt(f.p);
```

---

## 2. Orthonormal Orientation Frames (The Bishop Frame)

When moving along complex 3D space curves, deriving camera roll from standard Frenet-Serret frames fails at inflection points where curvature $\kappa \to 0$, causing violent $180^\circ$ camera flips.

f(x) Studio uses **Bishop Orthonormal Frames** (Parallel Transport Frames) to orient cameras smoothly along space curves:

$$\frac{d\mathbf{T}}{ds} = k_1 \mathbf{M}_1 + k_2 \mathbf{M}_2, \quad \frac{d\mathbf{M}_1}{ds} = -k_1 \mathbf{T}, \quad \frac{d\mathbf{M}_2}{ds} = -k_2 \mathbf{T}$$

### Benefits:
- **Zero Gimbal Lock**: Orthonormal basis vectors never collapse.
- **Twist Minimization**: Minimizes camera roll rotation as the lens tracks along looping curves.
- **Stable Up-Vector**: Preserves horizon orientation without manual roll keyframes.

---

## 3. Analytical Closed-Form Trauma Shake

In real-world cinema, camera shake is not random white noise; it follows physical decay dynamics.

f(x) Studio implements a deterministic, closed-form trauma model inspired by game feel mechanics:

$$\text{Shake}(t) = \text{Trauma}(t)^2 \cdot \begin{bmatrix} A_x \sum_{i=1}^3 w_i \sin(\omega_i t + \phi_i) \\ A_y \sum_{i=1}^3 w_i \cos(\omega_i t + \psi_i) \\ A_{\text{roll}} \sum_{i=1}^3 w_i \sin(1.7 \omega_i t + \theta_i) \end{bmatrix}$$

```
TRAUMA DECAY PROFILE
1.0 ──────┐ (Kick Drum Hit / Barricade Breach)
          │\
          │ \   Trauma² Non-linear Falloff
          │  \
0.0       └───┴────────────────────────────────► Time (s)
          t=0  t=0.35s
```

### Key Implementation Principles:
1. **$t$-Derived Pure Function**: Built on analytical trigonometric harmonics rather than mutable accumulators, ensuring identical shake on 60 fps export and 120 fps displays.
2. **Non-Linear Trauma Curve ($\text{Trauma}^2$)**: Small impacts create subtle micro-tremors, while heavy hits produce violent, high-frequency shudder without linear robotic decay.
3. **Decoupled Frequencies**: Roll frequency ($1.7\times$) differs from translational pitch/yaw to eliminate diagonal rocking artifacts.

---

## 4. Lens Breathing & Dynamic FOV Choreography

Static focal lengths make procedural 3D camera moves feel rigid. Modulating Field of View (FOV) creates visceral depth:

```typescript
// Dynamic FOV Ramping
// Push-in with lens widening to create vertigo / dolly-zoom effect
const fovBase = 45.0;
const fovBreathing = Math.sin(f.t * 3.14159) * 1.5; // Organic respiratory sway
const dollyZoom = (1.0 - enterEase) * 12.0;

ctx.camera.fov = fovBase + fovBreathing + dollyZoom;
ctx.camera.updateProjectionMatrix();
```

---

## 5. Composition Framing & Screen-Space Damping

When tracking dynamic subjects (such as the Boattail Roadster in the music video), locking the camera hard to the subject center produces dizzying jitter.

### Framing Best Practices:
1. **Look-Ahead Target Offset**: Place target gaze coordinates ahead of the vehicle's instantaneous velocity vector $\mathbf{v}$:
   $$\mathbf{Target} = \mathbf{Pos}_{\text{hero}} + 0.25 \mathbf{v}_{\text{hero}}$$
2. **Thirds Composition**: Position the focal subject on the lower-third horizontal line ($y = 0.33$), leaving upper negative space for typography and sky choreography.
3. **Frustum Clearance Verification**: Use `bun scripts/godview.ts` to verify that the camera never comes closer than $0.5\,\text{m}$ to foreground geometry.
