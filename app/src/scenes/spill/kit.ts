// SPILL shared timing (song = video time, "Feel Good Inc." album version, 137.89 bpm) and easing helpers.
export const BEAT = 60 / 137.89, BAR = 4 * BEAT;
export const DROP = 6.432;
export const bar = (n: number) => DROP + n * BAR;
/** laugh pulses: rams 1-3 then the decaying impact frames as the cursor tumbles out */
export const RAMS = [0.34, 0.94, 1.45];
export const PULSES = [1.73, 2.02, 2.29, 2.61, 2.88];
export const BREAK = RAMS[2];
export const OUTSIDE = 3.0;
export const GULP: [number, number] = [12.2, 12.7];
export const SCREAM = bar(11), WHIP = bar(12), END = bar(13);
export const TAU = Math.PI * 2;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const sm = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
/** damped spring impulse at t>=0 */
export const spring = (t: number, w = 8, k = 6) => (t < 0 ? 0 : Math.exp(-t * k) * Math.sin(t * w));
/** pose updates at `fps` (stop-motion/cel stepping) */
export const stepped = (t: number, fps: number) => Math.floor(t * fps) / fps;
/** strength of a comic impact frame at time t: 1 on the 2 held frames after each hit, 0 otherwise */
export function impactFrame(t: number): { k: number; i: number } {
  const hits = [...RAMS, ...PULSES];
  for (let i = hits.length - 1; i >= 0; i--) {
    const d = t - hits[i];
    if (d >= 0 && d < (i === 2 ? 3 : 2) / 30) return { k: i < 6 ? 1 : 0.7, i };
  }
  return { k: 0, i: -1 };
}
