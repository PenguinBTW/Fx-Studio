# penguinshore — visual plan

Gentoo penguins porpoising ashore onto a pebble beach at polar dusk.
20 s, single backdrop shader + camera pan; all life is closed-form f(t)
in uv space (no accumulators, no sim).

## World

- Pale pink-blue polar sky, faint high cloud bands, dusk cooling late
  (ss 15.5→19.5 desaturates + dims the whole palette).
- Low sun smear on the water at uv (0.30, 0.452) with a warm reflection
  lane through the swell.
- Sea band between waterline `beachY(x) = 0.295 + 0.135·ss(0.35,0.95,x)`
  and horizon 0.468: crest stripes advancing shoreward, whitecap stripes
  strongest in the breaking zone just above the waterline, foam pulsing
  at the waterline.
- Dark pebble beach below the waterline: hash-speckled gravel, cold rim
  + wet sheen right at the waterline, darkening toward the frame bottom.
- Three distant bergs on the horizon with pink tops; six thin
  blowing-snow streaks drifting at the horizon.

## Life

- **Porpoise chain (12):** each bird has a hash-seeded start time,
  crossing ~4.5–6.5 s from left open water to the waterline; body tilts
  along the arc velocity; spray fan on the first 16 % of each breach
  (sun-side streaks glint pink); a white belly flash mid-arc; a brief
  upright pause at the waterline on landing.
- **Seal shadow:** one long dark shape cruising the shallows t≈11.8–15.4.
  While it passes (12.0–14.5) every breach is suppressed — the
  "scatter-hesitate then resume" beat.
- **Waddlers (5):** start ~9.5–15 s at the waterline, pause-look-waddle
  up the beach (advance only during 60 % of each 1.5 s step, lean rock,
  curved path wander), shake water off in the first 0.7 s with shed
  droplets.
- **Colony (7):** standing birds fade in from t≈10.5 on staggered
  arrivals near x 0.84–0.95 with a small idle shuffle.
- **Skua:** one dive over the colony edge, t 11.0–11.8.

## Camera

Low pan tracking the landing zone: target sweeps world x −32 → ~77+
(uv ≈ 0.40 → 0.74+), position trails it at +4. Push from z 24 → 20.5 and
target y −8 → −6 during the gather beat (ss 12→17). Narrow exports take a
dwell path (hold the surf break through the chain, then continue right)
so both the porpoise chain and the colony close in-frame.

## Captions (world-anchored probes)

- t 0.8–3.8 "polar dusk — empty shore" (anchored over the water)
- t 5.5–9.5 "porpoising through the break" (anchored in the surf)
- t 11–15 "first ashore" (anchored on the beach)
- t 15.2–19 "the colony gathers" (anchored at the colony)

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
