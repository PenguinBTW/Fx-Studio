# dawnditch — visual plan

## Concept
A dew-covered drainage ditch in a flat arable field at first light. Ploughed
ridges recede to a pale horizon; a straight dark ditch cuts mid-frame between
steep grassed banks. The first sun strip crosses from the right — the water
catches it as a glinting line, then the bank grass ignites, then the mist
hollows glow as they thin. A water vole slips along the far bank, pauses at a
tuft, swims a stretch (back + nose only), and vanishes into a tussock.

## Composition (authored uv)
- Horizon y≈0.66; pale rose→steel dawn sky above, one far tree line at y≈0.645.
- Ploughed field fills the middle band with perspective-ish furrow shading.
- Ditch: straight horizontal cut y≈0.44–0.50, dark water, steep bank shadow
  lips above/below; grass tufts along the far lip y≈0.51.
- Mist: 3–4 soft elliptical patches in hollows (y 0.52–0.62), drifting and
  thinning as the sun strip passes.
- Sun strip: a warm band crossing right→left between t≈2 and t≈9; inside it,
  dew glints flash and the ditch water shines.

## Camera
Low, near-static; slight drift along the ditch line (x −0.9 → +0.9 over 20 s)
so banks and tufts parallax gently.

## Light
Dawn ambient is cool blue-grey; the sun strip is the only warm source, a
traveling gauss band `sunX(t) = 1.05 → -0.10`. Dew glints fire only inside
the strip. Mist patch alpha decays inside the strip.

## Motion beats
0–2 s still ditch: trickle shimmer, mist patches breathing.
2–9 s sun strip crosses; water glint line sweeps; bank grass warms; mist thins.
4.5–14 s vole: walks the far bank 4.5–7.5, pause at tuft ~7.5–8.3, swims
8.3–12.5 (back+nose + wake line), climbs out 12.5–13.2 into tussock.
10–12.5 s skylark spirals up from the field; moorhen steps out ~14–15.5;
crow walks a far plough line 16–19. Bubble trail ~13.5.
18–20 s settle: warmed field, thinning mist, dew embers.

## Seeds / determinism
Closed-form f(t) only; h1/h2 seeds for tufts, dew glints, mist patches,
furrow jitter. No simulation state.
