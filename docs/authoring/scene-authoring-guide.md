# Scene Authoring Guide: Declarative DSL & Raw Scenes

This guide explains how to construct procedural motion graphics scenes in **f(x) Studio**.

Whether generating product reveals, UI interaction showcases, 3D particle choreographies, or kinetic typography music videos, the engine supports two first-class authoring paradigms:
- **A. Declarative DSL (`defineScene`)**: High-productivity path where the engine manages scene graphs, batches, camera projection, telemetry synchronization, and WebGL state restoration automatically. *(Recommended for $90\%$ of scenes).*
- **B. Raw `Scene` Subclass**: Low-level path giving full ownership of custom WebGL render targets, multi-pass shaders, compute textures, and manual GL state.

---

## 1. Declarative DSL (`defineScene`)

The declarative DSL provides a managed `SceneContext` equipped with instanced particle emitters, vector stroke batchers, 2D layers, SDF rasterizers, hierarchical scene graphs, and design token integration.

### Minimal Declarative Example
```typescript
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { cubicEaseOut } from '../../engine/motion';
import type { Frame } from '../../engine/scene';

export default defineScene({
  id: 'product_hero_reveal',
  duration: 8.0, // Advisory metadata only; timeline driver in project.json owns start/end

  setup(ctx: SceneContext) {
    // 1. Configure camera rig or waypoints
    ctx.rig.setLensMm(35);

    // 2. Add stateless analytical particle emitters
    ctx.particles.addEmitter('sparkles', {
      capacity: 1000,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      spread: 0.8,
      speed: 1.2,
      color: [1.0, 0.3, 0.1, 0.8],
      glow: 1.5,
    });

    // 3. Declare typography node
    ctx.text('hero_title', 'NEXT-GEN COMPOSITOR', {
      fontSize: 54,
      fontFamily: 'Inter, sans-serif',
      fontWeight: 700,
      color: ctx.tokens.bone,
      align: 'center',
    });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    // f.t: Global timeline time in seconds
    // f.lt: Local scene time (0.0 to 8.0s)
    // f.p: Scene progress (0.0 to 1.0)
    const enterEase = cubicEaseOut(Math.min(1.0, f.lt / 2.0));

    // 1. Update camera rig flight
    ctx.rig.position = [0, 1.5, 6.0 - 2.0 * enterEase];
    ctx.rig.target = [0, 0.5, 0];
    ctx.updateCamera(f.t, f.p);

    // 2. Render kinetic text (rendered to 2D layer; bounds tracked in SceneGraph)
    ctx.renderText('hero_title', ctx.layer2d.ctx, f.t, 960, 240);

    // 3. MANDATORY INVARIANT: Flush GPU lines, SDF quads, and 2D canvas layer to output target
    ctx.flush(out);

    // 4. Return dynamic post-processing overrides
    return {
      bloom: 0.25 + 0.10 * f.a.kick, // Pulse bloom with kick drum transient
      vignette: 0.35,
    };
  },

  dispose() {
    // Custom allocations cleaned up here (ctx automatically disposes core batches)
  },
});
```

---

## 2. Raw `Scene` Subclass

For complex scenes requiring custom render targets, raw compute shaders, or specialized GL pipeline integration, subclass `Scene` directly (`app/src/engine/scene.ts`).

### Raw Scene Lifecycle
```typescript
import { Scene, type SceneCtx, type Frame, type PostOverrides } from '../../engine/scene';
import { makeRT } from '../../engine/gl';
import * as THREE from 'three';

export default class CustomVolumetricCloud extends Scene {
  private rt: THREE.WebGLRenderTarget;
  private customMaterial: THREE.RawShaderMaterial;
  private mesh: THREE.Mesh;
  private scene3D = new THREE.Scene();
  private cam3D = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 1000);

  constructor(ctx: SceneCtx) {
    super(ctx);
    // Allocates HalfFloat linear HDR target scaled to output resolution
    this.rt = makeRT(ctx.W, ctx.H);
  }

  async init(): Promise<void> {
    // Compile custom shaders, load textures, build geometries
    const geo = new THREE.BoxGeometry(2, 2, 2);
    this.customMaterial = new THREE.RawShaderMaterial({
      vertexShader: `...`,
      fragmentShader: `...`,
    });
    this.mesh = new THREE.Mesh(geo, this.customMaterial);
    this.scene3D.add(this.mesh);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const gl = this.ctx.renderer;

    // INVARIANT 1: Output target must be fully overwritten or cleared
    gl.setRenderTarget(out);
    gl.clearColor(0.02, 0.02, 0.03, 1.0);
    gl.clear(true, true, true);

    // INVARIANT 2: Closed-form determinism f(t)
    this.mesh.rotation.y = f.t * 0.5;

    gl.render(this.scene3D, this.cam3D);

    // INVARIANT 3: WebGL state cache must be restored
    gl.resetState();

    return {
      bloom: 0.20,
    };
  }

  dispose(): void {
    this.rt.dispose();
    this.customMaterial.dispose();
    this.mesh.geometry.dispose();
  }
}
```

