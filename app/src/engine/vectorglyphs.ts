import * as THREE from 'three';
import polygonClipping, { type Polygon, type Ring } from 'polygon-clipping';
import { HERSHEY_CAP, HERSHEY_GLYPHS } from './hersheyglyphs';

/**
 * Procedural Geometric Vector Glyph Path Builder.
 * Generates clean structural neo-grotesque vector paths (0..1 normalized box)
 * with true inner holes for letters like A, B, D, O, P, Q, R, 0, 4, 6, 8, 9.
 */
function legacyGlyph(c: string): THREE.Shape | THREE.Shape[] | null {
  const shape = new THREE.Shape();

  switch (c) {
    case 'I':
    case '1':
      shape.moveTo(0.35, 0.0);
      shape.lineTo(0.65, 0.0);
      shape.lineTo(0.65, 1.0);
      shape.lineTo(0.35, 1.0);
      shape.closePath();
      return shape;

    case 'L':
      shape.moveTo(0.15, 0.0);
      shape.lineTo(0.85, 0.0);
      shape.lineTo(0.85, 0.22);
      shape.lineTo(0.40, 0.22);
      shape.lineTo(0.40, 1.0);
      shape.lineTo(0.15, 1.0);
      shape.closePath();
      return shape;

    case 'T':
      shape.moveTo(0.38, 0.0);
      shape.lineTo(0.62, 0.0);
      shape.lineTo(0.62, 0.78);
      shape.lineTo(0.90, 0.78);
      shape.lineTo(0.90, 1.0);
      shape.lineTo(0.10, 1.0);
      shape.lineTo(0.10, 0.78);
      shape.lineTo(0.38, 0.78);
      shape.closePath();
      return shape;

    case 'H':
      shape.moveTo(0.15, 0.0);
      shape.lineTo(0.38, 0.0);
      shape.lineTo(0.38, 0.40);
      shape.lineTo(0.62, 0.40);
      shape.lineTo(0.62, 0.0);
      shape.lineTo(0.85, 0.0);
      shape.lineTo(0.85, 1.0);
      shape.lineTo(0.62, 1.0);
      shape.lineTo(0.62, 0.60);
      shape.lineTo(0.38, 0.60);
      shape.lineTo(0.38, 1.0);
      shape.lineTo(0.15, 1.0);
      shape.closePath();
      return shape;

    case 'E':
      shape.moveTo(0.15, 0.0);
      shape.lineTo(0.85, 0.0);
      shape.lineTo(0.85, 0.22);
      shape.lineTo(0.40, 0.22);
      shape.lineTo(0.40, 0.40);
      shape.lineTo(0.75, 0.40);
      shape.lineTo(0.75, 0.60);
      shape.lineTo(0.40, 0.60);
      shape.lineTo(0.40, 0.78);
      shape.lineTo(0.85, 0.78);
      shape.lineTo(0.85, 1.0);
      shape.lineTo(0.15, 1.0);
      shape.closePath();
      return shape;

    case 'F':
      shape.moveTo(0.15, 0.0);
      shape.lineTo(0.40, 0.0);
      shape.lineTo(0.40, 0.40);
      shape.lineTo(0.75, 0.40);
      shape.lineTo(0.75, 0.60);
      shape.lineTo(0.40, 0.60);
      shape.lineTo(0.40, 0.78);
      shape.lineTo(0.85, 0.78);
      shape.lineTo(0.85, 1.0);
      shape.lineTo(0.15, 1.0);
      shape.closePath();
      return shape;

    case 'C':
      shape.moveTo(0.85, 0.22);
      shape.lineTo(0.85, 0.0);
      shape.lineTo(0.20, 0.0);
      shape.lineTo(0.20, 1.0);
      shape.lineTo(0.85, 1.0);
      shape.lineTo(0.85, 0.78);
      shape.lineTo(0.45, 0.78);
      shape.lineTo(0.45, 0.22);
      shape.closePath();
      return shape;

    case 'U':
      shape.moveTo(0.15, 1.0);
      shape.lineTo(0.15, 0.0);
      shape.lineTo(0.85, 0.0);
      shape.lineTo(0.85, 1.0);
      shape.lineTo(0.60, 1.0);
      shape.lineTo(0.60, 0.22);
      shape.lineTo(0.40, 0.22);
      shape.lineTo(0.40, 1.0);
      shape.closePath();
      return shape;

    case 'O':
    case '0': {
      shape.moveTo(0.10, 0.0);
      shape.lineTo(0.90, 0.0);
      shape.lineTo(0.90, 1.0);
      shape.lineTo(0.10, 1.0);
      shape.closePath();

      // Inner Hole
      const hole = new THREE.Path();
      hole.moveTo(0.35, 0.22);
      hole.lineTo(0.65, 0.22);
      hole.lineTo(0.65, 0.78);
      hole.lineTo(0.35, 0.78);
      hole.closePath();
      shape.holes.push(hole);
      return shape;
    }

    case 'A': {
      shape.moveTo(0.10, 0.0);
      shape.lineTo(0.32, 0.0);
      shape.lineTo(0.40, 0.35);
      shape.lineTo(0.60, 0.35);
      shape.lineTo(0.68, 0.0);
      shape.lineTo(0.90, 0.0);
      shape.lineTo(0.60, 1.0);
      shape.lineTo(0.40, 1.0);
      shape.closePath();

      const hole = new THREE.Path();
      hole.moveTo(0.43, 0.52);
      hole.lineTo(0.57, 0.52);
      hole.lineTo(0.50, 0.78);
      hole.closePath();
      shape.holes.push(hole);
      return shape;
    }

    case 'P': {
      shape.moveTo(0.15, 0.0);
      shape.lineTo(0.40, 0.0);
      shape.lineTo(0.40, 0.45);
      shape.lineTo(0.85, 0.45);
      shape.lineTo(0.85, 1.0);
      shape.lineTo(0.15, 1.0);
      shape.closePath();

      const hole = new THREE.Path();
      hole.moveTo(0.40, 0.65);
      hole.lineTo(0.65, 0.65);
      hole.lineTo(0.65, 0.82);
      hole.lineTo(0.40, 0.82);
      hole.closePath();
      shape.holes.push(hole);
      return shape;
    }

    case '-':
    case '_':
      shape.moveTo(0.15, 0.40);
      shape.lineTo(0.85, 0.40);
      shape.lineTo(0.85, 0.55);
      shape.lineTo(0.15, 0.55);
      shape.closePath();
      return shape;

    case ':': {
      shape.moveTo(0.38, 0.20);
      shape.lineTo(0.62, 0.20);
      shape.lineTo(0.62, 0.38);
      shape.lineTo(0.38, 0.38);
      shape.closePath();

      const dot2 = new THREE.Shape();
      dot2.moveTo(0.38, 0.62);
      dot2.lineTo(0.62, 0.62);
      dot2.lineTo(0.62, 0.80);
      dot2.lineTo(0.38, 0.80);
      dot2.closePath();
      return [shape, dot2];
    }

    default:
      return null;
  }
}

