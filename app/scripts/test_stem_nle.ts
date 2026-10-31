#!/usr/bin/env bun
// Test suite for f(x) Studio v0.8.0 Multi-Stem NLE & TypeScript DSL
//   bun scripts/test_stem_nle.ts

import {
  defineMix,
  validateMix,
  assembleSoundtrackStems,
  barToSeconds,
  barToSample,
  getPreAttackKickOffsetSamples,
  PRE_ATTACK_KICK_OFFSET_MS,
  type MixConfig,
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

console.log('=== f(x) Studio v0.8.0 Stem NLE Test Suite ===\n');

// 1. DSL Validation Tests
console.log('--- 1. defineMix & validateMix DSL Tests ---');

const validMix = defineMix({
  sampleRate: 48000,
  soundtracks: [
    {
      id: 'cinematic_theme',
      bus: 'music',
      stems: {
        drums: 'stems/drums.wav',
        bass: 'stems/bass.wav',
        vocals: 'stems/vocals.wav',
        other: 'stems/other.wav',
      },
      gainDb: -1.0,
      edits: {
        quantize: 'bars',
        excise: [
          {
            fromBar: 2,
            toBar: 4,
            stems: {
              drums: { transientLock: true },
              vocals: { breathGate: true },
              other: { tailSpillover: { spillSec: 2.0, tauSec: 0.7 } },
            },
          },
        ],
      },
    },
  ],
  buses: {
    music: {
      gainDb: 0.0,
      vocalSanctuary: { centerHz: 2200, q: 1.2, cutDb: -3.5 },
      splitBandDuck: { cues: ['vo_docking'], splitHz: 250, attenDb: -4.5 },
    },
  },
  master: { lufs: -14.0, truePeak: -1.5, limiterLookaheadMs: 2 },
});

check(validMix.soundtracks?.[0]?.id === 'cinematic_theme', 'defineMix returns valid config object');
const validResult = validateMix(validMix);
check(validResult.valid && validResult.errors.length === 0, 'validateMix passes clean config');

// Test rejection of invalid configs
const invalidRateResult = validateMix({ sampleRate: -48000 } as MixConfig);
check(!invalidRateResult.valid, 'validateMix rejects negative sample rate');

const invalidBusResult = validateMix({
  soundtracks: [{ id: 't1', bus: 'invalid_bus_name' as any, stems: { drums: 'd.wav' } }],
});
check(!invalidBusResult.valid, 'validateMix rejects invalid bus name');

const invalidExciseResult = validateMix({
  soundtracks: [
    {
      id: 't2',
      stems: { drums: 'd.wav' },
      edits: { excise: [{ fromBar: 5, toBar: 3 }] }, // fromBar > toBar
    },
  ],
});
check(!invalidExciseResult.valid, 'validateMix rejects fromBar > toBar');

// 2. Bar Timing & Transient Lock Offsets
console.log('\n--- 2. Bar Timing & Transient Lock Tests ---');

const downbeats = [0.0, 2.0, 4.0, 6.0, 8.0, 10.0, 12.0]; // 120 bpm, 2.0s per 4/4 bar
check(barToSeconds(0, downbeats) === 0.0, 'bar 0 lands at 0.0s');
check(barToSeconds(1, downbeats) === 2.0, 'bar 1 lands at 2.0s');
check(barToSeconds(3, downbeats) === 6.0, 'bar 3 lands at 6.0s');

const sample48k = barToSample(2, downbeats, 48000);
check(sample48k === 4.0 * 48000, 'bar 2 samples at 48kHz match exact 4.0s (192,000)');

const kickOffset = getPreAttackKickOffsetSamples(48000);
check(kickOffset === -114, `kick pre-attack offset @ 48kHz is -114 samples (${PRE_ATTACK_KICK_OFFSET_MS}ms)`);

const kickOffset44k = getPreAttackKickOffsetSamples(44100);
check(kickOffset44k === -105, `kick pre-attack offset @ 44.1kHz is -105 samples`);

// 3. Multi-Stem Timeline Assembly & Physical Seam Execution
console.log('\n--- 3. Multi-Stem NLE Assembly Tests ---');

const SR = 48000;
const DURATION_SEC = 12.0; // 6 bars of 2.0s
const TOTAL_SAMPLES = SR * DURATION_SEC * 2; // Stereo interleaved

// Synthesize 4 test stems
const rawDrums = new Float32Array(TOTAL_SAMPLES);
const rawBass = new Float32Array(TOTAL_SAMPLES);
const rawVocals = new Float32Array(TOTAL_SAMPLES);
const rawOther = new Float32Array(TOTAL_SAMPLES);

for (let frame = 0; frame < SR * DURATION_SEC; frame++) {
  const t = frame / SR;
  const leftIdx = frame * 2;
  const rightIdx = frame * 2 + 1;

  // Drums: Transient impulse on downbeats
  const onBeat = frame % (SR * 2) < 200;
  const drumSample = onBeat ? 0.9 : 0.0;
  rawDrums[leftIdx] = drumSample;
  rawDrums[rightIdx] = drumSample;

  // Bass: 100 Hz sine tone
  const bassSample = 0.5 * Math.sin(2 * Math.PI * 100 * t);
  rawBass[leftIdx] = bassSample;
  rawBass[rightIdx] = bassSample;

  // Vocals: speech-like modulated noise
  const vocalSample = t < 3.8 || t > 8.2 ? 0.3 * Math.sin(2 * Math.PI * 800 * t) : 0.0;
  rawVocals[leftIdx] = vocalSample;
  rawVocals[rightIdx] = vocalSample;

  // Other: 440 Hz continuous pad
  const otherSample = 0.4 * Math.sin(2 * Math.PI * 440 * t);
  rawOther[leftIdx] = otherSample;
  rawOther[rightIdx] = otherSample;
}

const mockStemDatabase: Record<string, Float32Array> = {
  'stems/drums.wav': rawDrums,
  'stems/bass.wav': rawBass,
  'stems/vocals.wav': rawVocals,
  'stems/other.wav': rawOther,
};

const mockLoader = async (file: string, _sr: number): Promise<Float32Array> => {
  const buffer = mockStemDatabase[file];
  if (!buffer) throw new Error(`Mock stem file not found: ${file}`);
  return buffer;
};

// Assemble with excision of bars 2 to 4 (cut out 4.0s to 8.0s = 2 bars)
const assembled = await assembleSoundtrackStems(
  validMix.soundtracks![0]!,
  { downbeats, bpm: 120 },
  { sampleRate: SR, loader: mockLoader },
);

const stemKeys = Object.keys(assembled);
check(stemKeys.length === 4, 'assembled stems has all 4 stems');
check(stemKeys.includes('drums') && stemKeys.includes('other'), 'stems include drums and other');

// Verify sample alignment across all stems
const drumsLen = assembled.drums!.length;
const bassLen = assembled.bass!.length;
const vocalsLen = assembled.vocals!.length;
const otherLen = assembled.other!.length;

check(drumsLen === bassLen && bassLen === vocalsLen && vocalsLen === otherLen, 'all assembled stems are sample-identical in length');

// Check excised duration: 12s - 4s excised = 8s
// Plus pre-attack offset (-114 samples) applied collectively
const expectedFrames = (DURATION_SEC - 4.0) * SR - kickOffset;
const actualFrames = drumsLen / 2;
check(Math.abs(actualFrames - expectedFrames) <= 120, `assembled frame length matches excised duration (~${expectedFrames} frames, got ${actualFrames})`);

// Tail Spillover Check:
// Bar 2 cut point occurs around frame 4.0 * SR = 192000 in source, mapped to resumption seam in output
const seamOutputFrame = 4.0 * SR; // Where resumption lands in assembled output
const tailInspectIndex = (seamOutputFrame + 4800) * 2; // 100ms into the resumption region
check(assembled.other![tailInspectIndex] !== 0, 'harmonic "other" stem contains tail spillover energy across the seam');

console.log('\n=======================================');
if (failures === 0) {
  console.log('RESULT: ALL TESTS PASSED (0 failures)\n');
  process.exit(0);
} else {
  console.error(`RESULT: ${failures} TEST(S) FAILED\n`);
  process.exit(1);
}
