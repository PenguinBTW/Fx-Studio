# emberdrift — visual plan

**Concept.** A campfire burns low in a forest clearing at night. Embers
leave the coal bed on helical updrafts, flashing, crackling, and dimming
to ash as they climb through the moonlit haze between dark pine walls.
Mid-scene the log cracks — a fountain of fresh sparks and new flame
tongues — then the drift settles back to a slow shimmer.

**Metaphor → physics mapping.** Campfire = warmth/contrast anchor at
frame bottom; embers = light escaping upward against the cold night
palette; the log crack = the single percussion hit everything syncs to.

## Composition (uv space, backdrop quad — visible x ≈ 0.27–0.73)

- **Sky** top 60%: near-black indigo gradient, faint star field,
  moon wafer + soft halo upper-left, moonlit haze band.
- **Pine walls**: two silhouette layers framing left/right edges —
  far layer lighter (hazier), near layer near-black, closed-form
  triangle-stack tree profiles at hashed x positions.
- **Ground**: dark floor band, warm ember-light pool around the fire.
- **Fire** at uv (0.5, ~0.14): glowing coal bed (hot orange blob,
  flickering), log silhouette beside it, 3 flame tongues on
  closed-form teardrop envelopes (sway + flicker + burst at crack).
- **Light cone**: faint warm cone rising from the fire; moths orbit
  inside it once during the settle.

## Foreground systems (InstancedMesh)

- **Embers ×250**: hash-seeded; rise on helical drafts (buoyant rise +
  sinusoidal lateral drift + per-ember turbulence); brightness envelope
  flash → steady → crackle decay → fade to ash; cycle lengths vary so
  the stream is continuous; ~12% get caught in upward gust bursts
  (extra rise speed on a closed-form gust gate); ~6 large foreground
  embers with bigger scale + bloom brightness.
- **Fountain**: embers born into the 9.6–11.8s window get a velocity +
  brightness kick (the log-crack burst) — closed-form, no state.
- **Moths ×4**: dark quads orbiting the light cone on a one-shot
  11.5–17s pass.

## Beats / camera

| t | beat |
|---|------|
| 0–6 | quiet crackle — fire established, thin ember stream |
| 6–9.6 | gust swell — haze leans, embers accelerate laterally |
| 9.6–12.5 | log crack — camera micro-shake, ember fountain, fresh tongues |
| 12.5–20 | drifting settle — moths orbit, stream thins and climbs |

Camera: breath drift throughout; slow push toward the fire 9.6–13.5;
shake impulse at the crack (decaying sine on position).

## Palette

Night indigo `#060b16`, moon `#cfd8ea`, far pines `#0d1524`,
near pines `#05080f`, ember `#ff9a3c` → `#ffd9a0` core → ash `#7a5a48`,
coal bed `#ff5a1f`, flame `#ffb347/#ff6a26`, light pool `rgba(255,150,60)`.

## Post

exposure ~0.6, bloom 0.55 (embers are point lights), agx, ca 0.06,
grain 0.06, vignette 0.55, fade in/out.

## Rules

All closed-form f(t) on hash seeds. No accumulators, no RNG, no sim.
GLSL3 backdrop only; `smoothstep`/`fract` in shader (TS `ss`/`frac`
are not available inside FRAG). No backticks in shader comments.
Backdrop content keeps to uv x ≈ 0.27–0.73 (the visible window).
