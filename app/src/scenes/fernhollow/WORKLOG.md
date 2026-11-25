# fernhollow worklog (session-state scratch — delete before final PR)

Assignment: author new scene, Blender pipeline for rigged assets, telemetry verification, PR, never merge.
Branch: devin/<ts>-fernhollow off origin/nightly. Design docs written (visual_plan/storyboard).

PLAN/STATE:
1. Blender assets: assets/fern/build.py (procedural frond arch, 3-4 variants via seed), assets/snail/build.py (rigged body+shell, "glide" pedal-wave clip, eyestalk sway shape/clip). Shared helpers copy _bl.py from fx_promo assets.
2. fernhollow.ts — beyond-DSL Scene subclass (needs DepthDoFPass physical DoF + godray-ish shaft billboards; invariants: closed-form, resetState, dispose, textProbes).
   - World: mossy fallen log along X axis, soil floor, 6-8 fern fronds arcing overhead (instanced GLB variants, analytic sway), canopy backdrop, light shafts as additive analytic billboards.
   - AnalyticalParticles: spore field, warm emissive, curl drift, seed deterministic.
   - Camera: slow creeping dolly closed-form; rack focus distance f(t) per storyboard beats.
   - Snail: instantiate, setTime(f.lt,'glide'), translate along log closed-form.
   - Audio telemetry: emit positions (fx-audio skill) if cheap.
3. Verification: bun scripts/render.ts motion telemetry F01-F16 zero Tier-A; godview + onion; stills; evidence in PR body.
4. bun run assets:check fernhollow before commit.
5. PR to nightly base (repo convention: chain targets nightly), report coordinator ece3d9ecdd114464b3035ad8c1131268.
Skills mandatory: fx-scenes, fx-3d-assets, fx-diagnostics, grounding-yourself read partially; re-read fx-diagnostics F-rules as needed.
Key refs: app/src/engine/dof.ts DepthDoFPass, rig.ts solveDollyZoom/orbitPosition/focusDistance, particles AnalyticalParticles closed-form.
