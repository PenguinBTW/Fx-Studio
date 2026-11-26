// Shared shader compositor for THRESHOLD engine transitions.
// Each transition gets a distinct fragment body but the same strict full-frame contract.
import type * as THREE from 'three';
import type { Frame, PostOverrides } from '../engine/scene';
import type { Transition, TransitionAPI, TransitionCtx } from '../engine/transition';
import { FSPass } from '../engine/gl';
import { smoothstep } from '../engine/util';

export type ThresholdTransitionMode = 'blackout' | 'exposure' | 'tunnel' | 'ink' | 'pageSlam' | 'staticFelt' | 'doorPush' | 'lightFall';

const BODY: Record<ThresholdTransitionMode, string> = {
  blackout: `
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    float cut = 1.0 - smoothstep(0.02, 0.24, u);
    vec3 darkA = ca * cut;
    float ignite = smoothstep(0.46, 0.57, u);
    float lumB = dot(cb, vec3(0.2126, 0.7152, 0.0722));
    float tubeLead = smoothstep(0.025, 0.24, lumB);
    float broad = smoothstep(0.60, 0.94, u);
    float starter = 0.68 + 0.32 * smoothstep(0.47, 0.60, u) + 0.10 * sin(u * 91.0) * (1.0 - broad);
    float spatialReveal = clamp(tubeLead * 1.18 + broad, 0.0, 1.0);
    vec3 incoming = cb * (0.10 + 0.90 * broad) * spatialReveal * ignite * starter;
    vec3 c = u < 0.46 ? darkA : incoming;
    fragColor = vec4(c, 1.0);`,
  exposure: `
    // The fire-door aperture is the carrier. Scene A dollies through the narrowing
    // rectangle, light blows out only inside that aperture, and the playroom resolves
    // behind it while the dark door/frame edges remain physically present.
    float zoomA = mix(1.0, 1.42, smoothstep(0.0, 1.0, u));
    vec2 aUv = clamp((vUv - 0.5) / zoomA + 0.5, 0.0, 1.0);
    float zoomB = mix(1.16, 1.0, smoothstep(0.12, 1.0, u));
    vec2 bUv = clamp((vUv - 0.5) / zoomB + 0.5, 0.0, 1.0);
    vec3 ca = texture(texA, aUv).rgb;
    vec3 cb = texture(texB, bUv).rgb;
    vec2 q = (vUv - vec2(0.5, 0.47)) * vec2(1.7778, 1.0);
    float width = mix(0.075, 1.08, smoothstep(0.02, 0.96, u));
    float height = mix(0.20, 0.84, smoothstep(0.02, 0.96, u));
    float rect = max(abs(q.x) / width, abs(q.y) / height);
    float inside = 1.0 - smoothstep(0.985, 1.015, rect);
    float frameBand = (1.0 - smoothstep(0.018, 0.075, abs(rect - 1.0))) * (1.0 - smoothstep(0.90, 1.0, u));
    float jambSide = smoothstep(0.55, 0.95, abs(q.x) / max(width, 0.001));
    float spillK = smoothstep(0.0, 0.20, u) * (1.0 - smoothstep(0.32, 0.68, u));
    float hazeN = fbm(vUv * vec2(8.0, 5.0) + vec2(u * 0.17, -u * 0.09), 4);
    float grainN = hash12(floor(vUv * vec2(210.0, 118.0)) + floor(u * 24.0));
    vec3 hotSpill = vec3(4.8, 4.25, 3.45) * (0.30 + 0.70 * spillK) * (0.55 + 0.38 * hazeN + 0.16 * grainN);
    vec3 office = ca * (0.48 + 0.22 * (1.0 - u));
    vec3 litAperture = mix(office, hotSpill, clamp(spillK * (0.72 + 0.28 * jambSide), 0.0, 1.0));
    float revealB = inside * smoothstep(0.22, 0.72, u);
    revealB = max(revealB, smoothstep(0.72, 0.92, u));
    vec3 throughDoor = mix(litAperture, cb, revealB);
    vec3 c = mix(office, throughDoor, inside);
    // A thin hot line of spilled light sits just inside the surviving frame edges.
    float edgeGlow = frameBand * smoothstep(0.04, 0.22, u) * (1.0 - smoothstep(0.72, 0.95, u));
    c += vec3(1.2, 0.75, 0.32) * edgeGlow * 0.55;
    c = mix(c, vec3(0.018, 0.012, 0.009), frameBand * (0.72 - 0.20 * edgeGlow));
    fragColor = vec4(c, 1.0);`,
  tunnel: `
    // Forward tunnel-throat carrier: the existing ribbed crawl tunnel remains the
    // outside world, while an irregular melting membrane opens radially at its mouth.
    // The pool emerges through that expanding aperture rather than behind a lateral wipe.
    vec2 q = (vUv - 0.5) * vec2(1.7778, 1.0);
    float zoomA = mix(1.0, 1.20, smoothstep(0.0, 1.0, u));
    vec2 aUv = clamp((vUv - 0.5) / zoomA + 0.5, 0.0, 1.0);
    float zoomB = mix(1.13, 1.0, smoothstep(0.18, 1.0, u));
    vec2 bUv = clamp((vUv - 0.5) / zoomB + 0.5, 0.0, 1.0);
    vec3 ca = texture(texA, aUv).rgb;
    vec3 cb0 = texture(texB, bUv).rgb;
    float angle = atan(q.y, q.x + 0.0001);
    float apertureNoise = fbm(vec2(angle * 1.35 + 4.0, length(q) * 5.0 - u * 0.4), 4);
    float d = length(q * vec2(1.0, 1.10));
    float rag = (apertureNoise - 0.5) * 0.105;
    float front = mix(-0.06, 1.42, smoothstep(0.03, 0.97, u)) + rag;
    float inside = 1.0 - smoothstep(front - 0.018, front + 0.018, d);
    float membrane = (1.0 - smoothstep(0.0, 0.23, abs(d - front))) * smoothstep(0.015, 0.09, u) * (1.0 - smoothstep(0.91, 1.0, u));
    float lipWide = (1.0 - smoothstep(0.0, 0.060, abs(d - front + 0.018))) * smoothstep(0.015, 0.09, u) * (1.0 - smoothstep(0.91, 1.0, u));
    float lip = (1.0 - smoothstep(0.0, 0.027, abs(d - front))) * smoothstep(0.015, 0.09, u) * (1.0 - smoothstep(0.91, 1.0, u));
    float crown = (1.0 - smoothstep(0.0, 0.009, abs(d - front - 0.014))) * smoothstep(0.015, 0.09, u) * (1.0 - smoothstep(0.91, 1.0, u));
    // Incoming pool is initially deadened/desaturated as seen through the tunnel mouth.
    float cbLum = dot(cb0, vec3(0.2126, 0.7152, 0.0722));
    float deadSky = 1.0 - smoothstep(0.66, 1.0, u);
    vec3 cb = mix(cb0, mix(vec3(cbLum), cb0, 0.56) * vec3(0.74, 0.84, 0.86), deadSky * 0.75);
    // Molten tunnel plastic: radially dragged fragments of the outgoing image with
    // fibrous flow lines, opaque hot body, and a dimensional glossy lip.
    float stretch = membrane;
    vec2 radial = normalize(q + vec2(0.0001, 0.0001));
    vec2 meltUv = clamp(aUv + radial * (0.030 * stretch) + vec2(0.0, -0.11 * stretch * stretch), 0.0, 1.0);
    vec3 melted = texture(texA, meltUv).rgb;
    float lum = dot(melted, vec3(0.2126, 0.7152, 0.0722));
    float plasticGrain = fbm(vUv * vec2(30.0, 14.0) + vec2(u * 0.21, -u * 0.12), 4);
    float flowLine = 0.5 + 0.5 * sin((angle * 5.0 + d * 24.0 + plasticGrain * 4.0 - u * 2.0) * TAU);
    vec3 hotBase = vec3(0.145, 0.082, 0.026) + melted * vec3(0.18, 0.13, 0.060);
    hotBase *= 0.68 + plasticGrain * 0.34 + flowLine * 0.10;
    vec3 hotPlastic = mix(melted, hotBase, sat(stretch * 1.55));
    vec3 wetPlastic = mix(hotPlastic, vec3(0.026, 0.096, 0.108) * (0.34 + lum), smoothstep(0.42, 1.0, stretch));
    vec3 ahead = mix(ca, wetPlastic, smoothstep(0.0, 0.24, stretch));
    // Water contact lives mostly along the lower arc of the aperture, rippling the first
    // revealed pool surface where hot plastic meets liquid.
    float lowerArc = smoothstep(-0.15, -0.70, q.y);
    float contactBand = lipWide * lowerArc * smoothstep(0.08, 0.24, u);
    vec2 contactRipple = radial * sin(angle * 17.0 + u * 29.0) * 0.006 * contactBand;
    vec3 pool = texture(texB, clamp(bUv + contactRipple, 0.0, 1.0)).rgb;
    pool = mix(pool, cb, 0.35);
    float fragN = fbm(vec2(angle * 3.0 + u * 0.7, d * 18.0), 4);
    float rags = smoothstep(0.57, 0.76, fragN) * membrane * (1.0 - inside * 0.35);
    vec3 rubber = vec3(0.19, 0.095, 0.015) * (0.55 + lum * 0.75);
    vec3 behindC = mix(pool, rubber, rags * 0.55);
    vec3 c = mix(ahead, behindC, inside);
    float ribShadow = pow(0.5 + 0.5 * sin(angle * 14.0 + apertureNoise * 2.2), 5.0) * membrane;
    vec3 thickEdge = vec3(0.070, 0.026, 0.005) * (0.65 + lum * 0.45);
    vec3 hotLip = vec3(0.30, 0.135, 0.015) * (0.52 + lum * 0.65) + vec3(0.20, 0.09, 0.012) * ribShadow;
    c = mix(c, thickEdge, lipWide * 0.40);
    c = mix(c, hotLip, lip * 0.78);
    c += vec3(0.30, 0.20, 0.065) * crown * (0.24 + lum * 0.55);
    float foamBreak = smoothstep(0.46, 0.78, fbm(vUv * vec2(36.0, 17.0) + vec2(u * 1.6, 0.0), 3));
    c += vec3(0.07, 0.30, 0.32) * contactBand * (0.25 + foamBreak * 0.55);
    fragColor = vec4(c, 1.0);`,
  ink: `
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    vec2 q = (vUv - 0.5) * vec2(1.7778, 1.0);
    // Ink blooms outward as a physical liquid front. Ahead of it pool imagery is
    // drowned; behind it opaque black liquid cellulose-dries into paper fibres,
    // then the library emerges through gaps in those fibres. No half-alpha wipe.
    float rag = (fbm(vUv * vec2(7.0, 6.0) + vec2(u * 0.35, -u * 0.18), 5) - 0.5) * 0.24;
    float d = length(q) + rag;
    float front = mix(-0.20, 1.34, smoothstep(0.02, 0.97, u));
    float inside = 1.0 - smoothstep(front - 0.014, front + 0.014, d);
    float wetBand = (1.0 - smoothstep(0.0, 0.22, abs(d - front))) * smoothstep(0.02, 0.10, u);
    float inkSub = (1.0 - smoothstep(front - 0.02, front + 0.20, d)) * smoothstep(0.0, 0.04, u);
    vec3 drowned = mix(ca, vec3(0.010, 0.022, 0.026), sat(inkSub * 1.25));
    // Paper fibre field: long torn cellulose threads and small dry pinholes.
    float fibreA = fbm(vec2(vUv.x * 42.0, vUv.y * 9.0), 5);
    float fibreB = fbm(vec2(vUv.x * 150.0, vUv.y * 28.0) + 3.7, 3);
    float fibre = fibreA * 0.65 + fibreB * 0.35;
    vec3 paper = vec3(0.34, 0.285, 0.20) * (0.48 + fibre * 0.55);
    vec3 wetInk = vec3(0.018, 0.030, 0.034);
    float dryK = smoothstep(0.24, 0.78, u) * inside;
    vec3 membrane = mix(wetInk, paper, dryK * (0.35 + 0.65 * smoothstep(0.30, 0.66, fibre)));
    // Library visibility is peeled open as a second opaque cellulose front.
    float peelN = (fbm(vUv * vec2(6.0, 5.0) + vec2(8.2, -u * 0.27), 4) - 0.5) * 0.16;
    float peelD = d + peelN;
    float peelFront = mix(-0.28, 1.72, smoothstep(0.42, 0.82, u));
    float peeled = 1.0 - smoothstep(peelFront - 0.018, peelFront + 0.018, peelD);
    float fibrousTears = 0.58 + 0.42 * smoothstep(0.26, 0.68, fibre);
    float reveal = inside * smoothstep(0.40, 0.50, u) * peeled * fibrousTears;
    vec3 transformed = mix(membrane, cb, reveal);
    vec3 c = mix(drowned, transformed, inside);
    float lip = (1.0 - smoothstep(0.0, 0.024, abs(d - front))) * smoothstep(0.02, 0.10, u) * (1.0 - smoothstep(0.88, 1.0, u));
    c = mix(c, vec3(0.0, 0.006, 0.008), lip * 0.86 + wetBand * 0.28);
    fragColor = vec4(c, 1.0);`,
  pageSlam: `
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    // Real-page timing compressed into the 0.6 s seam: slam in 0.12 s,
    // hold true black for 0.08 s, then three neon ignition flickers over 0.4 s.
    float close = smoothstep(0.0, 0.20, u);
    float bow = (vUv.y - 0.5) * (vUv.y - 0.5) * 0.11;
    float edgeL = mix(-0.16, 0.505, close) + bow;
    float edgeR = mix(1.16, 0.495, close) - bow;
    float pageL = 1.0 - smoothstep(edgeL - 0.006, edgeL + 0.006, vUv.x);
    float pageR = smoothstep(edgeR - 0.006, edgeR + 0.006, vUv.x);
    float page = sat(pageL + pageR);
    float grain = hash12(floor(vUv * vec2(240.0, 180.0)));
    float fibre = fbm(vUv * vec2(95.0, 18.0), 4) * 0.5 + 0.5;
    vec3 paper = vec3(0.31, 0.255, 0.175) * (0.68 + grain * 0.16 + fibre * 0.18);
    float deckle = max(
      1.0 - smoothstep(0.0, 0.028, abs(vUv.x - edgeL)),
      1.0 - smoothstep(0.0, 0.028, abs(vUv.x - edgeR))
    ) * (1.0 - close * 0.35);
    paper = mix(paper, vec3(0.10, 0.065, 0.035), deckle * 0.62);
    float pageShade = max(
      smoothstep(edgeL - 0.11, edgeL, vUv.x) * pageL,
      (1.0 - smoothstep(edgeR, edgeR + 0.11, vUv.x)) * pageR
    );
    paper *= 1.0 - pageShade * 0.42;
    vec3 slammed = mix(ca, paper, page);
    float neonU = clamp((u - 0.333) / 0.667, 0.0, 1.0);
    float pulse = pow(abs(sin(neonU * 3.0 * 3.14159)), 2.0);
    float starter = neonU <= 0.0 ? 0.0 : mix(0.22, 1.0, pulse) * smoothstep(0.0, 0.08, neonU);
    starter = max(starter, smoothstep(0.88, 1.0, neonU));
    vec3 neonScene = cb * (0.72 + 0.58 * starter) + vec3(0.55, 0.06, 0.025) * starter * 0.10;
    vec3 c = mix(slammed, vec3(0.0), smoothstep(0.18, 0.20, u));
    c = mix(c, neonScene, smoothstep(0.333, 0.39, u) * starter);
    fragColor = vec4(c, 1.0);`,
  staticFelt: `
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    // CRT grain first enlarges into directional felt fibres; scanline/curvature
    // structure dies away rather than surviving as a screen overlay.
    float grainCell = mix(300.0, 34.0, smoothstep(0.0, 0.42, u));
    vec2 id = floor(vUv * grainCell);
    float n = hash12(id + floor(u * 18.0));
    float scan = (0.5 + 0.5 * sin(vUv.y * 900.0)) * (1.0 - smoothstep(0.12, 0.48, u));
    vec3 stat = vec3(n) * (0.13 + 0.24 * scan + 0.08 * (1.0 - scan));
    vec3 a = mix(ca, stat, smoothstep(0.0, 0.36, u));
    float fibreLong = fbm(vec2(vUv.x * 78.0, vUv.y * 18.0), 5) * 0.5 + 0.5;
    float fibreFine = fbm(vec2(vUv.x * 190.0, vUv.y * 20.0), 3) * 0.5 + 0.5;
    float strand = 0.5 + 0.5 * sin(vUv.x * 620.0 + fibreLong * 8.0);
    vec3 felt = vec3(0.105, 0.027, 0.020) * (0.48 + fibreLong * 0.08 + fibreFine * 0.04 + strand * 0.035);
    // Heavy drapery rather than a flat red noise field: broad vertical folds catch a
    // warm house light, with valleys falling into brown shadow and a top/bottom falloff.
    // Irregular heavy folds: cell-hashed ridge positions avoid even sine spacing, while
    // broad shadow valleys and edge-biased sheen imply cloth occluding itself in depth.
    float warp = (fbm(vec2(vUv.x * 3.4, vUv.y * 0.55), 4) - 0.5) * 0.035;
    float foldX = (vUv.x + warp) * 8.0;
    float foldCell = floor(foldX);
    float localX = fract(foldX);
    float ridgeCenter = 0.30 + 0.40 * hash12(vec2(foldCell, 19.7));
    ridgeCenter += (vUv.y - 0.5) * (hash12(vec2(foldCell, 31.1)) - 0.5) * 0.18;
    float ridgeWidth = 0.28 + 0.18 * hash12(vec2(foldCell, 43.3));
    float ridgeDist = abs(localX - ridgeCenter);
    ridgeDist = min(ridgeDist, 1.0 - ridgeDist);
    float foldShape = clamp(1.0 - ridgeDist / max(ridgeWidth, 0.04), 0.0, 1.0);
    float foldWide = pow(foldShape, 0.72);
    float foldFine = 0.5 + 0.5 * sin(vUv.x * 137.0 + fibreFine * 1.7);
    float valley = pow(1.0 - foldWide, 2.2);
    float occlusion = pow(1.0 - foldShape, 3.2) * smoothstep(0.04, 0.48, ridgeDist);
    float ridge = pow(foldWide, 18.0);
    float verticalFalloff = smoothstep(0.0, 0.16, vUv.y) * (1.0 - smoothstep(0.82, 1.0, vUv.y) * 0.55);
    float centerLight = 1.0 - abs(vUv.x - 0.5) * 0.72;
    float hem = smoothstep(0.16, 0.025, vUv.y);
    float pool = hem * (0.55 + 0.45 * sin(vUv.x * 61.0 + fibreLong * 4.0));
    felt *= (0.31 + pow(foldWide, 1.45) * 0.72 + foldFine * 0.035) * (0.55 + verticalFalloff * 0.55) * centerLight;
    felt *= 1.0 - occlusion * 0.30;
    felt += vec3(0.38, 0.095, 0.032) * ridge * verticalFalloff * centerLight * 0.52;
    felt -= vec3(0.045, 0.014, 0.008) * valley * 0.36;
    felt -= vec3(0.040, 0.012, 0.008) * pool;
    felt += vec3(0.09, 0.018, 0.008) * smoothstep(0.035, 0.0, vUv.y) * (0.4 + foldWide * 0.6);
    vec3 m = mix(a, felt, smoothstep(0.22, 0.52, u));
    // The curtain parts from the center outward, with an irregular fibrous leading edge.
    float open = smoothstep(0.56, 0.98, u);
    float ragged = (fbm(vUv * vec2(18.0, 5.0), 4) - 0.5) * 0.075;
    float centerDist = abs(vUv.x - 0.5);
    float part = 1.0 - smoothstep(open * 0.54 + ragged - 0.025, open * 0.54 + ragged + 0.025, centerDist);
    part *= smoothstep(0.54, 0.62, u);
    float edgeGlow = (1.0 - smoothstep(0.0, 0.045, abs(centerDist - open * 0.54))) * smoothstep(0.54, 0.68, u) * (1.0 - open);
    vec3 c = mix(m, cb, part);
    // Loose fibres overlap both sides of the parting line so the reveal keeps a physical
    // textile fringe instead of cutting directly into the theatre's geometric seat grid.
    float fringeBand = 1.0 - smoothstep(0.0, 0.085, abs(centerDist - open * 0.54 + ragged * 0.55));
    float strandLines = 0.5 + 0.5 * sin(vUv.x * 430.0 + fibreLong * 24.0 + vUv.y * 18.0);
    float fringe = fringeBand * smoothstep(0.56, 0.72, u) * (1.0 - smoothstep(0.91, 1.0, u)) * (0.35 + strandLines * 0.65);
    c = mix(c, felt * 1.35 + vec3(0.055, 0.008, 0.004), fringe * 0.48);
    c += vec3(0.24, 0.055, 0.025) * edgeGlow;
    fragColor = vec4(c, 1.0);`,
  doorPush: `
    vec3 ca = texture(texA, vUv).rgb;
    // Incoming cathedral is slightly magnified and lowered at first, then settles:
    // a small scale/eye-height jump rather than a flat lateral wipe.
    float settle = smoothstep(0.10, 1.00, u);
    float zoom = mix(1.075, 1.0, settle);
    vec2 buv = (vUv - vec2(0.5, 0.5)) / zoom + vec2(0.5, mix(0.535, 0.5, settle));
    vec3 cb = texture(texB, clamp(buv, 0.0, 1.0)).rgb;
    float whip = smoothstep(0.0, 0.62, u);
    float edgePos = mix(1.18, -0.16, whip);
    float open = 1.0 - smoothstep(edgePos - 0.018, edgePos + 0.018, vUv.x);
    float blur = 0.018 * (1.0 - whip);
    vec3 aa = texture(texA, vUv + vec2(blur, 0.0)).rgb * 0.5 + texture(texA, vUv - vec2(blur, 0.0)).rgb * 0.5;
    float fibre = fbm(vUv * vec2(150.0, 26.0), 4) * 0.5 + 0.5;
    aa *= 0.74 + fibre * 0.18;
    float edgeBand = (1.0 - smoothstep(0.0, 0.055, abs(vUv.x - edgePos))) * (1.0 - smoothstep(0.52, 0.68, u));
    float shadow = smoothstep(edgePos, edgePos + 0.24, vUv.x) * (1.0 - smoothstep(0.42, 0.66, u));
    vec3 edgeCol = vec3(0.09, 0.018, 0.012) * (0.65 + fibre * 0.5);
    vec3 c = mix(cb, aa, open);
    c = mix(c, edgeCol, edgeBand * 0.92);
    c *= 1.0 - shadow * 0.38;
    fragColor = vec4(c, 1.0);`,
  lightFall: `
    vec3 ca = texture(texA, vUv).rgb;
    vec3 cb = texture(texB, vUv).rgb;
    // Several machine-light streaks decelerate, lengthen, and warm into hallway god-rays.
    float warm = smoothstep(0.12, 0.88, u);
    float lenBoost = mix(0.45, 1.45, smoothstep(0.18, 0.9, u));
    vec3 streakCol = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float lane = -0.34 + fi * 0.23 + (hash12(vec2(fi, 3.7)) - 0.5) * 0.08;
      float travel = fract(vUv.y * 0.32 + u * (1.0 - 0.32 * u) * 0.42 + fi * 0.29);
      float x = vUv.x - 0.5 - lane - (vUv.y - 0.5) * mix(0.11, 0.28, warm);
      float core = pow(max(0.0, 1.0 - abs(x) * mix(11.0, 5.0, warm)), 2.1) * 0.58;
      core += pow(max(0.0, 1.0 - abs(x) * mix(5.5, 2.6, warm)), 1.15) * 0.26;
      float lengthMask = smoothstep(0.0, 0.12 * lenBoost, travel) * (1.0 - smoothstep(0.52 * lenBoost, 0.92 * lenBoost, travel));
      lengthMask *= smoothstep(0.0, 0.035, travel) * (1.0 - smoothstep(0.965, 1.0, travel));
      streakCol += mix(vec3(0.28, 0.56, 1.25), vec3(1.35, 0.73, 0.31), warm) * core * lengthMask;
    }
    float sustain = smoothstep(0.02, 0.18, u) * (1.0 - smoothstep(0.58, 0.88, u));
    vec3 c = mix(ca, cb, smoothstep(0.22, 0.90, u));
    c += streakCol * max(0.0, sustain) * 0.43;
    fragColor = vec4(c, 1.0);`,
};

