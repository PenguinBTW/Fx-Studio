# Implementation Plan: P6 Ribbons & Aurora Curtains

> **Context**: Derived from subagent survey (`ses_e8a302be4ffekt6btu1eXAy0lW`, 519k tokens).  
> **Target Files**: `app/src/engine/ribbon.ts`, `app/src/engine/aurora.ts`, and `app/src/engine/glsl/aurora.ts`  
> **Key Dependents**: Act 2 (Solar Prominence loops), Act 5 (Planetary Aurora curtains), Act 6 (Retinal nerve dendrites).

---

## 1. Geometric & Mathematical Foundation

### A. Torsion-Free Parallel Transport Frame (Bishop Frame)
* **The Frenet-Serret Problem**:
  - The standard Frenet normal $\mathbf{N} = \frac{d\mathbf{T}/ds}{\|d\mathbf{T}/ds\|}$ and binormal $\mathbf{B} = \mathbf{T} \times \mathbf{N}$ suffer from catastrophic $180^\circ$ twist singularities at inflection points where curvature $\kappa \to 0$.
* **Parallel Transport Solution (Rotation-Minimizing Frame)**:
  - Initialize $\mathbf{N}_0$ orthogonal to $\mathbf{T}_0$.
  - For each discrete polyline step from $\mathbf{x}_i$ to $\mathbf{x}_{i+1}$:
    1. Compute reflection across bisecting plane between $\mathbf{T}_i$ and $\mathbf{T}_{i+1}$.
    2. Transport normal vector $\mathbf{N}_{i+1}$ without adding artificial axial torsion:
       $$\mathbf{v}_1 = \mathbf{x}_{i+1} - \mathbf{x}_i, \quad c_1 = \mathbf{v}_1 \cdot \mathbf{v}_1$$
       $$\mathbf{N}_i^L = \mathbf{N}_i - \frac{2}{c_1} (\mathbf{v}_1 \cdot \mathbf{N}_i) \mathbf{v}_1$$
       $$\mathbf{v}_2 = \mathbf{T}_{i+1} - \mathbf{T}_i^L, \quad c_2 = \mathbf{v}_2 \cdot \mathbf{v}_2$$
       $$\mathbf{N}_{i+1} = \mathbf{N}_i^L - \frac{2}{c_2} (\mathbf{v}_2 \cdot \mathbf{N}_i^L) \mathbf{v}_2$$
  - Produces perfectly smooth, non-twisting ribbon strips along arbitrary 3D splines.

---

## 2. Ribbon Strip Implementation (`app/src/engine/ribbon.ts`)

* **Geometry Generator**:
  - Input: Array of 3D spine points $\mathbf{p}_0, \dots, \mathbf{p}_N$, width function $w(s)$, and twist angle $\alpha(s)$.
  - Triangulation: Double vertex strip where vertex pairs are extruded along $\mathbf{B}_i$:
    $$\mathbf{v}_{\text{left}} = \mathbf{p}_i - \frac{w_i}{2} \mathbf{B}_i, \quad \mathbf{v}_{\text{right}} = \mathbf{p}_i + \frac{w_i}{2} \mathbf{B}_i$$
  - UV Mapping: $u \in [0, 1]$ across width, $v \in [0, 1]$ along path length.
* **Closed-Form Ribbon Evaluation**:
  - Like `LargeParticles`, ribbon positions can be evaluated per frame as pure functions of time $f(t, s)$.

---

## 3. Aurora Curtain Shader (`app/src/engine/glsl/aurora.ts`)

### A. Spectral Physics
Auroras emit light from specific quantum transitions in the upper atmosphere:
1. **Atomic Oxygen Green ($557.7\,\text{nm}$)**: Dominates at lower altitudes ($100 - 150\,\text{km}$).
2. **Atomic Oxygen Red ($630.0\,\text{nm}$)**: Higher altitudes ($150 - 300\,\text{km}$) due to long radiative lifetime ($110\,\text{s}$).
3. **Molecular Nitrogen Blue/Purple ($391.4\,\text{nm}, 427.8\,\text{nm}$)**: Fast energetic particle penetration at the curtain base.

### B. Vertical Curtain Geometry & Shader
* Curtains are extruded vertically along Earth's magnetic dipole field lines $\mathbf{B}(\mathbf{r})$.
* Raymarched curtain thickness with curl-noise folding (`curlNoise3` from `noise.ts`):
```glsl
vec3 sampleAurora(vec3 pos, float time) {
  // Altitude coordinate [0..1]
  float alt = clamp((pos.y - AURORA_BASE) / AURORA_HEIGHT, 0.0, 1.0);
  
  // Ribbon curtain folds driven by curl noise
  vec3 noiseOffset = curlNoise3(vec3(pos.xz * 0.1, time * 0.05));
  float curtainDensity = smoothstep(0.4, 0.0, abs(pos.z + noiseOffset.x * 2.0));
  
  // Fast vertical striations (charged particle precipitation)
  float rayFold = sin(pos.x * 5.0 + noiseOffset.y * 3.0);
  curtainDensity *= (0.6 + 0.4 * rayFold);
  
  // Spectral emission blend: Green at bottom, Red at top, Violet rim
  vec3 colGreen = OXYGEN_GREEN; // 557.7 nm from spectrum.ts
  vec3 colRed   = OXYGEN_RED;   // 630.0 nm from spectrum.ts
  vec3 colBlue  = NITROGEN_N2P; // 391.4 nm from spectrum.ts
  
  vec3 emission = mix(colBlue, colGreen, smoothstep(0.0, 0.2, alt));
  emission = mix(emission, colRed, smoothstep(0.3, 0.9, alt));
  
  return emission * curtainDensity * exp(-alt * 1.5);
}
```

---

## 4. Verification & Acceptance Criteria

* **Test Script**: `app/scripts/test_ribbons.ts`
  1. **Torsion Stability**: Evaluate ribbon along high-curvature loops (Frenet inflection test); verify normal vector dot product between successive vertices never flips sign ($> 0.98$).
  2. **Spectral Accuracy**: Vertical emission profile must match measured auroral spectrum (green peak at base, pure red tail at top).
  3. **Scrub Determinism**: Frame rendering at arbitrary timeline times produces identical byte output.
