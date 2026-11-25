// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// startrail — astrophotography register: an hour-long exposure compressed to
// 30s. Stars wheel about the celestial pole in growing circular arcs — the
// Earth's rotation written directly into the sky — while rare meteors slash
// through. The tripod is LOCKED: the catalog's only fixed-camera scene; the sky
// provides all motion. Arcs are closed-form in the vertex shader — each vertex
// carries its sweep fraction u in [0,1] and rotates by (rate*t*u) about the
// pole axis via Rodrigues, so exposure growth needs no accumulation buffer.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { CameraRig } from '../../engine/rig';

function hash1(i: number, salt: number): number {
  const h = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

const N_STARS = 1500;
const SEG = 64;
const RATE = 0.014; // rad/s sky rotation — 0.42 rad sweep over 30s
const AXIS = new THREE.Vector3(0.0, Math.sin(0.61), Math.cos(0.61)).normalize();

interface Meteor { t0: number; dur: number; origin: THREE.Vector3; dir: THREE.Vector3; }

const METEORS: Meteor[] = [
  { t0: 9.2, dur: 0.8, origin: new THREE.Vector3(-38, 42, -88), dir: new THREE.Vector3(0.86, -0.42, 0.28).normalize() },
  { t0: 17.6, dur: 0.65, origin: new THREE.Vector3(30, 55, -82), dir: new THREE.Vector3(-0.78, -0.5, 0.37).normalize() },
  { t0: 24.8, dur: 0.9, origin: new THREE.Vector3(-8, 62, -78), dir: new THREE.Vector3(0.5, -0.72, 0.48).normalize() },
];

export default class Startrail extends Scene {
  private cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 300);
  private world = new THREE.Scene();
  private rig = new CameraRig('perspective');
  private trailMat: THREE.ShaderMaterial | null = null;
  private trailMesh: THREE.Points | null = null;
  private meteorMat: THREE.ShaderMaterial | null = null;
  private meteorMesh: THREE.LineSegments | null = null;
  private ridgeMat: THREE.MeshBasicMaterial | null = null;
  private ridgeMesh: THREE.Mesh | null = null;
  private disposables: { dispose(): void }[] = [];

  override async init() {
    // ---- star arcs: GL_LINES, per-vertex sweep fraction ----
    const verts: number[] = [];
    const fracs: number[] = [];
    const colors: number[] = [];
    for (let i = 0; i < N_STARS; i++) {
      // distribute over the sky hemisphere facing -Z with wide margins
      const azm = hash1(i, 1) * Math.PI * 2;
      const elv = Math.asin(hash1(i, 2)) * 0.92 + 0.05;
      const r = 96;
      const bx = Math.cos(elv) * Math.cos(azm) * r;
      const by = Math.sin(elv) * r;
      const bz = -Math.abs(Math.cos(elv) * Math.sin(azm) * r) - 8;
      // stellar color: hot blue-white to cool amber, brightness varied
      const temp = hash1(i, 3);
      const cr = temp < 0.3 ? 0.75 + temp : 1.0;
      const cg = temp < 0.3 ? 0.85 + temp * 0.5 : 0.85;
      const cb = temp < 0.3 ? 1.0 : 0.55 + temp * 0.4;
      const bright = 0.4 + Math.pow(hash1(i, 4), 2.2) * 1.1;
      for (let s = 0; s <= SEG; s++) {
        const u0 = s / SEG;
        verts.push(bx, by, bz);
        fracs.push(u0);
        const f0 = 0.45 + u0 * 0.55;
        colors.push(cr * bright * f0, cg * bright * f0, cb * bright * f0);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('aFrac', new THREE.Float32BufferAttribute(fracs, 1));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.trailMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uSweep: { value: 0 },
        uAxis: { value: AXIS },
      },
      vertexShader: `
        attribute float aFrac;
        varying vec3 vColor;
        uniform float uSweep;
        uniform vec3 uAxis;
        void main(){
          // Rodrigues rotation of the base position by angle uSweep*aFrac about uAxis
          float ang = uSweep * aFrac;
          float c = cos(ang);
          float s = sin(ang);
          vec3 p = position;
          vec3 pr = p * c + cross(uAxis, p) * s + uAxis * dot(uAxis, p) * (1.0 - c);
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(pr, 1.0);
          gl_PointSize = 2.6;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        void main(){ vec2 d = gl_PointCoord - 0.5; float a = 1.0 - smoothstep(0.2, 0.5, length(d)); gl_FragColor = vec4(vColor * a, 1.0); }`,
      vertexColors: true,
    });
    this.trailMesh = new THREE.Points(geo, this.trailMat);
    this.trailMesh.frustumCulled = false;
    this.world.add(this.trailMesh);
    this.disposables.push(geo, this.trailMat);

    // ---- meteors: 3 events x 14 segments, shader evaluates closed-form ----
    const mVerts: number[] = [];
    const mInfo: number[] = []; // x: meteor index, y: fraction along trail
    for (let m = 0; m < METEORS.length; m++) {
      for (let s = 0; s < 14; s++) {
        mVerts.push(0, 0, 0, 0, 0, 0);
        mInfo.push(m, s / 14, m, (s + 1) / 14);
      }
    }
    const mgeo = new THREE.BufferGeometry();
    mgeo.setAttribute('position', new THREE.Float32BufferAttribute(mVerts, 3));
    mgeo.setAttribute('aInfo', new THREE.Float32BufferAttribute(mInfo, 2));
    const m0 = METEORS[0], m1 = METEORS[1], m2 = METEORS[2];
    this.meteorMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uT0: { value: new THREE.Vector3(m0.t0, m1.t0, m2.t0) },
        uDur: { value: new THREE.Vector3(m0.dur, m1.dur, m2.dur) },
        uOrg: { value: [m0.origin, m1.origin, m2.origin] },
        uDir: { value: [m0.dir, m1.dir, m2.dir] },
      },
      vertexShader: `
        attribute vec2 aInfo;
        varying float vFade;
        uniform float uTime;
        uniform vec3 uT0;
        uniform vec3 uDur;
        uniform vec3 uOrg[3];
        uniform vec3 uDir[3];
        void main(){
          int mi = int(aInfo.x + 0.5);
          float frac = aInfo.y;
          float t0 = mi == 0 ? uT0.x : (mi == 1 ? uT0.y : uT0.z);
          float dur = mi == 0 ? uDur.x : (mi == 1 ? uDur.y : uDur.z);
          vec3 org = uOrg[mi];
          vec3 dir = uDir[mi];
          float mt = (uTime - t0) / dur;
          float head = clamp(mt, 0.0, 1.0);
          // trail fraction: 1 = head, 0 = tail start; tail length 0.3 of path
          float back = head - (1.0 - frac) * 0.3;
          float active = step(0.0, mt) * step(mt, 1.35);
          float vis = step(0.0, back) * active;
          vec3 p = org + dir * (back * 90.0);
          // brightness envelope: flash in, fade out
          vFade = vis * frac * smoothstep(0.0, 0.08, mt) * (1.0 - smoothstep(0.75, 1.3, mt));
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        varying float vFade;
        void main(){ gl_FragColor = vec4(vec3(0.75, 1.0, 0.85) * vFade * 1.6, 1.0); }`,
    });
    this.meteorMesh = new THREE.LineSegments(mgeo, this.meteorMat);
    this.meteorMesh.frustumCulled = false;
    this.world.add(this.meteorMesh);
    this.disposables.push(mgeo, this.meteorMat);

    // ---- ridge silhouette: opaque black, drawn first, occludes stars below horizon ----
    const ridgeShape = new THREE.Shape();
    ridgeShape.moveTo(-60, -30);
    const ridgePts: [number, number][] = [];
    for (let i = 0; i <= 24; i++) {
      const x = -60 + (i / 24) * 120;
      const y = -6 + Math.sin(i * 0.7) * 3.5 + Math.sin(i * 2.3 + 1.7) * 1.8 + hash1(i, 40) * 2.0;
      ridgePts.push([x, y]);
    }
    for (const [x, y] of ridgePts) ridgeShape.lineTo(x, y);
    ridgeShape.lineTo(60, -30);
    ridgeShape.closePath();
    const ridgeGeo = new THREE.ShapeGeometry(ridgeShape);
    this.ridgeMat = new THREE.MeshBasicMaterial({ color: 0x020204 });
    this.ridgeMesh = new THREE.Mesh(ridgeGeo, this.ridgeMat);
    this.ridgeMesh.position.set(0, 0, -55);
    this.ridgeMesh.renderOrder = 1;
    this.world.add(this.ridgeMesh);
    this.disposables.push(ridgeGeo, this.ridgeMat);

    this.rig.setLensMm(24);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const rr = this.ctx.renderer;
    const lt = f.t;
    this.trailMat!.uniforms.uSweep.value = RATE * lt;
    this.meteorMat!.uniforms.uTime.value = lt;

    // LOCKED tripod — same frame every frame; rig used per the scene-optics rule
    this.rig.orbit([0, 18, -60], 30, 0.05, 0.0);
    const spec = this.rig.evalCam(0);
    this.rig.syncToThreeCamera(spec, this.cam);
    this.cam.lookAt(0, 26, -80);

    rr.setRenderTarget(out);
    rr.setClearColor(0x010103, 1);
    rr.clear(true, true, true);
    rr.render(this.world, this.cam);
    rr.resetState();
    return { exposure: 1.45, bloom: 0.28, vignette: 0.4 } as PostOverrides;
  }

  override dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
