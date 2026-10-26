# Core Engine Modules Reference (Universal Engine Modules v0.7.0)

**Platform Version**: v0.7.0  
**Implementation Directory**: [`app/src/engine/`](../../app/src/engine/)  

---

## Overview

The **f(x) Studio** engine provides 25 modular, decoupled building blocks. Each module addresses a specific domain in procedural motion design—camera choreography, physical optics, layout hierarchy, GPU vector primitives, physical solvers, particle simulation, multi-layer compositing, kinetic typography, multi-track audio, and headless export.

```
app/src/engine/
├── dsl.ts             # Module 12: Declarative Scene Authoring DSL (defineScene, SceneContext)
├── rig.ts             # Module 1: Universal Dual-Mode 6-DOF Camera Rig (CameraRig, dollyDistance)
├── transform.ts       # Module 2: Transform Hierarchy & Responsive Layout (TransformNode, LayoutNode)
├── text.ts            # Module 3: Universal Kinetic Typography Engine (KineticText)
├── sdf.ts             # Module 4: Analytic GPU Signed Distance Fields (SDFBatch)
├── motion.ts          # Module 5: Universal Motion Bus & Physical Solvers (MotionBus, motion)
├── particles.ts       # Module 6: Stateless Analytical GPU Particles (AnalyticalParticles)
├── graph.ts           # Module 7: Scoped Render Graph & Track Matte Compositor (CompositorGraph)
├── scenegraph.ts      # Module 8: Semantic Scene Graph & Entity Introspection (SceneGraph)
├── export.ts          # Module 9: Multi-Format Delivery & Headless Export (ExportPipeline)
├── tokens.ts          # Module 10: Pluggable Brand Design Token System (DesignTokens)
├── heal.ts            # Module 11: Directorial Self-Correction Contract (AgentHeal)
├── gltf.ts            # Module 13: Universal GLTF / GLB 3D Asset Loading & Instancing (GLTFManager)
├── material.ts        # Module 14: Procedural PBR Shader Materials (ProceduralMaterial)
├── text3d.ts          # Module 15: 3D Extruded Kinetic Typography (ExtrudedText)
├── post.ts            # Module 16: Cinematic Optical Post-Processing Pipeline (Post)
├── spectrum.ts        # Module 17: Physical Colour Science & CIE 1931 / Blackbody (spectrum.ts)
├── refract.ts         # Module 18: Cauchy Dispersion, Dielectric Fresnel & Rainbow Caustics (refract.ts)
├── noise.ts           # Module 19: Analytic Divergence-Free Curl Noise & Voronoi (noise.ts)
├── particles_large.ts # Module 20: 500k Stateless GPU Instanced Particle Engine (particles_large.ts)
├── ribbon.ts          # Module 21: Bishop RMF Parallel Transport & Aurora Curtains (ribbon.ts, aurora.ts)
├── curvemorph.ts      # Module 22: Continuous Curve Morph & Streamline Untangling (curvemorph.ts, treewalk.ts)
├── raymarch.ts        # Module 23: Multi-Tier Volumetric Raymarcher (raymarch.ts)
├── text_lighting.ts   # Module 24: In-World 3D Text Scene Lighting & Particle Deflection (text_lighting.ts)
├── events.ts          # Module 25: Multi-Track Audio Registry, Procedural SFX & Mixdown (mixdown.ts)
├── lines.ts           # Supporting: High-Throughput GPU Capsule Line Batching (LineBatch)
├── viewport.ts        # Supporting: Viewport Space Matrix & Coordinate Bridges (ViewportSpace)
└── driver.ts          # Supporting: Timeline Drivers (ClockDriver, AudioDriver, SpeechDriver)
```

---

## Module 1: Universal Dual-Mode 6-DOF Camera Rig ([`rig.ts`](../../app/src/engine/rig.ts))

The `CameraRig` provides cinematic 6-DOF flight paths and technical orthographic projections, solving camera flips, fisheye distortion, and non-deterministic trauma jitter.

