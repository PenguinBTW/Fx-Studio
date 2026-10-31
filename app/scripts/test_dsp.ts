#!/usr/bin/env bun
// Test suite for f(x) Studio v0.8.0 Cinematic DSP Suite
//   bun scripts/test_dsp.ts

import {
  applyVocalSanctuary,
  applySplitBandDuck,
  applyLookaheadLimiter,
  applyPreDropVacuum,
} from '../src/engine/audio';

let failures = 0;

function check(cond: boolean, desc: string): void {
  if (cond) {
    console.log(`[PASS] ${desc}`);
  } else {
    console.error(`[FAIL] ${desc}`);
    failures++;
  }
}

console.log('=== f(x) Studio v0.8.0 Cinematic DSP Test Suite ===\n');

const SR = 48000;

// 1. Vocal Sanctuary Dynamic Notch Filter Tests
console.log('--- 1. Vocal Sanctuary Dynamic Notch Filter Tests ---');
const nFrames = SR * 1; // 1 second
const pcm2200 = new Float32Array(nFrames * 2);
const pcm100 = new Float32Array(nFrames * 2);
const voActive = new Float32Array(nFrames).fill(1.0); // Active VO envelope

for (let i = 0; i < nFrames; i++) {
  const t = i / SR;
  const s2200 = 0.5 * Math.sin(2 * Math.PI * 2200 * t);
  const s100 = 0.5 * Math.sin(2 * Math.PI * 100 * t);
  pcm2200[i * 2] = s2200;
  pcm2200[i * 2 + 1] = s2200;
  pcm100[i * 2] = s100;
  pcm100[i * 2 + 1] = s100;
}

const notched2200 = applyVocalSanctuary(pcm2200, voActive, { sampleRate: SR, centerHz: 2200, cutDb: -3.5 });
const notched100 = applyVocalSanctuary(pcm100, voActive, { sampleRate: SR, centerHz: 2200, cutDb: -3.5 });

// Check RMS attenuation at 2200 Hz: expected attenuation ~ -3.5 dB (factor ~ 0.668)
let rmsIn2200 = 0, rmsOut2200 = 0;
let rmsIn100 = 0, rmsOut100 = 0;
for (let i = Math.floor(nFrames * 0.2); i < Math.floor(nFrames * 0.8); i++) {
  rmsIn2200 += pcm2200[i * 2]! ** 2;
  rmsOut2200 += notched2200[i * 2]! ** 2;
  rmsIn100 += pcm100[i * 2]! ** 2;
  rmsOut100 += notched100[i * 2]! ** 2;
}
const gainRatio2200 = Math.sqrt(rmsOut2200 / rmsIn2200);
const gainRatio100 = Math.sqrt(rmsOut100 / rmsIn100);

check(gainRatio2200 < 0.75 && gainRatio2200 > 0.60, `2200 Hz tone is notched by ~-3.5 dB (ratio=${gainRatio2200.toFixed(3)})`);
check(gainRatio100 > 0.98, `100 Hz bass tone passes through notch filter untouched (ratio=${gainRatio100.toFixed(3)})`);

// 2. Split-Band Spectral Ducking (Sub-Bass Decoupled) Tests
console.log('\n--- 2. Split-Band Spectral Ducking Tests ---');
const duckEnv = new Float32Array(nFrames).fill(1.0); // 100% duck active
const subBassPcm = new Float32Array(nFrames * 2);
const midHighPcm = new Float32Array(nFrames * 2);

for (let i = 0; i < nFrames; i++) {
  const t = i / SR;
  const sSub = 0.5 * Math.sin(2 * Math.PI * 80 * t); // 80 Hz sub
  const sMid = 0.5 * Math.sin(2 * Math.PI * 1000 * t); // 1000 Hz mid
  subBassPcm[i * 2] = sSub;
  subBassPcm[i * 2 + 1] = sSub;
  midHighPcm[i * 2] = sMid;
  midHighPcm[i * 2 + 1] = sMid;
}

const duckedSub = applySplitBandDuck(subBassPcm, duckEnv, { splitHz: 250, attenDb: -4.5, sampleRate: SR });
const duckedMid = applySplitBandDuck(midHighPcm, duckEnv, { splitHz: 250, attenDb: -4.5, sampleRate: SR });

let rmsSubIn = 0, rmsSubOut = 0;
let rmsMidIn = 0, rmsMidOut = 0;
for (let i = Math.floor(nFrames * 0.2); i < Math.floor(nFrames * 0.8); i++) {
  rmsSubIn += subBassPcm[i * 2]! ** 2;
  rmsSubOut += duckedSub[i * 2]! ** 2;
  rmsMidIn += midHighPcm[i * 2]! ** 2;
  rmsMidOut += duckedMid[i * 2]! ** 2;
}

const subRatio = Math.sqrt(rmsSubOut / rmsSubIn);
const midRatio = Math.sqrt(rmsMidOut / rmsMidIn);

check(subRatio > 0.95, `Sub-bass (80 Hz) remains decoupled and steady during ducking (ratio=${subRatio.toFixed(3)})`);
check(midRatio < 0.65 && midRatio > 0.55, `Mid frequencies (1000 Hz) duck by ~-4.5 dB (ratio=${midRatio.toFixed(3)})`);

// 3. Lookahead True Peak Limiter Tests
console.log('\n--- 3. Lookahead True Peak Limiter Tests ---');
const loudPcm = new Float32Array(nFrames * 2);
for (let i = 0; i < nFrames; i++) {
  const t = i / SR;
  // Overdriven signal reaching +6 dBFS (amplitude 2.0)
  const loud = 2.0 * Math.sin(2 * Math.PI * 500 * t);
  loudPcm[i * 2] = loud;
  loudPcm[i * 2 + 1] = loud;
}

const ceilingDb = -1.5;
const maxAllowedLinear = Math.pow(10, ceilingDb / 20); // ~0.841395
const limited = applyLookaheadLimiter(loudPcm, ceilingDb, 1.5, SR);

let maxPeak = 0;
for (let i = 0; i < limited.length; i++) {
  const abs = Math.abs(limited[i]!);
  if (abs > maxPeak) maxPeak = abs;
}

check(maxPeak <= maxAllowedLinear + 1e-3, `true peak limiter strictly clamps to <= -1.5 dBTP (max=${maxPeak.toFixed(4)}, ceiling=${maxAllowedLinear.toFixed(4)})`);

// 4. Pre-Drop Silence Vacuum Tests
console.log('\n--- 4. Pre-Drop Silence Vacuum Tests ---');
const dropPcm = new Float32Array(nFrames * 2).fill(0.8);
const dropSample = Math.floor(SR * 0.5); // Drop lands at 0.5s
const gapMs = 60; // 60ms gap
applyPreDropVacuum(dropPcm, dropSample, gapMs, SR);

// Verify exact digital zero in the vacuum window: [dropSample - gapMs + 2ms, dropSample)
const gapSamples = Math.floor((gapMs / 1000) * SR);
const verifyStart = dropSample - gapSamples + Math.floor(0.002 * SR);
let zeroViolations = 0;
for (let i = verifyStart; i < dropSample; i++) {
  if (dropPcm[i * 2] !== 0 || dropPcm[i * 2 + 1] !== 0) zeroViolations++;
}
check(zeroViolations === 0, 'pre-drop vacuum produces exact digital zero before the drop');

console.log('\n=======================================');
if (failures === 0) {
  console.log('RESULT: ALL DSP TESTS PASSED (0 failures)\n');
  process.exit(0);
} else {
  console.error(`RESULT: ${failures} TEST(S) FAILED\n`);
  process.exit(1);
}
