// cloudfall — atmospheric volumes: a fog bank pouring over a dawn ridge. The catalog's
// first volume study — the fog itself is the subject, not a prop in front of it.
// Layered drifting fog sheets (closed-form curl-ish advection in UV space), light
// shafts leaning through sparse pines, the ridge a dark silhouette. No simulation:
// every wisp position/density is pure f(x, t). Camera drifts forward into the volume
// so the fog passes THROUGH the lens plane.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { smoothstep, mulberry32 } from '../../engine/util';

export default class Cloudfall extends Scene {
  private cam = new THREE.PerspectiveCamera(44, W / H, 0.05, 120);
  private world = new THREE.Scene();
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private fogMats: THREE.ShaderMaterial[] = [];
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3() };

  override async init() {
    const rr = this.ctx.renderer;
    (this as any)._prevShadow = rr.shadowMap.enabled;
    rr.shadowMap.enabled = true;

    // dawn key behind the ridge — the fog is backlit, rim glow pink-gold
    const key = new THREE.DirectionalLight(0xffcf9e, 1.6);
    key.position.set(-3, 4, -6);
    this.world.add(key, new THREE.HemisphereLight(0x35405c, 0x0d0b09, 0.7));

    // dawn sky dome
    const skyGeo = new THREE.SphereGeometry(60, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = normalize(vP).y;
          vec3 zenith = vec3(0.10,0.13,0.24);
          vec3 horizon = vec3(0.85,0.55,0.35);
          vec3 c = mix(horizon, zenith, smoothstep(0.0, 0.45, h));
          float sun = pow(max(0.0, dot(normalize(vP), normalize(vec3(-0.35,0.12,-0.92)))), 24.0);
          c += vec3(1.0,0.75,0.45) * sun * 1.4;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.world.add(new THREE.Mesh(skyGeo, skyMat));

    // the ridge — two overlapping dark ridges for depth parallax (silhouette layers)
    const ridgeMat = new THREE.MeshBasicMaterial({ color: 0x0b0d10 });
    for (const [rz, scale, yoff] of [[-14, 1.0, 0], [-24, 1.6, 1.2]] as const) {
      const shape = new THREE.Shape();
      shape.moveTo(-30, -6);
      const rng = mulberry32(7 + rz);
      for (let x = -30; x <= 30; x += 2) {
        shape.lineTo(x, 1.2 + Math.sin(x * 0.4 + rz) * 0.8 + rng() * 0.9);
      }
      shape.lineTo(30, -6);
      shape.closePath();
      const geo = new THREE.ShapeGeometry(shape);
      const ridge = new THREE.Mesh(geo, ridgeMat);
      ridge.position.set(0, yoff - 1.5, rz);
      ridge.scale.setScalar(scale);
      this.world.add(ridge);
    }

    // sparse pine silhouettes on the near ridge — simple crossed-cone shapes
    const pineMat = new THREE.MeshBasicMaterial({ color: 0x060708 });
    const rng2 = mulberry32(11);
    for (let i = 0; i < 14; i++) {
      const h = 0.8 + rng2() * 1.4;
      const pine = new THREE.Mesh(new THREE.ConeGeometry(h * 0.32, h, 6), pineMat);
      pine.position.set(-8 + rng2() * 16, 0.4 + rng2() * 1.2, -13.5 + rng2() * 1.5);
      this.world.add(pine);
    }

    // --- the fog itself: 26 large soft sheets, each a shader plane whose density is
    // closed-form curl-ish noise advected over time. layered depths so the camera
    // push-in passes through them.
    const rng3 = mulberry32(21);
    for (let i = 0; i < 18; i++) {
      const z = -13 + (i / 18) * 13; // sheets from behind ridge to past the camera path
      const w = 14 + rng3() * 8;
      const h = 3.5 + rng3() * 2.5;
      const geo = new THREE.PlaneGeometry(w, h, 1, 1);
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uSeed: { value: rng3() * 100 },
          uAlpha: { value: 0.045 + rng3() * 0.06 },
        },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uSeed; uniform float uAlpha;
          // value-noise fog density — closed form, advected in x over time, with slow
          // billow in y. soft edges at sheet borders.
          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p){
            vec2 i = floor(p), f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
          }
          void main(){
            vec2 p = vUv * vec2(4.0, 2.0) + vec2(uSeed, 0.0);
            p.x -= uTime * 0.22;
            p.y += sin(uTime * 0.13 + uSeed) * 0.3;
            float n = noise(p) * 0.55 + noise(p * 2.3 + 5.0) * 0.3 + noise(p * 5.1) * 0.15;
            float edge = smoothstep(0.0, 0.18, vUv.x) * (1.0 - smoothstep(0.82, 1.0, vUv.x))
                       * smoothstep(0.0, 0.3, vUv.y) * (1.0 - smoothstep(0.7, 1.0, vUv.y));
            float d = smoothstep(0.32, 0.75, n) * edge * uAlpha;
            gl_FragColor = vec4(vec3(0.92, 0.88, 0.86), d);
          }`,
      });
      const sheet = new THREE.Mesh(geo, mat);
      sheet.position.set((rng3() - 0.5) * 6, 0.8 + rng3() * 2.4, z);
      this.fogMats.push(mat);
      this.world.add(sheet);
    }
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.t;
    const rr = this.ctx.renderer;

    for (const m of this.fogMats) (m.uniforms.uTime as any).value = lt;

    // camera: slow push into the fog bank — sheets pass through the lens plane
    const k = smoothstep(0, 30, lt);
    this.cam.position.set(Math.sin(lt * 0.05) * 0.8, 1.7 + k * 0.5, 6 - k * 8.5);
    this.tmp.b.set(0, 1.4, this.cam.position.z - 8);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(this.tmp.b);
    const focusD = 7.0;

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
      aperture: 3.0,
      maxRadius: 10,
      samples: 36,
      near: 0.05,
      far: 120,
    }, out);
    rr.resetState();
    return {};
  }

  override dispose() {
    const rr = this.ctx.renderer;
    rr.shadowMap.enabled = (this as any)._prevShadow ?? false;
    this.main?.dispose();
    this.dof.dispose();
    this.world.traverse((o: any) => {
      if (o.isMesh) {
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
