// fulmen — electrical register: a night thunderhead over dark terrain. Sheet
// lightning flickers inside the cloud volume, a stepped leader probes downward,
// then the return stroke — blinding, branching, re-striking through the same
// channel as real flashes do. The catalog's first electrical scene: light here
// is plasma, milliseconds of it, and everything else is darkness.
// All timing closed-form in t: strike schedule, leader progression, flash envelopes.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { smoothstep } from '../../engine/util';

// deterministic sin-hash in [0,1)
function seed(i: number, salt: number): number {
  const h = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

// ---- the strike schedule --------------------------------------------------
// each strike: leader descends over ~1.4s (faint), return stroke at t0 (blinding),
// then 1-3 re-strikes (dart leaders reuse the channel — real lightning behavior).
interface Strike { leaderStart: number; t0: number; restrikes: number[]; bolt: number }
const STRIKES: Strike[] = [
  { leaderStart: 5.6, t0: 7.0, restrikes: [7.35, 7.8], bolt: 0 },
  { leaderStart: 15.2, t0: 16.6, restrikes: [16.95], bolt: 1 },
  { leaderStart: 24.0, t0: 25.4, restrikes: [25.7, 26.05, 26.5], bolt: 2 },
];

// flash intensity envelope at time t: sum over strikes of return-stroke + restrike
// pulses. attack ~30ms, decay exponential-ish via smoothstep falloff over ~0.5s.
function flashEnv(t: number): number {
  let e = 0;
  for (const s of STRIKES) {
    const all = [s.t0, ...s.restrikes];
    for (let k = 0; k < all.length; k++) {
      const dt = t - all[k]!;
      if (dt < 0 || dt > 0.9) continue;
      const amp = k === 0 ? 1.0 : 0.55; // re-strikes dimmer than the main stroke
      e += amp * Math.exp(-dt * 9.0) * smoothstep(0, 0.02, dt);
    }
  }
  return e;
}
// sheet lightning: internal cloud flicker outside the main strikes — closed-form
// pseudo-random flicker train, deterministic.
function sheetEnv(t: number): number {
  let e = 0;
  for (let n = 0; n < 14; n++) {
    const t0 = 1.5 + seed(n, 40) * 27;
    const dt = t - t0;
    if (dt < 0 || dt > 0.7) continue;
    // suppress sheet flicker near main strikes — the stroke dominates
    e += (0.2 + seed(n, 41) * 0.25) * Math.exp(-dt * 7.0) * smoothstep(0, 0.05, dt);
  }
  const suppress = Math.min(1, flashEnv(t) * 2);
  return e * (1 - suppress);
}

// ---- bolt geometry ---------------------------------------------------------
// recursive branching channel, deterministic. returns line segment list with
// per-segment depth (0 = main channel) and u-along-channel parametrization.
interface Seg { a: THREE.Vector3; b: THREE.Vector3; depth: number; u0: number; u1: number }
function buildBolt(seedBase: number, from: THREE.Vector3, to: THREE.Vector3): Seg[] {
  const segs: Seg[] = [];
  const mainPts: THREE.Vector3[] = [];
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const p = from.clone().lerp(to, u);
    // fractal-ish wander, amplitude shrinking toward endpoints
    const w = Math.sin(u * Math.PI) * 0.9;
    p.x += (seed(seedBase * 100 + i, 1) - 0.5) * w;
    p.z += (seed(seedBase * 100 + i, 2) - 0.5) * w * 0.6;
    mainPts.push(p);
  }
  for (let i = 0; i < mainPts.length - 1; i++) {
    segs.push({ a: mainPts[i]!, b: mainPts[i + 1]!, depth: 0, u0: i / steps, u1: (i + 1) / steps });
  }
  // branches: spawn off the main channel at hashed points, shorter recursive sub-channels
  const nbr = 7 + Math.floor(seed(seedBase, 3) * 4);
  for (let b = 0; b < nbr; b++) {
    const atU = 0.15 + seed(seedBase * 31 + b, 4) * 0.7;
    const idx = Math.floor(atU * steps);
    const origin = mainPts[idx]!.clone();
    const dir = new THREE.Vector3(
      (seed(seedBase * 17 + b, 5) - 0.5) * 1.6,
      -0.5 - seed(seedBase * 17 + b, 6) * 0.7,
      (seed(seedBase * 17 + b, 7) - 0.5) * 1.0,
    );
    const blen = 3 + seed(seedBase * 17 + b, 8) * 3;
    const bsteps = 8;
    let prev = origin.clone();
    for (let i = 1; i <= bsteps; i++) {
      const u = i / bsteps;
      const p = origin.clone().addScaledVector(dir, u * blen * 0.4);
      p.x += (seed(seedBase * 71 + b * 10 + i, 9) - 0.5) * 0.5 * u;
      p.z += (seed(seedBase * 71 + b * 10 + i, 10) - 0.5) * 0.3 * u;
      segs.push({ a: prev.clone(), b: p.clone(), depth: 1, u0: atU, u1: atU });
      prev = p;
    }
  }
  return segs;
}

