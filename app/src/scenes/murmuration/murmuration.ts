// murmuration — swarm emergence: a starling flock at dusk, thousands of birds moving as
// one organism. The catalog's first collective-behavior register. The flock streams in as
// a loose ribbon, gathers into a dense shape-shifting mass overhead — ball, pancake,
// streaming sheet — then pours down into the roost trees in a funnel vortex. Every bird
// is a closed-form evaluation f(seed, t): correlated swirl around a migrating centroid
// with shear and breathing anisotropy — no simulation, no mutable state.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { smoothstep, mulberry32 } from '../../engine/util';

const COUNT = 2400;

// --- flock choreography ---------------------------------------------------------
// the murmuration is one organism: a centroid path, a shape-morph schedule, and a
// final funnel descent into the roost. everything else is per-bird variation.

// centroid: wide slow loops across the sky, descending late toward the roost
function centroid(t: number, out: THREE.Vector3): THREE.Vector3 {
  const funnelK = smoothstep(20, 29.5, t);
  const x = 6.5 * Math.sin(t * 0.21) * (1 - funnelK) + 1.2 * funnelK;
  const z = -2.5 + 2.8 * Math.cos(t * 0.16) * (1 - funnelK);
  const y = 7.5 + 1.6 * Math.sin(t * 0.27 + 1) - 5.6 * funnelK * funnelK;
  out.set(x, y, z);
  return out;
}

// shape morphing: the flock breathes between a compact ball and a flattened streaming
// sheet — the signature shape-shift. returns ellipsoid axis scales.
function shapeAxes(t: number, out: THREE.Vector3): THREE.Vector3 {
  // slow morph cycle ~11s: ball -> pancake -> ribbon -> ball
  const ph = t * (2 * Math.PI) / 11;
  const flat = 0.5 + 0.5 * Math.sin(ph);            // 0 ball, 1 flat
  const ribbon = 0.5 + 0.5 * Math.sin(ph * 0.5 + 2.1); // elongation mode
  out.set(
    5.6 + 4.2 * ribbon,          // x elongation when streaming
    3.6 - 1.6 * flat,           // y squash when pancaking
    4.2 - 1.7 * flat,
  );
  return out;
}

// one bird's offset within the flock, closed-form. birds orbit the centroid with shear
// (inner orbits faster), radii breathing individually, phases from seed.
interface Bird {
  theta0: number;   // initial orbital angle
  phi0: number;     // inclination
  r0: number;       // base radius fraction
  speed: number;    // orbital speed multiplier
  wobble: number;   // individual radius breathing phase
  lane: number;     // streamer lane offset
}

function birdOffset(b: Bird, t: number, axes: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  // orbital angle advances with shear: outer birds slower
  const r = b.r0 * (0.72 + 0.28 * Math.sin(t * 0.5 + b.wobble));
  const shear = 1.35 - r * 0.7;
  const th = b.theta0 + t * b.speed * shear;
  // inclined orbit plane per bird — gives the flock thickness and internal flow
  const cp = Math.cos(b.phi0), sp = Math.sin(b.phi0);
  const ox = Math.cos(th) * r;
  const oy = Math.sin(th) * r * sp;
  const oz = Math.sin(th) * r * cp;
  out.set(ox * axes.x, oy * axes.y, oz * axes.z);
  return out;
}

