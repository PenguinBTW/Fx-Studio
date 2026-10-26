// "THE INTERLOCK" palette. Red (--signal) is reserved for severed connections only.
import { hexToLinear } from '../../engine/util';

export const HEX = {
  void: '#050506',
  bone: '#E8E4DA',
  ash: '#6B6A66',
  signal: '#FF2A1F',
} as const;

export type Tok = keyof typeof HEX;
export type RGB = [number, number, number];

export const LIN: Record<Tok, RGB> = {
  void: hexToLinear(HEX.void),
  bone: hexToLinear(HEX.bone),
  ash: hexToLinear(HEX.ash),
  signal: hexToLinear(HEX.signal),
};

export const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

/** Emissive intensities (linear, may exceed 1 so the bloom threshold picks up lines and the red). */
export const GLOW = {
  bone: mul(LIN.bone, 1.25),
  ash: mul(LIN.ash, 1.0),
  signal: mul(LIN.signal, 3.0),
};

export function rgba(key: Tok, a = 1): string {
  const n = parseInt(HEX[key].replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
