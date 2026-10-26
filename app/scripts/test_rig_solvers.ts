import * as THREE from 'three';
import { CameraRig, solveDollyZoom, dollyZoomAt, orbitPosition, focusDistance, computeScreenFocusRadius } from '../src/engine/rig';
import { ViewportSpace } from '../src/engine/viewport';
import type { V3 } from '../src/engine/util';

let fails = 0;
const check = (name: string, ok: boolean, info = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`);
  if (!ok) fails++;
};

function makeCam(pos: V3, target: V3, fov: number, aspect = 16 / 9) {
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.01, 1000);
  cam.position.set(...pos);
  cam.lookAt(new THREE.Vector3(...target));
  cam.updateMatrixWorld(true);
  return cam;
}

// 1. Dolly-zoom: projected height of a subject stays constant while fov sweeps 20..90
{
  const target: V3 = [1, 2, -3], dir: V3 = [0, 0, 1], width = 2.5;
  let maxRel = 0, first = 0;
  for (let fov = 20; fov <= 90; fov += 1) {
    const { position } = solveDollyZoom(target, dir, width, fov);
    const cam = makeCam(position, target, fov);
    const a = new THREE.Vector3(target[0], target[1] - width / 2, target[2]).project(cam);
    const b = new THREE.Vector3(target[0], target[1] + width / 2, target[2]).project(cam);
    const h = b.y - a.y;
    if (fov === 20) first = h;
    maxRel = Math.max(maxRel, Math.abs(h - first) / first);
  }
  check('dolly-zoom projected size constant (fov 20..90)', maxRel < 1e-3, `max rel err ${maxRel.toExponential(2)}`);

  const fovOfT = (t: number) => 20 + 70 * t;
  const r0 = dollyZoomAt(target, dir, width, fovOfT, 0.37);
  const r1 = solveDollyZoom(target, dir, width, fovOfT(0.37));
  check('dollyZoomAt matches solveDollyZoom', r0.fov === r1.fov && r0.position.every((v, i) => v === r1.position[i]));

  const rig = new CameraRig();
  rig.position = [1, 2, -10];
  rig.target = [1, 2, -3];
  const res = rig.dollyZoom([1, 2, -3], width, 45);
  const cam = makeCam(rig.position, rig.target, 45);
  const a = new THREE.Vector3(1, 2 - width / 2, -3).project(cam);
  const b = new THREE.Vector3(1, 2 + width / 2, -3).project(cam);
  check('rig.dollyZoom subject fills frame height', Math.abs((b.y - a.y) - 2) < 1e-3 && res.fov === 45, `ndc h ${(b.y - a.y).toFixed(5)}`);
  const camFov = ViewportSpace.focalLengthToFov(rig.focalLengthPx, 1080);
  check('rig.dollyZoom lens matches fov', Math.abs(camFov - 45) < 1e-6, `fov ${camFov}`);
}

// 2. Orbit distance invariance + aim
{
  const target: V3 = [3, -1, 2], R = 7.5;
  let maxErr = 0;
  for (let pi = -80; pi <= 80; pi += 20) {
    for (let yi = 0; yi < 360; yi += 15) {
      const p = orbitPosition(target, R, pi * Math.PI / 180, yi * Math.PI / 180);
      maxErr = Math.max(maxErr, Math.abs(Math.hypot(p[0] - target[0], p[1] - target[1], p[2] - target[2]) - R));
    }
  }
  check('orbit distance invariant', maxErr < 1e-9, `max err ${maxErr.toExponential(2)}`);
  const up = orbitPosition(target, R, Math.PI / 6, 0);
  check('orbit pitch>0 raises camera, yaw 0 on +Z', up[1] > target[1] && Math.abs(up[0] - target[0]) < 1e-12 && up[2] > target[2]);
}

// 3. focusDistance vs THREE projection
{
  const camPos: V3 = [2, 1, -9], tgt: V3 = [0.5, 0.2, 0];
  const aim: V3 = [-1, 0.5, 1];
  const cam = makeCam(camPos, aim, 40);
  const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd);
  const pts: V3[] = [tgt, [3, 2, 4], [-2, -1, 6]];
  let maxErr = 0, maxEuc = 0;
  for (const p of pts) {
    const d = focusDistance(camPos, p, [fwd.x, fwd.y, fwd.z]);
    const v = new THREE.Vector3(...p).project(cam);
    // NDC z -> view-space depth for a perspective camera
    const n = cam.near, f = cam.far;
    const depth = (2 * n * f) / ((f + n) - v.z * (f - n));
    maxErr = Math.max(maxErr, Math.abs(d - depth) / depth);
    maxEuc = Math.max(maxEuc, Math.abs(focusDistance(camPos, p) - depth));
  }
  check('focusDistance (axis) matches projected depth', maxErr < 1e-4, `max rel err ${maxErr.toExponential(2)}`);
  check('Euclidean variant differs off-axis (sanity)', maxEuc > 1e-3);

  const rig = new CameraRig(); rig.position = camPos; rig.target = [camPos[0], camPos[1], camPos[2] + 5];
  check('rig.focusDistance on axis', Math.abs(rig.focusDistance([camPos[0], camPos[1], camPos[2] + 12]) - 12) < 1e-9);

  const centre = computeScreenFocusRadius(aim, cam, 16 / 9);
  const off = computeScreenFocusRadius([3, 2, 4], cam, 16 / 9);
  check('screen focus radius 0 at centre, >0 off', centre < 1e-6 && off > 0.05, `centre ${centre.toExponential(1)} off ${off.toFixed(3)}`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall rig solver tests passed');
process.exit(fails ? 1 : 0);