### Core Capabilities
* **Dual Projection Modes**: Supports `'perspective'` (14mm–200mm focal lengths), `'isometric'` (fixed $35.264^\circ$ elevation angle, affine scaling), and `'orthographic'`.
* **Centripetal Catmull-Rom Spline Flight**: Waypoint interpolation with $O(1)$ arc-length lookup table (LUT) ensuring uniform travel velocity without acceleration spikes at knots.
* **Singular-Safe Orthonormal Frames (Bishop Frames)**: Evaluates camera forward vector $F_w$. If $|F_w \cdot Y| > 0.99$ (looking straight down into the floor), it seamlessly substitutes an alternate reference vector, preventing the gimbal flip bug common to naive LookAt math.
* **Focal Length Threshold Rule**: Values $< 300$ are interpreted as optical millimeters (e.g., $35\text{mm}$, $85\text{mm}$); values $\ge 300$ are interpreted as pixel-scale focal lengths.
* **Analytical Closed-Form Trauma Shake**: Trauma decay follows an exponential function:
  $$T(t) = \sum_i I_i \cdot e^{-(t - t_{0,i}) \cdot \text{decay}}$$
  Rotational shake $\Delta \theta = T(t)^2 \cdot \text{noise}(t \cdot \omega)$ is deterministic and identical forward or backward.

### TypeScript API
```typescript
export interface CameraWaypoint {
  t: number;            // Normalized trajectory progress [0..1] (required for spline sorting)
  pos: [number, number, number];
  target: [number, number, number];
  roll?: number;        // Roll angle in radians (default: 0)
  focalLength?: number; // mm (if < 300) or screen px (if >= 300)
}

export class CameraRig {
  mode: 'perspective' | 'isometric' | 'orthographic';
  position: [number, number, number];
  createDebugRibbon(scene?: THREE.Scene, samples?: number): THREE.Line | null;
  target: [number, number, number];
  roll: number;
  focalLengthMm: number;
  setLensMm(mm: number): this;
  setPath(waypoints: CameraWaypoint[]): this;
  evalPath(progress: number): this;
  evalCam(t: number): Cam;
  syncToThreeCamera(cam: Cam, threeCam: THREE.PerspectiveCamera | THREE.OrthographicCamera): void;
  addTrauma(intensity: number, t0: number, decay?: number): this;
}
```

---

## Module 2: Transform Hierarchy & Responsive Layout ([`transform.ts`](../../app/src/engine/transform.ts))

Provides local-to-world parent-child transform cascading with normalized pivot anchors and responsive safe-zone pinning.

### Core Capabilities
* **`TransformNode`**: Parent-child 3D hierarchy with lazy matrix caching. Supports normalized anchor offsets (`anchor: [0.5, 0.5, 0.0]` for center pivot) without moving mesh geometry.
* **`LayoutNode`**: Responsive 2D-in-3D layout container. Pins UI elements, HUD cards, and callouts to screen edges (`'top-left'`, `'bottom-center'`) with safe-zone margins ($40\text{px}$ broadcast title safe).
* **3D Vertex Pinning**: Anchors 2D callout leaders directly to moving 3D world coordinates $(X_w, Y_w, Z_w)$ with dynamic depth scaling:
  $$\text{scale}(z) = \frac{z_{\text{ref}}}{z}$$

### TypeScript API
```typescript
export class TransformNode {
  position: V3;
  rotation: V3; // Euler angles in radians
  scale: V3;
  anchor: V3;   // Normalized [0..1] pivot
  size: V3;
  parent: TransformNode | null;
  children: TransformNode[];

  getWorldMatrix(): THREE.Matrix4;
  getPivotWorldPosition(): V3;
  addChild(child: TransformNode): this;
}

export class LayoutNode extends TransformNode {
  pin: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  marginPx: [number, number];
  resolveLayout(viewportWidth: number, viewportHeight: number): void;
}
```

---

