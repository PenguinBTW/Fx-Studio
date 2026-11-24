# fenrunner — visual plan

## Concept
Last light on the fens. A straight drain cuts the frame on a diagonal; the
afterglow sits on the water as a pale rose ribbon. One small water deer works
the near bank — a trot, a pause to look at the water, then gone behind a
pollarded willow. Everything else barely moves: mist on the water, reed heads
in a light breeze, one owl quartering far off.

## Composition (authored uv)
- Drain: diagonal band, centerline y = 0.215 + 0.13x, half-width 0.052 + 0.035x
  (wider near camera-left). Water = afterglow reflection + drift noise.
- Far bank (above drain): dense reed strokes + seeded reed heads + pollarded
  willow crowns, near-black against the sky.
- Near bank (below drain): dark grass strip, sparse reeds, willow trunks; the
  deer's path along y ≈ 0.285→0.255, x 1.06 → 0.42 (exits behind the clump at
  x=0.40).
- Sky: steel upper, rose strip at the horizon (y≈0.55), one faint star fading
  in from t=10.

## Camera
Low, near-static; drifts +3.2 units along the drain direction over 20 s so the
bank layers parallax slowly. Same authored-uv remap into the vUv band.

## Light
Afterglow is the only light source: `glow` gaussian at y≈0.565 tints sky,
water, and mist. Bloom 0.14 / threshold 0.72. The deer is pure silhouette
(0.07) against water + bank.

## Motion beats
0–3 s still drain: mist drift, faint reed sway, star not yet out.
3–9.5 s deer trots in right→left (four-leg gait, ear flick at ~2 Hz); reed
gust at ~6 s; fish rise rings at ~8 s near the far bank; owl quartering.
9.5–13 s pause-and-look: gait frozen, head angles to the water.
13–16.5 s exit behind the willow clump; moorhen crosses the drain 12–16 s.
14–20 s settle: star pricks through, mist keeps drifting.

## Seeds / determinism
Closed-form f(t) everywhere; h1/h2 seeds for reed heights/headers, willow
placement, noise drift. No simulation state.