---

## 3. The `Frame` Evaluation Object

Every invocation of `render(f, out)` delivers a comprehensive `Frame` object:

| Field | Type | Description |
| :--- | :--- | :--- |
| `f.t` | float (s) | Global timeline time in seconds. Monotonically advancing on playback/export. |
| `f.dt` | float (s) | Delta time ($1/\text{fps}$ during export). **Equals 0 immediately following a timeline seek.** |
| `f.lt` | float (s) | Local scene time ($t - \text{start}$). |
| `f.p` | float ($0 \dots 1$) | Normalized progress across scene lifespan ($lt / (\text{end} - \text{start})$). |
| `f.seeked` | boolean | `true` if the timeline jumped. Stateful scenes must reset simulation accumulators. |
| `f.preroll`| boolean | `true` during headless fast-forward simulations. Skip non-essential graphics passes. |
| `f.under` | Texture \| null | Outgoing scene's rendered texture during transition overlap. |
| `f.tin` | float ($0 \dots 1$) | Entrance blend progress ($0 \to 1$ during entrance overlap; strictly $1.0$ otherwise). |
| `f.tout`| float ($0 \dots 1$) | Exit blend progress ($0 \to 1$ during exit overlap; strictly $0.0$ otherwise). |
| `f.a` | `AudioSample` | Audio envelopes ($0 \dots 1$) and transient decay pulses (`kick`, `snare`, `hat`, `vonset`). |

---

## 4. Closed-Form Determinism vs. Stateful Simulations

> [!IMPORTANT]
> **The Determinism Invariant**:
> Render outputs must be a **pure, closed-form function of time**:
> $$\text{Output} = f(t)$$
> Never accumulate mutable variables across frames (`x += speed * dt`). Mutable accumulators drift between interactive playback (variable fps) and headless offline export (strict 60 fps), producing inconsistent motion.

### Stateful Scene Exception
If a physical simulation strictly requires numerical integration (e.g. cloth solver or rigid-body collision):
1. Mark `stateful = true` on the scene class.
2. Implement `reset()` to restore the initial state vector $\mathbf{s}_0$.
3. When the engine seeks, it calls `reset()` and fast-forwards through time at $1/60\,\text{s}$ steps with `f.preroll = true`.
4. *Note: Adaptive supersampling (`--samples auto`) throws an exception if any active scene is stateful, because sub-frames evaluate non-chronologically.*

---

## 5. Multi-Domain Authoring Patterns (Universal Recipes)

**f(x) Studio** is an unopinionated procedural motion graphics engine. It does not dictate aesthetic style, genre, or color palette. The following patterns demonstrate how to build across the major motion design disciplines:

### Pattern A: UI/UX Component Choreography & Spatial Cards
For software showcases, mobile interfaces, and spatial computing operating systems, use `SDFBatch` for sub-pixel rounded rectangles, analytic drop shadows, and auto-layout cascades:

```typescript
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { spring } from '../../engine/motion';
import type { Frame } from '../../engine/scene';

export default defineScene({
  id: 'ui_card_interaction',

  setup(ctx: SceneContext) {
    // Declare cached typography nodes
    ctx.text('card_title', 'Payment Authenticated', {
      fontSize: 32,
      fontFamily: 'Inter, -apple-system, sans-serif',
      fontWeight: 600,
      color: '#0A0A0B',
      align: 'center',
    });
    ctx.text('card_sub', 'Transaction ID #849201 // Encrypted', {
      fontSize: 18,
      fontFamily: 'Inter, -apple-system, sans-serif',
      color: '#666666',
      align: 'center',
    });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    // 1. Spring-damped modal card expansion
    const cardScale = spring(f.lt, { mass: 1.0, stiffness: 180.0, damping: 14.0, initialVelocity: 0.2 });
    const cardAlpha = Math.min(1.0, f.lt / 0.4);

    // 2. High-performance GPU SDF Card with Analytic Soft Drop Shadow
    ctx.card('modal_card', {
      x: 960 - (320 * cardScale),
      y: 540 - (200 * cardScale),
      w: 640 * cardScale,
      h: 400 * cardScale,
      radius: [16, 16, 16, 16], // [tl, tr, br, bl]
      fill: [0.95, 0.95, 0.96, 1.0], // Linear RGBA
      shadow: {
        blur: 32,
        offset: [0, 16],
        color: [0, 0, 0, 0.25],
      },
      opacity: cardAlpha,
    });

    // 3. Render typography cascade
    if (f.lt >= 0.15) {
      ctx.renderText('card_title', ctx.layer2d.ctx, f.t, 960, 480);
    }
    if (f.lt >= 0.30) {
      ctx.renderText('card_sub', ctx.layer2d.ctx, f.t, 960, 530);
    }

    // 4. Flush batches to target
    ctx.flush(out);

    return { bloom: 0.0, vignette: 0.0 }; // Clean, sharp UI without filmic bloom
  },
});
```

