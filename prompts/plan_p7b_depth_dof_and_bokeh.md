# Implementation Plan: P7b Depth-Based Depth of Field & Bokeh

> **Context**: Derived from Claude Opus 5.5 architectural survey (`ses_e89f3e233ffeaWnJ4xL0jWqqJQ`, 41.6k tokens).  
> **Target Files**: `app/src/engine/dof.ts`, `app/src/engine/glsl/dof.ts`, and `app/src/engine/engine.ts`  
> **Key Dependents**: Solar Core macro cinematography, in-world extruded text occlusion, and Act 6 (Retina photoreceptors).

---

## 1. Problem Formulation & Defect in Current Engine

* **Defect**: In `app/src/engine/post.ts` (line 189), the current `dof` parameter is a 2D screen-space radial vignette:
  ```glsl
  float blur = smoothstep(0.0, focalRange, abs(length(uv - vec2(0.5)) - focusDist));
  ```
  It measures distance from the screen center, **not scene depth**. An object at infinity at the center of the frame is sharp, while an object at the focal plane on the edge is blurred.
* **Requirement**: Implement genuine optical depth-of-field where blur diameter is governed by distance from the world-space focal plane, with realistic bokeh discs for out-of-focus specular highlights.

---

## 2. Optical Formulation: Thin Lens Circle of Confusion (CoC)

For a camera with focal length $f$, $f$-number $N$, focused at world distance $S_1$, the circle of confusion diameter $C$ for an object at depth $S_2$ is:
$$C = \frac{|S_2 - S_1|}{S_2} \cdot \frac{f^2}{N(S_1 - f)}$$
In normalized pixel radius form parameterized for artistic control:
$$C(z) = \text{clamp}\left(\left| 1.0 - \frac{d_{\text{focus}}}{z} \right| \cdot A_{\text{scale}}, \ 0.0, \ R_{\text{max}}\right)$$
* Where:
  * $z$ is the linear camera-space depth (reconstructed from the depth buffer).
  * $d_{\text{focus}}$ is the world-unit focus distance (e.g. projected from target via `rig.focusDistance(target)`).
  * $A_{\text{scale}}$ is the lens aperture diameter in pixels.
  * $R_{\text{max}}$ is the maximum blur radius clamp (typically 16–32 px) to preserve GPU fill rate.

---

## 3. Architecture & Engine Pipeline Integration

### A. Depth Buffer Attachment in `engine.ts`
1. Attach a depth texture to the main scene render target (`sceneRT`):
   ```typescript
   import * as THREE from 'three';
   
   this.sceneRT.depthTexture = new THREE.DepthTexture(W, H);
   this.sceneRT.depthTexture.type = THREE.UnsignedIntType;
   this.sceneRT.depthTexture.format = THREE.DepthFormat;
   ```
2. Pass `sceneRT.depthTexture` into the post-processing compositor passes.

### B. Depth Reconstruction in GLSL
Convert non-linear $z_{\text{buffer}} \in [0, 1]$ back to linear eye-space depth $z_{\text{eye}}$:
```glsl
float linearizeDepth(float zBuffer, float near, float far) {
  return (near * far) / (far - zBuffer * (far - near));
}
```

### C. Depth-Aware Bokeh Blur Pass (`app/src/engine/dof.ts`)
* **Two-Pass or Spiral Gather**:
  - To prevent background color from bleeding over sharp foreground edges, samples use **depth-aware bilateral weights**:
    $$w_i = \max\left(0.0, \ 1.0 - \frac{z_i - z_{\text{center}}}{\sigma_z}\right) \cdot \text{step}(r_i, C(z_i))$$
  - Out-of-focus foreground bokeh must bleed *over* in-focus background.
* **Aperture Blade Shape (Bokeh Diaphragm)**:
  - Circular ($N=0$) or Polygonal ($N=6$ hexagonal blades, $N=9$ circular cinema lens).
  - Jittered with Interleaved Gradient Noise (`IGN`) from `noise.ts` to convert banding into imperceptible blue-noise grain.

---

## 4. API & Backwards Compatibility

* Retain existing `dof`, `focusDist`, `focalRange` in `post.ts` for backward compatibility with legacy demo scenes.
* Introduce new physical DoF options:
  ```typescript
  export interface DepthDoFParams {
    enabled: boolean;
    focusDistance: number;   // World units along camera forward vector
    aperture: number;        // Lens opening scale [0..64 px blur]
    maxRadius?: number;      // Default 24.0 px
    blades?: number;         // 0 = circular, 6 = hexagonal
    anamorphicRatio?: number;// 1.0 = spherical, 2.0 = oval anamorphic bokeh
  }
  ```

---

## 5. Verification & Acceptance Criteria

* **Test Script**: `app/scripts/test_depth_dof.ts`
  1. **Focal Plane Sharpness**: Object at $z = d_{\text{focus}}$ must have CoC $= 0.0$ and retain $100\%$ edge contrast.
  2. **Linear Growth**: Objects placed at $2 \times$ and $4 \times$ focus distance must demonstrate monotonically increasing blur diameter.
  3. **Foreground / Background Occlusion**: A blurred foreground silhouette in front of a sharp background must bleed outward, while a blurred background must not contaminate the sharp foreground edge.
  4. **Performance**: Must execute in $< 5\,\text{ms}$ at $1080\text{p}$ on standard desktop GPUs.
