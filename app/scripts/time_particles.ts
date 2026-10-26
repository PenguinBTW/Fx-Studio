#!/usr/bin/env bun
// ms/frame at 1080p for LargeParticles (Core shot A of _prereq_demos/particles), same page path as
// `render.ts perf` (engine.render + readPixelsAsync). Run: bun scripts/time_particles.ts [--frames 60]
import { chromium } from 'playwright-core';
import path from 'node:path';

const APP = path.resolve(import.meta.dir, '..');
const fi = process.argv.indexOf('--frames');
const FRAMES = fi >= 0 ? Number(process.argv[fi + 1]) : 60;
const COUNTS = [0, 50000, 100000, 250000, 500000];
const TRAILS = [0, 8, 16];

const reachable = async (u: string) => { try { return (await fetch(u, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } };
const port = 5950 + (process.pid % 40);
const proc = Bun.spawn([process.execPath, 'x', 'vite', '--port', String(port), '--strictPort'], { cwd: APP, stdout: 'ignore', stderr: 'ignore', env: { ...process.env, MOTION_NO_HMR: '1', PDOOM_NO_HMR: '1' } });
const url = `http://localhost:${port}`;
for (let i = 0; i < 150 && !(await reachable(url)); i++) await Bun.sleep(100);
const launchOpts = { headless: true, args: ['--use-angle=vulkan', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--disable-background-timer-throttling'] };
let browser;
try { browser = await chromium.launch({ ...launchOpts, channel: 'chrome' }); } catch { browser = await chromium.launch(launchOpts); }
try {
  console.log(`LargeParticles Core shot, 1920x1080, ${FRAMES} frames each (avg ms incl. GPU sync + readback); count 0 = empty-scene baseline`);
  console.log('count\ttrail=0\ttrail=8\ttrail=16');
  for (const n of COUNTS) {
    const row: string[] = [];
    for (const tr of TRAILS) {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
      await page.goto(`${url}/?export=1&project=particles&count=${Math.max(n, 1)}&trail=${tr}`);
      await page.waitForFunction(() => (window as any).__motion?.ready || (window as any).__pdoom?.ready || (window as any).__motion?.error || (window as any).__pdoom?.error, null, { timeout: 120000 });
      const r = await page.evaluate(async (frames: number) => {
        const P = (window as any).__motion || (window as any).__pdoom;
        const buf = new Uint8Array(P.width * P.height * 4);
        P.still(1);
        const ms: number[] = [];
        for (let i = 0; i < frames + 5; i++) {
          const a = performance.now();
          P.engine.render(0.5 + i / 60, 1 / 60, false, 1, 0.5);
          await P.engine.readPixelsAsync(buf);
          if (i >= 5) ms.push(performance.now() - a);
        }
        ms.sort((x, y) => x - y);
        return { avg: ms.reduce((x, y) => x + y, 0) / ms.length, p95: ms[Math.floor(ms.length * 0.95)]! };
      }, FRAMES);
      row.push(`${r.avg.toFixed(1)} (p95 ${r.p95.toFixed(1)})`);
      await page.close();
    }
    console.log(`${n}\t${row.join('\t')}`);
  }
} finally {
  await browser.close();
  try { proc.kill(); } catch {}
}
