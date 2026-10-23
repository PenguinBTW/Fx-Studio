// =============================================================================
// BEAT 4: THE INVERSION (58.0s - 72.0s)
//
// - 58.0 - 63.0s: Slow zoom in on input circle resolving into 20,000-particle human silhouette
// - 63.0 - 67.0s: Figure reaches forward, pulse leaves hand and dies in red gap (rhymes Beat 1)
// - ~4% particles peel off the fingertips at impact and drift away into the void
// - 67.0 - 70.0s: Fast pullback reverse zoom to Beat 0 door slider resting EXACTLY halfway (0.50)
// - 70.0 - 72.0s: Hold in profound silence. Hard clean cut to black at 72.0s.
// =============================================================================

import * as THREE from 'three';
import { clamp, lerp, ease, prog, mulberry32 } from '../../engine/util';
import { HEX, LIN } from './palette';
import { PulseSparks, type SparkSegment } from './pulse_sparks';

export class Beat4Inversion {
  group = new THREE.Group();

  // 20,000-particle human silhouette
  readonly particleCount = 20000;
  private pointsMesh: THREE.Points;
  private basePositions: Float32Array;
  private currentPositions: Float32Array;
  private particleColors: Float32Array;
  private driftPhases: Float32Array;
  private isFingertipParticle: Uint8Array;

  // Interlock line coordinates in Beat 4
  readonly handPos: [number, number, number] = [0.24, 0.08, 0.0];
  readonly gapPos: [number, number, number] = [0.48, 0.08, 0.0];