export class ThresholdShaderTransition implements Transition {
  private pass: FSPass;

  constructor(private ctx: TransitionCtx, private mode: ThresholdTransitionMode) {
    this.pass = new FSPass(`
      uniform sampler2D texA;
      uniform sampler2D texB;
      uniform float u;
      void main() {
        ${BODY[mode]}
        vec3 endB = texture(texB, vUv).rgb;
        fragColor = vec4(mix(fragColor.rgb, endB, smoothstep(${mode === 'exposure' || mode === 'ink' ? '0.82' : '0.965'}, 1.0, u)), 1.0);
      }
    `, {
      texA: { value: null },
      texB: { value: null },
      u: { value: 0 },
    });
  }

  render(_f: Frame, out: THREE.WebGLRenderTarget, a: THREE.Texture, b: THREE.Texture, api: TransitionAPI): PostOverrides | void {
    this.pass.u.texA!.value = a;
    this.pass.u.texB!.value = b;
    this.pass.u.u!.value = Math.min(1, Math.max(0, api.u));
    this.pass.render(this.ctx.renderer, out, true);
    this.ctx.renderer.resetState();
    // Scene post fades/flashes are global post parameters, not per-texture effects. Suppress them
    // inside the seam; each THRESHOLD transition owns its black/white/fibre treatment here.
    // Exposure carries the outgoing office flash for the first instants of T1 instead
    // of cutting it off at the seam boundary; the shader whiteout is already rising,
    // so this bridge removes the one-frame black hole without extending the seam.
    const flashCarry = this.mode === 'exposure'
      ? smoothstep(29.35, 30.0, _f.t) * 1.8 * (1 - smoothstep(0, 0.18, api.u))
      : 0;
    return { flash: flashCarry, fade: 0 };
  }
}
