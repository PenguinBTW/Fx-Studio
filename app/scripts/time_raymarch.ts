#!/usr/bin/env bun
// P4 timing: ms/frame at 1080p for raymarch demo shots A/B/C at quality tiers 0/1/2, through the same
// export path as `render.ts perf` (engine.render + async readback, samples 1, shutter 0).
import { chromium } from 'playwright-core';
import path from 'node:path';

const APP = path.resolve(import.meta.dir, '..');
const reachable = async (u: string) => { try { return (await fetch(u, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } };
const port = 6050 + (process.pid % 100);
const proc = Bun.spawn([process.execPath, 'x', 'vite', '--port', String(port), '--strictPort'], { cwd: APP, stdout: 'ignore', stderr: 'ignore', env: { ...process.env, MOTION_NO_HMR: '1', PDOOM_NO_HMR: '1' } });
const url = `http://localhost:${port}`;
for (let i = 0; i < 150 && !(await reachable(url)); i++) await Bun.sleep(100);
const launchOpts = { headless: true, args: ['--use-angle=vulkan', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--disable-background-timer-throttling'] };
let browser;
try { browser = await chromium.launch({ ...launchOpts, channel: 'chrome' }); } catch { browser = await chromium.launch(launchOpts); }
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(`${url}/?export=1&project=raymarch`);
  await page.waitForFunction(() => (window as any).__motion?.ready || (window as any).__motion?.error, null, { timeout: 120000 });
  const shots: [string, number][] = [['A blobby metal', 1.0], ['B clouds', 6.0], ['C plasma', 12.0]];
  console.log('1080p, ms/frame incl. readback (avg / p95). Target: tier 0 about 33 ms.');
  for (const [name, t0] of shots) {
    const row: string[] = [];
    for (const q of [0, 1, 2]) {
      const r = await page.evaluate(async ({ t0, q }) => {
        const g = globalThis as any;
        g.__rmQuality = q;
        const P = g.__motion;
        const buf = new Uint8Array(P.width * P.height * 4);
        P.still(t0);
        const ms: number[] = [];
        for (let i = 0; i < 24; i++) {
          const a = performance.now();
          P.engine.render(t0 + i / 60, 1 / 60, false, 1, 0);
          await P.engine.readPixelsAsync(buf);
          ms.push(performance.now() - a);
        }
        ms.splice(0, 4);
        ms.sort((a, b) => a - b);
        return { avg: ms.reduce((a, b) => a + b, 0) / ms.length, p95: ms[Math.floor(ms.length * 0.95)] };
      }, { t0, q });
      row.push(`tier ${q}: ${r.avg.toFixed(1)} / ${r.p95.toFixed(1)} ms (${(1000 / r.avg).toFixed(0)} fps)`);
    }
    console.log(`${name.padEnd(16)} ${row.join('   ')}`);
  }
} finally {
  await browser.close();
  try { proc.kill(); } catch {}
}
process.exit(0);
