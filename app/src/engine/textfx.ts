// P10a text effects: odometer roller, stroke-plotted reveal with pen glow, letter-level layout hooks
// and word/char reveal timing. Everything here is a pure function of time (no DOM, no clock, no RNG)
// so it can be unit-tested headless. Canvas drawing helpers only touch the context they are given.
import { clamp, ease, pointAtLength, type V2, type V3 } from './util';
import type { StrokeText } from './stroke';

/* ───────────────────────────── Odometer ───────────────────────────── */

export interface OdometerOpts {
  /** Decimal places shown (default 0). */
  decimals?: number;
  /** Thousands separator ('' disables; default ','). */
  separator?: string;
  decimalPoint?: string;
  /** Integer places always allocated, so the width is fixed (default 1: grows when a new place carries in). */
  minDigits?: number;
  /** Show leading zero places instead of fading new places in on carry (default false). */
  leadingZeros?: boolean;
  /** Tabular cell widths in em. */
  cellWidth?: number;
  sepWidth?: number;
  /** Easing of each digit's carry roll (default inOutCubic). */
  rollEase?: (u: number) => number;
  prefix?: string;
  suffix?: string;
}

export type OdometerKind = 'digit' | 'sep' | 'point' | 'sign' | 'prefix' | 'suffix';

export interface OdometerCell {
  kind: OdometerKind;
  /** Decimal exponent of the digit (0 = units, -1 = tenths, 3 = thousands); 0 for non-digits. */
  place: number;
  /** Static character for non-digit cells; the nearest digit for digit cells. */
  char: string;
  /** Digit currently on show and the one rolling in below it. */
  from: number;
  to: number;
  /** Eased roll progress 0..1: the strip is shifted up by `frac` cell heights. */
  frac: number;
  /** Continuous strip position 0..10 (from + frac). */
  pos: number;
  alpha: number;
  /** Left edge and width in em, relative to the left of the whole counter. */
  x: number;
  w: number;
}

export interface OdometerState {
  value: number;
  /** Text the counter reads at this instant (cells below half-roll show `from`, past it `to`). */
  text: string;
  cells: OdometerCell[];
  /** Total width in em. */
  width: number;
}

const POW10 = (n: number) => Math.pow(10, n);

/**
 * Per-digit odometer state for `value`. Pass the already-eased value (e.g. `from + (to - from) * ease(u)`):
 * each digit sits still until all lower digits are 9, then rolls over the last 1.0 of the scaled value, so
 * 999 -> 1000 rolls every digit together and fades the new thousands place in. The units digit glides
 * across every integer step.
 */
export function odometer(value: number, opts: OdometerOpts = {}): OdometerState {
  const d = Math.max(0, Math.floor(opts.decimals ?? 0));
  const sep = opts.separator ?? ',';
  const dp = opts.decimalPoint ?? '.';
  const cw = opts.cellWidth ?? 0.62;
  const sw = opts.sepWidth ?? 0.3;
  const rollEase = opts.rollEase ?? ease.inOutCubic;
  const v = Number.isFinite(value) ? value : 0;
  const s = Math.abs(v) * POW10(d);
  const need = String(Math.floor(s) + 1).length;
  const places = Math.max(need, (opts.minDigits ?? 1) + d, d + 1);

  const cells: OdometerCell[] = [];
  let x = 0;
  const push = (kind: OdometerKind, char: string, w: number, alpha: number, extra: Partial<OdometerCell> = {}) => {
    cells.push({ kind, place: 0, char, from: 0, to: 0, frac: 0, pos: 0, alpha, x, w, ...extra });
    x += w;
  };
  const charW = (str: string) => str.length * cw * 0.75;

  if (opts.prefix) push('prefix', opts.prefix, charW(opts.prefix), 1);
  if (v < 0) push('sign', '-', sw, 1);

  const digitAlpha: number[] = [];
  for (let j = places - 1; j >= 0; j--) {
    const base = Math.floor(s / POW10(j));
    const transit = j === 0 ? s - Math.floor(s) : clamp((s % POW10(j)) - (POW10(j) - 1), 0, 1);
    const frac = rollEase(transit);
    const leading = base === 0 && j > d && !opts.leadingZeros;
    const alpha = leading ? clamp(transit * 2) : 1;
    digitAlpha[j] = alpha;
    const from = base % 10;
    const to = (from + 1) % 10;
    const intPlace = j - d;
    if (j === d - 1 && d > 0) push('point', dp, sw, digitAlpha[j + 1] ?? 1);
    else if (sep && intPlace >= 0 && intPlace % 3 === 2 && j !== places - 1) push('sep', sep, sw, digitAlpha[j + 1] ?? 1);
    push('digit', frac >= 0.5 ? String(to) : String(from), cw, alpha, { place: intPlace, from, to, frac, pos: from + frac });
  }
  if (opts.suffix) push('suffix', opts.suffix, charW(opts.suffix), 1);

  const text = cells.map((c) => (c.kind === 'digit' || c.kind === 'sep' ? (c.alpha >= 0.5 ? c.char : '') : c.char)).join('');
  return { value: v, text, cells, width: x };
}

