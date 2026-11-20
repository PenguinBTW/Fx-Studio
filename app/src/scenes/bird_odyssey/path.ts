// The journey, in one global frame. Bird keys pass exactly through every portal centre at its time.
import * as THREE from 'three';
import { TimeSpline, ScalarSpline, type V3 } from './common';
import type { PortalKind } from './portals';

export const DURATION = 82;

export const PORTALS: { kind: PortalKind; t: number; c: V3; n: V3 }[] = [
  { kind: 'nether', t: 16, c: [0, 14, -230], n: [0, 0, -1] },
  { kind: 'end', t: 32, c: [0, 30, -470], n: [0, -1, 0] },
  { kind: 'aether', t: 48, c: [0, -70, -720], n: [0, 0, -1] },
  { kind: 'sift', t: 64, c: [0, -40, -960], n: [0, 0, -1] },
];

const k = (t: number, p: V3) => ({ t, p });
export const BIRD = new TimeSpline([
  // overworld: dawn valley
  k(-2, [0, 44, 80]), k(0, [0, 38, 52]), k(4, [-6, 22, -6]), k(8, [-16, 13, -72]), k(12, [6, 11, -150]),
  k(14.6, [1, 13.5, -199]), k(16, [0, 14, -230]), k(17.2, [0, 14.5, -255]),
  // nether: lava sea, basalt, crimson & warped groves, then up and over into the End frame
  k(20, [-12, 18, -305]), k(24, [12, 24, -362]), k(27, [-5, 38, -410]), k(29.4, [0, 56, -446]),
  k(30.6, [0, 58, -462]), k(31.35, [0, 46, -469]), k(32, [0, 30, -470]), k(32.6, [0, 15, -471]),
  // end: fall through the void, pull out between the obsidian spires
  k(34, [0, -14, -478]), k(36, [3, -40, -505]), k(40, [12, -58, -568]), k(44, [-8, -64, -648]),
  k(46.8, [0, -69, -697]), k(48, [0, -70, -720]), k(49.2, [0, -69.4, -742]),
  // aether: sea of clouds & floating isles
  k(52, [12, -62, -790]), k(56, [-10, -52, -850]), k(60, [7, -44, -910]), k(62.8, [0, -40.5, -942]),
  k(64, [0, -40, -960]), k(65.2, [0, -40, -978]),
  // the sift: dunes, sand-falls, the hourglass at sunset
  k(68, [-9, -45, -1020]), k(72, [10, -48, -1078]), k(76, [0, -44, -1135]), k(80, [0, -36, -1185]), k(84, [0, -28, -1230]),
]);

/** flap amplitude 0 (glide) .. 1 */
export const FLAP = new ScalarSpline([[0, 0.25], [3, 0.9], [6, 0.35], [9, 0.9], [13, 0.4], [15, 1], [17, 0.6], [20, 0.25], [23, 0.9],
  [26, 1], [29, 1], [30.6, 0.2], [31, 0], [33.5, 0], [35.5, 0.7], [38, 0.3], [42, 0.8], [46, 1], [49, 0.5], [52, 0.2], [55, 0.8], [58, 0.3],
  [62, 1], [65, 0.5], [68, 0.2], [71, 0.7], [75, 0.3], [78, 0.9], [82, 0.6]]);
/** wing tuck for dives */
export const FOLD = new ScalarSpline([[0, 0], [30.4, 0], [31.2, 0.85], [33.6, 0.85], [35.2, 0], [82, 0]]);

// camera: rides the bird's own trail (so it passes through the same portals), lag in seconds + world offset
export const CAM_LAG = new ScalarSpline([[0, -1.3], [4, -0.25], [7.5, 0.55], [11, 0.5], [14, 0.36], [17, 0.32], [19, 0.4], [22, 0.25], [25.5, 0.6],
  [28.5, 0.5], [30.6, 0.3], [32, 0.24], [33.4, 0.3], [36.5, 0.7], [40, 0.35], [44, 0.5], [46.6, 0.36], [49, 0.4], [53, -0.5], [57, -0.85],
  [60.3, 0.5], [62.6, 0.36], [65.2, 0.42], [67.5, 0.6], [71, 0.4], [74.5, -0.7], [78, 1.0], [82, 2.2]]);
const o = (t: number, p: V3) => ({ t, p });
export const CAM_OFF = new TimeSpline([
  o(0, [9, -3, 0]), o(4, [9, 0, 1]), o(7.5, [4, 2.5, 0]), o(11, [-5, 1.5, 0]), o(14, [0, 0.9, 0]), o(16.5, [0, 0.5, 0]), o(18, [0, 1, 0]),
  o(21.5, [11, 3, 0]), o(25.5, [-6, 6, 0]), o(28.5, [3, 2, 0]), o(30.4, [0, 2.2, 1.0]), o(31.6, [0, 0.6, 0.4]), o(32.4, [0, 0.2, 0]),
  o(33.6, [0, 0.4, 0]), o(36.5, [9, 6, 8]), o(40, [-11, 4, 0]), o(44, [7, 3, 0]), o(46.6, [0, 1, 0]), o(48.5, [0, 0.6, 0]),
  o(50, [0, 1, 0]), o(53, [13, 2, -3]), o(57, [7, -1, 0]), o(60.3, [-6, 2, 0]), o(62.6, [0, 0.8, 0]), o(64.5, [0, 0.5, 0]),
  o(67.5, [0, 4, 0]), o(71, [9, 1, 0]), o(74.5, [8, 0.5, 0]), o(78, [0, 3.5, 0]), o(82, [0, 7, 0]),
]);
export const CAM_FOV = new ScalarSpline([[0, 42], [6, 50], [14, 56], [16.3, 64], [18, 52], [30, 54], [32.2, 66], [34, 58], [37, 48],
  [46.5, 56], [48.4, 64], [50, 52], [62.5, 56], [64.4, 64], [66, 50], [78, 44], [82, 40]]);
/** 0..1 blend of the camera/bird "up" toward -z while plunging straight down into the End portal */
export const DIVE = new ScalarSpline([[0, 0], [30.2, 0], [31.3, 1], [33.2, 1], [34.6, 0], [82, 0]]);

export const birdAt = (t: number, out = new THREE.Vector3()) => BIRD.at(t, out);
