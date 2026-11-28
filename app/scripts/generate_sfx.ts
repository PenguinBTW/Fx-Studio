// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// Flagship Bespoke SFX Synthesis Pipeline for 'The Memory Wall' (Viopls)
// Generates 48kHz 24-bit studio stereo stems with layered acoustic transients,
// pneumatic discharge, magnetic eddy braking, and physical metallic latching.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderCue, mkStereo, type Stereo, encodeWav } from './sfx/synth';

const outDir = join(import.meta.dir, '../src/scenes/memory_wall/audio/sfx');

function mixStereo(a: Stereo, b: Stereo, gainB = 1.0): Stereo {
  const len = Math.max(a.l.length, b.l.length);
  const out = mkStereo(len);
  for (let i = 0; i < len; i++) {
    const al = i < a.l.length ? a.l[i]! : 0;
    const ar = i < a.r.length ? a.r[i]! : 0;
    const bl = i < b.l.length ? b.l[i]! * gainB : 0;
    const br = i < b.r.length ? b.r[i]! * gainB : 0;
    out.l[i] = al + bl;
    out.r[i] = ar + br;
  }
  return out;
}

function normalizeStereo(st: Stereo, targetPeak = 0.92): Stereo {
  let pk = 0;
  for (let i = 0; i < st.l.length; i++) {
    pk = Math.max(pk, Math.abs(st.l[i]!), Math.abs(st.r[i]!));
  }
  if (pk > 0) {
    const scale = targetPeak / pk;
    for (let i = 0; i < st.l.length; i++) {
      st.l[i] *= scale;
      st.r[i] *= scale;
    }
  }
  return st;
}

console.log(`Generating studio-grade multi-layer SFX into ${outDir}...`);

// 1. Spindle Thrum (Continuous 55Hz Electromagnetic Motor Drive with Harmonics)
const thrumRes = renderCue({
  id: 'spindle_thrum',
  recipe: 'thrum',
  params: { dur: 12.0, f: 55, am: 8.0, amDepth: 0.45 },
  seed: 101,
});
writeFileSync(join(outDir, 'spindle_thrum.wav'), thrumRes.wav);
console.log('  ✓ spindle_thrum.wav');

// 2. Diverter Clamp (High-Pressure Hydraulic Manifold Strike + Heavy Pneumatic Rupture)
const clampImpact = renderCue({
  id: 'diverter_impact',
  recipe: 'subHit',
  params: { dur: 2.4, f0: 160, f1: 38, drop: 0.18, decay: 0.9, click: 0.4, wet: 0.2 },
  seed: 202,
});
const clampAir = renderCue({
  id: 'diverter_air',
  recipe: 'rupture',
  params: { bend: 0.08, tail: 1.6, f0: 110, f1: 42, crackleRate: 180, crackleLevel: 0.95, wet: 0.3 },
  seed: 203,
});
const clampMixed = normalizeStereo(mixStereo(clampImpact.audio, clampAir.audio, 0.85), 0.92);
writeFileSync(join(outDir, 'diverter_clamp.wav'), encodeWav(clampMixed));
console.log('  ✓ diverter_clamp.wav (Layered Hydraulic Impact + Pneumatic Rupture)');

// 3. Seam Drop 808 (Deep 34Hz Transition Sub-Drop Transient)
const dropRes = renderCue({
  id: 'seam_drop_808',
  recipe: 'subHit',
  params: { dur: 3.4, f0: 135, f1: 32, drop: 0.22, decay: 1.4, click: 0.25, wet: 0.2 },
  seed: 303,
});
writeFileSync(join(outDir, 'seam_drop_808.wav'), dropRes.wav);
console.log('  ✓ seam_drop_808.wav');

// 4. Aperture Whoosh (Spectral Kinetic Iris Expansion)
const whooshRes = renderCue({
  id: 'aperture_whoosh',
  recipe: 'whoosh',
  params: { dur: 1.8, cutLo: 220, cutHi: 7200, q: 1.6, peakAt: 0.55 },
  seed: 404,
});
writeFileSync(join(outDir, 'aperture_whoosh.wav'), whooshRes.wav);
console.log('  ✓ aperture_whoosh.wav');

// 5. Capsule Dock (Massive 512-bit DRAM Bulkhead Arrestor Slam + Metallic Latch Settle)
const dockImpact = renderCue({
  id: 'dock_sub',
  recipe: 'subHit',
  params: { dur: 2.8, f0: 175, f1: 30, drop: 0.15, decay: 1.1, click: 0.5, wet: 0.25 },
  seed: 501,
});
const dockRupture = renderCue({
  id: 'dock_crack',
  recipe: 'rupture',
  params: { bend: 0.05, tail: 1.8, f0: 130, f1: 45, crackleRate: 220, crackleLevel: 0.9, wet: 0.35 },
  seed: 502,
});
const dockLatch = renderCue({
  id: 'dock_click',
  recipe: 'click',
  params: { freq: 4200 },
  seed: 503,
});
let dockMixed = mixStereo(dockImpact.audio, dockRupture.audio, 0.9);
dockMixed = normalizeStereo(mixStereo(dockMixed, dockLatch.audio, 0.4), 0.94);
writeFileSync(join(outDir, 'capsule_dock.wav'), encodeWav(dockMixed));
console.log('  ✓ capsule_dock.wav (Layered Heavy Arrestor Impact + Caliper Strike + Latch)');

// 6. Shimmer Pulse (Pristine 2800Hz Crystal Overtone Ring-Down)
const shimmerRes = renderCue({
  id: 'shimmer_pulse',
  recipe: 'shimmer',
  params: { dur: 3.0, freq: 2800, voices: 10, ratio: 3.5, attack: 0.01, decay: 1.2, wet: 0.3 },
  seed: 606,
});
writeFileSync(join(outDir, 'shimmer_pulse.wav'), shimmerRes.wav);
console.log('  ✓ shimmer_pulse.wav');

console.log('All flagship multi-layer SFX stems successfully synthesized.');
