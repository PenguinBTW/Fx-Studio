// agent_v2 music sync: every seam's midpoint must land within one frame (60 fps) of a bar line of the song's bar grid (kit.bar, incl. the downbeat offset).
import { readFileSync } from 'fs';
import { join } from 'path';
import { BAR, bar } from '../src/scenes/agent_promo/kit';

const root = join(import.meta.dir, '..', 'src');
const proj = JSON.parse(readFileSync(join(root, 'scenes/agent_v2/project.json'), 'utf8')) as { transitions: { transition: string; at: number }[] };
let bad = 0;
for (const t of proj.transitions) {
  const src = readFileSync(join(root, 'transitions', `${t.transition}.ts`), 'utf8');
  const dur = Number(/dur:\s*([\d.]+)/.exec(src)?.[1] ?? NaN);
  const mid = t.at + dur / 2, n = Math.round((mid - bar(0)) / BAR), err = mid - bar(n);
  const ok = Number.isFinite(dur) && Math.abs(err) <= 1 / 60 + 0.005;
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${t.transition.padEnd(16)} mid=${mid.toFixed(3)}s bar=${n} err=${(err * 1000).toFixed(1)}ms`);
}
if (bad) { console.error(`${bad} seam(s) off the bar grid`); process.exit(1); }
console.log(`all ${proj.transitions.length} agent_v2 seams on the bar grid`);
