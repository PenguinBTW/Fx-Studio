#!/usr/bin/env bun
// Acceptance test for engine/spectrum.ts (+ GLSL mirror). Run: bun scripts/test_spectrum.ts [--no-gpu]
// CPU checks run first; GPU-vs-CPU runs the GLSL in headless Chrome (same launch as render.ts) via the
// _prereq_demos/spectrum scene and compares in 8-bit sRGB, tolerance 1/255. Also writes the chart still
// to out/prereq/spectrum_chart.png.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import {
  wavelengthToLinearSRGB, blackbodyToLinearSRGB, spectrumRamp, spectralSamples, spectralWhite, linearSRGBToOklab,
  oklabToLinearSRGB, linearSRGBToOklch, oklchToLinearSRGB, mixOklab, mixOklch, makeOklabGradient, oklabChroma, linearToSRGB8,
  OXYGEN_GREEN, OXYGEN_RED, SODIUM_D, type RGB,
} from '../src/engine/spectrum';

const APP = path.resolve(import.meta.dir, '..');
const ROOT = path.resolve(APP, '..');
let fails = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
};
const fmt = (c: RGB) => `[${c.map((v) => v.toFixed(3)).join(', ')}]`;

// ---- CPU ----
const dom = (c: RGB) => (c[0] >= c[1] && c[0] >= c[2] ? 'r' : c[1] >= c[2] ? 'g' : 'b');
const c650 = wavelengthToLinearSRGB(650), c550 = wavelengthToLinearSRGB(550), c450 = wavelengthToLinearSRGB(450);
check('650nm red-dominant', dom(c650) === 'r' && c650[0] > 2 * c650[1], fmt(c650));
check('550nm green-dominant', dom(c550) === 'g' && c550[1] > c550[0] && c550[1] > c550[2], fmt(c550));
check('450nm blue-dominant', dom(c450) === 'b' && c450[2] > 2 * c450[0], fmt(c450));
check('OXYGEN_GREEN 557.7 green', dom(wavelengthToLinearSRGB(OXYGEN_GREEN)) === 'g');
check('OXYGEN_RED 630 red', dom(wavelengthToLinearSRGB(OXYGEN_RED)) === 'r');
const na = wavelengthToLinearSRGB(SODIUM_D);
check('SODIUM_D 589 yellow-orange (r>g>b)', na[0] >= na[1] && na[1] > na[2], fmt(na));
const v380 = wavelengthToLinearSRGB(380), v400 = wavelengthToLinearSRGB(400), v410 = wavelengthToLinearSRGB(410);
check('380nm violet: B dominant, R > G, G ~ 0', v380[2] === 1 && v380[0] > v380[1] + 0.1 && v380[1] < 0.05, fmt(v380));
check('380-410nm deep violet (R 0.15-0.5, G < 0.05, B = 1)', [380, 390, 400, 410].every((nm) => { const c = wavelengthToLinearSRGB(nm); return c[0] > 0.15 && c[0] < 0.5 && c[1] < 0.05 && c[2] === 1; }), `${fmt(v400)} ${fmt(v410)}`);
{
  let worst = 0, at = 0, prev = linearToSRGB8(wavelengthToLinearSRGB(380));
  for (let px = 1; px <= 1600; px++) {
    const nm = 380 + px * 0.2, c = linearToSRGB8(wavelengthToLinearSRGB(nm));
    const d = Math.max(Math.abs(c[0] - prev[0]), Math.abs(c[1] - prev[1]), Math.abs(c[2] - prev[2]));
    if (d > worst) { worst = d; at = nm; }
    prev = c;
  }
  check('CPU wavelength strip max step < 8/255 per 0.2nm', worst < 8, `worst=${worst} at ${at.toFixed(1)}nm`);
}
let neg = false;
for (let nm = 360; nm <= 830; nm += 1) for (const v of wavelengthToLinearSRGB(nm, 'none')) if (v < -1e-9) neg = true;
check('wavelength output never negative (gamut mapped)', !neg);
const lum0 = wavelengthToLinearSRGB(380, 'luminous'), lum1 = wavelengthToLinearSRGB(555, 'luminous');
check('luminous mode: 555nm brighter than 380nm', Math.max(...lum1) > 20 * Math.max(...lum0));

