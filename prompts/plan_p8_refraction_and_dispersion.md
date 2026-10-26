# Implementation Plan: P8 Refraction & Chromatic Dispersion

> **Context**: Derived from Claude Opus 5.5 architectural survey (`ses_e8a1a81beffeI06oA0sWP46MSu`, 268k tokens).  
> **Target Files**: `app/src/engine/refract.ts` & `app/src/engine/glsl/refract.ts`  
> **Key Dependents**: Act 5 (Atmospheric Droplet), Act 6 (Cornea & Eye Lens), Transitions T7 & T8.

---

## 1. Physical Principles & Formulas

### A. Wavelength-Dependent Index of Refraction (Dispersion)
Water follows the Cauchy dispersion equation in the visible spectrum ($380\,\text{nm} - 780\,\text{nm}$):
$$n(\lambda) = A + \frac{B}{\lambda^2}$$
* Constants for water at standard temperature:
  * $A = 1.3199$
  * $B = 0.00515\,\mu\text{m}^2 = 5150\,\text{nm}^2$
* Expected indices:
  * $n(700\,\text{nm}, \text{red}) \approx 1.331$
  * $n(550\,\text{nm}, \text{green}) \approx 1.336$
  * $n(400\,\text{nm}, \text{violet}) \approx 1.344$

### B. Descartes Droplet Ray Geometry (Rainbow Mechanics)
1. **Ray Entry**: Refraction at droplet boundary into sphere with radius $R$:
   $$\sin \theta_1 = \frac{b}{R}, \quad \sin \theta_2 = \frac{\sin \theta_1}{n(\lambda)}$$
2. **Internal Reflections**:
   * For $k$ internal bounces, the total deflection angle $\Theta$ is:
     $$\Theta(b, \lambda) = 2(\theta_1 - \theta_2) + k(\pi - 2\theta_2)$$
3. **Descartes Caustic Extremum** ($d\Theta/db = 0$):
   * Primary Bow ($k=1$): Deflection minimum occurs at $\cos \theta_1 = \sqrt{\frac{n^2 - 1}{3}}$.
     * Resulting rainbow angle: $\approx 42.0^\circ$ for red ($700\,\text{nm}$) and $\approx 40.5^\circ$ for violet ($400\,\text{nm}$).
   * Secondary Bow ($k=2$):
     * Resulting angle: $\approx 50.5^\circ$ for red and $\approx 53.5^\circ$ for violet (color order reversed).

---

## 2. Technical Architecture & Module Structure

### A. TypeScript Module (`app/src/engine/refract.ts`)
* **Spectral Ray Tracer**:
  - Sample $N$ spectral wavelengths ($N=8$ fast, $N=16$ film quality) distributed between $380\,\text{nm}$ and $780\,\text{nm}$.
  - Weight each sample using `spectralSampleWeight(N, i)` from `app/src/engine/spectrum.ts`.
  - Accumulate RGB contribution via `wavelengthToLinearSRGB(wavelength, 'luminous')`.
* **Analytic Sphere Intersection**:
  - Exact Ray-Sphere test: $t = -\mathbf{d}\cdot\mathbf{p} \pm \sqrt{(\mathbf{d}\cdot\mathbf{p})^2 - (\mathbf{p}\cdot\mathbf{p} - R^2)}$.
  - Trace primary transmission, internal reflection, and Fresnel transmission ($F = F_0 + (1-F_0)(1-\cos\theta)^5$).
* **Ray Fan Visualization Hook**:
  - Generates line geometry (`THREE.LineSegments`) showing the internal ray fan dispersion inside the droplet for close-up macro cinematography.

### B. GLSL Fragment Shader Chunk (`app/src/engine/glsl/refract.ts`)
```glsl
// Cauchy dispersion for water
float waterIOR(float lambdaNm) {
  float lUm = lambdaNm * 0.001;
  return 1.3199 + 0.00515 / (lUm * lUm);
}

// Analytic sphere trace with single internal reflection and dispersion
vec3 traceDroplet(vec3 ro, vec3 rd, vec3 center, float radius, sampler2D envMap) {
  vec3 oc = ro - center;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - radius * radius;
  float h = b * b - c;
  if (h < 0.0) return texture(envMap, rd.xy * 0.5 + 0.5).rgb; // Miss
  
  float t1 = -b - sqrt(h);
  vec3 hitPos = ro + rd * t1;
  vec3 norm = normalize(hitPos - center);
  
  vec3 accumColor = vec3(0.0);
  const int SAMPLES = 8;
  
  for (int i = 0; i < SAMPLES; i++) {
    float wl = 400.0 + float(i) * (300.0 / float(SAMPLES - 1));
    float ior = waterIOR(wl);
    
    // 1st refraction
    vec3 refractDir = refract(rd, norm, 1.0 / ior);
    if (dot(refractDir, refractDir) < 0.1) continue;
    
    // Internal chord to back wall
    float chord = 2.0 * dot(center - hitPos, refractDir);
    vec3 backHit = hitPos + refractDir * chord;
    vec3 backNorm = normalize(center - backHit);
    
    // Internal reflection
    vec3 reflectDir = reflect(refractDir, backNorm);
    
    // 2nd hit on boundary & exit refraction
    float chord2 = 2.0 * dot(center - backHit, reflectDir);
    vec3 exitHit = backHit + reflectDir * chord2;
    vec3 exitNorm = normalize(center - exitHit);
    vec3 exitDir = refract(reflectDir, exitNorm, ior);
    
    // Sample environment / sky map inverted
    vec3 env = texture(envMap, exitDir.xy * 0.5 + 0.5).rgb;
    vec3 sampleWeight = wavelengthColor(wl); // from spectrum.ts GLSL chunk
    accumColor += env * sampleWeight;
  }
  
  return accumColor / float(SAMPLES);
}
```

---

## 3. Verification Criteria & Automated Tests

* **Test Script**: `app/scripts/test_refraction.ts`
  1. **Angular Precision**: Measure the rainbow deflection angle. Must verify primary bow apex within $[41.5^\circ, 42.5^\circ]$ for $700\,\text{nm}$ and $[40.0^\circ, 41.0^\circ]$ for $400\,\text{nm}$.
  2. **Total Internal Reflection**: Verify that rays exceeding the critical angle $\theta_c = \arcsin(1/n)$ achieve 100% reflectance without transmission loss.
  3. **White Light Invariance**: Flat uniform white environment must integrate back to neutral white with no chrominance bias (within $\pm 1\%$ RGB).
