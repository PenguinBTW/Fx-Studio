# Refraction & Physical Dispersion (`engine/refract.ts`, `engine/glsl/refract.ts`)

Physical dispersion, dielectric Fresnel reflection and transmission, and Descartes caustics for rainbow optics and refractive media.

## Cauchy Dispersion Formula

Refractive index $n$ as a function of wavelength $\lambda$ (in micrometers $\mu\text{m}$):
$$n(\lambda) = A + \frac{B}{\lambda^2}$$

Pre-configured material constants:
- **BK7 Optical Glass**: $A = 1.5046$, $B = 0.00420$
- **Water ($20^\circ\text{C}$)**: $A = 1.3199$, $B = 0.00330$
- **Diamond**: $A = 2.3780$, $B = 0.01250$
- **Dense Flint Glass (SF11)**: $A = 1.7374$, $B = 0.01320$

## Dielectric Fresnel & Total Internal Reflection (TIR)

Evaluates unpolarized Fresnel reflectance $R$ for non-magnetic dielectrics using Snell's Law $\eta_1 \sin\theta_i = \eta_2 \sin\theta_t$:
$$R_s = \left(\frac{\eta_1 \cos\theta_i - \eta_2 \cos\theta_t}{\eta_1 \cos\theta_i + \eta_2 \cos\theta_t}\right)^2, \quad R_p = \left(\frac{\eta_2 \cos\theta_i - \eta_1 \cos\theta_t}{\eta_2 \cos\theta_i + \eta_1 \cos\theta_t}\right)^2$$
$$R = \frac{R_s + R_p}{2}, \quad T = 1 - R$$

- **TIR**: When $\sin^2\theta_t > 1.0$, light undergoes total internal reflection with $R = 1.0$ and $T = 0.0$.

## Descartes Spherical Droplet Caustics

Calculates the deflection angle $\theta(b)$ of a parallel ray incident on a spherical water droplet of radius $R$ at impact parameter $b \in [0, R]$:
$$\phi = \arcsin(b/R), \quad r = \arcsin\left(\frac{b}{n \cdot R}\right)$$
$$\theta^{(1)}(b) = 4r - 2\phi \quad (\text{primary bow, 1 internal reflection})$$
$$\theta^{(2)}(b) = \pi + 2\phi - 6r \quad (\text{secondary bow, 2 internal reflections})$$

### Stationary Deflection & Rainbow Angles
The Descartes caustic occurs at the stationary point $\frac{d\theta}{db} = 0$:
$$\cos\phi^{(1)} = \sqrt{\frac{n^2 - 1}{3}}, \quad \cos\phi^{(2)} = \sqrt{\frac{n^2 - 1}{8}}$$
For water ($n \approx 1.333$):
- **Primary Bow**: Peak exit angle $\theta_{\text{peak}} \approx 42.37^\circ$
- **Secondary Bow**: Peak exit angle $\theta_{\text{peak}} \approx 50.41^\circ$ (reversed spectral ordering)
- **Alexander's Dark Band**: Region of zero geometric scattering between $42.4^\circ$ and $50.4^\circ$.

## GLSL Integration

`GLSL_REFRACT` provides GPU implementations matching the TypeScript API:
```glsl
#include "spectrum.glsl"
#include "refract.glsl"

// Trace ray through dispersive sphere
vec3 col = traceDropletSpectral(ro, rd, dropletPos, dropletRadius, numSamples);
```

## Testing & Verification

Run the test suite via Bun:
```bash
bun scripts/test_refraction.ts
```
Tests assert:
1. Cauchy index ordering: $n(400\,\text{nm}) > n(700\,\text{nm})$ across all materials.
2. Fresnel normal incidence matches $R_0 = ((n_1 - n_2)/(n_1 + n_2))^2$.
3. Exact recovery of primary ($42.37^\circ$) and secondary ($50.41^\circ$) Descartes rainbow angles.
4. Total internal reflection energy conservation ($R + T = 1.0$).
