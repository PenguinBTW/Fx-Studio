import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const APP = path.resolve(import.meta.dir, '..');
const ROOT = path.resolve(APP, '..');
const DIR = path.join(ROOT, 'out/logos/monogram_yt');

const files = [
  'monogram_fitted_squircle',
  'monogram_circular_plate',
  'monogram_edge_bevel',
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 2 });

for (const name of files) {
  const svgPath = path.join(DIR, `${name}.svg`);
  const pngPath = path.join(DIR, `${name}.png`);
  const content = fs.readFileSync(svgPath, 'utf-8');
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden;background:#030305;">${content}</body></html>`);
  await page.screenshot({ path: pngPath, type: 'png' });
  console.log(`Rendered ${name}.png`);
}

// Also create a comparison sheet showing how they look inside YouTube's circular crop
const pageSheet = await browser.newPage({ viewport: { width: 1920, height: 800 }, deviceScaleFactor: 1 });

const labels = [
  { id: 'monogram_fitted_squircle', title: '1. Floating Squircle (Fitted)', desc: 'The exact squircle from fx_monogram_icon.svg scaled so its corners and drop shadow float completely inside YouTube’s circular mask.' },
  { id: 'monogram_circular_plate', title: '2. Circular Hardware Plate', desc: 'Identical materials, bevel rim light, and drop shadow as the squircle, but with a circular chassis that naturally matches YouTube.' },
  { id: 'monogram_edge_bevel', title: '3. Full-Bleed Beveled Disc', desc: 'The bevel rim lighting lines the exact circular perimeter of YouTube’s avatar, turning the entire profile circle into a machined hardware button.' }
];

const cards = labels.map(item => {
  const svg = fs.readFileSync(path.join(DIR, `${item.id}.svg`), 'utf-8')
    .replace('<svg ', '<svg style="width: 100%; height: 100%; display: block;" ');

  return `
    <div style="background: #0d0e14; border: 1px solid #1a1b24; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 16px 36px rgba(0,0,0,0.6);">
      <div style="font-size: 17px; font-weight: 700; color: #F0ECE1; margin-bottom: 6px; text-align: center;">${item.title}</div>
      <div style="font-size: 11px; color: #76798e; margin-bottom: 24px; text-align: center; height: 32px; line-height: 1.4;">${item.desc}</div>

      <!-- Raw 800x800 square view -->
      <div style="font-size: 10px; font-family: monospace; color: #525468; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">Raw Square File View</div>
      <div style="width: 200px; height: 200px; border-radius: 8px; overflow: hidden; border: 1px solid #222330; margin-bottom: 24px;">
        ${svg}
      </div>

      <!-- YouTube Circular Crop Preview -->
      <div style="font-size: 10px; font-family: monospace; color: #FF2A1F; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">YouTube Circle Mask Preview</div>
      <div style="width: 200px; height: 200px; border-radius: 50%; overflow: hidden; border: 2px solid #33364a; box-shadow: 0 10px 24px rgba(0,0,0,0.8); margin-bottom: 20px;">
        ${svg}
      </div>

      <!-- YouTube Comment Simulation -->
      <div style="width: 100%; background: #14151c; border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; gap: 10px;">
        <div style="width: 36px; height: 36px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
          ${svg}
        </div>
        <div style="font-size: 11px; color: #ccc;">
          <b style="color: #fff;">f(x) Studio</b> <span style="color: #666;">• 48K subs</span>
          <div style="color: #999; font-size: 10px;">Comment preview at 36px scale</div>
        </div>
      </div>
    </div>
  `;
}).join('');

const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 36px 40px; background: #040406;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #fff; width: 1920px; height: 800px; overflow: hidden;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; flex-grow: 1; }
  </style>
</head>
<body>
  <div style="border-bottom: 1px solid #161720; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div>
      <div style="font-size: 26px; font-weight: 800; color: #F0ECE1;">f(x) Monogram // YouTube Fit Variations</div>
      <div style="font-size: 12px; color: #6b6e82; font-family: monospace; margin-top: 4px;">Preserving 100% of the fx_monogram_icon.svg materials, chiseled bone glyph, and bevel lighting</div>
    </div>
    <div style="font-size: 11px; font-family: monospace; color: #525468;">CALIBRATED FOR YOUTUBE CIRCLE CROP</div>
  </div>
  <div class="grid">
    ${cards}
  </div>
</body>
</html>
`;

await pageSheet.setContent(html);
const sheetPath = path.join(DIR, 'monogram_yt_comparison.png');
await pageSheet.screenshot({ path: sheetPath, type: 'png' });
console.log(`Rendered comparison sheet: ${sheetPath}`);

await browser.close();
