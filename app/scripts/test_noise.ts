#!/usr/bin/env bun
// P11 acceptance: TS mirror statistics, analytic derivatives vs finite differences, curl divergence,
// Voronoi invariants, IGN uniformity, then GPU-vs-CPU agreement through headless Chrome on
// scenes/_prereq_demos/noise (also writes out/prereq/noise_sheet.png). `--no-gpu` skips the browser part.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { createNoise, noiseSalts, ign, noiseJitter, type Vec3 } from '../src/engine/noise';
import { mulberry32 } from '../src/engine/util';

const APP = path.resolve(import.meta.dir, '..');
const ROOT = path.resolve(APP, '..');
let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
};
const e = (v: number) => v.toExponential(2);

const N = createNoise(0);
const rnd = mulberry32(12345);
const pt = (r = 20): Vec3 => [(rnd() * 2 - 1) * r, (rnd() * 2 - 1) * r, (rnd() * 2 - 1) * r];

// ---- statistics ----
{
  const M = 200000;
  let sum = 0, sq = 0, mn = Infinity, mx = -Infinity;
  for (let i = 0; i < M; i++) { const v = N.simplex(pt()); sum += v; sq += v * v; mn = Math.min(mn, v); mx = Math.max(mx, v); }
  const mean = sum / M, sd = Math.sqrt(sq / M - mean * mean);
  check('simplex mean ~ 0', Math.abs(mean) < 0.01, `mean=${mean.toFixed(4)} sd=${sd.toFixed(3)}`);
  check('simplex range within [-1.02, 1.02] and reaches > 0.8', mn >= -1.02 && mx <= 1.02 && mx > 0.8 && mn < -0.8, `min=${mn.toFixed(3)} max=${mx.toFixed(3)}`);
  let fsum = 0, fmn = Infinity, fmx = -Infinity;
  for (let i = 0; i < M / 4; i++) { const v = N.fbm(pt(), 6); fsum += v; fmn = Math.min(fmn, v); fmx = Math.max(fmx, v); }
  check('fbm mean ~ 0 and range within [-1.02, 1.02]', Math.abs(fsum / (M / 4)) < 0.01 && fmn >= -1.02 && fmx <= 1.02, `mean=${(fsum / (M / 4)).toFixed(4)} min=${fmn.toFixed(3)} max=${fmx.toFixed(3)}`);
  let maxStep = 0;
  for (let i = 0; i < 20000; i++) {
    const p = pt(); const d = 1e-3;
    maxStep = Math.max(maxStep, Math.abs(N.simplex([p[0] + d, p[1], p[2]]) - N.simplex(p)), Math.abs(N.simplex([p[0], p[1] + d, p[2]]) - N.simplex(p)), Math.abs(N.simplex([p[0], p[1], p[2] + d]) - N.simplex(p)));
  }
  check('simplex continuous (|dv| over 1e-3 step < 1e-2, Lipschitz ~6)', maxStep < 1e-2, `max=${e(maxStep)}`);
  const a = createNoise(7), b = createNoise(7), c = createNoise(8);
  const q = pt();
  check('seeded: same seed same field, different seed different', a.simplex(q) === b.simplex(q) && a.simplex(q) !== c.simplex(q) && noiseSalts(7).join() === noiseSalts(7).join());
  const hv = N.hashF3(1, 2, 3, 0);
  check('hash in [0,1) and stable', hv >= 0 && hv < 1 && hv === N.hashF3(1, 2, 3, 0) && N.hashF3(1, 2, 3, 1) !== hv && N.hashF3(-1, 2, 3, 0) !== N.hashF3(1, 2, 3, 0));
  const bins = new Array(16).fill(0); const HM = 160000;
  for (let i = 0; i < HM; i++) bins[Math.floor(N.hashF3(i % 400 - 200, Math.floor(i / 400) - 200, 0) * 16)]++;
  const chi = bins.reduce((s, o) => s + (o - HM / 16) ** 2 / (HM / 16), 0);
  check('hash uniform (chi2, 15 dof, < 37.7 = p 0.001)', chi < 37.7, `chi2=${chi.toFixed(1)}`);
}

