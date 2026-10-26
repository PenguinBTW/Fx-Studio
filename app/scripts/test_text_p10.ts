import * as THREE from 'three';
import { odometer, strokePlot, strokeProgress, layoutGlyphs, deflectPoint, revealProgress } from '../src/engine/textfx';
import { ExtrudedText } from '../src/engine/text3d';
import { polylineLengths, ease, type V2 } from '../src/engine/util';
import type { StrokeText } from '../src/engine/stroke';

let fails = 0;
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
  if (!ok) fails++;
};
const lin = (e = 0) => ease.linear(e);

// 1. odometer: static values read correctly
{
  const cases: [number, object, string][] = [
    [0, {}, '0'], [7, {}, '7'], [1234567, {}, '1,234,567'], [8760000000, {}, '8,760,000,000'],
    [-1234.5, { decimals: 1 }, '-1,234.5'], [3.14159, { decimals: 2 }, '3.14'], [1000, { separator: '' }, '1000'],
    [42, { minDigits: 6, leadingZeros: true }, '000,042'],
  ];
  for (const [v, o, want] of cases) {
    const st = odometer(v, o);
    check(`odometer(${v}) text`, st.text === want, `got '${st.text}' want '${want}'`);
  }
}

// 2. carry: 999 -> 1000 rolls every digit together
{
  const mid = odometer(999.5, { rollEase: lin });
  const digits = mid.cells.filter((c) => c.kind === 'digit');
  check('999.5: every digit rolls, plus the new thousands place 0 -> 1', digits.length === 4 && digits[0]!.from === 0 && digits.every((c) => Math.abs(c.frac - 0.5) < 1e-9) && digits.slice(1).every((c) => c.from === 9), JSON.stringify(digits.map((c) => [c.from, c.frac])));
  const q = odometer(999.25, { rollEase: lin, minDigits: 4 });
  const th = q.cells.find((c) => c.kind === 'digit' && c.place === 3)!;
  check('new thousands place fades in during carry', th.alpha > 0 && th.alpha < 1, `alpha=${th.alpha}`);
  const before = odometer(998.5, { rollEase: lin, minDigits: 4 });
  const tens = before.cells.find((c) => c.kind === 'digit' && c.place === 1)!;
  const units = before.cells.find((c) => c.kind === 'digit' && c.place === 0)!;
  check('998.5: only the units digit rolls', tens.frac === 0 && Math.abs(units.frac - 0.5) < 1e-9);
  const after = odometer(1000, { minDigits: 4 });
  check('1000 settled', after.text === '1,000' && after.cells.every((c) => c.kind !== 'digit' || c.frac === 0));
  const c19 = odometer(19.5, { rollEase: lin });
  const tens19 = c19.cells.find((c) => c.place === 1)!;
  check('19.5: tens and units both roll (carry)', Math.abs(tens19.frac - 0.5) < 1e-9 && tens19.from === 1);
  const neg = odometer(-9.5, { rollEase: lin });
  check('negative rolls by magnitude', neg.cells[0]!.kind === 'sign' && neg.cells.find((c) => c.kind === 'digit' && c.place === 0)!.from === 9);
  const dec = odometer(0.95, { decimals: 1, rollEase: lin });
  const tenth = dec.cells.find((c) => c.place === -1)!;
  check('decimals carry into units', Math.abs(tenth.frac - 0.5) < 1e-9 && tenth.from === 9);
}

// 3. value sweep: continuous, width monotone with places, tabular cells, determinism
{
  const sample = (t: number) => odometer(8_760_000_000 * ease.inOutCubic(Math.min(1, t / 4)), {});
  const a = JSON.stringify([0, 0.7, 1.9, 2, 3.3, 4].map(sample));
  const b = JSON.stringify([0, 0.7, 1.9, 2, 3.3, 4].map(sample));
  check('deterministic', a === b);
  check('final value', sample(4).text === '8,760,000,000');
  let maxStep = 0;
  let prev: number[] = [];
  for (let i = 0; i <= 400; i++) {
    const s = odometer(99_990 + (i / 400) * 20, { rollEase: lin });
    const pos = s.cells.filter((c) => c.kind === 'digit').map((c) => c.pos % 10);
    if (i > 0 && pos.length === prev.length) pos.forEach((p, k) => { const d = Math.abs(p - prev[k]!); maxStep = Math.max(maxStep, Math.min(d, 10 - d)); });
    prev = pos;
  }
  check('every digit strip moves continuously through 99,999 -> 100,000', maxStep <= 0.06, `maxStep=${maxStep.toFixed(3)}`);
  const widths = new Set([100, 500, 999].map((v) => odometer(v, { minDigits: 6, leadingZeros: true }).width.toFixed(6)));
  check('fixed width with minDigits', widths.size === 1);
  const w3 = odometer(123).cells.filter((c) => c.kind === 'digit').map((c) => c.w);
  check('tabular digit cells', new Set(w3).size === 1);
}

