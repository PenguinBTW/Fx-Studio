import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const APP = path.resolve(import.meta.dir, '..');
const ROOT = path.resolve(APP, '..');
const OUT_DIR = path.join(ROOT, 'out/logos');

const files = [
  'fx_hero_dark',
  'fx_signal_vermilion',
  'fx_monogram_icon',
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 2 });

for (const name of files) {
  const svgPath = path.join(OUT_DIR, `${name}.svg`);
  const pngPath = path.join(OUT_DIR, `${name}.png`);
  const content = fs.readFileSync(svgPath, 'utf-8');
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden;background:#000;">${content}</body></html>`);
  await page.screenshot({ path: pngPath, type: 'png' });
  console.log(`Rendered ${name}.png (1600x1600 @ 2x)`);
}

await browser.close();
console.log('All logo PNGs rendered successfully');
