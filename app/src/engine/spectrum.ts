// Spectral colour science: wavelength / blackbody -> linear sRGB, Oklab helpers, emission-line
// constants and equal-energy spectral samples for dispersion. All functions are pure (no state,
// no randomness). Every colour in and out is LINEAR sRGB (Rec.709 primaries, D65 white) unless a
// name says otherwise. The GLSL mirror lives in glsl/spectrum.ts and must stay in step with this file.
import { clamp } from './util';

export type RGB = [number, number, number];

// ---------------------------------------------------------------------------------------------
// Emission lines and laser wavelengths (nm, in air). Use with wavelengthToLinearSRGB(nm, 'luminous').
// ---------------------------------------------------------------------------------------------
/** [OI] 557.7 nm: the green auroral line (forbidden transition, ~100-150 km altitude). */
export const OXYGEN_GREEN = 557.7;
/** [OI] 630.0 nm: the red auroral line (above ~200 km, long-lived so it only survives in thin air). */
export const OXYGEN_RED = 630.0;
/** [OI] 636.4 nm: the weaker partner of the 630.0 red doublet. */
export const OXYGEN_RED_636 = 636.4;
/** Sodium D2 589.0 nm (D1 is 589.6): the yellow-orange of street lamps and salted flames. */
export const SODIUM_D = 589.0;
/** Sodium D1 589.6 nm. */
export const SODIUM_D1 = 589.6;
/** N2+ first negative band head, 427.8 nm: the violet-blue lower fringe of an aurora. */
export const NITROGEN_N2P = 427.8;
/** N2+ first negative band, 391.4 nm: the strongest violet-blue line (mostly UV-edge, dim to the eye). */
export const NITROGEN_N2P_VIOLET = 391.4;
/** N2 first positive band, ~660 nm: broad red-pink fringe at the base of an aurora curtain. */
export const NITROGEN_N2_RED = 660.0;
/** Hydrogen Balmer alpha, 656.3 nm: the red of emission nebulae. */
export const H_ALPHA = 656.3;
/** Hydrogen Balmer beta, 486.1 nm: cyan-blue. */
export const H_BETA = 486.1;
/** Hydrogen Balmer gamma, 434.0 nm: blue-violet. */
export const H_GAMMA = 434.0;
/** Hydrogen Balmer delta, 410.2 nm: violet. */
export const H_DELTA = 410.2;
/** [OIII] 500.7 nm: the green-teal of planetary nebulae (the "nebulium" line). */
export const OIII = 500.7;
/** [NII] 658.4 nm: red line beside H-alpha in nebulae. */
export const NII = 658.4;
/** [SII] 671.6 nm: deep red nebula line. */
export const SII = 671.6;
/** Mercury 404.7 nm: violet (the visible edge of a UV lamp). */
export const MERCURY_VIOLET = 404.7;
/** Mercury 435.8 nm: blue. */
export const MERCURY_BLUE = 435.8;
/** Mercury 546.1 nm: green (the bright line of fluorescent tubes and mercury lamps). */
export const MERCURY_GREEN = 546.1;
/** Mercury 577.0 / 579.1 nm doublet, ~578.0: yellow. */
export const MERCURY_YELLOW = 578.0;
/** Helium 447.1 nm: blue. */
export const HELIUM_BLUE = 447.1;
/** Helium 501.6 nm: green. */
export const HELIUM_GREEN = 501.6;
/** Helium D3 587.6 nm: yellow (the line that first revealed helium in the Sun). */
export const HELIUM_D3 = 587.6;
/** Helium 667.8 nm: red. */
export const HELIUM_RED = 667.8;
/** Neon 640.2 nm: the orange-red of neon signs. */
export const NEON_RED = 640.2;
/** Lithium 670.8 nm: crimson flame colour. */
export const LITHIUM_RED = 670.8;
/** Calcium 422.7 nm: violet-blue (flame test, stellar spectra). */
export const CALCIUM_VIOLET = 422.7;
/** Strontium 460.7 nm: blue (flame test). */
export const STRONTIUM_BLUE = 460.7;
/** Argon-ion laser, 488.0 nm: cyan-blue. */
export const LASER_ARGON_BLUE = 488.0;
/** Argon-ion laser, 514.5 nm: green. */
export const LASER_ARGON_GREEN = 514.5;
/** Frequency-doubled Nd:YAG, 532.0 nm: the common green laser pointer. */
export const LASER_GREEN_532 = 532.0;
/** Helium-neon laser, 632.8 nm: classic red laser. */
export const LASER_HENE = 632.8;
/** Red laser diode, 650.0 nm. */
export const LASER_RED_650 = 650.0;
/** Blue laser diode, 405.0 nm: Blu-ray violet. */
export const LASER_VIOLET_405 = 405.0;

