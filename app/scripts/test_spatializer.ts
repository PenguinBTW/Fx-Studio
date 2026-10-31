#!/usr/bin/env bun
// Test suite for f(x) Studio v0.8.0 3D Spatial Audio & Cytomic SVF
//   bun scripts/test_spatializer.ts

import {
  calculateVectorPanGains,
  calculateDistanceAttenuation,
  calculateAirAbsorptionCutoff,
  CytomicSVF,
  spatializeSource,
  ParameterSmoother,
  type SpatialSourceConfig,
  type TelemetryFrame,
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

console.log('=== f(x) Studio v0.8.0 3D Spatial Audio Test Suite ===\n');

// 1. Equal-Power Vector Pan Tests
console.log('--- 1. Vector Panning Tests ---');
const [centerL, centerR] = calculateVectorPanGains(0.0);
check(Math.abs(centerL - 1.0) < 1e-4 && Math.abs(centerR - 1.0) < 1e-4, 'center pan yields [1.0, 1.0]');

const [leftL, leftR] = calculateVectorPanGains(-0.65);
check(leftL > leftR, `left pan (-0.65) yields stronger left channel (L=${leftL.toFixed(3)}, R=${leftR.toFixed(3)})`);

const [rightL, rightR] = calculateVectorPanGains(0.65);
check(rightR > rightL, `right pan (+0.65) yields stronger right channel (L=${rightL.toFixed(3)}, R=${rightR.toFixed(3)})`);

// Clamp check beyond maxPan
const [clampL, clampR] = calculateVectorPanGains(1.5, 0.65);
check(Math.abs(clampR - rightR) < 1e-4, 'pan beyond maxPan is correctly clamped');

// 2. Distance Attenuation Tests
console.log('\n--- 2. Distance Attenuation Tests ---');
const d0 = calculateDistanceAttenuation(0.0, 1.0, 18.0);
check(Math.abs(d0 - 1.0) < 1e-4, 'distance 0m yields unity gain (1.0)');

const d1 = calculateDistanceAttenuation(1.0, 1.0, 18.0);
check(Math.abs(d1 - 0.5) < 1e-4, 'distance 1m (refDist) yields 0.5 (-6dB)');

const dFar = calculateDistanceAttenuation(500.0, 1.0, 18.0);
const expectedFloor = Math.pow(10, -18.0 / 20); // ~0.12589
check(Math.abs(dFar - expectedFloor) < 1e-4, `large distance clamps to -18dB floor (${dFar.toFixed(4)})`);

// 3. Air Absorption High-Frequency Roll-off Tests
console.log('\n--- 3. Air Absorption Cutoff Tests ---');
const cutoff0 = calculateAirAbsorptionCutoff(0.0, [20000, 2500], 8.0);
check(Math.abs(cutoff0 - 20000) < 1e-4, '0m distance gives full 20,000 Hz bandwidth');

const cutoffFar = calculateAirAbsorptionCutoff(100.0, [20000, 2500], 8.0);
check(Math.abs(cutoffFar - 2500) < 1.0, '100m distance asymptotes to 2,500 Hz minimum cutoff');

// 4. Cytomic SVF Filter DSP Tests
console.log('\n--- 4. Cytomic SVF Filter Tests ---');
const svf = new CytomicSVF(48000);
svf.setCutoffAndQ(2000, 0.7071);

// Generate 200 Hz tone (should pass) and 10 kHz tone (should attenuate)
const SR = 48000;
let rmsLowIn = 0, rmsLowOut = 0;
let rmsHighIn = 0, rmsHighOut = 0;

for (let i = 0; i < 2400; i++) {
  const t = i / SR;
  // Low tone: 200 Hz
  const lowSample = Math.sin(2 * Math.PI * 200 * t);
  const outLow = svf.process(lowSample).lp;
  if (i > 1000) {
    rmsLowIn += lowSample * lowSample;
    rmsLowOut += outLow * outLow;
  }
}

svf.reset();
svf.setCutoffAndQ(2000, 0.7071);

for (let i = 0; i < 2400; i++) {
  const t = i / SR;
  // High tone: 10 kHz
  const highSample = Math.sin(2 * Math.PI * 10000 * t);
  const outHigh = svf.process(highSample).lp;
  if (i > 1000) {
    rmsHighIn += highSample * highSample;
    rmsHighOut += outHigh * outHigh;
  }
}

const lowRatio = Math.sqrt(rmsLowOut / rmsLowIn);
const highRatio = Math.sqrt(rmsHighOut / rmsHighIn);

check(lowRatio > 0.95, `200 Hz tone passes through 2 kHz SVF with near-unity gain (${lowRatio.toFixed(3)})`);
check(highRatio < 0.10, `10 kHz tone is strongly attenuated by 2 kHz SVF (${highRatio.toFixed(3)})`);

// 5. Full spatializeSource Pipeline
console.log('\n--- 5. Full spatializeSource Pipeline Test ---');

const testDuration = 2.0; // 2 seconds
const testSamples = Math.floor(SR * testDuration);
const pcm = new Float32Array(testSamples * 2);

// Fill with 440 Hz stereo tone
for (let i = 0; i < testSamples; i++) {
  const t = i / SR;
  const s = 0.5 * Math.sin(2 * Math.PI * 440 * t);
  pcm[i * 2] = s;
  pcm[i * 2 + 1] = s;
}

// Telemetry frames: moves from Left (-0.5) to Right (+0.5) over 2 seconds
const telemetryFrames: TelemetryFrame[] = [
  { frame: 0, t: 0.0, sources: { ship: { sourceId: 'ship', pan: -0.5, distance: 2.0, velocity: 10.0, occluded: false } } },
  { frame: 60, t: 1.0, sources: { ship: { sourceId: 'ship', pan: 0.0, distance: 1.0, velocity: 20.0, occluded: false } } },
  { frame: 120, t: 2.0, sources: { ship: { sourceId: 'ship', pan: 0.5, distance: 3.0, velocity: 5.0, occluded: true } } },
];

const config: SpatialSourceConfig = {
  id: 'ship_thruster',
  file: 'sfx/thruster.wav',
  bus: 'sfx',
  bindTo: 'ship',
  spatial: {
    maxPan: 0.65,
    distanceAttenDb: 18.0,
    distanceLpfHz: [20000, 2500],
    occlusionNotchDb: 6.0,
  },
  modulation: {
    velocityToGainDb: [0.0, 3.0],
  },
};

const spatialized = spatializeSource(pcm, telemetryFrames, config, { sampleRate: SR });

check(spatialized.length === pcm.length, 'output PCM length matches input PCM length');

// Check left bias at t = 0.1s
const leftCheckSample = Math.floor(0.1 * SR) * 2;
const leftGain = Math.abs(spatialized[leftCheckSample]!);
const rightGain = Math.abs(spatialized[leftCheckSample + 1]!);
check(leftGain > rightGain, `initial left pan produces left > right energy (L=${leftGain.toFixed(4)}, R=${rightGain.toFixed(4)})`);

// Check right bias at t = 1.9s
const rightCheckSample = Math.floor(1.9 * SR) * 2;
const leftGainEnd = Math.abs(spatialized[rightCheckSample]!);
const rightGainEnd = Math.abs(spatialized[rightCheckSample + 1]!);
check(rightGainEnd > leftGainEnd, `final right pan produces right > left energy (L=${leftGainEnd.toFixed(4)}, R=${rightGainEnd.toFixed(4)})`);

// Check no NaN or infinite values
let hasNaN = false;
for (let i = 0; i < spatialized.length; i++) {
  if (isNaN(spatialized[i]!) || !isFinite(spatialized[i]!)) {
    hasNaN = true;
    break;
  }
}
check(!hasNaN, 'spatialized buffer contains zero NaN or Inf values');

console.log('\n=======================================');
if (failures === 0) {
  console.log('RESULT: ALL SPATIAL TESTS PASSED (0 failures)\n');
  process.exit(0);
} else {
  console.error(`RESULT: ${failures} TEST(S) FAILED\n`);
  process.exit(1);
}
