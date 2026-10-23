// =============================================================================
// CHROMATIC PALETTE: "CHROMA: THE DOT ODYSSEY"
//
// Vibrant, high-contrast, optical bloom-compatible color tokens
// across all 7 movements of the 180.0s procedural point-cloud tour-de-force.
// =============================================================================

import * as THREE from 'three';

export const HEX = {
  void: '#050506',
  bone: '#F0EDE4',
  ash: '#6B6A66',

  // Movement 1: Celestial Dragon
  gold: '#FFD700',
  dragonRed: '#FF2233',
  dragonJade: '#00E5A3',
  flameAmber: '#FF7700',

  // Movement 2: Bioluminescent Ocean
  oceanBlue: '#002B7F',
  oceanCyan: '#00E5FF',
  biolumViolet: '#8A2BE2',
  mantaSilver: '#E2E8F0',
  jellyPink: '#FF1493',

  // Movement 3: Drone Metamorphosis
  droneWhite: '#FFFFFF',
  droneGreen: '#00FF66',
  heartRuby: '#E60039',
  phoenixFire: '#FF4500',
  phoenixGold: '#FFB703',

  // Movement 4: Cyberpunk Megacity
  cyberPink: '#FF0055',
  cyberCyan: '#00F0FF',
  cyberYellow: '#FFE600',
  cyberPurple: '#7928CA',

  // Movement 5: Kerr Black Hole
  accretionCyan: '#50E3C2',
  accretionOrange: '#FF5E3A',
  photonWhite: '#FFFFFF',
  jetBlue: '#00A8FF',

  // Movement 6: Sacred 4D Tesseract
  tesseractLime: '#39FF14',
  tesseractMagenta: '#FF007F',
  tesseractCyan: '#00F5FF',

  // Movement 7: Big Bang & Spiral Galaxy
  galaxyCore: '#FFF8E7',
  galaxyArm1: '#3A86FF',
  galaxyArm2: '#FF006E',
  cosmicGold: '#FFBE0B',
} as const;

export const LIN = Object.fromEntries(
  Object.entries(HEX).map(([k, hex]) => [k, new THREE.Color(hex)])
) as Record<keyof typeof HEX, THREE.Color>;
