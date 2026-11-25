// verdant — a pea seedling in time-compressed growth. The catalog's first organic-growth
// register: nothing in it moves biologically before this. A seed cracks in the dark, the
// plumule hook rises circumnutating (the seeking spiral all climbing plants sweep), two
// cotyledons open like hands, the first true leaf unfurls with backlit veins, and a
// tendril reaches out curling for purchase. Everything is procedural geometry regenerated
// as pure f(t) each frame — growth IS the subject, so the camera nearly holds still.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../../engine/scene';
import { W, H } from '../../engine/gl';
import { DepthDoFPass } from '../../engine/dof';
import { smoothstep } from '../../engine/util';

// --- growth clock --------------------------------------------------------------
// staged development: each organ has a birth time and a growth curve in [0,1].
// the piece compresses ~10 days into 30 seconds.
const T_CRACK = 3.0;     // seed coat splits
const T_HOOK = 5.0;      // plumule hook breaks surface
const T_RISE = 16.0;     // stem mostly extended
const T_COTY = 13.0;     // cotyledons begin opening
const T_LEAF = 17.0;     // true leaf unfurls
const T_TENDRIL = 21.0;  // tendril reaches

function stemGrowth(t: number): number {
  return smoothstep(T_HOOK, T_RISE, t);
}
function cotyOpen(t: number): number {
  return smoothstep(T_COTY, T_COTY + 6, t);
}
function leafUnfurl(t: number): number {
  return smoothstep(T_LEAF, T_LEAF + 7, t);
}
function tendrilReach(t: number): number {
  return smoothstep(T_TENDRIL, T_TENDRIL + 7, t);
}

// circumnutation: the shoot tip sweeps slow ellipses as it rises — the seeking motion.
// amplitude grows with stem length; period ~4s (compressed from ~2h in life).
function nutation(t: number, out: THREE.Vector2): THREE.Vector2 {
  const w = (2 * Math.PI) / 4.2;
  const amp = 0.22 * stemGrowth(t);
  out.set(amp * Math.cos(w * t), amp * 0.7 * Math.sin(w * t));
  return out;
}

// --- stem path -------------------------------------------------------------------
// the stem is a vertical-ish curve from the seed (origin) to the moving tip.
// the hook: young stems rise bent over (protecting the meristem), straightening later.
function stemCurve(t: number): THREE.CatmullRomCurve3 {
  const g = stemGrowth(t);
  const nut = nutation(t, new THREE.Vector2());
  const hookK = 1 - smoothstep(T_COTY - 2, T_COTY + 2, t); // 1 = fully hooked, 0 = straight
  const H = 2.3 * g; // stem height
  const pts: THREE.Vector3[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    // base rises straight; the tip region bends over when hooked, and nutates
    const bend = hookK * Math.pow(f, 2.2) * 0.85;
    const x = nut.x * Math.pow(f, 1.6) + bend * 0.55;
    const z = nut.y * Math.pow(f, 1.6);
    const y = H * f - bend * 0.35 * f;
    pts.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(pts);
}

// --- leaf surface ---------------------------------------------------------------
// parametric leaf: heart-ish outline, folded along the midrib by angle `fold` (rad,
// pi = flat open, small = folded shut), curled tip-to-base by `curl`.
// u in [0,1] along midrib base->tip, v in [-1,1] across.
function leafPoint(u: number, v: number, len: number, wid: number, fold: number, curl: number, out: THREE.Vector3): THREE.Vector3 {
  // outline: widest at u~0.35, pointed tip
  const widthProfile = Math.sin(Math.PI * Math.pow(u, 0.72)) * (1 - 0.25 * u);
  const halfW = wid * widthProfile;
  // midrib spine curves backward as it unfurls (curl>0 = still curled toward base)
  const spineAng = curl * 2.4 * u;
  const spineR = len / (1 + curl * 1.6);
  const sy = spineR * Math.sin((1 - curl * 0.4) * u * 1.35);
  const curlK = curl < 0.08 ? curl / 0.08 : 1;
  const sz = -spineR * (1 - Math.cos((1 - curl * 0.4) * u * 1.35)) * curlK - curl * 0.18 * len * u * u;
  // laminar surface: v folds symmetric about midrib
  const side = Math.abs(v);
  const foldDrop = (1 - Math.cos(side * Math.PI * 0.5)) * halfW * Math.cos(fold);
  const across = v * halfW * Math.sin(fold);
  // gentle laminar ripple
  const ripple = 0.03 * len * Math.sin(v * 4.2 + u * 6.0) * side;
  out.set(across, sy - foldDrop * 0.3 + ripple * 0.4, sz + foldDrop + spineAng * 0.02 * len);
  return out;
}

function buildLeafGeometry(len: number, wid: number, fold: number, curl: number, segU = 22, segV = 10): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= segU; i++) {
    for (let j = 0; j <= segV; j++) {
      const u = i / segU;
      const v = (j / segV) * 2 - 1;
      leafPoint(u, v, len, wid, fold, curl, p);
      pos.push(p.x, p.y, p.z);
      uv.push(u, (v + 1) / 2);
    }
  }
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j;
      const b = a + 1;
      const c = a + segV + 1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// leaf material: backlight translucency faked with double-side lambert-ish shading +