const sun = blackbodyToLinearSRGB(5778);
check('5778K near-white (oklab chroma < 0.03)', oklabChroma(sun) < 0.03, `chroma=${oklabChroma(sun).toFixed(4)} rgb=${fmt(sun)}`);
const amber = blackbodyToLinearSRGB(3000);
check('3000K amber (r>g>b, g/r 0.4-0.75, b/r<0.4)', amber[0] > amber[1] && amber[1] > amber[2] && amber[1] / amber[0] > 0.4 && amber[1] / amber[0] < 0.75 && amber[2] / amber[0] < 0.4, fmt(amber));
const c1000 = blackbodyToLinearSRGB(1000), c40k = blackbodyToLinearSRGB(40000);
check('1000K red, 40000K blue', dom(c1000) === 'r' && dom(c40k) === 'b', `${fmt(c1000)} ${fmt(c40k)}`);
let mono = true, prev = -1;
for (let k = 1000; k <= 40000; k += 250) { const c = blackbodyToLinearSRGB(k); const ratio = c[2] / c[0]; if (ratio < prev - 1e-6) mono = false; prev = ratio; }
check('blackbody blue/red ratio monotonic in T', mono);
const lumY = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
check("blackbody 'luminance' norm: Y = 1 at 1000/3000/6500/40000 K", [1000, 3000, 6500, 40000].every((k) => Math.abs(lumY(blackbodyToLinearSRGB(k)) - 1) < 1e-6));
const r6500 = blackbodyToLinearSRGB(6500);
check('6500K near D65 (oklab chroma < 0.03)', oklabChroma(r6500) < 0.03, `chroma=${oklabChroma(r6500).toFixed(4)}`);
check("blackbody 'relative' ordering: hotter is brighter", lumY(blackbodyToLinearSRGB(3000, 'relative')) < lumY(blackbodyToLinearSRGB(6500, 'relative')));

for (const n of [8, 16, 33, 64]) {
  const s = spectralSamples(n);
  const sum = s.rgb.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]] as RGB, [0, 0, 0] as RGB);
  check(`spectralSamples(${n}) equal-energy sum is white`, sum.every((v) => Math.abs(v - 1) < 1e-9), fmt(sum));
}
const sNarrow = spectralSamples(12, 500, 600);
check('spectralSamples sub-window sums to white too', sNarrow.rgb.reduce((a, c) => a + c[0] + c[1] + c[2], 0) > 2.999 && sNarrow.rgb.reduce((a, c) => a + c[0] + c[1] + c[2], 0) < 3.001);
const s24 = spectralSamples(24);
const rainbow = s24.rgb.reduce((a, c, i) => { const L = s24.nm[i]! > 600 ? 1 : 0; return [a[0] + c[0] * L, a[1] + c[1] * L, a[2] + c[2] * L] as RGB; }, [0, 0, 0] as RGB);
check('spectralSamples red-pass filter gives red', dom(rainbow) === 'r' && rainbow[0] > 0.3 && rainbow[0] > 10 * rainbow[1], fmt(rainbow));
check('spectrumRamp(0) violet-blue, (1) red', dom(spectrumRamp(0)) === 'b' && dom(spectrumRamp(1)) === 'r');
check('spectrumRamp width pastels (lower chroma than width 0 mid-ramp)', oklabChroma(spectrumRamp(0.5, 120)) < oklabChroma(spectrumRamp(0.5, 0)));