// ---- derivatives vs finite differences ----
const H = 1e-5;
const fd = (f: (p: Vec3) => number, p: Vec3): Vec3 => [0, 1, 2].map((a) => { const u: Vec3 = [...p]; const d: Vec3 = [...p]; u[a]! += H; d[a]! -= H; return (f(u) - f(d)) / (2 * H); }) as Vec3;
const vmax = (a: number[]) => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
const sub = (a: number[], b: number[]) => a.map((x, i) => x - b[i]!);
{
  let wG = 0, wF = 0, wH = 0, scale = 0, hscale = 0, fscale = 0;
  for (let i = 0; i < 3000; i++) {
    const p = pt(15);
    const s = N.simplexGrad(p), f = N.fbmGrad(p, 5);
    wG = Math.max(wG, vmax(sub(s.grad, fd((q) => N.simplex(q), p))));
    wF = Math.max(wF, vmax(sub(f.grad, fd((q) => N.fbm(q, 5), p))));
    scale = Math.max(scale, vmax(s.grad)); fscale = Math.max(fscale, vmax(f.grad));
    const hs = N.simplexHess(p);
    const hfd = [0, 1, 2].map((a) => fd((q) => N.simplexGrad(q).grad[a]!, p)).flat();
    wH = Math.max(wH, vmax(sub(hs.hess, hfd)));
    hscale = Math.max(hscale, vmax(hs.hess));
  }
  check('snoiseGrad vs central differences (rel < 1e-5)', wG / scale < 1e-5, `worst=${e(wG)} |g|max=${scale.toFixed(2)}`);
  check('fbmGrad vs central differences (rel < 1e-5)', wF / fscale < 1e-5, `worst=${e(wF)}`);
  check('Hessian vs differences of gradient (rel < 1e-4)', wH / hscale < 1e-4, `worst=${e(wH)} |H|max=${hscale.toFixed(1)}`);
  const v = N.simplexGrad([0.3, 0.7, 1.1]);
  check('simplexGrad.value == simplex', v.value === N.simplex([0.3, 0.7, 1.1]));
}

// ---- curl ----
{
  let wDiv = 0, wJac = 0, wTr = 0, cmax = 0, jmax = 0, wCall = 0;
  for (let i = 0; i < 3000; i++) {
    const p = pt(15), t = rnd() * 10;
    const r = N.curlNoise3J(p, t);
    const dc = [0, 1, 2].map((a) => fd((q) => N.curlNoise3(q, t)[a]!, p));
    const div = dc[0]![0]! + dc[1]![1]! + dc[2]![2]!;
    wDiv = Math.max(wDiv, Math.abs(div));
    const jfd = [0, 1, 2].flatMap((i2) => dc[i2]!);
    wJac = Math.max(wJac, vmax(sub(r.jac, jfd)));
    wTr = Math.max(wTr, Math.abs(r.jac[0]! + r.jac[4]! + r.jac[8]!));
    cmax = Math.max(cmax, vmax(r.curl)); jmax = Math.max(jmax, vmax(r.jac));
    wCall = Math.max(wCall, vmax(sub(r.curl, N.curlNoise3(p, t))));
  }
  check('curl divergence ~ 0 by finite differences (|div| / |J|max < 1e-5)', wDiv / jmax < 1e-5, `worst|div|=${e(wDiv)} |J|max=${jmax.toFixed(1)} |curl|max=${cmax.toFixed(2)}`);
  check('curl Jacobian vs finite differences (rel < 1e-4)', wJac / jmax < 1e-4, `worst=${e(wJac)}`);
  check('curl Jacobian trace == 0 (analytic, < 1e-9)', wTr < 1e-9, `worst=${e(wTr)}`);
  check('curlNoise3 == curlNoise3J.curl', wCall === 0);
  let c2 = 0;
  for (let i = 0; i < 20000; i++) { const c = N.curlNoise3(pt(), rnd() * 5); c2 += c[0] * c[0] + c[1] * c[1] + c[2] * c[2]; }
  check('curl RMS magnitude reasonable (0.5..3)', Math.sqrt(c2 / 20000) > 0.5 && Math.sqrt(c2 / 20000) < 3, `rms=${Math.sqrt(c2 / 20000).toFixed(3)}`);
}

