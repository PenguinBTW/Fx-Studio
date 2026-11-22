// city_world: the living world around the a4_city kit so the city never sits in a void. Closed-form in city time T:
// terrain (hills one side, a bay the other), a sky-reflecting sea with sun glitter, the street grid with streetlights,
// car traffic (head/tail lights at night) that thins out as the city is abandoned, suburbs whose windows light at night,
// forests on the hills and trees that reclaim the streets during the decay.
import * as THREE from 'three';
import { clamp } from '../../engine/util';

const h = (i: number, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const SPAN = 52, NCAR = 900, NHOUSE = 1600, NTREE = 2600, NRECLAIM = 260;
const ROADS: { x: number; z: number; alongX: boolean }[] = [];
for (let k = 0; k <= 15; k++) { const c = (k - 7.5) * 3.2; ROADS.push({ x: c, z: 0, alongX: false }, { x: 0, z: c, alongX: true }); }
ROADS.push({ x: 0, z: 0, alongX: false });

/** Ground height: flat city plate (r < 32), hills rising to the north-west, the shore falling into a bay to the south-east. */
export function heightAt(x: number, z: number): number {
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  const side = 0.5 + 0.5 * Math.cos(a - 0.75 + 0.35 * Math.sin(r * 0.04));
  const ramp = clamp((r - 32) / 70);
  const n = Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05 - 0.7) * 0.6 + Math.sin(x * 0.11 - z * 0.08) * 0.25 + Math.sin(x * 0.23 + z * 0.19) * 0.1;
  const hills = ramp * ramp * (38 + 22 * n) * Math.pow(1 - side, 1.4);
  const bay = -9 * clamp((r - 34) / 26) * Math.pow(side, 1.6);
  return r < 32 ? 0 : hills + bay + ramp * 2.5 * n;
}

const WATER_VS = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FS = `uniform vec3 uTop, uBot, uSunCol, uSun, uFog, uCity; uniform float uT, uFogD, uNight; varying vec3 vW;
void main(){
  vec3 v = normalize(vW - cameraPosition);
  vec2 p = vW.xz;
  vec2 g = vec2(cos(p.x * 0.9 + uT * 1.3) * 0.5 + cos(p.x * 2.3 - p.y * 1.1 + uT * 2.1) * 0.3 + cos(p.x * 5.1 + p.y * 3.7 + uT * 3.3) * 0.12,
                cos(p.y * 0.8 - uT * 1.1) * 0.5 + cos(p.y * 2.7 + p.x * 0.9 + uT * 1.7) * 0.3 + cos(p.y * 4.9 - p.x * 4.1 - uT * 2.9) * 0.12);
  vec3 n = normalize(vec3(-g.x * 0.07, 1.0, -g.y * 0.07));
  vec3 r = reflect(v, n);
  vec3 sky = mix(uBot, uTop, smoothstep(-0.02, 0.55, r.y));
  float fr = 0.02 + 0.98 * pow(1.0 - max(dot(-v, n), 0.0), 5.0);
  vec3 deep = uBot * 0.06 + vec3(0.004, 0.012, 0.016);
  vec3 c = mix(deep, sky, fr) + uSunCol * pow(max(dot(r, normalize(uSun)), 0.0), 380.0) * 14.0;
  float cd = length(p);
  c += uCity * uNight * exp(-max(cd - 30.0, 0.0) * 0.04) * (0.5 + 0.5 * fr) * (0.6 + 0.4 * sin(p.x * 3.0 + g.y * 4.0));
  float d = length(vW - cameraPosition), fo = 1.0 - exp(-pow(uFogD * d, 2.0));
  gl_FragColor = vec4(mix(c, uFog, fo), 1.0);
}`;

export class CityWorld {
  group = new THREE.Group();
  private terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  private water: THREE.ShaderMaterial;
  private cars: THREE.InstancedMesh;
  private lamps: THREE.InstancedMesh;
  private houses: THREE.InstancedMesh;
  private windows: THREE.InstancedMesh;
  private trees: THREE.InstancedMesh;
  private reclaim: THREE.InstancedMesh;
  private lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private winMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private carMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private m = new THREE.Matrix4(); private c = new THREE.Color(); private q = new THREE.Quaternion(); private p = new THREE.Vector3(); private s = new THREE.Vector3();
  private car = Array.from({ length: NCAR }, (_, i) => ({ road: Math.floor(h(i, 1) * ROADS.length), dir: h(i, 2) < 0.5 ? -1 : 1, sp: 2.5 + 5 * h(i, 3), ph: h(i, 4), k: h(i, 5), body: h(i, 6) }));
  private disposables: { dispose(): void }[] = [];

