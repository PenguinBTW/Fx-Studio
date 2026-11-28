// Shared continuous first-person path interpolation for THRESHOLD motion repairs.
// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL

export type ScalarKey = readonly [time: number, value: number];

// Non-uniform Catmull/Hermite interpolation. Unlike the keyed pose system's per-key
// smoothstep, interior tangents remain nonzero, removing stop-start braking hitches
// while still passing exactly through the authored positions at their authored times.
export function hermite1D(t: number, keys: readonly ScalarKey[]): number {
  if (t <= keys[0]![0]) return keys[0]![1];
  const last = keys.length - 1;
  if (t >= keys[last]![0]) return keys[last]![1];
  let i = 0;
  while (i < last - 1 && t >= keys[i + 1]![0]) i++;
  const [t0, v0] = keys[i]!;
  const [t1, v1] = keys[i + 1]!;
  const dt = t1 - t0;
  const u = (t - t0) / dt;
  const m0 = i === 0 ? (v1 - v0) / dt : (v1 - keys[i - 1]![1]) / (t1 - keys[i - 1]![0]);
  const m1 = i === last - 1 ? (v1 - v0) / dt : (keys[i + 2]![1] - v0) / (keys[i + 2]![0] - t0);
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * m0 * dt + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * m1 * dt;
}
