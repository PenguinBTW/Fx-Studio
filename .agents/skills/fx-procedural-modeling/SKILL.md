---
name: fx-procedural-modeling
description: Procedural code-only 3D geometry, PBR materiality, spectral optics (blackbody, Cauchy dispersion), twist-free Bishop ribbons, 500k GPU curl particles, raymarched SDFs, and Minimalist-3D architecture in f(x) Studio.
---
# f(x) Studio: Procedural 3D Modeling, Shaders & Volumetrics

Technical standards, procedural algorithms, optical physics, and shader pipelines for building **code-only 3D visual environments, mechanical assemblies, dynamic ribbons, and atmospheric volumetrics** in **f(x) Studio** without importing external `.glb` models, raster textures, or image files.

## When to Use

- Authoring scenes with strict "code-only / zero-asset" directives.
- Generating mechanical components (switches, chassis grooves, knurled knobs, pawls) from parametric math.
- Implementing procedural PBR materials (brushed titanium, frosted glass, matte polymers, glowing bevels).
- Lighting procedural scenes with physical Planckian blackbodies and CIE 1931 spectra (`spectrum.ts`).
- Simulating optical dispersion and caustics through Cauchy refraction models (`refract.ts`).
- Sweeping dynamic, twist-free 3D ribbons along curves using Bishop rotation-minimizing frames (`ribbon.ts`).
- Emitting 100k–500k instanced GPU particles with 3D curl noise and analytic trails (`particles_large.ts`).
- Raymarching 3D Signed Distance Fields (SDFs) and recursive zoom-fold fractals in raw GLSL.

---

## 1. Upstream & Sibling Dependencies

- **`fx-scenes`**: The primary authoring target where procedural geometry and shaders are registered within `defineScene` or custom `Scene` subclasses.
- **`viopls-art-direction`**: Enforces palette tokens (`--void`, `--bone`, `--ash`, `--signal`), motivated single-world lighting, and anti-slop rules.
- **`fx-engine-dev`**: Governs WebGL state restoration (`renderer.resetState()`), static GPU buffer allocation, and shader compilation.
- **`fx-diagnostics`**: Auditing procedural camera paths (`cam_godview.png`) and edge shimmer (`F15`).

---

## 2. The Code-Only Philosophy: Mathematics as Geometry

In procedural motion design, virtual objects are not sculpted vertex-by-vertex in external CAD software. They are analytical mathematical expressions evaluated directly on the GPU or instantiated once as parametric buffer arrays:

- **Infinite Resolution**: Parametric curves and analytical SDFs never pixelate or show polygonal faceting when the camera pushes into extreme macro close-ups.
- **Stateless Determinism**: Procedural deformations, displacements, and sparks must evaluate cleanly as pure functions of local time:
  $$\text{State} = f(t)$$
- **Zero Asset Waterfall**: Eliminates HTTP asset loading, Draco WASM decompression delays, and texture decoding freezes in headless CI export.

---

## 3. Procedural Mechanical Primitives

### 3.1 Extruded Rounded Slots & Mechanical Sliders
Construct precise mechanical slots (door switch housings, chassis grooves) using parametric extruded shapes:

```typescript
import * as THREE from 'three';

export function createMechanicalSlot(
  length: number,
  width: number,
  depth: number,
  bevel: number
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const r = width / 2;
  const l = length - width;

  // Stadium / Pill 2D profile
  shape.absarc(l / 2, 0, r, -Math.PI / 2, Math.PI / 2, false);
  shape.absarc(-l / 2, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  geom.center();
  return geom;
}
```

### 3.2 Grip Ridges via Sine Normal Displacement
For physical tactile knobs and levers, generate micro-grip knurling directly on vertices or in the vertex shader:

```glsl
// Vertex Shader: Sine Knurling Displacement
uniform float uRidgeCount;
uniform float uRidgeDepth;
varying vec3 vNormal;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 pos = position;
  
  // High-frequency grip serrations along primary axis
  float displacement = sin(uv.x * uRidgeCount * 6.28318) * uRidgeDepth;
  pos += normal * displacement;
  
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
```

---

## 4. Procedural Materiality & Spectral Optics

### 4.1 Procedural PBR Material Presets (`material.ts`)
f(x) Studio provides optimized procedural PBR materials ready for Three.js meshes inside `app/src/engine/material.ts`:

