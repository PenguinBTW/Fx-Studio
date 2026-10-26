// Out-of-order determinism spot-check: still at T, still at an unrelated time, still at T again; hashes of the two T stills must match.
// Usage: bun scripts/check_scrub_determinism.ts [--project story_room] [--t 9] [--other 2.37]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const argv = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const project = opt('project', 'story_room');
const t = parseFloat(opt('t', '9'));
const other = parseFloat(opt('other', '2.37'));
const ROOT = path.resolve(import.meta.dir, '../..');
const outBase = path.join(ROOT, 'out', 'determinism');
fs.rmSync(outBase, { recursive: true, force: true });

function still(tag: string, time: number): string {
  const out = path.join(outBase, tag);
  const r = Bun.spawnSync(['bun', 'scripts/render.ts', 'stills', '--project', project, '--t', String(time), '--out', out], { cwd: path.resolve(import.meta.dir, '..') });
  const files = fs.existsSync(out) ? fs.readdirSync(out).filter(f => f.endsWith('.png')) : [];
  if (!files.length) { console.error(r.stderr.toString().slice(-2000)); throw new Error(`no still written for ${tag}`); }
  return path.join(out, files[0]);
}
const hash = (f: string) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const a = still('a_t', t);
const b = still('b_other', other);
const c = still('c_t_again', t);
const [ha, hb, hc] = [a, b, c].map(hash);
console.log(`t=${t}        ${ha}\nt=${other} ${hb}\nt=${t} again ${hc}`);
if (ha === hb) { console.error('[scrub] FAIL: unrelated times produced identical frames (test is meaningless)'); process.exit(1); }
if (ha !== hc) { console.error('[scrub] FAIL: frame at same t differs after rendering another t'); process.exit(1); }
console.log('[scrub] PASS: out-of-order render is byte-identical');
