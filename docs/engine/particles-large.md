# Large particles (P5)

`engine/particles_large.ts`, class `LargeParticles`, lazy `ctx.largeParticles` (capacity `largeParticleCapacity` in `defineScene`, default 100000, up to 500k tested). The old `AnalyticalParticles` is untouched.

Stateless: every vertex evaluates `p(seed, t)` in closed form. Per-particle data is two static vec4 attributes (phase/radius/cycle/temperature, and four randoms) from `mulberry32`; only uniforms change per frame. Each cycle re-rolls its randoms with an integer hash of (seed, cycle index), so particles respawn at new places. Any frame renders in any order (`bun run test:particles`).

## API

```ts
const lp = ctx.largeParticles;                  // or new LargeParticles(capacity, seed)
lp.configure({ count, mode, style, ... });      // setup-time; only count/seed/size/life/temperature rebuild buffers
lp.render(renderer, ctx.threeCam, out, t);      // additive premultiplied, resetState() afterwards
```

- `mode`: `free` (ballistic + gravity), `press` (inward to `center`, radius `core + (r0-core)(1-u)^power`, turbulence amplitude smoothstep-falling over `falloff` above the core, `coreDim` dims alpha near it), `spiral` (helix of `helixRadius`, `turns` around a dipole line r = L sin^3 th, longitude drift `lonRate`), `fall` (rain: drag-limited velocity + wind, plus curl), `star` (static shell, optional spin and twinkle).
- `style`: `disc` (soft billboard), `streak` (velocity-aligned capsule, `streak` seconds long), `points` (gl.POINTS).
- `trail: { segments 0..16, dt, taper, power, gain }`: camera-facing ribbon; segment k evaluates the position at `t - k*dt` and the width/alpha taper along k. Trail direction comes from the analytic velocity (curl Jacobian), not finite differences.
- `color: { mode: 'flat'|'blackbody'|'wavelength', rgb, range }`: per-particle temperature in [0,1] maps to kelvin or nm through `spectrum.ts` GLSL.
- `dof: { cocScale, focus, range }`: CoC in pixels is added to the radius and softens the profile (energy is conserved); view depth is computed per particle. `opaque: true` gives hard dots with depth write and no blending (no trails).
- `turbulence: { amp, freq, drift }` curl displacement; mode blocks (`press`, `spiral`, `fall`, `star`, `free`) hold per-mode parameters.

Demo: `?project=particles` (shots A Core 0-5 s, B magnetosphere 5-10, C rain 10-15, D stars 15-20). `?count=` `?trail=` `?i=` (intensity) URL overrides for the timing script and look tuning.

## Cost (this machine, 1080p, avg ms incl. readback, Core shot; `bun scripts/time_particles.ts`)

| count | trails 0 | trails 8 | trails 16 |
|---|---|---|---|
| 0 (floor) | 13.1 | 14.0 | 15.0 |
| 50k | 13.8 | 15.4 | 17.1 |
| 100k | 13.3 | 17.7 | 18.2 |
| 250k | 14.7 | 22.0 | 26.6 |
| 500k | 17.4 | 28.0 | 40.2 |

The 13 ms floor is the engine's frame and readback. Trails multiply vertex work (2 vertices per segment per instance, each with 3 simplex gradients plus Hessians for the velocity).

## Where count stops mattering

Past roughly 100-250k the Core is limited by additive saturation, not count: the centre clips to white. Density is sold by trails (8 segments), dim per-particle intensity and CoC, so keep 150-250k with 8 trails (~20 ms) rather than 500k with 16.

## Known gaps

- No collisions, no inter-particle forces; fields are analytic only.
- Trails are camera-facing ribbons evaluated at fixed `dt`; fast camera moves are not motion-blurred except by engine sub-frames.
- DoF is a per-particle CoC approximation. Particles do not write depth into the post DoF buffer unless `opaque`.
- `press` shells are sampled uniformly on the sphere; there is no anisotropy.
- Soft-sort: additive blending needs no sorting, `opaque` mode relies on the depth test only.
- Magnetosphere field lines are legible only at low count (about 40k) or as soft haze at high count; look still needs art direction.
- Rain streaks are alpha-weighted by length; very large `streak` values dim the streak.
- Intensities in the demo are tuned small (0.025-0.3) because additive overlap of many particles saturates quickly.
