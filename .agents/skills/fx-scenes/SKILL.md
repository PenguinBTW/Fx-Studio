---
name: fx-scenes
description: Scene authoring standards, declarative DSL patterns, 3D/2.5D staging, kinetic typography, camera choreography, motion layering, staged physics, and procedural wireframe rooms in f(x) Studio. Use when creating, modifying, or refactoring scenes in app/src/scenes/.
---
# f(x) Studio: Scene Authoring & Motion Craft

Authoring standards, architectural conventions, kinetic polish mechanics, staged physics, procedural wireframe architecture, and visual staging workflows for building scenes within **f(x) Studio** using raw `Scene` subclasses (the common path; flagship scenes use these) or, optionally, the Declarative Scene DSL (`defineScene`, used mainly by demo scenes).

## When to Use

- Creating, animating, or editing visual scenes in `app/src/scenes/<project>/`.
- Implementing 3D product models, spatial UI cards, HUD infographics, or kinetic typography.
- Applying high-end motion layering (`Base` + `Hit` + `Tremor` + `Creep`), keyframed springs, or coupled baselines.
- Constructing code-only procedural wireframe rooms with zero GLTF models via `LineBatch` and `planeAffine`.
- Choreographing 6-DOF camera movement, focal length sweeps, and trauma shake.
- Synchronizing motion parameters, physical springs, and particle systems to the timeline.
- Enforcing WebGL state cache hygiene, contrast halos, and text ducking during scene authoring.

---

## 1. Upstream & Sibling Skill Dependencies

Before authoring scenes, ensure alignment with connected production skills:
- **`video-design` (Universal Standards):** Zero HUD clutter, diegetic 3D text integration, continuous camera momentum, stylized 2.5D minimum, safe zone compliance.
- **`viopls-art-direction`:** Palette discipline (60/30/10 rule), anti-slop blacklist, unified materiality, and bold structural typography.
- **`design-around-audio` / `sound-design-and-foley`:** Downbeat anchoring, transient hit responses (`hit()`), and tactile micro-sync.
- **`fx-engine`:** Root architecture, coordinate conventions ($1920 \times 1080$), and engine invariants.
- **`fx-3d-assets`:** Ingesting, preloading (`models: { ... }`), and deterministically animating external GLTF/GLB models.
- **`fx-procedural-modeling`:** Authoring code-only shaders, procedural wireframes, and mathematical textures.
- **`fx-kinetic-typography`:** Word staggers, numeric rollers, variable font axes, and Hershey single-stroke fonts.
- **`fx-transitions`:** Seam continuity and incoming/outgoing momentum handoffs.
- **`fx-diagnostics`:** Running visual diagnostic instruments (`godview`, `onion`, `stitch`) to audit the finished scene.

---

## 2. Fundamental Scene Invariants [RULE]

Every scene file must adhere to these four technical invariants:

### 2.1 Pure Closed-Form Determinism: $\text{Frame} = f(t)$
- All transforms, colors, spring positions, and particle states must be pure mathematical functions of local scene time `f.lt` or global time `f.t`.
- **Strictly Prohibited:** Never use mutable state accumulators across frames:
  ```typescript
  // ILLEGAL: Accumulator drifts across random scrubs and breaks sub-frame sampling
  this.posX += this.velX * f.dt;

  // MANDATORY: Closed-form stateless mathematical function
  const posX = startX + velocity * f.lt + 0.5 * acceleration * f.lt * f.lt;
  ```
- **Stepped Values & Flicker:** Per-frame steps, jitter, or hash seeds must be keyed to `frameIdx(t) = Math.round(t * 60)`. Never use `Math.floor(t * 60)` (which transitions at frame edges and blends two states inside one shutter window).

### 2.2 WebGL Target Ownership & Clean Clears
- Every scene's `render(f, out)` execution must explicitly clear or completely overwrite its target buffer:
  ```typescript
  renderer.setRenderTarget(out);
  renderer.clear(true, true, true);
  ```

