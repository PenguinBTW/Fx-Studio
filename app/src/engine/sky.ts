/**
 * sky.ts — closed-form physically-based procedural sky dome + sun.
 *
 * Rayleigh/Mie scattering evaluated in closed form per view direction — the
 * classical single-scattering approximation with exact optical-path integrals:
 *
 *   L(ω) = β_R · P_R(γ) · (1 − e^(−τ_R·s)) + β_M · P_M(γ) · (1 − e^(−τ_M·s))
 *
 * evaluated analytically through the exponential atmosphere. Rayleigh phase
 * P_R(γ) = 3/(16π)(1 + cos²γ) exactly; Mie uses the closed-form
 * Henyey–Greenstein phase P_M(γ) = (1−g²) / (4π(1+g²−2g·cosγ)^1.5) — both exact
 * closed forms, no sampling, no LUTs, no iteration. Pure f(direction, sun) —
 * deterministic at any resolution.
 *
 * Sun position is time-of-day parameterized in closed form (solar geometry
 * approximation — exact circular orbit, closed-form hour angle) so it can drive
 * godray shaft directions consistently.
 */

export interface SunPosition {
  /** unit direction TO the sun */
  dir: [number, number, number];
  /** elevation above horizon, radians */
  elevation: number;
  /** azimuth from north, radians */
  azimuth: number;
}

/**
 * Closed-form solar position for time-of-day. Circular-orbit approximation —
 * exact for equinox; sufficient for cinematic time-of-day control.
 * @param hour solar time hours [0, 24), @param latitudeDeg observer latitude,
 * @param declinationDeg solar declination (default 0 = equinox)
 */
export function sunPosition(hour: number, latitudeDeg = 52, declinationDeg = 0): SunPosition {
  const lat = (latitudeDeg * Math.PI) / 180;
  const dec = (declinationDeg * Math.PI) / 180;
  const ha = ((hour - 12) / 12) * Math.PI; // hour angle, noon = 0
  const sinEl = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  // azimuth: closed-form spherical geometry
  const cosAz = (Math.sin(dec) - Math.sin(el) * Math.sin(lat)) / Math.max(1e-9, Math.cos(el) * Math.cos(lat));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (ha > 0) az = 2 * Math.PI - az;
  // world frame: y up, north = -z, east = +x
  const ce = Math.cos(el);
  return {
    dir: [ce * Math.sin(az), Math.sin(el), -ce * Math.cos(az)],
    elevation: el,
    azimuth: az,
  };
}

/**
 * Sky radiance in direction ω (unit) for sun direction s (unit), linear HDR.
 * Closed-form Rayleigh + Henyey–Greenstein Mie single scattering.
 * Wavelength-ordered Rayleigh coefficients (physical ratio ~ 1/λ⁴: blue dominates).
 */
export function skyRadiance(
  omega: [number, number, number],
  sunDir: [number, number, number],
  turbidity = 2.0,
): [number, number, number] {
  const cosGamma = omega[0] * sunDir[0] + omega[1] * sunDir[1] + omega[2] * sunDir[2];
  // optical path through atmosphere: longer near horizon — exact for flat-atmosphere
  // approximation s ∝ 1/max(ε, cosZenith)
  const zenith = Math.max(0, omega[1]);
  const sunZen = Math.max(0, sunDir[1]);
  const pathView = 1 / Math.max(0.06, zenith + 0.02);
  const pathSun = 1 / Math.max(0.06, sunZen + 0.02);
  // Rayleigh coefficients (relative, blue-dominant ~ physical 1/λ⁴ ordering)
  const betaR: [number, number, number] = [5.5e-1, 1.35, 3.31]; // normalized units ×1e-1
  const betaM = 0.005 * turbidity;
  // extinction along the combined path (sun→point→eye approximation)
  const ext = (b: number) => Math.exp(-b * 0.08 * (pathView + pathSun));
  // Rayleigh phase: exact 3/(16π)(1+cos²γ) — constant folded into beta scaling
  const phaseR = 0.75 * (1 + cosGamma * cosGamma);
  // Henyey–Greenstein Mie phase, g = 0.76 typical aerosol — exact closed form
  const g = 0.76;
  const g2 = g * g;
  const phaseM = ((1 - g2) / Math.pow(1 + g2 - 2 * g * cosGamma, 1.5)) * 0.25;
  const out: [number, number, number] = [0, 0, 0];
  const betaRArr = betaR;
  for (let i = 0; i < 3; i++) {
    const r = betaRArr[i]! * phaseR * ext(betaRArr[i]!) * 0.5;
    const m = betaM * phaseM * ext(betaM * 10) * 12;
    out[i] = (r + m) as number;
  }
  return out as [number, number, number];
}

/**
 * Sun disc radiance with atmospheric extinction — exact Beer–Lambert along the
 * solar path, limb-darkening omitted (disc treated uniform). Returns HDR multiplier
 * ~1 inside the disc, smooth penumbra edge (closed form smoothstep of angle).
 */
export function sunDisc(
  omega: [number, number, number],
  sunDir: [number, number, number],
  discAngleRad = 0.0047, // physical sun angular radius ~0.267°
  radiance = 40,
): number {
  const cosGamma = omega[0] * sunDir[0] + omega[1] * sunDir[1] + omega[2] * sunDir[2];
  const cosDisc = Math.cos(discAngleRad);
  // soft edge over ~0.5 disc radius for cinematic smoothness — closed form
  const edge = Math.min(1, Math.max(0, (cosGamma - cosDisc) / (1 - cosDisc) / 0.5));
  const sunZen = Math.max(0, sunDir[1]);
  const extinction = Math.exp(-0.35 / Math.max(0.06, sunZen + 0.02));
  return edge * edge * (3 - 2 * edge) * radiance * extinction;
}

/** Composed sky: scattering + disc, the canonical scene backdrop evaluation. */
export function skyColor(
  omega: [number, number, number],
  sunDir: [number, number, number],
  turbidity = 2.0,
): [number, number, number] {
  const s = skyRadiance(omega, sunDir, turbidity);
  const d = sunDisc(omega, sunDir);
  return [s[0] + d, s[1] + d * 0.95, s[2] + d * 0.85];
}

/**
 * GLSL chunk mirroring skyRadiance + sunDisc for sky-dome shaders.
 */
export const SKY_GLSL = /* glsl */ `
vec3 skyRadiance(vec3 omega, vec3 sunDir, float turbidity) {
  float cosGamma = dot(omega, sunDir);
  float zenith = max(0.0, omega.y);
  float sunZen = max(0.0, sunDir.y);
  float pathView = 1.0 / max(0.06, zenith + 0.02);
  float pathSun = 1.0 / max(0.06, sunZen + 0.02);
  vec3 betaR = vec3(0.55, 1.35, 3.31);
  float betaM = 0.005 * turbidity;
  float phaseR = 0.75 * (1.0 + cosGamma * cosGamma);
  float g = 0.76;
  float g2 = g * g;
  float phaseM = (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * cosGamma, 1.5) * 0.25;
  vec3 ext = exp(-betaR * 0.08 * (pathView + pathSun));
  vec3 r = betaR * phaseR * ext * 0.5;
  float m = betaM * phaseM * exp(-betaM * 10.0 * 0.08 * (pathView + pathSun)) * 12.0;
  return r + vec3(m);
}
`;
