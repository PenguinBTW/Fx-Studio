import { BLACKBODY_MAX_K, BLACKBODY_MIN_K, blackbodyRawLinearSRGB, SPECTRAL_LINES } from '../spectrum';

const BB_STEPS = 96;

const f5 = (x: number) => x.toFixed(5);

/**
 * GLSL (ES 3.0) mirror of engine/spectrum.ts. Append after GLSL_COMMON (it uses nothing from it, and
 * defines no name that common.ts defines). All colours are LINEAR sRGB.
 *
 * Cost: wavelengthToLinearSRGB = 7 exp; blackbodyToLinearSRGB = one log + two constant-array reads
 * (a 96-entry table of the un-gamut-mapped Y=1 colour baked from the TS integration, log-spaced 1000-40000 K, then gamut mapped per pixel); Oklab = 3 cbrt-style pow.
 * Dispersion accumulation: `spectralSampleWeight(nm, white)` with `white` = spectralWhite(n, lo, hi) from TS.
 */
export function buildGLSLSpectrum(): string {
  const table: string[] = [];
  for (let i = 0; i < BB_STEPS; i++) {
    const k = BLACKBODY_MIN_K * (BLACKBODY_MAX_K / BLACKBODY_MIN_K) ** (i / (BB_STEPS - 1));
    const c = blackbodyRawLinearSRGB(k);
    table.push(`vec3(${f5(c[0])},${f5(c[1])},${f5(c[2])})`);
  }
  const lines = Object.entries(SPECTRAL_LINES).map(([k, v]) => `const float ${k} = ${v.toFixed(1)};`).join('\n');
  return /* glsl */ `
${lines}
const float BLACKBODY_MIN_K = ${f5(BLACKBODY_MIN_K)};
const float BLACKBODY_MAX_K = ${f5(BLACKBODY_MAX_K)};

float _wsLobe(float l, float mu, float s1, float s2) {
  float t = (l - mu) / (l < mu ? s1 : s2);
  return exp(-0.5 * t * t);
}

/** CIE 1931 xbar, ybar, zbar (Wyman-Sloan-Shirley multi-lobe fit). */
vec3 cieXYZ(float nm) {
  return vec3(
    1.056 * _wsLobe(nm, 599.8, 37.9, 31.0) + 0.362 * _wsLobe(nm, 442.0, 16.0, 26.7) - 0.065 * _wsLobe(nm, 501.1, 20.4, 26.2),
    0.821 * _wsLobe(nm, 568.8, 46.9, 40.5) + 0.286 * _wsLobe(nm, 530.9, 16.3, 31.1),
    1.217 * _wsLobe(nm, 437.0, 11.8, 36.0) + 0.681 * _wsLobe(nm, 459.0, 26.0, 13.8));
}

vec3 xyzToLinearSRGB(vec3 c) {
  return vec3(
    dot(c, vec3(3.2404542, -1.5371385, -0.4985314)),
    dot(c, vec3(-0.969266, 1.8760108, 0.041556)),
    dot(c, vec3(0.0556434, -0.2040259, 1.0572252)));
}

/** Lift the most negative channel to 0 by adding it to all three: desaturates toward white, never clips. */
vec3 desaturateToGamut(vec3 c) { return c - min(0.0, min(c.r, min(c.g, c.b))); }

float _smax(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return max(a, b) + h * h * k * 0.25;
}
/** Smooth desaturate-to-white (TS softDesaturateToGamut): no slope kinks where a channel crosses zero. */
vec3 softDesaturateToGamut(vec3 c) {
  float s = max(max(abs(c.r), max(abs(c.g), abs(c.b))), 1e-12);
  float n = _smax(0.0, _smax(-c.r / s, _smax(-c.g / s, -c.b / s, 0.12), 0.12), 0.12) * s;
  return c + n;
}
/** Gamut-mapped CIE colour at nm, violet tail blended to the 420 nm chromaticity (TS spectralColour). */
vec3 spectralColour(float nm) {
  vec3 xyz = cieXYZ(nm);
  vec3 c = softDesaturateToGamut(xyzToLinearSRGB(xyz));
  if (nm >= 430.0) return c;
  vec3 x4 = cieXYZ(420.0);
  vec3 h = softDesaturateToGamut(xyzToLinearSRGB(x4));
  return mix(h * (xyz.y / x4.y), c, smoothstep(400.0, 430.0, nm));
}

/** intensity: 0 = 'peak' (brightest channel 1), 1 = 'luminous' (peak x ybar), 2 = 'none' (raw CIE after gamut map). */
vec3 wavelengthToLinearSRGB(float nm, int intensity) {
  if (nm < 360.0 || nm > 830.0) return vec3(0.0);
  float y = cieXYZ(nm).y;
  vec3 c = spectralColour(nm);
  if (intensity == 2) return c;
  return c * ((intensity == 1 ? max(y, 0.0) : 1.0) / max(max(c.r, max(c.g, c.b)), 1e-9));
}
vec3 wavelengthToLinearSRGB(float nm) { return wavelengthToLinearSRGB(nm, 0); }

/** t 0..1 -> 380..700 nm, peak-normalised. */
vec3 spectrumRamp(float t) { return wavelengthToLinearSRGB(380.0 + clamp(t, 0.0, 1.0) * 320.0, 0); }
/** Box-averaged over \`width\` nm with 9 taps, same as the TS spectrumRamp(t, width). */
vec3 spectrumRamp(float t, float width) {
  float nm = 380.0 + clamp(t, 0.0, 1.0) * 320.0;
  if (width <= 0.0) return wavelengthToLinearSRGB(nm, 0);
  vec3 s = vec3(0.0);
  for (int i = 0; i < 9; i++) s += wavelengthToLinearSRGB(nm + (float(i) / 8.0 - 0.5) * width, 0);
  return s / 9.0;
}

/** One dispersion sample's weight: gamut-mapped CIE colour divided by \`white\` (= TS spectralWhite(n, lo, hi)). */
vec3 spectralSampleWeight(float nm, vec3 white) {
  return spectralColour(nm) / white;
}

float luma709(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
const vec3 _BB_TABLE[${BB_STEPS}] = vec3[${BB_STEPS}](
  ${table.join(',\n  ')}
);

/** Luminance-normalised (Y = 1) blackbody colour, 1000-40000 K (clamped). TS: blackbodyToLinearSRGB(k, 'luminance'). */
vec3 blackbodyToLinearSRGB(float kelvin) {
  float u = clamp(log(clamp(kelvin, BLACKBODY_MIN_K, BLACKBODY_MAX_K) / BLACKBODY_MIN_K) / log(BLACKBODY_MAX_K / BLACKBODY_MIN_K), 0.0, 1.0) * ${(BB_STEPS - 1).toFixed(1)};
  int i = min(int(u), ${BB_STEPS - 2});
  vec3 c = desaturateToGamut(mix(_BB_TABLE[i], _BB_TABLE[i + 1], u - float(i)));
  return c / luma709(c);
}

float _okCbrt(float x) { return sign(x) * pow(abs(x), 1.0 / 3.0); }
vec3 linearSRGBToOklab(vec3 c) {
  float l = _okCbrt(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b);
  float m = _okCbrt(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b);
  float s = _okCbrt(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b);
  return vec3(
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s);
}
vec3 oklabToLinearSRGB(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.291485548 * lab.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
}
/** Oklch = (L, C, hue in degrees 0..360). */
vec3 oklabToOklch(vec3 lab) {
  float h = degrees(atan(lab.z, lab.y));
  return vec3(lab.x, length(lab.yz), h < 0.0 ? h + 360.0 : h);
}
vec3 oklchToOklab(vec3 lch) {
  float h = radians(lch.z);
  return vec3(lch.x, lch.y * cos(h), lch.y * sin(h));
}
vec3 linearSRGBToOklch(vec3 c) { return oklabToOklch(linearSRGBToOklab(c)); }
vec3 oklchToLinearSRGB(vec3 c) { return oklabToLinearSRGB(oklchToOklab(c)); }
float oklabChroma(vec3 c) { return length(linearSRGBToOklab(c).yz); }

/** Mix two linear sRGB colours in Oklab, gamut-mapped by desaturation. */
vec3 mixOklab(vec3 a, vec3 b, float t) {
  return desaturateToGamut(oklabToLinearSRGB(mix(linearSRGBToOklab(a), linearSRGBToOklab(b), t)));
}
/** Mix along the shortest hue arc in Oklch. */
vec3 mixOklch(vec3 a, vec3 b, float t) {
  vec3 ca = linearSRGBToOklch(a), cb = linearSRGBToOklch(b);
  float dh = cb.z - ca.z;
  dh -= 360.0 * floor(dh / 360.0 + 0.5);
  return desaturateToGamut(oklchToLinearSRGB(vec3(mix(ca.x, cb.x, t), mix(ca.y, cb.y, t), ca.z + dh * t)));
}

/** Equally spaced Oklab gradients over 2, 3 or 4 linear sRGB stops, t 0..1. */
vec3 oklabGradient(vec3 a, vec3 b, float t) { return mixOklab(a, b, clamp(t, 0.0, 1.0)); }
vec3 oklabGradient(vec3 a, vec3 b, vec3 c, float t) {
  t = clamp(t, 0.0, 1.0) * 2.0;
  return t < 1.0 ? mixOklab(a, b, t) : mixOklab(b, c, t - 1.0);
}
vec3 oklabGradient(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
  t = clamp(t, 0.0, 1.0) * 3.0;
  return t < 1.0 ? mixOklab(a, b, t) : (t < 2.0 ? mixOklab(b, c, t - 1.0) : mixOklab(c, d, t - 2.0));
}
`;
}

export const GLSL_SPECTRUM = buildGLSLSpectrum();
