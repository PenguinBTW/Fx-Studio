---
name: fx-transitions
description: Authoring standards, 3D spatial continuity, camera momentum handoffs, rack-focus seams, and engine-driven transitions in f(x) Studio. Use when connecting scenes, writing transition classes in app/src/transitions/, or fixing transition collisions.
---
# f(x) Studio: 3D Spatial Transitions & Seam Engineering

Standards, optical physics, camera momentum handoffs, and spatial continuity rules for authoring seamless transitions in **f(x) Studio**.

## When to Use

- Writing or modifying transition classes in `app/src/transitions/`.
- Connecting scenes in `project.json` using transition intervals and registration keys.
- Choreographing 3D spatial match-cuts, camera velocity handoffs, rack-focus seams, and optical chromatic dispersion.
- Implementing scene-internal diegetic transitions (`handlesTransition = true`) consuming `f.under`.
- Auditing cut seams using the Visual Seam Stitch Inspector (`stitch.ts`) and filmstrip diagnostics.
- Eliminating transition-seam text collisions (Rule `F04`) or horizon tilt pops.

---

## 1. Core Philosophy: Motivated 3D Spatial Seams

Transitions in f(x) Studio are never cheap 2D slideshow wipes or arbitrary video crossfades. Every transition must be an **intentional 3D spatial seam** engineered in concert with the scenes it connects:

- **Vector Momentum Continuity:** The entry camera trajectory of Scene B must inherit or directly complement the exit velocity vector ($\vec{v}_{\text{exit}}$) and focal direction of Scene A.
- **Physical Carriers:** Shared visual tokens (a 3D monolith, ribbon trail, light flare, or particle current) bridge the cut to guide the viewer's gaze across the threshold.
- **Optical Depth Continuity:** Rack-focus transitions transfer depth-of-field blur smoothly across scene boundaries without sharp focal snap-backs.
- **Decoupled Architecture:** Transition logic lives in standalone classes in `app/src/transitions/` (or scene-internal `handlesTransition` handlers) so individual scenes remain independently testable.

---

## 2. Project Manifest Integration (`project.json`) [RULE]

Transitions bridge scenes across a defined temporal window in `project.json`:

```json
{
  "scenes": [
    { "id": "scene_a", "file": "scene_a.ts", "start": 0.0, "end": 6.5 },
    { "id": "scene_b", "file": "scene_b.ts", "start": 6.0, "end": 12.0 }
  ],
  "transitions": [
    {
      "from": "scene_a",
      "to": "scene_b",
      "type": "kinetic_whip",
      "at": 6.25,
      "duration": 0.50
    }
  ]
}
```

- **Temporal Seam Window:** Evaluates across the interval $[t_{\text{at}} - \frac{\text{duration}}{2}, t_{\text{at}} + \frac{\text{duration}}{2}]$.
- **Scene Overlap:** Outgoing Scene A and incoming Scene B must both overlap during this entire window.
- **Normalized Progress $u$:** The engine maps timeline time $t$ to normalized transition progress $u \in [0.0, 1.0]$.

---

## 3. The Three Transition Paradigms [RULE]

Select the appropriate paradigm based on the creative intent:

```
                           [ TRANSITION PARADIGMS ]
                                       │
       ┌───────────────────────────────┼───────────────────────────────┐
       ▼                               ▼                               ▼
[ PARADIGM 1: Standalone ]   [ PARADIGM 2: Diegetic 3D ]     [ PARADIGM 3: Optical ]
Bespoke Transition Class     Scene-Internal (f.under)        Physical Depth / Dispersion
• Lives in app/src/transitions/ • Incoming scene handles it  • Thin-lens rack focus
• Off-path sampling (api)    • Texture mapped into 3D world  • Cauchy spectral dispersion
• Custom quad post-processing • Camera flies through portal  • Continuous particle stream
```

