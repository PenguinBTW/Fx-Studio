# In-World Text Lighting & Occlusion (`engine/text_lighting.ts`, `engine/textfx.ts`)

Physical scene lighting, depth buffer participation, and particle/volumetric occlusion for 3D kinetic typography.

## Architecture & Depth Participation

Standard overlay text passes are drawn as 2D orthographic overlays with depth writes disabled. For in-world cinematic typography (e.g., Act 1 technical readouts and Act 4 droplet interfaces), text geometry must inhabit the physical 3D scene:
- **Depth Buffer Participation**: `applyInWorldLighting()` explicitly sets `depthWrite: true` and `depthTest: true`.
- **PBR Materials**: Configurable with `MeshStandardMaterial` or `MeshPhysicalMaterial` (roughness, metalness, clearcoat, emissive glow).
- **Physical DoF Blur**: `computeTextCoC()` calculates the thin-lens Circle of Confusion (CoC) across glyph centroids, blurring foreground and background typography in unison with the camera focal plane.

## Particle Occlusion & Deflection

### Eye-Depth Partitioning
`partitionParticlesByTextDepth()` transforms coordinates into camera eye space ($-Z$) and segments particles into foreground and background buffers relative to the text plane, preventing background motes from erroneously drawing in front of opaque letterforms.

### Volume-Preserving Deflection Map
When particles or streamline ribbons intersect extruded glyphs, `computeGlyphDeflectionVector()` repels them using a smooth, volume-preserving radial transformation:
$$r' = (r^3 + R^3)^{1/3}$$
- **Non-Crossing Invariant**: Because $\frac{d}{dr}(r^3 + R^3)^{1/3} = \frac{r^2}{(r^3 + R^3)^{2/3}} > 0$ for all $r > 0$, streamlines never cross, fold, or invert.
- **Singularity Free**: At $r \le 10^{-7}$, the displacement smoothly saturates along canonical $+Y$, avoiding division-by-zero NaNs.

## `InWorldTextHelper` Static Facade

Provides a unified interface for scene authors:
```typescript
import { InWorldTextHelper } from '../engine/text_lighting';

// 1. Create extruded text with physical PBR lighting
const textGroup = InWorldTextHelper.create3D('FIRST LIGHT', {
  size: 2.0,
  depth: 0.4,
  roughness: 0.2,
  metalness: 0.8,
  emissive: 0x00ffff,
  emissiveIntensity: 0.5,
});

// 2. Extract layout & depth planes
const layout = InWorldTextHelper.getLayout(textGroup, camera);

// 3. Deflect surrounding particles
InWorldTextHelper.deflectParticles(particlePositions, layout.obstacles);
```

## Testing & Verification

Run tests via Bun:
```bash
bun scripts/test_text_lighting.ts
```
Verifies depth participation flags, PBR material creation, CoC focus matching, particle foreground/background partitioning, and finite repulsive deflection.
