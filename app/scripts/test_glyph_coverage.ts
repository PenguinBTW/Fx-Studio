import * as THREE from 'three';
import { ExtrudedText } from '../src/engine/text3d';
import { getGlyph } from '../src/engine/vectorglyphs';
import { fnv, OLD_CHARS } from './_glyph_hash';

const EXPECT_OLD_HASH = '7fd169f9';
const FILM = ['170,000 YEARS', '8 MIN 20 S', 'IT DOES NOT BEND', '42\u00B0', 'YOU WERE ITS DESTINATION.'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?\'":;-_/%+=()&';
let fails = 0;
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
  if (!ok) fails++;
};

check('legacy 16 glyph hash unchanged', fnv(OLD_CHARS) === EXPECT_OLD_HASH, fnv(OLD_CHARS));

const warns: string[] = [];
const origWarn = console.warn;
console.warn = (...a: unknown[]) => { warns.push(a.join(' ')); };

const all = new Set([...ALPHABET, ...ALPHABET.toLowerCase(), ...FILM.join('')]);
all.delete(' ');
let bad = '';
for (const ch of all) {
  const g = getGlyph(ch);
  const geom = ExtrudedText.create(ch, { size: 1 }).children[0] as THREE.Mesh | undefined;
  const pos = geom?.geometry.attributes.position?.array;
  const ok = !!g && !g.placeholder && !!pos && pos.length > 0 && Array.from(pos).every(Number.isFinite);
  if (!ok) bad += ch;
}
check('every film/alphabet char has real finite geometry', bad === '', bad ? `bad: ${bad}` : `${all.size} chars`);
check('no placeholder warnings for covered chars', warns.length === 0, warns.join('|'));

let wOk = true, wInfo = '';
for (const ch of ALPHABET) {
  const g = getGlyph(ch)!;
  if (!(g.advance > 0.15 && g.advance < 1.3)) { wOk = false; wInfo += ch; }
}
check('advances in (0.15, 1.3) em', wOk, wInfo);
const A = (c: string) => getGlyph(c)!.advance;
check('I and 1 narrower than O; . narrowest; M, W wider than O', A('I') < A('O') && A('1') < A('O') && A('.') < A('I') && A('M') > A('O') && A('W') > A('O'),
  `I=${A('I').toFixed(2)} .=${A('.').toFixed(2)} O=${A('O').toFixed(2)} M=${A('M').toFixed(2)} W=${A('W').toFixed(2)}`);
check('lowercase maps to uppercase', getGlyph('a')!.advance === getGlyph('A')!.advance && getGlyph('a')!.shapes === getGlyph('A')!.shapes);

const width = (t: string, o: object) => { const g = ExtrudedText.create(t, o); return new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).x; };
const t0 = width('IT DOES NOT BEND', { size: 1, letterSpacing: 0 }), t1 = width('IT DOES NOT BEND', { size: 1, letterSpacing: 0.1 });
check('+0.1em tracking adds ~0.1*(glyphs-1)', Math.abs(t1 - t0 - 0.1 * 12) < 0.05, `${(t1 - t0).toFixed(3)} want 1.2`);
const fx = ExtrudedText.create('ITIT', { size: 1, letterSpacing: 0, fixedAdvance: true });
const xs = fx.children.map((c) => c.position.x - fx.children[0]!.position.x);
check('fixedAdvance restores 0.85 em pitch', Math.abs(xs[1]! - 0.85) < 1e-9 && Math.abs(xs[2]! - 1.7) < 1e-9, xs.join(','));

const ph = ExtrudedText.create('\u2603\u2603', { size: 1 });
check('unknown char -> placeholder mesh, single warning', ph.children.length === 2 && warns.length === 1 && /No glyph/.test(warns[0] ?? ''), `warns=${warns.length}`);
console.warn = origWarn;

const sentence = ExtrudedText.create('IT DOES NOT BEND', { size: 1, letterSpacing: 0.1 });
check('IT DOES NOT BEND renders 13 glyph meshes', sentence.children.length === 13, `${sentence.children.length}`);

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