// vein pattern in a custom shader — veins read when the sun is behind the leaf.
function makeLeafMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: new THREE.Vector3(0.2, 0.5, -0.8).normalize() },
      uBase: { value: new THREE.Color(0x2e6b1e) },
      uVein: { value: new THREE.Color(0x9ccf6a) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vWPos; varying vec2 vUv;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir; uniform vec3 uBase; uniform vec3 uVein;
      varying vec3 vN; varying vec3 vWPos; varying vec2 vUv;
      void main() {
        vec3 n = normalize(vN);
        // veins: midrib + lateral veins branching at angles — procedural lines in uv space
        float midrib = 1.0 - smoothstep(0.0, 0.035, abs(vUv.y - 0.5));
        float lat = 0.0;
        for (int k = 0; k < 6; k++) {
          float uk = 0.12 + 0.14 * float(k);
          float slope = 2.6;
          float d1 = abs((vUv.y - 0.5) - (vUv.x - uk) * slope * 0.5);
          float d2 = abs((vUv.y - 0.5) + (vUv.x - uk) * slope * 0.5);
          float m = smoothstep(uk - 0.02, uk + 0.25, vUv.x);
          lat = max(lat, (1.0 - smoothstep(0.0, 0.018, min(d1, d2))) * m * (1.0 - vUv.x * 0.5));
        }
        float vein = clamp(midrib + lat * 0.8, 0.0, 1.0);
        // lighting: diffuse + strong translucency when sun is behind (n . sun negative)
        float diff = max(dot(n, uSunDir), 0.0) * 0.55;
        float back = max(dot(-n, uSunDir), 0.0);
        vec3 col = uBase * (0.55 + diff);
        // translucent glow — veins lighter where light passes through
        col += uVein * back * (0.35 + vein * 0.85);
        col += uVein * vein * 0.10;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.DoubleSide,
  });
}