### 2.3 WebGL State Cache Restoration
- If writing raw WebGL passes, custom GLSL shaders, or flushing custom batches outside the standard DSL, always restore Three.js internal state:
  ```typescript
  renderer.resetState();
  ```

### 2.4 WCAG Contrast Halos for On-Screen Text
- Per `video-design` and Rule `F04`, any Canvas2D typography rendered over 3D geometry, particles, or textured surfaces must include high-contrast knockout understroke halos:
  ```typescript
  ctx.renderText('SYSTEM ACTIVE', targetCanvas, f.t, x, y, {
    halo: true,
    haloColor: 'rgba(10, 13, 18, 0.95)',
    haloWidth: 6,
  });
  ```

---

## 3. High-End Motion Polish Mechanics [RULE]

Fluid, tactile, high-budget animation is achieved through structural choreography rather than arbitrary hand-tuned keyframes:

### 3.1 "One Clock, Many Hands" (The Synchronization Invariant)
- Derive every animated property in a shot from the same 1–2 master timing sources (a word trigger, transient hit, or progress curve).
- When two objects interact (e.g., text pushing other text, cards docking into a chassis), they must read the exact same clock through the same ease curve so visual relationships never drift apart.

### 3.2 Four-Layer Motion Architecture
No visible property should have only a single motion curve. Every active element must layer four movement bands:

```
[4-LAYER MOTION STACK]

1. BASE DRIFT      ===> 2. HIT TRANSIENT   ===> 3. FRAME TREMOR    ===> 4. HOLD CREEP
   - Slow life / breath   - Pulse on audio hits   - Deterministic jitter  - Constant advance
   - Keeps frame alive    - Snaps & settles       - Keyed to frameIdx(t)  - Prevents dead holds
```

1. **Base Drift / Breathing:** Continuous subtle travel or rotation (`f.lt * 0.05`), ensuring elements never freeze into static cards.
2. **Hit Transient:** Sharp exponential-decay pulse on narrative emphasis or audio kicks (`pulse(t, hitT, halfLife)`).
3. **Frame Tremor:** High-frequency vibration keyed deterministically to `hash(frameIdx(t))`, remaining constant across the shutter window.
4. **Hold Creep:** Elements on hold physically creep toward the lens ($1.0 + 0.035 \cdot (t - t_0)$) rather than standing dead still.

### 3.3 Typography Moves with Physical Mass
- **Never rely on opacity-only fades.** Opacity-only reveals look cheap and digital.
- Animate typography using **mass, width, weight, tracking, and spring overshoot**:
  - Word slams: Overshoot scale ($1.25 \to 1.0$) with rapid settle.
  - Typographic pressure: Animate font width ($125 \to 62$) and weight ($300 \to 900$) with negative tracking under narrative tension.
  - Baselines are physical planes: If a table rolls or an explosion occurs, text tilts and wobbles with the underlying surface.

### 3.4 Secondary Motion Echoes
- Every lead hero movement must have a cheaper secondary echo on the same clock:
  - Coordinate annotations flickering beside expanding UI cards.
  - Hairline connection guides extending as a 3D component slides into place.
  - Ghost trails or particle wisps emitting behind fast camera whips.

---

## 4. Staged Physics (Keyframed Momentum Without Simulators)

Never run mutable physical simulation integrators (`pos += vel * dt`). Fake inertia, gravity, and elastic momentum using closed-form analytical formulas:

### 4.1 Keyframed Springs & Overshoot
Evaluate mass-spring-damper overshoot analytically:
```typescript
import { springStep } from '../../engine/motion';

// Damped spring catching a stepped value:
const rollAngle = targetAngle * springStep(f.lt - stepTime, frequency, damping);
```

### 4.2 Coupled Physical Baselines
- When a 3D surface tilts, drops, or slips, all mounted children (cards, typography, leader lines) must share the same roll angle variable.
- Pass exit values across cuts as handoff constants (`ROLL_IN` / `ROLL_OUT`) so consecutive scenes inherit identical angular momentum.

