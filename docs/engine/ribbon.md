# Ribbons & Aurora Curtains (`engine/ribbon.ts`, `engine/aurora.ts`, `engine/glsl/aurora.ts`)

Procedural 3D ribbons, rotation-minimizing camera flight ribbons, and physical quantum atmospheric aurora curtains.

## Bishop Frame Parallel Transport

Standard Frenet-Serret frames suffer from catastrophic 180° twist flips at points of zero curvature (inflection points). To achieve smooth, twist-free extrusion along arbitrary 3D space curves, `RibbonGeometry` uses the **Double Reflection Rotation-Minimizing Frame (RMF)** method (Wang et al., 2008).

### Double Reflection Algorithm
Given spine vertices $x_i, x_{i+1}$ and incoming tangent/normal/binormal basis $(T_i, N_i, B_i)$:
1. **Reflection 1**: Reflect frame onto the midpoint bisecting plane:
   $$v_1 = x_{i+1} - x_i, \quad c_1 = v_1 \cdot v_1$$
   $$R_1(v) = v - \frac{2}{c_1} (v_1 \cdot v) v_1$$
2. **Reflection 2**: Reflect temporary frame to align with target tangent $T_{i+1}$:
   $$v_2 = T_{i+1} - R_1(T_i), \quad c_2 = v_2 \cdot v_2$$
   $$N_{i+1} = R_2(R_1(N_i)), \quad B_{i+1} = T_{i+1} \times N_{i+1}$$
3. **Singularity Guards**:
   - Zero-length segments: $c_1 < 10^{-18}$ safely bypasses reflection.
   - Collinear tangents: $c_2 < 10^{-18}$ safely preserves orientation without division by zero.
   - Orthonormality: Gram-Schmidt re-orthogonalization against $T_{i+1}$ executed at each vertex.

## Ribbon Geometry & In-Place Updates

- `RibbonGeometry` generates a continuous triangle strip extruded along normal $N_i$ or binormal $B_i$:
  $$v_{\text{left}} = x_i - B_i \cdot \frac{w_i}{2}, \quad v_{\text{right}} = x_i + B_i \cdot \frac{w_i}{2}$$
- **Zero GC Allocation**: `updateFromSpine(points, widths)` mutates existing GPU `Float32Array` attributes in-place without heap allocations.

## Volumetric Aurora Curtains (`aurora.ts`)

Aurora curtains model atmospheric emission from solar wind electron collisions across three distinct quantum spectral emission lines:
1. **Molecular Nitrogen ($N_2^+$)**: 391.4 nm (violet-blue) dominant at low altitudes ($100\text{–}120\text{ km}$).
2. **Atomic Oxygen ($O(^1S)$)**: 557.7 nm forbidden transition (emerald green) dominant in the core thermosphere ($120\text{–}180\text{ km}$).
3. **Atomic Oxygen ($O(^1D)$)**: 630.0 nm forbidden transition (crimson red) dominant in the high altitude veil ($200\text{–}350\text{ km}$).

### Curl Noise Curtains
Curtains are folded using 3D divergence-free curl noise:
$$p(u, v, t) = \text{baseSpine}(u) + v \cdot \text{up} + \mathbf{A}(u, v, t)$$
where $\mathbf{A}$ generates vertical fluting and horizontal rays that move synchronously across timeline scrub operations.

## Testing & Verification

Run tests via Bun:
```bash
bun scripts/test_ribbons.ts
```
Verifies:
- Bishop frame eliminates twist flip (min successive normal dot $> 0.999$, compared to Frenet $-1.000$).
- Spectral emission matches linear sRGB Rec.709 constants.
- Bitwise byte-identical geometry buffers upon reverse and shuffled scrubbing.
