// Two-Tier Transition Cascade & Registry (f(x) Studio v0.8.0)
// Resolves transition modules using a two-tier priority cascade:
//   Tier 1 (Bespoke): Project-local transitions in scenes/<project>/transitions/<name>.ts
//   Tier 2 (Global):  Platform library in transitions/<name>.ts
// Pure browser-compatible engine module transformed by Vite at build time.

import type { TransitionClass } from '../transition';

export type TransitionLoader = () => Promise<{ default: TransitionClass }>;

export interface TransitionRegistryMap {
  local: Record<string, TransitionLoader>;
  global: Record<string, TransitionLoader>;
}

// Global registry override (useful for testing or custom runtime injection)
let customRegistry: TransitionRegistryMap | null = null;

export function setTransitionRegistry(registry: TransitionRegistryMap | null): void {
  customRegistry = registry;
}

const defaultLocal: Record<string, TransitionLoader> = {};
const defaultGlobal: Record<string, TransitionLoader> = {};
/**
 * Returns a list of all available transition identifiers, segregated by tier.
 */
export function listAvailableTransitions(project?: string | null): { local: string[]; global: string[] } {
  const localMap = customRegistry ? customRegistry.local : defaultLocal;
  const globalMap = customRegistry ? customRegistry.global : defaultGlobal;

  const globalNames: string[] = [];
  for (const p of Object.keys(globalMap)) {
    const m = p.match(/\/([^/]+)\.ts$/);
    if (m) globalNames.push(m[1]!);
    else globalNames.push(p);
  }

  const localNames: string[] = [];
  if (project) {
    const prefix = `../../scenes/${project}/transitions/`;
    for (const p of Object.keys(localMap)) {
      if (p.startsWith(prefix) || p.startsWith(`${project}/`)) {
        const parts = p.replace(/\.ts$/i, '').split('/');
        const basename = parts[parts.length - 1]!;
        if (!localNames.includes(basename)) localNames.push(basename);
      }
    }
  }

  return { local: localNames, global: globalNames };
}

/**
 * Resolves a transition loader function via the Two-Tier Transition Cascade:
 * 1. Checks project-local `scenes/<project>/transitions/<name>.ts`
 * 2. Falls back to global `transitions/<name>.ts`
 *
 * @param name Transition file basename (without .ts extension)
 * @param project Optional active project name
 * @returns Lazy module loader `() => Promise<{ default: TransitionClass }>`
 */
export function resolveTransition(
  name: string,
  project?: string | null
): TransitionLoader {
  const cleanName = name.replace(/\.ts$/i, '').replace(/^[./\\]+/, '');
  const localMap = customRegistry ? customRegistry.local : defaultLocal;
  const globalMap = customRegistry ? customRegistry.global : defaultGlobal;

  // 1. Tier 1: Check project-local bespoke transitions
  if (project) {
    const candidates = [
      `./scenes/${project}/transitions/${cleanName}.ts`,
      `scenes/${project}/transitions/${cleanName}.ts`,
      `../../scenes/${project}/transitions/${cleanName}.ts`,
      `${project}/${cleanName}`,
      cleanName,
    ];
    for (const k of candidates) {
      if (localMap[k]) return localMap[k]!;
    }
  }

  // 2. Tier 2: Check global platform transition library
  const globalCandidates = [
    `./transitions/${cleanName}.ts`,
    `transitions/${cleanName}.ts`,
    `../../transitions/${cleanName}.ts`,
    cleanName,
  ];
  for (const k of globalCandidates) {
    if (globalMap[k]) return globalMap[k]!;
  }

  // 3. Fallback error with actionable diagnostics
  return () => {
    const { local, global } = listAvailableTransitions(project);
    const msg = [
      `[transition-cascade] Transition module '${cleanName}' not found.`,
      project ? `Searched Tier 1 (local): scenes/${project}/transitions/${cleanName}.ts (available: ${local.join(', ') || 'none'})` : null,
      `Searched Tier 2 (global): transitions/${cleanName}.ts (available: ${global.slice(0, 8).join(', ')}... [${global.length} total])`,
    ].filter(Boolean).join('\n  ');
    return Promise.reject(new Error(msg));
  };
}

/**
 * Creates a bound transition resolver for a specific project.
 */
export function createTransitionResolver(project?: string | null): (name: string) => TransitionLoader {
  return (name: string) => resolveTransition(name, project);
}