---

### Pattern B: Commercial 3D Product & Hardware Reveal
For luxury hardware teasers, unibody electronics, or industrial product reveals, combine PBR materials, studio rim lighting, and precision macro camera orbits:

```typescript
import * as THREE from 'three';
import { Scene, type Frame, type SceneCtx, type PostOverrides } from '../../engine/scene';
import { cubicEaseInOut } from '../../engine/motion';

export default class HardwareProductRevealScene extends Scene {
  private scene3D = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 50);
  private productGroup = new THREE.Group();
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;

  constructor(ctx: SceneCtx) {
    super(ctx);

    // 1. Studio lighting rig (Key, Fill, Rim)
    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    this.keyLight.position.set(4, 6, 5);
    
    this.rimLight = new THREE.DirectionalLight(0x93c5fd, 3.2); // Cool metallic rim accent
    this.rimLight.position.set(-5, 4, -4);

    this.scene3D.add(ambient, this.keyLight, this.rimLight);

    // 2. Machined aluminum / glass unibody chassis
    const chassisGeo = new THREE.CylinderGeometry(2.0, 2.0, 0.35, 64);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,       // Dark titanium
      metalness: 0.92,
      roughness: 0.18,       // Polished anisotropic sheen
    });
    const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
    this.productGroup.add(chassisMesh);
    this.scene3D.add(this.productGroup);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const gl = this.ctx.renderer;
    const progress = Math.min(1.0, f.lt / 4.0);
    const ease = cubicEaseInOut(progress);

    // Controlled turntable rotation & tilt
    this.productGroup.rotation.y = f.t * 0.4;
    this.productGroup.rotation.x = 0.35 * Math.sin(f.t * 0.3);

    // Macro camera sweep gliding from 3/4 detail into full view
    this.camera.position.set(
      Math.sin(ease * 0.8) * 6.5,
      1.8 - 0.6 * ease,
      8.0 - 2.5 * ease
    );
    this.camera.lookAt(0, 0, 0);

    gl.setRenderTarget(out);
    gl.clearColor(0.04, 0.04, 0.05, 1.0);
    gl.clear(true, true, true);
    gl.render(this.scene3D, this.camera);
    gl.resetState();

    return {
      bloom: 0.12,          // Subtle specular gleam on chamfered edges
      bloomThreshold: 0.85, // Only hot specular reflections bloom
      vignette: 0.25,
    };
  }

  dispose(): void {
    // Release geometry & materials
  }
}
```

---

### Pattern C: Brand Identity, Typography & Kinetic Logo Resolves
For title sequences, broadcast bumpers, and vector identity reveals, use single-stroke path write-ons, tracking expansion, and clean geometry:

```typescript
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import { cubicEaseOut, quadEaseInOut } from '../../engine/motion';
import type { Frame } from '../../engine/scene';

export default defineScene({
  id: 'brand_kinetic_resolve',

  setup(ctx: SceneContext) {
    ctx.text('brand_title', 'A E T H E R', {
      fontSize: 56,
      fontFamily: 'Cinzel, Georgia, serif',
      color: '#FFFFFF',
      align: 'center',
    });
    ctx.text('tagline', 'AUTONOMOUS INTELLIGENCE SYSTEMS', {
      fontSize: 14,
      fontFamily: 'Inter, sans-serif',
      letterSpacing: '4px',
      color: 'rgba(255, 255, 255, 0.65)',
      align: 'center',
    });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const enter = cubicEaseOut(Math.min(1.0, f.lt / 1.8));

    // 1. Render minimalist editorial brand title
    ctx.renderText('brand_title', ctx.layer2d.ctx, f.t, 960, 520);

    // 2. Precision hairline divider expanding from center via LineBatch
    const lineHalfWidth = 240 * enter;
    ctx.lines.seg2(
      960 - lineHalfWidth, 565,
      960 + lineHalfWidth, 565,
      1.5,
      [1.0, 1.0, 1.0],
      0.45 * enter
    );

    // 3. Subtle corporate tagline fade-in
    if (f.lt >= 1.2) {
      ctx.renderText('tagline', ctx.layer2d.ctx, f.t, 960, 605);
    }

    // 4. Flush lines and 2D typography to output target
    ctx.flush(out);

    return { bloom: 0.05, ca: 0.0 }; // Pristine optical clarity
  },
});
```

