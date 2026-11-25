// Don't forget to ground yourself when its time USE THE SKILL and REREAD IT ALL
// strata — geological-deep-time register: a canyon wall in compressed time.
// Sedimentary bands shear and carve as erosion proceeds — gullies incise soft
// layers, caprock protrudes, scree fans grow. The wall is a displaced plane:
// vertex-shader ridged noise whose amplitude grows with the erosion clock,
// fragment-shader strata banding by world height with differential retreat.
// All closed-form in t — no simulation, no accumulation.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { smoothstep } from '../../engine/util';
import { CameraRig } from '../../engine/rig';

export default class Strata extends Scene {
  private cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 200);
  private world = new THREE.Scene();
  private rig = new CameraRig('perspective');
  private wallMat: THREE.ShaderMaterial | null = null;
  private wallMesh: THREE.Mesh | null = null;
  private sun: THREE.DirectionalLight | null = null;
  private screeMat: THREE.ShaderMaterial | null = null;
  private screeMesh: THREE.Mesh | null = null;
  private disposables: { dispose(): void }[] = [];

  override async init() {
    // ---- wall: displaced plane, shader does erosion + strata ----
    this.wallMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(-0.5, 0.35, 0.8).normalize() },
      },
      vertexShader: `
        varying vec3 vWPos;
        varying vec3 vNorm;
        uniform float uTime;
        // ridged noise — cheap hash-based value noise
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p); vec2 f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                     mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
        }
        float fbm(vec2 p){
          float v = 0.0; float a = 0.5;
          for(int k=0;k<4;k++){ v += a*noise(p); p *= 2.1; a *= 0.5; }
          return v;
        }
        float layerResist(vec2 p){
          // same banding as the fragment stage: hard layers resist, soft carve
          float warp = noise(p * 0.12) * 2.2;
          float layerId = floor((p.y + 4.0 + warp) * 0.14);
          float lh = hash(vec2(layerId, 7.0));
          // cap layers (lh >= 0.9) resist strongly; bone softest
          return lh < 0.35 ? 1.0 : (lh < 0.65 ? 0.85 : (lh < 0.9 ? 1.15 : 0.3));
        }
        float relief(vec2 p, float ero){
          float gully = fbm(p * vec2(0.35, 0.06));
          float rough = fbm(p * vec2(0.9, 0.5));
          // positive relief = intact rock surface variation; erosion CARVES below
          float r = gully * 0.4 + rough * 0.15;
          float cg = fbm((p + 7.3) * vec2(0.35, 0.06));
          float cr = fbm((p + 7.3) * vec2(0.9, 0.5));
          float carve = (cg * 1.5 + cr * 0.5) * layerResist(p) * ero;
          return r - carve;
        }
        void main(){
          vec3 pos = position;
          float ero = smoothstep(3.0, 24.0, uTime);
          vec2 p = pos.xy;
          float d = relief(p, ero);
          pos.z += d * 2.2;
          // numeric normal
          float e = 0.15;
          float dx = relief(p + vec2(e, 0.0), ero) - d;
          float dy = relief(p + vec2(0.0, e), ero) - d;
          vNorm = normalize(vec3(-dx * 2.2 / e, -dy * 2.2 / e, 1.0));
          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        varying vec3 vWPos;
        varying vec3 vNorm;
        uniform float uTime;
        uniform vec3 uSunDir;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p); vec2 f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                     mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
        }
        void main(){
          float ero = smoothstep(3.0, 24.0, uTime);
          // strata bands by world height, warped slightly
          float warp = noise(vWPos.xy * 0.12) * 2.2;
          float band = fract((vWPos.y + warp) * 0.14);
          float layerId = floor((vWPos.y + warp) * 0.14);
          float lh = hash(vec2(layerId, 7.0));
          // palette: ochre / rust / bone / caprock dark
          vec3 ochre = vec3(0.62, 0.42, 0.22);
          vec3 rust = vec3(0.48, 0.26, 0.15);
          vec3 bone = vec3(0.72, 0.65, 0.52);
          vec3 cap = vec3(0.32, 0.22, 0.16);
          vec3 col = lh < 0.35 ? ochre : (lh < 0.65 ? rust : (lh < 0.9 ? bone : cap));
          // band edge darkening — bedding planes
          float edge = smoothstep(0.0, 0.06, band) * (1.0 - smoothstep(0.94, 1.0, band));
          col *= 0.55 + 0.45 * edge;
          // desert varnish streaks
          float varnish = noise(vWPos.xy * vec2(0.5, 0.05));
          col *= 0.8 + 0.2 * varnish;
          // erosion stain: lower retreats darken as scree dust
          col = mix(col, vec3(0.5, 0.38, 0.26), ero * 0.15 * (1.0 - smoothstep(-14.0, -2.0, vWPos.y)));
          // lighting: sun lambert + sky ambient, warm raking light
          vec3 n = normalize(vNorm);
          float nl = max(0.0, dot(n, uSunDir));
          vec3 sunCol = vec3(1.0, 0.82, 0.6) * 1.6;
          vec3 skyCol = vec3(0.35, 0.4, 0.52) * 0.55;
          vec3 lit = col * (sunCol * nl + skyCol);
          // relief shadowing deepens with erosion — cheap AO from depth
          lit *= 1.0 - ero * 0.1;
          gl_FragColor = vec4(lit, 1.0);
        }`,
    });
    const geo = new THREE.PlaneGeometry(70, 34, 220, 100);
    this.wallMesh = new THREE.Mesh(geo, this.wallMat);
    this.wallMesh.position.set(0, 4, 0);
    this.world.add(this.wallMesh);
    this.disposables.push(geo, this.wallMat);

    // ---- scree: talus fans at the wall base, growing with the erosion clock ----
    this.screeMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3(-0.5, 0.35, 0.8).normalize() } },
      vertexShader: `
        varying vec3 vNorm2;
        varying vec3 vWPos2;
        uniform float uTime;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p); vec2 f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                     mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
        }
        void main(){
          vec3 pos = position;
          float ero = smoothstep(5.0, 24.0, uTime);
          // fan mounds along the base, growing outward with erosion
          float fan = noise(vec2(pos.x * 0.18, 3.7));
          float grow = ero * (0.5 + fan);
          pos.z += grow * 2.4 * (1.0 - abs(pos.y) / 6.0);
          pos.y *= 1.0 + grow * 0.8;
          vNorm2 = vec3(0.0, 1.0, 0.0);
          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWPos2 = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        varying vec3 vNorm2;
        varying vec3 vWPos2;
        uniform vec3 uSunDir;
        void main(){
          vec3 col = vec3(0.5, 0.39, 0.27);
          float nl = max(0.0, dot(normalize(vNorm2), uSunDir));
          vec3 lit = col * (vec3(1.0, 0.82, 0.6) * 1.4 * nl + vec3(0.35, 0.4, 0.52) * 0.5);
          gl_FragColor = vec4(lit, 1.0);
        }`,
    });
    const screeGeo = new THREE.PlaneGeometry(70, 6, 110, 8);
    this.screeMesh = new THREE.Mesh(screeGeo, this.screeMat);
    this.screeMesh.rotation.x = -Math.PI / 2;
    this.screeMesh.position.set(0, -4.5, 1.5);
    this.world.add(this.screeMesh);
    this.disposables.push(screeGeo, this.screeMat);

    this.rig.setLensMm(42);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const rr = this.ctx.renderer;
    const lt = f.t;
    this.wallMat!.uniforms.uTime.value = lt;
    this.screeMat!.uniforms.uTime.value = lt;
    // survey drift along the wall face
    const drift = -6 + lt * 0.4;
    this.rig.orbit([drift, 4, 0], 26, 0.06, Math.sin(lt * 0.05) * 0.03);
    const spec = this.rig.evalCam(lt);
    this.rig.syncToThreeCamera(spec, this.cam);
    rr.setRenderTarget(out);
    rr.setClearColor(0x0d0f14, 1);
    rr.clear(true, true, true);
    rr.render(this.world, this.cam);
    rr.resetState();
    return { exposure: 1.0, bloom: 0.15, vignette: 0.45 } as PostOverrides;
  }

  override dispose() {
    for (const d of this.disposables) d.dispose();
  }
}