/** Name -> wavelength map of all lines above, for labelling and iteration. */
export const SPECTRAL_LINES: Readonly<Record<string, number>> = {
  OXYGEN_GREEN, OXYGEN_RED, OXYGEN_RED_636, SODIUM_D, SODIUM_D1, NITROGEN_N2P, NITROGEN_N2P_VIOLET, NITROGEN_N2_RED,
  H_ALPHA, H_BETA, H_GAMMA, H_DELTA, OIII, NII, SII, MERCURY_VIOLET, MERCURY_BLUE, MERCURY_GREEN, MERCURY_YELLOW,
  HELIUM_BLUE, HELIUM_GREEN, HELIUM_D3, HELIUM_RED, NEON_RED, LITHIUM_RED, CALCIUM_VIOLET, STRONTIUM_BLUE,
  LASER_ARGON_BLUE, LASER_ARGON_GREEN, LASER_GREEN_532, LASER_HENE, LASER_RED_650, LASER_VIOLET_405,
};

/** Visible range used by spectrumRamp and spectralSamples defaults. */
export const VISIBLE_MIN_NM = 380;
export const VISIBLE_MAX_NM = 700;

// ---------------------------------------------------------------------------------------------
// CIE 1931 2-degree colour matching functions: Wyman, Sloan & Shirley (2013) multi-lobe fit.
// ---------------------------------------------------------------------------------------------
const lobe = (l: number, mu: number, s1: number, s2: number) => {
  const t = (l - mu) / (l < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
};

/** CIE 1931 xbar, ybar, zbar at `nm`. ybar is the photopic luminosity function (peak ~1 near 560 nm). */
export function cieXYZ(nm: number): RGB {
  return [
    1.056 * lobe(nm, 599.8, 37.9, 31.0) + 0.362 * lobe(nm, 442.0, 16.0, 26.7) - 0.065 * lobe(nm, 501.1, 20.4, 26.2),
    0.821 * lobe(nm, 568.8, 46.9, 40.5) + 0.286 * lobe(nm, 530.9, 16.3, 31.1),
    1.217 * lobe(nm, 437.0, 11.8, 36.0) + 0.681 * lobe(nm, 459.0, 26.0, 13.8),
  ];
}

/** XYZ (D65 white) -> linear sRGB, unclipped (may be negative outside the gamut). */
export function xyzToLinearSRGB(x: number, y: number, z: number): RGB {
  return [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
}

/** Linear sRGB -> XYZ. */
export function linearSRGBToXYZ(r: number, g: number, b: number): RGB {
  return [
    0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  ];
}

/**
 * Gamut mapping by desaturation toward white: the most negative channel is lifted to zero by adding
 * the same amount to all three (a mix with the achromatic axis), which keeps hue and never clips.
 */
export function desaturateToGamut(c: RGB): RGB {
  const w = Math.min(0, c[0], c[1], c[2]);
  return [c[0] - w, c[1] - w, c[2] - w];
}

const smax = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
};
const SOFT_K = 0.12;

/**
 * Smooth variant of desaturateToGamut for the spectral locus. The white added is a smooth-max
 * (k = 0.12, relative to the largest channel) of the negative excursions, so there is no slope
 * discontinuity where a channel crosses zero (a hard max(0, -min) shows as seams in a rainbow).
 * It adds a small extra white (<= 0.03 of the peak) to colours that sit exactly on the gamut edge.
 */
export function softDesaturateToGamut(c: RGB): RGB {
  const s = Math.max(Math.abs(c[0]), Math.abs(c[1]), Math.abs(c[2]), 1e-12);
  const n = smax(0, smax(-c[0] / s, smax(-c[1] / s, -c[2] / s, SOFT_K), SOFT_K), SOFT_K) * s;
  return [c[0] + n, c[1] + n, c[2] + n];
}

const smooth01 = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Gamut-mapped CIE colour of unit radiance at `nm`, before intensity normalisation. Below 430 nm the
 * fit values are ~1e-3 and mostly fit error, so the colour is blended (smoothstep 400..430) to the
 * 420 nm chromaticity scaled by ybar: 380-410 nm reads as a continuous deep violet, not cyan.
 */
export function spectralColour(nm: number): RGB {
  const [x, y, z] = cieXYZ(nm);
  const c = softDesaturateToGamut(xyzToLinearSRGB(x, y, z));
  if (nm >= 430) return c;
  const [x4, y4, z4] = cieXYZ(420);
  const h = softDesaturateToGamut(xyzToLinearSRGB(x4, y4, z4));
  const k = y / y4, w = smooth01(400, 430, nm);
  return [h[0] * k * (1 - w) + c[0] * w, h[1] * k * (1 - w) + c[1] * w, h[2] * k * (1 - w) + c[2] * w];
}
/**
 * How the brightness of a spectral colour is scaled.
 *  - 'peak'     (default) brightest channel = 1: saturated and legible at every wavelength (a UI/emission colour).
 *  - 'luminous' 'peak' times ybar(nm): physically plausible eye response, violet and deep red fall to dark.
 *  - 'none'     raw CIE tristimulus of unit spectral radiance after gamut mapping (very dim at the ends).
 */
export type SpectralIntensity = 'peak' | 'luminous' | 'none';

/**
 * Monochromatic light of wavelength `nm` as linear sRGB (valid 360-830 nm, black outside).
 * Out-of-gamut colours are desaturated toward white with a smooth map (softDesaturateToGamut), never clipped; the violet tail uses spectralColour().
 */
export function wavelengthToLinearSRGB(nm: number, intensity: SpectralIntensity = 'peak'): RGB {
  if (!(nm >= 360 && nm <= 830)) return [0, 0, 0];
  const y = cieXYZ(nm)[1];
  const c = spectralColour(nm);
  if (intensity === 'none') return c;
  const k = (intensity === 'luminous' ? Math.max(y, 0) : 1) / Math.max(c[0], c[1], c[2], 1e-9);
  return [c[0] * k, c[1] * k, c[2] * k];
}

/**
 * Colour ramp across the visible spectrum: t = 0 -> 380 nm (violet), t = 1 -> 700 nm (red).
 * `width` (nm, default 0) box-averages the spectrum over [lambda - width/2, lambda + width/2] with 9 taps,
 * a cheap model of dispersion blur / finite bandwidth: it pastels the saturated spectral colours
 * smoothly instead of leaving hard hue steps.
 */
export function spectrumRamp(t: number, width = 0, intensity: SpectralIntensity = 'peak'): RGB {
  const nm = VISIBLE_MIN_NM + clamp(t, 0, 1) * (VISIBLE_MAX_NM - VISIBLE_MIN_NM);
  if (width <= 0) return wavelengthToLinearSRGB(nm, intensity);
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < 9; i++) {
    const c = wavelengthToLinearSRGB(nm + (i / 8 - 0.5) * width, intensity);
    r += c[0]; g += c[1]; b += c[2];
  }
  return [r / 9, g / 9, b / 9];
}

