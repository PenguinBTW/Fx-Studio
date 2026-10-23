import Act5BridgeChase from '../src/scenes/music_video/act5_bridge_chase';
import * as THREE from 'three';

const canvas = { getContext: () => ({ fillRect: () => {}, clearRect: () => {}, font: '', fillStyle: '', measureText: () => ({ width: 10 }) }), remove: () => {} } as any;
const ctx = { W: 1920, H: 1080, canvas } as any;
const scene = new Act5BridgeChase(ctx);
await scene.init();
scene.update(97.11);
const cam = scene.camera;
console.log('Cam pos:', cam.position);
const nearObjs: any[] = [];
scene.threeScene.traverse((obj: any) => {
  if (obj.isMesh && obj.visible) {
    const wp = new THREE.Vector3();
    obj.getWorldPosition(wp);
    const dist = wp.distanceTo(cam.position);
    if (dist < 35) {
      nearObjs.push({
        name: obj.name || obj.parent?.name || 'mesh',
        pos: [wp.x, wp.y, wp.z],
        dist,
        geo: obj.geometry?.type,
        mat: obj.material?.name || obj.material?.type
      });
    }
  }
});
nearObjs.sort((a,b) => a.dist - b.dist);
console.log('Near objects:', JSON.stringify(nearObjs.slice(0, 15), null, 2));