export interface OdometerCellRect {
  cell: OdometerCell;
  /** Pixel rect of the cell (top-left origin) and its centre. */
  x: number; y: number; w: number; h: number; cx: number; cy: number;
}

/** Pixel rectangles of every cell for a counter whose text box has top y and anchor x (per `align`). */
export function odometerRects(
  st: OdometerState, x: number, y: number, fontPx: number, align: 'left' | 'center' | 'right' = 'left', rowHeight = 1.25,
): OdometerCellRect[] {
  const total = st.width * fontPx;
  const left = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const h = fontPx * rowHeight;
  return st.cells.map((cell) => {
    const cx0 = left + cell.x * fontPx, w = cell.w * fontPx;
    return { cell, x: cx0, y, w, h, cx: cx0 + w / 2, cy: y + h / 2 };
  });
}

export interface OdometerDrawOpts {
  fontPx: number;
  /** CSS font shorthand without size, e.g. '700 ' prefix handled by caller: pass full font string. */
  font: string;
  color: string;
  align?: 'left' | 'center' | 'right';
  rowHeight?: number;
  haloColor?: string;
  haloPx?: number;
}

/** Draw an odometer: each digit is a vertical strip clipped to its cell and shifted by its roll fraction. */
export function drawOdometer(c: CanvasRenderingContext2D, st: OdometerState, x: number, y: number, o: OdometerDrawOpts): void {
  const rects = odometerRects(st, x, y, o.fontPx, o.align ?? 'left', o.rowHeight ?? 1.25);
  c.save();
  c.font = o.font;
  c.textAlign = 'center';
  c.textBaseline = 'top';
  (c as unknown as { letterSpacing?: string }).letterSpacing = '0px';
  const baseAlpha = c.globalAlpha;
  const put = (ch: string, cx: number, ty: number, a: number) => {
    if (a <= 0.002) return;
    c.globalAlpha = baseAlpha * a;
    if (o.haloColor) {
      c.strokeStyle = o.haloColor;
      c.lineWidth = (o.haloPx ?? 3) * 2;
      c.lineJoin = 'round';
      c.strokeText(ch, cx, ty);
    }
    c.fillStyle = o.color;
    c.fillText(ch, cx, ty);
  };
  for (const r of rects) {
    const cell = r.cell;
    if (cell.alpha <= 0.002) continue;
    if (cell.kind !== 'digit') {
      put(cell.char, r.cx, r.y, cell.alpha);
      continue;
    }
    c.save();
    c.beginPath();
    c.rect(r.x, r.y, r.w, r.h);
    c.clip();
    put(String(cell.from), r.cx, r.y - cell.frac * r.h, cell.alpha * (1 - cell.frac * 0.6));
    if (cell.frac > 0) put(String(cell.to), r.cx, r.y + (1 - cell.frac) * r.h, cell.alpha * (0.4 + cell.frac * 0.6));
    c.restore();
  }
  c.restore();
}

