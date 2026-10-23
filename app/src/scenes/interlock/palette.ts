// Palette and design tokens for "THE INTERLOCK"
// PALETTE STRICT RULE:
// --void: #050506 (background, always)
// --bone: #E8E4DA (all primary geometry, lines, particles)
// --ash: #6B6A66 (secondary lines, labels, dim states)
// --signal: #FF2A1F (ONLY severed connections / gaps — nowhere else, ever)

import { hexToLinear } from '../../engine/util';

export const HEX = {
  void: '#050506',
  bone: '#E8E4DA',
  ash: '#6B6A66',
  signal: '#FF2A1F',
} as const;

export type InterlockColorKey = keyof typeof HEX;

/** Linear RGB triplets for WebGL uniforms */
export const LIN: Record<InterlockColorKey, [number, number, number]> = {
  void: hexToLinear(HEX.void),
  bone: hexToLinear(HEX.bone),
  ash: hexToLinear(HEX.ash),
  signal: hexToLinear(HEX.signal),
};

/** CSS rgba() strings for Canvas2D */
export function rgba(key: InterlockColorKey, a = 1): string {
  const hex = HEX[key];
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