## Module 3: Universal Kinetic Typography Engine ([`text.ts`](../../app/src/engine/text.ts))

High-contrast kinetic typography with automatic line wrapping, knockout understroke halos, and zero-configuration telemetry emission.

### Core Capabilities
* **Knockout Understroke Halos**: Renders a thick, opaque background stroke (`haloColor: 'rgba(10, 13, 18, 0.95)'`, `haloWidth: 6`) behind glyph fills, guaranteeing WCAG contrast over noisy 3D geometry or particle storms.
* **Automatic Layout & Safe Wrapping**: Wraps text blocks based on `maxWidthPx`, preserving explicit newline characters and tracking line height.
* **Telemetry Interception**: All drawn text automatically populates `window.__motion.textProbes`, giving CI telemetry full visibility into reading dwell time, scale ratios, and potential bounding-box collisions.
* **Hershey Vector Stems**: Built-in support for single-stroke Hershey technical fonts ([`stroke.ts`](../../app/src/engine/stroke.ts)) for architectural drafting and blueprint formulas.

### TypeScript API
```typescript
export interface TextStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  alpha?: number;
  letterSpacing?: number | string;
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
}

export class KineticText {
  constructor(text: string, style?: TextStyle);
  get text(): string;
  setText(text: string): this;
  updateStyle(style: Partial<TextStyle>): this;
  setHalo(strokePx: number, color: string): this;
  anchorTo3D(pos: [number, number, number], depthScaling?: boolean): this;
  render(c2d: CanvasRenderingContext2D, t: number, x: number, y: number, staggerStates?: any[]): void;
  getScreenBounds(x: number, y: number): [number, number, number, number];
}
```

---

## Module 4: Analytic GPU Signed Distance Fields ([`sdf.ts`](../../app/src/engine/sdf.ts))

Instanced vector geometry renderer executing analytic SDF math directly in WebGL fragment shaders, completely bypassing CPU Canvas2D bottlenecks at 4K.

### Core Capabilities
* **Instanced SDF Primitives**: Renders rounded rectangles with individual per-corner radii, circular rings, analytic drop shadows, and targeting crosshairs using a single instanced quad draw call.
* **Per-Corner Radii Control**: Pass `[rTopLeft, rTopRight, rBottomRight, rBottomLeft]` to create asymmetrical tabs, message bubbles, or badge shapes without separate geometry allocations.
* **Analytic Soft Drop Shadows**: Evaluates smooth Gaussian-like drop shadows directly in the fragment shader without multi-pass Gaussian blur:
  $$d_{\text{shadow}} = \text{sdf}(p - \mathbf{offset})$$
  $$\alpha_{\text{shadow}} = \text{clamp}\left(1.0 - \frac{d_{\text{shadow}}}{\text{blur}}, 0.0, 1.0\right)$$
* **Analytic Anti-Aliased Trim Paths**: Renders stroked rings and borders with sub-pixel anti-aliasing via `fwidth()`:
  $$\alpha = \text{clamp}\left(0.5 - \frac{d}{\text{fwidth}(d)}, 0, 1\right)$$
* **WebGL State Cleanup**: Calls `renderer.resetState()` immediately following batch execution, preventing blend mode pollution.

### TypeScript API & Shader Usage
```typescript
export class SDFBatch {
  constructor(renderer: THREE.WebGLRenderer);
  
  drawRect(x: number, y: number, w: number, h: number, opts?: {
    cornerRadius?: number | [number, number, number, number]; // [tl, tr, br, bl]
    fillColor?: THREE.ColorRepresentation;
    strokeColor?: THREE.ColorRepresentation;
    strokeWidth?: number;
    shadowColor?: THREE.ColorRepresentation;
    shadowBlur?: number;
    shadowOffset?: [number, number];
  }): void;

  drawRing(cx: number, cy: number, radius: number, thickness: number, opts?: {
    color?: THREE.ColorRepresentation;
    startAngle?: number;
    endAngle?: number;
  }): void;

  flush(camera: THREE.Camera): void;
}
```

