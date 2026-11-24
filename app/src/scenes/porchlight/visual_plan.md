# porchlight — visual plan

A porch wall lamp at night pulling a moth swarm; a cat watches from the step.
One fullscreen GLSL pass.

## Composition
- Warm lamp top-right third (`LP = (0.70, 0.82)`): glowing glass shade with
  faint cage bars + a two-segment metal bracket to the wall.
- `lampFall` = tight + wide gaussians → hotspot, cone and breathing pulse
  (`0.94 + 0.06·sin·sin`) light the brick.
- Dark brick wall (mortar coursing kept subtle), porch step edge at
  `STEPY = 0.38` with a worn lip catching the lamp, door seam left with a
  warm inner crack glow.

## Swarm
- 26 moths, `mothPos(i,t)`: seeded ellipse (rx 0.024–0.094, ry 0.018–0.076),
  pendulum term `1.5·sin` flips orbit direction continuously; epoch
  `floor((t+φ)/per)` re-seeds radius/phase so a despawned moth respawns
  elsewhere; ~1/3 land on the shade mid-cycle (`landed` blends to rim).
- `mothAt`: body + wings as a squash/stretch ellipse at ~26 Hz flicker.
- Moths over the glass = dark cut-outs (`mothsOnLamp·glass`); the swarm also
  darkens the wall hotspot (shadow dapple).
- `h1(i·5.3) > thick` gate thickens the swarm 1.5→5 s.

## Cat + life
- Seated silhouette (haunches, chest, head, ears, curled tail with flick).
  Head drifts toward the nearest live moth below y<0.78; ears perk ~7 s;
  paw swipe arc 8.4→9.1 s. Faint lamp rim on its top edge.
- Beetle climbs the wall (0.60→0.76); stray moth swings to the door crack
  11.5→14.8 s; spider drops on a thread at the left edge 13.5→16.7 s.

## Beats
quiet lamp (0–1.5) → swarm thickens → cat tracks (4–) → paw swipe (8.4) →
stray/spider (11.5–16) → settle (16+).

## Camera
CameraRig near-static close-up, a small push toward the lamp as the swarm
thickens and ease back for the settle. Anchored captions via Layer2D; the
canvas textProbe hook records them.

All closed-form f(t), hash seeds only, no simulation state.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
