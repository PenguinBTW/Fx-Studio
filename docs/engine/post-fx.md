# Post-FX (`app/src/engine/post.ts`, `post_optics.ts`)

All new options are optional and default to the previous behaviour: `story_room` and `music_video` baseline frames are byte-identical (max per-channel diff 0).
Params go through the usual `PostOverrides` (scene return value, entry `post`, or `DEFAULT_POST`).

## Pass order (final pass, linear light unless noted)

`src` -> CA -> `+ bloom + halation + optics` -> `exposure` -> *(DoF slot, see below)* -> god-rays -> grade -> `colorTint` -> HUD + tone map -> invert -> flash -> vignette -> `(1 - fade)` -> sRGB -> grain + dither (scaled by `(1-fade)*level`) -> `blackPoint` -> `level` -> hard zero when `fade >= 1` or `level <= 0`.

### Seam for the depth DoF (Opus)
- Radial DoF lives inline in the final pass at the `// Optical Depth of Field` block, right after `col *= exposure`.
- A world-depth DoF should be a separate pass that runs **before** `this.final` (reads `src` plus a scene depth texture, writes an HDR RT) and then `f.src.value` is pointed at its output; bloom/halation/CA then see the defocused frame, as expected. The place to add it is in `Post.render()` just above `const f = this.final.u;` (a `runDepthDof` branch gated on `p.depthFocusDist !== undefined`). Add `depthFocusDist` (world units) and aperture to `PostParams` next to `focusDist`; the radial params keep their meaning.
- Note `src` is premultiplied HDR; the existing radial DoF un-premultiplies per tap.

## Grade

```ts
post.grade = 'industrial';                                  // legacy enum
post.grade = { lift: 0.01, gamma: 1.1, gain: [1.1, 1, .9], saturation: .8, tint: [1, 1, 1.05] };
post.grade = (t) => gradeMix(A, B, smoothstep(t / 4));      // function of song time t
```
Linear light: `rgb = mix(luma, rgb, saturation); rgb = rgb*gain + lift; rgb = pow(rgb, 1/gamma) * tint`. Missing fields are identity (an empty `{}` grade is a no-op, tested). `gradeMix(a, b, k)` blends lift/saturation linearly and gamma/gain/tint in log space, k clamped 0..1; returns a resolved grade usable directly as `grade`. The function form is called with the `time` passed to `Post.render` (song time). `colorTint` still multiplies afterwards.

## True black
- `fade` (existing, 0..1) and new `level` (multiplier, default 1) are applied last. Grain and dither amplitude are scaled by `(1-fade)*level`, and at `fade >= 1` or `level <= 0` the output is forced to exactly `vec3(0)` (also removes NaN/Inf), alpha stays 1 (or 0 with `transparent`).
- Verified headless with everything on (bloom 2, halation, CA, grain .2, vignette 1, god-rays, optics, DoF): 0 non-zero bytes in 1920x1080. fade=0.9999 -> max byte 0.
- `blackPoint` (0..0.99, default 0): display-referred, `out = (out - bp) / (1 - bp)` after grain, so noise below the black point is clipped away.
- Bloom, halation, optics and vignette are additive/multiplicative before the fade, so they cannot lift black on their own; at `fade=1` the optics pass is skipped.

## Tone map
`toneMap: 'legacy' | 'aces' | 'agx'` (default legacy: exactly the old exponential shoulder). ACES/AgX are not identity in the mids, so with them the HUD is mixed in *after* the tone map (display-linear). `toneMapHue` (0..1) blends toward a hue-preserving form (curve on the max channel, RGB rescaled, plus the legacy very-bright desaturation toward white).
HDR above 1 is preserved in HalfFloat RTs through bloom (prefilter clamps at 40); test: a 12.0 pixel bloom-lights its neighbours.
Violet-white swatch `(0.55, 0.40, 1.0)*k`, k = 0.4..40, hue measured in oklab (only where chroma > 0.06):

| map | max hue shift |
|---|---|
| legacy | 2.5 deg |
| aces (plain) | 8.5 deg (info; toward pink/magenta slightly, desaturates faster) |
| agx (plain) | 4.2 deg |
| aces / agx + `toneMapHue: 1` | 0.7 deg |

Beyond k ~ 40 every map clips to white (no hue left to shift).

## Photon optics (`post_optics.ts`)
`optics: { threshold, spikes: 0|4|6, spikeLength, airyRadius, intensity, tint, angle }`, off unless `optics` is set with `intensity > 0` (defaults: threshold 2, 6 spikes, length 160 px, airy 4 px, intensity 0.6).
- Input: HDR pixels, `c * max(0, max(rgb) - threshold) / max(rgb)` (hue-preserving), at half resolution.
- Spikes: per aperture axis (2 for 4-spike, 3 for 6-spike; each axis gives two opposite spikes) a 3-pass exponential-step streak, each channel sampled with its own scale (R 1.3x, G 1.0x, B 0.75x), so red spikes are longer than blue. Length is reach to ~3% intensity for green.
- Airy disk: 21x21 half-res gather with a CPU-built Airy kernel (`(2 J1(x)/x)^2`, per-channel radius scale, unit energy), with a 16x16-texel occupancy mask so empty frames skip the gather.
- `tint` is a plain linear RGB multiplier (hook for a spectrum colour); nothing imports `spectrum.ts`.

## God-ray tiers
`volumetricSteps` (default 10, `GODRAY_TIERS` = 10/24/48, max 64). Tiers keep ray length, per-step decay (`decay^(10/N)`) and brightness (`*10/N`). `volumetricJitter` (default 0 at 10 steps = bit-identical legacy, 1 above) offsets the start by an IGN value of `gl_FragCoord` only (deterministic, no time term). Banding RMS vs a 64-step reference: 11.7 LSB (10 steps) -> 3.7 (24) -> 0.8 (48).

## Docstring fix (M3)
`focusDist`/`focalRange`/`dofRadius` are a *radial screen-space* DoF (distance from screen centre, aspect-corrected), not scene depth. `depthFocusDist` (world units) will be added with the depth DoF pass.

## Tests and timing
- `bun run test:post` (15 checks: exact black x3, noise floor, neutral ramp, colour gradient, identity grade, hue x5, bloom, god-ray banding/brightness).
- `bun scripts/time_post.ts` -> ms/frame at 1080p. Demo: project `post_fx` (`app/src/scenes/_prereq_demos/post_fx/`), stills in `out/prereq/post_fx_t*.png`.

## Known gaps
- Optics is half-res; very small, very hot features beyond ~500 are clamped. Spike pattern has no aperture-blade ripple / dispersion fringing along the spike.
- Optics sees the pre-CA, pre-DoF frame; it does not respect `transparent` alpha (adds colour only).
- The function-form grade is evaluated with the song time at render, not per sub-frame with motion blur.
- `aces`/`agx` shift the overall mid-tone look vs legacy (not an identity below 1); use `legacy` for existing projects.
- Grade enum and object are mutually exclusive.
