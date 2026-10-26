// Glyph coverage demo: full alphabet, digits, punctuation and the film strings in extruded type under a plain light.
import * as THREE from 'three';
import { defineScene, type SceneContext } from '../../../engine/dsl';
import { type Frame } from '../../../engine/scene';

const ROWS: [string, number][] = [
  ['ABCDEFGHIJKLM', 0.62],
  ['NOPQRSTUVWXYZ', 0.62],
  ['0123456789', 0.62],
  ['. , ! ? \' " : ; - _ / % + = ( ) & \u00B0', 0.5],
  ['IT DOES NOT BEND', 0.62],
  ['YOU WERE ITS DESTINATION.', 0.5],
  ['170,000 YEARS   8 MIN 20 S   42\u00B0', 0.5],
];

export default defineScene({
  id: 'glyphs',
  rigMode: 'perspective',
  particleCapacity: 64,
  lineCapacity: 64,
  sdfCapacity: 64,

  setup: async (ctx: SceneContext) => {
    ctx.rig.setLensMm(35);
    ctx.rig.setPath([
      { t: 0, pos: [0, 0, 10.5], target: [0, 0, 0], roll: 0, focalLength: 35 },
      { t: 1, pos: [0, 0, 10.5], target: [0, 0, 0], roll: 0, focalLength: 35 },
    ]);
    ctx.scene3D.background = new THREE.Color(0x101014);
    ctx.scene3D.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-2, 3, 8);
    ctx.scene3D.add(key);
    ROWS.forEach(([txt, size], i) => {
      ctx.text3D(`g${i}`, txt, { size, depth: 0.12, letterSpacing: 0.1, position: [0, 2.9 - i * 0.98, 0] });
    });
  },

  render: (ctx: SceneContext, f: Frame, out: THREE.WebGLRenderTarget) => {
    const { renderer } = ctx;
    ctx.updateCamera(f.t, 0);
    ctx.layer2d.clear();
    ctx.flush(out, true);
    ctx.sceneGraph.syncTelemetry(f.t);
    renderer.resetState();
  },
});
