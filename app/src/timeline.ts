// Universal Timeline: Maps scenes to timeline intervals.
// Projects live in folders: scenes/<project>/ with a project.json manifest
// (entries + standalone transitions). Selection: ?project= URL >>
// scenes/active.json pointer >> 'default'. Works seamlessly for procedural
// motion graphics with ClockDriver, as well as optional Audio/Speech
// driven sequences.
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { TransitionClass, TransitionEntry } from './engine/transition';
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
const manifests = import.meta.glob<ProjectManifest>('./scenes/*/project.json', {
  eager: true,
  import: 'default',
});

const scene = (name: string) => () => {
  const m = sceneModules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

const transition = (name: string) => () => {
  const m = transitionModules[`./transitions/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`transition module not found: transitions/${name}.ts`));
};

function loadManifest(project?: string | null): ProjectManifest {
  const available = Object.keys(manifests).map((k) => k.split('/')[2]!);
  const want = resolveProjectName({
    urlProject: project,
    pointer: (activePointer as { project?: string } | null)?.project ?? null,
    available,
  });
  return manifests[`./scenes/${want}/project.json`] as ProjectManifest;
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
  return buildTransitionEntries(loadManifest(project), transition);
}