```typescript
import { ProceduralMaterial } from '../../engine/material';

// Brushed titanium / bone chassis
const chassisMat = ProceduralMaterial.brushedMetal({
  baseColor: '#E8E4DA', // --bone
  roughnessX: 0.15,
  roughnessY: 0.65,
  grooveScale: 400.0,
});

// Frosted optical glass
const glassMat = ProceduralMaterial.frostedGlass({
  baseColor: '#FFFFFF',
  opacity: 0.92,
  roughness: 0.15,
  fresnelPower: 2.5,
});

// Matte industrial polymer
const polymerMat = ProceduralMaterial.mattePolymer({
  color: '#050506', // --void
  roughness: 0.75,
});
```

### 4.2 Spectral Blackbody & Cauchy Refraction Optics (`spectrum.ts`, `refract.ts`)
Instead of arbitrary colors, light procedural assemblies using real optical physics:
- **Planckian Blackbody Radiators:** Calculate physical color temperature ($1000\text{K} - 12000\text{K}$):
  ```typescript
  import { blackbodyToLinearSRGB } from '../../engine/spectrum';
  const [r, g, b] = blackbodyToLinearSRGB(3400); // 3400K tungsten
  light.color.setRGB(r, g, b);
  ```
- **Cauchy Dispersion:** When rendering transparent crystal or glass geometry, evaluate wavelength-dependent refraction:
  $$n(\lambda) = A + \frac{B}{\lambda^2}$$
  Use `waterIOR(lambdaNm)` or `waterIOREmpirical(lambdaNm)` from `app/src/engine/refract.ts` to disperse chromatic fringes accurately.

---

## 5. Twist-Free Dynamic Ribbons via Bishop Frames (`ribbon.ts`)

Standard Three.js `TubeGeometry` suffers from catastrophic axis-flipping (gimbal lock and twisting) when paths loop or turn vertically. f(x) Studio uses **Bishop Rotation-Minimizing Frames (RMF)** to generate completely twist-free ribbons along 3D curves:

```typescript
import * as THREE from 'three';
import { RibbonGeometry } from '../../engine/ribbon';

// Generate ribbon along a parametric Catmull-Rom spine:
const ribbonGeom = new RibbonGeometry({
  segments: 128,
  width: (s, t) => 0.15 * Math.sin(s * Math.PI), // Tapered ends
  twist: (s, t) => s * 0.5,                       // Controlled structural twist
  spine: (t, s) => {
    // Pure closed-form 3D curve f(t, s)
    const angle = s * Math.PI * 2 + t * 0.2;
    return [
      Math.sin(angle) * 3.0,
      s * 2.0 - 1.0,
      Math.cos(angle) * 3.0,
    ];
  },
  time: 0,
});

const ribbonMesh = new THREE.Mesh(ribbonGeom, chassisMat);
scene.add(ribbonMesh);

// Inside render(f): update geometry dynamically without heap allocation
ribbonGeom.updateFromTime(f.lt);
```

---

## 6. High-Capacity Volumetrics: 500k GPU Curl Particles (`particles_large.ts`)

For atmospheric dust, cosmic voids, magnetic field lines, or data streams, never use CPU particle arrays. Deploy `LargeParticles`:

```typescript
import { LargeParticles } from '../../engine/particles_large';

// Allocate 200,000 instanced particles once during setup:
const particles = new LargeParticles(200000);
particles.configure({
  count: 200000,
  mode: 'free',                 // 'free' | 'press' | 'spiral' | 'fall' | 'star'
  style: 'streak',              // 'disc' | 'streak' | 'points'
  seed: 42,
  size: [0.005, 0.025],
  color: { mode: 'blackbody', range: [2400, 6500] }, // Planckian Kelvin range (2400K amber to 6500K daylight)
  turbulence: { amp: 1.2, freq: 0.4, drift: 0.1 },   // 3D GPU curl noise (curlNoise3J)
  free: {
    center: [0, 0, 0],
    shell: [0.5, 6.0],
    dir: [0, 0.5, 1],
    speed: 0.8,
  },
});
scene.add(particles);

// Render loop: stateless evaluation p(seed, t)
particles.update(f.lt);
```

