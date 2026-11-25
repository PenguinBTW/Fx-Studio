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
  const dy = y1 - y0;
  const bdy = heightFalloff * dy;
  // shallow rays: total exponent change decides, not slope alone — a long shallow ray
  // can still span many scale heights. Midpoint density, error O((b·dy)²/24).
  if (Math.abs(bdy) < 1e-3) {
    return baseDensity * Math.exp(-heightFalloff * (y0 + y1) / 2) * dist;
  }
  // difference form: a·(e^(−b·y0) − e^(−b·y1))·d/(b·dy) — mathematically identical to
  // the factored integral but NEVER evaluates large exponentials for positive heights
  // (the factored form overflows float32 shaders on downward rays, e.g. y0=100→y1=0).
  // Reference-factored difference: e^{cmax}·(e^{c0−cmax} − e^{c1−cmax}) — the inner
  // exponentials are ≤ 1 so they never overflow; when the true optical depth is huge
  // (deep negative heights), e^{cmax} overflows to +inf which is PHYSICALLY CORRECT:
  // τ = +inf → T = e^{−inf} = 0. IEEE semantics do the right thing — no NaN because
  // the inf appears only as a multiplier of a nonzero finite difference.
  const c0 = -heightFalloff * y0;
  const c1 = -heightFalloff * y1;
  const cmax = Math.max(c0, c1);
  const k = dy / dist;
  return (baseDensity * Math.exp(cmax) * (Math.exp(c0 - cmax) - Math.exp(c1 - cmax))) / (heightFalloff * k);
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
  float dy = y1 - y0;
  float bdy = heightFalloff * dy;
  // shallow-ray branch keys on TOTAL height change, not slope — midpoint density
  if (abs(bdy) < 1e-3) return baseDensity * exp(-heightFalloff * (y0 + y1) * 0.5) * dist;
  // reference-factored difference — inner exponentials ≤ 1, no NaN; deep negative
  // heights overflow the outer factor to +inf which is correct (T = e^(−inf) = 0)
  float c0 = -heightFalloff * y0;
  float c1 = -heightFalloff * y1;
  float cmax = max(c0, c1);
  float k = dy / dist;
  return baseDensity * exp(cmax) * (exp(c0 - cmax) - exp(c1 - cmax)) / (heightFalloff * k);
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
export function uniformEquivalentDensity(referenceHeight: number, fog: HeightFogOpts, referenceDistance = 30): number {
  // THREE.FogExp2 attenuates as e^(−(density·depth)²) — QUADRATIC in depth, so a
  // linear height-fog exponent can't be matched exactly. We match transmittance at
  // a characteristic scene distance: (d·dRef)² = a·e^(−b·y)·dRef → d = sqrt(a·e^(−b·y)/dRef).
  // Note the match is exact only where view-space depth equals ray length (camera axis);
  // off-axis rays of the same length get slightly less standard-material fog — inherent
  // to FogExp2's depth-based formulation, not correctable without a custom shader.
  const linear = fog.baseDensity * Math.exp(-fog.heightFalloff * referenceHeight);
  return Math.sqrt(linear / referenceDistance);
}
