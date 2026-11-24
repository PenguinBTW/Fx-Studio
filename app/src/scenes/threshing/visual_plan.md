# threshing — visual plan (20s)

One idea: **the doorway as a light funnel**. A weathered threshing barn at
harvest dusk; one door stands open and the last sun rakes through it, so the
dark interior is read only where the beam touches — floor pool, motes, a rope,
a pitchfork. Every animated thing either crosses the shaft or sits at its edge.

## Conceptual mapping

| idea | visual mechanic |
|------|-----------------|
| doorway = funnel | bright jamb edges + angled shaft polygon + floor pool, all else near-black |
| dust in a beam | hashed motes drifting down-left along the shaft direction, density thinning upward |
| sparrow = quick life | closed-form dart segments crossing the shaft; silhouette cut-outs in the light |
| owl = slow counterpoint | one wide backlit glide above the roofline |
| interior hints | rope line, pitchfork angle, haystack edge — drawn only inside the doorway dark |
| cat = patience | static silhouette on a grain sack; only the tail-tip flick moves |

## Light model

- Dusk exterior: wall in shade (umber/plum), sky strip rose→steel above the
  roofline; the barn front is a tonal mass, not a lit subject.
- The shaft is the only warm source: saturated amber, strongest at the floor
  pool, grazing the jamb edges. Motes and the sparrow brighten when inside the
  shaft mask (same mask drives everything — one light, three surfaces).
- Owl and field-crack stay cool-backlit so the warm shaft keeps its contrast.

## Anti-cliché audit

- No volumetric god-cone: the shaft is a flat angled band clipped by the door
  opening, like a real raking beam through a gap.
- No dust-particle glow sprites scattered everywhere: motes live only inside
  the shaft mask and thin upward.
- No horror-barn dressing: interior hints are three sparse shapes, not a
  furnished set.
- Sparrow/owl/cat stay pure silhouettes — no feather detail, no eyes.

## Eye-tracking map

1. entry: the door opening + floor pool (brightest contrast, center)
2. up the shaft to the jamb rim glow
3. sparrow crossing (first moving silhouette)
4. rope/pitchfork hints inside the dark
5. owl glide across the roofline → rest on the cat's sack edge

## Beats

still doorway → mote stream → sparrow dart ×2 → owl pass → settle.

## Determinism

All motion closed-form f(t): hash seeds for motes/stubble/plank variation,
smoothstep envelopes per beat, no simulation state.
