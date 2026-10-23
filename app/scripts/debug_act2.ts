import { chromium } from 'playwright-core';

const APP = process.cwd();
const port = 5399;
const proc = Bun.spawn([process.execPath, 'x', 'vite', '--port', String(port), '--strictPort'], {
  cwd: APP,
  stdout: 'ignore',
  stderr: 'ignore',
  env: { ...process.env, MOTION_NO_HMR: '1' }
});

for (let i = 0; i < 50; i++) {
  try {
    const res = await fetch(`http://localhost:${port}`);
    if (res.ok) break;
  } catch {}
  await Bun.sleep(100);
}

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

await page.goto(`http://localhost:${port}/?export=1`);
await page.waitForFunction(() => (window as any).__motion?.ready, null, { timeout: 15000 });

// Render at t = 33.55
await page.evaluate(async () => {
  const P = (window as any).__motion;
  await P.still(33.55, 1, 0.5);
});

// Let's raycast or check all meshes in Act 2 scene
const res = await page.evaluate(() => {
  // Find act2
  const THREE = (window as any).THREE;
  // Let's find all meshes in scene
  // In window.__motion, let's see how we can get the active scene
  return { ok: true };
});

await browser.close();
proc.kill();
