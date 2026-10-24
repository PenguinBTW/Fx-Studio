// Project system: many projects (folders of scenes) share one engine.
// Each project is `scenes/<name>/project.json`; selection is
// ?project= URL > scenes/active.json pointer > 'default' fallback.
// Pure + DOM-free so tooling tests can exercise it under bun.
import type { TimelineEntry } from './engine';
import type { TransitionEntry } from './transition';

export interface ManifestEntryDef {
  /** Scene file, folder-relative: 'default/demo' or legacy 'demo'. */
  scene: string;
  id?: string;
  start: number;
  end: number;
  caption?: { fig: string; text: string; dur?: number; delay?: number };
  post?: TimelineEntry['post'];
  params?: Record<string, any>;
  maxSamples?: number;
}

export interface ManifestTransitionDef {
  id?: string;
  /** Transition module in src/transitions (no folder). */
  transition: string;
  from: string;
  to: string;
  /** Window start (song seconds) + duration. Must lie inside both entries. */
  at: number;
  dur: number;
}

export interface ProjectManifest {
  project: string;
  entries: ManifestEntryDef[];
  transitions?: ManifestTransitionDef[];
}

/** Selection priority: explicit (?project= / --project) > pointer file > fallback. */
export function resolveProjectName(opts: {
  urlProject?: string | null;
  pointer?: string | null;
  available: string[];
  fallback?: string;
}): string {
  const fallback = opts.fallback ?? 'default';
  const want = opts.urlProject || opts.pointer || fallback;
  if (!opts.available.includes(want)) {
    throw new Error(`[project] Unknown project '${want}' (available: ${opts.available.join(', ') || 'none'})`);
  }
  return want;
}

export function buildTimelineEntries(
  manifest: ProjectManifest,
  loadScene: (file: string) => TimelineEntry['load'],
): TimelineEntry[] {
  return manifest.entries.map((e, i) => {
    const sceneNorm = e.scene.replace(/\\/g, '/');
    return {
      id: e.id ?? `${manifest.project}-e${i + 1}`,
      file: sceneNorm,
      load: loadScene(sceneNorm),
      start: e.start,
      end: e.end,
      ...(e.caption ? { caption: e.caption } : {}),
      ...(e.post ? { post: e.post } : {}),
      ...(e.params ? { params: e.params } : {}),
      ...(e.maxSamples !== undefined ? { maxSamples: e.maxSamples } : {}),
    };
  });
}

export function buildTransitionEntries(
  manifest: ProjectManifest,
  loadTransition: (name: string) => TransitionEntry['load'],
): TransitionEntry[] {
  return (manifest.transitions ?? []).map((t, i) => {
    const fromNorm = t.from.replace(/\\/g, '/');
    const toNorm = t.to.replace(/\\/g, '/');
    const transNorm = t.transition.replace(/\\/g, '/');
    return {
      id: t.id ?? `${manifest.project}-t${i + 1}`,
      from: fromNorm,
      to: toNorm,
      start: t.at,
      end: t.at + t.dur,
      load: loadTransition(transNorm),
    };
  });
}
