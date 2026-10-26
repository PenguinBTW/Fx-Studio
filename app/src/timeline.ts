// Universal Timeline: Maps scenes to timeline intervals.
// Projects live in folders: scenes/<project>/ with a project.json manifest
// (entries + standalone transitions). Selection: ?project= URL >>
// scenes/active.json pointer >> 'default'. Works seamlessly for procedural
// motion graphics with ClockDriver, as well as optional Audio/Speech
// driven sequences.
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import { validateTransition, type TransitionClass, type TransitionEntry } from './engine/transition';
import {
  buildTimelineEntries,
  buildTransitionEntries,
  resolveProjectName,
  type ProjectManifest,
} from './engine/projects';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';
import type { TimelineDriver } from './engine/driver';
import activePointer from './scenes/active.json';

// Scene modules are discovered lazily so a missing/broken scene never breaks the build.
// Recursive glob: scenes/<project>/<scene>.ts (and legacy root scenes/<scene>.ts).
const sceneModules = import.meta.glob<{ default: SceneClass }>('./scenes/**/*.ts');
const transitionModules = import.meta.glob<{ default: TransitionClass }>('./transitions/*.ts');
const manifestFiles = import.meta.glob<ProjectManifest>('./scenes/{*,_prereq_demos/*}/project.json', {
  eager: true,
  import: 'default',
});
// _prereq_demos/<module>/project.json is addressed as project <module>.
const manifests: Record<string, ProjectManifest> = {};
for (const [k, v] of Object.entries(manifestFiles)) {
  const parts = k.split('/');
  manifests[parts[2] === '_prereq_demos' ? parts[3]! : parts[2]!] = v;
}

const scene = (name: string) => () => {
  const m = sceneModules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

const transition = (name: string) => () => {
  const m = transitionModules[`./transitions/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`transition module not found: transitions/${name}.ts`));
};

function loadManifest(project?: string | null): ProjectManifest {
  const available = Object.keys(manifests);
  const want = resolveProjectName({
    urlProject: project,
    pointer: (activePointer as { project?: string } | null)?.project ?? null,
    available,
  });
  return manifests[want]!;
}

export function makeTimeline(
  _ly?: Lyrics | null,
  _au?: AudioData | null,
  _driver?: TimelineDriver,
  project?: string | null,
): TimelineEntry[] {
  return buildTimelineEntries(loadManifest(project), scene);
}

export function makeTransitions(project?: string | null): TransitionEntry[] {
  const manifest = loadManifest(project);
  const trs = buildTransitionEntries(manifest, transition);
  const entries = buildTimelineEntries(manifest, scene);
  for (const tr of trs) {
    const errs = validateTransition(tr, entries);
    if (errs.length > 0) {
      console.warn(`[transition ${tr.id}] validation warnings:\n  ` + errs.join('\n  '));
    }
  }
  return trs;
}