// 4. stroke reveal (synthetic font: 3 letters, 4 strokes)
function fakeStroke(): StrokeText {
  const mk = (pts: [number, number][]) => pts.map(([x, y]) => ({ x, y } as V2));
  const strokes = [mk([[0, 0], [100, 0]]), mk([[120, 0], [120, 50], [160, 50]]), mk([[200, 0], [300, 0]]), mk([[250, 0], [250, 80]])];
  const charOf = [0, 1, 2, 2];
  const lens = strokes.map((p) => polylineLengths(p));
  const startLen: number[] = [];
  let acc = 0;
  for (const L of lens) { startLen.push(acc); acc += L[L.length - 1]!; }
  const charRange: [number, number][] = [[0, 100], [100, 190], [190, acc]];
  return { strokes, charOf, startLen, lens, total: acc, width: 300, charRange, size: 100, capHeight: 70 };
}
{
  const st = fakeStroke();
  for (const stag of [undefined, 0, 0.5, 1]) {
    let mono = true, prev = -1, penOk = true;
    for (let i = 0; i <= 200; i++) {
      const s = strokePlot(st, i / 200 * 2, { start: 0.2, duration: 1.5, stagger: stag, ease: ease.inOutCubic });
      if (s.overall < prev - 1e-9) mono = false;
      prev = s.overall;
      if (i > 0 && i < 200 && s.pen === null && s.overall > 0) penOk = false;
      for (const p of s.perStroke) if (p < 0 || p > 1) mono = false;
    }
    check(`stroke progress monotonic, stagger=${stag}`, mono && penOk && prev > 0.999);
  }
  const e = strokeProgress(st, 0.5);
  check('sequential progress covers half the length', Math.abs(e.reduce((a, p, i) => a + p * (st.lens[i]!.at(-1)!), 0) - st.total / 2) < 1e-3);
  const half = strokeProgress(st, 0.5, 1);
  check('stagger=1: strokes strictly one after another', half[0] === 1 && half[1] === 1 && half[2] === 0 && half[3] === 0);
  const all = strokeProgress(st, 0.5, 0);
  check('stagger=0: all strokes together', all.every((p) => Math.abs(p - 0.5) < 1e-9));

  const notes = [1.0, 1.5, 2.2];
  const before = strokePlot(st, 0.9, { noteTimes: notes });
  check('note mode: nothing before first note', before.pen === null && before.overall === 0 && before.glow === 0);
  const at = strokePlot(st, 1.5, { noteTimes: notes });
  check('note i writes letter i: letter 0 done, glow=1, letter 1 starting', at.perStroke[0] === 1 && at.perStroke[1] === 0 && Math.abs(at.glow - 1) < 1e-9);
  const mid = strokePlot(st, 1.5 + 0.2, { noteTimes: notes });
  check('note mode: letter 1 mid-draw, pen on stroke 1', mid.writing && mid.pen!.stroke === 1 && mid.perStroke[2] === 0);
  const l2 = strokePlot(st, 2.2 + 0.1, { noteTimes: notes, noteDur: 0.4 });
  check('letter with two strokes writes both in sequence', l2.perStroke[2]! > 0 && l2.perStroke[2]! < 1 && l2.perStroke[3] === 0);
  const end = strokePlot(st, 5, { noteTimes: notes });
  check('note mode completes and glow decays', end.overall > 0.999 && end.glow < 0.05, `glow=${end.glow}`);
  const g1 = strokePlot(st, 1.6, { noteTimes: notes }).glow, g2 = strokePlot(st, 1.7, { noteTimes: notes }).glow;
  check('glow decays monotonically between notes', g2 < g1);
  const st2 = strokePlot(st, 1.7, { noteTimes: notes, unit: 'stroke' });
  check('stroke unit mapping: note 1 writes stroke 1', st2.perStroke[1]! > 0);
  check('strokePlot deterministic', JSON.stringify(strokePlot(st, 1.7, { noteTimes: notes })) === JSON.stringify(strokePlot(st, 1.7, { noteTimes: notes })));
}

