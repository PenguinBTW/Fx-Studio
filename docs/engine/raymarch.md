# Raymarch: Volumetrics & Analytic SDFs (`engine/raymarch.ts`, `engine/glsl/raymarch.ts`)

Composable GLSL raymarching framework supporting surface distance fields, participating media (clouds, smoke, nebulae), solar granulation emission, and depth-aware upsampling.

## Architecture

Raymarching is encapsulated via `RaymarchPass` and `buildMarcher(opts: MarcherOpts)`. The pipeline automatically composes the shader from modular chunks:
1. `GLSL_COMMON` (coordinate transforms, color models)
2. `GLSL_NOISE` (interleaved gradient noise, simplex, curl noise)
3. `GLSL_SPECTRUM` (Planckian blackbody, wavelength conversion)
4. `GLSL_RM_CORE` (camera unprojection, sub-pixel RGSS jitter, dynamic step budget)
5. User `map(vec3 p)` or `VolumeSource` routines
6. `GLSL_RM_MARCH` (sphere tracer with over-relaxation) or `GLSL_RM_VOLUME` (numerical volume integration)

## Quality Tiers & Performance Budgets

The engine defines three standardized quality tiers (`RM_TIERS`):

| Parameter | Tier 0 (Preview) | Tier 1 (Preview+) | Tier 2 (Offline) | Description |
|---|---|---|---|---|
| `marchSteps` | 64 | 112 | 256 | Surface sphere-tracing step budget |
| `epsMul` | 1.0 | 0.6 | 0.3 | Hit tolerance multiplier |
| `shadowSteps` | 28 | 48 | 96 | Soft shadow march steps |
| `aoSamples` | 4 | 5 | 8 | Ambient occlusion sample taps |
| `volSteps` | 40 | 64 | 160 | Volumetric view ray integration steps |
| `volStepMul` | 1.0 | 0.7 | 0.35 | Volumetric step size scaling factor |
| `lightSteps` | 3 | 5 | 8 | Secondary light-march in-scatter steps |
| `emptySkip` | 2.0 | 1.5 | 1.0 | Empty-space skipping acceleration |

*Target*: Preview tier 0 executes under 33 ms/frame at 1080p on modern GPUs (measured: 16.4 ms for metal blobs, 20.5 ms for clouds, 28.2 ms for solar plasma).

## Volumetric Integration

Volume rendering integrates optical depth and radiance along each ray segment $\Delta t$:
$$\tau = \sigma \Delta t, \quad T_s = e^{-\tau}, \quad \text{absorbed} = 1 - T_s$$
$$L_{\text{accum}} \mathrel{+}= T \cdot L_{\text{emit}} \cdot \frac{1 - e^{-\sigma \Delta t}}{\sigma} + T \cdot (1 - T_s) \cdot L_{\text{scatter}}$$

- **Singularity Protection**: Guarded by `sig > 1e-4` to prevent division-by-zero artifacts in optically thin regions.
- **Phase Function**: Henyey-Greenstein dual-lobe phase approximation `rmHG(cs, g)` with forward/backward asymmetry.
- **Powder Effect**: Implements beer-powder modulation $1 - e^{-2\sigma}$ to capture forward rim scattering in clouds.

## Depth-Aware Upsampling

When `halfRes: true` is configured:
1. Raymarching evaluates at half resolution ($W/2 \times H/2$) rendering color to texture 0 and linear view depth to texture 1 (`FloatType` MRT).
2. The full-resolution upsample pass (`UP_FRAG`) performs a bilateral gather comparing texel depth against the high-resolution depth guide (`guide`):
   $$w_k = w_{\text{bilinear}} \cdot \frac{1}{0.02 + 8 \cdot \frac{|d_k - d_{\text{guide}}|}{\max(d_{\text{guide}}, 10^{-3})}}$$
3. Prevents low-resolution edge bleeding across sharp foreground silhouettes.

## Testing & Benchmarks

- Benchmark CLI: `bun scripts/time_raymarch.ts`
- Verifies ms/frame including GPU sync and async pixel readback across Shots A (metal), B (clouds), and C (plasma).
