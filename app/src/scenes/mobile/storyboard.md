# mobile — storyboard

## Beats
1. **0–6s — reveal.** Tight on the red paddle, backlit edge. Camera drifts back and down; one by one the other paddles enter the light. The mobile hangs in blackness.
2. **6–22s — composition.** Slow orbital drift (~15° total). Each arm rotates at its own closed-form rate — incommensurate frequencies (periods 17s, 23s, 29s, 37s) so the composition never repeats in-window. Paddles catch the spot as their normals sweep through it — flashes of red, yellow, blue across the void.
3. **22–30s — hero settle.** Camera eases to a held three-quarter view, slight low angle looking up. Rotation continues; focus racks gently to the mobile's centroid. Held.

## Camera specification
- CameraRig throughout: `rig.orbit(target, radius, pitch, yaw)` with target drifting from the red paddle (t<6) to the sculpture centroid; radius eases 4→9; yaw sweeps slowly; `rig.syncToThreeCamera` each frame, then `rig.setLensMm(52)`.
- No cuts — one uncut gallery take.
- DoF: depthFocusDist driven to focus target distance; depthAperture 6; depthDof near/far in sub-object.

## Motion discipline
All rotation closed-form in local time: arm_i angle = a0i + lt·ωi + sway (small pendulum term, incommensurate). No simulation, no integration, fully deterministic.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