/* ───────────────────────── Stroke-plotted reveal ───────────────────────── */

export interface StrokePlotOpts {
  /** Time mode: written over [start, start + duration] seconds. */
  start?: number;
  duration?: number;
  /** Easing of the overall progress (time mode) or of each unit's progress (note mode). Default linear. */
  ease?: (u: number) => number;
  /**
   * Time mode only. Undefined: strokes are written one after another at constant pen speed (matches
   * `writtenLength`). 0..1: every stroke takes equal time; 0 = all at once, 1 = strictly one after another.
   */
  stagger?: number;
  /** Note mode: note i writes letter (or stroke) i, starting at noteTimes[i]. */
  noteTimes?: number[];
  unit?: 'letter' | 'stroke';
  /** Seconds a unit takes to write (default: just under the gap to the next note, 0.08..0.5 s). */
  noteDur?: number;
  /** Seconds for the pen glow to fall to 1/e after a note / after the last stroke (default 0.45). */
  glowDecay?: number;
}

export interface PenState { x: number; y: number; angle: number; stroke: number; char: number }

export interface StrokePlotState {
  /** Progress 0..1 of every stroke. */
  perStroke: Float32Array;
  /** Fraction of total path length written (0..1). */
  overall: number;
  pen: PenState | null;
  /** Pen glow 0..1: 1 at each note onset (or while writing in time mode), decaying exponentially. */
  glow: number;
  /** Whether a stroke is mid-draw at this instant. */
  writing: boolean;
}

const strokeLen = (st: StrokeText, i: number) => st.lens[i]![st.lens[i]!.length - 1] ?? 0;

/** Per-stroke progress for an overall 0..1 progress. See `StrokePlotOpts.stagger`. */
export function strokeProgress(st: StrokeText, overall: number, stagger?: number): Float32Array {
  const n = st.strokes.length;
  const out = new Float32Array(n);
  const u = clamp(overall);
  if (n === 0) return out;
  if (stagger === undefined) {
    const written = u * st.total;
    for (let i = 0; i < n; i++) {
      const L = strokeLen(st, i);
      out[i] = L <= 1e-9 ? (written >= st.startLen[i]! ? 1 : 0) : clamp((written - st.startLen[i]!) / L);
    }
  } else {
    const k = clamp(stagger);
    const dur = 1 / (1 + (n - 1) * k);
    const step = k * dur;
    for (let i = 0; i < n; i++) out[i] = clamp((u - i * step) / dur);
  }
  return out;
}

function penAt(st: StrokeText, perStroke: Float32Array): { pen: PenState | null; writing: boolean } {
  let last = -1;
  for (let i = 0; i < perStroke.length; i++) if (perStroke[i]! > 0) last = i;
  if (last < 0) return { pen: null, writing: false };
  let active = -1;
  for (let i = 0; i < perStroke.length; i++) if (perStroke[i]! > 0 && perStroke[i]! < 1) active = i;
  const i = active >= 0 ? active : last;
  const p = pointAtLength(st.strokes[i]!, st.lens[i]!, perStroke[i]! * strokeLen(st, i));
  return { pen: { x: p.x, y: p.y, angle: p.angle, stroke: i, char: st.charOf[i]! }, writing: active >= 0 };
}

/** Units for note mode: arrays of stroke indices (one per letter that has strokes, or one per stroke). */
function noteUnits(st: StrokeText, unit: 'letter' | 'stroke'): number[][] {
  if (unit === 'stroke') return st.strokes.map((_, i) => [i]);
  const byChar = new Map<number, number[]>();
  st.charOf.forEach((c, i) => { (byChar.get(c) ?? byChar.set(c, []).get(c)!).push(i); });
  return [...byChar.keys()].sort((a, b) => a - b).map((c) => byChar.get(c)!);
}

