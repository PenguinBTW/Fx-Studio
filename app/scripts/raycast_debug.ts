import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:5173/?export=1&project=music_video');
await page.waitForFunction(() => (window as any).__motion?.ready);

const hit = await page.evaluate(async () => {
  const motion = (window as any).__motion;
  await motion.still(97.11);
  const engine = (window as any).__engine || motion.engine;
  // Let's find the active scene
  const app = (window as any).__app;
  const scene = motion.activeScene || (window as any).__scene;
  const THREE = (window as any).THREE;
  
  // Let's inspect objects in the Three.js scene
  const results: any[] = [];
  if (scene && scene.threeScene && scene.camera) {
    const raycaster = new THREE.Raycaster();
    // Center-top of screen in NDC: (0, 0.4)
    raycaster.setFromCamera(new THREE.Vector2(0, 0.3), scene.camera);
    const intersects = raycaster.intersectObjects(scene.threeScene.children, true);
    for (const h of intersects.slice(0, 5)) {
      results.push({
        name: h.object.name || h.object.type,
        parent: h.object.parent?.name,
        distance: h.distance,
        mat: h.object.material?.name || h.object.material?.type
      });
    }
  }
  return results;
});

console.log('Raycast hit:', JSON.stringify(hit, null, 2));
await browser.close();