  constructor() {
    this.basePositions = new Float32Array(this.particleCount * 3);
    this.currentPositions = new Float32Array(this.particleCount * 3);
    this.particleColors = new Float32Array(this.particleCount * 4);
    this.driftPhases = new Float32Array(this.particleCount);
    this.isFingertipParticle = new Uint8Array(this.particleCount);

    this.generateHumanSilhouette();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.currentPositions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 4));

    // Delicate starlit particle shader: fine 1.8px points with soft Gaussian falloff
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: /* glsl */ `
        precision highp float;
        in vec4 color;
        out vec4 vColor;
        void main() {
          vColor = color;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 2.2;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        in vec4 vColor;
        out vec4 fragColor;
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float distSq = dot(coord, coord);
          if (distSq > 0.25) discard;
          float alpha = exp(-distSq * 9.0) * vColor.a;
          fragColor = vec4(vColor.rgb * alpha, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.pointsMesh = new THREE.Points(geo, mat);
    this.group.add(this.pointsMesh);
  }

  /**
   * Generates anatomically graceful human silhouette in profile facing right.
   */
  private generateHumanSilhouette(): void {
    const rnd = mulberry32(1048576);
    const bone = LIN.bone;

    let pIdx = 0;
    while (pIdx < this.particleCount) {
      const segChoice = rnd();
      let x = 0, y = 0, z = 0;
      let isFingertip = 0;

      if (segChoice < 0.15) {
        // Head & Cranium (profile facing right)
        // Center around (-0.03, 0.24)
        const rad = 0.045 * Math.cbrt(rnd());
        const ang = rnd() * Math.PI * 2;
        const noseBump = (ang > -0.4 && ang < 0.4) ? 0.015 : 0.0;
        x = -0.03 + Math.cos(ang) * (rad + noseBump);
        y = 0.24 + Math.sin(ang) * rad * 1.15;
        z = (rnd() - 0.5) * 0.030;
      } else if (segChoice < 0.22) {
        // Neck
        const u = rnd();
        x = lerp(-0.04, -0.01, u) + (rnd() - 0.5) * 0.020;
        y = lerp(0.16, 0.20, u);
        z = (rnd() - 0.5) * 0.024;
      } else if (segChoice < 0.52) {
        // Torso & Pelvis
        const u = rnd();
        // Chest arcs forward at u = 0.7, spine curves gently back at u = 0.4
        const spineCurve = Math.sin(u * Math.PI) * 0.025;
        const width = lerp(0.055, 0.042, u) * Math.sqrt(rnd());
        const ang = rnd() * Math.PI * 2;
        x = lerp(-0.06, -0.02, u) + spineCurve + Math.cos(ang) * width;
        y = lerp(-0.06, 0.16, u);
        z = Math.sin(ang) * width * 0.7;
      } else if (segChoice < 0.74) {
        // Reaching Right Arm (reaching toward lever/line on right)
        // Shoulder (-0.01, 0.14) -> Elbow (0.09, 0.11) -> Hand (0.24, 0.08)
        const u = rnd();
        let armX = 0, armY = 0;
        if (u < 0.5) {
          const uArm = u / 0.5;
          armX = lerp(-0.01, 0.09, uArm);
          armY = lerp(0.14, 0.11, uArm);
        } else {
          const uArm = (u - 0.5) / 0.5;
          armX = lerp(0.09, 0.24, uArm);
          armY = lerp(0.11, 0.08, uArm);
        }
        const thickness = lerp(0.020, 0.009, u) * Math.sqrt(rnd());
        const ang = rnd() * Math.PI * 2;
        x = armX + Math.cos(ang) * thickness;
        y = armY + Math.sin(ang) * thickness;
        z = (rnd() - 0.5) * 0.018;

        // Fingertip particles (near x > 0.21)
        if (u > 0.88) {
          isFingertip = 1;
        }
      } else if (segChoice < 0.82) {
        // Left Arm (resting at side)
        const u = rnd();
        const armX = lerp(-0.05, -0.06, u);
        const armY = lerp(0.13, -0.03, u);
        const thickness = 0.016 * Math.sqrt(rnd());
        const ang = rnd() * Math.PI * 2;
        x = armX + Math.cos(ang) * thickness;
        y = armY + Math.sin(ang) * thickness;
        z = (rnd() - 0.5) * 0.020;
      } else {
        // Legs (hips down to feet on ground at y = -0.30)
        const isForwardLeg = rnd() > 0.5;
        const u = rnd();
        const legX0 = isForwardLeg ? -0.02 : -0.07;
        const legX1 = isForwardLeg ? 0.01 : -0.08;
        const legX = lerp(legX0, legX1, u);
        const legY = lerp(-0.06, -0.30, u);
        const thickness = lerp(0.024, 0.012, u) * Math.sqrt(rnd());
        const ang = rnd() * Math.PI * 2;
        x = legX + Math.cos(ang) * thickness;
        y = legY;
        z = (rnd() - 0.5) * 0.022;
      }

      this.basePositions[pIdx * 3] = x;
      this.basePositions[pIdx * 3 + 1] = y;
      this.basePositions[pIdx * 3 + 2] = z;

      this.currentPositions[pIdx * 3] = x;
      this.currentPositions[pIdx * 3 + 1] = y;
      this.currentPositions[pIdx * 3 + 2] = z;

      this.driftPhases[pIdx] = rnd() * Math.PI * 2;
      this.isFingertipParticle[pIdx] = isFingertip;

      // Soft starlit bone color with delicate opacity
      this.particleColors[pIdx * 4] = bone[0];
      this.particleColors[pIdx * 4 + 1] = bone[1];
      this.particleColors[pIdx * 4 + 2] = bone[2];
      this.particleColors[pIdx * 4 + 3] = 0.40 + 0.35 * rnd();

      pIdx++;
    }
  }

  /**
   * Updates Beat 4 figure dynamics, reach gesture, particle leakage, and pulse.
   */
  update(t: number): {
    activePulse: { p0: [number, number, number]; p1: [number, number, number]; intensity: number } | null;
    sparks: SparkSegment[];
    gapFlare: number;
    figureAlpha: number;
  } {
    const pos = this.currentPositions;
    const base = this.basePositions;
    const colors = this.particleColors;
    const phases = this.driftPhases;
    const isFinger = this.isFingertipParticle;

    // 1. Reach Gesture at t = 63.5s
    const reachProg = prog(t, 63.0, 63.8, ease.outCubic) - prog(t, 66.2, 67.5, ease.inOutCubic);
    const reachOffset = reachProg * 0.025;

    // 2. Particle Leakage (~4% of particles peel off hand at t >= 63.85s)
    const leakAge = Math.max(0, t - 63.85);

    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      const i4 = i * 4;
      const phase = phases[i]!;

      // Gentle organic breathing shimmer
      const driftX = Math.sin(t * 1.5 + phase) * 0.0012 + Math.cos(t * 2.1 + phase * 2.0) * 0.0006;
      const driftY = Math.cos(t * 1.3 + phase) * 0.0014;

      let x = base[i3]! + driftX;
      let y = base[i3 + 1]! + driftY;
      let z = base[i3 + 2]!;

      if (isFinger[i]) {
        x += reachOffset;

        // Intent leakage: particles peel off and disperse into void
        if (leakAge > 0 && i % 3 === 0) {
          x += leakAge * 0.055;
          y += Math.sin(leakAge * 2.5 + phase) * 0.018 - leakAge * 0.012;
          colors[i4 + 3] = Math.max(0, 0.65 - leakAge * 0.38);
        }
      }

      pos[i3] = x;
      pos[i3 + 1] = y;
      pos[i3 + 2] = z;
    }

    (this.pointsMesh.geometry.attributes['position'] as THREE.BufferAttribute).needsUpdate = true;
    (this.pointsMesh.geometry.attributes['color'] as THREE.BufferAttribute).needsUpdate = true;

    // 3. Pulse from hand to red gap (triggers at t0 = 63.5s)
    // Travel duration: 0.35s -> arrives at 63.85s
    const pulseData = PulseSparks.getTravelingPulse(
      t,
      63.5,
      this.handPos,
      this.gapPos,
      0.35
    );

    const gapFlare = PulseSparks.getGapFlare(t, 63.5, 0.35);
    const sparks = PulseSparks.getSparks(t, 63.5, this.gapPos, 0.35, 48, 888);

    // 4. Figure Alpha Fade (dissolves during 67.0s - 70.0s pullback)
    const figureAlpha = clamp(prog(t, 58.0, 59.5, ease.outCubic) * (1.0 - prog(t, 67.0, 69.5, ease.inOutCubic)));
    this.pointsMesh.visible = figureAlpha > 0.01;

    return {
      activePulse: pulseData,
      sparks,
      gapFlare,
      figureAlpha,
    };
  }
}
