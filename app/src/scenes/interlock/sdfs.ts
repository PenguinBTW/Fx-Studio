// SDF Shape Library for "THE INTERLOCK"
// Primitives: circle, box, rounded rect, segment, and the 6 pictograms:
// 1. DOOR: door frame with latch point & severed gap
// 2. PAYMENT: card with chip, mag stripe & severed slash gap
// 3. STEERING: wheel with lane lines & severed column gap
// 4. FEED: content bars with one severed / struck out
// 5. BORDER: barrier gate lowered with severed lock
// 6. BUTTON: hatched button with severed contact gap
// And the canonical Interlock Glyph "G" (input circle, red gap blocker, output square).
//
// PALETTE STRICT RULE:
// Red appears ONLY at severed connections / gaps. Nowhere else, ever.

export const SDF_GLSL = /* glsl */ `
float sdRoundedBox(vec2 p, vec2 b, vec4 r) {
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  r.x  = (p.y > 0.0) ? r.x  : r.y;
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
}

// ---------------------------------------------------------------------------
// Pictogram 1: DOOR (outline with latch point and severed gap)
// ---------------------------------------------------------------------------
float sdPictogramDoor(vec2 p, out float isRed) {
  isRed = 0.0;
  // Outer frame
  float frame = abs(sdBox(p, vec2(0.35, 0.55))) - 0.015;
  // Inner door panel line
  float panel = abs(sdBox(p - vec2(-0.02, 0.0), vec2(0.28, 0.48))) - 0.012;
  // Latch point link on right
  float link = sdSegment(p, vec2(0.26, 0.0), vec2(0.48, 0.0)) - 0.012;
  // Severed gap at latch
  float dBlocker = sdBox(p - vec2(0.36, 0.0), vec2(0.018, 0.065));
  if (dBlocker < 0.012) {
    isRed = 1.0;
  }
  return min(min(frame, panel), min(link, dBlocker));
}

// ---------------------------------------------------------------------------
// Pictogram 2: PAYMENT (card with cross-out bar / severed link)
// ---------------------------------------------------------------------------
float sdPictogramPayment(vec2 p, out float isRed) {
  isRed = 0.0;
  // Card outline
  float card = abs(sdBox(p, vec2(0.52, 0.32))) - 0.015;
  // Chip
  float chip = abs(sdBox(p - vec2(-0.25, 0.05), vec2(0.12, 0.09))) - 0.01;
  // Magnetic stripe
  float stripe = sdSegment(p, vec2(-0.52, -0.12), vec2(0.52, -0.12)) - 0.012;
  // Severed cross-out slash gap
  float dGap = sdBox(p, vec2(0.020, 0.22));
  if (dGap < 0.015) {
    isRed = 1.0;
  }
  return min(min(card, chip), min(stripe, dGap));
}

// ---------------------------------------------------------------------------
// Pictogram 3: STEERING (wheel with lane lines pushing back & severed column)
// ---------------------------------------------------------------------------
float sdPictogramSteering(vec2 p, out float isRed) {
  isRed = 0.0;
  // Outer wheel ring
  float ring = abs(length(p) - 0.42) - 0.015;
  // Center hub
  float hub = abs(length(p) - 0.10) - 0.012;
  // Spokes
  float s1 = sdSegment(p, vec2(0.0, 0.10), vec2(0.0, 0.42)) - 0.012;
  float s2 = sdSegment(p, vec2(-0.08, -0.05), vec2(-0.36, -0.22)) - 0.012;
  float s3 = sdSegment(p, vec2(0.08, -0.05), vec2(0.36, -0.22)) - 0.012;
  // Lane line push-back marks on left and right
  float laneL = sdSegment(p, vec2(-0.62, -0.45), vec2(-0.55, 0.45)) - 0.014;
  float laneR = sdSegment(p, vec2(0.62, -0.45), vec2(0.55, 0.45)) - 0.014;
  // Severed steering column link gap
  float dBlocker = sdBox(p - vec2(0.0, -0.28), vec2(0.022, 0.07));
  if (dBlocker < 0.012) {
    isRed = 1.0;
  }
  return min(min(min(ring, hub), min(s1, min(s2, s3))), min(min(laneL, laneR), dBlocker));
}

// ---------------------------------------------------------------------------
// Pictogram 4: FEED (stacked content bars with one struck out / severed)
// ---------------------------------------------------------------------------
float sdPictogramFeed(vec2 p, out float isRed) {
  isRed = 0.0;
  // Stacked content bars
  float b1 = abs(sdBox(p - vec2(0.0, 0.36), vec2(0.48, 0.07))) - 0.012;
  float b2 = abs(sdBox(p - vec2(0.0, 0.12), vec2(0.48, 0.07))) - 0.012;
  float b3 = abs(sdBox(p - vec2(0.0, -0.12), vec2(0.48, 0.07))) - 0.012;
  float b4 = abs(sdBox(p - vec2(0.0, -0.36), vec2(0.48, 0.07))) - 0.012;
  // Middle link struck through / severed gap
  float dBlocker = sdBox(p - vec2(0.0, 0.12), vec2(0.022, 0.09));
  if (dBlocker < 0.014) {
    isRed = 1.0;
  }
  return min(min(b1, b2), min(min(b3, b4), dBlocker));
}

// ---------------------------------------------------------------------------
// Pictogram 5: BORDER (gate with lowered barrier & severed lock)
// ---------------------------------------------------------------------------
float sdPictogramBorder(vec2 p, out float isRed) {
  isRed = 0.0;
  // Left post
  float postL = abs(sdBox(p - vec2(-0.45, 0.0), vec2(0.05, 0.42))) - 0.012;
  // Right post
  float postR = abs(sdBox(p - vec2(0.45, 0.0), vec2(0.05, 0.42))) - 0.012;
  // Lowered horizontal barrier arm
  float arm = abs(sdBox(p - vec2(0.0, -0.05), vec2(0.46, 0.03))) - 0.012;
  // Severed gate lock gap
  float dBlocker = sdBox(p - vec2(0.38, -0.05), vec2(0.022, 0.08));
  if (dBlocker < 0.012) {
    isRed = 1.0;
  }
  return min(min(postL, postR), min(arm, dBlocker));
}

// ---------------------------------------------------------------------------
// Pictogram 6: BUTTON (greyed button with diagonal hatching & severed lead link)
// ---------------------------------------------------------------------------
float sdPictogramButton(vec2 p, out float isRed) {
  isRed = 0.0;
  // Outer rounded button box
  float box = abs(sdRoundedBox(p, vec2(0.46, 0.28), vec4(0.06))) - 0.014;
  // Diagonal hatching lines cleanly clipped inside inner box (bone, NOT red)
  float dH = fract((p.x + p.y) * 9.0) - 0.5;
  float hatchLines = abs(dH) / 9.0 - 0.010;
  float innerMask = sdBox(p, vec2(0.40, 0.22));
  float hatch = max(hatchLines, innerMask);
  // Severed wire lead link coming out to the right
  float leadWire = sdSegment(p, vec2(0.46, 0.0), vec2(0.70, 0.0)) - 0.012;
  float dBlocker = sdBox(p - vec2(0.58, 0.0), vec2(0.022, 0.075));
  if (dBlocker < 0.012) {
    isRed = 1.0;
  }
  return min(min(box, hatch), min(leadWire, dBlocker));
}
`;
