#!/usr/bin/env bun
// Test suite for f(x) Studio v0.8.0 Two-Tier Transition Cascade Registry
//   bun scripts/test_transitions_registry.ts

import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import {
  listAvailableTransitions,
  resolveTransition,
  createTransitionResolver,
  setTransitionRegistry,
  type TransitionLoader,
} from '../src/engine/transitions/registry';

let failures = 0;

function check(cond: boolean, desc: string): void {
  if (cond) {
    console.log(`[PASS] ${desc}`);
  } else {
    console.error(`[FAIL] ${desc}`);
    failures++;
  }
}

console.log('=== f(x) Studio v0.8.0 Transition Cascade Test Suite ===\n');

// In Bun test runner (outside Vite), inject file-based loader map into registry
const transitionsDir = path.resolve(import.meta.dir, '../src/transitions');
const globalLoaders: Record<string, TransitionLoader> = {};
if (existsSync(transitionsDir)) {
  for (const f of readdirSync(transitionsDir)) {
    if (f.endsWith('.ts') && !f.endsWith('.d.ts')) {
      const name = f.replace(/\.ts$/, '');
      const fullPath = path.resolve(transitionsDir, f);
      globalLoaders[name] = () => import(fullPath);
      globalLoaders[`../../transitions/${name}.ts`] = () => import(fullPath);
    }
  }
}

// Mock bespoke local transition for benchmark_test project
const localLoaders: Record<string, TransitionLoader> = {
  'benchmark_test/quantum_tunnel': async () => ({
    default: class MockQuantumTunnel {
      render() {}
    } as any,
  }),
};

setTransitionRegistry({
  global: globalLoaders,
  local: localLoaders,
});

// 1. List Available Transitions
const { local, global } = listAvailableTransitions('benchmark_test');
check(global.length > 10, `global transition library found (>10 transitions, found ${global.length})`);
check(global.includes('dissolve'), 'global transitions include "dissolve"');
check(global.includes('warp'), 'global transitions include "warp"');
check(global.includes('slot_breach'), 'global transitions include "slot_breach"');
check(local.includes('quantum_tunnel'), 'local project bespoke transitions include "quantum_tunnel"');

// 2. Resolve Global Transition (Tier 2 Fallback)
const dissolveLoader = resolveTransition('dissolve', 'some_project');
check(typeof dissolveLoader === 'function', 'resolveTransition returns loader function for global "dissolve"');

const loadedMod = await dissolveLoader();
check(typeof loadedMod.default === 'function', 'dissolveLoader loads module class successfully');

// 3. Resolve Project-Local Bespoke Transition (Tier 1 Priority)
const localLoader = resolveTransition('quantum_tunnel', 'benchmark_test');
const loadedLocal = await localLoader();
check(typeof loadedLocal.default === 'function', 'resolveTransition prioritizes local bespoke "quantum_tunnel"');

// 4. Fallback Diagnostics on Missing Transition
let caughtError = false;
let errorMessage = '';
try {
  const missingLoader = resolveTransition('non_existent_transition_xyz', 'benchmark_test');
  await missingLoader();
} catch (err) {
  caughtError = true;
  errorMessage = String((err as Error)?.message ?? err);
}

check(caughtError, 'missing transition throws actionable error');
check(errorMessage.includes('Tier 1 (local)') && errorMessage.includes('Tier 2 (global)'), 'error message contains two-tier diagnostic cascade');

// 5. Bound Resolver
const resolver = createTransitionResolver('benchmark_test');
const warpLoader = resolver('warp');
const warpMod = await warpLoader();
check(typeof warpMod.default === 'function', 'createTransitionResolver successfully resolves "warp"');

console.log('\n=======================================');
if (failures === 0) {
  console.log('RESULT: ALL TRANSITION CASCADE TESTS PASSED (0 failures)\n');
  process.exit(0);
} else {
  console.error(`RESULT: ${failures} TEST(S) FAILED\n`);
  process.exit(1);
}
