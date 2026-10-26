#!/usr/bin/env bun
// Headless post-FX tests (P7): exact-black fade, neutral ramp, colour gradient (no tint at defaults), grade identity,
// tone-map hue stability of a clipped violet-white, HDR > 1 reaching bloom, god-ray tier banding.
// Usage: bun scripts/test_post.ts   (starts a private vite server + headless chrome, like render.ts)
import { chromium } from 'playwright-core';
import path from 'node:path';

const APP = path.resolve(import.meta.dir, '..');
const port = 5800 + Math.floor(Math.random() * 150);
const proc = Bun.spawn([process.execPath, 'x', 'vite', '--port', String(port), '--strictPort'], { cwd: APP, stdout: 'ignore', stderr: 'ignore', env: { ...process.env, MOTION_NO_HMR: '1', PDOOM_NO_HMR: '1' } });
const url = `http://localhost:${port}`;
for (let i = 0; i < 150; i++) { try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) break; } catch {} await Bun.sleep(100); }

const launch = { headless: true, args: ['--use-angle=vulkan', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] };
let browser;
try { browser = await chromium.launch({ ...launch, channel: 'chrome' }); } catch { browser = await chromium.launch(launch); }
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`${url}/?export=1&project=post_fx`);
await page.waitForFunction(() => (window as any).__motion?.ready || (window as any).__motion?.error, null, { timeout: 120000 });

