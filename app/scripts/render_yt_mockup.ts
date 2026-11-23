import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const APP = path.resolve(import.meta.dir, '..');
const ROOT = path.resolve(APP, '..');
const YT_DIR = path.join(ROOT, 'out/logos/yt');

const icons = [
  { id: 'yt_monogram_aperture', label: 'Option A: Obsidian Lens Aperture' },
  { id: 'yt_monogram_vermilion', label: 'Option B: Signal Vermilion Edition' },
  { id: 'yt_monogram_spectral', label: 'Option C: Spectral Dispersion Rim' },
  { id: 'yt_monogram_pure', label: 'Option D: Minimalist High-Contrast' },
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });

// 1. Render each individual 800x800 logo to PNG
const pageSingle = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 2 });
for (const icon of icons) {
  const svgPath = path.join(YT_DIR, `${icon.id}.svg`);
  const pngPath = path.join(YT_DIR, `${icon.id}.png`);
  const content = fs.readFileSync(svgPath, 'utf-8');
  await pageSingle.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden;background:#000;">${content}</body></html>`);
  await pageSingle.screenshot({ path: pngPath, type: 'png' });
  console.log(`Rendered ${icon.id}.png`);
}
await pageSingle.close();

// 2. Build and render the Comprehensive YouTube UI Mockup Comparison (1920 x 1080)
const pageMockup = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

const cardsHtml = icons.map((icon) => {
  let svg = fs.readFileSync(path.join(YT_DIR, `${icon.id}.svg`), 'utf-8');
  svg = svg.replace('<svg ', '<svg style="width: 100%; height: 100%; display: block;" ');
  return `
    <div style="background: #0f0f13; border: 1px solid #1f212d; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 12px 30px rgba(0,0,0,0.5);">
      <div style="font-size: 15px; font-weight: 700; color: #E8E4DA; margin-bottom: 20px; letter-spacing: 0.5px; text-align: center;">${icon.label}</div>
      
      <!-- Large View (220px) -->
      <div style="width: 220px; height: 220px; border-radius: 50%; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.7); border: 2px solid #2a2d3e; margin-bottom: 24px;">
        ${svg}
      </div>

      <!-- Real YouTube Channel Header Simulation (80px) -->
      <div style="width: 100%; background: #181920; border-radius: 12px; padding: 12px 16px; margin-bottom: 14px; display: flex; align-items: center; gap: 14px;">
        <div style="width: 64px; height: 64px; border-radius: 50%; overflow: hidden; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">
          ${svg}
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px; overflow: hidden;">
          <div style="font-size: 14px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px;">
            f(x) Studio
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#aaa"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.4-1.4 3.6 3.6 7.6-7.6L19 8l-9 9z"/></svg>
          </div>
          <div style="font-size: 11px; color: #aaa;">@fxstudio • 48K subscribers</div>
        </div>
      </div>

      <!-- Real YouTube Comment Simulation (40px) -->
      <div style="width: 100%; background: #14141a; border-radius: 10px; padding: 10px 14px; display: flex; gap: 12px; align-items: flex-start;">
        <div style="width: 36px; height: 36px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
          ${svg}
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="font-size: 11px; font-weight: 600; color: #aaa;">@fxstudio <span style="font-weight: 400; color: #666;">• 2 hours ago</span></div>
          <div style="font-size: 12px; color: #eee; line-height: 1.3;">60 fps deterministic temporal motion blur.</div>
        </div>
      </div>
    </div>
  `;
}).join('');

const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 36px 40px; background: #060608;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #fff; width: 1920px; height: 1080px; overflow: hidden;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .header {
      display: flex; justify-content: space-between; align-items: flex-end;
      border-bottom: 1px solid #1a1b24; padding-bottom: 18px; margin-bottom: 24px;
    }
    .grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; flex-grow: 1;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size: 28px; font-weight: 800; letter-spacing: -0.5px; color: #F4F1EA;">f(x) Studio // YouTube Monogram Avatar Suite</div>
      <div style="font-size: 13px; color: #76798e; margin-top: 4px; font-family: monospace;">Circular Crop Safe-Zone & Micro-Scale Legibility Benchmark</div>
    </div>
    <div style="font-size: 11px; font-family: monospace; color: #666; text-align: right;">
      CANVAS: 800×800 CIRCLE<br>
      SCALES: 220px / 64px / 36px
    </div>
  </div>
  <div class="grid">
    ${cardsHtml}
  </div>
  <div style="margin-top: 18px; display: flex; justify-content: space-between; font-size: 11px; font-family: monospace; color: #525468; border-top: 1px solid #14151e; padding-top: 12px;">
    <div>ALL GLYPHS CALIBRATED INSIDE YOUTUBE 80% CIRCULAR CROP RADIUS</div>
    <div>VIOPLS DESIGN SYSTEM // --VOID --BONE --SIGNAL</div>
  </div>
</body>
</html>
`;

await pageMockup.setContent(fullHtml);
const mockupOut = path.join(YT_DIR, 'yt_mockup_preview.png');
await pageMockup.screenshot({ path: mockupOut, type: 'png' });
console.log(`Rendered comprehensive YouTube mockup sheet to ${mockupOut}`);

await browser.close();
