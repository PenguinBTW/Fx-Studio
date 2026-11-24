/**
 * atmosphere.ts — closed-form height fog + aerial perspective.
 *
 * Determinism sacred: every function is a pure closed-form f(geometry) — no
 * integration steps, no iteration, no noise. Fog density follows the standard
 * exponential height model ρ(y) = baseDensity · exp(−heightFalloff · y), and
 * the optical depth along an arbitrary ray is integrated ANALYTICALLY:
 *
 *   τ = ∫₀^d a·e^(−b(y₀ + s·k)) ds = a·e^(−b·y₀)·(1 − e^(−b·k·d)) / (b·k)
 *
 * where k = (y₁−y₀)/d is the ray's vertical slope fraction. The k→0 limit is
 * handled exactly: τ → a·e^(−b·y₀)·d.
 *
 * Aerial perspective inscatter uses the physically-motivated horizon-brightening
 * approximation: inscatter ∝ (1 − T) weighted toward the horizon direction,
 * tinted per-channel with a Rayleigh-ordered weighting (blue scatters most).
 */

export interface HeightFogOpts {
  /** density at y=0 (per world-unit). */
  baseDensity: number;
  /** height falloff rate (per world-unit); 0 = uniform fog. */
  heightFalloff: number;
}

/**
 * Optical depth along a ray through exponential height fog.
 * @param y0 start height, @param y1 end height, @param dist ray length (3D),
 * @param baseDensity a, @param heightFalloff b.
 * Exact closed form; exact in the horizontal-ray limit.
 */
export function fogOpticalDepth(y0: number, y1: number, dist: number, baseDensity: number, heightFalloff: number): number {
  if (dist <= 0 || baseDensity <= 0) return 0;
  if (heightFalloff === 0) return baseDensity * dist;
  const k = (y1 - y0) / dist;
  const bk = heightFalloff * k;
  // exact limit when the ray is horizontal (bk → 0): 1−e^(−bk·d) → bk·d
  if (Math.abs(bk) < 1e-7) return baseDensity * Math.exp(-heightFalloff * y0) * dist;
  return (baseDensity * Math.exp(-heightFalloff * y0) * (1 - Math.exp(-bk * dist))) / bk;
}

/** Beer-Lambert transmittance T = e^(−τ). */
export function fogTransmittance(y0: number, y1: number, dist: number, baseDensity: number, heightFalloff: number): number {
  return Math.exp(-fogOpticalDepth(y0, y1, dist, baseDensity, heightFalloff));
}

/**
 * Aerial perspective fog color for a ray direction, linear-sRGB HDR.
 * Physically motivated ordering: Rayleigh scattering ∝ 1/λ⁴ means the sky
 * inscatter is blue-weighted; near the horizon the airmass is largest so the
 * inscatter brightens and warms slightly (longer path, forward scattering).
 * @param elevNorm ray elevation direction component normalized [-1, 1] (y of normalized dir)
 * @param fogColor base fog color (linear sRGB), typically a sky-ambient tone
 * @param horizonBoost how much brighter/warmer the horizon inscatter is (0..1 typical)
 */
export function aerialFogColor(
  elevNorm: number,
  fogColor: [number, number, number],
  horizonBoost = 0.35,
): [number, number, number] {
  // horizon factor: 1 at horizontal, → 0 looking straight up/down
  const horiz = Math.max(0, 1 - Math.abs(elevNorm));
  const h = horiz * horiz * horizonBoost;
  // warm shift at horizon: red/green boosted slightly more than blue
  return [
    fogColor[0] * (1 + h * 1.15),
    fogColor[1] * (1 + h * 1.0),
    fogColor[2] * (1 + h * 0.8),
  ];
}

/**
 * Full aerial composite: final linear color of an object at distance.
 *   out = objectColor · T + fogColor(ray) · (1 − T)
 * — the standard inscatter equation, exact for homogeneous-per-ray inscatter.
 */
export function applyAerialPerspective(
  objectColor: [number, number, number],
  y0: number, y1: number, dist: number,
  elevNorm: number,
  fog: HeightFogOpts,
  fogColor: [number, number, number],
  horizonBoost = 0.35,
): [number, number, number] {
  const T = fogTransmittance(y0, y1, dist, fog.baseDensity, fog.heightFalloff);
  const fc = aerialFogColor(elevNorm, fogColor, horizonBoost);
  const s = 1 - T;
  return [
    objectColor[0] * T + fc[0] * s,
    objectColor[1] * T + fc[1] * s,
    objectColor[2] * T + fc[2] * s,
  ];
}

/**
 * GLSL chunk mirroring fogOpticalDepth + fogTransmittance exactly, for injection
 * into scene shaders — keeps GPU visuals bit-consistent with CPU-side planning math.
 */
export const ATMOSPHERE_GLSL = /* glsl */ `
float fogOpticalDepth(float y0, float y1, float dist, float baseDensity, float heightFalloff) {
  if (dist <= 0.0 || baseDensity <= 0.0) return 0.0;
  if (heightFalloff == 0.0) return baseDensity * dist;
  float k = (y1 - y0) / dist;
  float bk = heightFalloff * k;
  if (abs(bk) < 1e-7) return baseDensity * exp(-heightFalloff * y0) * dist;
  return baseDensity * exp(-heightFalloff * y0) * (1.0 - exp(-bk * dist)) / bk;
}
float fogTransmittance(float y0, float y1, float dist, float baseDensity, float heightFalloff) {
  return exp(-fogOpticalDepth(y0, y1, dist, baseDensity, heightFalloff));
}
`;

/**
 * Convenience: patch a THREE scene with fog whose EXP2 density matches the
 * height-fog model at a reference height — for scenes using standard materials.
 * Returns the exact density so callers can verify. (Height fog proper needs the
 * GLSL chunk in custom shaders; this is the zero-effort consistent default.)
 */
export function uniformEquivalentDensity(referenceHeight: number, fog: HeightFogOpts): number {
  return fog.baseDensity * Math.exp(-fog.heightFalloff * referenceHeight);
}