---

## Module 5: Universal Motion Bus & Physical Solvers ([`motion.ts`](../../app/src/engine/motion.ts))

Closed-form analytical solvers for physical springs, parametric bezier curves, LFO oscillators, and speech cues.

### Core Capabilities
* **Closed-Form Second-Order ODE Spring Solver**: Evaluates physical mass-spring-damper systems analytically for under-damped ($\zeta < 1$), critically-damped ($\zeta = 1$), and over-damped ($\zeta > 1$) configurations with non-zero initial velocity $v_0$:
  $$x(t) = 1 - e^{-\zeta \omega_n t} \left( \cos(\omega_d t) + \frac{\zeta \omega_n - v_0}{\omega_d} \sin(\omega_d t) \right)$$
* **LFO Waveforms**: Evaluates sine, triangle, sawtooth, and square oscillators with negative-time invariance.
* **Cubic Bezier Easing**: Analytical cubic bezier solver with bisection numerical fallback for complex velocity profiles.

### TypeScript API
```typescript
export class MotionBus {
  static spring(t: number, opts: {
    stiffness?: number; // k
    damping?: number;   // c
    mass?: number;      // m
    initialVelocity?: number; // v0
  }): number;

  static ease(t: number, p1x: number, p1y: number, p2x: number, p2y: number): number;
  static lfo(t: number, freqHz: number, wave: 'sine' | 'tri' | 'saw' | 'square'): number;
}
```

---

## Module 6: Stateless Analytical GPU Particles ([`particles.ts`](../../app/src/engine/particles.ts))

Stateless, deterministic particle system operating with zero simulation history.

### Core Capabilities
* **Static Allocation Guarantee**: Pre-allocates attribute buffers with `THREE.StaticDrawUsage`. Particles are never spawned or pushed across the PCIe bus during runtime rendering.
* **Closed-Form Ballistics**: Evaluates particle position at time $t$ analytically:
  $$\mathbf{P}_i(t) = \mathbf{P}_{0,i} + \mathbf{V}_{0,i} \cdot \tau_i + \frac{1}{2} \mathbf{g} \cdot \tau_i^2$$
  where $\tau_i = (t + \phi_i) \pmod{\text{lifespan}}$.
* **Quadratic Drag Falloff**: Incorporates non-linear drag without integration loops:
  $$\mathbf{V}_i(t) = \mathbf{V}_{0,i} \cdot e^{-\gamma \tau_i}$$
* **Sub-Frame Blur Robustness**: Evaluates identically under 324-spp supersampling without particle clumping or stutter because particles do not rely on $p_{t+dt} = p_t + v \cdot dt$ state accumulation.

---

## Module 7: Scoped Render Graph & Track Matte Compositor ([`graph.ts`](../../app/src/engine/graph.ts))

Multi-pass composition engine providing isolated render layers and dual-texture alpha/luma track mattes.

### Core Capabilities
* **Layer Isolation**: Renders foreground, midground, and background into separate offscreen targets.
* **Dual-Texture Track Mattes**: Supports `alpha` and `luma` track mattes (`matteMode: 'alpha' | 'luma' | 'inv-alpha' | 'inv-luma'`) directly on the GPU.
* **Hardware Blending Modes**: Hardware blending with `'normal'`, `'add'`, `'screen'`, and `'multiply'`.

### Track Matte Authoring Recipe
```typescript
import { CompositorGraph } from '../engine/graph';

// Reveal 3D text through an animated noise mask texture:
const graph = new CompositorGraph(renderer);

const textLayer = graph.addLayer('text_layer');
const maskLayer = graph.addLayer('mask_layer');

graph.setTrackMatte({
  sourceLayer: 'text_layer',
  maskLayer: 'mask_layer',
  mode: 'luma_matte', // Luma of mask_layer controls alpha of text_layer
});

graph.render(f, outputRenderTarget);
```

---

