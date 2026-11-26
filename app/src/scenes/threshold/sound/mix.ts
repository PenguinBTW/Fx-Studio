// THRESHOLD long-form mix architecture. Z1 is the first complete vertical-slice bed;
// all source stems are synthesized by ./build_stems.ts into ./generated (not committed).
import { defineMix } from '../../../engine/audio/manifest';

export default defineMix({
  sampleRate: 48000,
  build: '../../../../scripts/threshold_build_stems.ts',
  stems: [
    // Continuous zone room-tone architecture. Edge fades are baked into each generated bed,
    // so overlapping transition windows crossfade physical spaces rather than hard-cutting them.
    { id: 'z0_machine_room_tone', file: 'generated/z0_machine_room_tone.wav', bus: 'ambient', at: 0.0, gainDb: -7.0 },
    { id: 'z1_fluorescent_bed', file: 'generated/z1_fluorescent_bed.wav', bus: 'ambient', at: 4.0, gainDb: -5.5 },
    { id: 'z2_playroom_room_tone', file: 'generated/z2_playroom_room_tone.wav', bus: 'ambient', at: 29.6, gainDb: -6.5 },
    { id: 'z3_pool_room_tone', file: 'generated/z3_pool_room_tone.wav', bus: 'ambient', at: 54.6, gainDb: -6.0 },
    { id: 'z4_library_room_tone', file: 'generated/z4_library_room_tone.wav', bus: 'ambient', at: 79.4, gainDb: -6.5 },
    { id: 'z5_motel_room_tone', file: 'generated/z5_motel_room_tone.wav', bus: 'ambient', at: 104.7, gainDb: -6.0 },
    { id: 'z6_theatre_room_tone', file: 'generated/z6_theatre_room_tone.wav', bus: 'ambient', at: 129.4, gainDb: -6.5 },
    { id: 'z7_cathedral_room_tone', file: 'generated/z7_cathedral_room_tone.wav', bus: 'ambient', at: 149.5, gainDb: -5.5 },
    { id: 'z8_home_room_tone', file: 'generated/z8_home_room_tone.wav', bus: 'ambient', at: 194.4, gainDb: -6.5 },
    { id: 'end_office_afterimage_tone', file: 'generated/end_office_afterimage_tone.wav', bus: 'ambient', at: 225.0, gainDb: -7.0 },
    // Material/event cues localized to each spatial seam. They sit on sfx so the ambient
    // crossfade remains continuous while the physical transition object is unmistakable.
    { id: 'z2_playroom_events', file: 'generated/z2_playroom_events.wav', bus: 'sfx', at: 29.60, gainDb: -3.5 },
    { id: 't2_plastic_to_water', file: 'generated/t2_plastic_to_water.wav', bus: 'sfx', at: 54.60, gainDb: -1.0 },
    { id: 'z3_pool_events', file: 'generated/z3_pool_events.wav', bus: 'sfx', at: 54.60, gainDb: -2.5 },
    { id: 't3_ink_to_paper', file: 'generated/t3_ink_to_paper.wav', bus: 'sfx', at: 79.40, gainDb: -1.5 },
    { id: 'z4_library_events', file: 'generated/z4_library_events.wav', bus: 'sfx', at: 79.40, gainDb: -2.5 },
    { id: 't4_page_slam_neon', file: 'generated/t4_page_slam_neon.wav', bus: 'sfx', at: 104.70, gainDb: 0.5 },
    { id: 'z5_motel_events', file: 'generated/z5_motel_events.wav', bus: 'sfx', at: 104.70, gainDb: -2.5 },
    { id: 't5_static_to_felt', file: 'generated/t5_static_to_felt.wav', bus: 'sfx', at: 129.40, gainDb: -1.5 },
    { id: 'z6_theatre_events', file: 'generated/z6_theatre_events.wav', bus: 'sfx', at: 129.40, gainDb: -2.5 },
    { id: 't6_felt_door_push', file: 'generated/t6_felt_door_push.wav', bus: 'sfx', at: 149.50, gainDb: 0.0 },
    { id: 'z7_cathedral_events', file: 'generated/z7_cathedral_events.wav', bus: 'sfx', at: 149.50, gainDb: -2.5 },
    { id: 'z7_coldopen_exact_replay', file: 'generated/coldopen_arm_replay.wav', bus: 'sfx', at: 171.30, gainDb: -2.5 },
    { id: 't7_lightfall_home', file: 'generated/t7_lightfall_home.wav', bus: 'sfx', at: 194.40, gainDb: -1.0 },
    { id: 'z0_coldopen_arm_reference', file: 'generated/coldopen_arm_replay.wav', bus: 'sfx', at: 1.20, gainDb: -2.5 },
    { id: 'z8_home_events', file: 'generated/z8_home_events.wav', bus: 'sfx', at: 194.40, gainDb: -2.5 },
    { id: 'end_office_events', file: 'generated/end_office_events.wav', bus: 'sfx', at: 225.00, gainDb: -3.0 },
    { id: 'z1_phone_ring', file: 'generated/z1_phone_ring.wav', bus: 'sfx', at: 8.28, gainDb: 2.5 },
    { id: 'z1_receiver_breath', file: 'generated/z1_receiver_breath.wav', bus: 'sfx', at: 11.05, gainDb: -1.5 },
    { id: 'z1_ceiling_breath', file: 'generated/z1_ceiling_breath.wav', bus: 'sfx', at: 12.75, gainDb: -1.0 },
    { id: 'z1_ceiling_creaks', file: 'generated/z1_ceiling_creaks.wav', bus: 'sfx', at: 18.45, gainDb: 2.0 },
    { id: 'z1_run_carpet', file: 'generated/z1_run_carpet.wav', bus: 'sfx', at: 19.28, gainDb: 4.5 },
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
    // T4 page-slam true-black pause: normalized 0.20-0.333 of the 0.6s window.
    { id: 't4_page_slam_silence', from: 104.82, to: 104.90 },
  ],
  master: { lufs: -16, truePeak: -1.2, limiterLookaheadMs: 5 },
});
