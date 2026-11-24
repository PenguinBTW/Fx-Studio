// Chladni nodal-line field for a square plate.
// Plate displacement w(x,y) = cos(m*pi*x)cos(n*pi*y) - cos(n*pi*x)cos(m*pi*y);
// nodal lines (grains gather there) are the zero set w = 0.

export interface ChladniMode {
  m: number;
  n: number;
  /** Displayed drive frequency (Hz) on the rig readout. */
  freq: number;
}

/** Stepped resonant modes: rising order, rising frequency. */
export const MODES: ChladniMode[] = [
  { m: 1, n: 2, freq: 482 },
  { m: 2, n: 3, freq: 1097 },
  { m: 3, n: 4, freq: 2052 },
];

export function chladni(m: number, n: number, x: number, y: number): number {
  const { cos, PI } = Math;
  return cos(m * PI * x) * cos(n * PI * y) - cos(n * PI * x) * cos(m * PI * y);
}

/**
 * Samples the zero set of w on the unit square via sign-change crossings on a
 * grid (marching-squares edges; unordered point cloud is all grains need).
 * Returns [x0, y0, x1, y1, ...] with coordinates in [0, 1].
 */
export function nodalPoints(mode: ChladniMode, cells = 140): Float32Array {
  const N = cells;
  const w = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      w[j * (N + 1) + i] = chladni(mode.m, mode.n, i / N, j / N);
    }
  }
  const pts: number[] = [];
  const seen = new Set<number>();
  const EPS = 1e-9;
  const push = (x0: number, y0: number, w0: number, x1: number, y1: number, w1: number) => {
    // A crossing exists on an exact-zero vertex too: whole branches of the zero
    // set (e.g. the x=y diagonal, where w is identically zero) sit on grid
    // vertices and strict sign-change tests would skip them entirely.
    const f = Math.abs(w0) < EPS ? 0 : w0 / (w0 - w1);
    const px = x0 + (x1 - x0) * f, py = y0 + (y1 - y0) * f;
    const key = Math.round(px * 1e6) * 2e6 + Math.round(py * 1e6);
    if (seen.has(key)) return;
    seen.add(key);
    pts.push(px, py);
  };
  const crosses = (a: number, b: number) => a * b < 0 || ((Math.abs(a) < EPS) !== (Math.abs(b) < EPS));
  for (let j = 0; j < N; j++) {
    const y0 = j / N, y1 = (j + 1) / N;
    for (let i = 0; i < N; i++) {
      const x0 = i / N, x1 = (i + 1) / N;
      const a = w[j * (N + 1) + i]!;
      const b = w[j * (N + 1) + i + 1]!;
      const c = w[(j + 1) * (N + 1) + i]!;
      const d = w[(j + 1) * (N + 1) + i + 1]!;
      if (crosses(a, b)) push(x0, y0, a, x1, y0, b);
      if (crosses(c, d)) push(x0, y1, c, x1, y1, d);
      if (crosses(a, c)) push(x0, y0, a, x0, y1, c);
      if (crosses(b, d)) push(x1, y0, b, x1, y1, d);
    }
  }
  return new Float32Array(pts);
}