  constructor() {
    const tg = new THREE.PlaneGeometry(900, 900, 240, 240); tg.rotateX(-Math.PI / 2);
    const P = tg.attributes.position!, col = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), z = P.getZ(i), y = heightAt(x, z), r = Math.hypot(x, z), v = h(i, 9) * 0.25;
      P.setY(i, y);
      const c = r < 33 ? [0.13, 0.125, 0.12] : y < 0.8 ? [0.5, 0.45, 0.34] : y < 18 ? [0.1 + v * 0.2, 0.17 + v * 0.25, 0.07] : [0.3 + v * 0.2, 0.29 + v * 0.2, 0.27 + v * 0.2];
      col.set(c, i * 3);
    }
    tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); tg.computeVertexNormals();
    const terrain = new THREE.Mesh(tg, this.terrainMat); terrain.receiveShadow = true;
    this.water = new THREE.ShaderMaterial({ vertexShader: WATER_VS, fragmentShader: WATER_FS, fog: false, toneMapped: false,
      uniforms: { uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() }, uFog: { value: new THREE.Color() }, uCity: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uT: { value: 0 }, uFogD: { value: 0.002 }, uNight: { value: 0 } } });
    const wg = new THREE.PlaneGeometry(900, 900); wg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(wg, this.water); water.position.y = -0.4;
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.7 });
    const roads = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 1), roadMat, ROADS.length);
    ROADS.forEach((rd, i) => { const w = rd.x === 0 && rd.z === 0 ? 2.2 : 0.95; this.s.set(rd.alongX ? SPAN : w, 1, rd.alongX ? w : SPAN); roads.setMatrixAt(i, this.m.compose(this.p.set(rd.x, 0.012, rd.z), this.q.identity(), this.s)); });
    roads.receiveShadow = true;
    this.lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), this.lampMat, ROADS.length * 17 * 2);
    let li = 0;
    for (const rd of ROADS) for (let j = 0; j < 17; j++) for (const sd of [-1, 1]) {
      const a = (j - 8) * 3.2, o = sd * (rd.x === 0 && rd.z === 0 ? 1.2 : 0.55);
      this.lamps.setMatrixAt(li++, this.m.makeTranslation(rd.alongX ? a : rd.x + o, 0.9, rd.alongX ? rd.z + o : a));
    }
    this.cars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.09, 0.34), this.carMat, NCAR);
    const houseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const hg = new THREE.BoxGeometry(1, 1, 1); hg.translate(0, 0.5, 0);
    this.houses = new THREE.InstancedMesh(hg, houseMat, NHOUSE);
    this.windows = new THREE.InstancedMesh(hg, this.winMat, NHOUSE);
    let hi = 0;
    for (let i = 0; hi < NHOUSE && i < NHOUSE * 6; i++) {
      const r = 36 + 120 * Math.pow(h(i, 11), 1.3), a = h(i, 12) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, y = heightAt(x, z);
      if (y < 0.2 || y > 12) continue;
      const w = 0.8 + 1.4 * h(i, 13), d = 0.8 + 1.2 * h(i, 14), ht = 0.6 + 2.2 * h(i, 15) * Math.exp(-(r - 36) / 60);
      this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, h(i, 16) * Math.PI);
      this.houses.setMatrixAt(hi, this.m.compose(this.p.set(x, y - 0.3, z), this.q, this.s.set(w, ht + 0.3, d)));
      this.houses.setColorAt(hi, this.c.setRGB(0.55 + 0.3 * h(i, 17), 0.5 + 0.25 * h(i, 17), 0.45 + 0.2 * h(i, 18)));
      this.windows.setMatrixAt(hi, this.m.compose(this.p.set(x, y + ht * 0.45, z), this.q, this.s.set(w * 1.02, Math.min(0.14, ht * 0.15), d * 1.02)));
      this.windows.setColorAt(hi, this.c.setRGB(0, 0, 0));
      hi++;
    }
    this.houses.count = this.windows.count = hi;
    this.houses.castShadow = true; this.houses.receiveShadow = true;
    const trMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
    const cg = new THREE.ConeGeometry(0.6, 1.8, 6); cg.translate(0, 0.9, 0);
    this.trees = new THREE.InstancedMesh(cg, trMat, NTREE);
    let ti = 0;
    for (let i = 0; ti < NTREE && i < NTREE * 6; i++) {
      const r = 34 + 160 * Math.pow(h(i, 21), 0.9), a = h(i, 22) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, y = heightAt(x, z);
      if (y < 0.6 || y > 30) continue;
      const sc = 0.8 + 1.6 * h(i, 23);
      this.trees.setMatrixAt(ti, this.m.compose(this.p.set(x, y - 0.1, z), this.q.identity(), this.s.set(sc, sc * (0.9 + 0.5 * h(i, 24)), sc)));
      this.trees.setColorAt(ti, this.c.setRGB(0.08 + 0.08 * h(i, 25), 0.16 + 0.1 * h(i, 25), 0.06));
      ti++;
    }
    this.trees.count = ti;
    this.reclaim = new THREE.InstancedMesh(cg, trMat, NRECLAIM);
    for (let i = 0; i < NRECLAIM; i++) this.reclaim.setColorAt(i, this.c.setRGB(0.12 + 0.1 * h(i, 31), 0.2 + 0.12 * h(i, 31), 0.07));
    for (const im of [this.cars, this.lamps, this.trees, this.reclaim]) im.frustumCulled = false;
    this.group.add(terrain, water, roads, this.lamps, this.cars, this.houses, this.windows, this.trees, this.reclaim);
    this.disposables.push(tg, wg, this.terrainMat, this.water, roadMat, roads.geometry, this.lamps.geometry, this.lampMat, this.cars.geometry, this.carMat, hg, houseMat, this.winMat, cg, trMat);
  }

  /** built: 0..1 city finished; night: 0..1; decay: 0..1 abandonment; collapse: 0..1. */
  update(T: number, o: { built: number; night: number; decay: number; collapse: number; top: THREE.Color; bot: THREE.Color; sun: THREE.Vector3; sunCol: THREE.Color; fog: THREE.Color; fogD: number; tint: THREE.Color }) {
    const U = this.water.uniforms;
    (U.uTop!.value as THREE.Color).copy(o.top); (U.uBot!.value as THREE.Color).copy(o.bot); (U.uSunCol!.value as THREE.Color).copy(o.sunCol);
    (U.uFog!.value as THREE.Color).copy(o.fog); (U.uSun!.value as THREE.Vector3).copy(o.sun); (U.uCity!.value as THREE.Color).setRGB(1.2, 0.6, 0.25);
    U.uT!.value = T; U.uFogD!.value = o.fogD; U.uNight!.value = o.night * (1 - o.decay);
    this.terrainMat.color.copy(o.tint);
    const live = o.built * (1 - o.decay) * (1 - o.collapse);
    const glow = 0.25 + 3.2 * o.night;
    let n = 0;
    for (let i = 0; i < NCAR; i++) {
      const cr = this.car[i]!;
      if (cr.k >= live) continue;
      const rd = ROADS[cr.road]!, lane = cr.dir * (rd.x === 0 && rd.z === 0 ? 0.5 : 0.2);
      const a = (((cr.ph * SPAN + cr.dir * cr.sp * T) % SPAN) + SPAN) % SPAN - SPAN / 2;
      this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rd.alongX ? Math.PI / 2 : 0);
      this.cars.setMatrixAt(n, this.m.compose(this.p.set(rd.alongX ? a : rd.x + lane, 0.07, rd.alongX ? rd.z + lane : a), this.q, this.s.set(1, 1, 1)));
      if (o.night > 0.5) this.c.setRGB(...(cr.dir > 0 ? [1.0, 0.92, 0.8] : [1.0, 0.08, 0.04]) as [number, number, number]).multiplyScalar(glow);
      else this.c.setRGB(...([[0.8, 0.8, 0.78], [0.12, 0.12, 0.14], [0.55, 0.08, 0.06], [0.1, 0.2, 0.45]][Math.floor(cr.body * 4)]!) as [number, number, number]).multiplyScalar(0.5 + 0.5 * (1 - o.night));
      this.cars.setColorAt(n++, this.c);
    }
    this.cars.count = n;
    this.cars.instanceMatrix.needsUpdate = true; if (this.cars.instanceColor) this.cars.instanceColor.needsUpdate = true;
    const lampOn = o.night * (1 - o.collapse);
    for (let i = 0; i < this.lamps.count; i++) {
      const dead = h(i, 41) < o.decay * 1.15 || (o.decay > 0 && h(i + Math.floor(T * 9), 42) < 0.15 * o.decay);
      this.lamps.setColorAt(i, this.c.setRGB(1.0, 0.62, 0.28).multiplyScalar(dead ? 0.02 : 0.05 + 3.5 * lampOn));
    }
    if (this.lamps.instanceColor) this.lamps.instanceColor.needsUpdate = true;
    for (let i = 0; i < this.windows.count; i++) {
      const on = h(i, 51) < 0.75 && h(i, 52) > o.decay * 1.1 ? o.night * (1 - o.collapse) : 0;
      this.windows.setColorAt(i, this.c.setRGB(1.0, 0.7, 0.35).multiplyScalar(0.03 + on * (1.6 + h(i, 53) * 1.6)));
    }
    if (this.windows.instanceColor) this.windows.instanceColor.needsUpdate = true;
    for (let i = 0; i < NRECLAIM; i++) {
      const rd = ROADS[i % ROADS.length]!, a = (h(i, 61) - 0.5) * SPAN * 0.9, o2 = (h(i, 62) - 0.5) * 0.8;
      const g = clamp((o.decay - h(i, 63) * 0.6) / 0.4) * (0.35 + 0.5 * h(i, 64));
      this.reclaim.setMatrixAt(i, this.m.compose(this.p.set(rd.alongX ? a : rd.x + o2, 0, rd.alongX ? rd.z + o2 : a), this.q.identity(), this.s.setScalar(Math.max(1e-4, g))));
    }
    this.reclaim.instanceMatrix.needsUpdate = true;
  }

  dispose() { this.disposables.forEach((d) => d.dispose()); }
}
