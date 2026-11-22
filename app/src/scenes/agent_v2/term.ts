// The agent's voice: a terminal line that types out behind a block cursor, holds with the cursor blinking on the
// beat, then is wiped by the cursor sweeping back across it. One line on screen at a time, closed-form in T.
import { F, font } from '../../engine/type';
import { BEAT, B0 } from '../agent_promo/kit';

export interface TLine { text: string; at: number; hold: number; cps?: number; x?: number; y?: number }
export interface TermStyle { x?: number; y?: number; size?: number; color?: string; cursor?: string; align?: 'left' | 'center'; family?: string; halo?: string; prompt?: string; alpha?: number }

const WIPE = 0.24;
const jit = (k: number) => { const s = Math.sin(k * 91.7) * 43758.5; return (s - Math.floor(s)) - 0.5; };
/** Seconds a line takes to type. */
export const typeDur = (l: TLine) => l.text.length / (l.cps ?? 18);
/** Time at which the line is fully gone. */
export const lineEnd = (l: TLine) => l.at + typeDur(l) + l.hold + WIPE;

export function term(g: CanvasRenderingContext2D, lines: TLine[], T: number, st: TermStyle = {}) {
  const l = lines.find((q) => T >= q.at - 0.6 && T < lineEnd(q) + 0.05);
  if (!l) return;
  const size = st.size ?? 44, cps = l.cps ?? 18, pr = st.prompt ?? '';
  if ((st.alpha ?? 1) <= 0) return;
  g.save(); g.globalAlpha = st.alpha ?? 1; g.font = font(st.family ?? F.mono(400), size); g.textBaseline = 'middle'; g.textAlign = 'left';
  const full = g.measureText(pr + l.text).width, cw = g.measureText('M').width;
  const x0 = (l.x ?? st.x ?? 960) - ((st.align ?? 'center') === 'center' ? full / 2 : 0), y = l.y ?? st.y ?? 540;
  const td = typeDur(l), wipeAt = l.at + td + l.hold;
  let n = 0;
  if (T >= l.at) for (let k = 0; k < l.text.length; k++) if (T >= l.at + (k + 0.35 * jit(k)) / cps) n = k + 1;
  const w0 = T > wipeAt ? Math.min(1, (T - wipeAt) / WIPE) : 0;
  const ease = w0 * w0 * (3 - 2 * w0);
  const text = pr + l.text.slice(0, n), tw = g.measureText(text).width;
  const cut = x0 + tw * ease;
  g.save(); g.beginPath(); g.rect(cut, 0, 1920, 1080); g.clip();
  if (st.halo) { g.lineWidth = size * 0.32; g.lineJoin = 'round'; g.strokeStyle = st.halo; g.strokeText(text, x0, y); }
  g.fillStyle = st.color ?? '#F2F2F2'; g.fillText(text, x0, y); g.restore();
  // cursor: solid while typing, blinks on the beat while holding, leads the wipe as a stretched selection bar
  const typing = T >= l.at && n < l.text.length;
  const beatOn = Math.floor((T - B0) / (BEAT / 2)) % 2 === 0;
  if (w0 > 0) {
    const bw = cw * (1 + 2.5 * Math.sin(Math.PI * w0));
    g.fillStyle = st.cursor ?? '#F2F2F2'; g.globalAlpha = (st.alpha ?? 1) * (1 - Math.max(0, (w0 - 0.85) / 0.15));
    g.fillRect(cut - bw * (1 - w0) * 0.3, y - size * 0.52, bw * (1 - 0.7 * w0) + 2, size * 1.04);
  } else if (typing || beatOn || T < l.at) {
    g.fillStyle = st.cursor ?? '#F2F2F2'; g.globalAlpha = (st.alpha ?? 1) * (T < l.at ? (beatOn ? 1 : 0) : 1);
    g.fillRect(x0 + tw + cw * 0.12, y - size * 0.52, cw * 0.92, size * 1.04);
  }
  g.restore();
}
