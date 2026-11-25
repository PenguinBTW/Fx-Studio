# mercury — visual plan (fluid register)

**Concept.** Liquid metal in a void: mercury droplets fall from above, strike a central
pool, and are absorbed — the pool swells and wobbles with each impact, surface tension
pulling everything back to a sphere. The fluid IS the subject; the raymarched metaball
surface (smooth-min union) gives true coalescence for free.

**Why this register.** The catalog has macro (fernhollow), architectural (atrium),
abstract line-work (harmonograph), typographic mass (monolith) — nothing fluid. The
raymarched-SDF capability (fx-scenes §2.2 reason 2) is unexploited by the catalog.

**Beats (30s, 16:9, 60fps).**
- t0–8: droplets fall one per ~1.2s; pool quivers per impact; camera low, slow push.
- t8–18: camera orbits a quarter-turn; impacts continue, pool swells, wobble superposes.
- t18–26: orbit continues; droplet cadence slows; surface settles toward mirror-calm.
- t26–30: near-still mirror sphere, slow drift to hero framing; rim light peaks.

**Palette.** Near-black void, mercury = high-metalness mirror with warm key glint +
cool rim; HDR bloom picks up the speculars.

**Technique.** Raymarched smooth-min sphere union in a fullscreen pass inside a raw
Scene subclass — everything closed-form f(t): droplet positions, merge weights, wobble
amplitudes are decaying impulse sums. No simulation state.