const probeCol: RGB = [0.3, 0.6, 0.1];
const rt = oklabToLinearSRGB(linearSRGBToOklab(probeCol));
check('oklab round trip', rt.every((v, i) => Math.abs(v - probeCol[i]!) < 1e-5), fmt(rt));
const rt2 = oklchToLinearSRGB(linearSRGBToOklch(probeCol));
check('oklch round trip', rt2.every((v, i) => Math.abs(v - probeCol[i]!) < 1e-5));
const wLab = linearSRGBToOklab([1, 1, 1]);
check('oklab white = (1, 0, 0)', Math.abs(wLab[0] - 1) < 1e-3 && Math.abs(wLab[1]) < 1e-3 && Math.abs(wLab[2]) < 1e-3);
const mid = mixOklab([1, 0, 0], [0, 0, 1], 0.5);
check('mixOklab midpoint in gamut', mid.every((v) => v >= 0 && v <= 1.0001), fmt(mid));
check('mixOklab t=0/1 endpoints', mixOklab([0.2, 0.4, 0.6], [0.7, 0.1, 0.3], 0).every((v, i) => Math.abs(v - [0.2, 0.4, 0.6][i]!) < 1e-5));
check('mixOklch keeps chroma (middle chroma > mixOklab middle chroma)', oklabChroma(mixOklch([0.8, 0.02, 0.02], [0.03, 0.12, 0.85], 0.5)) > oklabChroma(mixOklab([0.8, 0.02, 0.02], [0.03, 0.12, 0.85], 0.5)) - 1e-6);
const grad = makeOklabGradient([{ pos: 0, rgb: [1, 0, 0] }, { pos: 0.5, rgb: [0, 1, 0] }, { pos: 1, rgb: [0, 0, 1] }]);
check('oklab gradient hits stops', grad(0.5).every((v, i) => Math.abs(v - [0, 1, 0][i]!) < 1e-4) && grad(-1)[0] > 0.99 && grad(2)[2] > 0.99);

// ---- GPU ----
const maxDiff8 = (gpu: number[], cpu: (i: number, n: number) => RGB, n: number) => {
  let worst = 0, at = 0;
  for (let i = 0; i < n; i++) {
    const g = linearToSRGB8([gpu[i * 4]!, gpu[i * 4 + 1]!, gpu[i * 4 + 2]!]);
    const c = linearToSRGB8(cpu(i, n));
    const d = Math.max(Math.abs(g[0] - c[0]), Math.abs(g[1] - c[1]), Math.abs(g[2] - c[2]));
    if (d > worst) { worst = d; at = i; }
  }
  return { worst, at };
};