const LEGACY = new Set(['I', '1', 'L', 'T', 'H', 'E', 'F', 'C', 'U', 'O', '0', 'A', 'P', '-', '_', ':']);
const ALIASES: Record<string, string> = { '\u2019': "'", '\u2018': "'", '\u201C': '"', '\u201D': '"', '\u2013': '-', '\u2014': '-', '\u00A0': ' ' };
const THIN = new Set(['%', '&', '@', '#', '$', '8', '*', '{', '}', '~']);
const PAD = 0.075;
const CAP_SEGS = 6;

function capsule(ax: number, ay: number, bx: number, by: number, r: number): Ring {
  const q = (v: number) => Math.round(v * 2048) / 2048;
  const ang = Math.atan2(by - ay, bx - ax);
  const ring: Ring = [];
  for (let i = 0; i <= CAP_SEGS; i++) {
    const a = ang - Math.PI / 2 + (Math.PI * i) / CAP_SEGS;
    ring.push([q(bx + Math.cos(a) * r), q(by + Math.sin(a) * r)]);
  }
  for (let i = 0; i <= CAP_SEGS; i++) {
    const a = ang + Math.PI / 2 + (Math.PI * i) / CAP_SEGS;
    ring.push([q(ax + Math.cos(a) * r), q(ay + Math.sin(a) * r)]);
  }
  return ring;
}

