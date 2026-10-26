// SDF glyph library for the Interlock "G": input ring, gap with red blocker, output square.
// Every shape is drawn with pixel-space antialiasing (distance scaled to physical px).
// Channel layout of the coverage accumulator C: x = bone, y = ash, z = red (severed connections only).
//
// Glyph "G" in local units (spans x in [-1, 1]):
//   input ring  centre (-0.8, 0) r 0.2        output square centre (0.8, 0) half 0.2
//   left line   -0.6 .. -0.233                right line   0.233 .. 0.6
//   gap         -0.233 .. 0.233 with a red blocker bar (half 0.035 x 0.30) at the centre
// A glyph of level L holds 6 children of level L-1 at 1/6 scale: input node, output node and
// four satellites (the satellites are ash). Level 1..6 output nodes hold a pictogram instead.
import { LIN, GLOW } from './palette';

const v3 = (c: number[]) => `vec3(${c.map((x) => x.toFixed(5)).join(',')})`;

export const GLYPH_COLORS_GLSL = /* glsl */ `
const vec3 K_BONE = ${v3(GLOW.bone)};
const vec3 K_ASH = ${v3(GLOW.ash)};
const vec3 K_RED = ${v3(GLOW.signal)};
const vec3 K_VOID = ${v3(LIN.void)};
`;

