# Spectrum: colour science (`engine/spectrum.ts`, `engine/glsl/spectrum.ts`)

Wavelength, blackbody and Oklab colour, in TS and as a GLSL mirror. Everything is **linear sRGB** (Rec.709, D65), pure and deterministic.

## Wavelength

`wavelengthToLinearSRGB(nm, intensity = 'peak')`: CIE 1931 colour matching via the Wyman-Sloan-Shirley multi-lobe fit (`cieXYZ`), converted to sRGB. Out-of-gamut results (every spectral colour is) are **desaturated toward white**, never clipped. Valid 360-830 nm, black outside.

- `softDesaturateToGamut` (used for spectral colours): the white added is a smooth-max (k = 0.12, relative to the largest channel) of the negative excursions. The hard `desaturateToGamut` (add `-min(0, r, g, b)`) is kept for blackbody and Oklab mixes, but on the spectral locus it left slope kinks of ~100/255 per nm at ~395, ~462 and ~549 nm where a channel crosses zero; these showed as seams in a rainbow strip. The smooth map adds a little extra white (<= ~3% of peak) near those crossings.
- `spectralColour(nm)` (the unit-radiance colour used by every spectral function): below 430 nm the CMF fit is ~1e-3 and mostly fit error, and peak normalisation turned it azure/cyan at 380-395 nm. It is blended (smoothstep 400..430 nm) to the 420 nm chromaticity scaled by ybar, so 380-410 nm is a constant violet, about (0.28, 0, 1) in linear sRGB (8-bit ~ (144, 0, 243)). The violet is saturated, not dark; use `'luminous'` for the physical fade to black.

Measured on the rendered chart (0.2 nm per pixel) the largest step is 4/255 (was ~20/255).

| `intensity` | meaning |
|---|---|
| `'peak'` | brightest channel = 1 (saturated, legible everywhere) |
| `'luminous'` | peak x ybar(nm): eye response, violet and deep red go dark |
| `'none'` | raw CIE tristimulus after gamut mapping (very dim at the ends) |

`spectrumRamp(t, width = 0)`: t 0..1 = 380..700 nm. `width` nm box-averages 9 taps (finite bandwidth / dispersion blur; pastels the colours).

`spectralSamples(n, lo = 380, hi = 700)` returns `{ nm[], rgb[] }`: n bin-centre wavelengths with weights white-balanced so that **equal radiance on all samples sums exactly to (1,1,1)**. Use for dispersion: `sum_i rgb[i] * L(nm[i])`. The balance is per `(n, lo, hi)`, so keep them fixed across a frame. `spectralWhite(n, lo, hi)` gives the divisor for the GPU (`spectralSampleWeight(nm, white)`).

## Blackbody

`blackbodyToLinearSRGB(kelvin, norm = 'luminance')`: Planck's law integrated at 1 nm against the CMFs (360-830 nm), clamped to 1000-40000 K, gamut-mapped by desaturation (below ~1900 K blue is negative in sRGB).

| `norm` | meaning |
|---|---|
| `'luminance'` (default) | relative luminance Y = 1 at every T (pure chromaticity; scale by your own strength). Components can exceed 1 (5778 K is about [1.11, 0.98, 0.91]) |
| `'peak'` | brightest channel = 1 |
| `'relative'` | Y relative to 6500 K (physical ordering, ~1e-4 at 1000 K to ~100 at 40000 K) |

Reference values (luminance norm): 3000 K [1.755, 0.849, 0.271] (amber), 1000 K [4.03, 0.20, 0] (ember), 40000 K [0.70, 0.98, 2.05].

GLSL `blackbodyToLinearSRGB(k)` is the `'luminance'` mode only: a 96-entry log-spaced table of the un-gamut-mapped colour, interpolated, then gamut-mapped and Y-normalised per pixel (gamut-mapping after interpolation is needed to stay within 1/255 near the 1900 K kink).

## Oklab

TS: `linearSRGBToOklab/oklabToLinearSRGB`, `oklabToOklch/oklchToOklab` (hue in degrees), `linearSRGBToOklch/oklchToLinearSRGB`, `oklabChroma`, `mixOklab`, `mixOklch` (shortest hue arc, keeps chroma), `makeOklabGradient(stops)` (piecewise, ascending `pos`). Mixes gamut-map by desaturation. GLSL has the same names, plus `oklabGradient(a,b,[c,[d,]]t)` over 2-4 equally spaced stops.

## Constants

`OXYGEN_GREEN` 557.7, `OXYGEN_RED` 630.0, `SODIUM_D` 589.0, `NITROGEN_N2P` 427.8, `NITROGEN_N2P_VIOLET` 391.4, `H_ALPHA` 656.3, `H_BETA` 486.1, plus Balmer gamma/delta, OIII, NII, SII, mercury, helium, neon, lithium, calcium, strontium and laser lines. All are in `SPECTRAL_LINES` and are emitted as `const float` in the GLSL chunk. 391.4 nm is at the UV edge (the CMF is tiny there: use `'peak'` intensity or it renders near black).

## GLSL use

```ts
import { GLSL_SPECTRUM } from '../engine/glsl/spectrum';
new FSPass(`${GLSL_SPECTRUM}\nvoid main(){ fragColor = vec4(blackbodyToLinearSRGB(3000.0), 1.0); }`, {});
```

Append after `GLSL_COMMON` (FSPass adds it). Names do not clash with common.ts. `wavelengthToLinearSRGB(nm, int intensity)` takes 0 peak / 1 luminous / 2 none. Cost: wavelength = 7 `exp`; blackbody = one `log` + table read; Oklab = 3 `pow`.

## Test and chart

`bun run test:spectrum` (in `app/`): CPU checks (including 380 nm violet and max strip step < 8/255), then headless Chrome GPU-vs-CPU comparison (8-bit sRGB, tolerance 1/255) through `scenes/_prereq_demos/spectrum/` (project `spectrum`). Writes `out/prereq/spectrum_chart.png` and asserts on the rendered strip row (y = 220: max per-pixel step < 8/255, 380 nm violet). `--no-gpu` skips the browser part.

## Limits and gaps

- The WSS fit is accurate to a few percent of the true CMFs; fine for rendering, not for colorimetry.
- Out-of-gamut handling is desaturation toward equal-RGB white, not a perceptual (Oklab chroma) clip; hue may shift slightly for the strongly negative channels.
- The 380-410 nm violet is a blend to the 420 nm chromaticity, not the true CIE colour (which is outside what the fit resolves).
- GLSL blackbody has no `'peak'`/`'relative'` mode.
- No sRGB gamut mapping for `makeOklabGradient` beyond desaturation; no spectral upsampling of arbitrary RGB.