// ---- voronoi ----
{
  let bad = 0, idBad = 0, f1w = 0, f2w = 0, tot = 20000, nearBad = 0;
  const brute = (p: Vec3) => {
    const ix = Math.floor(p[0]), iy = Math.floor(p[1]), iz = Math.floor(p[2]);
    const ds: number[] = [];
    for (let k = -2; k <= 2; k++) for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      const h = N.hash3F3(ix + i, iy + j, iz + k, 1);
      ds.push(Math.hypot(ix + i + h[0] * 0 + (0.5 + (h[0] - 0.5)) - p[0], iy + j + 0.5 + (h[1] - 0.5) - p[1], iz + k + 0.5 + (h[2] - 0.5) - p[2]));
    }
    ds.sort((a, b) => a - b);
    return ds;
  };
  for (let i = 0; i < tot; i++) {
    const p = pt(10);
    const v = N.voronoi3(p, 1);
    if (!(v.f1 <= v.f2)) bad++;
    const v2 = N.voronoi3(p, 1);
    if (v2.id !== v.id || v2.f1 !== v.f1) idBad++;
    const at = N.voronoi3(v.cell, 1);
    if (at.f1 > 1e-9 || at.id !== v.id) nearBad++;
    const b = brute(p);
    if (Math.abs(b[0]! - v.f1) > 1e-9) f1w++;
    if (Math.abs(b[1]! - v.f2) > 1e-9) f2w++;
  }
  check('voronoi3 F1 <= F2 always', bad === 0);
  check('voronoi3 cell id stable (repeat call) and id at cell centre matches', idBad === 0 && nearBad === 0, `repeat=${idBad} centre=${nearBad}`);
  check('voronoi3 F1 exact vs 5^3 brute force (>= 99.9%)', f1w / tot < 1e-3, `F1 wrong ${f1w}/${tot}`);
  check('voronoi3 F2 exact vs 5^3 brute force (>= 98%)', f2w / tot < 0.02, `F2 wrong ${f2w}/${tot} (3^3 search limit, documented)`);
  let bad2 = 0, sameId = 0, f1big = 0;
  for (let i = 0; i < tot; i++) {
    const p: [number, number] = [(rnd() * 2 - 1) * 10, (rnd() * 2 - 1) * 10];
    const v = N.voronoi2(p, 1);
    if (!(v.f1 <= v.f2)) bad2++;
    const q = N.voronoi2([v.cell[0] + 1e-4, v.cell[1] - 1e-4], 1);
    if (q.id === v.id) sameId++;
    if (v.f1 > Math.SQRT2) f1big++;
  }
  check('voronoi2 F1 <= F2 and id stable at its own cell centre', bad2 === 0 && sameId === tot, `ok ${sameId}/${tot}`);
  const lat = N.voronoi3([0.3, 0.4, 0.5], 0);
  check('voronoi jit=0 gives lattice (F1 = dist to cell centre)', Math.abs(lat.f1 - Math.hypot(0.2, 0.1, 0)) < 1e-12 && lat.cell.join() === '0.5,0.5,0.5');
  void f1big;
}