export interface SpectralSamples {
  /** Sample wavelengths, centres of n equal bins on [lo, hi]. */
  nm: number[];
  /** Per-sample linear sRGB weights. Summed over all samples they equal exactly (1, 1, 1). */
  rgb: RGB[];
}

/**
 * n wavelength samples with RGB weights, for accumulating dispersion (e.g. refraction rendered once
 * per wavelength). Every sample carries equal spectral radiance, so adding them all gives white:
 * each sample is the gamut-mapped CIE colour, then every channel is divided by its own sum over the
 * samples (a white balance). Summing `rgb[i] * L(nm[i])` yields white when L is constant and a
 * rainbow when L varies with wavelength. The balance is per call: a narrow [lo, hi] window also sums
 * to white, so use the same (n, lo, hi) for every pixel of a frame.
 */
export function spectralSamples(n: number, lo = VISIBLE_MIN_NM, hi = VISIBLE_MAX_NM): SpectralSamples {
  const count = Math.max(1, Math.floor(n));
  const nm: number[] = [];
  const raw: RGB[] = [];
  const sum: RGB = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    const l = lo + ((i + 0.5) / count) * (hi - lo);
    const c = spectralColour(l);
    nm.push(l);
    raw.push(c);
    sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2];
  }
  const rgb = raw.map((c): RGB => [c[0] / sum[0], c[1] / sum[1], c[2] / sum[2]]);
  return { nm, rgb };
}

