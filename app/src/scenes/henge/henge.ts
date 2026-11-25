// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// henge — archaeoastronomy register: a stone circle keeping time. A full day
// compressed to 30s — the sun arcs low and the stones' shadows sweep the plain
// like clock hands, until the sun drops exactly into the trilithon gap and
// light spears the circle's heart. The catalog has no ancient structure and no
// scene where cast shadow itself is the moving subject. One sun clock drives
// light color, sky gradient, and shadow sweep — all closed-form in t.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { smoothstep } from '../../engine/util';
import { CameraRig } from '../../engine/rig';
import { blackbodyToLinearSRGB } from '../../engine/spectrum';

function hash1(i: number, salt: number): number {
  const h = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

export default class Henge extends Scene {
  private cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 300);
  private world = new THREE.Scene();
  private rig = new CameraRig('perspective');
  private sun: THREE.DirectionalLight | null = null;
  private hemi: THREE.HemisphereLight | null = null;
  private skyMat: THREE.ShaderMaterial | null = null;
  private skyMesh: THREE.Mesh | null = null;
  private groundMat: THREE.MeshStandardMaterial | null = null;
  private stoneMat: THREE.MeshStandardMaterial | null = null;
  private stones: THREE.Mesh[] = [];
  private mistMat: THREE.ShaderMaterial | null = null;
  private mistMesh: THREE.Mesh | null = null;
  private shadowWasEnabled = false;
  private shadowCaptured = false;
  private disposables: { dispose(): void }[] = [];

  override async init() {
    // ---- sky dome: gradient driven by sun elevation ----
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uDay: { value: 0 }, uDuskGlow: { value: 0 }, uSunDir: { value: new THREE.Vector3(1, 0.1, 0) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP;
        uniform float uDay;
        uniform float uDuskGlow;
        uniform vec3 uSunDir;
        void main(){
          vec3 d = normalize(vP);
          float h = d.y;
          // night-indigo base, pale blue day
          vec3 zenithN = vec3(0.012, 0.018, 0.05);
          vec3 horizonN = vec3(0.05, 0.06, 0.11);
          vec3 zenithD = vec3(0.28, 0.42, 0.62);
          vec3 horizonD = vec3(0.65, 0.72, 0.78);
          vec3 zc = mix(zenithN, zenithD, uDay);
          vec3 hc = mix(horizonN, horizonD, uDay);
          vec3 col = mix(hc, zc, smoothstep(0.0, 0.55, h));
          // dawn/dusk glow lobe around the sun azimuth near the horizon
          float sunAmt = max(0.0, dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))));
          float lobe = pow(sunAmt, 3.0) * (1.0 - smoothstep(0.0, 0.35, abs(h - 0.06)));
          col += vec3(0.9, 0.42, 0.15) * lobe * uDuskGlow;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), this.skyMat);
    this.world.add(this.skyMesh);
    this.disposables.push(this.skyMesh.geometry, this.skyMat);

    // ---- ground: dark moor grass ----
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0x2a3324, roughness: 0.95, metalness: 0 });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.world.add(ground);
    this.disposables.push(ground.geometry, this.groundMat);

    // ---- stones: 9 monoliths + trilithon pair with lintel ----
    this.stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a6560, roughness: 0.92, metalness: 0.02 });
    this.disposables.push(this.stoneMat);
    const addStone = (x: number, z: number, w: number, h: number, d: number, seed: number) => {
      const geo = new THREE.BoxGeometry(w, h, d, 2, 3, 2);
      // weathered irregularity: deterministic vertex jitter
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const jx = (hash1(i, seed) - 0.5) * 0.14;
        const jz = (hash1(i, seed + 9) - 0.5) * 0.14;
        pos.setX(i, pos.getX(i) + jx);
        pos.setZ(i, pos.getZ(i) + jz);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, this.stoneMat!);
      m.position.set(x, h / 2 - 0.15, z);
      m.rotation.y = hash1(seed, 3) * 0.5 - 0.25;
      m.rotation.z = (hash1(seed, 5) - 0.5) * 0.06;
      m.castShadow = true;
      m.receiveShadow = true;
      this.world.add(m);
      this.stones.push(m);
      this.disposables.push(geo);
    };
    // ring of monoliths, gap at the solstice axis (+X)
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2 + 0.3;
      // skip stones near the trilithon axis
      if (Math.abs(Math.cos(ang)) > 0.94) continue;
      const r = 5.2;
      const h = 2.6 + hash1(i, 7) * 1.1;
      addStone(Math.cos(ang) * r, Math.sin(ang) * r, 1.1 + hash1(i, 2) * 0.5, h, 0.7 + hash1(i, 4) * 0.3, i * 13 + 1);
    }
    // trilithon: two tall pillars astride +X axis, lintel across — the sightline gap faces the sunset
    addStone(6.2, -1.1, 1.2, 4.2, 0.9, 101);
    addStone(6.2, 1.1, 1.2, 4.2, 0.9, 102);
    const lintelGeo = new THREE.BoxGeometry(1.0, 0.8, 3.4);
    const lintel = new THREE.Mesh(lintelGeo, this.stoneMat);
    lintel.position.set(6.2, 4.2 + 0.3, 0);
    lintel.castShadow = true;
    this.world.add(lintel);
    this.stones.push(lintel);
    this.disposables.push(lintelGeo);

    // ---- low dawn mist billboard ring ----
    this.mistMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uMist: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec2 vUv;
        uniform float uMist;
        void main(){
          float band = (1.0 - smoothstep(0.35, 0.95, vUv.y)) * smoothstep(0.0, 0.25, vUv.y);
          float lat = sin(vUv.x * 40.0) * 0.5 + 0.5;
          gl_FragColor = vec4(vec3(0.5, 0.55, 0.6), band * lat * 0.18 * uMist);
        }`,
    });
    this.mistMesh = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 2.2, 48, 1, true), this.mistMat);
    this.mistMesh.position.y = 0.8;
    this.mistMesh.renderOrder = 3;
    this.world.add(this.mistMesh);
    this.disposables.push(this.mistMesh.geometry, this.mistMat);

    // ---- the sun clock ----
    this.sun = new THREE.DirectionalLight(0xffffff, 2.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const sc = this.sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.far = 220;
    this.sun.shadow.bias = -0.0006;
    this.world.add(this.sun);
    this.world.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0x30405c, 0x1a140f, 0.4);
    this.world.add(this.hemi);

    this.rig.setLensMm(40);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const rr = this.ctx.renderer;
    const lt = f.t;

    // ---- sun clock: elevation and azimuth closed-form ----
    // day progress: 0 at 5s (sunrise) to 1 at 28.5s (sunset alignment)
    const day = smoothstep(5, 28.5, lt);
    // elevation: arcs to a low 32° noon — a winter's day, long shadows all day
    const elev = Math.sin(day * Math.PI) * 0.52 + 0.015 - 0.075 * (1.0 - smoothstep(3.5, 5, lt));
    // azimuth: rises in the east (+X slightly south), sets west... but the alignment
    // needs the sun ON the +X axis at the end — so the arc runs east(-X) to west(+X
    // through south). Sweep: az from -2.6 rad to +0.0 rad measured around Y.
    const az = -2.6 + day * 2.6;
    const sunDir = new THREE.Vector3(
      Math.cos(az) * Math.cos(elev),
      Math.sin(elev),
      Math.sin(az) * Math.cos(elev),
    );
    // sun position far away along direction; target at circle center
    this.sun!.position.copy(sunDir.clone().multiplyScalar(60));
    this.sun!.target.position.set(0, 0, 0);
    this.sun!.target.updateMatrixWorld();

    // light color/intensity from elevation — low sun warm, high sun neutral
    const dayness = smoothstep(-0.02, 0.12, elev);
    const warmth = 1.0 - smoothstep(0.1, 0.45, elev);
    const temp = 2600 + (1 - warmth) * 3500;
    const [kr, kg, kb] = blackbodyToLinearSRGB(temp);
    this.sun!.color.setRGB(kr, kg, kb);
    this.sun!.intensity = 0.02 + dayness * 2.7;
    this.hemi!.intensity = 0.38 + dayness * 0.4;

    // sky uniforms
    this.skyMat!.uniforms.uDay.value = dayness;
    this.skyMat!.uniforms.uDuskGlow.value = warmth * (0.4 + dayness * 0.6);
    this.skyMat!.uniforms.uSunDir.value.copy(sunDir);
    this.mistMat!.uniforms.uMist.value = 1.0 - smoothstep(6, 14, lt);

    // ---- camera: slow orbit holding the trilithon gap in frame ----
    const yaw = Math.PI - Math.max(0, 29.2 - lt) * 0.03;
    this.rig.orbit([2.0, 1.4, 0], 18, 0.17 + 0.02 * Math.sin(lt * 0.1), yaw);
    const spec = this.rig.evalCam(lt);
    this.rig.syncToThreeCamera(spec, this.cam);

    if (!this.shadowCaptured) { this.shadowWasEnabled = rr.shadowMap.enabled; this.shadowCaptured = true; }
    rr.shadowMap.enabled = true;
    rr.shadowMap.needsUpdate = true;

    rr.setRenderTarget(out);
    rr.clear(true, true, true);
    rr.render(this.world, this.cam);
    rr.resetState();
    const align = smoothstep(27.5, 29.5, lt);
    return { exposure: 0.65 + dayness * 0.5 + align * 0.1, bloom: 0.2 + align * 0.25, vignette: 0.45 } as PostOverrides;
  }

  override dispose() {
    const rr = this.ctx.renderer;
    rr.shadowMap.enabled = this.shadowWasEnabled;
    for (const d of this.disposables) d.dispose();
    this.sun?.dispose();
    this.hemi?.dispose();
  }
}