// ---- IGN ----
{
  const W = 512, bins = new Array(32).fill(0);
  let sum = 0;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const v = ign(x + 0.5, y + 0.5); bins[Math.min(31, Math.floor(v * 32))]++; sum += v; }
  const tot = W * W, chi = bins.reduce((s, o) => s + (o - tot / 32) ** 2 / (tot / 32), 0);
  check('ign uniform on a 512^2 tile (chi2 31 dof < 61.1 = p 0.001, mean ~ 0.5)', chi < 61.1 && Math.abs(sum / tot - 0.5) < 0.005, `chi2=${chi.toFixed(1)} mean=${(sum / tot).toFixed(4)}`);
  let frameSame = 0;
  for (let i = 0; i < 1000; i++) if (ign(i, 3, 0) === ign(i, 3)) frameSame++;
  check('ign pixel-only (no time), frame index changes it, frame 0 == no frame', frameSame === 1000 && ign(10, 10, 1) !== ign(10, 10) && ign(10.9, 10.9) === ign(10, 10));
  let jsum = 0, jmn = 1, jmx = 0;
  for (let f = 0; f < 256; f++) { const v = noiseJitter(100, 200, f); jsum += v; jmn = Math.min(jmn, v); jmx = Math.max(jmx, v); }
  check('noiseJitter over 256 frames covers [0,1) evenly at one pixel', jmn >= 0 && jmx < 1 && jmx - jmn > 0.97 && Math.abs(jsum / 256 - 0.5) < 0.02, `mean=${(jsum / 256).toFixed(3)} range=${jmn.toFixed(3)}..${jmx.toFixed(3)}`);
}