async function gpuTests() {
  const reachable = async (u: string) => { try { return (await fetch(u, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } };
  const port = 5800 + Math.floor(Math.random() * 150);
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
    page.on('pageerror', (e) => logs.push(e.message));
    await page.goto(`${url}/?export=1&project=spectrum`);
    await page.waitForFunction(() => (window as any).__motion?.ready || (window as any).__motion?.error, null, { timeout: 120000 });
    const err = await page.evaluate(() => (window as any).__motion?.error);
    if (err) throw new Error(`app failed to boot: ${err}\n${logs.join('\n')}`);
    mkdirSync(path.join(ROOT, 'out/prereq'), { recursive: true });
    await page.evaluate(() => (window as any).__motion.still(1.0, 1, 0));
    await page.screenshot({ path: path.join(ROOT, 'out/prereq/spectrum_chart.png'), clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    const strip: number[] = await page.evaluate(async () => {
      const img = new Image();
      const blob = await (window as any).__motion.png();
      img.src = 'data:image/png;base64,' + blob;
      await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const c = cv.getContext('2d')!; c.drawImage(img, 0, 0);
      const row = c.getImageData(160, 220, 1600, 1).data;
      return Array.from(row);
    });
    {
      let worst = 0, at = 0;
      for (let i = 1; i < 1600; i++) for (let k = 0; k < 3; k++) { const d = Math.abs(strip[i * 4 + k]! - strip[(i - 1) * 4 + k]!); if (d > worst) { worst = d; at = i; } }
      check('rendered chart strip (y=220) max per-pixel step < 8/255', worst < 8, `worst=${worst} at ${(380 + at * 0.2).toFixed(1)}nm`);
      const f = strip.slice(0, 3);
      check('rendered chart 380nm violet (B max, R > G)', f[2]! > 240 && f[0]! > f[1]! + 20, `rgb8=${f.join(',')}`);
    }    const probe = (mode: number, lo: number, hi: number, n: number, white: RGB = [1, 1, 1]) =>
      page.evaluate(([m, l, h, k, w]) => (window as any).__spectrumProbe(m, l, h, k, w), [mode, lo, hi, n, white] as const) as Promise<number[]>;
    const N = 321;
    const lerp = (lo: number, hi: number) => (i: number, n: number) => lo + ((i + 0.5) / n) * (hi - lo);

    const wl = lerp(300, 900);
    for (const [mode, name, intensity] of [[0, 'peak', 'peak'], [1, 'luminous', 'luminous'], [2, 'none', 'none']] as const) {
      const g = await probe(mode, 300, 900, N);
      const r = maxDiff8(g, (i, n) => wavelengthToLinearSRGB(wl(i, n), intensity), N);
      check(`GPU vs CPU wavelengthToLinearSRGB (${name}) within 1/255`, r.worst <= 1, `worst=${r.worst} at ${wl(r.at, N).toFixed(1)}nm`);
    }
    const g3 = await probe(3, 0, 1, N);
    const r3 = maxDiff8(g3, (i, n) => spectrumRamp((i + 0.5) / n, 40), N);
    check('GPU vs CPU spectrumRamp(t, 40nm) within 1/255', r3.worst <= 1, `worst=${r3.worst}`);

    const NB = 400;
    const g4 = await probe(4, 800, 42000, NB);
    const kk = lerp(800, 42000);
    const r4 = maxDiff8(g4, (i, n) => blackbodyToLinearSRGB(kk(i, n)), NB);
    check('GPU vs CPU blackbodyToLinearSRGB within 1/255', r4.worst <= 1, `worst=${r4.worst} at ${kk(r4.at, NB).toFixed(0)}K`);

    const A: RGB = [0.8, 0.02, 0.02], B: RGB = [0.03, 0.12, 0.85], C: RGB = [0.95, 0.8, 0.05];
    const gr = makeOklabGradient([{ pos: 0, rgb: A }, { pos: 0.5, rgb: B }, { pos: 1, rgb: C }]);
    const g5 = await probe(5, 0, 1, N);
    const r5 = maxDiff8(g5, (i, n) => gr((i + 0.5) / n), N);
    check('GPU vs CPU oklabGradient (3 stops) within 1/255', r5.worst <= 1, `worst=${r5.worst}`);
    const g6 = await probe(6, 0, 1, N);
    const r6 = maxDiff8(g6, (i, n) => mixOklch(A, B, (i + 0.5) / n), N);
    check('GPU vs CPU mixOklch within 1/255', r6.worst <= 1, `worst=${r6.worst}`);
    const g7 = await probe(7, 0, 1, N);
    const r7 = maxDiff8(g7, (i, n) => { const v = (i + 0.5) / n; return oklabToLinearSRGB(linearSRGBToOklab([v, 1 - v, 0.5 * v])); }, N);
    check('GPU vs CPU oklab round trip within 1/255', r7.worst <= 1, `worst=${r7.worst}`);

    const NS = 32;
    const white = spectralWhite(NS);
    const s = spectralSamples(NS);
    const g8 = await probe(8, 380, 700, NS, white);
    const r8 = maxDiff8(g8, (i) => s.rgb[i]!, NS);
    let gs: RGB = [0, 0, 0];
    for (let i = 0; i < NS; i++) gs = [gs[0] + g8[i * 4]!, gs[1] + g8[i * 4 + 1]!, gs[2] + g8[i * 4 + 2]!];
    check('GPU spectralSampleWeight matches CPU and sums to white', r8.worst <= 1 && gs.every((v) => Math.abs(v - 1) < 1e-3), `worst=${r8.worst} sum=${fmt(gs)}`);
    if (logs.length) console.log('browser errors:\n' + logs.slice(0, 10).join('\n'));
  } finally {
    await browser.close();
    try { proc.kill(); } catch {}
  }
}

if (!process.argv.includes('--no-gpu')) {
  try { await gpuTests(); } catch (e: any) { check('GPU tests ran', false, String(e?.message ?? e)); }
}
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