- **Zero Memory Accumulation:** Each vertex evaluates its closed-form trajectory directly on the GPU. Trails re-evaluate $t - k \cdot dt$ with zero history buffers.

---

## 7. Minimalist-3D Wireframe Architectures via `LineBatch`

For abstract structural rooms, industrial interiors, and schematic layouts:

```typescript
import { LineBatch } from '../../engine/lines';

export function buildSchematicRoom(lines: LineBatch, size = 10.0, step = 1.0): void {
  const half = size / 2;
  const colBase = [0.42, 0.41, 0.40, 0.8]; // --ash at 80%
  const colFloor = [0.25, 0.25, 0.24, 0.4];

  // 1. Structural Floor Grid (lines.seg(ax, ay, az, bx, by, bz, width, r, g, b, a))
  for (let x = -half; x <= half; x += step) {
    lines.seg(x, 0, -half, x, 0, half, 1.5, colFloor[0], colFloor[1], colFloor[2], colFloor[3]);
  }
  for (let z = -half; z <= half; z += step) {
    lines.seg(-half, 0, z, half, 0, z, 1.5, colFloor[0], colFloor[1], colFloor[2], colFloor[3]);
  }

  // 2. Room Outer Bounding Pillars
  lines.seg(-half, 0, -half, -half, size, -half, 2.5, colBase[0], colBase[1], colBase[2], colBase[3]);
  lines.seg(half, 0, -half, half, size, -half, 2.5, colBase[0], colBase[1], colBase[2], colBase[3]);
  lines.seg(-half, 0, half, -half, size, half, 2.5, colBase[0], colBase[1], colBase[2], colBase[3]);
  lines.seg(half, 0, half, half, size, half, 2.5, colBase[0], colBase[1], colBase[2], colBase[3]);
}
```

- **Anti-Clipping Edge Subdivision**: For camera paths flying through rooms, subdivide any segment longer than 0.5 metres (`Math.ceil(length / 0.5)`). This prevents near-plane frustum clipping artifacts.

---

## 8. Raymarched Signed Distance Fields & Zoom-Fold Fractals

When scripts demand infinite recursive geometry (e.g., an interlocking mechanism repeating at every scale of civilization):

```glsl
// Fragment Shader: Self-Similar Scale-Fold Fractal
uniform float uTime;
uniform float uZoomProgress; // Exponential zoom progress [0.0 to 1.0]
uniform vec2 uResolution;

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
  float scaleFactor = exp(13.8155 * uZoomProgress); // 10^6 zoom over duration
  vec2 p = uv * scaleFactor;

  float d = 1e6;
  float cellScale = 1.0;

  for (int i = 0; i < 5; i++) {
    vec2 pCell = mod(p + 1.5, 3.0) - 1.5; // Spatial folding grid
    float dOctave = sdBox(pCell * cellScale, vec2(0.3, 0.3)) / cellScale;
    d = min(d, dOctave);
    p *= 6.0;
    cellScale *= 6.0;
  }

  float aa = fwidth(d);
  float mask = smoothstep(aa, -aa, d);
  vec3 color = mix(vec3(0.02, 0.02, 0.02), vec3(0.91, 0.89, 0.85), mask);
  gl_FragColor = vec4(color, 1.0);
}
```

---

## 9. Pre-Flight Procedural Modeling Checklist

Before approving procedural geometry or custom shaders:

- [ ] **Zero External Assets:** Scene requires zero `.glb`, `.png`, or `.jpg` network requests.
- [ ] **Pure Determinism:** Displacements, ribbons, and particles evaluate from `f.lt` or `f.t` without accumulators.
- [ ] **Palette Discipline:** Adheres strictly to token colors (`--void`, `--bone`, `--ash`, `--signal`) and physical blackbody kelvins.
- [ ] **Edge Anti-Aliasing:** All shader SDFs and barycentric lines use `fwidth()` derivatives for sub-pixel anti-aliasing.
- [ ] **GPU Scalability:** Massive particle systems deploy `LargeParticles` (instanced GPU curl noise) rather than CPU loops.
- [ ] **Twist-Free Geometry:** Ribbon paths utilize `RibbonGeometry` with Bishop rotation-minimizing frames.
- [ ] **Subdivided Long Lines:** All structural wireframe lines are subdivided at $\le 0.5\text{m}$ intervals to eliminate camera near-plane clipping.
