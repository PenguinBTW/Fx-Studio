// =============================================================================
// PALETTE DEFINITIONS: "THE AIR-GAP CATHEDRAL"
//
// Token discipline:
// --void:   #050506 (Deep black cosmic void)
// --bone:   #E8E4DA (Structural skeletal points, cathedral architecture)
// --ash:    #6B6A66 (Secondary structures, ambient grid, organ envelopes)
// --signal: #FF2A1F (Conscious neural screaming shockwave, severed gap sparks)
// --laser:  #00F0FF (Subconscious autonomic sinus node, high-frequency scan)
// --gold:   #E5C07B (Diaphragm & bladder hybrid bypass bridges)
// =============================================================================

import * as THREE from 'three';

export const HEX = {
  void:   0x050506,
  bone:   0xE8E4DA,
  ash:    0x6B6A66,
  signal: 0xFF2A1F,
  laser:  0x00F0FF,
  gold:   0xE5C07B,
} as const;

export const LIN = {
  void:   new THREE.Color(HEX.void).convertSRGBToLinear(),
  bone:   new THREE.Color(HEX.bone).convertSRGBToLinear(),
  ash:    new THREE.Color(HEX.ash).convertSRGBToLinear(),
  signal: new THREE.Color(HEX.signal).convertSRGBToLinear(),
  laser:  new THREE.Color(HEX.laser).convertSRGBToLinear(),
  gold:   new THREE.Color(HEX.gold).convertSRGBToLinear(),
} as const;

export type ColorName = keyof typeof HEX;

export function rgba(name: ColorName, alpha = 1.0): string {
  const hex = HEX[name];
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}
