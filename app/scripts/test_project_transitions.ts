// Project folders + standalone transitions: manifest resolution, timeline
// building, transition validation and window math (DOM-free, runs under bun).
// Run: bun scripts/test_project_transitions.ts (also wired into test_milestones.ts)
import {
  resolveTransitionAt,
  transitionProgress,
  validateTransition,
  type TransitionEntry,
} from '../src/engine/transition';
import {
  buildTimelineEntries,
  buildTransitionEntries,
  resolveProjectName,
  type ProjectManifest,
} from '../src/engine/projects';
import type { TimelineEntry } from '../src/engine/engine';

console.log('--- Testing project folders + standalone transitions ---');
let allPassed = true;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) console.log(`PASS ${name}`);
  else { console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`); allPassed = false; }
};

const fakeLoad = (_file: string) => (async () => ({ default: class {} as any })) as any;

// 1. Project selection priority: ?project= > active.json pointer > 'default'.
check('url project wins', resolveProjectName({ urlProject: 'b', pointer: 'a', available: ['a', 'b'] }) === 'b');
check('pointer fallback', resolveProjectName({ pointer: 'a', available: ['a', 'b'] }) === 'a');
check('default fallback', resolveProjectName({ available: ['default', 'x'] }) === 'default');
let threw = '';
try { resolveProjectName({ urlProject: 'nope', available: ['a', 'b'] }); } catch (e) { threw = String((e as Error)?.message ?? e); }
check('unknown project throws listing available', /nope/.test(threw) && /a, b/.test(threw), threw);

// 2. Manifest -> entries (ids, files, passthrough) and transitions (at/dur).
const manifest: ProjectManifest = {
  project: 'p',
  entries: [
    { scene: 'p/one', id: 'a', start: 0, end: 3, caption: { fig: '01', text: 'hi' } },
    { scene: 'p/two', start: 2, end: 5, params: { k: 1 } },
  ],
};
const entries: TimelineEntry[] = buildTimelineEntries(manifest, fakeLoad as any);
check('entry ids + files', entries[0]!.id === 'a' && entries[0]!.file === 'p/one' && entries[1]!.id === 'p-e2');
check('caption/params passthrough', entries[0]!.caption?.fig === '01' && (entries[1]!.params as any)?.k === 1);
check('entry loaders are functions', typeof entries[0]!.load === 'function');

const trs: TransitionEntry[] = buildTransitionEntries(
  { project: 'p', entries: [], transitions: [{ transition: 'push', from: 'a', to: 'b', at: 2, dur: 1 }] }, fakeLoad as any,
);
check('at/dur -> start/end + default id', trs[0]!.start === 2 && trs[0]!.end === 3 && trs[0]!.id === 'p-t1');

// 3. Transition validation.
const demoEntries: TimelineEntry[] = [
  { id: 'a', load: fakeLoad('a') as any, start: 0, end: 3 },
  { id: 'b', load: fakeLoad('b') as any, start: 2, end: 5 },
];
const ok = { id: 'w', from: 'a', to: 'b', start: 2, end: 3 };
check('valid window passes', validateTransition(ok, demoEntries).length === 0);
check('unknown from flagged', validateTransition({ ...ok, from: 'zz' }, demoEntries).length === 1);
check('from==to flagged', validateTransition({ ...ok, to: 'a' }, demoEntries).length >= 1);
check('empty window flagged', validateTransition({ ...ok, start: 2, end: 2 }, demoEntries).length >= 1);
check('window outside from flagged', validateTransition({ ...ok, start: 2.5, end: 3.5 }, demoEntries).length >= 1);
check('window outside to flagged', validateTransition({ ...ok, start: 1, end: 2.5 }, demoEntries).length >= 1);
check(
  'reversed order flagged',
  validateTransition({ id: 'w', from: 'b', to: 'a', start: 2, end: 3 }, demoEntries).length >= 1,
);

// 4. Window resolution + progress.
const wins: TransitionEntry[] = [
  { id: 'w1', from: 'a', to: 'b', start: 2, end: 3, load: fakeLoad('x') as any },
  { id: 'w2', from: 'a', to: 'b', start: 4, end: 5, load: fakeLoad('x') as any },
];
check('resolves inside window', resolveTransitionAt(wins, 2.5)?.id === 'w1');
check('end-exclusive', resolveTransitionAt(wins, 3) === undefined);
check('undefined outside', resolveTransitionAt(wins, 0) === undefined && resolveTransitionAt(wins, 3.5) === undefined);
const overlap: TransitionEntry[] = [
  { id: 'late', from: 'a', to: 'b', start: 2.5, end: 4, load: fakeLoad('x') as any },
  { id: 'early', from: 'a', to: 'b', start: 2, end: 4, load: fakeLoad('x') as any },
];
check('earliest start wins overlaps', resolveTransitionAt(overlap, 3)?.id === 'early');
check('progress bounds', transitionProgress(wins[0]!, 2) === 0 && transitionProgress(wins[0]!, 3) === 1);
check('progress mid + clamp', Math.abs(transitionProgress(wins[0]!, 2.5) - 0.5) < 1e-9 && transitionProgress(wins[0]!, 99) === 1);
check('degenerate window -> 0', transitionProgress({ ...wins[0]!, start: 2, end: 2 }, 2) === 0);

if (allPassed) {
  console.log('\n>>> ALL PROJECT/TRANSITION CHECKS PASSED <<<');
} else {
  process.exit(1);
}