// ---- GPU vs CPU ----
async function gpuTests() {
  const reachable = async (u: string) => { try { return (await fetch(u, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } };
  const port = 5950 + Math.floor(Math.random() * 100);
  const proc = Bun.spawn([process.execPath, 'x', 'vite', '--port', String(port), '--strictPort'], { cwd: APP, stdout: 'ignore', stderr: 'ignore', env: { ...process.env, MOTION_NO_HMR: '1', PDOOM_NO_HMR: '1' } });
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 150 && !(await reachable(url)); i++) await Bun.sleep(100);
  const launchOpts = { headless: true, args: ['--use-angle=vulkan', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--disable-background-timer-throttling'] };
  let browser;
  try { browser = await chromium.launch({ ...launchOpts, channel: 'chrome' }); } catch { browser = await chromium.launch(launchOpts); }
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const logs: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
    page.on('pageerror', (er) => logs.push(er.message));
    await page.goto(`${url}/?export=1&project=noise`);
    await page.waitForFunction(() => (window as any).__motion?.ready || (window as any).__motion?.error, null, { timeout: 120000 });
    const err = await page.evaluate(() => (window as any).__motion?.error);
    if (err) throw new Error(`app failed to boot: ${err}\n${logs.join('\n')}`);
    await page.evaluate(() => (window as any).__motion.still(0, 1, 0));

    mkdirSync(path.join(ROOT, 'out/prereq'), { recursive: true });
    await page.screenshot({ path: path.join(ROOT, 'out/prereq/noise_sheet.png'), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    console.log('wrote out/prereq/noise_sheet.png');

    const n = 4096;
    const r = mulberry32(99);
    const pts: number[] = [];
    for (let i = 0; i < n; i++) pts.push((r() * 2 - 1) * 20, (r() * 2 - 1) * 20, (r() * 2 - 1) * 20, r() * 10);
    const px: number[] = [];
    for (let i = 0; i < n; i++) px.push(Math.floor(r() * 1920) + 0.5, Math.floor(r() * 1080) + 0.5, 0, 0);
    const probe = async (data: number[]) => (await page.evaluate((d) => (window as any).__noiseProbe(d), data)) as number[];
    const g = await probe(pts);
    const gi = await probe(px);
    const row = (buf: number[], y: number, i: number) => buf.slice((y * n + i) * 4, (y * n + i) * 4 + 4);

    const worst = (name: string, tol: number, f: (i: number) => number, note = '') => {
      let w = 0;
      for (let i = 0; i < n; i++) w = Math.max(w, f(i));
      check(`GPU == CPU ${name} (max abs err < ${e(tol)})`, w < tol, `worst=${e(w)} ${note}`);
    };
    const circ = (a: number, b: number) => { const d = Math.abs(a - b); return Math.min(d, 1 - d); };
    const P = (i: number): Vec3 => [pts[i * 4]!, pts[i * 4 + 1]!, pts[i * 4 + 2]!];
    const T = (i: number) => pts[i * 4 + 3]!;
    const d4 = (a: number[], b: number[], k = 4) => { let m = 0; for (let j = 0; j < k; j++) m = Math.max(m, Math.abs(a[j]! - b[j]!)); return m; };

    worst('snoise value + gradient', 2e-4, (i) => { const s = N.simplexGrad(P(i)); return d4(row(g, 0, i), [s.value, ...s.grad]); });
    worst('fbm(5) value + gradient', 5e-4, (i) => { const s = N.fbmGrad(P(i), 5); return d4(row(g, 1, i), [s.value, ...s.grad]); });
    worst('curlNoise3 vector', 5e-4, (i) => d4(row(g, 2, i), N.curlNoise3(P(i), T(i)), 3));
    worst('curl Jacobian (3 columns)', 2e-3, (i) => {
      const J = N.curlNoise3J(P(i), T(i)).jac;
      const col = (m: number) => [J[m]!, J[3 + m]!, J[6 + m]!];
      return Math.max(d4(row(g, 3, i), col(0), 3), d4(row(g, 4, i), col(1), 3), d4(row(g, 5, i), col(2), 3));
    }, '(|J| up to ~25)');
    worst('GPU curl divergence (trace of Jacobian)', 5e-3, (i) => Math.abs(row(g, 2, i)[3]!), '(float32 sum of 6 terms)');

    let idMis = 0, f12 = 0, cellW = 0, id2 = 0, f12b = 0;
    for (let i = 0; i < n; i++) {
      const v = N.voronoi3(P(i), 1), a = row(g, 6, i), b = row(g, 7, i);
      f12 = Math.max(f12, Math.abs(a[0]! - v.f1), Math.abs(a[1]! - v.f2));
      cellW = Math.max(cellW, Math.abs(a[3]! - v.cell[0]), Math.abs(b[0]! - v.cell[1]), Math.abs(b[1]! - v.cell[2]));
      if (Math.abs(a[2]! - v.id) > 1e-6) idMis++;
      const w = N.voronoi2([P(i)[0], P(i)[1]], 1), c = row(g, 8, i), d = row(g, 9, i);
      f12b = Math.max(f12b, Math.abs(c[0]! - w.f1), Math.abs(c[1]! - w.f2), Math.abs(c[3]! - w.cell[0]), Math.abs(d[0]! - w.cell[1]));
      if (Math.abs(c[2]! - w.id) > 1e-6) id2++;
    }
    check('GPU == CPU voronoi3 F1/F2 (< 2e-4) and cell centre (< 2e-4)', f12 < 2e-4 && cellW < 2e-4, `F=${e(f12)} cell=${e(cellW)}`);
    check('GPU == CPU voronoi3 cell id (<= 0.1% tie mismatches)', idMis <= n * 0.001, `${idMis}/${n} mismatches`);
    check('GPU == CPU voronoi2 F1/F2/cell (< 2e-4), id (<= 0.1% mismatches)', f12b < 2e-4 && id2 <= n * 0.001, `err=${e(f12b)} id ${id2}/${n}`);
    let w1 = 0, w2 = 0, w3 = 0;
    for (let i = 0; i < n; i++) {
      const x = px[i * 4]!, y = px[i * 4 + 1]!, o = row(gi, 10, i);
      w1 = Math.max(w1, circ(o[0]!, ign(x, y)));
      w2 = Math.max(w2, circ(o[1]!, ign(x, y, 3)));
      w3 = Math.max(w3, circ(o[2]!, noiseJitter(x, y, 5)));
    }
    check('GPU == CPU ign / ignFrame / noiseJitter at 1080p coordinates (circular err < 2e-3)', Math.max(w1, w2, w3) < 2e-3, `ign=${e(w1)} frame=${e(w2)} jitter=${e(w3)}`);
    if (logs.length) console.log('browser errors:\n' + logs.slice(0, 10).join('\n'));
  } finally {
    await browser.close();
    try { proc.kill(); } catch {}
  }
}

if (!process.argv.includes('--no-gpu')) {
  try { await gpuTests(); } catch (er: any) { check('GPU tests ran', false, String(er?.message ?? er)); }
}
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
