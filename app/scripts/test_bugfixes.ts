// Regression tests for audit bug fixes (pure-logic, no DOM/browser needed).
// Run: bun scripts/test_bugfixes.ts  (also wired into test_milestones.ts)
import { AudioDriver } from '../src/engine/driver';
import { AudioData } from '../src/engine/audio';
import { tokenToRgba } from '../src/engine/tokens';
import { hexToLinear } from '../src/engine/util';
import { parsePalette, computePaletteShares } from './motion/pixel-metrics';
import { CameraRig } from '../src/engine/rig';
import { overlayTextDuck } from '../src/engine/transition';
import { isSameElementPair } from './motion/text-analyzer';

console.log('--- Testing audit bug fixes ---');
let allPassed = true;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) console.log(`PASS ${name}`);
  else { console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`); allPassed = false; }
};

// 1. AudioDriver rms falls back to env()/sample() when rmsAt is absent (AudioData has no rmsAt).
{
  const audio = AudioData.createDummy(5.0, 120);
  (audio as any).rmsAt = undefined;
  const driver = new AudioDriver(audio);
  const s = driver.evaluate(1.0);
  check('driver rms uses env fallback (finite number)', typeof s.data?.rms === 'number' && Number.isFinite(s.data.rms), `got ${s.data?.rms}`);
}

// 2. AudioData tolerates empty / missing beat tables (no NaN, no throw).
{
  const empty = new AudioData({ duration: 5, bpm: 120, fps: 60, beats: [], downbeats: [], sections: [], features: {}, onsets: {} } as any);
  const tb = empty.timeOfBeat(2.5);
  const nb = empty.nearestBeat(1.0);
  check('timeOfBeat/nearestBeat finite on empty beats', Number.isFinite(tb) && Number.isFinite(nb), `got ${tb}, ${nb}`);
  const missing = new AudioData({ duration: 5, bpm: 120 } as any);
  let threw = false;
  try { missing.beatAt(1.0); missing.timeOfBeat(1.0); missing.barAt(1.0); missing.section(1.0); } catch { threw = true; }
  check('missing beats/downbeats/sections default safely', !threw && Array.isArray(missing.beats));
}

// 3. tokenToRgba expands 3-digit hex (parity with palette.rgba) and guards invalid input.
{
  const short = tokenToRgba('#ABC');
  const full = tokenToRgba('#AABBCC');
  check("tokenToRgba('#ABC') === tokenToRgba('#AABBCC')", short === full, `got ${short} vs ${full}`);
  const bad = tokenToRgba('#ZZZZZZ');
  check('tokenToRgba invalid hex falls back to white', bad === 'rgba(255,255,255,1)', `got ${bad}`);
}

// 4. hexToLinear never returns NaN uniforms.
{
  const [r, g, b] = hexToLinear('not-a-hex');
  check('hexToLinear invalid input is finite', [r, g, b].every(Number.isFinite), `got [${r},${g},${b}]`);
}

// 5. parsePalette rejects malformed entries with an informative error; '' still yields defaults.
{
  let msg = '';
  try { parsePalette('foo'); } catch (e) { msg = String((e as Error)?.message ?? e); }
  check("parsePalette('foo') throws informative error", /Malformed|expected/i.test(msg), `got '${msg}'`);
  let msg2 = '';
  try { parsePalette('a=#FFF,b=zzz'); } catch (e) { msg2 = String((e as Error)?.message ?? e); }
  check('parsePalette rejects bad hex informatively', /Malformed|hex/i.test(msg2), `got '${msg2}'`);
  check("parsePalette('') yields defaults", parsePalette('').length >= 5);
}

// 6. computePaletteShares tolerates an empty palette (no crash).
{
  const frame = new Uint8Array(480 * 270 * 4).fill(128);
  let threw = false, other = -1;
  try { other = computePaletteShares(frame, [], 480, 270).otherPct; } catch { threw = true; }
  check('computePaletteShares([]) returns otherPct=100', !threw && other === 100, `threw=${threw} other=${other}`);
}

{
  // Rig path sampling (godview blueprint hook): evalPath must place the
  // rig on the path (arc-length), not leave it at the constructor default.
  const rig = new CameraRig('perspective');
  rig.setPath([
    { t: 0, pos: [0, 1, -10], target: [0, 1, 0] },
    { t: 1, pos: [6, 1, -10], target: [6, 1, 0] },
  ]);
  rig.evalPath(0);
  const p0 = [...rig.position];
  rig.evalPath(1);
  const p1 = [...rig.position];
  const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]!) < 1e-6);
  check('rig.evalPath(0) sits on first waypoint', near(p0, [0, 1, -10]), JSON.stringify(p0));
  check('rig.evalPath(1) sits on last waypoint', near(p1, [6, 1, -10]), JSON.stringify(p1));
  const bare = new CameraRig('perspective');
  let threw = false;
  try { bare.evalPath(0.5); } catch { threw = true; }
  check('rig.evalPath without path falls back safely', !threw && near([...bare.position], [0, 1.8, -8]));
}

{
  // FSPass (engine/gl.ts) prepends `in vec2 vUv;` + `out vec4 fragColor;`
  // to every frag: re-declaring them fails strict GL compilers (black
  // compositor output). RawShaderMaterial files (lines/particles/sdf) own
  // their declarations and are exempt — only FSPass frags are scanned.
  const src = await Bun.file(new URL('../src/engine/graph.ts', import.meta.url)).text();
  const bad = src.split('\n').filter((l) => /^\s*(in vec2 vUv|out vec4 fragColor)\s*;/.test(l));
  check('graph.ts FSPass frags declare no vUv/fragColor', bad.length === 0, bad.join(' | '));
}

// Overlay-text duck across transition seams (transition.ts): outgoing text
// exits fast, incoming text enters late, never both legible at once.
{
  check('duck(1,0) === 1 outside overlaps', overlayTextDuck(1, 0) === 1);
  check('duck(1,1) === 0 after full exit', overlayTextDuck(1, 1) === 0);
  check('duck(0,0) === 0 before entrance', overlayTextDuck(0, 0) === 0);
  check('outgoing text gone by tout=0.35', overlayTextDuck(1, 0.35) === 0);
  check('incoming text silent at tin=0.55', overlayTextDuck(0.55, 0) === 0);
  let dual = false;
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    if (overlayTextDuck(1, u) > 0.15 && overlayTextDuck(u, 0) > 0.15) dual = true;
  }
  check('no seam instant has both sides legible', !dual);
  let mid = false;
  for (let i = 0; i <= 20; i++) {
    const u = 0.35 + (i / 20) * 0.3;
    if (overlayTextDuck(1, u) > 0.15 || overlayTextDuck(u, 0) > 0.15) mid = true;
  }
  check('mid-seam text gap (both sides dim 0.35-0.65)', !mid);
}

// Motion probe: duplicate reports of one element are not collisions.
{
  const rec = (text: string, cx: number, cy: number, w: number, h: number) =>
    ({ text, cx, cy, w, h }) as any;
  const same = rec('PARAMETRIC LATTICE', 200, 150, 400, 48);
  check('identical boxes are one element', isSameElementPair(same, { ...same }, 100));
  check('case/punct variants match', isSameElementPair(rec('Shell-Apex!', 100, 100, 180, 14), rec('shell apex', 100.5, 99, 187, 21), 89));
  check('cross-path duplicate matches', isSameElementPair(rec('SHELL APEX · Y-LOCKED', 1065.3, 161.1, 167.3, 9), rec('SHELL APEX · Y-LOCKED', 1059.9, 163.8, 158.6, 15), 72));
  check('distinct texts never match', !isSameElementPair(rec('IGNITION', 200, 150, 400, 48), rec('PARAMETRIC LATTICE', 200, 150, 400, 48), 68));
  check('distant duplicates still collide', !isSameElementPair(rec('CHORUS', 200, 150, 300, 40), rec('CHORUS', 320, 150, 300, 40), 55));
  check('low-overlap pairs still collide', !isSameElementPair(rec('CHORUS', 200, 150, 300, 40), rec('CHORUS', 210, 150, 300, 40), 8));
  check('bare punctuation never matches', !isSameElementPair(rec('·', 200, 150, 10, 12), rec('·', 200, 150, 10, 12), 100));
}

if (allPassed) {
  console.log('\n>>> ALL BUGFIX CHECKS PASSED <<<');
} else {
  process.exit(1);
}