### Paradigm 1: Bespoke Standalone Transitions (Primary Pattern)
- Extends the `Transition` base class in `app/src/transitions/`.
- Owns the temporal seam externally between $[t_{\text{at}} - \text{dur}/2, t_{\text{at}} + \text{dur}/2]$.
- Receives pre-rendered HalfFloat textures of Scene A (`texA`) and Scene B (`texB`), normalized progress $u \in [0, 1]$, and access to `api.sampleScene()`.
- Used for match-cuts, velocity warps, directional push-glides, and shader fragmentations.

### Paradigm 2: Diegetic 3D Handoffs (`handlesTransition = true`)
- Set `handlesTransition = true` in the incoming scene definition.
- The incoming scene directly consumes `f.under` (the rendered output texture of the outgoing scene) as an active 3D texture inside its own Three.js world space.
- The camera flies *through* a doorway, lens, screen, or portal quad in Scene B, breaching the threshold to reveal the new environment.

### Paradigm 3: Physical Optical Continuity (Rack Focus & Spectral Dispersion)
- **Rack-Focus Handoff:** Outgoing Scene A racks camera focus distance into extreme foreground or background blur ($C_{\text{out}} \to 24\text{px}$). Incoming Scene B begins at the exact matching Circle-of-Confusion blur and pulls into critical focus.
- **Spectral Dispersion Whip:** High-speed camera whips apply Cauchy chromatic dispersion (`refract.ts` / `spectrum.ts`) along the velocity vector rather than generic RGB split.
- **Atmospheric Currents:** Particle fields (`particles_large.ts`) and ribbons (`ribbon.ts`) maintain matching seeds and velocity vectors across the boundary so the ambient world flows uninterrupted.

---

## 4. The Power of `api.sampleScene(id, t)` [RULE]

Standard video transitions can only blend static pre-rendered video frames. In f(x) Studio, `api.sampleScene(id, t)` allows the transition to re-evaluate participant scenes at **arbitrary off-path timestamps**:

```typescript
// Sample Scene A at 2x forward speed to create an optical whip-out
const textureA = api.sampleScene(fromSceneId, tCut + (u * 2.0));

// Freeze Scene A at the exact cut timestamp while fracturing geometry
const frozenA = api.sampleScene(fromSceneId, tCut);

// Sample Scene B slightly ahead of time to match a kinetic rotation
const textureB = api.sampleScene(toSceneId, tCut + 0.15);
```

### Common Use Cases:
- **Speed Ramping:** Accelerate the outgoing scene's camera or animation into a high-motion blur whip right at the seam.
- **Freeze & Shatter:** Freeze Scene A on impact, project the frozen texture onto 3D shards or cards, and disperse them to reveal Scene B.
- **Temporal Lead-In:** Sample Scene B slightly ahead of time to synchronize a light sweep or kinetic transient hit.

---

## 5. Broadcast Text Ducking Contract (`overlayTextDuck`) [RULE]

To prevent **dual-legibility collisions** (Rule `F04`), where text from Scene A is rendered simultaneously over text from Scene B creating an unreadable mess, f(x) Studio enforces a broadcast ducking curve:

$$\text{duck}(t_{\text{in}}, t_{\text{out}}) = \min\left(1, \max\left(0, (1 - \text{smoothstep}(0, 0.35, t_{\text{out}})) \cdot \text{smoothstep}(0.55, 1, t_{\text{in}})\right)\right)$$

```
OVERLAY TEXT DUCK PROGRESSION
1.0 ──────┐                                       ┌─────── 1.0 (Incoming Text)
          │                                       │
          │ (Outgoing Text)                       │
0.0       └───────────┬───────────────────────────┴─────── 0.0
          0%         35%                         55%      100%
```

### Implementation Rules:
1. **Outgoing Text:** Must reach $0\%$ opacity by $35\%$ of the exit duration ($t_{\text{out}} = 0.35$).
2. **Incoming Text:** Must remain at $0\%$ opacity until $55\%$ of the entrance duration ($t_{\text{in}} = 0.55$).
3. In `defineScene`, 2D overlay and title opacities automatically multiply by `ctx.overlayDuck`. Raw `Scene` subclasses must explicitly multiply overlay alphas by `overlayTextDuck(f.tin, f.tout)`.