// tapered tube along curve — stem/tendril builder
function tubeAlong(curve: THREE.Curve<THREE.Vector3>, radius0: number, radius1: number, radial = 7, segs = 40): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos: number[] = [];
  const idx: number[] = [];
  const pt = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const f = i / segs;
    curve.getPointAt(f, pt);
    const r = radius0 + (radius1 - radius0) * f;
    const N = frames.normals[Math.min(i, segs - 1)];
    const B = frames.binormals[Math.min(i, segs - 1)];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const cx = Math.cos(a) * r, cy = Math.sin(a) * r;
      pos.push(pt.x + N.x * cx + B.x * cy, pt.y + N.y * cx + B.y * cy, pt.z + N.z * cx + B.z * cy);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + 1;
      const c = a + radial + 1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export default class Verdant extends Scene {
  private cam = new THREE.PerspectiveCamera(40, W / H, 0.05, 60);
  private world = new THREE.Scene();
  private dof = new DepthDoFPass();
  private main: THREE.WebGLRenderTarget | null = null;
  private stemMesh: THREE.Mesh | null = null;
  private tendrilMesh: THREE.Mesh | null = null;
  private cotyL: THREE.Mesh | null = null;
  private cotyR: THREE.Mesh | null = null;
  private leafMesh: THREE.Mesh | null = null;
  private leafMat = makeLeafMaterial();
  private stemMat = new THREE.MeshStandardMaterial({ color: 0x649a38, roughness: 0.5, metalness: 0.0 });
  private tendrilMat = new THREE.MeshStandardMaterial({ color: 0x8cc455, roughness: 0.42, metalness: 0.0 });
  private tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() };

  override async init() {
    const rr = this.ctx.renderer;
    (this as any)._prevShadow = rr.shadowMap.enabled;
    (this as any)._prevType = rr.shadowMap.type;
    rr.shadowMap.enabled = true;
    rr.shadowMap.type = THREE.PCFShadowMap;

    // lighting: low warm sun BEHIND the seedling — the whole point is translucency —
    // soft cool fill from camera side, faint ground bounce
    const sun = new THREE.DirectionalLight(0xffe0b0, 5.5);
    sun.position.set(0.8, 2.2, -3.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    const fill = new THREE.HemisphereLight(0x4a5878, 0x2a2118, 2.0);
    const front = new THREE.DirectionalLight(0xbfd0e8, 1.7);
    front.position.set(-1.5, 1.2, 3.5);
    this.world.add(sun, front, fill);

    // seed husk: half-buried sphere, static — the anchor of the shot
    // seed husk as two half-shells — they crack apart when the shoot emerges
    const huskMat = new THREE.MeshStandardMaterial({ color: 0x8a7148, roughness: 0.85, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const half = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 24, 18, side < 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI),
        huskMat,
      );
      half.scale.set(1, 0.72, 1);
      half.position.set(0, -0.06, 0);
      half.userData.side = side;
      this.world.add(half);
      (this as any)['husk' + (side < 0 ? 'L' : 'R')] = half;
    }

    // soil line: dark disc floor catching the backlight rim
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(30, 48),
      new THREE.MeshStandardMaterial({ color: 0x0a0805, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.16;
    floor.receiveShadow = true;
    this.world.add(floor);

    this.leafMat.uniforms.uSunDir!.value.copy(sun.position).normalize();
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const lt = f.t;
    const rr = this.ctx.renderer;

    // husk crack: shells part and tilt outward as the shoot emerges
    const crack = smoothstep(T_CRACK, T_CRACK + 3.5, lt);
    for (const key of ['huskL', 'huskR'] as const) {
      const half = (this as any)[key] as THREE.Mesh | undefined;
      if (half) {
        const side = half.userData.side as number;
        half.position.x = side * crack * 0.09;
        half.rotation.z = side * crack * 0.45;
      }
    }

    // --- regenerate growing geometry as pure f(t)
    const g = stemGrowth(lt);
    if (this.stemMesh) this.stemMesh.visible = g > 0.001;
    if (this.cotyL) this.cotyL.visible = cotyOpen(lt) > 0.001 && g > 0.001;
    if (this.cotyR) this.cotyR.visible = cotyOpen(lt) > 0.001 && g > 0.001;
    if (this.leafMesh) this.leafMesh.visible = leafUnfurl(lt) > 0.001 && g > 0.001;
    if (this.tendrilMesh) this.tendrilMesh.visible = tendrilReach(lt) > 0.001 && g > 0.001;
    if (g > 0.001) {
      const curve = stemCurve(lt);
      const geom = tubeAlong(curve, 0.024, 0.013);
      if (!this.stemMesh) {
        this.stemMesh = new THREE.Mesh(geom, this.stemMat);
        this.stemMesh.castShadow = true;
        this.world.add(this.stemMesh);
      } else {
        this.stemMesh.geometry.dispose();
        this.stemMesh.geometry = geom;
      }

      // tip frame: position + direction for attaching organs
      const tip = curve.getPointAt(1);
      const tangent = curve.getTangentAt(1).normalize();

      // cotyledons: fleshy pair at the first node (60% up the stem), opening apart
      const co = cotyOpen(lt);
      if (co > 0.001) {
        const nodeF = 0.55;
        const node = curve.getPointAt(nodeF);
        const openAngle = 0.15 + co * 1.35; // rad apart from vertical cluster
        const sizeC = 0.36 + 0.16 * smoothstep(T_COTY, T_COTY + 4, lt);
        for (const side of [-1, 1]) {
          const fold = 0.35 + (1 - co) * 1.6; // folded when young — pi/2-ish shut
          const geo = buildLeafGeometry(sizeC, sizeC * 0.62, Math.PI - fold, 0.12, 14, 8);
          const mesh = side < 0 ? this.cotyL : this.cotyR;
          if (!mesh) {
            const m = new THREE.Mesh(geo, this.leafMat);
            m.castShadow = true;
            this.world.add(m);
            if (side < 0) this.cotyL = m; else this.cotyR = m;
          } else {
            mesh.geometry.dispose();
            mesh.geometry = geo;
          }
          const target = side < 0 ? this.cotyL! : this.cotyR!;
          target.position.copy(node);
          target.rotation.set(0, 0, 0);
          // orient: leaf plane extends outward/downward from node, rotating apart as they open
          target.rotation.y = side * openAngle + Math.PI / 2;
          target.rotation.x = 0.5 - co * 0.65;
        }
      }

      // true leaf at the tip: unfurls late, curled at first
      const lu = leafUnfurl(lt);
      if (lu > 0.001) {
        const curl = 1 - lu;
        const fold = Math.PI - (0.5 + lu * 0.9);
        const geo = buildLeafGeometry(0.62, 0.30, fold, curl, 22, 10);
        if (!this.leafMesh) {
          this.leafMesh = new THREE.Mesh(geo, this.leafMat);
          this.leafMesh.castShadow = true;
          this.world.add(this.leafMesh);
        } else {
          this.leafMesh.geometry.dispose();
          this.leafMesh.geometry = geo;
        }
        this.leafMesh.position.copy(tip);
        // leaf extends along tip tangent, tilting outward as it unfurls
        this.leafMesh.rotation.set(0, 0, 0);
        const yaw = Math.atan2(tangent.x, tangent.z);
        this.leafMesh.rotation.y = yaw + 0.6;
        this.leafMesh.rotation.x = -(0.9 - lu * 0.55);
      }

      // tendril: thin spiral reaching from near the tip, extending and curling
      const tr = tendrilReach(lt);
      if (tr > 0.001) {
        const pts: THREE.Vector3[] = [];
        const L = 0.85 * tr;
        const turns = 3.2 + 1.8 * tr;
        const N = 40;
        const base = curve.getPointAt(0.9);
        for (let i = 0; i <= N; i++) {
          const u = i / N;
          // reaches outward (+x bias) with a curling tip — helix radius shrinks at end
          const helixR = 0.17 * (1 - u * 0.45) * smoothstep(0.15, 0.55, u);
          const a = turns * 2 * Math.PI * u + lt * 0.35; // slow seeking rotation
          pts.push(new THREE.Vector3(
            base.x + L * u * 0.85 + Math.cos(a) * helixR,
            base.y + L * u * 0.35 + Math.sin(a) * helixR * 0.6,
            base.z + Math.sin(a + 1.3) * helixR,
          ));
        }
        const tcurve = new THREE.CatmullRomCurve3(pts);
        const geo = tubeAlong(tcurve, 0.016, 0.006, 5, 44);
        if (!this.tendrilMesh) {
          this.tendrilMesh = new THREE.Mesh(geo, this.tendrilMat);
          this.world.add(this.tendrilMesh);
        } else {
          this.tendrilMesh.geometry.dispose();
          this.tendrilMesh.geometry = geo;
        }
      }
    }

    // --- camera: macro portrait, slow push with a slight arc — subject moves, camera
    // nearly holds still. focus racks from the seed to the rising tip.
    const k = smoothstep(0, 30, lt);
    const az = 0.35 + 0.3 * k;
    const radius = 2.05 - 0.62 * k;
    const camH = 0.55 + 0.75 * smoothstep(6, 24, lt);
    this.cam.position.set(radius * Math.sin(az), camH, radius * Math.cos(az));
    // look at a point that rises with the seedling
    const lookRise = 1.62 * smoothstep(5, 22, lt);
    this.tmp.b.set(0.12 + 0.1 * k, 0.08 + lookRise, 0);
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(this.tmp.b);

    const focusD = this.tmp.c.copy(this.tmp.b).sub(this.cam.position).length();

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
      aperture: 0.06,
      maxRadius: 16,
      samples: 36,
      near: 0.05,
      far: 60,
    }, out);
    rr.resetState();
    return {};
  }

  override dispose() {
    const rr = this.ctx.renderer;
    rr.shadowMap.enabled = (this as any)._prevShadow ?? false;
    rr.shadowMap.type = (this as any)._prevType ?? THREE.PCFShadowMap;
    this.main?.dispose();
    this.dof.dispose();
    for (const m of [this.stemMesh, this.cotyL, this.cotyR, this.leafMesh, this.tendrilMesh]) {
      m?.geometry.dispose();
    }
    this.leafMat.dispose();
    this.stemMat.dispose();
    this.tendrilMat.dispose();
    super.dispose();
  }
}
