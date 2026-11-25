# rainfall — storyboard

## Beats
1. **0–8s — drizzle.** Sparse impacts; each ring lives its full expansion undisturbed. Camera low over the surface, slow push-in begins.
2. **8–20s — downpour.** Intensity ramps (closed-form envelope); rings overlap into interference chaos; rain streaks thicken; the surface never rests.
3. **20–30s — easing.** Storm breathes out; individual rings readable again; camera settles; final large rings expire into stillness.

## Camera specification
- CameraRig orbit at low pitch (near-surface glancing angle), very slow yaw drift, radius easing 7→5.5 across the full take — one uncut push-in.
- `rig.setLensMm(50)`; syncToThreeCamera each frame; aim via orbit target on the surface pool center.
- DoF: depthFocusDist measured to pool center; depthAperture 5; depthDof near/far sub-object.

## Motion discipline
Fully closed-form: ripple field is an analytic sum of ring wavelets in the surface shader (each drop's spawn time/position hash-determined); rain streak positions wrap modulo fall height — a pure function of t. Intensity envelope is a smoothstep ladder. No simulation, no particles state.

Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
