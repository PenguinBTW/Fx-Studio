# Tree Walk & Streamline Untangling (`engine/treewalk.ts`, `engine/curvemorph.ts`)

Procedural polyline analysis, hierarchical branching tree extraction from 3D random walks, and continuous streamline untangling.

## Overview

In Act 2 (Radiative Transfer to Convection), a chaotic Brownian photon walk must smoothly transition into laminar magnetic field lines and branching solar prominence structures. `treewalk.ts` provides closed-form, deterministic geometric transformers that bridge these representations.

## Tree Extraction (`mapWalkToTree`)

Transforms an arbitrary 3D walk into a hierarchical branching tree structure:
```typescript
export interface TreeWalkOpts {
  branchCount?: number;   // Number of secondary branches (default 6)
  branchLength?: number;  // Segment length per branch
  maxDepth?: number;      // Maximum tree hierarchy depth (default 3)
  spread?: number;        // Lateral divergence factor
  seed?: number;          // Deterministic PRNG seed
}

export function mapWalkToTree(walkPoints: V3[], opts?: TreeWalkOpts): Tree
```

### Invariants:
1. **Tree Order**: The root branch (`parent = -1`) follows the primary walk trajectory.
2. **Hierarchy**: Child branch parents are strictly earlier indices (`parent[i] < i`), preventing cyclic dependencies.
3. **Exact Junctions**: Every child branch starts at an exact vertex of its parent branch ($C^0$ continuous).

## Streamline Untangling (`walkToStreamlines`)

Untangles chaotic Brownian walks into smooth laminar magnetic streamlines over morph progress $s \in [0, 1]$:
```typescript
export function walkToStreamlines(
  walkPoints: V3[],
  numStreamlines: number,
  progress: number,
  opts?: WalkToStreamlinesOpts
): V3[][]
```

### Mathematical Properties:
- **At $s = 0$**: Returns exact replicas of the original walk polyline.
- **At $s = 1$**: Returns laminar, low-curvature streamlines with:
  - **Path Length Reduction**: $> 60\%$ reduction in arc-length.
  - **Curvature Reduction**: $> 90\%$ reduction in total integrated curvature $\sum \|\Delta T_i\|$.
- **Boundary Clamping**: A sinusoidal envelope $\sin(\pi i / (N - 1))$ scales lateral streamline dispersion, strictly preserving input endpoints ($x_0$ and $x_{N-1}$) across all $s \in [0, 1]$.
- **Rotation-Minimizing Distribution**: Multiple streamlines are distributed in a tubular envelope around the central axis using Bishop normal frames $(N_i, B_i)$.

## Testing & Verification

Run tests via Bun:
```bash
bun scripts/test_treewalk.ts
```
Covers:
1. `mapWalkToTree` branching hierarchy, depth limits, and node connectivity.
2. `walkToStreamlines` $s=0$ exact reproduction and $s=1$ laminar properties.
3. Continuous bounded vertex step deltas without jump discontinuities.
4. Out-of-order scrub determinism.