/** Stroke-plot state at time t in time mode (`start`/`duration`) or note mode (`noteTimes`). */
export function strokePlot(st: StrokeText, t: number, opts: StrokePlotOpts): StrokePlotState {
  const easeFn = opts.ease ?? ((u: number) => u);
  const decay = Math.max(1e-3, opts.glowDecay ?? 0.45);
  const n = st.strokes.length;
  let perStroke: Float32Array;
  let glow = 0;

  if (opts.noteTimes) {
    const T = opts.noteTimes;
    const units = noteUnits(st, opts.unit ?? 'letter');
    perStroke = new Float32Array(n);
    for (let k = 0; k < units.length && k < T.length; k++) {
      const gap = k + 1 < T.length ? T[k + 1]! - T[k]! : 0.6;
      const dur = Math.max(1e-3, opts.noteDur ?? clamp(gap * 0.9, 0.08, 0.5));
      const u = easeFn(clamp((t - T[k]!) / dur));
      const idx = units[k]!;
      let total = 0;
      for (const i of idx) total += strokeLen(st, i);
      let acc = 0;
      for (const i of idx) {
        const L = strokeLen(st, i);
        perStroke[i] = L <= 1e-9 ? (u > 0 ? 1 : 0) : clamp((u * total - acc) / L);
        acc += L;
      }
    }
    let lastNote = -1;
    for (let k = 0; k < T.length && k < units.length; k++) if (t >= T[k]!) lastNote = k;
    if (lastNote >= 0) glow = Math.exp(-(t - T[lastNote]!) / decay);
  } else {
    const start = opts.start ?? 0, dur = Math.max(1e-3, opts.duration ?? 1);
    const u = easeFn(clamp((t - start) / dur));
    perStroke = strokeProgress(st, u, opts.stagger);
    if (t > start) glow = t < start + dur ? 1 : Math.exp(-(t - start - dur) / decay);
  }

  let written = 0;
  for (let i = 0; i < n; i++) written += perStroke[i]! * strokeLen(st, i);
  const { pen, writing } = penAt(st, perStroke);
  return { perStroke, overall: st.total > 0 ? written / st.total : 0, pen: pen, glow: pen ? glow : 0, writing };
}

/** Draw each stroke up to its own progress (canvas must already be translated to the text origin). */
export function drawStrokePlot(c: CanvasRenderingContext2D, st: StrokeText, perStroke: ArrayLike<number>): void {
  c.beginPath();
  for (let i = 0; i < st.strokes.length; i++) {
    const p = perStroke[i] ?? 0;
    if (p <= 0) continue;
    const pts = st.strokes[i]!, L = st.lens[i]!;
    const remain = p * strokeLen(st, i);
    c.moveTo(pts[0]!.x, pts[0]!.y);
    let j = 1;
    for (; j < pts.length && L[j]! <= remain; j++) c.lineTo(pts[j]!.x, pts[j]!.y);
    if (j < pts.length) {
      const a = pts[j - 1]!, b = pts[j]!;
      const u = (remain - L[j - 1]!) / Math.max(1e-6, L[j]! - L[j - 1]!);
      c.lineTo(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u);
    }
  }
  c.stroke();
}