function ringToPoints(ring: Ring): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const n = ring.length - 1; // polygon-clipping closes rings
  for (let i = 0; i < n; i++) {
    const p = ring[i]!;
    const last = pts[pts.length - 1];
    if (last && Math.hypot(p[0] - last.x, p[1] - last.y) < 0.004) continue;
    pts.push(new THREE.Vector2(p[0], p[1]));
  }
  return pts;
}

function strokeGlyph(c: string): THREE.Shape[] | null {
  const src = HERSHEY_GLYPHS[c];
  if (!src) return null;
  const r = THIN.has(c) ? 0.075 : 0.1;
  const s = (1 - 2 * r) / HERSHEY_CAP;
  const parts: Polygon[] = [];
  for (const raw of src[1]) {
    let line = raw;
    if (line.length < 2) continue;
    if (line.length === 2) line = [line[0]!, line[1]!, line[0]!, line[1]!];
    for (let i = 0; i + 3 < line.length; i += 2) {
      parts.push([capsule(line[i]! * s, line[i + 1]! * s + r, line[i + 2]! * s, line[i + 3]! * s + r, r)]);
    }
  }
  if (!parts.length) return null;
  let merged = polygonClipping.union(parts[0]!);
  for (let i = 1; i < parts.length; i++) {
    try { merged = polygonClipping.union(merged, parts[i]!); } catch { /* degenerate sliver: skip this segment */ }
  }
  const shapes: THREE.Shape[] = [];
  for (const poly of merged) {
    const outer = ringToPoints(poly[0]!);
    if (outer.length < 3) continue;
    const shape = new THREE.Shape(outer);
    for (let h = 1; h < poly.length; h++) {
      const hp = ringToPoints(poly[h]!);
      if (hp.length >= 3) shape.holes.push(new THREE.Path(hp));
    }
    shapes.push(shape);
  }
  return shapes.length ? shapes : null;
}

function placeholderGlyph(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0.1, 0.0); shape.lineTo(0.5, 0.0); shape.lineTo(0.5, 0.7); shape.lineTo(0.1, 0.7); shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(0.14, 0.04); hole.lineTo(0.14, 0.66); hole.lineTo(0.46, 0.66); hole.lineTo(0.46, 0.04); hole.closePath();
  shape.holes.push(hole);
  return shape;
}

export interface GlyphInfo {
  char: string;
  shapes: THREE.Shape[];
  /** Ink box in em (x0, x1 include nothing but the outline; bevel is extra). */
  x0: number;
  x1: number;
  /** Variable advance in em: ink width plus padding on both sides. */
  advance: number;
  /** True when the glyph was one of the original hand-authored shapes (geometry is hash-locked). */
  legacy: boolean;
  placeholder: boolean;
}

const cache = new Map<string, GlyphInfo | null>();
const warned = new Set<string>();

export function normalizeGlyphChar(char: string): string {
  const a = ALIASES[char] ?? char;
  return a.length === 1 ? a.toUpperCase() : a;
}

export function getGlyph(char: string): GlyphInfo | null {
  const c = normalizeGlyphChar(char);
  if (c === ' ' || c === '\t' || c === '\r' || c === '\n') return null;
  if (cache.has(c)) return cache.get(c)!;

  let shapes: THREE.Shape[] | null = null;
  let placeholder = false;
  const legacy = LEGACY.has(c);
  if (legacy) {
    const g = legacyGlyph(c);
    shapes = g ? (Array.isArray(g) ? g : [g]) : null;
  } else {
    shapes = strokeGlyph(c);
  }
  if (!shapes) {
    placeholder = true;
    shapes = [placeholderGlyph()];
    if (!warned.has(c)) {
      warned.add(c);
      console.warn(`[vectorglyphs] No glyph for ${JSON.stringify(char)} (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}); drawing a placeholder box.`);
    }
  }
  let x0 = Infinity, x1 = -Infinity;
  for (const s of shapes) for (const p of s.getPoints()) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); }
  const info: GlyphInfo = { char: c, shapes, x0, x1, advance: x1 - x0 + 2 * PAD, legacy, placeholder };
  cache.set(c, info);
  return info;
}

export function createGlyphShape(char: string): THREE.Shape | THREE.Shape[] | null {
  const g = getGlyph(char);
  if (!g) return null;
  return g.legacy && g.shapes.length === 1 ? g.shapes[0]! : g.shapes;
}

export const VectorGlyphs = { createShape: createGlyphShape, get: getGlyph };