## Module 8: Semantic Scene Graph & Entity Introspection ([`scenegraph.ts`](../../app/src/engine/scenegraph.ts))

Spatial indexing system that exposes scene elements, semantic tags, and projected screen-space bounding boxes to autonomous agents and telemetry auditors.

### Core Capabilities
* **Semantic Tagging**: Registers entities with `id`, `role: 'hero' | 'ui' | 'environment' | 'typography'`, and `type`.
* **Automatic 3D OBB $\to$ 2D Screen AABB Projection**: Transforms 3D bounding boxes through the active camera frustum, outputting exact pixel coordinates `[minX, minY, maxX, maxY]`.
* **Collision Detection**: Computes intersection-over-union (IoU) across on-screen elements to catch text-on-text or text-on-UI collisions.

---

## Module 9: Multi-Format Delivery & Headless Export ([`export.ts`](../../app/src/engine/export.ts))

Industrial export pipeline driving headless Chromium via Playwright and streaming frames directly to FFmpeg.

### Core Capabilities
* **Delivery Presets**:
  * `mp4`: H.264 / AAC High-profile MP4.
  * `prores-4444`: Apple ProRes 4444 with 10-bit alpha channel.
  * `webm-alpha`: VP9 with transparent alpha channel.
  * `png-sequence`: Lossless 16-bit PNG sequence.
* **WebSocket Streaming**: Frame buffers stream over low-latency local WebSockets directly to FFmpeg `stdin`, bounding memory usage to $< 500\text{MB}$ even at 4K.
* **Hardware Video Encoding**: Supports AMD AMF hardware offload (`h264_amf`, `hevc_amf`, `av1_amf`) via `--gpu`.

---

## Module 10: Pluggable Brand Design Token System ([`tokens.ts`](../../app/src/engine/tokens.ts))

Centralized brand tokens and color palettes configuring both rendering shaders and CI color audits.

### Core Capabilities
* **Dynamic Palette Proxy**: Exposes tokens in sRGB, Linear-RGB (`LIN`), and CSS hex/rgba formats.
* **CIE $\Delta E_{76}$ Auditing**: Configures telemetry rules (`F11`, `F12`) to verify scenes remain within the brand color gamut.

---

## Module 11: Directorial Self-Correction Contract ([`heal.ts`](../../app/src/engine/heal.ts))

Self-healing bridge connecting visual diagnostic tool signals directly to machine-actionable repair instructions for autonomous coding agents.

### Core Capabilities
* **Machine-Actionable Directives**: Converts telemetry flags (`F04`, `F05`, `F13`, `F16`) into structured patch recommendations with exact file, line hint, and code snippets.
* **`findings.json` Emission**: Outputs structured remediation payloads that enable agents to automatically repair clipping, collisions, or timing glitches without human intervention.

---

## Module 12: Declarative Scene Authoring DSL & Strict Lifecycle ([`dsl.ts`](../../app/src/engine/dsl.ts))

The primary high-level authoring interface for autonomous agents and motion designers.

### Core Capabilities
* **Boilerplate Shield**: `defineScene()` wraps scene creation, automatically initializing `CameraRig`, `SDFBatch`, `AnalyticalParticles`, `LineBatch`, `Layer2D`, and `SceneGraph`.
* **Automatic WebGL Hygiene**: Automatically executes `renderer.resetState()` and flushes batch renderers after each frame.
* **Automatic Font & Asset Gating**: Waits for fonts and textures before invoking the author's render loop.

---

## Supporting Module: GPU Capsule Line Batching ([`lines.ts`](../../app/src/engine/lines.ts))

High-throughput instanced line renderer capable of drawing tens of thousands of anti-aliased 2D/3D lines per frame.

### GPU Buffer Layout
Lines are rendered as instanced rounded capsule segments using a single draw call:
- `aPosA` (`vec3`): World start coordinate $(x_1, y_1, z_1)$.
- `aPosB` (`vec3`): World end coordinate $(x_2, y_2, z_2)$.
- `aWidth` (`float`): Thickness of the line segment.
- `aColorA` / `aColorB` (`vec4`): RGBA start/end colors for gradient lines.
- `aFlags` (`float`): Mode bitfield (bit 0: screen-space vs world width; bit 1: dashed).

