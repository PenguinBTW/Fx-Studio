# Noise library (P11)

One shared, tested noise library with a bit-compatible CPU mirror.

- GLSL: `app/src/engine/glsl/noise.ts` exports `GLSL_NOISE` (seed 0) and `buildGLSLNoise(seed)`. It is **not** part of `GLSL_COMMON`; add `${GLSL_NOISE}` after it in a pass that needs it.
- TS mirror: `app/src/engine/noise.ts` exports `createNoise(seed)`, the default `noise` (seed 0), `ign`, `noiseJitter`.
- Test: `cd app; bun run test:noise` (add `--no-gpu` to skip the browser part). Writes `out/prereq/noise_sheet.png` from `scenes/_prereq_demos/noise/` (`?project=noise`).

## Determinism

The integer hash (`nzMix`, a lowbias32-style finaliser) is salted with four 32-bit constants drawn from `mulberry32(seed)`. No `sin` hash, no clock, no `Math.random`. `buildGLSLNoise(seed)` bakes the same salts into the shader, so GPU and CPU see the same field. All 3D lattice coordinates are `ivec3`; use the same seed on both sides.

## API (GLSL name / TS name)

| Function | Notes |
|---|---|
| `nzU/nzF/nzF3(ivec3, ch)` / `hashU3/hashF3/hash3F3(x,y,z,ch)` | Lattice hash to uint, [0,1), vec3 in [0,1). `ch` selects an independent stream. |
| `nzSimplex(p[,ch])` / `simplex(p,ch)` | 3D simplex gradient noise, range about [-0.96, 0.96], mean 0. |
| `snoiseGrad(p[,ch], out grad)` / `simplexGrad` | Value plus analytic gradient. |
| `snoiseHess(p,ch,out grad,out mat3 H)` / `simplexHess` | Plus analytic Hessian. |
| `fbm3(p,oct[,lac,gain])`, `fbmGrad3(p,oct,lac,gain,out grad)` / `fbm`, `fbmGrad` | Normalised by total amplitude; max 8 octaves; octave i uses channel i. Gradient is analytic. |
| `curlNoise3(p,t)` / `curlNoise3(p,t)` | Same call shape as the built-in `curlNoise(vec3,t)` in `particles.ts` (which is untouched). Divergence-free at every `t`. RMS magnitude about 1. |
| `curlNoise3J(p,t,out mat3 J)` / `curlNoise3J` | Curl plus Jacobian (GLSL: column m = d curl / d x_m; TS: row-major `jac[3*i+m] = d curl_i / d x_m`). Trace is exactly zero analytically. |
| `voronoi3(p,jit)`, `voronoi2(p,jit)` | `{f1, f2, cell, id}`: Euclidean F1/F2, feature point (cell centre), stable id in [0,1). `jit` 0..1. |
| `ign(px)`, `ignFrame(px,frame)`, `noiseJitter(px,frame)` / `ign(x,y[,frame])`, `noiseJitter(x,y,frame)` | Interleaved gradient noise. Pixel (floored) plus optional integer frame only, never the time. `noiseJitter` adds a golden-ratio sequence in the frame index (period 256) for ray-march start jitter. Pass `gl_FragCoord.xy` (physical px). |

### Curl construction
The vector potential is `A = (n64, n65, n66)`: three simplex fields on decorrelated hash channels. `curl = 0.25 * curl(A)` (`CURL_GAIN`). `t` translates the lattice by `CURL_DRIFT` per second, so the field is still an exact curl at each `t` (a time-evolving potential would also be fine, but translation keeps the Jacobian formula identical). For particles (P5): `jac * v` gives how the flow changes along a direction, e.g. for pressing in on a point or stretching streaks.

## Design choices
- Kernel radius^2 is 0.5, not the usual 0.6. At 0.6 a fifth lattice point can enter the radius so a 4-corner evaluation has tiny gradient jumps; at 0.5 value and gradient are C1 and the analytic derivatives are exact (`NZ_SCALE = 74`).
- Voronoi searches 3x3x3 (3x3 in 2D) cells. F1 is exact; F2 is wrong for about 1 in 20000 points in 3D at `jit = 1` (a feature point two cells away). Fine for granulation; lower `jit` to ~0.8 if edge exactness matters.
- Voronoi cell centre is the feature point; `id` is the hash of the winning lattice cell.

