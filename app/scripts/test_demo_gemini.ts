// Verification test suite for demo_gemini project and custom transitions
import { resolveProjectName, buildTimelineEntries, buildTransitionEntries, type ProjectManifest } from '../src/engine/projects';
import { validateTransition, transitionProgress, resolveTransitionAt, overlayTextDuck } from '../src/engine/transition';
import manifest from '../src/scenes/demo_gemini/project.json';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
  console.log(`✅ PASS: ${msg}`);
}

console.log('=== RUNNING DEMO_GEMINI PROJECT & TRANSITIONS TEST SUITE ===\n');

// 1. Manifest Structure
console.log('--- 1. Testing Manifest Geometry ---');
assert(manifest.project === 'demo_gemini', 'Project name is demo_gemini');
assert(manifest.entries.length === 5, 'Manifest contains exactly 5 scenes');
assert(manifest.transitions?.length === 4, 'Manifest contains exactly 4 transitions');

const scenes = manifest.entries.map((e) => e.id);
assert(scenes.includes('singularity'), 'Contains singularity scene');
assert(scenes.includes('tesseract'), 'Contains tesseract scene');
assert(scenes.includes('vector_lab'), 'Contains vector_lab scene (2D showcase)');
assert(scenes.includes('metropolis'), 'Contains metropolis scene');
assert(scenes.includes('supernova'), 'Contains supernova scene');

// 2. Timeline and Transition Validation
console.log('\n--- 2. Validating Transition Windows ---');
const dummyLoad = (file: string) => () => Promise.resolve({ default: class {} as any });
const tl = buildTimelineEntries(manifest as unknown as ProjectManifest, dummyLoad);
const trs = buildTransitionEntries(manifest as unknown as ProjectManifest, dummyLoad);

assert(tl.length === 5, 'Built 5 timeline entries');
assert(trs.length === 4, 'Built 4 transition entries');

for (const tr of trs) {
  const errs = validateTransition(tr, tl);
  assert(errs.length === 0, `Transition ${tr.id} [${tr.start}s - ${tr.end}s] has zero validation errors (got: ${errs.join(', ')})`);
}

// 3. Transition Sequence Progression
console.log('\n--- 3. Testing Seam Overlaps & Progress ---');
// Seam 1: singularity -> tesseract (at 7.5s, dur 1.5s -> [7.5, 9.0])
const tr1 = resolveTransitionAt(trs, 8.25);
assert(tr1 !== undefined && tr1.id === 't-warp-1', 'Mid-seam 1 resolves to t-warp-1');
assert(Math.abs(transitionProgress(tr1!, 8.25) - 0.5) < 1e-4, 't-warp-1 progress at 8.25s is exactly 0.5');

// Seam 2: tesseract -> vector_lab (at 15.0s, dur 1.5s -> [15.0, 16.5])
const tr2 = resolveTransitionAt(trs, 15.75);
assert(tr2 !== undefined && tr2.id === 't-shutter-1', 'Mid-seam 2 resolves to t-shutter-1');
assert(Math.abs(transitionProgress(tr2!, 15.75) - 0.5) < 1e-4, 't-shutter-1 progress at 15.75s is exactly 0.5');

// Seam 3: vector_lab -> metropolis (at 22.0s, dur 1.5s -> [22.0, 23.5])
const tr3 = resolveTransitionAt(trs, 22.75);
assert(tr3 !== undefined && tr3.id === 't-chase-1', 'Mid-seam 3 resolves to t-chase-1');
assert(Math.abs(transitionProgress(tr3!, 22.75) - 0.5) < 1e-4, 't-chase-1 progress at 22.75s is exactly 0.5');

// Seam 4: metropolis -> supernova (at 29.5s, dur 1.5s -> [29.5, 31.0])
const tr4 = resolveTransitionAt(trs, 30.25);
assert(tr4 !== undefined && tr4.id === 't-warp-2', 'Mid-seam 4 resolves to t-warp-2');
assert(Math.abs(transitionProgress(tr4!, 30.25) - 0.5) < 1e-4, 't-warp-2 progress at 30.25s is exactly 0.5');

// 4. Overlay Text Ducking Guarantee
console.log('\n--- 4. Testing Overlay Text Duck Contract ---');
assert(overlayTextDuck(1, 0) === 1.0, 'Outside transitions, duck is 1.0');
assert(overlayTextDuck(0, 0) === 0.0, 'Before entrance, duck is 0.0');
assert(overlayTextDuck(1, 1) === 0.0, 'After full exit, duck is 0.0');
assert(overlayTextDuck(0.5, 0.5) === 0.0, 'Mid-seam, text duck suppresses dual-legibility');

console.log('\n========================================');
console.log('ALL DEMO_GEMINI TESTS PASSED: 18/18');
console.log('========================================\n');
