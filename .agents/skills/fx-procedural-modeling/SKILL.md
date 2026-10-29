---
name: fx-procedural-modeling
description: Procedural code-only 3D geometry, wireframe architecture, Signed Distance Fields (SDFs), normal displacement, anisotropic brushed metal shaders, raymarching, and deterministic particle fountains in f(x) Studio.
---
# f(x) Studio: Procedural Modeling & Shader Geometry

Technical standards, procedural algorithms, mathematical formulas, and shader pipelines for building **code-only 3D visual environments, mechanical assemblies, and textures** in **f(x) Studio** without importing external `.glb` models, raster textures, or image files.

## When to Use

- Authoring scenes with strict "code-only / zero-asset" directives (e.g., [`child-lock-scene-prompt.md`](file:///c:/Users/brosf/Documents/A%20vio%20projects/VioPls/child-lock-scene-prompt.md)).
- Generating mechanical components (switches, levers, sliders, rods, pawls) from parametric curves and analytical math.
- Writing procedural surface shaders: brushed anisotropic metal, rubber seals, micro-scratched titanium, and glowing edge bevels.
- Building procedural wireframe architectures and Minimalist-3D rooms via `LineBatch`.
- Implementing raymarched 3D Signed Distance Fields (SDFs) and recursive self-similar fractal shaders in GLSL.
- Emitting closed-form deterministic particle fountains (sparks, electric arcs, dust motes).

---

## 1. Upstream & Sibling Dependencies

- **`fx-scenes`**: The primary authoring target where procedural geometry and shaders are registered within `defineScene`.
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
Construct precise mechanical slots (e.g., door switch housings, chassis grooves) using parametric extruded shapes:

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

## 4. Procedural Surface Shaders (No Texture Files)

### 4.1 Brushed Anisotropic Metal (`--bone` / Titanium)
Simulates microscopic horizontal machining grooves that stretch specular highlights into elongated streaks:

```glsl
// Fragment Shader: Procedural Anisotropic Brushed Metal
uniform vec3 uBaseColor;      // e.g. #E8E4DA (--bone)
uniform vec3 uSpecColor;      // Specular highlight tone
uniform vec3 uLightDir;       // Primary directional light
uniform float uRoughnessX;    // Tangent roughness (e.g., 0.15)
uniform float uRoughnessY;    // Bitangent roughness (e.g., 0.65)
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUv;

// Hash noise generator for procedural grain
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = normalize(uLightDir);
  vec3 H = normalize(L + V);

  // Derive tangent vector along the brushed direction
  vec3 T = normalize(cross(N, vec3(0.0, 1.0, 0.0)));
  vec3 B = cross(N, T);

  // Micro-texture grain displacement
  float noise = (hash(vUv * 400.0) - 0.5) * 0.08;
  N = normalize(N + T * noise);

  // Ward Anisotropic Specular formulation
  float dotNH = max(dot(N, H), 0.001);
  float dotNV = max(dot(N, V), 0.001);
  float dotNL = max(dot(N, L), 0.001);
  float dotTH = dot(T, H);
  float dotBH = dot(B, H);

  float exponent = -(pow(dotTH / uRoughnessX, 2.0) + pow(dotBH / uRoughnessY, 2.0)) / (1.0 + dotNH);
  float spec = exp(exponent) / (12.566 * uRoughnessX * uRoughnessY * sqrt(dotNL * dotNV));

  vec3 diffuse = uBaseColor * dotNL;
  vec3 specular = uSpecColor * spec * dotNL;

  gl_FragColor = vec4(diffuse + specular, 1.0);
}
```

### 4.2 Barycentric Wireframe Edge Glow
Renders solid geometry with glowing procedural edges without requiring duplicate wireframe meshes:

```glsl
// Fragment Shader: Single-Pass Barycentric Wireframe
varying vec3 vBarycentric;
uniform vec3 uSurfaceColor; // e.g. #050506 (--void)
uniform vec3 uEdgeColor;    // e.g. #E8E4DA (--bone)
uniform float uLineWidth;   // Screen-space line width in pixels

void main() {
  // Screen-space partial derivatives for resolution-independent line thickness
  vec3 d = fwidth(vBarycentric);
  vec3 a3 = smoothstep(d * (uLineWidth - 0.5), d * (uLineWidth + 0.5), vBarycentric);
  float edgeFactor = min(min(a3.x, a3.y), a3.z);

  // Glow edge
  vec3 color = mix(uEdgeColor, uSurfaceColor, edgeFactor);
  gl_FragColor = vec4(color, 1.0);
}
```

---

## 5. Minimalist-3D Wireframe Architectures via `LineBatch`

For abstract structural rooms, industrial interiors, and schematic layouts:

```typescript
import { LineBatch } from '../../engine/lines';

export function buildSchematicRoom(lines: LineBatch, size = 10.0, step = 1.0): void {
  const half = size / 2;
  const colBase = [0.42, 0.41, 0.40, 0.8]; // --ash at 80%
  const colFloor = [0.25, 0.25, 0.24, 0.4];

  // 1. Structural Floor Grid
  for (let x = -half; x <= half; x += step) {
    lines.add([x, 0, -half], [x, 0, half], 1.5, colFloor);
  }
  for (let z = -half; z <= half; z += step) {
    lines.add([-half, 0, z], [half, 0, z], 1.5, colFloor);
  }

  // 2. Room Outer Bounding Pillars
  lines.add([-half, 0, -half], [-half, size, -half], 2.5, colBase);
  lines.add([half, 0, -half], [half, size, -half], 2.5, colBase);
  lines.add([-half, 0, half], [-half, size, half], 2.5, colBase);
  lines.add([half, 0, half], [half, size, half], 2.5, colBase);
}
```

- **Anti-Clipping Edge Subdivision**: For camera paths flying through rooms, subdivide any segment longer than 0.5 metres (`Math.ceil(length / 0.5)`). This prevents near-plane frustum clipping artifacts.

---

## 6. Raymarched Signed Distance Fields & Zoom-Fold Fractals

When scripts demand infinite recursive geometry (e.g., an interlocking mechanism repeating at every scale of civilization):

### 6.1 The Zoom-Fold Recursive Fractal Shader
Evaluates self-similar geometry across multiple spatial octaves without instancing millions of 3D polygons:

```glsl
// Fragment Shader: Self-Similar Scale-Fold Fractal
uniform float uTime;
uniform float uZoomProgress; // Exponential zoom progress [0.0 to 1.0]
uniform vec2 uResolution;

// 2D Box SDF
float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// Glyph Interlock SDF (Input circle, gap blocker, output square)
float sdGlyph(vec2 p) {
  float dIn = length(p - vec2(-0.4, 0.0)) - 0.12;          // Input Circle
  float dOut = sdBox(p - vec2(0.4, 0.0), vec2(0.1, 0.1));  // Output Square
  float dWire = sdBox(p, vec2(0.35, 0.015));               // Main connecting bar
  float dGap = sdBox(p, vec2(0.06, 0.05));                 // Blocker gap
  return min(min(dIn, dOut), max(dWire, -dGap));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
  
  // Continuous Exponential Zoom: scale = exp(k * progress)
  float scaleFactor = exp(13.8155 * uZoomProgress); // 10^6 zoom over duration
  vec2 p = uv * scaleFactor;

  float d = 1e6;
  float cellScale = 1.0;

  // Unroll 5 recursive self-similar octaves with cross-fading
  for (int i = 0; i < 5; i++) {
    vec2 pCell = mod(p + 1.5, 3.0) - 1.5; // Spatial folding grid
    float dOctave = sdGlyph(pCell * cellScale) / cellScale;
    d = min(d, dOctave);
    p *= 6.0; // Next recursive octave scale
    cellScale *= 6.0;
  }

  // Anti-aliased render boundary
  float aa = fwidth(d);
  float mask = smoothstep(aa, -aa, d);

  vec3 color = mix(vec3(0.02, 0.02, 0.02), vec3(0.91, 0.89, 0.85), mask);
  gl_FragColor = vec4(color, 1.0);
}
```

---

## 7. Closed-Form Spark & Particle Fountains

Never simulate particles with frame-accumulated velocity (`pos += vel * dt`). Model particle fountains as closed-form ballistics keyed to emission time:

```typescript
import * as THREE from 'three';
import { mulberry32 } from '../engine/util';

export class DeterministicSparkFountain {
  public geometry: THREE.BufferGeometry;
  private seeds: Float32Array;

  constructor(count = 200, seed = 1) {
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    this.seeds = new Float32Array(count * 4); // [angle, speed, lifetime, seed]

    const rand = mulberry32(seed); // from engine/util.ts; never Math.random
    for (let i = 0; i < count; i++) {
      this.seeds[i * 4 + 0] = rand() * Math.PI * 2;       // Azimuth
      this.seeds[i * 4 + 1] = 2.0 + rand() * 6.0;         // Velocity
      this.seeds[i * 4 + 2] = 0.4 + rand() * 0.8;         // Duration
      this.seeds[i * 4 + 3] = rand();                     // Jitter
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  }

  // Pure stateless evaluation: Frame = f(t)
  update(t: number, burstTime: number, gravity = 9.8): void {
    const dt = t - burstTime;
    if (dt < 0) return;

    const pos = this.geometry.attributes.position.array as Float32Array;
    const count = this.seeds.length / 4;

    for (let i = 0; i < count; i++) {
      const theta = this.seeds[i * 4 + 0];
      const speed = this.seeds[i * 4 + 1];
      const life = this.seeds[i * 4 + 2];

      if (dt > life) {
        // Spark extinguished
        pos[i * 3 + 0] = 0; pos[i * 3 + 1] = -999; pos[i * 3 + 2] = 0;
        continue;
      }

      // Parabolic ballistic trajectory
      const vx = Math.cos(theta) * speed;
      const vz = Math.sin(theta) * speed;
      const vy = speed * 1.5;

      pos[i * 3 + 0] = vx * dt;
      pos[i * 3 + 1] = vy * dt - 0.5 * gravity * dt * dt;
      pos[i * 3 + 2] = vz * dt;
    }
    this.geometry.attributes.position.needsUpdate = true;
  }
}
```

---

## 8. Pre-Flight Procedural Modeling Checklist

Before approving procedural geometry or custom shaders:

- [ ] **Zero External Assets:** Scene requires zero `.glb`, `.png`, or `.jpg` network requests.
- [ ] **Pure Determinism:** Displacements, particles, and un-building dissolves evaluate from `f.lt` or `f.t` without accumulators.
- [ ] **Palette Discipline:** Adheres strictly to token colors (`--void`, `--bone`, `--ash`, `--signal`).
- [ ] **Edge Anti-Aliasing:** All shader SDFs and barycentric lines use `fwidth()` derivatives for sub-pixel anti-aliasing.
- [ ] **No PCIe Churn:** Static vertex geometries are allocated once in `init()` / `setup()`; animations execute in shaders or via `StaticDrawUsage`.
- [ ] **Subdivided Long Lines:** All structural wireframe lines are subdivided at $\le 0.5\text{m}$ intervals to eliminate camera near-plane clipping.
