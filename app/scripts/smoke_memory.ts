#!/usr/bin/env bun
// P14 memory telemetry: renders sampled frames across a whole project in ONE browser session (the sweep is repeated --passes times; only the last pass is fitted, earlier passes are warm-up that creates every scene's lazy GL resources) and reports
// JS heap + GL object counts (window.__fxStats, ?export=1) after each, then fits a trend over the post-warm-up samples.
//   --run FROM,N skips the sweep and renders N contiguous frames from FROM seconds (sequential dt, as the video path does), stats every 30 frames.
//   bun scripts/smoke_memory.ts [--project smoke10] [--step 2] [--burst 20] [--passes 2] [--out ../out/smoke_memory.json]
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] ? argv[i + 1]! : d; };
const APP = path.resolve(import.meta.dir, '..');
const project = opt('project', 'smoke10');
const step = +opt('step', '2');
const burst = +opt('burst', '20');
const passes = +opt('passes', '2');
const outFile = path.resolve(APP, opt('out', '../out/smoke_memory.json'));

const reachable = async (u: string) => { try { return (await fetch(u, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } };
let url = opt('url', 'http://localhost:5173');
let proc: ReturnType<typeof Bun.spawn> | null = null;
if (!(await reachable(url))) {
  const port = 5300 + Math.floor(Math.random() * 500);
  proc = Bun.spawn([process.execPath, 'x', 'vite', '--port', String(port), '--strictPort'], { cwd: APP, stdout: 'ignore', stderr: 'ignore', env: { ...process.env, MOTION_NO_HMR: '1', PDOOM_NO_HMR: '1' } });
  url = `http://localhost:${port}`;
  for (let i = 0; i < 100 && !(await reachable(url)); i++) await Bun.sleep(100);
}

const args = ['--use-angle=vulkan', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-precise-memory-info', '--js-flags=--expose-gc'];
let browser;
try { browser = await chromium.launch({ headless: true, channel: 'chrome', args }); } catch { browser = await chromium.launch({ headless: true, args }); }
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const logs: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  await page.goto(`${url}/?export=1&project=${project}`);
  await page.waitForFunction(() => (window as any).__motion?.ready || (window as any).__motion?.error, null, { timeout: 120000 });

  const info = await page.evaluate(() => {
    const m = (window as any).__motion;
    return { duration: m.duration as number, transitions: (m.engine.transitions as any[]).map((t) => ({ id: t.id, start: t.start, end: t.end })) };
  });
  const runArg = opt('run', '');
  if (runArg) {
    const [from, n] = runArg.split(',').map(Number) as [number, number];
    const res = await page.evaluate(async ([from, n]) => {
      const m = (window as any).__motion, st = (window as any).__fxStats, e = m.engine;
      const dt = 1 / 60, n0 = Math.round(from * 60), buf = new Uint8Array(m.width * m.height * 4);
      if (n0 > 0) e.render((n0 - 1) * dt, dt, false, 1, 0.5);
      const rows: any[] = [], ms: number[] = [];
      for (let i = 0; i < n; i++) {
        const a = performance.now();
        e.render((n0 + i) * dt, dt, false, 1, 0.5);
        await e.readPixelsAsync(buf);
        ms.push(performance.now() - a);
        if (i % 30 === 0) { (window as any).gc?.(); rows.push({ i, t: (n0 + i) * dt, ...st(), msAvg30: ms.slice(-30).reduce((x, y) => x + y, 0) / Math.min(30, ms.length) }); }
      }
      return { rows, avgMs: ms.reduce((x, y) => x + y, 0) / ms.length };
    }, [from, n] as const);
    console.log(JSON.stringify({ avgMs: res.avgMs, heapMB: res.rows.map((r: any) => +r.heapMB.toFixed(1)), fb: res.rows.map((r: any) => r.gl.framebuffers), tex: res.rows.map((r: any) => r.gl.textures), progs: res.rows.map((r: any) => r.programs), ms30: res.rows.map((r: any) => +r.msAvg30.toFixed(1)) }));
    writeFileSync(outFile.replace(/\.json$/, '_run.json'), JSON.stringify(res, null, 1));
    if (logs.length) console.error('BROWSER ERRORS:\n' + logs.slice(0, 20).join('\n'));
    await browser.close();
    try { proc?.kill(); } catch {}
    process.exit(0);
  }

  const times: { t: number; kind: string }[] = [];
  for (let t = 0; t <= info.duration - 1e-6; t += step) times.push({ t, kind: 'step' });
  for (const tr of info.transitions) {
    const mid = (tr.start + tr.end) / 2;
    for (const s of [tr.start + 0.05, mid]) for (let i = 0; i < burst; i++) times.push({ t: s + i / 60, kind: `burst:${tr.id}` });
  }
  times.sort((a, b) => a.t - b.t);
  const sweep = times.length;
  for (let p = 1; p < passes; p++) times.push(...times.slice(0, sweep));
  const warm = sweep * (passes > 1 ? passes - 1 : 0) || 10;

  const rows: any[] = [];
  const CHUNK = 40;
  for (let i = 0; i < times.length; i += CHUNK) {
    const part = times.slice(i, i + CHUNK);
    const res = await page.evaluate(async (ts) => {
      const m = (window as any).__motion, st = (window as any).__fxStats;
      const out: any[] = [];
      for (const x of ts) {
        const a = performance.now();
        m.still(x.t, 1, 0.5);
        await m.engine.readPixelsAsync();
        const ms = performance.now() - a;
        (window as any).gc?.();
        out.push({ t: x.t, kind: x.kind, ms, ...st() });
      }
      return out;
    }, part);
    rows.push(...res);
    process.stdout.write(`\r${rows.length}/${times.length}`);
  }
  console.log();

  const slope = (xs: number[], ys: number[]) => {
    const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i]! - mx) * (ys[i]! - my); den += (xs[i]! - mx) ** 2; }
    return den ? num / den : 0;
  };
  const post = rows.slice(warm);
  const xs = post.map((_, i) => i);
  const metrics: Record<string, (r: any) => number> = {
    heapMB: (r) => r.heapMB, geometries: (r) => r.geometries, textures: (r) => r.textures, programs: (r) => r.programs,
    glFramebuffers: (r) => r.gl.framebuffers, glTextures: (r) => r.gl.textures, glBuffers: (r) => r.gl.buffers, glRenderbuffers: (r) => r.gl.renderbuffers,
  };
  const summary: Record<string, any> = {};
  for (const [k, f] of Object.entries(metrics)) {
    const ys = post.map(f);
    summary[k] = { first: f(rows[0]), warm: f(rows[warm]!), last: ys[ys.length - 1], min: Math.min(...ys), max: Math.max(...ys), slopePer100: slope(xs, ys) * 100 };
  }
  const calm = rows.filter((r) => r.kind === 'step').map((r) => r.ms), burstMs = rows.filter((r) => r.kind.startsWith('burst')).map((r) => r.ms);
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  summary.msPerFrame = { step: avg(calm), burst: avg(burstMs) };
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify({ project, summary, rows }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  console.log(`samples ${rows.length}, wrote ${outFile}`);
  if (logs.length) console.error('BROWSER ERRORS:\n' + logs.slice(0, 20).join('\n'));
} finally {
  await browser.close();
  try { proc?.kill(); } catch {}
}