export default class Fulmen extends Scene {
  private cam = new THREE.PerspectiveCamera(46, W / H, 0.1, 400);
  private world = new THREE.Scene();
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private boltMats: THREE.ShaderMaterial[] = [];
  private boltMeshes: THREE.Mesh[] = [];
  private cloudMat: THREE.ShaderMaterial | null = null;
  private rainMat: THREE.ShaderMaterial | null = null;
  private flashLight: THREE.PointLight | null = null;
  private terrainMat: THREE.MeshStandardMaterial | null = null;

  override async init() {
    const rr = this.ctx.renderer;
    (this as any)._prevShadow = rr.shadowMap.enabled;
    rr.shadowMap.enabled = false; // night flash lighting: no shadow budget needed

    // night sky gradient — storm black with faint horizon glow
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = normalize(vP).y;
          vec3 zenith = vec3(0.008, 0.01, 0.02);
          vec3 horizon = vec3(0.05, 0.06, 0.1);
          gl_FragColor = vec4(mix(horizon, zenith, smoothstep(-0.1, 0.5, h)), 1.0);
        }`,
    });
    this.world.add(new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), skyMat));

    this.world.add(new THREE.HemisphereLight(0x101828, 0x050505, 0.25));

    // ---- terrain: dark rolling silhouette --------------------------------
    const tgeo = new THREE.PlaneGeometry(400, 200, 90, 40);
    tgeo.rotateX(-Math.PI / 2);
    const tp = tgeo.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), z = tp.getZ(i);
      // distant ridge silhouette — higher toward horizon (far -z)
      const ridge = smoothstep(20, -80, z) * (4 + Math.sin(x * 0.05) * 3 + Math.sin(x * 0.13 + 2) * 2);
      tp.setY(i, ridge + Math.sin(x * 0.3) * 0.3 + Math.sin(z * 0.4 + x * 0.1) * 0.4 - 2);
    }
    tgeo.computeVertexNormals();
    this.terrainMat = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 1 });
    const terrain = new THREE.Mesh(tgeo, this.terrainMat);
    terrain.position.set(0, 0, -40);
    this.world.add(terrain);

    // ---- the thunderhead: layered noise billboards, internally lit ---------
    this.cloudMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uFlash: { value: 0 },   // main-stroke flash envelope
        uSheet: { value: 0 },   // internal sheet flicker
        uBoltPos: { value: new THREE.Vector3(0, 30, -30) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vW;
        void main(){
          vUv = uv;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        varying vec2 vUv;
        varying vec3 vW;
        uniform float uTime;
        uniform float uFlash;
        uniform float uSheet;
        uniform vec3 uBoltPos;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){
          vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
        }
        float fbm(vec2 p){
          float v = 0.0, a = 0.5;
          for(int k=0;k<4;k++){ v += noise(p)*a; p *= 2.1; a *= 0.5; }
          return v;
        }
        void main(){
          // cauliflower cloud volume: fbm density, billowing slowly — closed form
          vec2 uv = vUv * vec2(3.0, 1.8);
          float n = fbm(uv + vec2(uTime * 0.008, uTime * 0.002));
          float n2 = fbm(uv * 2.3 - vec2(uTime * 0.005, 0.0));
          float density = smoothstep(0.35, 0.75, n * 0.7 + n2 * 0.4);
          // soft edges
          float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x)
                     * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
          density *= edge;
          // internal illumination: sheet flicker lights the volume diffusely,
          // the main flash lights it pointwise around the bolt top
          float dBolt = distance(vW, uBoltPos);
          float pointGlow = uFlash * 7.0 / (1.0 + dBolt * dBolt * 0.008);
          float inner = uSheet * (0.6 + n * 1.2);
          vec3 dark = vec3(0.012, 0.016, 0.03);
          vec3 lit = vec3(0.45, 0.5, 0.75) * inner + vec3(0.7, 0.75, 1.0) * pointGlow;
          vec3 col = dark + lit * density;
          float alpha = density * 0.92;
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    // three layered planes for parallax depth
    for (let layer = 0; layer < 3; layer++) {
      const cg = new THREE.PlaneGeometry(120 + layer * 30, 34 + layer * 8);
      const cm = new THREE.Mesh(cg, this.cloudMat);
      cm.position.set((layer - 1) * 8, 30 + layer * 3, -55 - layer * 14);
      cm.renderOrder = 2 + layer;
      (this as any)[`_cloud${layer}`] = cm;
      this.world.add(cm);
    }

    // ---- bolts: cylinders per segment with additive plasma shader ----------
    // bolt anchors: cloud base (~y 22) to terrain (~y 0), spread in x
    const anchors = [
      { from: new THREE.Vector3(-6, 24, -38), to: new THREE.Vector3(-8, 0.5, -30) },
      { from: new THREE.Vector3(9, 23, -42), to: new THREE.Vector3(11, 0.5, -33) },
      { from: new THREE.Vector3(-1, 25, -35), to: new THREE.Vector3(1, 0.5, -27) },
    ];
    for (let bi = 0; bi < anchors.length; bi++) {
      const segs = buildBolt(bi + 1, anchors[bi]!.from, anchors[bi]!.to);
      // merge segments into one geometry of thin quads (billboard-ish: use cylinders low-poly)
      const group = new THREE.Group();
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uFlash: { value: 0 },    // return-stroke envelope for THIS bolt
          uLeader: { value: 0 },   // stepped leader progress 0..1
        },
        vertexShader: `
          attribute float aU;
          attribute float aDepth;
          varying float vU;
          varying float vDepth;
          void main(){
            vU = aU;
            vDepth = aDepth;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          varying float vU;
          varying float vDepth;
          uniform float uFlash;
          uniform float uLeader;
          void main(){
            // stepped leader: faint channel visible only below the step front
            float leaderVis = step(vU, uLeader) * 0.16;
            // return stroke: the whole channel erupts; branches dimmer
            float stroke = uFlash * (vDepth < 0.5 ? 1.0 : 0.6);
            float vis = leaderVis * (vDepth < 0.5 ? 1.0 : 0.3) + stroke;
            if (vis < 0.004) discard;
            // plasma white-violet: blue-white core bleeding to violet edge
            vec3 core = vec3(0.9, 0.9, 1.0);
            vec3 halo = vec3(0.5, 0.4, 1.0);
            vec3 col = mix(halo, core, min(1.0, vis)) * vis * 5.0;
            gl_FragColor = vec4(col, min(1.0, vis));
          }`,
      });
      // build merged cylinder geometry
      const geoms: THREE.BufferGeometry[] = [];
      for (const s of segs) {
        const len = s.a.distanceTo(s.b);
        const r = s.depth === 0 ? 0.13 : 0.05;
        const cyl = new THREE.CylinderGeometry(r, r, len, 5, 1, true);
        // orient: cylinder Y-axis along segment
        const mid = s.a.clone().add(s.b).multiplyScalar(0.5);
        const dir = s.b.clone().sub(s.a).normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        cyl.applyQuaternion(quat);
        cyl.translate(mid.x, mid.y, mid.z);
        // per-vertex attributes: u along channel, depth
        const cnt = cyl.attributes.position.count;
        const us = new Float32Array(cnt).fill((s.u0 + s.u1) / 2);
        const ds = new Float32Array(cnt).fill(s.depth);
        cyl.setAttribute('aU', new THREE.BufferAttribute(us, 1));
        cyl.setAttribute('aDepth', new THREE.BufferAttribute(ds, 1));
        geoms.push(cyl);
      }
      // merge manually: concatenate attributes (simple approach — few segments)
      let total = 0;
      for (const g of geoms) total += g.attributes.position.count;
      const pos = new Float32Array(total * 3);
      const nor = new Float32Array(total * 3);
      const au = new Float32Array(total);
      const ad = new Float32Array(total);
      const idx: number[] = [];
      let vo = 0;
      for (const g of geoms) {
        const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.aU, d = g.attributes.aDepth;
        pos.set(p.array as Float32Array, vo * 3);
        nor.set(n.array as Float32Array, vo * 3);
        au.set(u.array as Float32Array, vo);
        ad.set(d.array as Float32Array, vo);
        const gi = g.index;
        if (gi) for (let k = 0; k < gi.count; k++) idx.push(gi.getX(k) + vo);
        vo += p.count;
      }
      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      merged.setAttribute('aU', new THREE.BufferAttribute(au, 1));
      merged.setAttribute('aDepth', new THREE.BufferAttribute(ad, 1));
      merged.setIndex(idx);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 20;
      this.boltMats.push(mat);
      this.boltMeshes.push(mesh);
      this.world.add(mesh);
      // dispose segment source geoms
      for (const g of geoms) g.dispose();
    }

    // ---- rain shaft: fine falling streaks, visible when flash-lit ----------
    const NR = 900;
    const rgeo = new THREE.BufferGeometry();
    const rpos = new Float32Array(NR * 3);
    const rseed = new Float32Array(NR);
    for (let i = 0; i < NR; i++) {
      rpos[i * 3] = (seed(i, 21) - 0.5) * 60;
      rpos[i * 3 + 1] = seed(i, 22) * 25;
      rpos[i * 3 + 2] = -20 - seed(i, 23) * 30;
      rseed[i] = seed(i, 24);
    }
    rgeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
    rgeo.setAttribute('aSeed', new THREE.BufferAttribute(rseed, 1));
    this.rainMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uFlash: { value: 0 } },
      vertexShader: `
        attribute float aSeed;
        varying float vA;
        uniform float uTime;
        uniform float uFlash;
        void main(){
          vec3 p = position;
          float fall = 18.0 + aSeed * 8.0;
          p.y = mod(p.y - uTime * fall, 25.0);
          // rain only shows when light catches it — flash visibility
          vA = (0.02 + uFlash * 0.5) * (0.5 + aSeed * 0.5);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.6 + aSeed) * (120.0 / max(1.0, -mv.z));
        }`,
      fragmentShader: `
        varying float vA;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          float disc = 1.0 - smoothstep(0.2, 1.0, d);
          float alpha = disc * vA;
          if (alpha < 0.008) discard;
          gl_FragColor = vec4(vec3(0.6, 0.7, 0.9) * alpha, alpha);
        }`,
    });
    const rain = new THREE.Points(rgeo, this.rainMat);
    rain.frustumCulled = false;
    rain.renderOrder = 5;
    (this as any)._rainGeo = rgeo;
    this.world.add(rain);

    // flash light: point light at the active bolt position, lights terrain/cloud edges
    this.flashLight = new THREE.PointLight(0x8090ff, 0, 150, 1.6);
    this.flashLight.position.set(0, 12, -30);
    this.world.add(this.flashLight);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const rr = this.ctx.renderer;
    const lt = f.t;

    const flash = flashEnv(lt);
    const sheet = sheetEnv(lt);

    // per-bolt uniforms: leader progression + stroke envelope
    for (let bi = 0; bi < this.boltMats.length; bi++) {
      const s = STRIKES[bi]!;
      const mat = this.boltMats[bi]!;
      // stepped leader progress: 0 before leaderStart, ramps to 1 at t0
      const lp = smoothstep(s.leaderStart, s.t0, lt);
      // this bolt's flash: main + its restrikes
      let be = 0;
      const all = [s.t0, ...s.restrikes];
      for (let k = 0; k < all.length; k++) {
        const dt = lt - all[k]!;
        if (dt < 0 || dt > 0.9) continue;
        be += (k === 0 ? 1.0 : 0.55) * Math.exp(-dt * 9.0) * smoothstep(0, 0.02, dt);
      }
      mat.uniforms.uLeader.value = lp;
      mat.uniforms.uFlash.value = be;
    }

    this.cloudMat!.uniforms.uTime.value = lt;
    this.cloudMat!.uniforms.uFlash.value = flash;
    this.cloudMat!.uniforms.uSheet.value = sheet;
    this.rainMat!.uniforms.uTime.value = lt;
    this.rainMat!.uniforms.uFlash.value = flash;
    this.flashLight!.intensity = flash * 260 + sheet * 10;

    // camera: slow wide push-in on the storm, slight drift; pulls back at the end
    const k = smoothstep(0, 30, lt);
    const az = Math.sin(lt * 0.03) * 0.06;
    const rad = 44 - k * 9;
    this.cam.position.set(Math.sin(az) * rad + k * 3, 5 + k * 2.0, Math.cos(az) * rad * 0.6 + 16);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(k * -2, 14 + Math.sin(lt * 0.05) * 1.5, -35);

    const fwd = this.cam.getWorldDirection(new THREE.Vector3());
    const focusD = new THREE.Vector3(0, 12, -33).sub(this.cam.position).dot(fwd);

    if (!this.main) {
      this.main = new THREE.WebGLRenderTarget(out.width, out.height, {
        type: THREE.HalfFloatType,
        depthTexture: new THREE.DepthTexture(out.width, out.height, THREE.UnsignedInt248Type),
      });
    }
    rr.setRenderTarget(this.main);
    rr.clear(true, true, true);
    rr.render(this.world, this.cam);
    this.dof.render(rr, this.main.texture, this.main.depthTexture!, {
      enabled: true,
      focusDistance: Math.max(1, focusD),
      aperture: 5,
      maxRadius: 8,
      samples: 32,
      near: 0.1,
      far: 400,
    }, out);
    rr.resetState();
    // exposure dips slightly during peak flash so the stroke doesn't clip to pure white
    return { exposure: 1.05 - Math.min(0.2, flash * 0.15), bloom: 0.75, vignette: 0.45 } as PostOverrides;
  }

  override dispose() {
    this.main?.dispose();
    this.cloudMat?.dispose();
    this.rainMat?.dispose();
    (this as any)._rainGeo?.dispose();
    for (const m of this.boltMats) m.dispose();
    for (const m of this.boltMeshes) m.geometry.dispose();
    this.terrainMat?.dispose();
    this.dof.dispose?.();
  }
}