---

## 6. Complete 3D Spatial Transition Template

```typescript
import * as THREE from 'three';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import type { Frame, PostOverrides } from '../engine/scene';
import { ease } from '../engine/util';

export default class SpatialWarpTransition implements Transition {
  private material: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(private ctx: TransitionCtx) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        texA: { value: null },
        texB: { value: null },
        progress: { value: 0 },
        direction: { value: new THREE.Vector2(1.0, 0.0) }, // Matches outgoing camera velocity
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D texA;
        uniform sampler2D texB;
        uniform float progress;
        uniform vec2 direction;
        varying vec2 vUv;

        void main() {
          vec2 offset = direction * progress;
          // Directional velocity stretch
          vec4 colA = texture2D(texA, vUv - offset * 0.4);
          vec4 colB = texture2D(texB, vUv + direction * (1.0 - progress) * 0.4);
          
          // Optical cross-fade with directional luminance bleed
          gl_FragColor = mix(colA, colB, smoothstep(0.2, 0.8, progress));
        }
      `,
    });

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(this.quad);
  }

  render(
    _f: Frame,
    out: THREE.WebGLRenderTarget,
    texA: THREE.Texture,
    texB: THREE.Texture,
    api: TransitionAPI
  ): PostOverrides | void {
    const gl = this.ctx.renderer;
    const progress = ease.inOutCubic(api.u);

    this.material.uniforms.texA.value = texA;
    this.material.uniforms.texB.value = texB;
    this.material.uniforms.progress.value = progress;

    gl.setRenderTarget(out);
    gl.clear(true, true, true);
    gl.render(this.scene, this.camera);
    gl.resetState(); // WebGL state cache restoration invariant
  }

  dispose(): void {
    this.quad.geometry.dispose();
    this.material.dispose();
  }
}
```

---

## 7. Seam Verification & Diagnostic Tooling (`stitch.ts`)

> **Note on Blended vs. Hard Cuts:** `stitch.ts` renders Scene A's last frame and Scene B's first frame side-by-side. For blended seams (whips, morphs, camera crashes), render real timeline frames across the seam (`bun scripts/render.ts stills --project <p> --t <list>`) and check for continuous velocity ramps.

Audit transitions using the **Seam Stitch Inspector**:

```bash
bun scripts/stitch.ts --from-scene scene_a --to-scene scene_b --t 6.25
```

### Generated Diagnostic Artifacts:
1. **`onion_seam.png` (False-Color Difference Overlay):**
   - Renders outgoing frame $N-1$ in green and incoming frame $N$ in magenta.
   - Highlights horizon tilt jumps, perspective misalignments, or carrier token spatial drift.
2. **`strip_seam.png` (10-Frame Filmstrip):**
   - Displays 10 consecutive frames spanning $\pm 250\text{ ms}$ across the seam cut.
   - Verifies smooth velocity continuity and ensures no single-frame blackout or whiteout flash occurs (Rule `F16`).

---

## 8. Pre-Flight Transition Checklist

Before finalizing any transition seam, verify:

- [ ] **Vector Direction:** Incoming scene camera velocity vector matches or complements outgoing camera motion.
- [ ] **Optical Consistency:** Depth of field blur or chromatic distortion matches across the seam cut.
- [ ] **State Restoration:** Transition render pass explicitly invokes `renderer.resetState()`.
- [ ] **Zero Text Collision:** Both scenes adhere to `overlayTextDuck` so titles never overlap during the seam.
- [ ] **Target Cleared:** The `out` buffer is cleanly cleared before drawing the transition quad.
- [ ] **Manifest Window:** `project.json` declares matching `from`, `to`, `at`, and `duration` with overlapping scene intervals.
- [ ] **Resource Disposal:** Geometries, materials, and internal render targets are disposed in `dispose()`.
- [ ] **Visual Audit:** Inspected `onion_seam.png` and `strip_seam.png` via `stitch.ts` with zero horizon tilt jumps.
