// ferroscan — magnetism/ferrofluid: a macro pool of ferrofluid on a brass plate in a dark
// studio. A cylindrical magnet descends and traverses above the pool; rosette spikes bloom
// in the liquid's surface tracking the field — pure closed-form: spike lattice positions are
// static hex, per-spike amplitude is a closed-form falloff of magnet distance. No simulation.
// The catalog's first electromagnetic-phenomena study; ferrofluid is a black mirror, so the
// whole scene is played in specular reflections.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { smoothstep } from '../../engine/util';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const MAXSPIKES = 37;

export default class Ferroscan extends Scene {
  private cam = new THREE.PerspectiveCamera(38, W / H, 0.05, 80);
  private world = new THREE.Scene();
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private poolMat: THREE.MeshStandardMaterial | null = null;
  private magnet: THREE.Mesh | null = null;
  private arm: THREE.Mesh | null = null;
  private uniforms = {
    uMagnet: { value: new THREE.Vector3(0, 5, 0) },
    uStrength: { value: 0 },
    uTime: { value: 0 },
  };
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3() };

  override async init() {
    const rr = this.ctx.renderer;
    (this as any)._prevShadow = rr.shadowMap.enabled;
    rr.shadowMap.enabled = true;

    // black-mirror materiality is unplayable without an environment: PMREM room studio
    const pm = new THREE.PMREMGenerator(rr);
    this.world.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.world.environmentIntensity = 0.55;
    pm.dispose();
    rr.resetState();

    this.world.add(new THREE.HemisphereLight(0x141c28, 0x030303, 0.35));
    // big soft key — the reflections in the liquid ARE the image
    const key = new THREE.SpotLight(0xfff2e2, 30, 30, 0.5, 0.6, 1.5);
    key.position.set(3.8, 3.6, 2.8);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.world.add(key, key.target);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.55);
    rim.position.set(-4, 2.5, -3.5);
    this.world.add(rim);
    const glint = new THREE.PointLight(0xffffff, 2.2, 6, 1.7);
    glint.position.set(-1.5, 2.2, 2.0);
    this.world.add(glint);

    // brass plate: shallow dish holding the pool
    const dish = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.45, 0.18, 48),
      new THREE.MeshStandardMaterial({ color: 0x8a6b32, roughness: 0.35, metalness: 0.95 }),
    );
    dish.position.y = -0.09;
    dish.receiveShadow = true;
    this.world.add(dish);
    // --- ferrofluid pool: dense disc, GPU vertex displacement — hex-lattice spikes whose
    // amplitude falls off from the magnet position. MeshStandardMaterial + injected
    // displacement so the specular normals are real.
    // NOTE: must be a tessellated grid — CircleGeometry is a fan with NO interior vertices,
    // so vertex displacement would interpolate across giant triangles (single-cone artifact)
    const poolGeo = new THREE.PlaneGeometry(4.4, 4.4, 150, 150);
    poolGeo.rotateX(-Math.PI / 2);
    // hex lattice of spike anchors, radius up to ~1.7 — count 37 (1+6+12+18)
    const anchors: number[] = [];
    const ringR = [0, 0.42, 0.84, 1.26];
    const ringN = [1, 6, 12, 18];
    for (let ring = 0; ring < 4; ring++) {
      for (let k = 0; k < ringN[ring]; k++) {
        const a = ring === 0 ? 0 : (k / ringN[ring]) * Math.PI * 2 + ring * 0.35;
        anchors.push(Math.cos(a) * ringR[ring], Math.sin(a) * ringR[ring]);
      }
    }
    while (anchors.length < MAXSPIKES * 2) anchors.push(99, 99);
    this.poolMat = new THREE.MeshStandardMaterial({
      color: 0x0d0e12,
      roughness: 0.06,
      metalness: 0.8,
    });
    const u = this.uniforms;
    this.poolMat.onBeforeCompile = (sh) => {
      sh.uniforms.uMagnet = u.uMagnet;
      sh.uniforms.uStrength = u.uStrength;
      sh.uniforms.uTime = u.uTime;
      sh.vertexShader = `
        uniform vec3 uMagnet;
        uniform float uStrength;
        uniform float uTime;
        varying vec3 vWp;
        varying vec2 vXz;
      ` + sh.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        {
          vec2 anchors[${MAXSPIKES}];
          ${Array.from({ length: MAXSPIKES }, (_, i) => `anchors[${i}] = vec2(${anchors[i * 2].toFixed(3)}, ${anchors[i * 2 + 1].toFixed(3)});`).join('\n          ')}
          float h = 0.0;
          vec2 grad = vec2(0.0);
          vec2 pxz = position.xz;
          vXz = position.xz;
          for (int i = 0; i < ${MAXSPIKES}; i++) {
            vec2 sp = anchors[i];
            if (sp.x > 50.0) continue;
            float planar = length(uMagnet.xz - sp);
            float d3 = sqrt(planar * planar + uMagnet.y * uMagnet.y);
            float field = uStrength / (1.0 + d3 * d3 * 1.5);
            float w = 0.075 - field * 0.09;
            w = max(w, 0.033);
            float dd2 = dot(pxz - sp, pxz - sp);
            float g1 = exp(-dd2 / (w * w)) * field * 0.85;
            float g2 = exp(-dd2 / 0.09) * field * 0.03;
            h += g1 + g2;
            // d/dx exp(-dd2/w2) = exp * (-2(x-spx)/w2)
            grad += g1 * (-2.0 * (pxz - sp) / (w * w)) + g2 * (-2.0 * (pxz - sp) / 0.09);
          }
          h += sin(pxz.x * 9.0 + uTime * 1.7) * sin(pxz.y * 7.0 - uTime * 1.3) * 0.004 * (0.3 + uStrength);
          transformed.y += h;
          // exact analytic normal from the displacement gradient: n = normalize(-dh/dx, 1, -dh/dz)
          vNormal = normalize(normalMatrix * normalize(vec3(-grad.x, 1.0, -grad.y)));
        }
      `);
      sh.fragmentShader = ('varying vec2 vXz;\n' + sh.fragmentShader).replace('void main() {', 'void main() {\n        if (length(vXz) > 2.19) discard;');
    };
    const pool = new THREE.Mesh(poolGeo, this.poolMat);
    pool.position.y = 0.015;
    pool.receiveShadow = true;
    this.world.add(pool);

    // the magnet: brushed-steel cylinder with a brass collar, on a slim arm from above-frame
    const magMat = new THREE.MeshStandardMaterial({ color: 0x99a0a8, roughness: 0.3, metalness: 0.95 });
    this.magnet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 32), magMat);
    this.magnet.castShadow = true;
    this.world.add(this.magnet);
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.26, 0.12, 32),
      new THREE.MeshStandardMaterial({ color: 0x8a6b32, roughness: 0.35, metalness: 0.95 }),
    );
    collar.position.y = 0.28;
    this.magnet.add(collar);
    this.arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 3.4, 12),
      new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.8 }),
    );
    this.arm.position.y = 2.0;
    this.magnet.add(this.arm);
  }

  private magnetPose(t: number, out: THREE.Vector3): number {
    // choreography in closed form:
    //  0–6s:  magnet high above center, descending — pool mirror-flat
    //  6–18s: slow traverse across the pool, working height — spikes bloom and track
    // 18–26s: hover near center, slow circular drift — full rosette
    // 26–30s: lift away — spikes subside
    if (t < 6) {
      const k = smoothstep(0, 6, t);
      out.set(0, 3.4 - k * 2.1, 0);
      return k * 0.55;
    } else if (t < 18) {
      const lt = t - 6;
      const k = smoothstep(0, 12, lt);
      const x = -1.35 + k * 2.7;
      const z = Math.sin(k * Math.PI) * 0.5;
      const bob = Math.sin(lt * 0.9) * 0.1;
      out.set(x, 1.15 + bob, z);
      return 0.85;
    } else if (t < 26) {
      const lt = t - 18;
      const a = lt * 0.45;
      out.set(Math.cos(a) * 0.4, 1.0, Math.sin(a) * 0.4);
      return 1.0;
    } else {
      const k = smoothstep(26, 30, t);
      out.set(0.3, 1.0 + k * 2.6, 0);
      return (1 - k) * 0.9;
    }
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.t;
    const rr = this.ctx.renderer;

    const strength = this.magnetPose(lt, this.tmp.a);
    this.magnet!.position.copy(this.tmp.a);
    this.uniforms.uMagnet.value.copy(this.tmp.a);
    // liquid responds at the surface — effective magnet height above the pool matters
    this.uniforms.uMagnet.value.y = Math.max(0.1, this.tmp.a.y - 0.25);
    this.uniforms.uStrength.value = strength;
    this.uniforms.uTime.value = lt;

    // camera: macro, low slow arc, gentle push-in across the build
    const az = -0.6 + lt * 0.03;
    const rad = 5.6 - smoothstep(4, 22, lt) * 1.2;
    const cy = 1.5 - smoothstep(6, 20, lt) * 0.5;
    this.cam.position.set(Math.sin(az) * rad, cy, Math.cos(az) * rad);
    this.cam.up.set(0, 1, 0);
    this.tmp.b.set(0, 0.35, 0);
    this.cam.lookAt(this.tmp.b);

    // DoF focus tracks the magnet's spike bloom point on the pool surface
    this.tmp.b.set(this.tmp.a.x * 0.6, 0.2, this.tmp.a.z * 0.6);
    const focusD = this.cam.position.distanceTo(this.tmp.b);

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
      aperture: 4.0,
      maxRadius: 11,
      samples: 36,
      near: 0.05,
      far: 80,
    }, out);
    rr.resetState();
    return { exposure: 1.05, bloom: 0.35, vignette: 0.55 } as PostOverrides;
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
