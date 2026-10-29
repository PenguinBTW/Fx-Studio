---
name: fx-transitions
description: Authoring standards, spatial continuity workflows, and seam engineering for bespoke scene-to-scene transitions in f(x) Studio. Use when connecting scenes, writing transition classes in app/src/transitions/, or fixing transition collisions.
---
# f(x) Studio: Bespoke Transitions & Seam Engineering

Standards, technical workflows, mathematical foundations, and spatial continuity rules for authoring bespoke transitions in **f(x) Studio**.

## When to Use

- Writing or modifying transition classes in `app/src/transitions/`.
- Connecting scenes in `project.json` using transition intervals and registration keys.
- Creating spatial match-cuts, velocity handoffs, camera crash morphs, or carrier transfers.
- Implementing scene-internal spatial transitions (`handlesTransition = true`) consuming `f.under`.
- Auditing cut seams using the Visual Seam Stitch Inspector (`stitch.ts`).
- Eliminating transition-seam text collisions (Rule `F04`) or horizon tilt pops.

---

## 1. Core Philosophy: Motivated Spatial Seams

Transitions in f(x) Studio are not generic canned wipes (e.g., stock blinds, random crossfades). Every transition must be an **intentional spatial seam** designed in concert with the scenes it connects:

- **Vector Continuity:** The entry camera trajectory of Scene B must inherit the exit velocity vector and focal direction of Scene A.
- **Physical Carriers:** Shared visual tokens (a 3D object, light flare, typography glyph, or geometric card) bridge the cut to guide viewer focus seamlessly across the threshold.
- **Decoupled Architecture:** Transition logic lives in standalone classes in `app/src/transitions/` so scene code remains clean, modular, and individually testable.

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
- **Scene Overlap:** The outgoing scene (`scene_a`) and incoming scene (`scene_b`) must overlap during this entire window.
- **Normalized Progress $u$:** The engine maps timeline time $t$ to normalized transition progress $u \in [0.0, 1.0]$.

---

## 3. The Three Transition Paradigms [RULE]

Select the appropriate paradigm based on the creative intent:

### Paradigm 1: Bespoke Standalone Transitions (Primary Pattern)
- Extends the `Transition` base class in `app/src/transitions/`.
- Owns the temporal seam externally between $[t_{\text{at}} - \text{dur}/2, t_{\text{at}} + \text{dur}/2]$.
- Receives pre-rendered HalfFloat textures of Scene A (`texA`) and Scene B (`texB`), normalized progress $u \in [0, 1]$, and access to `api.sampleScene()`.
- Used for match-cuts, velocity warps, directional push-glides, and shader fragmentations.

### Paradigm 2: Scene-Internal Spatial Handoffs (`handlesTransition = true`)
- Set `handlesTransition = true` in the incoming scene definition.
- The incoming scene directly consumes `f.under` (the rendered output texture of the outgoing scene) as an active 3D texture inside its own world space.
- The camera flies *through* a doorway, screen, vehicle mirror, or viewport card in Scene B, breaching the threshold to reveal the new environment.

### Paradigm 3: Clean Editorial Utility Cuts (Secondary Pattern)
- High-grade optical crossfades, subtle directional whips, or exposure whiteouts/blackouts.
- Used when a hard conceptual break or chapter pivot does not warrant a continuous spatial carrier.

---

## 4. The Power of `api.sampleScene(id, t)` [RULE]

Standard video transitions can only blend static pre-rendered video frames. In f(x) Studio, `api.sampleScene(id, t)` allows the transition to re-evaluate participant scenes at **arbitrary off-path timestamps**:

```typescript
// Sample Scene A at 2x forward speed to create an optical whip-out
const textureA = api.sampleScene(fromSceneId, tCut + (u * 2.0));

// Freeze Scene A at the exact cut timestamp while fracturing geometry
const frozenA = api.sampleScene(fromSceneId, tCut);

// Sample Scene B ahead of time to synchronize a light pulse
const textureB = api.sampleScene(toSceneId, tCut + 0.15);
```

### Common Use Cases:
- **Speed Ramping:** Accelerate the outgoing scene's camera or animation into a high-motion blur whip right at the seam.
- **Freeze & Shatter:** Freeze Scene A on impact, project the frozen texture onto 3D shards or cards, and disperse them to reveal Scene B.
- **Temporal Lead-In:** Sample Scene B slightly ahead of time to match a kinetic rotation or light sweep.

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
3. In `defineScene`, always multiply 2D overlay and title opacities by `ctx.overlayDuck(f.tin, f.tout)`.

---

## 6. Complete Transition Authoring Template

```typescript
import * as THREE from 'three';
import { Transition, type TransitionCtx, type TransitionSampleAPI } from '../engine/transition';
import { cubicEaseInOut } from '../engine/motion';

export default class KineticWhipTransition extends Transition {
  private material: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(ctx: TransitionCtx) {
    super(ctx);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        texA: { value: null },
        texB: { value: null },
        progress: { value: 0 },
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
        varying vec2 vUv;

        void main() {
          vec2 offset = vec2(progress, 0.0);
          vec4 colA = texture2D(texA, vUv - offset);
          vec4 colB = texture2D(texB, vUv + vec2(1.0 - progress, 0.0));
          gl_FragColor = mix(colA, colB, progress);
        }
      `,
    });

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.scene.add(this.quad);
  }

  render(
    texA: THREE.Texture,
    texB: THREE.Texture,
    u: number,
    out: THREE.WebGLRenderTarget,
    api: TransitionSampleAPI
  ): void {
    const gl = this.ctx.renderer;
    const progress = cubicEaseInOut(u);

    this.material.uniforms.texA.value = texA;
    this.material.uniforms.texB.value = texB;
    this.material.uniforms.progress.value = progress;

    gl.setRenderTarget(out);
    gl.clear(true, true, true);
    gl.render(this.scene, this.camera);
    gl.resetState(); // WebGL state cache restoration invariant
  }
}
```

---

## 7. Seam Verification & Diagnostic Tooling (`stitch.ts`)

> **Limit:** `stitch` renders scene A's last frame and scene B's first frame as two separate standalone frames. It does NOT render the blended transition, so on blended transitions (fades, morphs, camera crashes) it can report a false hard cut. For blended seams, render real timeline frames across the window (`bun scripts/render.ts stills --project <p> --t <list>`) and measure frame-to-frame pixel difference; a smooth ramp with no spike means no cut. Use `stitch` only for true hard cuts, and `onion` (which uses the real timeline) for motion trails.

Transitions must be visually audited using the **Seam Stitch Inspector** (hard cuts) plus timeline-frame sampling (blended seams):

```bash
bun scripts/stitch.ts --from-scene scene_a --to-scene scene_b --t 6.25
# (Alternative: bun scripts/render.ts stitch --from-scene scene_a --to-scene scene_b --t 6.25)
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
- [ ] **State Restoration:** Transition render pass explicitly invokes `renderer.resetState()`.
- [ ] **Zero Text Collision:** Both scenes use `overlayTextDuck` so titles never overlap during the seam.
- [ ] **Target Cleared:** The `out` buffer is cleanly cleared before drawing the transition quad.
- [ ] **Manifest Window:** `project.json` declares matching `from`, `to`, `at`, and `duration` with overlapping scene intervals.
- [ ] **Visual Audit:** Inspected `onion_seam.png` and `strip_seam.png` via `stitch.ts` with zero horizon tilt jumps.