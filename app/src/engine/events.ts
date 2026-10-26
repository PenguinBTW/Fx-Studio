// Visual event registry: maps named picture events (e.g. 'T4.voidCut') to times.
// Pure data and deterministic (no clocks). Times come from the project timeline
// (entries, transitions, absolute `at`) and may snap to analysed downbeats.
// The mixer and SFX tooling read the resolved table (events.json), so cues follow the picture.
import type { ProjectManifest } from './projects';

export interface EventSnap {
  to?: 'downbeat';
  /** Max |snap distance| in seconds; falls back to ResolveEventsOptions.snapTolerance. */
  tolerance?: number;
}

/** Exactly one anchor: `at`, `entry` or `transition`. `offset` (s) is added to it. */
export interface EventDef {
  id: string;
  /** Absolute project time (s). */
  at?: number;
  /** Timeline entry id; time = entry.start (or entry.end with from:'end'). */
  entry?: string;
  /** Transition id (manifest `id` or default `<project>-t<n>`); time = window start (or end with from:'end'). */
  transition?: string;
  from?: 'start' | 'end';
  offset?: number;
  /** true = snap with default tolerance. */
  snap?: boolean | EventSnap;
}

/** Event emitted by a scene, authored in scene-local seconds (0 = entry start). */
export interface SceneEventDef {
  id: string;
  local: number;
  snap?: boolean | EventSnap;
}

export interface EventAnalysis {
  downbeats?: number[];
}

export interface ResolvedEvent {
  id: string;
  t: number;
  frame: number;
  /** Present only when the time was moved by snapping. */
  raw?: number;
}

export interface ResolveEventsOptions {
  fps?: number;
  /** Default snap tolerance (s) for events that ask to snap without one. */
  snapTolerance?: number;
  registry?: EventRegistry;
}

export class EventRegistry {
  private scenes = new Map<string, SceneEventDef[]>();

  /** Register (replace) the events a scene emits, keyed by timeline entry id. */
  register(entryId: string, defs: SceneEventDef[]): void {
    this.scenes.set(entryId, defs.slice());
  }

  get(entryId: string): SceneEventDef[] {
    return this.scenes.get(entryId) ?? [];
  }

  entries(): string[] {
    return [...this.scenes.keys()];
  }

  clear(): void {
    this.scenes.clear();
  }

  dump(): Record<string, SceneEventDef[]> {
    return Object.fromEntries(this.scenes);
  }

  load(d: Record<string, SceneEventDef[]>): void {
    for (const [k, v] of Object.entries(d)) this.register(k, v);
  }
}

export const defaultEventRegistry = new EventRegistry();
// Lets the headless renderer read what scenes registered inside the page.
(globalThis as any).__fxEvents = defaultEventRegistry;

export function registerSceneEvents(entryId: string, defs: SceneEventDef[]): void {
  defaultEventRegistry.register(entryId, defs);
}

export function snapToDownbeat(t: number, downbeats: readonly number[], tolerance: number): number | null {
  let best: number | null = null;
  let bd = Infinity;
  for (const d of downbeats) {
    const dist = Math.abs(d - t);
    if (dist < bd) { bd = dist; best = d; }
  }
  return best !== null && bd <= tolerance ? best : null;
}

export function resolveEvents(
  project: ProjectManifest,
  analysis?: EventAnalysis | null,
  opts: ResolveEventsOptions = {},
): ResolvedEvent[] {
  const fps = opts.fps ?? 60;
  const tol0 = opts.snapTolerance ?? 0.05;
  const registry = opts.registry ?? defaultEventRegistry;
  const downbeats = analysis?.downbeats ?? [];
  const entries = new Map(project.entries.map((e, i) => [e.id ?? `${project.project}-e${i + 1}`, e]));
  const trans = new Map((project.transitions ?? []).map((t, i) => [t.id ?? `${project.project}-t${i + 1}`, t]));

  const defs: Array<{ def: EventDef; base: number | null }> = [];
  for (const def of project.events ?? []) defs.push({ def, base: null });
  for (const entryId of registry.entries()) {
    const e = entries.get(entryId);
    if (!e) continue;
    for (const s of registry.get(entryId)) {
      defs.push({ def: { id: s.id, at: e.start + s.local, snap: s.snap }, base: null });
    }
  }

  const seen = new Set<string>();
  const out: ResolvedEvent[] = [];
  for (const { def } of defs) {
    if (!def.id) throw new Error('[events] event without id');
    if (seen.has(def.id)) throw new Error(`[events] duplicate event id '${def.id}'`);
    seen.add(def.id);
    const anchors = [def.at, def.entry, def.transition].filter((v) => v !== undefined).length;
    if (anchors !== 1) throw new Error(`[events] '${def.id}' needs exactly one of at / entry / transition`);
    let t: number;
    if (def.at !== undefined) {
      t = def.at;
    } else if (def.entry !== undefined) {
      const e = entries.get(def.entry);
      if (!e) throw new Error(`[events] '${def.id}': unknown entry '${def.entry}'`);
      t = def.from === 'end' ? e.end : e.start;
    } else {
      const tr = trans.get(def.transition!);
      if (!tr) throw new Error(`[events] '${def.id}': unknown transition '${def.transition}'`);
      t = def.from === 'end' ? tr.at + tr.dur : tr.at;
    }
    t += def.offset ?? 0;
    if (!Number.isFinite(t)) throw new Error(`[events] '${def.id}': non-finite time`);
    const raw = t;
    if (def.snap) {
      const tol = (typeof def.snap === 'object' ? def.snap.tolerance : undefined) ?? tol0;
      const s = snapToDownbeat(t, downbeats, tol);
      if (s !== null) t = s;
    }
    out.push({ id: def.id, t, frame: Math.round(t * fps), ...(t !== raw ? { raw } : {}) });
  }
  out.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
  return out;
}

export function eventsToJson(events: ResolvedEvent[], fps = 60): { fps: number; events: ResolvedEvent[] } {
  return { fps, events };
}
