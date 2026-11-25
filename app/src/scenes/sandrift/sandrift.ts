// sandrift — aeolian/granular: a macro sand-dune crest at golden hour. Wind streams
// grains off the crest in scalloped ballistic sheets (closed-form particle paths),
// ripple waves migrate across the surface, occasional cascades slump down the lee face.
// The catalog's first granular-physics study — distinct from mercury's fluid cohesion:
// sand is a dispersed solid, and the scene is played in warm raking light and long shadows.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { smoothstep } from '../../engine/util';

// dune heightfield: an analytic crest along x≈0 with a sinuous crestline wandering in z,
// gentle windward slope (z<0 side), steep lee falloff (z>0). Closed-form everywhere.
function duneHeight(x: number, z: number, t: number): number {
  const wander = Math.sin(z * 0.35) * 1.2 + Math.sin(z * 0.13 + 2.0) * 0.8;
  const dx = x - wander;
  // crest profile: smooth asymmetric — gradual up, sharp down after the brink
  const up = smoothstep(-14, 0, dx) * 2.2;
  const down = smoothstep(0, 5, dx) * 2.6;
  let h = up - down + 0.4;
  // broad secondary undulation
  h += Math.sin(z * 0.5 + 1.2) * 0.35 + Math.sin(x * 0.3 + z * 0.2) * 0.15;
  // migrating ripples: fine waves traveling windward->lee, amplitude fading near crest
  const rip = Math.sin(dx * 2.6 - t * 0.5 + Math.sin(z * 1.4) * 0.8) * 0.05;
  h += rip * smoothstep(-12, -2, dx) * (1 - smoothstep(0, 3, dx));
  return h;
}

