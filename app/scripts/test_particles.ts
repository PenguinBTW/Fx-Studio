#!/usr/bin/env bun
// Acceptance test for LargeParticles. Run: bun scripts/test_particles.ts
// 1. Scrub determinism: frames at t=2.5 (Core), 7.5 (spiral), 12.5 (rain), 17.5 (stars) are rendered in order,
//    then in reverse with other frames in between, then once more; every pair of PNG hashes must match.
// 2. Old AnalyticalParticles baselines: story_room and music_video stills re-rendered (render.ts stills) and compared with
//    out/baseline (byte-for-byte PNG via render.ts stills.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';

const APP = path.resolve(import.meta.dir, '..');
const ROOT = path.resolve(APP, '..');
let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
};
const sha = (b64: string) => createHash('sha1').update(b64).digest('hex').slice(0, 12);

const reachable = async (u: string) => { try { return (await fetch(u, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } };
const port = 6100 + (process.pid % 150);
const proc = Bun.spawn([process.execPath, 'x', 'vite', '--port', String(port), '--strictPort'], { cwd: APP, stdout: 'ignore', stderr: 'ignore', env: { ...process.env, MOTION_NO_HMR: '1', PDOOM_NO_HMR: '1' } });
const url = `http://localhost:${port}`;
for (let i = 0; i < 150 && !(await reachable(url)); i++) await Bun.sleep(100);
const launchOpts = { headless: true, args: ['--use-angle=vulkan', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--disable-background-timer-throttling'] };
let browser;
try { browser = await chromium.launch({ ...launchOpts, channel: 'chrome' }); } catch { browser = await chromium.launch(launchOpts); }

async function open(project: string) {
  const page = await browser!.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`${url}/?export=1&project=${project}`);
  await page.waitForFunction(() => (window as any).__motion?.ready || (window as any).__pdoom?.ready || (window as any).__motion?.error || (window as any).__pdoom?.error, null, { timeout: 120000 });
  return page;
}
const still = (page: any, t: number, samples = 1): Promise<string> =>
  page.evaluate(async ([t, s]: number[]) => {
    const P = (window as any).__motion || (window as any).__pdoom;
    await P.still(t, s, 0.5);
    return P.png() as string;
  }, [t, samples]);

try {
  const page = await open('particles');
  const T = [2.5, 7.5, 12.5, 17.5];
  const first = new Map<number, string>();
  for (const t of T) first.set(t, sha(await still(page, t)));
  for (const t of [...T].reverse()) check(`scrub reverse t=${t}`, sha(await still(page, t)) === first.get(t), first.get(t));
  await still(page, 1.1); await still(page, 9.9);
  for (const t of [T[2]!, T[0]!, T[3]!, T[1]!]) check(`scrub shuffled t=${t}`, sha(await still(page, t)) === first.get(t));
  const s4a = sha(await still(page, 2.5, 4)); await still(page, 14);
  check('scrub with 4 spp sub-frames t=2.5', sha(await still(page, 2.5, 4)) === s4a);
  await page.close();

  const cases: [string, number[]][] = [['story_room', [2, 9, 14]], ['music_video', [3, 20, 60]]];
  for (const [proj, ts] of cases) {
    const outDir = path.join(ROOT, 'out/prereq/particles_baseline', proj);
    const r = Bun.spawnSync([process.execPath, 'scripts/render.ts', 'stills', '--project', proj, '--t', ts.join(','), '--out', outDir], { cwd: APP, stdout: 'ignore', stderr: 'ignore' });
    for (const t of ts) {
      const name = `f_${t.toFixed(2).padStart(7, '0')}.png`;
      const ref = path.join(ROOT, 'out/baseline', proj, name), cur = path.join(outDir, name);
      if (r.exitCode !== 0 || !existsSync(ref) || !existsSync(cur)) { check(`baseline ${proj} t=${t}`, false, 'render failed or baseline missing'); continue; }
      const same = Buffer.from(await Bun.file(ref).arrayBuffer()).equals(Buffer.from(await Bun.file(cur).arrayBuffer()));
      check(`baseline ${proj} t=${t} byte-identical`, same);
    }
  }} finally {
  await browser.close();
  try { proc.kill(); } catch {}
}
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