### Width Modes:
1. **Screen-Space Pixel Width (`pxWidth`)**:
   Line thickness remains constant on screen regardless of camera distance or focal length. Perfect for technical UI grids, measurement callouts, and wireframes.
2. **World-Space Physical Width**:
   Line thickness scales with perspective ($w \propto 1/z$). Perfect for physical cables, light beams, and architectural rods.

### Telemetry Linkage:
`LineBatch.frameSegs` tracks the exact count of submitted line segments per frame, directly feeding the telemetry engine's complexity counter (`segs`) to prevent GPU overload.

---

## Module 13: Universal GLTF / GLB 3D Asset Loading & Instancing ([`gltf.ts`](../../app/src/engine/gltf.ts))

Asynchronous preloader, asset cache, and skeleton-safe 3D model instancer for CAD assemblies, vehicles, electronics, and character rigs.

### Core Capabilities
* **Global Deduplicated Cache (`GLTFManager`)**: Loads and parses `.glb` / `.gltf` assets once via Promise memoization, preventing duplicate network/disk requests.
* **Deterministic Closed-Form Animation (`setTime`)**: Evaluates `AnimationMixer` at exact float timestamps `model.setTime(t, clip?)`, guaranteeing bit-identical skeletal poses during bidirectional scrubbing and 324-spp sub-frame supersampling.
* **Skeleton-Safe Instancing (`SkeletonUtils.clone`)**: Deeply clones bones, skinned meshes, and node hierarchies so multiple instances can be independently posed, moved, and animated without torn bone bindings.
* **Automatic Normalization (`center`, `fitToBox`)**: Instantly recenters arbitrary CAD models to $(0, 0, 0)$ and scales them to fit specified world bounding dimensions.
* **2D Screen Bounds Projection**: Projects 3D bounding box corners into 2D screen pixels `[minX, minY, maxX, maxY]` via `model.getScreenBounds(camera)`, expanding bounds to include active animated bones on `SkinnedMesh` instances to integrate with `SceneGraph` for automated text collision detection (`F04`).
* **Bundled Local Draco Support**: Official Draco WASM decoders are bundled in `app/public/draco/`, guaranteeing offline headless CI and air-gapped rendering without external network hits.

### TypeScript API
```typescript
export interface GLTFLoadOptions {
  dracoDecoderPath?: string;
  center?: boolean;
  fit?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  envMapIntensity?: number;
  material?: THREE.Material | ((mesh: THREE.Mesh, original: THREE.Material) => THREE.Material);
}

export class GLTFInstance {
  readonly root: THREE.Group;
  readonly animations: THREE.AnimationClip[];
  readonly meshes: THREE.Mesh[];
  
  setTime(timeInSeconds: number, clipName?: string, opts?: { loop?: boolean; timeScale?: number }): this;
  play(clipName: string, opts?: { loop?: boolean; timeScale?: number }): THREE.AnimationAction | null;
  getBounds(target?: THREE.Box3, includeBones?: boolean): THREE.Box3;
  getSize(target?: THREE.Vector3, includeBones?: boolean): THREE.Vector3;
  center(includeBones?: boolean): this;
  fitToBox(maxDimension: number, includeBones?: boolean): this;
  getScreenBounds(camera: THREE.Camera, width?: number, height?: number): [number, number, number, number];
  setMaterial(material: THREE.Material): this;
  dispose(): void;
}

export class GLTFManager {
  static load(url: string, opts?: GLTFLoadOptions): Promise<GLTFAsset>;
  static instantiate(url: string, opts?: GLTFLoadOptions): Promise<GLTFInstance>;
  static setDracoDecoderPath(path: string): void;
  static clearCache(): void;
}
```