export default class Sandrift extends Scene {
  private cam = new THREE.PerspectiveCamera(40, W / H, 0.05, 120);
  private world = new THREE.Scene();
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private sandMat: THREE.ShaderMaterial | null = null;
  private grainMat: THREE.ShaderMaterial | null = null;
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3() };

  override async init() {
    const rr = this.ctx.renderer;
    (this as any)._prevShadow = rr.shadowMap.enabled;
    rr.shadowMap.enabled = true;

    // golden hour: warm low sun, cool sky fill
    this.world.add(new THREE.HemisphereLight(0x3550a0, 0x453018, 0.5));
    const sun = new THREE.DirectionalLight(0xffb050, 2.6);
    sun.position.set(-18, 7, -6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.camera.far = 60;
    this.world.add(sun);
    const rim = new THREE.DirectionalLight(0x88a0ff, 0.3);
    rim.position.set(10, 4, 8);
    this.world.add(rim);

    // sky: gradient dome
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = normalize(vP).y;
          vec3 zenith = vec3(0.12, 0.2, 0.42);
          vec3 horizon = vec3(0.98, 0.55, 0.22);
          vec3 col = mix(horizon, zenith, smoothstep(-0.05, 0.5, h));
          col += vec3(1.0, 0.7, 0.35) * pow(max(0.0, 1.0 - abs(h - 0.02) * 8.0), 3.0) * 0.4;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.world.add(new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), skyMat));

    // --- the dune: CPU-displaced grid (static per-frame in motion but displacement is
    // closed-form in t — we bake at init for t=0 and animate ripples in the shader instead.
    // Geometry: fine grid for silhouette fidelity.
    const gw = 60, gd = 60, seg = 190;
    const geo = new THREE.PlaneGeometry(gw, gd, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, duneHeight(x, z, 0));
    }
    geo.computeVertexNormals();

    this.sandMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(-18, 7, -6).normalize() },
        uCamPos: { value: new THREE.Vector3() },
      },
      vertexShader: `
        varying vec3 vN;
        varying vec3 vW;
        void main(){
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        varying vec3 vN;
        varying vec3 vW;
        uniform vec3 uSunDir;
        uniform vec3 uCamPos;
        uniform float uTime;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p){
          vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
        }
        void main(){
          vec3 n = normalize(vN);
          // fine ripple shading: migrating wavefronts perturb the normal — closed-form in t
          float rip = sin(vW.x * 2.6 - uTime * 0.5 + sin(vW.z * 1.4) * 0.8);
          vec3 rn = normalize(n + vec3(rip * 0.16, 0.0, rip * 0.05));
          // grain sparkle: high-frequency noise glints
          float grain = noise(vW.xz * 34.0) * noise(vW.xz * 13.0);
          float diff = max(0.0, dot(rn, uSunDir));
          float sky = 0.35 + 0.3 * max(0.0, rn.y);
          vec3 sandCol = vec3(0.85, 0.6, 0.35);
          vec3 col = sandCol * (diff * vec3(1.3, 0.95, 0.6) + sky * vec3(0.35, 0.42, 0.6) * 0.55);
          // crest highlights + lee shadow darkening via normal orientation
          col *= 0.85 + grain * 0.4;
          // warm glints where grain sparkle faces sun
          col += vec3(1.0, 0.75, 0.4) * pow(grain, 3.0) * diff * 0.9;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const dune = new THREE.Mesh(new THREE.BufferGeometry().copy(geo), this.sandMat);
    this.world.add(dune);

    // --- wind-streamed grains: GPU points, closed-form ballistic+wind paths seeded off
    // the crestline. Each grain cycles: launch at crest, arc downwind, die.
    const N = 4200;
    const posArr = new Float32Array(N * 3); // dummy — real position computed in shader
    const seeds = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      // deterministic hash seeds — the engine invariant demands identical frames across exports
      const h1 = Math.sin(i * 127.1) * 43758.5453;
      const h2 = Math.sin(i * 311.7) * 12543.21;
      const h3 = Math.sin(i * 74.7) * 24634.63;
      const h4 = Math.sin(i * 269.5) * 32231.78;
      seeds[i * 4] = h1 - Math.floor(h1);
      seeds[i * 4 + 1] = h2 - Math.floor(h2);
      seeds[i * 4 + 2] = h3 - Math.floor(h3);
      seeds[i * 4 + 3] = h4 - Math.floor(h4);
    }
    const grainGeo = new THREE.BufferGeometry();
    grainGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    grainGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    this.grainMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uWind: { value: 1 } },
      vertexShader: `
        attribute vec4 aSeed;
        uniform float uTime;
        uniform float uWind;
        varying float vA;
        varying float vSun;
        // analytic crest wander — must match duneHeight's crestline
        float crestX(float z){ return sin(z * 0.35) * 1.2 + sin(z * 0.13 + 2.0) * 0.8; }
        float crestY(float x, float z){
          float wander = crestX(z);
          float dx = x - wander;
          float up = smoothstep(-14.0, 0.0, dx) * 2.2;
          float down = smoothstep(0.0, 5.0, dx) * 2.6;
          return up - down + 0.4 + sin(z * 0.5 + 1.2) * 0.35 + sin(x * 0.3 + z * 0.2) * 0.15;
        }
        void main(){
          float cyc = fract(uTime * (0.1 + aSeed.y * 0.12) + aSeed.x * 9.7);
          // launch point along the crestline
          float z0 = (aSeed.z - 0.5) * 16.0;
          float x0 = crestX(z0) + (aSeed.w - 0.5) * 0.6;
          float y0 = crestY(x0, z0) + 0.03;
          // ballistic: wind throws grains +x and slightly up, gravity pulls down
          float vt = cyc * (1.8 + aSeed.y * 1.4);
          float vx = (2.8 + aSeed.x * 2.6) * uWind;
          float vy = (0.6 + aSeed.w * 1.0) * uWind * (0.4 + aSeed.y * 0.6);
          vec3 p;
          p.x = x0 + vx * vt;
          p.y = y0 + vy * vt - 2.4 * vt * vt;
          p.z = z0 + sin(vt * 5.0 + aSeed.x * 20.0) * 0.12 * vt;
          // grains die when they fall back to the surface-ish or age out
          float ground = crestY(p.x, p.z);
          float above = p.y - ground;
          vA = (1.0 - smoothstep(0.0, 0.15, -above)) * (1.0 - cyc) * smoothstep(0.0, 0.05, cyc);
          vA *= 0.5;
          vSun = aSeed.w;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.5 + aSeed.y * 1.6) * (36.0 / -mv.z);
        }`,
      fragmentShader: `
        varying float vA;
        varying float vSun;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float d = 1.0 - smoothstep(0.15, 0.5, length(c));
          vec3 col = mix(vec3(0.85, 0.55, 0.25), vec3(1.0, 0.78, 0.42), vSun);
          gl_FragColor = vec4(col * 1.15, d * vA);
        }`,
    });
    const grains = new THREE.Points(grainGeo, this.grainMat);
    grains.frustumCulled = false;
    this.world.add(grains);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.t;
    const rr = this.ctx.renderer;

    this.sandMat!.uniforms.uTime.value = lt;
    this.grainMat!.uniforms.uTime.value = lt;
    // wind gusts: slow breathing envelope, closed-form
    this.grainMat!.uniforms.uWind.value = 0.75 + Math.sin(lt * 0.4) * 0.2 + Math.sin(lt * 1.1 + 2.0) * 0.1;

    // camera: low along the crest, slow push forward, crest running through frame diagonal
    const k = smoothstep(0, 30, lt);
    const zc = -6 + lt * 0.35;
    const wander = Math.sin(zc * 0.35) * 1.2 + Math.sin(zc * 0.13 + 2.0) * 0.8;
    const cx = wander - 3.2 + k * 0.6;
    const cy = duneHeight(cx, zc, 0) + 1.1 + Math.sin(lt * 0.13) * 0.08;
    this.cam.position.set(cx, cy, zc);
    this.tmp.b.set(wander + 2.5, duneHeight(wander + 2.5, zc + 6, 0) + 0.6, zc + 6);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(this.tmp.b);
    this.sandMat!.uniforms.uCamPos.value.copy(this.cam.position);

    const fwd = this.cam.getWorldDirection(new THREE.Vector3());
    const focusD = this.tmp.b.clone().sub(this.cam.position).dot(fwd);

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
      focusDistance: focusD,
      aperture: 4.5,
      maxRadius: 10,
      samples: 36,
      near: 0.05,
      far: 120,
    }, out);
    rr.resetState();
    return { exposure: 1.05, bloom: 0.3, vignette: 0.5 } as PostOverrides;
  }

  override dispose() {
    const rr = this.ctx.renderer;
    rr.shadowMap.enabled = (this as any)._prevShadow ?? false;
    this.main?.dispose();
    this.dof.dispose();
    this.world.traverse((o: any) => {
      if (o.isMesh || o.isPoints) {
        o.geometry?.dispose?.();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x?.dispose?.());
        else m?.dispose?.();
      }
      if (o.isLight) o.dispose?.();
    });
    super.dispose();
  }
}
