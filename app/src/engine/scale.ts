// Output resolution multiplier, read once from the page URL (`?scale=2` renders 3840x2160).
// Scenes lay out in logical px (1920x1080 unless ?size= is set); the engine renders at SCALE x that.
// Kept in its own module so glsl/common.ts can use it without an import cycle through gl.ts.
function readScale() {
  if (typeof location === 'undefined') return 1;
  const v = Number(new URLSearchParams(location.search).get('scale') ?? '1');
  if (!Number.isFinite(v)) return 1;
  // below 1 there is a single draft step: 0.5 (half-resolution previews, e.g. 960x540 from a 1920x1080 canvas)
  if (v < 1) return v > 0 ? 0.5 : 1;
  return Math.min(Math.round(v), 4);
}

/** Physical pixels per logical pixel of the output: 0.5 (draft) or an integer 1..4 (default 1). */
export const SCALE = readScale();

/** Parses a `WxH` size (e.g. `1080x1920`); null when absent or out of range (16..4096 per side). */
export function parseSize(v: string | null | undefined): [number, number] | null {
  const m = /^(\d+)x(\d+)$/.exec(v ?? '');
  if (!m) return null;
  const w = Number(m[1]), h = Number(m[2]);
  return w >= 16 && h >= 16 && w <= 4096 && h <= 4096 ? [w, h] : null;
}
// Logical canvas size, read once from the page URL (`?size=1080x1920` for vertical). Projects declare it as
// project.json "size"; render.ts and the preview player pass it on the URL.
const SIZE = (typeof location === 'undefined' ? null : parseSize(new URLSearchParams(location.search).get('size'))) ?? [1920, 1080];
export const LOGICAL_W = SIZE[0];
export const LOGICAL_H = SIZE[1];