## Tolerances (test results)
- TS: finite differences (h = 1e-5): gradient rel error 1e-8, fbm gradient 1e-6, Hessian 1e-7, curl divergence |div|/|J|max about 1e-9, Jacobian 3e-8.
- GPU vs CPU (4096 random points, float32 on GPU): snoise value and gradient 4e-5; fbm(5) 4e-4 (gradient scales to about 30); curl 2e-5; Jacobian 2e-4; Voronoi F1/F2/cell 1e-6, ids identical; IGN 8e-4 circular error at 1080p coordinates (float32 ulp of the dot product, which is also why GPU IGN is not bit-equal to CPU there). Test tolerances are looser than these and listed in `scripts/test_noise.ts`.
- IGN: uniform (chi2 0.9 on 512^2), mean 0.4999.

## Audit of existing noise (before P11)
`glsl/common.ts` (kept untouched): `hash11/12/22/13/33` (Dave Hoskins hashes without sin, float based), 2D/3D simplex `snoise` (Ashima/Gustavson, MIT, mod-289 permutation, no gradient, not seedable), `fbm(vec2|vec3,int)`, `curl2` (finite-difference curl of 3D simplex). No Voronoi, no analytic gradient, no IGN.

Duplicates elsewhere in the tree (not migrated; scenes were not asked to change):
- `particles.ts`: `hash(vec3)` and `curlNoise(vec3,t)`, which is sin/cos pseudo-curl, cheap, not noise-based, exactly divergence-free only by luck of structure. Left in place; P5 can switch to `curlNoise3`.
- `material.ts` (x2): `hash21`; `transitions/fiber_dive.ts`: `hash21`; `mirror_shatter.ts`, `topological_tear.ts`: `hash2` and `voronoiFoam` (2D, F1/F2 style, sin or float hash); `scenes/interlock/beat0_switch.ts`: `hash12`; `scenes/sonnet-test/materials.ts`: `vnoise` (value noise, x2).
- Curl-like fields: `airgap_cloud/cloud_shader.ts` `fastCurl`, `dot_odyssey/dot_shader.ts` `fastCurl`, `city_room_portal/portal_shader.ts` `curlTurbulence`, `cinematic_70mm/grand_horology.ts` and `insane_scenes_demo/kerr_ergosphere.ts` `curlNoise`.
- TS: `util.ts` `hash`, `noise1`, 2D value noise and fbm helpers (float-based, seeded by argument).

Names exported by `noise.ts` do not collide with `common.ts` (`snoise`, `fbm`, `curl2`, `hash*`). Existing scene-local `curlNoise` / `voronoi*` names would collide only if that scene also includes `GLSL_NOISE` (`curlNoise3`, `voronoi3`, `voronoi2` are the shared names).

## Provenance / licence
All code in `noise.ts` is original to this repository.
- Simplex lattice (skew factors 1/3, 1/6, simplex corner ordering) and the radial kernel `(r^2 - d^2)^4` follow Gustavson's published simplex noise description (Gustavson 2005, "Simplex noise demystified"); implemented independently with a hash instead of a permutation table. The 12 gradients are Perlin 2002 ("Improving Noise"). Analytic gradient and Hessian are derived here by differentiating the kernel.
- Integer hash finaliser is the lowbias32 construction (Chris Wellons, public domain / Unlicense), with different salting.
- Curl of a vector potential: Bridson, Hourihan, Nordenstam, "Curl-noise for procedural fluid flow" (SIGGRAPH 2007), the method only.
- Voronoi / Worley cellular noise: Worley 1996, the method only.
- Interleaved gradient noise: Jimenez 2014, "Next Generation Post Processing in Call of Duty: Advanced Warfare"; constants are from that talk.
No code was copied from any of these.

## Known gaps
- 2D simplex, periodic (tiling) variants, 4D noise and a blue-noise texture are not provided. `noiseJitter` is a spatio-temporal IGN/golden-ratio sequence, only blue-noise-ish.
- `fbm` is capped at 8 octaves; `curlNoise3J` costs 3 Hessians (about 3x the cost of `curlNoise3`), use it only where the Jacobian is needed.
- Hash channels 64..66 are reserved for curl, 1 and 7 for Voronoi, 0..7 for fbm octaves.
- Existing scenes still use their local noises; migration is not done.
