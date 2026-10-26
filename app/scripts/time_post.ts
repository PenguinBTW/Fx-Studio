#!/usr/bin/env bun
// Post-FX timing: ms/frame at 1080p (GPU-synced via a 1-px readback) for default post, each new pass, and everything on.
// Usage: bun scripts/time_post.ts [--frames 60]
import { chromium } from 'playwright-core';
import path from 'node:path';

const APP = path.resolve(import.meta.dir, '..');
const fi = process.argv.indexOf('--frames');
const FRAMES = fi >= 0 ? Number(process.argv[fi + 1]) : 60;
const port = 5950 + Math.floor(Math.random() * 40);
const proc = Bun.spawn([process.execPath, 'x', 'vite', '--port', String(port), '--strictPort'], { cwd: APP, stdout: 'ignore', stderr: 'ignore', env: { ...process.env, MOTION_NO_HMR: '1', PDOOM_NO_HMR: '1' } });
const url = `http://localhost:${port}`;
for (let i = 0; i < 150; i++) { try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) break; } catch {} await Bun.sleep(100); }
const launch = { headless: true, args: ['--use-angle=vulkan', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] };
let browser;
try { browser = await chromium.launch({ ...launch, channel: 'chrome' }); } catch { browser = await chromium.launch(launch); }
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`${url}/?export=1&project=post_fx`);
await page.waitForFunction(() => (window as any).__motion?.ready || (window as any).__motion?.error, null, { timeout: 120000 });

const rows: [string, number][] = await page.evaluate(async (frames: number) => {
  const { THREE } = await import('/src/scenes/_prereq_demos/post_fx/three_export.ts' as string);
  const gl = await import('/src/engine/gl.ts' as string);
  const postMod = await import('/src/engine/post.ts' as string);
  const eng = (window as any).__motion.engine;
  const r = eng.renderer, post = eng.post;
  const { W, H } = gl;
  const out = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false });
  const src = gl.makeRT(W, H, { depthBuffer: false });
  const hud = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
  hud.needsUpdate = true;
  // busy frame with a few HDR highlights so the optics mask is not trivially empty
  const p = new gl.FSPass(`void main() {
    vec2 px = vUv * vec2(1920.0, 1080.0); vec3 c = vec3(0.25 + 0.2 * sin(px.x * 0.01), 0.2 + 0.2 * sin(px.y * 0.013), 0.3);
    for (int i = 0; i < 4; i++) c += vec3(0.7, 0.5, 1.0) * 30.0 * exp(-dot(px - vec2(400.0 + 350.0 * float(i), 300.0 + 200.0 * float(i)), px - vec2(400.0 + 350.0 * float(i), 300.0 + 200.0 * float(i))) / 6.0);
    fragColor = vec4(c, 1.0); }`);
  p.render(r, src); r.resetState();
  const one = new Uint8Array(4);
  const time = (params: any) => {
    const full = { ...postMod.DEFAULT_POST, ...params };
    for (let i = 0; i < 5; i++) post.render(r, src.texture, hud, out, full, 1);
    r.readRenderTargetPixels(out, 0, 0, 1, 1, one);
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) post.render(r, src.texture, hud, out, full, 1 + i / 60);
    r.readRenderTargetPixels(out, 0, 0, 1, 1, one);
    return (performance.now() - t0) / frames;
  };
  const optics = { intensity: 0.8, threshold: 2 };
  const res: [string, number][] = [];
  res.push(['default post', time({})]);
  res.push(['+ per-frame grade object', time({ grade: { gain: 1.1, saturation: 0.9 } })]);
  res.push(['+ toneMap aces', time({ toneMap: 'aces' })]);
  res.push(['+ toneMap agx + hue', time({ toneMap: 'agx', toneMapHue: 1 })]);
  res.push(['+ optics 6 spikes + airy', time({ optics })]);
  res.push(['+ optics 4 spikes', time({ optics: { ...optics, spikes: 4 } })]);
  res.push(['+ optics airy only', time({ optics: { ...optics, spikes: 0 } })]);
  const vol = { volumetric: 0.6, volumetricLightPos: [0.5, 0.3] };
  res.push(['god-rays 10 steps (legacy)', time({ ...vol, volumetricSteps: 10 })]);
  res.push(['god-rays 24 steps', time({ ...vol, volumetricSteps: 24 })]);
  res.push(['god-rays 48 steps', time({ ...vol, volumetricSteps: 48 })]);
  res.push(['ALL new passes on (aces, grade, optics, rays 48)', time({ ...vol, volumetricSteps: 48, grade: { gain: 1.1 }, toneMap: 'aces', optics })]);
  return res;
}, FRAMES);

console.log(`post ms/frame at 1920x1080 (${FRAMES} frames, GPU-synced):`);
for (const [n, ms] of rows) console.log(`  ${ms.toFixed(2).padStart(7)} ms  ${n}`);
await browser.close();
proc.kill();