// ---------------------------------------------------------------------------------------------
// Blackbody
// ---------------------------------------------------------------------------------------------
const C2 = 1.438776877e-2; // second radiation constant, m*K
const BB_MIN_K = 1000;
const BB_MAX_K = 40000;

/** Planck spectral exitance up to a constant: 1 / (lambda^5 (exp(c2 / lambda T) - 1)), lambda in nm. */
function planck(nm: number, kelvin: number): number {
  const l = nm * 1e-9;
  return 1 / (l ** 5 * (Math.exp(C2 / (l * kelvin)) - 1)) * 1e-27;
}

/** CIE XYZ of a blackbody, 1 nm integration of Planck's law against the colour matching functions (360-830 nm). */
function blackbodyXYZ(kelvin: number): RGB {
  let x = 0, y = 0, z = 0;
  for (let nm = 360; nm <= 830; nm++) {
    const p = planck(nm, kelvin);
    const [cx, cy, cz] = cieXYZ(nm);
    x += p * cx; y += p * cy; z += p * cz;
  }
  return [x, y, z];
}

const luma709 = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const Y_6500 = blackbodyXYZ(6500)[1];

/**
 * How the brightness of a blackbody colour is scaled.
 *  - 'luminance' (default) relative luminance Y = 1 for every temperature: the pure chromaticity. A 1000 K
 *    ember and a 40000 K star come out equally bright, so multiply by your own emission strength.
 *  - 'peak'      brightest channel = 1.
 *  - 'relative'  Y relative to a 6500 K blackbody (Y(6500 K) = 1): physical brightness ordering at equal
 *    spectral-radiance integration, which grows steeply with T (about 1e-4 at 1000 K, ~100 at 40000 K).
 */
export type BlackbodyNorm = 'luminance' | 'peak' | 'relative';

/**
 * Linear sRGB of a blackbody radiator at `kelvin` (Planckian locus, clamped to 1000-40000 K).
 * Computed by integrating Planck's law against the CIE colour matching functions, then gamut mapped
 * by desaturation toward white (below ~1900 K blue goes negative in sRGB and the colour is pulled in).
 * Under 'luminance' normalisation the Y = 1 holds after the gamut mapping.
 */
export function blackbodyToLinearSRGB(kelvin: number, norm: BlackbodyNorm = 'luminance'): RGB {
  const k = clamp(kelvin, BB_MIN_K, BB_MAX_K);
  const [x, y, z] = blackbodyXYZ(k);
  const c = desaturateToGamut(xyzToLinearSRGB(x / y, 1, z / y));
  const s = norm === 'luminance' ? 1 / luma709(c) : norm === 'peak' ? 1 / Math.max(c[0], c[1], c[2]) : y / Y_6500 / luma709(c);
  return [c[0] * s, c[1] * s, c[2] * s];
}

/** Blackbody linear sRGB at Y = 1 BEFORE gamut mapping (smooth in T, so safe to tabulate and interpolate; the GLSL mirror does this). */
export function blackbodyRawLinearSRGB(kelvin: number): RGB {
  const [x, y, z] = blackbodyXYZ(clamp(kelvin, BB_MIN_K, BB_MAX_K));
  return xyzToLinearSRGB(x / y, 1, z / y);
}

export const BLACKBODY_MIN_K = BB_MIN_K;
export const BLACKBODY_MAX_K = BB_MAX_K;

/** Sum of the gamut-mapped CIE colours over n equal bins on [lo, hi]: the white-balance divisor that spectralSamples applies (pass it to the GLSL spectralSample* helpers as a uniform). */
export function spectralWhite(n: number, lo = VISIBLE_MIN_NM, hi = VISIBLE_MAX_NM): RGB {
  const count = Math.max(1, Math.floor(n));
  const sum: RGB = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    const c = spectralColour(lo + ((i + 0.5) / count) * (hi - lo));
    sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2];
  }
  return sum;
}

