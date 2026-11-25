// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// cymatics — acoustics register: sound made visible. Sand on a vibrating plate
// migrates into Chladni nodal-line figures as the driving frequency climbs —
// pitch as geometry. Grains are pre-sampled ON the nodal lines of three modes
// (rejection-sampled deterministically against the exact implicit Chladni
// equation); the performance is the morph between figure memberships with
// transition turbulence. All closed-form in t — no granular simulation.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { smoothstep } from '../../engine/util';
import { CameraRig } from '../../engine/rig';

function hash1(i: number, salt: number): number {
  const h = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

const N_GRAINS = 5500;
const HALF = 4.0; // plate half-width

// Chladni figures on a square: cos(nπx)cos(mπy) − cos(mπx)cos(nπy); nodal lines where zero
function chladni(n: number, m: number, x: number, y: number): number {
  const a = Math.cos(n * Math.PI * x / HALF) * Math.cos(m * Math.PI * y / HALF);
  const b = Math.cos(m * Math.PI * x / HALF) * Math.cos(n * Math.PI * y / HALF);
  return a - b;
}

const MODES: [number, number][] = [[1, 2], [2, 3], [1, 3]];
// transition windows: mode k settles after dissolve
const TRANSITIONS = [
  { dissolve: [3.5, 6.0], form: [6.0, 9.0] },
  { dissolve: [11.5, 14.0], form: [14.0, 17.0] },
  { dissolve: [19.5, 22.0], form: [22.0, 25.0] },
];

export default class Cymatics extends Scene {
  private cam = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
  private world = new THREE.Scene();
  private rig = new CameraRig('perspective');
  private grainMat: THREE.ShaderMaterial | null = null;
  private grainMesh: THREE.Points | null = null;
  private plateMesh: THREE.Mesh | null = null;
  private plateMat: THREE.MeshStandardMaterial | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  private disposables: { dispose(): void }[] = [];

  override async init() {
    // ---- grains: for each mode, rejection-sample positions near nodal lines ----
    const modePositions: Float32Array[] = [];
    for (let m = 0; m < MODES.length; m++) {
      const [n, mm] = MODES[m];
      const arr = new Float32Array(N_GRAINS * 3);
      for (let i = 0; i < N_GRAINS; i++) {
        // deterministic rejection sampling: walk candidates until one lands near a node
        let x = 0, y = 0, found = false;
        for (let attempt = 0; attempt < 60; attempt++) {
          const cx = (hash1(i * 61 + attempt, m * 7 + 1) * 2 - 1) * HALF * 0.94;
          const cy = (hash1(i * 61 + attempt, m * 7 + 2) * 2 - 1) * HALF * 0.94;
          if (Math.abs(chladni(n, mm, cx, cy)) < 0.045) { x = cx; y = cy; found = true; break; }
          x = cx; y = cy;
        }
        if (!found) { /* keep last candidate — sparse grain off the lines */ }
        arr[i * 3] = x;
        arr[i * 3 + 1] = 0.02;
        arr[i * 3 + 2] = y;
      }
      modePositions.push(arr);
    }
    // scatter positions (pre-vibration random)
    const scatter = new Float32Array(N_GRAINS * 3);
    for (let i = 0; i < N_GRAINS; i++) {
      scatter[i * 3] = (hash1(i, 90) * 2 - 1) * HALF * 0.94;
      scatter[i * 3 + 1] = 0.02;
      scatter[i * 3 + 2] = (hash1(i, 91) * 2 - 1) * HALF * 0.94;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(scatter, 3));
    geo.setAttribute('aMode0', new THREE.BufferAttribute(modePositions[0], 3));
    geo.setAttribute('aMode1', new THREE.BufferAttribute(modePositions[1], 3));
    geo.setAttribute('aMode2', new THREE.BufferAttribute(modePositions[2], 3));
    const seeds = new Float32Array(N_GRAINS);
    for (let i = 0; i < N_GRAINS; i++) seeds[i] = hash1(i, 55);
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.grainMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uW0: { value: 0 }, uW1: { value: 0 }, uW2: { value: 0 },
        uChaos: { value: 0 },
      },
      vertexShader: `
        attribute vec3 aMode0;
        attribute vec3 aMode1;
        attribute vec3 aMode2;
        attribute float aSeed;
        uniform float uTime;
        uniform float uW0;
        uniform float uW1;
        uniform float uW2;
        uniform float uChaos;
        varying float vShade;
        void main(){
          vec3 p = position * (1.0 - uW0 - uW1 - uW2) + aMode0 * uW0 + aMode1 * uW1 + aMode2 * uW2;
          // vibration jitter: ever-present micro dance, amplified in chaos transitions
          float amp = 0.012 + uChaos * 0.12;
          float jt = uTime * (23.0 + aSeed * 9.0);
          p.x += sin(jt + aSeed * 40.0) * amp;
          p.z += cos(jt * 1.3 + aSeed * 71.0) * amp;
          p.y += abs(sin(jt * 0.7 + aSeed * 13.0)) * amp * 0.6;
          vShade = 0.55 + aSeed * 0.45;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = 2.4;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vShade;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          if (length(d) > 0.5) discard;
          gl_FragColor = vec4(vec3(0.82, 0.74, 0.58) * vShade, 1.0);
        }`,
    });
    this.grainMesh = new THREE.Points(geo, this.grainMat);
    this.grainMesh.frustumCulled = false;
    this.world.add(this.grainMesh);
    this.disposables.push(geo, this.grainMat);

    // ---- plate: blackened steel square ----
    this.plateMat = new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.4, metalness: 0.85 });
    this.plateMesh = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 0.6, 0.25, HALF * 2 + 0.6), this.plateMat);
    this.plateMesh.position.y = -0.14;
    this.world.add(this.plateMesh);
    this.disposables.push(this.plateMesh.geometry, this.plateMat);

    this.keyLight = new THREE.DirectionalLight(0xfff4e2, 2.2);
    this.keyLight.position.set(5, 9, 3);
    this.world.add(this.keyLight);
    const rim = new THREE.DirectionalLight(0xcfe0ff, 1.1);
    rim.position.set(-6, 4, -5);
    this.world.add(rim);
    const amb = new THREE.AmbientLight(0x14161c, 1.4);
    this.world.add(amb);
    this.disposables.push({ dispose: () => { this.keyLight?.dispose(); rim.dispose(); amb.dispose(); } });

    this.rig.setLensMm(40);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const rr = this.ctx.renderer;
    const lt = f.t;

    // weight ladder: each figure forms, holds, then RELEASES toward scatter as it dissolves —
    // the release is what makes grains visibly scatter before the next figure forms
    const f0in = smoothstep(3.5, 8.0, lt);
    const f0out = smoothstep(11.5, 14.0, lt);
    const f1in = smoothstep(14.0, 17.0, lt);
    const f1out = smoothstep(19.5, 22.0, lt);
    const w0v = f0in * (1 - f0out);
    const w1v = f1in * (1 - f1out);
    const w2v = smoothstep(22.0, 25.0, lt);
    const w0 = w0v, w1 = w1v, w2 = w2v;
    // turbulence peaks mid-transition: strong when any figure is half-released
    const bell = (x: number) => x * (1 - x) * 4;
    const chaos = Math.max(bell(f0out), bell(f1out), bell(f1in) * 0.6, bell(smoothstep(22.0, 25.0, lt)) * 0.4);
    this.grainMat!.uniforms.uTime.value = lt;
    this.grainMat!.uniforms.uW0.value = w0;
    this.grainMat!.uniforms.uW1.value = w1;
    this.grainMat!.uniforms.uW2.value = w2;
    this.grainMat!.uniforms.uChaos.value = chaos;

    // overhead oblique observation drift
    this.rig.orbit([0, 0, 0], 15.5, 0.82 + Math.sin(lt * 0.04) * 0.02, lt * 0.014);
    const spec = this.rig.evalCam(lt);
    this.rig.syncToThreeCamera(spec, this.cam);

    rr.setRenderTarget(out);
    rr.setClearColor(0x050608, 1);
    rr.clear(true, true, true);
    rr.render(this.world, this.cam);
    rr.resetState();
    return {
      exposure: 1.05,
      bloom: 0.18,
      vignette: 0.5,
      depthFocusDist: 15.5,
      depthAperture: 5,
      depthDof: { near: 0.1, far: 100 },
    } as PostOverrides;
  }



  override dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
