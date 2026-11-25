// pennant — cloth/textile dynamics: a silk banner rippling in wind. The catalog's
// first textile register. Cloth displacement is pure closed-form wave superposition
// f(x, y, t) — pinned at the hoist, amplitude growing toward the fly end, gusts
// modulating the whole field — no simulation anywhere. Silk reads through three.js
// physical sheen, backlit against a dusk sky so the folds carry rim light.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { smoothstep } from '../../engine/util';

const CLOTH_W = 3.2;
const CLOTH_H = 1.15;
const SEG_X = 96;
const SEG_Y = 32;

// closed-form cloth displacement: superposed traveling waves, amplitude scaled by
// distance from the hoist (x01) and gusting over time. Returns offset perpendicular
// to the cloth plane plus a small in-plane billow.
function clothZ(x01: number, y01: number, t: number): { z: number; sag: number } {
  const amp = 0.06 + 0.42 * x01 * x01; // pinned at hoist, free at fly
  const gust = 0.75 + 0.45 * Math.sin(t * 0.5) * Math.sin(t * 0.13 + 1.7);
  const w1 = Math.sin(x01 * 5.5 - t * 3.1 + y01 * 1.2) * 0.55;
  const w2 = Math.sin(x01 * 9.0 - t * 4.6 + y01 * 2.8 + 1.3) * 0.28;
  const w3 = Math.sin(x01 * 16.0 - t * 7.3 - y01 * 4.0) * 0.12;
  const edge = Math.sin(y01 * Math.PI); // mid-cloth displaces most; hem+hoist constrained
  const z = (w1 + w2 + w3) * amp * gust * (0.35 + 0.65 * edge);
  // gravity sag grows when the gust dies — cloth goes slack, never simulated
  const slack = 1 - Math.min(1, Math.max(0, gust * 0.75));
  const sag = slack * x01 * x01 * 0.28;
  return { z, sag };
}

export default class Pennant extends Scene {
  private cam = new THREE.PerspectiveCamera(40, W / H, 0.05, 80);
  private world = new THREE.Scene();
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private cloth: THREE.Mesh | null = null;
  private clothGeo: THREE.PlaneGeometry | null = null;
  private basePos: Float32Array | null = null;
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3() };

  override async init() {
    const rr = this.ctx.renderer;
    (this as any)._prevShadow = rr.shadowMap.enabled;
    rr.shadowMap.enabled = true;

    // dusk backlight rig: low warm key behind-left (rim through the silk), cool fill
    const key = new THREE.DirectionalLight(0xffb070, 2.4);
    key.position.set(-4, 1.6, -3.5);
    key.castShadow = true;
    const fill = new THREE.HemisphereLight(0x33405e, 0x1a1210, 0.8);
    const front = new THREE.DirectionalLight(0xaa99bb, 0.9);
    front.position.set(3, 2, 5);
    this.world.add(key, fill, front);

    const skyGeo = new THREE.SphereGeometry(38, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = normalize(vP).y;
          vec3 zenith = vec3(0.04,0.05,0.10);
          vec3 horizon = vec3(0.45,0.22,0.12);
          vec3 c = mix(horizon, zenith, smoothstep(-0.05, 0.5, h));
          float glow = pow(max(0.0, dot(normalize(vP), normalize(vec3(-0.8,0.05,-0.5)))), 6.0);
          c += vec3(0.55,0.25,0.08) * glow;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.world.add(new THREE.Mesh(skyGeo, skyMat));

    // pole — dark iron, slightly tapered
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.05, 4.4, 12),
      new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.6, metalness: 0.7 }),
    );
    pole.position.set(-1.6, 0, 0);
    pole.castShadow = true;
    this.world.add(pole);
    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x6b5a2e, roughness: 0.35, metalness: 0.9 }),
    );
    finial.position.set(-1.6, 2.24, 0);
    this.world.add(finial);

    // ground — dark moor hint
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(20, 32),
      new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.2;
    ground.receiveShadow = true;
    this.world.add(ground);

    // --- the cloth: crimson silk with sheen, double-sided
    this.clothGeo = new THREE.PlaneGeometry(CLOTH_W, CLOTH_H, SEG_X, SEG_Y);
    const posAttr = this.clothGeo.getAttribute('position');
    this.basePos = new Float32Array(posAttr.array as any);
    const silk = new THREE.MeshPhysicalMaterial({
      color: 0x8a1420,
      roughness: 0.42,
      metalness: 0,
      sheen: 1.0,
      sheenColor: new THREE.Color(0xff8866),
      sheenRoughness: 0.5,
      side: THREE.DoubleSide,
      emissive: 0x30060a,
      emissiveIntensity: 0.5,
    });
    this.cloth = new THREE.Mesh(this.clothGeo, silk);
    // hoist (left edge of plane) at the pole: plane x spans -W/2..W/2 — shift so x=-W/2 sits at pole
    this.cloth.position.set(-1.6 + CLOTH_W / 2, 1.55, 0);
    this.cloth.castShadow = true;
    this.world.add(this.cloth);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.t;
    const rr = this.ctx.renderer;

    // displace cloth vertices — closed-form f(x, y, t); ease-in over the first second
    // so the banner doesn't pop in mid-gust
    const posAttr = this.clothGeo!.getAttribute('position') as THREE.BufferAttribute;
    const ease = smoothstep(0, 1.2, lt);
    const n = posAttr.count;
    for (let i = 0; i < n; i++) {
      const bx = this.basePos![i * 3];
      const by = this.basePos![i * 3 + 1];
      const x01 = (bx + CLOTH_W / 2) / CLOTH_W;
      const y01 = (by + CLOTH_H / 2) / CLOTH_H;
      const { z, sag } = clothZ(x01, y01, lt);
      posAttr.setZ(i, z * ease);
      posAttr.setY(i, by - sag * ease);
    }
    posAttr.needsUpdate = true;
    this.clothGeo!.computeVertexNormals();

    // camera: slow three-quarter orbit around the banner — the cloth must read against sky
    const az = 0.5 + Math.sin(lt * 0.07) * 0.35;
    const rad = 4.6 - smoothstep(0, 30, lt) * 1.1;
    this.cam.position.set(Math.sin(az) * rad, 1.35 + Math.sin(lt * 0.11) * 0.25, Math.cos(az) * rad);
    this.tmp.b.set(0.1, 1.35, 0);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(this.tmp.b);
    const focusD = this.tmp.a.copy(this.tmp.b).sub(this.cam.position).length();

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
      aperture: 0.035,
      maxRadius: 10,
      samples: 36,
      near: 0.05,
      far: 80,
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
    });
    super.dispose();
  }
}