export default class Murmuration extends Scene {
  private cam = new THREE.PerspectiveCamera(46, W / H, 0.1, 200);
  private world = new THREE.Scene();
  private inst: THREE.InstancedMesh | null = null;
  private birds: Bird[] = [];
  private main: THREE.WebGLRenderTarget | null = null;
  private dummy = new THREE.Object3D();
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3() };

  override async init() {
    // --- dusk sky: gradient dome with a low sun band in the west
    const skyGeo = new THREE.SphereGeometry(120, 32, 24);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: { uSunAz: { value: new THREE.Vector3(-0.85, 0.06, -0.5).normalize() } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunAz;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.08, 1.0);
          // dusk gradient: deep indigo zenith, ember band at the horizon
          vec3 zenith = vec3(0.055, 0.06, 0.14);
          vec3 mid = vec3(0.23, 0.12, 0.20);
          vec3 ember = vec3(0.85, 0.32, 0.10);
          vec3 col = mix(ember, mid, smoothstep(0.0, 0.16, h));
          col = mix(col, zenith, smoothstep(0.12, 0.55, h));
          // sun afterglow around the set sun's azimuth
          float sunD = max(dot(normalize(vDir), uSunAz), 0.0);
          col += vec3(1.0, 0.45, 0.15) * pow(sunD, 18.0) * 0.55;
          col += vec3(0.9, 0.35, 0.12) * pow(sunD, 5.0) * 0.16;
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.world.add(sky);

    // --- roost trees: a dark silhouette treeline on the horizon, densest at the
    // funnel's target — simple overlapping triangle-ish canopies, pure silhouette
    const treeMat = new THREE.MeshBasicMaterial({ color: 0x0a0a10 });
    const rnd = mulberry32(7);
    for (let i = 0; i < 26; i++) {
      const tx = -18 + i * 1.5 + rnd() * 0.8;
      const th = 1.6 + rnd() * 2.4 + (Math.abs(tx - 1.2) < 4 ? 1.2 : 0); // tallest near roost
      const tw = 1.1 + rnd() * 1.3;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(tw, th, 7), treeMat);
      cone.position.set(tx, th * 0.42, -14 - rnd() * 4);
      this.world.add(cone);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, th * 0.4, 5), treeMat);
      trunk.position.set(tx, th * 0.15, -14 - rnd() * 4);
      this.world.add(trunk);
    }
    // ground: near-black plane
    const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 40), new THREE.MeshBasicMaterial({ color: 0x070709 }));
    ground.rotation.x = -Math.PI / 2;
    this.world.add(ground);

    // --- the flock: instanced chevron birds. geometry: two swept triangles meeting at
    // a body point — reads as a flying bird silhouette at distance.
    const wing = new THREE.BufferGeometry();
    const verts = new Float32Array([
      // left wing triangle
      0, 0, 0.05, -0.09, 0.02, -0.03, 0, 0, -0.045,
      // right wing triangle
      0, 0, 0.05, 0.09, 0.02, -0.03, 0, 0, -0.045,
    ]);
    wing.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    wing.computeVertexNormals();
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x11101a, side: THREE.DoubleSide });
    this.inst = new THREE.InstancedMesh(wing, birdMat, COUNT);
    this.inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.world.add(this.inst);

    const rng = mulberry32(42);
    for (let i = 0; i < COUNT; i++) {
      this.birds.push({
        theta0: rng() * Math.PI * 2,
        phi0: (rng() - 0.5) * 2.4,
        r0: 0.25 + 0.75 * Math.pow(rng(), 0.6),
        speed: 0.9 + rng() * 0.7,
        wobble: rng() * Math.PI * 2,
        lane: rng(),
      });
    }
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.t;
    const rr = this.ctx.renderer;

    // stream-in phase: before gathering, the flock is a loose ribbon arriving from the
    // west — implemented as a temporal dilation of radius + offset along the stream
    const gatherK = smoothstep(1, 9, lt);   // 0 = dispersed ribbon, 1 = gathered flock
    const funnelK = smoothstep(20, 29.5, lt); // 1 = pouring into the roost

    centroid(lt, this.tmp.a);
    shapeAxes(lt, this.tmp.b);

    // update instances
    const axes = this.tmp.b;
    const cen = this.tmp.a;
    for (let i = 0; i < COUNT; i++) {
      const b = this.birds[i]!;
      birdOffset(b, lt, axes, this.tmp.c);
      // disperse: before gathering, birds spread along a wide ribbon trailing west
      const disperse = (1 - gatherK);
      this.tmp.c.x += disperse * (b.lane - 0.5) * 17 - disperse * 7;
      this.tmp.c.y += disperse * (b.lane - 0.5) * 3 + disperse * 0.8;
      this.tmp.c.z += disperse * (b.r0 - 0.5) * 10;
      // funnel: late, birds spiral down a narrowing cone toward the roost treetop
      if (funnelK > 0.001) {
        // vortex column: top stays high (visible against the ember band), base
        // narrows toward the roost — the pour is the money shot, don't hide it
        const funnelY = 1.6 + b.lane * 5.8 - funnelK * (1.1 - b.lane * 1.8);
        const funnelR = (0.5 + b.lane * 2.8) * (1 - funnelK * 0.35);
        const fa = b.theta0 + lt * (2.2 + b.speed);
        const fx = 1.2 + Math.cos(fa) * funnelR;
        const fz = -11.5 + Math.sin(fa) * funnelR;
        const fy = funnelY + 0.8;
        this.tmp.c.lerpVectors(this.tmp.c, this.tmp.d.set(fx - cen.x, fy - cen.y, fz - cen.z), funnelK);
      }
      this.dummy.position.set(cen.x + this.tmp.c.x, cen.y + this.tmp.c.y, cen.z + this.tmp.c.z);
      // orient along instantaneous motion direction — approximate with orbital tangent
      const th = b.theta0 + lt * b.speed * (1.35 - b.r0 * 0.7);
      this.dummy.rotation.set(0, -th + Math.PI / 2, Math.sin(th * 2) * 0.3);
      const sc = 0.85 + b.r0 * 0.5;
      this.dummy.scale.setScalar(sc);
      this.dummy.updateMatrix();
      this.inst!.setMatrixAt(i, this.dummy.matrix);
    }
    this.inst!.instanceMatrix.needsUpdate = true;

    // camera: wide tripod-ish shot, panning gently to hold the centroid in frame;
    // tilts down late as the flock pours into the trees
    const camX = cen.x * 0.22;
    const camY = 2.1 + 0.5 * funnelK;
    this.cam.position.set(camX, camY, 11.8);
    this.tmp.d.set(cen.x * 0.55, cen.y * (1 - funnelK * 0.35), cen.z * 0.4 - 3);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(this.tmp.d);

    rr.setRenderTarget(out);
    rr.clear(true, true, true);
    rr.render(this.world, this.cam);
    rr.resetState();
    return {};
  }

  override dispose() {
    this.inst?.dispose();
    super.dispose();
  }
}
