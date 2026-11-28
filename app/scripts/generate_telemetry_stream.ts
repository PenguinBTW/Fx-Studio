import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { projectWorldToScreenPan, type TelemetryFrame } from '../src/engine/audio';
import * as THREE from 'three';

const outFile = resolve(import.meta.dir, '../../out/events.jsonl');
mkdirSync(dirname(outFile), { recursive: true });

const fps = 60;
const totalFrames = 1200; // 20.0 seconds
const lines: string[] = [];

// Virtual Camera matching SceneContext Perspective Camera
const camera = new THREE.PerspectiveCamera(50, 1920 / 1080, 0.1, 1000);

for (let frame = 0; frame <= totalFrames; frame++) {
  const t = frame / fps;
  const sources: TelemetryFrame['sources'] = {};

  if (t <= 11.8) {
    // Scene 1: The Core Crucible
    const p = t / 11.8;
    const camX = Math.sin(p * Math.PI * 0.7) * 2.2;
    const camY = 1.8 - 0.7 * p + 0.3 * Math.sin(p * Math.PI);
    const camZ = 6.2 - 4.8 * p;
    camera.position.set(camX, camY, camZ);
    const targetX = p > 0.65 ? 2.4 * Math.min(1.0, (p - 0.65) / 0.25) : 0;
    const targetY = 1.0 - 0.5 * p;
    const targetZ = p > 0.85 ? -2.0 * ((p - 0.85) / 0.15) : 0;
    camera.lookAt(targetX, targetY, targetZ);
    camera.updateMatrixWorld();

    const spindlePos: [number, number, number] = [0, 1.2, 0];
    const { pan, distance, ndc } = projectWorldToScreenPan(
      spindlePos,
      camera.matrixWorldInverse.elements,
      camera.projectionMatrix.elements,
      0.65
    );

    let rotorSpeed = 42.0;
    if (t > 8.5) {
      const stallU = Math.min(1.0, (t - 8.5) / 2.5);
      rotorSpeed = 42.0 * Math.pow(1.0 - stallU, 2.5) + 0.8;
    }

    sources.core_spindle = {
      sourceId: 'core_spindle',
      pos: spindlePos,
      screenPos: ndc,
      pan: +pan.toFixed(3),
      distance: +distance.toFixed(3),
      velocity: +(rotorSpeed * 0.15).toFixed(3),
      zone: 'crucible_chamber',
      occluded: false,
    };
  }

  if (t >= 10.8) {
    // Scene 2: The Interconnect Chasm
    const p = (t - 10.8) / (20.0 - 10.8);

    let capsuleZ = 0;
    let capsuleVel = 0;
    if (t < 13.0) {
      capsuleZ = 2.0 - (t - 10.8) * 5.5;
      capsuleVel = 5.5;
    } else if (t < 15.63) {
      const brakeU = (t - 13.0) / 2.63;
      const easeBrake = 1.0 - Math.pow(1.0 - brakeU, 2.5);
      capsuleZ = -10.1 - easeBrake * 3.9;
      capsuleVel = 5.5 * Math.pow(1.0 - brakeU, 1.8);
    } else {
      capsuleZ = -14.0;
      capsuleVel = 0;
    }

    let camPos: [number, number, number];
    let camTarget: [number, number, number];
    if (p < 0.55) {
      const chaseU = p / 0.55;
      camPos = [1.8 - 0.6 * chaseU, 1.6 - 0.4 * chaseU, capsuleZ + 4.8 - 1.2 * chaseU];
      camTarget = [0, 0.45, capsuleZ - 0.5];
    } else {
      const inspectU = (p - 0.55) / 0.45;
      const smoothU = inspectU * inspectU * (3.0 - 2.0 * inspectU);
      camPos = [0.45 * (1.0 - smoothU), 1.05 - 0.35 * smoothU, -14.0 + 2.2 - 0.6 * smoothU];
      camTarget = [0, 0.42, -14.0 + 0.4];
    }

    camera.position.set(...camPos);
    camera.lookAt(...camTarget);
    camera.updateMatrixWorld();

    const capsulePos: [number, number, number] = [0, 0.42, capsuleZ];
    const { pan, distance, ndc } = projectWorldToScreenPan(
      capsulePos,
      camera.matrixWorldInverse.elements,
      camera.projectionMatrix.elements,
      0.65
    );

    sources.carrier_capsule = {
      sourceId: 'carrier_capsule',
      pos: capsulePos,
      screenPos: ndc,
      pan: +pan.toFixed(3),
      distance: +distance.toFixed(3),
      velocity: +capsuleVel.toFixed(3),
      zone: 'subterranean_canyon',
      occluded: false,
    };
  }

  const tf: TelemetryFrame = {
    frame,
    t: +t.toFixed(4),
    sources,
  };
  lines.push(JSON.stringify(tf));
}

writeFileSync(outFile, lines.join('\n') + '\n');
console.log(`Successfully generated ${lines.length} frames of 3D audio telemetry to: ${outFile}`);
