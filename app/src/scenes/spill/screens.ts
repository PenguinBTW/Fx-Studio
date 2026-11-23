// What plays on SPILL's hanging screens: an 8-tile procedural atlas (colour bars, terminal, pixel hills,
// cartoon sky, static, video call, map, error screen) + an instanced emissive material that flickers per screen.
import * as THREE from 'three';
import { hash } from './kit';

export function screenAtlas(): THREE.CanvasTexture {
  const T = 256, c = document.createElement('canvas'); c.width = T * 4; c.height = T * 2; const g = c.getContext('2d')!;
  const tile = (i: number, fn: (x: number, y: number) => void) => { const x = (i % 4) * T, y = Math.floor(i / 4) * T; g.save(); g.beginPath(); g.rect(x, y, T, T); g.clip(); fn(x, y); g.restore(); };
  tile(0, (x, y) => { ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'].forEach((col, k) => { g.fillStyle = col; g.fillRect(x + k * T / 7, y, T / 7 + 1, T * 0.7); }); g.fillStyle = '#101010'; g.fillRect(x, y + T * 0.7, T, T * 0.3); g.fillStyle = '#fff'; g.fillRect(x + T * 0.3, y + T * 0.75, T * 0.15, T * 0.2); });
  tile(1, (x, y) => { g.fillStyle = '#04100a'; g.fillRect(x, y, T, T); g.fillStyle = '#3cff8a'; for (let k = 0; k < 18; k++) g.fillRect(x + 12 + (hash(k) * 3 | 0) * 14, y + 10 + k * 13, 30 + hash(k + 9) * 170, 6); g.fillStyle = '#ff8a1e'; g.fillRect(x + 14, y + 10 + 18 * 13, 8, 10); });
  tile(2, (x, y) => { g.fillStyle = '#5c94fc'; g.fillRect(x, y, T, T); g.fillStyle = '#fff'; for (let k = 0; k < 3; k++) g.fillRect(x + 20 + k * 80, y + 30 + k * 12, 48, 16);
    g.fillStyle = '#00a800'; for (let k = 0; k < 16; k++) { const h = 60 + Math.round(Math.sin(k * 0.8) * 30 / 16) * 16; g.fillRect(x + k * 16, y + T - h, 16, h); } g.fillStyle = '#c84c0c'; g.fillRect(x, y + T - 30, T, 30); g.fillStyle = '#ffcc00'; g.fillRect(x + 120, y + 110, 16, 16); });
  tile(3, (x, y) => { const gr = g.createLinearGradient(x, y, x, y + T); gr.addColorStop(0, '#7fd0ff'); gr.addColorStop(1, '#fff2c8'); g.fillStyle = gr; g.fillRect(x, y, T, T);
    g.fillStyle = '#ffd21a'; g.beginPath(); g.arc(x + 190, y + 60, 34, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#5dd35d'; g.beginPath(); g.ellipse(x + 80, y + T, 150, 70, 0, 0, 7); g.fill(); g.stroke(); });
  tile(4, (x, y) => { const im = g.createImageData(T, T); for (let k = 0; k < T * T; k++) { const v = hash(k * 1.37) * 255; im.data.set([v, v, v, 255], k * 4); } g.putImageData(im, x, y); });
  tile(5, (x, y) => { const cols = ['#e8b48c', '#8c5a3c', '#f0c8a0', '#6a4a3a']; for (let k = 0; k < 4; k++) { const gx = x + (k % 2) * T / 2, gy = y + (k >> 1) * T / 2; g.fillStyle = ['#2b3a55', '#3d2b55', '#2b5548', '#553a2b'][k]; g.fillRect(gx + 2, gy + 2, T / 2 - 4, T / 2 - 4);
    g.fillStyle = cols[k]; g.beginPath(); g.arc(gx + T / 4, gy + T / 4 - 6, 22, 0, 7); g.fill(); g.beginPath(); g.ellipse(gx + T / 4, gy + T / 2, 44, 34, 0, Math.PI, 0); g.fill(); } });
  tile(6, (x, y) => { g.fillStyle = '#e9e4d6'; g.fillRect(x, y, T, T); g.strokeStyle = '#ffffff'; g.lineWidth = 9; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(x, y + hash(k) * T); g.lineTo(x + T, y + hash(k + 5) * T); g.stroke(); }
    g.fillStyle = '#a8d8a0'; g.fillRect(x + 30, y + 40, 60, 50); g.fillStyle = '#9cc8f0'; g.fillRect(x + 150, y + 150, 80, 90); g.fillStyle = '#e8202a'; g.beginPath(); g.arc(x + 128, y + 120, 12, 0, 7); g.fill(); });
  tile(7, (x, y) => { g.fillStyle = '#0a3cc8'; g.fillRect(x, y, T, T); g.fillStyle = '#fff'; g.font = 'bold 64px sans-serif'; g.fillText(':(', x + 20, y + 80); for (let k = 0; k < 5; k++) g.fillRect(x + 22, y + 120 + k * 22, 120 + hash(k) * 100, 8); });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

export function screenMaterial(atlas: THREE.Texture, uT: { value: number }) {
  return new THREE.ShaderMaterial({ uniforms: { uAtlas: { value: atlas }, uT },
    vertexShader: /* glsl */ `attribute float aTile; attribute vec3 aTint; varying vec2 vUv; varying float vTile; varying vec3 vTint; varying float vDist;
      void main() { vUv = uv; vTile = aTile; vTint = aTint; vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform sampler2D uAtlas; uniform float uT; varying vec2 vUv; varying float vTile; varying vec3 vTint; varying float vDist;
      void main() { float id = floor(vTile); vec2 o = vec2(mod(id, 4.0), 1.0 - floor(id / 4.0)) * vec2(0.25, 0.5);
        vec2 uv = vUv; if (id == 4.0) uv = fract(uv + vec2(fract(sin(floor(uT * 15.0) * 7.1) * 99.0), fract(sin(floor(uT * 15.0) * 3.3) * 77.0)));
        vec3 c = texture2D(uAtlas, o + uv * vec2(0.25, 0.5)).rgb;
        float scan = 0.85 + 0.15 * sin(vUv.y * 420.0); float fl = 0.9 + 0.1 * sin(uT * 23.0 + fract(vTile) * 60.0);
        gl_FragColor = vec4(mix(c * vTint * scan * fl * 1.6, vec3(0.71, 0.35, 0.42), smoothstep(150.0, 1100.0, vDist) * 0.85), 1.0); }` });
}
