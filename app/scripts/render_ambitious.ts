import { chromium } from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs';

const APP = path.resolve(import.meta.dir, '..');
const ROOT = path.resolve(APP, '..');
const DIR = path.join(ROOT, 'out/logos/ambitious');

const concepts = [
  { id: 'concept1_kinetic_ligature', title: '1. The Kinetic Ligature', tag: 'CONTINUOUS UNBROKEN MATHEMATICAL RIBBON', desc: 'The function curve f and variable x physically fuse into a single continuous woven gesture, interlocking at the golden ratio.' },
  { id: 'concept2_isometric_monolith', title: '2. The 3D Isometric Monolith', tag: 'CHISELED GEOMETRIC SPATIAL ENGINE', desc: 'True architectural 3D faceted geometry with direct overhead studio lighting, deep shadow walls, and mechanical chamfers.' },
  { id: 'concept3_waveform_singularity', title: '3. The Waveform Singularity', tag: 'PHYSICAL FUNCTION HARMONICS f(t)', desc: 'An active sine wave displacement cuts across the coordinate crosshairs, igniting a high-energy laser pulse singularity.' },
  { id: 'concept4_aperture_iris', title: '4. The Aperture Iris', tag: 'CINEMA OPTICAL APERTURE IRIS', desc: 'Six rotating carbon mechanical shutter blades forming a camera pupil with the chiseled f(x) emblem suspended in negative space.' },
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });

// 1. Render individual PNGs (1600x1600)
const pageSingle = await browser.newPage({ viewport: { width: 800, height: 800 }, deviceScaleFactor: 2 });
for (const c of concepts) {
  const svgPath = path.join(DIR, `${c.id}.svg`);
  const pngPath = path.join(DIR, `${c.id}.png`);
  const content = fs.readFileSync(svgPath, 'utf-8');
  await pageSingle.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden;background:#020204;">${content}</body></html>`);
  await pageSingle.screenshot({ path: pngPath, type: 'png' });
  console.log(`Rendered ${c.id}.png`);
}
await pageSingle.close();

// 2. Render comparison sheet
const pageSheet = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

const cards = concepts.map(item => {
  let svg = fs.readFileSync(path.join(DIR, `${item.id}.svg`), 'utf-8');
  svg = svg.replace('<svg ', '<svg style="width: 100%; height: 100%; display: block;" ');

  return `
    <div style="background: #0b0c12; border: 1px solid #1a1c28; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 16px 36px rgba(0,0,0,0.7);">
      <div style="font-size: 10px; font-family: monospace; color: #FF2A1F; letter-spacing: 1.5px; margin-bottom: 6px; text-transform: uppercase;">${item.tag}</div>
      <div style="font-size: 18px; font-weight: 800; color: #F0ECE1; margin-bottom: 8px; text-align: center;">${item.title}</div>
      <div style="font-size: 11px; color: #72758a; margin-bottom: 20px; text-align: center; height: 36px; line-height: 1.4;">${item.desc}</div>

      <!-- Master Avatar (220px) -->
      <div style="width: 220px; height: 220px; border-radius: 50%; overflow: hidden; border: 2px solid #282a3c; box-shadow: 0 12px 30px rgba(0,0,0,0.8); margin-bottom: 24px;">
        ${svg}
      </div>

      <!-- YouTube Channel Header (64px) -->
      <div style="width: 100%; background: #13141c; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">
        <div style="width: 52px; height: 52px; border-radius: 50%; overflow: hidden; flex-shrink: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
          ${svg}
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden;">
          <div style="font-size: 13px; font-weight: 700; color: #fff;">f(x) Studio</div>
          <div style="font-size: 10px; color: #888;">@fxstudio • 48K subs</div>
        </div>
      </div>

      <!-- YouTube Comment (36px) -->
      <div style="width: 100%; background: #0f1016; border-radius: 8px; padding: 8px 12px; display: flex; gap: 10px; align-items: center;">
        <div style="width: 32px; height: 32px; border-radius: 50%; overflow: hidden; flex-shrink: 0;">
          ${svg}
        </div>
        <div style="font-size: 11px; color: #aaa; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <b style="color: #fff;">f(x) Studio:</b> 60fps procedural motion
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
      color: #fff; width: 1920px; height: 1080px; overflow: hidden;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; flex-grow: 1; }
  </style>
</head>
<body>
  <div style="border-bottom: 1px solid #161722; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
    <div>
      <div style="font-size: 28px; font-weight: 900; letter-spacing: -0.5px; color: #F0ECE1;">f(x) Studio // Ambitious Trademark Concepts</div>
      <div style="font-size: 13px; color: #72758a; font-family: monospace; margin-top: 4px;">Pushing Beyond Standard Typography into Mathematical Sculptures & Visual Physics</div>
    </div>
    <div style="font-size: 11px; font-family: monospace; color: #525468; text-align: right;">
      ARCHITECTURAL SUITE<br>
      CIRCULAR YOUTUBE NATIVE
    </div>
  </div>
  <div class="grid">
    ${cards}
  </div>
  <div style="display: flex; justify-content: space-between; font-size: 11px; font-family: monospace; color: #424458; border-top: 1px solid #12131a; padding-top: 12px; margin-top: 16px;">
    <div>ALL EMBLEMS HAND-CRAFTED BESPOKE VECTOR SPLINES</div>
    <div>VIOPLS DESIGN SYSTEM // --VOID --BONE --SIGNAL</div>
  </div>
</body>
</html>
`;

await pageSheet.setContent(html);
const sheetPath = path.join(DIR, 'ambitious_concepts_comparison.png');
await pageSheet.screenshot({ path: sheetPath, type: 'png' });
console.log(`Rendered comparison sheet to ${sheetPath}`);

await browser.close();
