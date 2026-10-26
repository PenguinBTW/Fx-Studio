/**
 * Refraction and Chromatic Dispersion GLSL chunk (ES 3.0) for "First Light" (P8).
 * Provides Cauchy water dispersion and single-internal-reflection droplet tracing.
 */

export function buildGLSLRefract(): string {
  return /* glsl */ `
// ---- Cauchy dispersion & droplet refraction (P8) ----
const float WATER_CAUCHY_A = 1.3199;
const float WATER_CAUCHY_B_UM2 = 0.00515; // 5150 nm^2 in um^2

/**
 * Cauchy dispersion formula for water index of refraction across visible spectrum.
 * @param lambdaNm Wavelength in nanometers (380 - 780 nm)
 */
float waterIOR(float lambdaNm) {
  float lUm = lambdaNm * 0.001;
  return WATER_CAUCHY_A + WATER_CAUCHY_B_UM2 / (lUm * lUm);
}

/** Fast 3-lobe spectral chromaticity for visible spectrum (380 - 700 nm) */
vec3 wavelengthColor(float nm) {
  float r = exp(-0.5 * pow((nm - 605.0) / 38.0, 2.0)) + 0.35 * exp(-0.5 * pow((nm - 445.0) / 18.0, 2.0));
  float g = exp(-0.5 * pow((nm - 540.0) / 36.0, 2.0));
  float b = exp(-0.5 * pow((nm - 450.0) / 24.0, 2.0));
  return vec3(r, g, b);
}

/**
 * Analytic spherical droplet ray trace with single internal reflection and Cauchy dispersion.
 *
 * @param ro Ray origin in world space
 * @param rd Ray direction (unit vector)
 * @param center Droplet sphere center
 * @param radius Droplet sphere radius
 * @param envMap Environment texture sampler
 */
vec3 traceDroplet(vec3 ro, vec3 rd, vec3 center, float radius, sampler2D envMap) {
  vec3 oc = ro - center;
  float b = dot(oc, rd);
  float c = dot(oc, oc) - radius * radius;
  float h = b * b - c;
  if (h < 0.0) return texture(envMap, rd.xy * 0.5 + 0.5).rgb; // Ray missed droplet

  float t1 = -b - sqrt(h);
  if (t1 < 0.0) return texture(envMap, rd.xy * 0.5 + 0.5).rgb; // Droplet is behind ray

  vec3 hitPos = ro + rd * t1;
  vec3 norm = normalize(hitPos - center);

  vec3 accumColor = vec3(0.0);
  const int SAMPLES = 8;

  for (int i = 0; i < SAMPLES; i++) {
    float wl = 400.0 + float(i) * (300.0 / float(SAMPLES - 1));
    float ior = waterIOR(wl);

    // 1st refraction at outer boundary
    vec3 refractDir = refract(rd, norm, 1.0 / ior);
    if (dot(refractDir, refractDir) < 0.01) continue;

    // Internal chord to back wall
    float chord = 2.0 * dot(center - hitPos, refractDir);
    vec3 backHit = hitPos + refractDir * chord;
    vec3 backNorm = normalize(center - backHit);

    // Internal reflection off back wall
    vec3 reflectDir = reflect(refractDir, backNorm);

    // 2nd hit on boundary & exit refraction back into air
    float chord2 = 2.0 * dot(center - backHit, reflectDir);
    vec3 exitHit = backHit + reflectDir * chord2;
    vec3 exitNorm = normalize(center - exitHit);
    vec3 exitDir = refract(reflectDir, exitNorm, ior);

    // If total internal reflection at exit, fallback to reflected ray
    if (dot(exitDir, exitDir) < 0.01) {
      exitDir = reflect(reflectDir, exitNorm);
    }

    // Sample environment / sky map
    vec3 env = texture(envMap, exitDir.xy * 0.5 + 0.5).rgb;
    vec3 sampleWeight = wavelengthColor(wl);
    accumColor += env * sampleWeight;
  }

  return accumColor / float(SAMPLES);
}
`;
}

export const REFRACT_GLSL = buildGLSLRefract();
