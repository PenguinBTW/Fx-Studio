// THRESHOLD long-form mix architecture. Z1 is the first complete vertical-slice bed;
// all source stems are synthesized by ./build_stems.ts into ./generated (not committed).
import { defineMix } from '../../../engine/audio/manifest';

export default defineMix({
  sampleRate: 48000,
  stems: [
    { id: 'z1_fluorescent_bed', file: 'generated/z1_fluorescent_bed.wav', bus: 'ambient', at: 4.0, gainDb: -5.5 },
    { id: 'z1_phone_ring', file: 'generated/z1_phone_ring.wav', bus: 'sfx', at: 8.28, gainDb: 2.5 },
    { id: 'z1_receiver_breath', file: 'generated/z1_receiver_breath.wav', bus: 'sfx', at: 11.05, gainDb: -1.5 },
    { id: 'z1_ceiling_breath', file: 'generated/z1_ceiling_breath.wav', bus: 'sfx', at: 12.75, gainDb: -1.0 },
    { id: 'z1_ceiling_creaks', file: 'generated/z1_ceiling_creaks.wav', bus: 'sfx', at: 18.45, gainDb: 2.0 },
    { id: 'z1_run_carpet', file: 'generated/z1_run_carpet.wav', bus: 'foley_guide', at: 19.28, gainDb: -0.5 },
    { id: 'z1_door_jingle_hit', file: 'generated/z1_door_jingle_hit.wav', bus: 'sfx', at: 27.38, gainDb: 1.5 },
  ],
  buses: {
    ambient: { gainDb: -1.0 },
    sfx: { gainDb: 0.5 },
    foley_guide: { gainDb: -2.0 },
  },
  mutes: [
    // Z0 dead-beam pre-drop vacuum; hard silence survives the limiter by design.
    { id: 'z0_pre_drop_vacuum', from: 3.30, to: 3.55 },
  ],
  master: { lufs: -16, truePeak: -1.2, limiterLookaheadMs: 5 },
});