const results: { name: string; ok: boolean; detail: string }[] = await page.evaluate(async () => {
  const { THREE } = await import('/src/scenes/_prereq_demos/post_fx/three_export.ts' as string);
  const gl = await import('/src/engine/gl.ts' as string);
  const postMod = await import('/src/engine/post.ts' as string);
  const eng = (window as any).__motion.engine;
  const r = eng.renderer;
  const post = eng.post;
  const { W, H } = gl;
  const out = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, depthBuffer: false });
  const src = gl.makeRT(W, H, { depthBuffer: false });
  const hud = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat);
  hud.needsUpdate = true;
  const res: { name: string; ok: boolean; detail: string }[] = [];
  const add = (name: string, ok: boolean, detail: string) => res.push({ name, ok, detail });

  const fill = (body: string) => {
    const p = new gl.FSPass(`void main() { vec2 px = vUv; ${body} }`);
    p.render(r, src);
    p.dispose();
    r.resetState();
  };
  const run = (params: any, t = 1.0) => {
    post.render(r, src.texture, hud, out, { ...postMod.DEFAULT_POST, ...params }, t);
    const buf = new Uint8Array(W * H * 4);
    r.readRenderTargetPixels(out, 0, 0, W, H, buf);
    return buf;
  };
  const clean = { bloom: 0, halation: 0, ca: 0, grain: 0, vignette: 0 };
  const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  const px = (b: Uint8Array, x: number, y: number) => { const i = (y * W + x) * 4; return [b[i]!, b[i + 1]!, b[i + 2]!]; };

  // 1. exact black: everything on, fade = 1 (and level = 0), over a bright busy frame
  fill('vec3 c = vec3(8.0 * step(0.5, fract(px.x * 40.0)), 2.0, 5.0 * px.y); fragColor = vec4(c, 1.0);');
  const everything = { bloom: 2, halation: 1, ca: 4, grain: 0.2, vignette: 1, volumetric: 1, volumetricSteps: 48, flash: 0, optics: { intensity: 1, threshold: 0.5 }, dof: 1 };
  for (const [label, extra] of [['fade=1', { fade: 1 }], ['level=0', { level: 0 }], ['fade=1 (agx)', { fade: 1, toneMap: 'agx' }]] as const) {
    const b = run({ ...everything, ...extra });
    let nz = 0; for (let i = 0; i < b.length; i += 4) if (b[i] || b[i + 1] || b[i + 2]) nz++;
    let a = 0; for (let i = 3; i < b.length; i += 4) if (b[i] !== 255) a++;
    add(`exact black: ${label}`, nz === 0 && a === 0, `${nz} non-zero RGB pixels of ${W * H}, ${a} non-opaque`);
  }
  // each noise/floor source individually at 0 with the rest on: the fade=0.999 frame must be < 1 LSB
  {
    const b = run({ ...everything, fade: 0.9999 });
    let mx = 0; for (let i = 0; i < b.length; i += 4) mx = Math.max(mx, b[i]!, b[i + 1]!, b[i + 2]!);
    add('fade=0.9999 stays <= 1 LSB (no noise floor)', mx <= 1, `max byte ${mx}`);
  }

  // 2. neutral ramp (linear 0..0.7, identity part of the shoulder): out == sRGB(in) +-1 LSB and R==G==B
  fill('float v = px.x * 0.7; fragColor = vec4(vec3(v), 1.0);');
  {
    const b = run({ ...clean });
    let maxErr = 0, maxSplit = 0;
    for (let x = 0; x < W; x += 7) {
      const v = (x + 0.5) / W * 0.7, e = Math.round(toSrgb(v) * 255), p = px(b, x, 540);
      maxErr = Math.max(maxErr, Math.abs(p[0]! - e), Math.abs(p[1]! - e), Math.abs(p[2]! - e));
      maxSplit = Math.max(maxSplit, Math.abs(p[0]! - p[1]!), Math.abs(p[1]! - p[2]!));
    }
    add('neutral ramp, default post', maxErr <= 1 && maxSplit === 0, `max |out - sRGB(in)| = ${maxErr} LSB, max channel split = ${maxSplit}`);
    const b2 = run({ ...clean, grade: {}, blackPoint: 0, level: 1 });
    let d = 0; for (let i = 0; i < b.length; i++) d = Math.max(d, Math.abs(b[i]! - b2[i]!));
    add('identity grade object == no grade', d <= 1, `max diff ${d} LSB`);
  }

  // 3. colour gradient: three linear gradients, no hue/tint at defaults
  fill('fragColor = vec4(0.6 * px.x, 0.6 * px.y, 0.6 * (1.0 - px.x), 1.0);');
  {
    const b = run({ ...clean });
    let maxErr = 0;
    for (let y = 8; y < H; y += 53) for (let x = 8; x < W; x += 61) {
      const u = (x + 0.5) / W, v = (y + 0.5) / H, p = px(b, x, y);
      const e = [0.6 * u, 0.6 * v, 0.6 * (1 - u)].map((c) => Math.round(toSrgb(c) * 255));
      for (let c = 0; c < 3; c++) maxErr = Math.max(maxErr, Math.abs(p[c]! - e[c]!));
    }
    add('colour gradient, default post', maxErr <= 1, `max error ${maxErr} LSB`);
  }

  // 4. hue of clipped violet-white under each tone map (oklab hue of the output, vs the input's)
  const oklab = (r8: number[]) => {
    const l = r8.map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    const L = Math.cbrt(0.4122214708 * l[0]! + 0.5363325363 * l[1]! + 0.0514459929 * l[2]!);
    const M = Math.cbrt(0.2119034982 * l[0]! + 0.6806995451 * l[1]! + 0.1073969566 * l[2]!);
    const S = Math.cbrt(0.0883024619 * l[0]! + 0.2817188376 * l[1]! + 0.6299787005 * l[2]!);
    const a = 1.9779984951 * L - 2.428592205 * M + 0.4505937099 * S, bb = 0.0259040371 * L + 0.7827717662 * M - 0.808675766 * S;
    return { C: Math.hypot(a, bb), h: (Math.atan2(bb, a) * 180) / Math.PI };
  };
  // violet-white core: linear (0.55, 0.40, 1.0) * k, k = 0.4 .. 40 across x
  fill('float k = 0.4 * pow(100.0, px.x); fragColor = vec4(vec3(0.55, 0.40, 1.0) * k, 1.0);');
  const hueOf = (params: any) => {
    const b = run({ ...clean, ...params });
    const rows: { k: number; rgb: number[]; C: number; h: number }[] = [];
    for (const k of [0.4, 1, 2, 4, 8, 16, 40]) {
      const x = Math.round((Math.log(k / 0.4) / Math.log(100)) * W);
      const rgb = px(b, Math.min(W - 1, x), 540), o = oklab(rgb);
      rows.push({ k, rgb, ...o });
    }
    return rows;
  };
  const ref = oklab([0.55, 0.40, 1.0].map((c) => Math.round(toSrgb(c / 1.0) * 255))).h;
  for (const [name, params, tol] of [['legacy', {}, 12], ['aces', { toneMap: 'aces' }, null], ['agx', { toneMap: 'agx' }, null], ['aces + hue', { toneMap: 'aces', toneMapHue: 1 }, 12], ['agx + hue', { toneMap: 'agx', toneMapHue: 1 }, 12]] as const) {
    const rows = hueOf(params);
    const chroma = rows.filter((q) => q.C > 0.06);
    const worst = chroma.reduce((m, q) => Math.max(m, Math.abs(((q.h - ref + 540) % 360) - 180)), 0);
    const line = rows.map((q) => `k${q.k}:[${q.rgb}] C${q.C.toFixed(2)} h${q.h.toFixed(0)}`).join(' | ');
    add(`violet-white hue, ${name}`, tol === null ? true : worst <= tol, `${tol === null ? 'INFO ' : ''}max hue shift ${worst.toFixed(1)} deg (input h ${ref.toFixed(0)}) :: ${line}`);
  }

  // 5. HDR > 1 survives to bloom: a single 12.0 pixel makes its neighbourhood brighter with bloom on
  fill('float d = length((px - 0.5) * vec2(1920.0, 1080.0)); fragColor = vec4(vec3(d < 2.0 ? 12.0 : 0.0), 1.0);');
  {
    const a = run({ ...clean, bloom: 0, halation: 0 }), b = run({ ...clean, bloom: 1.5 });
    const p0 = px(a, 960 + 14, 540), p1 = px(b, 960 + 14, 540);
    add('HDR 12.0 reaches bloom', p1[0]! > p0[0]! + 8, `neighbour at +14px: ${p0[0]} (bloom off) -> ${p1[0]} (bloom on)`);
  }

  // 6. god-ray tiers: smooth sky wedge, banding = 1st-difference variance along a row crossing the rays
  fill('float d = length((px - vec2(0.5, 0.3)) * vec2(1.78, 1.0)); fragColor = vec4(vec3(d < 0.09 ? 6.0 : 0.02), 1.0);');
  {
    // banding = low-frequency error: 9x9-blurred red channel vs a 64-step reference (jitter noise averages out, step banding does not)
    const grab = (steps: number, jitter?: number) => run({ ...clean, volumetric: 0.3, volumetricLightPos: [0.5, 0.3], volumetricSteps: steps, volumetricJitter: jitter });
    const blurErr = (b: Uint8Array, ref: Uint8Array) => {
      let s = 0, n = 0;
      for (let y = 380; y < 560; y += 6) for (let x = 500; x < 1400; x += 3) {
        let a = 0, c = 0;
        for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { a += px(b, x + i, y + j)[0]!; c += px(ref, x + i, y + j)[0]!; }
        s += ((a - c) / 81) ** 2; n++;
      }
      return Math.sqrt(s / n);
    };
    const ref = grab(64, 0), g10 = grab(10, 0), g24 = grab(24), g48 = grab(48);
    const e10 = blurErr(g10, ref), e24 = blurErr(g24, ref), e48 = blurErr(g48, ref);
    add('god-ray tiers: banding error vs 64-step reference (RMS, LSB)', e48 < e10 && e24 < e10, `10 steps no jitter: ${e10.toFixed(2)}  24 + IGN: ${e24.toFixed(2)}  48 + IGN: ${e48.toFixed(2)}`);    const b10 = grab(10);
    const b48 = grab(48);
    const v10 = px(b10, 1100, 560)[0]!, v48 = px(b48, 1100, 560)[0]!;
    add('god-ray brightness is tier independent', Math.abs(v10 - v48) < 16 && v10 > 20 && v10 < 250, `at (1100,560): 10 steps ${v10}, 48 steps ${v48}`);
  }
  return res;
});

let fail = 0;
for (const x of results) { console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.name}\n      ${x.detail}`); if (!x.ok) fail++; }
await browser.close();
proc.kill();
console.log(fail ? `\n${fail} FAILED` : `\nall ${results.length} post tests passed`);
process.exit(fail ? 1 : 0);