// 5. letter hooks
{
  const g = layoutGlyphs(['AB', 'C'], (s) => s.length * 20 + 3 * s.length, { x: 100, y: 50, fontPx: 20, lineHeight: 1.5, align: 'left', tracking: 3 });
  check('2D glyph count and positions', g.length === 3 && g[0]!.x === 100 && g[1]!.x === 123 && g[2]!.y === 80 && g[0]!.w === 20, JSON.stringify(g[1]));
  const gc = layoutGlyphs(['AB'], (s) => s.length * 23, { x: 500, y: 0, fontPx: 20, lineHeight: 1, align: 'center', tracking: 3 });
  check('centered line is symmetric about x', Math.abs((gc[0]!.cx + gc[1]!.cx) / 2 - 500) < 1e-9);

  const grp = ExtrudedText.create('IT DOES', { size: 1, letterSpacing: 0.1 });
  const cam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
  cam.position.set(0, 0, 8);
  cam.updateMatrixWorld(true);
  const gl = ExtrudedText.glyphs(grp, cam);
  check('extruded glyph count (spaces skipped)', gl.length === 6 && gl.map((x) => x.char).join('') === 'ITDOES');
  check('word index', gl[0]!.word === 0 && gl[2]!.word === 1);
  check('glyph x increasing, screen projected', gl.every((x, i) => i === 0 || x.center[0] > gl[i - 1]!.center[0]) && gl.every((x) => x.screen && x.screen[0] > 0 && x.screen[0] < 1920));
  grp.position.set(2, 1, -3);
  const moved = ExtrudedText.glyphs(grp);
  check('group transform applied to world centres', Math.abs(moved[0]!.center[0] - gl[0]!.center[0] - 2) < 1e-6);
  check('tracking: extra spacing widens layout', (() => {
    const wide = ExtrudedText.glyphs(ExtrudedText.create('ITDOES', { size: 1, letterSpacing: 0.1 }));
    const base = ExtrudedText.glyphs(ExtrudedText.create('ITDOES', { size: 1, letterSpacing: 0 }));
    const pitch = (a: typeof wide) => (a[5]!.center[0] - a[0]!.center[0]) / 5;
    return Math.abs(pitch(wide) - pitch(base) - 0.1) < 1e-6;
  })(), '+0.1em pitch');

  const obs = [{ c: [0, 0, 0] as [number, number, number], r: 1 }];
  const p = deflectPoint([0, 0.2, 0], obs);
  check('deflection pushes interior points to/beyond the surface', Math.hypot(...p) >= 1 - 1e-9);
  const far = deflectPoint([10, 0, 0], obs);
  check('deflection is tiny far away', Math.abs(far[0] - 10) < 0.05);
  let mono = true, prevR = 0;
  for (let r = 0.01; r < 5; r += 0.01) { const q = deflectPoint([r, 0, 0], obs)[0]; if (q < prevR) mono = false; prevR = q; }
  check('deflection radial map is monotonic (no flips)', mono);
}

// 6. word-by-word reveal on extruded type
{
  const grp = ExtrudedText.create('YOU WERE ITS', { size: 1, letterSpacing: 0.1 });
  const o = { unit: 'word' as const, start: 1, interval: 1, inDuration: 0.5, motion: 'fade' as const };
  const vis = (t: number) => { ExtrudedText.reveal(grp, t, o); return (grp.children as THREE.Mesh[]).filter((m) => m.visible).map((m) => m.userData.glyph.word); };
  check('word reveal: none before start', vis(0.5).length === 0);
  check('word reveal: first word only', new Set(vis(1.2)).size === 1 && vis(1.2)[0] === 0);
  check('word reveal: two words at t=2.2', new Set(vis(2.2)).size === 2);
  check('word reveal: all words at t=9', new Set(vis(9)).size === 3);
  const a = vis(2.2).join(), b = (vis(9), vis(2.2).join());
  check('word reveal is scrub-safe (pure in t)', a === b);
  check('revealProgress eases 0..1', revealProgress(1.25, o, 0, 3) > 0 && revealProgress(9, o, 0, 3) === 1);
}

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
console.log('\nall text P10 checks passed');
