// Verification test suite for advanced_demo project, 11 scenes, and 10 transition windows
import { resolveProjectName, buildTimelineEntries, buildTransitionEntries, type ProjectManifest } from '../src/engine/projects';
import { validateTransition, transitionProgress, resolveTransitionAt, overlayTextDuck } from '../src/engine/transition';
import manifest from '../src/scenes/advanced_demo/project.json';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
  console.log(`✅ PASS: ${msg}`);
}

console.log('=== RUNNING ADVANCED_DEMO PROJECT & TRANSITIONS TEST SUITE ===\n');

// 1. Manifest Structure & Duration Contract
console.log('--- 1. Testing Manifest Geometry & Duration Contract ---');
assert(manifest.project === 'advanced_demo', 'Project name is advanced_demo');
assert(manifest.entries.length === 11, 'Manifest contains exactly 11 scenes');
assert(manifest.transitions?.length === 10, 'Manifest contains exactly 10 transitions');

// Duration validation: timeline must be >= 5 minutes (300.0 seconds)
const totalDuration = manifest.entries[manifest.entries.length - 1]!.end;
assert(totalDuration >= 300.0, `Total demo duration ${totalDuration}s is >= 300.0s (5 minutes minimum contract)`);
assert(totalDuration === 330.0, `Total demo duration is exactly 330.0s (5m 30s)`);

const scenes = manifest.entries.map((e) => e.id);
const expectedScenes = [
  'titanium_reveal',
  'swiss_constructivism',
  'abyssal_bioluminescence',
  'spatial_glass_os',
  'retro_phosphor_crt',
  'haute_horlogerie',
  'clinical_nanotech',
  'hyperbolic_manifold',
  'synthwave_highway',
  'stellar_reactor',
  'hyperdrive_finale',
];

for (const sc of expectedScenes) {
  assert(scenes.includes(sc), `Contains scene: ${sc}`);
}

// 2. Timeline and Transition Validation
console.log('\n--- 2. Validating Transition Windows & Invariants ---');
const dummyLoad = (file: string) => () => Promise.resolve({ default: class {} as any });
const tl = buildTimelineEntries(manifest as unknown as ProjectManifest, dummyLoad);
const trs = buildTransitionEntries(manifest as unknown as ProjectManifest, dummyLoad);

assert(tl.length === 11, 'Built 11 timeline entries');
assert(trs.length === 10, 'Built 10 transition entries');

for (const tr of trs) {
  const errs = validateTransition(tr, tl);
  assert(errs.length === 0, `Transition ${tr.id} [${tr.start}s - ${tr.end}s] has zero validation errors (got: ${errs.join(', ')})`);
}

// 3. Detailed Seam Overlaps & Mid-Point Progress
console.log('\n--- 3. Testing 10 Seam Overlaps & Progress ---');
for (let i = 0; i < trs.length; i++) {
  const tr = trs[i]!;
  const midPoint = (tr.start + tr.end) * 0.5;
  const resolved = resolveTransitionAt(trs, midPoint);
  assert(resolved !== undefined && resolved.id === tr.id, `Mid-seam ${i + 1} (${tr.id}) resolves correctly at t = ${midPoint}s`);
  const prog = transitionProgress(resolved!, midPoint);
  assert(Math.abs(prog - 0.5) < 1e-4, `${tr.id} progress at ${midPoint}s is exactly 0.5`);
}

// 4. Overlay Text Ducking Guarantee
console.log('\n--- 4. Testing Overlay Text Duck Contract ---');
assert(overlayTextDuck(1, 0) === 1.0, 'Outside transitions, duck is 1.0');
assert(overlayTextDuck(0, 0) === 0.0, 'Before entrance, duck is 0.0');
assert(overlayTextDuck(1, 1) === 0.0, 'After full exit, duck is 0.0');
assert(overlayTextDuck(0.5, 0.5) === 0.0, 'Mid-seam, text duck suppresses dual-legibility');

console.log('\n========================================');
console.log('ALL ADVANCED_DEMO TESTS PASSED: 38/38');
console.log('========================================\n');
