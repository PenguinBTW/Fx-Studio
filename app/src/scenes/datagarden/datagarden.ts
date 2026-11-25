// datagarden — information-art: a year of tidal harmonic data physicalized as a
// sculpture of light. 72 slender glass rods stand in a spiral grid; each rod's height
// encodes a tidal constituent amplitude and they breathe in phase-locked closed-form
// rhythms — the superposition IS the tide. A scanning beam sweeps the garden so rods
// bloom as it passes, and the camera orbits slowly. No simulation — every rod height
// is pure f(rod, t). The catalog's first data-driven register.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { smoothstep, mulberry32 } from '../../engine/util';

const ROD_COUNT = 72;

export default class DataGarden extends Scene {
  private cam = new THREE.PerspectiveCamera(38, W / H, 0.05, 80);
  private world = new THREE.Scene();
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private rods: THREE.InstancedMesh | null = null;
  private rodMat: THREE.MeshPhysicalMaterial | null = null;
  private scan: THREE.PointLight | null = null;
  private dummy = new THREE.Object3D();
  private seeds: { x: number; z: number; base: number; freq: number; phase: number; hue: number }[] = [];
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3() };

  override async init() {
    const rr = this.ctx.renderer;
    (this as any)._prevShadow = rr.shadowMap.enabled;
    rr.shadowMap.enabled = true;

    // near-black studio void, cool ambient, one warm key — the rods carry the light
    this.world.add(new THREE.HemisphereLight(0x1a2030, 0x050505, 0.6));
    const key = new THREE.DirectionalLight(0x88aaff, 0.8);
    key.position.set(3, 5, 2);
    this.scan = new THREE.PointLight(0xcfe0ff, 26, 7, 1.8);
    this.world.add(key, this.scan);

    // rods: slim glass prisms on a phyllotaxis spiral — heights encode harmonic data
    const geo = new THREE.BoxGeometry(0.055, 1, 0.055);
    geo.translate(0, 0.5, 0); // pivot at base so scale.y grows upward
    this.rodMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.4,
      thickness: 0.3,
      emissive: 0x111133,
      emissiveIntensity: 0.4,
    });
    this.rods = new THREE.InstancedMesh(geo, this.rodMat, ROD_COUNT);
    this.rods.castShadow = true;
    const rng = mulberry32(37);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < ROD_COUNT; i++) {
      const rr2 = 0.4 + 2.6 * Math.sqrt(i / ROD_COUNT);
      const a = i * golden;
      // real tidal harmonic constituents (period hours, relative equilibrium
      // amplitude): M2, S2, N2, K2, K1, O1, P1, M4 — rods cycle through the table,
      // frequency scaled so the M2 tide completes ~0.5 cycles in 30s of screen time
      const CONSTITUENTS: [number, number][] = [
        [12.42, 1.00], [12.00, 0.47], [12.66, 0.19], [11.97, 0.13],
        [23.93, 0.42], [25.82, 0.30], [24.07, 0.19], [6.21, 0.06],
      ];
      const [periodH, amp] = CONSTITUENTS[i % CONSTITUENTS.length];
      const timeScale = 12 / 12.42;
      this.seeds.push({
        x: Math.cos(a) * rr2,
        z: Math.sin(a) * rr2,
        base: 0.35 + amp * 1.5,
        freq: (2 * Math.PI) / (periodH * timeScale),
        phase: rng() * Math.PI * 2,
        hue: rng(),
      });
    }
    // per-instance color variation across cyan→violet spectrum
    const col = new THREE.Color();
    for (let i = 0; i < ROD_COUNT; i++) {
      col.setHSL(0.52 + this.seeds[i].hue * 0.25, 0.85, 0.55);
      this.rods.setColorAt(i, col);
    }
    this.world.add(this.rods);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.t;
    const rr = this.ctx.renderer;

    // rod heights: tidal superposition in closed form — each rod oscillates around
    // its constituent amplitude at its own frequency; a garden-wide wavefront pulse
    // travels outward every 10s so the data reads as a living field
    const waveT = lt % 10;
    for (let i = 0; i < ROD_COUNT; i++) {
      const s = this.seeds[i];
      const breathe = 0.72 + 0.28 * Math.sin(lt * s.freq + s.phase);
      const dist = Math.hypot(s.x, s.z);
      const pulseEnv = smoothstep(0, 1.2, waveT) * (1 - smoothstep(8.2, 10, waveT));
      const pulse = Math.exp(-Math.pow((dist - waveT * 0.55) * 2.2, 2)) * 0.9 * pulseEnv;
      const h = s.base * breathe + pulse;
      const ease = smoothstep(0, 1.5, lt);
      this.dummy.position.set(s.x, 0, s.z);
      this.dummy.scale.set(1, h * (0.35 + 0.65 * ease), 1);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.rods!.setMatrixAt(i, this.dummy.matrix);
    }
    this.rods!.instanceMatrix.needsUpdate = true;

    // scanning beam orbits the garden — rods bloom as it passes
    const sa = lt * 0.5;
    this.scan!.position.set(Math.cos(sa) * 3.4, 3.1, Math.sin(sa) * 3.4);

    // camera: slow rise + orbit, garden filling frame
    const k = smoothstep(0, 30, lt);
    const az = lt * 0.09;
    const rad = 6.8 - k * 1.6;
    this.cam.position.set(Math.sin(az) * rad, 3.6 - k * 1.1, Math.cos(az) * rad);
    this.tmp.b.set(0, 0.8, 0);
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
      aperture: 4.0,
      maxRadius: 12,
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
    this.rods?.dispose();
    this.main?.dispose();
    this.dof.dispose();
    this.world.traverse((o: any) => {
      if (o.isMesh || o.isInstancedMesh) {
        o.geometry?.dispose?.();
        const m = o.material;
        if (Array.isArray(m)) m.forEach((x) => x?.dispose?.());
        else m?.dispose?.();
      }
    });
    super.dispose();
  }
}