// ---------------------------------------------------------------------------------------------
// Oklab / Oklch (Bjorn Ottosson). Inputs and outputs of the linearSRGB* functions are linear sRGB.
// Oklab = [L, a, b], L 0..1. Oklch = [L, C, hDeg], hue in degrees 0..360.
// ---------------------------------------------------------------------------------------------
export function linearSRGBToOklab(c: RGB): RGB {
  const l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]);
  const m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]);
  const s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Oklab -> linear sRGB, unclipped (may leave [0,1] for out-of-gamut Oklab values). */
export function oklabToLinearSRGB(lab: RGB): RGB {
  const l = (lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2]) ** 3;
  const m = (lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2]) ** 3;
  const s = (lab[0] - 0.0894841775 * lab[1] - 1.291485548 * lab[2]) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function oklabToOklch(lab: RGB): RGB {
  const h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
  return [lab[0], Math.hypot(lab[1], lab[2]), h < 0 ? h + 360 : h];
}

export function oklchToOklab(lch: RGB): RGB {
  const h = (lch[2] * Math.PI) / 180;
  return [lch[0], lch[1] * Math.cos(h), lch[1] * Math.sin(h)];
}

export function linearSRGBToOklch(c: RGB): RGB {
  return oklabToOklch(linearSRGBToOklab(c));
}

export function oklchToLinearSRGB(lch: RGB): RGB {
  return oklabToLinearSRGB(oklchToOklab(lch));
}

/** Oklab chroma of a linear sRGB colour: ~0 grey, ~0.4 fully saturated. */
export function oklabChroma(c: RGB): number {
  const lab = linearSRGBToOklab(c);
  return Math.hypot(lab[1], lab[2]);
}

const labMix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Mix two linear sRGB colours in Oklab (perceptually even); result is desaturated into gamut, not clipped. */
export function mixOklab(a: RGB, b: RGB, t: number): RGB {
  return desaturateToGamut(oklabToLinearSRGB(labMix(linearSRGBToOklab(a), linearSRGBToOklab(b), t)));
}

/** Mix in Oklch along the shortest hue arc (keeps chroma through the mix: rainbow-like, no grey middle). */
export function mixOklch(a: RGB, b: RGB, t: number): RGB {
  const ca = linearSRGBToOklch(a), cb = linearSRGBToOklch(b);
  let dh = cb[2] - ca[2];
  if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const h = ca[2] + dh * t;
  return desaturateToGamut(oklchToLinearSRGB([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, h]));
}

export interface GradientStop {
  /** Position 0..1; stops must be ascending. */
  pos: number;
  /** Linear sRGB. */
  rgb: RGB;
}

/** Piecewise-linear Oklab gradient sampler over linear-sRGB stops. t outside the stops clamps to the ends. */
export function makeOklabGradient(stops: GradientStop[]): (t: number) => RGB {
  if (stops.length === 0) return () => [0, 0, 0];
  const labs = stops.map((s) => linearSRGBToOklab(s.rgb));
  return (t: number) => {
    if (t <= stops[0]!.pos) return desaturateToGamut(oklabToLinearSRGB(labs[0]!));
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i]!.pos || i === stops.length - 1) {
        const p0 = stops[i - 1]!.pos, p1 = stops[i]!.pos;
        const u = clamp((t - p0) / Math.max(p1 - p0, 1e-9), 0, 1);
        return desaturateToGamut(oklabToLinearSRGB(labMix(labs[i - 1]!, labs[i]!, u)));
      }
    }
    return [0, 0, 0];
  };
}

// ---------------------------------------------------------------------------------------------
// Display helpers (8-bit sRGB), handy for tests and Canvas2D.
// ---------------------------------------------------------------------------------------------
export function linearToSRGB(v: number): number {
  const c = clamp(v, 0, 1);
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

export function linearToSRGB8(c: RGB): [number, number, number] {
  return [Math.round(linearToSRGB(c[0]) * 255), Math.round(linearToSRGB(c[1]) * 255), Math.round(linearToSRGB(c[2]) * 255)];
}
