# desertstorm — visual plan

A haboob dust-front rolls over a straight desert highway at late afternoon.
One fullscreen GLSL pass holds the entire scene; all life is closed-form
f(t) with hash seeds.

## Beats
1. **Still road** (0–4s): low static shot down a two-lane road to its
   vanishing point — cracked verges, telephone poles left with sagging
   wires, broken fence right, mesa rim on the horizon, amber sun off-frame
   right, faint heat-shimmer pools on the tarmac.
2. **Wall rises** (4–8s): the haboob front enters from the left — a
   towering fbm-billowed ochre wall with a ragged top; the left sky browns
   out; gusts arrive (wires vibrate, bag whips, streaks thicken); a crow
   fights the headwind.
3. **Front arrives** (8–12s): the ragged edge sweeps left→right (~7s),
   swallowing poles, fence and road in sequence; god-ray slits open in the
   wall top; a truck's headlights grow in the pre-dust and are cut as the
   front crosses; camera micro-shakes.
4. **Swallowed** (11–14s): interior thick dust — featureless stratified
   brown, grain streaks at full speed.
5. **Thinning** (14–19s): the trailing tan haze fades to a veil; the road
   and mesa re-emerge dimmed; streaks ease.

## Palette
Amber/gold horizon → dusty steel-blue zenith; tarmac near-black with
wheel-polish bands and cream dashes; wall bands from deep churned brown
(0.30,0.20,0.12) at the base through ochre mid to pale tan top; god-ray
slits in hot amber (1.0,0.82,0.5); crow/poles/fence as near-silhouettes;
plastic bag sunlit white.

## Camera
CameraRig: near-static low shot down the road (y≈5.4, z 24→21 slight push),
micro shake (pos ±0.35, roll ±0.006) during the front's arrival t≈9–12.

## Anchoring
- HZ = 0.40; ground z = HZ/(HZ − uv.y), road half-width RW = 0.30/z.
- Poles left at world offset 0.52/z; fence right at 0.62/z; post heights
  ∝ 1/z; wires are two sagging segments between consecutive pole tops.
- Wall front uf = −0.18 + 1.38·ss(4.5, 11.5, t), top leans ahead, edge
  ragged by fbm; interior thickens behind the edge; veil thins ss(13.5,18.5).
- Dust streaks: 3 layers (12/16/20 grains), speeds 0.55/1.0/1.45, lengths
  grow with depth layer; density ∝ gustEnv + inWall.
- Truck headlights: z 26→7 over t 6.5–11.5, two gaussian glows at ±0.10
  lane offset, flicker, swallowed by the front.
- Crow: enters right t≈4.5, headwind wobble ∝ gustEnv, lands on fence post
  at t≈9–10; wings only while flying.
- Captions world-anchored to backdrop uv points, projected through the rig.

// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