---

## 5. Procedural Wireframe Rooms & `planeAffine` (Code-Only 3D Architecture)

When building architectural environments without external 3D models or textures, use the **Minimalist-3D Wireframe Room** technique:

### 5.1 World Construction via `LineBatch` Segment Soup
Build a metre-scale wireframe world once in `init()` as a static line array (`Segs`):
```typescript
import { LineBatch } from '../../engine/lines';

// Dedicated batches for crisp hairlines and hot glows:
const inkLines  = new LineBatch(130000, { blend: 'max' }); // Crisp structural lines
const glowLines = new LineBatch(70000,  { blend: 'add' }); // Hot glowing accents
```
- Subdivide long edges (`ceil(len / 0.5)`) so near-camera clipping and perspective projection remain smooth.
- Apply depth fading: `color * (1.0 - 0.5 * clamp(depth / 13.0))` to keep distant walls unobtrusive.

### 5.2 The Hero-Plane Occlusion Technique (Depth Buffer Alternative)
To achieve clean occlusion without expensive depth buffer sorting:
1. Define a single primary occluding hero plane (e.g., a central workstation, table, or flip-board).
2. Compute the plane normal facing the camera.
3. Test points against the plane:
   ```typescript
   function isFront(x: number, y: number, z: number, planeOrigin: V3, planeNormal: V3): boolean {
     return (x - planeOrigin[0]) * planeNormal[0] +
            (y - planeOrigin[1]) * planeNormal[1] +
            (z - planeOrigin[2]) * planeNormal[2] > 0;
   }
   ```
4. Render in strict order:
   $$\text{Back-Wall Quad} \longrightarrow \text{Behind-Plane Lines} \longrightarrow \text{Behind Paper (Canvas2D)} \longrightarrow \text{Front-Plane Lines} \longrightarrow \text{Front Paper (Canvas2D)}$$

### 5.3 Sticking 2D Typography to 3D Walls via `planeAffine`
Project Canvas2D labels directly onto 3D walls or cards without generating 3D polygon meshes:
```typescript
// Imported via: import { planeAffine } from '../../engine/util';
// wall axes: ux right along wall, uy DOWN the wall ([0, -1, 0])
const A = planeAffine(cam, worldAnchor, wallUx, wallUy, scaleM, wpx / 2, -7, 1.0, f.t);
if (A) {
  ctx2d.setTransform(A.a, A.b, A.c, A.d, A.e, A.f);
  ctx2d.fillStyle = '#EEE9DF';
  ctx2d.fillText(text, 0, 0);
}
```
*Measure text at 20px, then scale by physical metres `scaleM` to maintain sharpness at any camera distance.*

---

## 6. Pre-Flight Scene Authoring Checklist

Before marking a scene complete or submitting for review, verify:

- [ ] **Closed-Form Logic:** All animation curves evaluate directly from `f.lt` or `f.t` (no `+=` Euler state).
- [ ] **Stepped Values Clean:** All flicker, hash seeds, and stepped states use `frameIdx(t) = Math.round(t * 60)`.
- [ ] **Layered Motion:** Active subjects feature Base Drift + Hit Transient + Frame Tremor + Hold Creep.
- [ ] **Typography Mass:** Text animates via scale/weight/tracking overshoot, never raw opacity fades.
- [ ] **State Restoration:** Custom passes explicitly invoke `renderer.resetState()`.
- [ ] **Target Cleared:** Scene clears `out` buffer via `gl.clear(true, true, true)`.
- [ ] **Text Contrast:** All typography features knockout understroke halos (`haloWidth: 6`).
- [ ] **Text Ducking:** 2D overlay text multiplies opacity by `ctx.overlayDuck(f.tin, f.tout)`.
- [ ] **Camera Momentum:** Camera maintains smooth, continuous travel across the scene lifetime.
- [ ] **Safe Boundaries:** All critical visuals and text sit comfortably inside safe zones.