export const GLYPH_GLSL = /* glsl */ `
const float G_R = 6.0;
float gLw = PX_SCALE;

float gBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float gRBox(vec2 p, vec2 b, float r) { return gBox(p, b - vec2(r)) - r; }
float gSeg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
float gRing(vec2 p, vec2 c, float r) { return abs(length(p - c) - r); }
vec2 gRot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

float covL(float dpx) { return clamp(gLw + 0.5 - dpx, 0.0, 1.0); }
float covF(float sdpx) { return clamp(0.5 - sdpx, 0.0, 1.0); }

void gPut(inout vec3 C, int ch, float c) {
  if (ch == 0) C.x = max(C.x, c); else C.y = max(C.y, c);
}

// ---- the glyph's own primitives -------------------------------------------------------
void gPrims(vec2 p, float s, int ch, float wk, inout vec3 C) {
  float wl = smoothstep(0.35, 1.6, s) * wk;
  float wr = smoothstep(0.05, 0.40, s) * wk;
  if (wl > 0.001) {
    float ring = gRing(p, vec2(-0.8, 0.0), 0.2);
    float sq = abs(gRBox(p - vec2(0.8, 0.0), vec2(0.2), 0.02));
    float l1 = gSeg(p, vec2(-0.6, 0.0), vec2(-0.233, 0.0));
    float l2 = gSeg(p, vec2(0.233, 0.0), vec2(0.6, 0.0));
    gPut(C, ch, covL(min(min(ring, sq), min(l1, l2)) * s) * wl);
  }
  if (wr > 0.001) {
    float blk = gBox(p, vec2(min(0.02, 6.0 / s), 0.14)) * s - 0.55;
    float tk = min(gSeg(p, vec2(-0.233, -0.07), vec2(-0.233, 0.07)), gSeg(p, vec2(0.233, -0.07), vec2(0.233, 0.07))) * s - 0.3;
    C.z = max(C.z, covF(min(blk, tk)) * wr);
  }
}

// ---- pictograms (unit square, y up). Each has its own link with a red gap. ---------------
void gPict(int id, vec2 q, float sp, int ch, float wk, inout vec3 C) {
  if (max(abs(q.x), abs(q.y)) > 1.15) return;
  float w1 = smoothstep(0.35, 1.6, sp) * wk;
  float wr = smoothstep(0.05, 0.40, sp) * wk;
  float db = 1e3, da = 1e3, dr = 1e3;
  if (id == 0) {            // DOOR: outline, window, latch point, handle link with a gap
    db = min(db, gSeg(q, vec2(-0.55, -0.85), vec2(-0.55, 0.85)));
    db = min(db, gSeg(q, vec2(-0.55, 0.85), vec2(0.45, 0.85)));
    db = min(db, gSeg(q, vec2(0.45, 0.85), vec2(0.45, -0.85)));
    db = min(db, gSeg(q, vec2(0.45, -0.85), vec2(-0.55, -0.85)));
    da = min(da, gSeg(q, vec2(-0.4, 0.35), vec2(0.3, 0.35)));
    da = min(da, gSeg(q, vec2(0.3, 0.35), vec2(0.3, 0.65)));
    da = min(da, gSeg(q, vec2(0.3, 0.65), vec2(-0.4, 0.65)));
    da = min(da, gSeg(q, vec2(-0.4, 0.65), vec2(-0.4, 0.35)));
    db = min(db, gRing(q, vec2(0.3, -0.15), 0.08));
    db = min(db, gSeg(q, vec2(-0.4, -0.15), vec2(-0.12, -0.15)));
    db = min(db, gSeg(q, vec2(0.14, -0.15), vec2(0.22, -0.15)));
    dr = min(dr, gBox(q - vec2(0.01, -0.15), vec2(0.03, 0.13)));
  } else if (id == 1) {     // PAYMENT: card with a cross-out bar on its link
    db = min(db, abs(gRBox(q - vec2(0.0, 0.2), vec2(0.85, 0.5), 0.08)));
    da = min(da, gSeg(q, vec2(-0.85, 0.38), vec2(0.85, 0.38)));
    db = min(db, abs(gRBox(q - vec2(-0.5, 0.06), vec2(0.16, 0.11), 0.03)));
    db = min(db, gSeg(q, vec2(-0.85, -0.7), vec2(-0.2, -0.7)));
    db = min(db, gSeg(q, vec2(0.2, -0.7), vec2(0.85, -0.7)));
    dr = min(dr, gBox(gRot(q - vec2(0.0, -0.7), 0.6), vec2(0.035, 0.22)));
  } else if (id == 2) {     // STEERING: wheel pushed back by two lane lines
    db = min(db, gRing(q, vec2(0.0, 0.1), 0.55));
    db = min(db, gRing(q, vec2(0.0, 0.1), 0.1));
    db = min(db, gSeg(q, vec2(0.0, 0.1), vec2(-0.55, 0.1)));
    db = min(db, gSeg(q, vec2(0.0, 0.1), vec2(0.55, 0.1)));
    db = min(db, gSeg(q, vec2(0.0, 0.1), vec2(0.0, -0.45)));
    da = min(da, gSeg(q, vec2(-0.95, -0.9), vec2(-0.7, 0.9)));
    da = min(da, gSeg(q, vec2(0.95, -0.9), vec2(0.7, 0.9)));
    db = min(db, gSeg(q, vec2(-0.85, -0.25), vec2(-0.78, -0.25)));
    db = min(db, gSeg(q, vec2(-0.66, -0.25), vec2(-0.56, -0.25)));
    db = min(db, gSeg(q, vec2(0.85, -0.25), vec2(0.78, -0.25)));
    db = min(db, gSeg(q, vec2(0.66, -0.25), vec2(0.56, -0.25)));
    dr = min(dr, min(gBox(q - vec2(-0.72, -0.25), vec2(0.025, 0.13)), gBox(q - vec2(0.72, -0.25), vec2(0.025, 0.13))));
  } else if (id == 3) {     // FEED: stacked content bars, one struck out
    db = min(db, abs(gRBox(q - vec2(0.0, 0.72), vec2(0.7, 0.14), 0.05)));
    db = min(db, abs(gRBox(q - vec2(0.0, 0.26), vec2(0.7, 0.14), 0.05)));
    da = min(da, abs(gRBox(q - vec2(0.0, -0.2), vec2(0.7, 0.14), 0.05)));
    db = min(db, abs(gRBox(q - vec2(0.0, -0.66), vec2(0.7, 0.14), 0.05)));
    db = min(db, gSeg(q, vec2(-0.92, 0.9), vec2(-0.92, -0.08)));
    db = min(db, gSeg(q, vec2(-0.92, -0.32), vec2(-0.92, -0.9)));
    dr = min(dr, min(gBox(q - vec2(-0.92, -0.2), vec2(0.07, 0.035)), gSeg(q, vec2(-0.82, -0.2), vec2(0.82, -0.2)) - 0.02));
  } else if (id == 4) {     // BORDER: gate with a lowered barrier on the road link
    db = min(db, gSeg(q, vec2(-0.7, -0.85), vec2(-0.7, 0.65)));
    db = min(db, gSeg(q, vec2(0.7, -0.85), vec2(0.7, 0.65)));
    db = min(db, gSeg(q, vec2(-0.7, 0.65), vec2(0.7, 0.65)));
    da = min(da, gRing(q, vec2(-0.7, -0.3), 0.07));
    db = min(db, gSeg(q, vec2(0.0, -0.9), vec2(0.0, -0.4)));
    db = min(db, gSeg(q, vec2(0.0, -0.2), vec2(0.0, 0.55)));
    dr = min(dr, gBox(q - vec2(0.0, -0.3), vec2(0.55, 0.04)));
  } else {                  // BUTTON: greyed button with diagonal hatching
    float sdb = gRBox(q, vec2(0.8, 0.38), 0.2);
    da = min(da, abs(sdb));
    float h = abs(fract((q.x + q.y) * 2.5) - 0.5) / 2.5 * 0.7071;
    da = min(da, max(h, sdb + 0.04));
    db = min(db, gSeg(q, vec2(0.0, -0.42), vec2(0.0, -0.62)));
    db = min(db, gSeg(q, vec2(0.0, -0.86), vec2(0.0, -0.95)));
    dr = min(dr, gBox(q - vec2(0.0, -0.74), vec2(0.18, 0.035)));
  }
  if (w1 > 0.001) {
    gPut(C, ch, covL(db * sp) * w1);
    C.y = max(C.y, covL(da * sp) * w1);
  }
  if (wr > 0.001) C.z = max(C.z, covF(dr * sp - 0.55) * wr);
}

const vec2 G_CH[6] = vec2[6](vec2(-0.8, 0.0), vec2(0.8, 0.0), vec2(-0.45, 0.5), vec2(0.45, 0.5), vec2(-0.45, -0.5), vec2(0.45, -0.5));

uniform float uParentK;  // 0..1: levels above G_0 fade in (Beat 2 -> 3 seam)
uniform float uChainK;   // 0..1: the top glyph's input-node child (Beat 4 fades the nested glyph out)
uniform float uTopL;     // absolute level of the single top glyph; nothing exists above it
uniform float uEmph;     // weight of the top glyph's own lines (climax)
uniform float uLatt;     // weight of every level below the top glyph (climax dims the lattice)

// Descend the self-similar tree for ONE pixel. The cells of a glyph's six children are disjoint, so a
// pixel belongs to at most one child at each level: the union of all 6^n glyphs costs O(depth) per pixel.
// A child fades in over 2.5..7 px/unit (smoothstep) so octaves cross-fade instead of popping.
void gTrace(vec2 p, float s, int lvl, inout vec3 C) {
  int ch = 0;
  float w = 1.0;
  int top = int(uTopL + 0.5);
  for (int d = 0; d < 12; d++) {
    if (lvl < 0 || w < 0.002) return;
    if (abs(p.x) > 1.06 || abs(p.y) > 0.64) return;
    float wl = (lvl == 0) ? 1.0 : uParentK;
    float wt = (lvl == top) ? uEmph : uLatt;
    float wd = (lvl > top) ? 0.0 : w * wl * wt;
    if (wd > 0.002) gPrims(p, s, ch, wd, C);
    if (lvl == 0) return;
    float cf = smoothstep(2.5, 7.0, s / G_R);
    if (cf < 0.002) return;
    int hit = -1; vec2 q = vec2(0.0);
    for (int i = 0; i < 6; i++) {
      vec2 qi = (p - G_CH[i]) * G_R;
      if (abs(qi.x) <= 1.06 && abs(qi.y) <= 0.64) { hit = i; q = qi; }
    }
    if (hit < 0) return;
    w *= cf;
    if (hit != 0) w *= uParentK;
    if (hit == 0 && lvl == top) w *= uChainK;
    if (hit >= 2) ch = 1;
    if (hit == 1 && lvl >= 1 && lvl <= 6) {
      if (lvl <= top) gPict(lvl - 1, (p - G_CH[1]) / 0.17, s * 0.17, ch, w * wl * wt, C);
      return;
    }
    p = q; s /= G_R; lvl -= 1;
  }
}
`;
// ---- CPU mirror of the chain geometry (double precision) --------------------------------
export const RATIO = 6;
export const LEVELS = 8;
/** px per G0 unit at zoom 1 (logical): G0 spans 40% of a 1920 frame. */
export const PX0 = 0.4 * 1920 * 0.5;
export const Z_TOTAL = 1e6;

/** World x of the centre of chain glyph G_k (G0 at the origin, each G_k holds G_{k-1} at its input node). */
export const chainC = (k: number) => 0.96 * (Math.pow(RATIO, k) - 1);