/** Soft radial glow at the pen tip (additive look via 'lighter'); no-op when glow is ~0. */
export function drawPenGlow(
  c: CanvasRenderingContext2D, pen: PenState | null, glow: number,
  o: { color?: [number, number, number]; radius?: number } = {},
): void {
  if (!pen || glow <= 0.004) return;
  const [r, g, b] = o.color ?? [255, 214, 160];
  const R = (o.radius ?? 28) * (0.5 + 0.5 * glow);
  const grad = c.createRadialGradient(pen.x, pen.y, 0, pen.x, pen.y, R);
  grad.addColorStop(0, `rgba(${r},${g},${b},${0.95 * glow})`);
  grad.addColorStop(0.25, `rgba(${r},${g},${b},${0.35 * glow})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = grad;
  c.beginPath();
  c.arc(pen.x, pen.y, R, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/* ─────────────────────────── Letter-level hooks ─────────────────────────── */

export interface Glyph2D {
  index: number;
  char: string;
  line: number;
  /** Pixel box (top-left origin, 1080p logical space): em-box of the glyph advance. */
  x: number; y: number; w: number; h: number; cx: number; cy: number;
}

/**
 * Per-character pixel boxes for a block of lines. `measure(s)` must return the advance width of `s` in the
 * font (and letter-spacing) the text is drawn with. `tracking` (px) is removed from each width so centres are
 * not pushed by the trailing letter-space.
 */
export function layoutGlyphs(
  lines: string[], measure: (s: string) => number,
  o: { x: number; y: number; fontPx: number; lineHeight: number; align: 'left' | 'center' | 'right'; tracking?: number },
): Glyph2D[] {
  const out: Glyph2D[] = [];
  const track = o.tracking ?? 0;
  let index = 0;
  lines.forEach((line, li) => {
    const chars = Array.from(line);
    const total = measure(line) - track;
    const left = o.align === 'center' ? o.x - total / 2 : o.align === 'right' ? o.x - total : o.x;
    const top = o.y + li * o.fontPx * o.lineHeight;
    let prefix = '';
    let prev = 0;
    for (const ch of chars) {
      prefix += ch;
      const cur = measure(prefix);
      const w = Math.max(0, cur - prev - track);
      out.push({ index: index++, char: ch, line: li, x: left + prev, y: top, w, h: o.fontPx, cx: left + prev + w / 2, cy: top + o.fontPx * 0.5 });
      prev = cur;
    }
  });
  return out;
}

export interface GlyphObstacle { c: V3; r: number }

/**
 * Push `p` around spherical obstacles with the smooth radial map r' = (r^3 + R^3)^(1/3): points on the centre
 * move to the surface, far points barely move, and the map is continuous and monotonic (no flips), so
 * streamlines bend around each letter.
 */
export function deflectPoint(p: V3, obstacles: GlyphObstacle[], strength = 1): V3 {
  let x = p[0], y = p[1], z = p[2];
  for (const o of obstacles) {
    const dx = x - o.c[0], dy = y - o.c[1], dz = z - o.c[2];
    const d = Math.hypot(dx, dy, dz);
    const nd = Math.cbrt(d * d * d + o.r * o.r * o.r);
    const k = d > 1e-9 ? ((nd - d) * strength) / d : 0;
    if (d > 1e-9) { x += dx * k; y += dy * k; z += dz * k; }
    else y += o.r * strength;
  }
  return [x, y, z];
}

/**
 * Push `p` around a single spherical glyph obstacle.
 */
export function deflectPointFromGlyph(p: V3, glyph: GlyphObstacle | { c: V3; r: number }, strength = 1): V3 {
  return deflectPoint(p, [glyph], strength);
}

export type { ExtrudedTextLayout, GlyphWorldBounds } from './text_lighting';


/* ───────────────────────────── Reveal timing ───────────────────────────── */

export type RevealMotion = 'fade' | 'slide-up' | 'scale-pop' | 'cut';

export interface RevealOpts {
  unit: 'char' | 'word';
  start: number;
  /** Total spread of start times across units, or fixed `interval` seconds between units (wins if set). */
  stagger?: number;
  interval?: number;
  inDuration: number;
  motion?: RevealMotion;
  ease?: (u: number) => number;
}

/** Eased 0..1 reveal progress of unit i of n at time t. */
export function revealProgress(t: number, o: RevealOpts, i: number, n: number): number {
  const delay = o.interval !== undefined ? i * o.interval : n > 1 ? (i / (n - 1)) * (o.stagger ?? 0) : 0;
  const u = clamp((t - o.start - delay) / Math.max(1e-4, o.inDuration));
  return o.motion === 'cut' ? (u > 0 ? 1 : 0) : (o.ease ?? ease.outCubic)(u);
}

export type { V2, V3 };