---

### Pattern D: Data Visualization, Telemetry & Coordinate Grids
For technical infographics, dashboards, network graphs, and financial/scientific visuals, use `LineBatch` for coordinate grids and real-time metric curves:

```typescript
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame } from '../../engine/scene';

export default defineScene({
  id: 'telemetry_grid_infographic',

  setup(ctx: SceneContext) {
    ctx.text('telemetry_label', '', {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 20,
      color: '#00F0FF',
    });
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    const W = 1920, H = 1080;

    // 1. Clean background coordinate grid via LineBatch
    const GRID_STEP = 80;
    for (let x = GRID_STEP; x < W; x += GRID_STEP) {
      ctx.lines.seg2(x, 0, x, H, 1.0, [1, 1, 1], 0.05);
    }
    for (let y = GRID_STEP; y < H; y += GRID_STEP) {
      ctx.lines.seg2(0, y, W, y, 1.0, [1, 1, 1], 0.05);
    }

    // 2. Dynamic live data waveform evaluated in closed form
    const POINTS = 64;
    for (let i = 0; i < POINTS - 1; i++) {
      const x1 = 360 + (i / POINTS) * 1200;
      const x2 = 360 + ((i + 1) / POINTS) * 1200;
      
      const y1 = 540 + Math.sin(f.t * 3.0 + i * 0.25) * 140 * Math.cos(i * 0.1);
      const y2 = 540 + Math.sin(f.t * 3.0 + (i + 1) * 0.25) * 140 * Math.cos((i + 1) * 0.1);

      ctx.lines.seg2(x1, y1, x2, y2, 2.5, [0.0, 0.94, 1.0], 1.0);
    }

    // 3. Real-time telemetry callout label
    ctx.text('telemetry_label', `SYSTEM THROUGHPUT: ${(42.5 + Math.sin(f.t * 2.0) * 8.2).toFixed(2)} GB/s`);
    ctx.renderText('telemetry_label', ctx.layer2d.ctx, f.t, 360, 340);

    // 4. Flush to target
    ctx.flush(out);

    return { bloom: 0.20, vignette: 0.15 };
  },
});
```

---

### Pattern E: Generative Systems & Particle Dynamics
For abstract artistic visuals, atmospheric backgrounds, or fluid vortexes, use closed-form stateless particles:

```typescript
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../engine/dsl';
import type { Frame } from '../../engine/scene';

export default defineScene({
  id: 'generative_field_particles',

  setup(ctx: SceneContext) {
    // Add stateless GPU particle emitters with closed-form seed generation
    ctx.particles.addEmitter('vortex', {
      capacity: 4000,
      origin: [0, 0, 0],
      direction: [0, 1, 0],
      speed: 2.0,
      spread: 1.2,
      lifetime: 3.5,
      turbulence: 0.35,
      color: [0.91, 0.89, 0.85, 0.7],
      glow: 1.8,
    });

    ctx.rig.setLensMm(28);
  },

  render(ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) {
    // 1. Orbiting camera flight
    ctx.rig.position = [Math.sin(f.t * 0.2) * 9.0, 4.0, Math.cos(f.t * 0.2) * 9.0];
    ctx.rig.target = [0, 0, 0];
    ctx.updateCamera(f.t, f.p);

    // 2. Render particle system to target
    ctx.particles.render(ctx.renderer, out, ctx.threeCam, f.t);

    // 3. Flush 2D overlay if any text/cards exist
    ctx.flush(out);

    return { bloom: 0.35, vignette: 0.3 };
  },
});
```

---

## 6. Directorial Checklist for Scene Authoring

Before shipping or reviewing a new scene, verify each item against engine standards:

- [ ] **100% Deterministic $f(t)$**: Scrub the scene backwards and forwards in the interactive runner. Does the visual state land identically on frame $t$?
- [ ] **Target Cleared or Overwritten**: Does the scene fully overwrite or clear the output render target every frame?
- [ ] **WebGL State Restoration**: Is `renderer.resetState()` called if custom WebGL passes or raw shaders modify GL state?
- [ ] **Text Ducking Implemented**: Does typography honor `f.tin` and `f.tout` via `overlayTextDuck` so it never collides with adjacent scenes?
- [ ] **High-Contrast Knockout**: Are text elements backed by a dark/light halo or container to guarantee WCAG $\ge 4.5:1$ contrast against moving 3D geometry?
- [ ] **Clean Asset Disposal**: Does `dispose()` release all GPU geometries, materials, textures, and custom render targets?
